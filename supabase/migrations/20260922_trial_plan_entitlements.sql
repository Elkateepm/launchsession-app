-- Plan catalogue and the 14-day trial write lock.
--
-- Three things were true before this migration and are not after it:
--   1. A trial "expiring" did nothing. approve_trial_request() filled
--      organisations.modules with the full org-type preset, and allowedModules()
--      falls back to that set once the trial ends -- so an expired trial kept
--      every module it ever had. The trial had no teeth.
--   2. The app's plan keys (starter/pro/enterprise) did not match the plans the
--      marketing site actually sells (Starter/Advanced/Pro+).
--   3. organisations.modules was not covered by trg_guard_organisation_entitlements,
--      so an org admin could grant their own organisation any module.

-- ---------------------------------------------------------------- catalogue

create table if not exists public.plan_entitlements (
  plan                text primary key,
  label               text not null,
  blurb               text not null default '',
  -- The module keys this plan buys. BASE_MODULE_KEYS in src/lib/moduleAccess.js
  -- are available on every plan and are deliberately absent here.
  modules             text[] not null default '{}',
  child_limit         integer,          -- null = unlimited
  price_monthly_pence integer,          -- null = not self-serve
  price_annual_pence  integer,          -- per month, billed annually
  sort                integer not null default 0,
  -- false for the two states that are not purchasable: the trial itself and
  -- the post-trial lock.
  self_serve          boolean not null default true
);

alter table public.plan_entitlements enable row level security;

-- The pricing table is public information -- the signup screen and the
-- marketing pages both read it. There is deliberately no write policy: the
-- catalogue changes through a migration or the service role, never from a
-- browser.
drop policy if exists "Plan catalogue is public" on public.plan_entitlements;
create policy "Plan catalogue is public"
  on public.plan_entitlements for select to anon, authenticated using (true);

grant select on public.plan_entitlements to anon, authenticated;

insert into public.plan_entitlements
  (plan, label, blurb, modules, child_limit, price_monthly_pence, price_annual_pence, sort, self_serve)
values
  ('trial', 'Free trial',
   'Full access to everything for 14 days',
   array['calendar','planner','registers','events_trips','safeguarding','forms',
         'risk_assessments','medical_alerts','volunteers','parent_portal','messaging',
         'gallery','reports','impact_outcomes','fundraising','payments','hr',
         'resource_booking','mentoring'],
   null, null, null, 0, false),

  ('starter', 'Starter',
   'Everything you need to run sessions safely, from day one.',
   array['calendar','planner','registers','events_trips','safeguarding','forms',
         'risk_assessments','medical_alerts'],
   100, 2900, 2300, 1, true),

  ('advanced', 'Advanced',
   'Bring your whole community in -- volunteers, parents, and deeper safeguarding.',
   array['calendar','planner','registers','events_trips','safeguarding','forms',
         'risk_assessments','medical_alerts','volunteers','parent_portal',
         'messaging','gallery'],
   null, 5900, 4700, 2, true),

  ('pro_plus', 'Pro+',
   'Prove your impact and scale operations with full reporting and fundraising.',
   array['calendar','planner','registers','events_trips','safeguarding','forms',
         'risk_assessments','medical_alerts','volunteers','parent_portal',
         'messaging','gallery','reports','impact_outcomes','fundraising',
         'payments','hr','resource_booking','mentoring'],
   null, 9900, 7900, 3, true),

  -- Where an organisation lands when the trial runs out without a subscription,
  -- or when a subscription is cancelled. No modules: the read-only lock below
  -- is what actually holds, this just makes the state legible.
  ('expired', 'Trial ended',
   'Choose a plan to start making changes again.',
   '{}', null, null, null, 9, false)
on conflict (plan) do update set
  label               = excluded.label,
  blurb               = excluded.blurb,
  modules             = excluded.modules,
  child_limit         = excluded.child_limit,
  price_monthly_pence = excluded.price_monthly_pence,
  price_annual_pence  = excluded.price_annual_pence,
  sort                = excluded.sort,
  self_serve          = excluded.self_serve;

-- 'starter' stopped being a safe default the moment it became a paid tier: an
-- organisation created without going through approve_trial_request() would have
-- been handed a paid plan for nothing.
alter table public.organisations alter column plan set default 'trial';

-- The webhook maps a Stripe price to a plan key. A typo there used to write a
-- plan nothing recognises and silently strand the organisation; now it fails.
alter table public.organisations drop constraint if exists organisations_plan_fkey;
alter table public.organisations
  add constraint organisations_plan_fkey
  foreign key (plan) references public.plan_entitlements(plan)
  on update cascade;

-- ------------------------------------------------- is this org locked out?

create or replace function public.org_write_locked(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce((
    select
      -- A trial with no expiry set is treated as still running. Several orgs
      -- predate trial_expires_at and locking them out because a column is
      -- empty would be the wrong way to resolve that ambiguity -- the same
      -- rule isTrialActive() applies in the client.
      (o.plan = 'trial'
         and o.trial_expires_at is not null
         and o.trial_expires_at <= now())
      or o.plan = 'expired'
      -- past_due is deliberately absent: Stripe retries a failed card for
      -- about two weeks before giving up, and an organisation should not go
      -- read-only on the first failed charge. Stripe moves the subscription to
      -- unpaid or canceled when the retries are exhausted.
      or o.subscription_status in ('canceled', 'unpaid')
    from public.organisations o
    where o.id = p_org_id
  ), false)
  -- Command Centre staff are never locked out of a customer's workspace.
  and not exists (select 1 from public.super_admins sa where sa.id = auth.uid());
$function$;

comment on function public.org_write_locked(uuid) is
  'True when an organisation has run out of trial or subscription and may only read.';

create or replace function public.enforce_org_write_lock()
returns trigger
language plpgsql
-- Deliberately NOT security definer: the check below needs current_user to be
-- the PostgREST role that actually made the request.
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_org uuid;
begin
  -- Only requests arriving as a signed-in app user are locked.
  --
  -- service_role is exempt because the Stripe webhook's own write is what
  -- lifts the lock. postgres/supabase_admin are exempt so the SECURITY DEFINER
  -- functions this schema is built on keep working. anon is exempt on purpose:
  -- anon writes are confined by RLS to public forms -- a parent halfway
  -- through registering a child should not be stopped because the
  -- organisation's card expired.
  if current_user is distinct from 'authenticated' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then v_org := old.org_id; else v_org := new.org_id; end if;

  if v_org is not null and public.org_write_locked(v_org) then
    raise exception 'ORG_BILLING_LOCKED: This organisation is read-only because its plan has ended. An owner or administrator can choose a plan in Settings > Billing.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;

comment on function public.enforce_org_write_lock() is
  'Refuses writes from signed-in app users once org_write_locked() is true.';

-- ------------------------------------------------------- attach the trigger

-- Every org-scoped table gets the lock, bar the ones below. Generated rather
-- than hand-written so a table added later cannot quietly miss it -- rerun this
-- DO block (it is idempotent) after adding an org-scoped table.
do $do$
declare
  r record;
  -- Left unlocked on purpose:
  --   user_profiles, admin_invites  -- sign-in and account claiming; locking
  --     these could wedge an organisation out of the screen that takes payment.
  --   notification/push tables      -- delivery plumbing, not org content.
  --   *_audit_log and friends       -- written as a consequence of a write that
  --     is already blocked; locking them turns one clear error into two.
  --   ai_insights_cache, org_stats  -- server-maintained caches.
  --   webauthn_credentials          -- authentication material.
  v_exempt text[] := array[
    'user_profiles', 'admin_invites',
    'notifications', 'notification_preferences', 'push_subscriptions', 'push_delivery_logs',
    'attendance_audit_log', 'case_audit_log', 'hr_audit_log', 'module_access_audit',
    'risk_assessment_audit', 'safeguarding_audit_log', 'deleted_register_audit',
    'ai_insights_cache', 'org_stats', 'webauthn_credentials'
  ];
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not (c.relname = any (v_exempt))
      and exists (
        select 1 from information_schema.columns col
        where col.table_schema = 'public'
          and col.table_name = c.relname
          and col.column_name = 'org_id'
      )
  loop
    execute format('drop trigger if exists trg_org_write_lock on public.%I', r.relname);
    execute format(
      'create trigger trg_org_write_lock before insert or update or delete on public.%I '
      'for each row execute function public.enforce_org_write_lock()', r.relname);
  end loop;
end
$do$;

-- --------------------------------- close the modules self-grant hole

-- modules is now the paid entitlement, so it belongs with plan and the Stripe
-- columns the guard already protects.
create or replace function public.guard_organisation_entitlements()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  -- Service role (Stripe webhook, server functions) and migrations.
  if auth.uid() is null then
    return new;
  end if;

  if exists (select 1 from public.super_admins where id = auth.uid()) then
    return new;
  end if;

  if new.plan                   is distinct from old.plan
  or new.modules                is distinct from old.modules
  or new.status                 is distinct from old.status
  or new.subscription_status    is distinct from old.subscription_status
  or new.current_period_end     is distinct from old.current_period_end
  or new.billing_cycle          is distinct from old.billing_cycle
  or new.stripe_customer_id     is distinct from old.stripe_customer_id
  or new.stripe_subscription_id is distinct from old.stripe_subscription_id
  or new.stripe_price_id        is distinct from old.stripe_price_id
  or new.trial_started_at       is distinct from old.trial_started_at
  or new.trial_expires_at       is distinct from old.trial_expires_at
  or new.branding_enabled       is distinct from old.branding_enabled
  or new.hide_powered_by        is distinct from old.hide_powered_by
  or new.custom_domain          is distinct from old.custom_domain
  or new.subdomain              is distinct from old.subdomain
  or new.slug                   is distinct from old.slug
  or new.enabled_portals        is distinct from old.enabled_portals
  or new.sms_enabled            is distinct from old.sms_enabled
  or new.sms_monthly_limit      is distinct from old.sms_monthly_limit
  then
    raise exception 'Plan, billing and account settings are managed by LaunchSession'
      using errcode = '42501';
  end if;

  return new;
end $function$;
