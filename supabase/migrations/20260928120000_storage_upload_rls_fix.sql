begin;

create or replace function public.can_upload_document_object(target_document_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_approved()
    and public.current_profile_role() in ('legal_officer', 'operations_manager', 'managing_partner')
    and exists (
      select 1 from public.documents d
      where d.id::text = target_document_id
        and d.deleted_at is null
        and (
          (
            d.status = 'draft'
            and (
              (d.client_id is not null and public.can_edit_client(d.client_id))
              or (
                d.matter_id is not null
                and public.can_edit_matter(d.matter_id)
                and exists (
                  select 1 from public.matters m
                  where m.id = d.matter_id and m.matter_status = 'open'
                )
              )
              or (
                d.matter_id is null and d.client_id is null
                and public.current_profile_role() in ('operations_manager', 'managing_partner')
                and (d.created_by = auth.uid() or d.entered_by = auth.uid())
              )
            )
          )
          or (
            d.matter_id is not null
            and public.current_profile_role() in ('operations_manager', 'managing_partner')
            and exists (
              select 1 from public.matters m
              where m.id = d.matter_id and m.matter_status = 'closed'
            )
          )
        )
    );
$$;
revoke all on function public.can_upload_document_object(text) from public, anon;
grant execute on function public.can_upload_document_object(text) to authenticated;

drop policy if exists lexora_document_storage_insert on storage.objects;
create policy lexora_document_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lexora-documents'
    and split_part(name, '/', 1) = auth.uid()::text
    and public.can_upload_document_object(split_part(name, '/', 2))
  );

commit;