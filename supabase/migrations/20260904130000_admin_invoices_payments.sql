create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and profiles.status = 'active'
  );
$$;

revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated;

do $$
begin
  if to_regclass('public.invoices') is null then
    return;
  end if;

  execute 'alter table public.invoices enable row level security';
  execute 'alter table public.invoice_items enable row level security';
  execute 'alter table public.payments enable row level security';

  execute 'drop policy if exists "Admins can view invoices" on public.invoices';
  execute 'create policy "Admins can view invoices" on public.invoices for select to authenticated using (public.is_active_admin())';
  execute 'drop policy if exists "Admins can insert invoices" on public.invoices';
  execute 'create policy "Admins can insert invoices" on public.invoices for insert to authenticated with check (public.is_active_admin())';
  execute 'drop policy if exists "Admins can update invoices" on public.invoices';
  execute 'create policy "Admins can update invoices" on public.invoices for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin())';
  execute 'drop policy if exists "Clients can view own invoices" on public.invoices';
  execute 'create policy "Clients can view own invoices" on public.invoices for select to authenticated using (client_id = auth.uid())';

  execute 'drop policy if exists "Admins can view invoice items" on public.invoice_items';
  execute 'create policy "Admins can view invoice items" on public.invoice_items for select to authenticated using (public.is_active_admin())';
  execute 'drop policy if exists "Admins can insert invoice items" on public.invoice_items';
  execute 'create policy "Admins can insert invoice items" on public.invoice_items for insert to authenticated with check (public.is_active_admin())';
  execute 'drop policy if exists "Admins can update invoice items" on public.invoice_items';
  execute 'create policy "Admins can update invoice items" on public.invoice_items for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin())';
  execute 'drop policy if exists "Admins can delete invoice items" on public.invoice_items';
  execute 'create policy "Admins can delete invoice items" on public.invoice_items for delete to authenticated using (public.is_active_admin())';
  execute 'drop policy if exists "Clients can view own invoice items" on public.invoice_items';
  execute $pol$
    create policy "Clients can view own invoice items"
    on public.invoice_items
    for select
    to authenticated
    using (
      exists (
        select 1 from public.invoices
        where invoices.id = invoice_items.invoice_id
          and invoices.client_id = auth.uid()
      )
    )
  $pol$;

  execute 'drop policy if exists "Admins can view payments" on public.payments';
  execute 'create policy "Admins can view payments" on public.payments for select to authenticated using (public.is_active_admin())';
  execute 'drop policy if exists "Admins can insert payments" on public.payments';
  execute 'create policy "Admins can insert payments" on public.payments for insert to authenticated with check (public.is_active_admin())';
  execute 'drop policy if exists "Admins can update payments" on public.payments';
  execute 'create policy "Admins can update payments" on public.payments for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin())';
  execute 'drop policy if exists "Clients can view own payments" on public.payments';
  execute 'create policy "Clients can view own payments" on public.payments for select to authenticated using (client_id = auth.uid())';

  execute 'grant select, insert, update on public.invoices to authenticated';
  execute 'grant select, insert, update, delete on public.invoice_items to authenticated';
  execute 'grant select, insert, update on public.payments to authenticated';
end;
$$;

do $$
begin
  if to_regclass('public.payment_events') is null then
    return;
  end if;

  execute 'alter table public.payment_events enable row level security';
  execute 'drop policy if exists "Admins can view payment events" on public.payment_events';
  execute 'create policy "Admins can view payment events" on public.payment_events for select to authenticated using (public.is_active_admin())';
  execute 'grant select on public.payment_events to authenticated';
end;
$$;

create or replace function public.generate_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  if to_regclass('public.invoices') is null then
    raise exception 'invoices table is not available';
  end if;

  loop
    attempts := attempts + 1;
    candidate := 'INV-'
      || to_char(timezone('utc', now()), 'YYYYMMDD')
      || '-'
      || upper(substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text), 1, 8));

    exit when not exists (
      select 1 from public.invoices where invoice_number = candidate
    );

    if attempts >= 20 then
      raise exception 'Could not generate a unique invoice number';
    end if;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.generate_invoice_number() from public, anon, authenticated;

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

  select * into v_project
  from public.projects
  where id = v_quote.project_id;

  if not found then
    raise exception 'Project not found.';
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
    v_quote.project_id,
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

create or replace function public.admin_record_manual_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_type text,
  p_payment_method text default null,
  p_provider text default null,
  p_transaction_reference text default null,
  p_paid_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice record;
  v_paid numeric;
  v_amount numeric;
  v_next_paid numeric;
  v_next_due numeric;
  v_next_status text;
  v_payment_id uuid;
  v_paid_at timestamptz;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if to_regclass('public.invoices') is null or to_regclass('public.payments') is null then
    raise exception 'Payment tables are not available';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  if p_payment_type not in ('advance', 'milestone', 'final', 'full', 'refund') then
    raise exception 'Invalid payment type.';
  end if;

  v_amount := round(p_amount, 2);
  v_paid_at := coalesce(p_paid_at, timezone('utc', now()));

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_invoice.status in ('draft', 'cancelled') then
    raise exception 'Payments cannot be recorded on draft or cancelled invoices.';
  end if;

  select coalesce(sum(
    case
      when payment_type = 'refund' then -round(amount, 2)
      else round(amount, 2)
    end
  ), 0)
  into v_paid
  from public.payments
  where invoice_id = v_invoice.id
    and status = 'succeeded';

  if p_payment_type = 'refund' then
    if v_amount > v_paid then
      raise exception 'Refund cannot exceed the amount already paid.';
    end if;
    v_next_paid := round(v_paid - v_amount, 2);
  else
    if round(v_paid + v_amount, 2) > round(v_invoice.total, 2) then
      raise exception 'Amount paid cannot exceed the invoice total.';
    end if;
    v_next_paid := round(v_paid + v_amount, 2);
  end if;

  v_next_due := greatest(0, round(v_invoice.total - v_next_paid, 2));

  if v_invoice.status = 'refunded' and p_payment_type <> 'refund' then
    raise exception 'Cannot record a non-refund payment on a refunded invoice.';
  end if;

  if p_payment_type = 'refund' and v_next_paid <= 0 then
    v_next_status := 'refunded';
  elsif v_next_due <= 0 and v_next_paid >= round(v_invoice.total, 2) and round(v_invoice.total, 2) > 0 then
    v_next_status := 'paid';
  elsif v_next_paid > 0 and v_next_due > 0 then
    if v_invoice.due_date is not null and v_invoice.due_date < (timezone('utc', now()))::date then
      v_next_status := 'overdue';
    else
      v_next_status := 'partially_paid';
    end if;
  elsif v_invoice.due_date is not null and v_invoice.due_date < (timezone('utc', now()))::date then
    v_next_status := 'overdue';
  else
    v_next_status := 'issued';
  end if;

  insert into public.payments (
    invoice_id,
    project_id,
    client_id,
    amount,
    currency,
    payment_type,
    payment_method,
    provider,
    status,
    transaction_reference,
    paid_at
  )
  values (
    v_invoice.id,
    v_invoice.project_id,
    v_invoice.client_id,
    v_amount,
    v_invoice.currency,
    p_payment_type,
    nullif(btrim(coalesce(p_payment_method, '')), ''),
    coalesce(nullif(btrim(coalesce(p_provider, '')), ''), 'manual'),
    'succeeded',
    nullif(btrim(coalesce(p_transaction_reference, '')), ''),
    v_paid_at
  )
  returning id into v_payment_id;

  update public.invoices
  set
    amount_paid = v_next_paid,
    amount_due = v_next_due,
    status = v_next_status,
    paid_at = case
      when v_next_status = 'paid' then coalesce(v_invoice.paid_at, v_paid_at)
      when v_next_status = 'refunded' then null
      else v_invoice.paid_at
    end
  where id = v_invoice.id;

  return v_payment_id;
end;
$$;

revoke all on function public.admin_record_manual_payment(uuid, numeric, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.admin_record_manual_payment(uuid, numeric, text, text, text, text, timestamptz) to authenticated;
