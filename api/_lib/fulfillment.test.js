"use strict";

var assert = require("assert");
var fulfillment = require("./fulfillment");

var priced = {
  fulfillment: {
    shipping_enabled: true,
    shipping_fee_cents: 800,
    shipping_label: "Shipping",
    shipping_note: "Packed with care",
    pickup_enabled: true,
    pickup_fee_cents: 0,
    pickup_label: "Local Pickup",
    pickup_instructions: "Milan shop",
  },
};

var ready = fulfillment.readyMethods(priced);
assert.strictEqual(ready.length, 2);
assert.strictEqual(ready[0].feeCents, 800);
assert.strictEqual(ready[1].feeCents, 0);

assert.strictEqual(fulfillment.readyMethods({}).length, 0);
assert.strictEqual(
  fulfillment.readyMethods({ fulfillment: { shipping_enabled: true, pickup_enabled: true } }).length,
  0,
  "enabled without a saved fee is not ready"
);

var ship = fulfillment.resolveChoice(priced, "ship");
assert.strictEqual(ship.ok, true);
assert.strictEqual(ship.feeCents, 800);
var ignored = fulfillment.resolveChoice(priced, { method: "ship", feeCents: 1 });
assert.strictEqual(ignored.feeCents, 800, "client fee is ignored");

var fields = fulfillment.stripeFields(ship);
var amounts = fields.filter(function (pair) {
  return pair[0].indexOf("fixed_amount][amount]") !== -1;
});
assert.strictEqual(amounts.length, 1);
assert.strictEqual(amounts[0][1], 800);
assert.ok(
  !fields.some(function (pair) {
    return String(pair[0]).indexOf("shipping_options[1]") !== -1;
  }),
  "flat fee is one charge for the order"
);
assert.ok(fields.some(function (pair) {
  return pair[0] === "shipping_options[0][shipping_rate_data][tax_behavior]" && pair[1] === "exclusive";
}));

var pickup = fulfillment.resolveChoice(priced, "pickup");
assert.strictEqual(pickup.feeCents, 0);
var pickupFields = fulfillment.stripeFields(pickup);
assert.ok(pickupFields.some(function (pair) {
  return pair[0] === "billing_address_collection" && pair[1] === "required";
}));
assert.ok(!pickupFields.some(function (pair) {
  return String(pair[0]).indexOf("shipping_address_collection") !== -1;
}));
assert.ok(!pickupFields.some(function (pair) {
  return String(pair[0]).indexOf("shipping_options") !== -1;
}));

assert.strictEqual(fulfillment.resolveChoice(priced, "").code, "FULFILLMENT_REQUIRED");
assert.strictEqual(
  fulfillment.resolveChoice(
    { fulfillment: { shipping_enabled: false, pickup_enabled: true, pickup_fee_cents: 500 } },
    "ship"
  ).code,
  "FULFILLMENT_UNAVAILABLE"
);
assert.strictEqual(fulfillment.resolveChoice({}, "ship").code, "FULFILLMENT_NOT_CONFIGURED");
assert.strictEqual(fulfillment.feeCents(-1), null);
assert.strictEqual(fulfillment.feeCents(1.5), null);

var session = {
  amount_subtotal: 3800,
  amount_total: 4100,
  total_details: { amount_shipping: 800, amount_tax: 300 },
  metadata: { fulfillment_method: "ship", pickup_instructions: "" },
};
var shipTotals = fulfillment.totalsFromSession(session, []);
assert.strictEqual(shipTotals.subtotalCents, 3800);
assert.strictEqual(shipTotals.feeCents, 800);
assert.strictEqual(shipTotals.taxCents, 300);

var pickupSession = {
  amount_subtotal: 3500,
  amount_total: 3700,
  total_details: { amount_shipping: 0, amount_tax: 200 },
  metadata: { fulfillment_method: "pickup", pickup_instructions: "Side door" },
};
var pickupLines = [
  { price: { unit_amount: 3000, product: { metadata: { product_id: "abc" } } }, quantity: 2, amount_total: 3000 },
  { price: { unit_amount: 500, product: { metadata: { fulfillment: "pickup" } } }, quantity: 1, amount_total: 550 },
];
var pickupTotals = fulfillment.totalsFromSession(pickupSession, pickupLines);
assert.strictEqual(pickupTotals.feeCents, 500, "pickup fee is the pre-tax line, once");
assert.strictEqual(pickupTotals.subtotalCents, 3000);
assert.strictEqual(pickupTotals.taxCents, 200);
assert.strictEqual(pickupTotals.instructions, "Side door");
assert.strictEqual(fulfillment.isFulfillmentLine(pickupLines[1]), true);
assert.strictEqual(fulfillment.isFulfillmentLine(pickupLines[0]), false);

var qtyFields = fulfillment.stripeFields(
  fulfillment.resolveChoice(
    {
      fulfillment: {
        shipping_enabled: true,
        shipping_fee_cents: 650,
        pickup_enabled: false,
      },
    },
    "ship"
  )
);
assert.strictEqual(
  qtyFields.filter(function (pair) {
    return pair[0].indexOf("[amount]") !== -1;
  })[0][1],
  650
);

console.log("fulfillment checks passed");
