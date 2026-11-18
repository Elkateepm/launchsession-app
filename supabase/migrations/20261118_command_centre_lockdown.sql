-- Command Centre: keep organisations out, and make org delete work.
--
-- 1. Global templates are Command Centre's library, shown to every
--    organisation. The org policy let an org admin write any template in their
--    own org, including one with is_global = true, which then appeared in
--    every other organisation. Org admins can now only write their own,
--    non-global templates. Command Centre writes through the service role and
--    the super-admin policy, so it is unaffected.
--
-- 2. admin_delete_organisation(): Command Centre deleted an organisation by
--    issuing 35 table deletes from the browser, then deleting each member's
--    login one by one. Every FK to organisations already cascades, so one
--    delete does the job; this function does it in a single transaction and
--    keeps super admins' logins, so deleting an org a super admin belongs to
--    (e.g. Solidarity Sports) cannot lock the platform out of Command Centre.

-- ---------------------------------------------------------------------------
-- 1. Org admins cannot publish global templates
-- ---------------------------------------------------------------------------
drop policy if exists "Orgs admins write templates" on public.templates;
create policy "Orgs admins write templates" on public.templates
  for all
  using      (org_id = get_user_org_id() and is_org_admin() and is_global is not true)
  with check (org_id = get_user_org_id() and is_org_admin() and is_global is not true);

-- ---------------------------------------------------------------------------
-- 2. Delete an organisation in one call (super admins only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_organisation(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_name    text;
  v_slug    text;
  v_logins  uuid[];
  v_kept    int;
  v_deleted int;
begin
  if not exists (select 1 from super_admins where id = auth.uid()) then
    raise exception 'FORBIDDEN: platform administrator access required'
      using errcode = '42501';
  end if;

  select name, slug into v_name, v_slug from organisations where id = p_org_id;
  if not found then
    raise exception 'Organisation not found' using errcode = 'P0002';
  end if;

  -- Members whose login goes with the organisation. Platform staff keep theirs.
  select coalesce(array_agg(p.id), '{}')
    into v_logins
    from user_profiles p
   where p.org_id = p_org_id
     and not exists (select 1 from super_admins   s where s.id = p.id)
     and not exists (select 1 from platform_users u where u.id = p.id);

  select count(*)
    into v_kept
    from user_profiles p
   where p.org_id = p_org_id
     and (exists (select 1 from super_admins   s where s.id = p.id)
       or exists (select 1 from platform_users u where u.id = p.id));

  -- child_injuries -> children is ON DELETE RESTRICT, which is checked as the
  -- cascade reaches children, before it reaches child_injuries.
  delete from child_injuries where org_id = p_org_id;

  -- Every other table cascades from organisations.
  delete from organisations where id = p_org_id;

  -- Signup records are matched by slug, not by org_id.
  if v_slug is not null then
    delete from trial_requests where generated_slug = v_slug;
  end if;

  delete from auth.users where id = any (v_logins);
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'organisation',   v_name,
    'logins_deleted', v_deleted,
    'logins_kept',    v_kept
  );
end
$function$;

revoke all on function public.admin_delete_organisation(uuid) from public, anon;
grant execute on function public.admin_delete_organisation(uuid) to authenticated;
