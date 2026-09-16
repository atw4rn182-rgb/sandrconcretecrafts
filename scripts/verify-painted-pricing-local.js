#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const adminSandbox = { console, URL, globalThis: null };
adminSandbox.globalThis = adminSandbox;
vm.runInNewContext(read("admin/catalog-api.js"), adminSandbox, {
  filename: "admin/catalog-api.js",
});
const admin = adminSandbox.SRCatalog;

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(admin.parseMoneyInput("", { required: false }))),
  { ok: true, value: null, error: null },
  "blank optional money remains null"
);
assert.strictEqual(admin.parseMoneyInput("$1,250.129", {}).value, 1250.13);
assert.strictEqual(admin.parseMoneyInput("-1", {}).ok, false);
assert.strictEqual(admin.parseMoneyInput("not money", {}).ok, false);

function validProduct(overrides) {
  return Object.assign(
    {
      title: "Test",
      description: "Test description",
      price: "20.00",
      painted_price: "",
      sale_price: "",
      quantity: "1",
      status: "draft",
      product_type: "single",
      imageCount: 0,
      category_ids: [],
      badge_ids: [],
    },
    overrides || {}
  );
}

let checked = admin.validateProductInput(validProduct());
assert.strictEqual(checked.ok, true);
assert.strictEqual(checked.value.price, 20);
assert.strictEqual(checked.value.painted_price, null);

checked = admin.validateProductInput(validProduct({ painted_price: "$28.00" }));
assert.strictEqual(checked.ok, true);
assert.strictEqual(checked.value.painted_price, 28);

assert.strictEqual(
  admin.validateProductInput(validProduct({ painted_price: "-2" })).ok,
  false
);
assert.strictEqual(
  admin.validateProductInput(validProduct({ painted_price: "free" })).ok,
  false
);
assert.strictEqual(
  admin.validateProductInput(validProduct({ painted_price: "0" })).ok,
  false
);

const serverCatalog = require(path.join(root, "api/_lib/supabase-catalog.js"));
const product = {
  title: "Skull Planter",
  price: "20.00",
  sale_price: null,
  painted_price: "28.00",
  status: "published",
  track_inventory: true,
  quantity: 3,
};

assert.strictEqual(serverCatalog.unitCentsForFinish(product, "raw"), 2000);
assert.strictEqual(serverCatalog.unitCentsForFinish(product, "painted"), 2800);
assert.strictEqual(
  serverCatalog.unitCentsForFinish(
    Object.assign({}, product, { painted_price: null }),
    "painted"
  ),
  null
);
assert.strictEqual(serverCatalog.assertPurchasable(product, 2, "raw").ok, true);
assert.strictEqual(serverCatalog.assertPurchasable(product, 2, "painted").ok, true);
assert.strictEqual(serverCatalog.assertPurchasable(product, 4, "raw").ok, false);
assert.strictEqual(serverCatalog.assertPurchasable(product, 1, "custom").ok, false);

const app = read("app.js");
const checkout = read("api/create-checkout-session.js");
const stripe = read("api/_lib/stripe.js");
const webhook = read("api/stripe-webhook.js");
const verifyApi = read("api/verify-checkout-session.js");
const editor = read("admin/product-edit.html");
const orders = read("admin/orders.js");

assert(app.includes('lineKey(id, finish)'), "cart has product+finish identity");
assert(app.includes('finish: l.finish'), "checkout payload carries finish");
assert(app.includes('From '), "dual-price cards use restrained From pricing");
assert(editor.includes('id="painted_price"'), "admin has optional painted price");
assert(editor.includes("Leave Painted Price blank"), "admin helper text present");
assert(checkout.includes("catalog.assertPurchasable"), "server validates catalog data");
assert(!checkout.includes("row.price_cents"), "checkout does not accept browser prices");
assert(stripe.includes("[metadata][finish]"), "Stripe product metadata carries finish");
assert(
  stripe.includes("starting_after"),
  "Stripe line-item retrieval follows pagination"
);
assert(webhook.includes("finish: finish"), "webhook persists trusted finish");
assert(
  webhook.includes("retrieveCheckoutSessionLineItems"),
  "webhook retrieves every Stripe line-item page"
);
assert(orders.includes("Finish: "), "Admin Orders renders finish");
assert(
  verifyApi.includes('session.metadata.source === "storefront"'),
  "checkout success verification requires a storefront session"
);
assert(
  checkout.includes('source: "storefront"'),
  "checkout creation labels sessions with the source verification accepts"
);

(async function verifyCheckoutHandler() {
  const catalogPath = require.resolve(
    path.join(root, "api/_lib/supabase-catalog.js")
  );
  const stripePath = require.resolve(path.join(root, "api/_lib/stripe.js"));
  const checkoutPath = require.resolve(
    path.join(root, "api/create-checkout-session.js")
  );
  const verifyPath = require.resolve(
    path.join(root, "api/verify-checkout-session.js")
  );
  const realStripe = require(stripePath);
  const originalFetch = global.fetch;
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_mock";
  let pageCalls = 0;
  global.fetch = async function () {
    pageCalls += 1;
    return {
      ok: true,
      json: async () =>
        pageCalls === 1
          ? { data: [{ id: "li_1" }], has_more: true }
          : { data: [{ id: "li_2" }], has_more: false },
    };
  };
  const pagedItems = await realStripe.retrieveCheckoutSessionLineItems(
    "cs_test_mock"
  );
  assert.deepStrictEqual(
    pagedItems.map((item) => item.id),
    ["li_1", "li_2"]
  );
  assert.strictEqual(pageCalls, 2);
  global.fetch = originalFetch;
  if (originalStripeKey == null) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalStripeKey;

  let stripeInput = null;
  const trusted = Object.assign({}, product, {
    id: "11111111-1111-4111-8111-111111111111",
    description: "Trusted description",
    product_images: [],
  });

  require.cache[catalogPath].exports = {
    fetchPublicProduct: async () => trusted,
    assertPurchasable: serverCatalog.assertPurchasable,
    primaryImageUrl: () => null,
  };
  require.cache[stripePath] = {
    id: stripePath,
    filename: stripePath,
    loaded: true,
    exports: {
      siteUrl: () => "https://www.sandrconcretecrafts.com",
      stripeSecretKey: () => "sk_test_mock",
      stripeAllowLiveDebug: () => ({
        STRIPE_ALLOW_LIVE: null,
        STRIPE_ALLOW_TRUE: null,
        allowLivePasses: false,
      }),
      createCheckoutSession: async (input) => {
        stripeInput = input;
        return { id: "cs_test_mock", url: "https://checkout.stripe.test/mock" };
      },
    },
  };
  delete require.cache[checkoutPath];
  const handler = require(checkoutPath);

  function responseCapture() {
    return {
      statusCode: 0,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      end(value) {
        this.body = JSON.parse(value || "{}");
      },
    };
  }

  let res = responseCapture();
  await handler(
    {
      method: "POST",
      headers: {},
      body: {
        items: [
          {
            id: trusted.id,
            finish: "raw",
            quantity: 1,
            unit_amount: 1,
          },
          {
            id: trusted.id,
            finish: "painted",
            quantity: 1,
            unit_amount: 1,
          },
        ],
      },
    },
    res
  );
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(
    stripeInput.lineItems.map((line) => [line.finish, line.unitAmountCents]),
    [
      ["raw", 2000],
      ["painted", 2800],
    ],
    "server ignores browser prices and chooses trusted finish prices"
  );
  assert.strictEqual(
    stripeInput.metadata.source,
    "storefront",
    "created Checkout Session uses the verified storefront source"
  );

  res = responseCapture();
  await handler(
    {
      method: "POST",
      headers: {},
      body: {
        items: [{ id: trusted.id, finish: "custom", quantity: 1 }],
      },
    },
    res
  );
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.error, /valid finish/i);

  stripeInput = null;
  res = responseCapture();
  await handler(
    {
      method: "POST",
      headers: {},
      body: {
        items: [
          { id: trusted.id, finish: "raw", quantity: 2 },
          { id: trusted.id, finish: "painted", quantity: 2 },
        ],
      },
    },
    res
  );
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.error, /Only 3 available/i);
  assert.strictEqual(stripeInput, null, "combined finish quantities cannot oversell");

  require.cache[stripePath].exports.retrieveCheckoutSession = async () => ({
    payment_status: "paid",
    metadata: { source: "storefront" },
  });
  delete require.cache[verifyPath];
  const verifyHandler = require(verifyPath);
  res = responseCapture();
  await verifyHandler(
    {
      method: "GET",
      query: { session_id: "cs_test_verified" },
      url: "/api/verify-checkout-session?session_id=cs_test_verified",
    },
    res
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.verified, true);

  require.cache[stripePath].exports.retrieveCheckoutSession = async () => ({
    payment_status: "paid",
    metadata: { source: "sandrconcretecrafts" },
  });
  res = responseCapture();
  await verifyHandler(
    {
      method: "GET",
      url: "/api/verify-checkout-session?session_id=cs_test_wrongsource",
    },
    res
  );
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.verified, false);

  require.cache[stripePath].exports.retrieveCheckoutSession = async () => ({
    payment_status: "unpaid",
    metadata: { source: "storefront" },
  });
  res = responseCapture();
  await verifyHandler(
    {
      method: "GET",
      query: { session_id: "cs_test_unpaid" },
      url: "/api/verify-checkout-session?session_id=cs_test_unpaid",
    },
    res
  );
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.verified, false);

  console.log("All painted pricing and finish checks passed.");
})().catch(function (err) {
  console.error(err);
  process.exitCode = 1;
});
