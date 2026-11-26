# user_profiles update tests

`./run.sh` starts a throwaway local Postgres 16 (port 54998, or `PGPORT_TEST`),
loads `bootstrap.sql`, runs `tests.sql` against the old policy, applies
`../../migrations/20261126_profile_updates_staff_only.sql` twice, checks no
grant changed, then runs `tests.sql` again. It never connects to Supabase.

`bootstrap.sql` is a copy of the live `user_profiles` slice (table, policies,
org helpers, guard triggers) taken on 26 Nov 2026. The repo's migrations can't
be replayed from empty because the base schema was never committed, so if any
of those live definitions change, refresh this file from
`pg_get_functiondef` / `pg_policies` before trusting the run.

Each case runs one UPDATE as a given login and rolls it back. `ok` means one
row changed; `blocked` means RLS hid the row or a guard raised (the `why`
column says which). Every case has an expected result for before and after.
