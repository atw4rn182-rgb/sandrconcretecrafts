# Supabase (S & R Concrete Crafts)

Plain HTML / CSS / vanilla JS storefront with Supabase for catalog + admin.

## Migrations (run in numeric order)

| File | Purpose |
|------|---------|
| `20260912000001_initial_schema.sql` | Tables |
| `20260912000002_row_level_security.sql` | Public read of published; no public writes |
| `20260912000003_storage_product_images.sql` | Storage bucket |
| `20260912000004_seed_badges_and_settings.sql` | Badges + site_settings |
| `20260912000005_admin_users.sql` | Admin allow-list |
| `20260912000006_admin_catalog_policies.sql` | Active-admin catalog writes |
| `20260912000007_storefront_catalog_fields.sql` | `source_key`, `item_no`, `track_inventory`; public read for **published + sold_out** |
| `20260912000008_import_legacy_storefront_products.sql` | Idempotent import of 17 original storefront products |

**Having files in git ≠ applied on your project.** Apply via SQL Editor (or `supabase db push` if linked).

## Step 4 cutover (safe)

1. Apply **07**, then **08** in the SQL Editor.
2. In the Results / Notices for 08, confirm roughly: `inserted=…`, `skipped_existing=…`, `ambiguous_skipped=…`.
3. In Admin → Products, confirm imported rows (photos under `/assets/…`, item numbers, badges) and that any product you created earlier is still there.
4. Only then set Vercel env **`USE_LIVE_CATALOG=true`** and redeploy.
5. Until that flag is true, production keeps the **demo** product list in `app.js`.

### Import rules (08)

- Stable id: `source_key = legacy:<old-id>` (e.g. `legacy:cow`).
- Existing `source_key` → skip (never overwrites owner edits).
- Same title without that `source_key` → **AMBIGUOUS** warning, skip (no merge by title).
- `track_inventory = false` (original data had no stock counts).
- Images keep root-relative `/assets/prod-XX.png` (repo assets unchanged).

## Environment

```
SUPABASE_URL=…
SUPABASE_ANON_KEY=…
USE_LIVE_CATALOG=false
# never put SERVICE_ROLE in browser / Vercel public build for this site
```

`npm run build` → `scripts/write-public-env.js` → `js/env.js` (gitignored).

## Security summary

| Actor | Catalog read | Catalog write |
|-------|--------------|---------------|
| Anonymous | published + sold_out (+ related images/badges/categories) | No |
| Authenticated non-admin | same | No |
| Active admin | all statuses | Yes (RLS) |
| Service role | full (Dashboard / server only) | full |

Draft/hidden remain private. Public writes stay denied.

## Local verification (no remote DB)

```bash
node scripts/verify-step4-local.js
npm run build
```

## Intentionally not in this step

- Stripe / real orders (checkout remains clearly demo)
- Homepage / banner / appearance settings
- Stock reservation or payment security in the browser
