-- Request-stage messaging + Request -> Project conversation continuity
-- =====================================================================
-- Lets a Client message Admin from an eligible Project Request (statuses
-- new/reviewing/quoted) BEFORE a Project exists, using the SAME
-- project_messages table. When the accepted Quote creates the Project, the
-- existing request-stage rows are atomically relinked to the new project_id
-- (their ids never change, no rows are copied, no second conversation is
-- created).
--
-- Model:
--   project_messages.project_id  becomes nullable
--   project_messages.request_id  (new, nullable, FK -> project_requests)
--   CHECK: exactly one of (project_id, request_id) is set
--
-- Lifecycle:
--   before project:  message.request_id  = PR-…          (request conversation)
--   on project create: trigger relinks message -> project_id = new project
--   after project:   message.project_id  = PJ-…          (same rows, same ids)
--
-- The established Request -> Many Quote Versions -> One Project flow is not
-- modified; the trigger simply preserves the conversation whenever a Project
-- is created from a Request (any creation path). Admin select/insert access
-- already exists (is_active_admin policies cover the whole table), so admins
-- can reply to request-stage messages without new policies.
-- Idempotent: guarded, safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Schema: nullable project_id + request_id column + constraints
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.project_messages') is null then
    return;
  end if;

  execute 'alter table public.project_messages alter column project_id drop not null';

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'project_messages'
      and column_name = 'request_id'
  ) then
    execute 'alter table public.project_messages add column request_id uuid';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'project_messages_request_id_fkey'
  ) then
    execute 'alter table public.project_messages add constraint project_messages_request_id_fkey foreign key (request_id) references public.project_requests(id) on delete cascade';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'project_messages_context_check'
  ) then
    -- Exactly one conversation context per message: a request OR a project.
    execute 'alter table public.project_messages add constraint project_messages_context_check check ((project_id is null) <> (request_id is null))';
  end if;

  execute 'create index if not exists project_messages_request_id_created_at_idx on public.project_messages (request_id, created_at)';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. RLS: clients may read messages on their own project requests and insert
--    (own request, eligible status only, sender forced to auth.uid()).
--    Admins already have select/insert via the is_active_admin() policies.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.project_messages') is null
     or to_regclass('public.project_requests') is null then
    return;
  end if;

  execute 'drop policy if exists "Customers can view messages on their own project requests" on public.project_messages';
  execute 'create policy "Customers can view messages on their own project requests" on public.project_messages for select to authenticated using (request_id is not null and exists (select 1 from public.project_requests r where r.id = project_messages.request_id and r.client_id = auth.uid()))';

  execute 'drop policy if exists "Customers can send messages on their eligible project requests" on public.project_messages';
  execute 'create policy "Customers can send messages on their eligible project requests" on public.project_messages for insert to authenticated with check (sender_id = auth.uid() and request_id is not null and exists (select 1 from public.project_requests r where r.id = project_messages.request_id and r.client_id = auth.uid() and r.status in (''new'', ''reviewing'', ''quoted'') and not exists (select 1 from public.projects p where p.request_id = project_messages.request_id)))';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Conversation continuity trigger: when a Project is created from a
--    Request, relink that Request's message rows to the Project in place.
--    No copies, no id changes, no duplicate conversations.
-- ---------------------------------------------------------------------------
create or replace function public.link_request_messages_to_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.project_messages') is not null then
    update public.project_messages
    set project_id = NEW.id,
        request_id = null
    where request_id = NEW.request_id
      and project_id is null;
  end if;
  return NEW;
end;
$$;

do $$
begin
  if to_regclass('public.projects') is not null
     and not exists (
       select 1 from pg_trigger
       where tgname = 'link_request_messages_to_project_trigger'
     )
  then
    execute 'create trigger link_request_messages_to_project_trigger after insert on public.projects for each row execute function public.link_request_messages_to_project()';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. send_request_message(request_id, message, reply_to_id?) -> jsonb
--    Clients: own request + eligible status + no project yet.
--    Admins (is_active_admin): allowed (they reply to request-stage chats).
-- ---------------------------------------------------------------------------
create or replace function public.send_request_message(
  p_request_id uuid,
  p_message text,
  p_reply_to_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msg text;
  v_row public.project_messages;
  v_eligible boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if to_regclass('public.project_messages') is null
     or to_regclass('public.project_requests') is null
     or to_regclass('public.projects') is null then
    raise exception 'Messaging is not available in this database.';
  end if;

  if p_request_id is null then
    raise exception 'A project request is required.';
  end if;

  v_msg := btrim(coalesce(p_message, ''));
  if v_msg = '' then
    raise exception 'Message cannot be empty.';
  end if;
  if length(v_msg) > 2000 then
    raise exception 'Message is too long (2000 characters max).';
  end if;

  if public.is_active_admin() then
    -- Admins may reply on any request conversation (same table / RLS as
    -- project conversations).
    v_eligible := exists (
      select 1 from public.project_requests where id = p_request_id
    );
  else
    -- Client: must own the request, it must be in an active pre-project
    -- status, and it must not already have a project (once converted, the
    -- project chat takes over the same conversation).
    v_eligible := exists (
      select 1
      from public.project_requests r
      where r.id = p_request_id
        and r.client_id = v_uid
        and r.status in ('new', 'reviewing', 'quoted')
        and not exists (select 1 from public.projects p where p.request_id = r.id)
    );
  end if;

  if not v_eligible then
    raise exception 'This project request is not open for new messages.';
  end if;

  if p_reply_to_id is not null and not exists (
    select 1
    from public.project_messages
    where project_messages.id = p_reply_to_id
      and project_messages.request_id = p_request_id
  ) then
    raise exception 'Reply target is not part of this conversation.';
  end if;

  insert into public.project_messages (request_id, sender_id, message, reply_to_id, is_read)
  values (p_request_id, v_uid, v_msg, p_reply_to_id, false)
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. mark_request_messages_read(request_id) -> int
--    Owner client or admin; never marks the caller's own messages.
-- ---------------------------------------------------------------------------
create or replace function public.mark_request_messages_read(
  p_request_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_marked integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if to_regclass('public.project_messages') is null
     or to_regclass('public.project_requests') is null then
    raise exception 'Messaging is not available in this database.';
  end if;

  if p_request_id is null then
    raise exception 'A project request is required.';
  end if;

  if not exists (
    select 1 from public.project_requests
    where project_requests.id = p_request_id
      and project_requests.client_id = v_uid
  ) and not public.is_active_admin() then
    raise exception 'You do not have access to this conversation.';
  end if;

  update public.project_messages
  set is_read = true,
      read_at = timezone('utc', now())
  where project_messages.request_id = p_request_id
    and project_messages.sender_id is distinct from v_uid
    and project_messages.is_read = false;

  get diagnostics v_marked = row_count;
  return v_marked;
end;
$$;

-- Restrict execution of the new RPCs (idempotent).
do $$
begin
  if exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'send_request_message'
      and pg_get_function_identity_arguments(oid) = 'uuid, text, text'
  ) then
    execute 'revoke all on function public.send_request_message(uuid, text, text) from public, anon';
    execute 'grant execute on function public.send_request_message(uuid, text, text) to authenticated';
  end if;
  if exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'mark_request_messages_read'
      and pg_get_function_identity_arguments(oid) = 'uuid'
  ) then
    execute 'revoke all on function public.mark_request_messages_read(uuid) from public, anon';
    execute 'grant execute on function public.mark_request_messages_read(uuid) to authenticated';
  end if;
end;
$$;
