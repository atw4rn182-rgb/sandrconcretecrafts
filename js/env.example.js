/**
 * Browser env placeholders for the plain HTML site (no bundler).
 *
 * Local setup:
 *   1. Copy this file to js/env.js  — OR run: npm run build
 *   2. Paste your Supabase URL + anon key (never the service-role key)
 *
 * Production (Vercel):
 *   Set SUPABASE_URL and SUPABASE_ANON_KEY in Project → Settings → Environment Variables.
 *   Optionally set USE_LIVE_CATALOG=true after migrations 07–08 are applied (default false).
 *   Optionally set USE_STRIPE_CHECKOUT=true only after Stripe test keys + webhook are on the server.
 *   Never put STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET into this file.
 *   `npm run build` (scripts/write-public-env.js) generates js/env.js at deploy time.
 *   js/env.js stays gitignored and is never committed.
 *
 * When USE_LIVE_CATALOG is false, the storefront keeps the local demo product list.
 */
window.__SR_ENV__ = {
  SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  // Keep false until migrations 07–08 are applied and the import is verified.
  USE_LIVE_CATALOG: false,
  // Keep false until Stripe test Checkout is configured (server secrets + webhook).
  USE_STRIPE_CHECKOUT: false,
  // Set at build time on Vercel (VERCEL_GIT_COMMIT_SHA) — null locally.
  BUILD_COMMIT: null,
};
