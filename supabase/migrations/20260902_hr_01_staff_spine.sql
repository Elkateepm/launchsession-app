-- HR & Staff, part 1 of 3: the staff spine and the records that hang off it.
--
-- CANONICAL STAFF IDENTITY: public.hr_staff.
--
-- Not user_profiles. user_profiles is the source of truth for *accounts* --
-- who can sign in, their role, their module access -- and it holds 4 rows.
-- hr_staff holds 9, of which only 1 has user_id set. The other 8 are real
-- people the organisation employs who have never needed a dashboard login:
-- sessional workers, bank staff, a volunteer coordinator. An HR system keyed
-- on user_profiles could not hold a record for any of them.
--
-- So: user_profiles.id is identity, hr_staff.id is employment, and
-- hr_staff.user_id joins the two (already unique-indexed, already how
-- staff_leave and hr_staff_directory() work). Every table below references
-- hr_staff(id, org_id) so the tenant travels with the foreign key.

-- ── Employment lives on hr_staff, not a parallel staff_employment table ──
-- hr_staff already carries contract_type, start_date, job_title and DBS. A
-- second table would reintroduce exactly the split that 20260815_hr_consolidation
-- was written to close.
alter table public.hr_staff
  add column if not exists staff_ref text,
  add column if not exists employment_type text not null default 'employee',
  add column if not exists department text,
  add column if not exists line_manager_id uuid,
  add column if not exists continuous_service_date date,
  add column if not exists contracted_hours numeric(6,2),
  add column if not exists work_location text,
  add column if not exists probation_required boolean not null default false,
  add column if not exists probation_start date,
  add column if not exists probation_end date,
  add column if not exists probation_status text,
  add column if not exists notice_period text,
  add column if not exists employment_status text not null default 'active',
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists leaving_date date,
  add column if not exists leaving_reason text,
  add column if not exists payroll_ref text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hr_staff_employment_type_chk') then
    alter table public.hr_staff add constraint hr_staff_employment_type_chk
      check (employment_type in ('employee','sessional','volunteer','contractor','trustee'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hr_staff_employment_status_chk') then
    alter table public.hr_staff add constraint hr_staff_employment_status_chk
      check (employment_status in ('active','suspended','on_leave','leaving','left'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hr_staff_probation_status_chk') then
    alter table public.hr_staff add constraint hr_staff_probation_status_chk
      check (probation_status is null or probation_status in ('in_progress','passed','extended','further_review','ended'));
  end if;
  -- Line manager must be another staff record in the same organisation.
  if not exists (select 1 from pg_constraint where conname = 'hr_staff_line_manager_fk') then
    alter table public.hr_staff add constraint hr_staff_line_manager_fk
      foreign key (line_manager_id, org_id) references public.hr_staff(id, org_id) on delete set null;
  end if;
end $$;

create index if not exists idx_hr_staff_line_manager on public.hr_staff(line_manager_id);
create index if not exists idx_hr_staff_org_status on public.hr_staff(org_id, employment_status);
create index if not exists idx_hr_staff_probation_end on public.hr_staff(org_id, probation_end)
  where probation_required and probation_status = 'in_progress';

-- ── Absence: extend staff_leave rather than add staff_absences ───────────
-- staff_leave already holds staff_id/org_id/type/start/end/days/notes against
-- the same spine. Sickness is a kind of leave, not a separate universe.
alter table public.staff_leave
  add column if not exists category text not null default 'annual_leave',
  add column if not exists status text not null default 'recorded',
  add column if not exists reported_to uuid references auth.users(id) on delete set null,
  add column if not exists rtw_required boolean not null default false,
  add column if not exists rtw_completed boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'staff_leave_category_chk') then
    alter table public.staff_leave add constraint staff_leave_category_chk
      check (category in ('annual_leave','sickness','authorised_absence','unpaid_leave',
                          'compassionate','medical_appointment','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'staff_leave_status_chk') then
    alter table public.staff_leave add constraint staff_leave_status_chk
      check (status in ('recorded','ongoing','ended','cancelled'));
  end if;
end $$;

create index if not exists idx_staff_leave_org_dates on public.staff_leave(org_id, start_date, end_date);
create index if not exists idx_staff_leave_rtw_due on public.staff_leave(org_id)
  where rtw_required and not rtw_completed;

create table if not exists public.staff_return_to_work (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null,
  absence_id uuid references public.staff_leave(id) on delete set null,
  meeting_date date,
  manager_id uuid references auth.users(id) on delete set null,
  fit_to_return boolean,
  adjustments text,
  follow_up text,
  notes text,
  status text not null default 'due' check (status in ('due','completed','not_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade
);
create index if not exists idx_rtw_org_staff on public.staff_return_to_work(org_id, staff_id);
create index if not exists idx_rtw_status on public.staff_return_to_work(org_id, status);

-- ── Onboarding ──────────────────────────────────────────────────────────
create table if not exists public.staff_onboarding_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null,
  item_key text not null,
  label text not null,
  required boolean not null default true,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (staff_id, item_key),
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade
);
create index if not exists idx_onboarding_org_staff on public.staff_onboarding_items(org_id, staff_id);

-- ── Documents ───────────────────────────────────────────────────────────
-- One table, not three. An HR-case document and an investigation exhibit are
-- the same object with a different parent, and splitting them would mean three
-- upload paths, three RLS policies and three places to get retention wrong.
create table if not exists public.staff_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null,
  document_type text not null,
  title text not null,
  storage_path text not null,
  expiry_date date,
  notes text,
  confidentiality text not null default 'hr'
    check (confidentiality in ('standard','hr','sensitive')),
  hr_case_id uuid,
  disciplinary_case_id uuid,
  archived_at timestamptz,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade
);
create index if not exists idx_staff_docs_org_staff on public.staff_documents(org_id, staff_id);
create index if not exists idx_staff_docs_expiry on public.staff_documents(org_id, expiry_date)
  where expiry_date is not null and archived_at is null;

-- ── Compliance: org-level requirements, per-staff records ───────────────
create table if not exists public.staff_compliance_requirements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  requirement_key text not null,
  label text not null,
  description text,
  applies_to text not null default 'all'
    check (applies_to in ('all','employee','sessional','volunteer','role','department')),
  applies_value text,
  renewal_months integer,
  warn_days integer not null default 30,
  evidence_required boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (org_id, requirement_key)
);
create index if not exists idx_compliance_req_org on public.staff_compliance_requirements(org_id) where active;

-- Append-only history: a renewal writes a new row and supersedes the old one,
-- so "what did we hold in March 2026" stays answerable. Nothing here is
-- overwritten in place.
create table if not exists public.staff_compliance_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null,
  requirement_id uuid not null references public.staff_compliance_requirements(id) on delete cascade,
  status text not null default 'missing'
    check (status in ('complete','due_soon','overdue','missing','not_required')),
  issue_date date,
  expiry_date date,
  reference text,
  document_id uuid references public.staff_documents(id) on delete set null,
  notes text,
  superseded_by uuid references public.staff_compliance_records(id) on delete set null,
  is_current boolean not null default true,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade
);
create unique index if not exists idx_compliance_rec_current
  on public.staff_compliance_records(staff_id, requirement_id) where is_current;
create index if not exists idx_compliance_rec_expiry
  on public.staff_compliance_records(org_id, expiry_date) where is_current;

-- ── Training ────────────────────────────────────────────────────────────
-- Separate from volunteer_training, which keys on user_profiles and covers a
-- different population. This one keys on the staff spine.
create table if not exists public.staff_training (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null,
  course text not null,
  provider text,
  mandatory boolean not null default false,
  completed_date date,
  expiry_date date,
  certificate_document_id uuid references public.staff_documents(id) on delete set null,
  status text not null default 'planned'
    check (status in ('planned','booked','completed','expired','cancelled')),
  requirement_id uuid references public.staff_compliance_requirements(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade
);
create index if not exists idx_training_org_staff on public.staff_training(org_id, staff_id);
create index if not exists idx_training_expiry on public.staff_training(org_id, expiry_date)
  where status = 'completed';

-- ── Supervision / 1:1 ───────────────────────────────────────────────────
create table if not exists public.staff_supervisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null,
  manager_id uuid references auth.users(id) on delete set null,
  meeting_date date not null,
  meeting_type text not null default 'supervision'
    check (meeting_type in ('supervision','one_to_one','wellbeing','probation','return_to_work','other')),
  wellbeing text,
  workload text,
  performance text,
  development text,
  safeguarding_discussed boolean not null default false,
  safeguarding_notes text,
  staff_comments text,
  manager_notes text,
  -- Visible only to the manager who wrote them and to HR-sensitive holders.
  private_notes text,
  next_supervision_date date,
  status text not null default 'draft' check (status in ('draft','completed','follow_up')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade
);
create index if not exists idx_supervision_org_staff on public.staff_supervisions(org_id, staff_id, meeting_date desc);
create index if not exists idx_supervision_next on public.staff_supervisions(org_id, next_supervision_date);

create table if not exists public.staff_supervision_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  supervision_id uuid not null references public.staff_supervisions(id) on delete cascade,
  description text not null,
  owner_id uuid references auth.users(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_supervision_actions_due on public.staff_supervision_actions(org_id, due_date)
  where completed_at is null;

-- ── Probation ───────────────────────────────────────────────────────────
create table if not exists public.staff_probation_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null,
  review_date date not null,
  manager_id uuid references auth.users(id) on delete set null,
  objectives text,
  review_notes text,
  -- Never derived. A probation outcome is a decision a person makes.
  outcome text check (outcome is null or outcome in ('passed','extended','further_review','ended')),
  outcome_recorded_by uuid references auth.users(id) on delete set null,
  outcome_recorded_at timestamptz,
  extended_to date,
  status text not null default 'scheduled' check (status in ('scheduled','completed')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade
);
create index if not exists idx_probation_org_due on public.staff_probation_reviews(org_id, review_date)
  where status = 'scheduled';
