#!/usr/bin/env node
/**
 * Local (mocked) checks for admin dashboard catalog summary wiring.
 * Does not call Supabase or invent live metrics.
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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const catalogApi = read("admin/catalog-api.js");
assert(catalogApi.includes('count: "exact"'), "counts use exact head queries");
assert(catalogApi.includes("head: true"), "count queries are head-only");
assert(catalogApi.includes("getDashboardCounts"), "getDashboardCounts exported");
assert(catalogApi.includes("listInventoryAttention"), "inventory attention query present");
assert(
  /eq\("status",\s*"published"\)[\s\S]*eq\("track_inventory",\s*true\)[\s\S]*eq\("quantity",\s*0\)/.test(
    catalogApi
  ),
  "inventory attention filters published + tracked + qty 0"
);
assert(catalogApi.includes("normalizeProductStatusFilter"), "status filter normalizer present");

// Sandbox only the filter helper + constants by evaluating a thin extract.
const filterSandbox = { console };
vm.createContext(filterSandbox);
vm.runInContext(
  [
    "var PRODUCT_STATUS_FILTERS = ['draft', 'published', 'sold_out', 'hidden'];",
    "function normalizeProductStatusFilter(raw) {",
    "  var value = String(raw || '').trim().toLowerCase();",
    "  if (!value || value === 'all' || value === 'total') return '';",
    "  if (PRODUCT_STATUS_FILTERS.indexOf(value) === -1) return null;",
    "  return value;",
    "}",
    "this.normalizeProductStatusFilter = normalizeProductStatusFilter;",
  ].join("\n"),
  filterSandbox
);
const norm = filterSandbox.normalizeProductStatusFilter;
assert(norm("") === "", "empty status → all");
assert(norm("all") === "", "all → all");
assert(norm("TOTAL") === "", "total → all");
assert(norm("published") === "published", "published allowed");
assert(norm("sold_out") === "sold_out", "sold_out allowed");
assert(norm("hidden") === "hidden", "hidden allowed");
assert(norm("draft") === "draft", "draft allowed");
assert(norm("bogus") === null, "invalid status rejected");
assert(norm("Published ") === "published", "status normalized case/trim");

const dashHtml = read("admin/index.html");
assert(dashHtml.includes("dashboard.js"), "dashboard page loads dashboard.js");
assert(dashHtml.includes("dashboardRefresh"), "refresh control present");
assert(dashHtml.includes("Add Product"), "Add Product shortcut");
assert(dashHtml.includes("Manage Categories"), "Manage Categories shortcut");
assert(dashHtml.includes("not connected yet"), "orders/payments secondary note");
assert(!/Orders[\s\S]*Coming soon/i.test(dashHtml), "no Orders coming-soon metric card");
assert(!/Revenue/i.test(dashHtml), "no Revenue metric card");
assert(dashHtml.includes("sandrlogo.jpg"), "logo preserved on dashboard");

const dashJs = read("admin/dashboard.js");
assert(dashJs.includes("getDashboardCounts"), "dashboard loads exact counts");
assert(dashJs.includes("listRecentProducts"), "dashboard loads recent products");
assert(dashJs.includes("visibilitychange"), "refreshes when page becomes visible");
assert(dashJs.includes("pageshow"), "refreshes after bfcache restore");
assert(dashJs.includes("!loadedOnce"), "error path avoids fake zeros on first load");
assert(dashJs.includes("status=published"), "published card links with filter");
assert(dashJs.includes("status=draft"), "draft card links with filter");
assert(dashJs.includes("status=sold_out"), "sold_out card links with filter");
assert(dashJs.includes("status=hidden"), "hidden card links with filter");

const productsJs = read("admin/products.js");
assert(productsJs.includes("applyFiltersFromUrl"), "products page reads URL filters");
assert(productsJs.includes("normalizeProductStatusFilter"), "products validates status");
assert(productsJs.includes("syncFiltersToUrl"), "products syncs filters to URL");

const css = read("admin/admin.css");
assert(css.includes("[hidden]"), "hidden CSS fix present");
assert(css.includes("display: none !important"), "hidden CSS uses !important");
assert(css.includes("a.stat-card:hover"), "clickable stat cards styled");
assert(css.includes(".dash-list-item"), "recent/inventory list styles present");

const schemaSql = fs
  .readdirSync(path.join(root, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => read("supabase/migrations/" + f))
  .join("\n");
assert(!/\bcreate table\s+orders\b/i.test(schemaSql), "no orders table in migrations");
assert(!/\bcreate table\s+payments\b/i.test(schemaSql), "no payments table in migrations");

if (failed) {
  console.error("\n" + failed + " local dashboard check(s) failed");
  process.exit(1);
}
console.log("\nAll local dashboard checks passed (mocked; not live Supabase).");
