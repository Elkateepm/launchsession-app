-- Volunteers and parents are out of scope for this feature. They never reach
-- the dashboard -- both are routed to their own portals at /volunteer/<slug>
-- and /parent/<slug> -- so a module grant against one would be a control that
-- appears to do something and does not. What those portals expose is decided
-- by the portals and by the existing per-table role policies.
--
-- Three changes, all making the same rule explicit in a different place:

-- 1. The resolver short-circuits. Returning 'edit' means "this layer imposes
--    no restriction", NOT "a volunteer may edit anything" -- the restrictive
--    module gates simply stop applying, and the existing role policies
--    underneath decide as they always have. This is what the permissive
--    legacy fallback was already doing for these roles; pinning it here stops
--    a stray defaults row from ever changing it.
create or replace function public.module_access(p_module text)
returns text language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  with me as (
    select id, org_id, role from public.user_profiles where id = auth.uid()
  )
  select case
    when (select role from me) is null then 'none'
    when (select role from me) in ('owner','admin') then 'edit'
    -- Portal roles: not governed by this layer at all.
    when (select role from me) in ('volunteer','parent') then 'edit'
    else coalesce(
      (select g.level from public.module_access_grants g, me
        where g.user_id = me.id and g.org_id = me.org_id and g.module_key = p_module),
      (select d.level from public.module_access_defaults d, me
        where d.org_id = me.org_id and d.role = me.role and d.module_key = p_module),
      public.module_access_legacy_default((select role from me), p_module)
    )
  end;
$$;

-- 2. The template table stops accepting them. Nothing had written such a row
--    (verified zero for both roles before applying), so this narrows the
--    constraint rather than migrating data.
delete from public.module_access_defaults where role in ('volunteer','parent');
delete from public.module_access_grants g
  using public.user_profiles u
  where u.id = g.user_id and u.role in ('volunteer','parent');

alter table public.module_access_defaults drop constraint if exists module_access_defaults_role_check;
alter table public.module_access_defaults
  add constraint module_access_defaults_role_check check (role in ('manager','staff'));

-- 3. The grant trigger refuses them by name, so the failure is a readable
--    message rather than a row that silently resolves to no effect.
create or replace function public.enforce_module_grant_rules()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_actor_role  text;
  v_actor_org   uuid;
  v_target_role text;
  v_target_org  uuid;
  v_row         public.module_access_grants;
  v_old_level   text;
begin
  v_row := coalesce(new, old);

  -- The service key (invite flows, org provisioning, the admin client) has no
  -- auth.uid(). It is already trusted; these rules bound what a signed-in
  -- human can do to their colleagues.
  if auth.uid() is null then
    return v_row;
  end if;

  select role, org_id into v_actor_role, v_actor_org
    from public.user_profiles where id = auth.uid();

  if v_actor_role is null or v_actor_role not in ('owner','admin','manager') then
    raise exception 'Only administrators and managers can change module access';
  end if;

  if v_row.org_id is distinct from v_actor_org then
    raise exception 'Cannot change module access outside your organisation';
  end if;

  select role, org_id into v_target_role, v_target_org
    from public.user_profiles where id = v_row.user_id;

  if v_target_org is distinct from v_actor_org then
    raise exception 'That person is not a member of your organisation';
  end if;

  -- Administrators always resolve to 'edit', so a grant against one is a row
  -- that silently does nothing. Refusing it is better than storing a lie that
  -- reads as a restriction on the Access screen.
  if v_target_role in ('owner','admin') then
    raise exception 'Administrators have access to every module and cannot be restricted';
  end if;

  -- Same reasoning for the portal roles: module access does not govern them.
  if v_target_role in ('volunteer','parent') then
    raise exception 'Volunteers and parents use their own portal and are not governed by module access';
  end if;

  if v_actor_role = 'manager' then
    if v_row.user_id = auth.uid() then
      raise exception 'You cannot change your own module access';
    end if;
    if v_target_role = 'manager' then
      raise exception 'Only administrators can change a manager''s module access';
    end if;
    if tg_op <> 'DELETE'
       and public.module_level_rank(new.level)
           > public.module_level_rank(public.module_access(new.module_key)) then
      raise exception 'You cannot grant a higher level of access than you have yourself';
    end if;
  end if;

  if tg_op = 'UPDATE' then v_old_level := old.level; end if;

  insert into public.module_access_audit (org_id, actor_id, target_user, module_key, old_level, new_level, action)
  values (v_row.org_id, auth.uid(), v_row.user_id, v_row.module_key,
          v_old_level, case when tg_op = 'DELETE' then null else new.level end, tg_op);

  return v_row;
end;
$$;
