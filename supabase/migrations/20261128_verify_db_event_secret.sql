-- Lets the send-push Edge Function check the shared db_event_secret without
-- holding a copy of it. Database triggers send the secret from the vault;
-- the function asks the database whether it matches, so the secret lives in
-- exactly one place and rotating it needs no redeploy.
--
-- Callable by the service role only: exposed to anon, it would be an oracle
-- for guessing the secret.

create or replace function public.verify_db_event_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(p_secret is not null and p_secret = (
    select decrypted_secret from vault.decrypted_secrets where name = 'db_event_secret' limit 1
  ), false)
$$;

revoke all on function public.verify_db_event_secret(text) from public, anon, authenticated;
grant execute on function public.verify_db_event_secret(text) to service_role;
