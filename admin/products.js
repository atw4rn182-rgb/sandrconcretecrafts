/**
 * Admin products list — mobile cards + status chips.
 */
(function () {
  "use strict";

  var allProducts = [];
  var categories = [];
  var actionProductId = null;

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

  function showFlash(message, kind) {
    var el = document.getElementById("flash");
    if (!el) return;
    el.hidden = false;
    el.className = "flash is-visible flash--" + (kind || "ok");
    el.textContent = message;
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
    return '<span class="price-sale">' + SRCatalog.money(p.price) + "</span>";
  }

  function stockHtml(p) {
    if (!p.track_inventory) return '<span class="stock-pill stock-untracked">Stock not tracked</span>';
    var q = Number(p.quantity) || 0;
    if (q <= 0) return '<span class="stock-pill stock-zero">Qty 0</span>';
    return '<span class="stock-pill">Qty ' + SRCatalog.escapeHtml(String(q)) + "</span>";
  }

  function categorySummaryHtml(p) {
    var names = (p.categories || [])
      .map(function (c) {
        return c && c.name ? String(c.name) : "";
      })
      .filter(Boolean);
    if (!names.length) {
      return '<span class="product-card-cats muted">No category</span>';
    }
    var shown = names.slice(0, 2).join(", ");
    if (names.length > 2) shown += " +" + (names.length - 2);
    return (
      '<span class="product-card-cats">' + SRCatalog.escapeHtml(shown) + "</span>"
    );
  }

  function countByStatus(status) {
    if (!status) return allProducts.length;
    return allProducts.filter(function (p) {
      return p.status === status;
    }).length;
  }

  function renderStatusChips() {
    var wrap = document.getElementById("statusChips");
    if (!wrap) return;
    var current = document.getElementById("statusFilter").value;
    var chips = [
      { value: "", label: "All", count: countByStatus("") },
      { value: "published", label: "Published", count: countByStatus("published") },
      { value: "draft", label: "Drafts", count: countByStatus("draft") },
      { value: "sold_out", label: "Sold Out", count: countByStatus("sold_out") },
      { value: "hidden", label: "Hidden", count: countByStatus("hidden") },
    ];
    wrap.innerHTML = chips
      .map(function (c) {
        var active = current === c.value;
        return (
          '<button type="button" class="filter-chip' +
          (active ? " is-active" : "") +
          '" data-status="' +
          SRCatalog.escapeHtml(c.value) +
          '" aria-pressed="' +
          (active ? "true" : "false") +
          '">' +
          SRCatalog.escapeHtml(c.label) +
          " (" +
          c.count +
          ")</button>"
        );
      })
      .join("");
    wrap.querySelectorAll("[data-status]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.getElementById("statusFilter").value = btn.getAttribute("data-status") || "";
        onFilterChange();
      });
    });
  }

  function filtered() {
    var q = (document.getElementById("searchInput").value || "").trim().toLowerCase();
    var status = document.getElementById("statusFilter").value;
    var cat = document.getElementById("categoryFilter").value;
    var sortEl = document.getElementById("sortFilter");
    var sort = (sortEl && sortEl.value) || "newest";
    var rows = allProducts.filter(function (p) {
      if (status && p.status !== status) return false;
      if (q && String(p.title || "").toLowerCase().indexOf(q) === -1) return false;
      if (cat) {
        var hit = (p.categories || []).some(function (c) {
          return c && c.id === cat;
        });
        if (!hit) return false;
      }
      return true;
    });
    rows.sort(function (a, b) {
      var aTime = Date.parse(a.updated_at || a.created_at || 0) || 0;
      var bTime = Date.parse(b.updated_at || b.created_at || 0) || 0;
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });
    return rows;
  }

  function closeActionSheet() {
    var sheet = document.getElementById("productActionSheet");
    var backdrop = document.getElementById("actionSheetBackdrop");
    if (sheet) sheet.hidden = true;
    if (backdrop) backdrop.hidden = true;
    actionProductId = null;
    document.body.classList.remove("action-sheet-open");
  }

  function openActionSheet(product) {
    actionProductId = product.id;
    var sheet = document.getElementById("productActionSheet");
    var backdrop = document.getElementById("actionSheetBackdrop");
    var list = document.getElementById("actionSheetList");
    document.getElementById("actionSheetSub").textContent = product.title || "Product";
    list.innerHTML =
      '<a class="action-sheet-btn" href="/admin/product-edit.html?id=' +
      encodeURIComponent(product.id) +
      '">Edit</a>' +
      '<button type="button" class="action-sheet-btn" data-action="publish">Publish</button>' +
      '<button type="button" class="action-sheet-btn" data-action="hide">Hide</button>' +
      '<button type="button" class="action-sheet-btn" data-action="sold_out">Mark Sold Out</button>' +
      '<button type="button" class="action-sheet-btn action-sheet-btn--danger" data-action="delete">Delete</button>';
    list.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        onAction(btn.getAttribute("data-action"));
      });
    });
    sheet.hidden = false;
    if (backdrop) backdrop.hidden = false;
    document.body.classList.add("action-sheet-open");
  }

  async function onAction(action) {
    var product = allProducts.find(function (p) {
      return p.id === actionProductId;
    });
    if (!product) return;
    closeActionSheet();
    if (action === "delete") {
      onDelete(product.id, product.title);
      return;
    }
    if (action === "publish" || action === "hide" || action === "sold_out") {
      try {
        var status = action === "hide" ? "hidden" : action;
        await SRCatalog.changeProductStatus(product, status);
        product.status = status;
        if (status === "published" && !product.published_at) {
          product.published_at = new Date().toISOString();
        }
        var flash =
          status === "published"
            ? "Product published."
            : status === "hidden"
              ? "Product hidden from the shop."
              : "Marked sold out.";
        showFlash(flash, "ok");
        renderStatusChips();
        renderList();
      } catch (err) {
        showFlash(err.message || "Couldn’t update status.", "err");
      }
    }
  }

  function renderList() {
    var state = document.getElementById("listState");
    var wrap = document.getElementById("productList");
    var rows = filtered();
    renderStatusChips();

    if (!allProducts.length) {
      state.hidden = false;
      wrap.hidden = true;
      state.innerHTML =
        '<p class="state-title">No products yet</p><p>Add your first concrete piece to get started.</p>' +
        '<p><a class="btn btn-primary" href="/admin/product-edit.html">Add Product</a></p>';
      return;
    }

    if (!rows.length) {
      state.hidden = false;
      wrap.hidden = true;
      state.innerHTML =
        '<p class="state-title">No matches</p><p>Try a different search or filter.</p>';
      return;
    }

    state.hidden = true;
    wrap.hidden = false;
    wrap.innerHTML = rows
      .map(function (p) {
        var img = p.primary
          ? '<img src="' +
            SRCatalog.escapeHtml(p.primary.image_url) +
            '" alt="" />'
          : '<div class="thumb-empty">No photo</div>';
        return (
          '<article class="product-card">' +
          '<a class="product-card-media" href="/admin/product-edit.html?id=' +
          encodeURIComponent(p.id) +
          '">' +
          img +
          "</a>" +
          '<div class="product-card-body">' +
          '<a class="product-card-title" href="/admin/product-edit.html?id=' +
          encodeURIComponent(p.id) +
          '">' +
          SRCatalog.escapeHtml(p.title) +
          "</a>" +
          '<div class="product-card-price">' +
          priceHtml(p) +
          "</div>" +
          '<div class="product-card-meta">' +
          '<span class="status-pill status-' +
          SRCatalog.escapeHtml(p.status) +
          '">' +
          statusLabel(p.status) +
          "</span>" +
          stockHtml(p) +
          "</div>" +
          categorySummaryHtml(p) +
          "</div>" +
          '<button type="button" class="product-card-menu" data-menu="' +
          SRCatalog.escapeHtml(p.id) +
          '" aria-label="Actions for ' +
          SRCatalog.escapeHtml(p.title) +
          '">⋯</button>' +
          "</article>"
        );
      })
      .join("");

    wrap.querySelectorAll("[data-menu]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-menu");
        var product = allProducts.find(function (p) {
          return p.id === id;
        });
        if (product) openActionSheet(product);
      });
    });
  }

  async function onDelete(id, title) {
    var ok = window.confirm(
      'Delete "' + title + '"? This permanently removes the product and its photos from your catalog.'
    );
    if (!ok) return;
    try {
      var product = allProducts.find(function (p) {
        return p.id === id;
      });
      await SRCatalog.deleteProduct(id, product && product.images);
      allProducts = allProducts.filter(function (p) {
        return p.id !== id;
      });
      showFlash("“" + title + "” was deleted.", "ok");
      renderList();
    } catch (err) {
      showFlash(err.message || "Couldn’t delete that product.", "err");
    }
  }

  function applyFiltersFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var statusRaw = params.get("status");
    var status = SRCatalog.normalizeProductStatusFilter(statusRaw);
    var search = params.get("q") || params.get("search") || "";
    var category = params.get("category") || params.get("category_id") || "";
    var sort = params.get("sort") === "oldest" ? "oldest" : "newest";

    if (statusRaw != null && statusRaw !== "" && status === null) {
      showFlash("That status filter isn’t valid. Showing all products.", "err");
      status = "";
    }

    document.getElementById("statusFilter").value = status || "";
    document.getElementById("searchInput").value = search;
    if (category) {
      document.getElementById("categoryFilter").value = category;
    }
    var sortEl = document.getElementById("sortFilter");
    if (sortEl) sortEl.value = sort;
  }

  function syncFiltersToUrl() {
    var params = new URLSearchParams();
    var status = document.getElementById("statusFilter").value;
    var search = (document.getElementById("searchInput").value || "").trim();
    var category = document.getElementById("categoryFilter").value;
    var sortEl = document.getElementById("sortFilter");
    var sort = (sortEl && sortEl.value) || "newest";
    if (status) params.set("status", status);
    if (search) params.set("q", search);
    if (category) params.set("category", category);
    if (sort && sort !== "newest") params.set("sort", sort);
    var next = params.toString();
    var url = window.location.pathname + (next ? "?" + next : "");
    window.history.replaceState({}, "", url);
  }

  function onFilterChange() {
    syncFiltersToUrl();
    renderList();
  }

  async function load() {
    var state = document.getElementById("listState");
    try {
      var results = await Promise.all([
        SRCatalog.listProducts(),
        SRCatalog.listCategories(true),
      ]);
      allProducts = results[0];
      categories = results[1];
      var sel = document.getElementById("categoryFilter");
      sel.innerHTML =
        '<option value="">All categories</option>' +
        categories
          .map(function (c) {
            return (
              '<option value="' +
              SRCatalog.escapeHtml(c.id) +
              '">' +
              SRCatalog.escapeHtml(c.name) +
              (c.active ? "" : " (inactive)") +
              "</option>"
            );
          })
          .join("");
      applyFiltersFromUrl();
      var catVal = document.getElementById("categoryFilter").value;
      var catParam =
        new URLSearchParams(window.location.search).get("category") ||
        new URLSearchParams(window.location.search).get("category_id");
      if (catParam && !catVal) {
        showFlash("That category filter isn’t available. Showing all categories.", "err");
        syncFiltersToUrl();
      }
      renderList();
    } catch (err) {
      state.hidden = false;
      document.getElementById("productList").hidden = true;
      state.innerHTML =
        '<p class="state-title">Couldn’t load products</p><p>' +
        SRCatalog.escapeHtml(err.message || "Please try again.") +
        "</p>";
    }
  }

  function applyPublishMessaging() {
    var live =
      window.__SR_ENV__ &&
      String(window.__SR_ENV__.USE_LIVE_CATALOG || "").toLowerCase() === "true";
    var text = document.getElementById("publishBannerText");
    if (!text) return;
    text.textContent = live
      ? "Published and sold-out products show on the live storefront. Draft and hidden stay private."
      : "Saving here updates your catalog only. The public site still shows demo products until USE_LIVE_CATALOG is turned on after migrations 07–08.";
  }

  SRAdminShell.boot({ activeNav: "products" }).then(function (check) {
    if (!check) return;
    applyPublishMessaging();
    var params = new URLSearchParams(window.location.search);
    if (params.get("saved") === "1") showFlash("Product saved.", "ok");
    if (params.get("created") === "1") showFlash("Product created.", "ok");
    if (params.get("published") === "1") showFlash("Product published.", "ok");
    ["searchInput", "statusFilter", "categoryFilter", "sortFilter"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", onFilterChange);
      el.addEventListener("change", onFilterChange);
    });
    var close = document.getElementById("actionSheetClose");
    var backdrop = document.getElementById("actionSheetBackdrop");
    if (close) close.addEventListener("click", closeActionSheet);
    if (backdrop) backdrop.addEventListener("click", closeActionSheet);
    load();
  });
})();
