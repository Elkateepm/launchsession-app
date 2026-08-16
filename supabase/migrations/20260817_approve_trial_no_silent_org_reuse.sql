-- LIVE: signing up with the name of an existing memberless organisation handed
-- the caller an admin invite for THAT organisation.
--
-- approve_trial_request treated "slug exists but has no user_profiles" as an
-- abandoned shell safe to recycle: it reused the org, wrote an admin_invites
-- row carrying the caller's email, and returned a fresh token. Signup is
-- anonymous and public, so anyone who could guess the name of an org that had
-- not yet onboarded could claim admin on it. 'Watford FC' on this database was
-- in exactly that state -- 0 members, slug matching what a signup for that name
-- generates.
--
-- The recycle case is real (a signup that created an org then failed before
-- anyone joined) but "no members yet" cannot be the test for it: a brand-new
-- legitimate org is indistinguishable from an abandoned one. The email is the
-- only thing tying a request to the original requester, so reuse now requires
-- the address to match the invite already on file. Anything else raises
-- ORG_NAME_TAKEN, which the client already handles.
--
-- Also fixes an ambiguity introduced with the guard: RETURNS TABLE declares
-- email/full_name/organisation_name as OUT parameters, which collide with the
-- same-named columns on admin_invites. The first version raised 'column
-- reference "email" is ambiguous' -- it refused the attack, but by accident,
-- and would have refused a legitimate resume just as hard. Tables are aliased.
--
-- NOT fixed here, and the deeper problem: admin_invite_token is still returned
-- to the caller. The invite email is what proves the caller owns the address
-- they typed, and handing the token back in the RPC response skips that proof
-- entirely. Fixing it means moving the send server-side so the token never
-- reaches the browser. Tracked separately.
--
-- Verified after applying, as anon: claiming the memberless org refused with
-- ORG_NAME_TAKEN; claiming the in-use org refused; a genuine new signup worked.

-- Body as applied in migration approve_trial_fix_ambiguous_email_ref.

revoke all on function public.approve_trial_request(uuid) from public;
grant execute on function public.approve_trial_request(uuid) to anon, authenticated, service_role;
