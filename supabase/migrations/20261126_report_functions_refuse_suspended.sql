-- Report functions refuse a suspended login, like the rest of the app.
--
-- Since 18 Nov 2026 a suspended user, or anyone in a suspended organisation,
-- is shut out by get_my_org_id() and is_org_admin(), which check
-- is_access_suspended(). The report_* functions are older than that. Each
-- found the organisation with its own
--
--   select org_id into v_org from user_profiles where id = auth.uid();
--
-- which ignores suspension, so a suspended login could still read aggregate
-- reports through the API. report_insights_metrics and
-- report_delivery_metrics were rewritten this week with get_my_org_id(); this
-- does the same for the other nine.
--
-- Each definition is read back from the database, its org lookup replaced by
--
--   v_org := public.get_my_org_id();
--
-- and the function re-created. Nothing else in any body changes. A function
-- whose lookup is not found exactly once stops the migration rather than
-- being half-changed, and one already using get_my_org_id() is left alone,
-- so running this twice is harmless.
--
-- Execute is also limited to signed-in users. anon could call these before,
-- though the org check always turned it away.

do $migration$
declare
  f record;
  def text;
  hits int;
  found int := 0;
  lookup constant text := 'select\s+org_id\s+into\s+(\w+)\s+from\s+(?:public\.)?user_profiles\s+where\s+id\s*=\s*auth\.uid\(\)\s*;';
begin
  for f in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (
      'report_attendance_metrics',
      'report_funder_metrics',
      'report_impact_metrics',
      'report_overview_metrics',
      'report_project_metrics',
      'report_safeguarding_metrics',
      'report_session_learning_metrics',
      'report_workforce_metrics',
      'report_young_people_metrics')
  loop
    found := found + 1;
    def := pg_get_functiondef(f.oid);
    continue when position('get_my_org_id()' in def) > 0;
    select count(*) into hits from regexp_matches(def, lookup, 'gi');
    if hits <> 1 then
      raise exception '%: expected one org lookup, found %', f.proname, hits;
    end if;
    execute regexp_replace(def, lookup, '\1 := public.get_my_org_id();', 'i');
  end loop;
  if found <> 9 then
    raise exception 'Expected 9 report functions, found %', found;
  end if;
end
$migration$;

revoke all on function public.report_attendance_metrics(date, date) from public, anon;
grant execute on function public.report_attendance_metrics(date, date) to authenticated;
revoke all on function public.report_funder_metrics(date, date) from public, anon;
grant execute on function public.report_funder_metrics(date, date) to authenticated;
revoke all on function public.report_impact_metrics(date, date) from public, anon;
grant execute on function public.report_impact_metrics(date, date) to authenticated;
revoke all on function public.report_overview_metrics(date, date) from public, anon;
grant execute on function public.report_overview_metrics(date, date) to authenticated;
revoke all on function public.report_project_metrics(date, date) from public, anon;
grant execute on function public.report_project_metrics(date, date) to authenticated;
revoke all on function public.report_safeguarding_metrics(date, date) from public, anon;
grant execute on function public.report_safeguarding_metrics(date, date) to authenticated;
revoke all on function public.report_session_learning_metrics(date, date) from public, anon;
grant execute on function public.report_session_learning_metrics(date, date) to authenticated;
revoke all on function public.report_workforce_metrics(date, date) from public, anon;
grant execute on function public.report_workforce_metrics(date, date) to authenticated;
revoke all on function public.report_young_people_metrics(date, date) from public, anon;
grant execute on function public.report_young_people_metrics(date, date) to authenticated;
