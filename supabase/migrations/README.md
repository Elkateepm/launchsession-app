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

Earlier work (Fundraising, Risk Assessments, sidebar) was applied directly and
is not yet captured. Those migrations are additive and already live; they should
be exported here when there is a reason to touch them.
