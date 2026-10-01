-- Multiple project/team notification recipients.
-- Additive and backward-compatible: the legacy backup_email columns remain in place.

create table if not exists public.project_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  project_request_id uuid references public.project_requests (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  constraint project_notification_recipients_one_parent_chk
    check ((project_id is not null) <> (project_request_id is not null)),
  constraint project_notification_recipients_email_chk
    check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create unique index if not exists project_notification_recipients_project_email_uidx
  on public.project_notification_recipients (project_id, lower(email))
  where project_id is not null;

create unique index if not exists project_notification_recipients_request_email_uidx
  on public.project_notification_recipients (project_request_id, lower(email))
  where project_request_id is not null;

create index if not exists project_notification_recipients_project_idx
  on public.project_notification_recipients (project_id);

create index if not exists project_notification_recipients_request_idx
  on public.project_notification_recipients (project_request_id);

-- Preserve every existing request-time backup email. Keep the old column because
-- older application versions and admin search still read it.
insert into public.project_notification_recipients (project_request_id, email)
select r.id, btrim(r.backup_email)
from public.project_requests r
where r.backup_email is not null
  and btrim(r.backup_email) <> ''
  and r.backup_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and not exists (
    select 1
    from public.project_notification_recipients existing
    where existing.project_request_id = r.id
      and lower(existing.email) = lower(btrim(r.backup_email))
  );

-- Existing projects created from requests inherit the request recipients.
insert into public.project_notification_recipients (project_id, email)
select p.id, r.email
from public.projects p
join public.project_notification_recipients r
  on r.project_request_id = p.request_id
where p.request_id is not null
  and not exists (
    select 1
    from public.project_notification_recipients existing
    where existing.project_id = p.id
      and lower(existing.email) = lower(r.email)
  );

create or replace function public.copy_project_notification_recipients_from_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.request_id is not null then
    insert into public.project_notification_recipients (project_id, email)
    select new.id, r.email
    from public.project_notification_recipients r
    where r.project_request_id = new.request_id
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.copy_project_notification_recipients_from_request() from public, anon, authenticated;
drop trigger if exists trg_copy_project_notification_recipients on public.projects;
create trigger trg_copy_project_notification_recipients
after insert on public.projects
for each row execute function public.copy_project_notification_recipients_from_request();

alter table public.project_notification_recipients enable row level security;
revoke all on public.project_notification_recipients from public, anon, authenticated;
grant select, insert, update, delete on public.project_notification_recipients to authenticated;

create policy "Customers can view their project notification recipients"
on public.project_notification_recipients
for select to authenticated
using (
  exists (
    select 1 from public.project_requests r
    where r.id = project_notification_recipients.project_request_id
      and r.client_id = auth.uid()
  )
  or exists (
    select 1 from public.projects p
    where p.id = project_notification_recipients.project_id
      and p.client_id = auth.uid()
  )
  or public.is_active_admin()
);

create policy "Customers can insert their project notification recipients"
on public.project_notification_recipients
for insert to authenticated
with check (
  exists (
    select 1 from public.project_requests r
    where r.id = project_notification_recipients.project_request_id
      and r.client_id = auth.uid()
  )
  or exists (
    select 1 from public.projects p
    where p.id = project_notification_recipients.project_id
      and p.client_id = auth.uid()
  )
  or public.is_active_admin()
);

create policy "Customers can update their project notification recipients"
on public.project_notification_recipients
for update to authenticated
using (
  exists (
    select 1 from public.project_requests r
    where r.id = project_notification_recipients.project_request_id
      and r.client_id = auth.uid()
  )
  or exists (
    select 1 from public.projects p
    where p.id = project_notification_recipients.project_id
      and p.client_id = auth.uid()
  )
  or public.is_active_admin()
)
with check (
  exists (
    select 1 from public.project_requests r
    where r.id = project_notification_recipients.project_request_id
      and r.client_id = auth.uid()
  )
  or exists (
    select 1 from public.projects p
    where p.id = project_notification_recipients.project_id
      and p.client_id = auth.uid()
  )
  or public.is_active_admin()
);

create policy "Customers can delete their project notification recipients"
on public.project_notification_recipients
for delete to authenticated
using (
  exists (
    select 1 from public.project_requests r
    where r.id = project_notification_recipients.project_request_id
      and r.client_id = auth.uid()
  )
  or exists (
    select 1 from public.projects p
    where p.id = project_notification_recipients.project_id
      and p.client_id = auth.uid()
  )
  or public.is_active_admin()
);

create or replace function public.replace_own_project_notification_recipients(
  p_request_id uuid,
  p_emails text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_primary_email text;
  v_emails text[];
  v_email text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.project_requests
    where id = p_request_id
      and client_id = v_uid
      and status::text in ('draft', 'new', 'reviewing', 'quoted', 'rejected')
  ) then
    raise exception 'Request not found or cannot be edited.';
  end if;

  select lower(btrim(email)) into v_primary_email
  from public.project_requests
  where id = p_request_id;

  select coalesce(array_agg(email order by first_seen), '{}')
  into v_emails
  from (
    select lower(btrim(email)) as email, min(ord) as first_seen
    from unnest(coalesce(p_emails, '{}')) with ordinality as values(email, ord)
    where btrim(email) <> ''
    group by lower(btrim(email))
  ) normalized;

  if coalesce(array_length(v_emails, 1), 0) > 5 then
    raise exception 'You can add up to 5 team notification emails.';
  end if;

  foreach v_email in array v_emails loop
    if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Invalid team notification email address.';
    end if;
    if v_email = v_primary_email then
      raise exception 'Team notification emails must be different from your primary email.';
    end if;
  end loop;

  delete from public.project_notification_recipients
  where project_request_id = p_request_id;

  insert into public.project_notification_recipients (project_request_id, email)
  select p_request_id, email from unnest(v_emails) as values(email);

  -- Keep the legacy snapshot synchronized for older clients and admin screens.
  update public.project_requests
  set backup_email = nullif(v_emails[1], '')
  where id = p_request_id;
end;
$$;

revoke all on function public.replace_own_project_notification_recipients(uuid, text[]) from public, anon;
grant execute on function public.replace_own_project_notification_recipients(uuid, text[]) to authenticated;

comment on table public.project_notification_recipients is
  'Trusted project and project-request team notification recipients; legacy backup_email columns remain for compatibility.';
