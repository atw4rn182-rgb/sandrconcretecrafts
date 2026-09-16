/**
 * Verifies an admin's Supabase bearer token without ever sending the service
 * role key to the caller. Authentication and the active-admin lookup both run
 * with the public anon key plus the caller's own JWT/RLS context.
 */
"use strict";

function env(name) {
  return String(process.env[name] || "").trim();
}

function publicConfig() {
  var url =
    env("SUPABASE_URL") ||
    env("NEXT_PUBLIC_SUPABASE_URL") ||
    env("PUBLIC_SUPABASE_URL");
  var anonKey =
    env("SUPABASE_ANON_KEY") ||
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    env("PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    var err = new Error("Supabase admin authentication is not configured.");
    err.code = "ADMIN_AUTH_NOT_CONFIGURED";
    throw err;
  }
  return { url: url.replace(/\/$/, ""), anonKey: anonKey };
}

function bearerToken(req) {
  var header = String((req.headers && req.headers.authorization) || "").trim();
  var match = /^Bearer\s+([^\s]+)$/i.exec(header);
  if (!match || match[1].length < 20 || match[1].length > 8192) {
    var err = new Error("A valid admin bearer token is required.");
    err.code = "ADMIN_AUTH_REQUIRED";
    err.status = 401;
    throw err;
  }
  return match[1];
}

async function fetchJson(url, headers) {
  var res = await fetch(url, { method: "GET", headers: headers });
  var data = await res.json().catch(function () {
    return null;
  });
  if (!res.ok) {
    var err = new Error("Admin authentication failed.");
    err.code = res.status === 401 ? "ADMIN_AUTH_REQUIRED" : "ADMIN_AUTH_ERROR";
    err.status = res.status === 401 ? 401 : 502;
    throw err;
  }
  return data;
}

async function requireActiveAdmin(req) {
  var token = bearerToken(req);
  var cfg = publicConfig();
  var headers = {
    apikey: cfg.anonKey,
    Authorization: "Bearer " + token,
    Accept: "application/json",
  };
  var user = await fetchJson(cfg.url + "/auth/v1/user", headers);
  var id = user && String(user.id || "").trim();
  if (!id) {
    var missing = new Error("Admin authentication failed.");
    missing.code = "ADMIN_AUTH_REQUIRED";
    missing.status = 401;
    throw missing;
  }

  var query = new URLSearchParams({
    user_id: "eq." + id,
    active: "eq.true",
    select: "user_id,role,active",
    limit: "1",
  });
  var rows = await fetchJson(
    cfg.url + "/rest/v1/admin_users?" + query.toString(),
    headers
  );
  var admin = Array.isArray(rows) ? rows[0] : null;
  if (!admin || admin.active !== true || admin.user_id !== id) {
    var forbidden = new Error("Active admin access is required.");
    forbidden.code = "ADMIN_FORBIDDEN";
    forbidden.status = 403;
    throw forbidden;
  }
  return { id: id, role: admin.role, token: token };
}

module.exports = {
  bearerToken: bearerToken,
  requireActiveAdmin: requireActiveAdmin,
};
