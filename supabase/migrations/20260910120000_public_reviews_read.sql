-- Public read access for published client reviews
-- ------------------------------------------------
-- The homepage / services testimonials section reads reviews with the anon
-- key. RLS stays enabled; anonymous (and authenticated) visitors may only
-- SELECT reviews that admins have both approved and published
-- (status = 'approved' AND published_at IS NOT NULL).
--
-- Client name / company / project title are not readable from profiles or
-- projects under anon RLS, so a narrow SECURITY DEFINER helper returns only
-- the display fields needed on the public site. No emails, phones, avatars
-- from profiles, or internal project numbers are exposed.
--
-- Depends on public.reviews (20260904170000_admin_reviews.sql).

do $$
begin
  if to_regclass('public.reviews') is null then
    return;
  end if;

  execute 'alter table public.reviews enable row level security';

  execute 'drop policy if exists "Public can view published reviews" on public.reviews';
  execute $policy$
    create policy "Public can view published reviews"
    on public.reviews
    for select
    to anon, authenticated
    using (
      status = 'approved'::public.review_status
      and published_at is not null
    )
  $policy$;

  execute 'grant select on public.reviews to anon';
  execute 'grant select on public.reviews to authenticated';
end;
$$;

create or replace function public.list_public_reviews(p_limit integer default 12)
returns table (
  id uuid,
  rating integer,
  title text,
  review text,
  photo_url text,
  published_at timestamptz,
  client_name text,
  client_company text,
  project_title text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.rating,
    r.title,
    r.review,
    r.photo_url,
    r.published_at,
    coalesce(
      nullif(btrim(p.display_name), ''),
      nullif(btrim(p.full_name), ''),
      'Client'
    ) as client_name,
    nullif(btrim(p.company_name), '') as client_company,
    nullif(btrim(pr.title), '') as project_title
  from public.reviews r
  join public.profiles p on p.id = r.client_id
  left join public.projects pr on pr.id = r.project_id
  where r.status = 'approved'::public.review_status
    and r.published_at is not null
  order by r.published_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 24));
$$;

revoke all on function public.list_public_reviews(integer) from public;
grant execute on function public.list_public_reviews(integer) to anon, authenticated;
