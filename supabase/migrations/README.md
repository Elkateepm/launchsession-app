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
