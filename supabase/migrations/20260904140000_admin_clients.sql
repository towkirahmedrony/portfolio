-- Admin Clients Management
-- ------------------------
-- Adds what the /admin/clients pages need on top of the existing schema:
--   1. Admin read access to the tables the client list/detail pages query
--      (profiles is the primary data source; related tables are only read).
--   2. Security-definer RPCs for the two admin write actions that touch the
--      protected profiles row (status + email_verified). Clients can never
--      reach these paths: the functions re-check is_active_admin() and only
--      ever target rows whose role = 'client'. No service-role keys are used
--      and Supabase Auth is never modified from the browser.
--
-- email_verified is normally synced from Supabase Auth (email_confirmed_at /
-- Google identity) by triggers and sync_customer_session(). The manual RPC
-- below is intentionally narrow and exists only for admin support flows; the
-- protect_profile_system_fields trigger stays in force for every other path.
--
-- Depends on public.is_active_admin() (added in 20260904130000_admin_invoices_payments.sql).

-- 1) Admins can view every profile. profiles is guaranteed to exist.
drop policy if exists "Admins can view profiles" on public.profiles;
create policy "Admins can view profiles"
on public.profiles
for select
to authenticated
using (public.is_active_admin());

-- 2) Read access to related tables used by the client detail summaries.
--    Tables may not exist yet in some environments, so each block is guarded.
do $$
begin
  if to_regclass('public.referral_codes') is not null then
    execute 'alter table public.referral_codes enable row level security';
    execute 'drop policy if exists "Admins can view referral codes" on public.referral_codes';
    execute 'create policy "Admins can view referral codes" on public.referral_codes for select to authenticated using (public.is_active_admin())';
    execute 'grant select on public.referral_codes to authenticated';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.referral_rewards') is not null then
    execute 'alter table public.referral_rewards enable row level security';
    execute 'drop policy if exists "Admins can view referral rewards" on public.referral_rewards';
    execute 'create policy "Admins can view referral rewards" on public.referral_rewards for select to authenticated using (public.is_active_admin())';
    execute 'grant select on public.referral_rewards to authenticated';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.projects') is not null then
    execute 'alter table public.projects enable row level security';
    execute 'drop policy if exists "Admins can view projects" on public.projects';
    execute 'create policy "Admins can view projects" on public.projects for select to authenticated using (public.is_active_admin())';
    execute 'grant select on public.projects to authenticated';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.quotes') is not null then
    execute 'alter table public.quotes enable row level security';
    execute 'drop policy if exists "Admins can view quotes" on public.quotes';
    execute 'create policy "Admins can view quotes" on public.quotes for select to authenticated using (public.is_active_admin())';
    execute 'grant select on public.quotes to authenticated';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.project_messages') is not null then
    execute 'alter table public.project_messages enable row level security';
    execute 'drop policy if exists "Admins can view project messages" on public.project_messages';
    execute 'create policy "Admins can view project messages" on public.project_messages for select to authenticated using (public.is_active_admin())';
    execute 'grant select on public.project_messages to authenticated';
  end if;
end;
$$;

-- 3) Email lookup for admin client pages. profiles deliberately do not store
--    email (schema rule: do not duplicate auth.users), so admins read it from
--    auth.users through this gated helper instead of the raw auth schema.
create or replace function public.admin_auth_emails(p_ids uuid[])
returns table (profile_id uuid, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if p_ids is null or cardinality(p_ids) = 0 then
    return;
  end if;

  return query
    select u.id, u.email::text
    from auth.users u
    where u.id = any(p_ids);
end;
$$;

revoke all on function public.admin_auth_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_auth_emails(uuid[]) to authenticated;

-- 4) Activate / suspend / delete a client account. Only profiles.role = 'client'
--    rows can be touched; admins cannot change their own status here; id and
--    role are never writable. Bypass is scoped to this protected update and is
--    the same mechanism the auth sync triggers already use.
create or replace function public.admin_set_client_status(
  p_client_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if p_client_id is null then
    raise exception 'Client is required.';
  end if;

  if p_status is null or p_status not in ('active', 'suspended', 'deleted') then
    raise exception 'Invalid status. Allowed values: active, suspended, deleted.';
  end if;

  if p_client_id = auth.uid() then
    raise exception 'Admins cannot change their own account status.';
  end if;

  select p.role::text
  into v_role
  from public.profiles p
  where p.id = p_client_id;

  if v_role is null then
    raise exception 'Client profile not found.';
  end if;

  if v_role <> 'client' then
    raise exception 'Only client accounts can be managed from this action.';
  end if;

  -- Local (transaction-scoped) so the bypass never leaks past this RPC call.
  perform set_config('app.bypass_profile_protect', 'on', true);

  update public.profiles
  set status = p_status::public.profile_status
  where id = p_client_id;
end;
$$;

revoke all on function public.admin_set_client_status(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_client_status(uuid, text) to authenticated;

-- 5) Manual email verification override for support flows. email_verified is
--    derived from Supabase Auth and re-synced whenever the underlying auth
--    state changes, so this only affects the value until the next auth sync.
create or replace function public.admin_set_client_email_verified(
  p_client_id uuid,
  p_email_verified boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if p_client_id is null then
    raise exception 'Client is required.';
  end if;

  if p_email_verified is null then
    raise exception 'Email verification value is required.';
  end if;

  if p_client_id = auth.uid() then
    raise exception 'Admins cannot change their own email verification status.';
  end if;

  select p.role::text
  into v_role
  from public.profiles p
  where p.id = p_client_id;

  if v_role is null then
    raise exception 'Client profile not found.';
  end if;

  if v_role <> 'client' then
    raise exception 'Only client accounts can be managed from this action.';
  end if;

  -- Local (transaction-scoped) so the bypass never leaks past this RPC call.
  perform set_config('app.bypass_profile_protect', 'on', true);

  update public.profiles
  set email_verified = p_email_verified
  where id = p_client_id;
end;
$$;

revoke all on function public.admin_set_client_email_verified(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_client_email_verified(uuid, boolean) to authenticated;
