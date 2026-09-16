/**
 * POST /api/admin/cash-sales
 * Body: { sales: Sale[] } (one sale is valid; maximum 25).
 * The database RPC records the complete batch in one transaction.
 */
"use strict";

var auth = require("../_lib/admin-auth");
var db = require("../_lib/supabase-admin");
var validation = require("../_lib/in-person-validation");
var api = require("../_lib/api-response");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    api.sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    var admin = await auth.requireActiveAdmin(req);
    var body = api.readJsonBody(req);
    var sales = validation.normalizeCashBatch(body);
    var saved = await db.recordCashSalesBatch(admin.id, sales);
    var orders = Array.isArray(saved) ? saved : saved ? [saved] : [];
    api.sendJson(res, 200, {
      orders: orders.map(function (order) {
        return {
          id: order.id,
          payment_source: order.payment_source,
          payment_status: order.payment_status,
          amount_total: order.amount_total,
          sold_at: order.sold_at,
          idempotency_key: order.idempotency_key,
        };
      }),
    });
  } catch (err) {
    var status = api.errorStatus(err);
    console.error("[admin/cash-sales]", {
      code: err && err.code,
      status: status,
      message: err && err.message,
    });
    api.sendJson(res, status, {
      error:
        status < 500 && err && err.message
          ? err.message
          : "Couldn’t record cash sales.",
      code: (err && err.code) || "CASH_SALE_ERROR",
      field: (err && err.field) || undefined,
    });
  }
};
