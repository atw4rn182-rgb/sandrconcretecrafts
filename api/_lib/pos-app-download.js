/**
 * Short-lived, single-purpose APK download tokens.
 * These are HMAC tickets, never the admin JWT and never server secrets.
 */
"use strict";

var crypto = require("crypto");

function env(name) {
  return String(process.env[name] || "").trim();
}

function downloadSecret() {
  var value = env("POS_APP_DOWNLOAD_SECRET") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!value) {
    var err = new Error("App download is not configured.");
    err.code = "POS_APP_DOWNLOAD_NOT_CONFIGURED";
    err.status = 503;
    throw err;
  }
  return value;
}

function mintDownloadToken(channel, ttlSec) {
  var exp = Math.floor(Date.now() / 1000) + (Number(ttlSec) > 0 ? Number(ttlSec) : 90);
  var body = Buffer.from(
    JSON.stringify({ v: 1, ch: String(channel || "test"), exp: exp }),
    "utf8"
  ).toString("base64url");
  var sig = crypto.createHmac("sha256", downloadSecret()).update(body).digest("base64url");
  return body + "." + sig;
}

function deny() {
  var err = new Error("This download link is invalid or expired.");
  err.code = "POS_APP_DOWNLOAD_DENIED";
  err.status = 401;
  return err;
}

function verifyDownloadToken(token) {
  var raw = String(token || "").trim();
  var parts = raw.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw deny();
  var expected = crypto.createHmac("sha256", downloadSecret()).update(parts[0]).digest("base64url");
  var left = Buffer.from(parts[1]);
  var right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw deny();
  var payload = null;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch (_err) {
    throw deny();
  }
  if (!payload || payload.v !== 1 || !payload.ch || payload.exp < Math.floor(Date.now() / 1000)) {
    throw deny();
  }
  return payload;
}

function readDownloadToken(req) {
  var query = req.query || {};
  if (query.t) return String(query.t);
  try {
    var url = new URL(req.url, "https://www.sandrconcretecrafts.com");
    var param = url.searchParams.get("t");
    if (param) return param;
  } catch (_err) {
    /* ignore */
  }
  var cookie = String((req.headers && req.headers.cookie) || "");
  var match = /(?:^|;\s*)sr_pos_apk=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : "";
}

function requestOrigin(req) {
  var proto = String((req.headers && req.headers["x-forwarded-proto"]) || "https")
    .split(",")[0]
    .trim();
  var host = String(
    (req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || ""
  )
    .split(",")[0]
    .trim();
  if (host) return proto + "://" + host;
  return (env("SITE_URL") || "https://www.sandrconcretecrafts.com").replace(/\/$/, "");
}

module.exports = {
  downloadSecret: downloadSecret,
  mintDownloadToken: mintDownloadToken,
  verifyDownloadToken: verifyDownloadToken,
  readDownloadToken: readDownloadToken,
  requestOrigin: requestOrigin,
};
