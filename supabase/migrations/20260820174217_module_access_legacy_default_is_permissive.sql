-- The fallback used when an organisation has written no template row and the
-- member has no grant. It has to reproduce TODAY's behaviour exactly, because
-- it is about to be consulted by RLS on ~100 tables.
--
-- The previous version returned 'none' for volunteers and parents on every
-- module. That was harmless while nothing read it, but as an RLS input it
-- would have shut down the volunteer and parent portals outright: both read
-- sessions, volunteer slots, attendance and message threads, and all four
-- would have started demanding a module the fallback denied.
--
-- So the fallback is permissive: this layer subtracts access, it never grants
-- it. Underneath it, the existing per-table role policies still apply exactly
-- as before -- a volunteer resolving 'edit' here does NOT mean a volunteer can
-- edit safeguarding records, it means this layer is not the thing stopping
-- them. Restriction begins only when an admin writes a template or a grant.
create or replace function public.module_access_legacy_default(p_role text, p_module text)
returns text language sql immutable
set search_path to 'pg_catalog', 'public'
as $$
  select case
    when p_role in ('owner','admin') then 'edit'
    -- Admin-only surfaces stay admin-only regardless; these already resolve
    -- through is_org_admin() in their own policies and in the nav.
    when p_module in ('hr','templates','settings','branding') then 'none'
    when p_role in ('manager','staff','volunteer','parent') then 'edit'
    else 'none'
  end;
$$;
