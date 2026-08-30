-- Per-member module access. Third layer beneath the organisation's purchased
-- modules and the coarse role checks (is_org_admin / is_org_manager).
--
-- Levels are ordered: none < view < edit. Ranking them as integers keeps the
-- "cannot grant above your own level" comparison honest; string comparison
-- would put 'edit' < 'none' < 'view' alphabetically.

create or replace function public.module_level_rank(p_level text)
returns int language sql immutable
set search_path to 'pg_catalog', 'public'
as $$ select case p_level when 'edit' then 2 when 'view' then 1 else 0 end $$;

-- Per-org role template. Owner and admin are deliberately absent: they always
-- resolve to 'edit'. If administrators were restrictable, one bad save would
-- lock an organisation out of the Settings screen that undoes it, with no
-- route back that does not involve us touching their database.
create table if not exists public.module_access_defaults (
  org_id     uuid not null references public.organisations(id) on delete cascade,
  role       text not null check (role in ('manager','staff','volunteer','parent')),
  module_key text not null,
  level      text not null check (level in ('none','view','edit')),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (org_id, role, module_key)
);

-- Per-person override on top of the template. Absence means "inherit"; a row
-- with level 'none' is an explicit revoke and is not the same thing.
create table if not exists public.module_access_grants (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  module_key text not null,
  level      text not null check (level in ('none','view','edit')),
  note       text,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  unique (org_id, user_id, module_key)
);

create index if not exists idx_module_access_grants_user on public.module_access_grants(user_id);
create index if not exists idx_module_access_defaults_org on public.module_access_defaults(org_id);

-- What a role could do before this feature existed. Used as the fallback when
-- no template row has been written, so a new organisation -- or a module added
-- to the product after an organisation was seeded -- behaves exactly as it
-- does today rather than defaulting to locked out.
create or replace function public.module_access_legacy_default(p_role text, p_module text)
returns text language sql immutable
set search_path to 'pg_catalog', 'public'
as $$
  select case
    when p_role in ('owner','admin') then 'edit'
    when p_module in ('hr','templates','settings','branding') then 'none'
    when p_role in ('manager','staff') then 'edit'
    else 'none'
  end;
$$;

-- The single resolver. Everything else -- RLS policies, the client, the nav --
-- goes through this.
--
-- Note on scope: this does NOT clamp to the organisation's purchased modules.
-- That check stays in the client (allowedModules) on purpose. Enforcing it here
-- would mean an expired trial revokes database access to rows the organisation
-- still owns, turning a "renew your plan" screen into query failures against
-- their own safeguarding records.
create or replace function public.module_access(p_module text)
returns text language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  with me as (
    select id, org_id, role from public.user_profiles where id = auth.uid()
  )
  select case
    when (select role from me) is null then 'none'
    when (select role from me) in ('owner','admin') then 'edit'
    else coalesce(
      (select g.level from public.module_access_grants g, me
        where g.user_id = me.id and g.org_id = me.org_id and g.module_key = p_module),
      (select d.level from public.module_access_defaults d, me
        where d.org_id = me.org_id and d.role = me.role and d.module_key = p_module),
      public.module_access_legacy_default((select role from me), p_module)
    )
  end;
$$;

create or replace function public.module_can_view(p_module text)
returns boolean language sql stable
set search_path to 'pg_catalog', 'public'
as $$ select public.module_access(p_module) <> 'none' $$;

create or replace function public.module_can_edit(p_module text)
returns boolean language sql stable
set search_path to 'pg_catalog', 'public'
as $$ select public.module_access(p_module) = 'edit' $$;

revoke execute on function public.module_access(text) from public;
revoke execute on function public.module_can_view(text) from public;
revoke execute on function public.module_can_edit(text) from public;
revoke execute on function public.module_level_rank(text) from public;
revoke execute on function public.module_access_legacy_default(text, text) from public;
grant execute on function public.module_access(text) to authenticated, service_role;
grant execute on function public.module_can_view(text) to authenticated, service_role;
grant execute on function public.module_can_edit(text) to authenticated, service_role;
grant execute on function public.module_level_rank(text) to authenticated, service_role;
grant execute on function public.module_access_legacy_default(text, text) to authenticated, service_role;
