-- HR & Staff, part 2 of 3: HR cases, the disciplinary chain, warnings,
-- offboarding and the audit log.
--
-- HR cases and disciplinaries are deliberately two tables, not one with a
-- flag. Most HR cases never become disciplinary, the two have different
-- audiences, and an escalation must leave the original case intact as part of
-- the audit trail rather than mutating into something else.
--
-- These are NOT public.cases. That table is child safeguarding
-- (child_name, child_id, requires_dsl) and must stay separate: different
-- subject, different RLS, different lawful basis.

-- Per-org sequential reference: HR-2026-0014. Advisory lock rather than a
-- sequence so each organisation numbers from 1 and two concurrent creates
-- cannot collide.
create or replace function public.hr_next_reference(p_org_id uuid, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  yr text := to_char((now() at time zone 'Europe/London'), 'YYYY');
  n  integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_org_id::text || p_prefix || yr));
  if p_prefix = 'HR' then
    select count(*) + 1 into n from public.hr_cases
     where org_id = p_org_id and reference like 'HR-' || yr || '-%';
  else
    select count(*) + 1 into n from public.disciplinary_cases
     where org_id = p_org_id and reference like 'DISC-' || yr || '-%';
  end if;
  return p_prefix || '-' || yr || '-' || lpad(n::text, 4, '0');
end $$;

-- ── HR cases ────────────────────────────────────────────────────────────
create table if not exists public.hr_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  reference text,
  staff_id uuid not null,
  case_type text not null check (case_type in (
    'attendance','performance','capability','grievance','welfare','complaint',
    'conduct_concern','management_concern','relationship','other')),
  title text not null,
  description text,
  issue_date date,
  reported_date date,
  reported_by text,
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  status text not null default 'open'
    check (status in ('open','triage','review','action_required','monitoring','resolved','closed')),
  immediate_action text,
  owner_id uuid references auth.users(id) on delete set null,
  next_action text,
  next_review_date date,
  -- Pointer only. Confidential child detail never crosses into HR; an
  -- unauthorised viewer sees that a restricted record exists, nothing more.
  linked_safeguarding_case_id uuid references public.cases(id) on delete set null,
  resolved_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closure_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (org_id, reference),
  unique (id, org_id),
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade
);
create index if not exists idx_hr_cases_org_status on public.hr_cases(org_id, status);
create index if not exists idx_hr_cases_org_staff on public.hr_cases(org_id, staff_id);
create index if not exists idx_hr_cases_owner on public.hr_cases(org_id, owner_id) where status not in ('resolved','closed');
create index if not exists idx_hr_cases_review on public.hr_cases(org_id, next_review_date) where status not in ('resolved','closed');

-- Timeline. Mirrors public.case_events, which is the established shape for
-- this in the safeguarding hub.
create table if not exists public.hr_case_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  hr_case_id uuid not null,
  entry_type text not null check (entry_type in (
    'created','note','meeting','correspondence','document','status_change',
    'owner_change','priority_change','action_created','action_completed',
    'escalated','resolved','closed','linked')),
  body text,
  meta jsonb,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (hr_case_id, org_id) references public.hr_cases(id, org_id) on delete cascade
);
create index if not exists idx_hr_case_entries_case on public.hr_case_entries(hr_case_id, created_at desc);

create table if not exists public.hr_case_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  hr_case_id uuid not null,
  description text not null,
  owner_id uuid references auth.users(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (hr_case_id, org_id) references public.hr_cases(id, org_id) on delete cascade
);
create index if not exists idx_hr_case_actions_due on public.hr_case_actions(org_id, due_date) where completed_at is null;

-- ── Disciplinary ────────────────────────────────────────────────────────
-- Wording throughout is neutral: "alleged", "concern raised". Nothing in this
-- schema records or infers guilt before an outcome is entered by a person.
create table if not exists public.disciplinary_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  reference text,
  staff_id uuid not null,
  source_hr_case_id uuid,
  escalation_reason text,
  escalated_by uuid references auth.users(id) on delete set null,
  escalated_at timestamptz,
  category text not null check (category in (
    'conduct','gross_misconduct_allegation','repeated_policy_breach',
    'attendance_conduct','performance_conduct','safeguarding_linked','other')),
  allegation text not null,
  incident_date date,
  reported_date date,
  reported_by text,
  case_manager_id uuid references auth.users(id) on delete set null,
  risk_level text check (risk_level is null or risk_level in ('low','medium','high')),
  immediate_action text,
  stage text not null default 'concern'
    check (stage in ('concern','triage','investigation','hearing','outcome','appeal','closed')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  next_action text,
  next_action_date date,
  linked_safeguarding_case_id uuid references public.cases(id) on delete set null,
  triage_decision text check (triage_decision is null or triage_decision in (
    'no_formal_action','informal_action','further_hr_management','investigation_required',
    'safeguarding_process','other')),
  triage_reasoning text,
  triage_decided_by uuid references auth.users(id) on delete set null,
  triage_decided_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closure_summary text,
  final_outcome text,
  remaining_follow_up text,
  -- Set on closure. Ordinary UI must not edit a closed record; corrections go
  -- through an audited admin path.
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (org_id, reference),
  unique (id, org_id),
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade,
  foreign key (source_hr_case_id, org_id) references public.hr_cases(id, org_id) on delete set null
);
create index if not exists idx_disc_org_stage on public.disciplinary_cases(org_id, stage);
create index if not exists idx_disc_org_staff on public.disciplinary_cases(org_id, staff_id);
create index if not exists idx_disc_next_action on public.disciplinary_cases(org_id, next_action_date) where stage <> 'closed';

create table if not exists public.disciplinary_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  disciplinary_case_id uuid not null,
  entry_type text not null,
  body text,
  meta jsonb,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (disciplinary_case_id, org_id) references public.disciplinary_cases(id, org_id) on delete cascade
);
create index if not exists idx_disc_entries_case on public.disciplinary_entries(disciplinary_case_id, created_at desc);

create table if not exists public.disciplinary_investigations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  disciplinary_case_id uuid not null,
  investigator_id uuid references auth.users(id) on delete set null,
  investigator_name text,
  started_on date,
  target_completion date,
  completed_on date,
  status text not null default 'open' check (status in ('open','completed','paused')),
  summary text,
  -- Recorded, never computed.
  recommendation text check (recommendation is null or recommendation in (
    'no_case_to_answer','informal_action','proceed_to_hearing','further_investigation')),
  recommended_by uuid references auth.users(id) on delete set null,
  recommended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (disciplinary_case_id, org_id) references public.disciplinary_cases(id, org_id) on delete cascade
);
create index if not exists idx_disc_inv_case on public.disciplinary_investigations(disciplinary_case_id);
create index if not exists idx_disc_inv_target on public.disciplinary_investigations(org_id, target_completion) where status = 'open';

create table if not exists public.disciplinary_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  investigation_id uuid not null,
  title text not null,
  evidence_type text,
  description text,
  source text,
  document_id uuid references public.staff_documents(id) on delete set null,
  notes text,
  -- Evidence is not silently editable; a change writes a superseding row and
  -- an audit entry rather than overwriting the original.
  superseded_by uuid references public.disciplinary_evidence(id) on delete set null,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  foreign key (investigation_id, org_id) references public.disciplinary_investigations(id, org_id) on delete cascade
);
create index if not exists idx_disc_evidence_inv on public.disciplinary_evidence(investigation_id);

create table if not exists public.disciplinary_witnesses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  investigation_id uuid not null,
  name text not null,
  relationship text,
  contact text,
  interview_date date,
  statement text,
  document_id uuid references public.staff_documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (investigation_id, org_id) references public.disciplinary_investigations(id, org_id) on delete cascade
);
create index if not exists idx_disc_witness_inv on public.disciplinary_witnesses(investigation_id);

create table if not exists public.disciplinary_interviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  investigation_id uuid not null,
  interviewee text not null,
  interview_type text,
  held_on date,
  held_at_time text,
  attendees text,
  notes text,
  document_id uuid references public.staff_documents(id) on delete set null,
  follow_up_required boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (investigation_id, org_id) references public.disciplinary_investigations(id, org_id) on delete cascade
);
create index if not exists idx_disc_interview_inv on public.disciplinary_interviews(investigation_id);

create table if not exists public.disciplinary_hearings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  disciplinary_case_id uuid not null,
  hearing_date date,
  hearing_time text,
  location text,
  chair_id uuid references auth.users(id) on delete set null,
  chair_name text,
  hr_representative text,
  companion text,
  other_attendees text,
  notes text,
  status text not null default 'not_scheduled'
    check (status in ('not_scheduled','scheduled','adjourned','completed','awaiting_outcome')),
  is_appeal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (disciplinary_case_id, org_id) references public.disciplinary_cases(id, org_id) on delete cascade
);
create index if not exists idx_disc_hearing_case on public.disciplinary_hearings(disciplinary_case_id);
create index if not exists idx_disc_hearing_upcoming on public.disciplinary_hearings(org_id, hearing_date) where status = 'scheduled';

create table if not exists public.disciplinary_outcomes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  disciplinary_case_id uuid not null,
  outcome text not null check (outcome in (
    'no_formal_action','informal_action','first_written_warning',
    'final_written_warning','dismissal','other_sanction')),
  decision_maker_id uuid references auth.users(id) on delete set null,
  decision_maker_name text,
  decision_date date not null,
  reasoning text,
  effective_date date,
  follow_up_requirements text,
  review_date date,
  outcome_letter_document_id uuid references public.staff_documents(id) on delete set null,
  warning_months integer,
  appeal_deadline date,
  -- An appeal never edits the original decision; it supersedes it, and both
  -- stay readable.
  superseded_by uuid references public.disciplinary_outcomes(id) on delete set null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (id, org_id),
  foreign key (disciplinary_case_id, org_id) references public.disciplinary_cases(id, org_id) on delete cascade
);
create index if not exists idx_disc_outcome_case on public.disciplinary_outcomes(disciplinary_case_id);
create index if not exists idx_disc_outcome_appeal_deadline on public.disciplinary_outcomes(org_id, appeal_deadline) where is_current;

create table if not exists public.disciplinary_appeals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  disciplinary_case_id uuid not null,
  outcome_id uuid references public.disciplinary_outcomes(id) on delete set null,
  lodged_date date,
  grounds text,
  appeal_manager_id uuid references auth.users(id) on delete set null,
  appeal_manager_name text,
  hearing_date date,
  notes text,
  decision text check (decision is null or decision in (
    'upheld','reduced','overturned','rehearing_required','other')),
  decision_reasoning text,
  decision_date date,
  decided_by uuid references auth.users(id) on delete set null,
  status text not null default 'lodged' check (status in ('lodged','scheduled','heard','decided','withdrawn')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (disciplinary_case_id, org_id) references public.disciplinary_cases(id, org_id) on delete cascade
);
create index if not exists idx_disc_appeal_case on public.disciplinary_appeals(disciplinary_case_id);

-- ── Warnings ────────────────────────────────────────────────────────────
-- Never deleted. An expired warning stays on the record as history; an appeal
-- that overturns one changes its status, it does not remove it.
create table if not exists public.staff_warnings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null,
  disciplinary_case_id uuid,
  outcome_id uuid references public.disciplinary_outcomes(id) on delete set null,
  warning_type text not null check (warning_type in (
    'informal','first_written','final_written','other')),
  issued_date date not null,
  expiry_date date,
  status text not null default 'active'
    check (status in ('active','expired','withdrawn','overturned')),
  decision_maker_id uuid references auth.users(id) on delete set null,
  decision_maker_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade,
  foreign key (disciplinary_case_id, org_id) references public.disciplinary_cases(id, org_id) on delete set null
);
create index if not exists idx_warnings_org_staff on public.staff_warnings(org_id, staff_id);
create index if not exists idx_warnings_expiry on public.staff_warnings(org_id, expiry_date) where status = 'active';

-- ── Offboarding ─────────────────────────────────────────────────────────
create table if not exists public.staff_offboarding (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null,
  reason text not null check (reason in (
    'resignation','end_of_fixed_term','retirement','dismissal','redundancy',
    'volunteer_leaving','other')),
  notice_given_date date,
  leaving_date date,
  final_working_date date,
  manager_id uuid references auth.users(id) on delete set null,
  exit_interview_completed boolean not null default false,
  exit_notes text,
  rehire_eligible boolean,
  checklist jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (staff_id),
  foreign key (staff_id, org_id) references public.hr_staff(id, org_id) on delete cascade
);
create index if not exists idx_offboarding_org on public.staff_offboarding(org_id, status);

-- ── Audit ───────────────────────────────────────────────────────────────
-- Summaries are deliberately short and non-substantive. The point of this log
-- is who touched what and when; putting an allegation or a medical note into a
-- generic summary would leak it to everyone who can read the audit trail.
create table if not exists public.hr_audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  staff_id uuid,
  action text not null,
  summary text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_hr_audit_org_created on public.hr_audit_log(org_id, created_at desc);
create index if not exists idx_hr_audit_entity on public.hr_audit_log(org_id, entity_type, entity_id);
create index if not exists idx_hr_audit_staff on public.hr_audit_log(org_id, staff_id, created_at desc);
