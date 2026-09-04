-- Admin Reviews Management
-- ------------------------
-- Supports /admin/reviews against database-schema.md. Reviews are created by
-- the client flow; admins only moderate (read + update status/published_at).
-- No insert/delete policies are granted here and ownership columns
-- (client_id, project_id) are never writable from the admin UI.
--
-- The table/enum are created only when absent so any existing DDL wins.
-- Depends on public.is_active_admin() (20260904130000).

-- 1) review_status enum (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'review_status'
  ) then
    create type public.review_status as enum (
      'pending', 'approved', 'rejected', 'hidden'
    );
  end if;
end;
$$;

-- 2) reviews table (guarded)
do $$
begin
  if to_regclass('public.reviews') is null then
    execute $ddl$
      create table public.reviews (
        id uuid primary key default gen_random_uuid(),
        project_id uuid not null references public.projects (id) on delete cascade,
        client_id uuid not null references public.profiles (id) on delete cascade,
        rating integer not null check (rating between 1 and 5),
        title text,
        review text not null,
        status public.review_status not null default 'pending',
        submitted_at timestamptz not null default now(),
        published_at timestamptz
      )
    $ddl$;
    execute 'create index reviews_status_idx on public.reviews (status, submitted_at desc)';
    execute 'create index reviews_project_idx on public.reviews (project_id)';
    execute 'create index reviews_client_idx on public.reviews (client_id)';
  end if;
end;
$$;

-- 3) RLS + admin moderation policies
do $$
begin
  if to_regclass('public.reviews') is not null then
    execute 'alter table public.reviews enable row level security';
    execute 'drop policy if exists "Admins can view reviews" on public.reviews';
    execute 'create policy "Admins can view reviews" on public.reviews for select to authenticated using (public.is_active_admin())';
    execute 'drop policy if exists "Admins can moderate reviews" on public.reviews';
    execute 'create policy "Admins can moderate reviews" on public.reviews for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin())';
    execute 'grant select, update on public.reviews to authenticated';
  end if;
end;
$$;
