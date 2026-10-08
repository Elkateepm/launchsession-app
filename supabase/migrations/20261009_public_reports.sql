-- Reporting an injury or a concern without an account, ported from the
-- Solidarity Sports hub (its 20260830_public_forms_create_injury_and_concern).
--
-- A coach covering a session, a volunteer on a trip, a parent who saw
-- something: none of them have a login, and what they need to report is
-- exactly what must not wait. Public forms already accept anonymous
-- submissions through submit_public_form (size limits, rate limit, org taken
-- from the form). A form marked creates_record = 'injury' or 'concern' now has
-- each submission turned into an accident book entry or a safeguarding
-- concern, so neither table is ever opened to the public.
--
-- A public reporter cannot pick a child from a list (a stranger must not see
-- the children), so both records take a typed name, matched to a child by a
-- person afterwards.
--
-- Multi-tenant: the record's organisation is the form's. A submission whose
-- org_id does not match its form's is ignored.

alter table public.org_forms add column if not exists creates_record text not null default 'none';
alter table public.org_forms drop constraint if exists org_forms_creates_record_check;
alter table public.org_forms add constraint org_forms_creates_record_check
  check (creates_record in ('none', 'injury', 'concern'));

-- Room for a report with no account behind it. The existing policies stay as
-- they are: staff can still only insert as themselves (reported_by =
-- auth.uid()), and a row with no reporter is readable by admins only
-- (reported_by = auth.uid() or is_org_admin()), which is right for a report
-- from outside.
alter table public.child_injuries alter column reported_by drop not null;
alter table public.child_injuries alter column child_id drop not null;
alter table public.child_injuries add column if not exists child_name text;
alter table public.child_injuries add column if not exists reported_name text;
alter table public.child_injuries add column if not exists reported_contact text;
alter table public.child_injuries add column if not exists submission_id uuid
  references public.form_submissions(id) on delete set null;
-- Only the public path may leave out the child or the reporter.
alter table public.child_injuries drop constraint if exists child_injuries_child_named;
alter table public.child_injuries add constraint child_injuries_child_named
  check (child_id is not null or child_name is not null);
alter table public.child_injuries drop constraint if exists child_injuries_reporter_known;
alter table public.child_injuries add constraint child_injuries_reporter_known
  check (reported_by is not null or submission_id is not null);

alter table public.cause_for_concern add column if not exists submission_id uuid
  references public.form_submissions(id) on delete set null;

-- Gathers the answers by what each question fills in (mapsTo, as forms that
-- update a child's record already use) and writes the record. Questions with
-- no mapping stay on the submission, which the record links to.
create or replace function public.handle_form_creates_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form  public.org_forms%rowtype;
  v_field jsonb;
  v_key   text;
  a       jsonb := '{}'::jsonb;
  v_when  timestamptz;
  v_date  date;
begin
  select * into v_form from public.org_forms where id = new.form_id;
  if not found or coalesce(v_form.creates_record, 'none') = 'none' then
    return null;
  end if;
  if v_form.org_id is distinct from new.org_id then
    return null;
  end if;

  for v_field in select * from jsonb_array_elements(coalesce(v_form.fields, '[]'::jsonb))
  loop
    v_key := coalesce(v_field ->> 'mapsTo', v_field ->> 'maps_to');
    if v_key is null or v_field ->> 'id' is null then continue; end if;
    a := a || jsonb_build_object(v_key,
      nullif(btrim(coalesce(new.data ->> (v_field ->> 'id'), '')), ''));
  end loop;

  begin
    v_when := coalesce((a ->> 'occurred_at')::timestamptz, new.created_at, now());
  exception when others then
    v_when := coalesce(new.created_at, now());
  end;
  begin
    v_date := (a ->> 'date_of_incident')::date;
  exception when others then
    v_date := null;
  end;

  if v_form.creates_record = 'injury' then
    insert into public.child_injuries (
      org_id, child_id, child_name, occurred_at, location, what_happened,
      injury_type, body_part, first_aid_given, treated_by, witnesses,
      reported_by, reported_name, reported_contact, submission_id)
    values (
      new.org_id, new.linked_child_id,
      case when new.linked_child_id is null then coalesce(a ->> 'child_name', 'Not named') else a ->> 'child_name' end,
      v_when, a ->> 'location',
      coalesce(a ->> 'what_happened', 'Reported through a public form. See the submission.'),
      a ->> 'injury_type', a ->> 'body_part', a ->> 'first_aid_given',
      a ->> 'treated_by', a ->> 'witnesses',
      null, coalesce(a ->> 'reported_name', new.submitted_name),
      a ->> 'reported_contact', new.id);

  elsif v_form.creates_record = 'concern' then
    insert into public.cause_for_concern (
      org_id, submitted_by, submitter_name, submitter_role, child_name, child_id,
      concern_type, description, date_of_incident, location, witnesses, status, submission_id)
    values (
      new.org_id, null,
      coalesce(a ->> 'reported_name', new.submitted_name, 'Reported without an account'),
      a ->> 'submitter_role',
      coalesce(a ->> 'child_name', 'Not named'),
      new.linked_child_id,
      coalesce(a ->> 'concern_type', 'other'),
      -- cause_for_concern has no contact column, and the safeguarding lead
      -- must be able to reach whoever raised it.
      coalesce(a ->> 'description', 'Reported through a public form. See the submission.')
        || case when a ->> 'reported_contact' is not null then E'\n\nContact: ' || (a ->> 'reported_contact') else '' end,
      coalesce(v_date, (coalesce(new.created_at, now()) at time zone 'Europe/London')::date),
      coalesce(a ->> 'location', 'Not given'),
      a ->> 'witnesses', 'open', new.id);
  end if;

  return null;
end
$$;

revoke all on function public.handle_form_creates_record() from public, anon, authenticated;

drop trigger if exists trg_z_form_creates_record on public.form_submissions;
create trigger trg_z_form_creates_record
  after insert on public.form_submissions
  for each row execute function public.handle_form_creates_record();
