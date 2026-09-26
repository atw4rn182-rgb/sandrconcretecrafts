/**
 * POST /api/admin/terminal/payment-intent
 *
 * Creates an authoritative unpaid tap-to-pay order, then a card_present
 * PaymentIntent for that exact amount. Stripe and database idempotency make a
 * safe retry converge on the same order/payment.
 */
"use strict";

var auth = require("../../_lib/admin-auth");
var db = require("../../_lib/supabase-admin");
var stripe = require("../../_lib/stripe");
var validation = require("../../_lib/in-person-validation");
var tapTotal = require("../../_lib/tap-total");
var api = require("../../_lib/api-response");

function one(value) {
  return Array.isArray(value) ? value[0] : value;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    api.sendJson(res, 405, { error: "Method not allowed." });
    return;
  }
  try {
    var admin = await auth.requireActiveAdmin(req);
    var cfg = stripe.terminalConfig();
    var body = api.readJsonBody(req);
    if (body && body.simulated === true && cfg.mode === "live") {
      var mismatch = new Error(
        "This TEST app can only simulate payments against a TEST Terminal backend. Online Checkout was not changed."
      );
      mismatch.code = "TERMINAL_MODE_MISMATCH";
      mismatch.status = 409;
      throw mismatch;
    }
    console.log("[admin/terminal/payment-intent]", {
      mode: cfg.mode,
      livemode: cfg.mode === "live",
    });
    var sale = validation.normalizeSale(body);
    var order = one(await db.recordInPersonSale(admin.id, "tap_to_pay", sale));
    if (!order || !order.id || !Number.isSafeInteger(Number(order.amount_total))) {
      throw new Error("Terminal order creation returned an invalid result.");
    }
    var amount = tapTotal.assertClientTotalMatchesOrder(sale, order);

    var intent = await stripe.createTerminalPaymentIntent({
      amount: amount,
      orderId: order.id,
      idempotencyKey: sale.idempotency_key,
      description: "S&R Concrete Crafts in-person sale",
    });
    if (
      !intent ||
      !/^pi_[A-Za-z0-9_]+$/.test(String(intent.id || "")) ||
      !intent.client_secret
    ) {
      throw new Error("Stripe returned an invalid PaymentIntent.");
    }
    await db.attachTerminalPaymentIntent(order.id, admin.id, intent.id);
    api.sendJson(res, 200, {
      order_id: order.id,
      payment_intent_id: intent.id,
      client_secret: intent.client_secret,
      amount: Number(order.amount_total),
      currency: "usd",
    });
  } catch (err) {
    var status = api.errorStatus(err);
    console.error("[admin/terminal/payment-intent]", {
      code: err && err.code,
      status: status,
      message: err && err.message,
    });
    api.sendJson(res, status, {
      error:
        status < 500 && err && err.message
          ? err.message
          : "Couldn’t prepare the Terminal payment.",
      code: (err && err.code) || "TERMINAL_PAYMENT_ERROR",
      field: (err && err.field) || undefined,
    });
  }
};
