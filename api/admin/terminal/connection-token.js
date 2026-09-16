/**
 * POST /api/admin/terminal/connection-token
 * Authenticated contract for a future Stripe Terminal native client.
 */
"use strict";

var auth = require("../../_lib/admin-auth");
var stripe = require("../../_lib/stripe");
var api = require("../../_lib/api-response");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    api.sendJson(res, 405, { error: "Method not allowed." });
    return;
  }
  try {
    await auth.requireActiveAdmin(req);
    var cfg = stripe.terminalConfig();
    var token = await stripe.createTerminalConnectionToken();
    if (!token || !token.secret) throw new Error("Stripe returned no connection token.");
    api.sendJson(res, 200, {
      secret: token.secret,
      location_id: cfg.locationId,
    });
  } catch (err) {
    var status = api.errorStatus(err);
    console.error("[admin/terminal/connection-token]", {
      code: err && err.code,
      status: status,
      message: err && err.message,
    });
    api.sendJson(res, status, {
      error:
        status < 500 && err && err.message
          ? err.message
          : "Couldn’t create a Terminal connection token.",
      code: (err && err.code) || "TERMINAL_TOKEN_ERROR",
    });
  }
};
