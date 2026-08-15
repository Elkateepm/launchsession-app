# AGENTS.md — LaunchSession

Instructions for AI coding agents working in this repository. Read this before
making changes. The rules below are not style preferences; each one exists
because breaking it has caused a real failure.

---

## What this is

LaunchSession is a multi-tenant B2B2C SaaS platform for youth organisations,
charities and sports clubs. Every organisation's data is isolated from every
other organisation's. A bug that leaks one org's children, medical records or
safeguarding notes to another org is the worst thing that can happen here —
treat org scoping as the first consideration in any data change, not a
finishing check.

Stack: Create React App (React 19) · Supabase (Postgres + RLS) · Vercel ·
plain JS, no TypeScript · inline styles, no CSS framework.

---

## Hard constraints

**1. `CI=true npm run build` must pass before every push.**
CRA treats warnings as errors under `CI=true`, which is exactly how Vercel
builds it. A build that passes locally without `CI=true` can still fail the
deploy.

**2. Vercel Hobby plan allows 12 serverless functions. `api/` currently has
exactly 12.**
Do not add a file to `api/`. New backend functionality goes in as a branch
inside an existing handler — `api/send-form-email.js` is the usual host.
Adding a thirteenth file breaks the deploy for the whole project, not just the
new endpoint.

**3. Git commits must use a verified identity.**
```bash
git -c user.email="mohammed.elkateep@outlook.com" -c user.name="Elkateepm" commit -m "..."
```
An unverified email causes Vercel to mark the deployment `BLOCKED`. There is no
global git config in most working environments here, so pass it inline.

**4. Never commit secrets.**
No service role keys, tokens, or `.env` contents in source. The Supabase
service role key must never reach the client bundle.

---

## Database

Supabase project `ssahcqeqrxawmwtjpwvh` (org-facing app and Command Centre share it).

- **Schema changes go through `apply_migration`**, not `execute_sql` — migrations
  are recorded in history, ad-hoc SQL is not. Use `execute_sql` for reads and
  verification only.
- **Every table with org data carries `org_id`** and has RLS enabled. The
  established policy pattern is `org_id = get_my_org_id()` for reads and
  `org_id = get_my_org_id() and is_org_admin()` for writes. Follow it; do not
  invent a new scoping mechanism.
- **Test RLS before trusting it.** Inside a transaction:
  `set local role anon;` / `set local role authenticated;` then run the query.
- **Migrations must be additive on live tables.** Do not drop or retype a column
  that shipped code reads. Add the new column, migrate reads, remove later.

### Dates and timezones

The database runs UTC. The organisations are in the UK. Between midnight and
1am BST, `current_date` and `now()::date` return *yesterday*, which files
sessions and donations on the wrong day and makes them invisible in the app.

Always use:
```sql
(now() at time zone 'Europe/London')::date
```
In JS, format with `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' })`
rather than `toISOString().slice(0,10)`.

### Derived totals

Where a total can be recomputed from rows, compute it — do not let each screen
maintain it. `fundraising_campaigns.raised` is owned by a trigger
(`trg_donation_totals` → `recalc_campaign_raised`). Client code must never write
to it. The same reasoning applies to any future running total: a stored figure
is one refund or deleted row away from being wrong.

---

## Code conventions

- **Inline styles.** No Tailwind, no CSS modules. Colour and spacing tokens come
  from module-level constants (e.g. `LS` in `fundraising/fundraisingShared.js`).
- **Org branding.** Org-branded accents read from `org.primary_color` /
  `org.secondary_color`. Do not hardcode a brand colour.
- **Terminology.** Orgs rename core nouns ("young people" vs "members" vs
  "players"). Use `useTerms()` from `src/context/OrgContext` for any
  user-facing noun that varies by org type. Do not hardcode "child" or "session"
  in new UI.
- **Mobile first.** Most users are on phones. `useIsMobile()` from
  `src/hooks/useIsMobile`. Tap targets ≥ 44px. Test at 390px width.
- **No Realtime subscriptions.** Supabase Realtime crashes iOS WebKit in this
  app's usage. Poll instead, and pause polling when the tab is hidden.
- **No browser storage in artifacts/prototypes**, but `localStorage` is fine in
  the app itself.
- **Comments explain why, not what.** A comment restating the code is noise; a
  comment explaining a non-obvious constraint is what stops the next person
  reintroducing a bug.

---

## Locked flows

Two documents in the repo root describe flows that must not be changed casually:

- `AUTH_FLOW_LOCK.md` — landing → org search → login → dashboard. Do not bypass
  org search, do not default a user into an organisation.
- `TRIAL_FLOW_LOCK.md`

Read the relevant file before touching signup, login, org lookup or trials.

---

## Working practice

- **Surgical changes.** Change what was asked. Do not reformat, rename or
  "tidy" surrounding code — it buries the real diff and makes review impossible.
- **Verify, don't assume.** Run the build. Query the database to confirm a
  migration did what you intended. Report what you actually checked, and say
  plainly when something is unverified.
- **Syntax check before a full build** when iterating:
  `npx esbuild [file] --bundle=false --loader:.jsx=jsx --outfile=/dev/null`
- **On macOS, `touch` empties files.** Write files with a `python3 << 'PYEOF'`
  heredoc using raw strings, not `cat >` or `touch`.
- **Large edits to big files** (e.g. `Hub.jsx`) are more reliable via a `python3`
  inline `str.replace` script than a line-based edit tool.

### Parallel agents

More than one agent may be working in this repository at the same time, with no
awareness of each other. Both write to the same working tree, so simultaneous
edits to one file silently lose work.

State which files you are touching before you start. If another agent is active,
use a separate clone or `git worktree`.

---

## Branches in flight

Do not merge these to `main` without being asked.

- **`native/capacitor-shell`** — Capacitor iOS/Android wrapper. If your change
  touches auth, the app shell, or `public/`, say so: that branch needs `main`
  merged into it afterwards. Native push (APNs) is blocked on a paid Apple
  Developer account; service workers do not run in a Capacitor WebView.
- **`feat/risk-redesign`** — Risk Assessments redesign. Operational overview,
  guided hazard builder, dynamic updates and emergency view. Not merged.

Merged since: the Fundraising Hub (payment abstraction lives in
`src/services/paymentService.js` — no component may import Stripe or any
provider directly).

## Role model

`user_profiles.role` is one of `owner`, `admin`, `manager`, `staff`,
`volunteer`. RLS helpers:

- `is_org_admin()` — owner, admin
- `is_org_manager()` — owner, admin, manager
- `can_edit_risk()` — owner, admin, manager, staff

An org-scoped policy alone is **not** access control. `org_id =
get_user_org_id()` lets every member of the organisation write, including
volunteers, whatever the UI shows. Any table holding safety, safeguarding or
financial records needs a role predicate as well as an org predicate.

Where a rule concerns specific columns rather than whole rows — approval
fields, for instance — RLS cannot express it. Use a `BEFORE UPDATE` trigger;
see `trg_risk_guard_approval`.

---

## Before reporting a task done

1. `CI=true npm run build` passes.
2. `api/` still has 12 or fewer files.
3. New tables have RLS enabled and org-scoped policies.
4. No secrets in the diff.
5. Any date logic uses `Europe/London`.
6. You have said which files you changed.
