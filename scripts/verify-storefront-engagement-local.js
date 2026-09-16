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

console.log("sharing fallbacks, review config, motion, scroll, and dismissal: ok");
