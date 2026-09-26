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
  var quickLines = [];
  var tapMode = "quick";
  var discountMilli = 0;
  var taxMilli = 0;
  var customDiscountOpen = false;
  var tapIdempotencyKey = null;
  var tapSubmitting = false;
  var RECEIPT_STORE_KEY = "sr_pos_last_receipt";
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
      showReceiptOptions((result && result.orders) || [], [sale], "cash");
      announce("Cash sale recorded. You can screenshot the receipt now.", "ok");
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
      showReceiptOptions((result && result.orders) || [], sales, "cash");
      announce(sales.length + " cash sales recorded. You can screenshot the receipts now.", "ok");
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

  function methodLabel(method) {
    if (method === "cash") return "Cash";
    if (method === "tap_to_pay") return "Tap to Pay";
    if (method === "online") return "Online";
    return "Paid";
  }

  function receiptNumber(orderId) {
    var id = String(orderId || "").replace(/-/g, "");
    return id ? "SR-" + id.slice(0, 8).toUpperCase() : "SR-SALE";
  }

  function saleLinesForReceipt(sale) {
    return ((sale && sale.items) || []).map(function (item) {
      if (item.type === "custom") {
        return {
          name: item.name || "Sale",
          detail: "",
          cents: Number(item.unit_amount_cents) * (Number(item.quantity) || 1),
        };
      }
      return {
        name: item.name || "Website product",
        detail: item.finish === "painted" ? "Painted" : item.finish === "raw" ? "Raw" : "",
        cents: Number(item.unit_amount_cents || 0) * (Number(item.quantity) || 1),
      };
    });
  }

  function receiptSaleFromState(sale, quote) {
    var copy = Object.assign({}, sale);
    if (tapMode === "catalog") {
      copy.items = tapLines.map(function (line) {
        return {
          type: "custom",
          name: line.product.title,
          finish: line.finish,
          unit_amount_cents: lineUnitCents(line),
          quantity: line.quantity,
        };
      });
    }
    copy.discount_milli = quote.discountMilli;
    copy.tax_milli = quote.taxMilli;
    return copy;
  }

  function quoteFromSale(sale) {
    var lines = ((sale && sale.items) || []).map(function (item) {
      return Number(item.unit_amount_cents || 0) * (Number(item.quantity) || 1);
    });
    return SRPosTotals.quote({
      lines: lines,
      discountMilli: sale && sale.discount_milli,
      taxMilli: sale && sale.tax_milli,
    });
  }

  function writeReceiptStore(payload) {
    try {
      window.sessionStorage.setItem(RECEIPT_STORE_KEY, JSON.stringify(payload));
    } catch (_err) {
      /* ignore quota / private mode */
    }
  }

  function readReceiptStore() {
    try {
      var raw = window.sessionStorage.getItem(RECEIPT_STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  }

  function renderPosReceipts(orders, submittedSales, method) {
    var wrap = byId("posReceiptList");
    if (!wrap) return;
    wrap.innerHTML = orders
      .map(function (order, index) {
        var sale = submittedSales[index] || {};
        var quote = quoteFromSale(sale);
        if (!quote.total && Number(order.amount_total) > 0) {
          quote = {
            subtotal: Number(order.amount_total),
            discount: 0,
            discountMilli: 0,
            tax: 0,
            taxMilli: 0,
            total: Number(order.amount_total),
          };
        }
        var when = sale.sold_at ? new Date(sale.sold_at) : new Date();
        var lines = saleLinesForReceipt(sale);
        if (!lines.length && quote.total) {
          lines = [{ name: "Sale", detail: "", cents: quote.total }];
        }
        return (
          '<article class="pos-receipt">' +
          "<header><strong>S&amp;R Concrete Crafts</strong><span>Receipt " +
          escapeHtml(receiptNumber(order.id)) +
          "</span><span>" +
          escapeHtml(when.toLocaleString()) +
          "</span></header><ul>" +
          lines
            .map(function (line) {
              return (
                "<li><span>" +
                escapeHtml(line.name) +
                (line.detail ? " <small>" + escapeHtml(line.detail) + "</small>" : "") +
                "</span><strong>" +
                money(line.cents) +
                "</strong></li>"
              );
            })
            .join("") +
          '</ul><dl><div><dt>Subtotal</dt><dd>' +
          money(quote.subtotal) +
          "</dd></div>" +
          (quote.discount
            ? "<div><dt>Discount " +
              escapeHtml(SRPosTotals.percentLabel(quote.discountMilli)) +
              "%</dt><dd>-" +
              money(quote.discount) +
              "</dd></div>"
            : "") +
          "<div><dt>Tax" +
          (quote.taxMilli
            ? " " + escapeHtml(SRPosTotals.percentLabel(quote.taxMilli)) + "%"
            : "") +
          "</dt><dd>" +
          money(quote.tax) +
          "</dd></div><div class=\"pos-receipt-total\"><dt>TOTAL PAID</dt><dd>" +
          money(order.amount_total || quote.total) +
          "</dd></div></dl><p>Payment method: " +
          escapeHtml(methodLabel(method)) +
          "</p><p>Payment status: Paid</p></article>"
        );
      })
      .join("");
  }

  function showReceiptOptions(orders, submittedSales, method) {
    var panel = byId("receiptSuccess");
    var list = byId("receiptOrderList");
    if (!orders.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    writeReceiptStore({
      orders: orders,
      sales: submittedSales,
      method: method || "cash",
    });
    renderPosReceipts(orders, submittedSales, method || "cash");
    list.innerHTML = orders.map(function (order, index) {
      var sale = submittedSales[index] || {};
      return (
        '<div class="receipt-order-row" data-receipt-order="' +
        escapeHtml(order.id) +
        '"><div class="receipt-order-summary"><strong>' +
        money(order.amount_total) +
        '</strong><span>Sale ' +
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
    setTapMode("catalog", { preserve: true });
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

  function quickAmountCents() {
    var input = byId("quickAmount");
    return parseCents(input && input.value);
  }

  function quickSaleNote() {
    var input = byId("quickSaleNote");
    var note = String((input && input.value) || "").trim();
    return note || null;
  }

  function quickLineCents() {
    return quickLines.map(function (line) {
      return line.unitAmountCents;
    });
  }

  function catalogLineCents() {
    return tapLines.map(function (line) {
      return lineUnitCents(line) * line.quantity;
    });
  }

  function activeLineCents() {
    return tapMode === "catalog" ? catalogLineCents() : quickLineCents();
  }

  function currentQuote() {
    return SRPosTotals.quote({
      lines: activeLineCents(),
      discountMilli: discountMilli,
      taxMilli: taxMilli,
    });
  }

  function setTapMode(mode, options) {
    var next = mode === "catalog" ? "catalog" : "quick";
    var preserve = options && options.preserve;
    if (next !== tapMode && !preserve) {
      var losing = next === "catalog" ? quickLines.length : tapLines.length;
      if (
        losing &&
        !window.confirm("Switch modes? The current sale amounts will be cleared so totals do not mix.")
      ) {
        return;
      }
      if (next === "catalog") {
        quickLines = [];
        var amount = byId("quickAmount");
        if (amount) amount.value = "";
      } else {
        tapLines = [];
      }
      tapIdempotencyKey = newKey("tap");
    }
    tapMode = next;
    var quick = byId("tapQuickAmount");
    var catalog = byId("tapCatalogDetails");
    var quickBtn = byId("tapQuickModeBtn");
    var catalogBtn = byId("tapCatalogModeBtn");
    if (quick) quick.hidden = tapMode === "catalog";
    if (catalog) {
      catalog.hidden = tapMode === "quick";
      catalog.open = tapMode === "catalog";
    }
    if (quickBtn) {
      quickBtn.classList.toggle("is-active", tapMode === "quick");
      quickBtn.setAttribute("aria-pressed", tapMode === "quick" ? "true" : "false");
    }
    if (catalogBtn) {
      catalogBtn.classList.toggle("is-active", tapMode === "catalog");
      catalogBtn.setAttribute("aria-pressed", tapMode === "catalog" ? "true" : "false");
    }
    if (!preserve) {
      setError("tapError", "");
      renderQuickLines();
      renderTapCart();
    }
  }

  function renderQuickLines() {
    var wrap = byId("quickLines");
    if (!wrap) return;
    if (!quickLines.length) {
      wrap.innerHTML = '<p class="payment-inline-state">No amounts added yet.</p>';
      return;
    }
    wrap.innerHTML = quickLines
      .map(function (line, index) {
        return (
          '<article class="pos-quick-line" data-quick-key="' +
          escapeHtml(line.key) +
          '"><span>Item ' +
          (index + 1) +
          "</span><strong>" +
          money(line.unitAmountCents) +
          '</strong><button type="button" class="tap-line-remove" data-remove-quick aria-label="Remove item ' +
          (index + 1) +
          '">Remove</button></article>'
        );
      })
      .join("");
    wrap.querySelectorAll("[data-remove-quick]").forEach(function (button) {
      button.addEventListener("click", function () {
        var root = button.closest("[data-quick-key]");
        var key = root && root.getAttribute("data-quick-key");
        quickLines = quickLines.filter(function (line) {
          return line.key !== key;
        });
        tapIdempotencyKey = newKey("tap");
        renderQuickLines();
        updateTakePaymentButton();
      });
    });
  }

  function addQuickLine() {
    setTapMode("quick", { preserve: true });
    var cents = quickAmountCents();
    if (cents == null) {
      setError("tapError", "Enter an amount from $0.01 to $10,000.00, then tap Add.");
      if (byId("quickAmount")) byId("quickAmount").focus();
      return;
    }
    if (quickLines.length >= 100) {
      setError("tapError", "This sale already has the maximum number of amounts.");
      return;
    }
    quickLines.push({
      key: newKey("tap-quick"),
      unitAmountCents: cents,
    });
    var amount = byId("quickAmount");
    if (amount) {
      amount.value = "";
      amount.focus();
    }
    setError("tapError", "");
    tapIdempotencyKey = newKey("tap");
    renderQuickLines();
    updateTakePaymentButton();
  }

  function clearQuickSale(force) {
    if (
      !force &&
      (quickLines.length || byId("quickAmount").value || discountMilli) &&
      !window.confirm("Clear this Quick Sale? Entered amounts and the discount will be removed.")
    ) {
      return;
    }
    quickLines = [];
    discountMilli = 0;
    customDiscountOpen = false;
    var amount = byId("quickAmount");
    var note = byId("quickSaleNote");
    var custom = byId("customDiscountInput");
    if (amount) amount.value = "";
    if (note) note.value = "";
    if (custom) custom.value = "";
    if (byId("customDiscountField")) byId("customDiscountField").hidden = true;
    tapIdempotencyKey = newKey("tap");
    setError("tapError", "");
    renderQuickLines();
    updateDiscountButtons();
    updateTakePaymentButton();
  }

  function onQuickAmountInput() {
    setError("tapError", "");
  }

  function appendKeypad(key) {
    var input = byId("quickAmount");
    if (!input) return;
    var current = String(input.value || "");
    if (key === "back") {
      input.value = current.slice(0, -1);
    } else if (key === ".") {
      if (current.indexOf(".") === -1) input.value = (current || "0") + ".";
    } else {
      var next = current + key;
      if (/^\d{0,7}(?:\.\d{0,2})?$/.test(next)) input.value = next;
    }
    onQuickAmountInput();
  }

  function updateDiscountButtons() {
    document.querySelectorAll("[data-discount-milli]").forEach(function (button) {
      button.classList.toggle(
        "is-active",
        !customDiscountOpen && Number(button.getAttribute("data-discount-milli")) === discountMilli
      );
    });
    var customBtn = byId("customDiscountBtn");
    if (customBtn) customBtn.classList.toggle("is-active", customDiscountOpen);
    if (byId("customDiscountField")) {
      byId("customDiscountField").hidden = !customDiscountOpen;
    }
  }

  function applyDiscountMilli(value, custom) {
    discountMilli = SRPosTotals.clampDiscountMilli(value);
    customDiscountOpen = !!custom;
    tapIdempotencyKey = newKey("tap");
    updateDiscountButtons();
    updateTakePaymentButton();
  }

  function applyCustomDiscount() {
    var parsed = SRPosTotals.parsePercentToMilli(byId("customDiscountInput").value);
    if (!parsed.ok) {
      setError("tapError", parsed.error || "Enter a discount from 0% to 100%.");
      return;
    }
    setError("tapError", "");
    applyDiscountMilli(parsed.value, true);
  }

  function resetQuickAmount() {
    setTapMode("quick");
    clearQuickSale(true);
  }

  function lineUnitCents(line) {
    return line.type === "product"
      ? productCents(line.product, line.finish)
      : line.unitAmountCents;
  }

  function isAndroidPos() {
    return /Android/i.test(navigator.userAgent || "");
  }

  var POS_APP_SEEN_KEY = "sr_ttp_app_seen";
  var posAppMeta = null;
  var posAppBusy = false;

  function posAppSeen() {
    try {
      return window.localStorage.getItem(POS_APP_SEEN_KEY) === "1";
    } catch (_err) {
      return false;
    }
  }

  function markPosAppSeen() {
    try {
      window.localStorage.setItem(POS_APP_SEEN_KEY, "1");
    } catch (_err) {
      /* ignore quota / private mode */
    }
  }

  function renderPosAppCard() {
    var android = isAndroidPos();
    var installBtn = byId("installPosAppBtn");
    var openBtn = byId("openPosAppBtn");
    var copy = byId("posAppCopy");
    var help = byId("posAppHelp");
    var badge = byId("posAppBadge");
    var seen = posAppSeen();
    if (posAppMeta && badge) {
      badge.textContent = posAppMeta.version_name
        ? posAppMeta.label + " · " + posAppMeta.version_name
        : posAppMeta.label;
      badge.className =
        "pos-app-badge " +
        (posAppMeta.simulated ? "pos-app-badge--test" : "pos-app-badge--live");
    }
    if (copy) {
      copy.textContent = android
        ? "Required once on this Android phone to accept contactless payments. Customers do not install an app."
        : "Open this page on your S&R Android phone to install the staff Tap to Pay app. Customers do not install an app.";
    }
    if (help) {
      help.textContent = android
        ? "Authorized S&R staff devices only."
        : "This installer is only for authorized S&R staff phones.";
    }
    if (installBtn) {
      installBtn.hidden = !android;
      installBtn.className = seen
        ? "btn btn-ghost btn-block"
        : "btn btn-primary btn-block";
      installBtn.textContent = seen
        ? "Reinstall S&R Tap to Pay"
        : "Install S&R Tap to Pay";
      installBtn.disabled = posAppBusy;
    }
    if (openBtn) {
      openBtn.hidden = !android;
      openBtn.className = seen
        ? "btn btn-primary btn-block"
        : "btn btn-ghost btn-block";
    }
  }

  async function loadPosAppMeta() {
    var token = adminSession && adminSession.access_token;
    if (!token) return;
    try {
      var response = await fetch("/api/admin/pos-app", {
        headers: { Authorization: "Bearer " + token },
      });
      var body = await response.json().catch(function () {
        return null;
      });
      if (!response.ok || !body) return;
      posAppMeta = body;
      renderPosAppCard();
    } catch (_err) {
      /* Keep the HTML test-version label if metadata cannot load. */
    }
  }

  async function installPosApp() {
    if (posAppBusy || !isAndroidPos()) return;
    setError("posAppError", "");
    var token = adminSession && adminSession.access_token;
    if (!token) {
      setError("posAppError", "Your admin session is missing. Please sign in again.");
      return;
    }
    posAppBusy = true;
    renderPosAppCard();
    var steps = byId("posAppSteps");
    if (steps) steps.hidden = false;
    try {
      var response = await fetch("/api/admin/pos-app?download=1", {
        headers: { Authorization: "Bearer " + token },
        credentials: "same-origin",
      });
      var body = await response.json().catch(function () {
        return null;
      });
      if (!response.ok) {
        throw new Error(apiErrorMessage(response, body));
      }
      if (!body || !body.download_url || body.download_url.indexOf("/api/admin/pos-app-file") === -1) {
        throw new Error("The app download isn’t ready yet. Please try again.");
      }
      posAppMeta = body;
      var help = byId("posAppDownloadHelp");
      var link = byId("posAppDownloadLink");
      if (link) {
        link.href = body.download_url;
        link.setAttribute("download", body.filename || "S-and-R-Tap-to-Pay-TEST.apk");
      }
      if (help) help.hidden = false;
      window.location.assign(body.download_url);
    } catch (err) {
      setError("posAppError", err.message || "Couldn’t download the S&R Tap to Pay app.");
    } finally {
      posAppBusy = false;
      renderPosAppCard();
    }
  }

  function openPosApp() {
    if (!isAndroidPos()) return;
    setError("posAppError", "");
    var fallback =
      "https://www.sandrconcretecrafts.com/admin/payments.html?app=missing";
    var intentUrl = window.SRTapHandoff.buildOpenAppIntent(fallback);
    var timer = window.setTimeout(function () {
      setError(
        "posAppError",
        "Install S&R Tap to Pay on this phone first, then tap Open."
      );
    }, 1800);
    document.addEventListener("visibilitychange", function onHide() {
      if (document.hidden) {
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", onHide);
        markPosAppSeen();
        renderPosAppCard();
      }
    });
    window.location.href = intentUrl;
  }

  function tapSalePayload() {
    if (!tapIdempotencyKey) tapIdempotencyKey = newKey("tap");
    var note = quickSaleNote();
    var quote = currentQuote();
    var items;
    if (tapMode === "catalog") {
      items = trustedTapPayload();
    } else {
      items = quickLines.map(function (line, index) {
        return {
          type: "custom",
          name: (note || "Quick sale " + (index + 1)).slice(0, 120),
          unit_amount_cents: line.unitAmountCents,
          quantity: 1,
        };
      });
    }
    return {
      sold_at: new Date().toISOString(),
      idempotency_key: tapIdempotencyKey,
      sale_note: note,
      customer_name: null,
      customer_email: null,
      customer_phone: null,
      receipt_email: null,
      discount_milli: quote.discountMilli,
      tax_milli: quote.taxMilli,
      amount_total_cents: quote.total,
      items: items,
    };
  }

  function tapCartTotal() {
    return tapLines.reduce(function (sum, line) {
      return sum + lineUnitCents(line) * line.quantity;
    }, 0);
  }

  function activeTapTotal() {
    return currentQuote().total;
  }

  function syncTapModeUi(total) {
    var quick = byId("tapQuickAmount");
    var catalog = byId("tapCatalogDetails");
    var source = byId("tapChargeSource");
    var catalogBtn = byId("takeCatalogPaymentBtn");
    var catalogCharging = tapMode === "catalog" && tapCartTotal() > 0;
    var quickCharging = tapMode === "quick" && currentQuote().subtotal > 0;
    if (quick) {
      quick.classList.toggle("is-charging", tapMode === "quick" && quickCharging);
      quick.classList.toggle("is-idle", tapMode === "catalog");
    }
    if (catalog) {
      catalog.classList.toggle("is-charging", catalogCharging);
    }
    if (source) {
      if (catalogCharging) {
        source.textContent =
          "Charging website products — " +
          money(total) +
          ". Typed amount is not used.";
      } else if (quickCharging) {
        source.textContent =
          "Charging Quick Sale — " +
          money(total) +
          ". Website products are not used.";
      } else {
        source.textContent =
          "Enter amounts or select website products. Only one total is charged.";
      }
    }
    if (catalogBtn) {
      catalogBtn.hidden = !catalogCharging;
      catalogBtn.disabled = !catalogCharging || !isAndroidPos() || tapSubmitting;
      catalogBtn.textContent = tapSubmitting
        ? "Opening Tap to Pay…"
        : "TAKE PAYMENT — " + money(total);
    }
  }

  function updatePosTotals() {
    var quote = currentQuote();
    if (byId("posSubtotal")) byId("posSubtotal").textContent = money(quote.subtotal);
    if (byId("posDiscount")) byId("posDiscount").textContent = "-" + money(quote.discount);
    if (byId("posDiscountRow")) byId("posDiscountRow").hidden = !quote.discount;
    if (byId("posDiscountLabel")) {
      byId("posDiscountLabel").textContent = quote.discountMilli
        ? "Discount " + SRPosTotals.percentLabel(quote.discountMilli) + "%"
        : "Discount";
    }
    if (byId("posTax")) byId("posTax").textContent = money(quote.tax);
    if (byId("posTaxLabel")) {
      byId("posTaxLabel").textContent = taxMilli
        ? "Tax " + SRPosTotals.percentLabel(taxMilli) + "%"
        : "Tax";
    }
    if (byId("posGrandTotal")) byId("posGrandTotal").textContent = money(quote.total);
    if (byId("posTotalBanner")) byId("posTotalBanner").textContent = "TOTAL: " + money(quote.total);
    return quote;
  }

  function updateTakePaymentButton() {
    var button = byId("takePaymentBtn");
    var help = byId("terminalHelp");
    var status = byId("terminalStatus");
    var blocked = byId("terminalBlocked");
    var android = isAndroidPos();
    var quote = updatePosTotals();
    var total = quote.total;
    var ready = android && total > 0 && !tapSubmitting;
    syncTapModeUi(total);
    if (button) {
      button.disabled = !ready;
      button.textContent = android
        ? tapSubmitting
          ? "Opening Tap to Pay…"
          : "TAKE PAYMENT — " + money(total)
        : "TAKE PAYMENT — Native App Required";
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
        ? "TAKE PAYMENT opens the S&R Tap to Pay app on this phone. The S&R server still sets the charge amount."
        : "This browser does not tap cards. On the Pixel, TAKE PAYMENT opens the S&R Tap to Pay app.";
    }
  }

  function showHandoffDiag(sale, quote) {
    var box = byId("tapHandoffDiag");
    if (!box) return;
    box.hidden = false;
    box.textContent = [
      "ADMIN PAYMENT HANDOFF",
      "HANDOFF BUILD",
      "calculated_total_cents=" + quote.total,
      "handoff_total_cents=" + sale.amount_total_cents,
      "amount_total_cents=" + sale.amount_total_cents,
      "handoff_version=" + (window.SRTapHandoff && window.SRTapHandoff.HANDOFF_VERSION),
      "payload_version=" + sale.handoff_version,
      "handoff_target=sandrpos://collect extras S.p + i.amount_total_cents",
      "Sending to Tap to Pay: " + (window.SRTapHandoff ? window.SRTapHandoff.money(sale.amount_total_cents) : ""),
    ].join("\n");
  }

  function openNativeCollect(sale) {
    if (!window.SRTapHandoff) {
      tapSubmitting = false;
      updateTakePaymentButton();
      setError("tapError", "Tap to Pay handoff script did not load. Refresh Payments and try again.");
      return;
    }
    var intentUrl = window.SRTapHandoff.buildCollectIntent(
      sale,
      "https://www.sandrconcretecrafts.com/admin/payments.html?tap=missing"
    );
    var fallback = window.setTimeout(function () {
      tapSubmitting = false;
      updateTakePaymentButton();
      setError(
        "tapError",
        "Install the S&R Tap to Pay app on this Pixel, then try again. This page does not tap cards."
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
    var quote = currentQuote();
    if (tapMode === "catalog") {
      if (!tapLines.length || tapCartTotal() <= 0) {
        setError("tapError", "Add a website product first.");
        return;
      }
    } else if (!quickLines.length || quote.subtotal <= 0) {
      setError("tapError", "Add at least one amount greater than $0.00.");
      if (byId("quickAmount")) byId("quickAmount").focus();
      return;
    }
    if (quote.total <= 0) {
      setError("tapError", "TOTAL must be greater than $0.00.");
      return;
    }
    if (quote.discount > quote.subtotal || quote.discountMilli < 0 || quote.discountMilli > 100000) {
      setError("tapError", "That discount is not valid.");
      return;
    }
    if (quote.taxMilli !== taxMilli || quote.tax < 0) {
      setError("tapError", "Tax could not be calculated. Check Settings.");
      return;
    }
    var sale = tapSalePayload();
    sale = window.SRTapHandoff ? window.SRTapHandoff.prepareSale(sale) : sale;
    showHandoffDiag(sale, quote);
    if (sale.amount_total_cents !== quote.total) {
      setError("tapError", "The total changed. Review the sale and try again.");
      return;
    }
    tapSubmitting = true;
    updateTakePaymentButton();
    writeReceiptStore({
      orders: [{ id: "pending", amount_total: quote.total }],
      sales: [receiptSaleFromState(sale, quote)],
      method: "tap_to_pay",
    });
    openNativeCollect(sale);
  }

  function handleTapReturn() {
    var params = new URLSearchParams(window.location.search);
    var paid = String(params.get("paid") || "").trim();
    var tap = String(params.get("tap") || "").trim();
    var app = String(params.get("app") || "").trim();
    if (!paid && !tap && !app) return;
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", "/admin/payments.html");
    }
    if (app === "missing") {
      setError(
        "posAppError",
        "Install S&R Tap to Pay on this phone first, then tap Open."
      );
    }
    if (paid) {
      tapIdempotencyKey = newKey("tap");
      tapLines = [];
      resetQuickAmount();
      renderTapCart();
      var stored = readReceiptStore() || {};
      var amount = Number(params.get("amount"));
      showReceiptOptions(
        [{
          id: paid,
          amount_total: Number.isFinite(amount)
            ? amount
            : ((stored.orders && stored.orders[0] && stored.orders[0].amount_total) || 0),
        }],
        stored.sales || [{}],
        "tap_to_pay"
      );
      announce("Tap to Pay sale recorded. Screenshot the receipt if needed.", "ok");
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
    return tapLines
      .filter(function (line) {
        return line.type === "product";
      })
      .map(function (line) {
        return {
          type: "product",
          product_id: line.product.id,
          finish: line.finish,
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
    if (byId("tapCatalogTotal")) byId("tapCatalogTotal").textContent = money(total);
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
    byId("tapQuickModeBtn").addEventListener("click", function () {
      setTapMode("quick");
    });
    byId("tapCatalogModeBtn").addEventListener("click", function () {
      setTapMode("catalog");
    });
    byId("quickAmount").addEventListener("input", onQuickAmountInput);
    byId("quickAmount").addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addQuickLine();
      }
    });
    byId("addQuickLine").addEventListener("click", addQuickLine);
    byId("clearQuickSale").addEventListener("click", function () {
      clearQuickSale(false);
    });
    byId("posKeypad").addEventListener("click", function (event) {
      var key = event.target && event.target.getAttribute("data-pos-key");
      if (key) appendKeypad(key);
    });
    document.querySelectorAll("[data-discount-milli]").forEach(function (button) {
      button.addEventListener("click", function () {
        applyDiscountMilli(Number(button.getAttribute("data-discount-milli")), false);
      });
    });
    byId("customDiscountBtn").addEventListener("click", function () {
      customDiscountOpen = true;
      if (byId("customDiscountField")) byId("customDiscountField").hidden = false;
      updateDiscountButtons();
      if (byId("customDiscountInput")) byId("customDiscountInput").focus();
    });
    byId("customDiscountInput").addEventListener("change", applyCustomDiscount);
    byId("customDiscountInput").addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        applyCustomDiscount();
      }
    });
    byId("clearDiscountBtn").addEventListener("click", function () {
      if (byId("customDiscountInput")) byId("customDiscountInput").value = "";
      applyDiscountMilli(0, false);
    });
    byId("clearTapCart").addEventListener("click", function () {
      tapLines = [];
      tapIdempotencyKey = newKey("tap");
      setError("tapError", "");
      renderTapCart();
    });
    byId("takePaymentBtn").addEventListener("click", takePayment);
    if (byId("takeCatalogPaymentBtn")) {
      byId("takeCatalogPaymentBtn").addEventListener("click", takePayment);
    }
    byId("installPosAppBtn").addEventListener("click", installPosApp);
    byId("openPosAppBtn").addEventListener("click", openPosApp);
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
    setTapMode("quick", { preserve: true });
    renderQuickLines();
    renderTapCart();
    updateDiscountButtons();
    renderPosAppCard();
    bindEvents();
    handleTapReturn();
    loadCatalog();
    loadPosAppMeta();
    SRCatalog.getStoreSettings()
      .then(function (row) {
        var settings = SRStoreSettings.normalize((row && row.settings) || {});
        taxMilli = SRPosTotals.clampTaxMilli(settings.pos && settings.pos.tax_milli);
        updateTakePaymentButton();
      })
      .catch(function () {
        taxMilli = 0;
        updateTakePaymentButton();
      });
  });
})();
