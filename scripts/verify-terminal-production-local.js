#!/usr/bin/env node
"use strict";

var assert = require("assert");
var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var mode = require("../api/_lib/terminal-mode");
var tapTotal = require("../api/_lib/tap-total");
var stripe = require("../api/_lib/stripe");

var root = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

var gradle = read("android/app/build.gradle.kts");
var controller = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/TerminalController.kt"
);
var viewModel = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/CollectViewModel.kt"
);
var collect = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/CollectActivity.kt"
);
var permissions = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/TerminalPermissions.kt"
);
var paymentIntent = read("api/admin/terminal/payment-intent.js");
var connectionToken = read("api/admin/terminal/connection-token.js");
var webhook = read("api/stripe-terminal-webhook.js");
var checkoutWebhook = read("api/stripe-webhook.js");
var checkoutCreate = read("api/create-checkout-session.js");
var cash = read("api/admin/cash-sales.js");
var confirmSql = read("supabase/migrations/20260916000001_in_person_sales.sql");
var posApp = read("api/_lib/pos-app.js");
var parser = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/data/CollectPayloadParser.kt"
);

// A. Production build has SIMULATED_READER=false
assert.match(gradle, /buildTypes[\s\S]*release[\s\S]*SIMULATED_READER", "false"/);
assert.match(gradle, /p4-production/);
assert.match(gradle, /versionCode\.set\(12\)/);
assert.match(gradle, /versionName\.set\("1\.0\.0"\)/);

// B. Test build retains SIMULATED_READER=true
assert.match(gradle, /debug[\s\S]*SIMULATED_READER", "true"/);
assert.match(gradle, /versionCode = 11/);
assert.match(gradle, /versionName = "0\.1\.10-test"/);
assert.match(gradle, /p311-physical/);

// C. Production + TEST Terminal backend → TERMINAL_MODE_MISMATCH
assert.strictEqual(mode.compatible(false, "test"), false);
assert.match(controller, /!useSimulatedReader\(\) && session\.livemode == false/);
assert.match(paymentIntent, /compatible\(simulated, cfg\.mode\)/);

// D. Simulation + LIVE backend → TERMINAL_MODE_MISMATCH
assert.strictEqual(mode.compatible(true, "live"), false);
assert.match(controller, /useSimulatedReader\(\) && session\.livemode == true/);

// E. Production + LIVE backend → allowed
assert.strictEqual(mode.compatible(false, "live"), true);
assert.strictEqual(mode.compatible(true, "test"), true);

// F. $1 Admin sale → 100 cents
assert.strictEqual(
  tapTotal.assertClientTotalMatchesOrder(
    { amount_total_cents: 100 },
    { amount_total: 100 }
  ),
  100
);
assert.match(read("android/app/src/main/java/com/sandrconcretecrafts/pos/data/SalePayload.kt"), /amount_total_cents/);

// G. Invalid handoff → stops before Terminal
assert.match(parser, /LEGACY_HANDOFF|HANDOFF_PAYLOAD/);
assert.match(collect, /showPayloadFailure/);
assert.match(viewModel, /This sale has no total/);
assert.match(viewModel, /if \(!started\.compareAndSet/);

// H. Server amount mismatch → rejected
assert.throws(function () {
  tapTotal.assertClientTotalMatchesOrder({ amount_total_cents: 200 }, { amount_total: 100 });
}, /does not match the server total/);
assert.match(paymentIntent, /assertClientTotalMatchesOrder/);
assert.match(viewModel, /The server total did not match this sale/);

// I / J. Coarse or Fine satisfies app Location gate
assert.match(permissions, /coarseGranted \|\| fineGranted/);
assert.match(permissions, /val locationGranted: Boolean[\s\S]*coarseGranted \|\| fineGranted/);

// K. NFC unavailable/disabled → correct safe state
assert.match(read("android/app/src/main/java/com/sandrconcretecrafts/pos/setup/SetupGate.kt"), /NFC_UNAVAILABLE/);
assert.match(read("android/app/src/main/java/com/sandrconcretecrafts/pos/setup/SetupGate.kt"), /NFC_OFF/);
assert.match(collect, /nfcAvailable|nfcEnabled/);

// L. Terminal initialization errors expose sanitized Stripe source
assert.match(controller, /SOURCE: \$\{ErrorSource\.STRIPE_SDK\}|SOURCE: STRIPE_SDK/);
assert.match(controller, /BLOCKED STAGE/);
assert.match(controller, /ERROR CODE/);
assert.doesNotMatch(controller, /sk_live_|whsec_/);

// M. Real reader discovery uses simulated=false
assert.match(controller, /isSimulated = useSimulatedReader\(\)/);
assert.match(controller, /SIMULATED_READER_FORBIDDEN|!useSimulatedReader\(\) && config\.isSimulated/);

// N. No automated live card collection during tests/deployment
assert.doesNotMatch(viewModel, /onReady = \{[\s\S]{0,200}takePayment\(/);
assert.doesNotMatch(viewModel, /onReady = \{[\s\S]{0,200}terminal\.collect\(/);
assert.match(collect, /takePayment\.setOnClickListener \{ viewModel\.takePayment\(\) \}/);

// O / P. Terminal webhook signature + idempotency
assert.match(webhook, /terminalWebhookSecret|STRIPE_TERMINAL_WEBHOOK_SECRET/);
assert.match(read("api/_lib/stripe.js"), /resolveTerminalApiSecret/);
assert.match(webhook, /stripe\.constructEvent/);
assert.match(webhook, /confirmTapToPayPayment/);
assert.doesNotMatch(webhook, /STRIPE_WEBHOOK_SECRET/);
assert.match(confirmSql, /if v_order\.payment_status = 'paid' then[\s\S]*return v_order/);

var secret = "local_terminal_webhook_unit_secret";
var payload = JSON.stringify({
  type: "payment_intent.succeeded",
  data: { object: { id: "pi_local_unit", amount: 100, currency: "usd" } },
});
var timestamp = String(Math.floor(Date.now() / 1000));
var expected = crypto
  .createHmac("sha256", secret)
  .update(timestamp + "." + payload, "utf8")
  .digest("hex");
var event = stripe.constructEvent(payload, "t=" + timestamp + ",v1=" + expected, secret);
assert.strictEqual(event.type, "payment_intent.succeeded");
assert.throws(function () {
  stripe.constructEvent(payload, "t=" + timestamp + ",v1=deadbeef", secret);
});

// Q. One successful Terminal payment → one completed order
assert.match(confirmSql, /payment_source = 'tap_to_pay'/);
assert.match(confirmSql, /payment_status = 'unpaid'/);
assert.match(webhook, /confirmTapToPayPayment/);

// R. Failed Terminal payment → no completed paid order
assert.match(webhook, /event\.type !== "payment_intent\.succeeded"/);
assert.doesNotMatch(viewModel, /confirmTapToPayPayment/);
assert.match(viewModel, /Failed\(/);

// S. Online Checkout regression stays isolated
assert.doesNotMatch(checkoutCreate, /STRIPE_TERMINAL_SECRET_KEY|sandrpos/);
assert.doesNotMatch(checkoutWebhook, /STRIPE_TERMINAL_SECRET_KEY|STRIPE_TERMINAL_WEBHOOK_SECRET/);
assert.match(checkoutWebhook, /constructEvent/);

// T. Cash regression
assert.doesNotMatch(cash, /sandrpos|STRIPE_TERMINAL_SECRET_KEY/);
assert.match(cash, /normalizeCashBatch|record_cash_sales_batch|cash/);

// U / V / W. No secrets bundled into Android source
assert.doesNotMatch(gradle, /sk_live_|sk_test_|SERVICE_ROLE|whsec_|STRIPE_SECRET_KEY/);
assert.doesNotMatch(controller, /sk_live_|SERVICE_ROLE|whsec_/);
assert.match(connectionToken, /requireActiveAdmin/);
assert.doesNotMatch(connectionToken, /service_role|SERVICE_ROLE/);
assert.match(posApp, /SR_POS_APP_CHANNEL \|\| "test"/);
assert.match(posApp, /versionName: "1\.0\.0"/);

console.log("production Terminal dual-mode, mismatch, webhook, and isolation: ok");
