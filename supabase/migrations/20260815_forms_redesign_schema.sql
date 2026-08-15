-- Forms redesign: additive schema.
-- Applied to project ssahcqeqrxawmwtjpwvh as migration forms_redesign_schema.

alter table public.org_forms
  add column if not exists purpose text,
  add column if not exists linked_project_id uuid,
  add column if not exists linked_session_id uuid,
  add column if not exists intro_text text,
  add column if not exists confirmation_message text,
  add column if not exists closing_date date,
  add column if not exists accent_color text,
  add column if not exists cover_image_url text,
  add column if not exists multi_step boolean not null default false,
  add column if not exists created_by uuid;

alter table public.form_submissions
  add column if not exists review_status text not null default 'new'
    check (review_status in ('new', 'needs_review', 'reviewed')),
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists flags text[] not null default '{}',
  add column if not exists submitted_name text,
  add column if not exists linked_child_id uuid;

create index if not exists idx_form_subs_review
  on public.form_submissions(org_id, review_status, created_at desc);

create table if not exists public.org_form_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  description text,
  purpose text,
  icon text,
  fields jsonb not null default '[]'::jsonb,
  use_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_form_templates_org on public.org_form_templates(org_id);

alter table public.org_form_templates enable row level security;

drop policy if exists "org form templates read" on public.org_form_templates;
create policy "org form templates read" on public.org_form_templates
  for select using (org_id = get_my_org_id());

drop policy if exists "org form templates write" on public.org_form_templates;
create policy "org form templates write" on public.org_form_templates
  for all using (org_id = get_my_org_id() and is_org_admin())
  with check (org_id = get_my_org_id() and is_org_admin());
