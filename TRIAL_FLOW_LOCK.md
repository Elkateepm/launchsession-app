# LaunchSession Trial Flow Lock

Landing / Packages -> Start Free 14-Day Trial -> Signup form -> create_trial_signup()
-> trial_requests row -> approve_trial_request() -> organisation created with
plan `trial`, modules = default_modules_for_org_type(), trial_expires_at = now()
+ 14 days -> invite email -> Create Password -> dashboard.

No card is taken at any point before the organisation chooses a plan. The
marketing pages say "no card required" and the signup flow must keep that true.

## While the trial runs

- `isTrialActive(org)` in `src/lib/moduleAccess.js` grants every module,
  whatever `organisations.modules` says -- "not suggested for your organisation
  type" is not the same as "you must pay for this".
- A trial with a null `trial_expires_at` is treated as **still running**, in
  both the client and `org_write_locked()`. Some organisations predate the
  column. Do not "fix" this by locking them out.
- `TrialBanner` counts the days down, and turns urgent at 3 days left.

## When it ends

The organisation becomes **read-only**, it is not deleted and not suspended:

- `org_write_locked(org_id)` in Postgres is the enforcement. The
  `trg_org_write_lock` trigger on every org-scoped table refuses writes from
  the `authenticated` role. service_role, the SECURITY DEFINER functions and
  anon (public forms) are exempt -- see the migration for why.
- `isPlanEnded(org)` is the client mirror of that function. It exists to
  explain the block, not to be the block. **If you change one, change both.**
- `PlanEndedWall` covers the app, except over Settings -- that is where the
  plan is chosen, so walling it would be a trap. It is dismissible on purpose:
  an unpaid organisation still owns its safeguarding records, and a DSL must be
  able to read a concern during an incident whatever the billing says.
- `past_due` does **not** lock. Stripe retries a failed card for about two
  weeks and only then moves the subscription to `unpaid`/`canceled`.

## Converting

`Settings -> Billing` posts to `/api/create-checkout-session` with a plan and a
cycle. An organisation that subscribes partway through its trial keeps the
remaining days (`subscription_data.trial_end`); Stripe requires that to be at
least 48 hours out, below which billing simply starts immediately.

Plans, prices and the modules each one buys live in `public.plan_entitlements`,
not in code. `api/stripe-webhook.js` reads that table to set
`organisations.modules` when a subscription changes, which is what makes a
downgrade actually remove access.
