-- Plan child limits, enforced.
--
-- plan_entitlements.child_limit has been displayed since the plans went in but
-- governed nothing, so Starter's "up to 100 young people" was a claim on a
-- pricing page rather than a rule.
--
-- A soft ceiling: it blocks *adding*, never viewing. An organisation that
-- downgrades while over the limit keeps every child fully readable and
-- editable -- on a system holding medical alerts and safeguarding concerns,
-- making a child's record vanish because of a billing state would be the
-- wrong trade in every case. Archiving someone who has left frees a place.

create or replace function public.enforce_child_limit()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_limit integer;
  v_count integer;
begin
  -- Only two operations consume a place: adding an active child, and
  -- reactivating an archived one. Editing, archiving and deleting are free.
  if tg_op = 'INSERT' and not coalesce(new.active, true) then
    return new;
  end if;
  if tg_op = 'UPDATE' and not (coalesce(new.active, false) and not coalesce(old.active, false)) then
    return new;
  end if;

  select pe.child_limit into v_limit
  from public.organisations o
  join public.plan_entitlements pe on pe.plan = o.plan
  where o.id = new.org_id;

  -- Unlimited, or a plan with no catalogue row. Both mean "do not stand in
  -- the way" -- a missing row must never become an accidental limit of zero.
  if v_limit is null then
    return new;
  end if;

  -- Command Centre staff can always act, including to dig an organisation out
  -- of a state it cannot fix itself.
  if exists (select 1 from public.super_admins sa where sa.id = auth.uid()) then
    return new;
  end if;

  -- Serialise per organisation so two concurrent adds cannot both read 99 and
  -- both succeed. Transaction-scoped, so a bulk import takes it once.
  perform pg_advisory_xact_lock(hashtext(new.org_id::text));

  select count(*) into v_count
  from public.children c
  where c.org_id = new.org_id and c.active;

  if v_count >= v_limit then
    raise exception 'CHILD_LIMIT_REACHED: This organisation''s plan includes up to % young people. Archive someone who has left, or move to a plan with no limit, to add another.', v_limit
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

comment on function public.enforce_child_limit() is
  'Blocks adding or reactivating a child beyond the plan''s child_limit. Never hides or removes existing records.';

drop trigger if exists trg_child_limit on public.children;
create trigger trg_child_limit
  before insert or update of active on public.children
  for each row execute function public.enforce_child_limit();

-- Deliberately NOT exempting the service role: api/import-children.js runs with
-- the service key, and a limit that a spreadsheet upload walks straight past is
-- not a limit.

-- What the Billing screen shows. Scoped to the caller's own organisation, so it
-- cannot be used to count another org's children.
create or replace function public.org_child_usage()
returns table (used integer, child_limit integer)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select
    (select count(*)::integer
       from public.children c
      where c.org_id = public.get_my_org_id() and c.active),
    (select pe.child_limit
       from public.organisations o
       join public.plan_entitlements pe on pe.plan = o.plan
      where o.id = public.get_my_org_id());
$function$;

revoke execute on function public.org_child_usage() from anon, public;
grant execute on function public.org_child_usage() to authenticated;
