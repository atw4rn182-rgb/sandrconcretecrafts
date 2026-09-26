/**
 * Integer-cent POS math for the Admin Pay Center.
 * 1% = 1000 milli. 10% = 10000 milli. 7.875% = 7875 milli.
 */
(function (global) {
  "use strict";

  var MAX_LINE_CENTS = 1000000;
  var MAX_TOTAL_CENTS = 100000000;
  var MAX_DISCOUNT_MILLI = 100000;
  var MAX_TAX_MILLI = 200000;

  function asInt(value) {
    var n = Number(value);
    return Number.isSafeInteger(n) ? n : 0;
  }

  function clampMilli(value, max) {
    var n = asInt(value);
    if (n < 0) return 0;
    if (n > max) return max;
    return n;
  }

  function shareCents(cents, milli) {
    var amount = asInt(cents);
    var rate = asInt(milli);
    if (amount <= 0 || rate <= 0) return 0;
    return Math.round((amount * rate) / 100000);
  }

  function percentLabel(milli) {
    var n = clampMilli(milli, MAX_TAX_MILLI);
    var text = (n / 1000).toFixed(3).replace(/\.?0+$/, "");
    return text || "0";
  }

  function parsePercentToMilli(raw) {
    var text = String(raw == null ? "" : raw)
      .trim()
      .replace(/%/g, "")
      .replace(/,/g, "");
    if (!text) return { ok: true, value: 0 };
    if (!/^\d+(?:\.\d{1,3})?$/.test(text)) {
      return { ok: false, value: 0, error: "Enter a percentage from 0 to 100." };
    }
    var value = Number(text);
    if (!isFinite(value) || value < 0 || value > 100) {
      return { ok: false, value: 0, error: "Enter a percentage from 0 to 100." };
    }
    return { ok: true, value: Math.round(value * 1000) };
  }

  function quote(input) {
    var lines = Array.isArray(input && input.lines) ? input.lines : [];
    var subtotal = 0;
    lines.forEach(function (cents) {
      var line = asInt(cents);
      if (line > 0) subtotal += line;
    });
    if (subtotal > MAX_TOTAL_CENTS) subtotal = MAX_TOTAL_CENTS;
    var discountMilli = clampMilli(input && input.discountMilli, MAX_DISCOUNT_MILLI);
    var taxMilli = clampMilli(input && input.taxMilli, MAX_TAX_MILLI);
    var discount = shareCents(subtotal, discountMilli);
    if (discount > subtotal) discount = subtotal;
    var taxable = subtotal - discount;
    var tax = shareCents(taxable, taxMilli);
    var total = taxable + tax;
    if (total > MAX_TOTAL_CENTS) total = MAX_TOTAL_CENTS;
    return {
      subtotal: subtotal,
      discountMilli: discountMilli,
      discount: discount,
      taxMilli: taxMilli,
      tax: tax,
      total: total,
    };
  }

  var api = {
    MAX_LINE_CENTS: MAX_LINE_CENTS,
    shareCents: shareCents,
    percentLabel: percentLabel,
    parsePercentToMilli: parsePercentToMilli,
    quote: quote,
    clampDiscountMilli: function (value) {
      return clampMilli(value, MAX_DISCOUNT_MILLI);
    },
    clampTaxMilli: function (value) {
      return clampMilli(value, MAX_TAX_MILLI);
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.SRPosTotals = api;
})(typeof window !== "undefined" ? window : globalThis);
