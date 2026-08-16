-- Session rostering could only ever see people who hold a login.
--
-- SessionWizard read user_profiles directly:
--   .from('user_profiles').select('id, full_name').in('role', ['admin','staff'])
--
-- HR, since the consolidation, holds staff records with no account at all --
-- sessional coaches, bank staff, anyone invited but not yet signed up. Those
-- people were invisible to session creation entirely. On Solidarity Sports the
-- wizard offered 2 people while HR listed 8. That is the same
-- accounts-vs-records split the consolidation set out to close, still open on
-- this screen.
--
-- hr_staff_directory() cannot be reused here. It is admin-only by design
-- because it returns DBS dates, training expiry and leave allowance, whereas
-- session creation is not admin-only. Reusing it would either break for
-- staff-role planners or hand them colleagues' HR records.
--
-- So: a narrower rostering view. It answers only what rostering needs -- who
-- exists, can they actually be assigned, and is there a reason to pause --
-- and returns a compliance STATE rather than the underlying dates, so a
-- staff-role planner learns "checks expired" without gaining the record.
--
-- People with no account are returned with user_id null and are shown in the
-- picker but not selectable. That is a data-model fact, not a UI choice:
-- sessions.lead_staff_id references user_profiles(id) and
-- session_staff.user_id references auth.users(id), so an accountless person
-- genuinely cannot be stored against a session. Better to show them greyed
-- with "No account yet" than to omit them and leave the planner wondering
-- where the coach they just added in HR went.
--
-- compliance_state_for() mirrors complianceState() in HRCentre.jsx (expired
-- below zero days, expiring within 30) and grades worst-state-wins across DBS,
-- safeguarding and first aid -- so someone whose first aid has lapsed reads as
-- expired even while their DBS is merely approaching expiry. One definition,
-- so the picker and the HR screens cannot drift.
--
-- Verified after applying: staff-role user gets 10 rows; staff-role is still
-- blocked from hr_staff_directory(); anon is blocked from both.

-- Bodies as applied in migrations compliance_state_helper and
-- session_assignable_staff_rpc.

revoke all on function public.compliance_state_for(text, date, date, date) from public;
grant execute on function public.compliance_state_for(text, date, date, date) to authenticated, service_role;

revoke all on function public.session_assignable_staff() from public;
grant execute on function public.session_assignable_staff() to authenticated;
