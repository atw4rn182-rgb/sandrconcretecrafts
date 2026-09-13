/**
 * Minimal Stripe REST helpers (no npm stripe SDK).
 * Secrets come only from process.env — never from the browser.
 */
"use strict";

var crypto = require("crypto");

function env(name) {
  return String(process.env[name] || "").trim();
}

function envFlagTrue() {
  // Prefer the canonical Vercel name; keep STRIPE_ALLOW_TRUE as a typo/alias.
  var names = Array.prototype.slice.call(arguments);
  for (var i = 0; i < names.length; i++) {
    var raw = env(names[i]);
    if (raw && raw.toLowerCase() === "true") return true;
  }
  return false;
}

function stripeLiveAllowed() {
  return envFlagTrue("STRIPE_ALLOW_LIVE", "STRIPE_ALLOW_TRUE");
}

function stripeSecretKey() {
  return env("STRIPE_SECRET_KEY");
}

function siteUrl() {
  var raw = env("SITE_URL") || "https://www.sandrconcretecrafts.com";
  return raw.replace(/\/$/, "");
}

function appendForm(params, key, value) {
  if (value == null) return;
  params.append(key, String(value));
}

/**
 * Create a Checkout Session (payment mode) via Stripe API.
 * @param {object} input
 * @param {Array<{name:string,description?:string,unitAmountCents:number,quantity:number,imageUrl?:string|null}>} input.lineItems
 * @param {object} [input.metadata]
 */
async function createCheckoutSession(input) {
  var secret = stripeSecretKey();
  if (!secret) {
    var err = new Error("Stripe isn’t configured on the server yet.");
    err.code = "STRIPE_NOT_CONFIGURED";
    throw err;
  }
  // Block live secret / restricted keys until STRIPE_ALLOW_LIVE=true.
  if (/^(sk_live_|rk_live_)/.test(secret)) {
    if (!stripeLiveAllowed()) {
      var liveErr = new Error(
        "Live Stripe keys are blocked. In Vercel set STRIPE_ALLOW_LIVE=true (Production, available to Functions), then redeploy."
      );
      liveErr.code = "STRIPE_LIVE_BLOCKED";
      throw liveErr;
    }
  }

  var params = new URLSearchParams();
  appendForm(params, "mode", "payment");
  appendForm(
    params,
    "success_url",
    siteUrl() + "/?checkout=success&session_id={CHECKOUT_SESSION_ID}"
  );
  appendForm(params, "cancel_url", siteUrl() + "/?checkout=cancel");
  appendForm(params, "billing_address_collection", "auto");
  appendForm(params, "phone_number_collection[enabled]", "true");
  appendForm(params, "shipping_address_collection[allowed_countries][0]", "US");

  (input.lineItems || []).forEach(function (item, i) {
    var prefix = "line_items[" + i + "]";
    appendForm(params, prefix + "[quantity]", item.quantity);
    appendForm(params, prefix + "[price_data][currency]", "usd");
    appendForm(
      params,
      prefix + "[price_data][unit_amount]",
      item.unitAmountCents
    );
    appendForm(
      params,
      prefix + "[price_data][product_data][name]",
      item.name
    );
    if (item.productId) {
      appendForm(
        params,
        prefix + "[price_data][product_data][metadata][product_id]",
        item.productId
      );
    }
    if (item.description) {
      appendForm(
        params,
        prefix + "[price_data][product_data][description]",
        String(item.description).slice(0, 500)
      );
    }
    if (item.imageUrl) {
      appendForm(
        params,
        prefix + "[price_data][product_data][images][0]",
        item.imageUrl
      );
    }
  });

  var meta = input.metadata || {};
  Object.keys(meta).forEach(function (key) {
    if (meta[key] == null) return;
    appendForm(params, "metadata[" + key + "]", meta[key]);
  });

  var res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + secret,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  var body = await res.json().catch(function () {
    return null;
  });

  if (!res.ok) {
    var message =
      (body && body.error && body.error.message) ||
      "Couldn’t start Stripe Checkout.";
    var apiErr = new Error(message);
    apiErr.code = "STRIPE_API_ERROR";
    apiErr.status = res.status;
    throw apiErr;
  }

  return body;
}

/**
 * Retrieve a Checkout Session with line items (+ product metadata when available).
 */
async function retrieveCheckoutSession(sessionId) {
  var secret = stripeSecretKey();
  if (!secret) {
    var err = new Error("Stripe isn’t configured on the server yet.");
    err.code = "STRIPE_NOT_CONFIGURED";
    throw err;
  }
  var id = String(sessionId || "").trim();
  if (!id) {
    var miss = new Error("Missing Checkout Session id.");
    miss.code = "STRIPE_SESSION_MISSING";
    throw miss;
  }

  var qs = new URLSearchParams();
  qs.append("expand[]", "line_items.data.price.product");

  var res = await fetch(
    "https://api.stripe.com/v1/checkout/sessions/" +
      encodeURIComponent(id) +
      "?" +
      qs.toString(),
    {
      method: "GET",
      headers: {
        Authorization: "Bearer " + secret,
      },
    }
  );
  var body = await res.json().catch(function () {
    return null;
  });
  if (!res.ok) {
    var message =
      (body && body.error && body.error.message) ||
      "Couldn’t load Checkout Session.";
    var apiErr = new Error(message);
    apiErr.code = "STRIPE_API_ERROR";
    throw apiErr;
  }
  return body;
}

/**
 * Verify Stripe-Signature and return the parsed event object.
 * @param {Buffer|string} rawBody
 * @param {string} signatureHeader
 * @param {string} webhookSecret
 */
function constructEvent(rawBody, signatureHeader, webhookSecret) {
  if (!webhookSecret) {
    var cfgErr = new Error("Webhook secret is not configured.");
    cfgErr.code = "STRIPE_WEBHOOK_NOT_CONFIGURED";
    throw cfgErr;
  }
  if (!signatureHeader) {
    var miss = new Error("Missing Stripe-Signature header.");
    miss.code = "STRIPE_SIGNATURE_MISSING";
    throw miss;
  }

  var parts = String(signatureHeader).split(",").map(function (p) {
    return p.trim();
  });
  var timestamp = null;
  var signatures = [];
  parts.forEach(function (part) {
    var kv = part.split("=");
    if (kv[0] === "t") timestamp = kv[1];
    if (kv[0] === "v1") signatures.push(kv.slice(1).join("="));
  });

  if (!timestamp || !signatures.length) {
    var bad = new Error("Invalid Stripe-Signature header.");
    bad.code = "STRIPE_SIGNATURE_INVALID";
    throw bad;
  }

  var ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!isFinite(ageSec) || ageSec > 300) {
    var stale = new Error("Stripe signature timestamp is outside tolerance.");
    stale.code = "STRIPE_SIGNATURE_TOLERANCE";
    throw stale;
  }

  var payload =
    String(timestamp) +
    "." +
    (Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody));
  var expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload, "utf8")
    .digest("hex");

  var matched = signatures.some(function (sig) {
    var left = Buffer.from(expected, "utf8");
    var right = Buffer.from(String(sig), "utf8");
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  });

  if (!matched) {
    var fail = new Error("Stripe signature verification failed.");
    fail.code = "STRIPE_SIGNATURE_MISMATCH";
    throw fail;
  }

  var json = Buffer.isBuffer(rawBody)
    ? rawBody.toString("utf8")
    : String(rawBody);
  return JSON.parse(json);
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  var chunks = [];
  for await (var chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = {
  env: env,
  siteUrl: siteUrl,
  stripeSecretKey: stripeSecretKey,
  createCheckoutSession: createCheckoutSession,
  retrieveCheckoutSession: retrieveCheckoutSession,
  constructEvent: constructEvent,
  readRawBody: readRawBody,
  stripeLiveAllowed: stripeLiveAllowed,
};
