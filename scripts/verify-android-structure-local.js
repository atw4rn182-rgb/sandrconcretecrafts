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
assert.match(manifest, /android:name="android.permission.ACCESS_FINE_LOCATION"/);
assert.match(manifest, /tools:node="replace"/);
assert.match(manifest, /android:name="android.permission.BLUETOOTH_CONNECT"/);
assert.match(manifest, /android:name="android.permission.BLUETOOTH_SCAN"/);
assert.doesNotMatch(manifest, /ACCESS_FINE_LOCATION[\s\S]{0,80}maxSdkVersion/);
assert.match(manifest, /cleartextTrafficPermitted="false"|usesCleartextTraffic="false"/);

var gradleApp = read("android/app/build.gradle.kts");
assert.match(gradleApp, /minSdk = 33/);
assert.match(gradleApp, /versionCode = 3/);
assert.match(gradleApp, /SIMULATED_READER/);

var tokenProvider = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/SrConnectionTokenProvider.kt"
);
assert.match(tokenProvider, /\/api\/admin\/terminal\/connection-token|fetchConnectionToken/);
assert.match(tokenProvider, /io\.execute/);
assert.doesNotMatch(tokenProvider, /tml_/);
assert.doesNotMatch(tokenProvider, /Log\.|println\(|sk_live_/);

var api = read("android/app/src/main/java/com/sandrconcretecrafts/pos/data/SrApi.kt");
assert.match(api, /\/api\/admin\/terminal\/connection-token/);
assert.match(api, /\/api\/admin\/terminal\/payment-intent/);
assert.match(api, /admin_users/);
assert.doesNotMatch(api, /STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(api, /tml_[A-Za-z0-9_]{6,}/);
assert.match(api, /refreshTerminalLocation/);

var controller = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/TerminalController.kt"
);
assert.match(controller, /Terminal\.init\(/);
assert.doesNotMatch(controller, /initTerminal/);
assert.match(controller, /TapToPayDiscoveryConfiguration/);
assert.match(controller, /isSimulated/);
assert.match(controller, /PublicConfig\.simulatedReader/);
assert.doesNotMatch(controller, /\|\|\s*debuggable/);
assert.match(controller, /processPaymentIntent/);
assert.match(controller, /safeDiagnostics/);
assert.match(controller, /refreshTerminalLocation|awaitLocationId/);
assert.match(controller, /isSimulated = useSimulatedReader/);
assert.doesNotMatch(controller, /tml_/);

var viewModel = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/CollectViewModel.kt"
);
assert.match(viewModel, /UiState\.Ready/);
assert.match(viewModel, /terminal\.connect/);
assert.doesNotMatch(viewModel, /createPaymentIntent/);
assert.doesNotMatch(viewModel, /collectExisting/);

var collect = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/CollectActivity.kt"
);
assert.match(collect, /TerminalPermissions\.missingRuntimePermissions/);
assert.match(collect, /checkSelfPermission|missingRuntimePermissions/);
assert.match(collect, /override fun onResume/);
assert.match(collect, /ACTION_APPLICATION_DETAILS_SETTINGS/);
assert.match(collect, /tap_ready_title|Tap to Pay Ready/);
assert.doesNotMatch(collect, /granted\.values\.all/);

var permissions = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/TerminalPermissions.kt"
);
assert.match(permissions, /ACCESS_FINE_LOCATION/);
assert.match(permissions, /BLUETOOTH_CONNECT/);
assert.match(permissions, /checkSelfPermission/);
assert.doesNotMatch(permissions, /client_secret|sk_live_|whsec_/);

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

var merged = path.join(
  root,
  "android",
  "app",
  "build",
  "intermediates",
  "merged_manifest",
  "debug",
  "processDebugMainManifest",
  "AndroidManifest.xml"
);
if (fs.existsSync(merged)) {
  var mergedXml = fs.readFileSync(merged, "utf8");
  assert.match(mergedXml, /android:name="android.permission.ACCESS_FINE_LOCATION"/);
  assert.doesNotMatch(
    mergedXml,
    /ACCESS_FINE_LOCATION"[\s\S]{0,80}maxSdkVersion/
  );
}

console.log("android companion structure, 5.8.1 SDK pair, and secret hygiene: ok");
