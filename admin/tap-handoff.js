/**
 * Admin → Android Tap to Pay handoff protocol.
 * Version 2 puts the sale in Intent extras (S.p) plus integer extras.
 * Chrome intent:// URLs often drop ?query= parameters; extras survive.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SRTapHandoff = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var HANDOFF_VERSION = 2;
  var PACKAGE_NAME = "com.sandrconcretecrafts.pos";
  var SCHEME = "sandrpos";
  var HOST = "collect";

  function utf8ToBase64Url(text) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(String(text), "utf8").toString("base64url");
    }
    var bytes = unescape(encodeURIComponent(String(text)));
    return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToUtf8(encoded) {
    var b64 = String(encoded || "").replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    if (typeof Buffer !== "undefined") {
      return Buffer.from(b64, "base64").toString("utf8");
    }
    return decodeURIComponent(escape(atob(b64)));
  }

  function asPositiveCents(value) {
    var cents = Number(value);
    if (!Number.isSafeInteger(cents) || cents < 1) return null;
    return cents;
  }

  function prepareSale(sale) {
    if (!sale || typeof sale !== "object") {
      throw new Error("Sale payload is required.");
    }
    var cents = asPositiveCents(sale.amount_total_cents);
    if (cents == null) {
      throw new Error("amount_total_cents is required and must be >= 1.");
    }
    var prepared = {};
    Object.keys(sale).forEach(function (key) {
      prepared[key] = sale[key];
    });
    prepared.handoff_version = HANDOFF_VERSION;
    prepared.amount_total_cents = cents;
    return prepared;
  }

  function encodeSale(sale) {
    return utf8ToBase64Url(JSON.stringify(prepareSale(sale)));
  }

  function decodeSale(encoded) {
    var json = base64UrlToUtf8(encoded);
    var sale = JSON.parse(json);
    var version = Number(sale && sale.handoff_version);
    if (version !== HANDOFF_VERSION) {
      var err = new Error("HANDOFF_VERSION_MISMATCH");
      err.reason = "HANDOFF_VERSION_MISMATCH";
      err.expected = HANDOFF_VERSION;
      err.received = sale && sale.handoff_version;
      throw err;
    }
    var cents = asPositiveCents(sale && sale.amount_total_cents);
    if (cents == null) {
      var missing = new Error(
        sale && sale.amount_total_cents == null
          ? "AMOUNT_TOTAL_MISSING"
          : "AMOUNT_TOTAL_INVALID"
      );
      missing.reason = missing.message;
      throw missing;
    }
    return sale;
  }

  function buildCollectIntent(sale, fallbackUrl) {
    var prepared = prepareSale(sale);
    var encoded = utf8ToBase64Url(JSON.stringify(prepared));
    var cents = prepared.amount_total_cents;
    var fallback =
      fallbackUrl ||
      "https://www.sandrconcretecrafts.com/admin/payments.html?tap=missing";
    return (
      "intent://" +
      HOST +
      "/v" +
      HANDOFF_VERSION +
      "/" +
      cents +
      "#Intent;scheme=" +
      SCHEME +
      ";package=" +
      PACKAGE_NAME +
      ";S.p=" +
      encoded +
      ";i.handoff_version=" +
      HANDOFF_VERSION +
      ";i.amount_total_cents=" +
      cents +
      ";S.browser_fallback_url=" +
      encodeURIComponent(fallback) +
      ";end"
    );
  }

  function buildOpenAppIntent(fallbackUrl) {
    var fallback =
      fallbackUrl ||
      "https://www.sandrconcretecrafts.com/admin/payments.html?app=missing";
    return (
      "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=" +
      PACKAGE_NAME +
      ";S.browser_fallback_url=" +
      encodeURIComponent(fallback) +
      ";end"
    );
  }

  function money(cents) {
    var n = asPositiveCents(cents);
    if (n == null) return "—";
    return "$" + (n / 100).toFixed(2);
  }

  function dollarFixture() {
    return {
      sold_at: "2026-09-26T12:00:00.000Z",
      idempotency_key: "tap-fixture-1-00",
      sale_note: "Quick sale fixture",
      customer_name: null,
      customer_email: null,
      customer_phone: null,
      receipt_email: null,
      discount_milli: 0,
      tax_milli: 0,
      amount_total_cents: 100,
      items: [
        {
          type: "custom",
          name: "Quick sale 1",
          unit_amount_cents: 100,
          quantity: 1,
        },
      ],
    };
  }

  return {
    HANDOFF_VERSION: HANDOFF_VERSION,
    PACKAGE_NAME: PACKAGE_NAME,
    SCHEME: SCHEME,
    HOST: HOST,
    prepareSale: prepareSale,
    encodeSale: encodeSale,
    decodeSale: decodeSale,
    buildCollectIntent: buildCollectIntent,
    buildOpenAppIntent: buildOpenAppIntent,
    money: money,
    asPositiveCents: asPositiveCents,
    dollarFixture: dollarFixture,
    utf8ToBase64Url: utf8ToBase64Url,
    base64UrlToUtf8: base64UrlToUtf8,
  };
});
