#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var read = function (rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
};

var route = read("api/admin/send-receipt.js");
var provider = read("api/_lib/resend.js");
var db = read("api/_lib/supabase-admin.js");
var ui = read("admin/payments.js");
var env = read(".env.example");

assert.match(route, /auth\.requireActiveAdmin\(req\)/);
assert.match(route, /db\.getPaidOrderForReceipt\(orderId\)/);
assert.match(route, /if \(order\.receipt_sent_at\)/);
assert.ok(
  route.indexOf("resend.sendReceipt") < route.indexOf("db.markReceiptSent"),
  "delivery must succeed before receipt tracking is updated"
);
assert.match(route, /sale is still safely recorded/i);
assert.match(provider, /Idempotency-Key/);
assert.match(provider, /RESEND_API_KEY/);
assert.match(provider, /RECEIPT_FROM_EMAIL/);
assert.match(provider, /RECEIPT_REPLY_TO_EMAIL/);
assert.match(provider, /RECEIPT_BCC_EMAIL/);
assert.match(db, /payment_status=eq\.paid&receipt_sent_at=is\.null/);
assert.match(ui, /The sale is still safely recorded/i);
["RESEND_API_KEY", "RECEIPT_FROM_EMAIL", "RECEIPT_REPLY_TO_EMAIL", "RECEIPT_BCC_EMAIL"].forEach(
  function (name) {
    assert.match(env, new RegExp("^" + name + "=", "m"));
  }
);

console.log("receipt configuration and paid-sale failure isolation: ok");
