-- Recipient tracking, so "who hasn't replied" is answerable without comparing a
-- response list against a register by hand.

alter table public.org_forms drop constraint if exists org_forms_id_org_uniq;
alter table public.org_forms add constraint org_forms_id_org_uniq unique (id, org_id);

create table if not exists public.form_recipients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  form_id uuid not null,
  child_id uuid,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'completed')),
  sent_at timestamptz,
  completed_at timestamptz,
  submission_id uuid,
  created_at timestamptz not null default now(),
  constraint form_recipients_form_org_fk
    foreign key (form_id, org_id)
    references public.org_forms(id, org_id) on delete cascade
);

create index if not exists idx_form_recipients_form on public.form_recipients(form_id, status);
create index if not exists idx_form_recipients_org on public.form_recipients(org_id);
create unique index if not exists idx_form_recipients_unique
  on public.form_recipients(form_id, coalesce(child_id::text, lower(coalesce(recipient_email, ''))));

alter table public.form_recipients enable row level security;

drop policy if exists "form recipients read" on public.form_recipients;
create policy "form recipients read" on public.form_recipients
  for select using (org_id = get_my_org_id());

drop policy if exists "form recipients write" on public.form_recipients;
create policy "form recipients write" on public.form_recipients
  for all using (org_id = get_my_org_id() and is_org_admin())
  with check (org_id = get_my_org_id() and is_org_admin());

create or replace function public.add_form_recipients_from_children(p_form_id uuid, p_child_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_added integer;
begin
  select org_id into v_org from public.org_forms where id = p_form_id;
  if v_org is null or v_org <> get_my_org_id() or not is_org_admin() then
    raise exception 'Not permitted.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.form_recipients (org_id, form_id, child_id, recipient_name, recipient_email, status)
  select v_org, p_form_id, c.id,
         coalesce(nullif(trim(c.parent_name), ''), c.first_name), c.parent_email, 'pending'
  from public.children c
  where c.org_id = v_org and c.id = any(p_child_ids)
  on conflict do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end $$;

revoke all on function public.add_form_recipients_from_children(uuid, uuid[]) from public;
grant execute on function public.add_form_recipients_from_children(uuid, uuid[]) to authenticated;

-- A recipient list that must be ticked off by hand is the problem it was meant
-- to solve. Matching is on email: the public form is anonymous, so that is the
-- only field a respondent reliably shares with their recipient row. No match
-- means no tick, which is correct -- the response is still valid.
create or replace function public.trg_form_submission_completes_recipient()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  select value into v_email from jsonb_each_text(new.data)
  where value ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' limit 1;
  if v_email is null then return new; end if;

  update public.form_recipients r
     set status = 'completed', completed_at = now(), submission_id = new.id
   where r.form_id = new.form_id and r.org_id = new.org_id
     and lower(r.recipient_email) = lower(v_email)
     and r.status <> 'completed';
  return new;
end $$;

drop trigger if exists trg_submission_completes_recipient on public.form_submissions;
create trigger trg_submission_completes_recipient
after insert on public.form_submissions
for each row execute function public.trg_form_submission_completes_recipient();

-- ---------------------------------------------------------------- hardening
-- Applied as form_recipients_hardening + form_recipient_trigger_fix_uuid_agg.

-- Orphan cleanup before the constraints can be added.
delete from public.form_recipients r
where r.child_id is not null
  and not exists (select 1 from public.children c where c.id = r.child_id);

alter table public.form_recipients drop constraint if exists form_recipients_child_fk;
alter table public.form_recipients add constraint form_recipients_child_fk
  foreign key (child_id) references public.children(id) on delete cascade;

alter table public.form_recipients drop constraint if exists form_recipients_submission_fk;
alter table public.form_recipients add constraint form_recipients_submission_fk
  foreign key (submission_id) references public.form_submissions(id) on delete set null;

-- Revoking from PUBLIC does not remove a direct grant to anon.
revoke execute on function public.add_form_recipients_from_children(uuid, uuid[]) from anon;

-- Completion, corrected. The first version took the first email-shaped value
-- anywhere in the payload and updated EVERY recipient sharing it -- so siblings,
-- who have separate rows but one parent email, were all marked complete by a
-- single submission.
create or replace function public.trg_form_submission_completes_recipient()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ids uuid[];
begin
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
