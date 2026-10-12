/**
 * Display URLs for product photos.
 * Cards, thumbs, and the product detail use a few same-origin sizes.
 * Those URLs are cached at the site edge, so a visit does not download the
 * photo from Supabase. Storage paths stay content-addressed, so a replaced
 * photo gets a new URL instead of a stale cached one.
 */
(function (global) {
  "use strict";

  var PRESETS = {
    adminThumb: { route: "admin" },
    dashThumb: { route: "admin" },
    editorThumb: { route: "admin" },
    editorPreview: { route: "detail" },
    card: { route: "card" },
    detail: { route: "detail" },
    cart: { route: "cart" },
    about: { route: "card" },
  };

  function escapeAttr(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function objectPublicParts(url) {
    var raw = String(url || "").trim();
    var marker = "/storage/v1/object/public/";
    var idx = raw.indexOf(marker);
    if (idx === -1) return null;
    if (raw.indexOf("/storage/v1/render/image/") !== -1) return null;
    var origin = raw.slice(0, idx);
    var path = raw.slice(idx + marker.length);
    var cut = path.search(/[?#]/);
    if (cut !== -1) path = path.slice(0, cut);
    if (!origin || !path) return null;
    return { origin: origin, path: path };
  }

  function displayPath(url, route) {
    var parts = objectPublicParts(url);
    if (!parts) return "";
    var path = parts.path;
    var bucket = "product-images/";
    if (path.indexOf(bucket) !== 0) return "";
    var rest = path.slice(bucket.length);
    if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9-]+\.(?:webp|jpe?g|png)$/i.test(rest)) return "";
    if (route !== "card" && route !== "admin" && route !== "detail" && route !== "cart") return "";
    return "/img/" + route + "/" + rest;
  }

  function transformUrl(url, presetName) {
    var preset = presetOf(presetName);
    var local = displayPath(url, preset.route);
    return local || String(url || "");
  }

  function presetOf(name) {
    return PRESETS[name] || PRESETS.card;
  }

  function displayUrl(url, presetName) {
    return transformUrl(url, presetName);
  }

  function resolved(url, presetName) {
    var original = String(url || "");
    var src = transformUrl(original, presetName);
    return {
      src: src,
      srcset: "",
      sizes: "",
      full: "",
    };
  }

  function imgTag(url, opts) {
    opts = opts || {};
    var view = resolved(url, opts.preset || "card");
    var parts = [
      'src="' + escapeAttr(view.src) + '"',
      'alt="' + escapeAttr(opts.alt || "") + '"',
      'decoding="async"',
      'loading="' + (opts.eager ? "eager" : "lazy") + '"',
    ];
    if (opts.eager) parts.push('fetchpriority="high"');
    if (opts.width) parts.push('width="' + escapeAttr(String(opts.width)) + '"');
    if (opts.height) parts.push('height="' + escapeAttr(String(opts.height)) + '"');
    if (opts.fallback) parts.push('data-fallback="' + escapeAttr(opts.fallback) + '"');
    return "<img " + parts.join(" ") + " />";
  }

  function urlsMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    try {
      var base =
        global.location && global.location.href
          ? global.location.href
          : "https://www.sandrconcretecrafts.com/";
      return new URL(a, base).href === new URL(b, base).href;
    } catch (err) {
      return false;
    }
  }

  function installFallback(root) {
    var target = root || global.document;
    if (!target || target.__srImgFallback) return;
    target.__srImgFallback = true;
    target.addEventListener(
      "error",
      function (event) {
        var img = event.target;
        if (!img || !img.getAttribute || String(img.tagName).toUpperCase() !== "IMG") return;
        var step = img.getAttribute("data-img-step") || "";
        var last = img.getAttribute("data-fallback");
        if (step !== "fallback" && last && !urlsMatch(img.src, last)) {
          img.setAttribute("data-img-step", "fallback");
          img.removeAttribute("srcset");
          img.src = last;
          return;
        }
        img.classList.add("img-failed");
      },
      true
    );
  }

  global.SRImageDisplay = {
    PRESETS: PRESETS,
    displayUrl: displayUrl,
    resolved: resolved,
    imgTag: imgTag,
    installFallback: installFallback,
    transformUrl: transformUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
