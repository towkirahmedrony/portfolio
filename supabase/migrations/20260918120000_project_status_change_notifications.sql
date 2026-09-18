-- Canonical status email dispatch: notification creation and async pg_net queueing
-- happen at the database event boundary, regardless of which backend updates status.
create extension if not exists pg_net;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'email_notification_webhook_secret'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'email_notification_webhook_secret',
      'Server-to-server authentication for project status email dispatch',
      null
    );
  end if;
end;
$$;

create or replace function public.get_email_notification_webhook_secret()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'email_notification_webhook_secret'
  limit 1
$$;

revoke all on function public.get_email_notification_webhook_secret() from public, anon, authenticated;
grant execute on function public.get_email_notification_webhook_secret() to service_role;

create or replace function public.create_project_status_change_notification()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_notification_id uuid;
  v_webhook_secret text;
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, message, project_id)
    select
      new.client_id,
      'project_status_changed',
      'Project status updated',
      'Your project ' || new.project_number || ' changed from ' || old.status::text || ' to ' || new.status::text || '.',
      new.id
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = new.client_id
        and n.project_id = new.id
        and n.type = 'project_status_changed'
        and n.message = 'Your project ' || new.project_number || ' changed from ' || old.status::text || ' to ' || new.status::text || '.'
    )
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
          timeout_milliseconds := 5000
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
