#!/usr/bin/env node
/**
 * Local checks for mobile-first admin redesign (no live auth required).
 */
const fs = require("fs");
const path = require("path");

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

const css = read("admin/admin.css");
assert(css.includes("overflow-x: hidden"), "admin CSS prevents horizontal page overflow");
assert(css.includes("admin-bottom-nav"), "bottom nav styles present");
assert(css.includes("safe-area-inset-bottom"), "safe-area padding considered");
assert(css.includes("product-card"), "product card styles present");
assert(css.includes("editor-steps") || css.includes("editor-step"), "editor step styles present");
assert(css.includes("@media (min-width: 900px)"), "desktop breakpoint restores sidebar layout");
assert(css.includes("[hidden]"), "hidden CSS fix retained");

const shell = read("admin/admin-shell.js");
assert(shell.includes("adminBottomNav"), "shell injects bottom nav");
assert(shell.includes('data-nav="payments"'), "payments is a primary mobile tab");
assert(shell.includes("adminMoreSheet"), "shell injects More sheet");
assert(shell.includes("Sign Out"), "More sheet includes sign out");

const dash = read("admin/index.html");
assert(dash.includes("Welcome back"), "dashboard welcome copy");
assert(dash.includes("dash-nav-card"), "dashboard nav cards");
assert(dash.includes("View Store"), "View Store link");
assert(dash.includes("salesTrendChart"), "dashboard includes responsive sales trend");

const products = read("admin/products.html");
assert(products.includes("product-card-list") || products.includes("productList"), "products list container");
assert(products.includes("statusChips"), "status filter chips");
assert(products.includes("Add New Product"), "mobile add CTA");

const edit = read("admin/product-edit.html");
assert(edit.includes('data-step="1"'), "editor step 1");
assert(edit.includes('data-step="4"'), "editor step 4 review");
assert(edit.includes("addCategoryBtn"), "inline category preserved");
assert(edit.includes("livePreview"), "live preview retained");

const orders = read("admin/orders.html");
assert(orders.includes("order-card-list"), "orders list container");
assert(orders.includes("orderSourceChips"), "orders source filters");
assert(orders.includes("Online Store"), "orders label online sales");
assert(orders.includes("Cash"), "orders label cash sales");
assert(orders.includes("Tap to Pay"), "orders label tap sales");

const payments = read("admin/payments.html");
assert(payments.includes("payments-main"), "payments mobile layout present");
assert(payments.includes("singleCashForm"), "single cash form present");
assert(payments.includes("batchCashForm"), "batch cash form present");
assert(payments.includes("Native App Required"), "web Terminal action stays disabled");

const storefront = read("index.html");
assert(storefront.includes("S&amp;R Concrete Crafts"), "storefront name untouched by admin redesign check");

if (failed) {
  console.error("\n" + failed + " mobile-admin check(s) failed");
  process.exit(1);
}
console.log("\nAll local mobile-admin checks passed (mocked; live auth/browser separate).");
