"use strict";

/**
 * Same-origin product photos, served from an existing API route so the
 * Hobby plan does not gain another serverless function.
 * The public URL is /img/<preset>/<folder>/<file>. The site edge caches the
 * response for a year. Supabase is contacted only when that copy is missing.
 */

var PRESETS = {
  card: { width: 600, quality: 75 },
  admin: { width: 200, quality: 70 },
  detail: { width: 1200, quality: 82 },
  cart: { width: 160, quality: 70 },
};

var MAX_BYTES = 1500000;

function parseImageRequest(query) {
  query = query || {};
  var presetName = String(query.preset || "");
  var preset = PRESETS[presetName];
  var folder = String(query.folder || "");
  var file = String(query.file || "");
  if (!preset) return null;
  if (!/^[A-Za-z0-9-]{1,80}$/.test(folder)) return null;
  if (!/^[A-Za-z0-9-]{1,80}\.(?:webp|jpe?g|png)$/i.test(file)) return null;
  return {
    preset: presetName,
    folder: folder,
    file: file,
    width: preset.width,
    quality: preset.quality,
  };
}

function queryOf(req) {
  var q = (req && req.query) || {};
  if (q.preset || q.folder || q.file) return q;
  try {
    var url = new URL(String((req && req.url) || ""), "https://www.sandrconcretecrafts.com");
    return {
      preset: url.searchParams.get("preset") || "",
      folder: url.searchParams.get("folder") || "",
      file: url.searchParams.get("file") || "",
    };
  } catch (err) {
    return q;
  }
}

function isImageRequest(req) {
  var q = queryOf(req);
  return Boolean(q.preset || q.folder || q.file);
}

function projectBase() {
  var raw = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(raw)) return "";
  return raw;
}

function cacheHeaders(res, type, length) {
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", String(length));
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

async function readImage(url) {
  var upstream = await fetch(url, { redirect: "manual" });
  if (!upstream || upstream.status !== 200) return null;
  var type = String(upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type.indexOf("image/") !== 0) return null;
  var bytes = Buffer.from(await upstream.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) return null;
  return { type: type, bytes: bytes };
}

async function serve(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return;
  }
  var parsed = parseImageRequest(queryOf(req));
  var base = projectBase();
  if (!parsed || !base) {
    res.statusCode = parsed ? 503 : 400;
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return;
  }
  var objectPath = encodeURIComponent(parsed.folder) + "/" + encodeURIComponent(parsed.file);
  var rendered =
    base +
    "/storage/v1/render/image/public/product-images/" +
    objectPath +
    "?width=" +
    parsed.width +
    "&quality=" +
    parsed.quality +
    "&resize=contain";
  var image = null;
  try {
    image = await readImage(rendered);
    if (!image) {
      image = await readImage(base + "/storage/v1/object/public/product-images/" + objectPath);
    }
  } catch (err) {
    image = null;
  }
  if (!image) {
    res.statusCode = 404;
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return;
  }
  cacheHeaders(res, image.type, image.bytes.length);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(image.bytes);
}

module.exports = {
  PRESETS: PRESETS,
  parseImageRequest: parseImageRequest,
  isImageRequest: isImageRequest,
  serve: serve,
};
