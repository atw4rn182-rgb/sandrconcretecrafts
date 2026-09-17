/**
 * Staff Tap-to-Pay APK channels. The APK bytes live in a private Storage
 * bucket; this file is only public metadata (no secrets).
 *
 * Switch the admin installer later with SR_POS_APP_CHANNEL=production after
 * uploading the real-reader signed APK to production/app-release.apk.
 */
"use strict";

var PACKAGE_NAME = "com.sandrconcretecrafts.pos";
var BUCKET = "sr-staff-pos-app";

var CHANNELS = {
  test: {
    object: "test/app-debug.apk",
    simulated: true,
    label: "TEST VERSION — Simulated payments only",
    filename: "S-and-R-Tap-to-Pay-TEST.apk",
    versionName: "0.1.2-test",
  },
  production: {
    object: "production/app-release.apk",
    simulated: false,
    label: "Production — Real Tap to Pay",
    filename: "S-and-R-Tap-to-Pay.apk",
    versionName: "0.1.0",
  },
};

function currentChannelName() {
  var raw = String(process.env.SR_POS_APP_CHANNEL || "test")
    .trim()
    .toLowerCase();
  return CHANNELS[raw] ? raw : "test";
}

function currentManifest() {
  var name = currentChannelName();
  return Object.assign(
    {
      channel: name,
      bucket: BUCKET,
      packageName: PACKAGE_NAME,
    },
    CHANNELS[name]
  );
}

function testFallbackUrl() {
  var fromEnv = String(process.env.SR_POS_APP_TEST_URL || "").trim();
  if (fromEnv) return fromEnv;
  return (
    "https://github.com/atw4rn182-rgb/sandrconcretecrafts/releases/download/staff-pos-test/" +
    CHANNELS.test.filename
  );
}

module.exports = {
  BUCKET: BUCKET,
  CHANNELS: CHANNELS,
  PACKAGE_NAME: PACKAGE_NAME,
  currentChannelName: currentChannelName,
  currentManifest: currentManifest,
  testFallbackUrl: testFallbackUrl,
};
