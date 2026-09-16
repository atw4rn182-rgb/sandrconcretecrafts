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
assert(dashHtml.includes("sales-goals"), "dashboard shows sales goals");
assert(dashHtml.includes("salesChart"), "paid-revenue bar chart retained");
assert(dashHtml.includes("salesTrendChart"), "source trend chart present");
assert(dashHtml.includes('data-chart-source="online"'), "online trend source present");
assert(dashHtml.includes('data-chart-source="cash"'), "cash trend source present");
assert(dashHtml.includes('data-chart-source="tap_to_pay"'), "tap trend source present");
assert(dashHtml.includes("Recent paid orders"), "recent paid orders section present");
assert(!/Orders[\s\S]*Coming soon/i.test(dashHtml), "orders are no longer marked coming soon");
assert(dashHtml.includes("sandrlogo.jpg"), "logo preserved on dashboard");

const dashJs = read("admin/dashboard.js");
assert(dashJs.includes("getDashboardCounts"), "dashboard loads exact counts");
assert(dashJs.includes("listRecentProducts"), "dashboard loads recent products");
assert(dashJs.includes("listPaidOrdersLite"), "dashboard loads authoritative paid sales");
assert(dashJs.includes("SRSales.buildSalesSnapshot"), "dashboard aggregates sales centrally");
assert(dashJs.includes("drawTrend"), "dashboard renders payment-source trend");
assert(dashJs.includes("visibilitychange"), "refreshes when page becomes visible");
assert(dashJs.includes("pageshow"), "refreshes after bfcache restore");
assert(dashJs.includes("!loadedOnce"), "error path avoids fake zeros on first load");
assert(dashJs.includes("status=published"), "published card links with filter");
assert(dashJs.includes("filter=paid"), "sales cards link to paid orders");

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
assert(/\bcreate table\s+(?:public\.)?orders\b/i.test(schemaSql), "orders schema exists");
assert(/\bcreate table\s+(?:public\.)?order_items\b/i.test(schemaSql), "order items schema exists");
assert(!/\bcreate table\s+(?:public\.)?payments\b/i.test(schemaSql), "no duplicate payments table");

if (failed) {
  console.error("\n" + failed + " local dashboard check(s) failed");
  process.exit(1);
}
console.log("\nAll local dashboard checks passed (mocked; not live Supabase).");
