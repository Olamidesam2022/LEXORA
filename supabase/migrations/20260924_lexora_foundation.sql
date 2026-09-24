-- LEXORA clients, matter relationships, billing, and retention schema.

begin;

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

commit;
