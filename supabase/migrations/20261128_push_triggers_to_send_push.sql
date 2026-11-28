-- Database triggers send their pushes to the send-push Edge Function instead
-- of the Vercel API. Apply only once send-push reports {"configured": true}
-- (VAPID keys set as Edge Function secrets); until then it refuses to send.
--
-- Only the URL changes. The body keeps type 'db_event_push' and the same
-- x-db-event-secret header, which send-push checks against the vault via
-- verify_db_event_secret(). Rewriting the live definitions rather than
-- restating them keeps everything else in these functions exactly as it is.
--
-- To roll back, run the same block with the two URLs swapped.

do $$
declare
  fn text;
  def text;
  old_url constant text := 'https://app.launchsession.co.uk/api/send-form-email';
  new_url constant text := 'https://ssahcqeqrxawmwtjpwvh.supabase.co/functions/v1/send-push';
begin
  foreach fn in array array[
    'notify_session_created_or_edited',
    'trg_notify_session_closed',
    'trg_notify_child_registration',
    'trg_notify_role_escalation'
  ] loop
    def := pg_get_functiondef(format('public.%I()', fn)::regprocedure);
    if position(old_url in def) = 0 then
      raise exception '%: expected the send-form-email URL, found none -- not rewriting', fn;
    end if;
    if position('''db_event_push''' in def) = 0 then
      raise exception '%: does not send db_event_push -- not rewriting', fn;
    end if;
    execute replace(def, old_url, new_url);
  end loop;
end $$;
