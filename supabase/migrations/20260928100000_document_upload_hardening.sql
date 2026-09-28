begin;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'lexora-documents',
  'lexora-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists documents_cleanup_incomplete_draft on public.documents;
create policy documents_cleanup_incomplete_draft on public.documents for update to authenticated
  using (created_by = auth.uid() and status = 'draft' and deleted_at is null and storage_path is null)
  with check (created_by = auth.uid() and status = 'draft' and deleted_at is not null and storage_path is null);

commit;