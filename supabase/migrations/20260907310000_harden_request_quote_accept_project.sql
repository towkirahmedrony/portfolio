-- Harden Request -> Quote version(s) -> client accept -> ONE Project.
--
-- Completes the workflow from 20260907300000:
--   * Accept is the only path that inserts a project.
--   * Repeated / concurrent accepts are idempotent (request lock + unique
--     projects.request_id + unique_violation fallback).
--   * Already-accepted quotes still attach/create the single project if needed.
--   * Invoices require the accepted quote's project (never invent one).

-- ---------------------------------------------------------------------------
-- 1. Client accept/reject/request-changes (atomic + idempotent).
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

  if v_action = 'reject' then
    if v_quote.status = 'accepted' then
      raise exception 'This quote can no longer be rejected.';
    end if;

    if v_quote.status not in ('sent', 'viewed') then
      raise exception 'This quote can no longer be accepted or rejected.';
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

  -- Accept is the only path that creates a project.
  if v_quote.status <> 'accepted' then
    if v_quote.status not in ('sent', 'viewed') then
      raise exception 'This quote can no longer be accepted or rejected.';
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
      if v_quote.status is distinct from 'accepted' then
        raise exception 'This quote can no longer be accepted.';
      end if;
    else
      v_quote.status := 'accepted';
      v_quote.accepted_at := coalesce(v_quote.accepted_at, v_now);
    end if;
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
          'normal'::public.project_priority,
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
  end if;

  if v_project_id is not null then
    update public.projects
    set
      agreed_price = v_quote.total,
      currency = coalesce(nullif(v_quote.currency, ''), currency)
    where id = v_project_id;
  end if;

  if v_project_id is not null and to_regclass('public.project_messages') is not null then
    if not exists (
      select 1
      from public.project_messages
      where project_id = v_project_id
        and sender_id = v_uid
        and message = 'Client accepted quote v' || v_quote.version::text || '.'
    ) then
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
  end if;

  return 'accepted'::public.quote_status;
end;
$$;

revoke all on function public.client_respond_to_quote(uuid, text, text) from public, anon;
grant execute on function public.client_respond_to_quote(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Invoice from quote: require the project created by client accept.
-- ---------------------------------------------------------------------------

create or replace function public.admin_create_invoice_from_quote(
  p_quote_id uuid,
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote record;
  v_project record;
  v_invoice_id uuid;
  v_item record;
  v_project_id uuid;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if to_regclass('public.invoices') is null or to_regclass('public.quotes') is null then
    raise exception 'Invoice tables are not available';
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'Quote not found.';
  end if;

  if v_quote.status <> 'accepted' then
    raise exception 'Only accepted quotes can be converted to invoices.';
  end if;

  if exists (select 1 from public.invoices where quote_id = p_quote_id) then
    raise exception 'An invoice already exists for this quote.';
  end if;

  v_project_id := v_quote.project_id;

  if v_project_id is null and v_quote.project_request_id is not null then
    select id
    into v_project_id
    from public.projects
    where request_id = v_quote.project_request_id
    limit 1;
  end if;

  if v_project_id is null then
    raise exception 'A project is created when the client accepts a quote. Invoices can only be created after that.';
  end if;

  select * into v_project
  from public.projects
  where id = v_project_id;

  if not found then
    raise exception 'Project not found.';
  end if;

  if v_quote.project_id is distinct from v_project_id then
    update public.quotes
    set project_id = v_project_id
    where id = v_quote.id
      and project_id is null;
  end if;

  insert into public.invoices (
    invoice_number,
    project_id,
    client_id,
    quote_id,
    currency,
    subtotal,
    discount_total,
    tax_total,
    total,
    amount_paid,
    amount_due,
    status,
    issue_date,
    due_date
  )
  values (
    public.generate_invoice_number(),
    v_project_id,
    v_project.client_id,
    v_quote.id,
    coalesce(nullif(v_quote.currency, ''), v_project.currency, 'BDT'),
    coalesce(v_quote.subtotal, 0),
    coalesce(v_quote.discount_total, 0),
    coalesce(v_quote.tax_total, 0),
    coalesce(v_quote.total, 0),
    0,
    coalesce(v_quote.total, 0),
    'draft',
    (timezone('utc', now()))::date,
    p_due_date
  )
  returning id into v_invoice_id;

  for v_item in
    select description, quantity, unit_price, amount
    from public.quote_items
    where quote_id = v_quote.id
    order by sort_order asc, created_at asc
  loop
    insert into public.invoice_items (
      invoice_id,
      description,
      quantity,
      unit_price,
      amount
    )
    values (
      v_invoice_id,
      v_item.description,
      v_item.quantity,
      v_item.unit_price,
      v_item.amount
    );
  end loop;

  if not exists (select 1 from public.invoice_items where invoice_id = v_invoice_id) then
    raise exception 'Accepted quote has no line items.';
  end if;

  return v_invoice_id;
end;
$$;

revoke all on function public.admin_create_invoice_from_quote(uuid, date) from public, anon;
grant execute on function public.admin_create_invoice_from_quote(uuid, date) to authenticated;
