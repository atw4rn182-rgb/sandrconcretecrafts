"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var receipt = require("./receipt");

test("receipt validates email and escapes authoritative order content", function () {
  assert.equal(receipt.validEmail(" Buyer@Example.com "), "buyer@example.com");
  assert.equal(receipt.validEmail("bad\n@example.com"), null);
  var output = receipt.buildReceipt({
    id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    payment_source: "cash",
    sold_at: "2026-09-16T18:00:00Z",
    amount_total: 2500,
    currency: "usd",
    customer_name: "<Rachel>",
    order_items: [
      {
        product_name: "<Planter>",
        finish: "painted",
        quantity: 1,
        amount_total: 2500,
      },
    ],
  });
  assert.match(output.text, /Receipt: AAAAAAAA/);
  assert.match(output.text, /Payment: Cash/);
  assert.match(output.text, /Painted/);
  assert.match(output.text, /Total: \$25\.00/);
  assert.match(output.html, /sandrlogo\.jpg/);
  assert.doesNotMatch(output.html, /<Rachel>|<Planter>/);
  assert.match(output.html, /&lt;Rachel&gt;/);
  assert.match(output.html, /&lt;Planter&gt;/);
});
