-- Applied as organisations_guard_entitlement_columns.
--
-- "Admins can update own org" is a whole-row policy, and RLS cannot limit
-- columns. An organisation admin could therefore set their own plan,
-- subscription status, trial end date, Stripe ids, branding entitlement,
-- custom domain or SMS allowance straight through the API. These columns are
-- owned by billing (the Stripe webhook, service role) and by LaunchSession
-- staff (super admins); every screen an org admin uses writes other columns.
-- Same approach as trg_risk_guard_approval.
--
-- Verified in rolled-back transactions as a non-super-admin org admin: the
-- Branding Centre, onboarding and settings save shapes still update; changing
-- the trial end, branding_enabled or plan is refused; another org's row is
-- untouched (RLS, 0 rows).

create or replace function public.guard_organisation_entitlements()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  -- Service role (Stripe webhook, server functions) and migrations.
  if auth.uid() is null then
    return new;
  end if;

  if exists (select 1 from public.super_admins where id = auth.uid()) then
    return new;
  end if;

  if new.plan                   is distinct from old.plan
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
end $$;

drop trigger if exists trg_guard_organisation_entitlements on public.organisations;
create trigger trg_guard_organisation_entitlements
  before update on public.organisations
  for each row execute function public.guard_organisation_entitlements();
