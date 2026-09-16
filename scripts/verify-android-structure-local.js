#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function walk(dir, files) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === "build" || entry.name === ".gradle") return;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  });
}

var gradle = read("android/app/build.gradle.kts");
assert.match(gradle, /com\.stripe:stripeterminal-taptopay:5\.8\.1/);
assert.match(gradle, /com\.stripe:stripeterminal-core:5\.8\.1/);
assert.doesNotMatch(gradle, /sk_live_|sk_test_|STRIPE_SECRET_KEY|SERVICE_ROLE|whsec_/);

var manifest = read("android/app/src/main/AndroidManifest.xml");
assert.match(manifest, /android:scheme="sandrpos"/);
assert.match(manifest, /android:host="collect"/);
assert.match(manifest, /android:name="android.permission.NFC"/);
assert.match(manifest, /cleartextTrafficPermitted="false"|usesCleartextTraffic="false"/);

var gradleApp = read("android/app/build.gradle.kts");
assert.match(gradleApp, /minSdk = 33/);
assert.match(gradleApp, /SIMULATED_READER/);

var tokenProvider = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/SrConnectionTokenProvider.kt"
);
assert.match(tokenProvider, /\/api\/admin\/terminal\/connection-token|fetchConnectionToken/);
assert.doesNotMatch(tokenProvider, /tml_/);

var api = read("android/app/src/main/java/com/sandrconcretecrafts/pos/data/SrApi.kt");
assert.match(api, /\/api\/admin\/terminal\/connection-token/);
assert.match(api, /\/api\/admin\/terminal\/payment-intent/);
assert.match(api, /admin_users/);
assert.doesNotMatch(api, /STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(api, /tml_[A-Za-z0-9_]{6,}/);

var controller = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/TerminalController.kt"
);
assert.match(controller, /Terminal\.init\(/);
assert.doesNotMatch(controller, /initTerminal/);
assert.match(controller, /TapToPayDiscoveryConfiguration/);
assert.match(controller, /isSimulated/);
assert.match(controller, /processPaymentIntent/);
assert.doesNotMatch(controller, /tml_/);

var files = [];
walk(path.join(root, "android"), files);
var forbidden = [
  "sk_live_",
  "sk_test_",
  "rk_live_",
  "whsec_",
  "SERVICE_ROLE",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
];
files.forEach(function (file) {
  if (!/\.(kt|kts|xml|properties|pro)$/.test(file)) return;
  var text = fs.readFileSync(file, "utf8");
  forbidden.forEach(function (needle) {
    assert.doesNotMatch(
      text,
      new RegExp(needle),
      path.relative(root, file) + " must not contain " + needle
    );
  });
});

assert.doesNotMatch(read("api/create-checkout-session.js"), /sandrpos/);
console.log("android companion structure, 5.8.1 SDK pair, and secret hygiene: ok");
