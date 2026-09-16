"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var validation = require("./in-person-validation");
var adminAuth = require("./admin-auth");

var now = Date.parse("2026-09-16T18:00:00.000Z");
var productId = "123e4567-e89b-42d3-a456-426614174000";

function sale(overrides) {
  return Object.assign(
    {
      sold_at: "2026-09-16T17:59:00Z",
      idempotency_key: "cash:20260916:abcdefgh",
      sale_note: "County fair",
      receipt_email: "Buyer@Example.com",
      items: [
        {
          type: "product",
          product_id: productId,
          finish: "painted",
          quantity: 2,
          // Must be ignored: the RPC resolves product prices from the catalog.
          unit_amount_cents: 1,
        },
        {
          type: "custom",
          name: "Gift wrap",
          unit_amount_cents: 250,
          quantity: 1,
        },
      ],
    },
    overrides || {}
  );
}

var normalized = validation.normalizeSale(sale(), { nowMs: now });
assert.strictEqual(normalized.receipt_email, "buyer@example.com");
assert.strictEqual(normalized.items[0].unit_amount_cents, undefined);
assert.strictEqual(normalized.items[1].unit_amount_cents, 250);
assert.strictEqual(normalized.sold_at, "2026-09-16T17:59:00.000Z");

assert.throws(function () {
  validation.normalizeSale(
    sale({
      items: [
        {
          type: "custom",
          name: "Invalid decimal",
          unit_amount_cents: "2.50",
          quantity: 1,
        },
      ],
    }),
    { nowMs: now }
  );
}, /integer cents/);

assert.throws(function () {
  validation.normalizeSale(
    sale({
      items: [{ type: "custom", name: "Quick sale", unit_amount_cents: 0, quantity: 1 }],
    }),
    { nowMs: now }
  );
}, /outside the allowed range/);

assert.throws(function () {
  validation.normalizeSale(
    sale({
      items: [{ type: "custom", name: "Quick sale", unit_amount_cents: -100, quantity: 1 }],
    }),
    { nowMs: now }
  );
}, /outside the allowed range/);

var quickDollar = validation.normalizeSale(
  sale({
    sale_note: "2 painted pumpkins",
    items: [{ type: "custom", name: "2 painted pumpkins", unit_amount_cents: 100, quantity: 1 }],
  }),
  { nowMs: now }
);
assert.strictEqual(quickDollar.items[0].unit_amount_cents, 100);
assert.strictEqual(quickDollar.sale_note, "2 painted pumpkins");

var twelveFifty = validation.normalizeSale(
  sale({
    items: [{ type: "custom", name: "Quick sale", unit_amount_cents: 1250, quantity: 1 }],
  }),
  { nowMs: now }
);
assert.strictEqual(twelveFifty.items[0].unit_amount_cents, 1250);

var twentyFive = validation.normalizeSale(
  sale({
    items: [{ type: "custom", name: "Quick sale", unit_amount_cents: 2500, quantity: 1 }],
  }),
  { nowMs: now }
);
assert.strictEqual(twentyFive.items[0].unit_amount_cents, 2500);

assert.throws(function () {
  validation.normalizeSale(sale({ receipt_email: "not-an-email" }), {
    nowMs: now,
  });
}, /valid email/);

assert.throws(function () {
  validation.normalizeSale(sale({ sold_at: "2026-09-16 17:59:00" }), {
    nowMs: now,
  });
}, /RFC 3339/);

assert.throws(function () {
  validation.normalizeCashBatch(
    { sales: [sale(), sale()] },
    { nowMs: now }
  );
}, /unique idempotency_key/);

assert.strictEqual(
  adminAuth.bearerToken({
    headers: { authorization: "Bearer " + "a".repeat(32) },
  }),
  "a".repeat(32)
);
assert.throws(function () {
  adminAuth.bearerToken({ headers: { authorization: "Basic abc" } });
}, /bearer token/);

var migration = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "..",
    "supabase",
    "migrations",
    "20260916000001_in_person_sales.sql"
  ),
  "utf8"
);
assert.match(migration, /alter column stripe_session_id drop not null/);
assert.match(migration, /orders_stripe_payment_intent_unique_idx[\s\S]+where stripe_payment_intent is not null/);
assert.match(migration, /grant execute[\s\S]+record_cash_sales_batch\(uuid, jsonb\)[\s\S]+to service_role/);
assert.doesNotMatch(migration, /create policy[\s\S]{0,100}for insert/i);

console.log("in-person validation: ok");
