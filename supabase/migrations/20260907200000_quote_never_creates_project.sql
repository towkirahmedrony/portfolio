-- Quotes attach to existing projects only.
-- Project conversion remains exclusive to public.admin_convert_project_request,
-- which inserts one projects row (status = pending) and sets
-- project_requests.status = converted.
--
-- This migration:
--   1. Inspects duplicate projects.request_id values without deleting them.
--   2. Adds a unique index on projects.request_id when no duplicates exist,
--      so a request cannot convert into a second project.

do $$
declare
  v_duplicate_count integer := 0;
begin
  if to_regclass('public.projects') is null then
    return;
  end if;

  select count(*) into v_duplicate_count
  from (
    select request_id
    from public.projects
    where request_id is not null
    group by request_id
    having count(*) > 1
  ) duplicates;

  if v_duplicate_count > 0 then
    raise notice
      'projects.request_id has % duplicate group(s). Unique index skipped. Inspect rows referenced by quotes/invoices/messages before any cleanup.',
      v_duplicate_count;
    return;
  end if;

  execute $sql$
    create unique index if not exists projects_request_id_unique
      on public.projects (request_id)
      where request_id is not null
  $sql$;
end;
$$;

-- Read-only inspection of request_id collisions. Does not delete rows.
-- Preserve any project referenced by quotes, invoices, or project_messages.
--
-- select
--   p.request_id,
--   p.id as project_id,
--   p.project_number,
--   p.status as project_status,
--   p.created_at,
--   (select count(*) from public.quotes q where q.project_id = p.id) as quote_count,
--   (select count(*) from public.invoices i where i.project_id = p.id) as invoice_count,
--   (select count(*) from public.project_messages m where m.project_id = p.id) as message_count
-- from public.projects p
-- where p.request_id in (
--   select request_id
--   from public.projects
--   where request_id is not null
--   group by request_id
--   having count(*) > 1
-- )
-- order by p.request_id, p.created_at;
