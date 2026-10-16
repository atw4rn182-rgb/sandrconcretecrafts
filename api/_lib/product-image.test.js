"use strict";

var assert = require("assert");
var img = require("./product-image.js");

var card = img.parseImageRequest({ preset: "card", folder: "prod", file: "photo.jpg" });
assert.strictEqual(card.preset, "card");
assert.strictEqual(card.width, 600);
assert.strictEqual(card.quality, 75);
assert.strictEqual(img.PRESETS.admin.width, 200);
assert.strictEqual(img.PRESETS.detail.width, 1200);
assert.strictEqual(img.PRESETS.cart.width, 160);
assert.strictEqual(img.parseImageRequest({ preset: "original", folder: "prod", file: "photo.jpg" }), null);
assert.strictEqual(img.parseImageRequest({ preset: "card", folder: "../secret", file: "photo.jpg" }), null);
assert.strictEqual(img.parseImageRequest({ preset: "card", folder: "prod", file: "photo.svg" }), null);
assert.strictEqual(img.parseImageRequest({ preset: "card", folder: "prod", file: "a/b.jpg" }), null);
assert.strictEqual(img.isImageRequest({ query: { session_id: "cs_test_abc" } }), false);
assert.strictEqual(img.isImageRequest({ query: { preset: "card", folder: "prod", file: "photo.jpg" } }), true);
assert.ok(img.parseImageRequest({
  preset: "detail",
  folder: "06c80995-5af1-44b5-b0af-e0aca55239f9",
  file: "ea48364b-5ad2-4160-8dc6-89d58af54033.webp",
}));

var fs = require("fs");
var path = require("path");

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader: function (k, v) { this.headers[k.toLowerCase()] = v; },
    end: function (b) { this.body = b || null; },
  };
}

(async function () {
  process.env.SUPABASE_URL = "https://abcproject.supabase.co";
  var realFetch = global.fetch;
  var calls = [];
  global.fetch = async function (url) {
    calls.push(String(url));
    return new Response(Buffer.from("RIFF0000WEBPVP8 "), {
      status: 200,
      headers: { "content-type": "image/webp" },
    });
  };
  try {
    for (var preset of ["card", "admin", "detail", "cart"]) {
      calls.length = 0;
      var res = fakeRes();
      await img.serve(
        { method: "GET", query: { preset: preset, folder: "prod-1", file: "photo-1.webp" } },
        res
      );
      assert.strictEqual(res.statusCode, 200, preset + " served");
      assert.deepStrictEqual(calls, [
        "https://abcproject.supabase.co/storage/v1/object/public/product-images/prod-1/photo-1.webp",
      ], preset + " cache miss reads the stored object directly, once");
      assert.match(res.headers["cache-control"], /max-age=31536000, immutable/);
      assert.match(res.headers["vercel-cdn-cache-control"], /s-maxage=31536000/);
    }

    global.fetch = async function (url) {
      calls.push(String(url));
      return new Response("missing", { status: 400, headers: { "content-type": "application/json" } });
    };
    calls.length = 0;
    var miss = fakeRes();
    await img.serve({ method: "GET", query: { preset: "card", folder: "prod-1", file: "gone.webp" } }, miss);
    assert.strictEqual(miss.statusCode, 404);
    assert.strictEqual(miss.headers["cache-control"], "no-store", "missing photos are not cached");
    assert.strictEqual(calls.length, 1, "no fallback to a transformation endpoint");
    calls.forEach(function (u) {
      assert.doesNotMatch(u, /render\/image/);
    });
  } finally {
    global.fetch = realFetch;
  }

  // No Supabase Image Transformations anywhere in shipped code.
  var root = path.join(__dirname, "..", "..");
  var skip = /^(node_modules|android|\.git|\.vercel|supabase|scripts)$/;
  var offenders = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
      if (skip.test(entry.name)) return;
      var full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      if (!/\.(js|html|css|json)$/.test(entry.name) || /\.test\.js$/.test(entry.name)) return;
      var text = fs.readFileSync(full, "utf8");
      var lines = text.split(/\r?\n/);
      lines.forEach(function (line, i) {
        var rel = path.relative(root, full).replace(/\\/g, "/");
        if (/render\/image/.test(line)) {
          var guard = rel === "js/image-display.js" && /indexOf\("\/storage\/v1\/render\/image\/"\) !== -1\) return null/.test(line);
          var doc = rel === "api/_lib/product-image.js" && /^\s*\*/.test(line);
          if (!guard && !doc) offenders.push(rel + ":" + (i + 1));
        }
        if (/\btransform\s*:\s*\{/.test(line) && /\.js$/.test(rel)) offenders.push(rel + ":" + (i + 1) + " (storage transform option)");
      });
    });
  })(root);
  assert.deepStrictEqual(offenders, [], "Supabase image transformation usage found");

  console.log("image route checks passed");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
