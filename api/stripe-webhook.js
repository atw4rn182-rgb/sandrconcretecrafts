/**
 * POST /api/stripe-webhook
 *
 * Verifies Stripe signatures with STRIPE_WEBHOOK_SECRET (server-only).
 * On checkout.session.completed, upserts an order + line items via
 * SUPABASE_SERVICE_ROLE_KEY (never exposed to the browser / js/env.js).
 */
"use strict";

var stripe = require("./_lib/stripe");
var adminDb = require("./_lib/supabase-admin");

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function pickAddress(session) {
  var shipping =
    (session &&
      session.collected_information &&
      session.collected_information.shipping_details) ||
    (session && session.shipping_details) ||
    null;
  var billing =
    (session && session.customer_details && session.customer_details.address) ||
    null;
  var name =
    (shipping && shipping.name) ||
    (session && session.customer_details && session.customer_details.name) ||
    null;
  var address = (shipping && shipping.address) || billing || null;
  if (!address && !name) {
    return {
      shipping_name: null,
      shipping_line1: null,
      shipping_line2: null,
      shipping_city: null,
      shipping_state: null,
      shipping_postal_code: null,
      shipping_country: null,
      shipping_address: null,
    };
  }
  return {
    shipping_name: name || null,
    shipping_line1: address && address.line1 ? address.line1 : null,
    shipping_line2: address && address.line2 ? address.line2 : null,
    shipping_city: address && address.city ? address.city : null,
    shipping_state: address && address.state ? address.state : null,
    shipping_postal_code:
      address && address.postal_code ? address.postal_code : null,
    shipping_country: address && address.country ? address.country : null,
    shipping_address: address || null,
  };
}

function parseCartMetadata(cartMeta) {
  var lines = [];
  String(cartMeta || "")
    .split(",")
    .forEach(function (part) {
      var bits = String(part || "").split(":");
      if (bits.length < 2) return;
      var id = bits[0].trim();
      var finish = bits.length >= 3 ? bits[1].trim().toLowerCase() : null;
      var qty = Number(bits.length >= 3 ? bits[2] : bits[1]);
      if (!id || !Number.isInteger(qty) || qty < 1) return;
      if (finish !== "raw" && finish !== "painted") finish = null;
      lines.push({ id: id, finish: finish, quantity: qty });
    });
  return lines;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function lineItemsFromSession(session, cartLines, retrievedLineItems) {
  var data =
    (Array.isArray(retrievedLineItems) && retrievedLineItems) ||
    (session &&
      session.line_items &&
      Array.isArray(session.line_items.data) &&
      session.line_items.data) ||
    [];
  var fallbackLines = Array.isArray(cartLines) ? cartLines : [];

  if (data.length) {
    return data.map(function (li, index) {
      var product = li.price && li.price.product;
      var fallback = fallbackLines[index] || {};
      var metaId =
        product &&
        typeof product === "object" &&
        product.metadata &&
        product.metadata.product_id
          ? product.metadata.product_id
          : null;
      if (!metaId && fallback.id) metaId = fallback.id;
      var finish =
        product &&
        typeof product === "object" &&
        product.metadata &&
        product.metadata.finish
          ? String(product.metadata.finish).toLowerCase()
          : fallback.finish || null;
      if (finish !== "raw" && finish !== "painted") finish = null;
      var qty = Number(li.quantity) || 1;
      var amountTotal =
        li.amount_total != null
          ? Number(li.amount_total)
          : Number(li.amount_subtotal) || 0;
      var unitAmount =
        li.price && li.price.unit_amount != null
          ? Number(li.price.unit_amount)
          : qty > 0
            ? Math.round(amountTotal / qty)
            : null;
      return {
        product_id: isUuid(metaId) ? metaId : null,
        product_name: li.description || (product && product.name) || "Item",
        finish: finish,
        quantity: qty,
        unit_amount: isFinite(unitAmount) ? unitAmount : null,
        amount_total: isFinite(amountTotal) ? amountTotal : 0,
      };
    });
  }

  // Fallback when line items were not expanded: metadata.cart only.
  return fallbackLines.map(function (line) {
    return {
      product_id: isUuid(line.id) ? line.id : null,
      product_name: "Item",
      finish: line.finish || null,
      quantity: line.quantity,
      unit_amount: null,
      amount_total: 0,
    };
  });
}

async function handleCheckoutCompleted(sessionStub, eventType) {
  var sessionId = sessionStub && sessionStub.id;
  if (!sessionId) {
    throw new Error("Checkout session id missing.");
  }

  // Re-fetch with expansions so we have line items + product metadata.
  var session = await stripe.retrieveCheckoutSession(sessionId);
  var retrievedLineItems =
    await stripe.retrieveCheckoutSessionLineItems(sessionId);
  var details = session.customer_details || {};
  var ship = pickAddress(session);
  var paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent && session.payment_intent.id
        ? session.payment_intent.id
        : null;

  var paymentStatus = session.payment_status;
  if (!paymentStatus) {
    paymentStatus =
      eventType === "checkout.session.async_payment_failed"
        ? "unpaid"
        : "paid";
  }

  var order = {
    stripe_session_id: session.id,
    stripe_payment_intent: paymentIntent,
    payment_status: paymentStatus,
    amount_total: Number(session.amount_total) || 0,
    currency: String(session.currency || "usd").toLowerCase(),
    customer_name: details.name || ship.shipping_name || null,
    customer_email: details.email || session.customer_email || null,
    customer_phone: details.phone || null,
    shipping_name: ship.shipping_name,
    shipping_line1: ship.shipping_line1,
    shipping_line2: ship.shipping_line2,
    shipping_city: ship.shipping_city,
    shipping_state: ship.shipping_state,
    shipping_postal_code: ship.shipping_postal_code,
    shipping_country: ship.shipping_country,
    shipping_address: ship.shipping_address,
    // Do NOT set fulfillment_* here: DB defaults apply on INSERT, and
    // webhook retries must not reset an admin's shipped/completed status.
    metadata: {
      cart: (session.metadata && session.metadata.cart) || null,
      source: (session.metadata && session.metadata.source) || null,
      event_type: eventType || null,
    },
  };

  var cartLines = parseCartMetadata(session.metadata && session.metadata.cart);
  var items = lineItemsFromSession(session, cartLines, retrievedLineItems);

  var saved = await adminDb.upsertOrderWithItems(order, items);

  console.log("[stripe-webhook] order upserted", {
    order_id: saved.id,
    session_id: session.id,
    payment_status: order.payment_status,
    amount_total: order.amount_total,
    item_count: items.length,
    event_type: eventType || null,
  });

  return saved;
}

function paymentIntentIdFrom(obj) {
  if (!obj) return null;
  if (typeof obj.payment_intent === "string") return obj.payment_intent;
  if (obj.payment_intent && obj.payment_intent.id) return obj.payment_intent.id;
  return null;
}

async function handleChargeRefunded(charge) {
  var pi = paymentIntentIdFrom(charge) || (charge && charge.payment_intent);
  if (!pi || typeof pi !== "string") {
    console.log("[stripe-webhook] charge.refunded without payment_intent — skipped");
    return null;
  }
  var amount = Number(charge.amount) || 0;
  var refunded = Number(charge.amount_refunded) || 0;
  var status =
    amount > 0 && refunded >= amount
      ? "refunded"
      : refunded > 0
        ? "partially_refunded"
        : "paid";
  var updated = await adminDb.updateOrderPaymentStatusByPaymentIntent(pi, status);
  console.log("[stripe-webhook] refund status update", {
    payment_intent: pi,
    payment_status: status,
    order_id: updated && updated.id,
  });
  return updated;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  var webhookSecret = stripe.env("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    sendJson(res, 503, { error: "Webhook is not configured." });
    return;
  }

  try {
    var rawBody = await stripe.readRawBody(req);
    var signature = req.headers["stripe-signature"];
    var event = stripe.constructEvent(rawBody, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
        await handleCheckoutCompleted(event.data && event.data.object, event.type);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data && event.data.object);
        break;
      default:
        console.log("[stripe-webhook] ignored event type:", event.type);
        break;
    }

    sendJson(res, 200, { received: true });
  } catch (err) {
    var code = err && err.code;
    console.error(
      "[stripe-webhook]",
      code || "error",
      err && err.message ? String(err.message).slice(0, 160) : "failed"
    );
    if (
      code === "STRIPE_SIGNATURE_MISSING" ||
      code === "STRIPE_SIGNATURE_INVALID" ||
      code === "STRIPE_SIGNATURE_MISMATCH" ||
      code === "STRIPE_SIGNATURE_TOLERANCE"
    ) {
      sendJson(res, 400, { error: "Invalid signature." });
      return;
    }
    if (code === "SUPABASE_SERVICE_NOT_CONFIGURED") {
      sendJson(res, 503, { error: "Order storage is not configured." });
      return;
    }
    // Return 500 so Stripe retries transient DB failures.
    sendJson(res, 500, { error: "Webhook handler failed." });
  }
};
