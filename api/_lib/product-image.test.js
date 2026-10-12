"use strict";

var assert = require("assert");
var img = require("./product-image.js");

var card = img.parseImageRequest({ preset: "card", folder: "prod", file: "photo.jpg" });
assert.strictEqual(card.preset, "card");
assert.strictEqual(card.width, 600);
assert.strictEqual(card.quality, 75);
assert.strictEqual(img.PRESETS.admin.width, 200);
assert.strictEqual(img.PRESETS.detail.width, 1200);
assert.strictEqual(img.PRESETS.cart.width, 160);
assert.strictEqual(img.parseImageRequest({ preset: "original", folder: "prod", file: "photo.jpg" }), null);
assert.strictEqual(img.parseImageRequest({ preset: "card", folder: "../secret", file: "photo.jpg" }), null);
assert.strictEqual(img.parseImageRequest({ preset: "card", folder: "prod", file: "photo.svg" }), null);
assert.strictEqual(img.parseImageRequest({ preset: "card", folder: "prod", file: "a/b.jpg" }), null);
assert.strictEqual(img.isImageRequest({ query: { session_id: "cs_test_abc" } }), false);
assert.strictEqual(img.isImageRequest({ query: { preset: "card", folder: "prod", file: "photo.jpg" } }), true);
assert.ok(img.parseImageRequest({
  preset: "detail",
  folder: "06c80995-5af1-44b5-b0af-e0aca55239f9",
  file: "ea48364b-5ad2-4160-8dc6-89d58af54033.webp",
}));

console.log("image route checks passed");
