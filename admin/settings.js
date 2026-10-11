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
        pickup_fee_cents: $("pickupFee").value,
        shipping_enabled: $("shippingEnabled").checked,
        shipping_label: $("shippingLabel").value,
        shipping_note: $("shippingNote").value,
        shipping_fee_cents: $("shippingFee").value,
        base_weight_oz: (function () {
          if (typeof SRProductWeight === "undefined") return 16;
          var parsed = SRProductWeight.parseParts($("baseWeightLb").value, $("baseWeightOz").value, {
            required: true,
          });
          return parsed.ok ? parsed.ounces : "invalid";
        })(),
      },
      storefront: {
        show_sold_out: $("prefSoldOut").checked,
        featured_first: $("prefFeaturedFirst").checked,
        show_low_stock: $("prefLowStock").checked,
        show_about: $("prefAbout").checked,
        show_social_links: $("prefSocial").checked,
      },
      pos: {
        tax_milli: (function () {
          var parsed = window.SRPosTotals
            ? SRPosTotals.parsePercentToMilli($("posTaxRate").value)
            : { ok: true, value: 0 };
          return parsed.ok ? parsed.value : 0;
        })(),
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
    $("pickupFee").value = SRStoreSettings.formatFeeDollars(s.fulfillment.pickup_fee_cents);
    $("shippingEnabled").checked = s.fulfillment.shipping_enabled;
    $("shippingLabel").value = s.fulfillment.shipping_label;
    $("shippingNote").value = s.fulfillment.shipping_note;
    $("shippingFee").value = SRStoreSettings.formatFeeDollars(s.fulfillment.shipping_fee_cents);
    var baseParts = window.SRProductWeight
      ? SRProductWeight.splitOunces(s.fulfillment.base_weight_oz)
      : { pounds: 1, ounces: 0 };
    $("baseWeightLb").value = String(baseParts.pounds);
    $("baseWeightOz").value = String(baseParts.ounces);
    $("prefSoldOut").checked = s.storefront.show_sold_out;
    $("prefFeaturedFirst").checked = s.storefront.featured_first;
    $("prefLowStock").checked = s.storefront.show_low_stock;
    $("prefAbout").checked = s.storefront.show_about;
    $("prefSocial").checked = s.storefront.show_social_links;
    $("posTaxRate").value = window.SRPosTotals
      ? SRPosTotals.percentLabel(s.pos && s.pos.tax_milli)
      : "0";

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
      "<div><dt>Fulfillment</dt><dd>Shipping: " +
      (s.fulfillment.shipping_enabled
        ? s.fulfillment.shipping_fee_cents == null
          ? "on, fee not set"
          : "$" + SRStoreSettings.formatFeeDollars(s.fulfillment.shipping_fee_cents)
        : "off") +
      "<br />Local pickup / meet-up: " +
      (s.fulfillment.pickup_enabled
        ? s.fulfillment.pickup_fee_cents == null
          ? "on, fee not set"
          : s.fulfillment.pickup_fee_cents === 0
            ? "Free"
            : "$" + SRStoreSettings.formatFeeDollars(s.fulfillment.pickup_fee_cents)
        : "off") +
      "<br />Base weight: " +
      (window.SRProductWeight
        ? SRProductWeight.formatOunces(s.fulfillment.base_weight_oz)
        : "1 lb 0 oz") +
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
      "<div><dt>In-person tax</dt><dd>" +
      (s.pos && s.pos.tax_milli
        ? SRPosTotals.percentLabel(s.pos.tax_milli) + "%"
        : "0% — not collecting tax at events") +
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
      "pickupFee",
      "shippingEnabled",
      "shippingLabel",
      "shippingNote",
      "shippingFee",
      "baseWeightLb",
      "baseWeightOz",
      "prefSoldOut",
      "prefFeaturedFirst",
      "prefLowStock",
      "prefAbout",
      "prefSocial",
      "posTaxRate",
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
      var taxParsed = SRPosTotals.parsePercentToMilli($("posTaxRate").value);
      readFormIntoDraft();
      var errors = SRStoreSettings.validateDraft(draft);
      var shipParsed = SRStoreSettings.parseFeeInput($("shippingFee").value);
      var pickParsed = SRStoreSettings.parseFeeInput($("pickupFee").value);
      var baseParsed = window.SRProductWeight
        ? SRProductWeight.parseParts($("baseWeightLb").value, $("baseWeightOz").value, { required: true })
        : { ok: true };
      if (!shipParsed.ok) errors.unshift(shipParsed.error);
      if (!pickParsed.ok) errors.unshift(pickParsed.error);
      if (!baseParsed.ok) errors.unshift(baseParsed.error);
      if (!taxParsed.ok) {
        errors.unshift(taxParsed.error || "Enter a tax rate from 0% to 100%.");
      }
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

    $("applyBaseWeightBtn").addEventListener("click", async function () {
      var parsed = SRProductWeight.parseParts($("baseWeightLb").value, $("baseWeightOz").value, {
        required: true,
      });
      if (!parsed.ok) {
        showFlash(parsed.error, false);
        return;
      }
      var mode = $("baseWeightAll").checked ? "all" : "missing";
      if (SRProductWeight.applyNeedsConfirmation(mode)) {
        var confirmed = window.confirm(
          "This will replace existing custom product weights. Continue?"
        );
        if (!confirmed) return;
      }
      var btn = $("applyBaseWeightBtn");
      btn.disabled = true;
      try {
        var result = await SRCatalog.applyProductBaseWeight(parsed.ounces, mode);
        if (draft.fulfillment) draft.fulfillment.base_weight_oz = result.ounces;
        if (saved.fulfillment) saved.fulfillment.base_weight_oz = result.ounces;
        refreshSummary();
        showFlash(
          result.missingOnly
            ? "Applied " +
                SRProductWeight.formatOunces(result.ounces) +
                " to " +
                result.updated +
                " products with no weight. Custom weights were kept."
            : "Applied " +
                SRProductWeight.formatOunces(result.ounces) +
                " to " +
                result.updated +
                " products. Custom weights were replaced.",
          true
        );
      } catch (err) {
        var message = (err && err.message) || "Couldn’t apply the base weight.";
        if (message.indexOf("The base weight was saved") === 0 && draft.fulfillment) {
          draft.fulfillment.base_weight_oz = parsed.ounces;
          if (saved.fulfillment) saved.fulfillment.base_weight_oz = parsed.ounces;
          refreshSummary();
        }
        showFlash(message, false);
      }
      btn.disabled = false;
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
