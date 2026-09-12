/**
 * Product create/edit editor with photo management and live preview.
 */
(function () {
  "use strict";

  var productId = null;
  var existing = null;
  var dirty = false;
  var saving = false;
  var slugTouched = false;
  var images = []; // { id?, image_url, alt_text, sort_order, is_primary, file?, localUrl?, pending? }
  var removedExisting = [];
  var categories = [];
  var badges = [];

  function $(id) {
    return document.getElementById(id);
  }

  function showFlash(msg, kind) {
    var el = $("flash");
    el.hidden = false;
    el.className = "flash is-visible flash--" + (kind || "ok");
    el.textContent = msg;
  }

  function showFormError(msg) {
    var el = $("formError");
    if (!msg) {
      el.classList.remove("is-visible");
      el.textContent = "";
      return;
    }
    el.classList.add("is-visible");
    el.textContent = msg;
  }

  function markDirty() {
    dirty = true;
  }

  function readForm() {
    var catIds = Array.prototype.map
      .call(document.querySelectorAll('input[name="category"]:checked'), function (el) {
        return el.value;
      });
    var badgeIds = Array.prototype.map
      .call(document.querySelectorAll('input[name="badge"]:checked'), function (el) {
        return el.value;
      });
    return {
      title: $("title").value,
      slug: $("slug").value,
      description: $("description").value,
      price: $("price").value,
      sale_price: $("sale_price").value,
      quantity: $("quantity").value,
      item_no: $("item_no").value,
      track_inventory: $("track_inventory").checked,
      product_type: $("product_type").value,
      status: $("status").value,
      featured: $("featured").checked,
      category_ids: catIds,
      badge_ids: badgeIds,
      imageCount: images.length,
    };
  }

  function applyPublishMessaging() {
    var live =
      window.__SR_ENV__ &&
      String(window.__SR_ENV__.USE_LIVE_CATALOG || "").toLowerCase() === "true";
    var text = $("publishBannerText");
    var hint = $("statusHint");
    if (text) {
      text.textContent = live
        ? "Published and sold-out products appear on the live storefront. Draft and hidden stay private. Visitors do not need to sign in."
        : "Publishing saves to your catalog, but the public site still uses the demo product list until USE_LIVE_CATALOG is enabled after migrations 07–08.";
    }
    if (hint) {
      hint.textContent = live
        ? "Published = visible on the live shop (sold out still shows as unavailable). Draft and hidden never appear publicly."
        : "Publish marks the product ready in your catalog. The live shop cutover flag is still off, so visitors see demo products.";
    }
  }

  function syncInventoryUi() {
    var tracked = $("track_inventory").checked;
    $("quantity").disabled = !tracked;
    var qh = $("quantityHint");
    if (qh) {
      qh.textContent = tracked
        ? "Stock is enforced in the shop UI when tracking is on. Browser checks are not a warehouse reservation."
        : "Inventory not tracked — quantity is ignored for purchases. Turn tracking on only when you manage stock.";
    }
  }

  function updatePreview() {
    var data = readForm();
    var title = String(data.title || "").trim() || "Product title";
    var desc = String(data.description || "").trim() || "Short description appears here.";
    $("previewTitle").textContent = title;
    $("previewDesc").textContent = desc.length > 140 ? desc.slice(0, 137) + "…" : desc;

    var price = Number(data.price);
    var sale = data.sale_price === "" ? null : Number(data.sale_price);
    var hasSale = sale != null && isFinite(sale) && isFinite(price) && sale < price;
    $("previewPrice").textContent = SRCatalog.money(hasSale ? sale : isFinite(price) ? price : 0);
    if (hasSale) {
      $("previewWas").hidden = false;
      $("previewWas").textContent = SRCatalog.money(price);
    } else {
      $("previewWas").hidden = true;
    }

    var primary =
      images.find(function (img) {
        return img.is_primary;
      }) || images[0];
    if (primary && (primary.localUrl || primary.image_url)) {
      $("previewImg").hidden = false;
      $("previewPlaceholder").hidden = true;
      $("previewImg").src = primary.localUrl || primary.image_url;
      $("previewImg").alt = primary.alt_text || title;
    } else {
      $("previewImg").hidden = true;
      $("previewPlaceholder").hidden = false;
      $("previewImg").removeAttribute("src");
    }

    var selectedBadges = badges.filter(function (b) {
      return data.badge_ids.indexOf(b.id) !== -1;
    });
    var badge = selectedBadges[0];
    if (badge) {
      $("previewBadge").hidden = false;
      $("previewBadge").textContent = badge.label || badge.name;
      $("previewBadge").classList.toggle(
        "store-card-tag--soft",
        /new|handmade|one/i.test(badge.slug || "")
      );
    } else if (data.featured) {
      $("previewBadge").hidden = false;
      $("previewBadge").textContent = "Featured";
      $("previewBadge").classList.remove("store-card-tag--soft");
    } else {
      $("previewBadge").hidden = true;
    }

    $("previewSold").hidden = data.status !== "sold_out";
    $("livePreview").classList.toggle("is-sold-out", data.status === "sold_out");
  }

  function renderChecks() {
    $("categoryChecks").innerHTML = categories.length
      ? categories
          .map(function (c) {
            return (
              '<label class="check-item"><input type="checkbox" name="category" value="' +
              SRCatalog.escapeHtml(c.id) +
              '" /> ' +
              SRCatalog.escapeHtml(c.name) +
              (c.active ? "" : ' <span class="muted">(inactive)</span>') +
              "</label>"
            );
          })
          .join("")
      : '<p class="muted">No categories yet. Create some on the Categories page.</p>';

    $("badgeChecks").innerHTML = badges.length
      ? badges
          .map(function (b) {
            return (
              '<label class="check-item"><input type="checkbox" name="badge" value="' +
              SRCatalog.escapeHtml(b.id) +
              '"' +
              (b.active ? "" : " disabled") +
              " /> " +
              SRCatalog.escapeHtml(b.label || b.name) +
              "</label>"
            );
          })
          .join("")
      : '<p class="muted">No badges found. Run the badge seed migration in Supabase.</p>';
  }

  function renderPhotos() {
    var list = $("photoList");
    if (!images.length) {
      list.innerHTML = '<p class="muted">No photos yet.</p>';
      updatePreview();
      return;
    }
    list.innerHTML = images
      .map(function (img, index) {
        var src = img.localUrl || img.image_url || "";
        return (
          '<div class="photo-item' +
          (img.is_primary ? " is-primary" : "") +
          '" data-index="' +
          index +
          '">' +
          '<div class="photo-thumb"><img src="' +
          SRCatalog.escapeHtml(src) +
          '" alt="" /></div>' +
          '<div class="photo-meta">' +
          '<label>Alt text<input type="text" data-alt="' +
          index +
          '" value="' +
          SRCatalog.escapeHtml(img.alt_text || "") +
          '" /></label>' +
          '<div class="photo-actions">' +
          '<button type="button" class="btn btn-ghost btn-small" data-primary="' +
          index +
          '">' +
          (img.is_primary ? "Main photo" : "Make main") +
          "</button>" +
          '<button type="button" class="btn btn-ghost btn-small" data-up="' +
          index +
          '"' +
          (index === 0 ? " disabled" : "") +
          ">Up</button>" +
          '<button type="button" class="btn btn-ghost btn-small" data-down="' +
          index +
          '"' +
          (index === images.length - 1 ? " disabled" : "") +
          ">Down</button>" +
          '<button type="button" class="btn btn-ghost btn-small btn-danger-text" data-remove="' +
          index +
          '">Remove</button>' +
          "</div></div></div>"
        );
      })
      .join("");

    list.querySelectorAll("[data-alt]").forEach(function (input) {
      input.addEventListener("input", function () {
        var i = Number(input.getAttribute("data-alt"));
        images[i].alt_text = input.value;
        markDirty();
        updatePreview();
      });
    });
    list.querySelectorAll("[data-primary]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = Number(btn.getAttribute("data-primary"));
        images.forEach(function (img, idx) {
          img.is_primary = idx === i;
        });
        markDirty();
        renderPhotos();
      });
    });
    list.querySelectorAll("[data-up]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = Number(btn.getAttribute("data-up"));
        if (i <= 0) return;
        var tmp = images[i - 1];
        images[i - 1] = images[i];
        images[i] = tmp;
        reindexSort();
        markDirty();
        renderPhotos();
      });
    });
    list.querySelectorAll("[data-down]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = Number(btn.getAttribute("data-down"));
        if (i >= images.length - 1) return;
        var tmp = images[i + 1];
        images[i + 1] = images[i];
        images[i] = tmp;
        reindexSort();
        markDirty();
        renderPhotos();
      });
    });
    list.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = Number(btn.getAttribute("data-remove"));
        var img = images[i];
        if (img.id) removedExisting.push(img);
        if (img.localUrl) URL.revokeObjectURL(img.localUrl);
        images.splice(i, 1);
        if (images.length && !images.some(function (x) { return x.is_primary; })) {
          images[0].is_primary = true;
        }
        reindexSort();
        markDirty();
        renderPhotos();
      });
    });
    updatePreview();
  }

  function reindexSort() {
    images.forEach(function (img, idx) {
      img.sort_order = idx;
    });
  }

  async function onFilesSelected(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var status = $("uploadStatus");
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var err = SRCatalog.validateImageFile(file);
      if (err) {
        status.textContent = err;
        continue;
      }
      status.textContent = "Ready: " + file.name;
      images.push({
        file: file,
        localUrl: URL.createObjectURL(file),
        image_url: "",
        alt_text: "",
        sort_order: images.length,
        is_primary: images.length === 0,
        pending: true,
      });
      markDirty();
    }
    $("photoInput").value = "";
    renderPhotos();
    status.textContent = images.some(function (img) { return img.pending; })
      ? "New photos will upload when you save."
      : "";
  }

  function fillForm(product) {
    $("title").value = product.title || "";
    $("slug").value = product.slug || "";
    $("description").value = product.description || "";
    $("price").value = product.price != null ? product.price : "";
    $("sale_price").value = product.sale_price != null ? product.sale_price : "";
    $("quantity").value = product.quantity != null ? product.quantity : 0;
    $("item_no").value = product.item_no || "";
    $("track_inventory").checked = !!product.track_inventory;
    $("product_type").value = product.product_type || "single";
    $("status").value = product.status || "draft";
    $("featured").checked = !!product.featured;
    syncInventoryUi();
    slugTouched = true;

    var catIds = (product.categories || []).map(function (c) { return c.id; });
    document.querySelectorAll('input[name="category"]').forEach(function (el) {
      el.checked = catIds.indexOf(el.value) !== -1;
    });
    var badgeIds = (product.badges || []).map(function (b) { return b.id; });
    document.querySelectorAll('input[name="badge"]').forEach(function (el) {
      el.checked = badgeIds.indexOf(el.value) !== -1;
    });

    images = (product.images || []).map(function (img, idx) {
      return {
        id: img.id,
        image_url: img.image_url,
        alt_text: img.alt_text || "",
        sort_order: img.sort_order != null ? img.sort_order : idx,
        is_primary: !!img.is_primary,
      };
    });
    if (images.length && !images.some(function (x) { return x.is_primary; })) {
      images[0].is_primary = true;
    }
    renderPhotos();
    dirty = false;
  }

  async function saveWithIntent(intent) {
    if (saving) return;
    showFormError("");
    var raw = readForm();
    if (intent === "draft") raw.status = "draft";
    if (intent === "publish") raw.status = "published";
    if (intent === "hide") raw.status = "hidden";
    if (intent === "sold_out") raw.status = "sold_out";
    $("status").value = raw.status;

    var validated = SRCatalog.validateProductInput(raw, {
      publishing: raw.status === "published",
    });
    if (!validated.ok) {
      showFormError(validated.errors.join(" "));
      return;
    }

    saving = true;
    setBusy(true);
    var fields = validated.value;
    var warnings = [];

    try {
          var wasNew = !productId;
          var product;
          if (!productId) {
            product = await SRCatalog.createProduct(fields);
            productId = product.id;
            existing = product;
            history.replaceState({}, "", "/admin/product-edit.html?id=" + encodeURIComponent(productId));
            $("pageTitle").textContent = "Edit Product";
            $("crumbLabel").textContent = "Edit";
          } else {
            product = await SRCatalog.updateProduct(productId, fields, existing || {});
            existing = product;
          }

      // Upload pending files now that we have a product id
      for (var i = 0; i < images.length; i++) {
        var img = images[i];
        if (!img.file) continue;
        $("uploadStatus").textContent = "Uploading " + (img.file.name || "photo") + "…";
        try {
          var uploaded = await SRCatalog.uploadProductImage(productId, img.file);
          img.image_url = uploaded.image_url;
          img.pending = false;
          img.file = null;
          if (img.localUrl) {
            URL.revokeObjectURL(img.localUrl);
            img.localUrl = null;
          }
        } catch (upErr) {
          throw new Error(
            "Product details saved, but a photo failed to upload: " +
              (upErr.message || "Please retry save.")
          );
        }
      }
      $("uploadStatus").textContent = "";

      reindexSort();
      if (images.length && !images.some(function (x) { return x.is_primary; })) {
        images[0].is_primary = true;
      }

      var syncImg = await SRCatalog.syncProductImages(productId, images, removedExisting);
      warnings = warnings.concat(syncImg.warnings || []);
      removedExisting = [];

      await SRCatalog.syncProductCategories(productId, fields.category_ids);
      await SRCatalog.syncProductBadges(productId, fields.badge_ids);

      // Reload canonical state
      existing = await SRCatalog.getProduct(productId);
      fillForm(existing);
      dirty = false;

      if (warnings.length) {
        showFlash("Saved with warnings: " + warnings.join(" "), "err");
      } else {
        window.location.href =
          "/admin/products.html?" + (wasNew ? "created=1" : "saved=1");
        return;
      }
    } catch (err) {
      showFormError(err.message || "Couldn’t save. Your entries are still here — try again.");
      // Keep form values; if product was created, keep id for retry
    } finally {
      saving = false;
      setBusy(false);
      renderPhotos();
    }
  }

  function setBusy(isBusy) {
    ["saveBtn", "saveDraftBtn", "publishBtn", "hideBtn", "soldOutBtn"].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = isBusy;
    });
    if (isBusy) $("saveBtn").textContent = "Saving…";
    else $("saveBtn").textContent = "Save";
  }

  function bindForm() {
    ["title", "description", "price", "sale_price", "quantity", "item_no", "product_type", "status"].forEach(
      function (id) {
        $(id).addEventListener("input", function () {
          markDirty();
          if (id === "title" && !productId && !slugTouched) {
            $("slug").value = SRCatalog.slugify($("title").value);
          }
          updatePreview();
        });
        $(id).addEventListener("change", function () {
          markDirty();
          updatePreview();
        });
      }
    );
    $("slug").addEventListener("input", function () {
      slugTouched = true;
      markDirty();
    });
    $("track_inventory").addEventListener("change", function () {
      markDirty();
      syncInventoryUi();
      updatePreview();
    });
    $("featured").addEventListener("change", function () {
      markDirty();
      updatePreview();
    });
    $("categoryChecks").addEventListener("change", function () {
      markDirty();
      updatePreview();
    });
    $("badgeChecks").addEventListener("change", function () {
      markDirty();
      updatePreview();
    });
    $("photoInput").addEventListener("change", function (e) {
      onFilesSelected(e.target.files);
    });

    $("productForm").addEventListener("submit", function (e) {
      e.preventDefault();
      saveWithIntent("save");
    });
    $("saveDraftBtn").addEventListener("click", function () {
      saveWithIntent("draft");
    });
    $("publishBtn").addEventListener("click", function () {
      saveWithIntent("publish");
    });
    $("hideBtn").addEventListener("click", function () {
      saveWithIntent("hide");
    });
    $("soldOutBtn").addEventListener("click", function () {
      saveWithIntent("sold_out");
    });

    window.addEventListener("beforeunload", function (e) {
      if (!dirty || saving) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  SRAdminShell.boot({ activeNav: "products" }).then(async function (check) {
    if (!check) return;
    applyPublishMessaging();
    bindForm();
    syncInventoryUi();
    try {
      var loaded = await Promise.all([
        SRCatalog.listCategories(true),
        SRCatalog.listBadges(true),
      ]);
      categories = loaded[0];
      badges = loaded[1].filter(function (b) {
        return b.active;
      });
      // Keep inactive badge assignments visible by including assigned later
      renderChecks();

      var params = new URLSearchParams(window.location.search);
      var id = params.get("id");
      if (id) {
        productId = id;
        $("pageTitle").textContent = "Edit Product";
        $("crumbLabel").textContent = "Edit";
        existing = await SRCatalog.getProduct(id);
        // Ensure inactive badges already on the product remain checkable
        var assignedInactive = (existing.badges || []).filter(function (b) {
          return !b.active;
        });
        badges = badges.concat(assignedInactive);
        renderChecks();
        fillForm(existing);
      } else {
        updatePreview();
      }
    } catch (err) {
      showFormError(err.message || "Couldn’t load the editor.");
    }
  });
})();
