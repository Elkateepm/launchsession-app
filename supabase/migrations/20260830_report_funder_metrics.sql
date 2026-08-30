-- Funder reporting metrics.
--
-- The nine report types in REPORT_LIBRARY all called report_overview_metrics
-- and differed only in which of its fourteen numbers they printed. So the
-- "Funder / Grant Report" was reach, sessions, attendance rate and hours --
-- none of which answers what a grant report is actually asked to answer.
--
-- A youth funder wants to know four things, and the old metrics covered one:
--
--   Who did you reach?      Not just a headcount: age, additional needs, how
--                           many were new to you this period.
--   How deep did it go?     Seeing 200 people once is a different programme
--                           from working with 40 people twenty times, and the
--                           headcount alone cannot tell them apart. This is
--                           the single most common follow-up question a
--                           report of this kind gets.
--   Did they stay?          Retention across the period.
--   Did anything change?    Distance travelled -- baseline to latest per
--                           person per outcome area -- and goals met.
--
-- Distance travelled is computed here rather than in the browser: the client
-- would otherwise pull every outcome_score row to average them, which is the
-- mistake reportingService.js was written to stop.
--
-- Dates use Europe/London. The database runs UTC and the organisations are in
-- the UK, so current_date between midnight and 1am BST is yesterday.

create or replace function public.report_funder_metrics(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org_id uuid;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_span int;
  v_prev_from date;
  v_prev_to date;
  v_mid date;
  v_result jsonb;
begin
  select org_id into v_org_id from user_profiles where id = auth.uid();
  if v_org_id is null then
    raise exception 'Not authorised';
  end if;

  if p_to < p_from then
    raise exception 'The end of the period cannot be before its start.';
  end if;

  v_span := greatest((p_to - p_from), 0);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;
  v_mid := p_from + (v_span / 2);

  with cur_sessions as (
    select * from sessions
    where org_id = v_org_id and session_date between p_from and p_to
      and cancelled_at is null
  ),
  delivered_sessions as (
    select * from cur_sessions where closed_at is not null or session_date < v_today
  ),
  cur_att as (
    select a.*, s.session_date, s.project_id
    from attendance a join cur_sessions s on s.id = a.session_id
  ),
  -- "Attended" means actually present. An absence is a marked place, not a
  -- person reached, and counting it as reach is how reach figures get inflated.
  present as (
    select * from cur_att where status in ('signed_in', 'signed_out')
  ),
  prev_att as (
    select a.* from attendance a
    join sessions s on s.id = a.session_id
    where s.org_id = v_org_id and s.session_date between v_prev_from and v_prev_to
  ),
  -- Sessions attended per person, which is what turns a headcount into a
  -- statement about depth.
  per_child as (
    select child_id, count(distinct session_id) as sessions_attended
    from present group by child_id
  ),
  -- New to us this period: nobody attended anything before p_from.
  prior_att as (
    select distinct a.child_id
    from attendance a join sessions s on s.id = a.session_id
    where s.org_id = v_org_id and s.session_date < p_from
      and a.status in ('signed_in', 'signed_out')
  ),
  -- Age at the end of the period, banded. Unknown is reported rather than
  -- dropped: a funder reading "24 young people" against bands summing to 19
  -- would rightly ask where the other five went.
  ages as (
    select c.id,
      case
        when c.date_of_birth is null then 'unknown'
        when extract(year from age(p_to, c.date_of_birth)) < 8 then 'under_8'
        when extract(year from age(p_to, c.date_of_birth)) < 12 then 'age_8_11'
        when extract(year from age(p_to, c.date_of_birth)) < 16 then 'age_12_15'
        when extract(year from age(p_to, c.date_of_birth)) < 19 then 'age_16_18'
        else 'age_19_plus'
      end as band
    from children c
    where c.org_id = v_org_id and c.id in (select child_id from per_child)
  ),
  -- Distance travelled. A single reading gives no pair: one score is a
  -- starting point, not a result.
  reads as (
    select child_id, area, score,
      row_number() over (partition by child_id, area order by recorded_at asc) as rn_first,
      row_number() over (partition by child_id, area order by recorded_at desc) as rn_last,
      count(*) over (partition by child_id, area) as n
    from outcome_scores
    where org_id = v_org_id and score is not null
      and (recorded_at at time zone 'Europe/London')::date between p_from and p_to
  ),
  pairs as (
    select f.child_id, f.area, f.score as baseline, l.score as latest,
           (l.score - f.score)::numeric as delta
    from reads f
    join reads l on l.child_id = f.child_id and l.area = f.area and l.rn_last = 1
    where f.rn_first = 1 and f.n >= 2
  ),
  -- Averaged per person first, so someone rated on ten areas does not outweigh
  -- nine people rated on one.
  per_person as (
    select child_id, avg(delta) as delta, count(*) as areas
    from pairs group by child_id
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'generated_at', now(),

    'reach', jsonb_build_object(
      'people', (select count(*) from per_child),
      'new_to_us', (select count(*) from per_child where child_id not in (select child_id from prior_att)),
      'returning', (select count(*) from per_child where child_id in (select child_id from prior_att)),
      'on_roll', (select count(*) from children where org_id = v_org_id and active = true),
      'schools', (select count(distinct c.school) from children c
                  where c.org_id = v_org_id and c.school is not null and c.school <> ''
                    and c.id in (select child_id from per_child)),
      'with_sen', (select count(*) from children c
                   where c.org_id = v_org_id and c.sen is not null and c.sen <> ''
                     and c.id in (select child_id from per_child)),
      'age_bands', (select coalesce(jsonb_object_agg(band, n), '{}'::jsonb)
                    from (select band, count(*) as n from ages group by band) t)
    ),

    'engagement', jsonb_build_object(
      -- Buckets, not an average: a mean of 3 sessions hides whether that is
      -- everyone attending three times or half attending once and half ten times.
      'attended_once', (select count(*) from per_child where sessions_attended = 1),
      'attended_2_4', (select count(*) from per_child where sessions_attended between 2 and 4),
      'attended_5_9', (select count(*) from per_child where sessions_attended between 5 and 9),
      'attended_10_plus', (select count(*) from per_child where sessions_attended >= 10),
      'median_sessions', (select percentile_cont(0.5) within group (order by sessions_attended)
                          from per_child),
      'total_attendances', (select count(*) from present),
      -- Still coming back by the second half of the period. Meaningless over a
      -- window too short to have halves, so it is null rather than misleading.
      'retained', case when v_span >= 27 then (
        select count(*) from (
          select child_id from present where session_date <= v_mid
          intersect
          select child_id from present where session_date > v_mid
        ) t
      ) else null end,
      'retention_base', case when v_span >= 27 then (
        select count(distinct child_id) from present where session_date <= v_mid
      ) else null end
    ),

    'delivery', jsonb_build_object(
      'sessions_planned', (select count(*) from cur_sessions),
      'sessions_delivered', (select count(*) from delivered_sessions),
      'contact_hours', (
        select coalesce(round(sum(extract(epoch from (end_time::time - start_time::time)) / 3600)), 0)
        from delivered_sessions where start_time is not null and end_time is not null
      ),
      -- Hours of provision received across everyone, which is the figure a
      -- cost-per-hour calculation actually needs.
      'participant_hours', (
        select coalesce(round(sum(extract(epoch from (s.end_time::time - s.start_time::time)) / 3600)), 0)
        from present p join cur_sessions s on s.id = p.session_id
        where s.start_time is not null and s.end_time is not null
      ),
      'locations', (select count(distinct location) from cur_sessions where location is not null),
      'projects', (select count(distinct project_id) from cur_sessions where project_id is not null)
    ),

    'attendance', jsonb_build_object(
      'rate', (select case when count(*) filter (where status in ('signed_in','signed_out','absent')) > 0
                 then round(100.0 * count(*) filter (where status in ('signed_in','signed_out'))
                          / count(*) filter (where status in ('signed_in','signed_out','absent')))
                 else null end from cur_att),
      'prev_rate', (select case when count(*) filter (where status in ('signed_in','signed_out','absent')) > 0
                      then round(100.0 * count(*) filter (where status in ('signed_in','signed_out'))
                               / count(*) filter (where status in ('signed_in','signed_out','absent')))
                      else null end from prev_att),
      'absences', (select count(*) from cur_att where status = 'absent')
    ),

    'outcomes', jsonb_build_object(
      'measured', (select count(*) from per_person),
      'tracked', (select count(distinct child_id) from reads),
      -- 0.5 matches MOVEMENT_THRESHOLD in distanceTravelled.js. Below that, a
      -- subjective 1-10 rating taken by different staff on different days is
      -- noise rather than evidence.
      'improved', (select count(*) from per_person where delta >= 0.5),
      'held', (select count(*) from per_person where delta > -0.5 and delta < 0.5),
      'declined', (select count(*) from per_person where delta <= -0.5),
      'avg_delta', (select round(avg(delta), 2) from per_person),
      'by_area', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'area', area, 'people', people, 'baseline', baseline, 'latest', latest, 'delta', delta
        ) order by delta desc), '[]'::jsonb)
        from (
          select area, count(distinct child_id) as people,
                 round(avg(baseline), 2) as baseline,
                 round(avg(latest), 2) as latest,
                 round(avg(delta), 2) as delta
          from pairs group by area
        ) a
      )
    ),

    'goals', jsonb_build_object(
      'completed', (select count(*) from goals
                    where org_id = v_org_id and completed_at is not null
                      and (completed_at at time zone 'Europe/London')::date between p_from and p_to),
      'active', (select count(*) from goals
                 where org_id = v_org_id and completed_at is null
                   and coalesce(status, 'active') <> 'completed')
    ),

    'safeguarding', jsonb_build_object(
      -- Aggregate only. No identifiable detail leaves this function.
      'open_concerns', (select count(*) from cause_for_concern
                        where org_id = v_org_id and resolved_at is null)
    )
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.report_funder_metrics(date, date) from public;
grant execute on function public.report_funder_metrics(date, date) to authenticated;

comment on function public.report_funder_metrics(date, date) is
  'Funder-grade reporting aggregate: reach with age bands, depth of engagement, retention, delivery volume, distance travelled and goals met. Org resolved from auth.uid(); aggregate figures only.';
