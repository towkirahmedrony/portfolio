-- Admin Audit Logs
-- ----------------
-- Supports /admin/audit-logs against database-schema.md.
-- Strictly read-only for admins: only a SELECT policy and grant are added —
-- no insert/update/delete reachable through the API. Audit rows are written
-- exclusively by the system (triggers/server code), never from this UI.
--
-- Created only when absent so any existing DDL wins.
-- Depends on public.is_active_admin() (20260904130000).

do $$
begin
  if to_regclass('public.audit_logs') is null then
    execute $ddl$
      create table public.audit_logs (
        id uuid primary key default gen_random_uuid(),
        actor_id uuid references public.profiles (id) on delete set null,
        action text not null,
        entity_type text not null,
        entity_id uuid,
        old_data jsonb,
        new_data jsonb,
        ip_address inet,
        user_agent text,
        created_at timestamptz not null default now()
      )
    $ddl$;
    execute 'create index audit_logs_created_at_idx on public.audit_logs (created_at desc)';
    execute 'create index audit_logs_action_idx on public.audit_logs (action)';
    execute 'create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id)';
    execute 'create index audit_logs_actor_idx on public.audit_logs (actor_id)';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.audit_logs') is not null then
    execute 'alter table public.audit_logs enable row level security';
    execute 'drop policy if exists "Admins can view audit logs" on public.audit_logs';
    execute 'create policy "Admins can view audit logs" on public.audit_logs for select to authenticated using (public.is_active_admin())';
    execute 'grant select on public.audit_logs to authenticated';
  end if;
end;
$$;
