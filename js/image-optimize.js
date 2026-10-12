/**
 * Rules for product-photo storage.
 * Originals are resized before they are stored. Display thumbnails stay separate.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SRImageOptimize = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var MAX_EDGE = 1600;
  var QUALITY = 0.82;
  var MAX_INCOMING_BYTES = 25 * 1024 * 1024;
  var STORED_MAX_BYTES = 10 * 1024 * 1024;
  var SKIP_BYTES = 450 * 1024;
  var MIN_SAVINGS = 0.15;

  var TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };

  function targetDimensions(width, height) {
    var w = Math.max(0, Math.round(Number(width) || 0));
    var h = Math.max(0, Math.round(Number(height) || 0));
    var edge = Math.max(w, h);
    if (!edge || edge <= MAX_EDGE) {
      return { width: w, height: h, resized: false };
    }
    var scale = MAX_EDGE / edge;
    return {
      width: Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale)),
      resized: true,
    };
  }

  function classify(file) {
    file = file || {};
    var mime = String(file.type || file.mime || "").toLowerCase();
    var bytes = Number(file.bytes != null ? file.bytes : file.size) || 0;
    var width = Number(file.width) || 0;
    var height = Number(file.height) || 0;
    if (!TYPES[mime]) {
      return {
        action: "reject",
        message: "Use a JPEG, PNG, or WebP photo.",
      };
    }
    if (bytes > MAX_INCOMING_BYTES) {
      return {
        action: "reject",
        message: "This photo is over 25 MB. Choose a smaller photo and try again.",
      };
    }
    if (!bytes) {
      return { action: "reject", message: "That photo was empty. Choose another file." };
    }
    if (mime === "image/gif") {
      if (bytes > STORED_MAX_BYTES) {
        return {
          action: "reject",
          message: "GIF photos over 10 MB can’t be stored. Use a JPEG or PNG instead.",
        };
      }
      return { action: "passthrough", reason: "gif" };
    }
    var edge = Math.max(width, height);
    if (width && height && edge <= MAX_EDGE && bytes <= SKIP_BYTES) {
      return { action: "passthrough", reason: "already-small" };
    }
    return { action: "optimize", reason: edge > MAX_EDGE ? "dimensions" : "bytes" };
  }

  function preferOptimized(info) {
    info = info || {};
    var originalBytes = Number(info.originalBytes) || 0;
    var optimizedBytes = Number(info.optimizedBytes) || 0;
    if (!optimizedBytes) return false;
    if (optimizedBytes > STORED_MAX_BYTES) return false;
    if (info.resized) return optimizedBytes < originalBytes;
    if (!originalBytes) return true;
    return optimizedBytes <= originalBytes * (1 - MIN_SAVINGS);
  }

  return {
    MAX_EDGE: MAX_EDGE,
    QUALITY: QUALITY,
    MAX_INCOMING_BYTES: MAX_INCOMING_BYTES,
    STORED_MAX_BYTES: STORED_MAX_BYTES,
    SKIP_BYTES: SKIP_BYTES,
    MIN_SAVINGS: MIN_SAVINGS,
    TYPES: TYPES,
    targetDimensions: targetDimensions,
    classify: classify,
    preferOptimized: preferOptimized,
  };
});
