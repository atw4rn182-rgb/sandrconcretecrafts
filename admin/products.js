/**
 * Admin products list page.
 */
(function () {
  "use strict";

  var allProducts = [];
  var categories = [];

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
    return SRCatalog.money(p.price);
  }

  function filtered() {
    var q = (document.getElementById("searchInput").value || "").trim().toLowerCase();
    var status = document.getElementById("statusFilter").value;
    var cat = document.getElementById("categoryFilter").value;
    return allProducts.filter(function (p) {
      if (status && p.status !== status) return false;
      if (q && String(p.title || "").toLowerCase().indexOf(q) === -1) return false;
      if (cat) {
        var hit = (p.categories || []).some(function (c) {
          return c.id === cat;
        });
        if (!hit) return false;
      }
      return true;
    });
  }

  function renderList() {
    var state = document.getElementById("listState");
    var wrap = document.getElementById("productList");
    var rows = filtered();

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
    wrap.innerHTML =
      '<table class="product-table"><thead><tr>' +
      "<th>Product</th><th>Price</th><th>Qty</th><th>Status</th><th>Categories</th><th></th>" +
      "</tr></thead><tbody>" +
      rows
        .map(function (p) {
          var img = p.primary
            ? '<img src="' +
              SRCatalog.escapeHtml(p.primary.image_url) +
              '" alt="" />'
            : '<div class="thumb-empty">No photo</div>';
          var cats = (p.categories || [])
            .map(function (c) {
              return SRCatalog.escapeHtml(c.name);
            })
            .join(", ");
          return (
            "<tr>" +
            '<td class="cell-product"><div class="prod-cell">' +
            '<div class="prod-thumb">' +
            img +
            "</div><div>" +
            "<strong>" +
            SRCatalog.escapeHtml(p.title) +
            "</strong>" +
            '<div class="muted">' +
            SRCatalog.escapeHtml(p.slug) +
            "</div></div></div></td>" +
            "<td>" +
            priceHtml(p) +
            "</td>" +
            "<td>" +
            SRCatalog.escapeHtml(String(p.quantity)) +
            "</td>" +
            '<td><span class="status-pill status-' +
            SRCatalog.escapeHtml(p.status) +
            '">' +
            statusLabel(p.status) +
            "</span></td>" +
            '<td class="cell-cats">' +
            (cats || "—") +
            "</td>" +
            '<td class="cell-actions">' +
            '<a class="btn btn-ghost btn-small" href="/admin/product-edit.html?id=' +
            encodeURIComponent(p.id) +
            '">Edit</a> ' +
            '<button type="button" class="btn btn-ghost btn-small btn-danger-text" data-delete="' +
            SRCatalog.escapeHtml(p.id) +
            '" data-title="' +
            SRCatalog.escapeHtml(p.title) +
            '">Delete</button>' +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";

    wrap.querySelectorAll("[data-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        onDelete(btn.getAttribute("data-delete"), btn.getAttribute("data-title"));
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
      ? "Published and sold-out products show on the live storefront. Draft and hidden stay private. Publish edits appear after visitors refresh."
      : "Saving here updates your catalog only. The public site still shows demo products until USE_LIVE_CATALOG is turned on after migrations 07–08.";
  }

  SRAdminShell.boot({ activeNav: "products" }).then(function (check) {
    if (!check) return;
    applyPublishMessaging();
    var params = new URLSearchParams(window.location.search);
    if (params.get("saved") === "1") showFlash("Product saved.", "ok");
    if (params.get("created") === "1") showFlash("Product created.", "ok");
    ["searchInput", "statusFilter", "categoryFilter"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", renderList);
      document.getElementById(id).addEventListener("change", renderList);
    });
    load();
  });
})();
