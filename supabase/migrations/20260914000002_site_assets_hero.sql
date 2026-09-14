-- Prompt XY.1: public site-assets bucket for storefront hero (and future site media)
-- Additive only. Does not alter product-images or site_settings schema.
-- Appearance JSON lives in existing site_settings.config.appearance (no column change).
--
-- APPLY IN SUPABASE SQL EDITOR (or CLI) before relying on hero upload in production.
-- Until applied: Appearance falls back to default hero; upload will show a clear error.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (storefront <img> tags)
drop policy if exists "site_assets_bucket_public_select" on storage.objects;
create policy "site_assets_bucket_public_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'site-assets');

-- Active admins only may write under hero/ (and future site paths)
drop policy if exists "site_assets_bucket_admin_insert" on storage.objects;
create policy "site_assets_bucket_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'site-assets'
    and public.is_active_admin()
    and (storage.foldername(name))[1] = 'hero'
  );

drop policy if exists "site_assets_bucket_admin_update" on storage.objects;
create policy "site_assets_bucket_admin_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'site-assets'
    and public.is_active_admin()
    and (storage.foldername(name))[1] = 'hero'
  )
  with check (
    bucket_id = 'site-assets'
    and public.is_active_admin()
    and (storage.foldername(name))[1] = 'hero'
  );

drop policy if exists "site_assets_bucket_admin_delete" on storage.objects;
create policy "site_assets_bucket_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'site-assets'
    and public.is_active_admin()
    and (storage.foldername(name))[1] = 'hero'
  );
