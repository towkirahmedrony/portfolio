-- Convert an approved project_request into a projects row.
-- Security-definer so conversion can insert the unique request_id relationship
-- without a service-role key. Duplicate conversion is rejected.

create or replace function public.generate_project_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  if to_regclass('public.projects') is null then
    raise exception 'projects table is not available';
  end if;

  loop
    attempts := attempts + 1;
    candidate := 'PJ-'
      || to_char(timezone('utc', now()), 'YYYYMMDD')
      || '-'
      || upper(substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text), 1, 8));

    exit when not exists (
      select 1 from public.projects where project_number = candidate
    );

    if attempts >= 20 then
      raise exception 'Could not generate a unique project number';
    end if;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.generate_project_number() from public, anon, authenticated;

create or replace function public.admin_convert_project_request(
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_project_id uuid;
  v_title text;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if to_regclass('public.project_requests') is null or to_regclass('public.projects') is null then
    raise exception 'Project tables are not available';
  end if;

  select * into v_request
  from public.project_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if exists (select 1 from public.projects where request_id = p_request_id) then
    raise exception 'This request has already been converted to a project.';
  end if;

  if v_request.status = 'converted' then
    raise exception 'This request has already been converted to a project.';
  end if;

  if v_request.status <> 'approved' then
    raise exception 'Only approved requests can be converted to a project.';
  end if;

  if v_request.client_id is null then
    raise exception 'This request has no linked client profile and cannot be converted.';
  end if;

  v_title := nullif(btrim(coalesce(v_request.project_type, '')), '');
  if v_title is null then
    v_title := 'Project from ' || v_request.request_number;
  end if;

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
    due_date
  )
  values (
    public.generate_project_number(),
    v_request.id,
    v_request.client_id,
    v_title,
    v_request.description,
    'pending',
    'normal',
    coalesce(nullif(v_request.budget_currency, ''), 'BDT'),
    coalesce(v_request.budget_max, v_request.budget_min),
    v_request.deadline_date
  )
  returning id into v_project_id;

  if to_regclass('public.project_requirements') is not null then
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

  update public.project_requests
  set status = 'converted'
  where id = v_request.id;

  if to_regclass('public.referrals') is not null then
    update public.referrals
    set first_project_id = v_project_id
    where project_request_id = v_request.id
      and first_project_id is null;
  end if;

  return v_project_id;
end;
$$;

revoke all on function public.admin_convert_project_request(uuid) from public, anon;
grant execute on function public.admin_convert_project_request(uuid) to authenticated;
