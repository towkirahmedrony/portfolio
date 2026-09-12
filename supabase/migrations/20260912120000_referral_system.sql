-- Referral system: signup capture -> project-request link -> first-project
-- qualification -> exactly one reward.
--
-- Additive only. No table is created, dropped, or reset; no existing referral
-- table/column is duplicated. Existing referral objects reused as-is:
--   public.referral_codes, public.referrals, public.referral_rewards,
--   public.referral_settings, public.ensure_referral_code(),
--   public.admin_update_referral_settings(), public.handle_new_user().
--
-- Existing behaviour preserved:
--   * public.prepare_project_request() still nulls a client-supplied
--     referral_code_id (so the code can never be chosen by the browser); the
--     server re-derives it afterwards in attach_referral_to_project_request().
--   * public.client_respond_to_quote() and public.admin_convert_project_request()
--     still set referrals.first_project_id; the new AFTER INSERT trigger on
--     public.projects now writes it first, so those updates stay no-ops.

-- ---------------------------------------------------------------------------
-- 1. Integrity constraints (verified against live data: 0 referrals rows,
--    0 referral_rewards rows, so no pre-existing conflicts).
-- ---------------------------------------------------------------------------

-- ONE referred customer -> at most ONE referral relationship.
create unique index if not exists referrals_referred_client_uidx
  on public.referrals (referred_client_id)
  where referred_client_id is not null;

-- ONE referral -> at most ONE reward.
create unique index if not exists referral_rewards_referral_uidx
  on public.referral_rewards (referral_id);

-- Self-referral is impossible at the storage layer, not just in a function.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.referrals'::regclass
      and conname = 'referrals_no_self_referral'
  ) then
    alter table public.referrals
      add constraint referrals_no_self_referral
      check (referred_client_id is null or referred_client_id <> referrer_id);
  end if;
end $$;

-- A project records at most one referral discount (guard for the trigger below).
create unique index if not exists project_discounts_referral_uidx
  on public.project_discounts (project_id, source_id)
  where source_type = 'referral';

-- ---------------------------------------------------------------------------
-- 2. Referral creation (server-side, validated, atomic, idempotent).
-- ---------------------------------------------------------------------------

-- Internal worker. Never granted to anon/authenticated: callers must use the
-- auth.uid()-scoped wrappers below, so a client can never name another user.
create or replace function public.create_referral_for_client(
  p_client_id uuid,
  p_code text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_code_row public.referral_codes%rowtype;
  v_settings public.referral_settings%rowtype;
  v_referrer public.profiles%rowtype;
  v_referral_id uuid;
  v_has_settings boolean := false;
begin
  if p_client_id is null or v_code = '' then
    return null;
  end if;

  -- Already referred (or already processed): return the existing relationship.
  select r.id into v_referral_id
  from public.referrals r
  where r.referred_client_id = p_client_id
  limit 1;

  if v_referral_id is not null then
    return v_referral_id;
  end if;

  select * into v_code_row
  from public.referral_codes c
  where c.code = v_code
  limit 1;

  if not found then
    return null;                        -- unknown code: ignored safely
  end if;
  if v_code_row.is_active is not true then
    return null;                        -- inactive code: ignored safely
  end if;
  if v_code_row.expires_at is not null and v_code_row.expires_at <= now() then
    return null;                        -- expired code: ignored safely
  end if;
  if v_code_row.owner_id = p_client_id then
    return null;                        -- self-referral: blocked
  end if;

  -- Percentages are snapshotted from the current settings row. With no settings
  -- row there is nothing configured to snapshot, so no referral is created
  -- (fail closed instead of hardcoding a percentage).
  select * into v_settings
  from public.referral_settings s
  order by s.created_at asc
  limit 1;
  v_has_settings := found;

  if not v_has_settings or v_settings.is_active is not true then
    return null;                        -- referral program inactive
  end if;

  select * into v_referrer
  from public.profiles p
  where p.id = v_code_row.owner_id
  limit 1;

  if not found or v_referrer.status <> 'active' then
    return null;                        -- deleted/suspended referrer
  end if;

  insert into public.referrals (
    referrer_id,
    referred_client_id,
    referral_code_id,
    status,
    client_discount_percent,
    referrer_reward_percent
  )
  values (
    v_code_row.owner_id,
    p_client_id,
    v_code_row.id,
    'pending',
    v_settings.new_client_discount_percent,
    v_settings.referrer_reward_percent
  )
  -- The matching unique index is partial, so the predicate must be repeated for
  -- inference to succeed.
  on conflict (referred_client_id) where referred_client_id is not null do nothing
  returning id into v_referral_id;

  if v_referral_id is null then
    -- Concurrent duplicate: another transaction won the race.
    select r.id into v_referral_id
    from public.referrals r
    where r.referred_client_id = p_client_id
    limit 1;
    return v_referral_id;
  end if;

  update public.referral_codes
  set used_count = used_count + 1
  where id = v_code_row.id;

  return v_referral_id;
end;
$function$;

-- Safe wrapper: always operates on the caller. Idempotent.
create or replace function public.claim_my_referral(p_code text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return public.create_referral_for_client(v_uid, p_code);
end;
$function$;

-- Safe wrapper: guarantee the caller owns an active code and return it.
create or replace function public.ensure_my_referral_code()
returns table (id uuid, code text, is_active boolean, expires_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_referral_code(v_uid);

  return query
    select c.id, c.code, c.is_active, c.expires_at
    from public.referral_codes c
    where c.owner_id = v_uid
    order by c.is_active desc, c.created_at asc
    limit 1;
end;
$function$;

-- Time-based reward expiry, applied to the database (not only the UI).
create or replace function public.expire_referral_rewards()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  update public.referral_rewards
  set status = 'expired',
      updated_at = now()
  where status = 'available'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$function$;

-- The generic worker takes an arbitrary profile id, so it must not be callable
-- by end users. auth.uid()-scoped wrappers above are the only client surface.
revoke all on function public.create_referral_for_client(uuid, text) from public;
revoke all on function public.create_referral_for_client(uuid, text) from anon;
revoke all on function public.create_referral_for_client(uuid, text) from authenticated;
revoke all on function public.ensure_referral_code(uuid) from public;
revoke all on function public.ensure_referral_code(uuid) from anon;
revoke all on function public.ensure_referral_code(uuid) from authenticated;

grant execute on function public.claim_my_referral(text) to authenticated;
grant execute on function public.ensure_my_referral_code() to authenticated;
grant execute on function public.expire_referral_rewards() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Signup -> referral creation.
--    Extends the existing auth trigger: metadata may carry the code captured
--    from /signup?ref=..., and it is validated server-side here. A referral
--    failure must never block profile creation (same pattern already used for
--    ensure_referral_code).
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  user_full_name text;
  user_display_name text;
  user_avatar_url text;
  referral_error text;
  referral_code text;
begin
  user_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Client'
  );

  user_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    user_full_name
  );

  user_avatar_url := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'picture'), '')
  );

  perform set_config('app.bypass_profile_protect', 'on', true);

  insert into public.profiles (
    id,
    full_name,
    display_name,
    avatar_url,
    email_verified,
    last_seen_at
  )
  values (
    new.id,
    user_full_name,
    user_display_name,
    user_avatar_url,
    (new.email_confirmed_at is not null),
    now()
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    email_verified = excluded.email_verified,
    last_seen_at = now();

  begin
    perform public.ensure_referral_code(new.id);
  exception when others then
    referral_error := sqlerrm;
    raise warning 'ensure_referral_code failed for user %: %', new.id, referral_error;
  end;

  -- Referral capture is best-effort secondary work: the code is validated
  -- inside create_referral_for_client (existence, active, expiry, self-referral,
  -- settings state). An invalid code simply produces no referral row.
  referral_code := new.raw_user_meta_data ->> 'referral_code';

  if referral_code is not null and btrim(referral_code) <> '' then
    begin
      perform public.create_referral_for_client(new.id, referral_code);
    exception when others then
      referral_error := sqlerrm;
      raise warning 'create_referral_for_client failed for user %: %', new.id, referral_error;
    end;
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Referral -> project request association (server-derived).
--    prepare_project_request() has already cleared any browser-supplied
--    referral_code_id; this re-derives it from the client's own referral row.
-- ---------------------------------------------------------------------------

create or replace function public.attach_referral_to_project_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_referral record;
begin
  if new.client_id is null then
    return new;
  end if;

  select r.id, r.referral_code_id
  into v_referral
  from public.referrals r
  where r.referred_client_id = new.client_id
    and r.project_request_id is null
    and r.first_project_id is null
    and r.status not in ('cancelled', 'invalid')
  order by r.created_at asc
  limit 1;

  if not found then
    return new;
  end if;

  update public.referrals
  set project_request_id = new.id
  where id = v_referral.id
    and project_request_id is null;

  if not found then
    -- Another request already claimed this referral (or a concurrent insert).
    return new;
  end if;

  update public.project_requests
  set referral_code_id = v_referral.referral_code_id
  where id = new.id
    and referral_code_id is null;

  return new;
end;
$function$;

drop trigger if exists attach_referral_to_project_request_trg on public.project_requests;
create trigger attach_referral_to_project_request_trg
after insert on public.project_requests
for each row execute function public.attach_referral_to_project_request();

-- ---------------------------------------------------------------------------
-- 5. First project -> referral discount (snapshot, first project only).
-- ---------------------------------------------------------------------------

create or replace function public.apply_referral_to_project()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_referral record;
  v_amount numeric;
  v_discount numeric;
begin
  if new.client_id is null then
    return new;
  end if;

  select r.id, r.client_discount_percent, r.referral_code_id
  into v_referral
  from public.referrals r
  where r.referred_client_id = new.client_id
    and r.first_project_id is null
    and r.status not in ('cancelled', 'invalid')
    and (r.project_request_id = new.request_id or r.project_request_id is null)
  order by r.created_at asc
  limit 1;

  if not found then
    return new;
  end if;

  -- Permanent first-project marker for this referral.
  update public.referrals
  set first_project_id = new.id
  where id = v_referral.id
    and first_project_id is null;

  if not found then
    return new;
  end if;

  -- Discount is recorded from the stored snapshot, never from client input,
  -- and only for this one (first) project.
  if v_referral.client_discount_percent is not null
     and v_referral.client_discount_percent > 0 then
    v_amount := coalesce(new.agreed_price, 0);
    v_discount := round(v_amount * v_referral.client_discount_percent / 100.0, 2);

    insert into public.project_discounts (
      project_id,
      source_type,
      source_id,
      code,
      label,
      percent,
      discount_amount,
      currency
    )
    select
      new.id,
      'referral'::public.discount_source_type,
      v_referral.id,
      c.code,
      'Referral discount',
      v_referral.client_discount_percent,
      v_discount,
      coalesce(new.currency, 'BDT')
    from public.referral_codes c
    where c.id = v_referral.referral_code_id
      and not exists (
        select 1
        from public.project_discounts d
        where d.project_id = new.id
          and d.source_type = 'referral'
      );
  end if;

  return new;
end;
$function$;

drop trigger if exists apply_referral_to_project_trg on public.projects;
create trigger apply_referral_to_project_trg
after insert on public.projects
for each row execute function public.apply_referral_to_project();

-- ---------------------------------------------------------------------------
-- 6. Qualification -> exactly one reward, and safe reversal on cancellation.
--    Qualification is driven by the existing project status flow: a project is
--    only "done" at status = 'completed' (project_status enum). No new status
--    is invented.
-- ---------------------------------------------------------------------------

create or replace function public.qualify_referral_on_project()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_referral public.referrals%rowtype;
  v_min numeric;
  v_validity integer;
  v_amount numeric;
  v_expires timestamptz;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select r.* into v_referral
    from public.referrals r
    where r.first_project_id = new.id
      and r.status not in ('cancelled', 'invalid')
    order by r.created_at asc
    limit 1
    for update;

    if not found then
      return new;
    end if;

    -- Exactly one reward per referral, forever (guards webhook/event retries).
    if exists (
      select 1 from public.referral_rewards w where w.referral_id = v_referral.id
    ) then
      return new;
    end if;

    if v_referral.referred_client_id is distinct from new.client_id then
      return new;
    end if;

    select s.minimum_project_amount, s.reward_validity_days
    into v_min, v_validity
    from public.referral_settings s
    order by s.created_at asc
    limit 1;

    -- Trusted amount: the project's own agreed price (set from the accepted
    -- quote), never a client-supplied number.
    v_amount := coalesce(new.agreed_price, 0);

    if v_min is not null and v_amount < v_min then
      -- First project completed below the configured minimum: the relationship
      -- is recorded as qualified, but no reward is earned.
      update public.referrals
      set status = 'qualified',
          qualified_at = coalesce(qualified_at, now())
      where id = v_referral.id
        and status = 'pending';
      return new;
    end if;

    update public.referrals
    set status = 'reward_available',
        qualified_at = coalesce(qualified_at, now())
    where id = v_referral.id;

    if v_validity is not null and v_validity > 0 then
      v_expires := now() + make_interval(days => v_validity);
    else
      v_expires := null;
    end if;

    insert into public.referral_rewards (
      referral_id,
      referrer_id,
      reward_type,
      reward_percent,
      status,
      available_from,
      expires_at
    )
    values (
      v_referral.id,
      v_referral.referrer_id,
      'referral_discount',
      coalesce(v_referral.referrer_reward_percent, 0),
      'available',
      now(),
      v_expires
    )
    on conflict (referral_id) do nothing;

    return new;
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    select r.* into v_referral
    from public.referrals r
    where r.first_project_id = new.id
    limit 1
    for update;

    if not found then
      return new;
    end if;

    -- An unredeemed reward must not stay redeemable after the project is gone.
    update public.referral_rewards
    set status = 'cancelled',
        cancelled_at = now(),
        updated_at = now()
    where referral_id = v_referral.id
      and status in ('pending', 'available');

    -- No reward was ever earned: release the first-project slot so the client's
    -- next project can still qualify this referral.
    if not exists (
      select 1 from public.referral_rewards w where w.referral_id = v_referral.id
    ) then
      update public.referrals
      set first_project_id = null,
          project_request_id = null,
          status = 'pending',
          qualified_at = null
      where id = v_referral.id
        and first_project_id = new.id;
    end if;

    return new;
  end if;

  return new;
end;
$function$;

drop trigger if exists qualify_referral_on_project_trg on public.projects;
create trigger qualify_referral_on_project_trg
after update of status on public.projects
for each row execute function public.qualify_referral_on_project();

-- ---------------------------------------------------------------------------
-- 7. RLS is intentionally unchanged: the existing policies already implement
--    the required model (owner/referrer SELECT on referral_codes, referrals and
--    referral_rewards; authenticated SELECT on referral_settings; admin ALL).
--    Customers have no INSERT/UPDATE/DELETE policy on any referral table, so
--    referrer_id, referred_client_id, percentages and reward status are all
--    server-owned. Privileged work happens only inside the SECURITY DEFINER
--    functions above, which are scoped to auth.uid().
-- ---------------------------------------------------------------------------
