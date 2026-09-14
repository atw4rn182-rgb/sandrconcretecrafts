/**
 * Shared admin shell — desktop sidebar + mobile bottom nav / More sheet.
 * Requires admin-auth.js to be loaded first.
 */
(function (global) {
  "use strict";

  var ICONS = {
    home:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/></svg>',
    products:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7z"/><path d="M12 12v8M4 8.5l8 3.5 8-3.5"/></svg>',
    add:
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    orders:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M3 4h2.2l2 11.2a1.4 1.4 0 0 0 1.4 1.1h8.6a1.4 1.4 0 0 0 1.4-1.1L21 7H7"/></svg>',
    more:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/></svg>',
    chevron:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  };

  function sidebarNavHtml(active) {
    function link(href, key, label, ico) {
      var cls = "nav-link" + (active === key ? " is-active" : "");
      return (
        '<a class="' +
        cls +
        '" href="' +
        href +
        '"><span class="nav-ico" aria-hidden="true">' +
        ico +
        "</span> " +
        label +
        "</a>"
      );
    }
    return (
      link("/admin/", "dashboard", "Home", "◆") +
      link("/admin/products.html", "products", "Products", "▣") +
      link("/admin/product-edit.html", "add", "Add Product", "+") +
      link("/admin/categories.html", "categories", "Categories", "▤") +
      link("/admin/orders.html", "orders", "Orders", "☰") +
      link("/admin/customers.html", "customers", "Customers", "☺") +
      '<a class="nav-link is-disabled" href="#" aria-disabled="true" title="Coming soon"><span class="nav-ico" aria-hidden="true">◈</span> Appearance</a>' +
      '<a class="nav-link is-disabled" href="#" aria-disabled="true" title="Coming soon"><span class="nav-ico" aria-hidden="true">⚙</span> Settings</a>'
    );
  }

  function ensureMobileChrome(active) {
    var app = document.getElementById("adminApp");
    if (!app) return;

    if (!document.getElementById("adminBottomNav")) {
      var nav = document.createElement("nav");
      nav.className = "admin-bottom-nav";
      nav.id = "adminBottomNav";
      nav.setAttribute("aria-label", "Primary");
      nav.innerHTML =
        '<a class="bottom-nav-item" data-nav="dashboard" href="/admin/">' +
        ICONS.home +
        "<span>Home</span></a>" +
        '<a class="bottom-nav-item" data-nav="products" href="/admin/products.html">' +
        ICONS.products +
        "<span>Products</span></a>" +
        '<a class="bottom-nav-item bottom-nav-add" data-nav="add" href="/admin/product-edit.html" aria-label="Add product">' +
        '<span class="bottom-nav-add-btn">' +
        ICONS.add +
        "</span><span>Add</span></a>" +
        '<a class="bottom-nav-item" data-nav="orders" href="/admin/orders.html">' +
        ICONS.orders +
        "<span>Orders</span></a>" +
        '<button type="button" class="bottom-nav-item" data-nav="more" id="moreNavBtn" aria-expanded="false" aria-controls="adminMoreSheet">' +
        ICONS.more +
        "<span>More</span></button>";
      app.appendChild(nav);
    }

    if (!document.getElementById("adminMoreSheet")) {
      var sheet = document.createElement("div");
      sheet.id = "adminMoreSheet";
      sheet.className = "admin-more-sheet";
      sheet.hidden = true;
      sheet.innerHTML =
        '<div class="admin-more-backdrop" id="moreSheetBackdrop" hidden></div>' +
        '<div class="admin-more-panel" role="dialog" aria-modal="true" aria-labelledby="moreSheetTitle">' +
        '<div class="admin-more-handle" aria-hidden="true"></div>' +
        '<h2 id="moreSheetTitle">More</h2>' +
        '<div class="admin-more-list">' +
        '<a class="admin-more-link" href="/admin/categories.html"><span>Categories</span><span class="chev" aria-hidden="true">' +
        ICONS.chevron +
        "</span></a>" +
        '<a class="admin-more-link" href="/admin/customers.html"><span>Customers</span><span class="chev" aria-hidden="true">' +
        ICONS.chevron +
        "</span></a>" +
        '<a class="admin-more-link is-disabled" href="#" aria-disabled="true"><span>Appearance <em>Coming soon</em></span></a>' +
        '<a class="admin-more-link is-disabled" href="#" aria-disabled="true"><span>Settings <em>Coming soon</em></span></a>' +
        '<button type="button" class="admin-more-link admin-more-signout" id="moreSignOutBtn">Sign Out</button>' +
        "</div>" +
        '<button type="button" class="btn btn-ghost btn-block" id="moreSheetClose">Close</button>' +
        "</div>";
      app.appendChild(sheet);
    }

    var key = active || "dashboard";
    if (key === "categories" || key === "customers" || key === "settings") key = "more";
    document.querySelectorAll(".bottom-nav-item[data-nav]").forEach(function (el) {
      var on = el.getAttribute("data-nav") === key;
      el.classList.toggle("is-active", on);
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  }

  function bindMoreSheet() {
    var btn = document.getElementById("moreNavBtn");
    var sheet = document.getElementById("adminMoreSheet");
    var backdrop = document.getElementById("moreSheetBackdrop");
    var closeBtn = document.getElementById("moreSheetClose");
    var moreSignOut = document.getElementById("moreSignOutBtn");
    if (!btn || !sheet) return;

    function setOpen(open) {
      sheet.hidden = !open;
      if (backdrop) backdrop.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("more-sheet-open", open);
    }

    btn.addEventListener("click", function () {
      setOpen(sheet.hidden);
    });
    if (backdrop) backdrop.addEventListener("click", function () { setOpen(false); });
    if (closeBtn) closeBtn.addEventListener("click", function () { setOpen(false); });
    if (moreSignOut) {
      moreSignOut.addEventListener("click", async function () {
        moreSignOut.disabled = true;
        moreSignOut.textContent = "Signing out…";
        await SRAdminAuth.signOut();
        window.location.replace(SRAdminAuth.LOGIN_PATH);
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !sheet.hidden) setOpen(false);
    });
  }

  function enhanceMobileHeader() {
    var topbar = document.querySelector(".admin-topbar");
    if (!topbar || topbar.querySelector(".mobile-brand")) return;
    var brand = document.createElement("div");
    brand.className = "mobile-brand";
    brand.innerHTML =
      '<img src="/assets/sandrlogo.jpg" alt="" width="36" height="36" />' +
      "<div><strong>S&amp;R Concrete Crafts</strong><span>Admin Dashboard</span></div>";
    var toggle = topbar.querySelector(".menu-toggle");
    if (toggle && toggle.nextSibling) topbar.insertBefore(brand, toggle.nextSibling);
    else topbar.insertBefore(brand, topbar.firstChild);
  }

  /**
   * @param {{ activeNav: string, title?: string }} options
   * @returns {Promise<object|null>} admin check result
   */
  function bootAdminShell(options) {
    var opts = options || {};
    var app = document.getElementById("adminApp");
    var gate = document.getElementById("adminGate");
    var emailEl = document.getElementById("ownerEmail");
    var signOutBtn = document.getElementById("signOutBtn");
    var menuToggle = document.getElementById("menuToggle");
    var backdrop = document.getElementById("sidebarBackdrop");
    var nav = document.getElementById("adminNav");

    if (nav) nav.innerHTML = sidebarNavHtml(opts.activeNav || "dashboard");
    ensureMobileChrome(opts.activeNav || "dashboard");
    enhanceMobileHeader();
    bindMoreSheet();

    var safety = setTimeout(function () {
      if (gate && gate.dataset.resolved !== "1") {
        gate.textContent =
          "Admin authorization service did not respond. Please refresh the page or sign in again.";
        gate.dataset.resolved = "1";
      }
    }, 22000);

    function setNavOpen(open) {
      if (!app || !menuToggle || !backdrop) return;
      app.classList.toggle("nav-open", open);
      menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
      backdrop.hidden = !open;
    }

    if (menuToggle) {
      menuToggle.addEventListener("click", function () {
        setNavOpen(!app.classList.contains("nav-open"));
      });
    }
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        setNavOpen(false);
      });
    }

    if (signOutBtn) {
      signOutBtn.addEventListener("click", async function () {
        signOutBtn.disabled = true;
        signOutBtn.textContent = "Signing out…";
        await SRAdminAuth.signOut();
        window.location.replace(SRAdminAuth.LOGIN_PATH);
      });
    }

    if (typeof SRAdminAuth === "undefined") {
      if (gate) {
        gate.textContent = global.__SR_ENV_LOAD_ERROR__
          ? "Admin setup is incomplete. Supabase configuration is missing."
          : "Admin tools failed to load. Please refresh the page.";
        gate.dataset.resolved = "1";
      }
      clearTimeout(safety);
      return Promise.resolve(null);
    }

    // IMPORTANT: finish getSession / admin_users checks BEFORE binding onAuthStateChange.
    // Registering the watcher first can deadlock supabase-js and cause session timeouts.
    return SRAdminAuth.requireAdminPage({ gateId: "adminGate" })
      .then(function (check) {
        clearTimeout(safety);
        if (!check || !check.ok) return null;
        if (gate) {
          gate.hidden = true;
          gate.dataset.resolved = "1";
        }
        if (app) app.hidden = false;
        if (emailEl) {
          emailEl.textContent =
            (check.session.user && check.session.user.email) || "Owner";
        }
        SRAdminAuth.watchAuth(function (event) {
          if (event === "SIGNED_OUT") {
            window.location.replace(SRAdminAuth.LOGIN_PATH);
          }
        });
        return check;
      })
      .catch(function () {
        clearTimeout(safety);
        if (gate && gate.dataset.resolved !== "1") {
          gate.textContent =
            "Admin authorization service did not respond. Please refresh the page or sign in again.";
          gate.dataset.resolved = "1";
        }
        return null;
      });
  }

  global.SRAdminShell = {
    boot: bootAdminShell,
    navHtml: sidebarNavHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
