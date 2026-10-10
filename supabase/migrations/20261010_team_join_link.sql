-- A link (and its QR code) that lets someone ask to join an organisation's team.
--
-- Until now the only way onto a team was a one-person email invite, typed in
-- by an admin. That is slow at a training day or a volunteer fair, where the
-- easiest thing is a QR code on a phone screen. But an organisation here holds
-- children's records, so a link must never let anyone in by itself:
--
--   * the link only lets someone ASK. Each request waits on the Team page;
--   * approving it sends the ordinary email invite (api/invite-volunteer),
--     with a role the approver chooses then. The link carries no role, so a
--     leaked link can never be turned into an admin account;
--   * owners, admins and managers -- the people who already approve new
--     starters on the Team page -- can see, approve, decline, turn the link
--     off, or replace it so the old QR code stops working.
--
-- Multi-tenant: the organisation always comes from the link's code, never from
-- the caller. Neither table is readable or writable by anon; the public page
-- goes through the two security definer functions at the bottom.

-- Who may run the team. Approved owners, admins and managers of that org.
create or replace function public.can_manage_team(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select exists (
    select 1 from public.user_profiles
     where id = auth.uid()
       and org_id = p_org_id
       and role in ('owner', 'admin', 'manager')
       and coalesce(approval_status, 'approved') = 'approved'
  );
$$;
revoke all on function public.can_manage_team(uuid) from public, anon;
grant execute on function public.can_manage_team(uuid) to authenticated;

-- One live link per organisation. No row means the link is off. Replacing the
-- link deletes the row and inserts a new one, so the old code stops matching.
create table if not exists public.team_join_links (
  org_id uuid primary key references public.organisations(id) on delete cascade,
  code uuid not null unique default gen_random_uuid(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.team_join_links enable row level security;
revoke all on public.team_join_links from public, anon, authenticated;
grant select, insert, delete on public.team_join_links to authenticated;

drop policy if exists team_join_links_read on public.team_join_links;
create policy team_join_links_read on public.team_join_links
  for select to authenticated using (public.can_manage_team(org_id));
drop policy if exists team_join_links_create on public.team_join_links;
create policy team_join_links_create on public.team_join_links
  for insert to authenticated with check (public.can_manage_team(org_id));
drop policy if exists team_join_links_remove on public.team_join_links;
create policy team_join_links_remove on public.team_join_links
  for delete to authenticated using (public.can_manage_team(org_id));

create table if not exists public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (char_length(phone) <= 40),
  message text check (char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists team_join_requests_org_status on public.team_join_requests (org_id, status, created_at desc);
-- One waiting request per email per org: asking twice does not queue twice.
create unique index if not exists team_join_requests_one_pending
  on public.team_join_requests (org_id, lower(email)) where status = 'pending';

alter table public.team_join_requests enable row level security;
revoke all on public.team_join_requests from public, anon, authenticated;
grant select on public.team_join_requests to authenticated;
-- Deciding is the only change staff make. Who asked, and for which org, is
-- fixed at submission.
grant update (status, decided_by, decided_at) on public.team_join_requests to authenticated;

drop policy if exists team_join_requests_read on public.team_join_requests;
create policy team_join_requests_read on public.team_join_requests
  for select to authenticated using (public.can_manage_team(org_id));
drop policy if exists team_join_requests_decide on public.team_join_requests;
create policy team_join_requests_decide on public.team_join_requests
  for update to authenticated
  using (public.can_manage_team(org_id))
  with check (public.can_manage_team(org_id) and decided_by = auth.uid());

-- What the public join page shows: the organisation's name and look, nothing
-- else. An unknown or replaced code returns no row.
create or replace function public.get_team_join_page(p_code uuid)
returns table (org_name text, logo_url text, primary_color text)
language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select o.name, o.logo_url, o.primary_color
    from public.team_join_links l
    join public.organisations o on o.id = l.org_id
   where l.code = p_code;
$$;
revoke all on function public.get_team_join_page(uuid) from public;
grant execute on function public.get_team_join_page(uuid) to anon, authenticated;

create or replace function public.submit_team_join_request(
  p_code uuid, p_full_name text, p_email text, p_phone text default null, p_message text default null
) returns void
language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_org_id uuid;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  select org_id into v_org_id from public.team_join_links where code = p_code;
  if v_org_id is null then
    raise exception 'This join link has been turned off. Ask the organisation for a new one.';
  end if;

  if v_name = '' then raise exception 'Please enter your name.'; end if;
  if char_length(v_name) > 120 then raise exception 'That name is too long.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Please enter a valid email address.';
  end if;
  if char_length(v_phone) > 40 then raise exception 'That phone number is too long.'; end if;
  if char_length(v_message) > 1000 then raise exception 'Please keep the message under 1000 characters.'; end if;

  if not public.check_rate_limit('team-join:org:' || v_org_id::text, 30, 3600)
     or not public.check_rate_limit('team-join:global', 200, 3600) then
    raise exception 'Too many requests just now. Please try again in an hour.';
  end if;

  -- A repeat while one is already waiting is quietly accepted, so the form
  -- does not reveal whether an email has asked before.
  insert into public.team_join_requests (org_id, full_name, email, phone, message)
  values (v_org_id, v_name, v_email, v_phone, v_message)
  on conflict (org_id, lower(email)) where status = 'pending' do nothing;
end;
$$;
revoke all on function public.submit_team_join_request(uuid, text, text, text, text) from public;
grant execute on function public.submit_team_join_request(uuid, text, text, text, text) to anon, authenticated;
