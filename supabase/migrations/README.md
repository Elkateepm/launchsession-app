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
