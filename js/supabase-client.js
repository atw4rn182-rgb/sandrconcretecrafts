/**
 * Dormant / shared Supabase browser helpers for S&R Concrete Crafts.
 *
 * Admin pages load:
 *   1. js/env.js          (generated on Vercel from SUPABASE_URL + SUPABASE_ANON_KEY)
 *   2. @supabase/supabase-js (CDN)
 *   3. this file
 *
 * The public storefront loads this when USE_LIVE_CATALOG is enabled.
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

  function isConfigured() {
    if (global.__SR_ENV_LOAD_ERROR__) return false;
    const { url, anonKey } = readEnv();
    return Boolean(
      url &&
        anonKey &&
        !url.includes("YOUR_PROJECT_REF") &&
        !anonKey.includes("YOUR_SUPABASE_ANON_KEY")
    );
  }

  /**
   * Creates a Supabase client when @supabase/supabase-js is available.
   * Returns null if credentials or the SDK are missing (safe no-op).
   */
  function createSrSupabaseClient() {
    const { url, anonKey } = readEnv();

    if (!isConfigured()) {
      console.warn(
        "[S&R] Supabase env not configured. On Vercel set SUPABASE_URL + SUPABASE_ANON_KEY."
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
    isConfigured: isConfigured,
  };
})(typeof window !== "undefined" ? window : globalThis);
