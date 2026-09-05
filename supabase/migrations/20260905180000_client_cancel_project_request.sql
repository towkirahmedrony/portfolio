-- Client cancellation for own project_requests.
-- Clients may only transition new / reviewing / quoted → cancelled.
-- All other columns stay protected; admins keep the existing update policy.

create or replace function public.cancel_own_project_request(p_request_id uuid)
returns public.request_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if to_regclass('public.project_requests') is null then
    raise exception 'project_requests is not available';
  end if;

  select id, client_id, status
  into v_request
  from public.project_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if v_request.client_id is null or v_request.client_id <> v_uid then
    raise exception 'Not authorized';
  end if;

  if v_request.status = 'cancelled' then
    return v_request.status;
  end if;

  if v_request.status not in ('new', 'reviewing', 'quoted') then
    raise exception 'This request can no longer be cancelled.';
  end if;

  update public.project_requests
  set status = 'cancelled'
  where id = v_request.id
    and client_id = v_uid
    and status in ('new', 'reviewing', 'quoted');

  if not found then
    raise exception 'This request can no longer be cancelled.';
  end if;

  return 'cancelled'::public.request_status;
end;
$$;

revoke all on function public.cancel_own_project_request(uuid) from public, anon;
grant execute on function public.cancel_own_project_request(uuid) to authenticated;

drop policy if exists "Customers can cancel their own project requests" on public.project_requests;

create policy "Customers can cancel their own project requests"
on public.project_requests
for update
to authenticated
using (
  client_id = auth.uid()
  and status in ('new', 'reviewing', 'quoted')
)
with check (
  client_id = auth.uid()
  and status = 'cancelled'
);

create or replace function public.protect_project_request_client_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_active_admin() then
    return new;
  end if;

  if auth.uid() is null or old.client_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Clients can only cancel their own requests.';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status not in ('new', 'reviewing', 'quoted') or new.status <> 'cancelled' then
    raise exception 'This request can no longer be cancelled.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_project_request_client_update on public.project_requests;

create trigger protect_project_request_client_update
before update on public.project_requests
for each row
execute function public.protect_project_request_client_update();

revoke all on function public.protect_project_request_client_update() from public, anon, authenticated;

do $$
begin
  if to_regclass('public.projects') is not null then
    execute 'alter table public.projects enable row level security';
    execute 'drop policy if exists "Customers can view their own projects" on public.projects';
    execute 'create policy "Customers can view their own projects" on public.projects for select to authenticated using (client_id = auth.uid())';
    execute 'grant select on public.projects to authenticated';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.quotes') is not null then
    execute 'alter table public.quotes enable row level security';
    execute 'drop policy if exists "Customers can view quotes for their projects" on public.quotes';
    execute $policy$
      create policy "Customers can view quotes for their projects"
      on public.quotes
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.projects
          where projects.id = quotes.project_id
            and projects.client_id = auth.uid()
        )
      )
    $policy$;
    execute 'grant select on public.quotes to authenticated';
  end if;
end;
$$;
