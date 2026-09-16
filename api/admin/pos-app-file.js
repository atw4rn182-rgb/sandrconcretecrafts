/**
 * GET /api/admin/pos-app-file?t=...
 * Chrome can download this URL without a Bearer header.
 * The token is a short-lived HMAC ticket minted after admin authentication.
 */
"use strict";

var db = require("../_lib/supabase-admin");
var api = require("../_lib/api-response");
var posApp = require("../_lib/pos-app");
var tickets = require("../_lib/pos-app-download");

function apkHeaders(res, filename) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="' + filename.replace(/"/g, "") + '"'
  );
}

async function apkLocation(manifest) {
  try {
    return await db.createSignedStorageUrl(
      manifest.bucket,
      manifest.object,
      90,
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
    var payload = tickets.verifyDownloadToken(tickets.readDownloadToken(req));
    var manifest = posApp.currentManifest();
    if (payload.ch !== manifest.channel) {
      var mismatch = new Error("This download link is invalid or expired.");
      mismatch.code = "POS_APP_DOWNLOAD_DENIED";
      mismatch.status = 401;
      throw mismatch;
    }
    var location = await apkLocation(manifest);
    apkHeaders(res, manifest.filename);
    res.statusCode = 302;
    res.setHeader("Location", location);
    res.end();
  } catch (err) {
    var status = api.errorStatus(err);
    api.sendJson(res, status, {
      error:
        status < 500 && err && err.message
          ? err.message
          : "Couldn’t download the S&R Tap to Pay app.",
      code: (err && err.code) || "POS_APP_ERROR",
    });
  }
};
