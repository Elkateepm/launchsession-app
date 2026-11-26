-- Session delivery report: hours that add up, and a fuller picture of the period.
--
-- Two changes to report_delivery_metrics:
--
-- 1. Hours. A session from 23:00 to 01:30 was counted as -21.5 hours, because
--    end minus start goes negative across midnight. Two such sessions turned a
--    month into "-14h" on the printed report and pulled every total down. A
--    session whose end time is earlier than its start now runs past midnight:
--    end + 24h - start, the rule report_insights_metrics already uses.
--
-- 2. Detail, so the report describes the period rather than only counting it:
--    the days of the week and times of day sessions ran, the best attended
--    sessions, how many registers were completed, why sessions were
--    cancelled, and how many people were on each session's team. Aggregates
--    and session titles only; no child is named.
--
-- Every key the report already read keeps its meaning. The org now comes from
-- get_my_org_id(), which also refuses a suspended login, and execute is
-- limited to signed-in users (it was also granted to anon, which the org
-- check already turned away).

create or replace function public.report_delivery_metrics(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid; v_today date := (now() at time zone 'Europe/London')::date; v_r jsonb;
begin
  v_org := get_my_org_id();
  if v_org is null then raise exception 'Not authorised'; end if;
  if p_to < p_from then raise exception 'The end of the period cannot be before its start.'; end if;

  with sess as (
    select * from sessions where org_id = v_org and session_date between p_from and p_to
  ),
  live as (select * from sess where cancelled_at is null),
  delivered as (
    select l.*,
      case when nullif(l.start_time, '') is not null and nullif(l.end_time, '') is not null
        then extract(epoch from (l.end_time::time - l.start_time::time)) / 3600
             + case when l.end_time::time < l.start_time::time then 24 else 0 end end as hours
    from live l where l.closed_at is not null or l.session_date < v_today
  ),
  dur as (select * from delivered where hours is not null),
  att as (
    select a.session_id, a.status from attendance a join delivered d on d.id = a.session_id
  ),
  per_session as (
    select d.id, d.title, d.session_date,
      count(a.*) filter (where a.status in ('signed_in', 'signed_out')) as present,
      count(a.*) filter (where a.status in ('signed_in', 'signed_out', 'absent')) as marked
    from delivered d left join att a on a.session_id = d.id
    group by 1, 2, 3
  ),
  team as (
    select d.id, count(ss.*) as people, count(ss.*) filter (where ss.volunteer_id is not null) as volunteers
    from delivered d left join session_staff ss on ss.session_id = d.id
    group by 1
  )
  select jsonb_build_object(
    'planned', (select count(*) from live),
    'delivered', (select count(*) from delivered),
    'cancelled', (select count(*) from sess where cancelled_at is not null),
    'hours', (select coalesce(round(sum(hours)), 0) from dur),
    'avg_duration', (select round(avg(hours)::numeric, 1) from dur),
    'locations', (select count(distinct location) from live where location is not null),
    -- A session nobody was rostered to is a gap in the record, not necessarily
    -- in the staffing, but it is the only signal available here.
    'unstaffed', (select count(*) from team where people = 0),
    'by_type', (select coalesce(jsonb_agg(jsonb_build_object('label', t, 'n', n, 'hours', h) order by n desc), '[]'::jsonb)
      from (select coalesce(session_type, 'unspecified') as t, count(*) as n, coalesce(round(sum(hours)), 0) as h
            from delivered group by 1) x),
    'by_month', (select coalesce(jsonb_agg(jsonb_build_object('label', m, 'n', n, 'hours', h) order by sort), '[]'::jsonb)
      from (select to_char(session_date, 'Mon YYYY') as m, date_trunc('month', session_date) as sort,
                   count(*) as n, coalesce(round(sum(hours)), 0) as h
            from delivered group by 1, 2) x),
    'by_location', (select coalesce(jsonb_agg(jsonb_build_object('label', l, 'n', n) order by n desc), '[]'::jsonb)
      from (select location as l, count(*) as n from delivered
            where location is not null and location <> '' group by 1 order by 2 desc limit 10) x),
    'reflections', jsonb_build_object(
      'completed', (select count(distinct r.session_id) from session_reflections r
                    join delivered d on d.id = r.session_id),
      'avg_rating', (select round(avg(r.overall_rating), 1) from session_reflections r
                     join delivered d on d.id = r.session_id where r.overall_rating is not null),
      'would_repeat', (select count(*) from session_reflections r
                       join delivered d on d.id = r.session_id where r.would_repeat is true)
    ),
    -- Monday first, as a UK week is read.
    'by_weekday', (select coalesce(jsonb_agg(jsonb_build_object('label', lbl, 'n', n, 'hours', h) order by dow), '[]'::jsonb)
      from (select extract(isodow from session_date)::int as dow,
                   (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])[extract(isodow from session_date)::int] as lbl,
                   count(*) as n, coalesce(round(sum(hours)), 0) as h
            from delivered group by 1, 2) x),
    'by_time_of_day', (select coalesce(jsonb_agg(jsonb_build_object('label', lbl, 'n', n) order by ord), '[]'::jsonb)
      from (select case when nullif(start_time, '') is null then 4
                        when start_time::time < time '12:00' then 1
                        when start_time::time < time '17:00' then 2 else 3 end as ord,
                   case when nullif(start_time, '') is null then 'No start time'
                        when start_time::time < time '12:00' then 'Morning'
                        when start_time::time < time '17:00' then 'Afternoon' else 'Evening' end as lbl,
                   count(*) as n
            from delivered group by 1, 2) x),
    'best_attended', (select coalesce(jsonb_agg(jsonb_build_object(
        'label', title, 'date', session_date, 'present', present, 'marked', marked,
        'rate', case when marked > 0 then round(100.0 * present / marked) end) order by present desc, session_date), '[]'::jsonb)
      from (select * from per_session where present > 0 order by present desc, session_date limit 5) x),
    'registers', jsonb_build_object(
      'completed', (select count(*) from per_session where marked > 0),
      'present', (select coalesce(sum(present), 0) from per_session),
      'marked', (select coalesce(sum(marked), 0) from per_session)
    ),
    'team', jsonb_build_object(
      'avg_size', (select round(avg(people)::numeric, 1) from team where people > 0),
      'with_volunteers', (select count(*) from team where volunteers > 0)
    ),
    'in_projects', (select count(*) from delivered where project_id is not null),
    'multi_day', (select count(*) from delivered where end_date is not null and end_date > session_date),
    'cancellation_reasons', (select coalesce(jsonb_agg(jsonb_build_object('label', r, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(cancellation_reason), ''), 'No reason recorded') as r, count(*) as n
            from sess where cancelled_at is not null group by 1 order by 2 desc limit 6) x)
  ) into v_r;
  return v_r;
end $function$;

revoke all on function public.report_delivery_metrics(date, date) from public;
revoke all on function public.report_delivery_metrics(date, date) from anon;
grant execute on function public.report_delivery_metrics(date, date) to authenticated;
