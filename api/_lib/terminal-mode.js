/**
 * Safe Terminal TEST vs LIVE classification. Never returns secret values.
 */
"use strict";

function fromSecret(secret) {
  var value = String(secret || "");
  if (/^(sk_live_|rk_live_)/.test(value)) return "live";
  if (/^(sk_test_|rk_test_)/.test(value)) return "test";
  return "unknown";
}

function fromStripeToken(token, secret) {
  if (token && typeof token.livemode === "boolean") {
    return token.livemode ? "live" : "test";
  }
  return fromSecret(secret);
}

function livemodeFlag(token, secret) {
  return fromStripeToken(token, secret) === "live";
}

function compatible(simulated, backend) {
  if (backend !== "live" && backend !== "test") return false;
  if (simulated === true && backend === "live") return false;
  if (simulated === false && backend === "test") return false;
  return true;
}

module.exports = {
  fromSecret: fromSecret,
  fromStripeToken: fromStripeToken,
  livemodeFlag: livemodeFlag,
  compatible: compatible,
};
