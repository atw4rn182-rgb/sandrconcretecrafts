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

console.log("terminal mode classification: ok");
