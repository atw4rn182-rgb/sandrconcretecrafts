#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

function amountCents(sale) {
  if (!sale || sale.amount_total_cents == null) return null;
  var cents = Number(sale.amount_total_cents);
  return Number.isSafeInteger(cents) && cents >= 1 ? cents : null;
}

function money(cents) {
  return "$" + (cents / 100).toFixed(2);
}

assert.strictEqual(amountCents({ amount_total_cents: 2300 }), 2300);
assert.strictEqual(amountCents({ amount_total_cents: 2233 }), 2233);
assert.strictEqual(amountCents({ amount_total_cents: 0 }), null);
assert.strictEqual(amountCents({ items: [{ type: "custom", unit_amount_cents: 800 }] }), null);
assert.strictEqual(amountCents(null), null);
assert.strictEqual(money(2233), "$22.33");
assert.strictEqual("Take Payment — " + money(2300), "Take Payment — $23.00");

var kotlin = fs.readFileSync(
  path.join(__dirname, "..", "android/app/src/main/java/com/sandrconcretecrafts/pos/data/SalePayload.kt"),
  "utf8"
);
assert.match(kotlin, /amount_total_cents/);
assert.doesNotMatch(kotlin, /unit_amount_cents/);
assert.doesNotMatch(kotlin, /client_secret|sk_live_|whsec_/);

var viewModel = fs.readFileSync(
  path.join(__dirname, "..", "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/CollectViewModel.kt"),
  "utf8"
);
assert.match(viewModel, /SalePayload\.amountCents/);
assert.match(viewModel, /createPaymentIntent/);
assert.doesNotMatch(viewModel, /type"\) == "custom"/);

console.log("tap handoff amount_total_cents contract: ok");
