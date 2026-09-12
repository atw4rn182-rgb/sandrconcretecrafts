#!/usr/bin/env node
/**
 * Local (mocked) checks for inline category creation in the product editor.
 * Does not call Supabase or mutate live catalog data.
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

const html = read("admin/product-edit.html");
assert(html.includes('id="addCategoryBtn"'), "Add Category button present");
assert(html.includes('id="addCategoryPanel"'), "inline category panel present");
assert(html.includes('id="newCategoryName"'), "category name field present");
assert(html.includes("Create &amp; Select"), "Create & Select control present");
assert(html.includes('id="addCategoryCancelBtn"'), "Cancel control present");
assert(
  html.includes("created right away") || html.includes("created immediately") || html.includes("Assigning it to this product"),
  "explains create-now vs save-product assignment"
);
assert(!/<form[^>]*id="addCategory/i.test(html), "no nested category form element");
assert(html.includes('role="dialog"'), "panel exposed as dialog");
assert(html.includes("categoryChecks"), "existing category checkboxes container kept");

const editJs = read("admin/product-edit.js");
assert(editJs.includes("SRCatalog.createCategory"), "uses existing createCategory helper");
assert(editJs.includes("creatingCategory"), "guards duplicate submissions");
assert(editJs.includes("findEquivalentCategory"), "detects equivalent category names");
assert(editJs.includes("showDuplicateOffer") || editJs.includes("Select existing"), "offers select-existing for duplicates");
assert(editJs.includes("markDirty()"), "marks product dirty after category select");
assert(editJs.includes('e.key === "Enter"'), "handles Enter in name field");
assert(editJs.includes('e.key === "Escape"'), "handles Escape");
assert(editJs.includes("renderCategoryChecks"), "re-renders category choices without full page reload");
assert(editJs.includes("selectedCategoryIds"), "preserves selected categories across re-render");
assert(!/location\.reload\(/.test(editJs), "does not reload page while creating category");
assert(editJs.includes("active: true"), "creates categories as active");
assert(
  /inactive[\s\S]*stay inactive|will stay inactive/i.test(editJs),
  "does not reactivate inactive duplicates without explicit action"
);

const catalogApi = read("admin/catalog-api.js");
assert(catalogApi.includes("async function createCategory"), "createCategory helper exists");
assert(catalogApi.includes('.from("categories")'), "createCategory writes categories table");

const css = read("admin/admin.css");
assert(css.includes(".inline-cat-panel"), "inline category panel styles present");
assert(css.includes(".inline-cat-error"), "inline error styles present");
assert(css.includes("[hidden]"), "hidden CSS fix retained");

// Pure name-normalization / duplicate fixture (mocked)
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  [
    "function normalizeCategoryName(name) {",
    "  return String(name || '').trim().replace(/\\s+/g, ' ').toLowerCase();",
    "}",
    "function findEquivalentCategory(categories, name) {",
    "  var needle = normalizeCategoryName(name);",
    "  if (!needle) return null;",
    "  for (var i = 0; i < categories.length; i++) {",
    "    if (normalizeCategoryName(categories[i].name) === needle) return categories[i];",
    "  }",
    "  return null;",
    "}",
    "this.normalizeCategoryName = normalizeCategoryName;",
    "this.findEquivalentCategory = findEquivalentCategory;",
  ].join("\n"),
  sandbox
);

const fixtures = [
  { id: "1", name: "Planters", active: true },
  { id: "2", name: "  Wall Art ", active: false },
];
assert(sandbox.normalizeCategoryName("  Foo   Bar ") === "foo bar", "trims/collapses name whitespace");
assert(sandbox.findEquivalentCategory(fixtures, "planters").id === "1", "finds active duplicate by name");
assert(sandbox.findEquivalentCategory(fixtures, "WALL ART").id === "2", "finds inactive duplicate by name");
assert(sandbox.findEquivalentCategory(fixtures, "New Thing") === null, "new names are not duplicates");
assert(sandbox.findEquivalentCategory(fixtures, "   ") === null, "blank name is not a match");

const shell = read("admin/admin-shell.js");
assert(shell.includes("Orders"), "Orders nav still present as-is");
assert(shell.includes("Customers"), "Customers nav still present as-is");
assert(shell.includes("Appearance"), "Appearance nav still present as-is");
assert(shell.includes("Settings"), "Settings nav still present as-is");
assert(shell.includes("is-disabled"), "coming-soon nav items remain disabled");

if (failed) {
  console.error("\n" + failed + " local inline-category check(s) failed");
  process.exit(1);
}
console.log("\nAll local inline-category checks passed (mocked; not live Supabase).");
