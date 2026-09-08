-- Project Request Form: required phone + conditional file fields
-- ----------------------------------------------------------------
-- Extends the existing Form Builder (order_form_steps / fields / options).
-- Does not recreate the form, duplicate tables, or alter historical
-- project_requests.phone nullability. New inserts/edits require a phone.

do $$
declare
  conname text;
begin
  if to_regclass('public.order_form_fields') is not null then
    select c.conname
    into conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'order_form_fields'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%input_type%';

    if conname is not null then
      execute format('alter table public.order_form_fields drop constraint %I', conname);
    end if;

    alter table public.order_form_fields
      add constraint order_form_fields_input_type_check
      check (input_type in (
        'text', 'email', 'tel', 'textarea', 'date', 'radio', 'checkbox_group', 'select', 'file'
      ));
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.project_files') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'project_files'
         and column_name = 'form_field_key'
     )
  then
    alter table public.project_files
      add column form_field_key text;
  end if;
end;
$$;

create or replace function public.prepare_project_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.client_id := coalesce(auth.uid(), new.client_id);
  new.status := 'new';
  new.submitted_at := now();
  new.updated_at := now();
  new.referral_code_id := null;

  if new.request_number is null or btrim(new.request_number) = '' then
    new.request_number := public.generate_request_number();
  end if;

  if new.phone is null or btrim(new.phone) = '' then
    raise exception 'Please enter your phone number.';
  end if;

  return new;
end;
$$;

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
  v_phone text;
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
  v_phone := nullif(btrim(coalesce(p_payload->>'phone', '')), '');

  if v_full_name is null then
    raise exception 'Please enter your full name.';
  end if;

  if v_email is null then
    raise exception 'Please enter your email address.';
  end if;

  if v_phone is null then
    raise exception 'Please enter your phone number.';
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
    phone = v_phone,
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

do $$
declare
  v_phone_step uuid;
  v_phone_sort integer;
  v_has_logo record;
  v_website record;
  v_reference record;
  v_logo_yes jsonb;
  v_redesign jsonb;
  v_slugs text[];
  v_ws_key text;
begin
  if to_regclass('public.order_form_fields') is not null
     and to_regclass('public.order_form_steps') is not null
     and exists (select 1 from public.order_form_steps where is_active = true)
  then

  select f.step_id,
         coalesce(f.sort_order, 0) + 1
  into v_phone_step, v_phone_sort
  from public.order_form_fields f
  join public.order_form_steps s on s.id = f.step_id
  where f.field_key in ('email')
  order by s.sort_order, f.sort_order
  limit 1;

  if v_phone_step is null then
    select f.step_id,
           coalesce(f.sort_order, 0) + 1
    into v_phone_step, v_phone_sort
    from public.order_form_fields f
    join public.order_form_steps s on s.id = f.step_id
    where f.field_key in ('full_name', 'fullName')
    order by s.sort_order, f.sort_order
    limit 1;
  end if;

  if v_phone_step is null then
    select id, 0
    into v_phone_step, v_phone_sort
    from public.order_form_steps
    where is_active = true
    order by sort_order, id
    limit 1;
  end if;

  if v_phone_step is not null then
    insert into public.order_form_fields (
      field_key,
      step_id,
      input_type,
      label,
      hint,
      placeholder,
      required,
      visible,
      sort_order,
      conditional,
      constraints,
      is_active
    )
    values (
      'phone',
      v_phone_step,
      'tel',
      'Phone Number',
      'Required so we can reach you about this request.',
      'Your phone number',
      true,
      true,
      v_phone_sort,
      '{}'::jsonb,
      jsonb_build_object('span', 'full'),
      true
    )
    on conflict (field_key) do update
    set
      required = true,
      visible = true,
      is_active = true,
      input_type = 'tel',
      conditional = '{}'::jsonb,
      label = case
        when btrim(coalesce(order_form_fields.label, '')) = '' then 'Phone Number'
        else order_form_fields.label
      end;
  end if;

  select f.id, f.field_key, f.step_id, f.sort_order
  into v_has_logo
  from public.order_form_fields f
  where f.field_key in ('has_logo', 'hasLogo')
  order by case when f.field_key = 'has_logo' then 0 else 1 end
  limit 1;

  if v_has_logo is not null then
    v_logo_yes := jsonb_build_object(
      'show_when', jsonb_build_object(
        'field', v_has_logo.field_key,
        'in', jsonb_build_array('yes', 'true', '1')
      )
    );

    insert into public.order_form_fields (
      field_key,
      step_id,
      input_type,
      label,
      hint,
      required,
      visible,
      sort_order,
      conditional,
      constraints,
      is_active
    )
    values (
      'logo_file',
      v_has_logo.step_id,
      'file',
      'Upload Logo',
      'Optional. JPG, PNG, WEBP, SVG, PDF, or ZIP.',
      false,
      true,
      v_has_logo.sort_order + 1,
      v_logo_yes,
      jsonb_build_object('category', 'logo', 'max_files', 1, 'span', 'full'),
      true
    )
    on conflict (field_key) do update
    set
      input_type = 'file',
      required = false,
      visible = true,
      is_active = true,
      step_id = excluded.step_id,
      sort_order = excluded.sort_order,
      conditional = excluded.conditional,
      constraints = excluded.constraints,
      label = case
        when btrim(coalesce(order_form_fields.label, '')) = '' then 'Upload Logo'
        else order_form_fields.label
      end,
      hint = coalesce(order_form_fields.hint, excluded.hint);
  end if;

  select f.id, f.field_key, f.step_id, f.sort_order, f.options_group
  into v_website
  from public.order_form_fields f
  where f.field_key in ('website_status', 'websiteStatus')
  order by case when f.field_key = 'website_status' then 0 else 1 end
  limit 1;

  if v_website is not null then
    v_ws_key := v_website.field_key;

    select coalesce(array_agg(distinct o.slug), array['redesign'::text])
    into v_slugs
    from public.order_form_options o
    where o.is_active = true
      and (
        (v_website.options_group is not null and o."group" = v_website.options_group)
        or o."group" in ('website_status', 'websiteStatus')
      )
      and (
        o.slug ilike '%redesign%'
        or o.label ilike '%redesign%'
      );

    if v_slugs is null or coalesce(array_length(v_slugs, 1), 0) = 0 then
      v_slugs := array['redesign'];
    end if;

    v_redesign := jsonb_build_object(
      'show_when', jsonb_build_object(
        'field', v_ws_key,
        'in', to_jsonb(v_slugs)
      )
    );

    select f.id, f.field_key, f.step_id, f.sort_order
    into v_reference
    from public.order_form_fields f
    where f.field_key in ('reference_urls', 'referenceUrls')
    order by case when f.field_key = 'reference_urls' then 0 else 1 end
    limit 1;

    if v_reference is null then
      insert into public.order_form_fields (
        field_key,
        step_id,
        input_type,
        label,
        hint,
        placeholder,
        required,
        visible,
        sort_order,
        conditional,
        constraints,
        is_active
      )
      values (
        'reference_urls',
        v_website.step_id,
        'text',
        'Website/Reference URL',
        'Optional. Paste a current site or inspiration link.',
        'https://',
        false,
        true,
        v_website.sort_order + 1,
        v_redesign,
        jsonb_build_object('span', 'full'),
        true
      );

      select f.id, f.field_key, f.step_id, f.sort_order
      into v_reference
      from public.order_form_fields f
      where f.field_key = 'reference_urls';
    else
      update public.order_form_fields
      set
        required = false,
        visible = true,
        is_active = true,
        conditional = v_redesign,
        constraints = case
          when constraints = '{}'::jsonb then jsonb_build_object('span', 'full')
          else constraints
        end,
        hint = coalesce(hint, 'Optional. Paste a current site or inspiration link.')
      where id = v_reference.id;
    end if;

    insert into public.order_form_fields (
      field_key,
      step_id,
      input_type,
      label,
      hint,
      required,
      visible,
      sort_order,
      conditional,
      constraints,
      is_active
    )
    values (
      'website_reference_file',
      coalesce(v_reference.step_id, v_website.step_id),
      'file',
      'Reference photo or file',
      'Optional. Independent from the URL — you can add a file, a link, both, or neither.',
      false,
      true,
      coalesce(v_reference.sort_order, v_website.sort_order) + 1,
      v_redesign,
      jsonb_build_object('category', 'attachment', 'max_files', 3, 'span', 'full'),
      true
    )
    on conflict (field_key) do update
    set
      input_type = 'file',
      required = false,
      visible = true,
      is_active = true,
      step_id = excluded.step_id,
      sort_order = excluded.sort_order,
      conditional = excluded.conditional,
      constraints = excluded.constraints,
      label = case
        when btrim(coalesce(order_form_fields.label, '')) = '' then excluded.label
        else order_form_fields.label
      end,
      hint = coalesce(order_form_fields.hint, excluded.hint);
  end if;
  end if;
end;
$$;
