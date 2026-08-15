-- SMS delivery log, opt-out register and per-org cap.

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  to_number text not null,
  body text not null,
  purpose text not null default 'other'
    check (purpose in ('form_reminder','session_reminder','safeguarding','broadcast','test','other')),
  related_form_id uuid,
  related_session_id uuid,
  child_id uuid references public.children(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','failed','blocked_opt_out')),
  provider_sid text,
  error_message text,
  segments integer,
  sent_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sms_org_date on public.sms_messages(org_id, created_at desc);
create index if not exists idx_sms_form on public.sms_messages(related_form_id);

-- Opt-out is per number and global. Someone replying STOP has withdrawn consent
-- from the sender they can see, which is LaunchSession's number regardless of
-- which organisation prompted the message.
create table if not exists public.sms_opt_outs (
  phone text primary key,
  reason text,
  opted_out_at timestamptz not null default now()
);

alter table public.sms_messages enable row level security;
alter table public.sms_opt_outs enable row level security;

drop policy if exists "sms read" on public.sms_messages;
create policy "sms read" on public.sms_messages
  for select using (org_id = get_my_org_id() and is_org_admin());

-- No client write policy: rows are written by the service role in the API
-- handler. A client able to write here could fabricate a delivery record.
drop policy if exists "sms opt outs read" on public.sms_opt_outs;
create policy "sms opt outs read" on public.sms_opt_outs
  for select using (auth.role() = 'authenticated');

alter table public.organisations
  add column if not exists sms_monthly_limit integer not null default 500,
  add column if not exists sms_enabled boolean not null default false;

alter table public.children
  add column if not exists sms_opt_out boolean not null default false;

create or replace function public.sms_usage_this_month(p_org_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(count(*), 0)::integer
  from public.sms_messages
  where org_id = p_org_id
    and status in ('sent','delivered')
    and created_at >= date_trunc('month', now() at time zone 'Europe/London');
$$;

grant execute on function public.sms_usage_this_month(uuid) to authenticated;
