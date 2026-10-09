-- The public form learns what kind of report it is, so a safeguarding form can
-- say "If a child is in immediate danger, call 999 now" before the first
-- question rather than in the thank-you message after the last.
--
-- get_public_form() gains one column, creates_record ('none', 'injury' or
-- 'concern', from 20261009_public_reports). Postgres will not change a
-- function's result columns in place, so it is dropped and created again with
-- the same body, filters and grants as before.

drop function if exists public.get_public_form(text, uuid);

create function public.get_public_form(p_org_slug text, p_form_id uuid)
returns table(
  id uuid, name text, description text, intro_text text, confirmation_message text,
  fields jsonb, multi_step boolean, accent_color text, cover_image_url text, closing_date date,
  org_name text, org_logo_url text, org_primary_color text, org_secondary_color text,
  creates_record text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select f.id, f.name, f.description, f.intro_text, f.confirmation_message, f.fields, f.multi_step,
         f.accent_color, f.cover_image_url, f.closing_date,
         o.name, o.logo_url, o.primary_color, o.secondary_color,
         coalesce(f.creates_record, 'none')
  from public.org_forms f
  join public.organisations o on o.id = f.org_id
  where f.id = p_form_id
    and lower(o.slug) = lower(p_org_slug)
    and f.visibility = 'public'
    and coalesce(f.status, case when f.is_active then 'active' else 'draft' end) = 'active'
    -- A form past its closing date should say so rather than quietly accepting
    -- responses nobody will act on.
    and (f.closing_date is null or f.closing_date >= (now() at time zone 'Europe/London')::date)
  limit 1;
$function$;

revoke all on function public.get_public_form(text, uuid) from public;
grant execute on function public.get_public_form(text, uuid) to anon, authenticated;
