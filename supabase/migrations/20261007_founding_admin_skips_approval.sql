-- A founding admin has nobody to approve them.
--
-- claim_invite_profile() puts every new account into approval_status
-- 'pending' until an owner, admin or manager of the organisation lets it in.
-- That is right for staff an admin invites. But a trial's founding admin
-- arrives through the same invite: approve_trial_request() creates the
-- organisation empty and issues an admin_invites row to the person who signed
-- up. They claimed it, became the organisation's only member, and waited on
-- "An admin or manager at <org> needs to approve it" with no such person in
-- existence. Tye Dye Drama hit this on 7 Oct 2026.
--
-- The rule is about who could decide, not about which flow created the
-- invite: an owner or admin invite into an organisation that has no approved
-- owner, admin or manager is let straight in. That covers the trial founder,
-- and also an admin invited by a super admin into an organisation whose
-- approvers have all gone. Every other claim still waits, exactly as before.
--
-- Applied to project ssahcqeqrxawmwtjpwvh. The function previously existed
-- only in the live project; this is its full definition.

create or replace function public.claim_invite_profile(p_token uuid)
 returns table(org_slug text, role text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  inv         record;
  actor       uuid := auth.uid();
  actor_email text;
  inv_role    text;
  new_status  text;
begin
  if actor is null then
    raise exception 'You must be signed in to claim an invite';
  end if;

  select * into inv from public.admin_invites
  where token = p_token and status = 'pending';

  if inv is null then
    raise exception 'Invite not found or already used';
  end if;

  select email into actor_email from auth.users where id = actor;

  -- The token alone is not enough. Without this, anyone holding a leaked
  -- invite link could attach a different account to the organisation.
  if lower(coalesce(actor_email, '')) <> lower(inv.email) then
    raise exception 'This invite was issued to a different email address';
  end if;

  inv_role := coalesce(inv.role, 'staff');

  -- One claim per organisation at a time, so two admin invites into an empty
  -- organisation cannot both see "no approvers yet" and both skip approval.
  perform pg_advisory_xact_lock(hashtext('claim_invite_profile:' || inv.org_id::text));

  if inv_role in ('owner', 'admin') and not exists (
    select 1 from public.user_profiles p
    where p.org_id = inv.org_id
      and p.id <> actor
      and p.role in ('owner', 'admin', 'manager')
      and p.approval_status = 'approved'
  ) then
    new_status := 'approved';
  else
    new_status := 'pending';
  end if;

  -- Transaction-local, so the guard trigger lets this one write through
  -- without opening a hole for ordinary client updates.
  perform set_config('app.claiming_invite', 'on', true);

  insert into public.user_profiles (id, org_id, email, full_name, role, approval_status, approved_at)
  values (actor, inv.org_id, inv.email, inv.full_name, inv_role, new_status,
          case when new_status = 'approved' then now() end)
  on conflict (id) do update
    set org_id          = excluded.org_id,
        email           = excluded.email,
        full_name       = coalesce(excluded.full_name, public.user_profiles.full_name),
        role            = excluded.role,
        approval_status = excluded.approval_status,
        approved_by     = null,
        approved_at     = excluded.approved_at;

  update public.admin_invites
     set status = 'accepted', accepted_at = now()
   where id = inv.id;

  return query
    select o.slug, inv_role
    from public.organisations o where o.id = inv.org_id;
end $function$;

-- Let in anyone already stranded by the old behaviour: a pending owner or
-- admin in an organisation where nobody could ever approve them. On 7 Oct
-- 2026 that was exactly one account, Tye Dye Drama's founder.
update public.user_profiles p
   set approval_status = 'approved', approved_at = now(), approved_by = null
 where p.approval_status = 'pending'
   and p.role in ('owner', 'admin')
   and not exists (
     select 1 from public.user_profiles q
     where q.org_id = p.org_id
       and q.role in ('owner', 'admin', 'manager')
       and q.approval_status = 'approved'
   );
