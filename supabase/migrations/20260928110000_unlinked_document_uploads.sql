begin;

drop policy if exists documents_insert_draft on public.documents;
create policy documents_insert_draft on public.documents for insert to authenticated
  with check (
    public.is_approved()
    and public.current_profile_role() in ('legal_officer', 'operations_manager', 'managing_partner')
    and created_by = auth.uid()
    and status = 'draft'
    and (
      (client_id is not null and public.can_edit_client(client_id))
      or (matter_id is not null and public.can_edit_matter(matter_id))
      or (
        client_id is null and matter_id is null
        and public.current_profile_role() in ('operations_manager', 'managing_partner')
      )
    )
  );

drop policy if exists lexora_document_storage_insert on storage.objects;
create policy lexora_document_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lexora-documents'
    and public.current_profile_role() in ('legal_officer', 'operations_manager', 'managing_partner')
    and split_part(name, '/', 1) = auth.uid()::text
    and exists (
      select 1
      from public.documents d
      where d.id::text = split_part(name, '/', 2)
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
                d.client_id is null and d.matter_id is null
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
    )
  );

commit;