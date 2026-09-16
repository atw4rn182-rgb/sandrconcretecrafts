#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var posApp = require("../api/_lib/pos-app");

var previous = process.env.SR_POS_APP_CHANNEL;
process.env.SR_POS_APP_CHANNEL = "test";
var testManifest = posApp.currentManifest();
assert.strictEqual(testManifest.simulated, true);
assert.strictEqual(testManifest.channel, "test");
assert.match(testManifest.label, /TEST VERSION — Simulated payments only/);
assert.match(posApp.currentManifest().filename, /TEST\.apk$/);
assert.match(posApp.testFallbackUrl(), /staff-pos-test/);

process.env.SR_POS_APP_CHANNEL = "production";
var liveManifest = posApp.currentManifest();
assert.strictEqual(liveManifest.simulated, false);
assert.strictEqual(liveManifest.channel, "production");
assert.match(liveManifest.label, /Production — Real Tap to Pay/);
assert.doesNotMatch(liveManifest.filename, /TEST/);

process.env.SR_POS_APP_CHANNEL = "nope";
assert.strictEqual(posApp.currentManifest().channel, "test");

if (previous == null) delete process.env.SR_POS_APP_CHANNEL;
else process.env.SR_POS_APP_CHANNEL = previous;

var route = fs.readFileSync(
  path.join(__dirname, "..", "api", "admin", "pos-app.js"),
  "utf8"
);
assert.match(route, /auth\.requireActiveAdmin\(req\)/);
assert.match(route, /wantsDownload/);
assert.doesNotMatch(route, /sk_live_|sk_test_|whsec_|SERVICE_ROLE/);

var apk = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
if (fs.existsSync(apk)) {
  var fd = fs.openSync(apk, "r");
  var magic = Buffer.alloc(2);
  fs.readSync(fd, magic, 0, 2, 0);
  fs.closeSync(fd);
  assert.strictEqual(magic.toString("utf8"), "PK");
}

var buildConfig = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "build",
  "generated",
  "source",
  "buildConfig",
  "debug",
  "com",
  "sandrconcretecrafts",
  "pos",
  "BuildConfig.java"
);
if (fs.existsSync(buildConfig)) {
  var text = fs.readFileSync(buildConfig, "utf8");
  assert.match(text, /SIMULATED_READER = true/);
  assert.match(text, /API_BASE_URL = "https:\/\/www\.sandrconcretecrafts\.com"/);
  assert.doesNotMatch(text, /sk_live_|sk_test_|whsec_|SERVICE_ROLE/);
}

console.log("staff Tap to Pay APK installer contract: ok");
