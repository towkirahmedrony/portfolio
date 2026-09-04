-- Admin Settings Foundation
-- --------------------------
-- Supports the /admin/settings notification preferences section against
-- database-schema.md. referral_settings already exists and is intentionally
-- left untouched here. No speculative settings fields are created.
--
-- notification_preferences is per-admin (user_id unique FK → profiles.id),
-- which already gives the architecture room for multiple admins later:
-- each admin row is only ever readable/writable by its owner via RLS.
--
-- Created only when absent so any existing DDL wins.
-- Depends on public.is_active_admin() (20260904130000).

do $$
begin
  if to_regclass('public.notification_preferences') is null then
    execute $ddl$
      create table public.notification_preferences (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null unique references public.profiles (id) on delete cascade,
        email_project_updates boolean not null default true,
        email_messages boolean not null default true,
        email_quotes boolean not null default true,
        email_payments boolean not null default true,
        email_referrals boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.notification_preferences') is not null then
    execute 'alter table public.notification_preferences enable row level security';
    -- Own-row policies only: an admin manages exactly their own preferences.
    execute 'drop policy if exists "Users can view own notification preferences" on public.notification_preferences';
    execute 'create policy "Users can view own notification preferences" on public.notification_preferences for select to authenticated using (user_id = auth.uid())';
    execute 'drop policy if exists "Users can insert own notification preferences" on public.notification_preferences';
    execute 'create policy "Users can insert own notification preferences" on public.notification_preferences for insert to authenticated with check (user_id = auth.uid())';
    execute 'drop policy if exists "Users can update own notification preferences" on public.notification_preferences';
    execute 'create policy "Users can update own notification preferences" on public.notification_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
    execute 'grant select, insert, update on public.notification_preferences to authenticated';
  end if;
end;
$$;
