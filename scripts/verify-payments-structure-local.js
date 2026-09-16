#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var read = function (rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
};

var html = read("admin/payments.html");
var js = read("admin/payments.js");
var shell = read("admin/admin-shell.js");
var css = read("admin/admin.css");

assert.match(shell, /\/admin\/payments\.html/);
assert.match(html, /id="singleCashForm"/);
assert.match(html, /id="batchCashForm"/);
assert.match(html, /id="receiptSuccess"/);
assert.match(html, /id="tapCartLines"/);
assert.match(html, /id="takePaymentBtn"[^>]*disabled/);
assert.match(html, /Native App Required/);
assert.match(js, /Authorization:\s*"Bearer " \+ token/);
assert.match(js, /fetch\("\/api\/admin\/cash-sales"/);
assert.match(js, /if \(singleSubmitting\) return/);
assert.match(js, /if \(batchSubmitting\) return/);
assert.match(js, /batchRows\.length >= 25/);
assert.match(js, /unit_amount_cents:\s*cents/);
assert.match(js, /product_id:\s*line\.product\.id/);
assert.match(js, /clearTapCart/);
assert.match(js, /sandrpos:\/\/collect|scheme=sandrpos/);
assert.match(js, /com\.sandrconcretecrafts\.pos/);
assert.doesNotMatch(js, /fetch\("\/api\/admin\/terminal/);
assert.match(css, /\.payment-choice-grid/);
assert.match(css, /\.batch-row/);
assert.match(css, /\.tap-cart-line/);

console.log("payments structure and web/native boundary: ok");
