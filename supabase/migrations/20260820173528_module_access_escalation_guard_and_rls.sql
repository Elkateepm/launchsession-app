-- Who may write a grant, and what they may write.
--
-- This is a trigger rather than an RLS policy for the same reason the
-- user_profiles role guard is: RLS constrains which ROWS a caller may touch,
-- not which VALUES they may put in them. A policy could stop a manager editing
-- someone else's grant but could not stop them writing level='edit' on a module
-- they only hold 'view' on.

create table if not exists public.module_access_audit (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  actor_id    uuid,
  target_user uuid,
  module_key  text not null,
  old_level   text,
  new_level   text,
  action      text not null,
  created_at  timestamptz not null default now()
);
alter table public.module_access_audit enable row level security;
create index if not exists idx_module_access_audit_org on public.module_access_audit(org_id, created_at desc);

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
  -- auth.uid(). It is already trusted; these rules exist to bound what a
  -- signed-in human can do to their colleagues.
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

  if v_actor_role = 'manager' then
    -- Self-service widening is the obvious hole: without this a manager with
    -- 'view' on Payments grants themselves 'edit' in one call.
    if v_row.user_id = auth.uid() then
      raise exception 'You cannot change your own module access';
    end if;
    if v_target_role = 'manager' then
      raise exception 'Only administrators can change a manager''s module access';
    end if;
    -- A manager can hand out no more than they hold themselves.
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

drop trigger if exists trg_enforce_module_grant_rules on public.module_access_grants;
create trigger trg_enforce_module_grant_rules
  before insert or update or delete on public.module_access_grants
  for each row execute function public.enforce_module_grant_rules();

-- The role template is org-wide policy, so it is admin-only. A manager
-- adjusting "what every staff member can see" is a different act from a
-- manager adjusting one person, and should not ride on the same permission.
create or replace function public.enforce_module_default_rules()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_actor_role text;
  v_actor_org  uuid;
  v_row        public.module_access_defaults;
begin
  v_row := coalesce(new, old);
  if auth.uid() is null then return v_row; end if;

  select role, org_id into v_actor_role, v_actor_org
    from public.user_profiles where id = auth.uid();

  if v_actor_role is null or v_actor_role not in ('owner','admin') then
    raise exception 'Only administrators can change role access defaults';
  end if;
  if v_row.org_id is distinct from v_actor_org then
    raise exception 'Cannot change access defaults outside your organisation';
  end if;

  if tg_op <> 'DELETE' then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enforce_module_default_rules on public.module_access_defaults;
create trigger trg_enforce_module_default_rules
  before insert or update or delete on public.module_access_defaults
  for each row execute function public.enforce_module_default_rules();

-- RLS. The triggers police values; these police rows.
alter table public.module_access_grants enable row level security;
alter table public.module_access_defaults enable row level security;

drop policy if exists "read own or org grants" on public.module_access_grants;
create policy "read own or org grants" on public.module_access_grants
  for select to authenticated
  using (org_id = public.get_my_org_id() and (user_id = auth.uid() or public.is_org_manager()));

drop policy if exists "managers write grants" on public.module_access_grants;
create policy "managers write grants" on public.module_access_grants
  for all to authenticated
  using (org_id = public.get_my_org_id() and public.is_org_manager())
  with check (org_id = public.get_my_org_id() and public.is_org_manager());

-- Everyone in the org may READ the template: the client needs it to explain
-- why a module is missing, and it contains no personal data.
drop policy if exists "read org defaults" on public.module_access_defaults;
create policy "read org defaults" on public.module_access_defaults
  for select to authenticated
  using (org_id = public.get_my_org_id());

drop policy if exists "admins write defaults" on public.module_access_defaults;
create policy "admins write defaults" on public.module_access_defaults
  for all to authenticated
  using (org_id = public.get_my_org_id() and public.is_org_admin())
  with check (org_id = public.get_my_org_id() and public.is_org_admin());

drop policy if exists "managers read access audit" on public.module_access_audit;
create policy "managers read access audit" on public.module_access_audit
  for select to authenticated
  using (org_id = public.get_my_org_id() and public.is_org_manager());
