-- Client edit / resubmit for own project_requests.
-- Clients may update content while status is draft/new/reviewing/quoted/rejected.
-- After a successful edit the request returns to 'new' for review.
-- approved / converted / cancelled remain locked. Request identity is preserved.

alter table public.project_requests
  add column if not exists last_activity_at timestamptz;

create or replace function public.update_own_project_request(
  p_request_id uuid,
  p_payload jsonb
)
returns public.request_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request record;
  v_full_name text;
  v_email text;
  v_features text[];
  v_urls text[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid request payload.';
  end if;

  if to_regclass('public.project_requests') is null then
    raise exception 'project_requests is not available';
  end if;

  select *
  into v_request
  from public.project_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if v_request.client_id is null or v_request.client_id <> v_uid then
    raise exception 'Not authorized';
  end if;

  if v_request.status::text not in ('draft', 'new', 'reviewing', 'quoted', 'rejected') then
    raise exception 'This request can no longer be edited.';
  end if;

  v_full_name := nullif(btrim(coalesce(p_payload->>'full_name', '')), '');
  v_email := nullif(btrim(coalesce(p_payload->>'email', '')), '');

  if v_full_name is null then
    raise exception 'Please enter your full name.';
  end if;

  if v_email is null then
    raise exception 'Please enter your email address.';
  end if;

  if p_payload ? 'required_features' and jsonb_typeof(p_payload->'required_features') = 'array' then
    select array_agg(value)
    into v_features
    from (
      select nullif(btrim(jsonb_array_elements_text(p_payload->'required_features')), '') as value
    ) as items
    where value is not null;

    if v_features is not null and array_length(v_features, 1) is null then
      v_features := null;
    end if;
  else
    v_features := v_request.required_features;
  end if;

  if p_payload ? 'reference_urls' and jsonb_typeof(p_payload->'reference_urls') = 'array' then
    select array_agg(value)
    into v_urls
    from (
      select nullif(btrim(jsonb_array_elements_text(p_payload->'reference_urls')), '') as value
    ) as items
    where value is not null;

    if v_urls is not null and array_length(v_urls, 1) is null then
      v_urls := null;
    end if;
  else
    v_urls := v_request.reference_urls;
  end if;

  update public.project_requests
  set
    full_name = v_full_name,
    email = v_email,
    phone = nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
    company_name = nullif(btrim(coalesce(p_payload->>'company_name', '')), ''),
    project_type = nullif(btrim(coalesce(p_payload->>'project_type', '')), ''),
    website_status = nullif(btrim(coalesce(p_payload->>'website_status', '')), ''),
    page_count = case
      when p_payload ? 'page_count' then nullif(p_payload->>'page_count', '')::integer
      else page_count
    end,
    description = nullif(btrim(coalesce(p_payload->>'description', '')), ''),
    required_features = v_features,
    has_design = case
      when p_payload ? 'has_design' then
        case p_payload->>'has_design'
          when 'true' then true
          when 'false' then false
          else null
        end
      else has_design
    end,
    figma_url = nullif(btrim(coalesce(p_payload->>'figma_url', '')), ''),
    reference_urls = v_urls,
    design_style = nullif(btrim(coalesce(p_payload->>'design_style', '')), ''),
    has_logo = case
      when p_payload ? 'has_logo' then
        case p_payload->>'has_logo'
          when 'true' then true
          when 'false' then false
          else null
        end
      else has_logo
    end,
    has_brand_colors = case
      when p_payload ? 'has_brand_colors' then
        case p_payload->>'has_brand_colors'
          when 'true' then true
          when 'false' then false
          else null
        end
      else has_brand_colors
    end,
    brand_colors = nullif(btrim(coalesce(p_payload->>'brand_colors', '')), ''),
    budget_min = case
      when p_payload ? 'budget_min' then nullif(p_payload->>'budget_min', '')::numeric
      else budget_min
    end,
    budget_max = case
      when p_payload ? 'budget_max' then nullif(p_payload->>'budget_max', '')::numeric
      else budget_max
    end,
    budget_currency = coalesce(
      nullif(btrim(coalesce(p_payload->>'budget_currency', '')), ''),
      budget_currency,
      'BDT'
    ),
    deadline_type = nullif(btrim(coalesce(p_payload->>'deadline_type', '')), ''),
    deadline_date = case
      when p_payload ? 'deadline_date' then nullif(p_payload->>'deadline_date', '')::date
      else deadline_date
    end,
    referral_code_entered = nullif(btrim(coalesce(p_payload->>'referral_code_entered', '')), ''),
    referral_code_id = case
      when p_payload ? 'referral_code_entered' then null
      else referral_code_id
    end,
    service_id = case
      when p_payload ? 'service_id' then nullif(p_payload->>'service_id', '')::uuid
      else service_id
    end,
    form_snapshot = case
      when p_payload ? 'form_snapshot' then p_payload->'form_snapshot'
      else form_snapshot
    end,
    status = 'new',
    last_activity_at = now()
  where id = v_request.id
    and client_id = v_uid
    and status::text in ('draft', 'new', 'reviewing', 'quoted', 'rejected');

  if not found then
    raise exception 'This request can no longer be edited.';
  end if;

  return 'new'::public.request_status;
end;
$$;

revoke all on function public.update_own_project_request(uuid, jsonb) from public, anon;
grant execute on function public.update_own_project_request(uuid, jsonb) to authenticated;

create or replace function public.protect_project_request_client_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_active_admin() then
    return new;
  end if;

  if auth.uid() is null or old.client_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  if new.id is distinct from old.id
    or new.request_number is distinct from old.request_number
    or new.client_id is distinct from old.client_id
    or new.submitted_at is distinct from old.submitted_at
  then
    raise exception 'Request identity cannot be changed.';
  end if;

  if old.status::text in ('approved', 'converted', 'cancelled')
    and new.status is distinct from old.status
  then
    raise exception 'This request can no longer be modified.';
  end if;

  if old.status::text in ('approved', 'converted', 'cancelled') then
    raise exception 'This request can no longer be modified.';
  end if;

  if new.status = 'cancelled' then
    if (to_jsonb(new) - 'status' - 'updated_at' - 'last_activity_at')
      is distinct from (to_jsonb(old) - 'status' - 'updated_at' - 'last_activity_at')
    then
      raise exception 'Clients can only cancel their own requests.';
    end if;

    if old.status::text not in ('draft', 'new', 'reviewing', 'quoted') then
      raise exception 'This request can no longer be cancelled.';
    end if;

    return new;
  end if;

  if old.status::text not in ('draft', 'new', 'reviewing', 'quoted', 'rejected') then
    raise exception 'This request can no longer be edited.';
  end if;

  if new.status::text <> 'new' then
    raise exception 'This request can no longer be edited.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_project_request_client_update on public.project_requests;

create trigger protect_project_request_client_update
before update on public.project_requests
for each row
execute function public.protect_project_request_client_update();

revoke all on function public.protect_project_request_client_update() from public, anon, authenticated;

drop policy if exists "Customers can cancel their own project requests" on public.project_requests;
drop policy if exists "Customers can update their own project requests" on public.project_requests;

create policy "Customers can update their own project requests"
on public.project_requests
for update
to authenticated
using (
  client_id = auth.uid()
  and status::text in ('draft', 'new', 'reviewing', 'quoted', 'rejected')
)
with check (
  client_id = auth.uid()
  and status::text in ('new', 'cancelled')
);
