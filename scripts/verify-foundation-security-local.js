#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var read = function (rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
};

var migration = read("supabase/migrations/20260916000001_in_person_sales.sql");
var cashRoute = read("api/admin/cash-sales.js");
var terminalRoute = read("api/admin/terminal/payment-intent.js");
var tokenRoute = read("api/admin/terminal/connection-token.js");
var receiptRoute = read("api/admin/send-receipt.js");
var db = read("api/_lib/supabase-admin.js");

assert.match(migration, /alter column stripe_session_id drop not null/i);
assert.match(migration, /payment_source in \('online', 'cash', 'tap_to_pay'\)/);
assert.match(migration, /orders_idempotency_key_unique_idx[\s\S]*where idempotency_key is not null/i);
assert.match(migration, /v_line_total := v_unit_cents::bigint \* v_quantity/);
assert.match(migration, /v_total := v_total \+ v_line_total/);
assert.match(migration, /if v_line_total > 100000000 or v_total > 100000000/);
assert.match(migration, /where idempotency_key = p_idempotency_key[\s\S]*return v_existing/);
assert.match(migration, /record_cash_sales_batch[\s\S]*returns setof public\.orders[\s\S]*security definer/i);
assert.match(migration, /revoke all on function public\._create_in_person_sale[\s\S]*from public/i);
assert.match(migration, /revoke all on function public\.record_in_person_sale[\s\S]*from public, anon, authenticated/i);
assert.match(migration, /grant execute on function public\.record_cash_sales_batch[\s\S]*to service_role/i);
assert.doesNotMatch(migration, /create policy[\s\S]{0,160}for insert/i);

[cashRoute, terminalRoute, tokenRoute, receiptRoute].forEach(function (route) {
  assert.match(route, /auth\.requireActiveAdmin\(req\)/);
});
assert.match(tokenRoute, /location_id:\s*cfg\.locationId/);
assert.doesNotMatch(tokenRoute, /tml_/);
assert.match(read("api/_lib/stripe.js"), /STRIPE_TERMINAL_SECRET_KEY/);
assert.match(
  read("api/_lib/stripe.js"),
  /stripeFormRequest\("terminal\/connection_tokens", params, null, cfg\.secret\)/
);
assert.match(cashRoute, /validation\.normalizeCashBatch\(body\)/);
assert.match(terminalRoute, /stripe\.terminalConfig\(\)[\s\S]*validation\.normalizeSale/);
assert.match(terminalRoute, /db\.recordInPersonSale[\s\S]*stripe\.createTerminalPaymentIntent/);
assert.match(db, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(
  read("scripts/write-public-env.js"),
  /process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET)/
);

console.log("foundation security, arithmetic, idempotency, and auth wiring: ok");
