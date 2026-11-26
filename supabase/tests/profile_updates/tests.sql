-- Who may update which user_profiles rows, before and after
-- 20261126_profile_updates_staff_only.sql. Run with run.sh.
\set ON_ERROR_STOP on
\set QUIET on
begin;

-- ---- fixtures --------------------------------------------------------------
insert into public.organisations (id, slug) values
  ('a0000000-0000-0000-0000-000000000000', 'org-a'),
  ('b0000000-0000-0000-0000-000000000000', 'org-b');

create temp table who (name text primary key, id uuid, org uuid, role text, status text);
insert into who values
  ('owner_a',     '00000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000000', 'owner',     'active'),
  ('admin_a',     '00000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-000000000000', 'admin',     'active'),
  ('manager_a',   '00000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-000000000000', 'manager',   'active'),
  ('staff_a',     '00000000-0000-0000-0000-0000000000a4', 'a0000000-0000-0000-0000-000000000000', 'staff',     'active'),
  ('staff2_a',    '00000000-0000-0000-0000-0000000000a5', 'a0000000-0000-0000-0000-000000000000', 'staff',     'active'),
  ('vol_a',       '00000000-0000-0000-0000-0000000000a6', 'a0000000-0000-0000-0000-000000000000', 'volunteer', 'active'),
  ('pending_a',   '00000000-0000-0000-0000-0000000000a7', 'a0000000-0000-0000-0000-000000000000', 'volunteer', 'pending'),
  ('rejected_a',  '00000000-0000-0000-0000-0000000000a8', 'a0000000-0000-0000-0000-000000000000', 'volunteer', 'rejected'),
  ('invited_a',   '00000000-0000-0000-0000-0000000000a9', 'a0000000-0000-0000-0000-000000000000', 'volunteer', 'pending_invite'),
  ('parent_a',    '00000000-0000-0000-0000-0000000000aa', 'a0000000-0000-0000-0000-000000000000', 'parent',    'active'),
  ('susp_mgr_a',  '00000000-0000-0000-0000-0000000000ab', 'a0000000-0000-0000-0000-000000000000', 'manager',   'suspended'),
  ('super',       '00000000-0000-0000-0000-0000000000ac', 'a0000000-0000-0000-0000-000000000000', 'admin',     'active'),
  ('admin_b',     '00000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000000', 'admin',     'active'),
  ('manager_b',   '00000000-0000-0000-0000-0000000000b2', 'b0000000-0000-0000-0000-000000000000', 'manager',   'active');
insert into auth.users (id, email) select id, name || '@example.test' from who;
insert into public.user_profiles (id, email, org_id, full_name, role, status)
  select id, name || '@example.test', org, name, role, status from who;
insert into public.super_admins values ('00000000-0000-0000-0000-0000000000ac');

-- ---- harness ---------------------------------------------------------------
-- Runs one UPDATE as `actor` (null = service role) and always rolls it back.
-- 'ok' = exactly one row changed; 'blocked' = RLS filtered it or a guard raised.
create or replace function pg_temp.try(actor text, sql text) returns text
language plpgsql as $$
declare n int; outcome text;
begin
  begin
    if actor is null then
      execute 'set local role service_role';
    else
      perform set_config('request.jwt.claim.sub', (select id::text from who where name = actor), true);
      execute 'set local role authenticated';
    end if;
    execute sql;
    get diagnostics n = row_count;
    outcome := case when n = 1 then 'ok' else 'blocked' end;
    raise exception using errcode = 'P0420', message = outcome;
  exception
    when sqlstate 'P0420' then
      outcome := sqlerrm;
    when others then
      outcome := 'blocked: ' || sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  return outcome;
end $$;

create temp table cases (n serial, label text, actor text, sql text, before_fix text, after_fix text, got text, why text);

create or replace function pg_temp.upd(target text, sets text) returns text language sql as $$
  select format('update public.user_profiles set %s where id = %L', sets, (select id from who where name = target))
$$;

insert into cases (label, actor, sql, before_fix, after_fix) values
  -- the holes
  ('staff edits a colleague''s name',             'staff_a',    pg_temp.upd('staff2_a', 'full_name = ''x'''),        'ok',      'blocked'),
  ('staff edits a volunteer''s email',            'staff_a',    pg_temp.upd('vol_a', 'email = ''x@evil.test'''),     'ok',      'blocked'),
  ('staff edits the owner''s phone',              'staff_a',    pg_temp.upd('owner_a', 'phone = ''0'''),             'ok',      'blocked'),
  ('staff activates a pending volunteer',         'staff_a',    pg_temp.upd('pending_a', 'status = ''active'''),     'ok',      'blocked'),
  ('pending volunteer activates themself',        'pending_a',  pg_temp.upd('pending_a', 'status = ''active'''),     'ok',      'blocked'),
  ('rejected volunteer activates themself',       'rejected_a', pg_temp.upd('rejected_a', 'status = ''active'''),    'ok',      'blocked'),
  ('invited volunteer jumps to active',           'invited_a',  pg_temp.upd('invited_a', 'status = ''active'''),     'ok',      'blocked'),
  ('staff changes own status',                    'staff_a',    pg_temp.upd('staff_a', 'status = ''inactive'''),     'ok',      'blocked'),
  ('parent changes own status',                   'parent_a',   pg_temp.upd('parent_a', 'status = ''inactive'''),    'ok',      'blocked'),
  -- already refused before, still refused
  ('volunteer edits another volunteer',           'vol_a',      pg_temp.upd('pending_a', 'full_name = ''x'''),       'blocked', 'blocked'),
  ('parent edits a staff member',                 'parent_a',   pg_temp.upd('staff_a', 'phone = ''0'''),             'blocked', 'blocked'),
  ('staff changes a role',                        'staff_a',    pg_temp.upd('vol_a', 'role = ''admin'''),            'blocked', 'blocked'),
  ('staff approves a member',                     'staff_a',    pg_temp.upd('pending_a', 'approval_status = ''declined'''), 'blocked', 'blocked'),
  ('manager of another org edits a profile',      'manager_b',  pg_temp.upd('vol_a', 'full_name = ''x'''),           'blocked', 'blocked'),
  ('admin of another org changes a status',       'admin_b',    pg_temp.upd('pending_a', 'status = ''active'''),     'blocked', 'blocked'),
  ('manager suspends someone',                    'manager_a',  pg_temp.upd('vol_a', 'status = ''suspended'''),      'blocked', 'blocked'),
  ('volunteer suspends themself',                 'vol_a',      pg_temp.upd('vol_a', 'status = ''suspended'''),      'blocked', 'blocked'),
  ('suspended manager edits a volunteer',         'susp_mgr_a', pg_temp.upd('vol_a', 'full_name = ''x'''),           'blocked', 'blocked'),
  ('suspended manager restores themself',         'susp_mgr_a', pg_temp.upd('susp_mgr_a', 'status = ''active'''),    'blocked', 'blocked'),
  -- legitimate writes that must keep working
  ('own profile: name + phone (ProfilePage)',     'staff_a',    pg_temp.upd('staff_a', 'full_name = ''Me'', phone = ''1'''), 'ok', 'ok'),
  ('own profile: volunteer onboarding',           'pending_a',  pg_temp.upd('pending_a', 'full_name = ''Me'', availability = ''{"mon":true}'''), 'ok', 'ok'),
  ('own profile: onboarding_complete',            'admin_a',    pg_temp.upd('admin_a', 'onboarding_complete = true'), 'ok',     'ok'),
  ('own status unchanged in the SET list',        'pending_a',  pg_temp.upd('pending_a', 'status = ''pending'', phone = ''1'''), 'ok', 'ok'),
  ('accept invite: pending_invite -> pending',    'invited_a',  pg_temp.upd('invited_a', 'status = ''pending'', full_name = ''New'''), 'ok', 'ok'),
  ('manager accepts an application (status)',     'manager_a',  pg_temp.upd('pending_a', 'application_status = ''accepted'', status = ''active'''), 'ok', 'ok'),
  ('admin rejects an application (status)',       'admin_a',    pg_temp.upd('pending_a', 'application_status = ''rejected'', status = ''rejected'''), 'ok', 'ok'),
  ('owner edits a staff job title',               'owner_a',    pg_temp.upd('staff_a', 'job_title = ''Coach'''),     'ok',      'ok'),
  ('manager writes volunteer notes',              'manager_a',  pg_temp.upd('vol_a', 'application_notes = ''n'''),   'ok',      'ok'),
  ('manager sets DBS expiry',                     'manager_a',  pg_temp.upd('vol_a', 'dbs_expiry = ''2027-01-01'''), 'ok',      'ok'),
  ('manager approves a member',                   'manager_a',  pg_temp.upd('pending_a', 'approval_status = ''approved'''), 'ok', 'ok'),
  ('admin changes a role',                        'admin_a',    pg_temp.upd('vol_a', 'role = ''staff'''),            'ok',      'ok'),
  ('manager changes own status',                  'manager_a',  pg_temp.upd('manager_a', 'status = ''inactive'''),   'ok',      'ok'),
  ('super admin restores a suspended manager',    'super',      pg_temp.upd('susp_mgr_a', 'status = ''active'''),    'ok',      'ok'),
  ('service role activates a volunteer (api/)',   null,         pg_temp.upd('pending_a', 'status = ''active'''),     'ok',      'ok');

-- Phase is passed in by run.sh: before or after the migration.
update cases set why = pg_temp.try(actor, sql);
-- 0 rows means RLS hid the row; a message means a guard raised.
update cases set got = split_part(why, ':', 1),
                 why = case when why = 'blocked' then 'RLS: no row' else nullif(trim(substr(why, 9)), '') end;
select n, label, coalesce(actor, 'service role') as actor,
       case when :'phase' = 'before' then before_fix else after_fix end as expected, got,
       case when got = case when :'phase' = 'before' then before_fix else after_fix end then 'PASS' else 'FAIL' end as result,
       why
  from cases order by n;

do $$ begin
  if exists (select 1 from cases where got is distinct from
               case when current_setting('t.phase') = 'before' then before_fix else after_fix end) then
    raise exception 'profile update tests failed (%)', current_setting('t.phase');
  end if;
end $$;

rollback;
