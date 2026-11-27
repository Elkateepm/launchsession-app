-- Run with a database administration connection. Read-only checks; rolled back.
begin;
set local role anon;
do $$
begin
  if exists(select 1 from public.children)
    or exists(select 1 from public.safeguarding_documents) then
    raise exception 'Anonymous access to protected records';
  end if;
  if exists(select 1 from public.organisations_safe
    where contact_email is not null or contact_phone is not null or notes is not null
      or dsl_email is not null or dsl_phone is not null or dsl_name is not null
      or onboarding_data is not null or stripe_customer_id is not null
      or stripe_subscription_id is not null or custom_groups is not null
      or custom_locations is not null or safeguarding_policy_url is not null
      or safeguarding_alert_prefs is not null) then
    raise exception 'Anonymous access to private organisation fields';
  end if;
  -- Public branding is deliberately available before login.
  perform id from public.organisations_public limit 1;
end $$;
reset role;
do $$
declare
  account record;
  tested integer := 0;
begin
  -- Platform superadmins deliberately have cross-organisation privileges.
  for account in
    select u.id, u.org_id, u.role from public.user_profiles u
    where u.org_id is not null and u.role in ('admin','volunteer')
      and not exists(select 1 from public.super_admins s where s.id=u.id)
  loop
    perform set_config('request.jwt.claim.sub',account.id::text,true);
    perform set_config('request.jwt.claims',
      json_build_object('sub',account.id,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    if exists(select 1 from public.children where org_id <> account.org_id)
      or exists(select 1 from public.safeguarding_documents where org_id <> account.org_id) then
      raise exception 'Cross-organisation record access';
    end if;
    if exists(select 1 from public.organisations_safe where id <> account.org_id
      and (contact_email is not null or notes is not null or dsl_email is not null
        or stripe_customer_id is not null or onboarding_data is not null)) then
      raise exception 'Cross-organisation private organisation fields';
    end if;
    if account.role = 'admin' and not exists(
      select 1 from public.organisations where id = account.org_id
    ) then
      raise exception 'Organisation admin cannot read their organisation';
    end if;
    if account.role = 'volunteer' and (
      exists(select 1 from public.safeguarding_documents)
      or exists(select 1 from public.safeguarding_audit_log)
    ) then
      raise exception 'Volunteer access to restricted safeguarding records';
    end if;
    execute 'reset role';
    tested := tested + 1;
  end loop;
  if tested = 0 then raise exception 'No eligible accounts: checks did not run'; end if;
end $$;
select 'Anonymous and ordinary admin/volunteer read-access checks passed' as result;
rollback;
