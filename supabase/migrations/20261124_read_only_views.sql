-- Views are for reading. Take away every write right the API roles had on them.
--
-- Found 24 Nov 2026 in a security check: organisations_public is owned by
-- postgres without security_invoker, so writes through it skip row level
-- security, it is auto-updatable, and anon held INSERT/UPDATE/DELETE on it.
-- With only the public anon key anyone could rename any active organisation,
-- change its logo or slug, or DELETE it, and 143 tables cascade from
-- organisations (children, cases, safeguarding documents, attendance...).
-- Tested in a rolled-back transaction: an anon no-op UPDATE matched all 5
-- organisations and an anon DELETE was permitted.
--
-- The app and Command Centre only ever SELECT from views, so SELECT stays as it
-- is. The HR and payment views below are security_invoker (row security still
-- applies), but nothing writes through them either, so they lose the stray
-- write grants too.

revoke insert, update, delete, truncate, references, trigger
  on public.organisations_public,
     public.organisations_safe,
     public.hr_staff_warnings_live,
     public.hr_supervision_visible,
     public.hr_dashboard_stats,
     public.hr_needs_attention,
     public.hr_onboarding_progress,
     public.hr_staff_compliance,
     public.hr_staff_compliance_summary,
     public.payment_charge_balances
  from public, anon, authenticated;
