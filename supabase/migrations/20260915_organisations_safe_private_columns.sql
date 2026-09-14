-- Applied as organisations_safe_private_columns, after the client change
-- that refetches the organisation on sign-in was live.
--
-- organisations_safe runs as its owner, so it bypasses RLS, and anon can read
-- it: the sign-in screen needs an organisation's name, logo and colours before
-- anyone has signed in. But it returned every column to everyone, so the anon
-- key in the app bundle could list each active organisation's contact name,
-- email and phone, internal notes, designated safeguarding lead, session
-- locations, onboarding answers and Stripe ids.
--
-- Those columns now come back only to members of that organisation and to
-- super admins -- the same people "org members can read own org" and "super
-- admins can read all orgs" already let read organisations. Everyone else
-- gets NULL. Branding, status, plan and modules are unchanged, because the
-- sign-in screen and module gating read them.
--
-- Built from the view's current column list so CREATE OR REPLACE keeps the
-- column order and types it requires.
do $$
declare
  private_cols text[] := array[
    'contact_name', 'contact_email', 'contact_phone', 'notes',
    'dsl_name', 'dsl_phone', 'dsl_email',
    'safeguarding_policy_url', 'safeguarding_alert_prefs',
    'custom_groups', 'custom_locations', 'onboarding_data',
    'stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id',
    'subscription_status', 'current_period_end', 'billing_cycle'
  ];
  cols text;
begin
  select string_agg(
           case when c.column_name = any (private_cols)
                then format('case when o.id = public.get_my_org_id() or exists (select 1 from public.super_admins sa where sa.id = auth.uid()) then o.%1$I end as %1$I', c.column_name)
                else format('o.%I', c.column_name)
           end,
           ', ' order by c.ordinal_position)
    into cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'organisations_safe';

  execute format(
    'create or replace view public.organisations_safe as
       select %s
       from public.organisations o
       where o.status = any (array[%L, %L])',
    cols, 'active', 'trial');
end $$;

-- CREATE OR REPLACE keeps grants, but restate that the view is read-only.
revoke insert, update, delete, truncate, references, trigger on public.organisations_safe from anon, authenticated, public;
