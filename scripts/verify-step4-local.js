#!/usr/bin/env node
/**
 * Local checks for Step 4 import inventory + storefront helpers.
 * Does not touch the remote database.
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

const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const demoIds = [...appJs.matchAll(/id:\s*"([a-z0-9-]+)"/g)]
  .map((m) => m[1])
  .filter((id, i, arr) => arr.indexOf(id) === i && !id.includes(" "));

// Rough: DEMO_PRODUCTS block ids before SHIPPING
const demoBlock = appJs.slice(0, appJs.indexOf("SHIPPING_THRESHOLD"));
const productIds = [...demoBlock.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
assert(productIds.length === 17, "demo catalog has 17 products (got " + productIds.length + ")");

const importSql = fs.readFileSync(
  path.join(root, "supabase/migrations/20260912000008_import_legacy_storefront_products.sql"),
  "utf8"
);
const sourceKeys = [...importSql.matchAll(/'legacy:([a-z0-9-]+)'/g)].map((m) => m[1]);
const uniqueKeys = [...new Set(sourceKeys)];
assert(uniqueKeys.length === 17, "import has 17 unique legacy source keys");
productIds.forEach(function (id) {
  assert(uniqueKeys.indexOf(id) !== -1, "import includes legacy:" + id);
});

const mig7 = fs.readFileSync(
  path.join(root, "supabase/migrations/20260912000007_storefront_catalog_fields.sql"),
  "utf8"
);
assert(mig7.includes("source_key"), "migration 07 adds source_key");
assert(mig7.includes("item_no"), "migration 07 adds item_no");
assert(mig7.includes("track_inventory"), "migration 07 adds track_inventory");
assert(mig7.includes("'sold_out'"), "migration 07 allows sold_out public read");

const writeEnv = fs.readFileSync(path.join(root, "scripts/write-public-env.js"), "utf8");
assert(writeEnv.includes("USE_LIVE_CATALOG"), "build writes USE_LIVE_CATALOG");

// Helper sandbox checks
const helperSrc = fs.readFileSync(path.join(root, "js/storefront-catalog.js"), "utf8");
const sandbox = {
  console,
  window: { location: { origin: "https://sandrconcretecrafts.com" }, __SR_ENV__: {} },
};
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(helperSrc, sandbox);
const Cat = sandbox.window.SRStorefrontCatalog;
assert(!!Cat, "SRStorefrontCatalog defined");
assert(Cat.escapeHtml('<img src=x onerror=alert(1)>').includes("&lt;"), "escapeHtml encodes tags");
assert(Cat.isSafeImageUrl("/assets/prod-01.png"), "root-relative assets allowed");
assert(Cat.isSafeImageUrl("assets/prod-01.png"), "relative assets allowed");
assert(!Cat.isSafeImageUrl("javascript:alert(1)"), "javascript: blocked");
assert(
  Cat.resolveCartProductId("cow", [{ id: "uuid-1", legacyId: "cow", sourceKey: "legacy:cow" }]) ===
    "uuid-1",
  "cart maps legacy id cow → uuid"
);
assert(Cat.resolveCartProductId("missing", [{ id: "uuid-1", legacyId: "cow" }]) === null, "stale cart id → null");

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(indexHtml.includes("storefront-catalog.js"), "index loads storefront catalog helper");
assert(!indexHtml.includes("USE_LIVE_CATALOG"), "index does not hardcode live flag");
assert(indexHtml.includes("No order was placed"), "checkout honesty copy present");

require("child_process").execSync("node scripts/write-public-env.js", {
  cwd: root,
  stdio: "pipe",
  env: Object.assign({}, process.env, {
    USE_LIVE_CATALOG: "false",
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",
  }),
});
const envOut = fs.readFileSync(path.join(root, "js/env.js"), "utf8");
assert(envOut.includes("USE_LIVE_CATALOG: false"), "build defaults USE_LIVE_CATALOG false");

if (failed) {
  console.error("\n" + failed + " check(s) failed");
  process.exit(1);
}
console.log("\nAll local Step 4 checks passed.");
