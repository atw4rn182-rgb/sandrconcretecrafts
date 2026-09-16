"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");

require("./sales-lib");

test("sales totals use sold_at with created_at fallback across sources", function () {
  var now = new Date("2026-09-16T18:00:00");
  var orders = [
    {
      id: "cash",
      payment_status: "paid",
      payment_source: "cash",
      amount_total: 2500,
      sold_at: "2026-09-16T12:00:00",
      created_at: "2025-01-01T12:00:00",
    },
    {
      id: "online",
      payment_status: "paid",
      amount_total: 1500,
      created_at: "2026-09-16T13:00:00",
    },
    {
      id: "unpaid",
      payment_status: "unpaid",
      payment_source: "tap_to_pay",
      amount_total: 9999,
      sold_at: "2026-09-16T14:00:00",
    },
  ];
  var snapshot = globalThis.SRSales.buildSalesSnapshot(orders, now);
  assert.equal(snapshot.revenue.today, 4000);
  assert.equal(snapshot.orderCounts.all, 2);
  assert.equal(globalThis.SRSales.paymentSource(orders[1]), "online");
  assert.equal(
    globalThis.SRSales.seriesDaily(orders, 1, now, "cash")[0].cents,
    2500
  );
});

test("customer aggregation excludes only fully anonymous paid sales", function () {
  var customers = globalThis.SRSales.aggregateCustomers([
    {
      id: "anonymous",
      payment_status: "paid",
      amount_total: 100,
      sold_at: "2026-09-15T12:00:00Z",
    },
    {
      id: "named",
      payment_status: "paid",
      payment_source: "cash",
      customer_name: "Rachel",
      amount_total: 200,
      sold_at: "2026-09-16T12:00:00Z",
    },
  ]);
  assert.equal(customers.length, 1);
  assert.equal(customers[0].name, "Rachel");
  assert.equal(customers[0].total_spent_cents, 200);
});
