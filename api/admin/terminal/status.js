/**
 * GET /api/admin/terminal/status
 * Sanitized LIVE/TEST + location confirmation. No secrets, tokens, or IDs.
 */
"use strict";

var auth = require("../../_lib/admin-auth");
var stripe = require("../../_lib/stripe");
var api = require("../../_lib/api-response");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    api.sendJson(res, 405, { error: "Method not allowed." });
    return;
  }
  try {
    await auth.requireActiveAdmin(req);
    var webhookConfigured = !!stripe.terminalWebhookSecret();
    var checkoutConfigured = !!stripe.env("STRIPE_WEBHOOK_SECRET");
    var cfg;
    try {
      cfg = stripe.terminalConfig();
    } catch (err) {
      api.sendJson(res, api.errorStatus(err), {
        enabled: false,
        backend: "UNKNOWN",
        location: "UNVERIFIED",
        webhook: webhookConfigured ? "CONFIGURED" : "MISSING",
        checkout_webhook_isolated: checkoutConfigured,
        code: (err && err.code) || "STRIPE_TERMINAL_NOT_CONFIGURED",
        error: err && err.message ? err.message : "Stripe Terminal is not configured.",
      });
      return;
    }
    var location = await stripe.retrieveTerminalLocation();
    var locationLive = !!(location && location.livemode === true);
    var backend =
      cfg.mode === "live" ? "LIVE" : cfg.mode === "test" ? "TEST" : "UNKNOWN";
    var locationStatus = "MISSING";
    if (location && location.id) {
      if (cfg.mode === "live" && locationLive) locationStatus = "CONFIRMED";
      else if (cfg.mode === "test" && location.livemode === false) locationStatus = "TEST_ONLY";
      else locationStatus = "MISMATCH";
    }
    api.sendJson(res, 200, {
      enabled: true,
      backend: backend,
      location: locationStatus,
      webhook: webhookConfigured ? "CONFIGURED" : "MISSING",
      checkout_webhook_isolated: checkoutConfigured,
    });
  } catch (err) {
    var status = api.errorStatus(err);
    api.sendJson(res, status, {
      enabled: false,
      backend: "UNKNOWN",
      location:
        err && err.code === "LIVE_TERMINAL_LOCATION_MISSING"
          ? "MISSING"
          : "UNVERIFIED",
      code: (err && err.code) || "TERMINAL_STATUS_ERROR",
      error:
        status < 500 && err && err.message
          ? err.message
          : "Couldn’t verify Terminal status.",
    });
  }
};
