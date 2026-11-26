# Migrations

Schema for this project has historically been applied directly to Supabase
rather than committed here, which means a fresh environment or a restored
database cannot reproduce it. That gap was flagged in review: `PublicForm`
calls RPCs that exist only in the live project.

Migrations for the Forms redesign are captured below. Anything applied from here
on should land in this folder at the same time it is applied.

Applied to project `ssahcqeqrxawmwtjpwvh`, in order:

- `20260815_forms_redesign_schema.sql`
- `20260815_forms_public_access.sql`

Storage bucket hardening, applied 18 Aug 2026:

- `20260818_private_gallery_bucket_org_scoped.sql`
- `20260818_private_staff_photos_bucket_org_scoped.sql`

Both were applied to the live project before being written here, which is the
exact gap this README warns about. They are captured now and are idempotent
enough to re-run: the bucket updates are no-ops if already applied, and the
policy drops use `if exists`. The `create policy` statements will fail on a
second run, so a fresh environment applies them once.

RLS review fixes, applied 19 Aug 2026:

- `20260819_close_role_escalation_and_anon_invite_holes.sql`

Earlier work (Fundraising, Risk Assessments, sidebar) was applied directly and
is not yet captured. Those migrations are additive and already live; they should
be exported here when there is a reason to touch them.

Per-member module access, applied 20 Aug 2026:

- `20260820173447_module_access_layer_schema.sql`
- `20260820173528_module_access_escalation_guard_and_rls.sql`

Both were written here at the same time they were applied. The resolver
(`module_access(module_key)`) falls back to the pre-feature role behaviour when
no template or grant row exists, so applying these two files alone changes
nothing about who can reach what.

Module access RLS enforcement, applied 20 Aug 2026:

- `20260820174217_module_access_legacy_default_is_permissive.sql`
- `20260820174243_module_access_rls_gates_all_modules.sql`

The gate was applied live in two steps (`..._all_modules` then
`..._split_per_command`) because the first version let a `view`-level member
DELETE. The file here is the corrected end state and is the only one a fresh
environment needs; there is deliberately no separate file for the correction.


Founding admins skip approval, applied 7 Oct 2026:

- `20261007_founding_admin_skips_approval.sql`

The full definition of `claim_invite_profile()`, which until now existed only
in the live project. An owner or admin invite into an organisation with no
approved owner, admin or manager is approved on claim, because nobody could
ever approve it. The same file approves the one account already stranded that
way.

Deleting a login keeps its records, applied 15 Nov 2026:

- `20261115_user_delete_keeps_records.sql`

Deleting a user failed whenever they were linked to a session, case, risk
assessment, safeguarding record, injury report or HR record: 32 attribution
foreign keys had no ON DELETE action, and `hr_staff_user_org_fk` nulled its
NOT NULL `org_id`. Those keys now clear just the person's id, and four triggers
(`touch_child_injury`, `assert_session_planner`, `trg_risk_guard_approval`,
`notify_session_created_or_edited`) let that cleared id through only when the
login no longer exists (`user_account_removed()`). Tested on the live project
in a rolled-back transaction, deleting through both `delete_auth_user` and a
plain service-role delete, before it was applied.

Command Centre lockdown, applied 18 Nov 2026:

- `20261118_command_centre_lockdown.sql`

Org admins can no longer write global templates (an org admin could publish a
template to every organisation by setting `is_global`). Adds
`admin_delete_organisation(p_org_id)`, super admins only, which deletes an
organisation in one transaction (every FK to organisations cascades;
`child_injuries` is cleared first because its FK to `children` is RESTRICT),
removes its signup record and its members' logins, and keeps the logins of
super admins and platform users. Tested in a rolled-back transaction by
deleting Solidarity Sports as the super admin and trying both changes as a
Livity Youth Edinburgh admin.

Suspend blocks access, applied 18 Nov 2026:

- `20261118_suspend_blocks_access.sql`

Command Centre's Suspend buttons set `user_profiles.status` or
`organisations.status` to `suspended`, which nothing read. A person is now
blocked when their profile or their organisation is suspended: Supabase Auth
refuses their login (`banned_until` set to the 2999-01-01 sentinel), their
sessions are deleted, and the org-scope helpers (`get_my_org_id`,
`get_user_org_id`, `get_admin_org_id`, `is_org_admin`, `is_org_manager`) answer
NULL for them. Restoring to `active` lifts only the sentinel ban. Super admins
and platform users are never blocked. Only the service role or a super admin
can move a profile into or out of `suspended` (`trg_guard_profile_suspension`).
`my_access_block()` tells the app why. Nine policies still look up the org
inline (newsletters, volunteer broadcasts/recognition/training, admin invites);
for those the ban and session sign-out are the block. Tested in a rolled-back
transaction (person and organisation suspend/restore, guard, super admin kept,
existing bans kept, nobody else touched) before it was applied.

Command Centre account health, applied 18 Nov 2026:

- `20261118_command_centre_health.sql`

Two read-only functions for the redesigned Command Centre, super admins only:
`admin_org_health()` (per organisation: members, awaiting approval, pending
invites and the oldest one, children, sessions in total / last 30 days /
upcoming, last session date, last sign-in by a non-platform member, attendance
in the last 30 days) and `admin_list_users()` (every profile with its
organisation and last sign-in). Tested as the super admin and refused for an
organisation admin in a rolled-back transaction.

Account health for the LaunchNexus summary, applied 24 Nov 2026:

- `20261124_org_health_for_nexus_summary.sql`

`admin_org_health()` now also answers the service role, so Command Centre's
read-only `api/nexus-summary` endpoint (launch-session repo) can build the
summary the LaunchNexus admin shows. The service role could already read every
table behind it; everyone else is still refused unless they are a super admin.

Reports & Insights, applied 25 Nov 2026 (recorded as version 20261125013449):

- `20261125_report_insights_metrics.sql`

`report_insights_metrics(p_from, p_to, p_project_ids, p_groups)`: totals for a
period and the one of the same length before it, a weekly or monthly series,
breakdowns by project, group, location and age band, and the names of
projects and groups for the filter pickers. Org from `get_my_org_id()`,
Europe/London dates, aggregates only; safeguarding counts for owners and
admins alone. Execute revoked from public and anon, granted to authenticated.
Tested offline against a local Postgres with two organisations (56
assertions: figures, filters, another org's project ids and group names
matching nothing, staff seeing no safeguarding, anon refused, suspended login
refused), then compiled and run against the live schema inside a transaction
that always aborts. After applying: security definer, stable, anon refused
(42501), authenticated allowed; an admin of the largest organisation gets
figures in about 100 ms, and another organisation's project id returns
nothing. Live has no non-admin login, so the staff path rests on the local
tests. If the function is ever missing, the app falls back to the per-report
functions above: monthly figures, no filters, no volunteer hours.

Session delivery report as a period snapshot, applied 26 Nov 2026 (recorded as version 20261126000246):

- `20261126_report_delivery_snapshot.sql`

Replaces `report_delivery_metrics`. Hours for a session that ends after
midnight were negative (23:00 to 01:30 counted as -21.5h, printing "-14h" for a
month); they now count end + 24h - start. Adds the days and times sessions
ran, the best attended sessions (titles only), register completion, team
size, sessions in projects, multi-day sessions and cancellation reasons.
Every existing key keeps its meaning. Org from `get_my_org_id()` (refuses a
suspended login); execute revoked from anon. Tested offline (25 assertions,
anon and suspended refused) and compared old against new on live inside a
block that always aborts: same sessions and months, hours 71 -> 95 for 28 Aug
to 25 Nov for the largest organisation, November -14h -> 10h. Verified after
applying: same figures, no negative month, anon refused (42501), service role
and signed-in users still allowed.

Report functions refuse a suspended login, applied 26 Nov 2026 (recorded as version 20261126001518):

- `20261126_report_functions_refuse_suspended.sql`

The nine older `report_*` functions (attendance, funder, impact, overview,
project, safeguarding, session learning, workforce, young people) found the
org with their own `user_profiles` lookup, which ignores suspension. Each is
re-created from its own live definition with that one statement replaced by
`public.get_my_org_id()`; execute is revoked from anon. Proved on live in a
block that always aborts: every body changed in that statement only (9/9),
and all 54 outputs (6 logins x 9 functions, last 12 months) were identical
before and after; anon off, signed-in users and the service role still on.
Verified after applying: 9/9 use the helper with no old lookup left, all 54
calls by real logins succeed, and anon calls are refused (42501).


Only staff edit other people's profiles, and only staff change a status, applied 26 Nov 2026 (recorded as version 20261126234541):

- `20261126_profile_updates_staff_only.sql`

"update profiles" now passes for your own row, or for a row in your
organisation when you are an owner, admin or manager. The new
`guard_profile_status` trigger refuses a status change unless it comes from the
service role, `claim_invite_profile`, a super admin or platform user, or an
owner/admin/manager of that organisation; the one self-service change left is
`pending_invite` -> `pending` (accepting a volunteer invite). Tested offline
with `supabase/tests/profile_updates/run.sh`: 34 cases before (the holes
reproduce) and after, with grants unchanged.
Verified live after applying: the new policy and trigger are in place, table
grants are unchanged, and in a block that always aborts the invited volunteer
was refused `active`, allowed `pending`, and could not touch an admin's row.
