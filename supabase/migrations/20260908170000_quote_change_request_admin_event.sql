-- Request Changes must create a durable admin-visible event (fix for prod).
--
-- Confirmed production state: client_respond_to_quote() predates
-- 20260908150000 / 20260908160000. Its request_changes branch only wrote a
-- project_messages row when v_quote.project_id IS NOT NULL, so a change
-- request on a request-linked quote with no project yet (project_id = NULL,
-- project_request_id set) returned successfully without creating any record
-- the Admin Panel can surface. The quotes table also lacked the
-- client_change_requested_at / client_change_message markers.
--
-- This migration is self-contained and safe to run whether or not
-- 20260908150000 / 20260908160000 were applied:
--   * Adds the two nullable quotes columns (IF NOT EXISTS) - the same additive
--     schema change, kept so pre-08160000 databases converge.
--   * Replaces client_respond_to_quote() (supersedes 20260907310000 /
--     20260908150000 / 20260908160000) so request_changes:
--       - records the client's message + timestamp on the quote row itself;
--       - writes a project message when a project exists - resolved through
--         the project request (PR -> PJ) when the quote has no project yet
--         but an earlier accepted version converted the request;
--       - always inserts an audit_logs event
--         (action = 'quote.client_change_requested', entity = quote,
--          new_data = {version, request_id, project_id, message}) so the
--         Admin Dashboard shows "Quote Change Requested" even with no
--         project, keyed by quote + project request (PR-...).
--   * Accept remains the ONLY path that creates a project; request-changes
--     never creates one. Reject/accept behavior is unchanged.
--
-- * No new table and no parallel notification system: audit_logs is the
--   existing admin activity stream (admin-only SELECT RLS, 20260904190000)
--   that the Admin Dashboard quote-responses section already reads, and
--   project_messages is the existing project-scoped messaging UI. The
--   documented `notifications` table is not created by any migration and is
--   not referenced by any app code, so it is intentionally not used here.
-- * RLS is untouched: audit_logs stays admin-SELECT-only, project_messages
--   rows are written by this SECURITY DEFINER function only after the caller
--   is verified as the owning client (auth.uid() = request.client_id or
--   project.client_id). No broad public policy is added.

alter table public.quotes
  add column if not exists client_change_requested_at timestamptz,
  add column if not exists client_change_message text;

create index if not exists quotes_client_change_requested_at_idx
  on public.quotes (client_change_requested_at desc)
  where client_change_requested_at is not null;

-- ---------------------------------------------------------------------------
-- client_respond_to_quote (supersedes 20260907310000 / 20260908150000)
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
  v_target_project_id uuid;
  v_title text;
  v_first_accept boolean := false;
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

  -- Resolve an existing project (created by an earlier accepted quote
  -- version) so reject / request-changes messages and audit rows still reach
  -- the project the request already converted to.
  v_target_project_id := v_quote.project_id;
  if v_target_project_id is null and v_has_request then
    select id
    into v_target_project_id
    from public.projects
    where request_id = v_request.id
    limit 1;
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

    -- Row-level marker so the quote itself shows the change request on the
    -- admin quote list / detail / version history (same visibility contract
    -- as accepted_at / rejected_at).
    update public.quotes
    set
      client_change_requested_at = v_now,
      client_change_message = v_message,
      updated_at = v_now
    where id = v_quote.id;

    v_note := 'Client requested changes on quote v'
      || v_quote.version::text
      || ': '
      || v_message;

    if v_target_project_id is not null and to_regclass('public.project_messages') is not null then
      insert into public.project_messages (
        project_id,
        sender_id,
        message,
        is_read
      )
      values (
        v_target_project_id,
        v_uid,
        v_note,
        false
      );
    end if;

    -- Record the change request even when no project exists yet, so the admin
    -- dashboard can surface it against the project request (PR-...).
    if to_regclass('public.audit_logs') is not null then
      insert into public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data,
        created_at
      )
      values (
        v_uid,
        'quote.client_change_requested',
        'quote',
        v_quote.id,
        jsonb_build_object(
          'version', v_quote.version,
          'request_id', v_quote.project_request_id,
          'project_id', v_target_project_id,
          'message', v_message
        ),
        v_now
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

    if v_target_project_id is not null and to_regclass('public.project_messages') is not null then
      insert into public.project_messages (
        project_id,
        sender_id,
        message,
        is_read
      )
      values (
        v_target_project_id,
        v_uid,
        v_note,
        false
      );
    end if;

    if to_regclass('public.audit_logs') is not null then
      insert into public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        new_data,
        created_at
      )
      values (
        v_uid,
        'quote.client_rejected',
        'quote',
        v_quote.id,
        jsonb_build_object(
          'version', v_quote.version,
          'request_id', v_quote.project_request_id,
          'project_id', v_target_project_id,
          'message', v_message
        ),
        v_now
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
      v_first_accept := true;
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

  -- Log the acceptance once, on the transition that actually accepts it.
  if v_first_accept and to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      new_data,
      created_at
    )
    values (
      v_uid,
      'quote.client_accepted',
      'quote',
      v_quote.id,
      jsonb_build_object(
        'version', v_quote.version,
        'request_id', v_quote.project_request_id,
        'project_id', v_project_id,
        'message', v_message
      ),
      v_now
    );
  end if;

  return 'accepted'::public.quote_status;
end;
$$;

revoke all on function public.client_respond_to_quote(uuid, text, text) from public, anon;
grant execute on function public.client_respond_to_quote(uuid, text, text) to authenticated;
