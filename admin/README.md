# Admin area

Private owner tools for S&R Concrete Crafts.

## Pages

- `/admin/login.html` — email/password sign in
- `/admin/` — dashboard (exact catalog counts, recent products, inventory attention)
- `/admin/products.html` — product list (`?status=draft|published|sold_out|hidden`, optional `q`, `category`)
- `/admin/product-edit.html` — add/edit product + live preview (includes inline Add Category)
- `/admin/categories.html` — create/rename/activate categories

## Required SQL migrations (in order)

1. `20260912000001_initial_schema.sql`
2. `20260912000002_row_level_security.sql`
3. `20260912000003_storage_product_images.sql`
4. `20260912000004_seed_badges_and_settings.sql`
5. `20260912000005_admin_users.sql`
6. `20260912000006_admin_catalog_policies.sql`
7. **`20260912000007_storefront_catalog_fields.sql`** — `source_key`, `item_no`, `track_inventory`, sold-out public read
8. **`20260912000008_import_legacy_storefront_products.sql`** — idempotent import of the 17 original demo products
9. **`20260913000001_orders.sql`** — `orders` + `order_items` for Stripe Checkout webhook upserts (admin read; service-role write)

Supabase Dashboard → **SQL** → New query → paste each file → Run.

Creating a migration file does **not** apply it.

## Public config (Vercel)

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (never service-role).

Keep **`USE_LIVE_CATALOG` unset or `false`** until migrations 07–08 are applied and the import notices look correct. Then set `USE_LIVE_CATALOG=true` and redeploy so `npm run build` writes the flag into `js/env.js`.

## Owner account

1. Auth → Users → Add user  
2. Insert into `admin_users` (see earlier Step 2 docs)

## Publish meaning

- With **`USE_LIVE_CATALOG=false`** (default): Publish saves to the catalog; visitors still see the local demo list.
- With **`USE_LIVE_CATALOG=true`**: Published and sold-out products appear on the public shop. Draft and hidden never appear. Edits show after a refresh.

## Notes

- Imported legacy products use `source_key` like `legacy:cow` and start with **inventory not tracked**.
- Item # is editable on the product form.
- Canceling an edit does **not** delete existing photos.
- Checkout: demo by default. Stripe hosted Checkout is available behind `USE_STRIPE_CHECKOUT` (server secrets only — see `docs/STRIPE_SETUP.md`). Paid sessions appear under **Orders** after the webhook upserts them.
- From the product editor, **Add Category** creates an active category immediately via `SRCatalog.createCategory`. Checking it on the product still requires **Save**. Equivalent names offer “Select existing” instead of duplicating; inactive matches are selected without reactivation.
