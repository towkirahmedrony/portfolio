-- Admin Referrals Management
-- --------------------------
-- Supports /admin/referrals, /admin/referrals/[id] and
-- /admin/referrals/settings against database-schema.md.
--
-- The schema document describes four tables (referral_codes, referrals,
-- referral_rewards, referral_settings). Some environments only have
-- referral_codes, so the missing enums/tables are created here (guarded, so a
-- database that already has them is untouched and their own DDL wins).
-- Defaults for referral_settings follow database-schema.md (5% new-client
-- discount, 2% referrer reward) and are only seeded when no row exists.
--
-- Data integrity (schema rules): self-referrals are rejected and a referral
-- code must belong to the referrer it is used with. Reward state is never
-- manually rewritten here — the admin UI only reads referral_rewards; settings
-- are written through the gated admin_update_referral_settings RPC.
--
-- Depends on public.is_active_admin() (added in 20260904130000) and
-- public.admin_auth_emails (added in 20260904140000) is not required here.

-- 1) Missing enums (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'referral_status'
  ) then
    create type public.referral_status as enum (
      'pending', 'qualified', 'reward_pending', 'reward_available',
      'completed', 'cancelled', 'invalid'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'reward_status'
  ) then
    create type public.reward_status as enum (
      'pending', 'available', 'redeemed', 'expired', 'cancelled'
    );
  end if;
end;
$$;

-- 2) referral_settings (single active config row; defaults 5% / 2%).
create table if not exists public.referral_settings (
  id uuid primary key default gen_random_uuid(),
  new_client_discount_percent numeric not null default 5
    check (new_client_discount_percent between 0 and 100),
  referrer_reward_percent numeric not null default 2
    check (referrer_reward_percent between 0 and 100),
  minimum_project_amount numeric
    check (minimum_project_amount is null or minimum_project_amount >= 0),
  reward_validity_days integer
    check (reward_validity_days is null or reward_validity_days between 1 and 3650),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed the defaults only when the table is empty (preserve any existing value).
insert into public.referral_settings (
  new_client_discount_percent,
  referrer_reward_percent
)
select 5, 2
where not exists (select 1 from public.referral_settings);

-- 3) Referral integrity helper: reject self-referrals and mismatched codes.
create or replace function public.referrals_validate_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if new.referrer_id is null then
    raise exception 'A referrer is required.';
  end if;

  if new.referred_client_id is not null and new.referred_client_id = new.referrer_id then
    raise exception 'Self-referral is not allowed.';
  end if;

  if new.referral_code_id is not null then
    select owner_id into v_owner
    from public.referral_codes
    where id = new.referral_code_id;

    if v_owner is null then
      raise exception 'Referral code not found.';
    end if;

    if v_owner <> new.referrer_id then
      raise exception 'Referral code does not belong to the referrer.';
    end if;
  end if;

  return new;
end;
$$;

-- 4) referrals table (created only when absent so an existing DDL wins).
do $$
begin
  if to_regclass('public.referrals') is null then
    execute $ddl$
      create table public.referrals (
        id uuid primary key default gen_random_uuid(),
        referrer_id uuid not null references public.profiles (id) on delete cascade,
        referred_client_id uuid references public.profiles (id) on delete set null,
        referral_code_id uuid not null references public.referral_codes (id) on delete cascade,
        project_request_id uuid references public.project_requests (id) on delete set null,
        first_project_id uuid references public.projects (id) on delete set null,
        status public.referral_status not null default 'pending',
        client_discount_percent numeric not null default 5
          check (client_discount_percent between 0 and 100),
        referrer_reward_percent numeric not null default 2
          check (referrer_reward_percent between 0 and 100),
        created_at timestamptz not null default now(),
        qualified_at timestamptz,
        completed_at timestamptz,
        cancelled_at timestamptz
      )
    $ddl$;
    execute $ddl$
      create trigger referrals_integrity_check
      before insert or update on public.referrals
      for each row execute function public.referrals_validate_integrity()
    $ddl$;
  end if;
end;
$$;

-- 5) referral_rewards table (created only when absent so an existing DDL wins).
do $$
begin
  if to_regclass('public.referral_rewards') is null then
    execute $ddl$
      create table public.referral_rewards (
        id uuid primary key default gen_random_uuid(),
        referral_id uuid not null references public.referrals (id) on delete cascade,
        referrer_id uuid not null references public.profiles (id) on delete cascade,
        reward_type text not null default 'referral_discount',
        reward_percent numeric not null default 2
          check (reward_percent between 0 and 100),
        status public.reward_status not null default 'pending',
        available_from timestamptz,
        expires_at timestamptz,
        redeemed_project_id uuid references public.projects (id) on delete set null,
        redeemed_at timestamptz,
        cancelled_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;
  end if;
end;
$$;

-- 6) RLS + policies. Admins read everything; clients can only see rows tied to
--    their own profile. Settings writes happen exclusively via the RPC below.
alter table public.referral_settings enable row level security;

do $$
begin
  execute 'drop policy if exists "Admins can view referral settings" on public.referral_settings';
  execute 'create policy "Admins can view referral settings" on public.referral_settings for select to authenticated using (public.is_active_admin())';
  execute 'grant select on public.referral_settings to authenticated';

  if to_regclass('public.referrals') is not null then
    execute 'alter table public.referrals enable row level security';
    execute 'drop policy if exists "Admins can view referrals" on public.referrals';
    execute 'create policy "Admins can view referrals" on public.referrals for select to authenticated using (public.is_active_admin())';
    execute 'drop policy if exists "Clients can view own referrals" on public.referrals';
    execute 'create policy "Clients can view own referrals" on public.referrals for select to authenticated using (referrer_id = auth.uid() or referred_client_id = auth.uid())';
    execute 'grant select on public.referrals to authenticated';
  end if;

  if to_regclass('public.referral_rewards') is not null then
    execute 'alter table public.referral_rewards enable row level security';
    execute 'drop policy if exists "Admins can view referral rewards" on public.referral_rewards';
    execute 'create policy "Admins can view referral rewards" on public.referral_rewards for select to authenticated using (public.is_active_admin())';
    execute 'drop policy if exists "Clients can view own referral rewards" on public.referral_rewards';
    execute 'create policy "Clients can view own referral rewards" on public.referral_rewards for select to authenticated using (referrer_id = auth.uid())';
    execute 'grant select on public.referral_rewards to authenticated';
  end if;
end;
$$;

-- 7) Settings write path: security-definer RPC, admin-only, range-validated.
create or replace function public.admin_update_referral_settings(
  p_client_discount_percent numeric,
  p_referrer_reward_percent numeric,
  p_minimum_project_amount numeric default null,
  p_reward_validity_days integer default null,
  p_is_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings_id uuid;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if to_regclass('public.referral_settings') is null then
    raise exception 'referral_settings is not available in the current database schema.';
  end if;

  if p_client_discount_percent is null
     or p_client_discount_percent < 0 or p_client_discount_percent > 100 then
    raise exception 'New client discount must be between 0 and 100.';
  end if;

  if p_referrer_reward_percent is null
     or p_referrer_reward_percent < 0 or p_referrer_reward_percent > 100 then
    raise exception 'Referrer reward must be between 0 and 100.';
  end if;

  if p_minimum_project_amount is not null and p_minimum_project_amount < 0 then
    raise exception 'Minimum project amount cannot be negative.';
  end if;

  if p_reward_validity_days is not null
     and (p_reward_validity_days < 1 or p_reward_validity_days > 3650) then
    raise exception 'Reward validity must be between 1 and 3650 days (or empty).';
  end if;

  if p_is_active is null then
    p_is_active := true;
  end if;

  select id into v_settings_id
  from public.referral_settings
  limit 1;

  if v_settings_id is null then
    insert into public.referral_settings (
      new_client_discount_percent,
      referrer_reward_percent,
      minimum_project_amount,
      reward_validity_days,
      is_active
    )
    values (
      round(p_client_discount_percent, 2),
      round(p_referrer_reward_percent, 2),
      p_minimum_project_amount,
      p_reward_validity_days,
      p_is_active
    );
  else
    update public.referral_settings
    set new_client_discount_percent = round(p_client_discount_percent, 2),
        referrer_reward_percent = round(p_referrer_reward_percent, 2),
        minimum_project_amount = p_minimum_project_amount,
        reward_validity_days = p_reward_validity_days,
        is_active = p_is_active,
        updated_at = now()
    where id = v_settings_id;
  end if;
end;
$$;

revoke all on function public.admin_update_referral_settings(numeric, numeric, numeric, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_update_referral_settings(numeric, numeric, numeric, integer, boolean)
  to authenticated;

revoke all on function public.referrals_validate_integrity() from public, anon, authenticated;
