-- admin_org_health(): also answer the service role.
--
-- Command Centre now has a read-only summary endpoint (launch-session
-- api/nexus-summary.js) that the LaunchNexus admin reads to show LaunchSession
-- accounts next to its own work. The endpoint runs server-side with the
-- service role, where auth.uid() is null, so the super-admin check refused it.
--
-- The service role can already read every table this function reads, so
-- letting it call the function gives it nothing new. Everyone else is checked
-- exactly as before: super admins only. The body is unchanged.

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
set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not exists (select 1 from super_admins where id = auth.uid()) then
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
grant execute on function public.admin_org_health() to authenticated, service_role;
