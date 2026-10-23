-- Registered charities get 20% off every plan (23 Oct 2026).
--
-- An organisation claims the discount by adding its charity number in
-- Settings -> Billing. The claim applies at checkout straight away
-- (api/create-checkout-session.js), and LaunchSession checks the number
-- against the public register afterwards, marking it verified or rejected.
-- Asking every charity to wait on a manual check before it could pay would
-- put friction on the honest majority to stop a 20% saving.
--
-- So the organisation owns the claim and LaunchSession owns the verdict:
-- org admins may set charity_status to 'none' or 'claimed' only, and may not
-- touch charity_reviewed_at. Super admins and the service role are exempt, as
-- for every other column guard_organisation_entitlements() protects.

alter table public.organisations
  add column if not exists charity_number      text,
  add column if not exists charity_regulator   text,
  add column if not exists charity_status      text not null default 'none',
  add column if not exists charity_claimed_at  timestamptz,
  add column if not exists charity_reviewed_at timestamptz;

-- The formats are what each register prints: England & Wales 6 or 7 digits
-- (a linked charity adds "-1"), Scotland SC + 6 digits, Northern Ireland
-- NIC + 6 digits. The app normalises spaces and case before saving.
alter table public.organisations
  add constraint organisations_charity_status_check
    check (charity_status in ('none', 'claimed', 'verified', 'rejected')),
  add constraint organisations_charity_regulator_check
    check (charity_regulator is null or charity_regulator in ('ccew', 'oscr', 'ccni')),
  add constraint organisations_charity_number_format
    check (charity_number is null or charity_number ~ '^([0-9]{6,7}(-[0-9]{1,2})?|SC[0-9]{6}|NIC[0-9]{6})$'),
  add constraint organisations_charity_claim_complete
    check (charity_status = 'none' or (charity_number is not null and charity_regulator is not null));

-- The live definition, with the charity block added before the final return.
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

  -- Charity discount: claim, change or withdraw, but never verify, reject,
  -- or re-claim the very number that was rejected.
  if new.charity_number      is distinct from old.charity_number
  or new.charity_regulator   is distinct from old.charity_regulator
  or new.charity_status      is distinct from old.charity_status
  or new.charity_claimed_at  is distinct from old.charity_claimed_at
  or new.charity_reviewed_at is distinct from old.charity_reviewed_at
  then
    if new.charity_status not in ('none', 'claimed')
    or new.charity_reviewed_at is distinct from old.charity_reviewed_at
    or (old.charity_status = 'rejected' and new.charity_status = 'claimed'
        and new.charity_number is not distinct from old.charity_number)
    then
      raise exception 'Charity discount checks are made by LaunchSession'
        using errcode = '42501';
    end if;
  end if;

  return new;
end $function$;

-- The app reads its organisation through organisations_safe, which anon can
-- also read. The charity columns are appended and masked like the other
-- private columns: members of the organisation and super admins see them.
-- Built from the view's current column list, as in
-- 20260915_organisations_safe_private_columns.sql, so CREATE OR REPLACE keeps
-- the column order and types it requires.
do $$
declare
  private_cols text[] := array[
    'contact_name', 'contact_email', 'contact_phone', 'notes',
    'dsl_name', 'dsl_phone', 'dsl_email',
    'safeguarding_policy_url', 'safeguarding_alert_prefs',
    'custom_groups', 'custom_locations', 'onboarding_data',
    'stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id',
    'subscription_status', 'current_period_end', 'billing_cycle',
    'charity_number', 'charity_regulator', 'charity_status',
    'charity_claimed_at', 'charity_reviewed_at'
  ];
  new_cols text[] := array['charity_number', 'charity_regulator', 'charity_status', 'charity_claimed_at', 'charity_reviewed_at'];
  masked text := 'case when o.id = public.get_my_org_id() or exists (select 1 from public.super_admins sa where sa.id = auth.uid()) then o.%1$I end as %1$I';
  cols text;
begin
  select string_agg(
           case when c.column_name = any (private_cols) then format(masked, c.column_name)
                else format('o.%I', c.column_name)
           end,
           ', ' order by c.ordinal_position)
    into cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'organisations_safe'
    and c.column_name <> all (new_cols);

  select cols || ', ' || string_agg(format(masked, n), ', ' order by i)
    into cols
  from unnest(new_cols) with ordinality as t(n, i);

  execute format(
    'create or replace view public.organisations_safe as
       select %s
       from public.organisations o
       where o.status = any (array[%L, %L])',
    cols, 'active', 'trial');
end $$;

revoke insert, update, delete, truncate, references, trigger on public.organisations_safe from anon, authenticated, public;
