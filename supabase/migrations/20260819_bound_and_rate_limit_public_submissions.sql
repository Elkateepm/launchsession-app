-- submit_child_registration and submit_volunteer_application are callable
-- without signing in and had no rate limit and no field-length bounds. Anyone
-- knowing a public org slug could repeatedly insert arbitrarily large rows into
-- that charity's pending queue. Neither reaches live records without an admin
-- approving, so this is abuse and noise rather than a breach -- but a flooded
-- queue is how a real registration gets missed.
--
-- Thresholds are deliberately generous, because a school-holiday sign-up push
-- is a real pattern that must not be throttled: 60 registrations and 30
-- volunteer applications per organisation per hour. The global buckets (400
-- and 200 per hour) mean one targeted charity cannot deny service to the rest
-- of the platform. Tune if a customer legitimately exceeds them.
--
-- Lengths sit well above any honest entry -- a genuine medical note is a
-- sentence or two, not four thousand characters. Email format and a sane date
-- of birth range are also checked, and DBS numbers are capped at 64 characters.
--
-- Verified against the live database after applying: a normal registration is
-- accepted; a 5000-character medical note, a malformed parent email and an
-- unknown org slug are each rejected.
--
-- Not solved here, because it cannot be solved in the database: a volunteer
-- application can still be submitted under someone else's email address.
-- Establishing that the applicant owns the address needs a verification step
-- in the flow itself.

create or replace function public.submit_child_registration(
  p_org_slug text, p_first_name text, p_last_name text DEFAULT NULL::text,
  p_date_of_birth date DEFAULT NULL::date, p_school text DEFAULT NULL::text,
  p_parent_name text DEFAULT NULL::text, p_parent_phone text DEFAULT NULL::text,
  p_parent_email text DEFAULT NULL::text, p_emergency_contact_name text DEFAULT NULL::text,
  p_emergency_contact_phone text DEFAULT NULL::text, p_allergies text DEFAULT NULL::text,
  p_medical_notes text DEFAULT NULL::text, p_has_asthma boolean DEFAULT false,
  p_has_diabetes boolean DEFAULT false, p_takes_medication boolean DEFAULT false,
  p_medication_details text DEFAULT NULL::text, p_has_epipen boolean DEFAULT false,
  p_has_behaviour_plan boolean DEFAULT false, p_behaviour_plan_notes text DEFAULT NULL::text,
  p_travel_consent boolean DEFAULT false, p_consent_photo boolean DEFAULT false,
  p_consent_trip boolean DEFAULT false, p_consent_medical boolean DEFAULT false,
  p_consent_data_sharing boolean DEFAULT false, p_notes text DEFAULT NULL::text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_org_id uuid;
  v_new_id uuid;
begin
  if p_first_name is null or length(trim(p_first_name)) = 0 then
    raise exception 'First name is required';
  end if;

  if length(p_first_name) > 120
     or length(coalesce(p_last_name, '')) > 120
     or length(coalesce(p_school, '')) > 200
     or length(coalesce(p_parent_name, '')) > 200
     or length(coalesce(p_parent_phone, '')) > 40
     or length(coalesce(p_parent_email, '')) > 254
     or length(coalesce(p_emergency_contact_name, '')) > 200
     or length(coalesce(p_emergency_contact_phone, '')) > 40
     or length(coalesce(p_allergies, '')) > 2000
     or length(coalesce(p_medical_notes, '')) > 4000
     or length(coalesce(p_medication_details, '')) > 2000
     or length(coalesce(p_behaviour_plan_notes, '')) > 4000
     or length(coalesce(p_notes, '')) > 4000
  then
    raise exception 'One or more fields are longer than we can accept. Please shorten them and try again.';
  end if;

  if p_parent_email is not null and length(trim(p_parent_email)) > 0
     and p_parent_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That email address does not look valid.';
  end if;

  if p_date_of_birth is not null
     and (p_date_of_birth > current_date or p_date_of_birth < current_date - interval '30 years') then
    raise exception 'That date of birth does not look valid.';
  end if;

  select id into v_org_id from public.organisations
   where slug = p_org_slug and status in ('active', 'trial');
  if v_org_id is null then
    raise exception 'Organisation not found or not accepting registrations';
  end if;

  if not check_rate_limit('child-reg:org:' || v_org_id::text, 60, 3600)
     or not check_rate_limit('child-reg:global', 400, 3600) then
    raise exception 'Too many registrations have been submitted recently. Please try again shortly.';
  end if;

  insert into public.child_registration_requests (
    org_id, status, first_name, last_name, date_of_birth, school,
    parent_name, parent_phone, parent_email, emergency_contact_name, emergency_contact_phone,
    allergies, medical_notes, has_asthma, has_diabetes, takes_medication, medication_details,
    has_epipen, has_behaviour_plan, behaviour_plan_notes,
    travel_consent, consent_photo, consent_trip, consent_medical, consent_data_sharing, notes
  ) values (
    v_org_id, 'pending', trim(p_first_name), p_last_name, p_date_of_birth, p_school,
    p_parent_name, p_parent_phone, p_parent_email, p_emergency_contact_name, p_emergency_contact_phone,
    p_allergies, p_medical_notes, p_has_asthma, p_has_diabetes, p_takes_medication, p_medication_details,
    p_has_epipen, p_has_behaviour_plan, p_behaviour_plan_notes,
    p_travel_consent, p_consent_photo, p_consent_trip, p_consent_medical, p_consent_data_sharing, p_notes
  ) returning id into v_new_id;

  return v_new_id;
end;
$function$;

create or replace function public.submit_volunteer_application(
  p_org_slug text, p_first_name text, p_last_name text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text,
  p_dob date DEFAULT NULL::date, p_emergency_contact_name text DEFAULT NULL::text,
  p_emergency_contact_phone text DEFAULT NULL::text, p_skills text[] DEFAULT NULL::text[],
  p_availability text[] DEFAULT NULL::text[], p_dbs_number text DEFAULT NULL::text,
  p_dbs_expiry date DEFAULT NULL::date, p_notes text DEFAULT NULL::text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_org_id uuid;
  v_new_id uuid;
begin
  if p_first_name is null or length(trim(p_first_name)) = 0 then
    raise exception 'First name is required';
  end if;

  if length(p_first_name) > 120
     or length(coalesce(p_last_name, '')) > 120
     or length(coalesce(p_email, '')) > 254
     or length(coalesce(p_phone, '')) > 40
     or length(coalesce(p_emergency_contact_name, '')) > 200
     or length(coalesce(p_emergency_contact_phone, '')) > 40
     or length(coalesce(p_dbs_number, '')) > 64
     or length(coalesce(p_notes, '')) > 4000
     or coalesce(cardinality(p_skills), 0) > 50
     or coalesce(cardinality(p_availability), 0) > 50
     or length(coalesce(array_to_string(p_skills, ','), '')) > 2000
     or length(coalesce(array_to_string(p_availability, ','), '')) > 2000
  then
    raise exception 'One or more fields are longer than we can accept. Please shorten them and try again.';
  end if;

  if p_email is not null and length(trim(p_email)) > 0
     and p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That email address does not look valid.';
  end if;

  select id into v_org_id from public.organisations
   where slug = p_org_slug and status in ('active', 'trial');
  if v_org_id is null then
    raise exception 'Organisation not found or not accepting applications';
  end if;

  if not check_rate_limit('vol-app:org:' || v_org_id::text, 30, 3600)
     or not check_rate_limit('vol-app:global', 200, 3600) then
    raise exception 'Too many applications have been submitted recently. Please try again shortly.';
  end if;

  insert into public.volunteer_applications (
    org_id, status, first_name, last_name, email, phone, dob,
    emergency_contact_name, emergency_contact_phone, skills, availability,
    dbs_number, dbs_expiry, notes
  ) values (
    v_org_id, 'pending', trim(p_first_name), p_last_name, p_email, p_phone, p_dob,
    p_emergency_contact_name, p_emergency_contact_phone, p_skills, p_availability,
    p_dbs_number, p_dbs_expiry, p_notes
  ) returning id into v_new_id;

  return v_new_id;
end;
$function$;
