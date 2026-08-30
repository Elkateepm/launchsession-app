-- Three SECURITY DEFINER functions were callable by anon while performing no
-- caller check of their own. Being DEFINER, they run with the owner's
-- privileges and bypass RLS entirely.
--
--   notify_users(p_org_id, p_user_ids, ...) inserts straight into
--   notifications for any organisation and any users, with a caller-supplied
--   title, body and target_url. An unauthenticated caller could place a
--   notification carrying an arbitrary link into a charity's notification
--   centre -- a credible phishing route into an app whose users handle
--   children's records. Legitimate callers are the trg_notify_* trigger
--   functions and api/send-form-email.js on the service key. Trigger functions
--   are themselves DEFINER and owned by postgres, so they are unaffected.
--
--   delete_session_for_retention(p_session_id) deletes a session and its
--   dependents with no authorisation check. Called only by
--   api/send-form-email.js via the admin client. Session ids are UUIDs and so
--   not practically guessable, but that is obscurity rather than a control.
--
--   check_user_in_org(p_email, p_org_id) answers whether an address belongs to
--   an organisation. Unreferenced in the application, and as an anon-callable
--   oracle it answers "does this person work for this charity" for any address.
--   Revoked rather than dropped, in case an external caller exists.
--
-- Note on the first attempt, which was a no-op: Postgres grants EXECUTE to
-- PUBLIC by default when a function is created, so revoking from anon and
-- authenticated leaves that default in place and both roles still resolve
-- EXECUTE through PUBLIC. The grant must be removed from PUBLIC itself, then
-- re-granted to the roles that need it. Worth remembering for every other
-- DEFINER function in this schema.

revoke execute on function public.notify_users(uuid, uuid[], text, text, text, text, text, text) from public, anon, authenticated;
grant  execute on function public.notify_users(uuid, uuid[], text, text, text, text, text, text) to service_role;

revoke execute on function public.delete_session_for_retention(uuid) from public, anon, authenticated;
grant  execute on function public.delete_session_for_retention(uuid) to service_role;

revoke execute on function public.check_user_in_org(text, uuid) from public, anon, authenticated;
grant  execute on function public.check_user_in_org(text, uuid) to service_role;
