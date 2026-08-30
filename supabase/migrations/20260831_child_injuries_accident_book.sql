-- The accident book, ported from the Solidarity Sports hub.
--
-- A child hurt during a session has to be recorded the way an inspector or an
-- insurer would expect to find it: what happened, what was done about it, who
-- saw it, and when the parent was told.
--
-- The original is single-organisation, so its policies are role-only. Here the
-- first predicate on every policy is the organisation: an injury to one org's
-- child must never be readable by another, and org scoping is the first
-- consideration in any data change in this app rather than a finishing check.
--
-- Visibility is the reporter and org admins. A staff member sees what they
-- logged; everything else is an admin view. Deleting is admins only -- an
-- accident book anyone can erase is not an accident book.
--
-- Applied 2026-08-31. Verified by impersonating real users: a staff member can
-- insert and sees their own row; org_id defaults correctly from
-- get_my_org_id(); an admin in the same org sees it; an admin in a DIFFERENT
-- org sees 0 rows and their update and delete both affect 0 rows.

create table if not exists public.child_injuries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.get_my_org_id() references public.organisations(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete restrict,
  session_id uuid references public.sessions(id) on delete set null,
  occurred_at timestamptz not null,
  location text,
  what_happened text not null,
  injury_type text,
  body_part text,
  first_aid_given text,
  treated_by text,
  witnesses text,
  sent_to_hospital boolean not null default false,
  parent_notified boolean not null default false,
  parent_notified_at timestamptz,
  parent_notified_by uuid references auth.users(id),
  parent_notified_method text,
  follow_up_needed boolean not null default false,
  follow_up_notes text,
  reported_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.child_injuries is
  'Accident book. One row per injury. Org-scoped; visible to the person who logged it and to org admins.';
comment on column public.child_injuries.reported_by is
  'Who logged it. Half the visibility rule, so it defaults from auth.uid() and cannot be pointed at someone else on insert.';

create index if not exists child_injuries_org_idx on public.child_injuries (org_id, occurred_at desc);
create index if not exists child_injuries_child_idx on public.child_injuries (child_id, occurred_at desc);
create index if not exists child_injuries_reported_by_idx on public.child_injuries (reported_by);

alter table public.child_injuries enable row level security;

drop policy if exists "child_injuries read own or admin" on public.child_injuries;
create policy "child_injuries read own or admin"
  on public.child_injuries for select
  using (org_id = public.get_my_org_id() and (reported_by = auth.uid() or public.is_org_admin()));

-- can_edit_risk() is owner, admin, manager and staff. Volunteers are excluded,
-- matching the original's staff-only rule: this is a staff record.
drop policy if exists "child_injuries insert own" on public.child_injuries;
create policy "child_injuries insert own"
  on public.child_injuries for insert
  with check (org_id = public.get_my_org_id() and reported_by = auth.uid() and public.can_edit_risk());

drop policy if exists "child_injuries update own or admin" on public.child_injuries;
create policy "child_injuries update own or admin"
  on public.child_injuries for update
  using (org_id = public.get_my_org_id() and (reported_by = auth.uid() or public.is_org_admin()))
  with check (org_id = public.get_my_org_id() and (reported_by = auth.uid() or public.is_org_admin()));

drop policy if exists "child_injuries delete admin" on public.child_injuries;
create policy "child_injuries delete admin"
  on public.child_injuries for delete
  using (org_id = public.get_my_org_id() and public.is_org_admin());

create or replace function public.touch_child_injury()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  -- reported_by is half the visibility rule and org_id is the whole of the
  -- tenancy boundary. Neither is the editor's to move.
  if tg_op = 'UPDATE' then
    new.reported_by := old.reported_by;
    new.org_id := old.org_id;
  end if;
  return new;
end $$;

drop trigger if exists touch_child_injury on public.child_injuries;
create trigger touch_child_injury
  before update on public.child_injuries
  for each row execute function public.touch_child_injury();
