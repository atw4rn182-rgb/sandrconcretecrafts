/**
 * Authenticated, post-sale receipt delivery.
 * The order, payment state, totals, and lines are always loaded server-side.
 */
"use strict";

var auth = require("../_lib/admin-auth");
var api = require("../_lib/api-response");
var db = require("../_lib/supabase-admin");
var receipt = require("../_lib/receipt");
var resend = require("../_lib/resend");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    api.sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    await auth.requireActiveAdmin(req);
    var body = api.readJsonBody(req);
    var orderId = String(body.order_id || "").trim();
    var email = receipt.validEmail(body.email);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
      var invalidOrder = new Error("Choose a valid paid order.");
      invalidOrder.code = "INVALID_ORDER";
      invalidOrder.status = 400;
      throw invalidOrder;
    }
    if (!email) {
      var invalidEmail = new Error("Enter a valid receipt email address.");
      invalidEmail.code = "INVALID_RECEIPT_EMAIL";
      invalidEmail.status = 400;
      throw invalidEmail;
    }

    var order = await db.getPaidOrderForReceipt(orderId);
    if (!order) {
      var missing = new Error("That paid order was not found.");
      missing.code = "PAID_ORDER_NOT_FOUND";
      missing.status = 404;
      throw missing;
    }
    if (order.receipt_sent_at) {
      api.sendJson(res, 200, {
        status: "already_sent",
        order_id: order.id,
        email: order.receipt_email,
        sent_at: order.receipt_sent_at,
      });
      return;
    }

    var content = receipt.buildReceipt(order);
    var sent = await resend.sendReceipt(
      {
        to: email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      },
      "receipt-" + order.id
    );

    // This is deliberately after provider success. A failed update does not
    // affect the paid sale; provider idempotency prevents a duplicate retry.
    var updated = await db.markReceiptSent(order.id, email, sent.id);
    if (!updated) {
      var latest = await db.getPaidOrderForReceipt(order.id);
      if (!latest || !latest.receipt_sent_at) {
        var tracking = new Error(
          "The receipt was sent, but its status could not be saved. Keep the order and contact your web helper before retrying."
        );
        tracking.code = "RECEIPT_TRACKING_ERROR";
        tracking.status = 502;
        throw tracking;
      }
      updated = latest;
    }
    api.sendJson(res, 200, {
      status: "sent",
      order_id: order.id,
      email: updated.receipt_email,
      sent_at: updated.receipt_sent_at,
    });
  } catch (err) {
    var status = api.errorStatus(err);
    console.error("[admin/send-receipt]", {
      code: err && err.code,
      status: status,
      message: err && err.message,
    });
    api.sendJson(res, status, {
      error:
        status < 500 || (err && err.code === "RECEIPT_NOT_CONFIGURED")
          ? err.message
          : "The receipt could not be sent. The sale is still safely recorded.",
      code: (err && err.code) || "RECEIPT_ERROR",
    });
  }
};
