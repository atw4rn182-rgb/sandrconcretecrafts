/**
 * Server-only Supabase REST helpers using the service role key.
 * Never import this into browser scripts or write-public-env.js.
 */
"use strict";

function env(name) {
  return String(process.env[name] || "").trim();
}

function serviceConfig() {
  var url =
    env("SUPABASE_URL") ||
    env("NEXT_PUBLIC_SUPABASE_URL") ||
    env("PUBLIC_SUPABASE_URL");
  var serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    var err = new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for order writes."
    );
    err.code = "SUPABASE_SERVICE_NOT_CONFIGURED";
    throw err;
  }
  if (serviceKey.indexOf("eyJ") !== 0 && serviceKey.length < 20) {
    var bad = new Error("SUPABASE_SERVICE_ROLE_KEY looks invalid.");
    bad.code = "SUPABASE_SERVICE_NOT_CONFIGURED";
    throw bad;
  }
  return { url: url.replace(/\/$/, ""), serviceKey: serviceKey };
}

async function rest(path, options) {
  var cfg = serviceConfig();
  var opts = options || {};
  var headers = Object.assign(
    {
      apikey: cfg.serviceKey,
      Authorization: "Bearer " + cfg.serviceKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    opts.headers || {}
  );
  var res = await fetch(cfg.url + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers: headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  var text = await res.text();
  var data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
  }
  if (!res.ok) {
    var msg =
      (data && data.message) ||
      (data && data.error_description) ||
      (typeof data === "string" ? data : "") ||
      "Supabase request failed.";
    var err = new Error(String(msg).slice(0, 240));
    err.code = "SUPABASE_REST_ERROR";
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Upsert order by stripe_session_id, replace line items.
 * @param {object} order
 * @param {Array<object>} items
 */
async function upsertOrderWithItems(order, items) {
  var rows = await rest("orders?on_conflict=stripe_session_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: [order],
  });
  var saved = Array.isArray(rows) ? rows[0] : rows;
  if (!saved || !saved.id) {
    throw new Error("Order upsert did not return a row.");
  }

  await rest("order_items?order_id=eq." + encodeURIComponent(saved.id), {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  if (items && items.length) {
    var payload = items.map(function (item) {
      return Object.assign({}, item, { order_id: saved.id });
    });
    await rest("order_items", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: payload,
    });
  }

  return saved;
}

/**
 * Update payment_status for an order matched by Stripe payment_intent id.
 */
async function updateOrderPaymentStatusByPaymentIntent(paymentIntentId, paymentStatus) {
  var pi = String(paymentIntentId || "").trim();
  var status = String(paymentStatus || "").trim();
  if (!pi || !status) return null;
  var rows = await rest(
    "orders?stripe_payment_intent=eq." + encodeURIComponent(pi),
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: { payment_status: status },
    }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

module.exports = {
  upsertOrderWithItems: upsertOrderWithItems,
  updateOrderPaymentStatusByPaymentIntent: updateOrderPaymentStatusByPaymentIntent,
  serviceConfig: serviceConfig,
};
