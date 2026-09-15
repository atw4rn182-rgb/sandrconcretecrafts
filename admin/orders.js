/**
 * Admin orders list + fulfillment actions.
 * Pickup orders are excluded from Needs Shipping.
 * Does not log PII.
 */
(function () {
  "use strict";

  var orders = [];
  var activeFilter = "all";
  var openOrderId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function moneyFromCents(cents, currency) {
    if (typeof SRSales !== "undefined" && SRSales.moneyFromCents) {
      return SRSales.moneyFromCents(cents, currency);
    }
    var n = Number(cents);
    if (!isFinite(n)) n = 0;
    return "$" + (n / 100).toFixed(2);
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

  function paymentLabel(status) {
    var s = String(status || "").toLowerCase();
    if (s === "paid") return "Paid";
    if (s === "unpaid") return "Unpaid";
    if (s === "refunded") return "Refunded";
    if (s === "partially_refunded") return "Partially refunded";
    if (s === "no_payment_required") return "No payment required";
    return s ? s.replace(/_/g, " ") : "Unknown";
  }

  function paymentClass(status) {
    return String(status || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "unknown";
  }

  function fulfillLabel(status) {
    var s = String(status || "unfulfilled").toLowerCase();
    if (s === "unfulfilled") return "Unfulfilled";
    if (s === "shipped") return "Shipped";
    if (s === "completed") return "Completed";
    if (s === "canceled") return "Canceled";
    return s.replace(/_/g, " ");
  }

  function methodLabel(method) {
    var m = String(method || "").toLowerCase();
    if (m === "pickup") return "Pickup";
    if (m === "ship") return "Ship";
    if (m === "unknown") return "Method unknown";
    return m || "—";
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

  function readFilterFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var f = String(params.get("filter") || "all").toLowerCase();
      if (
        f === "needs-shipping" ||
        f === "shipped" ||
        f === "paid" ||
        f === "all"
      ) {
        return f;
      }
    } catch (e) {
      /* ignore */
    }
    return "all";
  }

  function readOrderFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get("order");
    } catch (e) {
      return null;
    }
  }

  function setFilter(filter, pushUrl) {
    activeFilter = filter || "all";
    document.querySelectorAll("#orderFilterChips [data-filter]").forEach(function (btn) {
      var on = btn.getAttribute("data-filter") === activeFilter;
      btn.classList.toggle("is-active", on);
    });
    if (pushUrl) {
      try {
        var url = new URL(window.location.href);
        if (activeFilter === "all") url.searchParams.delete("filter");
        else url.searchParams.set("filter", activeFilter);
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch (e) {
        /* ignore */
      }
    }
    renderList();
  }

  function matchesFilter(o) {
    if (activeFilter === "all") return true;
    if (activeFilter === "paid") {
      return String(o.payment_status || "").toLowerCase() === "paid";
    }
    if (activeFilter === "shipped") {
      return String(o.fulfillment_status || "").toLowerCase() === "shipped";
    }
    if (activeFilter === "needs-shipping") {
      return (
        typeof SRSales !== "undefined" && SRSales.needsShipping
          ? SRSales.needsShipping(o)
          : String(o.payment_status || "").toLowerCase() === "paid" &&
              String(o.fulfillment_status || "unfulfilled").toLowerCase() ===
                "unfulfilled" &&
              String(o.fulfillment_method || "ship").toLowerCase() === "ship"
      );
    }
    return true;
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

  function emptyMessage() {
    if (activeFilter === "needs-shipping") {
      return "Nothing needs shipping right now.";
    }
    if (activeFilter === "shipped") {
      return "No shipped orders yet.";
    }
    if (activeFilter === "paid") {
      return "No paid orders yet.";
    }
    return "No orders yet. When a Stripe Checkout payment completes, it will show up here.";
  }

  function renderList() {
    var wrap = $("orderList");
    var filtered = orders.filter(matchesFilter);
    if (!filtered.length) {
      wrap.hidden = true;
      setState(emptyMessage(), false);
      return;
    }
    setState("");
    wrap.hidden = false;
    wrap.innerHTML = filtered
      .map(function (o) {
        var name = o.customer_name || o.customer_email || "Customer";
        var fulfill = String(o.fulfillment_status || "unfulfilled").toLowerCase();
        var method = String(o.fulfillment_method || "").toLowerCase();
        return (
          '<button type="button" class="order-card" data-order-id="' +
          SRCatalog.escapeHtml(o.id) +
          '">' +
          '<div class="order-card-top">' +
          '<span class="order-card-name">' +
          SRCatalog.escapeHtml(name) +
          "</span>" +
          '<span class="order-card-badges">' +
          '<span class="order-status order-status--' +
          SRCatalog.escapeHtml(paymentClass(o.payment_status)) +
          '">' +
          SRCatalog.escapeHtml(paymentLabel(o.payment_status)) +
          "</span>" +
          '<span class="fulfill-badge fulfill-badge--' +
          SRCatalog.escapeHtml(fulfill) +
          '">' +
          SRCatalog.escapeHtml(fulfillLabel(fulfill)) +
          "</span>" +
          "</span>" +
          "</div>" +
          '<div class="order-card-meta">' +
          SRCatalog.escapeHtml(formatWhen(o.created_at)) +
          (method === "pickup"
            ? ' · <span class="method-pill">Pickup</span>'
            : "") +
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
    var method = String(order.fulfillment_method || "").toLowerCase();
    if (method === "pickup") {
      return '<p><span class="method-pill">Pickup</span> — customer will pick up (not in Needs Shipping).</p>';
    }
    var parts = [
      order.shipping_name,
      order.shipping_line1,
      order.shipping_line2,
      [order.shipping_city, order.shipping_state, order.shipping_postal_code]
        .filter(Boolean)
        .join(", "),
      order.shipping_country,
    ].filter(Boolean);
    if (!parts.length) return '<p class="muted">No shipping address on this order.</p>';
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

  function fulfillmentActions(order) {
    var status = String(order.fulfillment_status || "unfulfilled").toLowerCase();
    var method = String(order.fulfillment_method || "").toLowerCase();
    var html = "";

    if (status === "unfulfilled" && method !== "pickup") {
      html +=
        '<div class="fulfill-form">' +
        '<div class="field"><label for="shipCarrier">Carrier (optional)</label>' +
        '<input id="shipCarrier" type="text" autocomplete="off" placeholder="USPS, UPS…" /></div>' +
        '<div class="field"><label for="shipTracking">Tracking # (optional)</label>' +
        '<input id="shipTracking" type="text" autocomplete="off" placeholder="Tracking number" /></div>' +
        '<button type="button" class="btn btn-primary btn-block" id="markShippedBtn">Mark as Shipped</button>' +
        "</div>";
    }

    if (status === "unfulfilled" && method === "pickup") {
      html +=
        '<button type="button" class="btn btn-primary btn-block" id="markCompletedBtn">Mark Completed (pickup)</button>';
    }

    if (status === "shipped") {
      html +=
        '<button type="button" class="btn btn-primary btn-block" id="markCompletedBtn">Mark Completed</button>';
    }

    if (order.tracking_number || order.carrier || order.shipped_at) {
      html +=
        '<div class="fulfill-meta muted">' +
        (order.carrier
          ? "<div>Carrier: " + SRCatalog.escapeHtml(order.carrier) + "</div>"
          : "") +
        (order.tracking_number
          ? "<div>Tracking: " +
            SRCatalog.escapeHtml(order.tracking_number) +
            "</div>"
          : "") +
        (order.shipped_at
          ? "<div>Shipped: " +
            SRCatalog.escapeHtml(formatWhen(order.shipped_at)) +
            "</div>"
          : "") +
        (order.completed_at
          ? "<div>Completed: " +
            SRCatalog.escapeHtml(formatWhen(order.completed_at)) +
            "</div>"
          : "") +
        "</div>";
    }

    return html;
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

    var fulfill = String(order.fulfillment_status || "unfulfilled").toLowerCase();

    $("orderDetailTitle").textContent =
      order.customer_name || order.customer_email || "Order";
    $("orderDetailBody").innerHTML =
      '<div class="order-detail-section">' +
      "<h3>Status</h3>" +
      '<p class="order-card-badges">' +
      '<span class="order-status order-status--' +
      SRCatalog.escapeHtml(paymentClass(order.payment_status)) +
      '">' +
      SRCatalog.escapeHtml(paymentLabel(order.payment_status)) +
      "</span>" +
      '<span class="fulfill-badge fulfill-badge--' +
      SRCatalog.escapeHtml(fulfill) +
      '">' +
      SRCatalog.escapeHtml(fulfillLabel(fulfill)) +
      "</span>" +
      '<span class="method-pill">' +
      SRCatalog.escapeHtml(methodLabel(order.fulfillment_method)) +
      "</span>" +
      "</p>" +
      "<p><strong>" +
      SRCatalog.escapeHtml(moneyFromCents(order.amount_total, order.currency)) +
      "</strong> · " +
      SRCatalog.escapeHtml(formatWhen(order.created_at)) +
      "</p>" +
      "</div>" +
      '<div class="order-detail-section">' +
      "<h3>Fulfillment</h3>" +
      fulfillmentActions(order) +
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
      "<details class=\"order-support-refs\">" +
      "<summary>Payment support codes</summary>" +
      '<p class="muted">Only needed if you contact Stripe support about this order.</p>' +
      '<p class="order-mono muted">Checkout code<br />' +
      SRCatalog.escapeHtml(order.stripe_session_id || "—") +
      "</p>" +
      '<p class="order-mono muted">Payment code<br />' +
      SRCatalog.escapeHtml(order.stripe_payment_intent || "—") +
      "</p>" +
      "</details>" +
      "</div>";

    bindFulfillmentButtons(order);
  }

  function mergeFulfillment(id, patch) {
    var idx = orders.findIndex(function (o) {
      return o.id === id;
    });
    if (idx === -1) return;
    orders[idx] = Object.assign({}, orders[idx], patch);
    return orders[idx];
  }

  function bindFulfillmentButtons(order) {
    var shipBtn = $("markShippedBtn");
    var doneBtn = $("markCompletedBtn");

    if (shipBtn) {
      shipBtn.addEventListener("click", async function () {
        if (
          !window.confirm(
            "Mark this order as shipped? You can add carrier and tracking first."
          )
        ) {
          return;
        }
        var carrierEl = $("shipCarrier");
        var trackEl = $("shipTracking");
        shipBtn.disabled = true;
        shipBtn.textContent = "Updating…";
        try {
          var updated = await SRCatalog.updateOrderFulfillment(order.id, {
            fulfillment_status: "shipped",
            shipped_at: new Date().toISOString(),
            carrier: carrierEl ? carrierEl.value : null,
            tracking_number: trackEl ? trackEl.value : null,
          });
          var merged = mergeFulfillment(order.id, updated);
          renderList();
          renderDetail(merged || Object.assign({}, order, updated));
          showFlash("Marked as shipped.");
        } catch (err) {
          showFlash((err && err.message) || "Couldn’t update fulfillment.", "err");
          shipBtn.disabled = false;
          shipBtn.textContent = "Mark as Shipped";
        }
      });
    }

    if (doneBtn) {
      doneBtn.addEventListener("click", async function () {
        if (!window.confirm("Mark this order as completed?")) return;
        doneBtn.disabled = true;
        doneBtn.textContent = "Updating…";
        try {
          var updated = await SRCatalog.updateOrderFulfillment(order.id, {
            fulfillment_status: "completed",
            completed_at: new Date().toISOString(),
          });
          var merged = mergeFulfillment(order.id, updated);
          renderList();
          renderDetail(merged || Object.assign({}, order, updated));
          showFlash("Marked as completed.");
        } catch (err) {
          showFlash((err && err.message) || "Couldn’t update fulfillment.", "err");
          doneBtn.disabled = false;
          doneBtn.textContent = "Mark Completed";
        }
      });
    }
  }

  function openDetail(id) {
    openOrderId = id;
    var order = orders.find(function (o) {
      return o.id === id;
    });
    if (!order) return;
    renderDetail(order);
    $("orderDetailSheet").hidden = false;
    $("orderDetailBackdrop").hidden = false;
    document.body.classList.add("more-sheet-open");
    SRCatalog.getOrder(id)
      .then(function (full) {
        var idx = orders.findIndex(function (o) {
          return o.id === id;
        });
        if (idx !== -1) orders[idx] = full;
        if (openOrderId === id) renderDetail(full);
      })
      .catch(function () {
        /* keep list data */
      });
  }

  function closeDetail() {
    openOrderId = null;
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
    $("orderFilterChips").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-filter]");
      if (!btn) return;
      setFilter(btn.getAttribute("data-filter"), true);
    });
  }

  async function loadOrders() {
    setState("Loading orders…");
    // Load all orders once; chips filter client-side so pickup / needs-shipping
    // match SRSales.needsShipping and switching filters stays snappy.
    orders = await SRCatalog.listOrders();
    renderList();
  }

  SRAdminShell.boot({ activeNav: "orders" }).then(async function (check) {
    if (!check) return;
    activeFilter = readFilterFromUrl();
    bind();
    setFilter(activeFilter, false);
    try {
      await loadOrders();
      var deep = readOrderFromUrl();
      if (deep) openDetail(deep);
    } catch (err) {
      setState(
        (err && err.message) ||
          "Couldn’t load orders. If this is the first time, run the orders migration in Supabase.",
        true
      );
      showFlash((err && err.message) || "Couldn’t load orders.", "err");
    }
  });
})();
