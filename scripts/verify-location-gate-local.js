#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var GRANTED = 0;
var DENIED = -1;

function block(fineGranted, coarseGranted, servicesOn, alreadyRequested, rationaleLocation) {
  var granted = coarseGranted || fineGranted;
  if (granted && !servicesOn) return "LOCATION_SERVICES_DISABLED";
  if (granted) return "NONE";
  if (alreadyRequested && !rationaleLocation) return "LOCATION_SETTINGS_REQUIRED";
  return "LOCATION_DENIED";
}

function requirement(fineGranted, coarseGranted) {
  return coarseGranted || fineGranted ? "SATISFIED" : "NOT SATISFIED";
}

function level(fineGranted, coarseGranted) {
  if (fineGranted) return "PRECISE";
  if (coarseGranted) return "APPROXIMATE";
  return "NONE";
}

// A. Coarse GRANTED / Fine DENIED — Stripe 5.8.1 SATISFIED
assert.strictEqual(block(false, true, true, true, true), "NONE");
assert.strictEqual(requirement(false, true), "SATISFIED");
assert.strictEqual(level(false, true), "APPROXIMATE");

// B. Fine GRANTED
assert.strictEqual(block(true, true, true, false, false), "NONE");
assert.strictEqual(requirement(true, false), "SATISFIED");
assert.strictEqual(level(true, false), "PRECISE");

// C. Neither granted
assert.strictEqual(block(false, false, true, false, false), "LOCATION_DENIED");
assert.strictEqual(requirement(false, false), "NOT SATISFIED");

// D. Permission satisfied, Location Services OFF
assert.strictEqual(block(false, true, false, false, false), "LOCATION_SERVICES_DISABLED");
assert.strictEqual(block(true, true, false, false, false), "LOCATION_SERVICES_DISABLED");

// E. Location + services ON → proceed
assert.strictEqual(block(false, true, true, false, false), "NONE");

// K. no permission-request loop after permanent deny
assert.strictEqual(block(false, false, true, true, false), "LOCATION_SETTINGS_REQUIRED");
assert.notStrictEqual(GRANTED, DENIED);

var root = path.join(__dirname, "..");
var permissions = fs.readFileSync(
  path.join(root, "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/TerminalPermissions.kt"),
  "utf8"
);
var collect = fs.readFileSync(
  path.join(root, "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/CollectActivity.kt"),
  "utf8"
);

assert.match(permissions, /fun evaluate\(/);
assert.match(permissions, /locationGranted/);
assert.match(permissions, /coarseGranted \|\| fineGranted/);
assert.match(permissions, /LOCATION_SERVICES_DISABLED/);
assert.match(permissions, /LOCATION_SETTINGS_REQUIRED/);
assert.match(permissions, /STRIPE_SDK_VERSION = "5\.8\.1"/);
assert.match(permissions, /Location requirement result/);
assert.match(permissions, /Location permission level/);
assert.match(permissions, /SOURCE: APP PERMISSION GATE/);
assert.doesNotMatch(permissions, /FINE_DENIED_COARSE_GRANTED/);
assert.doesNotMatch(permissions, /Precise Location is required/);
assert.doesNotMatch(permissions, /Location permission is required for Stripe Terminal/);

assert.match(collect, /TerminalPermissions\.evaluate/);
assert.match(collect, /override fun onResume/);
assert.match(collect, /SetupActivity/);
assert.doesNotMatch(collect, /missingRuntimePermissions/);
assert.doesNotMatch(collect, /Location permission is required for Stripe Terminal/);
assert.doesNotMatch(collect, /permission\.launch\(missing\)/);

var setup = fs.readFileSync(
  path.join(root, "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/SetupActivity.kt"),
  "utf8"
);
assert.match(setup, /requestedLocationThisSession/);
assert.match(setup, /ACTION_LOCATION_SOURCE_SETTINGS/);
assert.match(setup, /ACTION_APPLICATION_DETAILS_SETTINGS/);
assert.match(setup, /BLOCKED STAGE/);
assert.doesNotMatch(setup, /REQUEST_FINE_LOCATION/);

var controller = fs.readFileSync(
  path.join(
    root,
    "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/TerminalController.kt"
  ),
  "utf8"
);
assert.match(controller, /TERMINAL_MODE_MISMATCH/);
assert.match(controller, /SOURCE: STRIPE SDK/);
assert.match(controller, /SOURCE: APP TERMINAL MODE GATE/);
assert.match(controller, /Stripe error code/);
assert.match(controller, /Stripe SDK version/);

var sale = fs.readFileSync(
  path.join(root, "android/app/src/main/java/com/sandrconcretecrafts/pos/data/SalePayload.kt"),
  "utf8"
);
assert.match(sale, /amount_total_cents/);
assert.doesNotMatch(sale, /unit_amount_cents/);

assert.doesNotMatch(
  fs.readFileSync(path.join(root, "api/admin/cash-sales.js"), "utf8"),
  /sandrpos|ACCESS_FINE_LOCATION/
);
assert.doesNotMatch(
  fs.readFileSync(path.join(root, "api/create-checkout-session.js"), "utf8"),
  /sandrpos|STRIPE_TERMINAL_SECRET_KEY/
);
assert.doesNotMatch(
  fs.readFileSync(path.join(root, "api/stripe-webhook.js"), "utf8"),
  /sandrpos|STRIPE_TERMINAL_SECRET_KEY/
);

console.log("location gate Stripe 5.8.1 coarse-or-fine states: ok");
