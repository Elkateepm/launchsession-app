-- Findings from an independent review of the RLS policies. Four issues, two of
-- them a full tenant-boundary compromise. Applied to ssahcqeqrxawmwtjpwvh.
--
-- 1. CRITICAL -- any user could grant themselves admin, in any organisation.
--
-- "update profiles" allowed a row through when
--   id = auth.uid() OR org_id = get_user_org_id()
-- on both USING and WITH CHECK. RLS constrains which ROWS may be updated, not
-- which COLUMNS, so a volunteer or parent could update their own row and set
-- role = 'admin' and org_id to another charity. Both checks still pass via the
-- id = auth.uid() branch. is_org_admin() then returns true and the tenant
-- helpers return the target organisation -- safeguarding records included.
-- The second branch was equally bad: any member could edit any colleague's
-- row, including their role.
--
-- Column-level protection needs a trigger. Non-admins may still edit their own
-- profile; they cannot move between organisations or change anyone's role.
-- Still permitted: service_role (auth.uid() null, used by
-- api/complete-invite-account.js), admins and owners (the HR and Settings role
-- pickers), and rows not yet provisioned (old.org_id null, used by
-- CreatePassword.jsx when the profile row already exists).

create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.org_id is null then
    return new;
  end if;

  if new.role is not distinct from old.role
     and new.org_id is not distinct from old.org_id then
    return new;
  end if;

  select p.role into actor_role
  from public.user_profiles p
  where p.id = auth.uid();

  if actor_role in ('admin', 'owner') then
    return new;
  end if;

  raise exception
    'Only an administrator can change a role or organisation'
    using errcode = '42501';
end;
$$;

drop trigger if exists guard_profile_privilege_columns on public.user_profiles;

create trigger guard_profile_privilege_columns
  before update on public.user_profiles
  for each row
  execute function public.guard_profile_privilege_columns();

-- 2. CRITICAL -- anonymous callers could read and rewrite every pending invite.
--
--   "public can read invite by token"  SELECT TO public USING (accepted = false)
--   "public can accept invite"         UPDATE TO public USING (accepted = false)
--                                                       WITH CHECK (true)
--
-- Neither referenced the token. The SELECT returned every pending invite --
-- token, email, org_id, role -- to anyone unauthenticated. The UPDATE allowed
-- any column on those rows to be rewritten, so an invite could be redirected
-- to an attacker's address with role set to admin, then accepted.
--
-- Nothing in the application uses this table; the live flow is admin_invites
-- with get_invite_by_token() and accept_invite_by_token(). Admin policies stay.

drop policy if exists "public can read invite by token" on public.organisation_invites;
drop policy if exists "public can accept invite" on public.organisation_invites;

-- 3. HIGH -- volunteers could write session_staff rows into any organisation.
-- The policy checked user_id = auth.uid() and nothing else, so a volunteer
-- could insert a row carrying their own user_id and an arbitrary org_id.

drop policy if exists "volunteers can manage own session_staff" on public.session_staff;

create policy "volunteers manage own org session_staff"
  on public.session_staff for all
  to authenticated
  using (user_id = auth.uid() and org_id = get_my_org_id())
  with check (user_id = auth.uid() and org_id = get_my_org_id());

-- 4. HIGH -- dead tables left wide open. Six tables carried ALL policies whose
-- only test was auth.uid() IS NOT NULL: any signed-in user of any organisation,
-- full read and write. All empty, none referenced in the repository.
-- org_stats additionally had USING (true) granted to public, reachable without
-- signing in. Policies dropped rather than tables, so with RLS on and no
-- policies no client can reach them and they can still be inspected.

drop policy if exists "Public read org_stats" on public.org_stats;
drop policy if exists "Authenticated users can manage org_stats" on public.org_stats;
drop policy if exists "Authenticated access app_users" on public.app_users;
drop policy if exists "Authenticated access app_children" on public.app_children;
drop policy if exists "Authenticated access app_sessions" on public.app_sessions;
drop policy if exists "Authenticated users can manage org_members" on public.org_members;
drop policy if exists "Authenticated users can manage org_users" on public.org_users;

-- 5. Hardening. The tenant helpers are SECURITY DEFINER with an unqualified
-- user_profiles reference and no pinned search_path. No exploit today, since
-- neither anon nor authenticated can CREATE in public, but that is one grant
-- away. is_org_admin() was also VOLATILE, wrong for a read-only lookup and a
-- re-evaluation per row.

alter function public.get_my_org_id()    set search_path = pg_catalog, public;
alter function public.get_user_org_id()  set search_path = pg_catalog, public;
alter function public.get_admin_org_id() set search_path = pg_catalog, public;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select role in ('admin', 'owner') from public.user_profiles where id = auth.uid();
$$;

-- Not changed, and still open:
--   cause_for_concern UPDATE is named "Admins can update concerns" but tests
--   only org_id = get_user_org_id(), so any member can edit a safeguarding
--   concern. Within-tenant, and tightening it may break a staff workflow that
--   currently depends on it, so it needs a product decision rather than a
--   silent policy change.
--
--   sms_opt_outs SELECT is auth.role() = 'authenticated' with no tenant
--   predicate. The table has no org_id column -- it is keyed on phone number --
--   so scoping it needs a schema change. SMS work is on hold; left as is.
