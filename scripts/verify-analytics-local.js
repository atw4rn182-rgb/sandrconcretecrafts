#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var read = function (rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
};

delete globalThis.SRSales;
require(path.join(root, "admin/sales-lib.js"));

var now = new Date("2026-09-16T18:00:00");
var rows = [
  { payment_status: "paid", payment_source: "cash", amount_total: 2500, sold_at: "2026-09-16T12:00:00" },
  { payment_status: "paid", payment_source: "tap_to_pay", amount_total: 3000, sold_at: "2026-09-16T13:00:00" },
  { payment_status: "paid", amount_total: 1500, created_at: "2026-09-16T14:00:00" },
  { payment_status: "unpaid", payment_source: "tap_to_pay", amount_total: 9000, sold_at: "2026-09-16T15:00:00" },
];
var sales = globalThis.SRSales;
var snapshot = sales.buildSalesSnapshot(rows, now);

assert.strictEqual(snapshot.revenue.today, 7000);
assert.strictEqual(snapshot.orderCounts.all, 3);
assert.strictEqual(sales.paymentSource(rows[2]), "online");
assert.strictEqual(sales.seriesDaily(rows, 1, now, "cash")[0].cents, 2500);
assert.strictEqual(sales.seriesDaily(rows, 1, now, "tap_to_pay")[0].cents, 3000);
assert.strictEqual(sales.seriesDaily(rows, 1, now, "online")[0].cents, 1500);

var api = read("admin/catalog-api.js");
var dashboard = read("admin/dashboard.js");
assert.match(api, /payment_source, sold_at, amount_total/);
assert.match(api, /new Date\(b\.sold_at \|\| b\.created_at\)/);
assert.match(dashboard, /data-chart-source|chartSource/);
assert.match(dashboard, /SRSales\.seriesDaily/);
assert.match(dashboard, /SRSales\.seriesMonthly/);

console.log("analytics sources, paid-only totals, and authoritative timestamps: ok");
