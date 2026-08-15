-- HR consolidation: staff managed in one place.
--
-- hr_staff and user_profiles were unrelated tables with no link, so HR showed
-- hand-typed records while Team & Staff showed real accounts, reconciled in the
-- client by matching email strings. Merging the UI without joining the data
-- would only have moved the duplication.

alter table public.hr_staff
  add column if not exists user_id uuid references public.user_profiles(id) on delete set null,
  add column if not exists job_title text,
  add column if not exists safeguarding_training_expiry date,
  add column if not exists first_aid_expiry date,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists updated_at timestamptz not null default now();

-- One HR record per account, or a second silently shadows the first.
create unique index if not exists idx_hr_staff_user
  on public.hr_staff(user_id) where user_id is not null;
create index if not exists idx_hr_staff_org on public.hr_staff(org_id);

alter table public.hr_staff drop constraint if exists hr_staff_id_org_uniq;
alter table public.hr_staff add constraint hr_staff_id_org_uniq unique (id, org_id);

alter table public.staff_leave drop constraint if exists staff_leave_staff_org_fk;
alter table public.staff_leave add constraint staff_leave_staff_org_fk
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade;

-- Accounts joined to their HR record, plus HR records with no login yet.
-- user_id stays nullable on purpose: a staff record can exist before an invite
-- is accepted.
create or replace function public.hr_staff_directory()
returns table (
  source text, user_id uuid, hr_id uuid, full_name text, email text, role text,
  job_title text, is_active boolean, dbs_status text, dbs_expiry date,
  safeguarding_training_expiry date, first_aid_expiry date, start_date date,
  leave_allowance integer, on_leave_today boolean
)
language sql security definer set search_path = public stable
as $$
  with me as (select get_my_org_id() as org_id),
  today as (select (now() at time zone 'Europe/London')::date as d)
  select 'account'::text, p.id, h.id, coalesce(p.full_name, p.email), p.email, p.role,
         h.job_title, coalesce(h.is_active, true), h.dbs_status, h.dbs_expiry,
         h.safeguarding_training_expiry, h.first_aid_expiry, h.start_date, h.leave_allowance,
         exists (select 1 from public.staff_leave l, today
                  where l.staff_id = h.id and today.d between l.start_date and l.end_date)
  from public.user_profiles p
  left join public.hr_staff h on h.user_id = p.id
  where p.org_id = (select org_id from me)
  union all
  select 'record'::text, null, h.id, h.full_name, h.email, h.role, h.job_title,
         coalesce(h.is_active, true), h.dbs_status, h.dbs_expiry,
         h.safeguarding_training_expiry, h.first_aid_expiry, h.start_date, h.leave_allowance,
         exists (select 1 from public.staff_leave l, today
                  where l.staff_id = h.id and today.d between l.start_date and l.end_date)
  from public.hr_staff h
  where h.org_id = (select org_id from me) and h.user_id is null;
$$;

revoke all on function public.hr_staff_directory() from public;
grant execute on function public.hr_staff_directory() to authenticated;

-- ------------------------------------------------------ invite token scoping
--
-- The invite-acceptance page read admin_invites through a policy of
-- `status = 'pending'` with NO token predicate, so the anon role could read
-- every pending invite -- email, name, role, org, and the token -- and accept
-- any of them. Org takeover by enumeration. Nothing was exposed only because
-- every existing invite happened to be accepted already.

create or replace function public.get_invite_by_token(p_token uuid)
returns table (
  id uuid, email text, full_name text, role text, org_id uuid,
  org_name text, org_slug text, org_logo_url text, org_primary_color text
)
language sql security definer set search_path = public stable
as $$
  select i.id, i.email, i.full_name, i.role, i.org_id,
         o.name, o.slug, o.logo_url, o.primary_color
  from public.admin_invites i
  join public.organisations o on o.id = i.org_id
  where i.token = p_token and i.status = 'pending'
  limit 1;
$$;

revoke all on function public.get_invite_by_token(uuid) from public;
grant execute on function public.get_invite_by_token(uuid) to anon, authenticated;

create or replace function public.accept_invite_by_token(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.admin_invites where token = p_token and status = 'pending';
  if v_id is null then return false; end if;
  update public.admin_invites set status = 'accepted', accepted_at = now() where id = v_id;
  return true;
end $$;

revoke all on function public.accept_invite_by_token(uuid) from public;
grant execute on function public.accept_invite_by_token(uuid) to anon, authenticated;

drop policy if exists "Anyone can read pending invites by token" on public.admin_invites;
drop policy if exists "public can read invite by token" on public.admin_invites;
drop policy if exists "public can accept invite" on public.admin_invites;
