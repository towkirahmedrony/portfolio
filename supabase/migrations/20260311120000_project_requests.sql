create type public.request_status as enum (
  'new',
  'reviewing',
  'quoted',
  'approved',
  'rejected',
  'converted',
  'cancelled'
);

create table public.project_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  client_id uuid references public.profiles (id),
  full_name text not null,
  email text not null,
  phone text,
  company_name text,
  project_type text,
  website_status text,
  page_count integer,
  description text,
  required_features text[],
  has_design boolean,
  figma_url text,
  reference_urls text[],
  design_style text,
  has_logo boolean,
  has_brand_colors boolean,
  brand_colors text,
  budget_min numeric,
  budget_max numeric,
  budget_currency text not null default 'BDT',
  deadline_type text,
  deadline_date date,
  referral_code_entered text,
  referral_code_id uuid references public.referral_codes (id),
  source text,
  status public.request_status not null default 'new',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.generate_request_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  loop
    attempts := attempts + 1;
    candidate := 'PR-'
      || to_char(timezone('utc', now()), 'YYYYMMDD')
      || '-'
      || upper(substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text), 1, 8));

    exit when not exists (
      select 1 from public.project_requests where request_number = candidate
    );

    if attempts >= 20 then
      raise exception 'Could not generate a unique request number';
    end if;
  end loop;

  return candidate;
end;
$$;

create or replace function public.prepare_project_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.client_id := auth.uid();
  new.status := 'new';
  new.submitted_at := now();
  new.updated_at := now();
  new.referral_code_id := null;

  if new.request_number is null or btrim(new.request_number) = '' then
    new.request_number := public.generate_request_number();
  end if;

  return new;
end;
$$;

create trigger prepare_project_request
before insert on public.project_requests
for each row
execute function public.prepare_project_request();

create or replace function public.set_project_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_project_requests_updated_at
before update on public.project_requests
for each row
execute function public.set_project_requests_updated_at();

alter table public.project_requests enable row level security;

create policy "Anyone can submit project requests"
on public.project_requests
for insert
to anon, authenticated
with check (
  client_id is null
  or client_id = auth.uid()
);

create policy "Customers can view their own project requests"
on public.project_requests
for select
to authenticated
using (auth.uid() = client_id);

revoke all on public.project_requests from public, anon, authenticated;

grant insert (
  request_number,
  full_name,
  email,
  phone,
  company_name,
  project_type,
  website_status,
  page_count,
  description,
  required_features,
  has_design,
  figma_url,
  reference_urls,
  design_style,
  has_logo,
  has_brand_colors,
  brand_colors,
  budget_min,
  budget_max,
  budget_currency,
  deadline_type,
  deadline_date,
  referral_code_entered,
  source
) on public.project_requests to anon, authenticated;

grant select on public.project_requests to authenticated;

revoke all on function public.generate_request_number() from public, anon, authenticated;
revoke all on function public.prepare_project_request() from public, anon, authenticated;
revoke all on function public.set_project_requests_updated_at() from public, anon, authenticated;
