/**
 * Shared admin shell bootstrap for protected /admin pages.
 * Requires admin-auth.js to be loaded first.
 */
(function (global) {
  "use strict";

  function navHtml(active) {
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
      link("/admin/", "dashboard", "Dashboard", "◆") +
      link("/admin/products.html", "products", "Products", "▣") +
      link("/admin/categories.html", "categories", "Categories", "▤") +
      '<a class="nav-link is-disabled" href="#" aria-disabled="true" title="Coming soon"><span class="nav-ico" aria-hidden="true">☰</span> Orders</a>' +
      '<a class="nav-link is-disabled" href="#" aria-disabled="true" title="Coming soon"><span class="nav-ico" aria-hidden="true">☺</span> Customers</a>' +
      '<a class="nav-link is-disabled" href="#" aria-disabled="true" title="Coming soon"><span class="nav-ico" aria-hidden="true">◈</span> Appearance</a>' +
      '<a class="nav-link is-disabled" href="#" aria-disabled="true" title="Coming soon"><span class="nav-ico" aria-hidden="true">⚙</span> Settings</a>'
    );
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

    if (nav) nav.innerHTML = navHtml(opts.activeNav || "dashboard");

    var safety = setTimeout(function () {
      if (gate && gate.dataset.resolved !== "1") {
        gate.textContent =
          (global.SRAdminAuth && SRAdminAuth.MISSING_CONFIG_MESSAGE) ||
          "Admin setup is incomplete. Supabase configuration is missing.";
        gate.dataset.resolved = "1";
      }
    }, 12000);

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

    SRAdminAuth.watchAuth(function (event) {
      if (event === "SIGNED_OUT") {
        window.location.replace(SRAdminAuth.LOGIN_PATH);
      }
    });

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
        return check;
      })
      .catch(function () {
        clearTimeout(safety);
        if (gate && gate.dataset.resolved !== "1") {
          gate.textContent = SRAdminAuth.MISSING_CONFIG_MESSAGE;
          gate.dataset.resolved = "1";
        }
        return null;
      });
  }

  global.SRAdminShell = {
    boot: bootAdminShell,
    navHtml: navHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
