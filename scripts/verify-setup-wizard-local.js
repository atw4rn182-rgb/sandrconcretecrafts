#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

function locationBlock(fineGranted, coarseGranted, servicesOn, alreadyRequested, rationaleFine) {
  if (fineGranted && !servicesOn) return "LOCATION_SERVICES_DISABLED";
  if (fineGranted) return "NONE";
  if (coarseGranted) return "FINE_DENIED_COARSE_GRANTED";
  if (alreadyRequested && !rationaleFine) return "FINE_DENIED_SETTINGS_REQUIRED";
  return "FINE_DENIED";
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
    input.alreadyRequestedFine,
    input.rationaleFine
  );
  if (loc === "FINE_DENIED") return "LOCATION_PRECISE";
  if (loc === "FINE_DENIED_COARSE_GRANTED") return "LOCATION_APPROXIMATE";
  if (loc === "FINE_DENIED_SETTINGS_REQUIRED") return "LOCATION_SETTINGS";
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
      alreadyRequestedFine: false,
      rationaleFine: false,
      signedIn: true,
      terminal: "IDLE",
    },
    over
  );
}

// A. Fresh install / no Location permission
assert.strictEqual(setupScreen(base({ welcomeSeen: false })), "WELCOME");
assert.strictEqual(setupScreen(base()), "LOCATION_PRECISE");

// B. Fine Location granted → continue toward Terminal
assert.strictEqual(
  setupScreen(base({ fineGranted: true, coarseGranted: true })),
  "TERMINAL_CONNECT"
);

// C. Coarse granted but Fine denied
assert.strictEqual(
  setupScreen(base({ coarseGranted: true, alreadyRequestedFine: true, rationaleFine: true })),
  "LOCATION_APPROXIMATE"
);

// D. Permission permanently denied
assert.strictEqual(
  setupScreen(base({ alreadyRequestedFine: true, rationaleFine: false })),
  "LOCATION_SETTINGS"
);

// E. Location Services off
assert.strictEqual(
  setupScreen(base({ fineGranted: true, servicesOn: false })),
  "LOCATION_SERVICES"
);

// F. NFC off
assert.strictEqual(setupScreen(base({ nfcEnabled: false })), "NFC_OFF");

// G. NFC unavailable
assert.strictEqual(setupScreen(base({ nfcAvailable: false, nfcEnabled: false })), "NFC_UNAVAILABLE");

// H. All requirements satisfied after first setup
assert.strictEqual(
  setupScreen(
    base({
      completedOnce: true,
      fineGranted: true,
      coarseGranted: true,
      terminal: "IDLE",
    })
  ),
  "SKIP"
);

// I. Permission revoked after previous successful setup
assert.strictEqual(
  setupScreen(base({ completedOnce: true, fineGranted: false, coarseGranted: false })),
  "LOCATION_PRECISE"
);

// J. Returning from Settings is modeled as a fresh evaluate, not a restart
assert.strictEqual(
  setupScreen(
    base({
      completedOnce: true,
      fineGranted: true,
      coarseGranted: true,
      alreadyRequestedFine: true,
    })
  ),
  "SKIP"
);

// K. TEST Terminal backend mismatch
assert.strictEqual(
  setupScreen(base({ fineGranted: true, terminal: "MODE_MISMATCH" })),
  "TERMINAL_MODE_MISMATCH"
);

// L. Successful progression to simulated Terminal initialization
assert.strictEqual(
  setupScreen(base({ fineGranted: true, signedIn: true, terminal: "IDLE" })),
  "TERMINAL_CONNECT"
);
assert.strictEqual(
  setupScreen(base({ fineGranted: true, terminal: "READY" })),
  "READY"
);

// No permission-request loop: after a request with no rationale, open Settings
assert.notStrictEqual(
  setupScreen(base({ alreadyRequestedFine: true, rationaleFine: false })),
  "LOCATION_PRECISE"
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
var login = fs.readFileSync(
  path.join(root, "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/LoginActivity.kt"),
  "utf8"
);

assert.match(gate, /enum class Screen/);
assert.match(gate, /LOCATION_APPROXIMATE/);
assert.match(gate, /LOCATION_SETTINGS/);
assert.match(gate, /NFC_UNAVAILABLE/);
assert.match(gate, /TERMINAL_MODE_MISMATCH/);
assert.match(gate, /fun evaluate\(/);
assert.match(gate, /Precise Location/);
assert.match(gate, /Approximate/);
assert.doesNotMatch(gate, /Location permission is required for Stripe Terminal/);
assert.doesNotMatch(gate, /BLUETOOTH_SCAN|Nearby Devices/);

assert.match(setup, /SetupGate\.evaluate/);
assert.match(setup, /RequestMultiplePermissions/);
assert.match(setup, /ACTION_NFC_SETTINGS/);
assert.match(setup, /ACTION_LOCATION_SOURCE_SETTINGS/);
assert.match(setup, /ACTION_APPLICATION_DETAILS_SETTINGS/);
assert.match(setup, /override fun onResume/);
assert.match(setup, /requestedFineThisSession/);
assert.match(setup, /test_diagnostics|TEST Diagnostics/);
assert.doesNotMatch(setup, /permission\.launch\(missing\)/);

assert.match(collect, /TerminalPermissions\.evaluate/);
assert.match(collect, /SetupActivity/);
assert.match(collect, /override fun onResume/);
assert.doesNotMatch(collect, /missingRuntimePermissions/);
assert.doesNotMatch(collect, /Location permission is required for Stripe Terminal/);
assert.doesNotMatch(collect, /permission\.launch/);

assert.match(login, /SetupActivity\.needsWizard|SetupActivity/);

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

console.log("setup wizard state machine A-L: ok");
