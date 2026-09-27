/**
 * Safe Terminal TEST vs LIVE classification. Never returns secret values.
 */
"use strict";

function isApiSecret(value) {
  return /^(sk_live_|rk_live_|sk_test_|rk_test_)/.test(String(value || ""));
}

function isWebhookSecret(value) {
  return /^whsec_/.test(String(value || ""));
}

function fromSecret(secret) {
  var value = String(secret || "");
  if (/^(sk_live_|rk_live_)/.test(value)) return "live";
  if (/^(sk_test_|rk_test_)/.test(value)) return "test";
  return "unknown";
}

/** Never treat a webhook signing secret as a Stripe API key. */
function resolveTerminalApiSecret(dedicated, webhookSlot, checkoutSecret) {
  if (isApiSecret(dedicated)) return String(dedicated);
  if (isApiSecret(webhookSlot)) return String(webhookSlot);
  return String(checkoutSecret || "");
}

function resolveTerminalWebhookSecret(webhookSlot, dedicated) {
  if (isWebhookSecret(webhookSlot)) return String(webhookSlot);
  if (isWebhookSecret(dedicated)) return String(dedicated);
  return String(webhookSlot || "");
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
  isApiSecret: isApiSecret,
  isWebhookSecret: isWebhookSecret,
  fromSecret: fromSecret,
  fromStripeToken: fromStripeToken,
  livemodeFlag: livemodeFlag,
  compatible: compatible,
  resolveTerminalApiSecret: resolveTerminalApiSecret,
  resolveTerminalWebhookSecret: resolveTerminalWebhookSecret,
};
