/**
 * Admin categories management.
 */
(function () {
  "use strict";

  var categories = [];

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
      '<table class="product-table"><thead><tr><th>Name</th><th>Slug</th><th>Sort</th><th>Status</th><th></th></tr></thead><tbody>' +
      categories
        .map(function (c) {
          return (
            "<tr><td><strong>" +
            SRCatalog.escapeHtml(c.name) +
            "</strong></td><td class='muted'>" +
            SRCatalog.escapeHtml(c.slug) +
            "</td><td>" +
            SRCatalog.escapeHtml(String(c.sort_order)) +
            "</td><td>" +
            (c.active
              ? '<span class="status-pill status-published">Active</span>'
              : '<span class="status-pill status-hidden">Inactive</span>') +
            '</td><td class="cell-actions">' +
            '<button type="button" class="btn btn-ghost btn-small" data-edit="' +
            SRCatalog.escapeHtml(c.id) +
            '">Edit</button> ' +
            '<button type="button" class="btn btn-ghost btn-small" data-toggle="' +
            SRCatalog.escapeHtml(c.id) +
            '">' +
            (c.active ? "Deactivate" : "Activate") +
            "</button></td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";

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

    load();
  });
})();
