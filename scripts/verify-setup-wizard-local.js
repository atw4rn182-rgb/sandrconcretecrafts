#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

function locationBlock(fineGranted, coarseGranted, servicesOn, alreadyRequested, rationaleLocation) {
  var granted = coarseGranted || fineGranted;
  if (granted && !servicesOn) return "LOCATION_SERVICES_DISABLED";
  if (granted) return "NONE";
  if (alreadyRequested && !rationaleLocation) return "LOCATION_SETTINGS_REQUIRED";
  return "LOCATION_DENIED";
}

function setupScreen(input) {
  if (!input.welcomeSeen) return "WELCOME";
  if (input.sdkInt < (input.minSdk || 33)) return "ANDROID_UNSUPPORTED";
  if (!input.nfcAvailable) return "NFC_UNAVAILABLE";
  if (!input.nfcEnabled) return "NFC_OFF";
  var loc = locationBlock(
    input.fineGranted,
    input.coarseGranted,
    input.servicesOn,
    input.alreadyRequestedLocation,
    input.rationaleLocation
  );
  if (loc === "LOCATION_DENIED") return "LOCATION_PERMISSION";
  if (loc === "LOCATION_SETTINGS_REQUIRED") return "LOCATION_SETTINGS";
  if (loc === "LOCATION_SERVICES_DISABLED") return "LOCATION_SERVICES";
  if (input.terminal === "MODE_MISMATCH") return "TERMINAL_MODE_MISMATCH";
  if (input.terminal === "FAILED") return "TERMINAL_FAILED";
  if (input.terminal === "READY") return "READY";
  if (input.terminal === "CONNECTING") return "TERMINAL_CONNECT";
  if (input.completedOnce) return "SKIP";
  if (!input.signedIn) return "SIGN_IN";
  return "TERMINAL_CONNECT";
}

function base(over) {
  return Object.assign(
    {
      welcomeSeen: true,
      completedOnce: false,
      sdkInt: 34,
      minSdk: 33,
      nfcAvailable: true,
      nfcEnabled: true,
      fineGranted: false,
      coarseGranted: false,
      servicesOn: true,
      alreadyRequestedLocation: false,
      rationaleLocation: false,
      signedIn: true,
      terminal: "IDLE",
    },
    over
  );
}

assert.strictEqual(setupScreen(base({ welcomeSeen: false })), "WELCOME");
assert.strictEqual(setupScreen(base()), "LOCATION_PERMISSION");

// Fine granted → Terminal
assert.strictEqual(
  setupScreen(base({ fineGranted: true, coarseGranted: true })),
  "TERMINAL_CONNECT"
);

// A/C. Coarse granted + Fine denied → proceed, do not demand Precise
assert.strictEqual(
  setupScreen(base({ coarseGranted: true, alreadyRequestedLocation: true, rationaleLocation: true })),
  "TERMINAL_CONNECT"
);

// Permanent deny only when neither granted
assert.strictEqual(
  setupScreen(base({ alreadyRequestedLocation: true, rationaleLocation: false })),
  "LOCATION_SETTINGS"
);

assert.strictEqual(
  setupScreen(base({ fineGranted: true, servicesOn: false })),
  "LOCATION_SERVICES"
);
assert.strictEqual(
  setupScreen(base({ coarseGranted: true, servicesOn: false })),
  "LOCATION_SERVICES"
);

assert.strictEqual(setupScreen(base({ nfcEnabled: false })), "NFC_OFF");
assert.strictEqual(setupScreen(base({ nfcAvailable: false, nfcEnabled: false })), "NFC_UNAVAILABLE");

assert.strictEqual(
  setupScreen(
    base({
      completedOnce: true,
      coarseGranted: true,
      terminal: "IDLE",
    })
  ),
  "SKIP"
);

assert.strictEqual(
  setupScreen(base({ completedOnce: true, fineGranted: false, coarseGranted: false })),
  "LOCATION_PERMISSION"
);

assert.strictEqual(
  setupScreen(
    base({
      completedOnce: true,
      coarseGranted: true,
      alreadyRequestedLocation: true,
    })
  ),
  "SKIP"
);

assert.strictEqual(
  setupScreen(base({ coarseGranted: true, terminal: "MODE_MISMATCH" })),
  "TERMINAL_MODE_MISMATCH"
);

assert.strictEqual(
  setupScreen(base({ coarseGranted: true, signedIn: true, terminal: "IDLE" })),
  "TERMINAL_CONNECT"
);
assert.strictEqual(
  setupScreen(base({ coarseGranted: true, terminal: "READY" })),
  "READY"
);

assert.notStrictEqual(
  setupScreen(base({ alreadyRequestedLocation: true, rationaleLocation: false })),
  "LOCATION_PERMISSION"
);

var root = path.join(__dirname, "..");
var gate = fs.readFileSync(
  path.join(root, "android/app/src/main/java/com/sandrconcretecrafts/pos/setup/SetupGate.kt"),
  "utf8"
);
var setup = fs.readFileSync(
  path.join(root, "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/SetupActivity.kt"),
  "utf8"
);
var collect = fs.readFileSync(
  path.join(root, "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/CollectActivity.kt"),
  "utf8"
);

assert.match(gate, /enum class Screen/);
assert.match(gate, /LOCATION_PERMISSION/);
assert.match(gate, /LOCATION_SETTINGS/);
assert.match(gate, /NFC_UNAVAILABLE/);
assert.match(gate, /TERMINAL_MODE_MISMATCH/);
assert.match(gate, /fun evaluate\(/);
assert.match(gate, /coarseGranted \|\| fineGranted/);
assert.match(gate, /Approximate Location is enough/);
assert.doesNotMatch(gate, /Precise Location is required/);
assert.doesNotMatch(gate, /Location permission is required for Stripe Terminal/);
assert.doesNotMatch(gate, /LOCATION_APPROXIMATE/);
assert.doesNotMatch(gate, /BLUETOOTH_SCAN|Nearby Devices/);

assert.match(setup, /SetupGate\.evaluate/);
assert.match(setup, /evaluateAndTrace/);
assert.match(setup, /RequestMultiplePermissions/);
assert.match(setup, /ACTION_NFC_SETTINGS/);
assert.match(setup, /ACTION_LOCATION_SOURCE_SETTINGS/);
assert.match(setup, /override fun onResume/);
assert.match(setup, /requestedLocationThisSession/);
assert.match(setup, /test_diagnostics|TEST Diagnostics/);
assert.doesNotMatch(setup, /permission\.launch\(missing\)/);

assert.match(collect, /TerminalPermissions\.evaluateAndTrace/);
assert.match(collect, /needsDeviceRepair/);
assert.match(collect, /SetupActivity/);
assert.match(collect, /override fun onResume/);
assert.doesNotMatch(collect, /Location permission is required for Stripe Terminal/);
assert.doesNotMatch(collect, /permission\.launch/);

assert.match(
  fs.readFileSync(
    path.join(root, "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/TerminalController.kt"),
    "utf8"
  ),
  /TERMINAL_MODE_MISMATCH/
);
assert.match(
  fs.readFileSync(
    path.join(root, "android/app/src/main/java/com/sandrconcretecrafts/pos/data/SalePayload.kt"),
    "utf8"
  ),
  /amount_total_cents/
);
assert.doesNotMatch(
  fs.readFileSync(path.join(root, "api/admin/cash-sales.js"), "utf8"),
  /sandrpos|ACCESS_FINE_LOCATION|SetupGate/
);
assert.doesNotMatch(
  fs.readFileSync(path.join(root, "api/create-checkout-session.js"), "utf8"),
  /sandrpos|STRIPE_TERMINAL_SECRET_KEY|SetupGate/
);

console.log("setup wizard Stripe 5.8.1 coarse-or-fine state machine: ok");
