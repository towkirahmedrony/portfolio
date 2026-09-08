-- Project Chat: realtime Client <-> Admin messaging
-- ===================================================
-- Turns the existing project_messages table (1 project = 1 conversation) into
-- a secure, realtime messaging surface. No new tables, no parallel
-- notification system, no changes to the Request -> Quote -> Project workflow.
--
-- What this migration does:
--   1. RLS policies on project_messages so clients can SELECT / INSERT only on
--      projects they own, and active admins can send on any project (the
--      existing admin SELECT policy is recreated idempotently).
--   2. send_project_message(...)        - SECURITY DEFINER RPC used by the
--      chat UI on both sides. auth.uid() is the ONLY sender identity; the
--      caller must own the project or be an active admin. Returns the
--      inserted row as jsonb (canonical id for de-duplication).
--   3. mark_project_messages_read(...)  - SECURITY DEFINER RPC that marks
--      incoming messages read. Only the owning client or an active admin may
--      call it, and it never touches the caller's own messages.
--   4. (project_id, created_at) index matching the actual chat query
--      (messages of one project ordered by created_at).
--   5. Adds project_messages to the Supabase Realtime publication so INSERT
--      events stream to subscribers (RLS decides who may receive them).
--
-- Tables / RPCs are guarded (to_regclass) so the migration is safe on any
-- database, matching the convention used by the other migrations in this
-- repo. RLS is never weakened: direct table UPDATE/DELETE stays closed, and
-- every authorization decision is made by the database against auth.uid().

-- ---------------------------------------------------------------------------
-- 1. RLS policies on project_messages
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.project_messages') is null then
    return;
  end if;

  execute 'alter table public.project_messages enable row level security';

  -- Clients can read the conversation of projects they own.
  execute 'drop policy if exists "Customers can view messages on their own projects" on public.project_messages';
  execute 'create policy "Customers can view messages on their own projects" on public.project_messages for select to authenticated using (exists (select 1 from public.projects p where p.id = project_messages.project_id and p.client_id = auth.uid()))';

  -- Clients can only INSERT into their own project conversation AND must
  -- declare themselves (sender_id = auth.uid()). Cross-project inserts or
  -- sender impersonation fail the WITH CHECK.
  execute 'drop policy if exists "Customers can send messages on their own projects" on public.project_messages';
  execute 'create policy "Customers can send messages on their own projects" on public.project_messages for insert to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_messages.project_id and p.client_id = auth.uid()))';

  -- Admins keep full read access (recreated idempotently) and can send.
  execute 'drop policy if exists "Admins can view project messages" on public.project_messages';
  execute 'create policy "Admins can view project messages" on public.project_messages for select to authenticated using (public.is_active_admin())';

  execute 'drop policy if exists "Admins can send project messages" on public.project_messages';
  execute 'create policy "Admins can send project messages" on public.project_messages for insert to authenticated with check (public.is_active_admin())';

  execute 'grant select on public.project_messages to authenticated';
  execute 'grant insert on public.project_messages to authenticated';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. send_project_message(project_id, message, reply_to_id?)
--    Authoritative sender resolution + ownership check inside the database.
-- ---------------------------------------------------------------------------
create or replace function public.send_project_message(
  p_project_id uuid,
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
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if to_regclass('public.project_messages') is null
     or to_regclass('public.projects') is null then
    raise exception 'Messaging is not available in this database.';
  end if;

  if p_project_id is null then
    raise exception 'A project is required.';
  end if;

  v_msg := btrim(coalesce(p_message, ''));
  if v_msg = '' then
    raise exception 'Message cannot be empty.';
  end if;
  if length(v_msg) > 2000 then
    raise exception 'Message is too long (2000 characters max).';
  end if;

  -- Authorization: the sender must own this project OR be an active admin.
  if not exists (
    select 1
    from public.projects
    where projects.id = p_project_id
      and projects.client_id = v_uid
  ) and not public.is_active_admin() then
    raise exception 'You do not have access to this project conversation.';
  end if;

  -- A reply target must belong to the same conversation when supplied.
  if p_reply_to_id is not null and not exists (
    select 1
    from public.project_messages
    where project_messages.id = p_reply_to_id
      and project_messages.project_id = p_project_id
  ) then
    raise exception 'Reply target is not part of this conversation.';
  end if;

  insert into public.project_messages (
    project_id,
    sender_id,
    message,
    reply_to_id,
    is_read
  )
  values (
    p_project_id,
    v_uid,
    v_msg,
    p_reply_to_id,
    false
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.send_project_message(uuid, text, text) from public, anon;
grant execute on function public.send_project_message(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. mark_project_messages_read(project_id) -> number of rows marked
--    Marks only OTHER people's messages; caller's own are never touched and
--    no-op rows (already read) are not rewritten.
-- ---------------------------------------------------------------------------
create or replace function public.mark_project_messages_read(
  p_project_id uuid
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
     or to_regclass('public.projects') is null then
    raise exception 'Messaging is not available in this database.';
  end if;

  if p_project_id is null then
    raise exception 'A project is required.';
  end if;

  if not exists (
    select 1
    from public.projects
    where projects.id = p_project_id
      and projects.client_id = v_uid
  ) and not public.is_active_admin() then
    raise exception 'You do not have access to this project conversation.';
  end if;

  update public.project_messages
  set is_read = true,
      read_at = timezone('utc', now())
  where project_messages.project_id = p_project_id
    and project_messages.sender_id is distinct from v_uid
    and project_messages.is_read = false;

  get diagnostics v_marked = row_count;
  return v_marked;
end;
$$;

revoke all on function public.mark_project_messages_read(uuid) from public, anon;
grant execute on function public.mark_project_messages_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Query index: chat history is fetched as
--      where project_id = $1 order by created_at asc
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.project_messages') is not null then
    execute 'create index if not exists project_messages_project_id_created_at_idx on public.project_messages (project_id, created_at)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Supabase Realtime: publish project_messages changes.
--    (Managed Supabase projects ship a "supabase_realtime" publication; the
--    guard keeps this safe on databases without it. Delivery of each event
--    to a subscriber is still gated by that subscriber's SELECT RLS policy.)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.project_messages') is not null
     and exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'project_messages'
     )
  then
    execute 'alter publication supabase_realtime add table public.project_messages';
  end if;
end;
$$;
