#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var handoff = require("../admin/tap-handoff");
var pos = require("../admin/pos-totals");

var root = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// A. Admin $1 → 100 cents
assert.strictEqual(pos.quote({ lines: [100], discountMilli: 0, taxMilli: 0 }).total, 100);

// B/C. Encoder + parser fixture $1.00
var fixture = handoff.dollarFixture();
assert.strictEqual(fixture.amount_total_cents, 100);
var prepared = handoff.prepareSale(fixture);
assert.strictEqual(prepared.handoff_version, 2);
assert.strictEqual(prepared.amount_total_cents, 100);
var encoded = handoff.encodeSale(fixture);
var decoded = handoff.decodeSale(encoded);
assert.strictEqual(decoded.handoff_version, 2);
assert.strictEqual(decoded.amount_total_cents, 100);
assert.strictEqual(handoff.money(decoded.amount_total_cents), "$1.00");

var intent = handoff.buildCollectIntent(fixture);
assert.match(intent, /^intent:\/\/collect\/v2\/100#Intent;/);
assert.match(intent, /scheme=sandrpos/);
assert.match(intent, /package=com\.sandrconcretecrafts\.pos/);
assert.match(intent, /S\.p=/);
assert.match(intent, /i\.handoff_version=2/);
assert.match(intent, /i\.amount_total_cents=100/);
assert.doesNotMatch(intent, /intent:\/\/collect\?p=/);

var extra = intent.match(/;S\.p=([^;]+);/);
assert.ok(extra, "intent extra S.p is present");
assert.strictEqual(handoff.decodeSale(extra[1]).amount_total_cents, 100);

// D. Missing amount
assert.throws(function () {
  handoff.prepareSale({ items: [] });
}, /amount_total_cents/);

// E. Zero amount
assert.strictEqual(handoff.asPositiveCents(0), null);
assert.throws(function () {
  handoff.prepareSale({ amount_total_cents: 0 });
}, /amount_total_cents/);

// F. Wrong version
assert.throws(function () {
  handoff.decodeSale(
    handoff.utf8ToBase64Url(JSON.stringify({ handoff_version: 1, amount_total_cents: 100 }))
  );
}, /HANDOFF_VERSION_MISMATCH/);

// N. $23.00
assert.strictEqual(pos.quote({ lines: [2300], discountMilli: 0, taxMilli: 0 }).total, 2300);
var twentyThree = handoff.prepareSale({ amount_total_cents: 2300, items: [] });
assert.strictEqual(handoff.decodeSale(handoff.encodeSale(twentyThree)).amount_total_cents, 2300);

// O. $23 + 10% discount, tax if configured
var discounted = pos.quote({ lines: [2300], discountMilli: 10000, taxMilli: 0 });
assert.strictEqual(discounted.subtotal, 2300);
assert.strictEqual(discounted.discount, 230);
assert.strictEqual(discounted.total, 2070);
var taxed = pos.quote({ lines: [2300], discountMilli: 10000, taxMilli: 7875 });
assert.strictEqual(taxed.total, discounted.total + taxed.tax);
assert.strictEqual(
  handoff.decodeSale(handoff.encodeSale({ amount_total_cents: taxed.total })).amount_total_cents,
  taxed.total
);

var kotlinParser = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/data/CollectPayloadParser.kt"
);
assert.match(kotlinParser, /const val VERSION = 2/);
assert.match(kotlinParser, /HANDOFF_VERSION_MISMATCH/);
assert.match(kotlinParser, /AMOUNT_TOTAL_MISSING/);
assert.match(kotlinParser, /AMOUNT_TOTAL_INVALID/);
assert.match(kotlinParser, /HANDOFF_PAYLOAD/);
assert.match(kotlinParser, /PAYLOAD_VALIDATION/);
assert.match(kotlinParser, /Base64/);
assert.doesNotMatch(kotlinParser, /optInt\("amount_total_cents", 0\)/);

var sale = read("android/app/src/main/java/com/sandrconcretecrafts/pos/data/SalePayload.kt");
assert.match(sale, /amount_total_cents/);
assert.doesNotMatch(sale, /unit_amount_cents/);
assert.doesNotMatch(sale, /return "\$0\.00"/);
assert.match(sale, /return "—"/);

var collect = read("android/app/src/main/java/com/sandrconcretecrafts/pos/ui/CollectActivity.kt");
assert.match(collect, /CollectPayloadParser\.parse/);
assert.match(collect, /COLLECT CODE/);
assert.match(collect, /handoffPanel/);
assert.match(collect, /showPayloadFailure/);
assert.match(collect, /parsed !is CollectPayloadParser\.Result\.Ok/);
assert.doesNotMatch(collect, /URLDecoder/);
assert.doesNotMatch(collect, /Location permission is required for Stripe Terminal/);

var viewModel = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/CollectViewModel.kt"
);
assert.match(viewModel, /SalePayload\.amountCents/);
assert.match(viewModel, /createPaymentIntent/);
assert.doesNotMatch(viewModel, /type"\) == "custom"/);

var payments = read("admin/payments.js");
assert.match(payments, /SRTapHandoff/);
assert.match(payments, /prepareSale/);
assert.match(payments, /buildCollectIntent/);
assert.match(payments, /ADMIN PAYMENT HANDOFF/);
assert.match(payments, /amount_total_cents: quote\.total/);
assert.doesNotMatch(payments, /intent:\/\/collect\?p=/);

var html = read("admin/payments.html");
assert.match(html, /tap-handoff\.js/);
assert.match(html, /tapHandoffDiag/);

var manifest = read("android/app/src/main/AndroidManifest.xml");
assert.match(manifest, /android:scheme="sandrpos"/);
assert.match(manifest, /android:host="collect"/);
assert.match(manifest, /\.ui\.CollectActivity/);
assert.match(manifest, /\.ui\.SetupActivity/);
assert.doesNotMatch(manifest, /PaymentActivity|TerminalActivity|TapToPayActivity/);

var strings = read("android/app/src/main/res/values/strings.xml");
assert.match(strings, /Back to S&amp;R Payments/);
assert.match(strings, /collect_test_banner/);
assert.doesNotMatch(strings, /Location permission is required for Stripe Terminal/);

assert.doesNotMatch(read("api/admin/cash-sales.js"), /SRTapHandoff|sandrpos/);
assert.doesNotMatch(read("api/create-checkout-session.js"), /SRTapHandoff|sandrpos/);
assert.doesNotMatch(read("api/stripe-webhook.js"), /SRTapHandoff|sandrpos/);
assert.match(read("api/_lib/tap-total.js"), /amount_total_cents is required/);
assert.match(read("android/app/src/main/java/com/sandrconcretecrafts/pos/terminal/TerminalController.kt"), /TERMINAL_MODE_MISMATCH/);

console.log("tap handoff amount_total_cents contract: ok");
