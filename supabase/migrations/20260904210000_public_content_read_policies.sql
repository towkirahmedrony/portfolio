-- Public read access for portfolio & services content
-- ----------------------------------------------------
-- The public site (/projects, /services and the homepage sections) reads
-- portfolio_projects / services / portfolio_project_images / service_features
-- with the anon key. RLS stays enabled; anonymous users can only SELECT rows
-- that are published (published = true). Gallery images and feature bullets are
-- readable only when their parent project / service is published.
--
-- Tables and admin-only policies come from 20260904160000_admin_content_cms.sql.
-- This migration only adds anon read access; no schema or column changes.

do $$
declare
  t text;
begin
  foreach t in array array['portfolio_projects', 'services']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('drop policy if exists "Public can view published %I" on public.%I', t, t);
    execute format(
      'create policy "Public can view published %I" on public.%I for select to anon using (published = true)',
      t,
      t
    );
    execute format('grant select on public.%I to anon', t);
  end loop;
end;
$$;

-- Child tables: only rows whose parent project / service is published.
do $$
begin
  if to_regclass('public.portfolio_project_images') is not null then
    drop policy if exists "Public can view images of published projects" on public.portfolio_project_images;
    create policy "Public can view images of published projects"
      on public.portfolio_project_images
      for select
      to anon
      using (
        exists (
          select 1
          from public.portfolio_projects p
          where p.id = portfolio_project_images.portfolio_project_id
            and p.published = true
        )
      );
    grant select on public.portfolio_project_images to anon;
  end if;

  if to_regclass('public.service_features') is not null then
    drop policy if exists "Public can view features of published services" on public.service_features;
    create policy "Public can view features of published services"
      on public.service_features
      for select
      to anon
      using (
        exists (
          select 1
          from public.services s
          where s.id = service_features.service_id
            and s.published = true
        )
      );
    grant select on public.service_features to anon;
  end if;
end;
$$;
