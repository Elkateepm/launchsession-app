-- Forms public access: security-definer RPCs used by the unauthenticated
-- /forms/:slug/:id page. Exported verbatim from project ssahcqeqrxawmwtjpwvh.
--
-- These replace two anon table policies that were dropped in the same change:
--   "Public can read active forms" on org_forms      -- exposed every active
--     form of every organisation, including non-public ones
--   "Public can submit to active forms" on form_submissions -- let the client
--     choose org_id and form_id freely
--
drop policy if exists "Public can read active forms" on public.org_forms;
drop policy if exists "Public can submit to active forms" on public.form_submissions;

create or replace function public.get_public_form(p_org_slug text, p_form_id uuid)
returns table (
  id uuid, name text, description text, intro_text text, confirmation_message text,
  fields jsonb, multi_step boolean, accent_color text, cover_image_url text,
  closing_date date, org_name text, org_logo_url text,
  org_primary_color text, org_secondary_color text
)
language sql security definer set search_path = public stable
as $function$
  select
    f.id, f.name, f.description, f.intro_text, f.confirmation_message,
    f.fields, f.multi_step, f.accent_color, f.cover_image_url, f.closing_date,
    o.name, o.logo_url, o.primary_color, o.secondary_color
  from public.org_forms f
  join public.organisations o on o.id = f.org_id
  where f.id = p_form_id
    -- The slug must match the form's owning org, so a form id cannot be read
    -- under another organisation's URL.
    and lower(o.slug) = lower(p_org_slug)
    and f.visibility = 'public'
    and coalesce(f.status, case when f.is_active then 'active' else 'draft' end) = 'active'
    and (f.closing_date is null or f.closing_date >= (now() at time zone 'Europe/London')::date)
  limit 1;
$function$;

revoke all on function public.get_public_form(text, uuid) from public;
grant execute on function public.get_public_form(text, uuid) to anon, authenticated;

create or replace function public.submit_public_form(
  p_form_id uuid, p_data jsonb, p_name text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $function$
declare
  v_org uuid;
  v_flags text[] := '{}';
  v_id uuid;
  v_answers text;
  v_recent int;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Invalid submission.';
  end if;

  -- A real form response is a few kilobytes. A sanity bound, not a business rule.
  if length(p_data::text) > 100000 or (select count(*) from jsonb_object_keys(p_data)) > 200 then
    raise exception 'This submission is too large.';
  end if;

  -- org_id is derived from the form, never accepted from the client.
  select f.org_id into v_org
  from public.org_forms f
  where f.id = p_form_id
    and f.visibility = 'public'
    and coalesce(f.status, case when f.is_active then 'active' else 'draft' end) = 'active'
    and (f.closing_date is null or f.closing_date >= (now() at time zone 'Europe/London')::date);

  if v_org is null then
    raise exception 'This form is not accepting responses.';
  end if;

  -- Crude flood protection. Not a substitute for a real rate limiter, but it
  -- stops a script filling the table faster than anyone would notice.
  select count(*) into v_recent
  from public.form_submissions
  where form_id = p_form_id and created_at > now() - interval '1 minute';
  if v_recent > 20 then
    raise exception 'Too many submissions just now. Please try again shortly.';
  end if;

  -- Values only, never keys. Scanning the serialised payload matched question
  -- wording, so answering "No" to "any changes to medical information?" flagged
  -- itself and every health form arrived marked urgent.
  select string_agg(value, ' ') into v_answers
  from jsonb_each_text(p_data) where value is not null;
  v_answers := coalesce(v_answers, '');

  -- An explicit negative is not a disclosure.
  if v_answers ~* '(allerg|epipen|anaphyla)'
     and v_answers !~* '(no known allerg|none|no allerg|n/?a)' then
    v_flags := array_append(v_flags, 'medical');
  end if;

  if v_answers ~* '(medication|inhaler|insulin|epipen)'
     and v_answers !~* '(no medication|none|not applicable|n/?a)' then
    v_flags := array_append(v_flags, 'medication');
  end if;

  if v_answers ~* 'withdraw' then
    v_flags := array_append(v_flags, 'consent_withdrawn');
  end if;

  insert into public.form_submissions (form_id, org_id, data, submitted_name, flags, review_status)
  values (
    p_form_id, v_org, p_data, nullif(trim(coalesce(p_name, '')), ''), v_flags,
    case when array_length(v_flags, 1) is null then 'new' else 'needs_review' end
  )
  returning id into v_id;

  return v_id;
end $function$;

revoke all on function public.submit_public_form(uuid, jsonb, text) from public;
grant execute on function public.submit_public_form(uuid, jsonb, text) to anon, authenticated;
