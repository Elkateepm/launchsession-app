-- Two gaps in the public signup path, both fixed here rather than in the client.
--
-- 1. The landing page's founding-offer counter read `waitlist_signups`
--    directly as anon. That table is insert-only for anon -- correctly, since a
--    SELECT policy would hand every lead's name and email to anyone who opened
--    devtools -- so the read always returned an empty array. The counter was
--    permanently stuck at "50 of 50 remaining" with a 0% bar and never closed
--    the form once the spots were gone. The failure was silent: the request
--    succeeded, it just came back empty, so the catch-block fallback never ran.
--
-- 2. Signup had no recovery path. The invite email is the only way into a newly
--    created workspace, so a signup whose mail bounced or landed in spam was
--    stuck with nothing but a support address.
--
-- Both are definer functions so the client gets exactly one number, or one
-- side effect, and no access to the rows behind them.

-- Returns only the integer; leads stay unreadable to anon.
create or replace function public.founding_spots_claimed()
returns integer
language sql
security definer
stable
set search_path to 'public'
as $$
  select count(*)::integer from waitlist_signups where interest = 'lifetime_deal_50';
$$;

comment on function public.founding_spots_claimed() is
  'Count of claimed founding-member spots for the public landing page. Returns only the integer -- waitlist_signups stays unreadable to anon so lead details are never exposed.';

grant execute on function public.founding_spots_claimed() to anon, authenticated;


-- Re-triggers the same server-side send as create_trial_signup. The token is
-- read from the row rather than accepted from the caller, so it still never
-- reaches the browser.
create or replace function public.resend_signup_invite(p_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_id     uuid;
  v_secret text;
begin
  if v_email = '' then
    raise exception 'An email address is required.';
  end if;

  -- Tighter than signup's own limit: resending is cheap to trigger and each one
  -- sends real mail, so this is the abuse surface, not workspace creation.
  if not check_rate_limit('resend_invite:email:' || v_email, 3, 900) then
    raise exception 'RESEND_RATE_LIMIT: That link has been sent a few times already. Please wait about fifteen minutes before trying again, or contact support@launchsession.co.uk.';
  end if;
  if not check_rate_limit('resend_invite:global', 60, 600) then
    raise exception 'RESEND_RATE_LIMIT: We are seeing an unusual number of requests right now. Please try again in a few minutes.';
  end if;

  -- Most recent approved, still-unaccepted signup for this address. An
  -- already-accepted invite has an account behind it, so the right recovery
  -- there is a password reset, not another invite link.
  select id into v_id
  from trial_requests
  where lower(email) = v_email
    and status = 'approved'
    and admin_invite_token is not null
  order by created_at desc
  limit 1;

  -- Deliberately silent when nothing matches. Telling the caller whether an
  -- address has a workspace would turn this into an account-existence oracle
  -- for anyone who can reach the endpoint.
  if v_id is null then
    return;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'db_event_secret' limit 1;

  if v_secret is null then
    raise warning 'resend_signup_invite: db_event_secret missing, invite email not resent for %', v_id;
    return;
  end if;

  perform net.http_post(
    url := 'https://app.launchsession.co.uk/api/send-form-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-db-event-secret', v_secret),
    body := jsonb_build_object('type', 'signup_invite_email', 'trial_id', v_id)
  );
end;
$$;

comment on function public.resend_signup_invite(text) is
  'Re-sends the admin invite email for the most recent approved signup with this address. Rate limited, and silent when no match exists so it cannot be used to test whether an address has an account.';

grant execute on function public.resend_signup_invite(text) to anon, authenticated;
