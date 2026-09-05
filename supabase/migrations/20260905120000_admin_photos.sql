-- Admin photo uploads (Supabase Storage bucket: photos)
-- -----------------------------------------------------
-- The "photos" bucket is created in the Supabase dashboard; this migration
-- never inserts a new bucket. Folders (portfolio, services, reviews, profile,
-- projects, clients) are created automatically by object paths on upload.
--
-- Public SELECT is required so published portfolio/services images render on
-- the website. INSERT/UPDATE/DELETE are admin-only via is_active_admin().
--
-- Optional image columns are added only when missing:
--   services.image_url, reviews.photo_url
-- Existing URL columns (portfolio_projects.thumbnail_url,
-- portfolio_project_images.image_url, profiles.avatar_url) are reused.
--
-- Depends on public.is_active_admin() (20260904130000).

-- 1) Make the existing photos bucket publicly readable for the website.
update storage.buckets
set public = true
where id = 'photos';

-- 2) Storage RLS: anyone may view; only active admins may write.
drop policy if exists "Public can view photos" on storage.objects;
create policy "Public can view photos"
on storage.objects
for select
to public
using (bucket_id = 'photos');

drop policy if exists "Admins can upload photos" on storage.objects;
create policy "Admins can upload photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'photos'
  and public.is_active_admin()
  and (storage.foldername(name))[1] in (
    'portfolio', 'services', 'reviews', 'profile', 'projects', 'clients'
  )
);

drop policy if exists "Admins can update photos" on storage.objects;
create policy "Admins can update photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'photos'
  and public.is_active_admin()
)
with check (
  bucket_id = 'photos'
  and public.is_active_admin()
  and (storage.foldername(name))[1] in (
    'portfolio', 'services', 'reviews', 'profile', 'projects', 'clients'
  )
);

drop policy if exists "Admins can delete photos" on storage.objects;
create policy "Admins can delete photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'photos'
  and public.is_active_admin()
);

-- 3) Optional image columns on existing CMS tables (no new tables).
do $$
begin
  if to_regclass('public.services') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'services'
         and column_name = 'image_url'
     )
  then
    alter table public.services add column image_url text;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.reviews') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'reviews'
         and column_name = 'photo_url'
     )
  then
    alter table public.reviews add column photo_url text;
  end if;
end;
$$;

-- 4) Admin-only write of a client avatar_url. RLS only lets a user update
--    their own profile, so this gated RPC is required for /admin/clients.
create or replace function public.admin_set_client_avatar_url(
  p_client_id uuid,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if p_client_id is null then
    raise exception 'Client is required.';
  end if;

  select p.role::text
  into v_role
  from public.profiles p
  where p.id = p_client_id;

  if v_role is null then
    raise exception 'Client profile not found.';
  end if;

  if v_role <> 'client' then
    raise exception 'Only client avatars can be managed from this action.';
  end if;

  update public.profiles
  set avatar_url = nullif(trim(p_avatar_url), '')
  where id = p_client_id;
end;
$$;

revoke all on function public.admin_set_client_avatar_url(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_client_avatar_url(uuid, text) to authenticated;
