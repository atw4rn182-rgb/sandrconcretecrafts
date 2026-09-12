-- Step 3: active-admin catalog + storage write policies
-- Preserves Step 1 public-read policies. Does not allow client management of admin_users.

-- ---------------------------------------------------------------------------
-- PRODUCTS — admins can read all statuses and fully manage rows
-- ---------------------------------------------------------------------------

create policy "products_admin_select_all"
  on public.products
  for select
  to authenticated
  using (public.is_active_admin());

create policy "products_admin_insert"
  on public.products
  for insert
  to authenticated
  with check (public.is_active_admin());

create policy "products_admin_update"
  on public.products
  for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

create policy "products_admin_delete"
  on public.products
  for delete
  to authenticated
  using (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- PRODUCT IMAGES
-- ---------------------------------------------------------------------------

create policy "product_images_admin_select_all"
  on public.product_images
  for select
  to authenticated
  using (public.is_active_admin());

create policy "product_images_admin_insert"
  on public.product_images
  for insert
  to authenticated
  with check (public.is_active_admin());

create policy "product_images_admin_update"
  on public.product_images
  for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

create policy "product_images_admin_delete"
  on public.product_images
  for delete
  to authenticated
  using (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- CATEGORIES — include inactive for admin management
-- ---------------------------------------------------------------------------

create policy "categories_admin_select_all"
  on public.categories
  for select
  to authenticated
  using (public.is_active_admin());

create policy "categories_admin_insert"
  on public.categories
  for insert
  to authenticated
  with check (public.is_active_admin());

create policy "categories_admin_update"
  on public.categories
  for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

create policy "categories_admin_delete"
  on public.categories
  for delete
  to authenticated
  using (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- PRODUCT CATEGORIES
-- ---------------------------------------------------------------------------

create policy "product_categories_admin_select_all"
  on public.product_categories
  for select
  to authenticated
  using (public.is_active_admin());

create policy "product_categories_admin_insert"
  on public.product_categories
  for insert
  to authenticated
  with check (public.is_active_admin());

create policy "product_categories_admin_delete"
  on public.product_categories
  for delete
  to authenticated
  using (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- BADGES — read inactive definitions in admin; writes stay locked
-- (badge definitions are seeded; assignment is via product_badges)
-- ---------------------------------------------------------------------------

create policy "badges_admin_select_all"
  on public.badges
  for select
  to authenticated
  using (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- PRODUCT BADGES
-- ---------------------------------------------------------------------------

create policy "product_badges_admin_select_all"
  on public.product_badges
  for select
  to authenticated
  using (public.is_active_admin());

create policy "product_badges_admin_insert"
  on public.product_badges
  for insert
  to authenticated
  with check (public.is_active_admin());

create policy "product_badges_admin_delete"
  on public.product_badges
  for delete
  to authenticated
  using (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- STORAGE: product-images — active admins may upload / update / delete
-- Public select policy from Step 1 remains unchanged.
-- ---------------------------------------------------------------------------

create policy "product_images_bucket_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_active_admin()
  );

create policy "product_images_bucket_admin_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_active_admin()
  )
  with check (
    bucket_id = 'product-images'
    and public.is_active_admin()
  );

create policy "product_images_bucket_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_active_admin()
  );
