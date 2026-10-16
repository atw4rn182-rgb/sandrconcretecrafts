/* Hearts / favorites / popular, Post to Socials, and Tap to Pay setup checks. */
var assert = require("assert");
var fs = require("fs");
var path = require("path");

function read(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

// Likes: server-authoritative counts behind an RPC, no direct table access.
var sql = read("supabase/migrations/20261015000001_product_likes.sql");
assert.match(sql, /like_count integer not null default 0/i);
assert.match(sql, /products_like_count_nonnegative/);
assert.match(sql, /primary key \(product_id, device_id\)/i);
assert.match(sql, /alter table public\.product_likes enable row level security/i);
assert.match(sql, /revoke all on public\.product_likes from anon, authenticated/i);
assert.match(sql, /security definer/i);
assert.match(sql, /on conflict do nothing/i);
assert.match(sql, /status in \('published', 'sold_out'\)/i);
assert.match(sql, /products_zz_like_count_guard/);
assert.match(sql, /grant execute on function public\.toggle_product_like/i);
assert.doesNotMatch(sql, /grant (insert|update|select)[^;]*product_likes[^;]*anon/i);

var catalog = read("js/storefront-catalog.js");
assert.match(catalog, /rpc\("toggle_product_like"/);
assert.match(catalog, /sr_favorites_v1/);
assert.match(catalog, /sr_like_device_v1/);
assert.match(catalog, /like_count/);
assert.match(catalog, /runWithLikeFallback/, "catalog still loads before the migration is applied");
assert.doesNotMatch(catalog, /from\("product_likes"\)/, "never downloads the likes table");
assert.doesNotMatch(catalog, /\.channel\(|setInterval/, "no realtime or polling");

var app = read("app.js");
assert.match(app, /class="card-heart/);
assert.match(app, /data-like="/);
assert.match(app, /aria-pressed/);
assert.match(app, /closest\("\[data-category\],\[data-view\]"\)/);
assert.match(app, /fetchCatalogPage/);
assert.doesNotMatch(app, />\s*XOXO\s*</, "cards never show the word XOXO");

var css = read("styles.css");
assert.match(css, /\.card-heart\.is-liked/);
assert.match(css, /\.card-heart-count:empty/);

// Post to Socials: one shared post, honest platform states.
global.window = global;
require(path.join(__dirname, "..", "admin", "social-share.js"));
var share = global.SRSocialShare;
assert.ok(share, "SRSocialShare is exported");
assert.strictEqual(share.MAX_PRODUCTS, 10);
assert.strictEqual(
  share.DEFAULT_INTRO,
  "New inventory drop from S&R Concrete Crafts! Check out our newest pieces."
);
share.PLATFORMS.forEach(function (p) {
  assert.strictEqual(p.connected, false, p.id + " is not faked as connected");
  assert.strictEqual(p.publish, null, p.id + " has no fake publisher");
  assert.ok(p.setupNote, p.id + " documents what real posting needs");
});
assert.deepStrictEqual(
  share.PLATFORMS.map(function (p) { return p.id; }),
  ["facebook", "instagram", "tiktok"]
);

var one = [{ id: "abc-1", title: "Planter", price: 25, categories: [{ slug: "planters" }] }];
assert.strictEqual(share.linkFor(one), "https://www.sandrconcretecrafts.com/?product=abc-1");
var sameCat = [
  { id: "a", title: "A", price: 10, categories: [{ slug: "planters" }] },
  { id: "b", title: "B", price: 12, categories: [{ slug: "planters" }, { slug: "gifts" }] },
];
assert.strictEqual(share.linkFor(sameCat), "https://www.sandrconcretecrafts.com/?category=planters");
var mixed = [
  { id: "a", title: "A", price: 10, categories: [{ slug: "planters" }] },
  { id: "b", title: "B", price: 12, categories: [{ slug: "coasters" }] },
];
assert.strictEqual(share.linkFor(mixed), "https://www.sandrconcretecrafts.com/");
var caption = share.buildCaption(mixed, share.linkFor(mixed));
assert.match(caption, /^New inventory drop from S&R Concrete Crafts!/);
assert.match(caption, /A/);
assert.match(caption, /B/);
assert.strictEqual((caption.match(/https:\/\//g) || []).length, 1, "one link for the whole post");

var socialJs = read("admin/social-share.js");
assert.match(socialJs, /navigator\.share|global\.navigator\.share/);
assert.match(socialJs, /canShare/);
assert.match(socialJs, /Nothing was posted/);
assert.doesNotMatch(socialJs, /access_token|app_secret|client_secret/i);

var productsHtml = read("admin/products.html");
assert.match(productsHtml, /id="socialSelectBtn"/);
assert.match(productsHtml, /id="socialSelectBar"/);
assert.match(productsHtml, /social-share\.js\?v=/);
var productsJs = read("admin/products.js");
assert.match(productsJs, /SRSocialShare\.open/);
assert.match(productsJs, /data-action="social"/);

// Tap to Pay: version return + first-time setup guide.
var payments = read("admin/payments.js");
assert.match(payments, /MIN_POS_APP_CODE = 13/);
assert.match(payments, /recordPosAppReturn/);
assert.match(payments, /posAppHelpToggle/);
var setupActivity = read(
  "android/app/src/main/java/com/sandrconcretecrafts/pos/ui/SetupActivity.kt"
);
assert.match(setupActivity, /setup=ready/);
assert.match(setupActivity, /app_code=/);

console.log("xoxo hearts, social sharing, and Tap to Pay setup checks passed");
