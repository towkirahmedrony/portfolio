-- V1 transactional notifications: project creation is the trusted event point.
-- Reuses public.notifications and preserves existing RLS and business logic.
create or replace function public.create_project_confirmation_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.notifications n
    where n.user_id = new.client_id
      and n.project_id = new.id
      and n.type = 'project_confirmed'
  ) then
    insert into public.notifications (user_id, type, title, message, project_id)
    values (
      new.client_id,
      'project_confirmed',
      'Project confirmed',
      'Your project ' || new.project_number || ' has been created and confirmed.',
      new.id
    );
  end if;
  return new;
end;
$$;

revoke all on function public.create_project_confirmation_notification() from public, anon, authenticated;

drop trigger if exists trg_project_confirmation_notification on public.projects;
create trigger trg_project_confirmation_notification
after insert on public.projects
for each row execute function public.create_project_confirmation_notification();
