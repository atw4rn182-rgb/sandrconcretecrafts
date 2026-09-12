# Supabase foundation (Step 1)

This project is a **plain HTML / CSS / vanilla JavaScript** site.  
Step 1 adds a Supabase backend schema only. The public storefront still loads demo products from `app.js` and does **not** call Supabase yet.

## What was added

| Path | Purpose |
|------|---------|
| `supabase/migrations/*.sql` | Schema, RLS, storage bucket, badge + settings seeds |
| `.env.example` | Placeholder env var names (no secrets) |
| `js/env.example.js` | Browser env template for later (copy → `js/env.js`) |
| `js/supabase-client.js` | Dormant client helper (not loaded by `index.html`) |

## Tables created by migrations

1. `products`
2. `product_images`
3. `categories`
4. `product_categories`
5. `badges`
6. `product_badges`
7. `site_settings`

## Storage setup required

Bucket id/name: **`product-images`**

- Public bucket (storefront `<img>` tags need public URLs)
- Max file size: 10 MB
- Allowed MIME types: jpeg, png, webp, gif, avif
- **Public SELECT** for `anon` + `authenticated`
- **No client uploads** in Step 1 (upload via Dashboard or service role until admin Step 2)

Migration `20260912000003_storage_product_images.sql` creates the bucket + read policy.  
If Storage SQL fails in the editor, create the bucket in **Dashboard → Storage** with the same settings, then run only the `create policy` statement from that file.

## Environment variables you need

Create a Supabase project, then copy `.env.example` → `.env` (gitignored):

```
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

Rules:

- Use **anon key** in any future browser code (with RLS).
- **Never** put the service-role key in HTML/JS that ships to the browser.
- For a later local browser test without a bundler, copy `js/env.example.js` → `js/env.js` and fill URL + anon key only.

## How to run migrations

### Option A — Supabase SQL Editor (manual)

1. Open your project → **SQL → New query**
2. Run files **in order**:
   1. `supabase/migrations/20260912000001_initial_schema.sql`
   2. `supabase/migrations/20260912000002_row_level_security.sql`
   3. `supabase/migrations/20260912000003_storage_product_images.sql`
   4. `supabase/migrations/20260912000004_seed_badges_and_settings.sql`

### Option B — Supabase CLI

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Security summary (Step 1)

| Actor | Products / catalog | Storage uploads | Site settings |
|-------|--------------------|-----------------|---------------|
| Anonymous visitor | SELECT published / active only | No | SELECT |
| Authenticated (no admin yet) | Same as anon | No | SELECT |
| Service role | Full (bypasses RLS) | Full | Full |

Admin write policies and Auth are intentionally deferred to Step 2.

## Seeded badges

New, Featured, Best Seller, Hot Seller, Limited, Low Stock, Sale, Handmade, One of a Kind  
(manual assignment only — no fake sales automation)

## Step 2 addition

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260912000005_admin_users.sql` | `admin_users` + `is_active_admin()` + RLS |
| `admin/*` | Login + protected dashboard shell |

See `admin/README.md` for owner setup.

### Migration status check (important)

Having migration **files** in this repo does **not** mean they were applied to your remote Supabase database.  
From the local workspace we could **not** verify remote application (no `.env`, no linked CLI project).

Before relying on catalog or admin tables, confirm in Supabase:

- **Table Editor** shows `products`, `badges`, `site_settings`, etc.
- After Step 2 SQL: `admin_users` exists

If missing, run the SQL files in numeric order in the SQL Editor.

## Step 3 addition

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260912000006_admin_catalog_policies.sql` | Active-admin read/write on catalog + product-images storage |
| `admin/products.html` / `product-edit.html` / `categories.html` | Product & category management UI |

### Apply migration 6 before live saving

```text
supabase/migrations/20260912000006_admin_catalog_policies.sql
```

Until this is run in the Supabase SQL Editor, authenticated admins cannot insert/update products or upload images (RLS will deny writes).

## What is intentionally NOT done yet

- Storefront still uses local demo products (not Supabase catalog)
- No Stripe / checkout / orders
- No seasonal theme CSS applied
- Badge **definitions** are not edited in UI (assignments only; seed migration provides badges)

