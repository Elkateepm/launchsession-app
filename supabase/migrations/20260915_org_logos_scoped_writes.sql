-- Applied as org_logos_scoped_writes.
--
-- The org-logos bucket let any signed-in user, in any organisation and any
-- role, upload over, replace or delete any object in it: another
-- organisation's logo and sign-in background, and the LaunchSession badge in
-- email-assets/ that every organisation falls back to. The bucket is public,
-- so whatever was uploaded went straight onto sign-in screens and emails.
--
-- What legitimately writes here:
--   <org_id>/logo|icon|login-bg|email-logo.<ext>  Branding Centre, org admins
--   avatars/<user_id>.<ext>                        CreatePassword, the user themself
--   email-assets/*                                 LaunchSession staff (super admins)

create or replace function public.can_write_org_logo_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.super_admins where id = auth.uid())
    or (
      (storage.foldername(p_name))[1] = public.get_my_org_id()::text
      and public.is_org_admin()
    )
    or p_name ~ ('^avatars/' || auth.uid()::text || '\.[A-Za-z0-9]{1,5}$')
  );
$$;

revoke all on function public.can_write_org_logo_object(text) from public, anon;
grant execute on function public.can_write_org_logo_object(text) to authenticated;

drop policy if exists "Org members can upload logo" on storage.objects;
drop policy if exists "Org members can update logo" on storage.objects;
drop policy if exists "Org members can delete logo" on storage.objects;

create policy "org-logos: scoped upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'org-logos' and public.can_write_org_logo_object(name));

create policy "org-logos: scoped update" on storage.objects
  for update to authenticated
  using (bucket_id = 'org-logos' and public.can_write_org_logo_object(name))
  with check (bucket_id = 'org-logos' and public.can_write_org_logo_object(name));

create policy "org-logos: scoped delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'org-logos' and public.can_write_org_logo_object(name));

-- Images only, and nothing large enough to make a sign-in screen slow to load.
-- Existing files are untouched; the limit applies to new uploads. No SVG: it
-- can carry script, and none are stored today.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 where id = 'org-logos';
