/**
 * S & R Concrete Crafts — admin authentication helpers
 * Uses Supabase Auth (email/password) + admin_users verification.
 * Never place the service-role key here.
 */
(function (global) {
  "use strict";

  function adminPath(fileName) {
    // Hosted (Vercel / local server): absolute /admin/... paths
    // file:// preview: stay relative within /admin/
    const hosted =
      global.location &&
      (global.location.protocol === "http:" || global.location.protocol === "https:");
    if (hosted) return "/admin/" + fileName;
    return fileName;
  }

  const LOGIN_PATH = adminPath("login.html");
  const DASHBOARD_PATH = adminPath("index.html");

  let clientPromise = null;

  function friendlyAuthError(error) {
    if (!error) return "Something went wrong. Please try again.";
    const msg = String(error.message || error.error_description || "").toLowerCase();
    const status = error.status || error.code;

    if (msg.includes("invalid login") || msg.includes("invalid credentials") || status === 400) {
      return "That email or password doesn’t look right. Please try again.";
    }
    if (msg.includes("email not confirmed")) {
      return "Please confirm your email in Supabase before signing in.";
    }
    if (msg.includes("network") || msg.includes("fetch")) {
      return "We couldn’t reach the sign-in service. Check your internet connection.";
    }
    if (msg.includes("not configured") || msg.includes("env")) {
      return "Admin sign-in isn’t configured yet. Add your Supabase URL and anon key to js/env.js.";
    }
    return "We couldn’t sign you in right now. Please try again in a moment.";
  }

  function getCreateClient() {
    if (global.supabase && typeof global.supabase.createClient === "function") {
      return global.supabase.createClient;
    }
    if (typeof global.createClient === "function") return global.createClient;
    return null;
  }

  function readEnv() {
    if (global.SRSupabase && typeof global.SRSupabase.getEnv === "function") {
      return global.SRSupabase.getEnv();
    }
    const env = global.__SR_ENV__ || {};
    return {
      url: String(env.SUPABASE_URL || "").trim(),
      anonKey: String(env.SUPABASE_ANON_KEY || "").trim(),
    };
  }

  function isEnvConfigured() {
    const { url, anonKey } = readEnv();
    return Boolean(
      url &&
        anonKey &&
        !url.includes("YOUR_PROJECT_REF") &&
        !anonKey.includes("YOUR_SUPABASE_ANON_KEY")
    );
  }

  async function getClient() {
    if (clientPromise) return clientPromise;

    clientPromise = (async () => {
      if (!isEnvConfigured()) {
        const err = new Error("Supabase env not configured");
        err.code = "ENV_MISSING";
        throw err;
      }

      const createClient = getCreateClient();
      if (!createClient) {
        const err = new Error("Supabase library not loaded");
        err.code = "SDK_MISSING";
        throw err;
      }

      const { url, anonKey } = readEnv();
      return createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "sr-admin-auth",
        },
      });
    })();

    return clientPromise;
  }

  async function getSession() {
    const supabase = await getClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  /**
   * Returns { ok, session, profile, reason }
   * Authorization is based on admin_users.active — not UI alone.
   */
  async function verifyActiveAdmin() {
    const supabase = await getClient();
    const session = await getSession();

    if (!session || !session.user) {
      return { ok: false, session: null, profile: null, reason: "unauthenticated" };
    }

    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id, role, active, created_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      // Table missing / RLS / network — treat as denied, surface setup hint when helpful
      const code = error.code || "";
      if (code === "42P01" || String(error.message || "").includes("does not exist")) {
        return { ok: false, session, profile: null, reason: "schema_missing", error };
      }
      return { ok: false, session, profile: null, reason: "lookup_failed", error };
    }

    if (!data) {
      return { ok: false, session, profile: null, reason: "not_admin" };
    }

    if (!data.active) {
      return { ok: false, session, profile: data, reason: "inactive" };
    }

    return { ok: true, session, profile: data, reason: null };
  }

  async function signIn(email, password) {
    const supabase = await getClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || ""),
    });

    if (error) {
      const wrapped = new Error(friendlyAuthError(error));
      wrapped.cause = error;
      throw wrapped;
    }

    const check = await verifyActiveAdmin();
    if (!check.ok) {
      await supabase.auth.signOut();
      const denied = new Error(denyMessage(check.reason));
      denied.code = check.reason;
      throw denied;
    }

    return { session: data.session, profile: check.profile };
  }

  function denyMessage(reason) {
    switch (reason) {
      case "not_admin":
      case "inactive":
        return "This account isn’t set up for admin access. Ask your web helper to add you as an active admin.";
      case "schema_missing":
        return "Admin access isn’t ready yet. The admin database table still needs to be created in Supabase.";
      case "lookup_failed":
        return "We signed you in, but couldn’t verify admin access. Please try again or contact support.";
      default:
        return "You don’t have permission to open the admin area.";
    }
  }

  async function signOut() {
    try {
      const supabase = await getClient();
      await supabase.auth.signOut();
    } catch (_) {
      // Still clear local redirect even if network fails
    }
  }

  function go(path) {
    window.location.replace(path);
  }

  /**
   * Call on /admin/index.html (and future protected pages).
   * Redirects unauthenticated users; blocks non-admins.
   */
  async function requireAdminPage(options) {
    const opts = options || {};
    const gateEl = document.getElementById(opts.gateId || "adminGate");

    try {
      if (!isEnvConfigured()) {
        if (gateEl) {
          gateEl.textContent =
            "Admin isn’t configured yet. Add Supabase URL and anon key to js/env.js, then refresh.";
        }
        setTimeout(() => go(LOGIN_PATH), 1200);
        return null;
      }

      const check = await verifyActiveAdmin();

      if (check.reason === "unauthenticated") {
        go(LOGIN_PATH);
        return null;
      }

      if (!check.ok) {
        await signOut();
        go(LOGIN_PATH + "?denied=1");
        return null;
      }

      if (gateEl) gateEl.hidden = true;
      return check;
    } catch (err) {
      if (err && err.code === "ENV_MISSING") {
        go(LOGIN_PATH);
        return null;
      }
      // Expired / invalid refresh token etc.
      await signOut();
      go(LOGIN_PATH + "?expired=1");
      return null;
    }
  }

  /**
   * Call on login page — bounce active admins to dashboard.
   */
  async function redirectIfAdminSession() {
    if (!isEnvConfigured()) return false;
    try {
      const check = await verifyActiveAdmin();
      if (check.ok) {
        go(DASHBOARD_PATH);
        return true;
      }
      if (check.session && !check.ok) {
        await signOut();
      }
    } catch (_) {
      /* stay on login */
    }
    return false;
  }

  function watchAuth(onChange) {
    getClient()
      .then((supabase) => {
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (typeof onChange === "function") onChange(event, session);
          if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
            if (!window.location.pathname.endsWith("/login.html")) {
              go(LOGIN_PATH + (event === "SIGNED_OUT" ? "" : "?expired=1"));
            }
          }
        });
        return data;
      })
      .catch(() => {});
  }

  global.SRAdminAuth = {
    LOGIN_PATH,
    DASHBOARD_PATH,
    getClient,
    getSession,
    isEnvConfigured,
    verifyActiveAdmin,
    signIn,
    signOut,
    requireAdminPage,
    redirectIfAdminSession,
    watchAuth,
    friendlyAuthError,
    denyMessage,
  };
})(typeof window !== "undefined" ? window : globalThis);
