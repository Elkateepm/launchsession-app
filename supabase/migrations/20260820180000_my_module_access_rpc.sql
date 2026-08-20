-- The client needs the caller's effective level for every module in one round
-- trip. Resolving it in JavaScript from the grants and defaults tables would
-- mean a second implementation of the precedence rules, which would drift from
-- the one the policies use -- and a UI that disagrees with RLS shows people
-- buttons that fail when pressed.
create or replace function public.my_module_access()
returns jsonb language sql stable
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(jsonb_object_agg(k, public.module_access(k)), '{}'::jsonb)
  from unnest(array[
    'calendar','planner','people','registers','volunteers','messaging','gallery',
    'safeguarding','forms','case_management','risk_assessments','medical_alerts',
    'reports','impact_outcomes','fundraising','hr','payments','resource_booking',
    'events_trips','parent_portal','mentoring','templates'
  ]) as k;
$$;

revoke execute on function public.my_module_access() from public;
grant execute on function public.my_module_access() to authenticated;
