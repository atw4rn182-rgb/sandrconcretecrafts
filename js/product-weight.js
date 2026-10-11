/**
 * Product weight in whole ounces.
 * A blank product weight is not 1 lb stored on the product.
 * It means "use the base weight from Settings."
 */
(function (global) {
  "use strict";

  var OZ_PER_LB = 16;
  var DEFAULT_BASE_OZ = 16;
  var MAX_OZ = 8000;

  function wholeNumber(raw) {
    var text = String(raw == null ? "" : raw).trim();
    if (!/^\d+$/.test(text)) return null;
    var n = Number(text);
    if (!Number.isInteger(n)) return null;
    return n;
  }

  /**
   * @param {string|number} pounds
   * @param {string|number} ounces
   * @param {{required?: boolean}} [opts]
   * Blank + blank => ounces null (use base), unless required.
   */
  function parseParts(pounds, ounces, opts) {
    var required = !!(opts && opts.required);
    var lbText = String(pounds == null ? "" : pounds).trim();
    var ozText = String(ounces == null ? "" : ounces).trim();
    if (!lbText && !ozText) {
      if (required) return { ok: false, ounces: null, error: "Enter a base product weight." };
      return { ok: true, ounces: null };
    }
    var lb = wholeNumber(lbText || "0");
    var oz = wholeNumber(ozText || "0");
    if (lb == null || oz == null) {
      return { ok: false, ounces: null, error: "Use whole numbers for pounds and ounces." };
    }
    if (oz > 15) {
      return { ok: false, ounces: null, error: "Ounces must be 0 through 15." };
    }
    if (lb > 500) {
      return { ok: false, ounces: null, error: "Pounds must be 500 or less." };
    }
    var total = lb * OZ_PER_LB + oz;
    if (total < 1) {
      return {
        ok: false,
        ounces: null,
        error: required
          ? "Enter a base weight of at least 1 ounce."
          : "Enter a weight, or leave both boxes blank to use the base weight.",
      };
    }
    if (total > MAX_OZ) {
      return { ok: false, ounces: null, error: "Weight must be 500 pounds or less." };
    }
    return { ok: true, ounces: total };
  }

  function normalizeBaseOz(value) {
    var n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > MAX_OZ) return DEFAULT_BASE_OZ;
    return n;
  }

  function splitOunces(total) {
    var n = normalizeBaseOz(total);
    return { pounds: Math.floor(n / OZ_PER_LB), ounces: n % OZ_PER_LB };
  }

  function formatOunces(total) {
    var parts = splitOunces(total);
    return parts.pounds + " lb " + parts.ounces + " oz";
  }

  /**
   * Custom weight wins. Null means the configured base weight.
   */
  function effectiveOunces(customOz, baseOz) {
    if (customOz == null || customOz === "") return normalizeBaseOz(baseOz);
    var n = Number(customOz);
    if (!Number.isInteger(n) || n < 1 || n > MAX_OZ) return normalizeBaseOz(baseOz);
    return n;
  }

  function lineOunces(customOz, baseOz, quantity) {
    var qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) return null;
    return effectiveOunces(customOz, baseOz) * qty;
  }

  /**
   * Preview of a bulk apply. Does not talk to the database.
   * "missing" writes the base only where weight_oz is null.
   * "all" replaces every weight.
   */
  function applyToProducts(products, baseOz, mode) {
    var ounces = normalizeBaseOz(baseOz);
    var all = mode === "all";
    return (products || []).map(function (product) {
      if (!all && product && product.weight_oz != null) return product;
      return Object.assign({}, product, { weight_oz: ounces });
    });
  }

  function applyNeedsConfirmation(mode) {
    return mode === "all";
  }

  var api = {
    OZ_PER_LB: OZ_PER_LB,
    DEFAULT_BASE_OZ: DEFAULT_BASE_OZ,
    MAX_OZ: MAX_OZ,
    parseParts: parseParts,
    normalizeBaseOz: normalizeBaseOz,
    splitOunces: splitOunces,
    formatOunces: formatOunces,
    effectiveOunces: effectiveOunces,
    lineOunces: lineOunces,
    applyToProducts: applyToProducts,
    applyNeedsConfirmation: applyNeedsConfirmation,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.SRProductWeight = api;
})(typeof window !== "undefined" ? window : globalThis);
