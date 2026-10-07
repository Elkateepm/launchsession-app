-- Nobody can make themselves a member of an organisation.
--
-- The "insert profiles" policy on user_profiles allows a row whenever
-- id = auth.uid(), and nothing checked what that row said. Public sign-up is on
-- (Create Password and the volunteer invite rely on it), so anyone could create
-- an account, insert their own profile with any org_id and role = 'admin', and
-- get_my_org_id() would hand them that organisation's children, safeguarding
-- and medical records. The update guards (guard_profile_privilege_columns,
-- guard_profile_role_and_approval) only ever covered UPDATE. On 8 Oct 2026 no
-- owner, admin or manager profile existed without an invitation behind it.
--
-- The app itself did this: AuthedApp upserted { org_id: <org on screen>,
-- role: 'admin' } for any signed-in account with no profile. That fallback is
-- removed in the same change.
--
-- A profile insert is now allowed only from:
--   - the service role and server functions (auth.uid() is null), which is
--     how invitations, volunteer invites and account completion create them;
--   - claim_invite_profile(), which sets app.claiming_invite for its write;
--   - LaunchSession staff (super_admins, platform_users), for the Command Centre;
--   - an organisation's owner or admin adding someone else to their own
--     organisation, as the "admins can manage org users" policy intends.
--
-- INSERT ... ON CONFLICT fires BEFORE INSERT triggers even when it ends in an
-- update, so a client "upsert" of an existing profile is refused too. The one
-- client upsert left, in VolunteerAcceptInvite, becomes an update.
--
-- Applied to project ssahcqeqrxawmwtjpwvh.

create or replace function public.guard_profile_insert()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    return new;
  end if;

  if current_setting('app.claiming_invite', true) = 'on' then
    return new;
  end if;

  if exists (select 1 from public.super_admins where id = actor)
     or exists (select 1 from public.platform_users where id = actor) then
    return new;
  end if;

  if new.id is distinct from actor
     and new.org_id is not distinct from public.get_my_org_id()
     and coalesce(public.is_org_admin(), false) then
    return new;
  end if;

  raise exception 'Accounts join an organisation by invitation'
    using errcode = '42501';
end
$function$;

revoke execute on function public.guard_profile_insert() from public, anon, authenticated;

drop trigger if exists trg_guard_profile_insert on public.user_profiles;
create trigger trg_guard_profile_insert
  before insert on public.user_profiles
  for each row execute function public.guard_profile_insert();
