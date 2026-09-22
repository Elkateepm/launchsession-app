-- plan_entitlements picked up Supabase's default "grant all on new tables in
-- public to anon, authenticated". Only RLS was holding writes back, and the
-- absence of a policy is a weaker thing to depend on than the absence of the
-- privilege. The catalogue is read-only to every browser role; it changes
-- through a migration or the service role.
revoke all on public.plan_entitlements from anon, authenticated;
grant select on public.plan_entitlements to anon, authenticated;

-- org_write_locked() is SECURITY DEFINER and reads organisations. anon never
-- reaches it -- enforce_org_write_lock() returns early for any role that is
-- not `authenticated` -- so anon has no reason to hold EXECUTE.
--
-- authenticated MUST keep it: enforce_org_write_lock() is invoker-rights and
-- calls this function as the signed-in user, so revoking it there would make
-- every write fail with a permission error instead of a billing one.
revoke execute on function public.org_write_locked(uuid) from anon, public;
grant execute on function public.org_write_locked(uuid) to authenticated, service_role;

-- A trigger function cannot be called from SQL (it returns type `trigger`) and
-- Postgres does not check EXECUTE when a trigger fires, so no browser role
-- needs this one.
revoke execute on function public.enforce_org_write_lock() from anon, public;
