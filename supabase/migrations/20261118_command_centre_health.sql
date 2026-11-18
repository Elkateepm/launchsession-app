-- Command Centre: account health and a platform-wide people list.
--
-- Both are read-only and for super admins only. The console used to show an
-- organisation as a name, a plan and a status; these give it what it needs to
-- tell a busy account from one that has gone quiet or never started.

-- ---------------------------------------------------------------------------
-- admin_org_health(): one row per organisation
-- ---------------------------------------------------------------------------
-- last_login_at ignores platform staff, so a super admin who is also a member
-- (Solidarity Sports) does not make an account look active.
create or replace function public.admin_org_health()
returns table (
  org_id            uuid,
  members           int,
  awaiting_approval int,
  pending_invites   int,
  oldest_invite_at  timestamptz,
  children          int,
  sessions_total    int,
  sessions_30d      int,
  upcoming_sessions int,
  last_session_on   date,
  last_login_at     timestamptz,
  attendance_30d    int
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not exists (select 1 from super_admins where id = auth.uid()) then
    raise exception 'FORBIDDEN: platform administrator access required'
      using errcode = '42501';
  end if;

  return query
  select
    o.id,
    (select count(*)::int from user_profiles p where p.org_id = o.id),
    (select count(*)::int from user_profiles p
      where p.org_id = o.id and coalesce(p.approval_status, 'approved') <> 'approved'),
    (select count(*)::int from admin_invites ai where ai.org_id = o.id and ai.status = 'pending'),
    (select min(ai.created_at) from admin_invites ai where ai.org_id = o.id and ai.status = 'pending'),
    (select count(*)::int from children c where c.org_id = o.id),
    (select count(*)::int from sessions s where s.org_id = o.id),
    (select count(*)::int from sessions s
      where s.org_id = o.id and s.session_date between current_date - 30 and current_date),
    (select count(*)::int from sessions s where s.org_id = o.id and s.session_date > current_date),
    (select max(s.session_date) from sessions s where s.org_id = o.id and s.session_date <= current_date),
    (select max(u.last_sign_in_at)
       from user_profiles p
       join auth.users u on u.id = p.id
      where p.org_id = o.id
        and not exists (select 1 from super_admins   sa where sa.id = p.id)
        and not exists (select 1 from platform_users pu where pu.id = p.id)),
    (select count(*)::int
       from attendance a
       join sessions s on s.id = a.session_id
      where s.org_id = o.id and s.session_date between current_date - 30 and current_date)
  from organisations o;
end
$function$;

revoke all on function public.admin_org_health() from public, anon;
grant execute on function public.admin_org_health() to authenticated;

-- ---------------------------------------------------------------------------
-- admin_list_users(): everyone with a profile, with their last sign-in
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  id                uuid,
  email             text,
  full_name         text,
  role              text,
  status            text,
  approval_status   text,
  org_id            uuid,
  org_name          text,
  created_at        timestamptz,
  last_sign_in_at   timestamptz,
  is_platform_admin boolean
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not exists (select 1 from super_admins where super_admins.id = auth.uid()) then
    raise exception 'FORBIDDEN: platform administrator access required'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    coalesce(u.email::text, p.email),
    p.full_name,
    p.role,
    p.status,
    p.approval_status,
    p.org_id,
    o.name,
    p.created_at,
    u.last_sign_in_at,
    exists (select 1 from super_admins sa where sa.id = p.id)
  from user_profiles p
  left join auth.users u on u.id = p.id
  left join organisations o on o.id = p.org_id
  order by p.created_at desc;
end
$function$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
