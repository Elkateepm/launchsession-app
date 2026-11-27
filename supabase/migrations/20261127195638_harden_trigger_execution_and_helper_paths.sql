-- Trigger functions are invoked by PostgreSQL, not directly by API clients.
-- Preserve the trigger bodies and existing trigger attachments.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
  end loop;
end;
$$;

-- Both helpers use only built-in operations on their arguments.
alter function public.default_modules_for_org_type(text) set search_path = pg_catalog;
alter function public.hr_requirement_applies(text, text, text, text, text) set search_path = pg_catalog;
