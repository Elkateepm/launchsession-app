-- Suspend actually blocks access.
--
-- Command Centre's Suspend buttons set user_profiles.status or
-- organisations.status to 'suspended', but nothing read either column, so a
-- suspended person or organisation carried on as normal. After this migration
-- a person is blocked when their own profile is suspended OR their
-- organisation is suspended, and restoring to 'active' lets them back in.
--
-- Blocked means, all at once:
--   * auth.users.banned_until is set to a fixed sentinel (2999-01-01), so
--     sign-in and token refresh are refused by Supabase Auth (user_banned);
--   * their auth sessions are deleted, so the next token refresh fails and the
--     app signs them out (refresh tokens cascade from sessions);
--   * the org-scope helpers (get_my_org_id, get_user_org_id, get_admin_org_id,
--     is_org_admin, is_org_manager) answer NULL for them, so RLS stops
--     returning their organisation's data even while the current access
--     token is still valid.
--
-- Platform staff (super_admins, platform_users) are never blocked, so
-- suspending an organisation a super admin belongs to (e.g. Solidarity
-- Sports) cannot lock the platform out of Command Centre.
--
-- Only the platform may suspend or restore: the service role (Command Centre's
-- /api/db, where auth.uid() is null) or a super admin. Without that guard,
-- "update profiles" would let any member suspend a colleague.

-- ---------------------------------------------------------------------------
-- Is this person blocked?
-- ---------------------------------------------------------------------------
create or replace function public.is_access_suspended(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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

-- ---------------------------------------------------------------------------
-- Make Supabase Auth agree with the profile and organisation.
-- ---------------------------------------------------------------------------
create or replace function public.sync_access_suspension(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- A fixed value, so a restore only lifts bans this mechanism placed and
  -- never one set some other way.
  v_sentinel constant timestamptz := '2999-01-01 00:00:00+00';
begin
  if public.is_access_suspended(p_user) then
    -- Someone already banned (by this or any other means) is left as they are.
    update auth.users
       set banned_until = v_sentinel
     where id = p_user
       and (banned_until is null or banned_until <= now());
    if found then
      delete from auth.sessions where user_id = p_user;
    end if;
  else
    update auth.users
       set banned_until = null
     where id = p_user
       and banned_until = v_sentinel;
  end if;
end
$$;

revoke all on function public.sync_access_suspension(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Only the platform may suspend or restore a person.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_suspension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if coalesce(old.status, '') <> 'suspended' and coalesce(new.status, '') <> 'suspended' then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if exists (select 1 from super_admins where id = auth.uid()) then
    return new;
  end if;
  raise exception 'Suspending or restoring an account is managed by LaunchSession'
    using errcode = '42501';
end
$$;

drop trigger if exists trg_guard_profile_suspension on public.user_profiles;
create trigger trg_guard_profile_suspension
  before update of status on public.user_profiles
  for each row execute function public.guard_profile_suspension();

-- ---------------------------------------------------------------------------
-- Keep the ban in step with the profile and the organisation.
-- ---------------------------------------------------------------------------
create or replace function public.trg_profile_access_suspension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.org_id is distinct from old.org_id then
    perform public.sync_access_suspension(new.id);
  end if;
  return null;
end
$$;

drop trigger if exists trg_profile_access_suspension on public.user_profiles;
create trigger trg_profile_access_suspension
  after insert or update of status, org_id on public.user_profiles
  for each row execute function public.trg_profile_access_suspension();

create or replace function public.trg_org_access_suspension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.sync_access_suspension(p.id)
       from public.user_profiles p
      where p.org_id = new.id;
  end if;
  return null;
end
$$;

drop trigger if exists trg_org_access_suspension on public.organisations;
create trigger trg_org_access_suspension
  after update of status on public.organisations
  for each row execute function public.trg_org_access_suspension();

-- ---------------------------------------------------------------------------
-- The org-scope helpers stop answering for a blocked person. Same signatures,
-- volatility and search_path as before; only the suspension check is new.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_org_id()
returns uuid
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select org_id from user_profiles
   where id = auth.uid()
     and not public.is_access_suspended(id)
   limit 1;
$function$;

create or replace function public.get_user_org_id()
returns uuid
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select org_id from user_profiles
   where id = auth.uid()
     and not public.is_access_suspended(id)
   limit 1;
$function$;

create or replace function public.get_admin_org_id()
returns uuid
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select org_id
  from user_profiles
  where id = auth.uid()
  and role = any (array['admin', 'owner'])
  and not public.is_access_suspended(id)
  limit 1
$function$;

create or replace function public.is_org_admin()
returns boolean
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select role in ('admin', 'owner') from public.user_profiles
   where id = auth.uid()
     and not public.is_access_suspended(id);
$function$;

create or replace function public.is_org_manager()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select role in ('owner', 'admin', 'manager') from user_profiles
   where id = auth.uid()
     and not public.is_access_suspended(id);
$function$;

-- ---------------------------------------------------------------------------
-- What the app asks on sign-in: am I blocked, and why?
-- ---------------------------------------------------------------------------
create or replace function public.my_access_block()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then null
    when not public.is_access_suspended(auth.uid()) then null
    else (
      select jsonb_build_object(
               'reason', case when p.status = 'suspended' then 'user_suspended' else 'org_suspended' end,
               'organisation', o.name)
        from public.user_profiles p
        left join public.organisations o on o.id = p.org_id
       where p.id = auth.uid()
    )
  end;
$$;

revoke all on function public.my_access_block() from public, anon;
grant execute on function public.my_access_block() to authenticated;
