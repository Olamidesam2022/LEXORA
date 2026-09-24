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
