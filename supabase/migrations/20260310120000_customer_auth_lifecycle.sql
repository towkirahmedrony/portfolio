create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.bypass_profile_protect', true) = 'on' then
    return new;
  end if;

  new.id = old.id;
  new.role = old.role;
  new.status = old.status;
  new.email_verified = old.email_verified;
  new.created_at = old.created_at;
  new.last_seen_at = old.last_seen_at;
  return new;
end;
$$;

create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_count integer not null default 0
);

create unique index referral_codes_one_active_per_owner
  on public.referral_codes (owner_id)
  where is_active = true;

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  loop
    attempts := attempts + 1;
    candidate := upper(substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text), 1, 10));

    exit when not exists (
      select 1 from public.referral_codes where code = candidate
    );

    if attempts >= 20 then
      raise exception 'Could not generate a unique referral code';
    end if;
  end loop;

  return candidate;
end;
$$;

create or replace function public.ensure_referral_code(profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  attempts integer := 0;
begin
  if exists (
    select 1
    from public.referral_codes
    where owner_id = profile_id
  ) then
    return;
  end if;

  loop
    begin
      insert into public.referral_codes (owner_id, code)
      values (profile_id, public.generate_referral_code());
      return;
    exception
      when unique_violation then
        if exists (
          select 1
          from public.referral_codes
          where owner_id = profile_id
        ) then
          return;
        end if;

        attempts := attempts + 1;
        if attempts >= 8 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

create or replace function public.profile_full_name_from_auth(
  user_email text,
  user_meta jsonb
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(user_meta ->> 'full_name'), ''),
    nullif(trim(user_meta ->> 'name'), ''),
    nullif(split_part(coalesce(user_email, ''), '@', 1), ''),
    'Customer'
  );
$$;

create or replace function public.profile_display_name_from_auth(
  user_email text,
  user_meta jsonb
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(user_meta ->> 'display_name'), ''),
    nullif(trim(user_meta ->> 'name'), ''),
    nullif(split_part(coalesce(user_email, ''), '@', 1), '')
  );
$$;

create or replace function public.profile_avatar_url_from_auth(user_meta jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(user_meta ->> 'avatar_url'), ''),
    nullif(trim(user_meta ->> 'picture'), '')
  );
$$;

create or replace function public.auth_user_email_verified(
  user_id uuid,
  confirmed_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(confirmed_at is not null, false)
    or exists (
      select 1
      from auth.identities i
      where i.user_id = auth_user_email_verified.user_id
        and i.provider = 'google'
        and lower(coalesce(i.identity_data ->> 'email_verified', 'false')) in ('true', 't', '1')
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    display_name,
    avatar_url,
    email_verified
  )
  values (
    new.id,
    public.profile_full_name_from_auth(new.email, new.raw_user_meta_data),
    public.profile_display_name_from_auth(new.email, new.raw_user_meta_data),
    public.profile_avatar_url_from_auth(new.raw_user_meta_data),
    public.auth_user_email_verified(new.id, new.email_confirmed_at)
  )
  on conflict (id) do nothing;

  perform public.ensure_referral_code(new.id);
  return new;
end;
$$;

create or replace function public.sync_profile_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_profile_protect', 'on', true);

  update public.profiles
  set email_verified = public.auth_user_email_verified(new.id, new.email_confirmed_at)
  where id = new.id
    and email_verified is distinct from public.auth_user_email_verified(new.id, new.email_confirmed_at);

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;

create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is distinct from new.email_confirmed_at)
execute function public.sync_profile_email_verified();

create or replace function public.sync_profile_email_verified_from_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  confirmed_at timestamptz;
begin
  if new.provider is distinct from 'google' then
    return new;
  end if;

  select u.email_confirmed_at
  into confirmed_at
  from auth.users u
  where u.id = new.user_id;

  perform set_config('app.bypass_profile_protect', 'on', true);

  update public.profiles
  set email_verified = public.auth_user_email_verified(new.user_id, confirmed_at)
  where id = new.user_id
    and email_verified is distinct from public.auth_user_email_verified(new.user_id, confirmed_at);

  return new;
end;
$$;

drop trigger if exists on_auth_google_identity_verified on auth.identities;

create trigger on_auth_google_identity_verified
after insert or update on auth.identities
for each row
when (new.provider = 'google')
execute function public.sync_profile_email_verified_from_identity();

create or replace function public.sync_customer_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  user_meta jsonb;
  confirmed_at timestamptz;
  verified boolean;
begin
  if uid is null then
    return;
  end if;

  select u.email, u.raw_user_meta_data, u.email_confirmed_at
  into user_email, user_meta, confirmed_at
  from auth.users u
  where u.id = uid;

  if not found then
    return;
  end if;

  verified := public.auth_user_email_verified(uid, confirmed_at);

  insert into public.profiles (
    id,
    full_name,
    display_name,
    avatar_url,
    email_verified
  )
  values (
    uid,
    public.profile_full_name_from_auth(user_email, user_meta),
    public.profile_display_name_from_auth(user_email, user_meta),
    public.profile_avatar_url_from_auth(user_meta),
    verified
  )
  on conflict (id) do nothing;

  perform set_config('app.bypass_profile_protect', 'on', true);

  update public.profiles
  set email_verified = verified
  where id = uid
    and email_verified is distinct from verified;

  perform public.ensure_referral_code(uid);

  update public.profiles
  set last_seen_at = now()
  where id = uid
    and (
      last_seen_at is null
      or last_seen_at < now() - interval '15 minutes'
    );
end;
$$;

do $$
declare
  rec record;
begin
  for rec in
    select p.id
    from public.profiles p
    where not exists (
      select 1
      from public.referral_codes rc
      where rc.owner_id = p.id
    )
  loop
    perform public.ensure_referral_code(rec.id);
  end loop;
end;
$$;

alter table public.referral_codes enable row level security;

create policy "Customers can view their own referral codes"
on public.referral_codes
for select
to authenticated
using (auth.uid() = owner_id);

revoke all on public.referral_codes from public, anon, authenticated;
grant select on public.referral_codes to authenticated;

revoke all on function public.generate_referral_code() from public, anon, authenticated;
revoke all on function public.ensure_referral_code(uuid) from public, anon, authenticated;
revoke all on function public.profile_full_name_from_auth(text, jsonb) from public, anon, authenticated;
revoke all on function public.profile_display_name_from_auth(text, jsonb) from public, anon, authenticated;
revoke all on function public.profile_avatar_url_from_auth(jsonb) from public, anon, authenticated;
revoke all on function public.sync_profile_email_verified() from public, anon, authenticated;
revoke all on function public.sync_profile_email_verified_from_identity() from public, anon, authenticated;
revoke all on function public.auth_user_email_verified(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.sync_customer_session() from public, anon;
grant execute on function public.sync_customer_session() to authenticated;
