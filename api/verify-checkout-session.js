"use strict";

const stripe = require("./_lib/stripe");

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { verified: false, error: "Method not allowed." });
    return;
  }

  try {
    var sessionId = new URL(
      req.url || "/",
      "https://local.invalid"
    ).searchParams.get("session_id");
    sessionId = String(sessionId || "").trim();
    if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      sendJson(res, 400, {
        verified: false,
        error: "Missing or invalid Checkout Session.",
      });
      return;
    }

    var session = await stripe.retrieveCheckoutSession(sessionId);
    var paid =
      session &&
      (session.payment_status === "paid" ||
        session.payment_status === "no_payment_required");
    var fromStorefront =
      session &&
      session.metadata &&
      session.metadata.source === "storefront";

    if (!paid || !fromStorefront) {
      sendJson(res, 409, {
        verified: false,
        error: "Payment has not been verified.",
      });
      return;
    }

    sendJson(res, 200, { verified: true });
  } catch (err) {
    console.error("[verify-checkout-session]", {
      code: err && err.code,
      message: err && err.message,
    });
    sendJson(res, 500, {
      verified: false,
      error: "Couldn’t verify payment yet. Your cart was kept.",
    });
  }
};
