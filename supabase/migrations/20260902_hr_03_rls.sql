-- HR & Staff, part 3 of 3: access helpers, RLS and the documents bucket.
--
-- Three layers, reusing what already exists rather than inventing a parallel
-- permission system:
--   1. org isolation           get_my_org_id()
--   2. role                    is_org_admin() / is_org_manager()
--   3. per-member module grant module_access_grants (module_can_view/edit)
--
-- Nothing here uses `using (true)`.

-- Ordinary HR: employment, compliance, training, supervision, absence.
-- Managers included -- approving and supervising their own people is the job.
create or replace function public.hr_can_view() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_manager() and public.module_can_view('hr')
$$;

create or replace function public.hr_can_edit() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_manager() and public.module_can_edit('hr')
$$;

-- Sensitive HR: disciplinaries, investigations, hearings, outcomes, warnings,
-- appeals, private supervision notes.
--
-- Deliberately NOT module_can_view('hr_sensitive'): that would make it a
-- purchasable module and every org without it would lose access. It is an
-- explicit per-person grant on top of the HR module -- owners and admins hold
-- it inherently, everyone else has to be given it.
create or replace function public.hr_sensitive_can_view() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_admin() or exists (
    select 1 from public.module_access_grants g
    where g.user_id = auth.uid()
      and g.org_id = public.get_my_org_id()
      and g.module_key = 'hr_sensitive'
      and g.level in ('view','edit')
  )
$$;

create or replace function public.hr_sensitive_can_edit() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_admin() or exists (
    select 1 from public.module_access_grants g
    where g.user_id = auth.uid()
      and g.org_id = public.get_my_org_id()
      and g.module_key = 'hr_sensitive'
      and g.level = 'edit'
  )
$$;

-- Line-manager scoping. A manager reaches their own reports; an admin reaches
-- everyone. Without this, "manager" would mean "reads the whole organisation's
-- HR file", which is exactly what the brief rules out.
create or replace function public.hr_staff_in_my_remit(p_staff_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_admin() or exists (
    select 1
    from public.hr_staff s
    left join public.hr_staff m on m.id = s.line_manager_id
    where s.id = p_staff_id
      and s.org_id = public.get_my_org_id()
      and (m.user_id = auth.uid() or s.user_id = auth.uid())
  )
$$;

-- ── Enable RLS everywhere ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'staff_return_to_work','staff_onboarding_items','staff_documents',
    'staff_compliance_requirements','staff_compliance_records','staff_training',
    'staff_supervisions','staff_supervision_actions','staff_probation_reviews',
    'hr_cases','hr_case_entries','hr_case_actions',
    'disciplinary_cases','disciplinary_entries','disciplinary_investigations',
    'disciplinary_evidence','disciplinary_witnesses','disciplinary_interviews',
    'disciplinary_hearings','disciplinary_outcomes','disciplinary_appeals',
    'staff_warnings','staff_offboarding','hr_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ── Ordinary HR tables, scoped to the viewer's remit ────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'staff_return_to_work','staff_onboarding_items','staff_compliance_records',
    'staff_training','staff_probation_reviews'
  ] loop
    execute format($f$
      drop policy if exists "hr read %1$s" on public.%1$I;
      create policy "hr read %1$s" on public.%1$I for select
        using (org_id = public.get_my_org_id() and public.hr_can_view()
               and public.hr_staff_in_my_remit(staff_id));
      drop policy if exists "hr write %1$s" on public.%1$I;
      create policy "hr write %1$s" on public.%1$I for all
        using (org_id = public.get_my_org_id() and public.hr_can_edit()
               and public.hr_staff_in_my_remit(staff_id))
        with check (org_id = public.get_my_org_id() and public.hr_can_edit()
               and public.hr_staff_in_my_remit(staff_id));
    $f$, t);
  end loop;
end $$;

-- Compliance requirements are org-level definitions, not per-staff.
drop policy if exists "hr read compliance requirements" on public.staff_compliance_requirements;
create policy "hr read compliance requirements" on public.staff_compliance_requirements
  for select using (org_id = public.get_my_org_id() and public.hr_can_view());
drop policy if exists "hr write compliance requirements" on public.staff_compliance_requirements;
create policy "hr write compliance requirements" on public.staff_compliance_requirements
  for all using (org_id = public.get_my_org_id() and public.is_org_admin())
  with check (org_id = public.get_my_org_id() and public.is_org_admin());

-- Supervision: everyone in remit reads the record, but private_notes is for
-- the author and HR-sensitive holders. A column cannot be filtered by RLS, so
-- reads go through a view that blanks it (see hr_supervision_visible below).
drop policy if exists "hr read supervisions" on public.staff_supervisions;
create policy "hr read supervisions" on public.staff_supervisions for select
  using (org_id = public.get_my_org_id() and public.hr_can_view()
         and public.hr_staff_in_my_remit(staff_id));
drop policy if exists "hr write supervisions" on public.staff_supervisions;
create policy "hr write supervisions" on public.staff_supervisions for all
  using (org_id = public.get_my_org_id() and public.hr_can_edit()
         and public.hr_staff_in_my_remit(staff_id))
  with check (org_id = public.get_my_org_id() and public.hr_can_edit()
         and public.hr_staff_in_my_remit(staff_id));

create or replace view public.hr_supervision_visible
with (security_invoker = true) as
  select s.id, s.org_id, s.staff_id, s.manager_id, s.meeting_date, s.meeting_type,
         s.wellbeing, s.workload, s.performance, s.development,
         s.safeguarding_discussed, s.safeguarding_notes, s.staff_comments,
         s.manager_notes,
         case when s.created_by = auth.uid() or public.hr_sensitive_can_view()
              then s.private_notes else null end as private_notes,
         s.next_supervision_date, s.status, s.created_at, s.updated_at, s.created_by
  from public.staff_supervisions s;

drop policy if exists "hr rw supervision actions" on public.staff_supervision_actions;
create policy "hr rw supervision actions" on public.staff_supervision_actions for all
  using (org_id = public.get_my_org_id() and public.hr_can_view())
  with check (org_id = public.get_my_org_id() and public.hr_can_edit());

-- ── Documents ───────────────────────────────────────────────────────────
-- confidentiality = 'sensitive' means disciplinary material and needs the
-- sensitive grant on top of ordinary HR access.
drop policy if exists "hr read staff documents" on public.staff_documents;
create policy "hr read staff documents" on public.staff_documents for select
  using (
    org_id = public.get_my_org_id() and public.hr_can_view()
    and public.hr_staff_in_my_remit(staff_id)
    and (confidentiality <> 'sensitive' or public.hr_sensitive_can_view())
  );
drop policy if exists "hr write staff documents" on public.staff_documents;
create policy "hr write staff documents" on public.staff_documents for all
  using (
    org_id = public.get_my_org_id() and public.hr_can_edit()
    and public.hr_staff_in_my_remit(staff_id)
    and (confidentiality <> 'sensitive' or public.hr_sensitive_can_edit())
  )
  with check (
    org_id = public.get_my_org_id() and public.hr_can_edit()
    and public.hr_staff_in_my_remit(staff_id)
    and (confidentiality <> 'sensitive' or public.hr_sensitive_can_edit())
  );

-- ── HR cases ────────────────────────────────────────────────────────────
-- A manager reaches a case if the person is in their remit OR the case is
-- assigned to them, which is how a case gets handed to someone outside the
-- reporting line.
drop policy if exists "hr read cases" on public.hr_cases;
create policy "hr read cases" on public.hr_cases for select
  using (org_id = public.get_my_org_id() and public.hr_can_view()
         and (public.hr_staff_in_my_remit(staff_id) or owner_id = auth.uid()));
drop policy if exists "hr write cases" on public.hr_cases;
create policy "hr write cases" on public.hr_cases for all
  using (org_id = public.get_my_org_id() and public.hr_can_edit()
         and (public.hr_staff_in_my_remit(staff_id) or owner_id = auth.uid()))
  with check (org_id = public.get_my_org_id() and public.hr_can_edit());

do $$
declare t text;
begin
  foreach t in array array['hr_case_entries','hr_case_actions'] loop
    execute format($f$
      drop policy if exists "hr read %1$s" on public.%1$I;
      create policy "hr read %1$s" on public.%1$I for select
        using (exists (select 1 from public.hr_cases c
                       where c.id = %1$I.hr_case_id and c.org_id = %1$I.org_id));
      drop policy if exists "hr write %1$s" on public.%1$I;
      create policy "hr write %1$s" on public.%1$I for all
        using (public.hr_can_edit() and exists (
                 select 1 from public.hr_cases c
                 where c.id = %1$I.hr_case_id and c.org_id = %1$I.org_id))
        with check (public.hr_can_edit() and exists (
                 select 1 from public.hr_cases c
                 where c.id = %1$I.hr_case_id and c.org_id = %1$I.org_id));
    $f$, t);
  end loop;
end $$;

-- ── Disciplinary: sensitive throughout ──────────────────────────────────
drop policy if exists "disc read cases" on public.disciplinary_cases;
create policy "disc read cases" on public.disciplinary_cases for select
  using (org_id = public.get_my_org_id() and public.hr_sensitive_can_view());
drop policy if exists "disc write cases" on public.disciplinary_cases;
create policy "disc write cases" on public.disciplinary_cases for all
  using (org_id = public.get_my_org_id() and public.hr_sensitive_can_edit() and not locked)
  with check (org_id = public.get_my_org_id() and public.hr_sensitive_can_edit());

-- Children of a disciplinary case inherit its visibility. `locked` is checked
-- on the parent so a closed case cannot be edited through a child row either.
do $$
declare t text;
begin
  foreach t in array array[
    'disciplinary_entries','disciplinary_investigations','disciplinary_hearings',
    'disciplinary_outcomes','disciplinary_appeals'
  ] loop
    execute format($f$
      drop policy if exists "disc read %1$s" on public.%1$I;
      create policy "disc read %1$s" on public.%1$I for select
        using (org_id = public.get_my_org_id() and public.hr_sensitive_can_view());
      drop policy if exists "disc write %1$s" on public.%1$I;
      create policy "disc write %1$s" on public.%1$I for all
        using (org_id = public.get_my_org_id() and public.hr_sensitive_can_edit()
               and exists (select 1 from public.disciplinary_cases d
                           where d.id = %1$I.disciplinary_case_id
                             and d.org_id = %1$I.org_id and not d.locked))
        with check (org_id = public.get_my_org_id() and public.hr_sensitive_can_edit());
    $f$, t);
  end loop;

  foreach t in array array[
    'disciplinary_evidence','disciplinary_witnesses','disciplinary_interviews'
  ] loop
    execute format($f$
      drop policy if exists "disc read %1$s" on public.%1$I;
      create policy "disc read %1$s" on public.%1$I for select
        using (org_id = public.get_my_org_id() and public.hr_sensitive_can_view());
      drop policy if exists "disc write %1$s" on public.%1$I;
      create policy "disc write %1$s" on public.%1$I for all
        using (org_id = public.get_my_org_id() and public.hr_sensitive_can_edit()
               and exists (select 1 from public.disciplinary_investigations i
                           join public.disciplinary_cases d
                             on d.id = i.disciplinary_case_id and d.org_id = i.org_id
                           where i.id = %1$I.investigation_id
                             and i.org_id = %1$I.org_id and not d.locked))
        with check (org_id = public.get_my_org_id() and public.hr_sensitive_can_edit());
    $f$, t);
  end loop;
end $$;

-- Warnings: readable to sensitive holders, and to the person themselves.
drop policy if exists "read staff warnings" on public.staff_warnings;
create policy "read staff warnings" on public.staff_warnings for select
  using (org_id = public.get_my_org_id() and (
    public.hr_sensitive_can_view()
    or exists (select 1 from public.hr_staff s
               where s.id = staff_warnings.staff_id and s.user_id = auth.uid())
  ));
-- No delete policy anywhere: a warning is withdrawn or overturned by status,
-- never removed.
drop policy if exists "insert staff warnings" on public.staff_warnings;
create policy "insert staff warnings" on public.staff_warnings for insert
  with check (org_id = public.get_my_org_id() and public.hr_sensitive_can_edit());
drop policy if exists "update staff warnings" on public.staff_warnings;
create policy "update staff warnings" on public.staff_warnings for update
  using (org_id = public.get_my_org_id() and public.hr_sensitive_can_edit())
  with check (org_id = public.get_my_org_id() and public.hr_sensitive_can_edit());

drop policy if exists "hr rw offboarding" on public.staff_offboarding;
create policy "hr rw offboarding" on public.staff_offboarding for all
  using (org_id = public.get_my_org_id() and public.hr_can_view()
         and public.hr_staff_in_my_remit(staff_id))
  with check (org_id = public.get_my_org_id() and public.hr_can_edit());

-- ── Audit: readable by admins, append-only, never updated or deleted ────
drop policy if exists "read hr audit" on public.hr_audit_log;
create policy "read hr audit" on public.hr_audit_log for select
  using (org_id = public.get_my_org_id() and public.is_org_admin());
drop policy if exists "append hr audit" on public.hr_audit_log;
create policy "append hr audit" on public.hr_audit_log for insert
  with check (org_id = public.get_my_org_id() and actor_user_id = auth.uid());

-- ── Storage: a private bucket for HR documents ──────────────────────────
-- Follows the staff-photos / safeguarding-docs convention: private, org id as
-- the first path segment, checked against the caller's org.
insert into storage.buckets (id, name, public)
values ('hr-documents', 'hr-documents', false)
on conflict (id) do nothing;

drop policy if exists "hr docs read" on storage.objects;
create policy "hr docs read" on storage.objects for select to authenticated
  using (bucket_id = 'hr-documents'
         and public.hr_can_view()
         and (storage.foldername(name))[1] = public.get_my_org_id()::text);

drop policy if exists "hr docs write" on storage.objects;
create policy "hr docs write" on storage.objects for insert to authenticated
  with check (bucket_id = 'hr-documents'
              and public.hr_can_edit()
              and (storage.foldername(name))[1] = public.get_my_org_id()::text);

drop policy if exists "hr docs update" on storage.objects;
create policy "hr docs update" on storage.objects for update to authenticated
  using (bucket_id = 'hr-documents'
         and public.hr_can_edit()
         and (storage.foldername(name))[1] = public.get_my_org_id()::text);
