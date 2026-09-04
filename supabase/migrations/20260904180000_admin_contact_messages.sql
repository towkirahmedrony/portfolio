-- Admin Contact Messages Inbox
-- -----------------------------
-- Supports /admin/contact-messages against database-schema.md.
-- Contact messages are private: only admins may read or update them
-- (status / read_at / replied_at). No anon or client policies are created,
-- and message data is never exposed to unauthorized roles.
--
-- Created only when absent so any existing DDL wins.
-- Depends on public.is_active_admin() (20260904130000).

-- 1) contact_status enum (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'contact_status'
  ) then
    create type public.contact_status as enum (
      'new', 'read', 'replied', 'archived', 'spam'
    );
  end if;
end;
$$;

-- 2) contact_messages table (guarded)
do $$
begin
  if to_regclass('public.contact_messages') is null then
    execute $ddl$
      create table public.contact_messages (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        email text not null,
        phone text,
        subject text,
        message text not null,
        status public.contact_status not null default 'new',
        created_at timestamptz not null default now(),
        read_at timestamptz,
        replied_at timestamptz
      )
    $ddl$;
    execute 'create index contact_messages_status_idx on public.contact_messages (status, created_at desc)';
  end if;
end;
$$;

-- 3) RLS + admin policies (select + update only)
do $$
begin
  if to_regclass('public.contact_messages') is not null then
    execute 'alter table public.contact_messages enable row level security';
    execute 'drop policy if exists "Admins can view contact messages" on public.contact_messages';
    execute 'create policy "Admins can view contact messages" on public.contact_messages for select to authenticated using (public.is_active_admin())';
    execute 'drop policy if exists "Admins can update contact messages" on public.contact_messages';
    execute 'create policy "Admins can update contact messages" on public.contact_messages for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin())';
    execute 'grant select, update on public.contact_messages to authenticated';
  end if;
end;
$$;
