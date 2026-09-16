#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var read = function (rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
};

var create = read("api/create-checkout-session.js");
var verify = read("api/verify-checkout-session.js");
var webhook = read("api/stripe-webhook.js");
var app = read("app.js");

var createdSource = /metadata:\s*\{[\s\S]*?source:\s*"([^"]+)"/.exec(create);
var acceptedSource = /session\.metadata\.source\s*===\s*"([^"]+)"/.exec(verify);
assert.ok(createdSource, "Checkout creation source metadata is present");
assert.ok(acceptedSource, "Checkout verification source guard is present");
assert.strictEqual(createdSource[1], acceptedSource[1]);
assert.strictEqual(createdSource[1], "storefront");

assert.match(create, /catalog\.fetchPublicProduct/);
assert.match(create, /catalog\.assertPurchasable/);
assert.doesNotMatch(create, /unit_amount|unitAmountCents:\s*(?:body|requested|variant)/);
assert.match(webhook, /stripe\.constructEvent/);
assert.match(webhook, /stripe\.retrieveCheckoutSessionLineItems/);
assert.match(webhook, /adminDb\.upsertOrderWithItems/);
assert.match(app, /verified = response\.ok && result && result\.verified === true/);
assert.match(app, /if \(verified\) \{[\s\S]*?cart = \[\]/);
assert.match(app, /Payment couldn’t be verified yet\. Your cart was kept\./);

console.log("hosted Checkout source, trusted pricing, webhook, and cart regression: ok");
