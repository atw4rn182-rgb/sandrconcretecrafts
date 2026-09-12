/**
 * Admin dashboard — real catalog counts and recent products (active admin only).
 */
(function () {
  "use strict";

  var loadedOnce = false;
  var loading = false;

  function $(id) {
    return document.getElementById(id);
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

  function showError(msg, retryable) {
    var el = $("dashboardError");
    var loadingEl = $("dashboardLoading");
    var content = $("dashboardContent");
    if (loadingEl) loadingEl.hidden = true;
    // Keep last good summary visible on refresh failure; never invent zeros.
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
        loadingEl.textContent = "Loading catalog summary…";
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

  function renderCounts(counts) {
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
        label: "Orders",
        value: "—",
        ico: "☰",
        href: "/admin/orders.html",
        placeholder: true,
      },
      {
        key: "revenue",
        label: "Revenue",
        value: "—",
        ico: "◈",
        href: "/admin/orders.html",
        placeholder: true,
      },
    ];

    $("statsGrid").innerHTML = cards
      .map(function (c) {
        return (
          '<a class="stat-card' +
          (c.placeholder ? " stat-card--placeholder" : "") +
          '" href="' +
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
          (c.placeholder
            ? '<div class="stat-note">Not connected</div>'
            : "") +
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

  function renderInventory(rows, count) {
    var panel = $("inventoryPanel");
    var list = $("inventoryList");
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

  async function loadDashboard(isRefresh) {
    if (loading) return;
    clearError();
    setLoading(true);
    if (!isRefresh) {
      $("dashboardContent").hidden = true;
    }
    try {
      var bundle = await Promise.all([
        SRCatalog.getDashboardCounts(),
        SRCatalog.listRecentProducts(8),
        SRCatalog.listInventoryAttention(12),
        SRCatalog.countInventoryAttention(),
      ]);
      var counts = bundle[0];
      var recent = bundle[1];
      var attention = bundle[2];
      var attentionCount = bundle[3];

      renderCounts(counts);
      renderRecent(recent);
      renderInventory(attention, attentionCount);

      loadedOnce = true;
      $("dashboardLoading").hidden = true;
      $("dashboardContent").hidden = false;
    } catch (err) {
      // Never leave zeros from a failed request looking like real data.
      if (!loadedOnce) {
        $("dashboardContent").hidden = true;
      }
      showError(
        (err && err.message) ||
          "Couldn’t load catalog summary. Check your connection and try again.",
        true
      );
    } finally {
      setLoading(false);
    }
  }

  SRAdminShell.boot({ activeNav: "dashboard" }).then(function (check) {
    if (!check) return;
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
