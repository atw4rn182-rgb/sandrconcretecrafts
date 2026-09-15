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
        finish: row && row.finish != null ? row.finish : "raw",
      };
    });
  }
  if (body.productId || body.id || body.product_id) {
    return [
      {
        id: body.productId || body.id || body.product_id,
        quantity: body.quantity == null ? 1 : body.quantity,
        finish: body.finish == null ? "raw" : body.finish,
      },
    ];
  }
  return [];
}

/** Non-secret allow-live snapshot for error JSON (never includes Stripe keys). */
function allowLiveFields() {
  var d =
    (stripe.stripeAllowLiveDebug && stripe.stripeAllowLiveDebug()) ||
    {
      STRIPE_ALLOW_LIVE: null,
      STRIPE_ALLOW_TRUE: null,
      allowLivePasses: false,
    };
  return {
    STRIPE_ALLOW_LIVE: d.STRIPE_ALLOW_LIVE,
    STRIPE_ALLOW_TRUE: d.STRIPE_ALLOW_TRUE,
    allowLivePasses: !!d.allowLivePasses,
  };
}

function mergeAllowLive(payload) {
  var fields = allowLiveFields();
  payload.STRIPE_ALLOW_LIVE = fields.STRIPE_ALLOW_LIVE;
  payload.STRIPE_ALLOW_TRUE = fields.STRIPE_ALLOW_TRUE;
  payload.allowLivePasses = fields.allowLivePasses;
  return payload;
}

module.exports = async function handler(req, res) {
  try {
    setCors(req, res);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, mergeAllowLive({ error: "Use POST to start checkout." }));
      return;
    }

    if (!stripe.stripeSecretKey()) {
      sendJson(
        res,
        503,
        mergeAllowLive({
          error:
            "Stripe Checkout isn’t configured yet. Demo checkout still works on the site.",
          code: "STRIPE_NOT_CONFIGURED",
        })
      );
      return;
    }

    var body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body || "{}");
      } catch (e) {
        sendJson(res, 400, mergeAllowLive({ error: "Invalid JSON body." }));
        return;
      }
    }
    if (!body || typeof body !== "object") body = {};

    var requested = normalizeItems(body).filter(function (row) {
      return row && row.id;
    });
    if (!requested.length) {
      sendJson(
        res,
        400,
        mergeAllowLive({
          error: "Add at least one product before checking out.",
        })
      );
      return;
    }
    if (requested.length > 40) {
      sendJson(
        res,
        400,
        mergeAllowLive({ error: "Too many items in one checkout." })
      );
      return;
    }

    // Merge duplicate product+finish lines. A product may appear once per finish.
    var variants = [];
    requested.forEach(function (row) {
      var id = String(row.id).trim();
      var finish = String(row.finish == null ? "raw" : row.finish)
        .trim()
        .toLowerCase();
      var q = Number(row.quantity);
      if (!Number.isInteger(q) || q < 1) q = 1;
      var existing = variants.find(function (item) {
        return item.id === id && item.finish === finish;
      });
      if (existing) existing.quantity += q;
      else variants.push({ id: id, finish: finish, quantity: q });
    });

    var lineItems = [];
    var metaLines = [];
    var productCache = Object.create(null);
    var totalById = Object.create(null);
    variants.forEach(function (item) {
      totalById[item.id] = (totalById[item.id] || 0) + item.quantity;
    });

    var ids = Object.keys(totalById);
    for (var i = 0; i < ids.length; i++) {
      var inventoryProductId = ids[i];
      var inventoryRow = await catalog.fetchPublicProduct(inventoryProductId);
      productCache[inventoryProductId] = inventoryRow;
      var inventoryCheck = catalog.assertPurchasable(
        inventoryRow,
        totalById[inventoryProductId],
        "raw"
      );
      if (!inventoryCheck.ok) {
        sendJson(res, 400, mergeAllowLive({ error: inventoryCheck.error }));
        return;
      }
    }

    for (var j = 0; j < variants.length; j++) {
      var variant = variants[j];
      var productId = variant.id;
      var row = productCache[productId];
      var check = catalog.assertPurchasable(
        row,
        variant.quantity,
        variant.finish
      );
      if (!check.ok) {
        sendJson(res, 400, mergeAllowLive({ error: check.error }));
        return;
      }

      var finishLabel = check.finish === "painted" ? "Painted" : "Raw Concrete";
      lineItems.push({
        name: row.title || "Product",
        description:
          "Finish: " +
          finishLabel +
          (row.description ? " · " + String(row.description).slice(0, 440) : ""),
        unitAmountCents: check.unitCents,
        quantity: check.quantity,
        imageUrl: catalog.primaryImageUrl(row),
        productId: productId,
        finish: check.finish,
      });
      metaLines.push(productId + ":" + check.finish + ":" + check.quantity);
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
      sendJson(
        res,
        502,
        mergeAllowLive({ error: "Stripe didn’t return a checkout URL." })
      );
      return;
    }

    sendJson(res, 200, {
      url: session.url,
      id: session.id,
    });
  } catch (err) {
    var code = err && err.code;
    var message = (err && err.message) || String(err);

    console.error("[create-checkout-session] exception", {
      code: code || null,
      message: message,
      name: err && err.name,
      status: err && err.status,
      stack: err && err.stack,
      allowLive: allowLiveFields(),
    });

    // Live-key safety gate — always 503 with flat allow-live fields (never generic).
    if (code === "STRIPE_LIVE_BLOCKED") {
      var liveDebug = (err && err.debug) || allowLiveFields();
      sendJson(
        res,
        503,
        {
          error: message || "Live payments aren’t enabled on the server yet.",
          code: "STRIPE_LIVE_BLOCKED",
          STRIPE_ALLOW_LIVE: liveDebug.STRIPE_ALLOW_LIVE,
          STRIPE_ALLOW_TRUE: liveDebug.STRIPE_ALLOW_TRUE,
          allowLivePasses: !!liveDebug.allowLivePasses,
        }
      );
      return;
    }

    if (code === "STRIPE_NOT_CONFIGURED") {
      sendJson(
        res,
        503,
        mergeAllowLive({
          error: message || "Stripe isn’t ready.",
          code: "STRIPE_NOT_CONFIGURED",
        })
      );
      return;
    }

    // Unexpected errors (incl. STRIPE_API_ERROR): still return JSON + allow-live debug.
    sendJson(
      res,
      500,
      mergeAllowLive({
        error: "Couldn’t start checkout. Please try again.",
        code: code || "CHECKOUT_ERROR",
        detail: message,
      })
    );
  }
};
