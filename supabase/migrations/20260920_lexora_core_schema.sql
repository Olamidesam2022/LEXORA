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
]) on conflict(id) do nothing;
