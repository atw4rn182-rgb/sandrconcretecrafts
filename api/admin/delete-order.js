/**
 * POST /api/admin/delete-order
 * Body: { order_id }. Deletes one order and cascaded line items.
 * Does not delete customers. Service-role RPC only.
 */
"use strict";

var auth = require("../_lib/admin-auth");
var db = require("../_lib/supabase-admin");
var api = require("../_lib/api-response");

var UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    api.sendJson(res, 405, { error: "Method not allowed." });
    return;
  }
  try {
    var admin = await auth.requireActiveAdmin(req);
    var body = api.readJsonBody(req) || {};
    var orderId = String(body.order_id || "").trim();
    if (!UUID_RE.test(orderId)) {
      api.sendJson(res, 400, { error: "A valid order id is required.", code: "INVALID_ORDER" });
      return;
    }
    await db.deleteAdminOrder(admin.id, orderId);
    api.sendJson(res, 200, { ok: true, order_id: orderId });
  } catch (err) {
    var status = api.errorStatus(err);
    console.error("[admin/delete-order]", {
      code: err && err.code,
      status: status,
      message: err && err.message,
    });
    api.sendJson(res, status, {
      error:
        status < 500 && err && err.message
          ? err.message
          : "Couldn’t delete that order.",
      code: (err && err.code) || "DELETE_ORDER_ERROR",
    });
  }
};
