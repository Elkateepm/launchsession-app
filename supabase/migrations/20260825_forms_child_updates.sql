-- Child-updating forms: a form can declare that its answers maintain the child
-- record, and each question can name the column it maintains.
--
-- Also closes the gap that made recipient tracking guesswork: an invite link
-- now carries ?r=<recipient_id>, so a response is tied to the invite that
-- produced it instead of being matched back by whichever email-shaped value
-- appeared in the payload.

-- ------------------------------------------------------------------ org_forms

alter table public.org_forms
  add column if not exists updates_child boolean not null default false,
  add column if not exists update_mode text not null default 'review';

-- Added separately so re-running against a table that already has the column
-- does not fail on a duplicate constraint.
alter table public.org_forms drop constraint if exists org_forms_update_mode_chk;
alter table public.org_forms add constraint org_forms_update_mode_chk
  check (update_mode in ('review', 'auto'));

comment on column public.org_forms.updates_child is
  'When true, answers on this form maintain the child record. Per-question targets live in fields[].saves_to.';
comment on column public.org_forms.update_mode is
  'review = mapped changes wait for an admin; auto = they apply on submission.';

-- ----------------------------------------------------------- form_submissions

-- Which invite produced this response. Null for anyone who used the plain
-- public link, which stays a supported way to answer.
alter table public.form_submissions
  add column if not exists recipient_id uuid;

alter table public.form_submissions drop constraint if exists form_submissions_recipient_fk;
alter table public.form_submissions add constraint form_submissions_recipient_fk
  foreign key (recipient_id) references public.form_recipients(id) on delete set null;

create index if not exists idx_form_subs_recipient
  on public.form_submissions(recipient_id) where recipient_id is not null;

-- ------------------------------------------------------------------- trigger

-- Email matching stays, but only as the fallback it always should have been.
-- An explicit recipient id is authoritative, and without this guard a response
-- carrying ?r= could tick off both the invited recipient AND whichever other
-- recipient happened to share the email in the payload.
create or replace function public.trg_form_submission_completes_recipient()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ids uuid[];
begin
  if new.recipient_id is not null then
    return new;
  end if;

  select array_agg(r.id) into v_ids
  from public.form_recipients r
  where r.form_id = new.form_id and r.org_id = new.org_id
    and r.status <> 'completed' and r.recipient_email is not null
    and lower(r.recipient_email) in (
      select lower(value) from jsonb_each_text(new.data)
      where value ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    );

  -- Zero: the respondent isn't on the list, which is fine. More than one:
  -- ambiguous, and ticking off the wrong child's consent is worse than leaving
  -- both outstanding, so it is left for a human.
  if v_ids is null or array_length(v_ids, 1) <> 1 then
    return new;
  end if;

  update public.form_recipients
     set status = 'completed', completed_at = now(), submission_id = new.id
   where id = v_ids[1];
  return new;
end $$;

-- ------------------------------------------------------------ submit_public_form

-- The three-argument version is dropped rather than kept alongside: a call made
-- with three named arguments would match both signatures and Postgres would
-- reject it as ambiguous. Dropping it means a client that has not picked up the
-- new bundle yet still resolves to this function, with p_recipient_id
-- defaulting to null -- so the public form keeps working across the deploy gap.
drop function if exists public.submit_public_form(uuid, jsonb, text);

create or replace function public.submit_public_form(
  p_form_id uuid, p_data jsonb, p_name text default null, p_recipient_id uuid default null
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
  v_recipient uuid;
  v_child uuid;
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

  -- The recipient id arrives from a query string, so it is treated as a hint,
  -- not a fact: it counts only if that recipient belongs to this form and this
  -- org. A mangled, stale or foreign id is ignored and the response is still
  -- accepted -- losing a parent's consent because a link got truncated would be
  -- far worse than leaving a row unticked.
  if p_recipient_id is not null then
    select r.id, r.child_id into v_recipient, v_child
    from public.form_recipients r
    where r.id = p_recipient_id
      and r.form_id = p_form_id
      and r.org_id = v_org;
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

  insert into public.form_submissions (
    form_id, org_id, data, submitted_name, flags, review_status, recipient_id, linked_child_id
  )
  values (
    p_form_id, v_org, p_data, nullif(trim(coalesce(p_name, '')), ''), v_flags,
    case when array_length(v_flags, 1) is null then 'new' else 'needs_review' end,
    v_recipient, v_child
  )
  returning id into v_id;

  -- The invite is answered. This is the deterministic half of what the email
  -- matching trigger could only guess at.
  if v_recipient is not null then
    update public.form_recipients
       set status = 'completed', completed_at = now(), submission_id = v_id
     where id = v_recipient and status <> 'completed';
  end if;

  return v_id;
end $function$;

revoke all on function public.submit_public_form(uuid, jsonb, text, uuid) from public;
grant execute on function public.submit_public_form(uuid, jsonb, text, uuid) to anon, authenticated;
