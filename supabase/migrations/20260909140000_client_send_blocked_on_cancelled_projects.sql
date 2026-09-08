-- Client-initiated messaging on cancelled projects
-- ==================================================
-- UI rule: a Client may start / continue a project chat for every project
-- status EXCEPT "cancelled". This migration enforces that rule in the
-- database (send_project_message), so hiding the button is never the only
-- defense:
--   * owning clients are rejected when the project status is 'cancelled';
--   * active admins are NOT affected (admin-side communication on cancelled
--     projects is intentionally preserved);
--   * read access, read-state, history and Realtime are untouched.
-- No status values, enums, constraints or business workflow are modified.
-- Idempotent: guarded blocks, safe to re-run.

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

  -- Clients cannot start/send new messages on a cancelled project. Admins
  -- (checked first above) are intentionally allowed to keep communicating.
  if not public.is_active_admin() and exists (
    select 1
    from public.projects
    where projects.id = p_project_id
      and projects.status = 'cancelled'
  ) then
    raise exception 'This project was cancelled, so new messages cannot be sent.';
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

-- Restrict execution (idempotent, avoids hard failure if the function was
-- never created on a given database).
do $$
begin
  if exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'send_project_message'
      and pg_get_function_identity_arguments(oid) = 'uuid, text, text'
  ) then
    execute 'revoke all on function public.send_project_message(uuid, text, text) from public, anon';
    execute 'grant execute on function public.send_project_message(uuid, text, text) to authenticated';
  end if;
end;
$$;
