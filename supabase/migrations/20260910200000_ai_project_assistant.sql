-- AI Project Assistant
-- --------------------
-- Ensures ai_settings, ai_rules, ai_knowledge, ai_faqs, ai_chat_sessions, and
-- ai_chat_messages exist. Tables are created only when absent so any existing
-- DDL on the database wins.
--
-- Anonymous visitors must not have direct table access. Persistence happens
-- through the Next.js server route using the service role key. Authenticated
-- clients may read/write only their own chat sessions. Knowledge tables are
-- admin-managed; the server loads active rows to build Gemini context.
--
-- Depends on public.is_active_admin() (20260904130000).

do $$
begin
  if to_regclass('public.ai_settings') is null then
    execute $ddl$
      create table public.ai_settings (
        id uuid primary key default gen_random_uuid(),
        key text not null unique,
        value text not null default '',
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;
  end if;

  if to_regclass('public.ai_rules') is null then
    execute $ddl$
      create table public.ai_rules (
        id uuid primary key default gen_random_uuid(),
        title text not null,
        content text not null,
        category text,
        priority integer not null default 0,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;
    execute 'create index ai_rules_active_priority_idx on public.ai_rules (is_active, priority desc, created_at)';
  end if;

  if to_regclass('public.ai_knowledge') is null then
    execute $ddl$
      create table public.ai_knowledge (
        id uuid primary key default gen_random_uuid(),
        title text not null,
        content text not null,
        category text,
        sort_order integer not null default 0,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;
    execute 'create index ai_knowledge_active_sort_idx on public.ai_knowledge (is_active, sort_order, created_at)';
  end if;

  if to_regclass('public.ai_faqs') is null then
    execute $ddl$
      create table public.ai_faqs (
        id uuid primary key default gen_random_uuid(),
        question text not null,
        answer text not null,
        sort_order integer not null default 0,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;
    execute 'create index ai_faqs_active_sort_idx on public.ai_faqs (is_active, sort_order, created_at)';
  end if;

  if to_regclass('public.ai_chat_sessions') is null then
    execute $ddl$
      create table public.ai_chat_sessions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references public.profiles (id) on delete set null,
        visitor_id text,
        title text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;
    execute 'create index ai_chat_sessions_user_idx on public.ai_chat_sessions (user_id, updated_at desc)';
    execute 'create index ai_chat_sessions_visitor_idx on public.ai_chat_sessions (visitor_id, updated_at desc)';
  end if;

  if to_regclass('public.ai_chat_messages') is null then
    execute $ddl$
      create table public.ai_chat_messages (
        id uuid primary key default gen_random_uuid(),
        session_id uuid not null references public.ai_chat_sessions (id) on delete cascade,
        role text not null,
        content text not null,
        cta jsonb,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        check (role in ('user', 'assistant', 'system'))
      )
    $ddl$;
    execute 'create index ai_chat_messages_session_idx on public.ai_chat_messages (session_id, created_at)';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.ai_chat_sessions') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ai_chat_sessions' and column_name = 'visitor_id'
    ) then
      alter table public.ai_chat_sessions add column visitor_id text;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ai_chat_sessions' and column_name = 'title'
    ) then
      alter table public.ai_chat_sessions add column title text;
    end if;
  end if;

  if to_regclass('public.ai_chat_messages') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ai_chat_messages' and column_name = 'metadata'
    ) then
      alter table public.ai_chat_messages add column metadata jsonb not null default '{}'::jsonb;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ai_chat_messages' and column_name = 'cta'
    ) then
      alter table public.ai_chat_messages add column cta jsonb;
    end if;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.ai_settings') is not null
     and not exists (select 1 from public.ai_settings) then
    insert into public.ai_settings (key, value) values
      ('enabled', 'true'),
      ('assistant_name', 'Project Assistant'),
      ('tone', 'professional, clear, and concise'),
      ('cta_label', 'Start a Project'),
      ('cta_href', '/start-project'),
      ('max_history_messages', '20');
  end if;

  if to_regclass('public.ai_rules') is not null
     and not exists (select 1 from public.ai_rules) then
    insert into public.ai_rules (title, content, category, priority) values
      (
        'Never invent business facts',
        'Never invent pricing, services, portfolio details, availability, guarantees, or private information. Only use facts present in the provided context.',
        'safety',
        100
      ),
      (
        'Admit missing information',
        'If reliable information is unavailable, say so instead of guessing. Offer Start a Project or Contact as the next step when a definite answer cannot be given.',
        'safety',
        90
      ),
      (
        'Stay on this business',
        'Stay focused on Shakib Shahriar''s web development business. Politely decline unrelated topics and redirect to websites, web apps, portfolio, process, or starting a project.',
        'behavior',
        80
      ),
      (
        'Hiring intent CTA',
        'When the visitor wants to hire, request a quote, discuss budget, or start a project, use Start a Project as the primary call to action.',
        'cta',
        70
      );
  end if;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ai_settings',
    'ai_rules',
    'ai_knowledge',
    'ai_faqs',
    'ai_chat_sessions',
    'ai_chat_messages'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

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
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.ai_chat_sessions') is not null then
    drop policy if exists "Users can view own ai_chat_sessions" on public.ai_chat_sessions;
    create policy "Users can view own ai_chat_sessions"
      on public.ai_chat_sessions
      for select
      to authenticated
      using (user_id = auth.uid());

    drop policy if exists "Users can insert own ai_chat_sessions" on public.ai_chat_sessions;
    create policy "Users can insert own ai_chat_sessions"
      on public.ai_chat_sessions
      for insert
      to authenticated
      with check (user_id = auth.uid());

    drop policy if exists "Users can update own ai_chat_sessions" on public.ai_chat_sessions;
    create policy "Users can update own ai_chat_sessions"
      on public.ai_chat_sessions
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if to_regclass('public.ai_chat_messages') is not null then
    drop policy if exists "Users can view own ai_chat_messages" on public.ai_chat_messages;
    create policy "Users can view own ai_chat_messages"
      on public.ai_chat_messages
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.ai_chat_sessions s
          where s.id = ai_chat_messages.session_id
            and s.user_id = auth.uid()
        )
      );

    drop policy if exists "Users can insert own ai_chat_messages" on public.ai_chat_messages;
    create policy "Users can insert own ai_chat_messages"
      on public.ai_chat_messages
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.ai_chat_sessions s
          where s.id = ai_chat_messages.session_id
            and s.user_id = auth.uid()
        )
      );
  end if;
end;
$$;
