/**
 * Browser env placeholders for the plain HTML site (no bundler).
 *
 * Local setup:
 *   1. Copy this file to js/env.js  — OR run: npm run build
 *   2. Paste your Supabase URL + anon key (never the service-role key)
 *
 * Production (Vercel):
 *   Set SUPABASE_URL and SUPABASE_ANON_KEY in Project → Settings → Environment Variables.
 *   `npm run build` (scripts/write-public-env.js) generates js/env.js at deploy time.
 *   js/env.js stays gitignored and is never committed.
 *
 * Storefront index.html still does NOT load this file (demo products remain local).
 */
window.__SR_ENV__ = {
  SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
};
