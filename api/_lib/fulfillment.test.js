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

var defaults = fulfillment.readyMethods({});
assert.strictEqual(defaults.length, 1);
assert.strictEqual(defaults[0].method, "pickup");
assert.strictEqual(defaults[0].feeCents, 500, "missing pickup fee is $5.00 once");
assert.strictEqual(defaults[0].label, "Local Pickup / Meet-Up");
var unsetFees = fulfillment.readyMethods({
  fulfillment: { shipping_enabled: true, pickup_enabled: true },
});
assert.strictEqual(unsetFees.length, 1, "shipping without a saved fee is not offered");
assert.strictEqual(unsetFees[0].feeCents, 500);
assert.strictEqual(
  fulfillment.resolveChoice({}, "pickup").feeCents,
  500,
  "checkout uses the $5 default, not a client price"
);
assert.strictEqual(
  fulfillment.resolveChoice({ fulfillment: { pickup_fee_cents: 0, pickup_enabled: true, shipping_enabled: false } }, "pickup").feeCents,
  0,
  "a saved 0 stays free"
);
assert.strictEqual(
  fulfillment.readyMethods({ fulfillment: { pickup_enabled: false, shipping_enabled: false } }).length,
  0
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
assert.strictEqual(
  fulfillment.resolveChoice(
    { fulfillment: { shipping_enabled: false, pickup_enabled: false } },
    "ship"
  ).code,
  "FULFILLMENT_NOT_CONFIGURED"
);
assert.strictEqual(fulfillment.resolveChoice({}, "ship").code, "FULFILLMENT_UNAVAILABLE");
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

var tiered = {
  fulfillment: {
    shipping_enabled: true,
    shipping_pricing_mode: "per_item",
    shipping_fee_cents: 1000,
    shipping_first_item_cents: 1000,
    shipping_additional_item_cents: 300,
    pickup_enabled: true,
    pickup_fee_cents: 500,
  },
};
function tierQuote(config, quantity) {
  return fulfillment.resolveChoice(config, { method: "ship", feeCents: 1, quantity: 1 }, { quantity: quantity }).feeCents;
}
assert.strictEqual(tierQuote(tiered, 1), 1000);
assert.strictEqual(tierQuote(tiered, 2), 1300);
assert.strictEqual(tierQuote(tiered, 3), 1600);
assert.strictEqual(tierQuote(tiered, 5), 2200);
assert.strictEqual(
  tierQuote(
    {
      fulfillment: {
        shipping_enabled: true,
        shipping_pricing_mode: "per_item",
        shipping_fee_cents: 1000,
        shipping_first_item_cents: 1000,
        shipping_additional_item_cents: 200,
        pickup_enabled: true,
        pickup_fee_cents: 500,
      },
    },
    3
  ),
  1400
);
assert.strictEqual(
  tierQuote(
    {
      fulfillment: {
        shipping_enabled: true,
        shipping_pricing_mode: "per_item",
        shipping_fee_cents: 1000,
        shipping_first_item_cents: 1200,
        shipping_additional_item_cents: 250,
        pickup_enabled: false,
      },
    },
    4
  ),
  1950
);
assert.strictEqual(
  fulfillment.resolveChoice(tiered, { method: "pickup", feeCents: 999 }, { quantity: 5 }).feeCents,
  500
);
assert.strictEqual(
  fulfillment.resolveChoice(
    { fulfillment: { shipping_enabled: true, shipping_fee_cents: 1000, pickup_enabled: true, pickup_fee_cents: 500 } },
    { method: "ship", feeCents: 1 },
    { quantity: 5 }
  ).feeCents,
  1000,
  "a shop with no pricing mode keeps its saved flat fee"
);
assert.strictEqual(fulfillment.perItemShippingCents(1000, 300, 5), 2200);
var tierFields = fulfillment.stripeFields(fulfillment.resolveChoice(tiered, "ship", { quantity: 3 }));
assert.strictEqual(
  tierFields.filter(function (pair) {
    return pair[0].indexOf("fixed_amount][amount]") !== -1;
  }).length,
  1
);
assert.strictEqual(
  tierFields.filter(function (pair) {
    return pair[0].indexOf("fixed_amount][amount]") !== -1;
  })[0][1],
  1600
);

console.log("fulfillment checks passed");
