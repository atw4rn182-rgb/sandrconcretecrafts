/**
 * POST /api/stripe-terminal-webhook
 *
 * Uses a webhook secret separate from hosted Checkout. Only a signed,
 * succeeded PaymentIntent can confirm an already-known tap_to_pay order.
 */
"use strict";

var stripe = require("./_lib/stripe");
var db = require("./_lib/supabase-admin");
var api = require("./_lib/api-response");

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    api.sendJson(res, 405, { error: "Method not allowed." });
    return;
  }
  var secret = stripe.env("STRIPE_TERMINAL_WEBHOOK_SECRET");
  if (!secret) {
    api.sendJson(res, 503, { error: "Terminal webhook is not configured." });
    return;
  }
  try {
    var raw = await stripe.readRawBody(req);
    var event = stripe.constructEvent(
      raw,
      req.headers["stripe-signature"],
      secret
    );
    if (event.type !== "payment_intent.succeeded") {
      api.sendJson(res, 200, { received: true, ignored: true });
      return;
    }
    var intent = event.data && event.data.object;
    var id = String((intent && intent.id) || "");
    var amount = Number(
      intent && intent.amount_received != null
        ? intent.amount_received
        : intent && intent.amount
    );
    var currency = String((intent && intent.currency) || "").toLowerCase();
    if (
      !/^pi_[A-Za-z0-9_]+$/.test(id) ||
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      currency !== "usd"
    ) {
      throw new Error("Succeeded PaymentIntent payload is invalid.");
    }
    var updated = await db.confirmTapToPayPayment(id, amount, currency);
    api.sendJson(res, 200, {
      received: true,
      updated: !!(updated && (updated.id || (updated[0] && updated[0].id))),
    });
  } catch (err) {
    var code = err && err.code;
    console.error("[stripe-terminal-webhook]", {
      code: code,
      message: err && err.message,
    });
    if (
      code === "STRIPE_SIGNATURE_MISSING" ||
      code === "STRIPE_SIGNATURE_INVALID" ||
      code === "STRIPE_SIGNATURE_MISMATCH" ||
      code === "STRIPE_SIGNATURE_TOLERANCE"
    ) {
      api.sendJson(res, 400, { error: "Invalid signature." });
      return;
    }
    api.sendJson(res, 500, { error: "Terminal webhook handler failed." });
  }
};
