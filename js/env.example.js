/**
 * Browser env placeholders for the plain HTML site (no bundler).
 *
 * Setup:
 *   1. Copy this file to js/env.js
 *   2. Paste your Supabase URL + anon key (never the service-role key)
 *   3. Admin pages load js/env.js automatically
 *
 * js/env.js is gitignored. Do not commit the service-role key.
 * The anon key is designed for browser use with Row Level Security.
 *
 * Storefront index.html still does NOT load this file (demo products remain local).
 */
window.__SR_ENV__ = {
  SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
};
