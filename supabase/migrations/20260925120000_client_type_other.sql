begin;

alter table public.clients
  drop constraint if exists clients_client_type_check;

alter table public.clients
  add constraint clients_client_type_check
  check (client_type in ('individual', 'organization', 'other'));

commit;