"use strict";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  var body = req.body;
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > 256 * 1024) {
      var tooLarge = new Error("Request body is too large.");
      tooLarge.code = "BODY_TOO_LARGE";
      tooLarge.status = 413;
      throw tooLarge;
    }
    try {
      body = JSON.parse(body || "{}");
    } catch (e) {
      var invalid = new Error("Invalid JSON body.");
      invalid.code = "INVALID_JSON";
      invalid.status = 400;
      throw invalid;
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    var bad = new Error("A JSON object is required.");
    bad.code = "INVALID_JSON";
    bad.status = 400;
    throw bad;
  }
  return body;
}

function errorStatus(err) {
  if (err && Number.isInteger(err.status) && err.status >= 400 && err.status < 600) {
    return err.status;
  }
  if (err && err.code === "SUPABASE_SERVICE_NOT_CONFIGURED") return 503;
  if (err && err.code === "SUPABASE_REST_ERROR") return 502;
  return 500;
}

module.exports = {
  sendJson: sendJson,
  readJsonBody: readJsonBody,
  errorStatus: errorStatus,
};
