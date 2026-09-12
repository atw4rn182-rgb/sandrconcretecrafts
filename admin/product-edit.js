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
  var creatingCategory = false;
  var pendingDuplicateCategory = null;

  function $(id) {
    return document.getElementById(id);
  }

  function selectedCategoryIds() {
    return Array.prototype.map.call(
      document.querySelectorAll('input[name="category"]:checked'),
      function (el) {
        return el.value;
      }
    );
  }

  function selectedBadgeIds() {
    return Array.prototype.map.call(
      document.querySelectorAll('input[name="badge"]:checked'),
      function (el) {
        return el.value;
      }
    );
  }

  function normalizeCategoryName(name) {
    return String(name || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function findEquivalentCategory(name) {
    var needle = normalizeCategoryName(name);
    if (!needle) return null;
    for (var i = 0; i < categories.length; i++) {
      if (normalizeCategoryName(categories[i].name) === needle) {
        return categories[i];
      }
    }
    return null;
  }

  function sortCategoriesInPlace() {
    categories.sort(function (a, b) {
      var so = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
      if (so) return so;
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      });
    });
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
      category_ids: selectedCategoryIds(),
      badge_ids: selectedBadgeIds(),
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

  function renderCategoryChecks(selectedIds) {
    var selected = selectedIds || selectedCategoryIds();
    var wrap = $("categoryChecks");
    if (!categories.length) {
      wrap.innerHTML =
        '<p class="muted">No categories yet. Use Add Category below to create one.</p>';
      return;
    }
    wrap.innerHTML = categories
      .map(function (c) {
        var checked = selected.indexOf(c.id) !== -1 ? " checked" : "";
        return (
          '<label class="check-item"><input type="checkbox" name="category" value="' +
          SRCatalog.escapeHtml(c.id) +
          '"' +
          checked +
          " /> " +
          SRCatalog.escapeHtml(c.name) +
          (c.active ? "" : ' <span class="muted">(inactive)</span>') +
          "</label>"
        );
      })
      .join("");
  }

  function renderBadgeChecks(selectedIds) {
    var selected = selectedIds || selectedBadgeIds();
    var wrap = $("badgeChecks");
    if (!badges.length) {
      wrap.innerHTML =
        '<p class="muted">No badges found. Run the badge seed migration in Supabase.</p>';
      return;
    }
    wrap.innerHTML = badges
      .map(function (b) {
        var checked = selected.indexOf(b.id) !== -1 ? " checked" : "";
        return (
          '<label class="check-item"><input type="checkbox" name="badge" value="' +
          SRCatalog.escapeHtml(b.id) +
          '"' +
          (b.active ? "" : " disabled") +
          checked +
          " /> " +
          SRCatalog.escapeHtml(b.label || b.name) +
          "</label>"
        );
      })
      .join("");
  }

  function renderChecks(opts) {
    opts = opts || {};
    var catIds =
      opts.categoryIds != null
        ? opts.categoryIds
        : opts.preserve
          ? selectedCategoryIds()
          : [];
    var badgeIds =
      opts.badgeIds != null
        ? opts.badgeIds
        : opts.preserve
          ? selectedBadgeIds()
          : [];
    renderCategoryChecks(catIds);
    renderBadgeChecks(badgeIds);
  }

  function showInlineCategoryError(msg) {
    var el = $("addCategoryInlineError");
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function clearDuplicateOffer() {
    pendingDuplicateCategory = null;
    var offer = $("addCategoryDupOffer");
    offer.hidden = true;
    $("addCategoryDupText").textContent = "";
  }

  function showDuplicateOffer(existing) {
    pendingDuplicateCategory = existing;
    clearCreateBusy();
    showInlineCategoryError("");
    var offer = $("addCategoryDupOffer");
    offer.hidden = false;
    var statusNote = existing.active
      ? ""
      : " It is currently inactive and will stay inactive — only selected for this product.";
    $("addCategoryDupText").textContent =
      'A category named "' +
      existing.name +
      '" already exists.' +
      statusNote +
      " Select it instead of creating a duplicate.";
    $("addCategorySelectExisting").focus();
  }

  function clearCreateBusy() {
    creatingCategory = false;
    $("addCategoryCreateBtn").disabled = false;
    $("addCategoryCreateBtn").textContent = "Create & Select";
    $("newCategoryName").disabled = false;
    $("addCategoryCancelBtn").disabled = false;
    $("addCategorySelectExisting").disabled = false;
  }

  function setCreateBusy(busy) {
    creatingCategory = !!busy;
    $("addCategoryCreateBtn").disabled = !!busy;
    $("addCategoryCreateBtn").textContent = busy ? "Creating…" : "Create & Select";
    $("newCategoryName").disabled = !!busy;
    $("addCategoryCancelBtn").disabled = !!busy;
    $("addCategorySelectExisting").disabled = !!busy;
  }

  function openAddCategoryPanel() {
    var panel = $("addCategoryPanel");
    var btn = $("addCategoryBtn");
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    showInlineCategoryError("");
    clearDuplicateOffer();
    clearCreateBusy();
    $("addCategoryCancelBtn").disabled = false;
    $("newCategoryName").focus();
    $("newCategoryName").select();
  }

  function closeAddCategoryPanel(opts) {
    opts = opts || {};
    var panel = $("addCategoryPanel");
    var btn = $("addCategoryBtn");
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    showInlineCategoryError("");
    clearDuplicateOffer();
    clearCreateBusy();
    $("addCategoryCancelBtn").disabled = false;
    if (!opts.keepName) $("newCategoryName").value = "";
    if (opts.returnFocus !== false) btn.focus();
  }

  function selectExistingCategory(cat) {
    if (!cat) return;
    var selected = selectedCategoryIds();
    if (selected.indexOf(cat.id) === -1) selected.push(cat.id);
    if (!categories.some(function (c) { return c.id === cat.id; })) {
      categories.push(cat);
      sortCategoriesInPlace();
    }
    renderCategoryChecks(selected);
    markDirty();
    updatePreview();
    closeAddCategoryPanel();
  }

  async function createAndSelectCategory() {
    if (creatingCategory) return;
    clearDuplicateOffer();
    showInlineCategoryError("");
    var name = String($("newCategoryName").value || "").trim().replace(/\s+/g, " ");
    $("newCategoryName").value = name;
    if (!name) {
      showInlineCategoryError("Enter a category name.");
      $("newCategoryName").focus();
      return;
    }

    var existingMatch = findEquivalentCategory(name);
    if (existingMatch) {
      showDuplicateOffer(existingMatch);
      return;
    }

    setCreateBusy(true);
    try {
      var created = await SRCatalog.createCategory({
        name: name,
        active: true,
      });
      categories.push(created);
      sortCategoriesInPlace();
      var selected = selectedCategoryIds();
      selected.push(created.id);
      renderCategoryChecks(selected);
      markDirty();
      updatePreview();
      closeAddCategoryPanel();
      showFlash("Category “" + created.name + "” created and selected. Save the product to keep the assignment.", "ok");
    } catch (err) {
      // Keep typed name for retry; do not touch product fields or photos.
      showInlineCategoryError(err.message || "Couldn’t create that category. Try again.");
      clearCreateBusy();
      $("newCategoryName").focus();
      $("newCategoryName").select();
    }
  }

  function bindCategoryCreator() {
    $("addCategoryBtn").addEventListener("click", function () {
      if ($("addCategoryPanel").hidden) openAddCategoryPanel();
      else closeAddCategoryPanel();
    });
    $("addCategoryCancelBtn").addEventListener("click", function () {
      closeAddCategoryPanel();
    });
    $("addCategoryCreateBtn").addEventListener("click", function () {
      createAndSelectCategory();
    });
    $("addCategorySelectExisting").addEventListener("click", function () {
      if (pendingDuplicateCategory) selectExistingCategory(pendingDuplicateCategory);
    });
    $("newCategoryName").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        createAndSelectCategory();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeAddCategoryPanel();
      }
    });
    $("newCategoryName").addEventListener("input", function () {
      if (!$("addCategoryDupOffer").hidden || !$("addCategoryInlineError").hidden) {
        clearDuplicateOffer();
        showInlineCategoryError("");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if ($("addCategoryPanel").hidden) return;
      // Prefer the input handler when the field is focused; still close from elsewhere.
      if (document.activeElement === $("newCategoryName")) return;
      e.preventDefault();
      closeAddCategoryPanel();
    });
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
    if (isBusy) {
      $("publishBtn").textContent = "Publishing…";
      $("saveDraftBtn").textContent = "Saving…";
      $("saveBtn").textContent = "Saving…";
    } else {
      $("publishBtn").textContent = "Publish";
      $("saveDraftBtn").textContent = "Save Draft";
      $("saveBtn").textContent = "Save (keep status)";
    }
  }

  function bindEditorSteps() {
    var current = 1;
    function showStep(n) {
      current = Math.min(4, Math.max(1, Number(n) || 1));
      document.querySelectorAll(".editor-step").forEach(function (el) {
        var step = Number(el.getAttribute("data-step"));
        var on = step === current;
        el.classList.toggle("is-active", on);
        el.hidden = !on;
      });
      document.querySelectorAll(".editor-step-tab").forEach(function (tab) {
        var on = Number(tab.getAttribute("data-goto")) === current;
        tab.classList.toggle("is-active", on);
        if (on) tab.setAttribute("aria-current", "step");
        else tab.removeAttribute("aria-current");
      });
      var first = document.querySelector('.editor-step.is-active input, .editor-step.is-active textarea, .editor-step.is-active select');
      if (first && window.matchMedia("(max-width: 899px)").matches) {
        try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    document.querySelectorAll("[data-next]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showStep(btn.getAttribute("data-next"));
      });
    });
    document.querySelectorAll("[data-prev]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showStep(btn.getAttribute("data-prev"));
      });
    });
    document.querySelectorAll(".editor-step-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        showStep(tab.getAttribute("data-goto"));
      });
    });
    // Desktop: reveal all steps for continuous form; mobile uses one-at-a-time.
    function syncDesktopSteps() {
      var desktop = window.matchMedia("(min-width: 900px)").matches;
      document.querySelectorAll(".editor-step").forEach(function (el) {
        if (desktop) {
          el.hidden = false;
          el.classList.add("is-active");
        } else {
          showStep(current);
        }
      });
    }
    syncDesktopSteps();
    window.addEventListener("resize", syncDesktopSteps);
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
    bindCategoryCreator();
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

  SRAdminShell.boot({
    activeNav: new URLSearchParams(window.location.search).get("id") ? "products" : "add",
  }).then(async function (check) {
    if (!check) return;
    applyPublishMessaging();
    bindForm();
    bindEditorSteps();
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
