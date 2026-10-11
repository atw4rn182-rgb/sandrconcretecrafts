/**
 * Online checkout fulfillment. Fees come only from saved store settings.
 * A missing fee is not configured — it is not $0 and it is not a guessed rate.
 * Pay Center tax is not read here.
 */
"use strict";

var MAX_FEE_CENTS = 10000000;
var DEFAULT_PICKUP_FEE_CENTS = 500;

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

function enabledFlag(value, fallback) {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

/**
 * Missing pickup fee uses the $5.00 default. An explicit 0 stays free.
 * A shipping fee is never invented.
 */
function pickupFeeOrDefault(value) {
  if (value == null || value === "") return DEFAULT_PICKUP_FEE_CENTS;
  return feeCents(value);
}

var DEFAULT_FIRST_ITEM_CENTS = 1000;
var DEFAULT_ADDITIONAL_ITEM_CENTS = 300;

/**
 * Missing mode stays flat so a saved per-order fee keeps charging.
 * "carrier" is reserved for a later carrier rate and is not priced here.
 */
function pricingMode(fulfillment) {
  var mode = String(fulfillment && fulfillment.shipping_pricing_mode != null ? fulfillment.shipping_pricing_mode : "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (mode === "per_item") return "per_item";
  if (mode === "carrier") return "carrier";
  return "flat";
}

function tierFeeOrDefault(value, fallback) {
  if (value == null || value === "") return fallback;
  var parsed = feeCents(value);
  return parsed == null ? fallback : parsed;
}

function perItemShippingCents(firstCents, additionalCents, quantity) {
  var qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) qty = 1;
  var first = tierFeeOrDefault(firstCents, DEFAULT_FIRST_ITEM_CENTS);
  var extra = tierFeeOrDefault(additionalCents, DEFAULT_ADDITIONAL_ITEM_CENTS);
  return first + Math.max(qty - 1, 0) * extra;
}

/**
 * Methods the owner has enabled and priced. Pickup defaults to $5.00 once.
 * $0 is a real free fee when the owner saved 0.
 * @param {object} config site_settings.config
 */
function readyMethods(config) {
  var fulfillment =
    config && config.fulfillment && typeof config.fulfillment === "object"
      ? config.fulfillment
      : {};
  var methods = [];
  if (enabledFlag(fulfillment.shipping_enabled, true)) {
    var mode = pricingMode(fulfillment);
    var label = cleanLabel(fulfillment.shipping_label, "Shipping");
    var instructions = cleanNote(fulfillment.shipping_note);
    if (mode === "per_item") {
      var first = tierFeeOrDefault(fulfillment.shipping_first_item_cents, DEFAULT_FIRST_ITEM_CENTS);
      var additional = tierFeeOrDefault(
        fulfillment.shipping_additional_item_cents,
        DEFAULT_ADDITIONAL_ITEM_CENTS
      );
      methods.push({
        method: "ship",
        pricingMode: "per_item",
        feeCents: perItemShippingCents(first, additional, 1),
        firstItemCents: first,
        additionalItemCents: additional,
        label: label,
        instructions: instructions,
      });
    } else if (mode === "flat") {
      var shippingFee = feeCents(fulfillment.shipping_fee_cents);
      if (shippingFee != null) {
        methods.push({
          method: "ship",
          pricingMode: "flat",
          feeCents: shippingFee,
          label: label,
          instructions: instructions,
        });
      }
    }
  }
  if (enabledFlag(fulfillment.pickup_enabled, true)) {
    var pickupFee = pickupFeeOrDefault(fulfillment.pickup_fee_cents);
    if (pickupFee != null) {
      methods.push({
        method: "pickup",
        feeCents: pickupFee,
        label: cleanLabel(fulfillment.pickup_label, "Local Pickup / Meet-Up"),
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
function resolveChoice(config, requested, options) {
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
  var fee = match.feeCents;
  if (match.method === "ship" && match.pricingMode === "per_item") {
    fee = perItemShippingCents(
      match.firstItemCents,
      match.additionalItemCents,
      options && options.quantity
    );
  }
  return {
    ok: true,
    method: match.method,
    pricingMode: match.pricingMode || "flat",
    feeCents: fee,
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
  DEFAULT_PICKUP_FEE_CENTS: DEFAULT_PICKUP_FEE_CENTS,
  DEFAULT_FIRST_ITEM_CENTS: DEFAULT_FIRST_ITEM_CENTS,
  DEFAULT_ADDITIONAL_ITEM_CENTS: DEFAULT_ADDITIONAL_ITEM_CENTS,
  feeCents: feeCents,
  perItemShippingCents: perItemShippingCents,
  methodName: methodName,
  readyMethods: readyMethods,
  resolveChoice: resolveChoice,
  stripeFields: stripeFields,
  isFulfillmentLine: isFulfillmentLine,
  totalsFromSession: totalsFromSession,
};
