/**
 * POST /api/create-checkout-session
 *
 * Creates a Stripe Checkout Session (payment mode) using server-side
 * catalog prices from Supabase. Never trusts client-supplied prices.
 *
 * Env (server-only):
 *   STRIPE_SECRET_KEY
 *   SITE_URL
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 * Optional:
 *   STRIPE_ALLOW_LIVE=true  (required before sk_live_ keys will work)
 */
"use strict";

var catalog = require("./_lib/supabase-catalog");
var stripe = require("./_lib/stripe");

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function setCors(req, res) {
  var origin = String(req.headers.origin || "");
  var allowed = stripe.siteUrl();
  var ok =
    !origin ||
    origin === allowed ||
    origin === allowed.replace("https://www.", "https://") ||
    /^https:\/\/([a-z0-9-]+\.)?sandrconcretecrafts\.com$/i.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  if (ok && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeItems(body) {
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body.items)) {
    return body.items.map(function (row) {
      return {
        id: row && (row.id || row.productId || row.product_id),
        quantity: row && row.quantity,
      };
    });
  }
  if (body.productId || body.id || body.product_id) {
    return [
      {
        id: body.productId || body.id || body.product_id,
        quantity: body.quantity == null ? 1 : body.quantity,
      },
    ];
  }
  return [];
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Use POST to start checkout." });
    return;
  }

  if (!stripe.stripeSecretKey()) {
    sendJson(res, 503, {
      error: "Stripe Checkout isn’t configured yet. Demo checkout still works on the site.",
      code: "STRIPE_NOT_CONFIGURED",
    });
    return;
  }

  try {
    var body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body || "{}");
      } catch (e) {
        sendJson(res, 400, { error: "Invalid JSON body." });
        return;
      }
    }
    if (!body || typeof body !== "object") body = {};

    var requested = normalizeItems(body).filter(function (row) {
      return row && row.id;
    });
    if (!requested.length) {
      sendJson(res, 400, {
        error: "Add at least one product before checking out.",
      });
      return;
    }
    if (requested.length > 40) {
      sendJson(res, 400, { error: "Too many items in one checkout." });
      return;
    }

    // Merge duplicate product ids
    var qtyById = {};
    requested.forEach(function (row) {
      var id = String(row.id).trim();
      var q = Number(row.quantity);
      if (!Number.isInteger(q) || q < 1) q = 1;
      qtyById[id] = (qtyById[id] || 0) + q;
    });

    var lineItems = [];
    var metaLines = [];
    var ids = Object.keys(qtyById);

    for (var i = 0; i < ids.length; i++) {
      var productId = ids[i];
      var row = await catalog.fetchPublicProduct(productId);
      var check = catalog.assertPurchasable(row, qtyById[productId]);
      if (!check.ok) {
        sendJson(res, 400, { error: check.error });
        return;
      }

      lineItems.push({
        name: row.title || "Product",
        description: row.description || undefined,
        unitAmountCents: check.unitCents,
        quantity: check.quantity,
        imageUrl: catalog.primaryImageUrl(row),
        productId: productId,
      });
      metaLines.push(productId + ":" + check.quantity);
    }

    var session = await stripe.createCheckoutSession({
      lineItems: lineItems,
      metadata: {
        source: "sandrconcretecrafts",
        item_count: String(lineItems.length),
        // Compact product:qty list for webhook visibility (keep short)
        cart: metaLines.join(",").slice(0, 450),
      },
    });

    if (!session || !session.url) {
      sendJson(res, 502, { error: "Stripe didn’t return a checkout URL." });
      return;
    }

    sendJson(res, 200, {
      url: session.url,
      id: session.id,
    });
  } catch (err) {
    var code = err && err.code;
    if (code === "STRIPE_NOT_CONFIGURED" || code === "STRIPE_LIVE_BLOCKED") {
      var payload = {
        error: err.message || "Stripe isn’t ready.",
        code: code,
      };
      // TEMP: non-secret allow-live snapshot so DevTools Network shows what
      // the function received (never includes Stripe secret keys).
      if (code === "STRIPE_LIVE_BLOCKED" && err.debug) {
        payload.debug = err.debug;
      }
      sendJson(res, 503, payload);
      return;
    }
    console.error("[create-checkout-session]", code || "error", err && err.message);
    sendJson(res, 500, {
      error: "Couldn’t start checkout. Please try again.",
    });
  }
};
