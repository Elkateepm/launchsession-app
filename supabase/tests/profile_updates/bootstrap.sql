-- Local stand-in for the live user_profiles slice of project ssahcqeqrxawmwtjpwvh.
--
-- The base schema was applied straight to Supabase and is not in
-- supabase/migrations (see its README), so a replay from empty cannot build
-- user_profiles. This file recreates what the new migration touches, copied
-- from the live project on 26 Nov 2026 with pg_get_functiondef / pg_policies
-- / pg_get_triggerdef: the table, its five policies (one RESTRICTIVE), the
-- org helpers, the three UPDATE guard triggers and the suspension sync. The
-- INSERT guard (fixtures are inserted as the owner, so it never fires) and
-- trg_notify_role_escalation (net.http_post + vault) are left out.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key, email text, banned_until timestamptz);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table public.organisations (id uuid primary key, slug text, status text default 'active');
create table public.super_admins (id uuid primary key);
create table public.platform_users (id uuid primary key);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, org_id uuid references public.organisations(id) on delete cascade,
  full_name text, role text default 'staff', status text default 'active',
  phone text, job_title text, application_status text, application_notes text,
  dbs_expiry date, availability jsonb default '{}'::jsonb, onboarding_complete boolean default false,
  approval_status text not null default 'approved' check (approval_status in ('pending','approved','declined')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz, approval_note text,
  unique (id, org_id)
);
alter table public.user_profiles enable row level security;
grant select, insert, update, delete on public.user_profiles to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- ---- helpers (live definitions) ------------------------------------------
create function public.is_access_suspended(p_user uuid) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce((
           select p.status = 'suspended' or coalesce(o.status = 'suspended', false)
             from public.user_profiles p
             left join public.organisations o on o.id = p.org_id
            where p.id = p_user
         ), false)
     and not exists (select 1 from public.super_admins   s where s.id = p_user)
     and not exists (select 1 from public.platform_users u where u.id = p_user);
$$;
revoke all on function public.is_access_suspended(uuid) from public, anon, authenticated;

create function public.sync_access_suspension(p_user uuid) returns void
language plpgsql security definer set search_path to '' as $$
declare v_sentinel constant timestamptz := '2999-01-01 00:00:00+00';
begin
  if public.is_access_suspended(p_user) then
    update auth.users set banned_until = v_sentinel
     where id = p_user and (banned_until is null or banned_until <= now());
    if found then delete from auth.sessions where user_id = p_user; end if;
  else
    update auth.users set banned_until = null where id = p_user and banned_until = v_sentinel;
  end if;
end $$;
revoke all on function public.sync_access_suspension(uuid) from public, anon, authenticated;

create function public.get_user_org_id() returns uuid
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select org_id from user_profiles where id = auth.uid() and not public.is_access_suspended(id) limit 1;
$$;
create function public.get_my_org_id() returns uuid
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select org_id from user_profiles where id = auth.uid() and not public.is_access_suspended(id) limit 1;
$$;
create function public.get_admin_org_id() returns uuid
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select org_id from user_profiles where id = auth.uid() and role = any (array['admin', 'owner'])
     and not public.is_access_suspended(id) limit 1
$$;
create function public.is_org_admin() returns boolean
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select role in ('admin', 'owner') from public.user_profiles
   where id = auth.uid() and not public.is_access_suspended(id);
$$;
create function public.is_org_manager() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select role in ('owner', 'admin', 'manager') from user_profiles
   where id = auth.uid() and not public.is_access_suspended(id);
$$;
create function public.is_portal_user() returns boolean
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select coalesce((select role in ('volunteer', 'parent') from public.user_profiles where id = auth.uid()), false)
$$;
revoke all on function public.is_portal_user() from public, anon;
grant execute on function public.is_portal_user() to authenticated;

-- ---- guard triggers (live definitions) -----------------------------------
create function public.guard_profile_privilege_columns() returns trigger
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare actor_role text;
begin
  if auth.uid() is null then return new; end if;
  if old.org_id is null then return new; end if;
  if new.role is not distinct from old.role and new.org_id is not distinct from old.org_id then return new; end if;
  select p.role into actor_role from public.user_profiles p where p.id = auth.uid();
  if actor_role in ('admin', 'owner') then return new; end if;
  raise exception 'Only an administrator can change a role or organisation' using errcode = '42501';
end; $$;

create function public.guard_profile_role_and_approval() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  actor uuid := auth.uid(); actor_role text; actor_org uuid;
  approval_changed boolean; role_changed boolean;
begin
  approval_changed := new.approval_status is distinct from old.approval_status
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.approval_note is distinct from old.approval_note;
  role_changed := new.role is distinct from old.role;
  if not approval_changed and not role_changed then return new; end if;
  if current_setting('app.claiming_invite', true) = 'on' then return new; end if;
  if actor is null then return new; end if;
  select role, org_id into actor_role, actor_org from public.user_profiles where id = actor;
  if actor_org is distinct from old.org_id then
    raise exception 'You cannot change members of another organisation';
  end if;
  if approval_changed then
    if actor_role not in ('owner', 'admin', 'manager') then
      raise exception 'Only an admin or manager can approve or decline a member';
    end if;
    if actor = old.id then raise exception 'You cannot approve or decline your own account'; end if;
    if new.approval_status is distinct from old.approval_status then
      if new.approval_status in ('approved', 'declined') then
        new.approved_by := actor; new.approved_at := now();
      else
        new.approved_by := null; new.approved_at := null;
      end if;
    end if;
  end if;
  if role_changed then
    if actor_role not in ('owner', 'admin') then
      raise exception 'Only an owner or admin can change a member''s role';
    end if;
    if actor = old.id then raise exception 'You cannot change your own role'; end if;
    if new.role = 'owner' and actor_role <> 'owner' then
      raise exception 'Only an owner can make someone else an owner';
    end if;
  end if;
  return new;
end $$;

create function public.guard_profile_suspension() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if coalesce(old.status, '') <> 'suspended' and coalesce(new.status, '') <> 'suspended' then return new; end if;
  if auth.uid() is null then return new; end if;
  if exists (select 1 from super_admins where id = auth.uid()) then return new; end if;
  raise exception 'Suspending or restoring an account is managed by LaunchSession' using errcode = '42501';
end $$;

create function public.trg_profile_access_suspension() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.org_id is distinct from old.org_id then
    perform public.sync_access_suspension(new.id);
  end if;
  return null;
end $$;

create trigger guard_profile_privilege_columns before update on public.user_profiles
  for each row execute function public.guard_profile_privilege_columns();
create trigger trg_guard_profile_role_and_approval before update on public.user_profiles
  for each row execute function public.guard_profile_role_and_approval();
create trigger trg_guard_profile_suspension before update of status on public.user_profiles
  for each row execute function public.guard_profile_suspension();
create trigger trg_profile_access_suspension after insert or update of status, org_id on public.user_profiles
  for each row execute function public.trg_profile_access_suspension();

-- ---- policies (live definitions) -----------------------------------------
create policy "admins can manage org users" on public.user_profiles for all
  using ((org_id = get_user_org_id()) and is_org_admin())
  with check ((org_id = get_user_org_id()) and is_org_admin());
create policy "insert profiles" on public.user_profiles for insert to authenticated
  with check ((id = (select auth.uid())) or (org_id = get_my_org_id())
    or exists (select 1 from platform_users pu where pu.id = (select auth.uid())));
create policy "portal accounts: own profile only" on public.user_profiles as restrictive for update to authenticated
  using ((not (select is_portal_user())) or (id = (select auth.uid())))
  with check ((not (select is_portal_user())) or (id = (select auth.uid())));
create policy "read profiles" on public.user_profiles for select
  using ((id = (select auth.uid())) or (org_id = get_admin_org_id()) or (org_id = get_my_org_id()));
create policy "update profiles" on public.user_profiles for update
  using ((id = (select auth.uid())) or (org_id = get_user_org_id()))
  with check ((id = (select auth.uid())) or (org_id = get_user_org_id()));
