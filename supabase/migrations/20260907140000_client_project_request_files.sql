-- Client attachments on project requests.
-- Reuses public.project_files and the existing "photos" storage bucket.
-- Does not create a new table. Column changes are no-ops when already present.

do $$
begin
  if to_regclass('public.project_files') is null then
    raise exception 'project_files is not available';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_files'
      and column_name = 'project_request_id'
  ) then
    alter table public.project_files
      add column project_request_id uuid references public.project_requests (id) on delete set null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_files'
      and column_name = 'project_id'
      and is_nullable = 'NO'
  ) then
    alter table public.project_files alter column project_id drop not null;
  end if;
end;
$$;

create index if not exists project_files_project_request_id_idx
  on public.project_files (project_request_id)
  where deleted_at is null;

alter table public.project_files enable row level security;

drop policy if exists "Clients can view own request files" on public.project_files;
create policy "Clients can view own request files"
on public.project_files
for select
to authenticated
using (
  uploaded_by = auth.uid()
  or exists (
    select 1
    from public.project_requests pr
    where pr.id = project_files.project_request_id
      and pr.client_id = auth.uid()
  )
  or exists (
    select 1
    from public.projects p
    where p.id = project_files.project_id
      and p.client_id = auth.uid()
      and project_files.is_public = true
  )
);

drop policy if exists "Clients can insert own request files" on public.project_files;
create policy "Clients can insert own request files"
on public.project_files
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and bucket_name = 'photos'
  and project_request_id is not null
  and exists (
    select 1
    from public.project_requests pr
    where pr.id = project_request_id
      and pr.client_id = auth.uid()
      and pr.status in ('draft', 'new', 'reviewing', 'quoted', 'rejected')
      and not exists (
        select 1 from public.projects p where p.request_id = pr.id
      )
  )
);

drop policy if exists "Clients can update own request files" on public.project_files;
create policy "Clients can update own request files"
on public.project_files
for update
to authenticated
using (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.project_requests pr
    where pr.id = project_files.project_request_id
      and pr.client_id = auth.uid()
      and pr.status in ('draft', 'new', 'reviewing', 'quoted', 'rejected')
      and not exists (
        select 1 from public.projects p where p.request_id = pr.id
      )
  )
)
with check (
  uploaded_by = auth.uid()
);

grant select, insert, update on public.project_files to authenticated;

drop policy if exists "Clients can upload project request files" on storage.objects;
create policy "Clients can upload project request files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = 'project-requests'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Clients can update project request files" on storage.objects;
create policy "Clients can update project request files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = 'project-requests'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = 'project-requests'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Clients can delete project request files" on storage.objects;
create policy "Clients can delete project request files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = 'project-requests'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create or replace function public.link_request_files_to_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.request_id is not null and to_regclass('public.project_files') is not null then
    update public.project_files
    set project_id = new.id
    where project_request_id = new.request_id
      and project_id is null
      and deleted_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists link_request_files_to_project on public.projects;
create trigger link_request_files_to_project
after insert on public.projects
for each row
execute function public.link_request_files_to_project();
