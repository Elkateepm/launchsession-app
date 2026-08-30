-- One aggregate per report.
--
-- Until now every entry in REPORT_LIBRARY called report_overview_metrics and
-- printed a different subset of its fourteen numbers, so a "Session Delivery
-- Report" and a "Safeguarding Report" were the same query wearing different
-- titles. Each report now asks its own question of the database.
--
-- Conventions shared by all of them:
--   * org resolved from auth.uid(), never accepted from the client
--   * Europe/London for every date boundary -- the database runs UTC and the
--     organisations are in the UK, so current_date in the small hours of BST
--     is yesterday
--   * aggregates and small ranked lists only; nothing returns a full table dump
--   * a delivered session is one that is closed or whose date has passed

-- ─────────────────────────────────────────────── session delivery

create or replace function public.report_delivery_metrics(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid; v_today date := (now() at time zone 'Europe/London')::date; v_r jsonb;
begin
  select org_id into v_org from user_profiles where id = auth.uid();
  if v_org is null then raise exception 'Not authorised'; end if;
  if p_to < p_from then raise exception 'The end of the period cannot be before its start.'; end if;

  with sess as (
    select * from sessions where org_id = v_org and session_date between p_from and p_to
  ),
  live as (select * from sess where cancelled_at is null),
  delivered as (select * from live where closed_at is not null or session_date < v_today),
  dur as (
    select d.*, extract(epoch from (d.end_time::time - d.start_time::time)) / 3600 as hours
    from delivered d where d.start_time is not null and d.end_time is not null
  )
  select jsonb_build_object(
    'planned', (select count(*) from live),
    'delivered', (select count(*) from delivered),
    'cancelled', (select count(*) from sess where cancelled_at is not null),
    'hours', (select coalesce(round(sum(hours)), 0) from dur),
    'avg_duration', (select round(avg(hours), 1) from dur),
    'locations', (select count(distinct location) from live where location is not null),
    -- A session nobody was rostered to is a gap in the record, not necessarily
    -- in the staffing, but it is the only signal available here.
    'unstaffed', (select count(*) from delivered d
                  where not exists (select 1 from session_staff ss where ss.session_id = d.id)),
    'by_type', (select coalesce(jsonb_agg(jsonb_build_object('label', t, 'n', n, 'hours', h) order by n desc), '[]'::jsonb)
      from (select coalesce(session_type, 'unspecified') as t, count(*) as n,
                   coalesce(round(sum(extract(epoch from (end_time::time - start_time::time)) / 3600)), 0) as h
            from delivered group by 1) x),
    'by_month', (select coalesce(jsonb_agg(jsonb_build_object('label', m, 'n', n, 'hours', h) order by sort), '[]'::jsonb)
      from (select to_char(session_date, 'Mon YYYY') as m, date_trunc('month', session_date) as sort,
                   count(*) as n,
                   coalesce(round(sum(extract(epoch from (end_time::time - start_time::time)) / 3600)), 0) as h
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
    )
  ) into v_r;
  return v_r;
end $function$;

-- ─────────────────────────────────────────────── attendance

create or replace function public.report_attendance_metrics(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid; v_span int; v_pf date; v_pt date; v_r jsonb;
begin
  select org_id into v_org from user_profiles where id = auth.uid();
  if v_org is null then raise exception 'Not authorised'; end if;
  if p_to < p_from then raise exception 'The end of the period cannot be before its start.'; end if;
  v_span := greatest((p_to - p_from), 0); v_pt := p_from - 1; v_pf := v_pt - v_span;

  with sess as (select * from sessions where org_id = v_org and session_date between p_from and p_to and cancelled_at is null),
  att as (select a.*, s.session_date, s.title from attendance a join sess s on s.id = a.session_id),
  marked as (select * from att where status in ('signed_in','signed_out','absent')),
  prev as (select a.* from attendance a join sessions s on s.id = a.session_id
           where s.org_id = v_org and s.session_date between v_pf and v_pt
             and a.status in ('signed_in','signed_out','absent')),
  per_session as (
    select s.id, s.title, s.session_date,
           count(*) filter (where a.status in ('signed_in','signed_out')) as present,
           count(*) filter (where a.status in ('signed_in','signed_out','absent')) as marked
    from sess s join attendance a on a.session_id = s.id group by 1,2,3
  )
  select jsonb_build_object(
    'rate', (select case when count(*) > 0 then round(100.0 * count(*) filter (where status in ('signed_in','signed_out')) / count(*)) end from marked),
    'prev_rate', (select case when count(*) > 0 then round(100.0 * count(*) filter (where status in ('signed_in','signed_out')) / count(*)) end from prev),
    'attended', (select count(*) from att where status in ('signed_in','signed_out')),
    'absent', (select count(*) from att where status = 'absent'),
    'marked', (select count(*) from marked),
    -- Places on a register nobody ever marked either way. An unmarked place is
    -- not an absence, and counting it as one would understate attendance.
    'unmarked', (select count(*) from att where status not in ('signed_in','signed_out','absent')),
    'by_month', (select coalesce(jsonb_agg(jsonb_build_object('label', m, 'rate', rate, 'n', n) order by sort), '[]'::jsonb)
      from (select to_char(session_date, 'Mon YYYY') as m, date_trunc('month', session_date) as sort,
                   count(*) as n,
                   round(100.0 * count(*) filter (where status in ('signed_in','signed_out')) / nullif(count(*), 0)) as rate
            from marked group by 1,2) x),
    'absence_reasons', (select coalesce(jsonb_agg(jsonb_build_object('label', r, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(absence_reason), ''), 'No reason recorded') as r, count(*) as n
            from att where status = 'absent' group by 1 order by 2 desc limit 8) x),
    -- Named because this report is read by the staff who would act on it, and
    -- repeat absence is the thing it exists to surface.
    'repeat_absentees', (select coalesce(jsonb_agg(jsonb_build_object('label', nm, 'n', n) order by n desc), '[]'::jsonb)
      from (select trim(c.first_name || ' ' || coalesce(c.last_name, '')) as nm, count(*) as n
            from att a join children c on c.id = a.child_id
            where a.status = 'absent' group by 1 having count(*) >= 2 order by 2 desc limit 10) x),
    'lowest_sessions', (select coalesce(jsonb_agg(jsonb_build_object('label', title, 'rate', rate, 'n', marked) order by rate), '[]'::jsonb)
      from (select title, marked, round(100.0 * present / nullif(marked, 0)) as rate
            from per_session where marked >= 3 order by 3 limit 5) x)
  ) into v_r;
  return v_r;
end $function$;

-- ─────────────────────────────────────────────── young people engagement

create or replace function public.report_young_people_metrics(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid; v_span int; v_mid date; v_r jsonb;
begin
  select org_id into v_org from user_profiles where id = auth.uid();
  if v_org is null then raise exception 'Not authorised'; end if;
  if p_to < p_from then raise exception 'The end of the period cannot be before its start.'; end if;
  v_span := greatest((p_to - p_from), 0); v_mid := p_from + (v_span / 2);

  with sess as (select * from sessions where org_id = v_org and session_date between p_from and p_to and cancelled_at is null),
  present as (select a.*, s.session_date from attendance a join sess s on s.id = a.session_id
              where a.status in ('signed_in','signed_out')),
  per_child as (select child_id, count(distinct session_id) as n from present group by 1),
  prior as (select distinct a.child_id from attendance a join sessions s on s.id = a.session_id
            where s.org_id = v_org and s.session_date < p_from and a.status in ('signed_in','signed_out')),
  ages as (
    select case when c.date_of_birth is null then 'unknown'
      when extract(year from age(p_to, c.date_of_birth)) < 8 then 'under_8'
      when extract(year from age(p_to, c.date_of_birth)) < 12 then 'age_8_11'
      when extract(year from age(p_to, c.date_of_birth)) < 16 then 'age_12_15'
      when extract(year from age(p_to, c.date_of_birth)) < 19 then 'age_16_18'
      else 'age_19_plus' end as band
    from children c where c.org_id = v_org and c.id in (select child_id from per_child)
  )
  select jsonb_build_object(
    'reached', (select count(*) from per_child),
    'on_roll', (select count(*) from children where org_id = v_org and active = true),
    'new_to_us', (select count(*) from per_child where child_id not in (select child_id from prior)),
    'returning', (select count(*) from per_child where child_id in (select child_id from prior)),
    -- Known to us, attended before, did not attend at all in this period.
    'lapsed', (select count(*) from prior where child_id not in (select child_id from per_child)),
    'with_sen', (select count(*) from children c where c.org_id = v_org
                 and c.sen is not null and c.sen <> '' and c.id in (select child_id from per_child)),
    'schools', (select count(distinct school) from children where org_id = v_org
                and school is not null and school <> '' and id in (select child_id from per_child)),
    'walk_ins', (select count(*) from children where org_id = v_org and is_walk_in = true
                 and id in (select child_id from per_child)),
    'total_attendances', (select count(*) from present),
    'median_sessions', (select percentile_cont(0.5) within group (order by n) from per_child),
    'attended_once', (select count(*) from per_child where n = 1),
    'attended_2_4', (select count(*) from per_child where n between 2 and 4),
    'attended_5_9', (select count(*) from per_child where n between 5 and 9),
    'attended_10_plus', (select count(*) from per_child where n >= 10),
    'retained', case when v_span >= 27 then (select count(*) from (
        select child_id from present where session_date <= v_mid
        intersect select child_id from present where session_date > v_mid) t) end,
    'retention_base', case when v_span >= 27 then
      (select count(distinct child_id) from present where session_date <= v_mid) end,
    'age_bands', (select coalesce(jsonb_object_agg(band, n), '{}'::jsonb)
                  from (select band, count(*) as n from ages group by 1) t),
    'by_group', (select coalesce(jsonb_agg(jsonb_build_object('label', g, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(c.group_name), ''), 'No group') as g, count(*) as n
            from children c where c.org_id = v_org and c.id in (select child_id from per_child)
            group by 1 order by 2 desc limit 12) x),
    'most_engaged', (select coalesce(jsonb_agg(jsonb_build_object('label', nm, 'n', n) order by n desc), '[]'::jsonb)
      from (select trim(c.first_name || ' ' || coalesce(c.last_name, '')) as nm, pc.n
            from per_child pc join children c on c.id = pc.child_id
            order by pc.n desc limit 10) x)
  ) into v_r;
  return v_r;
end $function$;

-- ─────────────────────────────────────────────── impact

create or replace function public.report_impact_metrics(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid; v_today date := (now() at time zone 'Europe/London')::date; v_r jsonb;
begin
  select org_id into v_org from user_profiles where id = auth.uid();
  if v_org is null then raise exception 'Not authorised'; end if;
  if p_to < p_from then raise exception 'The end of the period cannot be before its start.'; end if;

  with reads as (
    select child_id, area, score,
      row_number() over (partition by child_id, area order by recorded_at asc) as rf,
      row_number() over (partition by child_id, area order by recorded_at desc) as rl,
      count(*) over (partition by child_id, area) as n
    from outcome_scores where org_id = v_org and score is not null
      and (recorded_at at time zone 'Europe/London')::date between p_from and p_to
  ),
  pairs as (
    select f.child_id, f.area, f.score as baseline, l.score as latest, (l.score - f.score)::numeric as delta
    from reads f join reads l on l.child_id = f.child_id and l.area = f.area and l.rl = 1
    where f.rf = 1 and f.n >= 2
  ),
  per_person as (select child_id, avg(delta) as delta, count(*) as areas from pairs group by 1)
  select jsonb_build_object(
    'readings', (select count(*) from reads),
    'tracked', (select count(distinct child_id) from reads),
    'measured', (select count(*) from per_person),
    'improved', (select count(*) from per_person where delta >= 0.5),
    'held', (select count(*) from per_person where delta > -0.5 and delta < 0.5),
    'declined', (select count(*) from per_person where delta <= -0.5),
    'avg_delta', (select round(avg(delta), 2) from per_person),
    'by_area', (select coalesce(jsonb_agg(jsonb_build_object(
        'area', area, 'people', people, 'baseline', baseline, 'latest', latest, 'delta', delta) order by delta desc), '[]'::jsonb)
      from (select area, count(distinct child_id) as people, round(avg(baseline),2) as baseline,
                   round(avg(latest),2) as latest, round(avg(delta),2) as delta
            from pairs group by 1) a),
    -- Candidates for a case study: the individual journeys behind the averages.
    'most_improved', (select coalesce(jsonb_agg(jsonb_build_object('label', nm, 'delta', d, 'areas', ar) order by d desc), '[]'::jsonb)
      from (select trim(c.first_name || ' ' || coalesce(c.last_name,'')) as nm,
                   round(pp.delta, 1) as d, pp.areas as ar
            from per_person pp join children c on c.id = pp.child_id
            where pp.delta >= 0.5 order by pp.delta desc limit 8) x),
    'needs_attention', (select coalesce(jsonb_agg(jsonb_build_object('label', nm, 'delta', d, 'areas', ar) order by d), '[]'::jsonb)
      from (select trim(c.first_name || ' ' || coalesce(c.last_name,'')) as nm,
                   round(pp.delta, 1) as d, pp.areas as ar
            from per_person pp join children c on c.id = pp.child_id
            where pp.delta <= -0.5 order by pp.delta limit 8) x),
    'goals', jsonb_build_object(
      'completed', (select count(*) from goals where org_id = v_org and completed_at is not null
                    and (completed_at at time zone 'Europe/London')::date between p_from and p_to),
      'created', (select count(*) from goals where org_id = v_org
                  and (created_at at time zone 'Europe/London')::date between p_from and p_to),
      'active', (select count(*) from goals where org_id = v_org and completed_at is null
                 and coalesce(status,'active') <> 'completed'),
      'overdue', (select count(*) from goals where org_id = v_org and completed_at is null
                  and coalesce(status,'active') <> 'completed' and target_date is not null and target_date < v_today),
      'by_area', (select coalesce(jsonb_agg(jsonb_build_object('label', a, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(nullif(trim(area),''), 'Unassigned') as a, count(*) as n
              from goals where org_id = v_org group by 1 order by 2 desc limit 10) x)
    )
  ) into v_r;
  return v_r;
end $function$;

-- ─────────────────────────────────────────────── workforce

create or replace function public.report_workforce_metrics(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid; v_today date := (now() at time zone 'Europe/London')::date; v_r jsonb;
begin
  select org_id into v_org from user_profiles where id = auth.uid();
  if v_org is null then raise exception 'Not authorised'; end if;
  if p_to < p_from then raise exception 'The end of the period cannot be before its start.'; end if;

  with sess as (
    select s.*, extract(epoch from (s.end_time::time - s.start_time::time)) / 3600 as hours
    from sessions s where s.org_id = v_org and s.session_date between p_from and p_to
      and s.cancelled_at is null
  ),
  roster as (
    select ss.*, s.hours, s.session_date,
      coalesce(up.full_name, trim(v.first_name || ' ' || coalesce(v.last_name,''))) as person,
      case when ss.user_id is not null then 'Staff' else 'Volunteer' end as kind
    from session_staff ss
    join sess s on s.id = ss.session_id
    left join user_profiles up on up.id = ss.user_id
    left join volunteers v on v.id = ss.volunteer_id
  ),
  slots as (select vs.* from session_volunteer_slots vs join sess s on s.id = vs.session_id)
  select jsonb_build_object(
    'people', (select count(distinct coalesce(user_id::text, volunteer_id::text)) from roster),
    'staff', (select count(distinct user_id) from roster where user_id is not null),
    'volunteers', (select count(distinct volunteer_id) from roster where volunteer_id is not null),
    'assignments', (select count(*) from roster),
    'hours', (select coalesce(round(sum(hours)), 0) from roster where hours is not null),
    'sessions_covered', (select count(distinct session_id) from roster),
    'sessions_total', (select count(*) from sess),
    'avg_per_session', (select round(count(*)::numeric / nullif(count(distinct session_id), 0), 1) from roster),
    'by_person', (select coalesce(jsonb_agg(jsonb_build_object(
        'label', person, 'kind', kind, 'n', n, 'hours', h) order by n desc), '[]'::jsonb)
      from (select person, kind, count(*) as n, coalesce(round(sum(hours)), 0) as h
            from roster where person is not null and person <> '' group by 1,2 order by 3 desc limit 20) x),
    'by_role', (select coalesce(jsonb_agg(jsonb_build_object('label', r, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(role),''), 'Unspecified') as r, count(*) as n
            from roster group by 1 order by 2 desc limit 10) x),
    'volunteer_slots', jsonb_build_object(
      'required', (select coalesce(sum(spaces_required), 0) from slots),
      'filled', (select coalesce(sum(spaces_filled), 0) from slots)
    ),
    -- Compliance figures, deliberately counts only: a report is not the place
    -- to list who is out of date.
    'dbs', jsonb_build_object(
      'volunteers_expired', (select count(*) from volunteers where org_id = v_org and active = true
                             and dbs_expiry is not null and dbs_expiry < v_today),
      'volunteers_expiring_90d', (select count(*) from volunteers where org_id = v_org and active = true
                                  and dbs_expiry between v_today and v_today + 90),
      'volunteers_missing', (select count(*) from volunteers where org_id = v_org and active = true
                             and (dbs_number is null or dbs_number = ''))
    )
  ) into v_r;
  return v_r;
end $function$;

-- ─────────────────────────────────────────────── projects

create or replace function public.report_project_metrics(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid; v_today date := (now() at time zone 'Europe/London')::date; v_r jsonb;
begin
  select org_id into v_org from user_profiles where id = auth.uid();
  if v_org is null then raise exception 'Not authorised'; end if;
  if p_to < p_from then raise exception 'The end of the period cannot be before its start.'; end if;

  with proj as (
    select p.* from projects p
    where p.org_id = v_org and p.archived_at is null
      and coalesce(p.start_date, p_from) <= p_to
      and coalesce(p.end_date, p_to) >= p_from
  ),
  psess as (
    select s.*, extract(epoch from (s.end_time::time - s.start_time::time)) / 3600 as hours
    from sessions s where s.org_id = v_org and s.project_id is not null
      and s.session_date between p_from and p_to and s.cancelled_at is null
  ),
  rows_ as (
    select pr.id, pr.name, pr.project_type, pr.status, pr.start_date, pr.end_date,
      (select count(*) from psess s where s.project_id = pr.id) as sessions,
      (select coalesce(round(sum(s.hours)), 0) from psess s where s.project_id = pr.id) as hours,
      (select count(distinct a.child_id) from attendance a join psess s on s.id = a.session_id
       where s.project_id = pr.id and a.status in ('signed_in','signed_out')) as participants,
      (select count(*) from project_participants pp where pp.project_id = pr.id) as enrolled,
      (select round(100.0 * count(*) filter (where a.status in ('signed_in','signed_out'))
              / nullif(count(*) filter (where a.status in ('signed_in','signed_out','absent')), 0))
       from attendance a join psess s on s.id = a.session_id where s.project_id = pr.id) as rate
    from proj pr
  )
  select jsonb_build_object(
    'projects', (select count(*) from rows_),
    'sessions', (select coalesce(sum(sessions), 0) from rows_),
    'hours', (select coalesce(sum(hours), 0) from rows_),
    'participants', (select count(distinct a.child_id) from attendance a join psess s on s.id = a.session_id
                     where a.status in ('signed_in','signed_out')),
    'active_now', (select count(*) from proj where coalesce(start_date, v_today) <= v_today
                   and coalesce(end_date, v_today) >= v_today),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', name, 'type', project_type, 'status', status,
        'start', start_date, 'end', end_date, 'sessions', sessions, 'hours', hours,
        'participants', participants, 'enrolled', enrolled, 'rate', rate) order by sessions desc), '[]'::jsonb)
      from rows_)
  ) into v_r;
  return v_r;
end $function$;

-- ─────────────────────────────────────────────── safeguarding

create or replace function public.report_safeguarding_metrics(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid; v_today date := (now() at time zone 'Europe/London')::date; v_r jsonb;
begin
  select org_id into v_org from user_profiles where id = auth.uid();
  if v_org is null then raise exception 'Not authorised'; end if;
  -- Enforced here as well as in the UI. An org-scoped policy alone would let
  -- every member of the organisation read this, whatever the screen shows.
  if not is_org_admin() then raise exception 'Not authorised'; end if;
  if p_to < p_from then raise exception 'The end of the period cannot be before its start.'; end if;

  with c as (
    select * from cause_for_concern
    where org_id = v_org and (created_at at time zone 'Europe/London')::date between p_from and p_to
  )
  select jsonb_build_object(
    'raised', (select count(*) from c),
    'resolved', (select count(*) from c where resolved_at is not null),
    'open', (select count(*) from c where resolved_at is null),
    'open_all_time', (select count(*) from cause_for_concern where org_id = v_org and resolved_at is null),
    'dsl_notified', (select count(*) from c where dsl_notified is true or dsl_notified_at is not null),
    'parents_notified', (select count(*) from c where parents_notified is true),
    'police_notified', (select count(*) from c where police_notified is true),
    'follow_up_overdue', (select count(*) from cause_for_concern where org_id = v_org
                          and resolved_at is null and follow_up_due is not null and follow_up_due < v_today),
    -- Median, not mean: one concern left open for months would otherwise
    -- describe a response time nobody actually experienced.
    'median_days_to_resolve', (select round(percentile_cont(0.5) within group (
        order by extract(epoch from (resolved_at - created_at)) / 86400)::numeric, 1)
      from c where resolved_at is not null),
    'median_hours_to_dsl', (select round(percentile_cont(0.5) within group (
        order by extract(epoch from (dsl_notified_at - created_at)) / 3600)::numeric, 1)
      from c where dsl_notified_at is not null),
    'by_type', (select coalesce(jsonb_agg(jsonb_build_object('label', t, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(concern_type),''), 'Unspecified') as t, count(*) as n
            from c group by 1 order by 2 desc limit 12) x),
    'by_priority', (select coalesce(jsonb_agg(jsonb_build_object('label', p, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(priority),''), 'Unset') as p, count(*) as n
            from c group by 1) x),
    'by_status', (select coalesce(jsonb_agg(jsonb_build_object('label', s, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(status),''), 'Unset') as s, count(*) as n
            from c group by 1) x),
    'by_month', (select coalesce(jsonb_agg(jsonb_build_object('label', m, 'n', n) order by sort), '[]'::jsonb)
      from (select to_char(created_at, 'Mon YYYY') as m, date_trunc('month', created_at) as sort, count(*) as n
            from c group by 1,2) x)
  ) into v_r;
  return v_r;
end $function$;

-- ─────────────────────────────────────────────── grants

revoke all on function public.report_delivery_metrics(date, date) from public;
revoke all on function public.report_attendance_metrics(date, date) from public;
revoke all on function public.report_young_people_metrics(date, date) from public;
revoke all on function public.report_impact_metrics(date, date) from public;
revoke all on function public.report_workforce_metrics(date, date) from public;
revoke all on function public.report_project_metrics(date, date) from public;
revoke all on function public.report_safeguarding_metrics(date, date) from public;

grant execute on function public.report_delivery_metrics(date, date) to authenticated;
grant execute on function public.report_attendance_metrics(date, date) to authenticated;
grant execute on function public.report_young_people_metrics(date, date) to authenticated;
grant execute on function public.report_impact_metrics(date, date) to authenticated;
grant execute on function public.report_workforce_metrics(date, date) to authenticated;
grant execute on function public.report_project_metrics(date, date) to authenticated;
grant execute on function public.report_safeguarding_metrics(date, date) to authenticated;
