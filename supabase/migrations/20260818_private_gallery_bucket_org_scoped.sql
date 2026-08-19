-- Children's photographs were served from a public storage bucket.
--
-- Two separate problems, and fixing only the first would have left the
-- exposure substantially intact:
--
-- 1. `gallery` was a public bucket. A public bucket bypasses storage RLS on
--    read entirely, so every object was retrievable by anyone holding the URL
--    -- no authentication, no tenant boundary. A URL that leaked through
--    browser history, a forwarded link, a referrer header or a screenshot
--    granted permanent access to an image of a child. The policies below were
--    never consulted for reads at all.
--
-- 2. The `Gallery public read` policy granted SELECT over the WHOLE bucket to
--    the `public` role with no org scoping, and the insert/delete policies
--    only checked that a caller was signed in. So even once the bucket was
--    private, any authenticated user of any organisation could still read,
--    write and delete any other organisation's photographs.
--
-- Objects are foldered by org id (`<org_id>/...`), so the first path segment
-- is the tenant key. This mirrors the get_my_org_id() pattern used by every
-- table policy in the public schema.
--
-- Application side: src/lib/storageUrl.js mints short-lived signed URLs and
-- src/components/shared/SignedImg.jsx renders them. Rows written before this
-- migration still hold a full public-style URL, which no longer resolves but
-- remains a reliable way to recover the object path, so there is no data
-- migration to run.

update storage.buckets set public = false where id = 'gallery';

-- Reads: org members only, scoped to their own org's folder.
drop policy if exists "Gallery public read" on storage.objects;

create policy "Gallery read own org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = get_my_org_id()::text
  );

-- Writes: previously any authenticated user could write into any org's folder.
drop policy if exists "Org members can upload gallery photos" on storage.objects;

create policy "Gallery upload own org"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = get_my_org_id()::text
  );

drop policy if exists "Org members can delete gallery photos" on storage.objects;

create policy "Gallery delete own org"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = get_my_org_id()::text
  );

-- Needed for upsert on child profile photos.
create policy "Gallery update own org"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = get_my_org_id()::text
  )
  with check (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = get_my_org_id()::text
  );

-- Note: child attachment and child photo uploads in Registers.jsx previously
-- wrote to `children/<child_id>/...` with no org prefix, which would fall
-- outside these policies. That path was changed to be org-prefixed in the same
-- commit. Both had zero rows, so no existing objects needed moving.
