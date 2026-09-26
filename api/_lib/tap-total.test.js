"use strict";

var assert = require("assert");
var tapTotal = require("./tap-total");

assert.strictEqual(
  tapTotal.assertClientTotalMatchesOrder(
    { amount_total_cents: 2233 },
    { amount_total: 2233 }
  ),
  2233
);

assert.throws(function () {
  tapTotal.assertClientTotalMatchesOrder({ amount_total_cents: 2300 }, { amount_total: 2233 });
}, /does not match the server total/);

assert.throws(function () {
  tapTotal.assertClientTotalMatchesOrder({}, { amount_total: 100 });
}, /required for Tap to Pay/);

assert.throws(function () {
  tapTotal.assertClientTotalMatchesOrder({ amount_total_cents: 100 }, { amount_total: 1.5 });
}, /invalid/);

console.log("tap total mismatch rejection: ok");
