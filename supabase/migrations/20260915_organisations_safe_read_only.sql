-- Applied as organisations_safe_read_only.
--
-- organisations_safe is a plain view owned by postgres, so writes through it
-- run as the owner and skip the RLS on organisations. With the default grants,
-- the anon key (public in the app bundle) could UPDATE or DELETE any active or
-- trial organisation through it -- confirmed in a rolled-back transaction
-- before this was applied. Nothing in the app writes through the view; all
-- writes go to organisations, where the RLS policies apply.
revoke insert, update, delete, truncate, references, trigger on public.organisations_safe from anon, authenticated, public;
