# Admin area

Private owner tools for S & R Concrete Crafts.

## Pages

- `/admin/login.html` — email/password sign in
- `/admin/` — dashboard
- `/admin/products.html` — product list
- `/admin/product-edit.html` — add/edit product + live preview
- `/admin/categories.html` — create/rename/activate categories

## Required SQL migrations (in order)

1. `20260912000001_initial_schema.sql`
2. `20260912000002_row_level_security.sql`
3. `20260912000003_storage_product_images.sql`
4. `20260912000004_seed_badges_and_settings.sql`
5. `20260912000005_admin_users.sql`
6. **`20260912000006_admin_catalog_policies.sql`** ← required for product saves/uploads

Supabase Dashboard → **SQL** → New query → paste each file → Run.

Creating the migration file does **not** apply it. Until migration 6 runs, product saves will fail with a permission message.

## Public config (Vercel)

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (never service-role). Redeploy so `npm run build` writes `js/env.js`.

## Owner account

1. Auth → Users → Add user  
2. Insert into `admin_users` (see earlier Step 2 docs)

## Notes

- Catalog “Publish” does **not** update the public demo storefront yet.
- Badge choices come from the `badges` table (seeded), not hard-coded UI-only values.
- Canceling an edit does **not** delete existing photos.
