/**
 * Admin customers — aggregated from paid orders (no fake rows).
 * Does not log PII.
 */
(function () {
  "use strict";

  var customers = [];

  function $(id) {
    return document.getElementById(id);
  }

  function formatWhen(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (e) {
      return "—";
    }
  }

  function showFlash(msg, kind) {
    var el = $("flash");
    if (!el) return;
    el.hidden = false;
    el.className = "flash" + (kind === "err" ? " flash--err" : "");
    el.textContent = msg;
  }

  function setState(msg, isError) {
    var el = $("listState");
    el.hidden = !msg;
    el.textContent = msg || "";
    el.classList.toggle("state-box--error", !!isError);
  }

  function renderList() {
    var wrap = $("customerList");
    if (!customers.length) {
      wrap.hidden = true;
      setState(
        "No identified customers yet. Paid sales appear when a name, email, or phone is saved.",
        false
      );
      return;
    }
    setState("");
    wrap.hidden = false;
    wrap.innerHTML = customers
      .map(function (c, i) {
        var name = c.name || c.email || "Customer";
        var repeat = c.order_count >= 2;
        return (
          '<button type="button" class="customer-card" data-customer-idx="' +
          i +
          '">' +
          '<div class="customer-card-top">' +
          '<span class="customer-card-name">' +
          SRCatalog.escapeHtml(name) +
          "</span>" +
          (repeat
            ? '<span class="repeat-badge">Repeat Customer</span>'
            : "") +
          "</div>" +
          '<div class="customer-card-meta">' +
          SRCatalog.escapeHtml(c.email || c.phone || "Name only") +
          "</div>" +
          '<div class="customer-card-foot">' +
          "<span>" +
          SRCatalog.escapeHtml(String(c.order_count)) +
          (c.order_count === 1 ? " order" : " orders") +
          " · Last " +
          SRCatalog.escapeHtml(formatWhen(c.last_order_at)) +
          "</span>" +
          '<span class="customer-card-total">' +
          SRCatalog.escapeHtml(
            SRSales.moneyFromCents(c.total_spent_cents)
          ) +
          "</span>" +
          "</div>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderDetail(c) {
    if (!c) return;
    var name = c.name || c.email || "Customer";
    $("customerDetailTitle").textContent = name;

    var history = (c.orders || [])
      .slice()
      .sort(function (a, b) {
        return new Date(SRSales.saleDate(b)) - new Date(SRSales.saleDate(a));
      })
      .map(function (o) {
        var fulfill = String(o.fulfillment_status || "unfulfilled").toLowerCase();
        return (
          '<a class="customer-order-row" href="/admin/orders.html?order=' +
          encodeURIComponent(o.id) +
          '">' +
          "<div>" +
          "<strong>" +
          SRCatalog.escapeHtml(SRSales.moneyFromCents(o.amount_total, o.currency)) +
          "</strong>" +
          '<div class="muted">' +
          SRCatalog.escapeHtml(formatWhen(SRSales.saleDate(o))) +
          "</div>" +
          "</div>" +
          '<span class="source-badge source-badge--' +
          SRCatalog.escapeHtml(SRSales.paymentSource(o)) +
          '">' +
          SRCatalog.escapeHtml(SRSales.sourceLabel(SRSales.paymentSource(o))) +
          "</span>" +
          '<span class="fulfill-badge fulfill-badge--' +
          SRCatalog.escapeHtml(fulfill) +
          '">' +
          SRCatalog.escapeHtml(fulfill.replace(/_/g, " ")) +
          "</span>" +
          "</a>"
        );
      })
      .join("");

    $("customerDetailBody").innerHTML =
      '<div class="order-detail-section">' +
      "<h3>Contact</h3>" +
      "<p>" +
      SRCatalog.escapeHtml(c.name || "—") +
      "<br />" +
      SRCatalog.escapeHtml(c.email || "—") +
      (c.phone
        ? "<br />" + SRCatalog.escapeHtml(c.phone)
        : "") +
      "</p>" +
      "</div>" +
      '<div class="order-detail-section">' +
      "<h3>Summary</h3>" +
      "<p>" +
      SRCatalog.escapeHtml(String(c.order_count)) +
      (c.order_count === 1 ? " paid order" : " paid orders") +
      " · " +
      SRCatalog.escapeHtml(SRSales.moneyFromCents(c.total_spent_cents)) +
      " total</p>" +
      "<p class=\"muted\">First " +
      SRCatalog.escapeHtml(formatWhen(c.first_order_at)) +
      " · Last " +
      SRCatalog.escapeHtml(formatWhen(c.last_order_at)) +
      "</p>" +
      (c.order_count >= 2
        ? '<p><span class="repeat-badge">Repeat Customer</span></p>'
        : "") +
      "</div>" +
      '<div class="order-detail-section">' +
      "<h3>Order history</h3>" +
      (history || '<p class="muted">No orders.</p>') +
      "</div>";
  }

  function openDetail(idx) {
    var c = customers[idx];
    if (!c) return;
    renderDetail(c);
    $("customerDetailSheet").hidden = false;
    $("customerDetailBackdrop").hidden = false;
    document.body.classList.add("more-sheet-open");
  }

  function closeDetail() {
    $("customerDetailSheet").hidden = true;
    $("customerDetailBackdrop").hidden = true;
    document.body.classList.remove("more-sheet-open");
  }

  function bind() {
    $("customerList").addEventListener("click", function (e) {
      var card = e.target.closest("[data-customer-idx]");
      if (!card) return;
      openDetail(Number(card.getAttribute("data-customer-idx")));
    });
    $("customerDetailClose").addEventListener("click", closeDetail);
    $("customerDetailBackdrop").addEventListener("click", closeDetail);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDetail();
    });
  }

  SRAdminShell.boot({ activeNav: "customers" }).then(async function (check) {
    if (!check) return;
    bind();
    try {
      var paid = await SRCatalog.listPaidOrdersLite();
      customers = SRSales.aggregateCustomers(paid);
      renderList();
    } catch (err) {
      setState(
        (err && err.message) ||
          "Couldn’t load customers. Check your connection and try again.",
        true
      );
      showFlash((err && err.message) || "Couldn’t load customers.", "err");
    }
  });
})();
