-- safeguarding-docs: an admin reaches only their own organisation's files.
--
-- Found 24 Nov 2026 in a security check. The three admin policies on this
-- bucket checked is_org_admin() (the caller is an admin of SOME organisation)
-- but not which organisation the file belongs to. Anyone can become an admin
-- by starting a free trial, so in practice any member of the public could
-- list, download, delete or upload into every organisation's safeguarding
-- documents. Tested in a rolled-back transaction: admins of three other
-- organisations each saw Solidarity Sports' 2 documents.
--
-- The app writes this bucket under these paths (organisation id in brackets):
--   [org]/...                      safeguarding dashboard, policy document
--   case-evidence/[org]/...        case files
--   risk-assessments/[org]/...     risk assessment attachments
--   messages/[org]/...             volunteer portal message attachments
--   certificates/[org]/[user]/...  volunteer certificates
-- Who may act is unchanged (admins and owners); only the organisation check
-- is added. The members' own-certificate policies are untouched.

create or replace function public.safeguarding_doc_org(p_name text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when (storage.foldername(p_name))[1] in ('case-evidence', 'risk-assessments', 'messages', 'certificates')
      then (storage.foldername(p_name))[2]
    else (storage.foldername(p_name))[1]
  end
$$;

drop policy if exists "Admins can view safeguarding docs" on storage.objects;
drop policy if exists "Admins can upload safeguarding docs" on storage.objects;
drop policy if exists "Admins can delete safeguarding docs" on storage.objects;

create policy "Admins can view safeguarding docs" on storage.objects
  for select to authenticated
  using (bucket_id = 'safeguarding-docs' and public.is_org_admin()
         and public.safeguarding_doc_org(name) = public.get_my_org_id()::text);

create policy "Admins can upload safeguarding docs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'safeguarding-docs' and public.is_org_admin()
              and public.safeguarding_doc_org(name) = public.get_my_org_id()::text);

create policy "Admins can delete safeguarding docs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'safeguarding-docs' and public.is_org_admin()
         and public.safeguarding_doc_org(name) = public.get_my_org_id()::text);
