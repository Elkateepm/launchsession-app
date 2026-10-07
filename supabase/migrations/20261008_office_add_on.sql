-- Office replaces HR as the add-on, and Branding sits on the top plan only.
--
-- Decided 8 Oct 2026, the same day 20261008_three_plan_pricing.sql went live:
--
--   platform                  Complete Platform              £49.99 (£39.99 annual)
--   platform_office           Platform + Office              £59.99 (£47.99)
--   platform_office_branding  Platform + Office + Branding   £69.99 (£55.99)
--
-- Office is the desk work an administrator does between sessions: HR, resource
-- booking and payments. Forms and the newsletter stay in every plan. They live
-- in the Office tab in the app, but consent and registration forms are core
-- safeguarding tools, and the base plan is sold as the complete platform.
--
-- No organisation was on platform_branding or platform_branding_hr, so the two
-- keys are renamed in place. organisations.plan follows through ON UPDATE
-- CASCADE.
--
-- Applied to project ssahcqeqrxawmwtjpwvh.

update public.plan_entitlements set plan = 'platform_office' where plan = 'platform_branding';
update public.plan_entitlements set plan = 'platform_office_branding' where plan = 'platform_branding_hr';

insert into public.plan_entitlements
  (plan, label, blurb, modules, child_limit, price_monthly_pence, price_annual_pence, sort, self_serve, includes_branding)
values
  ('platform', 'Complete Platform',
   'Everything you need to run sessions, people, safety and communication, with no cap on young people.',
   array['calendar','planner','registers','events_trips','safeguarding','forms',
         'risk_assessments','medical_alerts','volunteers','parent_portal','messaging',
         'gallery','reports','impact_outcomes','fundraising','mentoring'],
   null, 4999, 3999, 1, true, false),

  ('platform_office', 'Platform + Office',
   'The complete platform, plus the Office: HR, resource booking and payments.',
   array['calendar','planner','registers','events_trips','safeguarding','forms',
         'risk_assessments','medical_alerts','volunteers','parent_portal','messaging',
         'gallery','reports','impact_outcomes','fundraising','mentoring',
         'hr','resource_booking','payments'],
   null, 5999, 4799, 2, true, false),

  ('platform_office_branding', 'Platform + Office + Branding',
   'Everything LaunchSession does, in your own logo, colours and emails.',
   array['calendar','planner','registers','events_trips','safeguarding','forms',
         'risk_assessments','medical_alerts','volunteers','parent_portal','messaging',
         'gallery','reports','impact_outcomes','fundraising','mentoring',
         'hr','resource_booking','payments'],
   null, 6999, 5599, 3, true, true)
on conflict (plan) do update set
  label               = excluded.label,
  blurb               = excluded.blurb,
  modules             = excluded.modules,
  child_limit         = excluded.child_limit,
  price_monthly_pence = excluded.price_monthly_pence,
  price_annual_pence  = excluded.price_annual_pence,
  sort                = excluded.sort,
  self_serve          = excluded.self_serve,
  includes_branding   = excluded.includes_branding;
