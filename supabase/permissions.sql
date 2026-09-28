-- LEXORA row-level security for an existing schema.
-- Assumes the baseline schema and workflow triggers have already been applied.

begin;

alter table public.profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.matters enable row level security;
alter table public.matter_access enable row level security;
alter table public.matter_notes enable row level security;
alter table public.matter_tasks enable row level security;
alter table public.deadlines enable row level security;
alter table public.advisory_requests enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.clients enable row level security;
alter table public.fee_notes enable row level security;
alter table public.payments enable row level security;
alter table public.document_activity enable row level security;
alter table public.document_versions enable row level security;

create or replace function public.current_profile_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_profile_status()
returns public.profile_status
language sql stable security definer set search_path = public as $$
  select status from public.profiles where id = auth.uid()
$$;

create or replace function public.is_approved()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_profile_status() = 'approved', false)
$$;

create or replace function public.can_edit_client(target_client_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
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
language sql security definer stable set search_path = public as $$
  select coalesce(public.is_approved(), false) and exists (
    select 1 from public.matters m
    where m.id = target_matter_id
      and m.deleted_at is null
      and (
        public.current_profile_role() in ('operations_manager', 'managing_partner')
        or (
          public.current_profile_role() = 'legal_officer'
          and m.matter_status = 'open'
          and exists (
            select 1 from public.clients c
            where c.id = m.client_id
              and c.assigned_to = auth.uid()
              and c.deleted_at is null
          )
        )
      )
  )
$$;

create or replace function public.can_access_matter(target_matter_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.matters m
    where m.id = target_matter_id
      and m.deleted_at is null
      and public.is_approved()
      and public.current_profile_role() in ('legal_officer', 'operations_manager', 'managing_partner')
      and (
        public.current_profile_role() in ('operations_manager', 'managing_partner')
        or exists (
          select 1 from public.clients c
          where c.id = m.client_id and c.assigned_to = auth.uid()
        )
      )
  )
$$;

-- Remove only policies owned by this LEXORA permission set before recreating them.
do $$
declare existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname in ('public', 'storage')
      and policyname = any (array[
        'matters_select_authorized', 'matters_insert_authorized', 'matters_update_open_authorized',
        'matters_soft_delete_managing_partner', 'matters_no_hard_delete',
        'clients_select_authorized', 'clients_insert_authorized', 'clients_update_authorized', 'clients_no_hard_delete',
        'documents_select_authorized', 'documents_insert_draft', 'documents_update_workflow',
        'documents_soft_delete_managing_partner', 'documents_cleanup_incomplete_draft', 'documents_no_hard_delete',
        'matter_access_select', 'matter_access_manage',
        'matter_notes_select', 'matter_notes_insert', 'matter_notes_update_author', 'matter_notes_no_hard_delete',
        'matter_tasks_select', 'matter_tasks_insert', 'matter_tasks_update', 'matter_tasks_no_hard_delete',
        'lexora_deadlines_select', 'lexora_deadlines_insert', 'lexora_deadlines_update', 'lexora_deadlines_no_delete',
        'fee_notes_select', 'fee_notes_insert', 'fee_notes_update', 'fee_notes_no_hard_delete',
        'payments_select', 'payments_insert', 'payments_no_update', 'payments_no_hard_delete',
        'document_activity_select', 'document_versions_select', 'document_versions_insert',
        'lexora_document_storage_read', 'lexora_document_storage_insert',
        'profiles_select_roles', 'profiles_update_managing_partner', 'profiles_insert_self_pending',
        'advisory_select_roles', 'advisory_insert_roles', 'advisory_update_submitter_or_manager', 'advisory_no_hard_delete',
        'notifications_select_own', 'notifications_update_own', 'notifications_insert_system',
        'audit_logs_select_authorized', 'audit_logs_insert_self'
      ])
  loop
    execute format('drop policy %I on %I.%I', existing_policy.policyname, existing_policy.schemaname, existing_policy.tablename);
  end loop;
end;
$$;

create policy matters_select_authorized on public.matters for select to authenticated
  using (
    deleted_at is null
    and public.is_approved()
    and public.current_profile_role() in ('legal_officer', 'operations_manager', 'managing_partner')
    and (
      public.current_profile_role() in ('operations_manager', 'managing_partner')
      or exists (
        select 1 from public.clients c
        where c.id = client_id and c.assigned_to = auth.uid()
      )
    )
  );
create policy matters_insert_authorized on public.matters for insert to authenticated
  with check (
    public.is_approved()
    and public.current_profile_role() in ('legal_officer', 'operations_manager', 'managing_partner')
    and created_by = auth.uid()
    and client_id is not null
    and practice_area <> 'needs_review'
    and matter_status = 'open'
    and closed_at is null
    and public.can_edit_client(client_id)
  );
create policy matters_update_open_authorized on public.matters for update to authenticated
  using (public.can_edit_matter(id) and matter_status = 'open')
  with check (public.can_edit_matter(id));
create policy matters_soft_delete_managing_partner on public.matters for update to authenticated
  using (public.current_profile_role() = 'managing_partner')
  with check (public.current_profile_role() = 'managing_partner');
create policy matters_no_hard_delete on public.matters for delete to authenticated using (false);

create policy clients_select_authorized on public.clients for select to authenticated
  using (
    public.is_approved()
    and (
      public.current_profile_role() in ('operations_manager', 'managing_partner')
      or assigned_to = auth.uid()
    )
  );
create policy clients_insert_authorized on public.clients for insert to authenticated
  with check (
    public.is_approved()
    and public.current_profile_role() in ('operations_manager', 'managing_partner')
    and created_by = auth.uid()
  );
create policy clients_update_authorized on public.clients for update to authenticated
  using (public.can_edit_client(id))
  with check (public.can_edit_client(id));
create policy clients_no_hard_delete on public.clients for delete to authenticated using (false);

create policy documents_select_authorized on public.documents for select to authenticated using (
  (deleted_at is null or public.current_profile_role() = 'managing_partner')
  and (
    public.current_profile_role() in ('operations_manager', 'managing_partner')
    or (client_id is not null and public.can_edit_client(client_id))
    or (matter_id is not null and public.can_access_matter(matter_id))
    or (
      public.current_profile_role() <> 'legal_officer'
      and matter_id is null and client_id is null
      and (created_by = auth.uid() or entered_by = auth.uid())
    )
  )
);
create policy documents_insert_draft on public.documents for insert to authenticated with check (
  public.is_approved()
  and public.current_profile_role() in ('legal_officer', 'operations_manager', 'managing_partner')
  and created_by = auth.uid()
  and status = 'draft'
  and (
    (client_id is not null and public.can_edit_client(client_id))
    or (matter_id is not null and public.can_edit_matter(matter_id))
      or (
        matter_id is null and client_id is null
        and public.current_profile_role() in ('operations_manager', 'managing_partner')
      )
  )
);
create policy documents_update_workflow on public.documents for update to authenticated
  using (
    (
      public.current_profile_role() = 'legal_officer'
      and status = 'draft'
      and (matter_id is null or exists(select 1 from public.matters m where m.id = matter_id and m.matter_status = 'open'))
      and (
        (client_id is not null and public.can_edit_client(client_id))
        or (matter_id is not null and public.can_edit_matter(matter_id))
      )
    )
    or (
      public.current_profile_role() = 'operations_manager'
      and status in ('submitted', 'in_ops_review')
      and (matter_id is null or exists(select 1 from public.matters m where m.id = matter_id and m.matter_status = 'open'))
    )
    or (
      public.current_profile_role() = 'managing_partner'
      and status = 'awaiting_partner_approval'
      and (matter_id is null or exists(select 1 from public.matters m where m.id = matter_id and m.matter_status = 'open'))
    )
  )
  with check (
    (
      public.current_profile_role() = 'legal_officer'
      and status in ('draft', 'submitted')
      and (matter_id is null or exists(select 1 from public.matters m where m.id = matter_id and m.matter_status = 'open'))
      and (
        (client_id is not null and public.can_edit_client(client_id))
        or (matter_id is not null and public.can_edit_matter(matter_id))
      )
    )
    or (
      public.current_profile_role() = 'operations_manager'
      and status in ('submitted', 'in_ops_review', 'awaiting_partner_approval')
      and (matter_id is null or exists(select 1 from public.matters m where m.id = matter_id and m.matter_status = 'open'))
    )
    or (
      public.current_profile_role() = 'managing_partner'
      and status in ('awaiting_partner_approval', 'approved', 'in_ops_review')
      and (matter_id is null or exists(select 1 from public.matters m where m.id = matter_id and m.matter_status = 'open'))
    )
  );
drop policy if exists documents_cleanup_incomplete_draft on public.documents;
create policy documents_cleanup_incomplete_draft on public.documents for update to authenticated
  using (created_by = auth.uid() and status = 'draft' and deleted_at is null and storage_path is null)
  with check (created_by = auth.uid() and status = 'draft' and deleted_at is not null and storage_path is null);
create policy documents_soft_delete_managing_partner on public.documents for update to authenticated
  using (public.current_profile_role() = 'managing_partner')
  with check (public.current_profile_role() = 'managing_partner');
create policy documents_no_hard_delete on public.documents for delete to authenticated using (false);

create policy matter_access_select on public.matter_access for select to authenticated
  using (
    public.current_profile_role() in ('operations_manager', 'managing_partner')
    or public.can_access_matter(matter_id)
  );
create policy matter_access_manage on public.matter_access for all to authenticated
  using (public.current_profile_role() = 'operations_manager')
  with check (public.current_profile_role() = 'operations_manager' and granted_by = auth.uid());

create policy matter_notes_select on public.matter_notes for select to authenticated
  using (deleted_at is null and public.can_access_matter(matter_id));
create policy matter_notes_insert on public.matter_notes for insert to authenticated
  with check (public.can_edit_matter(matter_id) and coalesce(created_by, auth.uid()) = auth.uid());
create policy matter_notes_update_author on public.matter_notes for update to authenticated
  using (public.can_edit_matter(matter_id))
  with check (public.can_edit_matter(matter_id));
create policy matter_notes_no_hard_delete on public.matter_notes for delete to authenticated using (false);

create policy matter_tasks_select on public.matter_tasks for select to authenticated
  using (deleted_at is null and public.can_access_matter(matter_id));
create policy matter_tasks_insert on public.matter_tasks for insert to authenticated
  with check (public.can_edit_matter(matter_id) and coalesce(created_by, auth.uid()) = auth.uid());
create policy matter_tasks_update on public.matter_tasks for update to authenticated
  using (deleted_at is null and public.can_edit_matter(matter_id))
  with check (public.can_edit_matter(matter_id));
create policy matter_tasks_no_hard_delete on public.matter_tasks for delete to authenticated using (false);

create policy lexora_deadlines_select on public.deadlines for select to authenticated
  using (public.can_access_matter(matter_id));
create policy lexora_deadlines_insert on public.deadlines for insert to authenticated
  with check (
    public.can_edit_matter(matter_id)
    and coalesce(created_by, auth.uid()) = auth.uid()
    and exists(select 1 from public.matters m where m.id = matter_id and m.matter_status = 'open')
  );
create policy lexora_deadlines_update on public.deadlines for update to authenticated
  using (
    public.can_edit_matter(matter_id)
    and exists(select 1 from public.matters m where m.id = matter_id and m.matter_status = 'open')
  )
  with check (public.can_edit_matter(matter_id));
create policy lexora_deadlines_no_delete on public.deadlines for delete to authenticated using (false);

create policy fee_notes_select on public.fee_notes for select to authenticated
  using (public.current_profile_role() in ('operations_manager', 'managing_partner') or public.can_access_matter(matter_id));
create policy fee_notes_insert on public.fee_notes for insert to authenticated
  with check (
    public.is_approved()
    and created_by = auth.uid()
    and public.can_edit_client(client_id)
    and public.can_edit_matter(matter_id)
  );
create policy fee_notes_update on public.fee_notes for update to authenticated
  using (public.can_edit_client(client_id) and public.can_edit_matter(matter_id))
  with check (public.can_edit_client(client_id) and public.can_edit_matter(matter_id));
create policy fee_notes_no_hard_delete on public.fee_notes for delete to authenticated using (false);

create policy payments_select on public.payments for select to authenticated
  using (public.current_profile_role() in ('operations_manager', 'managing_partner') or public.can_access_matter(matter_id));
create policy payments_insert on public.payments for insert to authenticated
  with check (
    public.is_approved()
    and created_by = auth.uid()
    and public.can_edit_client(client_id)
    and public.can_edit_matter(matter_id)
  );
create policy payments_no_update on public.payments for update to authenticated using (false) with check (false);
create policy payments_no_hard_delete on public.payments for delete to authenticated using (false);

create policy document_activity_select on public.document_activity for select to authenticated using (
  public.current_profile_role() in ('operations_manager', 'managing_partner')
  or exists(
    select 1 from public.documents d
    where d.id = document_id
      and (
        (d.client_id is not null and public.can_edit_client(d.client_id))
        or (d.matter_id is not null and public.can_access_matter(d.matter_id))
        or (
          public.current_profile_role() <> 'legal_officer'
          and d.matter_id is null and d.client_id is null
          and (d.created_by = auth.uid() or d.entered_by = auth.uid())
        )
      )
  )
);
create policy document_versions_select on public.document_versions for select to authenticated using (
  public.current_profile_role() in ('operations_manager', 'managing_partner')
  or exists(
    select 1 from public.documents d
    where d.id = document_id
      and (
        (d.client_id is not null and public.can_edit_client(d.client_id))
        or (d.matter_id is not null and public.can_access_matter(d.matter_id))
        or (
          public.current_profile_role() <> 'legal_officer'
          and d.matter_id is null and d.client_id is null
          and (d.created_by = auth.uid() or d.entered_by = auth.uid())
        )
      )
  )
);
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
              or (
                d.matter_id is not null
                and public.can_edit_matter(d.matter_id)
                and exists(select 1 from public.matters m where m.id = d.matter_id and m.matter_status = 'open')
                or (
                  d.matter_id is null and d.client_id is null
                  and public.current_profile_role() in ('operations_manager', 'managing_partner')
                  and (d.created_by = auth.uid() or d.entered_by = auth.uid())
                )
              )
            )
          )
          or (
            d.matter_id is not null
            and public.current_profile_role() in ('operations_manager', 'managing_partner')
            and exists(select 1 from public.matters m where m.id = d.matter_id and m.matter_status = 'closed')
          )
        )
    )
  );

create policy lexora_document_storage_read on storage.objects for select to authenticated using (
  bucket_id = 'lexora-documents'
  and (
    public.current_profile_role() in ('operations_manager', 'managing_partner')
    or exists(
      select 1 from public.documents d
      where d.storage_path = name
        and (
          (d.client_id is not null and public.can_edit_client(d.client_id))
          or (d.matter_id is not null and public.can_access_matter(d.matter_id))
          or (
            public.current_profile_role() <> 'legal_officer'
            and d.matter_id is null and d.client_id is null
            and (d.created_by = auth.uid() or d.entered_by = auth.uid())
          )
        )
    )
    or exists(
      select 1 from public.document_versions v
      join public.documents d on d.id = v.document_id
      where v.storage_path = name
        and (
          (d.client_id is not null and public.can_edit_client(d.client_id))
          or (d.matter_id is not null and public.can_access_matter(d.matter_id))
          or (
            public.current_profile_role() <> 'legal_officer'
            and d.matter_id is null and d.client_id is null
            and (d.created_by = auth.uid() or d.entered_by = auth.uid())
          )
        )
    )
  )
);
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
create policy lexora_document_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lexora-documents'
    and split_part(name, '/', 1) = auth.uid()::text
    and public.can_upload_document_object(split_part(name, '/', 2))
  );

create policy profiles_select_roles on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.current_profile_role() = 'managing_partner'
  or (
    public.current_profile_role() = 'operations_manager'
    and role = 'legal_officer'
    and status::text = 'approved'
  )
);
create policy profiles_update_managing_partner on public.profiles for update to authenticated
  using (public.current_profile_role() = 'managing_partner')
  with check (public.current_profile_role() = 'managing_partner');
create policy profiles_insert_self_pending on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'legal_officer' and status::text = 'pending');

create policy advisory_select_roles on public.advisory_requests for select to authenticated
  using (deleted_at is null and public.is_approved() and public.current_profile_role() in ('legal_officer', 'operations_manager', 'managing_partner'));
create policy advisory_insert_roles on public.advisory_requests for insert to authenticated
  with check (public.is_approved() and created_by = auth.uid());
create policy advisory_update_submitter_or_manager on public.advisory_requests for update to authenticated
  using (public.is_approved() and (created_by = auth.uid() or public.current_profile_role() in ('operations_manager', 'managing_partner')))
  with check (public.is_approved() and (created_by = auth.uid() or public.current_profile_role() in ('operations_manager', 'managing_partner')));
create policy advisory_no_hard_delete on public.advisory_requests for delete to authenticated using (false);

create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_insert_system on public.notifications for insert to authenticated
  with check (public.current_profile_role() = 'managing_partner');

create policy audit_logs_select_authorized on public.audit_logs for select to authenticated
  using (
    public.current_profile_role() in ('managing_partner', 'operations_manager')
    or (target_id is not null and public.can_access_matter(target_id))
  );
create policy audit_logs_insert_self on public.audit_logs for insert to authenticated
  with check (public.is_approved() and performed_by = auth.uid());

commit;