/**
 * Admin products list — mobile cards + status chips.
 * Loads 50 products at a time from Supabase. Search and filters run in the query.
 */
(function () {
  "use strict";

  var PAGE = (window.SRCatalog && SRCatalog.PRODUCT_PAGE_SIZE) || 50;
  var loadedProducts = [];
  var categories = [];
  var actionProductId = null;
  var requestGen = 0;
  var loadingPage = false;
  var hasMore = false;
  var nextOffset = 0;
  var matchTotal = 0;
  var searchTimer = null;
  var moreObserver = null;
  var statusCounts = {
    all: 0,
    published: 0,
    draft: 0,
    sold_out: 0,
    hidden: 0,
  };

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
    return '<span class="product-card-cats">' + SRCatalog.escapeHtml(shown) + "</span>";
  }

  function countByStatus(status) {
    if (!status) return statusCounts.all || 0;
    return statusCounts[status] || 0;
  }

  function currentFilters() {
    var sortEl = document.getElementById("sortFilter");
    return {
      search: (document.getElementById("searchInput").value || "").trim(),
      status: document.getElementById("statusFilter").value || "",
      categoryId: document.getElementById("categoryFilter").value || "",
      sort: (sortEl && sortEl.value) || "newest",
    };
  }

  function filtersAreActive(filters) {
    return !!(filters.search || filters.status || filters.categoryId);
  }

  function findLoaded(id) {
    return (
      loadedProducts.find(function (product) {
        return product.id === id;
      }) || null
    );
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

  function ensureMore() {
    var el = document.getElementById("productListMore");
    if (el) return el;
    el = document.createElement("p");
    el.id = "productListMore";
    el.className = "list-more";
    el.setAttribute("aria-live", "polite");
    document.getElementById("productList").insertAdjacentElement("afterend", el);
    return el;
  }

  function maybeFill() {
    if (loadingPage || !hasMore) return;
    var el = document.getElementById("productListMore");
    if (!el || !("IntersectionObserver" in window)) return;
    var rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 600) loadMore();
  }

  function updateMoreLabel(message) {
    var el = ensureMore();
    if (!("IntersectionObserver" in window)) return;
    if (typeof message === "string") {
      el.textContent = message;
      return;
    }
    el.textContent = loadingPage && hasMore ? "Loading more products…" : "";
  }

  function thumbHtml(product, eager) {
    var url = product.primary && product.primary.image_url;
    if (!url) return '<div class="thumb-empty">No photo</div>';
    if (window.SRImageDisplay) {
      return SRImageDisplay.imgTag(url, {
        preset: "adminThumb",
        alt: "",
        eager: !!eager,
        width: 76,
        height: 76,
      });
    }
    return (
      '<img src="' +
      SRCatalog.escapeHtml(url) +
      '" alt="" width="76" height="76" loading="' +
      (eager ? "eager" : "lazy") +
      '" decoding="async" />'
    );
  }

  function cardMarkup(product, eager) {
    return (
      '<article class="product-card" data-product-id="' +
      SRCatalog.escapeHtml(product.id) +
      '">' +
      '<a class="product-card-media" href="/admin/product-edit.html?id=' +
      encodeURIComponent(product.id) +
      '">' +
      thumbHtml(product, eager) +
      "</a>" +
      '<div class="product-card-body">' +
      '<a class="product-card-title" href="/admin/product-edit.html?id=' +
      encodeURIComponent(product.id) +
      '">' +
      SRCatalog.escapeHtml(product.title) +
      "</a>" +
      '<div class="product-card-price">' +
      priceHtml(product) +
      "</div>" +
      '<div class="product-card-meta">' +
      '<span class="status-pill status-' +
      SRCatalog.escapeHtml(product.status) +
      '">' +
      statusLabel(product.status) +
      "</span>" +
      stockHtml(product) +
      "</div>" +
      categorySummaryHtml(product) +
      "</div>" +
      '<button type="button" class="product-card-menu" data-menu="' +
      SRCatalog.escapeHtml(product.id) +
      '" aria-label="Actions for ' +
      SRCatalog.escapeHtml(product.title) +
      '">⋯</button>' +
      "</article>"
    );
  }

  function bindMenus(root) {
    root.querySelectorAll("[data-menu]:not([data-bound])").forEach(function (btn) {
      btn.setAttribute("data-bound", "1");
      btn.addEventListener("click", function () {
        var product = findLoaded(btn.getAttribute("data-menu"));
        if (product) openActionSheet(product);
      });
    });
  }

  function emptyCatalogHtml() {
    return (
      '<p class="state-title">No products yet</p><p>Add your first concrete piece to get started.</p>' +
      '<p><a class="btn btn-primary" href="/admin/product-edit.html">Add Product</a></p>'
    );
  }

  function paintList() {
    var state = document.getElementById("listState");
    var wrap = document.getElementById("productList");
    renderStatusChips();
    ensureMore();
    if (!loadedProducts.length) {
      state.hidden = false;
      wrap.hidden = true;
      wrap.innerHTML = "";
      updateMoreLabel("");
      state.innerHTML = filtersAreActive(currentFilters())
        ? '<p class="state-title">No matches</p><p>Try a different search or filter.</p>'
        : emptyCatalogHtml();
      return;
    }
    state.hidden = true;
    wrap.hidden = false;
    wrap.innerHTML = loadedProducts
      .map(function (product, index) {
        return cardMarkup(product, index < 6);
      })
      .join("");
    bindMenus(wrap);
    updateMoreLabel("");
  }

  function appendCards(added) {
    var wrap = document.getElementById("productList");
    wrap.hidden = false;
    document.getElementById("listState").hidden = true;
    wrap.insertAdjacentHTML(
      "beforeend",
      added
        .map(function (product) {
          return cardMarkup(product, false);
        })
        .join("")
    );
    bindMenus(wrap);
    updateMoreLabel("");
  }

  function absorb(page) {
    var merged = SRCatalog.mergeProductPage(loadedProducts, page.products || []);
    loadedProducts = merged.products;
    nextOffset += (page.products || []).length;
    if (typeof page.total === "number") matchTotal = page.total;
    hasMore = SRCatalog.pageHasMore(
      (page.products || []).length,
      page.limit || PAGE,
      loadedProducts.length,
      matchTotal
    );
    if ((page.products || []).length && !merged.added.length) hasMore = false;
    return merged.added;
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

  function removeLoadedCard(id) {
    var removed = false;
    loadedProducts = loadedProducts.filter(function (product) {
      if (product.id !== id) return true;
      removed = true;
      return false;
    });
    if (removed && nextOffset > 0) nextOffset -= 1;
    var card = document.querySelector('[data-product-id="' + id + '"]');
    if (card) card.remove();
    if (!loadedProducts.length) paintList();
  }

  async function onAction(action) {
    var product = findLoaded(actionProductId);
    if (!product) return;
    closeActionSheet();
    if (action === "delete") {
      onDelete(product.id, product.title);
      return;
    }
    if (action === "publish" || action === "hide" || action === "sold_out") {
      try {
        var previous = product.status;
        var status = action === "hide" ? "hidden" : action;
        await SRCatalog.changeProductStatus(product, status);
        product.status = status;
        if (status === "published" && !product.published_at) {
          product.published_at = new Date().toISOString();
        }
        if (previous !== status) {
          if (statusCounts[previous]) statusCounts[previous] -= 1;
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
        var flash =
          status === "published"
            ? "Product published."
            : status === "hidden"
              ? "Product hidden from the shop."
              : "Marked sold out.";
        showFlash(flash, "ok");
        var filters = currentFilters();
        if (filters.status && filters.status !== status) {
          removeLoadedCard(product.id);
          matchTotal = Math.max(0, matchTotal - 1);
        }
        renderStatusChips();
        var card = document.querySelector('[data-product-id="' + product.id + '"]');
        if (card) card.outerHTML = cardMarkup(product, false);
        bindMenus(document.getElementById("productList"));
      } catch (err) {
        showFlash(err.message || "Couldn’t update status.", "err");
      }
    }
  }

  async function onDelete(id, title) {
    var ok = window.confirm(
      'Delete "' + title + '"? This permanently removes the product and its photos from your catalog.'
    );
    if (!ok) return;
    try {
      var product = findLoaded(id);
      await SRCatalog.deleteProduct(id, product && product.images);
      var previous = product && product.status;
      removeLoadedCard(id);
      if (previous && statusCounts[previous]) statusCounts[previous] -= 1;
      statusCounts.all = Math.max(0, (statusCounts.all || 0) - 1);
      matchTotal = Math.max(0, matchTotal - 1);
      showFlash("“" + title + "” was deleted.", "ok");
      renderStatusChips();
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
    var filters = currentFilters();
    if (filters.status) params.set("status", filters.status);
    if (filters.search) params.set("q", filters.search);
    if (filters.categoryId) params.set("category", filters.categoryId);
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    var next = params.toString();
    var url = window.location.pathname + (next ? "?" + next : "");
    window.history.replaceState({}, "", url);
  }

  function onFilterChange(event) {
    var fromSearch = event && event.target && event.target.id === "searchInput";
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      syncFiltersToUrl();
      loadFirstPage();
    }, fromSearch ? 280 : 0);
  }

  async function refreshCounts(gen, filters) {
    var base = { search: filters.search, categoryId: filters.categoryId };
    var statuses = ["", "published", "draft", "sold_out", "hidden"];
    var counts = await Promise.all(
      statuses.map(function (status) {
        var filter = { search: base.search, categoryId: base.categoryId };
        if (status) filter.status = status;
        return SRCatalog.countProducts(filter);
      })
    );
    if (gen !== requestGen) return;
    statusCounts = {
      all: counts[0],
      published: counts[1],
      draft: counts[2],
      sold_out: counts[3],
      hidden: counts[4],
    };
    renderStatusChips();
  }

  async function loadFirstPage() {
    requestGen += 1;
    var gen = requestGen;
    loadingPage = true;
    loadedProducts = [];
    nextOffset = 0;
    hasMore = false;
    matchTotal = 0;
    var state = document.getElementById("listState");
    var wrap = document.getElementById("productList");
    state.hidden = false;
    state.textContent = "Loading products…";
    wrap.hidden = true;
    wrap.innerHTML = "";
    updateMoreLabel("");
    var filters = currentFilters();
    try {
      var page = await SRCatalog.listProductsPage({
        offset: 0,
        limit: PAGE,
        search: filters.search,
        status: filters.status,
        categoryId: filters.categoryId,
        sort: filters.sort,
      });
      if (gen !== requestGen) return;
      absorb(page);
      paintList();
      await refreshCounts(gen, filters);
    } catch (err) {
      if (gen !== requestGen) return;
      state.hidden = false;
      wrap.hidden = true;
      state.innerHTML =
        '<p class="state-title">Couldn’t load products</p><p>' +
        SRCatalog.escapeHtml(err.message || "Please try again.") +
        "</p>";
    } finally {
      if (gen === requestGen) {
        loadingPage = false;
        updateMoreLabel("");
        maybeFill();
      }
    }
  }

  async function loadMore() {
    if (loadingPage || !hasMore) return;
    var gen = requestGen;
    var offset = nextOffset;
    var filters = currentFilters();
    loadingPage = true;
    updateMoreLabel();
    try {
      var page = await SRCatalog.listProductsPage({
        offset: offset,
        limit: PAGE,
        search: filters.search,
        status: filters.status,
        categoryId: filters.categoryId,
        sort: filters.sort,
      });
      if (gen !== requestGen) return;
      var added = absorb(page);
      if (added.length) appendCards(added);
      else hasMore = false;
    } catch (err) {
      if (gen !== requestGen) return;
      updateMoreLabel(err.message || "Couldn’t load more products.");
      return;
    } finally {
      if (gen === requestGen) loadingPage = false;
    }
    if (gen === requestGen) updateMoreLabel("");
    if (gen === requestGen) maybeFill();
  }

  function watchMore() {
    var el = ensureMore();
    if (!("IntersectionObserver" in window)) {
      if (document.getElementById("loadMoreBtn")) return;
      el.innerHTML =
        '<button type="button" class="btn btn-ghost" id="loadMoreBtn">Load more products</button>';
      document.getElementById("loadMoreBtn").addEventListener("click", function () {
        loadMore();
      });
      return;
    }
    if (moreObserver) return;
    moreObserver = new IntersectionObserver(
      function (entries) {
        if (
          entries.some(function (entry) {
            return entry.isIntersecting;
          })
        ) {
          loadMore();
        }
      },
      { root: null, rootMargin: "600px 0px", threshold: 0 }
    );
    moreObserver.observe(el);
  }

  async function load() {
    var state = document.getElementById("listState");
    try {
      categories = await SRCatalog.listCategories(true);
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
      watchMore();
      await loadFirstPage();
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
      : "Saving here updates your catalog only. The public shop is still on a temporary product list until the live catalog is turned on.";
  }

  if (window.SRImageDisplay) SRImageDisplay.installFallback(document);

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
