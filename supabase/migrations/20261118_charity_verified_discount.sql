-- A verified charity gets its 20% off, whenever it subscribed.
--
-- Checkout already applies the charity coupon for a claimed or verified
-- charity. What was missing: an organisation that subscribed first and was
-- verified afterwards kept paying full price until it changed plan.
--
-- When charity_status becomes 'verified' (only LaunchSession can set it:
-- guard_organisation_entitlements refuses organisations), post to
-- api/send-form-email (type charity_discount_sync) with the shared vault
-- secret. That handler puts the coupon on any live Stripe subscription and
-- emails the organisation's admins through Resend
-- (send-charity-verified-email). Same pg_net + db_event_secret pattern as
-- create_trial_signup.

create or replace function public.organisations_charity_verified()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $function$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'db_event_secret' limit 1;

  if v_secret is null then
    raise warning 'organisations_charity_verified: db_event_secret missing, discount not synced for %', new.id;
    return new;
  end if;

  perform net.http_post(
    url := 'https://app.launchsession.co.uk/api/send-form-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-db-event-secret', v_secret),
    body := jsonb_build_object('type', 'charity_discount_sync', 'org_id', new.id)
  );
  return new;
end
$function$;

revoke all on function public.organisations_charity_verified() from public, anon, authenticated;

drop trigger if exists trg_organisations_charity_verified on public.organisations;
create trigger trg_organisations_charity_verified
  after update of charity_status on public.organisations
  for each row
  when (new.charity_status = 'verified' and old.charity_status is distinct from 'verified')
  execute function public.organisations_charity_verified();
