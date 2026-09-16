/**
 * GET /api/admin/pos-app
 * Authenticated staff metadata for the Tap-to-Pay companion.
 * GET /api/admin/pos-app?download=1 also returns a short-lived signed APK URL.
 * Never streams the APK through this function and never returns server secrets.
 */
"use strict";

var auth = require("../_lib/admin-auth");
var db = require("../_lib/supabase-admin");
var api = require("../_lib/api-response");
var posApp = require("../_lib/pos-app");

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

async function resolveDownloadUrl(manifest) {
  try {
    return await db.createSignedStorageUrl(
      manifest.bucket,
      manifest.object,
      120,
      manifest.filename
    );
  } catch (err) {
    if (!manifest.simulated) throw err;
    var fallback = posApp.testFallbackUrl();
    if (!fallback) throw err;
    return fallback;
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
      payload.download_url = await resolveDownloadUrl(manifest);
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
