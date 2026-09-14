/**
 * Admin sales command center + catalog summary (active admin only).
 * Revenue = paid orders only. No fake data. No PII in logs.
 */
(function () {
  "use strict";

  var loadedOnce = false;
  var loading = false;
  var skipAnim = false;
  var chartRange = "7d";
  var lastSnap = null;
  var lastGoals = null;
  var celebrateTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function greetingText() {
    var h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  function statusLabel(status) {
    return (
      {
        draft: "Draft",
        published: "Published",
        sold_out: "Sold out",
        hidden: "Hidden",
      }[status] || status
    );
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

  function showError(msg, retryable) {
    var el = $("dashboardError");
    var loadingEl = $("dashboardLoading");
    var content = $("dashboardContent");
    if (loadingEl) loadingEl.hidden = true;
    if (content && !loadedOnce) content.hidden = true;
    if (!el) return;
    el.hidden = false;
    el.classList.add("is-visible");
    el.innerHTML =
      "<p>" +
      SRCatalog.escapeHtml(msg || "Couldn’t load the dashboard.") +
      "</p>" +
      (retryable
        ? '<p><button type="button" class="btn btn-ghost" id="dashboardRetry">Try again</button></p>'
        : "");
    var retry = $("dashboardRetry");
    if (retry) {
      retry.addEventListener("click", function () {
        loadDashboard(true);
      });
    }
  }

  function clearError() {
    var el = $("dashboardError");
    if (!el) return;
    el.hidden = true;
    el.classList.remove("is-visible");
    el.innerHTML = "";
  }

  function setLoading(isLoading) {
    loading = isLoading;
    var loadingEl = $("dashboardLoading");
    var refresh = $("dashboardRefresh");
    if (loadingEl) {
      loadingEl.hidden = !isLoading || loadedOnce;
      if (isLoading && !loadedOnce) {
        loadingEl.textContent = "Loading sales summary…";
      }
    }
    if (refresh) {
      refresh.disabled = isLoading;
      refresh.textContent = isLoading ? "Refreshing…" : "Refresh";
    }
  }

  function priceHtml(p) {
    if (p.sale_price != null && Number(p.sale_price) < Number(p.price)) {
      return (
        '<span class="price-sale">' +
        SRCatalog.money(p.sale_price) +
        '</span> <span class="price-was">' +
        SRCatalog.money(p.price) +
        "</span>"
      );
    }
    return SRCatalog.money(p.price);
  }

  function thumbHtml(p) {
    var primary = p.primary || SRCatalog.primaryImage(p.images || p.product_images || []);
    if (primary && primary.image_url) {
      return (
        '<img src="' +
        SRCatalog.escapeHtml(primary.image_url) +
        '" alt="" width="48" height="48" />'
      );
    }
    return '<div class="thumb-empty">No photo</div>';
  }

  function animOpts() {
    return {
      skip: skipAnim || SRSales.prefersReducedMotion(),
      duration: 900,
    };
  }

  function showCelebrate(msg) {
    var toast = $("celebrateToast");
    if (!toast || !msg) return;
    if (celebrateTimer) clearTimeout(celebrateTimer);
    toast.hidden = false;
    toast.textContent = msg;
    celebrateTimer = setTimeout(function () {
      toast.hidden = true;
      toast.textContent = "";
    }, 3200);
  }

  function runCelebrations(snap, goals) {
    var pending = SRSales.pendingCelebrations(snap, goals);
    if (!pending.length) return;
    var first = pending[0];
    var scope = first.scope === "annual" ? "Annual" : "Weekly";
    showCelebrate(scope + " goal · " + first.threshold + "% reached!");
    SRSales.acknowledgeCelebrations(snap, pending);
  }

  function renderGoals(snap, goals, animate) {
    var annualPct = SRSales.pct(snap.revenue.year, goals.annual_cents);
    var weeklyPct = SRSales.pct(snap.revenue.week, goals.weekly_cents);
    var opts = animate ? animOpts() : { skip: true };

    $("annualPct").textContent = annualPct + "%";
    $("weeklyPct").textContent = weeklyPct + "%";
    $("annualGoalLabel").textContent =
      "of " + SRSales.moneyFromCents(goals.annual_cents);
    $("weeklyGoalLabel").textContent =
      "of " + SRSales.moneyFromCents(goals.weekly_cents);

    var annualBar = $("annualBar");
    var weeklyBar = $("weeklyBar");
    if (annualBar) annualBar.setAttribute("aria-valuenow", String(Math.round(annualPct)));
    if (weeklyBar) weeklyBar.setAttribute("aria-valuenow", String(Math.round(weeklyPct)));

    SRSales.animateNumber($("annualRevenue"), snap.revenue.year, opts);
    SRSales.animateNumber($("weeklyRevenue"), snap.revenue.week, opts);
    SRSales.animateBar($("annualBarFill"), annualPct, opts);
    SRSales.animateBar($("weeklyBarFill"), weeklyPct, opts);

    $("weeklyGoalInput").value = (goals.weekly_cents / 100).toFixed(2);
    $("annualGoalInput").value = (goals.annual_cents / 100).toFixed(2);
  }

  function renderNeedsShipping(snap) {
    var n = snap.needsShippingCount || 0;
    $("needsShipCount").textContent = String(n);
    $("needsShipLabel").textContent =
      n === 0
        ? "All caught up — nothing waiting to ship"
        : n === 1
          ? "1 paid order waiting to ship"
          : n + " paid orders waiting to ship";
    $("needsShipCard").classList.toggle("needs-ship-card--alert", n > 0);
  }

  function renderMetrics(snap, animate) {
    var opts = animate ? animOpts() : { skip: true };
    SRSales.animateNumber($("metricToday"), snap.revenue.today, opts);
    SRSales.animateNumber($("metricWeek"), snap.revenue.week, opts);
    SRSales.animateNumber($("metricMonth"), snap.revenue.month, opts);
    SRSales.animateNumber($("metricYear"), snap.revenue.year, opts);
  }

  function seriesForRange(orders) {
    if (chartRange === "30d") return SRSales.seriesDaily(orders, 30);
    if (chartRange === "year") return SRSales.seriesMonthly(orders);
    return SRSales.seriesDaily(orders, 7);
  }

  function drawChart(orders) {
    var canvas = $("salesChart");
    var empty = $("salesChartEmpty");
    if (!canvas || !canvas.getContext) return;

    var series = seriesForRange(orders || []);
    var max = 0;
    series.forEach(function (b) {
      if (b.cents > max) max = b.cents;
    });
    var hasData = max > 0;
    if (empty) empty.hidden = hasData;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = canvas.clientWidth || 640;
    var cssH = 220;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var padL = 8;
    var padR = 8;
    var padT = 16;
    var padB = 28;
    var plotW = cssW - padL - padR;
    var plotH = cssH - padT - padB;
    var n = series.length || 1;
    var gap = n > 20 ? 2 : 6;
    var barW = Math.max(3, (plotW - gap * (n - 1)) / n);
    var scale = max > 0 ? plotH / max : 0;

    ctx.strokeStyle = "rgba(47, 44, 40, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    series.forEach(function (b, i) {
      var h = hasData ? Math.max(b.cents > 0 ? 2 : 0, b.cents * scale) : 0;
      var x = padL + i * (barW + gap);
      var y = padT + plotH - h;
      var grad = ctx.createLinearGradient(0, y, 0, padT + plotH);
      grad.addColorStop(0, "#bd6f43");
      grad.addColorStop(1, "#2f6f6d");
      ctx.fillStyle = b.cents > 0 ? grad : "rgba(47, 44, 40, 0.08)";
      var drawH = b.cents > 0 ? h : 2;
      ctx.beginPath();
      var r = Math.min(4, barW / 2);
      var by = padT + plotH - drawH;
      ctx.moveTo(x, padT + plotH);
      ctx.lineTo(x, by + r);
      ctx.quadraticCurveTo(x, by, x + r, by);
      ctx.lineTo(x + barW - r, by);
      ctx.quadraticCurveTo(x + barW, by, x + barW, by + r);
      ctx.lineTo(x + barW, padT + plotH);
      ctx.closePath();
      ctx.fill();
    });

    ctx.fillStyle = "#8a847a";
    ctx.font = "11px Inter, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    var labelEvery = chartRange === "30d" ? 5 : chartRange === "year" ? 1 : 1;
    series.forEach(function (b, i) {
      if (i % labelEvery !== 0 && i !== n - 1) return;
      var x = padL + i * (barW + gap) + barW / 2;
      ctx.fillText(b.label, x, cssH - 8);
    });
  }

  function renderRecentOrders(paidOrders) {
    var el = $("recentOrdersList");
    var rows = (paidOrders || []).slice(0, 8);
    if (!rows.length) {
      el.innerHTML =
        '<div class="state-box state-box--inset"><p class="state-title">No paid orders yet</p>' +
        "<p>When a Stripe Checkout payment completes, it will show up here.</p>" +
        '<p><a class="btn btn-ghost" href="/admin/orders.html">Open Orders</a></p></div>';
      return;
    }
    el.innerHTML =
      '<ul class="dash-list">' +
      rows
        .map(function (o) {
          var label = o.customer_name || "Customer";
          var fulfill = String(o.fulfillment_status || "unfulfilled").toLowerCase();
          return (
            '<li class="dash-list-item">' +
            '<div class="dash-list-body">' +
            "<strong>" +
            SRCatalog.escapeHtml(label) +
            "</strong>" +
            '<div class="dash-list-meta">' +
            "<span>" +
            SRCatalog.escapeHtml(formatWhen(o.created_at)) +
            "</span>" +
            '<span class="fulfill-badge fulfill-badge--' +
            SRCatalog.escapeHtml(fulfill) +
            '">' +
            SRCatalog.escapeHtml(fulfill.replace(/_/g, " ")) +
            "</span>" +
            "</div>" +
            "</div>" +
            '<div class="dash-list-side">' +
            "<strong>" +
            SRCatalog.escapeHtml(SRSales.moneyFromCents(o.amount_total, o.currency)) +
            "</strong>" +
            '<a class="btn btn-ghost btn-small" href="/admin/orders.html?order=' +
            encodeURIComponent(o.id) +
            '">View</a>' +
            "</div>" +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function renderCounts(counts, snap) {
    var paidCount = (snap && snap.orderCounts && snap.orderCounts.all) || 0;
    var revenue = (snap && snap.revenue && snap.revenue.all) || 0;
    var cards = [
      {
        key: "total",
        label: "Products",
        value: counts.total,
        ico: "▣",
        href: "/admin/products.html",
      },
      {
        key: "published",
        label: "Published",
        value: counts.published,
        ico: "✓",
        href: "/admin/products.html?status=published",
      },
      {
        key: "orders",
        label: "Paid orders",
        value: paidCount,
        ico: "☰",
        href: "/admin/orders.html?filter=paid",
      },
      {
        key: "revenue",
        label: "All-time paid",
        value: SRSales.moneyFromCents(revenue),
        ico: "◈",
        href: "/admin/orders.html?filter=paid",
      },
    ];

    $("statsGrid").innerHTML = cards
      .map(function (c) {
        return (
          '<a class="stat-card" href="' +
          SRCatalog.escapeHtml(c.href) +
          '">' +
          '<div class="stat-card-top"><span class="stat-ico" aria-hidden="true">' +
          c.ico +
          '</span><div class="stat-label">' +
          SRCatalog.escapeHtml(c.label) +
          "</div></div>" +
          '<div class="stat-value">' +
          SRCatalog.escapeHtml(String(c.value)) +
          "</div>" +
          "</a>"
        );
      })
      .join("");
  }

  function renderRecent(rows) {
    var el = $("recentList");
    if (!rows.length) {
      el.innerHTML =
        '<div class="state-box state-box--inset"><p class="state-title">No products yet</p>' +
        '<p>Add your first piece to start building the catalog.</p>' +
        '<p><a class="btn btn-primary" href="/admin/product-edit.html">Add Product</a></p></div>';
      return;
    }
    el.innerHTML =
      '<ul class="dash-list">' +
      rows
        .map(function (p) {
          return (
            '<li class="dash-list-item">' +
            '<div class="prod-thumb">' +
            thumbHtml(p) +
            "</div>" +
            '<div class="dash-list-body">' +
            "<strong>" +
            SRCatalog.escapeHtml(p.title) +
            "</strong>" +
            '<div class="dash-list-meta">' +
            '<span class="status-pill status-' +
            SRCatalog.escapeHtml(p.status) +
            '">' +
            statusLabel(p.status) +
            "</span>" +
            "<span>" +
            priceHtml(p) +
            "</span>" +
            "</div>" +
            "</div>" +
            '<a class="btn btn-ghost btn-small" href="/admin/product-edit.html?id=' +
            encodeURIComponent(p.id) +
            '">Edit</a>' +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function renderInventory(rows) {
    var panel = $("inventoryPanel");
    var list = $("inventoryList");
    var count = (rows && rows.length) || 0;
    if (!count) {
      panel.hidden = true;
      list.innerHTML = "";
      return;
    }
    panel.hidden = false;
    list.innerHTML =
      '<p class="dash-alert-count">' +
      SRCatalog.escapeHtml(String(count)) +
      (count === 1 ? " product needs" : " products need") +
      " stock before shoppers can buy.</p>" +
      '<ul class="dash-list">' +
      rows
        .map(function (p) {
          return (
            '<li class="dash-list-item">' +
            '<div class="prod-thumb">' +
            thumbHtml(p) +
            "</div>" +
            '<div class="dash-list-body">' +
            "<strong>" +
            SRCatalog.escapeHtml(p.title) +
            "</strong>" +
            '<div class="dash-list-meta"><span>Tracked stock: 0</span></div>' +
            "</div>" +
            '<a class="btn btn-ghost btn-small" href="/admin/product-edit.html?id=' +
            encodeURIComponent(p.id) +
            '">Update stock</a>' +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function setSkipVisible(show) {
    var btn = $("skipAnimBtn");
    if (btn) btn.hidden = !show;
  }

  async function loadDashboard(isRefresh) {
    if (loading) return;
    clearError();
    setLoading(true);
    if (!isRefresh) {
      $("dashboardContent").hidden = true;
      skipAnim = SRSales.prefersReducedMotion();
      setSkipVisible(!skipAnim);
    }
    try {
      var bundle = await Promise.all([
        SRCatalog.getDashboardCounts(),
        SRCatalog.listRecentProducts(8),
        SRCatalog.listInventoryAttention(12),
        SRCatalog.listPaidOrdersLite(),
        SRCatalog.getSalesGoals(),
      ]);
      var counts = bundle[0];
      var recent = bundle[1];
      var attention = bundle[2];
      var paidLite = bundle[3] || [];
      var goalsRaw = bundle[4];
      var goals = SRSales.normalizeGoals(goalsRaw);
      var snap = SRSales.buildSalesSnapshot(paidLite);
      lastSnap = snap;
      lastGoals = goals;

      var greet = $("dashGreeting");
      if (greet) greet.textContent = greetingText();

      var animate = !isRefresh && !skipAnim;
      renderGoals(snap, goals, animate);
      renderNeedsShipping(snap);
      renderMetrics(snap, animate);
      drawChart(paidLite);
      renderRecentOrders(snap.paidOrders);
      renderCounts(counts, snap);
      renderRecent(recent);
      renderInventory(attention);

      loadedOnce = true;
      $("dashboardLoading").hidden = true;
      $("dashboardContent").hidden = false;

      if (!isRefresh) {
        runCelebrations(snap, goals);
        if (animate) {
          setTimeout(function () {
            setSkipVisible(false);
          }, 1000);
        } else {
          setSkipVisible(false);
        }
      }
    } catch (err) {
      if (!loadedOnce) {
        $("dashboardContent").hidden = true;
      }
      showError(
        (err && err.message) ||
          "Couldn’t load sales summary. Check your connection and try again.",
        true
      );
    } finally {
      setLoading(false);
    }
  }

  function bindGoalsForm() {
    var form = $("goalsForm");
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var errEl = $("goalsFormError");
      var btn = $("goalsSaveBtn");
      if (errEl) {
        errEl.hidden = true;
        errEl.classList.remove("is-visible");
        errEl.textContent = "";
      }
      var weeklyDollars = Number($("weeklyGoalInput").value);
      var annualDollars = Number($("annualGoalInput").value);
      if (!isFinite(weeklyDollars) || weeklyDollars < 0 || !isFinite(annualDollars) || annualDollars < 0) {
        if (errEl) {
          errEl.hidden = false;
          errEl.classList.add("is-visible");
          errEl.textContent = "Enter valid dollar amounts.";
        }
        return;
      }
      var weeklyCents = Math.round(weeklyDollars * 100);
      var annualCents = Math.round(annualDollars * 100);
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Saving…";
      }
      try {
        var saved = await SRCatalog.saveSalesGoals(weeklyCents, annualCents);
        lastGoals = SRSales.normalizeGoals(saved);
        if (lastSnap) {
          renderGoals(lastSnap, lastGoals, false);
          runCelebrations(lastSnap, lastGoals);
        }
        if (btn) btn.textContent = "Saved";
        setTimeout(function () {
          if (btn) btn.textContent = "Save goals";
        }, 1200);
      } catch (err) {
        if (errEl) {
          errEl.hidden = false;
          errEl.classList.add("is-visible");
          errEl.textContent = (err && err.message) || "Couldn’t save goals.";
        }
        if (btn) btn.textContent = "Save goals";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  function bindChartTabs() {
    document.querySelectorAll(".chart-range-tabs [data-range]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        chartRange = btn.getAttribute("data-range") || "7d";
        document.querySelectorAll(".chart-range-tabs [data-range]").forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        if (lastSnap) drawChart(lastSnap.paidOrders);
      });
    });
    window.addEventListener("resize", function () {
      if (lastSnap) drawChart(lastSnap.paidOrders);
    });
  }

  SRAdminShell.boot({ activeNav: "dashboard" }).then(function (check) {
    if (!check) return;
    bindGoalsForm();
    bindChartTabs();

    $("skipAnimBtn").addEventListener("click", function () {
      skipAnim = true;
      setSkipVisible(false);
      if (lastSnap && lastGoals) {
        renderGoals(lastSnap, lastGoals, false);
        renderMetrics(lastSnap, false);
      }
    });

    $("dashboardRefresh").addEventListener("click", function () {
      loadDashboard(true);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && loadedOnce) {
        loadDashboard(true);
      }
    });
    window.addEventListener("pageshow", function (event) {
      if (event.persisted && loadedOnce) {
        loadDashboard(true);
      }
    });
    loadDashboard(false);
  });
})();
