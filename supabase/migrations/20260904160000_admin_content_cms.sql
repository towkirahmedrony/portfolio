-- Admin Portfolio & Services (Content CMS)
-- ----------------------------------------
-- Supports /admin/portfolio, /admin/portfolio/[id], /admin/services and
-- /admin/services/[id] against database-schema.md. Tables are created only
-- when absent so any existing DDL on the database wins. Access is admin-only
-- (is_active_admin): public pages in this codebase render static data and do
-- not read these tables, so no anon/client policies are added here.
--
-- Depends on public.is_active_admin() (20260904130000).

-- 1) portfolio_projects
do $$
begin
  if to_regclass('public.portfolio_projects') is null then
    execute $ddl$
      create table public.portfolio_projects (
        id uuid primary key default gen_random_uuid(),
        title text not null,
        slug text not null unique,
        short_description text,
        description text,
        category text,
        technologies text[] not null default '{}',
        live_url text,
        github_url text,
        thumbnail_url text,
        featured boolean not null default false,
        published boolean not null default false,
        sort_order integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;
  end if;
end;
$$;

-- 2) portfolio_project_images (metadata; objects live in Supabase Storage)
do $$
begin
  if to_regclass('public.portfolio_project_images') is null then
    execute $ddl$
      create table public.portfolio_project_images (
        id uuid primary key default gen_random_uuid(),
        portfolio_project_id uuid not null
          references public.portfolio_projects (id) on delete cascade,
        image_url text not null,
        alt_text text,
        sort_order integer not null default 0
      )
    $ddl$;
    execute 'create index portfolio_project_images_project_idx on public.portfolio_project_images (portfolio_project_id, sort_order)';
  end if;
end;
$$;

-- 3) services
do $$
begin
  if to_regclass('public.services') is null then
    execute $ddl$
      create table public.services (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        slug text not null unique,
        short_description text,
        description text,
        starting_price numeric
          check (starting_price is null or starting_price >= 0),
        currency text not null default 'BDT',
        estimated_days_min integer
          check (estimated_days_min is null or estimated_days_min >= 0),
        estimated_days_max integer
          check (estimated_days_max is null or estimated_days_max >= 0),
        published boolean not null default false,
        featured boolean not null default false,
        sort_order integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;
  end if;
end;
$$;

-- 4) service_features
do $$
begin
  if to_regclass('public.service_features') is null then
    execute $ddl$
      create table public.service_features (
        id uuid primary key default gen_random_uuid(),
        service_id uuid not null
          references public.services (id) on delete cascade,
        feature text not null,
        sort_order integer not null default 0
      )
    $ddl$;
    execute 'create index service_features_service_idx on public.service_features (service_id, sort_order)';
  end if;
end;
$$;

-- 5) RLS + admin policies. All writes happen in server actions running as the
--    signed-in admin, so table-level grants to authenticated are sufficient.
do $$
declare
  t text;
begin
  foreach t in array array['portfolio_projects', 'portfolio_project_images', 'services', 'service_features']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Admins can view %I" on public.%I', t, t);
    execute format('create policy "Admins can view %I" on public.%I for select to authenticated using (public.is_active_admin())', t, t);
    execute format('drop policy if exists "Admins can insert %I" on public.%I', t, t);
    execute format('create policy "Admins can insert %I" on public.%I for insert to authenticated with check (public.is_active_admin())', t, t);
    execute format('drop policy if exists "Admins can update %I" on public.%I', t, t);
    execute format('create policy "Admins can update %I" on public.%I for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin())', t, t);
    execute format('drop policy if exists "Admins can delete %I" on public.%I', t, t);
    execute format('create policy "Admins can delete %I" on public.%I for delete to authenticated using (public.is_active_admin())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
