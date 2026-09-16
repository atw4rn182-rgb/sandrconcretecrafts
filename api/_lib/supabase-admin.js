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

/** Call a service-role-only PostgREST RPC. */
async function rpc(functionName, args) {
  return rest("rpc/" + encodeURIComponent(functionName), {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: args || {},
  });
}

async function recordCashSalesBatch(adminUserId, sales) {
  return rpc("record_cash_sales_batch", {
    p_recorded_by: adminUserId,
    p_sales: sales,
  });
}

async function recordInPersonSale(adminUserId, paymentSource, sale) {
  return rpc("record_in_person_sale", {
    p_payment_source: paymentSource,
    p_sold_at: sale.sold_at,
    p_recorded_by: adminUserId,
    p_sale_note: sale.sale_note,
    p_idempotency_key: sale.idempotency_key,
    p_customer_name: sale.customer_name,
    p_customer_email: sale.customer_email,
    p_customer_phone: sale.customer_phone,
    p_receipt_email: sale.receipt_email,
    p_stripe_payment_intent: sale.stripe_payment_intent || null,
    p_items: sale.items,
  });
}

async function attachTerminalPaymentIntent(orderId, adminUserId, paymentIntentId) {
  return rpc("attach_terminal_payment_intent", {
    p_order_id: orderId,
    p_recorded_by: adminUserId,
    p_payment_intent: paymentIntentId,
  });
}

async function confirmTapToPayPayment(paymentIntentId, amount, currency) {
  return rpc("confirm_tap_to_pay_payment", {
    p_payment_intent: paymentIntentId,
    p_amount: amount,
    p_currency: currency,
  });
}

async function getPaidOrderForReceipt(orderId) {
  var select = [
    "id",
    "payment_status",
    "payment_source",
    "amount_total",
    "currency",
    "customer_name",
    "customer_email",
    "sold_at",
    "created_at",
    "receipt_email",
    "receipt_sent_at",
    "receipt_provider_id",
    "order_items(product_name,finish,quantity,unit_amount,amount_total)",
  ].join(",");
  var rows = await rest(
    "orders?id=eq." +
      encodeURIComponent(orderId) +
      "&payment_status=eq.paid&select=" +
      encodeURIComponent(select) +
      "&limit=1"
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function markReceiptSent(orderId, email, providerId) {
  var rows = await rest(
    "orders?id=eq." +
      encodeURIComponent(orderId) +
      "&payment_status=eq.paid&receipt_sent_at=is.null",
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: {
        receipt_email: email,
        receipt_sent_at: new Date().toISOString(),
        receipt_provider_id: providerId,
      },
    }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
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
  recordCashSalesBatch: recordCashSalesBatch,
  recordInPersonSale: recordInPersonSale,
  attachTerminalPaymentIntent: attachTerminalPaymentIntent,
  confirmTapToPayPayment: confirmTapToPayPayment,
  getPaidOrderForReceipt: getPaidOrderForReceipt,
  markReceiptSent: markReceiptSent,
  rpc: rpc,
  serviceConfig: serviceConfig,
};
