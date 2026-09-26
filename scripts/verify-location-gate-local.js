#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var GRANTED = 0;
var DENIED = -1;

function block(fineGranted, coarseGranted, servicesOn, alreadyRequested, rationaleFine) {
  if (fineGranted && !servicesOn) return "LOCATION_SERVICES_DISABLED";
  if (fineGranted) return "NONE";
  if (coarseGranted) return "FINE_DENIED_COARSE_GRANTED";
  if (alreadyRequested && !rationaleFine) return "FINE_DENIED_SETTINGS_REQUIRED";
  return "FINE_DENIED";
}

assert.strictEqual(block(true, true, true, false, false), "NONE");
assert.strictEqual(block(true, true, false, false, false), "LOCATION_SERVICES_DISABLED");
assert.strictEqual(block(false, true, true, true, true), "FINE_DENIED_COARSE_GRANTED");
assert.strictEqual(block(false, false, true, false, false), "FINE_DENIED");
assert.strictEqual(block(false, false, true, true, false), "FINE_DENIED_SETTINGS_REQUIRED");
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
assert.match(permissions, /FINE_DENIED_COARSE_GRANTED/);
assert.match(permissions, /LOCATION_SERVICES_DISABLED/);
assert.match(permissions, /FINE_DENIED_SETTINGS_REQUIRED/);
assert.match(permissions, /context\.checkSelfPermission\(finePermission\)/);
assert.match(permissions, /ContextCompat\.checkSelfPermission/);
assert.match(permissions, /shouldShowRequestPermissionRationale|rationaleFine/);
assert.match(permissions, /BUILD_ID/);
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
assert.match(setup, /requestedFineThisSession/);
assert.match(setup, /ACTION_LOCATION_SOURCE_SETTINGS/);
assert.match(setup, /ACTION_APPLICATION_DETAILS_SETTINGS/);
assert.match(setup, /BLOCKED STAGE/);

var controller = fs.readFileSync(
  path.join(
    root,
    "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/TerminalController.kt"
  ),
  "utf8"
);
assert.match(controller, /TERMINAL_MODE_MISMATCH/);

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

console.log("location gate approximate/precise/services states: ok");
