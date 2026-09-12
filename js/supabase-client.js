/**
 * Dormant Supabase browser client for S & R Concrete Crafts.
 *
 * Step 1: foundation only — not imported by index.html.
 * The public storefront still uses the local PRODUCTS array in app.js.
 *
 * When wiring the storefront (later step), load in this order:
 *   1. js/env.js          (from env.example.js — anon key only)
 *   2. @supabase/supabase-js (CDN or future bundler)
 *   3. this file
 *
 * Never place SUPABASE_SERVICE_ROLE_KEY in this file or any browser script.
 */
(function (global) {
  "use strict";

  function readEnv() {
    const env = global.__SR_ENV__ || {};
    return {
      url: String(env.SUPABASE_URL || "").trim(),
      anonKey: String(env.SUPABASE_ANON_KEY || "").trim(),
    };
  }

  /**
   * Creates a Supabase client when @supabase/supabase-js is available.
   * Returns null if credentials or the SDK are missing (safe no-op).
   */
  function createSrSupabaseClient() {
    const { url, anonKey } = readEnv();

    if (!url || !anonKey || url.includes("YOUR_PROJECT_REF")) {
      console.warn(
        "[S&R] Supabase env not configured. Copy js/env.example.js → js/env.js."
      );
      return null;
    }

    const createClient =
      (global.supabase && global.supabase.createClient) ||
      global.createClient;

    if (typeof createClient !== "function") {
      console.warn(
        "[S&R] @supabase/supabase-js is not loaded. Client not created."
      );
      return null;
    }

    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  global.SRSupabase = {
    createClient: createSrSupabaseClient,
    getEnv: readEnv,
  };
})(typeof window !== "undefined" ? window : globalThis);
