-- Trial reminder emails: one three days out, one when the trial lapses.
--
-- Scheduled with pg_cron rather than a Vercel cron because the Hobby plan
-- allows only two of those, and posted to the existing send-form-email handler
-- with the db_event_secret the signup mailer already uses -- so this needs no
-- new credential anywhere.

create table if not exists public.trial_reminders_sent (
  org_id  uuid not null references public.organisations(id) on delete cascade,
  kind    text not null check (kind in ('ending_soon', 'ended')),
  sent_at timestamptz not null default now(),
  primary key (org_id, kind)
);

comment on table public.trial_reminders_sent is
  'One row per reminder already sent. The primary key is what makes the daily sweep idempotent.';

alter table public.trial_reminders_sent enable row level security;
-- No policies at all: only the service role, which bypasses RLS, touches this.
revoke all on public.trial_reminders_sent from anon, authenticated;

-- Which organisations are due a reminder of this kind, right now.
--
-- Each window has a lower bound as well as an upper one, and the lower bound
-- is the important half: without it the first run would mail every
-- organisation whose trial lapsed months ago. They have had their answer, and
-- a reminder about a trial that ended in August would read as a bug.
create or replace function public.orgs_due_trial_reminder(p_kind text)
returns table (org_id uuid, name text, trial_expires_at timestamptz)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select o.id, o.name, o.trial_expires_at
  from public.organisations o
  where o.trial_expires_at is not null
    and o.status = 'active'
    and (
      -- Three days out. Restricted to plan = 'trial' so an organisation that
      -- has already paid is never nudged about a trial it has left behind.
      (p_kind = 'ending_soon'
        and o.plan = 'trial'
        and o.trial_expires_at > now()
        and o.trial_expires_at <= now() + interval '3 days')
      or
      -- Just lapsed. 'expired' is included because the org may already have
      -- been moved there by a cancelled subscription.
      (p_kind = 'ended'
        and o.plan in ('trial', 'expired')
        and o.trial_expires_at <= now()
        and o.trial_expires_at > now() - interval '2 days')
    )
    and not exists (
      select 1 from public.trial_reminders_sent r
      where r.org_id = o.id and r.kind = p_kind
    );
$function$;

revoke execute on function public.orgs_due_trial_reminder(text) from anon, authenticated, public;
grant execute on function public.orgs_due_trial_reminder(text) to service_role;

-- The cron entry point. Mirrors how create_trial_signup() reaches the mailer.
create or replace function public.trigger_trial_reminders()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'db_event_secret' limit 1;

  if v_secret is null then
    raise warning 'trigger_trial_reminders: db_event_secret missing, no reminders sent';
    return;
  end if;

  perform net.http_post(
    url := 'https://app.launchsession.co.uk/api/send-form-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-db-event-secret', v_secret),
    body := jsonb_build_object('type', 'trial_reminders')
  );
end;
$function$;

revoke execute on function public.trigger_trial_reminders() from anon, authenticated, public;

-- 08:00 UTC -- 9am through British Summer Time, 8am in winter. Daily is enough:
-- both windows are wider than a day, so a missed run still catches the
-- organisation on the next one.
select cron.unschedule('trial-reminders-daily')
where exists (select 1 from cron.job where jobname = 'trial-reminders-daily');

select cron.schedule('trial-reminders-daily', '0 8 * * *', $cron$select public.trigger_trial_reminders()$cron$);
