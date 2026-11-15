-- Deleting a login keeps the records it touched.
--
-- Deleting a user (Command Centre -> delete_auth_user, or the GoTrue admin
-- API) failed whenever that person had ever led a session, owned a case,
-- approved a risk assessment, logged a safeguarding action, reported an
-- injury or had an HR staff record. Found 15 Nov 2026 while removing test
-- logins: the delete died on hr_staff and then on 32 NO ACTION foreign keys.
--
-- After this migration a delete keeps every business record and audit row and
-- clears only the link to the person: the column becomes NULL, the same thing
-- delete_user() already did by hand for some of these tables.
--
-- 1. 32 attribution foreign keys move from NO ACTION to ON DELETE SET NULL.
--    Every one of these columns is nullable.
-- 2. hr_staff_user_org_fk is (user_id, org_id). Plain ON DELETE SET NULL
--    nulled org_id too, which is NOT NULL, so any login with an HR record
--    could not be deleted. It now clears user_id only (Postgres 15+ syntax).
-- 3. Four triggers would undo or refuse the NULL that step 1 writes. They now
--    let it through only when the referenced login no longer exists:
--      touch_child_injury           restored reported_by on every UPDATE,
--                                   which would leave a dangling reference.
--      assert_session_planner       refused the update when the deleting
--                                   admin has no admin/owner/staff profile.
--      trg_risk_guard_approval      refused clearing an approver unless the
--                                   deleting admin is an org manager.
--      notify_session_created_or_edited
--                                   pushed "session edited" to staff when a
--                                   deleted lead was cleared.
--    Every other change goes through those checks exactly as before.

-- ---------------------------------------------------------------------------
-- Helper: was this reference cleared because the login was deleted?
-- Reads auth.users, so it is SECURITY DEFINER and not callable by app users;
-- only the SECURITY DEFINER trigger functions below call it.
-- ---------------------------------------------------------------------------
create or replace function public.user_account_removed(p_old uuid, p_new uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_old is not null
     and p_new is null
     and not exists (select 1 from auth.users u where u.id = p_old);
$$;

revoke all on function public.user_account_removed(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Attribution foreign keys -> ON DELETE SET NULL
-- ---------------------------------------------------------------------------

-- References to auth.users
alter table public.attendance_audit_log   drop constraint attendance_audit_log_changed_by_fkey,
  add constraint attendance_audit_log_changed_by_fkey foreign key (changed_by) references auth.users(id) on delete set null;
alter table public.cause_for_concern      drop constraint cause_for_concern_assigned_to_fkey,
  add constraint cause_for_concern_assigned_to_fkey foreign key (assigned_to) references auth.users(id) on delete set null;
alter table public.child_injuries         drop constraint child_injuries_parent_notified_by_fkey,
  add constraint child_injuries_parent_notified_by_fkey foreign key (parent_notified_by) references auth.users(id) on delete set null;
alter table public.child_injuries         drop constraint child_injuries_reported_by_fkey,
  add constraint child_injuries_reported_by_fkey foreign key (reported_by) references auth.users(id) on delete set null;
alter table public.safeguarding_audit_log drop constraint safeguarding_audit_log_performed_by_fkey,
  add constraint safeguarding_audit_log_performed_by_fkey foreign key (performed_by) references auth.users(id) on delete set null;
alter table public.safeguarding_documents drop constraint safeguarding_documents_uploaded_by_fkey,
  add constraint safeguarding_documents_uploaded_by_fkey foreign key (uploaded_by) references auth.users(id) on delete set null;
alter table public.sessions               drop constraint sessions_reopened_by_fkey,
  add constraint sessions_reopened_by_fkey foreign key (reopened_by) references auth.users(id) on delete set null;
alter table public.wellbeing_checks       drop constraint wellbeing_checks_logged_by_fkey,
  add constraint wellbeing_checks_logged_by_fkey foreign key (logged_by) references auth.users(id) on delete set null;

-- References to user_profiles
alter table public.case_audit_log         drop constraint case_audit_log_actor_id_fkey,
  add constraint case_audit_log_actor_id_fkey foreign key (actor_id) references public.user_profiles(id) on delete set null;
alter table public.case_documents         drop constraint case_documents_uploaded_by_fkey,
  add constraint case_documents_uploaded_by_fkey foreign key (uploaded_by) references public.user_profiles(id) on delete set null;
alter table public.case_events            drop constraint case_events_created_by_fkey,
  add constraint case_events_created_by_fkey foreign key (created_by) references public.user_profiles(id) on delete set null;
alter table public.case_tasks             drop constraint case_tasks_created_by_fkey,
  add constraint case_tasks_created_by_fkey foreign key (created_by) references public.user_profiles(id) on delete set null;
alter table public.case_tasks             drop constraint case_tasks_owner_id_fkey,
  add constraint case_tasks_owner_id_fkey foreign key (owner_id) references public.user_profiles(id) on delete set null;
alter table public.cases                  drop constraint cases_assigned_to_user_id_fkey,
  add constraint cases_assigned_to_user_id_fkey foreign key (assigned_to_user_id) references public.user_profiles(id) on delete set null;
alter table public.cases                  drop constraint cases_risk_ack_by_fkey,
  add constraint cases_risk_ack_by_fkey foreign key (risk_ack_by) references public.user_profiles(id) on delete set null;
alter table public.org_documents          drop constraint org_documents_uploaded_by_fkey,
  add constraint org_documents_uploaded_by_fkey foreign key (uploaded_by) references public.user_profiles(id) on delete set null;
alter table public.payment_charges        drop constraint payment_charges_created_by_fkey,
  add constraint payment_charges_created_by_fkey foreign key (created_by) references public.user_profiles(id) on delete set null;
alter table public.payment_charges        drop constraint payment_charges_waived_by_fkey,
  add constraint payment_charges_waived_by_fkey foreign key (waived_by) references public.user_profiles(id) on delete set null;
alter table public.payment_transactions   drop constraint payment_transactions_reconciled_by_fkey,
  add constraint payment_transactions_reconciled_by_fkey foreign key (reconciled_by) references public.user_profiles(id) on delete set null;
alter table public.payment_transactions   drop constraint payment_transactions_recorded_by_fkey,
  add constraint payment_transactions_recorded_by_fkey foreign key (recorded_by) references public.user_profiles(id) on delete set null;
alter table public.project_reflections    drop constraint project_reflections_created_by_fkey,
  add constraint project_reflections_created_by_fkey foreign key (created_by) references public.user_profiles(id) on delete set null;
alter table public.projects               drop constraint projects_created_by_fkey,
  add constraint projects_created_by_fkey foreign key (created_by) references public.user_profiles(id) on delete set null;
alter table public.reports                drop constraint reports_created_by_fkey,
  add constraint reports_created_by_fkey foreign key (created_by) references public.user_profiles(id) on delete set null;
alter table public.risk_assessment_audit  drop constraint risk_assessment_audit_actor_id_fkey,
  add constraint risk_assessment_audit_actor_id_fkey foreign key (actor_id) references public.user_profiles(id) on delete set null;
alter table public.risk_assessment_documents drop constraint risk_assessment_documents_uploaded_by_fkey,
  add constraint risk_assessment_documents_uploaded_by_fkey foreign key (uploaded_by) references public.user_profiles(id) on delete set null;
alter table public.risk_assessments       drop constraint risk_assessments_assigned_reviewer_id_fkey,
  add constraint risk_assessments_assigned_reviewer_id_fkey foreign key (assigned_reviewer_id) references public.user_profiles(id) on delete set null;
alter table public.risk_assessments       drop constraint risk_assessments_created_by_fkey,
  add constraint risk_assessments_created_by_fkey foreign key (created_by) references public.user_profiles(id) on delete set null;
alter table public.risk_assessments       drop constraint risk_assessments_dsl_approved_by_fkey,
  add constraint risk_assessments_dsl_approved_by_fkey foreign key (dsl_approved_by) references public.user_profiles(id) on delete set null;
alter table public.risk_assessments       drop constraint risk_assessments_manager_approved_by_fkey,
  add constraint risk_assessments_manager_approved_by_fkey foreign key (manager_approved_by) references public.user_profiles(id) on delete set null;
alter table public.session_reflections    drop constraint session_reflections_created_by_fkey,
  add constraint session_reflections_created_by_fkey foreign key (created_by) references public.user_profiles(id) on delete set null;
alter table public.sessions               drop constraint sessions_cancelled_by_fkey,
  add constraint sessions_cancelled_by_fkey foreign key (cancelled_by) references public.user_profiles(id) on delete set null;
alter table public.sessions               drop constraint sessions_lead_staff_id_fkey,
  add constraint sessions_lead_staff_id_fkey foreign key (lead_staff_id) references public.user_profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. hr_staff keeps its org when the login goes
-- ---------------------------------------------------------------------------
alter table public.hr_staff drop constraint hr_staff_user_org_fk,
  add constraint hr_staff_user_org_fk foreign key (user_id, org_id)
    references public.user_profiles(id, org_id) on delete set null (user_id);

-- ---------------------------------------------------------------------------
-- 3. Triggers let the cleared reference through
-- ---------------------------------------------------------------------------

-- Was SECURITY INVOKER; DEFINER so it can call user_account_removed().
create or replace function public.touch_child_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  new.updated_at := now();
  -- reported_by is half the visibility rule and org_id is the whole of the
  -- tenancy boundary. Neither is the editor's to move. The one exception is
  -- ON DELETE SET NULL clearing reported_by after the reporter's login was
  -- deleted; restoring it would leave a reference to a user that is gone.
  if tg_op = 'UPDATE' then
    if not public.user_account_removed(old.reported_by, new.reported_by) then
      new.reported_by := old.reported_by;
    end if;
    new.org_id := old.org_id;
  end if;
  return new;
end
$function$;

create or replace function public.assert_session_planner()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare v_role text;
begin
  if auth.uid() is null then return NEW; end if;

  -- A deleted login's references being cleared (ON DELETE SET NULL) is not
  -- someone changing the session: let it through when that is the only change.
  if TG_OP = 'UPDATE'
     and (to_jsonb(NEW) - array['lead_staff_id','cancelled_by','closed_by','opened_by','reopened_by'])
       = (to_jsonb(OLD) - array['lead_staff_id','cancelled_by','closed_by','opened_by','reopened_by'])
     and (NEW.lead_staff_id is not distinct from OLD.lead_staff_id or public.user_account_removed(OLD.lead_staff_id, NEW.lead_staff_id))
     and (NEW.cancelled_by  is not distinct from OLD.cancelled_by  or public.user_account_removed(OLD.cancelled_by,  NEW.cancelled_by))
     and (NEW.closed_by     is not distinct from OLD.closed_by     or public.user_account_removed(OLD.closed_by,     NEW.closed_by))
     and (NEW.opened_by     is not distinct from OLD.opened_by     or public.user_account_removed(OLD.opened_by,     NEW.opened_by))
     and (NEW.reopened_by   is not distinct from OLD.reopened_by   or public.user_account_removed(OLD.reopened_by,   NEW.reopened_by))
  then
    return NEW;
  end if;

  select p.role into v_role from user_profiles p where p.id = auth.uid();

  -- Positive allowlist. A NULL role must fail: 'not in' against NULL yields
  -- NULL, which would not raise, so the null case is stated explicitly.
  if v_role is null or v_role not in ('admin', 'owner', 'staff') then
    raise exception 'You do not have permission to create or change sessions.'
      using errcode = 'insufficient_privilege';
  end if;

  return NEW;
end
$function$;

create or replace function public.trg_risk_guard_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- An approver cleared because their login was deleted is not a new approval.
  if (   (new.manager_approved_by is distinct from old.manager_approved_by
          and not public.user_account_removed(old.manager_approved_by, new.manager_approved_by))
      or new.manager_approved_at is distinct from old.manager_approved_at
      or (new.dsl_approved_by is distinct from old.dsl_approved_by
          and not public.user_account_removed(old.dsl_approved_by, new.dsl_approved_by))
      or new.dsl_approved_at   is distinct from old.dsl_approved_at)
     and not public.is_org_manager() then
    raise exception 'Only a manager or administrator can approve a risk assessment'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$function$;

create or replace function public.notify_session_created_or_edited()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $function$
declare
  v_secret text;
  v_event_type text;
  v_actor uuid;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'db_event_secret' limit 1;
  if v_secret is null then
    return coalesce(new, old);
  end if;

  v_actor := auth.uid();

  if tg_op = 'INSERT' then
    v_event_type := 'SESSION_CREATED';
  elsif tg_op = 'UPDATE' then
    -- SESSION_CANCELLED already covers cancellation separately -- don't
    -- double-notify when this update is the cancelling one.
    if new.cancelled_at is not null and old.cancelled_at is null then
      return new;
    end if;
    -- Only "planning detail" columns count as an edit worth notifying
    -- about -- operational/audit columns (closed_at, register_status,
    -- the reminder-flag columns the app itself writes, etc.) are excluded
    -- so this doesn't fire on every register open/close or cron sweep tick.
    -- A lead cleared because their login was deleted is not an edit either.
    if not (
      new.title is distinct from old.title or
      new.session_date is distinct from old.session_date or
      new.start_time is distinct from old.start_time or
      new.end_time is distinct from old.end_time or
      new.end_date is distinct from old.end_date or
      new.location is distinct from old.location or
      new.session_type is distinct from old.session_type or
      new.description is distinct from old.description or
      new.max_capacity is distinct from old.max_capacity or
      new.meeting_point is distinct from old.meeting_point or
      new.min_staff is distinct from old.min_staff or
      new.staff_ratio is distinct from old.staff_ratio or
      new.age_range is distinct from old.age_range or
      new.colour is distinct from old.colour or
      new.transport_required is distinct from old.transport_required or
      new.equipment_required is distinct from old.equipment_required or
      new.packed_lunch is distinct from old.packed_lunch or
      new.consent_required is distinct from old.consent_required or
      new.allow_walk_ins is distinct from old.allow_walk_ins or
      new.volunteer_limit is distinct from old.volunteer_limit or
      (new.lead_staff_id is distinct from old.lead_staff_id
        and not public.user_account_removed(old.lead_staff_id, new.lead_staff_id)) or
      new.bubbles is distinct from old.bubbles or
      new.rotation_slots is distinct from old.rotation_slots or
      new.cost_per_person is distinct from old.cost_per_person or
      new.transport_provider is distinct from old.transport_provider or
      new.accommodation is distinct from old.accommodation or
      new.venue_id is distinct from old.venue_id or
      new.internal_notes is distinct from old.internal_notes or
      new.medical_check_required is distinct from old.medical_check_required or
      new.collection_permissions_required is distinct from old.collection_permissions_required or
      new.sign_out_required is distinct from old.sign_out_required or
      new.safeguarding_lead_required is distinct from old.safeguarding_lead_required or
      new.medication_support_required is distinct from old.medication_support_required or
      new.venue_confirmation_required is distinct from old.venue_confirmation_required or
      new.emergency_contact_sheet_required is distinct from old.emergency_contact_sheet_required or
      new.reflection_required is distinct from old.reflection_required or
      new.risk_assessment_required is distinct from old.risk_assessment_required
    ) then
      return new;
    end if;
    v_event_type := 'SESSION_EDITED';
  else
    return coalesce(new, old);
  end if;

  perform net.http_post(
    url := 'https://app.launchsession.co.uk/api/send-form-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-db-event-secret', v_secret),
    body := jsonb_build_object('type', 'db_event_push', 'event_type', v_event_type, 'session_id', new.id, 'actor_user_id', v_actor)
  );

  return new;
end;
$function$;
