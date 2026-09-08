-- Admin Project Request Form builder
-- ----------------------------------
-- Ensures order_form_steps / order_form_fields / order_form_options exist and
-- that only active admins can write. Public (anon / authenticated) may SELECT
-- active, visible rows so /start-project stays database-driven. Hidden rows
-- remain readable by admins for the form builder.
--
-- Depends on public.is_active_admin() (20260904130000).
-- Does not touch project_requests, quotes, or projects.

create or replace function public.set_order_form_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.order_form_steps') is null then
    execute $ddl$
      create table public.order_form_steps (
        id uuid primary key default gen_random_uuid(),
        step_key text not null unique,
        title text not null,
        description text,
        sort_order integer not null default 0,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;
    execute 'create index order_form_steps_sort_idx on public.order_form_steps (sort_order, id)';
  end if;

  if to_regclass('public.order_form_options') is null then
    execute $ddl$
      create table public.order_form_options (
        id uuid primary key default gen_random_uuid(),
        "group" text not null,
        slug text not null,
        label text not null,
        description text,
        requires_text boolean not null default false,
        sort_order integer not null default 0,
        is_active boolean not null default true,
        meta jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique ("group", slug)
      )
    $ddl$;
    execute 'create index order_form_options_group_sort_idx on public.order_form_options ("group", sort_order, id)';
  end if;

  if to_regclass('public.order_form_fields') is null then
    execute $ddl$
      create table public.order_form_fields (
        id uuid primary key default gen_random_uuid(),
        field_key text not null unique,
        step_id uuid not null references public.order_form_steps (id) on delete cascade,
        input_type text not null,
        label text not null,
        hint text,
        placeholder text,
        options_group text,
        required boolean not null default false,
        visible boolean not null default true,
        sort_order integer not null default 0,
        conditional jsonb not null default '{}'::jsonb,
        constraints jsonb not null default '{}'::jsonb,
        default_value jsonb,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (input_type in (
          'text', 'email', 'tel', 'textarea', 'date', 'radio', 'checkbox_group', 'select'
        ))
      )
    $ddl$;
    execute 'create index order_form_fields_step_sort_idx on public.order_form_fields (step_id, sort_order, id)';
  end if;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['order_form_steps', 'order_form_fields', 'order_form_options']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format(
      'drop trigger if exists set_%I_updated_at on public.%I',
      t,
      t
    );
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_order_form_updated_at()',
      t,
      t
    );
  end loop;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['order_form_steps', 'order_form_fields', 'order_form_options']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "Admins can view %I" on public.%I', t, t);
    execute format(
      'create policy "Admins can view %I" on public.%I for select to authenticated using (public.is_active_admin())',
      t,
      t
    );
    execute format('drop policy if exists "Admins can insert %I" on public.%I', t, t);
    execute format(
      'create policy "Admins can insert %I" on public.%I for insert to authenticated with check (public.is_active_admin())',
      t,
      t
    );
    execute format('drop policy if exists "Admins can update %I" on public.%I', t, t);
    execute format(
      'create policy "Admins can update %I" on public.%I for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin())',
      t,
      t
    );
    execute format('drop policy if exists "Admins can delete %I" on public.%I', t, t);
    execute format(
      'create policy "Admins can delete %I" on public.%I for delete to authenticated using (public.is_active_admin())',
      t,
      t
    );

    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select on public.%I to anon', t);
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.order_form_steps') is not null then
    drop policy if exists "Public can view active order form steps" on public.order_form_steps;
    create policy "Public can view active order form steps"
      on public.order_form_steps
      for select
      to anon, authenticated
      using (is_active = true);
  end if;

  if to_regclass('public.order_form_options') is not null then
    drop policy if exists "Public can view active order form options" on public.order_form_options;
    create policy "Public can view active order form options"
      on public.order_form_options
      for select
      to anon, authenticated
      using (is_active = true);
  end if;

  if to_regclass('public.order_form_fields') is not null then
    drop policy if exists "Public can view active order form fields" on public.order_form_fields;
    create policy "Public can view active order form fields"
      on public.order_form_fields
      for select
      to anon, authenticated
      using (
        is_active = true
        and visible = true
        and exists (
          select 1
          from public.order_form_steps s
          where s.id = order_form_fields.step_id
            and s.is_active = true
        )
      );
  end if;
end;
$$;
