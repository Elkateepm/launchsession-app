-- Only staff edit other people's profiles; nobody but staff changes a status.
--
-- Before this migration the UPDATE policy "update profiles" on user_profiles
-- passed for `id = auth.uid() OR org_id = get_user_org_id()`. Two holes:
--
--   1. Any non-portal member (role 'staff' today) could update any other
--      profile in their organisation: name, email, phone, address, DBS
--      details, status and so on. Volunteers and parents were already held to
--      their own row by the RESTRICTIVE policy "portal accounts: own profile
--      only", so the hole was staff-on-colleague, not volunteer-on-anyone.
--   2. Anyone could change their own `status`. A self-registered volunteer in
--      'pending' (or 'rejected') could set themselves to 'active' and walk
--      past the approval gate in VolunteerPortal.jsx, which reads `status`.
--
-- The guard triggers only cover role and org (guard_profile_privilege_columns),
-- role and approval (guard_profile_role_and_approval) and suspension
-- (guard_profile_suspension). Nothing guarded `status` outside suspension.
--
-- After this migration:
--
--   * "update profiles" passes for your own row, or for a row in your
--     organisation when you are an owner, admin or manager
--     (is_org_manager(), which already answers NULL for suspended accounts).
--     "admins can manage org users" (owner/admin, ALL) is unchanged.
--   * guard_profile_status refuses a status change unless it comes from the
--     service role (auth.uid() is null: api/ routes and Command Centre),
--     claim_invite_profile, a super admin or platform user, or an owner, admin
--     or manager of that profile's organisation. The one self-service change
--     still allowed is 'pending_invite' -> 'pending', which is what accepting
--     a volunteer invite does from the browser (VolunteerAcceptInvite.jsx) and
--     only moves the account into the approval queue.
--   * Suspension rules are unchanged: guard_profile_suspension still keeps
--     'suspended' to the platform, so a manager cannot suspend or restore.
--
-- Who writes user_profiles from the browser, and whether they still can:
--   own row (any role)  ProfilePage, CreatePassword, Onboarding, VPProfile,
--                       VolunteerPortal onboarding, VolunteerAcceptInvite  -> yes
--   owner/admin/manager TeamCentre (approve, job title, role), HRHome approve,
--                       Settings + HR role, VolunteersApplications (stage +
--                       status), VolunteerDirectory notes, VolunteersTraining
--                       DBS expiry                                          -> yes
--   'staff' role        the three Volunteers writes above on other people   -> NO
--                       (staff get Volunteers 'edit' by default; there are
--                       no 'staff' accounts live on 26 Nov 2026)
--
-- No grant is changed.

-- ---------------------------------------------------------------------------
-- 1. Other people's profiles: owners, admins and managers only.
-- ---------------------------------------------------------------------------
drop policy if exists "update profiles" on public.user_profiles;

create policy "update profiles" on public.user_profiles
  for update
  using (
    id = (select auth.uid())
    or (org_id = public.get_user_org_id() and coalesce(public.is_org_manager(), false))
  )
  with check (
    id = (select auth.uid())
    or (org_id = public.get_user_org_id() and coalesce(public.is_org_manager(), false))
  );

-- ---------------------------------------------------------------------------
-- 2. Status changes: staff and the platform only.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor      uuid := auth.uid();
  actor_role text;
  actor_org  uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if actor is null then
    return new;                                   -- service role
  end if;

  if current_setting('app.claiming_invite', true) = 'on' then
    return new;
  end if;

  if exists (select 1 from public.super_admins   s where s.id = actor)
     or exists (select 1 from public.platform_users u where u.id = actor) then
    return new;
  end if;

  select p.role, p.org_id into actor_role, actor_org
    from public.user_profiles p
   where p.id = actor;

  if actor_role in ('owner', 'admin', 'manager')
     and actor_org is not distinct from old.org_id
     and old.org_id is not null
     and not public.is_access_suspended(actor) then
    return new;
  end if;

  -- Accepting a volunteer invite: into the approval queue, never past it.
  if actor = old.id
     and old.status = 'pending_invite'
     and new.status = 'pending' then
    return new;
  end if;

  raise exception 'Only an owner, admin or manager can change a member''s status'
    using errcode = '42501';
end
$$;

revoke all on function public.guard_profile_status() from public, anon, authenticated;

drop trigger if exists trg_guard_profile_status on public.user_profiles;
create trigger trg_guard_profile_status
  before update of status on public.user_profiles
  for each row execute function public.guard_profile_status();
