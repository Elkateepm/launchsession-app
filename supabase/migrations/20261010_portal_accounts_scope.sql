-- Volunteer and parent accounts reach only what the volunteer portal needs.
--
-- module_access() waved portal roles through every module gate:
--
--   -- Portal roles: not governed by this layer at all.
--   when (select role from me) in ('volunteer','parent') then 'edit'
--
-- and most tables' own policies only check the organisation. So a volunteer's
-- login, used directly against the API rather than through the portal, could
-- read and change every child's record, every safeguarding concern and case,
-- mentoring notes, payments and the rest of their organisation's data. No
-- volunteer or parent accounts existed when this was found (10 Oct 2026), so
-- nothing was exposed; the volunteer portal would have created the first.
--
-- After this migration a portal account gets:
--   planner, registers, messaging, safeguarding, volunteers  -> module access
--   every other module                                       -> none
-- and, within those modules, only its own corner:
--   sessions             read only
--   session_staff        read; book or cancel itself before it is signed in;
--                        never change sign-in times, which are its hours
--   session_notes        read and add, on sessions it is on the team of
--   attendance (+ audit, corrections)   sessions it is on the team of
--   children             young people on sessions it is on the team of, read only
--   cause_for_concern    file one; never read or change concerns
--   cases and the rest of safeguarding  none
--   messages             threads for volunteers or everyone, volunteer
--                        threads for its sessions, and its own conversation
--                        with staff
--   volunteer_training / volunteer_attendance   its own rows
--   org_documents        documents shared with volunteers, read only
--   user_profiles        change only its own
--   invites, projects, templates, reflections and similar   none
--
-- Every restriction is a RESTRICTIVE policy that passes for anyone who is not
-- a portal account, so staff, managers, admins and owners are unaffected.

create or replace function public.is_portal_user()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((select role in ('volunteer', 'parent') from public.user_profiles where id = auth.uid()), false)
$$;

-- Sessions the caller is on the team of. SECURITY DEFINER so the policies on
-- session_staff are not re-entered from inside other tables' policies.
-- Threads a portal account may read: for volunteers or everyone, its own
-- conversation with staff, and volunteer threads for sessions it is on.
create or replace function public.portal_can_see_thread(p_audience text, p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_audience in ('volunteers', 'general', 'dm:' || auth.uid()::text)
      or (p_audience = 'event_volunteers' and p_session_id in (select session_id from public.session_staff where user_id = auth.uid()))
$$;

create or replace function public.my_team_session_ids()
returns setof uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select session_id from public.session_staff where user_id = (select auth.uid())
$$;

revoke all on function public.is_portal_user() from public, anon;
revoke all on function public.my_team_session_ids() from public, anon;
revoke all on function public.portal_can_see_thread(text, uuid) from public, anon;
grant execute on function public.portal_can_see_thread(text, uuid) to authenticated;
grant execute on function public.is_portal_user() to authenticated;
grant execute on function public.my_team_session_ids() to authenticated;

-- 1. The module layer: the portal's modules only.
create or replace function public.module_access(p_module text)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with me as (
    select id, org_id, role from public.user_profiles where id = auth.uid()
  )
  select case
    when (select role from me) is null then 'none'
    when (select role from me) in ('owner','admin') then 'edit'
    -- Portal roles: the modules the volunteer portal uses, each narrowed to
    -- the account's own rows by the policies below. Nothing else.
    when (select role from me) in ('volunteer','parent') then
      case when p_module in ('planner', 'registers', 'messaging', 'safeguarding', 'volunteers') then 'edit' else 'none' end
    else coalesce(
      (select g.level from public.module_access_grants g, me
        where g.user_id = me.id and g.org_id = me.org_id and g.module_key = p_module),
      (select d.level from public.module_access_defaults d, me
        where d.org_id = me.org_id and d.role = me.role and d.module_key = p_module),
      public.module_access_legacy_default((select role from me), p_module)
    )
  end;
$$;

-- 2. Within those modules, the account's own corner.
--
-- Each check is wrapped in a sub-select so Postgres runs it once per query,
-- not once per row.

-- sessions: read only.
drop policy if exists "portal accounts: sessions read only" on public.sessions;
create policy "portal accounts: sessions read only" on public.sessions
  as restrictive for all to authenticated
  using (true)
  with check (not (select public.is_portal_user()));
drop policy if exists "portal accounts: sessions no delete" on public.sessions;
create policy "portal accounts: sessions no delete" on public.sessions
  as restrictive for delete to authenticated
  using (not (select public.is_portal_user()));

-- session_staff: book and cancel itself, nothing else. No updates at all: the
-- sign-in and sign-out times on this row are the volunteer's hours.
drop policy if exists "portal accounts: session_staff own booking" on public.session_staff;
create policy "portal accounts: session_staff own booking" on public.session_staff
  as restrictive for insert to authenticated
  with check (not (select public.is_portal_user())
    or (user_id = (select auth.uid()) and role = 'volunteer' and signed_in_at is null and signed_out_at is null));
drop policy if exists "portal accounts: session_staff no updates" on public.session_staff;
create policy "portal accounts: session_staff no updates" on public.session_staff
  as restrictive for update to authenticated
  using (not (select public.is_portal_user()));
drop policy if exists "portal accounts: session_staff cancel own" on public.session_staff;
create policy "portal accounts: session_staff cancel own" on public.session_staff
  as restrictive for delete to authenticated
  using (not (select public.is_portal_user()) or (user_id = (select auth.uid()) and signed_in_at is null));

-- session_notes: the sessions it is on.
drop policy if exists "portal accounts: session_notes own sessions" on public.session_notes;
create policy "portal accounts: session_notes own sessions" on public.session_notes
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or session_id in (select public.my_team_session_ids()))
  with check (not (select public.is_portal_user()) or (session_id in (select public.my_team_session_ids()) and created_by = (select auth.uid())));
drop policy if exists "portal accounts: session_notes no edits" on public.session_notes;
create policy "portal accounts: session_notes no edits" on public.session_notes
  as restrictive for update to authenticated
  using (not (select public.is_portal_user()));
drop policy if exists "portal accounts: session_notes no delete" on public.session_notes;
create policy "portal accounts: session_notes no delete" on public.session_notes
  as restrictive for delete to authenticated
  using (not (select public.is_portal_user()));

-- The register: sessions it is on. Signing young people in and out is what a
-- volunteer on the door does; deleting attendance is not.
drop policy if exists "portal accounts: attendance own sessions" on public.attendance;
create policy "portal accounts: attendance own sessions" on public.attendance
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or session_id in (select public.my_team_session_ids()))
  with check (not (select public.is_portal_user()) or session_id in (select public.my_team_session_ids()));
drop policy if exists "portal accounts: attendance no delete" on public.attendance;
create policy "portal accounts: attendance no delete" on public.attendance
  as restrictive for delete to authenticated
  using (not (select public.is_portal_user()));

drop policy if exists "portal accounts: attendance audit own sessions" on public.attendance_audit_log;
create policy "portal accounts: attendance audit own sessions" on public.attendance_audit_log
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or session_id in (select public.my_team_session_ids()))
  with check (not (select public.is_portal_user()) or session_id in (select public.my_team_session_ids()));

drop policy if exists "portal accounts: attendance corrections own sessions" on public.attendance_corrections;
create policy "portal accounts: attendance corrections own sessions" on public.attendance_corrections
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or session_id in (select public.my_team_session_ids()))
  with check (not (select public.is_portal_user()) or session_id in (select public.my_team_session_ids()));

-- Young people: those on its sessions' registers, read only. The register
-- needs names, allergies and medical flags; the directory is not theirs.
drop policy if exists "portal accounts: children on own sessions" on public.children;
create policy "portal accounts: children on own sessions" on public.children
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or exists (
    select 1 from public.attendance a
    where a.child_id = children.id and a.session_id in (select public.my_team_session_ids())))
  with check (not (select public.is_portal_user()));

-- Safeguarding: a volunteer can raise a concern and that is all. Reading
-- concerns, and every case table, stays with the people who handle them.
drop policy if exists "portal accounts: concerns file only" on public.cause_for_concern;
create policy "portal accounts: concerns file only" on public.cause_for_concern
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()))
  with check (not (select public.is_portal_user()) or submitted_by = (select auth.uid()));
-- (An insert is checked against WITH CHECK only. The portal files a concern
-- without reading it back, which this policy would refuse.)

-- Messages: threads for volunteers or everyone, and its own thread with staff.
drop policy if exists "portal accounts: message threads" on public.message_threads;
create policy "portal accounts: message threads" on public.message_threads
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or public.portal_can_see_thread(audience, session_id))
  with check (not (select public.is_portal_user()) or audience = 'dm:' || (select auth.uid())::text);
drop policy if exists "portal accounts: message threads no delete" on public.message_threads;
create policy "portal accounts: message threads no delete" on public.message_threads
  as restrictive for delete to authenticated
  using (not (select public.is_portal_user()));

drop policy if exists "portal accounts: messages in own threads" on public.message_thread_messages;
create policy "portal accounts: messages in own threads" on public.message_thread_messages
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or exists (
    select 1 from public.message_threads t
    where t.id = message_thread_messages.thread_id and public.portal_can_see_thread(t.audience, t.session_id)))
  with check (not (select public.is_portal_user()) or (sender_id = (select auth.uid()) and exists (
    select 1 from public.message_threads t
    where t.id = message_thread_messages.thread_id and public.portal_can_see_thread(t.audience, t.session_id))));
drop policy if exists "portal accounts: messages no edits" on public.message_thread_messages;
create policy "portal accounts: messages no edits" on public.message_thread_messages
  as restrictive for update to authenticated
  using (not (select public.is_portal_user()));
drop policy if exists "portal accounts: messages no delete" on public.message_thread_messages;
create policy "portal accounts: messages no delete" on public.message_thread_messages
  as restrictive for delete to authenticated
  using (not (select public.is_portal_user()));

drop policy if exists "portal accounts: own pins" on public.message_thread_pins;
create policy "portal accounts: own pins" on public.message_thread_pins
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or user_id = (select auth.uid()))
  with check (not (select public.is_portal_user()) or user_id = (select auth.uid()));
drop policy if exists "portal accounts: own reactions" on public.message_reactions;
create policy "portal accounts: own reactions" on public.message_reactions
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or user_id = (select auth.uid()))
  with check (not (select public.is_portal_user()) or user_id = (select auth.uid()));

-- Its own training records and logged hours.
drop policy if exists "portal accounts: own training" on public.volunteer_training;
create policy "portal accounts: own training" on public.volunteer_training
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or volunteer_id = (select auth.uid()))
  with check (not (select public.is_portal_user()) or volunteer_id = (select auth.uid()));
drop policy if exists "portal accounts: own volunteer attendance" on public.volunteer_attendance;
create policy "portal accounts: own volunteer attendance" on public.volunteer_attendance
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or volunteer_id = (select auth.uid()))
  with check (not (select public.is_portal_user()) or volunteer_id = (select auth.uid()));

-- Documents shared with volunteers, read only.
drop policy if exists "portal accounts: shared documents read only" on public.org_documents;
create policy "portal accounts: shared documents read only" on public.org_documents
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()) or visible_to in ('volunteers', 'all'))
  with check (not (select public.is_portal_user()));

-- Its own profile only.
drop policy if exists "portal accounts: own profile only" on public.user_profiles;
create policy "portal accounts: own profile only" on public.user_profiles
  as restrictive for update to authenticated
  using (not (select public.is_portal_user()) or id = (select auth.uid()))
  with check (not (select public.is_portal_user()) or id = (select auth.uid()));

-- Inside the portal's modules but nothing to do with it.
do $$
declare t text;
begin
  foreach t in array array[
    -- planner
    'session_tasks', 'session_templates', 'projects', 'project_participants', 'project_reflections',
    'project_staff', 'annotations', 'session_follow_up_actions', 'session_reflections',
    -- registers
    'deleted_register_audit',
    -- messaging
    'newsletters', 'newsletter_lists', 'newsletter_recipients', 'newsletter_unsubscribes', 'sms_messages', 'sms_opt_outs',
    -- safeguarding
    'cases', 'case_audit_log', 'case_documents', 'case_events', 'case_notes', 'case_tasks',
    'safeguarding_audit_log', 'safeguarding_documents',
    -- volunteers
    'volunteers', 'volunteer_applications', 'volunteer_broadcasts', 'volunteer_recognition', 'session_volunteer_slots',
    -- outside any module gate, open to the whole organisation
    'admin_invites', 'organisation_invites', 'import_templates', 'locations', 'internal_mail', 'internal_mail_recipients'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "portal accounts: none" on public.%I', t);
      execute format('create policy "portal accounts: none" on public.%I as restrictive for all to authenticated using (not (select public.is_portal_user())) with check (not (select public.is_portal_user()))', t);
    end if;
  end loop;
end $$;

-- 3. Certificates. The portal's Upload a certificate wrote to the
-- safeguarding-docs bucket, where only admins may write, so it always failed.
-- A volunteer may now add files to its own folder there, and read them back;
-- admins keep reading everything as before.
drop policy if exists "Members upload own certificates" on storage.objects;
create policy "Members upload own certificates" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'safeguarding-docs'
    and (storage.foldername(name))[1] = 'certificates'
    and (storage.foldername(name))[2] = public.get_my_org_id()::text
    and (storage.foldername(name))[3] = auth.uid()::text
  );
drop policy if exists "Members read own certificates" on storage.objects;
create policy "Members read own certificates" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'safeguarding-docs'
    and (storage.foldername(name))[1] = 'certificates'
    and (storage.foldername(name))[2] = public.get_my_org_id()::text
    and (storage.foldername(name))[3] = auth.uid()::text
  );
