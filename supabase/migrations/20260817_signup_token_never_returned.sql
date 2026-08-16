-- CRITICAL, live: unauthenticated account takeover of any existing user.
--
-- create_trial_signup returned admin_invite_token to its anonymous caller.
-- /api/complete-invite-account accepted an invite token as sufficient proof to
-- force-set the password on an existing auth.users row matched by email. Chain:
--
--   1. call create_trial_signup with a VICTIM'S existing email
--   2. receive a valid admin_invite_token directly in the response
--   3. POST token + victim email + attacker password to complete-invite-account
--   4. victim's password is reset, and their user_profiles row is upserted into
--      the attacker's newly created org -- so they also lose their real tenant
--
-- No enumeration needed: the token is minted on demand for any address typed.
-- This reproduced the practical effect of the old anon SELECT hole through a
-- different door. Closing that policy and then returning the same token in the
-- RPC response left the outcome unchanged.
--
-- The invite email is the ONLY thing proving the person who filled in the form
-- controls the address they typed. So the token must reach the mailbox and
-- nowhere else.
--
-- FIX (both halves are required -- a token can still leak from a mailbox):
--  * create_trial_signup no longer returns the token. It triggers the send via
--    pg_net once the row commits, using the same vault db_event_secret pattern
--    as the existing notification triggers. The new signup_invite_email branch
--    in api/send-form-email.js reads the token server-side from trial_requests
--    rather than accepting one, so it cannot be used to post an arbitrary token
--    to an arbitrary address.
--  * api/complete-invite-account.js now refuses when the matched account has
--    ever signed in, or already holds a profile in a different organisation.
--    The stray-row case it exists for is narrow: an auth.users row from an
--    earlier invite attempt that was never activated.
--
-- Also revoked here:
--  * approve_trial_request from public/anon/authenticated. It returns an admin
--    token and is only called from inside create_trial_signup, whose definer
--    owner does not need callers to hold EXECUTE.
--  * a stale explicit anon grant on session_assignable_staff(). Its internal
--    null-org check already blocked anonymous callers, but the grant should
--    not have been there.
--
-- Verified as anon after applying: signup still works; the returned column set
-- is generated_slug/email/organisation_name with no token; approve_trial_request
-- is no longer callable.

-- Bodies as applied in migration signup_token_never_returned_to_caller_v2.

revoke all on function public.create_trial_signup(text, text, text, text, boolean) from public;
grant execute on function public.create_trial_signup(text, text, text, text, boolean) to anon, authenticated, service_role;

revoke all on function public.approve_trial_request(uuid) from public, anon, authenticated;
grant execute on function public.approve_trial_request(uuid) to service_role;

revoke all on function public.session_assignable_staff() from public, anon;
grant execute on function public.session_assignable_staff() to authenticated;
