-- The three plans the website sells, and branding that follows the plan.
--
-- Since 1 Sep 2026 the website has sold one ladder: the platform, the platform
-- with the Branding Centre, and both with HR. Billing still sold Starter /
-- Advanced / Pro+ at £29 / £59 / £99, which split by modules rather than by
-- branding, so nothing an organisation paid for said whether it had bought
-- branding. Billing now sells what the website sells:
--
--   platform              £49.99/mo (£39.99/mo billed annually)
--   platform_branding     £59.99/mo (£47.99)   + Branding Centre, branded emails
--   platform_branding_hr  £69.99/mo (£55.99)   + Branding Centre and HR
--
-- No organisation had paid when this was written, so no subscription moves.
-- The old rows stay, unsold, because organisations.plan references this table
-- and a migration on a live table removes nothing it does not have to.
--
-- Applied to project ssahcqeqrxawmwtjpwvh.

alter table public.plan_entitlements
  add column if not exists includes_branding boolean not null default false;

comment on column public.plan_entitlements.includes_branding is
  'Whether this plan buys the Branding Centre: the organisation''s own identity on sign-in, forms, public pages and emails. Copied to organisations.branding_enabled whenever an organisation''s plan changes.';

insert into public.plan_entitlements
  (plan, label, blurb, modules, child_limit, price_monthly_pence, price_annual_pence, sort, self_serve, includes_branding)
values
  ('platform', 'Complete Platform',
   'Everything you need to run sessions, people, safety and communication, with no cap on young people.',
   array['calendar','planner','registers','events_trips','safeguarding','forms',
         'risk_assessments','medical_alerts','volunteers','parent_portal','messaging',
         'gallery','reports','impact_outcomes','fundraising','payments',
         'resource_booking','mentoring'],
   null, 4999, 3999, 1, true, false),

  ('platform_branding', 'Platform + Branding',
   'The whole platform in your own logo and colours, with branded forms, emails and sign-up pages.',
   array['calendar','planner','registers','events_trips','safeguarding','forms',
         'risk_assessments','medical_alerts','volunteers','parent_portal','messaging',
         'gallery','reports','impact_outcomes','fundraising','payments',
         'resource_booking','mentoring'],
   null, 5999, 4799, 2, true, true),

  ('platform_branding_hr', 'Platform + Branding + HR',
   'Everything LaunchSession does, in your own branding, including the HR Centre.',
   array['calendar','planner','registers','events_trips','safeguarding','forms',
         'risk_assessments','medical_alerts','volunteers','parent_portal','messaging',
         'gallery','reports','impact_outcomes','fundraising','payments','hr',
         'resource_booking','mentoring'],
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

-- The free trial includes branding: seeing their own identity is the
-- strongest reason to choose a Branding plan when it ends.
update public.plan_entitlements set includes_branding = true where plan = 'trial';
update public.plan_entitlements set includes_branding = false where plan = 'expired';

-- No longer sold. Kept for the foreign key and for history.
update public.plan_entitlements
   set self_serve = false, includes_branding = false, sort = 20 + sort
 where plan in ('starter', 'advanced', 'pro_plus') and self_serve;

-- ---------------------------------------------- branding follows the plan

-- Whenever an organisation's plan is set or changes -- trial approval, the
-- Stripe webhook, a cancellation moving it to 'expired' -- its branding switch
-- is set from the plan. A super admin can still change branding_enabled on its
-- own afterwards, for example for a founding member, and that stands until the
-- plan next changes.
--
-- Invoker rights: it only reads the plan catalogue, which every role may read.
-- It runs before trg_guard_organisation_entitlements (triggers fire in name
-- order), and the guard allows the branding change exactly when it allows the
-- plan change that caused it.
create or replace function public.branding_follows_plan()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if tg_op = 'INSERT' or new.plan is distinct from old.plan then
    new.branding_enabled := coalesce(
      (select pe.includes_branding from public.plan_entitlements pe where pe.plan = new.plan),
      false);
  end if;
  return new;
end
$function$;

drop trigger if exists trg_branding_follows_plan on public.organisations;
create trigger trg_branding_follows_plan
  before insert or update of plan on public.organisations
  for each row execute function public.branding_follows_plan();
