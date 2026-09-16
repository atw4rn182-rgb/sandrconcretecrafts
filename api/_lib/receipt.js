"use strict";

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function validEmail(value) {
  var email = String(value || "").trim().toLowerCase();
  if (!email || email.length > 254 || /[\r\n]/.test(email)) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function sourceLabel(source) {
  return {
    online: "Online Store",
    cash: "Cash",
    tap_to_pay: "Tap to Pay",
  }[String(source || "").toLowerCase()] || "Sale";
}

function money(cents, currency) {
  var amount = (Number(cents) || 0) / 100;
  var code = String(currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch (_err) {
    return "$" + amount.toFixed(2);
  }
}

function formatDate(value) {
  var date = new Date(value);
  if (!isFinite(date.getTime())) return "Date unavailable";
  return date.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Denver",
  });
}

function lineDescription(item) {
  var finish =
    item.finish === "painted"
      ? "Painted"
      : item.finish === "raw"
        ? "Raw concrete"
        : null;
  return String(item.product_name || "Item") + (finish ? " — " + finish : "");
}

function buildReceipt(order) {
  var items = order.order_items || order.items || [];
  var soldAt = order.sold_at || order.created_at;
  var source = sourceLabel(order.payment_source);
  var total = money(order.amount_total, order.currency);
  var textLines = items.map(function (item) {
    return (
      String(Number(item.quantity) || 0) +
      " × " +
      lineDescription(item) +
      " — " +
      money(item.amount_total, order.currency)
    );
  });
  var htmlLines = items.map(function (item) {
    return (
      '<tr><td style="padding:10px 0;border-bottom:1px solid #e8e1d7">' +
      escapeHtml(String(Number(item.quantity) || 0) + " × " + lineDescription(item)) +
      '</td><td style="padding:10px 0;border-bottom:1px solid #e8e1d7;text-align:right">' +
      escapeHtml(money(item.amount_total, order.currency)) +
      "</td></tr>"
    );
  });
  var greeting = order.customer_name
    ? "Hi " + String(order.customer_name).trim() + ","
    : "Thank you for your purchase!";
  var receiptNo = order.id ? String(order.id).slice(0, 8).toUpperCase() : "";
  var text = [
    greeting,
    "",
    "Here is your S&R Concrete Crafts receipt.",
    receiptNo ? "Receipt: " + receiptNo : "",
    "Payment: " + source,
    "Date: " + formatDate(soldAt),
    "",
  ]
    .filter(function (line) { return line !== ""; })
    .concat(textLines)
    .concat(["", "Total: " + total, "", "Thank you for supporting our small business."])
    .join("\n");
  var html =
    '<!doctype html><html><body style="margin:0;background:#f7f3ec;color:#2f2c28;font-family:Arial,sans-serif">' +
    '<div style="max-width:620px;margin:0 auto;padding:28px 18px"><div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #e8e1d7">' +
    '<img src="https://www.sandrconcretecrafts.com/assets/sandrlogo.jpg" alt="S&amp;R Concrete Crafts" width="56" height="56" style="display:block;margin:0 0 12px;border-radius:12px" />' +
    '<h1 style="margin:0 0 8px;color:#9b5534;font-size:26px">S&amp;R Concrete Crafts</h1>' +
    '<p style="margin:0 0 24px;color:#6c655d">Handcrafted concrete pieces</p>' +
    "<p>" +
    escapeHtml(greeting) +
    "</p><p>Here is your receipt.</p>" +
    '<p style="color:#6c655d">' +
    (receiptNo ? "<strong>Receipt:</strong> " + escapeHtml(receiptNo) + "<br>" : "") +
    "<strong>Payment:</strong> " +
    escapeHtml(source) +
    "<br><strong>Date:</strong> " +
    escapeHtml(formatDate(soldAt)) +
    "</p><table role=\"presentation\" style=\"width:100%;border-collapse:collapse\">" +
    htmlLines.join("") +
    '<tr><td style="padding-top:18px;font-size:18px"><strong>Total</strong></td><td style="padding-top:18px;text-align:right;font-size:18px"><strong>' +
    escapeHtml(total) +
    "</strong></td></tr></table>" +
    '<p style="margin:28px 0 0;color:#6c655d">Thank you for supporting our small business.</p>' +
    "</div></div></body></html>";
  return {
    subject: "Your S&R Concrete Crafts receipt",
    html: html,
    text: text,
  };
}

module.exports = {
  buildReceipt: buildReceipt,
  escapeHtml: escapeHtml,
  sourceLabel: sourceLabel,
  validEmail: validEmail,
};
