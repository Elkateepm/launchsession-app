-- Volunteers ask to help on a session; staff accept or decline.
--
-- Booking from the volunteer portal used to put the volunteer straight on
-- the session's team (session_staff). Now it is a request, shown on the
-- session's card with Accept / Decline. Accepting adds them to session_staff
-- exactly as before (so the compliance check in assert_session_staff_valid
-- still runs then), so nothing that reads session_staff changes.
--
-- A separate table, rather than a status on session_staff, because 27 places
-- read session_staff as "who is on the team"; a requested row there would
-- count as cover, appear on registers and be signed in.

create table if not exists public.session_volunteer_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'declined')),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  unique (session_id, user_id)
);

create index if not exists session_volunteer_requests_org_idx
  on public.session_volunteer_requests (org_id, status, session_id);

alter table public.session_volunteer_requests enable row level security;

-- Staff in the organisation: owner, admin, manager, staff.
create or replace function public.is_org_staff(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.org_id = p_org
      and p.role in ('owner', 'admin', 'manager', 'staff')
      and coalesce(p.approval_status, 'approved') = 'approved'
  )
$$;
revoke all on function public.is_org_staff(uuid) from public, anon;
grant execute on function public.is_org_staff(uuid) to authenticated;

drop policy if exists "svr: read own or staff" on public.session_volunteer_requests;
create policy "svr: read own or staff" on public.session_volunteer_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_staff(org_id));

-- A volunteer asks for themselves, in their own organisation, for one of its
-- sessions that has not happened yet and is not cancelled.
drop policy if exists "svr: volunteer asks" on public.session_volunteer_requests;
create policy "svr: volunteer asks" on public.session_volunteer_requests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and org_id = public.get_my_org_id()
    and status = 'requested' and decided_by is null and decided_at is null
    and exists (
      select 1 from public.sessions s
      where s.id = session_volunteer_requests.session_id
        and s.org_id = session_volunteer_requests.org_id
        and s.cancelled_at is null and coalesce(s.status, '') <> 'cancelled'
        and s.session_date >= (now() at time zone 'Europe/London')::date
    )
  );

-- Staff decline (status) ; nobody else updates.
drop policy if exists "svr: staff decide" on public.session_volunteer_requests;
create policy "svr: staff decide" on public.session_volunteer_requests
  for update to authenticated
  using (public.is_org_staff(org_id))
  with check (public.is_org_staff(org_id));

-- The volunteer withdraws their own request; staff clear one once accepted.
drop policy if exists "svr: withdraw or clear" on public.session_volunteer_requests;
create policy "svr: withdraw or clear" on public.session_volunteer_requests
  for delete to authenticated
  using (user_id = auth.uid() or public.is_org_staff(org_id));

grant select, insert, update, delete on public.session_volunteer_requests to authenticated;
-- Supabase's default privileges also grant anon; signed-out visitors have no business here.
revoke all on public.session_volunteer_requests from anon;

-- Tell the people who run sessions that someone wants to help.
create or replace function public.notify_session_volunteer_request()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_title text;
  v_date date;
begin
  select coalesce(nullif(trim(p.preferred_name), ''), nullif(trim(p.full_name), ''), 'A volunteer')
    into v_name from public.user_profiles p where p.id = new.user_id;
  select s.title, s.session_date into v_title, v_date from public.sessions s where s.id = new.session_id;
  insert into public.notifications (org_id, user_id, category, event_type, title, body, target_url, priority)
  select new.org_id, p.id, 'volunteers', 'VOLUNTEER_SESSION_REQUEST',
         v_name || ' wants to help at ' || coalesce(v_title, 'a session'),
         'On ' || to_char(v_date, 'Dy DD Mon') || '. Accept or decline it on the session.',
         '/?tab=planner', 'normal'
  from public.user_profiles p
  where p.org_id = new.org_id and p.role in ('owner', 'admin', 'manager')
    and coalesce(p.approval_status, 'approved') = 'approved'
    and p.id <> new.user_id;
  return new;
end $$;
revoke all on function public.notify_session_volunteer_request() from public, anon, authenticated;

drop trigger if exists trg_notify_session_volunteer_request on public.session_volunteer_requests;
create trigger trg_notify_session_volunteer_request
  after insert on public.session_volunteer_requests
  for each row execute function public.notify_session_volunteer_request();

-- Same write lock as session_staff: an organisation whose plan has ended reads but does not write.
drop trigger if exists trg_org_write_lock on public.session_volunteer_requests;
create trigger trg_org_write_lock
  before insert or update or delete on public.session_volunteer_requests
  for each row execute function public.enforce_org_write_lock();
