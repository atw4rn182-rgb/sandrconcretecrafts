/**
 * Admin in-person payments.
 * Cash sales are submitted to the authenticated admin API. The browser never
 * talks to Stripe Terminal; Take Payment hands the sale to the Android app.
 */
(function () {
  "use strict";

  var products = [];
  var batchRows = [];
  var tapLines = [];
  var tapIdempotencyKey = null;
  var tapSubmitting = false;
  var singleSubmitting = false;
  var batchSubmitting = false;
  var adminSession = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return SRCatalog.escapeHtml(value);
  }

  function money(cents) {
    return "$" + (Math.max(0, Number(cents) || 0) / 100).toFixed(2);
  }

  function parseCents(raw) {
    var text = String(raw == null ? "" : raw)
      .trim()
      .replace(/\$/g, "")
      .replace(/,/g, "");
    if (!/^\d+(?:\.\d{0,2})?$/.test(text)) return null;
    var value = Number(text);
    if (!isFinite(value)) return null;
    var cents = Math.round(value * 100);
    return cents >= 1 && cents <= 1000000 ? cents : null;
  }

  function localDateTimeValue(date) {
    var d = date || new Date();
    var shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return shifted.toISOString().slice(0, 16);
  }

  function soldAtIso(value) {
    var parsed = new Date(value);
    return isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }

  function newKey(prefix) {
    var random =
      window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    return prefix + "-" + random;
  }

  function setError(id, message) {
    var el = byId(id);
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    if (message) el.focus();
  }

  function announce(message, kind) {
    var el = byId("paymentStatus");
    el.hidden = false;
    el.className = "flash is-visible flash--" + (kind || "ok");
    el.textContent = message;
    el.setAttribute("tabindex", "-1");
    el.focus();
  }

  function validateSoldAt(value) {
    var iso = soldAtIso(value);
    if (!iso) return { ok: false, error: "Choose a valid sale date and time." };
    var time = Date.parse(iso);
    var now = Date.now();
    if (time < now - 366 * 86400000 || time > now + 5 * 60000) {
      return {
        ok: false,
        error: "Sale time must be within the past year and not in the future.",
      };
    }
    return { ok: true, value: iso };
  }

  function optionalValue(id) {
    return String((byId(id) && byId(id).value) || "").trim() || null;
  }

  function apiErrorMessage(response, body) {
    if (response.status === 401 || response.status === 403) {
      return "Your admin session expired or no longer has access. Please sign in again.";
    }
    return (body && body.error) || "Couldn’t record the sale. Please try again.";
  }

  async function postCashSales(sales) {
    var token = adminSession && adminSession.access_token;
    if (!token) throw new Error("Your admin session is missing. Please sign in again.");
    var response = await fetch("/api/admin/cash-sales", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sales: sales }),
    });
    var body = null;
    try {
      body = await response.json();
    } catch (_err) {
      body = null;
    }
    if (!response.ok) throw new Error(apiErrorMessage(response, body));
    return body;
  }

  function singleSalePayload() {
    var cents = parseCents(byId("singleAmount").value);
    if (cents == null) throw new Error("Enter an amount from $0.01 to $10,000.00.");
    var sold = validateSoldAt(byId("singleSoldAt").value);
    if (!sold.ok) throw new Error(sold.error);
    var description = optionalValue("singleDescription") || "Cash sale";
    return {
      sold_at: sold.value,
      idempotency_key: byId("singleCashForm").dataset.idempotencyKey,
      sale_note: optionalValue("singleNote"),
      customer_name: optionalValue("singleCustomerName"),
      customer_email: optionalValue("singleCustomerEmail"),
      customer_phone: optionalValue("singleCustomerPhone"),
      receipt_email: null,
      items: [
        {
          type: "custom",
          name: description,
          unit_amount_cents: cents,
          quantity: 1,
        },
      ],
    };
  }

  function resetSingle() {
    var form = byId("singleCashForm");
    form.reset();
    form.dataset.idempotencyKey = newKey("cash-single");
    byId("singleSoldAt").value = localDateTimeValue();
    setError("singleError", "");
  }

  async function submitSingle(event) {
    event.preventDefault();
    if (singleSubmitting) return;
    setError("singleError", "");
    var sale;
    try {
      sale = singleSalePayload();
    } catch (err) {
      setError("singleError", err.message);
      return;
    }
    singleSubmitting = true;
    var button = byId("singleSubmit");
    button.disabled = true;
    button.textContent = "Recording…";
    try {
      var result = await postCashSales([sale]);
      resetSingle();
      showReceiptOptions((result && result.orders) || [], [sale]);
      announce("Cash sale recorded. You can send a receipt now or continue.", "ok");
    } catch (err) {
      setError("singleError", err.message || "Couldn’t record the cash sale.");
    } finally {
      singleSubmitting = false;
      button.disabled = false;
      button.textContent = "Record Cash Sale";
    }
  }

  function newBatchRow() {
    return {
      id: newKey("row"),
      idempotencyKey: newKey("cash-batch"),
      amount: "",
      note: "",
      soldAt: localDateTimeValue(),
    };
  }

  function syncBatchFromDom() {
    batchRows.forEach(function (row) {
      var root = document.querySelector('[data-batch-id="' + row.id + '"]');
      if (!root) return;
      row.amount = root.querySelector("[data-field=amount]").value;
      row.note = root.querySelector("[data-field=note]").value;
      row.soldAt = root.querySelector("[data-field=soldAt]").value;
    });
  }

  function updateBatchSummary() {
    syncBatchFromDom();
    var total = batchRows.reduce(function (sum, row) {
      return sum + (parseCents(row.amount) || 0);
    }, 0);
    byId("batchCount").textContent = String(batchRows.length);
    byId("batchPlural").textContent = batchRows.length === 1 ? "" : "s";
    byId("batchTotal").textContent = money(total);
    byId("addBatchRow").disabled = batchRows.length >= 25;
  }

  function renderBatchRows(focusLast) {
    var wrap = byId("batchRows");
    wrap.innerHTML = batchRows
      .map(function (row, index) {
        return (
          '<fieldset class="batch-row" data-batch-id="' +
          escapeHtml(row.id) +
          '"><legend>Sale ' +
          (index + 1) +
          '</legend><button type="button" class="batch-remove" data-remove-batch="' +
          escapeHtml(row.id) +
          '" aria-label="Remove sale ' +
          (index + 1) +
          '"' +
          (batchRows.length === 1 ? " disabled" : "") +
          ">Remove</button>" +
          '<label class="payment-field"><span>Amount</span><span class="money-input"><span>$</span><input data-field="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' +
          escapeHtml(row.amount) +
          '" required /></span></label>' +
          '<label class="payment-field"><span>Note <small>Optional</small></span><input data-field="note" type="text" maxlength="500" value="' +
          escapeHtml(row.note) +
          '" placeholder="Item or event" /></label>' +
          '<label class="payment-field batch-date"><span>Date and time</span><input data-field="soldAt" type="datetime-local" value="' +
          escapeHtml(row.soldAt) +
          '" required /></label></fieldset>'
        );
      })
      .join("");
    wrap.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", updateBatchSummary);
      input.addEventListener("change", updateBatchSummary);
    });
    wrap.querySelectorAll("[data-remove-batch]").forEach(function (button) {
      button.addEventListener("click", function () {
        syncBatchFromDom();
        var id = button.getAttribute("data-remove-batch");
        batchRows = batchRows.filter(function (row) {
          return row.id !== id;
        });
        renderBatchRows(false);
      });
    });
    updateBatchSummary();
    if (focusLast) {
      var last = wrap.querySelector(".batch-row:last-child [data-field=amount]");
      if (last) last.focus();
    }
  }

  function batchPayload() {
    syncBatchFromDom();
    return batchRows.map(function (row, index) {
      var cents = parseCents(row.amount);
      if (cents == null) {
        throw new Error("Sale " + (index + 1) + " needs an amount from $0.01 to $10,000.00.");
      }
      var sold = validateSoldAt(row.soldAt);
      if (!sold.ok) throw new Error("Sale " + (index + 1) + ": " + sold.error);
      var note = String(row.note || "").trim();
      return {
        sold_at: sold.value,
        idempotency_key: row.idempotencyKey,
        sale_note: note || null,
        customer_name: null,
        customer_email: null,
        customer_phone: null,
        receipt_email: null,
        items: [
          {
            type: "custom",
            name: note.slice(0, 120) || "Cash sale",
            unit_amount_cents: cents,
            quantity: 1,
          },
        ],
      };
    });
  }

  function resetBatch() {
    batchRows = [newBatchRow()];
    byId("batchConfirm").checked = false;
    setError("batchError", "");
    renderBatchRows(false);
  }

  async function submitBatch(event) {
    event.preventDefault();
    if (batchSubmitting) return;
    setError("batchError", "");
    if (!byId("batchConfirm").checked) {
      setError("batchError", "Confirm that you checked every amount before recording the batch.");
      return;
    }
    var sales;
    try {
      sales = batchPayload();
    } catch (err) {
      setError("batchError", err.message);
      return;
    }
    batchSubmitting = true;
    var button = byId("batchSubmit");
    button.disabled = true;
    button.textContent = "Recording " + sales.length + " sales…";
    try {
      var result = await postCashSales(sales);
      resetBatch();
      showReceiptOptions((result && result.orders) || [], sales);
      announce(sales.length + " cash sales recorded. Receipts are optional.", "ok");
    } catch (err) {
      setError("batchError", err.message || "Couldn’t record the cash batch.");
    } finally {
      batchSubmitting = false;
      button.disabled = false;
      button.textContent = "Record Cash Batch";
    }
  }

  function setCashMode(mode) {
    var single = mode === "single";
    byId("singleCashForm").hidden = !single;
    byId("batchCashForm").hidden = single;
    byId("singleModeBtn").classList.toggle("is-active", single);
    byId("batchModeBtn").classList.toggle("is-active", !single);
    byId("singleModeBtn").setAttribute("aria-pressed", single ? "true" : "false");
    byId("batchModeBtn").setAttribute("aria-pressed", single ? "false" : "true");
    (single ? byId("singleAmount") : document.querySelector("[data-field=amount]")).focus();
  }

  async function sendReceipt(orderId, email, button, statusEl) {
    var token = adminSession && adminSession.access_token;
    button.disabled = true;
    button.textContent = "Sending…";
    statusEl.textContent = "";
    try {
      var response = await fetch("/api/admin/send-receipt", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ order_id: orderId, email: email }),
      });
      var body = await response.json().catch(function () { return null; });
      if (!response.ok) {
        throw new Error(
          (body && body.error) ||
            "The receipt could not be sent. The sale is still safely recorded."
        );
      }
      statusEl.className = "receipt-row-status receipt-row-status--ok";
      statusEl.textContent =
        body.status === "already_sent" ? "Receipt was already sent." : "Receipt sent.";
      button.textContent = "Sent";
    } catch (err) {
      statusEl.className = "receipt-row-status receipt-row-status--error";
      statusEl.textContent =
        (err && err.message) ||
        "Receipt unavailable. The sale is still safely recorded.";
      button.disabled = false;
      button.textContent = "Send receipt";
    }
  }

  function showReceiptOptions(orders, submittedSales) {
    var panel = byId("receiptSuccess");
    var list = byId("receiptOrderList");
    if (!orders.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    list.innerHTML = orders.map(function (order, index) {
      var sale = submittedSales[index] || {};
      return (
        '<div class="receipt-order-row" data-receipt-order="' +
        escapeHtml(order.id) +
        '"><div class="receipt-order-summary"><strong>' +
        money(order.amount_total) +
        '</strong><span>Cash sale ' +
        (orders.length > 1 ? index + 1 : "") +
        '</span></div><label class="payment-field"><span>Receipt email</span>' +
        '<input type="email" maxlength="254" autocomplete="email" data-receipt-email value="' +
        escapeHtml(sale.customer_email || "") +
        '" placeholder="customer@example.com" /></label>' +
        '<button type="button" class="btn btn-ghost" data-send-receipt>Send receipt</button>' +
        '<p class="receipt-row-status" data-receipt-status role="status"></p></div>'
      );
    }).join("");
    list.querySelectorAll("[data-receipt-order]").forEach(function (row) {
      var button = row.querySelector("[data-send-receipt]");
      button.addEventListener("click", function () {
        var input = row.querySelector("[data-receipt-email]");
        var email = String(input.value || "").trim();
        if (!input.checkValidity() || !email) {
          var status = row.querySelector("[data-receipt-status]");
          status.className = "receipt-row-status receipt-row-status--error";
          status.textContent = "Enter a valid email address.";
          input.focus();
          return;
        }
        sendReceipt(
          row.getAttribute("data-receipt-order"),
          email,
          button,
          row.querySelector("[data-receipt-status]")
        );
      });
    });
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function productCents(product, finish) {
    var dollars;
    if (finish === "painted" && product.painted_price != null) {
      dollars = Number(product.painted_price);
    } else if (
      product.sale_price != null &&
      Number(product.sale_price) < Number(product.price)
    ) {
      dollars = Number(product.sale_price);
    } else {
      dollars = Number(product.price);
    }
    return Math.max(0, Math.round((isFinite(dollars) ? dollars : 0) * 100));
  }

  function availableProducts() {
    var q = String(byId("catalogSearch").value || "").trim().toLowerCase();
    return products.filter(function (product) {
      if (product.status !== "published") return false;
      if (product.track_inventory && Number(product.quantity) < 1) return false;
      var haystack = (String(product.title || "") + " " + String(product.item_no || "")).toLowerCase();
      return !q || haystack.indexOf(q) !== -1;
    });
  }

  function renderCatalog() {
    var state = byId("catalogState");
    var wrap = byId("catalogResults");
    var rows = availableProducts();
    if (!rows.length) {
      state.hidden = false;
      state.textContent = products.length
        ? "No available products match that search."
        : "No available catalog products were found.";
      wrap.hidden = true;
      return;
    }
    state.hidden = true;
    wrap.hidden = false;
    wrap.innerHTML = rows
      .map(function (product) {
        var hasPainted = product.painted_price != null && Number(product.painted_price) > 0;
        return (
          '<article class="payment-catalog-card" data-product-card="' +
          escapeHtml(product.id) +
          '"><div><strong>' +
          escapeHtml(product.title) +
          "</strong><small>" +
          (product.item_no ? "Item " + escapeHtml(product.item_no) + " · " : "") +
          money(productCents(product, "raw")) +
          " raw" +
          (hasPainted ? " · " + money(productCents(product, "painted")) + " painted" : "") +
          '</small></div><label><span class="sr-only">Finish for ' +
          escapeHtml(product.title) +
          '</span><select data-product-finish><option value="raw">Raw</option>' +
          (hasPainted ? '<option value="painted">Painted</option>' : "") +
          '</select></label><button type="button" class="btn btn-ghost btn-small" data-add-product="' +
          escapeHtml(product.id) +
          '">Add</button></article>'
        );
      })
      .join("");
    wrap.querySelectorAll("[data-add-product]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-add-product");
        var product = products.find(function (item) {
          return item.id === id;
        });
        var card = button.closest("[data-product-card]");
        var finish = card.querySelector("[data-product-finish]").value;
        addProductLine(product, finish);
      });
    });
  }

  function addProductLine(product, finish) {
    if (!product) return;
    var existing = tapLines.find(function (line) {
      return line.type === "product" && line.product.id === product.id && line.finish === finish;
    });
    if (existing) {
      var max = product.track_inventory ? Math.min(99, Number(product.quantity) || 0) : 99;
      existing.quantity = Math.min(max, existing.quantity + 1);
    } else {
      tapLines.push({
        key: newKey("tap-product"),
        type: "product",
        product: product,
        finish: finish,
        quantity: 1,
      });
    }
    setError("tapError", "");
    renderTapCart();
  }

  function addCustomLine() {
    var name = String(byId("customName").value || "").trim();
    var cents = parseCents(byId("customAmount").value);
    if (!name) {
      setError("tapError", "Enter a description for the custom line.");
      byId("customName").focus();
      return;
    }
    if (cents == null) {
      setError("tapError", "Enter a custom amount from $0.01 to $10,000.00.");
      byId("customAmount").focus();
      return;
    }
    tapLines.push({
      key: newKey("tap-custom"),
      type: "custom",
      name: name,
      unitAmountCents: cents,
      quantity: 1,
    });
    byId("customName").value = "";
    byId("customAmount").value = "";
    setError("tapError", "");
    renderTapCart();
  }

  function lineUnitCents(line) {
    return line.type === "product"
      ? productCents(line.product, line.finish)
      : line.unitAmountCents;
  }

  function isAndroidPos() {
    return /Android/i.test(navigator.userAgent || "");
  }

  function tapSalePayload() {
    if (!tapIdempotencyKey) tapIdempotencyKey = newKey("tap");
    return {
      sold_at: new Date().toISOString(),
      idempotency_key: tapIdempotencyKey,
      sale_note: null,
      customer_name: null,
      customer_email: null,
      customer_phone: null,
      receipt_email: null,
      items: trustedTapPayload(),
    };
  }

  function tapCartTotal() {
    return tapLines.reduce(function (sum, line) {
      return sum + lineUnitCents(line) * line.quantity;
    }, 0);
  }

  function updateTakePaymentButton() {
    var button = byId("takePaymentBtn");
    var help = byId("terminalHelp");
    var status = byId("terminalStatus");
    var blocked = byId("terminalBlocked");
    var android = isAndroidPos();
    var total = tapCartTotal();
    var ready = android && tapLines.length > 0 && total > 0 && !tapSubmitting;
    if (button) {
      button.disabled = !ready;
      button.textContent = android
        ? tapSubmitting
          ? "Opening Tap to Pay…"
          : "Take Payment"
        : "Take Payment — Native App Required";
    }
    if (status) {
      status.textContent = android ? "Opens S&R Tap to Pay" : "Native app required";
      status.className =
        "terminal-status " +
        (android ? "terminal-status--ready" : "terminal-status--blocked");
    }
    if (blocked) blocked.hidden = android;
    if (help) {
      help.textContent = android
        ? "Take Payment opens the S&R Tap to Pay app on this phone. The S&R server still sets the charge amount."
        : "This browser does not tap cards. On the Motorola, Take Payment opens the S&R Tap to Pay app.";
    }
  }

  function openNativeCollect(sale) {
    var encoded = encodeURIComponent(JSON.stringify(sale));
    var intentUrl =
      "intent://collect?p=" +
      encoded +
      "#Intent;scheme=sandrpos;package=com.sandrconcretecrafts.pos;S.browser_fallback_url=" +
      encodeURIComponent(
        "https://www.sandrconcretecrafts.com/admin/payments.html?tap=missing"
      ) +
      ";end";
    var fallback = window.setTimeout(function () {
      tapSubmitting = false;
      updateTakePaymentButton();
      setError(
        "tapError",
        "Install the S&R Tap to Pay app on this Motorola, then try again. This page does not tap cards."
      );
    }, 1800);
    document.addEventListener("visibilitychange", function onHide() {
      if (document.hidden) {
        window.clearTimeout(fallback);
        document.removeEventListener("visibilitychange", onHide);
      }
    });
    window.location.href = intentUrl;
  }

  function takePayment() {
    if (tapSubmitting || !isAndroidPos()) return;
    setError("tapError", "");
    if (!tapLines.length) {
      setError("tapError", "Add a product or custom amount first.");
      return;
    }
    tapSubmitting = true;
    updateTakePaymentButton();
    openNativeCollect(tapSalePayload());
  }

  function handleTapReturn() {
    var params = new URLSearchParams(window.location.search);
    var paid = String(params.get("paid") || "").trim();
    var tap = String(params.get("tap") || "").trim();
    if (!paid && !tap) return;
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", "/admin/payments.html");
    }
    if (paid) {
      tapIdempotencyKey = newKey("tap");
      tapLines = [];
      renderTapCart();
      showReceiptOptions(
        [{ id: paid, amount_total: Number(params.get("amount")) || 0 }],
        [{}]
      );
      announce("Tap to Pay sale recorded. You can send a receipt now.", "ok");
      return;
    }
    if (tap === "missing") {
      setError(
        "tapError",
        "The S&R Tap to Pay app isn’t installed on this phone yet."
      );
    } else if (tap === "failed") {
      setError("tapError", "Tap to Pay didn’t finish. The sale was not charged.");
    } else if (tap === "cancel") {
      announce("Tap to Pay canceled. The cart is still here.", "ok");
    }
  }

  function trustedTapPayload() {
    return tapLines.map(function (line) {
      if (line.type === "product") {
        return {
          type: "product",
          product_id: line.product.id,
          finish: line.finish,
          quantity: line.quantity,
        };
      }
      return {
        type: "custom",
        name: line.name,
        unit_amount_cents: line.unitAmountCents,
        quantity: line.quantity,
      };
    });
  }

  function renderTapCart() {
    var wrap = byId("tapCartLines");
    var empty = byId("tapCartEmpty");
    var total = tapLines.reduce(function (sum, line) {
      return sum + lineUnitCents(line) * line.quantity;
    }, 0);
    byId("tapCartTotal").textContent = money(total);
    empty.hidden = tapLines.length > 0;
    wrap.hidden = tapLines.length === 0;
    byId("clearTapCart").hidden = tapLines.length === 0;
    wrap.innerHTML = tapLines
      .map(function (line) {
        var name = line.type === "product" ? line.product.title : line.name;
        var detail = line.type === "product" ? line.finish : "Custom";
        var max =
          line.type === "product" && line.product.track_inventory
            ? Math.min(99, Number(line.product.quantity) || 1)
            : 99;
        return (
          '<article class="tap-cart-line" data-tap-key="' +
          escapeHtml(line.key) +
          '"><div class="tap-line-copy"><strong>' +
          escapeHtml(name) +
          "</strong><small>" +
          escapeHtml(detail) +
          " · " +
          money(lineUnitCents(line)) +
          ' each</small></div><div class="qty-control" aria-label="Quantity for ' +
          escapeHtml(name) +
          '"><button type="button" data-qty="-1" aria-label="Decrease quantity">−</button><output>' +
          line.quantity +
          '</output><button type="button" data-qty="1" aria-label="Increase quantity"' +
          (line.quantity >= max ? " disabled" : "") +
          '>+</button></div><strong class="tap-line-total">' +
          money(lineUnitCents(line) * line.quantity) +
          '</strong><button type="button" class="tap-line-remove" data-remove-tap aria-label="Remove ' +
          escapeHtml(name) +
          '">Remove</button></article>'
        );
      })
      .join("");
    wrap.querySelectorAll("[data-tap-key]").forEach(function (root) {
      var key = root.getAttribute("data-tap-key");
      root.querySelectorAll("[data-qty]").forEach(function (button) {
        button.addEventListener("click", function () {
          var line = tapLines.find(function (item) { return item.key === key; });
          if (!line) return;
          var next = line.quantity + Number(button.getAttribute("data-qty"));
          var max =
            line.type === "product" && line.product.track_inventory
              ? Math.min(99, Number(line.product.quantity) || 1)
              : 99;
          if (next < 1) {
            tapLines = tapLines.filter(function (item) { return item.key !== key; });
          } else {
            line.quantity = Math.min(max, next);
          }
          renderTapCart();
        });
      });
      root.querySelector("[data-remove-tap]").addEventListener("click", function () {
        tapLines = tapLines.filter(function (item) { return item.key !== key; });
        renderTapCart();
      });
    });
    // Build the strict contract whenever the cart changes. It is intentionally
    // retained in memory only; ordinary web never sends it to Terminal.
    trustedTapPayload();
    updateTakePaymentButton();
  }

  async function loadCatalog() {
    try {
      products = await SRCatalog.listProducts();
      renderCatalog();
    } catch (err) {
      byId("catalogState").hidden = false;
      byId("catalogState").textContent =
        err.message || "Couldn’t load catalog products.";
      byId("catalogResults").hidden = true;
    }
  }

  function bindEvents() {
    byId("singleCashForm").addEventListener("submit", submitSingle);
    byId("batchCashForm").addEventListener("submit", submitBatch);
    byId("singleModeBtn").addEventListener("click", function () { setCashMode("single"); });
    byId("batchModeBtn").addEventListener("click", function () { setCashMode("batch"); });
    byId("addBatchRow").addEventListener("click", function () {
      if (batchRows.length >= 25) return;
      syncBatchFromDom();
      batchRows.push(newBatchRow());
      renderBatchRows(true);
    });
    byId("catalogSearch").addEventListener("input", renderCatalog);
    byId("addCustomLine").addEventListener("click", addCustomLine);
    byId("clearTapCart").addEventListener("click", function () {
      tapLines = [];
      setError("tapError", "");
      renderTapCart();
    });
    byId("takePaymentBtn").addEventListener("click", takePayment);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && tapSubmitting) {
        window.setTimeout(function () {
          tapSubmitting = false;
          updateTakePaymentButton();
        }, 500);
      }
    });
  }

  SRAdminShell.boot({ activeNav: "payments" }).then(function (check) {
    if (!check) return;
    adminSession = check.session;
    tapIdempotencyKey = newKey("tap");
    resetSingle();
    resetBatch();
    renderTapCart();
    bindEvents();
    handleTapReturn();
    loadCatalog();
  });
})();
