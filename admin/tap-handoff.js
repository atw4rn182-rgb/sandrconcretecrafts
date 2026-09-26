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
  var HANDOFF_BUILD = "p311";
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
      "#Intent;action=android.intent.action.VIEW;scheme=" +
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

  function parseChromeIntentUri(uri) {
    var text = String(uri || "");
    var marker = "#Intent;";
    var hash = text.indexOf(marker);
    if (text.indexOf("intent://") !== 0 || hash < 0 || text.slice(-4) !== ";end") {
      throw new Error("NOT_CHROME_INTENT");
    }
    var opaque = text.slice("intent://".length, hash);
    var body = text.slice(hash + marker.length, text.length - 4);
    var extras = {};
    var scheme = "";
    var pkg = "";
    body.split(";").forEach(function (part) {
      if (!part) return;
      if (part.indexOf("scheme=") === 0) scheme = part.slice(7);
      else if (part.indexOf("package=") === 0) pkg = part.slice(8);
      else if (part.indexOf("S.") === 0 || part.indexOf("i.") === 0) {
        var eq = part.indexOf("=");
        extras[part.slice(2, eq)] =
          part.charAt(0) === "i" ? Number(part.slice(eq + 1)) : part.slice(eq + 1);
      }
    });
    var pathPart = opaque.split("?")[0];
    var query = opaque.indexOf("?") >= 0 ? opaque.slice(opaque.indexOf("?") + 1) : "";
    var pathMatch = pathPart.match(/^collect\/v(\d+)\/(\d+)$/);
    var queryP = "";
    if (query) {
      query.split("&").forEach(function (pair) {
        var eq = pair.indexOf("=");
        if (eq < 1) return;
        if (decodeURIComponent(pair.slice(0, eq)) === "p") {
          queryP = decodeURIComponent(pair.slice(eq + 1));
        }
      });
    }
    return {
      opaque: opaque,
      scheme: scheme,
      package: pkg,
      pathVersion: pathMatch ? Number(pathMatch[1]) : null,
      pathAmount: pathMatch ? Number(pathMatch[2]) : null,
      extraVersion: extras.handoff_version != null ? Number(extras.handoff_version) : null,
      extraAmount: extras.amount_total_cents != null ? Number(extras.amount_total_cents) : null,
      extraPayload: extras.p || "",
      queryPayload: queryP,
      hasQueryPayload: Boolean(queryP),
    };
  }

  function classifyHandoff(parts) {
    var raw = parts.extraPayload || parts.queryPayload || "";
    var sale = null;
    if (raw) {
      try {
        sale = raw.charAt(0) === "{" ? JSON.parse(raw) : JSON.parse(base64UrlToUtf8(raw));
      } catch (_err) {
        sale = null;
      }
    }
    if (parts.hasQueryPayload && parts.pathVersion == null && parts.extraVersion == null) {
      return { ok: false, reason: "LEGACY_HANDOFF" };
    }
    var payloadVersion =
      sale && sale.handoff_version != null ? Number(sale.handoff_version) : null;
    var payloadAmount = sale ? asPositiveCents(sale.amount_total_cents) : null;
    var versions = [parts.pathVersion, parts.extraVersion, payloadVersion].filter(function (v) {
      return v != null && !Number.isNaN(v);
    });
    if (!versions.length) return { ok: false, reason: "HANDOFF_VERSION_MISSING" };
    if (versions.some(function (v) { return v !== versions[0]; })) {
      return { ok: false, reason: "HANDOFF_DATA_MISMATCH" };
    }
    if (versions[0] !== HANDOFF_VERSION) {
      return { ok: false, reason: "HANDOFF_VERSION_MISMATCH" };
    }
    var amounts = [parts.pathAmount, parts.extraAmount, payloadAmount].filter(function (v) {
      return v != null;
    });
    if (!amounts.length) return { ok: false, reason: "AMOUNT_TOTAL_MISSING" };
    if (amounts.some(function (v) { return v !== amounts[0]; })) {
      return { ok: false, reason: "HANDOFF_DATA_MISMATCH" };
    }
    if (!sale) return { ok: false, reason: "AMOUNT_TOTAL_MISSING" };
    return { ok: true, reason: "OK", amount: amounts[0], version: HANDOFF_VERSION, sale: sale };
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
    HANDOFF_BUILD: HANDOFF_BUILD,
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
    parseChromeIntentUri: parseChromeIntentUri,
    classifyHandoff: classifyHandoff,
  };
});
