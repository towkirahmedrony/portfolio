-- Transactional email notifications: event-identity idempotency + project_requests status emails.
--
-- Two changes:
--   1. Replace the notification-message-text duplicate guard with an explicit event identity
--      (`notifications.event_key`) so a legitimate repeat of the same status transition later in
--      a project's life is no longer silently suppressed.
--   2. Add the missing `project_requests.status` notification + pg_net dispatch path, reusing the
--      existing "send-email-notification" Edge Function and vault secret.
--
-- Idempotency model
-- -----------------
-- The status triggers fire exactly once per qualifying row update (guarded by
-- `WHEN (old.status IS DISTINCT FROM new.status)`). The event key additionally makes the insert
-- idempotent per transition event:
--
--   <entity>:<row id>:<from status>-><to status>@<transaction id>
--
-- The transaction id is the real "this occurrence" identity, so
--   in_progress -> revision, revision -> in_progress, in_progress -> revision
-- produces three different keys (three real events) while a duplicate insert for the *same*
-- transition event collides and is ignored via ON CONFLICT DO NOTHING. The webhook dispatch is
-- only performed when the insert actually returned a row, so one transition can never produce
-- more than one notification or more than one email dispatch.

-- ---------------------------------------------------------------------------
-- 1. Event identity column (NULL keeps other notification flows unaffected:
--    Postgres treats NULLs as distinct in a unique index).
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists event_key text;

comment on column public.notifications.event_key is
  'Idempotency identity of the domain event that produced this notification, e.g. project_status:<project_id>:<from>-><to>@<xid>. NULL for notifications created without an event identity.';

create unique index if not exists notifications_event_key_uidx
  on public.notifications (event_key);

-- ---------------------------------------------------------------------------
-- 2. Projects: same trigger/architecture, idempotency now based on the event.
-- ---------------------------------------------------------------------------
create or replace function public.create_project_status_change_notification()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_notification_id uuid;
  v_webhook_secret text;
  v_event_key text;
begin
  if new.status is distinct from old.status then
    v_event_key := 'project_status:' || new.id::text
      || ':' || old.status::text || '->' || new.status::text
      || '@' || pg_current_xact_id()::text;

    insert into public.notifications (user_id, type, title, message, project_id, event_key)
    values (
      new.client_id,
      'project_status_changed',
      'Project status updated',
      'Your project ' || new.project_number || ' changed from ' || old.status::text
        || ' to ' || new.status::text || '.',
      new.id,
      v_event_key
    )
    on conflict (event_key) do nothing
    returning id into v_notification_id;

    if v_notification_id is not null then
      select decrypted_secret into v_webhook_secret
      from vault.decrypted_secrets
      where name = 'email_notification_webhook_secret'
      limit 1;

      if v_webhook_secret is not null then
        perform net.http_post(
          url := 'https://gbxfpnqdqbeohkfsqnyk.supabase.co/functions/v1/send-email-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-email-notification-secret', v_webhook_secret
          ),
          body := jsonb_build_object(
            'type', 'project_status_changed',
            'project_id', new.id,
            'previous_status', old.status::text,
            'new_status', new.status::text,
            'notification_id', v_notification_id
          ),
          timeout_milliseconds := 120000
        );
      else
        raise log 'Project status email dispatch skipped: webhook secret is not configured';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.create_project_status_change_notification() from public, anon, authenticated;

drop trigger if exists trg_project_status_change_notification on public.projects;
create trigger trg_project_status_change_notification
after update of status on public.projects
for each row
when (old.status is distinct from new.status)
execute function public.create_project_status_change_notification();

-- ---------------------------------------------------------------------------
-- 3. Project requests: new status notification + pg_net dispatch.
--    Works whether or not the request has a linked project row. The linked
--    project id is attached when it exists purely so the client UI can link
--    the notification; it is not required for the email.
-- ---------------------------------------------------------------------------
create or replace function public.create_project_request_status_change_notification()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_notification_id uuid;
  v_webhook_secret text;
  v_event_key text;
  v_project_id uuid;
begin
  if new.status is distinct from old.status then
    -- notifications.user_id is NOT NULL and references profiles, so a request
    -- with no linked client profile cannot produce a notification.
    if new.client_id is null then
      raise log 'Project request % status email skipped: request has no linked client profile',
        new.request_number;
      return new;
    end if;

    select p.id into v_project_id
    from public.projects p
    where p.request_id = new.id
    limit 1;

    v_event_key := 'project_request_status:' || new.id::text
      || ':' || old.status::text || '->' || new.status::text
      || '@' || pg_current_xact_id()::text;

    insert into public.notifications (user_id, type, title, message, project_id, event_key)
    values (
      new.client_id,
      'project_request_status_changed',
      'Project request status updated',
      'Your project request ' || new.request_number || ' changed from ' || old.status::text
        || ' to ' || new.status::text || '.',
      v_project_id,
      v_event_key
    )
    on conflict (event_key) do nothing
    returning id into v_notification_id;

    if v_notification_id is not null then
      select decrypted_secret into v_webhook_secret
      from vault.decrypted_secrets
      where name = 'email_notification_webhook_secret'
      limit 1;

      if v_webhook_secret is not null then
        perform net.http_post(
          url := 'https://gbxfpnqdqbeohkfsqnyk.supabase.co/functions/v1/send-email-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-email-notification-secret', v_webhook_secret
          ),
          body := jsonb_build_object(
            'type', 'project_request_status_changed',
            'request_id', new.id,
            'project_id', v_project_id,
            'previous_status', old.status::text,
            'new_status', new.status::text,
            'notification_id', v_notification_id
          ),
          timeout_milliseconds := 120000
        );
      else
        raise log 'Project request status email dispatch skipped: webhook secret is not configured';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.create_project_request_status_change_notification() from public, anon, authenticated;

drop trigger if exists trg_project_request_status_change_notification on public.project_requests;
create trigger trg_project_request_status_change_notification
after update of status on public.project_requests
for each row
when (old.status is distinct from new.status)
execute function public.create_project_request_status_change_notification();
