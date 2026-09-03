create type public.profile_role as enum ('admin', 'client');
create type public.profile_status as enum ('active', 'suspended', 'deleted');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  display_name text,
  avatar_url text,
  phone text,
  company_name text,
  job_title text,
  role public.profile_role not null default 'client',
  status public.profile_status not null default 'active',
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
as $$
begin
  new.id = old.id;
  new.role = old.role;
  new.status = old.status;
  new.email_verified = old.email_verified;
  new.created_at = old.created_at;
  new.last_seen_at = old.last_seen_at;
  return new;
end;
$$;

create trigger protect_profile_system_fields
before update on public.profiles
for each row
execute function public.protect_profile_system_fields();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, display_name, email_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Customer'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.email_confirmed_at is not null, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "Customers can view their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Customers can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (
  full_name,
  display_name,
  avatar_url,
  phone,
  company_name,
  job_title
) on public.profiles to authenticated;
