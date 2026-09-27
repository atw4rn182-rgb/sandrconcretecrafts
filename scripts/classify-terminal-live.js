#!/usr/bin/env node
/**
 * Production-build Terminal gate. Prints only sanitized LIVE/TEST labels.
 * Never prints secrets, tokens, location IDs, or key prefixes.
 */
"use strict";

var stripe = require("../api/_lib/stripe");

function gate(name, value) {
  console.log("TERMINAL_GATE " + name + "=" + value);
}

function codeOf(err) {
  return (err && err.code) || "ERROR";
}

(async function main() {
  gate("webhook", stripe.terminalWebhookSecret() ? "CONFIGURED" : "MISSING");

  var cfg;
  try {
    cfg = stripe.terminalConfig();
    gate(
      "backend",
      cfg.mode === "live" ? "LIVE" : cfg.mode === "test" ? "TEST" : "UNKNOWN"
    );
  } catch (err) {
    gate("backend", "FAIL");
    gate("backend_code", codeOf(err));
    gate("location", "UNVERIFIED");
    gate("token_livemode", "UNVERIFIED");
    return;
  }

  try {
    var location = await stripe.retrieveTerminalLocation();
    var locationLive = !!(location && location.livemode === true);
    if (location && location.id) {
      if (cfg.mode === "live" && locationLive) gate("location", "CONFIRMED");
      else if (cfg.mode === "test" && location.livemode === false) {
        gate("location", "TEST_ONLY");
      } else gate("location", "MISMATCH");
    } else {
      gate("location", "MISSING");
    }
  } catch (err) {
    gate(
      "location",
      err && err.code === "LIVE_TERMINAL_LOCATION_MISSING" ? "MISSING" : "UNVERIFIED"
    );
    gate("location_code", codeOf(err));
  }

  try {
    var token = await stripe.createTerminalConnectionToken();
    var mode = stripe.terminalMode.fromStripeToken(token, cfg.secret);
    gate("token_livemode", mode === "live" ? "true" : "false");
  } catch (err) {
    gate("token_livemode", "UNVERIFIED");
    gate("token_code", codeOf(err));
  }
})().catch(function (err) {
  gate("fatal", codeOf(err));
});
