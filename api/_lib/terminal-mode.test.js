"use strict";

var assert = require("assert");
var mode = require("./terminal-mode");

assert.strictEqual(mode.fromSecret("sk_test_placeholder"), "test");
assert.strictEqual(mode.fromSecret("rk_test_placeholder"), "test");
assert.strictEqual(mode.fromSecret("sk_live_placeholder"), "live");
assert.strictEqual(mode.fromSecret("rk_live_placeholder"), "live");
assert.strictEqual(mode.fromSecret(""), "unknown");
assert.strictEqual(mode.fromStripeToken({ livemode: false }, "sk_live_placeholder"), "test");
assert.strictEqual(mode.fromStripeToken({ livemode: true }, "sk_test_placeholder"), "live");
assert.strictEqual(mode.fromStripeToken({}, "sk_test_placeholder"), "test");
assert.strictEqual(mode.livemodeFlag({ livemode: false }, "sk_test_placeholder"), false);
assert.strictEqual(mode.livemodeFlag({ livemode: true }, "sk_test_placeholder"), true);
assert.strictEqual(mode.compatible(true, "test"), true);
assert.strictEqual(mode.compatible(false, "live"), true);
assert.strictEqual(mode.compatible(true, "live"), false);
assert.strictEqual(mode.compatible(false, "test"), false);

assert.strictEqual(mode.isApiSecret("sk_live_placeholder"), true);
assert.strictEqual(mode.isWebhookSecret("whsec_placeholder"), true);
assert.strictEqual(mode.isApiSecret("whsec_placeholder"), false);
assert.strictEqual(
  mode.resolveTerminalApiSecret("whsec_misfiled", "", "sk_live_checkout"),
  "sk_live_checkout"
);
assert.strictEqual(
  mode.resolveTerminalApiSecret("whsec_misfiled", "sk_live_swapped", "sk_live_checkout"),
  "sk_live_swapped"
);
assert.strictEqual(
  mode.resolveTerminalWebhookSecret("", "whsec_misfiled"),
  "whsec_misfiled"
);
assert.strictEqual(
  mode.resolveTerminalWebhookSecret("whsec_correct", "sk_live_dedicated"),
  "whsec_correct"
);

console.log("terminal mode classification: ok");
