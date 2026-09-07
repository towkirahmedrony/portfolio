-- Request -> Quote(s) -> client accept -> ONE Project.
--
-- Quotes may exist before a project. quotes.project_id is nullable;
-- quotes.project_request_id associates a quote with the originating request.
-- A project is created only when the client accepts the current quote.
-- admin_convert_project_request no longer creates projects on its own.

-- ---------------------------------------------------------------------------
-- 1. Schema: allow pre-project quotes attached to a project request.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.quotes') is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quotes'
      and column_name = 'project_request_id'
  ) then
    alter table public.quotes
      add column project_request_id uuid references public.project_requests (id) on delete restrict;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quotes'
      and column_name = 'project_id'
      and is_nullable = 'NO'
  ) then
    alter table public.quotes alter column project_id drop not null;
  end if;
end;
$$;

update public.quotes as q
set project_request_id = p.request_id
from public.projects as p
where q.project_id = p.id
  and q.project_request_id is null
  and p.request_id is not null;

create index if not exists quotes_project_request_id_idx
  on public.quotes (project_request_id);

do $$
declare
  v_duplicate_count integer := 0;
begin
  if to_regclass('public.quotes') is null then
    return;
  end if;

  select count(*) into v_duplicate_count
  from (
    select project_request_id, version
    from public.quotes
    where project_request_id is not null
    group by project_request_id, version
    having count(*) > 1
  ) duplicates;

  if v_duplicate_count > 0 then
    raise notice
      'quotes (project_request_id, version) has % duplicate group(s). Unique index skipped.',
      v_duplicate_count;
    return;
  end if;

  execute $sql$
    create unique index if not exists quotes_request_version_unique
      on public.quotes (project_request_id, version)
      where project_request_id is not null
  $sql$;
end;
$$;

do $$
begin
  if to_regclass('public.quotes') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_request_or_project_chk'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_request_or_project_chk
      check (project_id is not null or project_request_id is not null);
  end if;
end;
$$;

do $$
declare
  v_duplicate_count integer := 0;
begin
  if to_regclass('public.projects') is null then
    return;
  end if;

  select count(*) into v_duplicate_count
  from (
    select request_id
    from public.projects
    where request_id is not null
    group by request_id
    having count(*) > 1
  ) duplicates;

  if v_duplicate_count > 0 then
    raise notice
      'projects.request_id has % duplicate group(s). Unique index skipped.',
      v_duplicate_count;
    return;
  end if;

  execute $sql$
    create unique index if not exists projects_request_id_unique
      on public.projects (request_id)
      where request_id is not null
  $sql$;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Client RLS: own quotes via request ownership, including pre-project quotes.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.quotes') is null then
    return;
  end if;

  execute 'alter table public.quotes enable row level security';

  execute 'drop policy if exists "Customers can view quotes for their projects" on public.quotes';
  execute $policy$
    create policy "Customers can view quotes for their projects"
    on public.quotes
    for select
    to authenticated
    using (
      status in ('sent', 'viewed', 'accepted', 'rejected', 'expired')
      and (
        exists (
          select 1
          from public.project_requests
          where project_requests.id = quotes.project_request_id
            and project_requests.client_id = auth.uid()
        )
        or exists (
          select 1
          from public.projects
          where projects.id = quotes.project_id
            and projects.client_id = auth.uid()
        )
      )
    )
  $policy$;

  execute 'grant select on public.quotes to authenticated';
end;
$$;

do $$
begin
  if to_regclass('public.quote_items') is null then
    return;
  end if;

  execute 'alter table public.quote_items enable row level security';

  execute 'drop policy if exists "Customers can view quote items for their projects" on public.quote_items';
  execute $policy$
    create policy "Customers can view quote items for their projects"
    on public.quote_items
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.quotes
        where quotes.id = quote_items.quote_id
          and quotes.status in ('sent', 'viewed', 'accepted', 'rejected', 'expired')
          and (
            exists (
              select 1
              from public.project_requests
              where project_requests.id = quotes.project_request_id
                and project_requests.client_id = auth.uid()
            )
            or exists (
              select 1
              from public.projects
              where projects.id = quotes.project_id
                and projects.client_id = auth.uid()
            )
          )
      )
    )
  $policy$;

  execute 'grant select on public.quote_items to authenticated';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Client mark-viewed: request ownership, no project required.
-- ---------------------------------------------------------------------------

create or replace function public.client_mark_quote_viewed(p_quote_id uuid)
returns public.quote_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote record;
  v_owns boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if to_regclass('public.quotes') is null then
    raise exception 'quotes is not available';
  end if;

  select quotes.*
  into v_quote
  from public.quotes
  where quotes.id = p_quote_id
  for update;

  if not found then
    raise exception 'Quote not found.';
  end if;

  if v_quote.project_request_id is not null then
    select exists (
      select 1
      from public.project_requests
      where id = v_quote.project_request_id
        and client_id = v_uid
    ) into v_owns;
  end if;

  if not v_owns and v_quote.project_id is not null then
    select exists (
      select 1
      from public.projects
      where id = v_quote.project_id
        and client_id = v_uid
    ) into v_owns;
  end if;

  if not v_owns then
    raise exception 'Quote not found.';
  end if;

  if v_quote.status = 'sent' then
    update public.quotes
    set
      status = 'viewed',
      updated_at = timezone('utc', now())
    where id = v_quote.id
      and status = 'sent';

    return 'viewed'::public.quote_status;
  end if;

  return v_quote.status;
end;
$$;

revoke all on function public.client_mark_quote_viewed(uuid) from public, anon;
grant execute on function public.client_mark_quote_viewed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Client accept/reject/request-changes.
--    Accept is the only path that creates a project, atomically.
-- ---------------------------------------------------------------------------

create or replace function public.client_respond_to_quote(
  p_quote_id uuid,
  p_action text,
  p_message text default null
)
returns public.quote_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote record;
  v_request record;
  v_project record;
  v_action text;
  v_message text;
  v_now timestamptz := timezone('utc', now());
  v_note text;
  v_owns boolean := false;
  v_has_request boolean := false;
  v_project_id uuid;
  v_title text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if to_regclass('public.quotes') is null then
    raise exception 'quotes is not available';
  end if;

  v_action := lower(btrim(coalesce(p_action, '')));
  if v_action not in ('accept', 'reject', 'request_changes') then
    raise exception 'Invalid quote action.';
  end if;

  v_message := nullif(btrim(coalesce(p_message, '')), '');

  select quotes.*
  into v_quote
  from public.quotes
  where quotes.id = p_quote_id
  for update;

  if not found then
    raise exception 'Quote not found.';
  end if;

  if v_quote.project_request_id is not null then
    select *
    into v_request
    from public.project_requests
    where id = v_quote.project_request_id
    for update;

    if found then
      v_has_request := true;
      if v_request.client_id = v_uid then
        v_owns := true;
      end if;
    end if;
  elsif v_quote.project_id is not null then
    select *
    into v_project
    from public.projects
    where id = v_quote.project_id
    for update;

    if found and v_project.client_id = v_uid then
      v_owns := true;
      if v_project.request_id is not null then
        select *
        into v_request
        from public.project_requests
        where id = v_project.request_id
        for update;

        if found then
          v_has_request := true;
        end if;
      end if;
    end if;
  end if;

  if not v_owns then
    raise exception 'Quote not found.';
  end if;

  if v_action = 'request_changes' then
    if v_quote.status not in ('sent', 'viewed', 'rejected', 'expired') then
      raise exception 'Changes can only be requested on a sent, viewed, rejected, or expired quote.';
    end if;

    if v_message is null then
      raise exception 'Please describe the changes you need.';
    end if;

    if length(v_message) > 2000 then
      raise exception 'Message is too long.';
    end if;

    v_note := 'Client requested changes on quote v'
      || v_quote.version::text
      || ': '
      || v_message;

    if v_quote.project_id is not null and to_regclass('public.project_messages') is not null then
      insert into public.project_messages (
        project_id,
        sender_id,
        message,
        is_read
      )
      values (
        v_quote.project_id,
        v_uid,
        v_note,
        false
      );
    end if;

    return v_quote.status;
  end if;

  if v_quote.status = 'accepted' then
    return 'accepted'::public.quote_status;
  end if;

  if v_quote.status not in ('sent', 'viewed') then
    raise exception 'This quote can no longer be accepted or rejected.';
  end if;

  if v_action = 'reject' then
    update public.quotes
    set
      status = 'rejected',
      rejected_at = coalesce(rejected_at, v_now),
      updated_at = v_now
    where id = v_quote.id
      and status in ('sent', 'viewed');

    if not found then
      raise exception 'This quote can no longer be rejected.';
    end if;

    v_note := 'Client rejected quote v' || v_quote.version::text || '.';
    if v_message is not null then
      v_note := v_note || ' ' || v_message;
    end if;

    if v_quote.project_id is not null and to_regclass('public.project_messages') is not null then
      insert into public.project_messages (
        project_id,
        sender_id,
        message,
        is_read
      )
      values (
        v_quote.project_id,
        v_uid,
        v_note,
        false
      );
    end if;

    return 'rejected'::public.quote_status;
  end if;

  if v_quote.valid_until is not null and v_quote.valid_until < v_now then
    raise exception 'This quote has expired.';
  end if;

  update public.quotes
  set
    status = 'accepted',
    accepted_at = coalesce(accepted_at, v_now),
    updated_at = v_now
  where id = v_quote.id
    and status in ('sent', 'viewed');

  if not found then
    select * into v_quote from public.quotes where id = p_quote_id;
    if v_quote.status = 'accepted' then
      return 'accepted'::public.quote_status;
    end if;
    raise exception 'This quote can no longer be accepted.';
  end if;

  v_project_id := v_quote.project_id;

  if v_has_request then
    select *
    into v_project
    from public.projects
    where request_id = v_request.id
    limit 1;

    if found then
      v_project_id := v_project.id;
    elsif to_regclass('public.projects') is null then
      raise exception 'projects table is not available';
    else
      if v_request.client_id is null then
        raise exception 'This request has no linked client profile and cannot create a project.';
      end if;

      v_title := nullif(btrim(coalesce(v_request.project_type, '')), '');
      if v_title is null then
        v_title := 'Project from ' || v_request.request_number;
      end if;

      begin
        insert into public.projects (
          project_number,
          request_id,
          client_id,
          title,
          description,
          status,
          priority,
          currency,
          estimated_budget,
          agreed_price,
          due_date
        )
        values (
          public.generate_project_number(),
          v_request.id,
          v_request.client_id,
          v_title,
          v_request.description,
          'pending',
          coalesce(v_request.priority, 'normal'::public.project_priority),
          coalesce(nullif(v_quote.currency, ''), nullif(v_request.budget_currency, ''), 'BDT'),
          coalesce(v_request.budget_max, v_request.budget_min),
          v_quote.total,
          v_request.deadline_date
        )
        returning id into v_project_id;
      exception
        when unique_violation then
          select id
          into v_project_id
          from public.projects
          where request_id = v_request.id
          limit 1;

          if v_project_id is null then
            raise;
          end if;
      end;

      if to_regclass('public.project_requirements') is not null
         and not exists (
           select 1 from public.project_requirements where project_id = v_project_id
         )
      then
        insert into public.project_requirements (
          project_id,
          summary,
          scope,
          pages,
          features,
          design_notes
        )
        values (
          v_project_id,
          v_request.description,
          v_request.project_type,
          v_request.page_count,
          to_jsonb(coalesce(v_request.required_features, '{}'::text[])),
          nullif(
            concat_ws(
              e'\n',
              case when v_request.design_style is not null then 'Style: ' || v_request.design_style end,
              case when v_request.figma_url is not null then 'Figma: ' || v_request.figma_url end,
              case when v_request.brand_colors is not null then 'Brand colors: ' || v_request.brand_colors end
            ),
            ''
          )
        );
      end if;

      if v_request.status is distinct from 'converted'
         and v_request.status is distinct from 'cancelled' then
        update public.project_requests
        set status = 'converted'
        where id = v_request.id
          and status is distinct from 'converted'
          and status is distinct from 'cancelled';
      end if;

      if to_regclass('public.referrals') is not null then
        update public.referrals
        set first_project_id = v_project_id
        where project_request_id = v_request.id
          and first_project_id is null;
      end if;
    end if;

    update public.quotes
    set project_id = v_project_id
    where project_request_id = v_request.id
      and (project_id is null or project_id = v_project_id);
  elsif v_project_id is not null then
    update public.projects
    set
      agreed_price = coalesce(agreed_price, v_quote.total),
      currency = coalesce(nullif(v_quote.currency, ''), currency)
    where id = v_project_id;
  end if;

  if v_project_id is not null then
    update public.projects
    set
      agreed_price = v_quote.total,
      currency = coalesce(nullif(v_quote.currency, ''), currency)
    where id = v_project_id;
  end if;

  if v_project_id is not null and to_regclass('public.project_messages') is not null then
    insert into public.project_messages (
      project_id,
      sender_id,
      message,
      is_read
    )
    values (
      v_project_id,
      v_uid,
      'Client accepted quote v' || v_quote.version::text || '.',
      false
    );
  end if;

  return 'accepted'::public.quote_status;
end;
$$;

revoke all on function public.client_respond_to_quote(uuid, text, text) from public, anon;
grant execute on function public.client_respond_to_quote(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Restrict admin conversion so it cannot bypass quote acceptance.
-- ---------------------------------------------------------------------------

create or replace function public.admin_convert_project_request(
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if to_regclass('public.project_requests') is null or to_regclass('public.projects') is null then
    raise exception 'Project tables are not available';
  end if;

  select id
  into v_project_id
  from public.projects
  where request_id = p_request_id
  limit 1;

  if v_project_id is not null then
    return v_project_id;
  end if;

  raise exception 'Projects are created when the client accepts a quote. Create and send a quote from this request instead.';
end;
$$;

revoke all on function public.admin_convert_project_request(uuid) from public, anon;
grant execute on function public.admin_convert_project_request(uuid) to authenticated;
