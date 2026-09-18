-- V1 project status-change notifications.
-- The notification is created in the same transaction as the status update;
-- email delivery is dispatched afterward by the trusted server action.
create or replace function public.create_project_status_change_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and not exists (
       select 1 from public.notifications n
       where n.user_id = new.client_id
         and n.project_id = new.id
         and n.type = 'project_status_changed'
         and n.message = 'Your project ' || new.project_number || ' changed from ' || old.status::text || ' to ' || new.status::text || '.'
     ) then
    insert into public.notifications (user_id, type, title, message, project_id)
    values (
      new.client_id,
      'project_status_changed',
      'Project status updated',
      'Your project ' || new.project_number || ' changed from ' || old.status::text || ' to ' || new.status::text || '.',
      new.id
    );
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
