-- LEXORA fresh baseline: schema, workflow, and role-scoped RLS policies.
-- Run this entire file once in the SQL Editor of a new, empty Supabase project.

begin;

-- Source migration: 20260920_lexora_core_schema.sql
-- Fresh LEXORA schema. This migration does not import or rename LOMS tables.
create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('legal_officer','operations_manager','managing_partner');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.profile_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.app_role not null default 'legal_officer',
  status public.profile_status not null default 'pending',
  department text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'info' check (type in ('urgent','info','warning')),
  message text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.matters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete restrict,
  creator_email text,
  entered_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  practice_area text not null default 'needs_review',
  matter_status text not null default 'open',
  closed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matters_practice_area_check check (practice_area in ('corporate_commercial','ma','tech_ip','contracts','regulatory_compliance','corporate_secretarial','adr','litigation','needs_review')),
  constraint matters_matter_status_check check (matter_status in ('open','closed')),
  constraint matters_closed_at_consistency_check check ((matter_status='closed' and closed_at is not null) or (matter_status='open' and closed_at is null))
);

create table if not exists public.matter_access (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (matter_id,user_id)
);

create table if not exists public.matter_notes (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  is_private boolean not null default false,
  note_type text not null default 'note',
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.matter_tasks (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','in_progress','completed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  title text not null default 'Deadline',
  due_date date not null,
  status text not null default 'open',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.advisory_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  requested_by text not null,
  department text not null,
  due_date date,
  status text not null default 'Pending' check (status in ('Pending','In Progress','Completed','Urgent')),
  assigned_to text,
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('MoU','Court Process','Legal Opinion','Contract','Correspondence')),
  matter_id uuid references public.matters(id) on delete set null,
  storage_path text,
  mime_type text,
  version text not null default '1.0',
  uploaded_by text not null default 'Unknown uploader',
  size text not null default '0 MB',
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  entered_by uuid references auth.users(id) on delete set null,
  content_sha256 text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  performed_by uuid references auth.users(id) on delete set null,
  target_id uuid,
  resource text,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_status_idx on public.profiles(role,status);
create index if not exists notifications_user_read_idx on public.notifications(user_id,read);
create index if not exists matters_created_by_idx on public.matters(created_by);
create index if not exists matter_access_matter_user_idx on public.matter_access(matter_id,user_id);
create index if not exists matter_notes_matter_created_idx on public.matter_notes(matter_id,created_at desc);
create index if not exists matter_tasks_matter_status_idx on public.matter_tasks(matter_id,status);
create index if not exists matter_tasks_assigned_to_idx on public.matter_tasks(assigned_to);
create index if not exists deadlines_matter_due_idx on public.deadlines(matter_id,due_date);
create index if not exists advisory_requests_status_idx on public.advisory_requests(status);
create index if not exists advisory_requests_due_date_idx on public.advisory_requests(due_date);
create index if not exists audit_logs_performed_by_idx on public.audit_logs(performed_by);

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

create or replace function public.current_profile_role()
returns public.app_role language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid()
$$;
create or replace function public.current_profile_status()
returns public.profile_status language sql stable security definer set search_path=public as $$
  select status from public.profiles where id=auth.uid()
$$;
create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.current_profile_status()='approved',false)
$$;

create or replace function public.notify_managing_partners_new_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(type,message,user_id)
  select 'info','New user awaiting approval: ' || new.full_name || ' (' || new.email || ')',p.id
  from public.profiles p where p.role='managing_partner' and p.status='approved';
  return new;
end;
$$;
drop trigger if exists on_profile_created_notify_managing_partners on public.profiles;
create trigger on_profile_created_notify_managing_partners after insert on public.profiles
for each row execute function public.notify_managing_partners_new_profile();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('lexora-documents','lexora-documents',false,52428800,array[
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','image/png','image/jpeg'
]) on conflict(id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- Source migration: 20260922_document_uploader_names.sql
-- The LEXORA core migration creates documents with matter_id and the final
-- workflow columns. Keep this migration focused on uploader-name normalization.

create or replace function public.normalize_document_uploader_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uploader_name text;
begin
  if NEW.uploaded_by is null or trim(NEW.uploaded_by) = '' then
    select full_name into uploader_name
    from public.profiles
    where id = coalesce(NEW.created_by, auth.uid())
    limit 1;

    if uploader_name is null or trim(uploader_name) = '' then
      uploader_name := 'Unknown uploader';
    end if;

    NEW.uploaded_by := uploader_name;
  elsif NEW.uploaded_by ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    select full_name into uploader_name
    from public.profiles
    where id::text = NEW.uploaded_by
    limit 1;

    if uploader_name is null or trim(uploader_name) = '' then
      select full_name into uploader_name
      from public.profiles
      where id = coalesce(NEW.created_by, auth.uid())
      limit 1;
    end if;

    if uploader_name is null or trim(uploader_name) = '' then
      uploader_name := 'Unknown uploader';
    end if;

    NEW.uploaded_by := uploader_name;
  end if;

  return NEW;
end;
$$;

drop trigger if exists documents_normalize_uploader_name on public.documents;
create trigger documents_normalize_uploader_name
before insert or update on public.documents
for each row
execute function public.normalize_document_uploader_name();


-- Source migration: 20260924_lexora_foundation.sql
-- LEXORA clients, matter relationships, billing, and retention schema.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  legal_name text,
  client_type text not null default 'organization'
    check (client_type in ('individual', 'organization')),
  email text,
  phone text,
  address text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists clients_display_name_search_idx
  on public.clients using gin (to_tsvector('simple', coalesce(display_name, '') || ' ' || coalesce(legal_name, '')));

alter table public.matters
  add column if not exists client_id uuid references public.clients(id) on delete restrict,
  add column if not exists practice_area text not null default 'needs_review',
  add column if not exists matter_status text not null default 'open',
  add column if not exists closed_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists matters_client_status_idx on public.matters(client_id, matter_status);
create index if not exists matters_practice_status_idx on public.matters(practice_area, matter_status);
create index if not exists matters_retention_idx on public.matters(closed_at) where matter_status = 'closed';

alter table public.documents
  add column if not exists client_id uuid references public.clients(id) on delete restrict,
  add column if not exists content_sha256 text,
  add column if not exists deleted_at timestamptz;

alter table public.advisory_requests add column if not exists deleted_at timestamptz;
alter table public.matter_notes add column if not exists deleted_at timestamptz;
alter table public.matter_tasks add column if not exists deleted_at timestamptz;

create table if not exists public.fee_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  matter_id uuid not null references public.matters(id) on delete restrict,
  reference text not null unique,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null default 'NGN',
  issued_at date not null default current_date,
  due_at date,
  status text not null default 'issued' check (status in ('draft', 'issued', 'part_paid', 'paid', 'void')),
  file_document_id uuid references public.documents(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  matter_id uuid not null references public.matters(id) on delete restrict,
  fee_note_id uuid references public.fee_notes(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'NGN',
  paid_at timestamptz not null default now(),
  payment_method text,
  reference text,
  proof_document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create or replace function public.validate_and_apply_fee_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare fee public.fee_notes%rowtype; total_paid numeric;
begin
  if new.fee_note_id is null then return new; end if;
  select * into fee from public.fee_notes where id=new.fee_note_id for update;
  if not found then raise exception 'Fee note not found'; end if;
  if fee.status in ('draft','void') then raise exception 'Payments cannot be applied to a draft or void fee note'; end if;
  if fee.currency <> new.currency then raise exception 'Payment currency must match the fee note currency'; end if;
  select coalesce(sum(amount),0) into total_paid from public.payments where fee_note_id=new.fee_note_id;
  total_paid := total_paid + new.amount;
  update public.fee_notes
    set status=case when total_paid >= fee.amount then 'paid' else 'part_paid' end,
        updated_at=now()
    where id=new.fee_note_id;
  return new;
end;
$$;
drop trigger if exists payments_validate_and_apply_fee on public.payments;
create trigger payments_validate_and_apply_fee before insert on public.payments
for each row execute function public.validate_and_apply_fee_payment();

-- Composite foreign keys prevent an otherwise-valid id from being paired with a
-- different client or matter in billing records.
do $$
declare c record;
begin
  if not exists (select 1 from pg_constraint where conname='matters_id_client_unique' and conrelid='public.matters'::regclass) then
    alter table public.matters add constraint matters_id_client_unique unique(id, client_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fee_notes_id_client_matter_unique' and conrelid='public.fee_notes'::regclass) then
    alter table public.fee_notes add constraint fee_notes_id_client_matter_unique unique(id, client_id, matter_id);
  end if;
  for c in select conname from pg_constraint where conrelid='public.payments'::regclass and contype='f'
    and confrelid='public.fee_notes'::regclass loop
    execute format('alter table public.payments drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conname='fee_notes_matter_client_fkey' and conrelid='public.fee_notes'::regclass) then
    alter table public.fee_notes add constraint fee_notes_matter_client_fkey
      foreign key(matter_id,client_id) references public.matters(id,client_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='payments_matter_client_fkey' and conrelid='public.payments'::regclass) then
    alter table public.payments add constraint payments_matter_client_fkey
      foreign key(matter_id,client_id) references public.matters(id,client_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='payments_fee_note_client_matter_fkey' and conrelid='public.payments'::regclass) then
    alter table public.payments add constraint payments_fee_note_client_matter_fkey
      foreign key(fee_note_id,client_id,matter_id) references public.fee_notes(id,client_id,matter_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='documents_matter_client_fkey' and conrelid='public.documents'::regclass) then
    alter table public.documents add constraint documents_matter_client_fkey
      foreign key(matter_id,client_id) references public.matters(id,client_id) on delete restrict;
  end if;
end $$;

create index if not exists fee_notes_client_matter_idx on public.fee_notes(client_id, matter_id, issued_at desc);
create index if not exists payments_client_matter_idx on public.payments(client_id, matter_id, paid_at desc);
create index if not exists payments_fee_note_idx on public.payments(fee_note_id) where fee_note_id is not null;

-- Retention decisions are surfaced; this view does not delete or archive records.
create or replace view public.matters_retention_review with (security_invoker = true) as
select m.id as matter_id, m.client_id, m.title, m.practice_area, m.closed_at,
       m.closed_at + interval '5 years' as minimum_retention_until,
       (m.closed_at + interval '5 years' <= now()) as retention_threshold_reached
from public.matters m
where m.matter_status = 'closed' and m.closed_at is not null;
revoke all on public.matters_retention_review from anon, authenticated;

alter table public.clients enable row level security;
alter table public.fee_notes enable row level security;
alter table public.payments enable row level security;


-- Source migration: 20260925120000_client_type_other.sql

alter table public.clients
  drop constraint if exists clients_client_type_check;

alter table public.clients
  add constraint clients_client_type_check
  check (client_type in ('individual', 'organization', 'other'));


-- Source migration: 20260926_lexora_workflow_security.sql
-- LEXORA role, document workflow, audit, and row-level security policies.

alter table public.profiles alter column role set default 'legal_officer'::public.app_role;
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

-- A remote schema reset can leave managed Auth accounts in place while
-- rebuilding public.profiles. Recreate existing profiles in a safe pending
-- state; never trust user metadata to restore privileged roles.
insert into public.profiles(id, email, full_name, role, status)
select
  u.id,
  coalesce(u.email, u.id::text || '@no-email.invalid'),
  coalesce(u.raw_user_meta_data->>'full_name', u.email, 'Existing User'),
  'legal_officer',
  'pending'
from auth.users u
on conflict (id) do nothing;

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


-- Source migration: 20260927090000_legal_officer_assigned_client_edits.sql

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
      or (
        matter_id is null and client_id is null
        and public.current_profile_role() in ('operations_manager', 'managing_partner')
      )
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

commit;

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

drop policy if exists documents_cleanup_incomplete_draft on public.documents;
create policy documents_cleanup_incomplete_draft on public.documents for update to authenticated
  using (created_by = auth.uid() and status = 'draft' and deleted_at is null and storage_path is null)
  with check (created_by = auth.uid() and status = 'draft' and deleted_at is not null and storage_path is null);

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
