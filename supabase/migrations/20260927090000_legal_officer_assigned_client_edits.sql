begin;

-- Assignment belongs to the client; its related records inherit the edit scope.
alter table public.clients
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;
create index if not exists clients_assigned_to_idx on public.clients(assigned_to);

create or replace function public.can_edit_client(target_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.is_approved(), false) and exists (
    select 1 from public.clients c
    where c.id = target_client_id
      and c.deleted_at is null
      and (
        public.current_profile_role() in ('operations_manager', 'managing_partner')
        or (public.current_profile_role() = 'legal_officer' and c.assigned_to = auth.uid())
      )
  )
$$;

create or replace function public.can_edit_matter(target_matter_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.is_approved(), false) and exists (
    select 1
    from public.matters m
    where m.id = target_matter_id
      and m.deleted_at is null
      and (
        public.current_profile_role() in ('operations_manager', 'managing_partner')
        or (
          public.current_profile_role() = 'legal_officer'
          and m.matter_status = 'open'
          and exists (
            select 1 from public.clients c
            where c.id = m.client_id and c.assigned_to = auth.uid() and c.deleted_at is null
          )
        )
      )
  )
$$;

create or replace function public.can_access_matter(target_matter_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.matters m
    where m.id = target_matter_id and m.deleted_at is null
      and public.is_approved()
      and public.current_profile_role() in ('legal_officer', 'operations_manager', 'managing_partner')
      and (
        public.current_profile_role() in ('operations_manager', 'managing_partner')
        or exists(select 1 from public.clients c where c.id=m.client_id and c.assigned_to=auth.uid())
      )
  )
$$;

-- Legal Officers must not change a matter's client or assignment to escape
-- their assigned-client scope.
create or replace function public.enforce_matter_update_scope()
returns trigger language plpgsql set search_path = public as $$
declare actor_role text;
begin
  actor_role := public.current_profile_role()::text;
  if actor_role = 'legal_officer' and (
    new.created_by is distinct from old.created_by
    or new.entered_by is distinct from old.entered_by
    or new.assigned_to is distinct from old.assigned_to
    or new.creator_email is distinct from old.creator_email
    or new.client_id is distinct from old.client_id
  ) then
    raise exception 'Legal Officers cannot change matter ownership, client, or assignment';
  end if;
  if (new.matter_status is distinct from old.matter_status or new.closed_at is distinct from old.closed_at)
     and actor_role not in ('operations_manager','managing_partner') then
    raise exception 'Only Operations Managers and Managing Partners can close a matter';
  end if;
  if old.matter_status='closed' and (new.matter_status is distinct from old.matter_status or new.closed_at is distinct from old.closed_at) then
    raise exception 'A closed matter cannot be reopened or have its retention date changed';
  end if;
  if old.matter_status='open' and new.matter_status='closed' then
    new.closed_at = now();
  end if;
  if new.matter_status='open' then
    new.closed_at = null;
  end if;
  if new.assigned_to is distinct from old.assigned_to
     and actor_role not in ('operations_manager','managing_partner') then
    raise exception 'Only Operations Managers can assign matters';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists matters_update_open_authorized on public.matters;
create policy matters_update_open_authorized on public.matters for update to authenticated
  using (public.can_edit_matter(id) and matter_status = 'open')
  with check (public.can_edit_matter(id));

drop policy if exists clients_update_authorized on public.clients;
create policy clients_update_authorized on public.clients for update to authenticated
  using (public.can_edit_client(id))
  with check (public.can_edit_client(id));

drop policy if exists clients_insert_authorized on public.clients;
create policy clients_insert_authorized on public.clients for insert to authenticated
  with check (
    public.is_approved()
    and public.current_profile_role() in ('operations_manager','managing_partner')
    and created_by = auth.uid()
  );

drop policy if exists clients_select_authorized on public.clients;
create policy clients_select_authorized on public.clients for select to authenticated using (
  public.is_approved()
  and (
    public.current_profile_role() in ('operations_manager','managing_partner')
    or assigned_to = auth.uid()
  )
);

drop policy if exists matters_insert_authorized on public.matters;
create policy matters_insert_authorized on public.matters for insert to authenticated
  with check (
    public.is_approved()
    and public.current_profile_role() in ('legal_officer','operations_manager','managing_partner')
    and created_by = auth.uid()
    and client_id is not null
    and practice_area <> 'needs_review'
    and matter_status = 'open'
    and closed_at is null
    and public.can_edit_client(client_id)
  );

drop policy if exists documents_insert_draft on public.documents;
create policy documents_insert_draft on public.documents for insert to authenticated
  with check (
    public.is_approved()
    and public.current_profile_role() in ('legal_officer','operations_manager','managing_partner')
    and created_by = auth.uid()
    and status = 'draft'
    and (
      (client_id is not null and public.can_edit_client(client_id))
      or (matter_id is not null and public.can_edit_matter(matter_id))
    )
  );

drop policy if exists matter_notes_insert on public.matter_notes;
create policy matter_notes_insert on public.matter_notes for insert to authenticated
  with check (public.can_edit_matter(matter_id) and coalesce(created_by,auth.uid())=auth.uid());

drop policy if exists matter_tasks_insert on public.matter_tasks;
create policy matter_tasks_insert on public.matter_tasks for insert to authenticated
  with check (public.can_edit_matter(matter_id) and coalesce(created_by,auth.uid())=auth.uid());

drop policy if exists lexora_deadlines_insert on public.deadlines;
create policy lexora_deadlines_insert on public.deadlines for insert to authenticated
  with check (
    public.can_edit_matter(matter_id)
    and coalesce(created_by,auth.uid())=auth.uid()
    and exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open')
  );

drop policy if exists fee_notes_insert on public.fee_notes;
create policy fee_notes_insert on public.fee_notes for insert to authenticated
  with check (
    public.is_approved()
    and created_by = auth.uid()
    and public.can_edit_client(client_id)
    and public.can_edit_matter(matter_id)
  );

drop policy if exists fee_notes_update on public.fee_notes;
create policy fee_notes_update on public.fee_notes for update to authenticated
  using (public.can_edit_client(client_id) and public.can_edit_matter(matter_id))
  with check (public.can_edit_client(client_id) and public.can_edit_matter(matter_id));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert to authenticated
  with check (
    public.is_approved()
    and created_by = auth.uid()
    and public.can_edit_client(client_id)
    and public.can_edit_matter(matter_id)
  );

drop policy if exists documents_select_authorized on public.documents;
create policy documents_select_authorized on public.documents for select to authenticated using (
  (deleted_at is null or public.current_profile_role()='managing_partner')
  and (
    public.current_profile_role() in ('operations_manager','managing_partner')
    or (client_id is not null and public.can_edit_client(client_id))
    or (matter_id is not null and public.can_access_matter(matter_id))
    or (
      public.current_profile_role() <> 'legal_officer'
      and matter_id is null and client_id is null
      and (created_by=auth.uid() or entered_by=auth.uid())
    )
  )
);

drop policy if exists matter_access_select on public.matter_access;
create policy matter_access_select on public.matter_access for select to authenticated using (
  public.current_profile_role() in ('operations_manager','managing_partner')
  or public.can_access_matter(matter_id)
);

drop policy if exists document_activity_select on public.document_activity;
create policy document_activity_select on public.document_activity for select to authenticated using (
  public.current_profile_role() in ('operations_manager','managing_partner')
  or exists(
    select 1 from public.documents d
    where d.id=document_id
      and (
        (d.client_id is not null and public.can_edit_client(d.client_id))
        or (d.matter_id is not null and public.can_access_matter(d.matter_id))
        or (public.current_profile_role() <> 'legal_officer' and d.matter_id is null and d.client_id is null and (d.created_by=auth.uid() or d.entered_by=auth.uid()))
      )
  )
);

drop policy if exists document_versions_select on public.document_versions;
create policy document_versions_select on public.document_versions for select to authenticated using (
  public.current_profile_role() in ('operations_manager','managing_partner')
  or exists(
    select 1 from public.documents d
    where d.id=document_id
      and (
        (d.client_id is not null and public.can_edit_client(d.client_id))
        or (d.matter_id is not null and public.can_access_matter(d.matter_id))
        or (public.current_profile_role() <> 'legal_officer' and d.matter_id is null and d.client_id is null and (d.created_by=auth.uid() or d.entered_by=auth.uid()))
      )
  )
);

drop policy if exists lexora_document_storage_read on storage.objects;
create policy lexora_document_storage_read on storage.objects for select to authenticated
using (
  bucket_id='lexora-documents'
  and (
    public.current_profile_role() in ('operations_manager','managing_partner')
    or exists(
      select 1 from public.documents d
      where d.storage_path=name
        and (
          (d.client_id is not null and public.can_edit_client(d.client_id))
          or (d.matter_id is not null and public.can_access_matter(d.matter_id))
          or (public.current_profile_role() <> 'legal_officer' and d.matter_id is null and d.client_id is null and (d.created_by=auth.uid() or d.entered_by=auth.uid()))
        )
    )
    or exists(
      select 1 from public.document_versions v
      join public.documents d on d.id=v.document_id
      where v.storage_path=name
        and (
          (d.client_id is not null and public.can_edit_client(d.client_id))
          or (d.matter_id is not null and public.can_access_matter(d.matter_id))
          or (public.current_profile_role() <> 'legal_officer' and d.matter_id is null and d.client_id is null and (d.created_by=auth.uid() or d.entered_by=auth.uid()))
        )
    )
  )
);

-- Keep the existing document workflow states while requiring assignment for
-- Legal Officer edits to client-linked drafts.
drop policy if exists documents_update_workflow on public.documents;
create policy documents_update_workflow on public.documents for update to authenticated
  using (
    (
      public.current_profile_role() = 'legal_officer'
      and status = 'draft'
      and (matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'))
      and (
        (client_id is not null and public.can_edit_client(client_id))
        or (matter_id is not null and public.can_edit_matter(matter_id))
      )
    )
    or (
      public.current_profile_role() = 'operations_manager'
      and status in ('submitted','in_ops_review')
      and (matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'))
    )
    or (
      public.current_profile_role() = 'managing_partner'
      and status = 'awaiting_partner_approval'
      and (matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'))
    )
  )
  with check (
    (
      public.current_profile_role() = 'legal_officer'
      and status in ('draft','submitted')
      and (matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'))
      and (
        (client_id is not null and public.can_edit_client(client_id))
        or (matter_id is not null and public.can_edit_matter(matter_id))
      )
    )
    or (
      public.current_profile_role() = 'operations_manager'
      and status in ('submitted','in_ops_review','awaiting_partner_approval')
      and (matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'))
    )
    or (
      public.current_profile_role() = 'managing_partner'
      and status in ('awaiting_partner_approval','approved','in_ops_review')
      and (matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'))
    )
  );

drop policy if exists matter_notes_update_author on public.matter_notes;
create policy matter_notes_update_author on public.matter_notes for update to authenticated
  using (public.can_edit_matter(matter_id))
  with check (public.can_edit_matter(matter_id));

drop policy if exists matter_tasks_update on public.matter_tasks;
create policy matter_tasks_update on public.matter_tasks for update to authenticated
  using (deleted_at is null and public.can_edit_matter(matter_id))
  with check (public.can_edit_matter(matter_id));

drop policy if exists lexora_deadlines_update on public.deadlines;
create policy lexora_deadlines_update on public.deadlines for update to authenticated
  using (
    public.can_edit_matter(matter_id)
    and exists(select 1 from public.matters m where m.id = matter_id and m.matter_status = 'open')
  )
  with check (public.can_edit_matter(matter_id));

-- Version uploads and storage writes are edits to client documents too.
drop policy if exists document_versions_insert on public.document_versions;
create policy document_versions_insert on public.document_versions for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.deleted_at is null
        and (
          (
            d.status = 'draft'
            and (
              (d.client_id is not null and public.can_edit_client(d.client_id))
              or (d.matter_id is not null and public.can_edit_matter(d.matter_id)
                  and exists(select 1 from public.matters m where m.id = d.matter_id and m.matter_status = 'open'))
            )
          )
          or (
            d.matter_id is not null
            and public.current_profile_role() in ('operations_manager','managing_partner')
            and exists(select 1 from public.matters m where m.id = d.matter_id and m.matter_status = 'closed')
          )
        )
    )
  );

drop policy if exists lexora_document_storage_insert on storage.objects;
create policy lexora_document_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'lexora-documents'
  and public.current_profile_role() in ('legal_officer','operations_manager','managing_partner')
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1 from public.documents d
    where d.id::text = split_part(name, '/', 2) and d.deleted_at is null
      and (
        (
          d.status = 'draft'
          and (
            (d.client_id is not null and public.can_edit_client(d.client_id))
            or (d.matter_id is not null and public.can_edit_matter(d.matter_id)
                and exists(select 1 from public.matters m where m.id = d.matter_id and m.matter_status = 'open'))
          )
        )
        or (
          d.matter_id is not null
          and public.current_profile_role() in ('operations_manager','managing_partner')
          and exists(select 1 from public.matters m where m.id = d.matter_id and m.matter_status = 'closed')
        )
      )
  )
);

commit;
