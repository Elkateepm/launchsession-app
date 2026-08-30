-- Enforce the module access layer in the database.
--
-- Every existing policy is left untouched. Each module-owned table instead
-- gains RESTRICTIVE policies, which Postgres ANDs with whatever permissive
-- policies are already there. Rewriting the ~100 existing policies to fold in
-- a module check would have meant re-deriving every tenant and role predicate
-- by hand, and a single mistake locks a charity out of its own safeguarding
-- records. A restrictive layer cannot widen anything: the worst failure mode
-- is over-restriction, which is visible and reversible.
--
-- Scoped `to authenticated` so the anonymous public surfaces -- form
-- submission, child registration, volunteer application, donation pages --
-- are unaffected. Those have their own hardening and no signed-in identity to
-- resolve a module against.
--
--   SELECT -> view    INSERT -> edit    UPDATE -> edit    DELETE -> edit
--
-- NOTE ON HISTORY: applied live in two steps. The first version used a single
-- `for all` policy with using(module_can_view) / with check(module_can_edit),
-- which was wrong -- Postgres applies using() to SELECT, UPDATE *and* DELETE,
-- so a member holding only 'view' could still DELETE (no WITH CHECK exists on
-- a delete, and the USING it consulted asked only for view). UPDATE was caught
-- by the WITH CHECK, which disguised it. Read-only access that permits
-- deletion is not read-only. This file is the corrected end state; a fresh
-- environment should apply only this.

do $$
declare
  r record;
  v_base text;
begin
  for r in
    select * from (values
      ('calendar_event_attendees','calendar'),
      ('calendar_events','calendar'),
      ('case_audit_log','case_management'),
      ('case_documents','case_management'),
      ('case_events','case_management'),
      ('case_notes','case_management'),
      ('case_tasks','case_management'),
      ('cases','case_management'),
      ('event_participants','events_trips'),
      ('events','events_trips'),
      ('form_recipients','forms'),
      ('form_submissions','forms'),
      ('org_form_templates','forms'),
      ('org_forms','forms'),
      ('session_forms','forms'),
      ('fundraising_campaigns','fundraising'),
      ('fundraising_documents','fundraising'),
      ('fundraising_donations','fundraising'),
      ('fundraising_payment_links','fundraising'),
      ('fundraising_supporters','fundraising'),
      ('grant_applications','fundraising'),
      ('grant_saves','fundraising'),
      ('grants','fundraising'),
      ('gallery_collections','gallery'),
      ('gallery_photos','gallery'),
      ('hr_staff','hr'),
      ('staff_invites','hr'),
      ('staff_leave','hr'),
      ('goals','impact_outcomes'),
      ('outcome_scores','impact_outcomes'),
      ('progress','impact_outcomes'),
      ('session_outcomes','impact_outcomes'),
      ('wellbeing_checks','impact_outcomes'),
      ('medical_alert_reviews','medical_alerts'),
      ('mentoring_logs','mentoring'),
      ('mentoring_matches','mentoring'),
      ('mentoring_referrals','mentoring'),
      ('mentoring_relationships','mentoring'),
      ('mentoring_reviews','mentoring'),
      ('mentoring_sessions','mentoring'),
      ('mentoring_timeline_events','mentoring'),
      ('announcements','messaging'),
      ('message_reactions','messaging'),
      ('message_thread_messages','messaging'),
      ('message_thread_pins','messaging'),
      ('message_threads','messaging'),
      ('sms_messages','messaging'),
      ('sms_opt_outs','messaging'),
      ('organisation_payment_accounts','payments'),
      ('payment_charges','payments'),
      ('payment_transactions','payments'),
      ('child_attachments','people'),
      ('child_consents','people'),
      ('child_registration_requests','people'),
      ('children','people'),
      ('project_participants','people'),
      ('annotations','planner'),
      ('project_reflections','planner'),
      ('project_staff','planner'),
      ('projects','planner'),
      ('session_notes','planner'),
      ('session_reflections','planner'),
      ('session_staff','planner'),
      ('session_tasks','planner'),
      ('session_templates','planner'),
      ('sessions','planner'),
      ('attendance','registers'),
      ('attendance_audit_log','registers'),
      ('attendance_corrections','registers'),
      ('deleted_register_audit','registers'),
      ('ai_insights_cache','reports'),
      ('reports','reports'),
      ('resource_bookings','resource_booking'),
      ('resource_checkouts','resource_booking'),
      ('resource_maintenance','resource_booking'),
      ('resource_stock_movements','resource_booking'),
      ('resources','resource_booking'),
      ('risk_assessment_audit','risk_assessments'),
      ('risk_assessment_documents','risk_assessments'),
      ('risk_assessment_hazards','risk_assessments'),
      ('risk_assessment_sessions','risk_assessments'),
      ('risk_assessments','risk_assessments'),
      ('risk_controls','risk_assessments'),
      ('risk_dynamic_updates','risk_assessments'),
      ('cause_for_concern','safeguarding'),
      ('safeguarding_audit_log','safeguarding'),
      ('safeguarding_documents','safeguarding'),
      ('session_volunteer_slots','volunteers'),
      ('volunteer_applications','volunteers'),
      ('volunteer_attendance','volunteers'),
      ('volunteer_broadcasts','volunteers'),
      ('volunteer_recognition','volunteers'),
      ('volunteer_training','volunteers'),
      ('volunteers','volunteers')
    ) as t(tbl, module_key)
  loop
    -- Skip anything not present, so this file stays applicable to an
    -- environment a table or two behind.
    if to_regclass('public.' || quote_ident(r.tbl)) is null then
      raise notice 'skipping missing table %', r.tbl;
      continue;
    end if;

    v_base := 'module gate: ' || r.module_key;

    execute format('drop policy if exists %I on public.%I', v_base, r.tbl);
    execute format('drop policy if exists %I on public.%I', v_base || ' (read)', r.tbl);
    execute format('drop policy if exists %I on public.%I', v_base || ' (insert)', r.tbl);
    execute format('drop policy if exists %I on public.%I', v_base || ' (update)', r.tbl);
    execute format('drop policy if exists %I on public.%I', v_base || ' (delete)', r.tbl);

    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated using (public.module_can_view(%L))',
      v_base || ' (read)', r.tbl, r.module_key);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (public.module_can_edit(%L))',
      v_base || ' (insert)', r.tbl, r.module_key);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (public.module_can_edit(%L)) with check (public.module_can_edit(%L))',
      v_base || ' (update)', r.tbl, r.module_key, r.module_key);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (public.module_can_edit(%L))',
      v_base || ' (delete)', r.tbl, r.module_key);
  end loop;
end $$;
