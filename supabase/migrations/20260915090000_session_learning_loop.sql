-- Connect session planning, staff reflection and reporting into one evidence loop.

alter table public.session_reflections
  add column if not exists engagement_rating smallint,
  add column if not exists inclusion_rating smallint,
  add column if not exists outcomes_observed text[] not null default '{}',
  add column if not exists evidence_notes text,
  add column if not exists participant_voice text,
  add column if not exists learning_tags text[] not null default '{}';

alter table public.session_reflections
  drop constraint if exists session_reflections_engagement_rating_check,
  add constraint session_reflections_engagement_rating_check
    check (engagement_rating is null or engagement_rating between 1 and 5),
  drop constraint if exists session_reflections_inclusion_rating_check,
  add constraint session_reflections_inclusion_rating_check
    check (inclusion_rating is null or inclusion_rating between 1 and 5);

create unique index if not exists session_reflections_one_per_session
  on public.session_reflections (session_id);

create table if not exists public.session_follow_up_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  reflection_id uuid not null references public.session_reflections(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  owner_id uuid references public.user_profiles(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'completed')),
  completed_at timestamptz,
  completed_by uuid references public.user_profiles(id) on delete set null,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_follow_up_actions_org_status_due_idx
  on public.session_follow_up_actions (org_id, status, due_date);
create index if not exists session_follow_up_actions_session_idx
  on public.session_follow_up_actions (session_id);

alter table public.session_follow_up_actions enable row level security;
grant select, insert, update, delete on public.session_follow_up_actions to authenticated;

drop policy if exists "Users see own org reflections" on public.session_reflections;
drop policy if exists "module gate: planner (read)" on public.session_reflections;
drop policy if exists "module gate: planner (insert)" on public.session_reflections;
drop policy if exists "module gate: planner (update)" on public.session_reflections;
drop policy if exists "module gate: planner (delete)" on public.session_reflections;

create policy "planner reflections read" on public.session_reflections
  for select to authenticated
  using (org_id = public.get_user_org_id() and public.module_can_view('planner'));
create policy "planner reflections insert" on public.session_reflections
  for insert to authenticated
  with check (org_id = public.get_user_org_id() and public.module_can_edit('planner'));
create policy "planner reflections update" on public.session_reflections
  for update to authenticated
  using (org_id = public.get_user_org_id() and public.module_can_edit('planner'))
  with check (org_id = public.get_user_org_id() and public.module_can_edit('planner'));
create policy "planner reflections delete" on public.session_reflections
  for delete to authenticated
  using (org_id = public.get_user_org_id() and public.module_can_edit('planner'));

create policy "planner follow ups read" on public.session_follow_up_actions
  for select to authenticated
  using (org_id = public.get_user_org_id() and public.module_can_view('planner'));
create policy "planner follow ups insert" on public.session_follow_up_actions
  for insert to authenticated
  with check (org_id = public.get_user_org_id() and public.module_can_edit('planner'));
create policy "planner follow ups update" on public.session_follow_up_actions
  for update to authenticated
  using (org_id = public.get_user_org_id() and public.module_can_edit('planner'))
  with check (org_id = public.get_user_org_id() and public.module_can_edit('planner'));
create policy "planner follow ups delete" on public.session_follow_up_actions
  for delete to authenticated
  using (org_id = public.get_user_org_id() and public.module_can_edit('planner'));

create or replace function public.report_session_learning_metrics(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Invalid date range'; end if;

  select org_id into v_org from public.user_profiles where id = auth.uid();
  if v_org is null then raise exception 'No organisation found'; end if;

  with delivered as (
    select s.id, coalesce(s.reflection_required, true) as reflection_required
    from public.sessions s
    where s.org_id = v_org
      and s.session_date between p_from and p_to
      and s.cancelled_at is null
      and (s.status = 'completed' or s.closed_at is not null or s.session_date < v_today)
  ), reflections as (
    select r.* from public.session_reflections r join delivered d on d.id = r.session_id
    where r.org_id = v_org
  ), actions as (
    select a.* from public.session_follow_up_actions a join delivered d on d.id = a.session_id
    where a.org_id = v_org
  ), observed as (
    select x.label, count(*)::int as n
    from reflections r cross join lateral unnest(r.outcomes_observed) x(label)
    group by x.label order by n desc, x.label
  ), tags as (
    select x.label, count(*)::int as n
    from reflections r cross join lateral unnest(r.learning_tags) x(label)
    group by x.label order by n desc, x.label
  )
  select jsonb_build_object(
    'delivered', (select count(*) from delivered),
    'reflection_required', (select count(*) from delivered where reflection_required),
    'reflections_completed', (select count(*) from reflections r join delivered d on d.id = r.session_id where d.reflection_required),
    'avg_overall', (select round(avg(overall_rating)::numeric, 1) from reflections),
    'avg_engagement', (select round(avg(engagement_rating)::numeric, 1) from reflections),
    'avg_inclusion', (select round(avg(inclusion_rating)::numeric, 1) from reflections),
    'evidence_count', (select count(*) from reflections where nullif(btrim(evidence_notes), '') is not null),
    'participant_voice_count', (select count(*) from reflections where nullif(btrim(participant_voice), '') is not null),
    'would_repeat', (select count(*) from reflections where would_repeat is true),
    'needs_changes', (select count(*) from reflections where would_repeat is false),
    'safeguarding_flags', (select count(*) from reflections where safeguarding_flag is true),
    'actions_total', (select count(*) from actions),
    'actions_open', (select count(*) from actions where status = 'open'),
    'actions_overdue', (select count(*) from actions where status = 'open' and due_date < v_today),
    'actions_completed', (select count(*) from actions where status = 'completed'),
    'observed_outcomes', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'n', n)) from observed), '[]'::jsonb),
    'learning_tags', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'n', n)) from tags), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.report_session_learning_metrics(date, date) from public, anon;
grant execute on function public.report_session_learning_metrics(date, date) to authenticated;
