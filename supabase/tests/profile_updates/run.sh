#!/usr/bin/env bash
# Throwaway local Postgres: bootstrap the live user_profiles slice, run the
# cases against the old policy (they must show the holes), apply the
# migration twice (it must be re-runnable), run the cases again.
#   supabase/tests/profile_updates/run.sh
# Needs Postgres 16 binaries on PATH (brew install postgresql@16). Never
# touches the live project.
set -euo pipefail
export LC_ALL=C LANG=C
here="$(cd "$(dirname "$0")" && pwd)"
migration="$here/../../migrations/20261126_profile_updates_staff_only.sql"
port="${PGPORT_TEST:-54998}"
dir="$(mktemp -d)"
trap 'pg_ctl -D "$dir/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$dir"' EXIT

initdb -D "$dir/data" -U postgres -A trust >/dev/null
pg_ctl -D "$dir/data" -l "$dir/log" -o "-p $port -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -w start >/dev/null
psql_() { psql -X -q -h 127.0.0.1 -p "$port" -U postgres -v ON_ERROR_STOP=1 "$@"; }
psql_ -d postgres -c 'create database t' >/dev/null
psql_ -d t -f "$here/bootstrap.sql" >/dev/null

echo "== before the migration (holes expected) =="
PGOPTIONS="-c t.phase=before" psql_ -d t -v phase=before -f "$here/tests.sql"

grants="select grantee||':'||privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='user_profiles' union all select proname||':'||coalesce(proacl::text,'') from pg_proc where pronamespace='public'::regnamespace and proname <> 'guard_profile_status' order by 1"
before_grants="$(psql_ -d t -At -c "$grants")"
psql_ -d t -f "$migration" >/dev/null 2>"$dir/migration.err" || { cat "$dir/migration.err"; exit 1; }
psql_ -d t -f "$migration" >/dev/null
[ "$before_grants" = "$(psql_ -d t -At -c "$grants")" ] || { echo "FAIL: grants changed"; exit 1; }
echo "== grants on user_profiles and existing functions unchanged =="
psql_ -d t -At -c "select 'guard_profile_status acl: '||coalesce(proacl::text,'') from pg_proc where proname='guard_profile_status'"

echo "== after the migration =="
PGOPTIONS="-c t.phase=after" psql_ -d t -v phase=after -f "$here/tests.sql"
echo "ALL PASS"
