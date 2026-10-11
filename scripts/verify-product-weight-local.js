"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var weight = require("../js/product-weight");

function read(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

assert.strictEqual(weight.effectiveOunces(null, 16), 16);
assert.strictEqual(weight.effectiveOunces(undefined, null), 16);
assert.strictEqual(weight.formatOunces(16), "1 lb 0 oz");

var eightOz = weight.parseParts("0", "8");
assert.strictEqual(eightOz.ok, true);
assert.strictEqual(eightOz.ounces, 8);
assert.strictEqual(weight.formatOunces(8), "0 lb 8 oz");

var onePound = weight.parseParts("1", "0");
assert.strictEqual(onePound.ok, true);
assert.strictEqual(onePound.ounces, 16);

var heavy = weight.parseParts("20", "15");
assert.strictEqual(heavy.ok, true);
assert.strictEqual(heavy.ounces, 335);
assert.strictEqual(weight.formatOunces(335), "20 lb 15 oz");

assert.strictEqual(weight.parseParts("1", "16").ok, false);
assert.strictEqual(weight.parseParts("-1", "0").ok, false);
assert.strictEqual(weight.parseParts("1", "-2").ok, false);

var custom = weight.parseParts("3", "8");
assert.strictEqual(custom.ok, true);
assert.strictEqual(custom.ounces, 56);
assert.strictEqual(weight.effectiveOunces(custom.ounces, 16), 56);
assert.strictEqual(weight.formatOunces(56), "3 lb 8 oz");

assert.strictEqual(weight.effectiveOunces(null, 32), 32, "a new base applies when no custom weight");
assert.strictEqual(weight.effectiveOunces(56, 32), 56, "a new base does not replace a custom weight");
assert.strictEqual(weight.parseParts("", "").ounces, null, "clearing both fields removes the custom weight");
assert.strictEqual(weight.effectiveOunces(weight.parseParts("", "").ounces, 32), 32);
assert.strictEqual(weight.lineOunces(null, 16, 3), 48, "1 lb times 3 is 3 lb");
assert.strictEqual(weight.formatOunces(48), "3 lb 0 oz");
assert.strictEqual(weight.lineOunces(56, 16, 2), 112, "3 lb 8 oz times 2 is 7 lb");
assert.strictEqual(weight.formatOunces(112), "7 lb 0 oz");
assert.strictEqual(weight.lineOunces(288, 16, 2), 576, "18 lb custom times quantity");

var products = [
  { id: "plain", title: "Small decoration", weight_oz: null },
  { id: "planter", title: "Concrete planter", weight_oz: 120 },
];
var missing = weight.applyToProducts(products, 16, "missing");
assert.strictEqual(missing[0].weight_oz, 16);
assert.strictEqual(missing[1].weight_oz, 120);
assert.strictEqual(missing[1], products[1], "custom product object is left intact");
assert.strictEqual(weight.applyNeedsConfirmation("missing"), false);
assert.strictEqual(weight.applyNeedsConfirmation("all"), true);
function applyIfConfirmed(list, ounces, mode, confirmed) {
  if (weight.applyNeedsConfirmation(mode) && !confirmed) return list;
  return weight.applyToProducts(list, ounces, mode);
}
var cancelled = applyIfConfirmed(products, 24, "all", false);
assert.strictEqual(cancelled[0].weight_oz, null, "canceling apply-all changes nothing");
assert.strictEqual(cancelled[1].weight_oz, 120);
var all = weight.applyToProducts(products, 24, "all");
assert.strictEqual(all[0].weight_oz, 24);
assert.strictEqual(all[1].weight_oz, 24);
assert.strictEqual(products[1].weight_oz, 120, "preview does not mutate the original custom weight");

assert.strictEqual(weight.parseParts("", "").ounces, null);
assert.strictEqual(weight.parseParts("18", "0").ounces, 288);
assert.strictEqual(weight.parseParts("0", "0").ok, false);

var migration = read("supabase/migrations/20261011000001_product_base_weight.sql");
assert.match(migration, /add column if not exists weight_oz integer null/);
assert.doesNotMatch(migration, /set weight_oz = 16/);
assert.match(migration, /weight_oz is null/);
assert.match(migration, /disable trigger products_set_updated_at/);

var settings = read("admin/settings.js");
var settingsHtml = read("admin/settings.html");
var editor = read("admin/product-edit.html");
var editorJs = read("admin/product-edit.js");
var catalog = read("admin/catalog-api.js");
var storefront = read("js/storefront-catalog.js");

assert.match(settingsHtml, /Apply Base Weight to Products/);
assert.match(settingsHtml, /id="baseWeightMissing"[^>]*checked/);
assert.match(settingsHtml, /Products without their own weight use this base weight/);
assert.match(settingsHtml, /Apply only to products with no custom weight/);
assert.match(settingsHtml, /Apply to ALL products/);
assert.match(settingsHtml, /This will replace existing custom product weights/);
assert.match(settings, /This will replace existing custom product weights\. Continue\?/);
assert.match(settings, /if \(!confirmed\) return/);
var confirmAt = settings.indexOf("if (!confirmed) return");
var applyAt = settings.indexOf("SRCatalog.applyProductBaseWeight");
assert.ok(confirmAt !== -1 && applyAt !== -1 && confirmAt < applyAt);
assert.match(editor, /Using base weight: 1 lb 0 oz/);
assert.match(editor, /id="useBaseWeightBtn"/);
assert.match(editorJs, /Using base weight: /);
assert.match(editorJs, /function useBaseWeight/);
assert.match(catalog, /weight_oz: fields\.weight_oz == null \? null : fields\.weight_oz/);
assert.match(catalog, /p_missing_only: missingOnly/);
assert.doesNotMatch(storefront, /weight_oz/);

var g = {};
eval(read("js/store-settings.js").replace("typeof window !== \"undefined\" ? window : globalThis", "g"));
var defaults = g.SRStoreSettings.cloneDefaults();
assert.strictEqual(defaults.fulfillment.base_weight_oz, 16);
assert.strictEqual(g.SRStoreSettings.normalize({}).fulfillment.base_weight_oz, 16);
assert.strictEqual(
  g.SRStoreSettings.normalize({ fulfillment: { base_weight_oz: 40 } }).fulfillment.base_weight_oz,
  40
);

console.log("product weight checks passed");
