-- Rate limiting for unauthenticated endpoints, and removal of anon's direct
-- write on trial_requests.
--
-- 1. rate_limit_events + check_rate_limit()
--    A single shared primitive, so each public endpoint stops inventing its own
--    counter. In the database rather than in memory because Vercel functions
--    are per-invocation and share no state. RLS on, no policies, service_role
--    only -- callers reach it exclusively through definer functions.
--    Sweeps rows older than 24h on each call, so it needs no cron.
--
-- 2. Signup limits, inside create_trial_signup:
--      signup:email:<address>  3 per hour
--      signup:global          30 per 10 minutes
--    Postgres cannot see the caller's IP, so these bound what IS visible here:
--    repeat attempts from one address, and total org-creation rate. The
--    per-email check runs FIRST, so one abusive address cannot exhaust the
--    global allowance and lock out genuine signups.
--    Neither replaces an edge/WAF rule for distributed abuse; together they
--    turn "unlimited orgs, instantly" into something bounded and alertable.
--
-- 3. passkey_auth_options (api/send-form-email.js) uses the same primitive at
--    20 per 5 minutes, keyed on a SHA-256 prefix of the client IP. The raw
--    address is never stored. That endpoint sits above the auth check by
--    design, and the origin allowlist is not a defence -- a non-browser client
--    can simply send an allowed Origin header.
--
-- 4. anon's direct INSERT on trial_requests is removed. The client now goes
--    through create_trial_signup, which is SECURITY DEFINER and bypasses RLS,
--    so the direct path was unused -- and it was the weaker one: one policy had
--    'with_check (true)', accepting any row at all; the other checked three
--    columns for NOT NULL and nothing else. No email format, no length bound,
--    no terms check. Every signup now goes through the validated function.
--
-- Verified as anon after applying: direct INSERT blocked, direct SELECT
-- blocked, signup via RPC works, bad email rejected, missing terms rejected,
-- and the 4th signup from one address blocked.

create table if not exists public.rate_limit_events (
  id         bigserial primary key,
  bucket     text        not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_bucket_time_idx
  on public.rate_limit_events (bucket, created_at desc);

alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;

-- check_rate_limit / create_trial_signup bodies are as applied in migrations
-- shared_rate_limiter and signup_rate_limits.

drop policy if exists "Anyone can submit trial request" on public.trial_requests;
drop policy if exists "public can create trial requests" on public.trial_requests;
revoke insert, select, update, delete on public.trial_requests from anon;
