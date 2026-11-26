-- Volunteer Centre, phase 1: ready to roster.
--
-- Volunteers' checks were recorded (volunteer_training, user_profiles.dbs_*)
-- but nothing acted on them. assert_session_staff_valid() only graded staff,
-- through hr_staff, so a volunteer with no DBS and no safeguarding training
-- could be put on a session with children -- by staff, or by booking
-- themselves in the volunteer app. And the Directory's "assign" wrote only
-- session_staff.volunteer_id, which the trigger never looked at at all, so it
-- skipped even the cross-organisation check.
--
-- This adds:
--   volunteer_requirements  what an organisation asks of its volunteers
--                           (sensible defaults until an admin changes them)
--   volunteer_checks        where each volunteer is with each requirement
--   volunteer_readiness()   ready / expiring / not_ready, the one rule
--   the trigger extended    a not-ready volunteer cannot be newly assigned to
--                           a published session, however the write arrives
--   daily reminders         30 and 7 days before a check expires, and on the
--                           day, to the volunteer and the coordinators
--
-- Overriding is deliberate and recorded rather than a bypass: an admin can
-- mark a requirement "not needed" for one volunteer, with a reason. Drafts stay
-- editable, exactly as for staff. auth.uid() null (service role, migrations)
-- bypasses, as RLS does. Only new assignments are checked, so a booking made
-- while someone was ready survives a later lapse; the reminders cover that.
--
-- No DBS certificate numbers are stored here: status, dates and a note only.

-- ── What an organisation requires ───────────────────────────────────────
create table if not exists public.volunteer_requirements (
  org_id uuid not null references public.organisations(id) on delete cascade,
  check_key text not null check (check_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text not null check (length(trim(label)) between 1 and 80),
  required boolean not null default true,
  renew_months integer check (renew_months is null or renew_months between 1 and 120),
  sort integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, check_key)
);

-- Until an admin saves their own list, these apply. src/lib/volunteerReadiness.js
-- carries the same list; keep the two together.
create or replace function public.volunteer_requirements_for(p_org uuid)
returns table (check_key text, label text, required boolean, renew_months integer, sort integer)
language sql stable security definer set search_path to 'public' as $$
  -- Another organisation's list is not the caller's business.
  select * from (
  select r.check_key, r.label, r.required, r.renew_months, r.sort
    from volunteer_requirements r where r.org_id = p_org
  union all
  select d.check_key, d.label, d.required, d.renew_months, d.sort
    from (values
      ('interview',    'Informal interview',     true,  null::int, 1),
      ('references',   'Two references',         true,  null,      2),
      ('dbs',          'Enhanced DBS check',     true,  36,        3),
      ('safeguarding', 'Safeguarding training',  true,  36,        4),
      ('induction',    'Induction',              true,  null,      5),
      ('first_aid',    'First aid',              false, 36,        6)
    ) as d(check_key, label, required, renew_months, sort)
   where not exists (select 1 from volunteer_requirements r where r.org_id = p_org)
  ) x where auth.uid() is null or p_org = get_my_org_id()
$$;

-- ── Where each volunteer is ─────────────────────────────────────────────
create table if not exists public.volunteer_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  volunteer_id uuid not null references public.user_profiles(id) on delete cascade,
  check_key text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'done', 'not_needed')),
  completed_on date,
  expires_on date,
  note text check (note is null or length(note) <= 500),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (volunteer_id, check_key),
  check (expires_on is null or completed_on is null or expires_on >= completed_on)
);
create index if not exists volunteer_checks_org_idx on public.volunteer_checks (org_id);
create index if not exists volunteer_checks_expiry_idx on public.volunteer_checks (expires_on) where status = 'done';

-- Column rules RLS cannot express: the volunteer belongs to the row's
-- organisation; "not needed" is an admin's decision and needs a reason; who
-- changed it is recorded by the database, not taken from the client.
create or replace function public.volunteer_checks_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_org uuid; v_role text;
begin
  select org_id, role into v_org, v_role from user_profiles where id = NEW.volunteer_id;
  if v_org is null or v_org <> NEW.org_id then
    raise exception 'That volunteer is not in this organisation.' using errcode = 'insufficient_privilege';
  end if;
  if v_role is distinct from 'volunteer' then
    raise exception 'Checks here are for volunteers only.' using errcode = 'check_violation';
  end if;
  if NEW.status = 'not_needed' and (TG_OP = 'INSERT' or OLD.status is distinct from 'not_needed') then
    if auth.uid() is not null and not is_org_admin() then
      raise exception 'Only an owner or administrator can mark a check as not needed.' using errcode = 'insufficient_privilege';
    end if;
    if NEW.note is null or length(trim(NEW.note)) < 3 then
      raise exception 'Say why this check is not needed.' using errcode = 'check_violation';
    end if;
  end if;
  NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  NEW.updated_at := now();
  return NEW;
end $$;

drop trigger if exists trg_volunteer_checks_guard on public.volunteer_checks;
create trigger trg_volunteer_checks_guard before insert or update on public.volunteer_checks
  for each row execute function public.volunteer_checks_guard();

-- ── The one rule ────────────────────────────────────────────────────────
-- ready: every required check done (and in date) or marked not needed
-- expiring: ready, but something required runs out within 30 days
-- not_ready: anything else. Null for someone outside the caller's organisation.
create or replace function public.volunteer_readiness(p_volunteer uuid)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_org uuid;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_missing int;
  v_expiring int;
begin
  select org_id into v_org from user_profiles where id = p_volunteer;
  if v_org is null then return null; end if;
  if auth.uid() is not null and v_org is distinct from get_my_org_id() then return null; end if;

  select count(*) filter (where c.id is null
                            or c.status not in ('done', 'not_needed')
                            or (c.status = 'done' and c.expires_on is not null and c.expires_on < v_today)),
         count(*) filter (where c.status = 'done' and c.expires_on between v_today and v_today + 30)
    into v_missing, v_expiring
    from volunteer_requirements_for(v_org) r
    left join volunteer_checks c on c.volunteer_id = p_volunteer and c.check_key = r.check_key
   where r.required;

  return case when v_missing > 0 then 'not_ready' when v_expiring > 0 then 'expiring' else 'ready' end;
end $$;

-- ── The guard on rostering, extended to volunteers ──────────────────────
create or replace function public.assert_session_staff_valid()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_session_org uuid;
  v_staff_org   uuid;
  v_active      boolean;
  v_status      text;
  v_compliance  text;
  v_name        text;
  v_changing    boolean;
  v_subject     uuid;
  v_role        text;
  v_ready       text;
begin
  if auth.uid() is null then return NEW; end if;
  -- The Directory used to assign by volunteer_id alone, which this guard never
  -- saw. Whichever column names the person, it is checked.
  v_subject := coalesce(NEW.user_id, NEW.volunteer_id);
  if v_subject is null then return NEW; end if;

  v_changing := (TG_OP = 'INSERT')
    or (coalesce(OLD.user_id, OLD.volunteer_id) is distinct from v_subject)
    or (OLD.session_id is distinct from NEW.session_id);

  select s.org_id, s.status into v_session_org, v_status
  from sessions s where s.id = NEW.session_id;

  select p.org_id, p.role, coalesce(nullif(trim(p.full_name), ''), 'This volunteer')
    into v_staff_org, v_role, v_name
  from user_profiles p where p.id = v_subject;

  if v_staff_org is null or v_staff_org is distinct from v_session_org then
    raise exception 'Cannot assign a person from another organisation to this session.'
      using errcode = 'insufficient_privilege';
  end if;

  if not v_changing then return NEW; end if;

  if v_role = 'volunteer' then
    if coalesce(v_status, 'draft') <> 'draft' then
      v_ready := volunteer_readiness(v_subject);
      if v_ready = 'not_ready' then
        raise exception 'VOLUNTEER_NOT_READY: % has checks still to complete and cannot be added to a published session.', v_name
          using errcode = 'insufficient_privilege';
      end if;
    end if;
    return NEW;
  end if;

  select coalesce(h.is_active, true),
         compliance_state_for(h.dbs_status, h.dbs_expiry,
                              h.safeguarding_training_expiry, h.first_aid_expiry),
         coalesce(h.full_name, 'This person')
    into v_active, v_compliance, v_name
  from hr_staff h
  where h.user_id = v_subject and h.org_id = v_session_org;

  if v_active = false then
    raise exception 'That person is no longer active and cannot be assigned.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_compliance = 'expired' and coalesce(v_status, 'draft') <> 'draft' then
    raise exception 'COMPLIANCE_EXPIRED: % has expired checks and cannot be assigned to a published session.', v_name
      using errcode = 'insufficient_privilege';
  end if;

  return NEW;
end $function$;

drop trigger if exists trg_session_staff_valid on public.session_staff;
create trigger trg_session_staff_valid
  before insert or update of user_id, volunteer_id, session_id on public.session_staff
  for each row execute function public.assert_session_staff_valid();

-- ── Reminders ───────────────────────────────────────────────────────────
-- One row per check, stage and expiry date, so renewing a check (a new expiry)
-- starts its reminders again rather than staying silenced by the old ones.
create table if not exists public.volunteer_check_reminders (
  check_id uuid not null references public.volunteer_checks(id) on delete cascade,
  stage text not null check (stage in ('30', '7', 'expired')),
  expires_on date not null,
  sent_at timestamptz not null default now(),
  primary key (check_id, stage, expires_on)
);

create or replace function public.notify_volunteer_check_expiries()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  r record;
  v_stage text;
  v_when text;
  v_sent integer := 0;
begin
  for r in
    select c.id, c.org_id, c.volunteer_id, c.expires_on, q.label,
           coalesce(nullif(trim(p.full_name), ''), 'A volunteer') as name, q.required
      from volunteer_checks c
      join user_profiles p on p.id = c.volunteer_id and p.role = 'volunteer'
      join lateral volunteer_requirements_for(c.org_id) q on q.check_key = c.check_key
     where c.status = 'done' and c.expires_on is not null and c.expires_on <= v_today + 30
  loop
    v_stage := case when r.expires_on < v_today then 'expired'
                    when r.expires_on <= v_today + 7 then '7' else '30' end;
    insert into volunteer_check_reminders (check_id, stage, expires_on)
      values (r.id, v_stage, r.expires_on) on conflict do nothing;
    if not found then continue; end if;

    v_when := case when v_stage = 'expired' then 'has run out'
                   else 'runs out on ' || to_char(r.expires_on, 'FMDD FMMonth YYYY') end;

    -- The volunteer.
    insert into notifications (org_id, user_id, category, event_type, title, body, target_url, priority)
    values (r.org_id, r.volunteer_id, 'volunteers', 'volunteer_check_expiring',
            'Your ' || lower(r.label) || ' ' || v_when,
            'Let your coordinator know when it is renewed so you can keep booking sessions.',
            '/volunteer', case when v_stage = 'expired' then 'high' else 'normal' end);

    -- Whoever runs volunteering: owners, admins and managers.
    insert into notifications (org_id, user_id, category, event_type, title, body, target_url, priority)
    select r.org_id, m.id, 'volunteers', 'volunteer_check_expiring',
           r.name || '''s ' || lower(r.label) || ' ' || v_when,
           case when r.required then 'Until it is renewed they cannot be added to new sessions.'
                else 'Not required, so it does not stop them being rostered.' end,
           '/dashboard?tab=volunteers', case when v_stage = 'expired' and r.required then 'high' else 'normal' end
      from user_profiles m
     where m.org_id = r.org_id and m.role in ('owner', 'admin', 'manager')
       and not is_access_suspended(m.id);

    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end $$;

-- ── Access ──────────────────────────────────────────────────────────────
alter table public.volunteer_requirements enable row level security;
alter table public.volunteer_checks enable row level security;
alter table public.volunteer_check_reminders enable row level security;

-- Everyone in the organisation can see what is asked of volunteers; only an
-- owner or admin changes it.
create policy "org reads volunteer requirements" on public.volunteer_requirements
  for select to authenticated using (org_id = get_my_org_id());
create policy "admins manage volunteer requirements" on public.volunteer_requirements
  for all to authenticated using (org_id = get_my_org_id() and is_org_admin())
  with check (org_id = get_my_org_id() and is_org_admin());

-- Staff see their organisation's checks; a volunteer sees only their own and
-- cannot change them. Owners, admins and managers record them.
create policy "staff and the volunteer read checks" on public.volunteer_checks
  for select to authenticated
  using (org_id = get_my_org_id() and (not is_portal_user() or volunteer_id = auth.uid()));
create policy "managers record checks" on public.volunteer_checks
  for insert to authenticated with check (org_id = get_my_org_id() and is_org_manager());
create policy "managers update checks" on public.volunteer_checks
  for update to authenticated using (org_id = get_my_org_id() and is_org_manager())
  with check (org_id = get_my_org_id() and is_org_manager());
create policy "admins delete checks" on public.volunteer_checks
  for delete to authenticated using (org_id = get_my_org_id() and is_org_admin());
-- volunteer_check_reminders: no policies, so only the reminder job touches it.

revoke all on public.volunteer_requirements, public.volunteer_checks, public.volunteer_check_reminders from anon;
grant select, insert, update, delete on public.volunteer_requirements, public.volunteer_checks to authenticated;

revoke all on function public.volunteer_requirements_for(uuid) from public, anon;
grant execute on function public.volunteer_requirements_for(uuid) to authenticated;
revoke all on function public.volunteer_readiness(uuid) from public, anon;
grant execute on function public.volunteer_readiness(uuid) to authenticated;
revoke all on function public.notify_volunteer_check_expiries() from public, anon, authenticated;
revoke all on function public.volunteer_checks_guard() from public, anon, authenticated;

-- 08:15 every day, after the trial reminders at 08:00.
select cron.unschedule('volunteer-check-reminders-daily')
 where exists (select 1 from cron.job where jobname = 'volunteer-check-reminders-daily');
select cron.schedule('volunteer-check-reminders-daily', '15 8 * * *', 'select public.notify_volunteer_check_expiries()');
