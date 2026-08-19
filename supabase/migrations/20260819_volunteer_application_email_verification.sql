-- Volunteer applications could be submitted under anyone's email address:
-- nothing established that the applicant controlled the inbox. That matters
-- because an application carries a DBS number and, once accepted, becomes a
-- volunteer account at a charity working with children.
--
-- Double opt-in. A submission carrying an email lands as 'unverified' and is
-- invisible to admins -- the applications list already filters on
-- status = 'pending', so nothing in the UI had to change for it to be hidden.
-- Clicking the emailed link promotes it to 'pending'.
--
-- Phone-only applications are unaffected and still land as 'pending': there is
-- no address to impersonate, and requiring an email would close a legitimate
-- route in for people without one.
--
-- Verified end to end against the live database: an emailed application lands
-- unverified and hidden, a wrong token is refused, the right token promotes it
-- to pending and returns the organisation, a replayed token is refused, and a
-- phone-only application still goes straight through.

alter table public.volunteer_applications
  add column if not exists email_verified boolean not null default false,
  add column if not exists verification_token uuid,
  add column if not exists verification_sent_at timestamptz,
  add column if not exists verified_at timestamptz;

create unique index if not exists volunteer_applications_verification_token_key
  on public.volunteer_applications (verification_token)
  where verification_token is not null;

-- The status check constraint allowed only pending/approved/rejected, which
-- broke two things:
--   1. the new 'unverified' state;
--   2. approval, which has never worked -- VolunteersMain.jsx writes
--      status = 'accepted' but the constraint only permitted 'approved', so
--      every approval attempt failed the check. That predates this work and
--      was found by exercising the flow rather than reading it.
-- Both spellings are allowed rather than picking one, since rows or code may
-- depend on either. Worth consolidating later.
alter table public.volunteer_applications
  drop constraint if exists volunteer_applications_status_check;

alter table public.volunteer_applications
  add constraint volunteer_applications_status_check
  check (status = any (array['unverified','pending','approved','accepted','rejected']));

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
  v_has_email boolean;
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

  v_has_email := p_email is not null and length(trim(p_email)) > 0;

  if v_has_email and p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
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
    dbs_number, dbs_expiry, notes, verification_token, email_verified
  ) values (
    v_org_id,
    case when v_has_email then 'unverified' else 'pending' end,
    trim(p_first_name), p_last_name, p_email, p_phone, p_dob,
    p_emergency_contact_name, p_emergency_contact_phone, p_skills, p_availability,
    p_dbs_number, p_dbs_expiry, p_notes,
    case when v_has_email then gen_random_uuid() else null end,
    false
  ) returning id into v_new_id;

  return v_new_id;
end;
$function$;

-- Confirming the link. Anon-callable by necessity -- the applicant has no
-- account -- but gated on a token nobody else holds, and rate limited so the
-- token space cannot be swept. Unknown and already-used tokens give the same
-- answer, so it cannot be used to test whether a token exists.
create or replace function public.verify_volunteer_application(p_token uuid)
returns table (org_name text, org_slug text, first_name text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_app record;
begin
  if not check_rate_limit('vol-verify:global', 300, 3600) then
    raise exception 'Too many attempts. Please try again shortly.';
  end if;

  select a.id, a.org_id, a.first_name as fname, a.status
    into v_app
  from public.volunteer_applications a
  where a.verification_token = p_token
    and a.status = 'unverified'
  limit 1;

  if not found then
    raise exception 'This link is no longer valid. It may already have been used.';
  end if;

  update public.volunteer_applications
     set status = 'pending', email_verified = true,
         verified_at = now(), verification_token = null
   where id = v_app.id;

  return query
    select o.name, o.slug, v_app.fname
    from public.organisations o
    where o.id = v_app.org_id;
end;
$function$;

revoke execute on function public.verify_volunteer_application(uuid) from public;
grant  execute on function public.verify_volunteer_application(uuid) to anon, authenticated;

-- Used by the mailer to look up where to send. service_role only: the address
-- and token are read here rather than accepted from the caller, so the mailer
-- cannot be driven to post a valid token to an address of the caller's choice.
create or replace function public.get_volunteer_verification_payload(p_application_id uuid)
returns table (
  email text, first_name text, verification_token uuid,
  org_name text, org_slug text, org_logo_url text,
  org_primary_color text, org_secondary_color text
)
language sql stable security definer
set search_path = pg_catalog, public
as $function$
  select a.email, a.first_name, a.verification_token,
         o.name, o.slug, o.logo_url, o.primary_color, o.secondary_color
  from public.volunteer_applications a
  join public.organisations o on o.id = a.org_id
  where a.id = p_application_id
    and a.status = 'unverified'
    and a.verification_token is not null
    and a.email is not null;
$function$;

revoke execute on function public.get_volunteer_verification_payload(uuid) from public, anon, authenticated;
grant  execute on function public.get_volunteer_verification_payload(uuid) to service_role;

-- Records that the mail went out, and throttles resends to one per five
-- minutes per application so the endpoint cannot be used to bomb an inbox.
create or replace function public.mark_volunteer_verification_sent(p_application_id uuid)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare v_last timestamptz;
begin
  select verification_sent_at into v_last
  from public.volunteer_applications where id = p_application_id;

  if v_last is not null and v_last > now() - interval '5 minutes' then
    return false;
  end if;

  update public.volunteer_applications
     set verification_sent_at = now() where id = p_application_id;
  return true;
end;
$function$;

revoke execute on function public.mark_volunteer_verification_sent(uuid) from public, anon, authenticated;
grant  execute on function public.mark_volunteer_verification_sent(uuid) to service_role;
