-- Ensure admins can SELECT audit_logs (prod parity fix).
--
-- Production finding: audit_logs existed with RLS enabled but NO policies, so
-- even authenticated admins received zero rows and the Admin Dashboard quote-
-- response section could never surface audit events. The policy defined in
-- 20260904190000 was never applied on that database.
--
-- This migration reapplies the same admin-only SELECT policy idempotently so
-- fresh and existing environments converge. It is applied verbatim on
-- production alongside 20260908150000 / 20260908160000 /
-- 20260908170000 (2026-09-08).
--
-- Security: admins only. Clients have no SELECT (no policy) and no INSERT
-- policy, so they cannot read or forge admin events. No broad public policy.
-- Mirrors the app's /admin gate, which authorizes via public.is_active_admin().

do $$
begin
  if to_regclass('public.audit_logs') is null then
    return;
  end if;

  execute 'alter table public.audit_logs enable row level security';
  execute 'drop policy if exists "Admins can view audit logs" on public.audit_logs';
  execute 'create policy "Admins can view audit logs" on public.audit_logs for select to authenticated using (public.is_active_admin())';
  execute 'grant select on public.audit_logs to authenticated';
end;
$$;
