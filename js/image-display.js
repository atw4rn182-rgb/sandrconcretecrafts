/**
 * Display-size URLs for product photos.
 * Original storage objects are never modified. Supabase image transformations
 * resize on request; if a transform fails, callers fall back to the original URL.
 */
(function (global) {
  "use strict";

  var PRESETS = {
    adminThumb: { width: 160, quality: 70 },
    dashThumb: { width: 96, quality: 70 },
    editorThumb: { width: 176, quality: 75 },
    editorPreview: { width: 960, quality: 80 },
    card: {
      width: 480,
      quality: 75,
      srcset: [480, 800],
      sizes: "(max-width: 560px) 92vw, (max-width: 960px) 45vw, 340px",
    },
    detail: { width: 1200, quality: 82 },
    cart: { width: 160, quality: 70 },
    about: { width: 960, quality: 78 },
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

  function transformUrl(url, width, quality) {
    var parts = objectPublicParts(url);
    if (!parts) return String(url || "");
    var w = Math.max(16, Math.round(Number(width) || 480));
    var q = Math.min(100, Math.max(40, Math.round(Number(quality) || 75)));
    return (
      parts.origin +
      "/storage/v1/render/image/public/" +
      parts.path +
      "?width=" +
      w +
      "&quality=" +
      q +
      "&resize=contain"
    );
  }

  function presetOf(name) {
    return PRESETS[name] || PRESETS.card;
  }

  function displayUrl(url, presetName) {
    var preset = presetOf(presetName);
    return transformUrl(url, preset.width, preset.quality);
  }

  function resolved(url, presetName) {
    var original = String(url || "");
    var preset = presetOf(presetName);
    var src = transformUrl(original, preset.width, preset.quality);
    var srcset = "";
    if (src !== original && preset.srcset && preset.srcset.length) {
      srcset = preset.srcset
        .map(function (w) {
          return transformUrl(original, w, preset.quality) + " " + w + "w";
        })
        .join(", ");
    }
    return {
      src: src,
      srcset: srcset,
      sizes: srcset ? preset.sizes || "" : "",
      full: src !== original ? original : "",
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
    if (view.srcset) {
      parts.push('srcset="' + escapeAttr(view.srcset) + '"');
      if (view.sizes) parts.push('sizes="' + escapeAttr(view.sizes) + '"');
    }
    if (opts.width) parts.push('width="' + escapeAttr(String(opts.width)) + '"');
    if (opts.height) parts.push('height="' + escapeAttr(String(opts.height)) + '"');
    if (view.full) parts.push('data-full="' + escapeAttr(view.full) + '"');
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
        var full = img.getAttribute("data-full");
        var last = img.getAttribute("data-fallback");
        if (step !== "full" && full && !urlsMatch(img.src, full)) {
          img.setAttribute("data-img-step", "full");
          img.removeAttribute("srcset");
          img.src = full;
          return;
        }
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
