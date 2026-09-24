-- LEXORA role, document workflow, audit, and row-level security policies.

begin;

alter table public.profiles alter column role set default 'legal_officer'::public.app_role;
alter table public.profiles add constraint profiles_role_check
  check (role::text in ('legal_officer', 'operations_manager', 'managing_partner'));
alter table public.documents alter column status set default 'draft';
alter table public.documents add constraint documents_workflow_status_check
  check (status in ('draft', 'submitted', 'in_ops_review', 'awaiting_partner_approval', 'approved'));
alter table public.documents add constraint documents_sha256_format_check
  check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');

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
  ) then
    raise exception 'Legal Officers cannot change matter ownership or assignment';
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
  if (new.assigned_to is distinct from old.assigned_to)
     and actor_role not in ('operations_manager','managing_partner') then
    raise exception 'Only Operations Managers can assign matters';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists enforce_matter_update_scope on public.matters;
create trigger enforce_matter_update_scope before update on public.matters
for each row execute function public.enforce_matter_update_scope();

create or replace function public.log_matter_soft_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.audit_logs(action, performed_by, target_id, resource, details)
    values ('SOFT_DELETE', auth.uid(), new.id, 'Matter', 'Matter soft-deleted by Managing Partner');
  end if;
  return new;
end;
$$;
drop trigger if exists matters_log_soft_delete on public.matters;
create trigger matters_log_soft_delete after update of deleted_at on public.matters
for each row execute function public.log_matter_soft_delete();

create table if not exists public.document_activity (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp()
);
create index if not exists document_activity_document_time_idx
  on public.document_activity(document_id, occurred_at desc);
alter table public.document_activity enable row level security;

-- Supabase Storage does not currently support S3 object versioning. Keep every
-- revision under a distinct immutable object key and track it in this table.
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  storage_path text not null unique,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint not null check (size_bytes >= 0),
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(document_id, version_number)
);
create index if not exists document_versions_document_idx on public.document_versions(document_id, version_number desc);
alter table public.document_versions enable row level security;
revoke update, delete, truncate on public.document_versions from public, anon, authenticated, service_role;
create or replace function public.prevent_document_version_mutation()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Document versions are immutable'; end;
$$;
drop trigger if exists document_versions_immutable on public.document_versions;
create trigger document_versions_immutable before update or delete on public.document_versions
for each row execute function public.prevent_document_version_mutation();
create or replace function public.log_document_version_added()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.document_activity(document_id, actor_id, action, details)
  values (new.document_id, new.uploaded_by, 'version_added', jsonb_build_object('version_number',new.version_number,'sha256',new.content_sha256,'size_bytes',new.size_bytes));
  return new;
end;
$$;
drop trigger if exists document_versions_log_added on public.document_versions;
create trigger document_versions_log_added after insert on public.document_versions
for each row execute function public.log_document_version_added();

create or replace function public.prevent_document_activity_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Document activity is append-only';
end;
$$;
drop trigger if exists document_activity_immutable on public.document_activity;
create trigger document_activity_immutable
before update or delete on public.document_activity
for each row execute function public.prevent_document_activity_mutation();
revoke update, delete, truncate on public.document_activity from public, anon, authenticated, service_role;
revoke insert on public.document_activity from public, anon, authenticated;

create or replace function public.log_document_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.document_activity(document_id, actor_id, action, from_status, to_status)
    values (new.id, auth.uid(), 'created', null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.document_activity(document_id, actor_id, action, from_status, to_status)
    values (new.id, auth.uid(), 'status_changed', old.status, new.status);
  end if;
  return new;
end;
$$;
drop trigger if exists documents_log_status_change on public.documents;
create trigger documents_log_status_change
after insert or update of status on public.documents
for each row execute function public.log_document_status_change();

create or replace function public.enforce_document_workflow_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_role text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  actor_role := public.current_profile_role()::text;
  if actor_role is null then
    raise exception 'A verified, approved caller is required to change document status';
  end if;
  if old.matter_id is not null and exists (
    select 1 from public.matters m where m.id=old.matter_id and m.matter_status='closed'
  ) then
    raise exception 'Documents on closed matters are read-only';
  end if;
  if not (
    (actor_role='legal_officer' and old.status='draft' and new.status='submitted' and old.created_by=auth.uid())
    or (actor_role='operations_manager' and old.status='submitted' and new.status='in_ops_review')
    or (actor_role='operations_manager' and old.status='in_ops_review' and new.status in ('awaiting_partner_approval','submitted'))
    or (actor_role='managing_partner' and old.status='awaiting_partner_approval' and new.status in ('approved','in_ops_review'))
  ) then
    raise exception 'Document status transition is not allowed for role %: % -> %', actor_role, old.status, new.status;
  end if;
  return new;
end;
$$;
drop trigger if exists documents_enforce_workflow_transition on public.documents;
create trigger documents_enforce_workflow_transition
before update of status on public.documents
for each row execute function public.enforce_document_workflow_transition();

create or replace function public.can_access_matter(target_matter_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.matters m
    where m.id = target_matter_id and m.deleted_at is null
      and public.current_profile_role() in ('legal_officer', 'operations_manager', 'managing_partner')
      and (
        public.current_profile_role() in ('operations_manager', 'managing_partner')
        or m.created_by = auth.uid() or m.entered_by = auth.uid() or m.assigned_to = auth.uid()
        or exists(select 1 from public.matter_access ma where ma.matter_id=m.id and ma.user_id=auth.uid())
      )
  )
$$;

-- Grant each LEXORA table its first explicit access policies.
create policy matters_select_authorized on public.matters for select to authenticated
  using (public.can_access_matter(id));
create policy matters_insert_authorized on public.matters for insert to authenticated
  with check (public.current_profile_role() in ('legal_officer','operations_manager','managing_partner') and created_by=auth.uid() and client_id is not null and practice_area <> 'needs_review' and matter_status='open' and closed_at is null);
create policy matters_update_open_authorized on public.matters for update to authenticated
  using (public.can_access_matter(id) and matter_status='open' and public.current_profile_role() in ('legal_officer','operations_manager','managing_partner'))
  with check (public.can_access_matter(id) and public.current_profile_role() in ('legal_officer','operations_manager','managing_partner'));
create policy matters_soft_delete_managing_partner on public.matters for update to authenticated
  using (public.current_profile_role()='managing_partner') with check (public.current_profile_role()='managing_partner');
create policy matters_no_hard_delete on public.matters for delete to authenticated using (false);

create policy clients_select_authorized on public.clients for select to authenticated using (
  public.current_profile_role() in ('operations_manager','managing_partner')
  or created_by=auth.uid()
  or exists(select 1 from public.matters m where m.client_id=clients.id and public.can_access_matter(m.id))
);
create policy clients_insert_authorized on public.clients for insert to authenticated
  with check (public.current_profile_role() in ('legal_officer','operations_manager','managing_partner') and created_by=auth.uid());
create policy clients_update_authorized on public.clients for update to authenticated
  using (public.current_profile_role() in ('operations_manager','managing_partner') or (public.current_profile_role()='legal_officer' and created_by=auth.uid()))
  with check (public.current_profile_role() in ('operations_manager','managing_partner') or (public.current_profile_role()='legal_officer' and created_by=auth.uid()));
create policy clients_no_hard_delete on public.clients for delete to authenticated using (false);

create policy documents_select_authorized on public.documents for select to authenticated using (
  (deleted_at is null or public.current_profile_role()='managing_partner')
  and (public.current_profile_role()='managing_partner'
    or (matter_id is not null and public.can_access_matter(matter_id))
    or (matter_id is null and (created_by=auth.uid() or entered_by=auth.uid())))
);
create policy documents_insert_draft on public.documents for insert to authenticated with check (
  public.current_profile_role() in ('legal_officer','operations_manager','managing_partner')
  and created_by=auth.uid() and status='draft'
  and (matter_id is null or (public.can_access_matter(matter_id) and exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open')))
);
create policy documents_update_workflow on public.documents for update to authenticated
  using (
    (public.current_profile_role()='legal_officer' and created_by=auth.uid() and status='draft' and coalesce(matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'), true))
    or (public.current_profile_role()='operations_manager' and status in ('submitted','in_ops_review') and coalesce(matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'), true))
    or (public.current_profile_role()='managing_partner' and status='awaiting_partner_approval' and coalesce(matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'), true))
  )
  with check (
    (public.current_profile_role()='legal_officer' and created_by=auth.uid() and status in ('draft','submitted') and coalesce(matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'), true))
    or (public.current_profile_role()='operations_manager' and status in ('submitted','in_ops_review','awaiting_partner_approval') and coalesce(matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'), true))
    or (public.current_profile_role()='managing_partner' and status in ('awaiting_partner_approval','approved','in_ops_review') and coalesce(matter_id is null or exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'), true))
  );
create policy documents_soft_delete_managing_partner on public.documents for update to authenticated
  using (public.current_profile_role()='managing_partner') with check (public.current_profile_role()='managing_partner');
create policy documents_no_hard_delete on public.documents for delete to authenticated using (false);

create or replace function public.guard_document_sensitive_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id is distinct from old.id or new.created_by is distinct from old.created_by
     or new.entered_by is distinct from old.entered_by or new.client_id is distinct from old.client_id
     or new.matter_id is distinct from old.matter_id then
    raise exception 'Document identity and ownership fields are immutable';
  end if;
  return new;
end;
$$;
drop trigger if exists documents_guard_sensitive_update on public.documents;
create trigger documents_guard_sensitive_update before update on public.documents
for each row execute function public.guard_document_sensitive_update();

create or replace function public.log_document_soft_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.document_activity(document_id, actor_id, action, details)
    values (new.id, auth.uid(), 'soft_deleted', jsonb_build_object('deleted_at', new.deleted_at));
  end if;
  return new;
end;
$$;
drop trigger if exists documents_log_soft_delete on public.documents;
create trigger documents_log_soft_delete after update of deleted_at on public.documents
for each row execute function public.log_document_soft_delete();

create policy matter_access_select on public.matter_access for select to authenticated using (
  user_id=auth.uid() or public.current_profile_role() in ('operations_manager','managing_partner')
);
create policy matter_access_manage on public.matter_access for all to authenticated
  using (public.current_profile_role()='operations_manager')
  with check (public.current_profile_role()='operations_manager' and granted_by=auth.uid());

create policy matter_notes_select on public.matter_notes for select to authenticated using (deleted_at is null and public.can_access_matter(matter_id));
create policy matter_notes_insert on public.matter_notes for insert to authenticated with check (public.can_access_matter(matter_id) and coalesce(created_by,auth.uid())=auth.uid());
create policy matter_notes_update_author on public.matter_notes for update to authenticated using (created_by=auth.uid() and public.can_access_matter(matter_id)) with check (created_by=auth.uid() and public.can_access_matter(matter_id));
create policy matter_notes_no_hard_delete on public.matter_notes for delete to authenticated using (false);
create policy matter_tasks_select on public.matter_tasks for select to authenticated using (deleted_at is null and public.can_access_matter(matter_id));
create policy matter_tasks_insert on public.matter_tasks for insert to authenticated with check (public.can_access_matter(matter_id) and coalesce(created_by,auth.uid())=auth.uid());
create policy matter_tasks_update on public.matter_tasks for update to authenticated using (public.can_access_matter(matter_id) and (created_by=auth.uid() or assigned_to=auth.uid() or public.current_profile_role() in ('operations_manager','managing_partner'))) with check (public.can_access_matter(matter_id));
create policy matter_tasks_no_hard_delete on public.matter_tasks for delete to authenticated using (false);

create policy lexora_deadlines_select on public.deadlines for select to authenticated
  using (public.can_access_matter(matter_id));
create policy lexora_deadlines_insert on public.deadlines for insert to authenticated
  with check (public.can_access_matter(matter_id) and coalesce(created_by,auth.uid())=auth.uid()
    and exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'));
create policy lexora_deadlines_update on public.deadlines for update to authenticated
  using (public.can_access_matter(matter_id) and exists(select 1 from public.matters m where m.id=matter_id and m.matter_status='open'))
  with check (public.can_access_matter(matter_id));
create policy lexora_deadlines_no_delete on public.deadlines for delete to authenticated using (false);

create policy fee_notes_select on public.fee_notes for select to authenticated using (
  public.current_profile_role() in ('operations_manager','managing_partner') or public.can_access_matter(matter_id)
);
create policy fee_notes_insert on public.fee_notes for insert to authenticated with check (public.current_profile_role() in ('operations_manager','managing_partner') and created_by=auth.uid() and public.can_access_matter(matter_id));
create policy fee_notes_update on public.fee_notes for update to authenticated using (public.current_profile_role() in ('operations_manager','managing_partner')) with check (public.current_profile_role() in ('operations_manager','managing_partner'));
create policy fee_notes_no_hard_delete on public.fee_notes for delete to authenticated using (false);
create policy payments_select on public.payments for select to authenticated using (
  public.current_profile_role() in ('operations_manager','managing_partner') or public.can_access_matter(matter_id)
);
create policy payments_insert on public.payments for insert to authenticated with check (public.current_profile_role() in ('operations_manager','managing_partner') and created_by=auth.uid() and public.can_access_matter(matter_id));
create policy payments_no_update on public.payments for update to authenticated using (false) with check (false);
create policy payments_no_hard_delete on public.payments for delete to authenticated using (false);

create policy document_activity_select on public.document_activity for select to authenticated using (
  public.current_profile_role() in ('managing_partner','operations_manager')
  or exists(select 1 from public.documents d where d.id=document_id and (public.can_access_matter(d.matter_id) or (d.matter_id is null and (d.created_by=auth.uid() or d.entered_by=auth.uid()))))
);
create policy document_versions_select on public.document_versions for select to authenticated using (
  public.current_profile_role()='managing_partner' or exists(select 1 from public.documents d where d.id=document_id and (d.matter_id is null or public.can_access_matter(d.matter_id)))
);
create policy document_versions_insert on public.document_versions for insert to authenticated with check (
  uploaded_by=auth.uid() and exists(
    select 1 from public.documents d where d.id=document_id and d.deleted_at is null
      and (
        (d.status='draft' and (d.matter_id is null or (public.can_access_matter(d.matter_id) and exists(select 1 from public.matters m where m.id=d.matter_id and m.matter_status='open'))))
        or (d.matter_id is not null and exists(select 1 from public.matters m where m.id=d.matter_id and m.matter_status='closed') and public.current_profile_role() in ('operations_manager','managing_partner'))
      )
  )
);

-- Files use immutable object keys in the dedicated LEXORA bucket.
create policy lexora_document_storage_read on storage.objects for select to authenticated
using (bucket_id='lexora-documents' and (
  exists(select 1 from public.documents d where d.storage_path=name and (public.current_profile_role()='managing_partner' or d.matter_id is null or public.can_access_matter(d.matter_id)))
  or exists(select 1 from public.document_versions v join public.documents d on d.id=v.document_id where v.storage_path=name and (public.current_profile_role()='managing_partner' or d.matter_id is null or public.can_access_matter(d.matter_id)))
));
create policy lexora_document_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id='lexora-documents' and public.current_profile_role() in ('legal_officer','operations_manager','managing_partner')
  and split_part(name,'/',1)=auth.uid()::text
  and exists(
    select 1 from public.documents d where d.id::text=split_part(name,'/',2) and d.deleted_at is null
      and (
        (d.status='draft' and (d.matter_id is null or exists(select 1 from public.matters m where m.id=d.matter_id and m.matter_status='open' and public.can_access_matter(m.id))))
        or (d.matter_id is not null and public.current_profile_role() in ('operations_manager','managing_partner') and exists(select 1 from public.matters m where m.id=d.matter_id and m.matter_status='closed'))
      )
  )
);

-- Profile, advisory, notification, and audit access policies.
create policy profiles_select_roles on public.profiles for select to authenticated using (
  id=auth.uid() or public.current_profile_role()='managing_partner'
  or (public.current_profile_role()='operations_manager' and role='legal_officer' and status::text='approved')
  
);
create policy profiles_update_managing_partner on public.profiles for update to authenticated
  using (public.current_profile_role()='managing_partner') with check (public.current_profile_role()='managing_partner');
create policy profiles_insert_self_pending on public.profiles for insert to authenticated
  with check (id=auth.uid() and role='legal_officer' and status::text='pending');
create policy advisory_select_roles on public.advisory_requests for select to authenticated
  using (deleted_at is null and public.is_approved() and public.current_profile_role() in ('legal_officer','operations_manager','managing_partner'));
create policy advisory_insert_roles on public.advisory_requests for insert to authenticated
  with check (public.is_approved() and created_by=auth.uid());
create policy advisory_update_submitter_or_manager on public.advisory_requests for update to authenticated
  using (public.is_approved() and (created_by=auth.uid() or public.current_profile_role() in ('operations_manager','managing_partner')))
  with check (public.is_approved() and (created_by=auth.uid() or public.current_profile_role() in ('operations_manager','managing_partner')));
create policy advisory_no_hard_delete on public.advisory_requests for delete to authenticated using (false);
create policy notifications_select_own on public.notifications for select to authenticated using (user_id=auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy notifications_insert_system on public.notifications for insert to authenticated with check (public.current_profile_role()='managing_partner');
create policy audit_logs_select_authorized on public.audit_logs for select to authenticated
  using (public.current_profile_role() in ('managing_partner','operations_manager') or (target_id is not null and public.can_access_matter(target_id)));
create policy audit_logs_insert_self on public.audit_logs for insert to authenticated
  with check (public.is_approved() and performed_by=auth.uid());

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name, role, status)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',new.email,'New User'), 'legal_officer', 'pending')
  on conflict (id) do update set email=excluded.email, full_name=excluded.full_name;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.delete_user_account(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target_user_id is null then raise exception 'A target user id is required'; end if;
  if auth.uid() is null or public.current_profile_role() <> 'managing_partner' then raise exception 'Only Managing Partner may irreversibly delete an account'; end if;
  if target_user_id=auth.uid() then raise exception 'You cannot delete your own account'; end if;
  insert into public.audit_logs(action,performed_by,target_id,resource,details)
  values ('IRREVERSIBLE_DELETE',auth.uid(),target_user_id,'Profile','Managing Partner permanently deleted a user account');
  delete from auth.users where id=target_user_id;
end;
$$;

-- Five-year review candidates for the retention dashboard/endpoint.
create or replace view public.matters_retention_review with (security_invoker = true) as
select m.id as matter_id, m.client_id, m.title, m.practice_area, m.closed_at,
       m.closed_at + interval '5 years' as minimum_retention_until,
       (m.closed_at + interval '5 years' <= now()) as retention_threshold_reached
from public.matters m
where m.matter_status='closed' and m.closed_at is not null;
grant select on public.matters_retention_review to authenticated;

create or replace function public.export_client_record(target_client_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'client', to_jsonb(c),
    'matters', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc) from public.matters m where m.client_id=c.id and m.deleted_at is null), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.documents d where d.client_id=c.id and d.deleted_at is null), '[]'::jsonb),
    'fee_notes', coalesce((select jsonb_agg(to_jsonb(f) order by f.issued_at desc) from public.fee_notes f where f.client_id=c.id and f.deleted_at is null), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_at desc) from public.payments p where p.client_id=c.id and p.deleted_at is null), '[]'::jsonb),
    'matter_notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.matter_notes n join public.matters m on m.id=n.matter_id where m.client_id=c.id and n.deleted_at is null), '[]'::jsonb),
    'matter_tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from public.matter_tasks t join public.matters m on m.id=t.matter_id where m.client_id=c.id and t.deleted_at is null), '[]'::jsonb),
    'deadlines', coalesce((select jsonb_agg(to_jsonb(dl) order by dl.due_date) from public.deadlines dl join public.matters m on m.id=dl.matter_id where m.client_id=c.id), '[]'::jsonb),
    'document_activity', coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at) from public.document_activity a join public.documents d on d.id=a.document_id where d.client_id=c.id), '[]'::jsonb)
  ) from public.clients c where c.id=target_client_id and c.deleted_at is null
$$;
grant execute on function public.export_client_record(uuid) to authenticated;

commit;
