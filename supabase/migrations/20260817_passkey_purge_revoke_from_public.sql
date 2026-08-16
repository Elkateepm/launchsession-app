-- Passkey challenge purge: remove the inherited PUBLIC execute grant.
--
-- 20260813120000_passkey_login.sql revoked EXECUTE from anon and authenticated,
-- which reads as sufficient but is not. Postgres grants EXECUTE to PUBLIC by
-- default on every new function, and anon/authenticated inherit it, so both
-- roles retained EXECUTE on a SECURITY DEFINER function despite the explicit
-- revoke. Verified on the live database before this change:
--
--   proacl                 = {=X/postgres,postgres=X/postgres,service_role=X/postgres}
--                             ^^^^^^^^^^^ the leading '=' is the PUBLIC grant
--   has_function_privilege('anon', ..., 'EXECUTE')          = true
--   has_function_privilege('authenticated', ..., 'EXECUTE') = true
--
-- The function only deletes already-expired rows, so this was not an auth
-- bypass. It was an unauthenticated write primitive reachable directly through
-- PostgREST, bypassing the API's own checks entirely.
--
-- Revoking from PUBLIC is the part that matters; anon and authenticated are
-- named again only so the intent survives a future reader.

revoke all on function public.purge_expired_webauthn_challenges()
  from public, anon, authenticated;

-- The API calls this with the service key, so this is the only grant needed.
grant execute on function public.purge_expired_webauthn_challenges()
  to service_role;
