-- Session builder: a structured plan on each session, and a library of
-- reusable activities.
--
-- sessions.plan is the running order: an ordered list of activity blocks
-- (kind, title, minutes, details, equipment, lead, groups, outcome, safety,
-- easier/harder). Times are not stored; they follow from the session's start.
-- It sits on the session row, so it inherits the sessions policies as they
-- are: whoever may edit a session may edit its plan, and the volunteer portal
-- (read-only on sessions) can show the running order.
--
-- activity_library holds an organisation's own reusable activities. Everyone
-- in the organisation can read it; staff (owner, admin, manager, staff) write.

alter table public.sessions add column if not exists plan jsonb;

alter table public.sessions drop constraint if exists sessions_plan_shape;
alter table public.sessions add constraint sessions_plan_shape check (
  plan is null or (jsonb_typeof(plan) = 'array' and jsonb_array_length(plan) <= 60 and pg_column_size(plan) < 200000)
);

comment on column public.sessions.plan is 'Session builder running order: ordered activity blocks. Times derive from start_time.';

create table if not exists public.activity_library (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  kind text not null default 'activity',
  title text not null check (length(trim(title)) between 1 and 120),
  minutes integer not null default 15 check (minutes between 1 and 600),
  details text check (details is null or length(details) <= 4000),
  equipment text[] not null default '{}' check (cardinality(equipment) <= 40),
  area text check (area is null or length(area) <= 80),
  age_range text check (age_range is null or length(age_range) <= 40),
  outcome text check (outcome is null or length(outcome) <= 40),
  safety text check (safety is null or length(safety) <= 1000),
  easier text check (easier is null or length(easier) <= 600),
  harder text check (harder is null or length(harder) <= 600),
  use_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activity_library_org_idx on public.activity_library (org_id, kind);

alter table public.activity_library enable row level security;

drop policy if exists "activity library: org reads" on public.activity_library;
create policy "activity library: org reads" on public.activity_library
  for select to authenticated
  using (org_id = public.get_my_org_id());

drop policy if exists "activity library: staff add" on public.activity_library;
create policy "activity library: staff add" on public.activity_library
  for insert to authenticated
  with check (org_id = public.get_my_org_id() and public.is_org_staff(org_id));

drop policy if exists "activity library: staff edit" on public.activity_library;
create policy "activity library: staff edit" on public.activity_library
  for update to authenticated
  using (org_id = public.get_my_org_id() and public.is_org_staff(org_id))
  with check (org_id = public.get_my_org_id() and public.is_org_staff(org_id));

drop policy if exists "activity library: staff remove" on public.activity_library;
create policy "activity library: staff remove" on public.activity_library
  for delete to authenticated
  using (org_id = public.get_my_org_id() and public.is_org_staff(org_id));

grant select, insert, update, delete on public.activity_library to authenticated;
-- Supabase's default privileges also grant anon; signed-out visitors have no business here.
revoke all on public.activity_library from anon;

create or replace function public.touch_activity_library()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_activity_library on public.activity_library;
create trigger trg_touch_activity_library
  before update on public.activity_library
  for each row execute function public.touch_activity_library();

-- An organisation whose plan has ended reads but does not write.
drop trigger if exists trg_org_write_lock on public.activity_library;
create trigger trg_org_write_lock
  before insert or update or delete on public.activity_library
  for each row execute function public.enforce_org_write_lock();
