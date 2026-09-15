/**
 * Admin categories management — create, edit, activate/deactivate, delete.
 * Deleting a category never deletes products (FK cascade removes associations only).
 */
(function () {
  "use strict";

  var categories = [];
  var pendingDelete = null;
  var deleting = false;

  function showFlash(message, kind) {
    var el = document.getElementById("flash");
    el.hidden = false;
    el.className = "flash is-visible flash--" + (kind || "ok");
    el.textContent = message;
  }

  function resetForm() {
    document.getElementById("catId").value = "";
    document.getElementById("catName").value = "";
    document.getElementById("catDesc").value = "";
    document.getElementById("catSort").value = "0";
    document.getElementById("catActive").checked = true;
    document.getElementById("catFormTitle").textContent = "Add category";
    document.getElementById("catCancelBtn").hidden = true;
    document.getElementById("catSaveBtn").textContent = "Save category";
  }

  function closeDeleteSheet() {
    pendingDelete = null;
    deleting = false;
    var sheet = document.getElementById("catDeleteSheet");
    var backdrop = document.getElementById("catDeleteBackdrop");
    if (sheet) sheet.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove("action-sheet-open");
    var confirmBtn = document.getElementById("catDeleteConfirm");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Delete Category";
    }
  }

  function openDeleteSheet(category, productCount) {
    pendingDelete = { id: category.id, name: category.name, count: productCount };
    var title = document.getElementById("catDeleteTitle");
    var body = document.getElementById("catDeleteBody");
    var sheet = document.getElementById("catDeleteSheet");
    var backdrop = document.getElementById("catDeleteBackdrop");
    var name = category.name || "this category";

    title.textContent = 'Delete “' + name + '”?';

    if (productCount > 0) {
      body.innerHTML =
        "This category is currently assigned to <strong>" +
        SRCatalog.escapeHtml(String(productCount)) +
        "</strong> product" +
        (productCount === 1 ? "" : "s") +
        ".<br /><br />The products will <strong>NOT</strong> be deleted. The category will simply be removed from those products.";
    } else {
      body.textContent =
        "This category is not currently assigned to any products. This permanently removes the category.";
    }

    sheet.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add("action-sheet-open");
    document.getElementById("catDeleteCancel").focus();
  }

  async function requestDelete(category) {
    var btn = document.querySelector('[data-delete="' + category.id + '"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Checking…";
    }
    try {
      var count = await SRCatalog.countCategoryProducts(category.id);
      openDeleteSheet(category, count);
    } catch (err) {
      showFlash(
        (err && err.message) || "Couldn’t check category usage. Please try again.",
        "err"
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Delete";
      }
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    deleting = true;
    var confirmBtn = document.getElementById("catDeleteConfirm");
    var name = pendingDelete.name;
    var id = pendingDelete.id;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Deleting…";
    }
    try {
      await SRCatalog.deleteCategory(id);
      closeDeleteSheet();
      if (document.getElementById("catId").value === id) resetForm();
      showFlash("“" + name + "” deleted.", "ok");
      await load();
    } catch (err) {
      deleting = false;
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Delete Category";
      }
      showFlash(
        (err && err.message) || "Couldn’t delete this category. Please try again.",
        "err"
      );
    }
  }

  function render() {
    var state = document.getElementById("catState");
    var list = document.getElementById("catList");
    if (!categories.length) {
      state.hidden = false;
      list.hidden = true;
      state.innerHTML =
        '<p class="state-title">No categories yet</p><p>Create your first category above.</p>';
      return;
    }
    state.hidden = true;
    list.hidden = false;
    list.innerHTML =
      '<div class="cat-card-list" role="list">' +
      categories
        .map(function (c) {
          return (
            '<article class="cat-card" role="listitem">' +
            '<div class="cat-card-main">' +
            "<h3>" +
            SRCatalog.escapeHtml(c.name) +
            "</h3>" +
            '<p class="muted cat-card-meta">' +
            SRCatalog.escapeHtml(c.slug) +
            " · Sort " +
            SRCatalog.escapeHtml(String(c.sort_order)) +
            "</p>" +
            (c.active
              ? '<span class="status-pill status-published">Active</span>'
              : '<span class="status-pill status-hidden">Inactive</span>') +
            "</div>" +
            '<div class="cat-card-actions">' +
            '<button type="button" class="btn btn-ghost btn-small" data-edit="' +
            SRCatalog.escapeHtml(c.id) +
            '">Edit</button>' +
            '<button type="button" class="btn btn-ghost btn-small" data-toggle="' +
            SRCatalog.escapeHtml(c.id) +
            '">' +
            (c.active ? "Deactivate" : "Activate") +
            "</button>" +
            '<button type="button" class="btn btn-ghost btn-small btn-danger-text" data-delete="' +
            SRCatalog.escapeHtml(c.id) +
            '">Delete</button>' +
            "</div>" +
            "</article>"
          );
        })
        .join("") +
      "</div>";

    list.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-edit");
        var c = categories.find(function (x) {
          return x.id === id;
        });
        if (!c) return;
        document.getElementById("catId").value = c.id;
        document.getElementById("catName").value = c.name;
        document.getElementById("catDesc").value = c.description || "";
        document.getElementById("catSort").value = c.sort_order || 0;
        document.getElementById("catActive").checked = !!c.active;
        document.getElementById("catFormTitle").textContent = "Edit category";
        document.getElementById("catCancelBtn").hidden = false;
        document.getElementById("catSaveBtn").textContent = "Update category";
        document.getElementById("catName").focus();
      });
    });

    list.querySelectorAll("[data-toggle]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-toggle");
        var c = categories.find(function (x) {
          return x.id === id;
        });
        if (!c) return;
        try {
          await SRCatalog.updateCategory(id, {
            name: c.name,
            description: c.description,
            sort_order: c.sort_order,
            active: !c.active,
          });
          showFlash(
            c.active ? "Category deactivated." : "Category activated.",
            "ok"
          );
          await load();
        } catch (err) {
          showFlash(err.message || "Couldn’t update category.", "err");
        }
      });
    });

    list.querySelectorAll("[data-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete");
        var c = categories.find(function (x) {
          return x.id === id;
        });
        if (!c) return;
        requestDelete(c);
      });
    });
  }

  async function load() {
    var state = document.getElementById("catState");
    try {
      categories = await SRCatalog.listCategories(true);
      render();
    } catch (err) {
      state.hidden = false;
      document.getElementById("catList").hidden = true;
      state.innerHTML =
        '<p class="state-title">Couldn’t load categories</p><p>' +
        SRCatalog.escapeHtml(err.message || "Please try again.") +
        "</p>";
    }
  }

  SRAdminShell.boot({ activeNav: "categories" }).then(function (check) {
    if (!check) return;

    document.getElementById("catCancelBtn").addEventListener("click", resetForm);

    document.getElementById("categoryForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var id = document.getElementById("catId").value;
      var payload = {
        name: document.getElementById("catName").value,
        description: document.getElementById("catDesc").value,
        sort_order: document.getElementById("catSort").value,
        active: document.getElementById("catActive").checked,
      };
      var btn = document.getElementById("catSaveBtn");
      btn.disabled = true;
      try {
        if (id) {
          await SRCatalog.updateCategory(id, payload);
          showFlash("Category updated.", "ok");
        } else {
          await SRCatalog.createCategory(payload);
          showFlash("Category created.", "ok");
        }
        resetForm();
        await load();
      } catch (err) {
        showFlash(err.message || "Couldn’t save category.", "err");
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("catDeleteCancel").addEventListener("click", closeDeleteSheet);
    document.getElementById("catDeleteBackdrop").addEventListener("click", closeDeleteSheet);
    document.getElementById("catDeleteConfirm").addEventListener("click", confirmDelete);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && pendingDelete) closeDeleteSheet();
    });

    load();
  });
})();
