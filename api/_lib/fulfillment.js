/**
 * Online checkout fulfillment. Fees come only from saved store settings.
 * A missing fee is not configured — it is not $0 and it is not a guessed rate.
 * Pay Center tax is not read here.
 */
"use strict";

var MAX_FEE_CENTS = 10000000;

function feeCents(value) {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return null;
  var n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_FEE_CENTS) return null;
  return n;
}

function cleanLabel(value, fallback) {
  var text = String(value == null ? "" : value)
    .replace(/[\u0000-\u001F]/g, "")
    .trim();
  if (!text) text = fallback;
  return text.slice(0, 100);
}

function cleanNote(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F]/g, "")
    .trim()
    .slice(0, 240);
}

function methodName(raw) {
  if (raw && typeof raw === "object") {
    raw = raw.method || raw.fulfillment || raw.fulfillment_method || "";
  }
  var value = String(raw == null ? "" : raw)
    .trim()
    .toLowerCase();
  if (value === "shipping") return "ship";
  if (value === "local_pickup" || value === "local-pickup") return "pickup";
  return value === "ship" || value === "pickup" ? value : "";
}

/**
 * Methods the owner has both enabled and priced. $0 is a real free fee.
 * @param {object} config site_settings.config
 */
function readyMethods(config) {
  var fulfillment = config && config.fulfillment;
  if (!fulfillment || typeof fulfillment !== "object") return [];
  var methods = [];
  if (fulfillment.shipping_enabled === true) {
    var shippingFee = feeCents(fulfillment.shipping_fee_cents);
    if (shippingFee != null) {
      methods.push({
        method: "ship",
        feeCents: shippingFee,
        label: cleanLabel(fulfillment.shipping_label, "Shipping"),
        instructions: cleanNote(fulfillment.shipping_note),
      });
    }
  }
  if (fulfillment.pickup_enabled === true) {
    var pickupFee = feeCents(fulfillment.pickup_fee_cents);
    if (pickupFee != null) {
      methods.push({
        method: "pickup",
        feeCents: pickupFee,
        label: cleanLabel(fulfillment.pickup_label, "Local Pickup"),
        instructions: cleanNote(fulfillment.pickup_instructions),
      });
    }
  }
  return methods;
}

/**
 * Resolve the customer's choice against saved settings.
 * Client-supplied prices are ignored.
 */
function resolveChoice(config, requested) {
  var methods = readyMethods(config);
  if (!methods.length) {
    return {
      ok: false,
      code: "FULFILLMENT_NOT_CONFIGURED",
      error:
        "Checkout isn’t ready yet. A shipping or pickup fee needs to be set before an order can be placed.",
    };
  }
  var name = methodName(requested);
  if (!name) {
    return {
      ok: false,
      code: "FULFILLMENT_REQUIRED",
      error: "Choose shipping or local pickup before checkout.",
    };
  }
  var match = null;
  methods.forEach(function (method) {
    if (method.method === name) match = method;
  });
  if (!match) {
    return {
      ok: false,
      code: "FULFILLMENT_UNAVAILABLE",
      error: "That option isn’t available. Choose another way to get your order.",
    };
  }
  return {
    ok: true,
    method: match.method,
    feeCents: match.feeCents,
    label: match.label,
    instructions: match.instructions,
  };
}

/**
 * One fulfillment charge for the whole order. Quantity never multiplies the fee.
 * tax_behavior "exclusive" matches the pre-tax fee shown in the cart.
 * It does not decide whether the fee is taxable and it does not set a tax rate.
 * Stripe Tax uses the account's product tax settings for that.
 */
function stripeFields(choice) {
  var fields = [];
  if (!choice || (choice.method !== "ship" && choice.method !== "pickup")) {
    return fields;
  }
  if (choice.method === "ship") {
    fields.push(["billing_address_collection", "auto"]);
    fields.push(["shipping_address_collection[allowed_countries][0]", "US"]);
    fields.push(["shipping_options[0][shipping_rate_data][type]", "fixed_amount"]);
    fields.push([
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]",
      choice.feeCents,
    ]);
    fields.push([
      "shipping_options[0][shipping_rate_data][fixed_amount][currency]",
      "usd",
    ]);
    fields.push([
      "shipping_options[0][shipping_rate_data][display_name]",
      choice.label || "Shipping",
    ]);
    fields.push(["shipping_options[0][shipping_rate_data][tax_behavior]", "exclusive"]);
    fields.push(["shipping_options[0][shipping_rate_data][metadata][fulfillment]", "ship"]);
    return fields;
  }
  fields.push(["billing_address_collection", "required"]);
  return fields;
}

function isFulfillmentLine(line) {
  var product = line && line.price && line.price.product;
  var meta = product && typeof product === "object" ? product.metadata : null;
  if (!meta) return false;
  return meta.fulfillment === "pickup" || meta.fulfillment === "ship";
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  var n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function pickupFeeCents(lineItems) {
  var fee = 0;
  var found = false;
  (lineItems || []).forEach(function (line) {
    if (!isFulfillmentLine(line)) return;
    found = true;
    var unit =
      line.price && line.price.unit_amount != null
        ? Number(line.price.unit_amount)
        : null;
    var qty = Number(line.quantity) || 1;
    if (unit != null && Number.isFinite(unit)) fee += Math.round(unit) * qty;
  });
  return found ? fee : 0;
}

/**
 * Authoritative totals from a Stripe Checkout Session. Not from the browser.
 */
function totalsFromSession(session, lineItems) {
  var meta = (session && session.metadata) || {};
  var method = methodName(meta.fulfillment_method);
  var details = (session && session.total_details) || {};
  var tax = numberOrNull(details.amount_tax);
  var shipping = numberOrNull(details.amount_shipping);
  var subtotal = numberOrNull(session && session.amount_subtotal);
  var pickupFee = pickupFeeCents(lineItems);
  var fee = null;
  var productSubtotal = null;
  if (method === "ship") {
    fee = shipping;
    productSubtotal = subtotal;
  } else if (method === "pickup") {
    fee = pickupFee;
    productSubtotal = subtotal == null ? null : subtotal - pickupFee;
  }
  return {
    method: method,
    feeCents: fee,
    taxCents: tax,
    subtotalCents: productSubtotal,
    instructions: method === "pickup" ? cleanNote(meta.pickup_instructions) : "",
  };
}

module.exports = {
  feeCents: feeCents,
  methodName: methodName,
  readyMethods: readyMethods,
  resolveChoice: resolveChoice,
  stripeFields: stripeFields,
  isFulfillmentLine: isFulfillmentLine,
  totalsFromSession: totalsFromSession,
};
