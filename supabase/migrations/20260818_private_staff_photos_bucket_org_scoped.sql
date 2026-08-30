-- staff-photos had the same shape of hole as `gallery`: a public bucket, plus
-- a "Photos are publicly viewable" policy granting SELECT over the entire
-- bucket to the `public` role with no tenant scoping. Adults rather than
-- children, so lower severity, but the same exposure and the same fix.
--
-- Objects are flat, named `<user id>.<ext>`. Reads are scoped to users who
-- share the caller's organisation.
--
-- The existing INSERT/UPDATE/DELETE policies are left as they were. INSERT is
-- the strict form `name = auth.uid()::text || '.' || split_part(name, '.', 2)`;
-- UPDATE and DELETE use `name like auth.uid()::text || '.%'`. Either way a
-- user can only write their own photo, and the literal dot before the wildcard
-- stops one UUID prefixing another.
-- VolunteerPortal previously uploaded to `<user id>/avatar.<ext>`, which
-- matched neither those policies nor any existing object; it was changed to
-- the flat form in the same commit.

update storage.buckets set public = false where id = 'staff-photos';

drop policy if exists "Photos are publicly viewable" on storage.objects;

create policy "Staff photos read own org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'staff-photos'
    and exists (
      select 1 from public.user_profiles p
      where p.id::text = split_part(name, '.', 1)
        and p.org_id = get_my_org_id()
    )
  );

-- Known consequence, recorded rather than fixed here: delete_user() removes
-- the profile row but never touches storage, so photographs belonging to
-- deleted accounts are now unreadable by anyone and remain in the bucket with
-- no retention basis. At the time of this migration four of the five objects
-- were in that state. Cleaning them up, and making account deletion remove
-- storage objects, is tracked separately.
