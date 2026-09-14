/**
 * Admin Appearance editor — live preview, save to site_settings.config.appearance.
 * Includes Prompt XY.1 hero image management (preview until Save).
 */
(function () {
  "use strict";

  var saved = SRAppearance.cloneDefaults();
  var draft = SRAppearance.cloneDefaults();
  var dirty = false;
  var pendingHeroFile = null;
  var pendingHeroObjectUrl = null;
  var wantDefaultHero = false;

  function $(id) {
    return document.getElementById(id);
  }

  function showFlash(msg, ok) {
    var el = $("flash");
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.className = "flash is-visible " + (ok ? "flash--ok" : "flash--err");
    clearTimeout(showFlash._t);
    showFlash._t = setTimeout(function () {
      el.hidden = true;
      el.classList.remove("is-visible");
    }, 5200);
  }

  function setDirty(next) {
    dirty = !!next;
    var pill = $("unsavedPill");
    if (pill) pill.hidden = !dirty;
  }

  function clearPendingHeroUrl() {
    if (pendingHeroObjectUrl) {
      URL.revokeObjectURL(pendingHeroObjectUrl);
      pendingHeroObjectUrl = null;
    }
  }

  function previewHeroUrl() {
    if (pendingHeroObjectUrl) return pendingHeroObjectUrl;
    if (wantDefaultHero) return SRAppearance.DEFAULT_HERO_URL;
    return SRAppearance.resolveHeroUrl(draft);
  }

  function computeDirty() {
    if (pendingHeroFile) return true;
    if (wantDefaultHero && (saved.hero_image_url || saved.hero_storage_path)) {
      return true;
    }
    return !SRAppearance.equals(draft, saved);
  }

  function syncControlUi() {
    var resolvedSeason =
      draft.seasonal_mode === "automatic"
        ? SRAppearance.resolveSeasonalTheme(draft)
        : draft.seasonal_theme;

    document.querySelectorAll("[data-field]").forEach(function (btn) {
      var field = btn.getAttribute("data-field");
      var value = btn.getAttribute("data-value");
      var selected;
      if (field === "seasonal_theme" && draft.seasonal_mode === "automatic") {
        selected = value === resolvedSeason;
      } else {
        selected = draft[field] === value;
      }
      btn.classList.toggle("is-selected", selected);
      btn.classList.toggle("is-active", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });

    var hint = $("seasonModeHint");
    if (hint) {
      hint.textContent =
        draft.seasonal_mode === "automatic"
          ? "Automatic: the shop follows the calendar (Halloween in October, Christmas in December, and so on). Manual always wins if you switch back. Right now: " +
            (resolvedSeason === "off"
              ? "Default Southwestern"
              : resolvedSeason.replace(/_/g, " ")) +
            "."
          : "Manual: you pick the season. It always overrides Automatic.";
    }

    var grid = $("seasonalThemeGrid");
    if (grid) {
      grid.classList.toggle("is-auto-mode", draft.seasonal_mode === "automatic");
      grid.querySelectorAll("[data-field='seasonal_theme']").forEach(function (btn) {
        btn.disabled = draft.seasonal_mode === "automatic";
      });
    }

    updateReminder();
  }

  function updateReminder() {
    var card = $("seasonReminder");
    var title = $("seasonReminderTitle");
    var body = $("seasonReminderBody");
    if (!card || !title || !body) return;

    var upcoming = SRAppearance.upcomingSeasonReminder(new Date());
    if (!upcoming) {
      card.hidden = true;
      return;
    }

    card.hidden = false;
    title.textContent = "Coming up: " + upcoming.label;
    if (draft.seasonal_mode === "automatic") {
      body.textContent =
        upcoming.label +
        " starts around " +
        upcoming.monthLabel +
        ". With Automatic on, your shop will switch when that window begins.";
    } else {
      body.textContent =
        upcoming.label +
        " is around " +
        upcoming.monthLabel +
        ". This is just a reminder — nothing changes until you pick it (or turn on Automatic).";
    }
  }

  function applyPreviewPositions(preview) {
    var device = ($("previewFrame") || {}).getAttribute("data-device") || "desktop";
    var pos =
      device === "mobile"
        ? SRAppearance.mobileObjectPosition(draft)
        : SRAppearance.desktopObjectPosition(draft);
    preview.style.setProperty("--hero-object-preview", pos);
    var img = preview.querySelector(".sf-prev-hero-img");
    if (img) img.style.objectPosition = pos;
  }

  function refreshPreview() {
    var preview = $("sfPreview");
    if (!preview) return;
    var url = previewHeroUrl();
    SRAppearance.applyToElement(preview, draft, { heroUrlOverride: url });
    applyPreviewPositions(preview);

    var thumb = $("heroThumb");
    if (thumb && thumb.getAttribute("src") !== url) {
      thumb.setAttribute("src", url);
    }

    syncControlUi();
    setDirty(computeDirty());
  }

  function setField(field, value) {
    if (!Object.prototype.hasOwnProperty.call(draft, field) && field !== "base_theme") {
      return;
    }
    if (field === "base_theme") {
      draft.base_theme = "southwestern";
    } else {
      draft[field] = value;
    }
    draft = SRAppearance.normalize(draft);
    refreshPreview();
  }

  function setHeroStatus(msg) {
    var el = $("heroImageStatus");
    if (el) el.textContent = msg || "";
  }

  async function onHeroFileChosen(file) {
    if (!file) return;
    setHeroStatus("Checking image…");
    try {
      var prepared = await SRCatalog.prepareHeroImageFile(file);
      clearPendingHeroUrl();
      pendingHeroFile = prepared.file;
      pendingHeroObjectUrl = URL.createObjectURL(prepared.file);
      wantDefaultHero = false;
      draft.hero_image_url = draft.hero_image_url; // keep until save
      refreshPreview();
      var msg =
        "New hero selected for preview (" +
        prepared.width +
        "×" +
        prepared.height +
        "). Save Appearance to publish.";
      if (prepared.warning) msg += " " + prepared.warning;
      setHeroStatus(msg);
      if (prepared.warning) showFlash(prepared.warning, false);
    } catch (err) {
      pendingHeroFile = null;
      clearPendingHeroUrl();
      setHeroStatus("");
      showFlash((err && err.message) || "Couldn’t use that image.", false);
      refreshPreview();
    }
  }

  function bindControls() {
    document.querySelectorAll("[data-field]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        setField(btn.getAttribute("data-field"), btn.getAttribute("data-value"));
      });
    });

    document.querySelectorAll(".preview-device-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var device = btn.getAttribute("data-device");
        var frame = $("previewFrame");
        document.querySelectorAll(".preview-device-btn").forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        if (frame) frame.setAttribute("data-device", device);
        refreshPreview();
      });
    });

    var fileInput = $("heroFileInput");
    if (fileInput) {
      fileInput.addEventListener("change", function () {
        var file = fileInput.files && fileInput.files[0];
        fileInput.value = "";
        onHeroFileChosen(file);
      });
    }

    $("restoreSavedHeroBtn").addEventListener("click", function () {
      pendingHeroFile = null;
      clearPendingHeroUrl();
      wantDefaultHero = false;
      draft.hero_image_url = saved.hero_image_url;
      draft.hero_storage_path = saved.hero_storage_path;
      draft = SRAppearance.normalize(draft);
      setHeroStatus("Preview restored to your last saved hero.");
      refreshPreview();
    });

    $("restoreDefaultHeroBtn").addEventListener("click", function () {
      pendingHeroFile = null;
      clearPendingHeroUrl();
      wantDefaultHero = true;
      draft.hero_image_url = null;
      draft.hero_storage_path = null;
      draft = SRAppearance.normalize(draft);
      setHeroStatus(
        "Default S&R hero shown in preview. Click Save Appearance to publish."
      );
      refreshPreview();
    });

    $("saveAppearanceBtn").addEventListener("click", async function () {
      var btn = $("saveAppearanceBtn");
      btn.disabled = true;
      var prev = btn.textContent;
      btn.textContent = pendingHeroFile ? "Uploading & saving…" : "Saving…";
      try {
        var next = await SRCatalog.saveAppearance(draft, {
          pendingHeroFile: pendingHeroFile,
          useDefaultHero: wantDefaultHero && !pendingHeroFile,
        });
        saved = SRAppearance.normalize(next);
        draft = SRAppearance.normalize(next);
        pendingHeroFile = null;
        clearPendingHeroUrl();
        wantDefaultHero = false;
        setHeroStatus("");
        refreshPreview();
        showFlash("Appearance saved", true);
      } catch (err) {
        showFlash(
          (err && err.message) || "Couldn’t save appearance. Please try again.",
          false
        );
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
    });

    $("resetSavedBtn").addEventListener("click", function () {
      pendingHeroFile = null;
      clearPendingHeroUrl();
      wantDefaultHero = false;
      draft = SRAppearance.normalize(saved);
      setHeroStatus("");
      refreshPreview();
      showFlash("Editor reset to your last saved look.", true);
    });

    $("resetDefaultBtn").addEventListener("click", function () {
      pendingHeroFile = null;
      clearPendingHeroUrl();
      wantDefaultHero = true;
      draft = SRAppearance.cloneDefaults();
      setHeroStatus(
        "Southwestern default + default hero in preview. Click Save Appearance to publish."
      );
      refreshPreview();
      showFlash(
        "Editor reset to Southwestern default. Click Save Appearance to publish.",
        true
      );
    });

    window.addEventListener("beforeunload", function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  async function load() {
    try {
      var row = await SRCatalog.getAppearance();
      saved = SRAppearance.normalize(row.appearance);
      draft = SRAppearance.normalize(row.appearance);
      pendingHeroFile = null;
      clearPendingHeroUrl();
      wantDefaultHero = false;
      refreshPreview();
    } catch (err) {
      saved = SRAppearance.cloneDefaults();
      draft = SRAppearance.cloneDefaults();
      refreshPreview();
      showFlash(
        (err && err.message) ||
          "Couldn’t load saved appearance — showing Southwestern defaults.",
        false
      );
    }
  }

  SRAdminShell.boot({ activeNav: "appearance" }).then(function (check) {
    if (!check || !check.ok) return;
    bindControls();
    load();
  });
})();
