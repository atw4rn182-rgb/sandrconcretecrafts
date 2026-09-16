#!/usr/bin/env node
/**
 * Upload a staff Tap-to-Pay APK into the private sr-staff-pos-app bucket.
 * Usage:
 *   node scripts/upload-staff-pos-apk.js --channel test --file path/to/app-debug.apk
 * Later, replace the flea-market build with:
 *   node scripts/upload-staff-pos-apk.js --channel production --file path/to/app-release.apk
 *   then set SR_POS_APP_CHANNEL=production on Vercel.
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment.
 * Never prints those values.
 */
"use strict";

var fs = require("fs");
var path = require("path");
var posApp = require("../api/_lib/pos-app");

function arg(name, fallback) {
  var idx = process.argv.indexOf("--" + name);
  if (idx === -1 || !process.argv[idx + 1]) return fallback;
  return process.argv[idx + 1];
}

function env(name) {
  return String(process.env[name] || "").trim();
}

function loadEnvFile(rel) {
  var full = path.join(__dirname, "..", rel);
  if (!fs.existsSync(full)) return;
  fs.readFileSync(full, "utf8")
    .split(/\r?\n/)
    .forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed || trimmed.charAt(0) === "#") return;
      var eq = trimmed.indexOf("=");
      if (eq < 1) return;
      var key = trimmed.slice(0, eq).trim();
      var value = trimmed.slice(eq + 1).trim();
      if (
        (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
        (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    });
}

[".env.local", ".env", ".env.vercel.tmp"].forEach(loadEnvFile);

async function main() {
  var channel = String(arg("channel", "test")).trim().toLowerCase();
  if (!posApp.CHANNELS[channel]) {
    throw new Error("Channel must be test or production.");
  }
  var file = arg(
    "file",
    path.join(
      __dirname,
      "..",
      "android",
      "app",
      "build",
      "outputs",
      "apk",
      "debug",
      "app-debug.apk"
    )
  );
  if (channel === "test" && /release/i.test(file)) {
    throw new Error("Refusing to upload a release APK to the test channel.");
  }
  if (channel === "production" && /debug/i.test(file)) {
    throw new Error("Refusing to upload a debug APK to the production channel.");
  }
  var url = env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
  var key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  url = url.replace(/\/$/, "");
  if (!fs.existsSync(file)) throw new Error("APK not found: " + file);
  var buf = fs.readFileSync(file);
  if (buf.length < 1000000) throw new Error("APK is unexpectedly small.");
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("File is not a zip/APK.");
  }

  var bucket = posApp.BUCKET;
  var objectPath = posApp.CHANNELS[channel].object;
  var headers = {
    apikey: key,
    Authorization: "Bearer " + key,
  };

  var bucketRes = await fetch(url + "/storage/v1/bucket", {
    method: "POST",
    headers: Object.assign({}, headers, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: false,
      fileSizeLimit: 157286400,
      allowedMimeTypes: [
        "application/vnd.android.package-archive",
        "application/octet-stream",
      ],
    }),
  });
  if (!bucketRes.ok && bucketRes.status !== 409) {
    throw new Error("Could not create bucket (" + bucketRes.status + ").");
  }

  var uploadRes = await fetch(
    url +
      "/storage/v1/object/" +
      encodeURIComponent(bucket) +
      "/" +
      objectPath
        .split("/")
        .map(encodeURIComponent)
        .join("/"),
    {
      method: "POST",
      headers: Object.assign({}, headers, {
        "Content-Type": "application/vnd.android.package-archive",
        "x-upsert": "true",
      }),
      body: buf,
    }
  );
  if (!uploadRes.ok) {
    throw new Error("Upload failed (" + uploadRes.status + ").");
  }

  console.log("uploaded channel=" + channel);
  console.log("bucket=" + bucket);
  console.log("object=" + objectPath);
  console.log("bytes=" + buf.length);
  console.log("simulated=" + String(posApp.CHANNELS[channel].simulated));
  console.log("label=" + posApp.CHANNELS[channel].label);
}

main().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
