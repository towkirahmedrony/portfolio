-- Fix: create_referral_for_client used `on conflict (referred_client_id)` while
-- the matching index is PARTIAL (referrals_referred_client_uidx ... where
-- referred_client_id is not null). Postgres cannot infer a partial index unless
-- the predicate is repeated, so every referral creation at signup raised
-- 42P10 "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Found by running the referral lifecycle against the live
-- database; the function body is otherwise unchanged.

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
    return null;
  end if;
  if v_code_row.is_active is not true then
    return null;
  end if;
  if v_code_row.expires_at is not null and v_code_row.expires_at <= now() then
    return null;
  end if;
  if v_code_row.owner_id = p_client_id then
    return null;
  end if;

  select * into v_settings
  from public.referral_settings s
  order by s.created_at asc
  limit 1;
  v_has_settings := found;

  if not v_has_settings or v_settings.is_active is not true then
    return null;
  end if;

  select * into v_referrer
  from public.profiles p
  where p.id = v_code_row.owner_id
  limit 1;

  if not found or v_referrer.status <> 'active' then
    return null;
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
  on conflict (referred_client_id) where referred_client_id is not null do nothing
  returning id into v_referral_id;

  if v_referral_id is null then
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
