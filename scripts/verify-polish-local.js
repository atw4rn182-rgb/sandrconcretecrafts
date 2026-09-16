#!/usr/bin/env node
/**
 * Local checks for tactile UI polish + simplified product editor.
 * Does not require a browser or live Supabase session.
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

const css = read("styles.css");
const seasonalCss = read("css/seasonal-decor.css");
assert(css.includes("--motion:"), "storefront motion token present");
assert(css.includes("--elevate-2"), "elevation tokens present");
assert(css.includes("--shadow-press"), "press shadow token present");
assert(css.includes("(hover: hover) and (pointer: fine)"), "hover motion gated to hover devices");
assert(css.includes("prefers-reduced-motion"), "reduced motion preserved");
assert(css.includes(".filter-chip.is-active::before"), "selected chips have non-color marker");
assert(css.includes("scale(1.02)"), "card image zoom kept subtle");
assert(seasonalCss.includes(".season-decor"), "seasonal decorative accents retained");
assert(css.includes(".store-share"), "store share action is styled");
assert(css.includes(".review-banner"), "review invitation is styled");
assert(css.includes(".btn-primary:active"), "primary button press state");
assert(css.includes(".add:disabled"), "disabled add controls styled");

const index = read("index.html");
assert(index.includes("sandrlogo"), "logo asset referenced");
assert((index.match(/season-decor/g) || []).length >= 4, "seasonal accents remain in markup");
assert(index.includes('id="storeShare"'), "share action remains in markup");
assert(index.includes('id="reviewBanner"'), "review invitation remains in markup");

const editHtml = read("admin/product-edit.html");
assert(/Product Title[\s\S]*Description[\s\S]*price[\s\S]*photoInput[\s\S]*categoryChecks/i.test(editHtml), "editor includes title, description, price, photos, categories");
assert(editHtml.includes('id="moreDetails"'), "optional details in expandable section");
assert(editHtml.includes('id="slug"') && editHtml.includes("moreDetails"), "slug remains in page");
assert(editHtml.includes("addCategoryBtn"), "inline Add Category preserved");
assert(editHtml.includes("Save Draft") && editHtml.includes(">Publish<"), "primary Save Draft / Publish actions");
assert(editHtml.includes("editor-actions-secondary"), "secondary status actions grouped");
assert(editHtml.includes("hideBtn") && editHtml.includes("soldOutBtn"), "secondary actions retained");

const editJs = read("admin/product-edit.js");
assert(editJs.includes("saveWithIntent"), "existing save logic retained");
assert(editJs.includes("beforeunload"), "unsaved-edit protection retained");
assert(editJs.includes("createAndSelectCategory") || editJs.includes("SRCatalog.createCategory"), "inline category creation retained");
assert(editJs.includes("uploadProductImage"), "upload handling retained");

const adminCss = read("admin/admin.css");
assert(adminCss.includes(".editor-more"), "expandable more-details styles present");
assert(adminCss.includes(".editor-actions-primary"), "primary action row styles present");
assert(adminCss.includes("(hover: hover)"), "admin hover motion gated");
assert(adminCss.includes("[hidden]"), "hidden CSS fix retained");

if (failed) {
  console.error("\n" + failed + " polish check(s) failed");
  process.exit(1);
}
console.log("\nAll local polish checks passed (mocked; browser/live checks separate).");
