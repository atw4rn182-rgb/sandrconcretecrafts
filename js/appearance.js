/**
 * Shared storefront appearance model for S&R Concrete Crafts.
 * Safe for browser: no secrets. Public reads site_settings.config.appearance.
 */
(function (global) {
  "use strict";

  var DEFAULT_HERO_URL = "/assets/hero-porch-fullbleed.jpg";

  var DEFAULTS = {
    base_theme: "southwestern",
    seasonal_mode: "manual",
    seasonal_theme: "off",
    accent: "terracotta",
    decorative_accent: "none",
    hero_overlay: "medium",
    hero_text_position: "left",
    background_style: "warm_cream",
    product_card_style: "soft",
    hero_image_url: null,
    hero_storage_path: null,
    hero_position_desktop_x: "right",
    hero_position_desktop_y: "center",
    hero_position_mobile_x: "center",
    hero_position_mobile_y: "center",
  };

  var ACCENTS = ["turquoise", "terracotta", "sandstone", "desert_teal"];
  var DECORATIVE = ["none", "zia", "roadrunner", "desert_pattern"];
  var HERO_OVERLAYS = ["light", "medium", "strong"];
  var HERO_TEXT_POSITIONS = ["left", "center"];
  var HERO_X = ["left", "center", "right"];
  var HERO_Y = ["top", "center", "bottom"];
  var BACKGROUNDS = ["warm_cream", "soft_sandstone", "light_peach"];
  var CARD_STYLES = ["soft", "elevated"];
  var SEASONAL = ["off", "halloween", "christmas", "fourth_of_july", "easter"];
  var MODES = ["manual", "automatic"];

  var POSITION_PCT = {
    left: "22%",
    center: "50%",
    right: "78%",
    top: "22%",
    bottom: "78%",
  };

  function pick(value, allowed, fallback) {
    var v = value == null ? "" : String(value).trim();
    return allowed.indexOf(v) >= 0 ? v : fallback;
  }

  function cleanUrl(value) {
    if (value == null) return null;
    var s = String(value).trim();
    if (!s) return null;
    if (s.indexOf("javascript:") === 0) return null;
    return s.slice(0, 2000);
  }

  function cleanPath(value) {
    if (value == null) return null;
    var s = String(value).trim();
    if (!s) return null;
    if (s.indexOf("..") >= 0) return null;
    if (s.indexOf("hero/") !== 0) return null;
    return s.slice(0, 400);
  }

  function normalize(raw) {
    var src = raw && typeof raw === "object" ? raw : {};
    return {
      base_theme: "southwestern",
      seasonal_mode: pick(src.seasonal_mode, MODES, DEFAULTS.seasonal_mode),
      seasonal_theme: pick(src.seasonal_theme, SEASONAL, DEFAULTS.seasonal_theme),
      accent: pick(src.accent, ACCENTS, DEFAULTS.accent),
      decorative_accent: pick(
        src.decorative_accent,
        DECORATIVE,
        DEFAULTS.decorative_accent
      ),
      hero_overlay: pick(src.hero_overlay, HERO_OVERLAYS, DEFAULTS.hero_overlay),
      hero_text_position: pick(
        src.hero_text_position,
        HERO_TEXT_POSITIONS,
        DEFAULTS.hero_text_position
      ),
      background_style: pick(
        src.background_style,
        BACKGROUNDS,
        DEFAULTS.background_style
      ),
      product_card_style: pick(
        src.product_card_style,
        CARD_STYLES,
        DEFAULTS.product_card_style
      ),
      hero_image_url: cleanUrl(src.hero_image_url),
      hero_storage_path: cleanPath(src.hero_storage_path),
      hero_position_desktop_x: pick(
        src.hero_position_desktop_x,
        HERO_X,
        DEFAULTS.hero_position_desktop_x
      ),
      hero_position_desktop_y: pick(
        src.hero_position_desktop_y,
        HERO_Y,
        DEFAULTS.hero_position_desktop_y
      ),
      hero_position_mobile_x: pick(
        src.hero_position_mobile_x,
        HERO_X,
        DEFAULTS.hero_position_mobile_x
      ),
      hero_position_mobile_y: pick(
        src.hero_position_mobile_y,
        HERO_Y,
        DEFAULTS.hero_position_mobile_y
      ),
    };
  }

  function cloneDefaults() {
    return normalize(DEFAULTS);
  }

  function resolveHeroUrl(appearance) {
    var a = normalize(appearance);
    return a.hero_image_url || DEFAULT_HERO_URL;
  }

  function objectPosition(x, y) {
    var xp = POSITION_PCT[x] || POSITION_PCT.center;
    var yp = y === "center" ? "50%" : POSITION_PCT[y] || "50%";
    if (x === "center") xp = "50%";
    return xp + " " + yp;
  }

  function desktopObjectPosition(appearance) {
    var a = normalize(appearance);
    return objectPosition(a.hero_position_desktop_x, a.hero_position_desktop_y);
  }

  function mobileObjectPosition(appearance) {
    var a = normalize(appearance);
    return objectPosition(a.hero_position_mobile_x, a.hero_position_mobile_y);
  }

  function automaticSeasonalTheme(date) {
    var d = date instanceof Date ? date : new Date();
    var month = d.getMonth();
    var day = d.getDate();
    if (month === 9) return "halloween";
    if (month === 11) return "christmas";
    if (month === 5 && day >= 20) return "fourth_of_july";
    if (month === 6 && day <= 10) return "fourth_of_july";
    if (month === 2 && day >= 20) return "easter";
    if (month === 3 && day <= 20) return "easter";
    return "off";
  }

  function resolveSeasonalTheme(appearance, date) {
    var a = normalize(appearance);
    if (a.seasonal_mode === "automatic") {
      return automaticSeasonalTheme(date);
    }
    return a.seasonal_theme === "off" ? "off" : a.seasonal_theme;
  }

  function upcomingSeasonReminder(date) {
    var d = date instanceof Date ? new Date(date.getTime()) : new Date();
    var year = d.getFullYear();
    var windows = [
      { key: "easter", label: "Easter / Spring", start: new Date(year, 2, 20) },
      {
        key: "fourth_of_july",
        label: "Fourth of July",
        start: new Date(year, 5, 20),
      },
      { key: "halloween", label: "Halloween", start: new Date(year, 9, 1) },
      { key: "christmas", label: "Christmas", start: new Date(year, 11, 1) },
      {
        key: "easter",
        label: "Easter / Spring",
        start: new Date(year + 1, 2, 20),
      },
      {
        key: "fourth_of_july",
        label: "Fourth of July",
        start: new Date(year + 1, 5, 20),
      },
      {
        key: "halloween",
        label: "Halloween",
        start: new Date(year + 1, 9, 1),
      },
      {
        key: "christmas",
        label: "Christmas",
        start: new Date(year + 1, 11, 1),
      },
    ];
    var now = d.getTime();
    for (var i = 0; i < windows.length; i++) {
      var w = windows[i];
      if (w.start.getTime() > now) {
        var months = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        return {
          key: w.key,
          label: w.label,
          monthLabel: months[w.start.getMonth()],
          start: w.start,
        };
      }
    }
    return null;
  }

  function equals(a, b) {
    var x = normalize(a);
    var y = normalize(b);
    var keys = Object.keys(DEFAULTS);
    for (var i = 0; i < keys.length; i++) {
      if (x[keys[i]] !== y[keys[i]]) return false;
    }
    return true;
  }

  function applyToElement(el, appearance, options) {
    if (!el) return;
    var opts = options || {};
    var a = normalize(appearance);
    var seasonal = opts.forceSeasonal
      ? pick(opts.forceSeasonal, SEASONAL, "off")
      : resolveSeasonalTheme(a, opts.date);
    var heroUrl = opts.heroUrlOverride || resolveHeroUrl(a);

    el.setAttribute("data-theme", a.base_theme);
    el.setAttribute("data-season", seasonal === "off" ? "off" : seasonal);
    el.setAttribute("data-accent", a.accent);
    el.setAttribute("data-decor", a.decorative_accent);
    el.setAttribute("data-hero-overlay", a.hero_overlay);
    el.setAttribute("data-hero-text", a.hero_text_position);
    el.setAttribute("data-bg", a.background_style);
    el.setAttribute("data-cards", a.product_card_style);
    el.setAttribute("data-hero-dx", a.hero_position_desktop_x);
    el.setAttribute("data-hero-dy", a.hero_position_desktop_y);
    el.setAttribute("data-hero-mx", a.hero_position_mobile_x);
    el.setAttribute("data-hero-my", a.hero_position_mobile_y);
    el.style.setProperty("--hero-object-desktop", desktopObjectPosition(a));
    el.style.setProperty("--hero-object-mobile", mobileObjectPosition(a));

    var imgs = el.querySelectorAll
      ? el.querySelectorAll("[data-appearance-hero], .hero-bg-img, .sf-prev-hero-img")
      : [];
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].getAttribute("src") !== heroUrl) {
        imgs[i].setAttribute("src", heroUrl);
      }
      imgs[i].style.objectPosition = "";
    }
  }

  function applyToDocument(appearance, options) {
    applyToElement(document.documentElement, appearance, options);
    if (document.body) applyToElement(document.body, appearance, options);
    var heroImg = document.querySelector(".hero-bg-img");
    if (heroImg) {
      var url = (options && options.heroUrlOverride) || resolveHeroUrl(appearance);
      if (heroImg.getAttribute("src") !== url) heroImg.setAttribute("src", url);
    }
  }

  async function fetchAppearance(supabaseClient) {
    if (!supabaseClient) return cloneDefaults();
    try {
      var result = await supabaseClient
        .from("site_settings")
        .select("config")
        .limit(1)
        .maybeSingle();
      if (result.error) return cloneDefaults();
      var cfg =
        result.data && result.data.config && typeof result.data.config === "object"
          ? result.data.config
          : {};
      return normalize(cfg.appearance);
    } catch (err) {
      return cloneDefaults();
    }
  }

  global.SRAppearance = {
    DEFAULTS: DEFAULTS,
    DEFAULT_HERO_URL: DEFAULT_HERO_URL,
    ACCENTS: ACCENTS,
    DECORATIVE: DECORATIVE,
    HERO_OVERLAYS: HERO_OVERLAYS,
    HERO_POSITIONS: HERO_TEXT_POSITIONS,
    HERO_X: HERO_X,
    HERO_Y: HERO_Y,
    BACKGROUNDS: BACKGROUNDS,
    CARD_STYLES: CARD_STYLES,
    SEASONAL: SEASONAL,
    MODES: MODES,
    normalize: normalize,
    cloneDefaults: cloneDefaults,
    resolveHeroUrl: resolveHeroUrl,
    desktopObjectPosition: desktopObjectPosition,
    mobileObjectPosition: mobileObjectPosition,
    automaticSeasonalTheme: automaticSeasonalTheme,
    resolveSeasonalTheme: resolveSeasonalTheme,
    upcomingSeasonReminder: upcomingSeasonReminder,
    equals: equals,
    applyToElement: applyToElement,
    applyToDocument: applyToDocument,
    fetchAppearance: fetchAppearance,
  };
})(typeof window !== "undefined" ? window : globalThis);
