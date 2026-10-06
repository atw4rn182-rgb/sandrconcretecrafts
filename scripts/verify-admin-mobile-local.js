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
assert(edit.includes('id="item_no"'), "item number field present");
assert(edit.includes('id="description"'), "description field present");
assert(/id="item_no"[^>]*inputmode="text"/.test(edit), "item number uses a text keypad on phones");
assert(css.includes("@media (max-width: 699px)"), "phone-only editor touch rules stay off tablet/desktop");
assert(css.includes("-webkit-user-select: text"), "phone form fields allow native text selection");
assert(css.includes("scroll-margin-bottom"), "focused editor fields stay above the bottom nav");
assert(css.includes("padding-bottom: calc(9rem"), "phone editor clears the fixed bottom nav");
assert(css.includes("overflow-x: clip"), "phone page clip does not create a hidden scroll container");
assert(
  /@media \(max-width: 699px\)[\s\S]*\.admin-main \{[\s\S]*overflow-x: visible/.test(css),
  "phone editor main does not keep a hidden overflow trap"
);
assert(css.includes("revealPhoneEditorExtras") === false, "phone extras helper lives in JS");

const editJs = read("admin/product-edit.js");
assert(editJs.includes('moreDetails'), "phone editor reveals slug/item number details");
assert(editJs.includes("(pointer: coarse)"), "category create does not force-select text on phones");
assert(editJs.includes("scrollIntoView"), "new category panel scrolls into view on phones");
assert(editJs.includes("lastDesktop === desktop"), "keyboard height resize does not reset editor steps");
assert(editJs.includes("opts.scroll !== false"), "scroll-to-top only happens on real step changes");
assert(editJs.includes("lastPhoneExtras === phone"), "keyboard height resize does not reopen editor extras");

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
assert(payments.includes("Quick Sale"), "tap to pay starts with quick sale calculator");
assert(payments.includes("TAKE PAYMENT"), "take payment button is prominent");
assert(payments.includes("posKeypad"), "mobile keypad present");
assert(payments.includes("Select Products from Website"), "website products remain available");
assert(payments.includes("tapChargeSource"), "charge source makes the active total obvious");
assert(payments.includes('inputmode="decimal"'), "amount field requests a decimal keypad");
assert(
  !/id="tapCatalogDetails"[^>]*\sopen\b/.test(payments),
  "website products stay collapsed by default"
);

const storefront = read("index.html");
assert(storefront.includes("S&amp;R Concrete Crafts"), "storefront name untouched by admin redesign check");

if (failed) {
  console.error("\n" + failed + " mobile-admin check(s) failed");
  process.exit(1);
}
console.log("\nAll local mobile-admin checks passed (mocked; live auth/browser separate).");
