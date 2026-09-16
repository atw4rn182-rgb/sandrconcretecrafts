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
assert.match(html, /Enter Amount/);
assert.match(html, /id="quickAmount"[^>]*inputmode="decimal"/);
assert.match(html, /Sale note \(optional\)/);
assert.match(html, /id="quickSaleNote"/);
assert.match(html, /<details class="tap-catalog-details" id="tapCatalogDetails">/);
assert.match(html, /Select Products from Website/);
assert.match(html, /Cart Total:/);
assert.doesNotMatch(html, /id="tapCatalogDetails"[^>]*\sopen\b/);
assert.ok(
  html.indexOf("Enter Amount") < html.indexOf("Select Products from Website"),
  "Enter Amount stays above website products"
);
assert.ok(
  html.indexOf('id="quickAmount"') < html.indexOf('id="tapCatalogDetails"'),
  "amount field stays above the collapsed catalog"
);
assert.ok(
  html.indexOf("Enter Amount") < html.indexOf('id="posAppCard"'),
  "quick amount stays above the installer card"
);
assert.match(html, /id="posAppCard"/);
assert.match(html, /Install S&amp;R Tap to Pay/);
assert.match(html, /Open S&amp;R Tap to Pay/);
assert.match(html, /TEST VERSION — Simulated payments only/);
assert.match(html, /Customers do not install an app/);
assert.match(html, /Downloaded\? Open the file and tap Install/);
assert.match(html, /Install unknown apps/);
assert.match(js, /Authorization:\s*"Bearer " \+ token/);
assert.match(js, /fetch\("\/api\/admin\/cash-sales"/);
assert.match(js, /\/api\/admin\/pos-app\?download=1/);
assert.match(js, /\/api\/admin\/pos-app-file/);
assert.match(js, /location\.assign\(body\.download_url\)/);
assert.match(js, /intent:\/\/collect#Intent;scheme=sandrpos/);
assert.match(js, /if \(singleSubmitting\) return/);
assert.match(js, /if \(batchSubmitting\) return/);
assert.match(js, /batchRows\.length >= 25/);
assert.match(js, /unit_amount_cents:\s*cents/);
assert.match(js, /sale_note:\s*note/);
assert.match(js, /tapMode === "catalog"/);
assert.match(js, /tapMode = "quick"/);
assert.match(js, /name: \(note \|\| "Quick sale"\)/);
assert.match(js, /if \(amount\) amount\.value = ""/);
assert.match(js, /productCents\(line\.product, line\.finish\)/);
assert.match(js, /product_id:\s*line\.product\.id/);
assert.match(js, /clearTapCart/);
assert.match(js, /sandrpos:\/\/collect|scheme=sandrpos/);
assert.match(js, /com\.sandrconcretecrafts\.pos/);
assert.doesNotMatch(js, /github\.com\/.*\/releases/);
assert.doesNotMatch(js, /fetch\("\/api\/admin\/terminal/);
assert.doesNotMatch(js, /client_secret/);
assert.doesNotMatch(js, /tapCartTotal\(\)\s*\+\s*quickAmountCents/);
assert.match(css, /\.payment-choice-grid/);
assert.match(css, /\.batch-row/);
assert.match(css, /\.tap-cart-line/);
assert.match(css, /\.pos-app-card/);
assert.match(css, /\.pos-app-badge--test/);
assert.match(css, /\.pos-app-badge--live/);
assert.match(css, /\.tap-amount-input/);
assert.match(css, /\.tap-catalog-details/);
assert.match(css, /\.tap-take-payment/);

function parseCents(raw) {
  var text = String(raw == null ? "" : raw)
    .trim()
    .replace(/\$/g, "")
    .replace(/,/g, "");
  if (!/^\d+(?:\.\d{0,2})?$/.test(text)) return null;
  var value = Number(text);
  if (!isFinite(value)) return null;
  var cents = Math.round(value * 100);
  return cents >= 1 && cents <= 1000000 ? cents : null;
}

assert.match(js, /if \(!\/\^\\d\+\(\?:\\\.\\d\{0,2\}\)\?\$\/\.test\(text\)\) return null;/);
assert.match(js, /return cents >= 1 && cents <= 1000000 \? cents : null;/);
assert.strictEqual(parseCents("1.00"), 100);
assert.strictEqual(parseCents("$1.00"), 100);
assert.strictEqual(parseCents("12.50"), 1250);
assert.strictEqual(parseCents("40.00"), 4000);
assert.strictEqual(parseCents("0"), null);
assert.strictEqual(parseCents("0.00"), null);
assert.strictEqual(parseCents("-1"), null);
assert.strictEqual(parseCents("-12.50"), null);
assert.strictEqual(parseCents("abc"), null);
assert.strictEqual(parseCents("12.5.0"), null);
assert.strictEqual(parseCents(""), null);

console.log("payments structure and web/native boundary: ok");
