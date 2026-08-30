-- Follow-up to the review of anon-reachable SECURITY DEFINER functions. Same
-- root cause throughout: Postgres grants EXECUTE to PUBLIC on creation, so
-- functions nobody intended to expose were callable without signing in.
--
-- 1. The module password verifiers returned TRUE to an unauthenticated caller.
--    Each derives the org from auth.uid(), reads that org's hash, and treats a
--    null hash as "no password configured, allow through". For anon both are
--    null, so the function returned true. Verified live before the fix:
--    verify_safeguarding_password('anything') returned true as anon.
--
--    Practical impact is smaller than it looks -- the gated data is org-scoped
--    by RLS, so an anonymous caller who passes the gate still reads nothing --
--    but a verifier that returns true to a caller it cannot identify is wrong
--    on its own terms, and it failed open rather than closed. Now returns
--    false when there is no organisation, and anon cannot call it at all.
--
-- 2. sms_usage_this_month(p_org_id) counted any organisation's messages with
--    no caller check, so any authenticated user could read another tenant's
--    usage. Signature kept; it now also requires the id to match the caller's
--    own organisation.
--
-- 3. recalc_campaign_raised had no caller check and could be invoked by anyone
--    knowing a campaign id, forcing recalculation of another organisation's
--    totals. Nothing calls it -- the only two references in the repo are
--    comments -- so it is service_role only.
--
-- 4. Password functions and the authenticated-only helpers keep their
--    authenticated grant, since the client calls them directly. Only the
--    PUBLIC/anon reach is removed.
--
-- After this: all 75 SECURITY DEFINER functions are pinned on search_path, and
-- the number reachable by anon falls from 60 to 39 -- the remainder being
-- trigger functions and the genuinely public registration/form/donation entry
-- points.

create or replace function public.verify_safeguarding_password(input_password text)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare v_org_id uuid; v_hash text;
begin
  select org_id into v_org_id from public.user_profiles where id = auth.uid();
  if v_org_id is null then return false; end if;
  select safeguarding_password_hash into v_hash from public.organisations where id = v_org_id;
  if v_hash is null then return true; end if;
  return v_hash = crypt(input_password, v_hash);
end;
$$;

create or replace function public.verify_children_password(input_password text)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare v_org_id uuid; v_hash text;
begin
  select org_id into v_org_id from public.user_profiles where id = auth.uid();
  if v_org_id is null then return false; end if;
  select children_password_hash into v_hash from public.organisations where id = v_org_id;
  if v_hash is null then return true; end if;
  return v_hash = crypt(input_password, v_hash);
end;
$$;

create or replace function public.verify_fundraising_password(input_password text)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare v_org_id uuid; v_hash text;
begin
  select org_id into v_org_id from public.user_profiles where id = auth.uid();
  if v_org_id is null then return false; end if;
  select fundraising_password_hash into v_hash from public.organisations where id = v_org_id;
  if v_hash is null then return true; end if;
  return v_hash = crypt(input_password, v_hash);
end;
$$;

create or replace function public.sms_usage_this_month(p_org_id uuid)
returns integer language sql stable security definer
set search_path = pg_catalog, public
as $$
  select count(*)::int
  from public.sms_messages
  where org_id = p_org_id
    and org_id = get_my_org_id()
    and created_at >= date_trunc('month', now());
$$;

revoke execute on function public.recalc_campaign_raised(uuid) from public, anon, authenticated;
grant  execute on function public.recalc_campaign_raised(uuid) to service_role;

revoke execute on function public.verify_safeguarding_password(text)  from public, anon;
revoke execute on function public.verify_children_password(text)      from public, anon;
revoke execute on function public.verify_fundraising_password(text)   from public, anon;
revoke execute on function public.set_safeguarding_password(text)     from public, anon;
revoke execute on function public.set_children_password(text)         from public, anon;
revoke execute on function public.set_fundraising_password(text)      from public, anon;
revoke execute on function public.clear_safeguarding_password()       from public, anon;
revoke execute on function public.clear_children_password()           from public, anon;
revoke execute on function public.clear_fundraising_password()        from public, anon;
revoke execute on function public.safeguarding_password_status()      from public, anon;
revoke execute on function public.children_password_status()          from public, anon;
revoke execute on function public.fundraising_password_status()       from public, anon;

grant execute on function public.verify_safeguarding_password(text) to authenticated;
grant execute on function public.verify_children_password(text)     to authenticated;
grant execute on function public.verify_fundraising_password(text)  to authenticated;
grant execute on function public.set_safeguarding_password(text)    to authenticated;
grant execute on function public.set_children_password(text)        to authenticated;
grant execute on function public.set_fundraising_password(text)     to authenticated;
grant execute on function public.clear_safeguarding_password()      to authenticated;
grant execute on function public.clear_children_password()          to authenticated;
grant execute on function public.clear_fundraising_password()       to authenticated;
grant execute on function public.safeguarding_password_status()     to authenticated;
grant execute on function public.children_password_status()         to authenticated;
grant execute on function public.fundraising_password_status()      to authenticated;

revoke execute on function public.report_overview_metrics(date, date) from public, anon;
revoke execute on function public.duplicate_project(uuid, text, date, date, boolean, boolean) from public, anon;
revoke execute on function public.generate_project_days(uuid, date[]) from public, anon;
revoke execute on function public.reconcile_payment_transaction(uuid) from public, anon;
revoke execute on function public.sms_usage_this_month(uuid) from public, anon;

grant execute on function public.report_overview_metrics(date, date) to authenticated;
grant execute on function public.duplicate_project(uuid, text, date, date, boolean, boolean) to authenticated;
grant execute on function public.generate_project_days(uuid, date[]) to authenticated;
grant execute on function public.reconcile_payment_transaction(uuid) to authenticated;
grant execute on function public.sms_usage_this_month(uuid) to authenticated;

alter function public.clear_fundraising_password()   set search_path = pg_catalog, public;
alter function public.fundraising_password_status()  set search_path = pg_catalog, public;
alter function public.set_fundraising_password(text) set search_path = pg_catalog, public;

-- STILL OPEN, deliberately not addressed here:
--   submit_child_registration and submit_volunteer_application have no rate
--   limit and no field-length bounds. Anyone knowing a public org slug can
--   repeatedly insert large medical-content rows into that charity's pending
--   queue, and a volunteer application can be submitted under someone else's
--   email carrying arbitrary DBS text. Neither reaches live records without
--   an admin approving, and the slug check does constrain which organisations
--   can be targeted. Fixing it means rewriting both function bodies and
--   choosing thresholds, which is a product decision -- check_rate_limit
--   (p_bucket, p_max, p_window_secs) already exists and is used by signup.
