-- Storage: product-images bucket for multiple product photos
--
-- If this migration fails in the SQL Editor because storage schema permissions
-- differ on your plan, create the bucket in Dashboard → Storage and run the
-- policies section manually (see supabase/README.md).

-- Public bucket so published storefront images can be loaded by <img> tags.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for anyone (anon + authenticated)
create policy "product_images_bucket_public_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- No insert / update / delete policies for anon or authenticated in Step 1.
-- Uploads will use authenticated admin (or service role) policies in Step 2.
-- Until then, upload via Dashboard or service-role tooling only.