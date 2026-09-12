/**
 * S&R Concrete Crafts — admin authentication helpers
 * Uses Supabase Auth (email/password) + admin_users verification.
 * Never place the service-role key here.
 *
 * Public config comes from js/env.js (generated on Vercel from SUPABASE_URL
 * + SUPABASE_ANON_KEY only).
 */
(function (global) {
  "use strict";

  var ACCESS_CHECK_MS = 12000;
  var MISSING_CONFIG_MESSAGE =
    "Admin setup is incomplete. Supabase configuration is missing.";

  function log(stage, detail) {
    try {
      if (detail !== undefined) {
        console.info("[SRAdminAuth]", stage, detail);
      } else {
        console.info("[SRAdminAuth]", stage);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function adminPath(fileName) {
    var hosted =
      global.location &&
      (global.location.protocol === "http:" || global.location.protocol === "https:");
    if (hosted) return "/admin/" + fileName;
    return fileName;
  }

  var LOGIN_PATH = adminPath("login.html");
  var DASHBOARD_PATH = adminPath("index.html");
  var clientPromise = null;
  var authWatcherBound = false;

  function withTimeout(promise, ms, message) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        var err = new Error(message || "This is taking too long. Please try again.");
        err.code = "TIMEOUT";
        reject(err);
      }, ms);
      Promise.resolve(promise).then(
        function (value) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        function (err) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  function friendlyAuthError(error) {
    if (!error) return "Something went wrong. Please try again.";
    if (error.code === "ENV_MISSING" || error.code === "ENV_LOAD_ERROR") {
      return MISSING_CONFIG_MESSAGE;
    }
    if (error.code === "TIMEOUT") {
      return "Sign-in is taking too long. Please check your connection and try again.";
    }
    if (error.code === "SDK_MISSING") {
      return "We couldn't load the sign-in tools. Please refresh the page.";
    }

    var msg = String(error.message || error.error_description || "").toLowerCase();
    var status = error.status || error.code;

    if (msg.includes("invalid login") || msg.includes("invalid credentials") || status === 400) {
      return "That email or password doesn't look right. Please try again.";
    }
    if (msg.includes("email not confirmed")) {
      return "Please confirm your email in Supabase before signing in.";
    }
    if (msg.includes("network") || msg.includes("fetch")) {
      return "We couldn't reach the sign-in service. Check your internet connection.";
    }
    if (msg.includes("not configured") || msg.includes("env")) {
      return MISSING_CONFIG_MESSAGE;
    }
    return "We couldn't sign you in right now. Please try again in a moment.";
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
    var env = global.__SR_ENV__ || {};
    return {
      url: String(env.SUPABASE_URL || "").trim(),
      anonKey: String(env.SUPABASE_ANON_KEY || "").trim(),
    };
  }

  function isEnvConfigured() {
    if (global.__SR_ENV_LOAD_ERROR__) return false;
    var env = readEnv();
    return Boolean(
      env.url &&
        env.anonKey &&
        env.url.indexOf("YOUR_PROJECT_REF") === -1 &&
        env.anonKey.indexOf("YOUR_SUPABASE_ANON_KEY") === -1
    );
  }

  function missingConfigError() {
    var err = new Error(MISSING_CONFIG_MESSAGE);
    err.code = global.__SR_ENV_LOAD_ERROR__ ? "ENV_LOAD_ERROR" : "ENV_MISSING";
    return err;
  }

  function getClient() {
    if (clientPromise) return clientPromise;

    clientPromise = Promise.resolve()
      .then(function () {
        if (!isEnvConfigured()) {
          log("public config missing");
          throw missingConfigError();
        }

        var env = readEnv();
        log("public config loaded", {
          host: String(env.url || "")
            .replace(/^https?:\/\//, "")
            .split("/")[0],
          keyKind:
            String(env.anonKey || "").indexOf("sb_publishable") === 0
              ? "sb_publishable"
              : String(env.anonKey || "").indexOf("eyJ") === 0
                ? "jwt-anon"
                : "other",
        });

        var createClient = getCreateClient();
        if (!createClient) {
          var sdkErr = new Error("Supabase library not loaded");
          sdkErr.code = "SDK_MISSING";
          throw sdkErr;
        }

        var client = createClient(env.url, env.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: "sr-admin-auth",
          },
        });
        log("Supabase client created");
        return client;
      })
      .catch(function (err) {
        clientPromise = null;
        throw err;
      });

    return clientPromise;
  }

  /**
   * Read session once from an existing client (no nested client/timeout wrappers).
   */
  function readSession(supabase) {
    log("getSession started");
    return supabase.auth.getSession().then(function (result) {
      log("getSession completed", {
        ok: !result.error,
        hasSession: !!(result.data && result.data.session),
        hasUser: !!(result.data && result.data.session && result.data.session.user),
      });
      if (result.error) throw result.error;
      return result.data.session || null;
    });
  }

  function getSession() {
    return getClient().then(function (supabase) {
      return withTimeout(
        readSession(supabase),
        ACCESS_CHECK_MS,
        "Checking your session timed out."
      );
    });
  }

  /**
   * Returns { ok, session, profile, reason }
   * Authorization is based on admin_users.active — not UI alone.
   */
  function verifyActiveAdmin() {
    return withTimeout(
      (async function () {
        var supabase = await getClient();
        var session = await readSession(supabase);

        if (!session || !session.user) {
          log("user not found");
          return { ok: false, session: null, profile: null, reason: "unauthenticated" };
        }

        log("user found", { idPrefix: String(session.user.id || "").slice(0, 8) });
        log("admin_users check started");

        var result = await supabase
          .from("admin_users")
          .select("user_id, role, active, created_at")
          .eq("user_id", session.user.id)
          .maybeSingle();

        var data = result.data;
        var error = result.error;

        log("admin_users check completed", {
          ok: !error,
          hasRow: !!data,
          active: !!(data && data.active),
          code: error && error.code ? error.code : null,
        });

        if (error) {
          var code = error.code || "";
          if (code === "42P01" || String(error.message || "").indexOf("does not exist") !== -1) {
            return {
              ok: false,
              session: session,
              profile: null,
              reason: "schema_missing",
              error: error,
            };
          }
          return {
            ok: false,
            session: session,
            profile: null,
            reason: "lookup_failed",
            error: error,
          };
        }

        if (!data) {
          return { ok: false, session: session, profile: null, reason: "not_admin" };
        }
        if (!data.active) {
          return { ok: false, session: session, profile: data, reason: "inactive" };
        }

        log("dashboard allowed");
        return { ok: true, session: session, profile: data, reason: null };
      })(),
      ACCESS_CHECK_MS,
      "Checking your access timed out."
    );
  }

  function signIn(email, password) {
    return getClient().then(function (supabase) {
      return withTimeout(
        supabase.auth.signInWithPassword({
          email: String(email || "").trim(),
          password: String(password || ""),
        }),
        ACCESS_CHECK_MS,
        "Sign-in timed out."
      ).then(function (result) {
        if (result.error) {
          var wrapped = new Error(friendlyAuthError(result.error));
          wrapped.cause = result.error;
          throw wrapped;
        }
        return verifyActiveAdmin().then(function (check) {
          if (!check.ok) {
            return supabase.auth.signOut().catch(function () {}).then(function () {
              var denied = new Error(denyMessage(check.reason));
              denied.code = check.reason;
              throw denied;
            });
          }
          return { session: result.data.session, profile: check.profile };
        });
      });
    });
  }

  function denyMessage(reason) {
    switch (reason) {
      case "not_admin":
      case "inactive":
        return "This account isn't set up for admin access. Ask your web helper to add you as an active admin.";
      case "schema_missing":
        return "Admin access isn't ready yet. The admin database table still needs to be created in Supabase.";
      case "lookup_failed":
        return "We signed you in, but couldn't verify admin access. Please try again or contact support.";
      case "timeout":
        return "Checking your access timed out. Please refresh and try again.";
      default:
        return "You don't have permission to open the admin area.";
    }
  }

  function signOut() {
    return getClient()
      .then(function (supabase) {
        return supabase.auth.signOut();
      })
      .catch(function () {
        /* still allow redirect */
      });
  }

  function go(path) {
    global.location.replace(path);
  }

  function setGateMessage(gateEl, message) {
    if (!gateEl) return;
    gateEl.hidden = false;
    gateEl.textContent = message;
    gateEl.dataset.resolved = "1";
  }

  /**
   * Call on /admin/index.html (and future protected pages).
   * Redirects unauthenticated users; blocks non-admins.
   * Never leaves "Checking your access…" forever.
   */
  function requireAdminPage(options) {
    var opts = options || {};
    var gateEl = document.getElementById(opts.gateId || "adminGate");

    return withTimeout(
      (async function () {
        if (!isEnvConfigured()) {
          log("requireAdminPage blocked — config missing");
          setGateMessage(gateEl, MISSING_CONFIG_MESSAGE);
          return null;
        }

        var check = await verifyActiveAdmin();

        if (check.reason === "unauthenticated") {
          log("redirect to login — no session");
          setGateMessage(gateEl, "Redirecting to sign in…");
          go(LOGIN_PATH);
          return null;
        }

        if (!check.ok) {
          log("redirect to login — denied", { reason: check.reason });
          await signOut();
          setGateMessage(gateEl, denyMessage(check.reason));
          go(LOGIN_PATH + "?denied=1");
          return null;
        }

        if (gateEl) {
          gateEl.hidden = true;
          gateEl.dataset.resolved = "1";
        }
        log("requireAdminPage complete — access granted");
        return check;
      })(),
      ACCESS_CHECK_MS + 2000,
      "Checking your access timed out."
    ).catch(function (err) {
      if (err && (err.code === "ENV_MISSING" || err.code === "ENV_LOAD_ERROR")) {
        setGateMessage(gateEl, MISSING_CONFIG_MESSAGE);
        return null;
      }

      if (err && err.code === "TIMEOUT") {
        log("requireAdminPage timed out");
        setGateMessage(
          gateEl,
          "Checking your access timed out. Please refresh the page or sign in again."
        );
        // Clear a potentially stuck/corrupt session so the next attempt can succeed.
        return signOut().then(function () {
          setTimeout(function () {
            go(LOGIN_PATH + "?expired=1");
          }, 1600);
          return null;
        });
      }

      log("requireAdminPage error", { code: err && err.code ? err.code : "unknown" });
      return signOut().then(function () {
        setGateMessage(gateEl, "Your session expired. Redirecting to sign in…");
        go(LOGIN_PATH + "?expired=1");
        return null;
      });
    });
  }

  function redirectIfAdminSession() {
    if (!isEnvConfigured()) return Promise.resolve(false);
    return withTimeout(verifyActiveAdmin(), ACCESS_CHECK_MS, "timed out")
      .then(function (check) {
        if (check.ok) {
          go(DASHBOARD_PATH);
          return true;
        }
        if (check.session && !check.ok) {
          return signOut().then(function () {
            return false;
          });
        }
        return false;
      })
      .catch(function () {
        return false;
      });
  }

  /**
   * Bind auth watcher AFTER the initial session/admin check finishes.
   * Registering onAuthStateChange before getSession() can deadlock supabase-js.
   */
  function watchAuth(onChange) {
    if (!isEnvConfigured()) return;
    if (authWatcherBound) return;
    authWatcherBound = true;

    getClient()
      .then(function (supabase) {
        supabase.auth.onAuthStateChange(function (event, session) {
          // Keep this callback synchronous — never await Supabase calls here.
          if (typeof onChange === "function") onChange(event, session);
          if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
            if (!global.location.pathname.endsWith("/login.html")) {
              go(LOGIN_PATH + (event === "SIGNED_OUT" ? "" : "?expired=1"));
            }
          }
        });
        log("auth watcher bound");
      })
      .catch(function () {
        authWatcherBound = false;
      });
  }

  global.SRAdminAuth = {
    LOGIN_PATH: LOGIN_PATH,
    DASHBOARD_PATH: DASHBOARD_PATH,
    MISSING_CONFIG_MESSAGE: MISSING_CONFIG_MESSAGE,
    getClient: getClient,
    getSession: getSession,
    isEnvConfigured: isEnvConfigured,
    verifyActiveAdmin: verifyActiveAdmin,
    signIn: signIn,
    signOut: signOut,
    requireAdminPage: requireAdminPage,
    redirectIfAdminSession: redirectIfAdminSession,
    watchAuth: watchAuth,
    friendlyAuthError: friendlyAuthError,
    denyMessage: denyMessage,
  };
})(typeof window !== "undefined" ? window : globalThis);
