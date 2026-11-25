-- Reports & Insights: trends, comparisons and breakdowns in one aggregate.
--
-- The report_* functions each answer one report's question for one period.
-- The Insights page asks different questions of the same records -- how is
-- this going over time, compared with what, and for which part of our work --
-- and a single call keeps the page from firing a dozen requests to draw it.
--
-- Same conventions as report_delivery_metrics and its siblings:
--   * the org comes from the caller (get_my_org_id(), which also refuses a
--     suspended login), never from an argument
--   * Europe/London for every date boundary
--   * aggregates only; no child, volunteer or concern is named in the result
--   * a delivered session is one that is closed or whose date has passed, and
--     cancelled sessions count for nothing
--
-- Optional filters narrow the work being described:
--   p_project_ids  sessions that belong to these projects
--   p_groups       people in these groups (children.group_name), and the
--                  sessions planned for them (sessions.bubbles) or attended
--                  by them
-- An id or group from another organisation matches nothing, because every
-- row is first restricted to the caller's org.
--
-- Safeguarding figures are counts only and are returned to owners and admins
-- alone, the same rule report_safeguarding_metrics enforces. They describe
-- the whole organisation whatever the filters say: a concern belongs to a
-- child, not to a project, and quietly filtering them would hide some.

create or replace function public.report_insights_metrics(
  p_from date,
  p_to date,
  p_project_ids uuid[] default null,
  p_groups text[] default null
)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_org uuid;
  v_admin boolean;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_span int;
  v_pf date;
  v_pt date;
  v_bucket text;
  v_projects uuid[];
  v_groups text[];
  v_r jsonb;
begin
  v_org := get_my_org_id();
  if v_org is null then raise exception 'Not authorised'; end if;
  if p_to < p_from then raise exception 'The end of the period cannot be before its start.'; end if;
  -- Five years is far beyond any report anyone writes, and keeps a typo in a
  -- date box from asking for a series of thousands of weeks.
  if p_to - p_from > 1830 then raise exception 'Choose a period of five years or less.'; end if;

  v_admin := coalesce(is_org_admin(), false);
  v_span := p_to - p_from;
  v_pt := p_from - 1;
  v_pf := v_pt - v_span;
  -- Weekly points up to about four months, monthly beyond: enough points to
  -- see a shape, few enough to read on a phone.
  v_bucket := case when v_span <= 124 then 'week' else 'month' end;
  -- An empty array from the client means "no filter", the same as null.
  v_projects := case when cardinality(p_project_ids) > 0 then p_project_ids end;
  v_groups := case when cardinality(p_groups) > 0 then p_groups end;

  with win as (
    select 'cur'::text as w, p_from as f, p_to as t
    union all select 'prev', v_pf, v_pt
  ),
  grp_children as (
    select c.id from children c
    where c.org_id = v_org and v_groups is not null and c.group_name = any(v_groups)
  ),
  sess as (
    select s.*, win.w,
      -- An evening that runs past midnight ends "before" it starts on the
      -- clock; it is a session of (end + 24h - start), not a negative one.
      case when nullif(s.start_time, '') is not null and nullif(s.end_time, '') is not null
        then (extract(epoch from (s.end_time::time - s.start_time::time)) / 3600)
             + case when s.end_time::time < s.start_time::time then 24 else 0 end end as hours,
      (s.closed_at is not null or s.session_date < v_today) as delivered
    from sessions s
    join win on s.session_date between win.f and win.t
    where s.org_id = v_org
      and s.cancelled_at is null
      and (v_projects is null or s.project_id = any(v_projects))
      and (v_groups is null
           or s.bubbles && v_groups
           or exists (select 1 from attendance a
                      where a.session_id = s.id and a.child_id in (select id from grp_children)))
  ),
  att as (
    select a.child_id, a.status, s.session_date, s.w, s.id as session_id
    from attendance a join sess s on s.id = a.session_id
    where v_groups is null or a.child_id in (select id from grp_children)
  ),
  present as (select * from att where status in ('signed_in', 'signed_out')),
  marked as (select * from att where status in ('signed_in', 'signed_out', 'absent')),
  -- Volunteer time by the live register, the rule in src/lib/volunteerHours.js:
  -- from sign-in to sign-out; without a sign-out, until the register closed
  -- or an hour after the session was due to end, whichever came first.
  vol as (
    select ss.volunteer_id, s.w, s.session_date,
      greatest(extract(epoch from (
        coalesce(ss.signed_out_at, least(
          coalesce(s.closed_at, now()),
          ((case when ((nullif(s.end_time, '') is not null and nullif(s.start_time, '') is not null and s.end_time < s.start_time)
                       or s.session_type in ('trip', 'residential', 'holiday'))
                      and s.end_date > s.session_date then s.end_date else s.session_date end)
            + coalesce(nullif(s.end_time, '')::time, time '23:59:59')) at time zone 'Europe/London'
            + interval '60 minutes'
        )) - ss.signed_in_at)) / 3600, 0) as hours
    from session_staff ss join sess s on s.id = ss.session_id
    where ss.volunteer_id is not null and ss.signed_in_at is not null
  ),
  concerns as (
    select cf.created_at, win.w, (cf.created_at at time zone 'Europe/London')::date as d
    from cause_for_concern cf
    join win on (cf.created_at at time zone 'Europe/London')::date between win.f and win.t
    where v_admin and cf.org_id = v_org
  ),
  totals as (
    select win.w,
      (select count(*) from sess where sess.w = win.w and delivered) as sessions_delivered,
      (select count(*) from sess where sess.w = win.w) as sessions_planned,
      (select coalesce(round(sum(hours)), 0) from sess where sess.w = win.w and delivered) as hours,
      (select count(*) from present where present.w = win.w) as attendances,
      (select count(*) from marked where marked.w = win.w) as marked,
      (select case when count(*) > 0 then round(100.0 * count(*) filter (where status <> 'absent') / count(*)) end
         from marked where marked.w = win.w) as attendance_rate,
      (select count(distinct child_id) from present where present.w = win.w) as reached,
      -- New means never marked present anywhere in the organisation before
      -- that window began, the same test the engagement report uses.
      (select count(distinct pr.child_id) from present pr where pr.w = win.w
         and not exists (
           select 1 from attendance a2 join sessions s2 on s2.id = a2.session_id
           where a2.child_id = pr.child_id and s2.org_id = v_org
             and s2.session_date < win.f and a2.status in ('signed_in', 'signed_out'))) as new_people,
      (select coalesce(round(sum(hours)::numeric, 1), 0) from vol where vol.w = win.w) as volunteer_hours,
      (select count(distinct volunteer_id) from vol where vol.w = win.w) as volunteers,
      (select count(distinct location) from sess where sess.w = win.w and delivered
         and nullif(trim(location), '') is not null) as locations,
      case when v_admin then (select count(*) from concerns where concerns.w = win.w) end as concerns_raised
    from win
  ),
  buckets as (
    select greatest(b::date, p_from) as start,
      least((b + case when v_bucket = 'week' then interval '6 days' else interval '1 month' - interval '1 day' end)::date, p_to) as finish
    from generate_series(date_trunc(v_bucket, p_from::timestamp), p_to::timestamp,
                         case when v_bucket = 'week' then interval '1 week' else interval '1 month' end) b
  ),
  series as (
    select bk.start, bk.finish,
      (select count(*) from sess where w = 'cur' and delivered and session_date between bk.start and bk.finish) as sessions,
      (select coalesce(round(sum(hours)), 0) from sess where w = 'cur' and delivered and session_date between bk.start and bk.finish) as hours,
      (select count(*) from present where w = 'cur' and session_date between bk.start and bk.finish) as attendances,
      (select count(*) from marked where w = 'cur' and session_date between bk.start and bk.finish) as marked,
      (select case when count(*) > 0 then round(100.0 * count(*) filter (where status <> 'absent') / count(*)) end
         from marked where w = 'cur' and session_date between bk.start and bk.finish) as rate,
      (select count(distinct child_id) from present where w = 'cur' and session_date between bk.start and bk.finish) as reached,
      (select coalesce(round(sum(hours)::numeric, 1), 0) from vol where w = 'cur' and session_date between bk.start and bk.finish) as volunteer_hours,
      case when v_admin then (select count(*) from concerns where w = 'cur' and d between bk.start and bk.finish) end as concerns
    from buckets bk
  ),
  ages as (
    select case when c.date_of_birth is null then 'unknown'
      when extract(year from age(p_to, c.date_of_birth)) < 8 then 'under_8'
      when extract(year from age(p_to, c.date_of_birth)) < 12 then 'age_8_11'
      when extract(year from age(p_to, c.date_of_birth)) < 16 then 'age_12_15'
      when extract(year from age(p_to, c.date_of_birth)) < 19 then 'age_16_18'
      else 'age_19_plus' end as band
    from children c
    where c.org_id = v_org and c.id in (select child_id from present where w = 'cur')
  )
  select jsonb_build_object(
    'generated_at', now(),
    'from', p_from, 'to', p_to, 'prev_from', v_pf, 'prev_to', v_pt,
    'bucket', v_bucket,
    'filtered', jsonb_build_object(
      'projects', coalesce(cardinality(v_projects), 0),
      'groups', coalesce(cardinality(v_groups), 0)),
    'can_see_safeguarding', v_admin,
    'current', (select to_jsonb(t) - 'w' from totals t where t.w = 'cur'),
    'previous', (select to_jsonb(t) - 'w' from totals t where t.w = 'prev'),
    'series', (select coalesce(jsonb_agg(to_jsonb(s) order by s.start), '[]'::jsonb) from series s),
    'by_project', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'label', label, 'sessions', n, 'hours', h, 'reached', reached, 'rate', rate) order by n desc), '[]'::jsonb)
      from (select s.project_id as id, coalesce(p.name, 'Not part of a project') as label,
                   count(*) as n, coalesce(round(sum(s.hours)), 0) as h,
                   (select count(distinct pr.child_id) from present pr join sess s2 on s2.id = pr.session_id
                     where pr.w = 'cur' and s2.project_id is not distinct from s.project_id) as reached,
                   (select round(100.0 * count(*) filter (where m.status <> 'absent') / nullif(count(*), 0))
                      from marked m join sess s3 on s3.id = m.session_id
                     where m.w = 'cur' and s3.project_id is not distinct from s.project_id) as rate
            from sess s left join projects p on p.id = s.project_id and p.org_id = v_org
            where s.w = 'cur' and s.delivered
            group by 1, 2 order by 3 desc limit 12) x),
    'by_group', (select coalesce(jsonb_agg(jsonb_build_object('label', g, 'reached', n, 'attendances', a) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(c.group_name), ''), 'No group') as g,
                   count(distinct pr.child_id) as n, count(*) as a
            from present pr join children c on c.id = pr.child_id and c.org_id = v_org
            where pr.w = 'cur' group by 1 order by 2 desc limit 12) x),
    'by_location', (select coalesce(jsonb_agg(jsonb_build_object('label', l, 'sessions', n, 'hours', h) order by n desc), '[]'::jsonb)
      from (select trim(location) as l, count(*) as n, coalesce(round(sum(hours)), 0) as h
            from sess where w = 'cur' and delivered and nullif(trim(location), '') is not null
            group by 1 order by 2 desc limit 10) x),
    'by_type', (select coalesce(jsonb_agg(jsonb_build_object('label', t, 'sessions', n) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(trim(session_type), ''), 'unspecified') as t, count(*) as n
            from sess where w = 'cur' and delivered group by 1 order by 2 desc limit 8) x),
    'by_age', (select coalesce(jsonb_object_agg(band, n), '{}'::jsonb)
      from (select band, count(*) as n from ages group by 1) a),
    'safeguarding', case when v_admin then jsonb_build_object(
      'open_now', (select count(*) from cause_for_concern where org_id = v_org and resolved_at is null),
      'resolved_in_period', (select count(*) from cause_for_concern where org_id = v_org and resolved_at is not null
                             and (resolved_at at time zone 'Europe/London')::date between p_from and p_to),
      'follow_up_overdue', (select count(*) from cause_for_concern where org_id = v_org and resolved_at is null
                            and follow_up_due is not null and follow_up_due < v_today)) end,
    -- What the filter pickers offer. Names of projects and groups only.
    'options', jsonb_build_object(
      'projects', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'archived', archived_at is not null)
                     order by archived_at is not null, name), '[]'::jsonb)
                   from (select id, name, archived_at from projects where org_id = v_org order by created_at desc limit 200) p),
      'groups', (select coalesce(jsonb_agg(g order by g), '[]'::jsonb)
                 from (select distinct trim(group_name) as g from children
                       where org_id = v_org and active = true and nullif(trim(group_name), '') is not null limit 200) x))
  ) into v_r;
  return v_r;
end $function$;

revoke all on function public.report_insights_metrics(date, date, uuid[], text[]) from public;
revoke all on function public.report_insights_metrics(date, date, uuid[], text[]) from anon;
grant execute on function public.report_insights_metrics(date, date, uuid[], text[]) to authenticated;
