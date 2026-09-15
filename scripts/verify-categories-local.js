#!/usr/bin/env node
/**
 * Local checks: homepage categories come from the categories table, not hard-coded names.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

const catalogJs = fs.readFileSync(path.join(root, "js/storefront-catalog.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert(catalogJs.includes("async function fetchStorefrontCategories"), "storefront fetches categories");
assert(catalogJs.includes('.from("categories")'), "categories query hits categories table");
assert(catalogJs.includes('.eq("active", true)'), "only active categories are requested");
assert(catalogJs.includes("fetchStorefrontCategories: fetchStorefrontCategories"), "helper is exported");

assert(appJs.includes("fetchStorefrontCategories"), "app.js uses category helper");
assert(appJs.includes("storefrontCategories"), "app.js keeps a dedicated category list");
assert(appJs.includes("loadStorefrontCategories"), "catalog load refreshes categories");
assert(!/activeCategory\s*=\s*["']hearts["']/i.test(appJs), "no hard-coded Hearts default");
assert(!/["']Hearts["']/.test(appJs.slice(appJs.indexOf("function collectCategories"))), "filter list does not hard-code Hearts");

assert(indexHtml.includes('id="filterChips"'), "homepage filter chips remain");
assert(indexHtml.includes('id="collectionFilters"'), "homepage filter wrap remains");
assert(!/rel="icon"[^>]*sandrlogo\.jpg/.test(indexHtml), "storefront no longer uses JPEG as favicon");
assert(indexHtml.includes("/favicon.ico?v=20260915"), "storefront favicon.ico is versioned");
assert(indexHtml.includes("/assets/favicon-32x32.png?v=20260915"), "32x32 favicon referenced");
assert(indexHtml.includes("/assets/favicon-16x16.png?v=20260915"), "16x16 favicon referenced");
assert(indexHtml.includes("/assets/apple-touch-icon.png?v=20260915"), "apple touch icon referenced");

["favicon.ico", "assets/favicon.ico", "assets/favicon-16x16.png", "assets/favicon-32x32.png", "assets/apple-touch-icon.png"].forEach(function (rel) {
  assert(fs.existsSync(path.join(root, rel)), rel + " exists");
});
assert(fs.existsSync(path.join(root, "assets/sr-emblem-source.jpg")), "emblem source artwork saved");

const sandbox = {
  console,
  window: { location: { origin: "https://sandrconcretecrafts.com" }, __SR_ENV__: {} },
};
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(catalogJs, sandbox);
const Cat = sandbox.window.SRStorefrontCatalog;
assert(!!Cat, "SRStorefrontCatalog defined");
assert(typeof Cat.fetchStorefrontCategories === "function", "fetchStorefrontCategories is a function");

if (failed) {
  console.error("\n" + failed + " local category check(s) failed");
  process.exit(1);
}
console.log("\nAll local category checks passed (mocked; not live Supabase).");
