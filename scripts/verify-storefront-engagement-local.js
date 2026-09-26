#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var read = function (rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
};

var html = read("index.html");
var app = read("app.js");
var settings = read("js/store-settings.js");
var css = read("styles.css");

assert.match(html, /id="storeShare"/);
assert.match(html, /id="shareManual"[^>]*hidden/);
assert.match(html, /id="modalShare"/);
assert.match(html, /id="footerReview"[^>]*hidden/);
assert.match(html, /id="reviewBanner"[^>]*hidden/);
assert.match(html, /id="reviewBannerLink"(?![^>]*href=)/);
assert.match(html, /src="\/assets\/review-banner-approved\.png"/);
assert.ok(fs.existsSync(path.join(root, "assets/review-banner-approved.png")), "approved review PNG exists");
assert.strictEqual(
  fs.readFileSync(path.join(root, "assets/review-banner-approved.png"))[0],
  0x89,
  "approved review asset is a PNG"
);
assert.match(app, /navigator\.share/);
assert.match(app, /navigator\.clipboard\.writeText/);
assert.match(app, /input\.select\(\)/);
assert.match(app, /sr_review_banner_dismissed/);
assert.match(app, /sessionStorage\.setItem/);
assert.match(app, /prefers-reduced-motion: reduce/);
assert.match(app, /is-scroll-hidden/);
assert.match(app, /artwork\.complete && !artwork\.naturalWidth/);
assert.ok(
  app.indexOf("await loadStoreSettings()") < app.indexOf("initReviewBanner();"),
  "review URL must be applied before banner initialization"
);
assert.match(settings, /google_review_url:\s*""/);
assert.match(settings, /cleanGoogleReviewUrl/);
assert.match(settings, /host === "google\.com"/);
assert.match(settings, /facebook:\s*""/);
assert.match(settings, /reviewLink\.removeAttribute\("href"\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.review-banner/);
assert.match(css, /\.review-banner-link img[\s\S]*drop-shadow/);
assert.match(css, /\.review-banner-link \{[\s\S]*overflow:\s*visible/);

var i18n = read("js/i18n.js");
assert.match(html, /data-lang-btn="en"/);
assert.match(html, /data-lang-btn="es"/);
assert.match(html, /js\/i18n\.js/);
assert.match(html, /class="lang-toggle"/);
assert.doesNotMatch(html, /translate\.google|goog-te-banner|Google Translate/i);
assert.match(i18n, /sr-storefront-lang/);
assert.match(i18n, /Agregar al carrito/);
assert.match(i18n, /card\.soldOut/);
assert.doesNotMatch(i18n, /admin\//);
assert.match(app, /SRStorefrontI18n/);
assert.match(app, /esc\(p\.name\)/);
assert.match(app, /esc\(shortDesc\(p\.desc\)\)/);
assert.doesNotMatch(app, /t\(\"p\.name\"\)|t\(p\.name\)/);

var adminFiles = [
  "admin/index.html",
  "admin/login.html",
  "admin/products.html",
  "admin/payments.html",
  "admin/settings.html",
];
adminFiles.forEach(function (rel) {
  var text = read(rel);
  assert.doesNotMatch(text, /lang-toggle|i18n\.js|data-lang-btn/, rel + " stays English-only");
});

console.log("sharing fallbacks, review config, motion, scroll, and dismissal: ok");
