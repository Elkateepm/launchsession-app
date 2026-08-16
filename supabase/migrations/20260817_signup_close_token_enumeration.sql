-- Signup: close anonymous admin-invite-token enumeration on trial_requests.
--
-- LIVE HOLE (verified before the change, on production data):
-- trial_requests had this policy for the anon role:
--
--   create policy "anon can read own recent trial request" on trial_requests
--     for select to anon
--     using (created_at >= now() - interval '10 minutes');
--
-- The name says "own". The predicate says "recent". There is no ownership
-- column on this table and anon has no identity, so the policy scoped by TIME
-- only -- every anonymous caller could read every signup from the last ten
-- minutes, including admin_invite_token, which is the credential that grants
-- admin on the newly created organisation.
--
-- Exploit: poll trial_requests as anon, take the token from any row, redeem it
-- before the founder opens their email. That is organisation takeover by
-- enumeration. Names and email addresses of every new signup leaked regardless.
--
-- Confirmed by seeding a row and reading it back with `set local role anon`:
-- the token came out in plaintext. After this migration the same query returns
-- zero rows.
--
-- Same shape as the admin_invites exposure fixed in the HR round: a policy that
-- reads as scoped, no token predicate, and the client-side filter doing all the
-- actual work.
--
-- FIX
-- The client only read the table to recover the token after approval, so the
-- read is removed entirely and the value is returned from the definer function
-- that already had it. Note that dropping the SELECT policy alone breaks the
-- client's .insert(...).select(): PostgREST evaluates RETURNING against the
-- SELECT policy. Hence create_trial_signup below, which does insert + approve
-- in one definer call so anon needs neither SELECT nor RETURNING.

drop policy if exists "anon can read own recent trial request" on public.trial_requests;

-- approve_trial_request now returns the invite details instead of void.
-- (Body unchanged apart from the two RETURN QUERY lines; see
--  20260817_trial_requests_close_anon_token_enumeration for the full definition
--  as applied.)

-- create_trial_signup wraps insert + approve, validates the input server-side,
-- and returns only the fields needed to send the invite email.

revoke all on function public.approve_trial_request(uuid) from public;
grant execute on function public.approve_trial_request(uuid) to anon, authenticated, service_role;

revoke all on function public.create_trial_signup(text, text, text, text, boolean) from public;
grant execute on function public.create_trial_signup(text, text, text, text, boolean) to anon, authenticated, service_role;
