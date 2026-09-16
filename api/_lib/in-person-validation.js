"use strict";

var UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var IDEMPOTENCY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
var EMAIL_RE =
  /^(?=.{3,254}$)[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
var RFC3339_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function invalid(message, field) {
  var err = new Error(message);
  err.code = "INVALID_SALE";
  err.status = 400;
  err.field = field || null;
  throw err;
}

function optionalText(value, field, max) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") invalid(field + " must be text.", field);
  var text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    invalid(field + " is invalid or too long.", field);
  }
  return text;
}

function requiredText(value, field, max) {
  var text = optionalText(value, field, max);
  if (!text) invalid(field + " is required.", field);
  return text;
}

function optionalEmail(value, field) {
  var email = optionalText(value, field, 254);
  if (!email) return null;
  email = email.toLowerCase();
  if (!EMAIL_RE.test(email)) invalid(field + " must be a valid email address.", field);
  return email;
}

function cents(value, field, min, max) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    invalid(field + " must be integer cents.", field);
  }
  if (value < min || value > max) {
    invalid(field + " is outside the allowed range.", field);
  }
  return value;
}

function quantity(value, field) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 99) {
    invalid(field + " must be an integer from 1 through 99.", field);
  }
  return value;
}

function idempotencyKey(value, field) {
  if (typeof value !== "string" || !IDEMPOTENCY_RE.test(value)) {
    invalid(
      field + " must be 16-128 safe characters and begin with a letter or number.",
      field
    );
  }
  return value;
}

function soldAt(value, nowMs) {
  if (typeof value !== "string" || !RFC3339_RE.test(value)) {
    invalid("sold_at must be an RFC 3339 timestamp with a timezone.", "sold_at");
  }
  var parsed = Date.parse(value);
  var now = nowMs == null ? Date.now() : nowMs;
  if (
    !Number.isFinite(parsed) ||
    parsed < now - 366 * 24 * 60 * 60 * 1000 ||
    parsed > now + 5 * 60 * 1000
  ) {
    invalid("sold_at is outside the allowed range.", "sold_at");
  }
  return new Date(parsed).toISOString();
}

function lineItem(row, index) {
  var field = "items[" + index + "]";
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    invalid(field + " must be an object.", field);
  }
  var type = row.type == null ? "product" : row.type;
  var qty = quantity(row.quantity, field + ".quantity");
  if (type === "product") {
    if (typeof row.product_id !== "string" || !UUID_RE.test(row.product_id)) {
      invalid(field + ".product_id must be a UUID.", field + ".product_id");
    }
    var finish = row.finish == null ? "raw" : String(row.finish).toLowerCase();
    if (finish !== "raw" && finish !== "painted") {
      invalid(field + ".finish must be raw or painted.", field + ".finish");
    }
    return {
      type: "product",
      product_id: row.product_id.toLowerCase(),
      finish: finish,
      quantity: qty,
    };
  }
  if (type === "custom") {
    return {
      type: "custom",
      name: requiredText(row.name, field + ".name", 120),
      unit_amount_cents: cents(
        row.unit_amount_cents,
        field + ".unit_amount_cents",
        1,
        1000000
      ),
      quantity: qty,
    };
  }
  invalid(field + ".type must be product or custom.", field + ".type");
}

function normalizeSale(input, options) {
  var row = input;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    invalid("Sale must be an object.", "sale");
  }
  var items = row.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    invalid("items must contain 1 to 100 lines.", "items");
  }
  var normalized = {
    sold_at: soldAt(row.sold_at, options && options.nowMs),
    idempotency_key: idempotencyKey(row.idempotency_key, "idempotency_key"),
    sale_note: optionalText(row.sale_note, "sale_note", 500),
    customer_name: optionalText(row.customer_name, "customer_name", 160),
    customer_email: optionalEmail(row.customer_email, "customer_email"),
    customer_phone: optionalText(row.customer_phone, "customer_phone", 40),
    receipt_email: optionalEmail(row.receipt_email, "receipt_email"),
    items: items.map(lineItem),
  };
  return normalized;
}

function normalizeCashBatch(body, options) {
  if (!body || typeof body !== "object" || !Array.isArray(body.sales)) {
    invalid("sales must be an array.", "sales");
  }
  if (body.sales.length < 1 || body.sales.length > 25) {
    invalid("A cash batch must contain 1 to 25 sales.", "sales");
  }
  var seen = Object.create(null);
  return body.sales.map(function (sale) {
    var normalized = normalizeSale(sale, options);
    if (seen[normalized.idempotency_key]) {
      invalid("Each sale must have a unique idempotency_key.", "idempotency_key");
    }
    seen[normalized.idempotency_key] = true;
    return normalized;
  });
}

module.exports = {
  cents: cents,
  optionalEmail: optionalEmail,
  optionalText: optionalText,
  idempotencyKey: idempotencyKey,
  soldAt: soldAt,
  normalizeSale: normalizeSale,
  normalizeCashBatch: normalizeCashBatch,
};
