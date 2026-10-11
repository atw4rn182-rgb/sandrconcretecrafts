"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

function read(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

var app = read("app.js");
var create = read("api/create-checkout-session.js");
var stripe = read("api/_lib/stripe.js");
var webhook = read("api/stripe-webhook.js");
var settings = read("js/store-settings.js");
var settingsHtml = read("admin/settings.html");
var orders = read("admin/orders.js");
var payments = read("admin/payments.js");

assert.doesNotMatch(app, /SHIPPING_FEE|SHIPPING_THRESHOLD/);
assert.match(app, /fulfillment: chosen\.method/);
assert.match(app, /cart\.taxLater/);
assert.match(create, /fulfillment\.resolveChoice/);
assert.match(create, /quantity: totalQuantity/);
assert.doesNotMatch(create, /body\.shipping|shippingAmount|clientShipping/);
assert.match(app, /pricingMode === "per_item"/);
assert.match(create, /unitAmountCents: choice\.feeCents/);
assert.match(create, /quantity: 1/);
assert.match(create, /automaticTax: true/);
assert.doesNotMatch(create, /body\.fee|requestedFee|clientFee/);
assert.match(stripe, /automatic_tax\[enabled\]/);
assert.match(stripe, /price_data\]\[tax_behavior\]/);
assert.match(webhook, /totalsFromSession/);
assert.match(webhook, /fulfillment_method = totals\.method/);
assert.doesNotMatch(webhook, /fulfillment_status:/);
assert.match(settings, /shipping_fee_cents/);
assert.match(settings, /pickup_fee_cents/);
assert.match(settings, /Use 0\.00 for free pickup|0\.00 if shipping is free/);
assert.match(settingsHtml, /id="shippingFee"/);
assert.match(settingsHtml, /Shipping pricing/);
assert.match(settingsHtml, /id="shippingModePerItem"/);
assert.match(settingsHtml, /id="shippingFirstFee"/);
assert.match(settingsHtml, /id="shippingAdditionalFee"/);
assert.match(settingsHtml, /id="pickupFee"/);
assert.match(settingsHtml, /Offer shipping/);
assert.match(settingsHtml, /Offer local pickup/);
assert.match(orders, /Not in Needs Shipping|not in Needs Shipping/);
assert.match(orders, /fulfillment_fee_cents/);
assert.match(orders, /tax_cents/);
assert.match(payments, /tax_milli/);
assert.match(read("admin/pos-totals.js"), /taxMilli/);
assert.doesNotMatch(create, /pos\.tax_milli|tax_milli/);

var g = {};
eval(settings.replace("typeof window !== \"undefined\" ? window : globalThis", "g"));
var S = g.SRStoreSettings;
assert.strictEqual(S.cloneDefaults().fulfillment.shipping_fee_cents, null);
assert.strictEqual(S.cloneDefaults().fulfillment.pickup_fee_cents, 500);
assert.strictEqual(S.readyFulfillment(S.cloneDefaults()).length, 1);
assert.strictEqual(S.readyFulfillment(S.cloneDefaults())[0].feeCents, 500);
assert.strictEqual(S.normalize({}).fulfillment.pickup_fee_cents, 500);
assert.strictEqual(
  S.normalize({ fulfillment: { pickup_fee_cents: "0.00" } }).fulfillment.pickup_fee_cents,
  0
);
var saved = S.normalize({
  fulfillment: {
    shipping_enabled: true,
    shipping_fee_cents: "8.50",
    pickup_enabled: true,
    pickup_fee_cents: "0.00",
  },
});
assert.strictEqual(saved.fulfillment.shipping_fee_cents, 850);
assert.strictEqual(saved.fulfillment.shipping_pricing_mode, "flat");
assert.strictEqual(saved.fulfillment.shipping_first_item_cents, 1000);
assert.strictEqual(saved.fulfillment.shipping_additional_item_cents, 300);
assert.strictEqual(S.perItemShippingCents(1000, 300, 1), 1000);
assert.strictEqual(S.perItemShippingCents(1000, 300, 2), 1300);
assert.strictEqual(S.perItemShippingCents(1000, 300, 3), 1600);
assert.strictEqual(S.perItemShippingCents(1000, 300, 5), 2200);
assert.strictEqual(S.perItemShippingCents(1000, 200, 3), 1400);
assert.strictEqual(S.perItemShippingCents(1200, 250, 4), 1950);
var perItem = S.normalize({
  fulfillment: {
    shipping_enabled: true,
    shipping_pricing_mode: "per_item",
    shipping_fee_cents: 1000,
    shipping_first_item_cents: "10.00",
    shipping_additional_item_cents: "3.00",
    pickup_enabled: true,
    pickup_fee_cents: "5.00",
  },
});
assert.strictEqual(perItem.fulfillment.shipping_fee_cents, 1000);
var perReady = S.readyFulfillment(perItem).filter(function (method) {
  return method.method === "ship";
})[0];
assert.strictEqual(perReady.pricingMode, "per_item");
assert.strictEqual(S.perItemShippingCents(perReady.firstItemCents, perReady.additionalItemCents, 5), 2200);
assert.strictEqual(saved.fulfillment.pickup_fee_cents, 0);
assert.strictEqual(S.readyFulfillment(saved).length, 2);
assert.ok(
  S.validateDraft({
    business: { name: "S&R" },
    fulfillment: { shipping_enabled: false, pickup_enabled: false },
  }).some(function (msg) {
    return msg.indexOf("at least one") !== -1;
  })
);
assert.ok(
  S.validateDraft({
    business: { name: "S&R" },
    fulfillment: { shipping_enabled: true, shipping_fee_cents: "-1", pickup_enabled: false },
  }).length > 0
);

console.log("fulfillment wiring checks passed");
