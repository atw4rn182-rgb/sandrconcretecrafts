"use strict";

function env(name) {
  return String(process.env[name] || "").trim();
}

function config() {
  var apiKey = env("RESEND_API_KEY");
  var from = env("RECEIPT_FROM_EMAIL");
  if (!apiKey || !from) {
    var err = new Error(
      "Email receipts are not configured. Add RESEND_API_KEY and RECEIPT_FROM_EMAIL; the sale is still safely recorded."
    );
    err.code = "RECEIPT_NOT_CONFIGURED";
    err.status = 503;
    throw err;
  }
  return {
    apiKey: apiKey,
    from: from,
    replyTo: env("RECEIPT_REPLY_TO_EMAIL") || null,
    bcc: env("RECEIPT_BCC_EMAIL") || null,
  };
}

async function sendReceipt(message, idempotencyKey) {
  var cfg = config();
  var payload = {
    from: cfg.from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  if (cfg.replyTo) payload.reply_to = cfg.replyTo;
  if (cfg.bcc) payload.bcc = [cfg.bcc];

  var response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + cfg.apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": String(idempotencyKey),
    },
    body: JSON.stringify(payload),
  });
  var body = await response.json().catch(function () {
    return null;
  });
  if (!response.ok || !body || !body.id) {
    var err = new Error(
      (body && body.message) || "The receipt provider could not send this email."
    );
    err.code = "RECEIPT_PROVIDER_ERROR";
    err.status = response.status >= 400 && response.status < 500 ? 502 : 503;
    throw err;
  }
  return body;
}

module.exports = {
  config: config,
  sendReceipt: sendReceipt,
};
