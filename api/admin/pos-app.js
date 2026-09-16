/**
 * GET /api/admin/pos-app
 * Authenticated staff metadata for the Tap-to-Pay companion.
 * GET /api/admin/pos-app?download=1 mints a short-lived same-origin APK URL.
 * Never streams the APK through this function and never returns server secrets
 * or the admin JWT in the download URL.
 */
"use strict";

var auth = require("../_lib/admin-auth");
var api = require("../_lib/api-response");
var posApp = require("../_lib/pos-app");
var tickets = require("../_lib/pos-app-download");

function wantsDownload(req) {
  var query = req.query || {};
  var flag = query.download;
  if (flag === "1" || flag === "true") return true;
  try {
    var url = new URL(req.url, "https://www.sandrconcretecrafts.com");
    var param = url.searchParams.get("download");
    return param === "1" || param === "true";
  } catch (_err) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    api.sendJson(res, 405, { error: "Method not allowed." });
    return;
  }
  try {
    await auth.requireActiveAdmin(req);
    var manifest = posApp.currentManifest();
    var payload = {
      channel: manifest.channel,
      simulated: manifest.simulated,
      label: manifest.label,
      filename: manifest.filename,
      package: manifest.packageName,
      version_name: manifest.versionName,
    };
    if (wantsDownload(req)) {
      var token = tickets.mintDownloadToken(manifest.channel, 90);
      payload.download_url =
        tickets.requestOrigin(req) +
        "/api/admin/pos-app-file?t=" +
        encodeURIComponent(token);
      res.setHeader(
        "Set-Cookie",
        "sr_pos_apk=" +
          encodeURIComponent(token) +
          "; Max-Age=90; Path=/api/admin/pos-app-file; HttpOnly; Secure; SameSite=Lax"
      );
    }
    api.sendJson(res, 200, payload);
  } catch (err) {
    var status = api.errorStatus(err);
    console.error("[admin/pos-app]", {
      code: err && err.code,
      status: status,
      message: err && err.message,
    });
    api.sendJson(res, status, {
      error:
        status < 500 && err && err.message
          ? err.message
          : "Couldn’t prepare the S&R Tap to Pay app download.",
      code: (err && err.code) || "POS_APP_ERROR",
    });
  }
};
