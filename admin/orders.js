/**
 * Admin orders list + detail (Stripe Checkout records).
 */
(function () {
  "use strict";

  var orders = [];

  function $(id) {
    return document.getElementById(id);
  }

  function moneyFromCents(cents, currency) {
    var n = Number(cents);
    if (!isFinite(n)) n = 0;
    var cur = String(currency || "usd").toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur === "USD" ? "USD" : cur,
      }).format(n / 100);
    } catch (e) {
      return "$" + (n / 100).toFixed(2);
    }
  }

  function formatWhen(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (e) {
      return String(iso);
    }
  }

  function statusLabel(status) {
    var s = String(status || "").toLowerCase();
    if (s === "paid") return "Paid";
    if (s === "unpaid") return "Unpaid";
    if (s === "refunded") return "Refunded";
    if (s === "partially_refunded") return "Partially refunded";
    if (s === "no_payment_required") return "No payment required";
    return s ? s.replace(/_/g, " ") : "Unknown";
  }

  function statusClass(status) {
    return String(status || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "unknown";
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

  function itemSummary(order) {
    var items = order.items || order.order_items || [];
    if (!items.length) return "No line items";
    if (items.length === 1) {
      return items[0].product_name + " × " + items[0].quantity;
    }
    var qty = items.reduce(function (s, it) {
      return s + (Number(it.quantity) || 0);
    }, 0);
    return items.length + " items · " + qty + " pcs";
  }

  function renderList() {
    var wrap = $("orderList");
    if (!orders.length) {
      wrap.hidden = true;
      setState(
        "No orders yet. When a Stripe Checkout payment completes, it will show up here.",
        false
      );
      return;
    }
    setState("");
    wrap.hidden = false;
    wrap.innerHTML = orders
      .map(function (o) {
        var name = o.customer_name || o.customer_email || "Customer";
        return (
          '<button type="button" class="order-card" data-order-id="' +
          SRCatalog.escapeHtml(o.id) +
          '">' +
          '<div class="order-card-top">' +
          '<span class="order-card-name">' +
          SRCatalog.escapeHtml(name) +
          "</span>" +
          '<span class="order-status order-status--' +
          SRCatalog.escapeHtml(statusClass(o.payment_status)) +
          '">' +
          SRCatalog.escapeHtml(statusLabel(o.payment_status)) +
          "</span>" +
          "</div>" +
          '<div class="order-card-meta">' +
          SRCatalog.escapeHtml(formatWhen(o.created_at)) +
          "</div>" +
          '<div class="order-card-foot">' +
          '<span class="order-card-items">' +
          SRCatalog.escapeHtml(itemSummary(o)) +
          "</span>" +
          '<span class="order-card-total">' +
          SRCatalog.escapeHtml(moneyFromCents(o.amount_total, o.currency)) +
          "</span>" +
          "</div>" +
          "</button>"
        );
      })
      .join("");
  }

  function shippingBlock(order) {
    var parts = [
      order.shipping_name,
      order.shipping_line1,
      order.shipping_line2,
      [order.shipping_city, order.shipping_state, order.shipping_postal_code]
        .filter(Boolean)
        .join(", "),
      order.shipping_country,
    ].filter(Boolean);
    if (!parts.length) return "<p class=\"muted\">No shipping address on this order.</p>";
    return (
      "<p>" +
      parts
        .map(function (line) {
          return SRCatalog.escapeHtml(line);
        })
        .join("<br />") +
      "</p>"
    );
  }

  function renderDetail(order) {
    var items = order.items || order.order_items || [];
    var lines = items
      .map(function (it) {
        var unit =
          it.unit_amount != null
            ? moneyFromCents(it.unit_amount, order.currency) + " each"
            : null;
        return (
          '<div class="order-line">' +
          "<div>" +
          "<strong>" +
          SRCatalog.escapeHtml(it.product_name || "Item") +
          "</strong>" +
          '<div class="muted">Qty ' +
          SRCatalog.escapeHtml(String(it.quantity)) +
          (unit ? " · " + SRCatalog.escapeHtml(unit) : "") +
          "</div>" +
          "</div>" +
          "<div>" +
          SRCatalog.escapeHtml(moneyFromCents(it.amount_total, order.currency)) +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    $("orderDetailTitle").textContent =
      order.customer_name || order.customer_email || "Order";
    $("orderDetailBody").innerHTML =
      '<div class="order-detail-section">' +
      "<h3>Status</h3>" +
      '<p><span class="order-status order-status--' +
      SRCatalog.escapeHtml(statusClass(order.payment_status)) +
      '">' +
      SRCatalog.escapeHtml(statusLabel(order.payment_status)) +
      "</span></p>" +
      "<p><strong>" +
      SRCatalog.escapeHtml(moneyFromCents(order.amount_total, order.currency)) +
      "</strong> · " +
      SRCatalog.escapeHtml(formatWhen(order.created_at)) +
      "</p>" +
      "</div>" +
      '<div class="order-detail-section">' +
      "<h3>Customer</h3>" +
      "<p>" +
      SRCatalog.escapeHtml(order.customer_name || "—") +
      "<br />" +
      SRCatalog.escapeHtml(order.customer_email || "—") +
      "<br />" +
      SRCatalog.escapeHtml(order.customer_phone || "No phone") +
      "</p>" +
      "</div>" +
      '<div class="order-detail-section">' +
      "<h3>Shipping</h3>" +
      shippingBlock(order) +
      "</div>" +
      '<div class="order-detail-section">' +
      "<h3>Items</h3>" +
      (lines || '<p class="muted">No line items saved.</p>') +
      "</div>" +
      '<div class="order-detail-section">' +
      "<h3>Payment references</h3>" +
      '<p class="order-mono muted">Checkout session<br />' +
      SRCatalog.escapeHtml(order.stripe_session_id || "—") +
      "</p>" +
      '<p class="order-mono muted">Payment intent<br />' +
      SRCatalog.escapeHtml(order.stripe_payment_intent || "—") +
      "</p>" +
      "</div>";
  }

  function openDetail(id) {
    var order = orders.find(function (o) {
      return o.id === id;
    });
    if (!order) return;
    renderDetail(order);
    $("orderDetailSheet").hidden = false;
    $("orderDetailBackdrop").hidden = false;
    document.body.classList.add("more-sheet-open");
    // Refresh full row in case list was partial
    SRCatalog.getOrder(id)
      .then(function (full) {
        var idx = orders.findIndex(function (o) {
          return o.id === id;
        });
        if (idx !== -1) orders[idx] = full;
        renderDetail(full);
      })
      .catch(function () {
        /* keep list data */
      });
  }

  function closeDetail() {
    $("orderDetailSheet").hidden = true;
    $("orderDetailBackdrop").hidden = true;
    document.body.classList.remove("more-sheet-open");
  }

  function bind() {
    $("orderList").addEventListener("click", function (e) {
      var card = e.target.closest("[data-order-id]");
      if (!card) return;
      openDetail(card.getAttribute("data-order-id"));
    });
    $("orderDetailClose").addEventListener("click", closeDetail);
    $("orderDetailBackdrop").addEventListener("click", closeDetail);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDetail();
    });
  }

  SRAdminShell.boot({ activeNav: "orders" }).then(async function (check) {
    if (!check) return;
    bind();
    try {
      orders = await SRCatalog.listOrders();
      renderList();
    } catch (err) {
      setState(
        err.message ||
          "Couldn’t load orders. If this is the first time, run the orders migration in Supabase.",
        true
      );
      showFlash(err.message || "Couldn’t load orders.", "err");
    }
  });
})();
