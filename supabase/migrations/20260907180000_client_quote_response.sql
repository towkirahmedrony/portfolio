-- Client quote response workflow (additive).
--
-- Clients may view their own sent/viewed/accepted/rejected/expired quotes and
-- quote line items, and may accept / reject / request changes through a
-- security-definer RPC. They cannot update quote prices, line items, totals,
-- project status, or invoice data. Existing quote versioning is unchanged.

-- ---------------------------------------------------------------------------
-- 1. Tighten client quote SELECT: own projects, non-draft only.
--    Admin policies remain separate (OR).
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
      and exists (
        select 1
        from public.projects
        where projects.id = quotes.project_id
          and projects.client_id = auth.uid()
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
        join public.projects on projects.id = quotes.project_id
        where quotes.id = quote_items.quote_id
          and projects.client_id = auth.uid()
          and quotes.status in ('sent', 'viewed', 'accepted', 'rejected', 'expired')
      )
    )
  $policy$;

  execute 'grant select on public.quote_items to authenticated';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Mark a sent quote as viewed when the owning client opens it.
--    Does not change money fields or terminal statuses.
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
  join public.projects on projects.id = quotes.project_id
  where quotes.id = p_quote_id
    and projects.client_id = v_uid
  for update of quotes;

  if not found then
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
-- 3. Client accept / reject / request-changes.
--    Accept and reject only mutate status + timestamp columns.
--    Request-changes preserves the quote and notifies admin via project_messages.
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
  v_project record;
  v_action text;
  v_message text;
  v_now timestamptz := timezone('utc', now());
  v_note text;
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
  join public.projects on projects.id = quotes.project_id
  where quotes.id = p_quote_id
    and projects.client_id = v_uid
  for update of quotes;

  if not found then
    raise exception 'Quote not found.';
  end if;

  select *
  into v_project
  from public.projects
  where id = v_quote.project_id
    and client_id = v_uid;

  if not found then
    raise exception 'Not authorized';
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

    if to_regclass('public.project_messages') is not null then
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

  if v_quote.status not in ('sent', 'viewed') then
    raise exception 'This quote can no longer be accepted or rejected.';
  end if;

  if v_action = 'accept' then
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
      raise exception 'This quote can no longer be accepted.';
    end if;

    if to_regclass('public.project_messages') is not null then
      insert into public.project_messages (
        project_id,
        sender_id,
        message,
        is_read
      )
      values (
        v_quote.project_id,
        v_uid,
        'Client accepted quote v' || v_quote.version::text || '.',
        false
      );
    end if;

    return 'accepted'::public.quote_status;
  end if;

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

  if to_regclass('public.project_messages') is not null then
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
end;
$$;

revoke all on function public.client_respond_to_quote(uuid, text, text) from public, anon;
grant execute on function public.client_respond_to_quote(uuid, text, text) to authenticated;
