/**
 * Admin Settings editor — Prompt XYZ.
 * Preview/summary updates live; public storefront changes only after Save Settings.
 */
(function () {
  "use strict";

  var draft = SRStoreSettings.cloneDefaults();
  var saved = SRStoreSettings.cloneDefaults();
  var announceStyle = "neutral";

  function $(id) {
    return document.getElementById(id);
  }

  function showFlash(msg, ok) {
    var el = $("flash");
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.className = "flash is-visible " + (ok ? "flash--ok" : "flash--err");
  }

  function clearFlash() {
    var el = $("flash");
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    el.className = "flash";
  }

  function isDirty() {
    return !SRStoreSettings.equals(draft, saved);
  }

  function readFormIntoDraft() {
    draft = SRStoreSettings.normalize({
      business: {
        name: $("bizName").value,
        description: $("bizDescription").value,
        city: $("bizCity").value,
        state: $("bizState").value,
      },
      contact: {
        email: $("contactEmail").value,
        email_enabled: $("emailEnabled").checked,
        phone: $("contactPhone").value,
        phone_enabled: $("phoneEnabled").checked,
      },
      social: {
        facebook: $("socialFacebook").value,
        instagram: $("socialInstagram").value,
        pinterest: $("socialPinterest").value,
        tiktok: $("socialTiktok").value,
      },
      reviews: {
        google_review_url: $("googleReviewUrl").value,
      },
      announcement: {
        enabled: $("announceEnabled").checked,
        text: $("announceText").value,
        style: announceStyle,
      },
      fulfillment: {
        pickup_enabled: $("pickupEnabled").checked,
        pickup_label: $("pickupLabel").value,
        pickup_instructions: $("pickupInstructions").value,
        shipping_enabled: $("shippingEnabled").checked,
        shipping_note: $("shippingNote").value,
      },
      storefront: {
        show_sold_out: $("prefSoldOut").checked,
        featured_first: $("prefFeaturedFirst").checked,
        show_low_stock: $("prefLowStock").checked,
        show_about: $("prefAbout").checked,
        show_social_links: $("prefSocial").checked,
      },
    });
  }

  function fillForm(settings) {
    var s = SRStoreSettings.normalize(settings);
    $("bizName").value = s.business.name;
    $("bizDescription").value = s.business.description;
    $("bizCity").value = s.business.city;
    $("bizState").value = s.business.state;
    $("emailEnabled").checked = s.contact.email_enabled;
    $("contactEmail").value = s.contact.email;
    $("phoneEnabled").checked = s.contact.phone_enabled;
    $("contactPhone").value = s.contact.phone;
    $("socialFacebook").value = s.social.facebook;
    $("socialInstagram").value = s.social.instagram;
    $("socialPinterest").value = s.social.pinterest;
    $("socialTiktok").value = s.social.tiktok;
    $("googleReviewUrl").value = s.reviews.google_review_url;
    $("announceEnabled").checked = s.announcement.enabled;
    $("announceText").value = s.announcement.text;
    announceStyle = s.announcement.style;
    $("pickupEnabled").checked = s.fulfillment.pickup_enabled;
    $("pickupLabel").value = s.fulfillment.pickup_label;
    $("pickupInstructions").value = s.fulfillment.pickup_instructions;
    $("shippingEnabled").checked = s.fulfillment.shipping_enabled;
    $("shippingNote").value = s.fulfillment.shipping_note;
    $("prefSoldOut").checked = s.storefront.show_sold_out;
    $("prefFeaturedFirst").checked = s.storefront.featured_first;
    $("prefLowStock").checked = s.storefront.show_low_stock;
    $("prefAbout").checked = s.storefront.show_about;
    $("prefSocial").checked = s.storefront.show_social_links;

    document.querySelectorAll("[data-announce-style]").forEach(function (btn) {
      var on = btn.getAttribute("data-announce-style") === announceStyle;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function refreshSummary() {
    readFormIntoDraft();
    var s = draft;
    var socialCount = SRStoreSettings.activeSocialLinks(s).length;
    var html =
      "<dl class=\"settings-summary-dl\">" +
      "<div><dt>Business</dt><dd>" +
      SRCatalog.escapeHtml(s.business.name) +
      "<br /><span class=\"muted\">" +
      SRCatalog.escapeHtml(SRStoreSettings.locationLabel(s)) +
      "</span></dd></div>" +
      "<div><dt>Contact</dt><dd>Phone: " +
      (s.contact.phone_enabled ? "enabled" : "hidden") +
      "<br />Email: " +
      (s.contact.email_enabled ? "enabled" : "hidden") +
      "</dd></div>" +
      "<div><dt>Store</dt><dd>Pickup: " +
      (s.fulfillment.pickup_enabled ? "enabled" : "off") +
      "<br />Shipping: " +
      (s.fulfillment.shipping_enabled ? "enabled" : "off") +
      "</dd></div>" +
      "<div><dt>Announcement</dt><dd>" +
      (s.announcement.enabled ? "Enabled" : "Disabled") +
      "</dd></div>" +
      "<div><dt>Social</dt><dd>" +
      (socialCount ? socialCount + " link(s)" : "None shown") +
      "</dd></div>" +
      "<div><dt>Reviews</dt><dd>" +
      (s.reviews.google_review_url ? "Google link configured" : "Not configured") +
      "</dd></div>" +
      "</dl>";
    $("settingsSummary").innerHTML = html;

    var dirty = isDirty();
    $("unsavedPill").hidden = !dirty;
    $("saveSettingsBtn").disabled = !dirty;
  }

  function onFormChange() {
    clearFlash();
    refreshSummary();
  }

  function bind() {
    [
      "bizName",
      "bizDescription",
      "bizCity",
      "bizState",
      "emailEnabled",
      "contactEmail",
      "phoneEnabled",
      "contactPhone",
      "socialFacebook",
      "socialInstagram",
      "socialPinterest",
      "socialTiktok",
      "googleReviewUrl",
      "announceEnabled",
      "announceText",
      "pickupEnabled",
      "pickupLabel",
      "pickupInstructions",
      "shippingEnabled",
      "shippingNote",
      "prefSoldOut",
      "prefFeaturedFirst",
      "prefLowStock",
      "prefAbout",
      "prefSocial",
    ].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("input", onFormChange);
      el.addEventListener("change", onFormChange);
    });

    document.querySelectorAll("[data-announce-style]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        announceStyle = btn.getAttribute("data-announce-style") || "neutral";
        onFormChange();
        fillForm(draft);
        refreshSummary();
      });
    });

    $("saveSettingsBtn").addEventListener("click", async function () {
      var btn = $("saveSettingsBtn");
      var enteredReviewUrl = $("googleReviewUrl").value.trim();
      readFormIntoDraft();
      var errors = SRStoreSettings.validateDraft(draft);
      if (
        enteredReviewUrl &&
        !SRStoreSettings.cleanGoogleReviewUrl(enteredReviewUrl)
      ) {
        errors.unshift("Enter an exact Google Write-a-Review URL.");
      }
      if (errors.length) {
        showFlash(errors[0], false);
        return;
      }
      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        var next = await SRCatalog.saveStoreSettings(draft);
        saved = SRStoreSettings.normalize(next);
        draft = SRStoreSettings.normalize(next);
        fillForm(saved);
        refreshSummary();
        showFlash("Settings saved", true);
      } catch (err) {
        showFlash((err && err.message) || "Couldn’t save settings.", false);
        refreshSummary();
      } finally {
        btn.textContent = "Save Settings";
      }
    });

    $("resetSettingsBtn").addEventListener("click", function () {
      draft = SRStoreSettings.normalize(saved);
      fillForm(draft);
      refreshSummary();
      showFlash("Unsaved changes discarded.", true);
    });

    window.addEventListener("beforeunload", function (e) {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  function loadSettings() {
    return SRCatalog.getStoreSettings()
      .then(function (row) {
        saved = SRStoreSettings.normalize(row.settings);
        draft = SRStoreSettings.normalize(row.settings);
        fillForm(saved);
        refreshSummary();
      })
      .catch(function (err) {
        // Auth already succeeded — never leave the gate on "Checking your access".
        saved = SRStoreSettings.cloneDefaults();
        draft = SRStoreSettings.cloneDefaults();
        fillForm(draft);
        refreshSummary();
        showFlash((err && err.message) || "Couldn’t load settings.", false);
      });
  }

  // Same proven bootstrap as Appearance / Orders / Products:
  // SRAdminShell.boot → requireAdminPage first → watchAuth after → then page data.
  SRAdminShell.boot({ activeNav: "settings" }).then(function (check) {
    if (!check || !check.ok) return;
    bind();
    loadSettings();
  });
})();
