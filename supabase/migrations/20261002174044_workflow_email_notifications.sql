-- ============================================================================
-- Workflow email notifications
--
-- Adds email notifications for the business-significant events in the client
-- and project workflow. Built on the existing pattern: a database trigger
-- records a `notifications` row (idempotent on `event_key`) and dispatches the
-- send-email-notification Edge Function through pg_net.
--
-- Nothing existing is removed or reset. The three pre-existing notification
-- triggers are re-pointed at the shared helpers below so there is exactly one
-- dispatch code path, and their event_key format and payload shape are
-- preserved byte-for-byte.
--
-- Audience routing, templates and recipient resolution all live in the Edge
-- Function; this migration only decides *that* an event happened.
-- ============================================================================

-- ---------------------------------------------------------------- shared core

-- Single place that talks to pg_net. Previously duplicated inline in every
-- trigger function.
create or replace function public.dispatch_email_notification(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_webhook_secret text;
begin
  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'email_notification_webhook_secret'
  limit 1;

  if v_webhook_secret is null then
    raise log 'Email notification dispatch skipped: webhook secret is not configured';
    return;
  end if;

  perform net.http_post(
    url := 'https://gbxfpnqdqbeohkfsqnyk.supabase.co/functions/v1/send-email-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-email-notification-secret', v_webhook_secret
    ),
    body := p_payload,
    timeout_milliseconds := 120000
  );
end;
$function$;

-- Records the in-app notification for one or more client-side recipients and
-- dispatches at most one email. Returns true when a new event was recorded.
create or replace function public.queue_client_email_notification(
  p_client_ids uuid[],
  p_type text,
  p_title text,
  p_message text,
  p_project_id uuid,
  p_event_key text,
  p_extra jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_client_id uuid;
  v_notification_id uuid;
  v_queued boolean := false;
  v_first_id uuid;
begin
  foreach v_client_id in array coalesce(p_client_ids, array[]::uuid[]) loop
    continue when v_client_id is null;

    v_notification_id := null;
    insert into public.notifications (user_id, type, title, message, project_id, event_key)
    values (
      v_client_id,
      p_type,
      p_title,
      p_message,
      p_project_id,
      p_event_key || ':' || v_client_id::text
    )
    on conflict (event_key) do nothing
    returning id into v_notification_id;

    if v_notification_id is not null then
      v_queued := true;
      v_first_id := coalesce(v_first_id, v_notification_id);
    end if;
  end loop;

  if v_queued then
    perform public.dispatch_email_notification(
      jsonb_build_object(
        'type', p_type,
        'notification_id', v_first_id,
        'audience', 'client',
        'project_id', p_project_id
      ) || coalesce(p_extra, '{}'::jsonb)
    );
  end if;

  return v_queued;
end;
$function$;

-- Same, but the in-app notification lands with every active admin and the email
-- is addressed to the admin audience.
create or replace function public.queue_admin_email_notification(
  p_type text,
  p_title text,
  p_message text,
  p_project_id uuid,
  p_event_key text,
  p_extra jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_admin_id uuid;
  v_notification_id uuid;
  v_queued boolean := false;
  v_first_id uuid;
begin
  for v_admin_id in
    select p.id from public.profiles p
    where p.role = 'admin' and p.status = 'active'
    order by p.created_at
  loop
    v_notification_id := null;
    insert into public.notifications (user_id, type, title, message, project_id, event_key)
    values (
      v_admin_id,
      p_type,
      p_title,
      p_message,
      p_project_id,
      p_event_key || ':' || v_admin_id::text
    )
    on conflict (event_key) do nothing
    returning id into v_notification_id;

    if v_notification_id is not null then
      v_queued := true;
      v_first_id := coalesce(v_first_id, v_notification_id);
    end if;
  end loop;

  if v_queued then
    perform public.dispatch_email_notification(
      jsonb_build_object(
        'type', p_type,
        'notification_id', v_first_id,
        'audience', 'admin',
        'project_id', p_project_id
      ) || coalesce(p_extra, '{}'::jsonb)
    );
  end if;

  return v_queued;
end;
$function$;

-- Client AND admin. In-app rows go to the client plus every active admin; one
-- email is dispatched and the Edge Function merges both recipient sets.
create or replace function public.queue_both_email_notification(
  p_client_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_project_id uuid,
  p_event_key text,
  p_extra jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_admin_id uuid;
  v_notification_id uuid;
  v_queued boolean := false;
  v_first_id uuid;
begin
  if p_client_id is not null then
    insert into public.notifications (user_id, type, title, message, project_id, event_key)
    values (
      p_client_id, p_type, p_title, p_message, p_project_id,
      p_event_key || ':' || p_client_id::text
    )
    on conflict (event_key) do nothing
    returning id into v_notification_id;

    if v_notification_id is not null then
      v_queued := true;
      v_first_id := v_notification_id;
    end if;
  end if;

  for v_admin_id in
    select p.id from public.profiles p
    where p.role = 'admin' and p.status = 'active'
    order by p.created_at
  loop
    v_notification_id := null;
    insert into public.notifications (user_id, type, title, message, project_id, event_key)
    values (
      v_admin_id, p_type, p_title, p_message, p_project_id,
      p_event_key || ':' || v_admin_id::text
    )
    on conflict (event_key) do nothing
    returning id into v_notification_id;

    if v_notification_id is not null then
      v_queued := true;
      v_first_id := coalesce(v_first_id, v_notification_id);
    end if;
  end loop;

  if v_queued then
    perform public.dispatch_email_notification(
      jsonb_build_object(
        'type', p_type,
        'notification_id', v_first_id,
        'audience', 'both',
        'project_id', p_project_id
      ) || coalesce(p_extra, '{}'::jsonb)
    );
  end if;

  return v_queued;
end;
$function$;

-- --------------------------------------------------------- re-point existing

-- Identical event_key and payload to the previous inline implementation.
create or replace function public.create_project_status_change_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_notification_id uuid;
  v_event_key text;
begin
  if new.status is distinct from old.status and new.client_id is not null then
    v_event_key := 'project_status:' || new.id::text
      || ':' || old.status::text || '->' || new.status::text
      || '@' || pg_current_xact_id()::text;

    insert into public.notifications (user_id, type, title, message, project_id, event_key)
    values (
      new.client_id,
      'project_status_changed',
      'Project status updated',
      'Your project ' || new.project_number || ' changed from ' || old.status::text
        || ' to ' || new.status::text || '.',
      new.id,
      v_event_key
    )
    on conflict (event_key) do nothing
    returning id into v_notification_id;

    if v_notification_id is not null then
      perform public.dispatch_email_notification(
        jsonb_build_object(
          'type', 'project_status_changed',
          'audience', 'client',
          'project_id', new.id,
          'previous_status', old.status::text,
          'new_status', new.status::text,
          'notification_id', v_notification_id
        )
      );
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.create_project_request_status_change_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_notification_id uuid;
  v_event_key text;
  v_project_id uuid;
begin
  if new.status is distinct from old.status then
    -- notifications.user_id is NOT NULL and references profiles, so a request
    -- with no linked client profile cannot produce a notification.
    if new.client_id is null then
      raise log 'Project request % status email skipped: request has no linked client profile',
        new.request_number;
      return new;
    end if;

    select p.id into v_project_id
    from public.projects p
    where p.request_id = new.id
    limit 1;

    v_event_key := 'project_request_status:' || new.id::text
      || ':' || old.status::text || '->' || new.status::text
      || '@' || pg_current_xact_id()::text;

    insert into public.notifications (user_id, type, title, message, project_id, event_key)
    values (
      new.client_id,
      'project_request_status_changed',
      'Project request status updated',
      'Your project request ' || new.request_number || ' changed from ' || old.status::text
        || ' to ' || new.status::text || '.',
      v_project_id,
      v_event_key
    )
    on conflict (event_key) do nothing
    returning id into v_notification_id;

    if v_notification_id is not null then
      perform public.dispatch_email_notification(
        jsonb_build_object(
          'type', 'project_request_status_changed',
          'audience', 'client',
          'request_id', new.id,
          'project_id', v_project_id,
          'previous_status', old.status::text,
          'new_status', new.status::text,
          'notification_id', v_notification_id
        )
      );
    end if;
  end if;
  return new;
end;
$function$;

-- Project confirmation: keeps the existing in-app behaviour, now with a stable
-- event_key so the guard is enforced by the unique index, and now actually
-- dispatches the email (the previous version never called pg_net).
create or replace function public.create_project_confirmation_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
begin
  if new.client_id is not null then
    perform public.queue_client_email_notification(
      array[new.client_id],
      'project_confirmed',
      'Project confirmed',
      'Your project ' || new.project_number || ' has been created and confirmed.',
      new.id,
      'project_confirmed:' || new.id::text,
      jsonb_build_object('request_id', new.request_id)
    );
  end if;
  return new;
end;
$function$;

-- ------------------------------------------------------------- new events

-- 1. A client submits a request -> the studio should know immediately.
create or replace function public.notify_project_request_received()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
begin
  if new.status = 'draft' then
    return new;
  end if;

  perform public.queue_admin_email_notification(
    'project_request_received',
    'New project request',
    'New project request ' || new.request_number || ' from '
      || coalesce(nullif(new.full_name, ''), 'a client') || '.',
    null,
    'project_request_received:' || new.id::text,
    jsonb_build_object('request_id', new.id)
  );
  return new;
end;
$function$;

-- 2. Quote lifecycle. Audience depends on who acted: the client is told when a
--    quote is issued, the studio is told when the client answers it.
create or replace function public.notify_quote_events()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_client_id uuid;
  v_project_number text;
  v_request_number text;
  v_label text;
  v_extra jsonb;
begin
  if new.project_id is not null then
    select p.client_id, p.project_number into v_client_id, v_project_number
    from public.projects p where p.id = new.project_id;
  end if;

  if v_client_id is null and new.project_request_id is not null then
    select r.client_id, r.request_number into v_client_id, v_request_number
    from public.project_requests r where r.id = new.project_request_id;
  end if;

  if v_client_id is null then
    return new;
  end if;

  v_label := coalesce(v_project_number, v_request_number, 'your project');
  v_extra := jsonb_build_object(
    'quote_id', new.id,
    'request_id', new.project_request_id,
    'amount', new.total,
    'currency', new.currency,
    'version', new.version,
    'valid_until', new.valid_until
  );

  if new.status is distinct from old.status then
    if new.status = 'sent' then
      perform public.queue_client_email_notification(
        array[v_client_id],
        'quote_sent',
        'Your quote is ready',
        'A quote for ' || v_label || ' is ready for your review.',
        new.project_id,
        'quote_sent:' || new.id::text || ':' || new.version::text,
        v_extra
      );
    elsif new.status = 'accepted' then
      perform public.queue_admin_email_notification(
        'quote_accepted',
        'Quote accepted',
        'The client accepted the quote for ' || v_label || '.',
        new.project_id,
        'quote_accepted:' || new.id::text || ':' || new.version::text,
        v_extra
      );
    elsif new.status = 'rejected' then
      perform public.queue_admin_email_notification(
        'quote_rejected',
        'Quote rejected',
        'The client rejected the quote for ' || v_label || '.',
        new.project_id,
        'quote_rejected:' || new.id::text || ':' || new.version::text,
        v_extra
      );
    end if;
  end if;

  if new.client_change_requested_at is distinct from old.client_change_requested_at
     and new.client_change_requested_at is not null then
    perform public.queue_admin_email_notification(
      'quote_change_requested',
      'Quote change requested',
      'The client requested changes to the quote for ' || v_label || '.',
      new.project_id,
      'quote_change_requested:' || new.id::text || ':' || new.client_change_requested_at::text,
      v_extra
    );
  end if;

  return new;
end;
$function$;

-- 3. Invoice issued -> client.
create or replace function public.notify_invoice_events()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
begin
  if new.client_id is null then
    return new;
  end if;

  if new.status is distinct from old.status and new.status = 'issued' then
    perform public.queue_client_email_notification(
      array[new.client_id],
      'invoice_issued',
      'Invoice issued',
      'Invoice ' || new.invoice_number || ' has been issued.',
      new.project_id,
      'invoice_issued:' || new.id::text,
      jsonb_build_object(
        'invoice_id', new.id,
        'amount_due', new.amount_due,
        'currency', new.currency,
        'due_date', new.due_date
      )
    );
  end if;

  return new;
end;
$function$;

-- 4. Payment outcomes. Inserts are covered too because a manually recorded
--    payment is created already in a terminal state.
create or replace function public.notify_payment_events()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_extra jsonb;
begin
  if new.client_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return new;
    end if;
  else
    if new.status not in ('succeeded', 'failed') then
      return new;
    end if;
  end if;

  v_extra := jsonb_build_object(
    'payment_id', new.id,
    'invoice_id', new.invoice_id,
    'amount', new.amount,
    'currency', new.currency,
    'payment_type', new.payment_type::text,
    'payment_method', new.payment_method,
    'transaction_reference', new.transaction_reference,
    'failure_reason', new.failure_reason
  );

  if new.status = 'succeeded' then
    perform public.queue_both_email_notification(
      new.client_id,
      'payment_received',
      'Payment received',
      'We received your payment of ' || new.amount::text || ' ' || new.currency || '.',
      new.project_id,
      'payment_received:' || new.id::text,
      v_extra
    );
  elsif new.status = 'failed' then
    perform public.queue_both_email_notification(
      new.client_id,
      'payment_failed',
      'Payment failed',
      'A payment of ' || new.amount::text || ' ' || new.currency || ' did not go through.',
      new.project_id,
      'payment_failed:' || new.id::text,
      v_extra
    );
  elsif new.status in ('refunded', 'partially_refunded') then
    perform public.queue_client_email_notification(
      array[new.client_id],
      'payment_refunded',
      'Payment refunded',
      'A refund of ' || new.amount::text || ' ' || new.currency || ' was issued.',
      new.project_id,
      'payment_refunded:' || new.id::text || ':' || new.status::text,
      v_extra
    );
  end if;

  return new;
end;
$function$;

-- 5. Milestone completed -> client.
create or replace function public.notify_milestone_events()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_client_id uuid;
begin
  if new.status is not distinct from old.status or new.status <> 'completed' then
    return new;
  end if;

  select p.client_id into v_client_id from public.projects p where p.id = new.project_id;
  if v_client_id is null then
    return new;
  end if;

  perform public.queue_client_email_notification(
    array[v_client_id],
    'milestone_completed',
    'Milestone completed',
    'The milestone "' || new.title || '" is complete.',
    new.project_id,
    'milestone_completed:' || new.id::text,
    jsonb_build_object('milestone_id', new.id, 'milestone_title', new.title)
  );
  return new;
end;
$function$;

-- 6. A deliverable is uploaded -> client.
create or replace function public.notify_deliverable_uploaded()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_client_id uuid;
begin
  if new.deleted_at is not null
     or new.project_id is null
     or new.category::text <> 'deliverable' then
    return new;
  end if;

  select p.client_id into v_client_id from public.projects p where p.id = new.project_id;
  if v_client_id is null then
    return new;
  end if;

  perform public.queue_client_email_notification(
    array[v_client_id],
    'deliverable_uploaded',
    'New deliverable available',
    'A new deliverable is available: ' || coalesce(new.original_name, 'file') || '.',
    new.project_id,
    'deliverable_uploaded:' || new.id::text,
    jsonb_build_object('file_id', new.id, 'file_name', new.original_name)
  );
  return new;
end;
$function$;

-- 7. Thread messages. The client is notified when the studio writes, and the
--    studio is notified when the client writes — never the sender.
create or replace function public.notify_project_message()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_client_id uuid;
  v_project_id uuid;
  v_request_id uuid;
  v_type text;
begin
  v_project_id := new.project_id;
  v_request_id := new.request_id;

  if v_request_id is not null then
    select r.client_id into v_client_id from public.project_requests r where r.id = v_request_id;
  elsif v_project_id is not null then
    select p.client_id into v_client_id from public.projects p where p.id = v_project_id;
  end if;

  if v_client_id is null then
    return new;
  end if;

  v_type := case when v_request_id is not null
    then 'request_message_received'
    else 'project_message_received'
  end;

  if new.sender_id = v_client_id then
    perform public.queue_admin_email_notification(
      v_type,
      'New client message',
      'A new message was posted on ' || v_type || ' thread.',
      v_project_id,
      'message_admin:' || new.id::text,
      jsonb_build_object('message_id', new.id, 'request_id', v_request_id)
    );
  else
    perform public.queue_client_email_notification(
      array[v_client_id],
      v_type,
      'New message',
      'You have a new message from the studio.',
      v_project_id,
      'message_client:' || new.id::text,
      jsonb_build_object('message_id', new.id, 'request_id', v_request_id)
    );
  end if;

  return new;
end;
$function$;

-- ------------------------------------------------------------- trigger wiring

drop trigger if exists trg_project_request_received on public.project_requests;
create trigger trg_project_request_received
  after insert on public.project_requests
  for each row execute function public.notify_project_request_received();

drop trigger if exists trg_quote_events on public.quotes;
create trigger trg_quote_events
  after update on public.quotes
  for each row execute function public.notify_quote_events();

drop trigger if exists trg_invoice_events on public.invoices;
create trigger trg_invoice_events
  after update on public.invoices
  for each row execute function public.notify_invoice_events();

drop trigger if exists trg_payment_events on public.payments;
create trigger trg_payment_events
  after insert or update on public.payments
  for each row execute function public.notify_payment_events();

drop trigger if exists trg_milestone_events on public.project_milestones;
create trigger trg_milestone_events
  after update on public.project_milestones
  for each row execute function public.notify_milestone_events();

drop trigger if exists trg_deliverable_uploaded on public.project_files;
create trigger trg_deliverable_uploaded
  after insert on public.project_files
  for each row execute function public.notify_deliverable_uploaded();

drop trigger if exists trg_project_message_notify on public.project_messages;
create trigger trg_project_message_notify
  after insert on public.project_messages
  for each row execute function public.notify_project_message();

comment on function public.queue_client_email_notification(uuid[], text, text, text, uuid, text, jsonb) is
  'Records in-app notifications for client-side recipients and dispatches one email.';
comment on function public.dispatch_email_notification(jsonb) is
  'Single pg_net dispatch path for the send-email-notification Edge Function.';
