/**
 * Owner storefront / business settings model.
 * Safe for browser: no secrets. Public reads site_settings.config.*.
 * Does not touch config.appearance or config.sales_goals.
 */
(function (global) {
  "use strict";

  var DEFAULT_DESCRIPTION =
    "Handmade concrete pieces cast in small batches in Milan, New Mexico.";

  var DEFAULTS = {
    business: {
      name: "S&R Concrete Crafts",
      description: DEFAULT_DESCRIPTION,
      city: "Milan",
      state: "NM",
    },
    contact: {
      email: "",
      email_enabled: false,
      phone: "",
      phone_enabled: false,
    },
    social: {
      facebook: "",
      instagram: "",
      pinterest: "",
      tiktok: "",
    },
    announcement: {
      enabled: false,
      text: "",
      style: "neutral",
    },
    fulfillment: {
      pickup_enabled: true,
      pickup_label: "Local Pickup",
      pickup_instructions: "",
      shipping_enabled: true,
      shipping_note: "",
    },
    storefront: {
      show_sold_out: true,
      featured_first: true,
      show_low_stock: true,
      show_about: true,
      show_social_links: true,
    },
  };

  var ANNOUNCEMENT_STYLES = ["neutral", "sale", "seasonal"];
  var SOCIAL_KEYS = ["facebook", "instagram", "pinterest", "tiktok"];
  var MAX_DESC = 500;
  var MAX_ANNOUNCE = 160;
  var MAX_NAME = 80;
  var MAX_CITY = 60;
  var MAX_STATE = 40;
  var MAX_PHONE = 40;
  var MAX_EMAIL = 120;
  var MAX_URL = 400;
  var MAX_PICKUP_LABEL = 60;
  var MAX_NOTE = 240;

  function asBool(v, fallback) {
    if (typeof v === "boolean") return v;
    if (v === "true" || v === 1 || v === "1") return true;
    if (v === "false" || v === 0 || v === "0") return false;
    return fallback;
  }

  function cleanText(value, max) {
    var s = value == null ? "" : String(value);
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
    if (max && s.length > max) s = s.slice(0, max);
    return s;
  }

  function cleanUrl(value) {
    var s = cleanText(value, MAX_URL);
    if (!s) return "";
    if (/^javascript:/i.test(s) || /^data:/i.test(s)) return "";
    if (!/^https?:\/\//i.test(s)) {
      if (/^[\w.-]+\.[\w.-]+/.test(s)) s = "https://" + s;
      else return "";
    }
    try {
      var u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.toString().slice(0, MAX_URL);
    } catch (err) {
      return "";
    }
  }

  function cleanEmail(value) {
    var s = cleanText(value, MAX_EMAIL);
    if (!s) return "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "";
    return s.toLowerCase();
  }

  function cleanPhone(value) {
    var s = cleanText(value, MAX_PHONE);
    if (!s) return "";
    var digits = s.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return "";
    return s;
  }

  function pickStyle(value) {
    var v = cleanText(value, 20).toLowerCase();
    return ANNOUNCEMENT_STYLES.indexOf(v) >= 0 ? v : "neutral";
  }

  function normalizeState(value) {
    var s = cleanText(value, MAX_STATE);
    if (!s) return DEFAULTS.business.state;
    if (/^new\s*mexico$/i.test(s) || /^nm$/i.test(s)) return "NM";
    return s;
  }

  function normalizeCity(value) {
    var s = cleanText(value, MAX_CITY);
    return s || DEFAULTS.business.city;
  }

  function normalizeFromLegacy(cfg) {
    var src = cfg && typeof cfg === "object" ? cfg : {};
    var legacySocial = src.social && typeof src.social === "object" ? src.social : {};
    return {
      business: Object.assign({}, DEFAULTS.business, src.business || {}, {
        name:
          (src.business && src.business.name) ||
          src.site_name ||
          DEFAULTS.business.name,
        description:
          (src.business && src.business.description) ||
          src.tagline ||
          DEFAULTS.business.description,
      }),
      contact: Object.assign({}, DEFAULTS.contact, src.contact || {}, {
        email:
          (src.contact && src.contact.email) ||
          src.contact_email ||
          DEFAULTS.contact.email,
      }),
      social: Object.assign({}, DEFAULTS.social, {
        instagram: legacySocial.instagram || "",
        pinterest: legacySocial.pinterest || "",
      }, src.social || {}),
      announcement: Object.assign({}, DEFAULTS.announcement, src.announcement || {}),
      fulfillment: Object.assign({}, DEFAULTS.fulfillment, src.fulfillment || {}),
      storefront: Object.assign({}, DEFAULTS.storefront, src.storefront || {}),
    };
  }

  function normalize(raw) {
    var merged = normalizeFromLegacy(raw && typeof raw === "object" ? raw : {});
    var b = merged.business || {};
    var c = merged.contact || {};
    var s = merged.social || {};
    var a = merged.announcement || {};
    var f = merged.fulfillment || {};
    var st = merged.storefront || {};

    var social = {};
    SOCIAL_KEYS.forEach(function (key) {
      social[key] = cleanUrl(s[key]);
    });

    return {
      business: {
        name: cleanText(b.name, MAX_NAME) || DEFAULTS.business.name,
        description:
          cleanText(b.description, MAX_DESC) || DEFAULTS.business.description,
        city: normalizeCity(b.city),
        state: normalizeState(b.state),
      },
      contact: {
        email: cleanEmail(c.email),
        email_enabled: asBool(c.email_enabled, false) && !!cleanEmail(c.email),
        phone: cleanPhone(c.phone),
        phone_enabled: asBool(c.phone_enabled, false) && !!cleanPhone(c.phone),
      },
      social: social,
      announcement: {
        enabled: asBool(a.enabled, false) && !!cleanText(a.text, MAX_ANNOUNCE),
        text: cleanText(a.text, MAX_ANNOUNCE),
        style: pickStyle(a.style),
      },
      fulfillment: {
        pickup_enabled: asBool(f.pickup_enabled, true),
        pickup_label:
          cleanText(f.pickup_label, MAX_PICKUP_LABEL) ||
          DEFAULTS.fulfillment.pickup_label,
        pickup_instructions: cleanText(f.pickup_instructions, MAX_NOTE),
        shipping_enabled: asBool(f.shipping_enabled, true),
        shipping_note: cleanText(f.shipping_note, MAX_NOTE),
      },
      storefront: {
        show_sold_out: asBool(st.show_sold_out, true),
        featured_first: asBool(st.featured_first, true),
        show_low_stock: asBool(st.show_low_stock, true),
        show_about: asBool(st.show_about, true),
        show_social_links: asBool(st.show_social_links, true),
      },
    };
  }

  function cloneDefaults() {
    return normalize(DEFAULTS);
  }

  function equals(a, b) {
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
  }

  function validateDraft(raw) {
    var errors = [];
    var d = raw && typeof raw === "object" ? raw : {};
    var email = cleanText(d.contact && d.contact.email, MAX_EMAIL);
    var phone = cleanText(d.contact && d.contact.phone, MAX_PHONE);
    if (d.contact && d.contact.email_enabled && email && !cleanEmail(email)) {
      errors.push("Enter a valid public email, or turn email off.");
    }
    if (d.contact && d.contact.phone_enabled && phone && !cleanPhone(phone)) {
      errors.push("Enter a valid public phone number, or turn phone off.");
    }
    SOCIAL_KEYS.forEach(function (key) {
      var v = d.social && d.social[key];
      if (v && !cleanUrl(v)) {
        errors.push("Check the " + key + " link — use a full https:// URL.");
      }
    });
    if (
      d.announcement &&
      d.announcement.enabled &&
      !cleanText(d.announcement.text, MAX_ANNOUNCE)
    ) {
      errors.push("Add announcement text, or turn the announcement off.");
    }
    if (!cleanText(d.business && d.business.name, MAX_NAME)) {
      errors.push("Business name is required.");
    }
    return errors;
  }

  function locationLabel(settings) {
    var s = normalize(settings);
    var state =
      s.business.state === "NM" ? "New Mexico" : s.business.state;
    return s.business.city + ", " + state;
  }

  function activeSocialLinks(settings) {
    var s = normalize(settings);
    if (!s.storefront.show_social_links) return [];
    var labels = {
      facebook: "Facebook",
      instagram: "Instagram",
      pinterest: "Pinterest",
      tiktok: "TikTok",
    };
    return SOCIAL_KEYS.filter(function (k) {
      return !!s.social[k];
    }).map(function (k) {
      return { key: k, label: labels[k], url: s.social[k] };
    });
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value == null ? "" : String(value);
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
  }

  function applyToDocument(settings) {
    var s = normalize(settings);
    var root = document.documentElement;
    if (root) {
      root.setAttribute(
        "data-announce",
        s.announcement.enabled ? s.announcement.style : "off"
      );
      root.setAttribute(
        "data-show-about",
        s.storefront.show_about ? "true" : "false"
      );
    }

    // Announcement
    var banner = document.getElementById("storeAnnouncement");
    if (banner) {
      if (s.announcement.enabled && s.announcement.text) {
        banner.hidden = false;
        banner.setAttribute("data-style", s.announcement.style);
        var textEl = banner.querySelector("[data-announce-text]");
        setText(textEl, s.announcement.text);
      } else {
        banner.hidden = true;
      }
    }

    // Brand
    document.querySelectorAll("[data-settings-business-name]").forEach(function (el) {
      setText(el, s.business.name);
    });
    document.querySelectorAll("[data-settings-location]").forEach(function (el) {
      setText(el, locationLabel(s));
    });
    document.querySelectorAll("[data-settings-location-short]").forEach(function (el) {
      setText(el, s.business.city + ", " + s.business.state);
    });
    document.querySelectorAll("[data-settings-description]").forEach(function (el) {
      setText(el, s.business.description);
    });

    // About
    var about = document.getElementById("about");
    setHidden(about, !s.storefront.show_about);
    var aboutNav = document.querySelector('a[href="#about"]');
    if (aboutNav) setHidden(aboutNav.closest("li") || aboutNav, !s.storefront.show_about);

    // Contact
    var contactWrap = document.getElementById("footerContact");
    var emailEl = document.getElementById("footerEmail");
    var phoneEl = document.getElementById("footerPhone");
    var showEmail = s.contact.email_enabled && s.contact.email;
    var showPhone = s.contact.phone_enabled && s.contact.phone;
    if (emailEl) {
      if (showEmail) {
        emailEl.hidden = false;
        emailEl.href = "mailto:" + s.contact.email;
        setText(emailEl, s.contact.email);
      } else {
        emailEl.hidden = true;
        emailEl.removeAttribute("href");
        setText(emailEl, "");
      }
    }
    if (phoneEl) {
      if (showPhone) {
        phoneEl.hidden = false;
        phoneEl.href = "tel:" + s.contact.phone.replace(/[^\d+]/g, "");
        setText(phoneEl, s.contact.phone);
      } else {
        phoneEl.hidden = true;
        phoneEl.removeAttribute("href");
        setText(phoneEl, "");
      }
    }
    if (contactWrap) setHidden(contactWrap, !(showEmail || showPhone));

    // Social
    var socialWrap = document.getElementById("footerSocial");
    var links = activeSocialLinks(s);
    if (socialWrap) {
      socialWrap.innerHTML = "";
      if (!links.length) {
        socialWrap.hidden = true;
      } else {
        socialWrap.hidden = false;
        links.forEach(function (link) {
          var a = document.createElement("a");
          a.className = "footer-social-link";
          a.href = link.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = link.label;
          socialWrap.appendChild(a);
        });
      }
    }

    // Fulfillment notes
    var fulfill = document.getElementById("footerFulfillment");
    if (fulfill) {
      var parts = [];
      if (s.fulfillment.pickup_enabled) {
        parts.push(
          s.fulfillment.pickup_label +
            (s.fulfillment.pickup_instructions
              ? ": " + s.fulfillment.pickup_instructions
              : "")
        );
      }
      if (s.fulfillment.shipping_enabled && s.fulfillment.shipping_note) {
        parts.push(s.fulfillment.shipping_note);
      } else if (s.fulfillment.shipping_enabled) {
        parts.push("Shipping available");
      }
      if (parts.length) {
        fulfill.hidden = false;
        setText(fulfill, parts.join(" · "));
      } else {
        fulfill.hidden = true;
        setText(fulfill, "");
      }
    }

    var cartFulfill = document.getElementById("cartFulfillmentNote");
    if (cartFulfill) {
      var cartParts = [];
      if (s.fulfillment.pickup_enabled) {
        cartParts.push(s.fulfillment.pickup_label || "Local Pickup");
      }
      if (s.fulfillment.shipping_enabled) {
        cartParts.push(
          s.fulfillment.shipping_note
            ? s.fulfillment.shipping_note
            : "Shipping available"
        );
      }
      if (cartParts.length) {
        cartFulfill.hidden = false;
        setText(cartFulfill, cartParts.join(" · "));
      } else {
        cartFulfill.hidden = true;
        setText(cartFulfill, "");
      }
    }

    // JSON-LD — only fields that map to owner values
    try {
      var ld = document.getElementById("localBusinessJsonLd");
      if (ld) {
        var data = JSON.parse(ld.textContent);
        data.name = s.business.name;
        data.description = s.business.description;
        if (!data.address) data.address = {};
        data.address.addressLocality = s.business.city;
        data.address.addressRegion = s.business.state === "NM" ? "NM" : s.business.state;
        data.address.addressCountry = "US";
        if (data.areaServed) {
          data.areaServed.name = locationLabel(s);
        }
        if (showEmail) data.email = s.contact.email;
        else delete data.email;
        if (showPhone) data.telephone = s.contact.phone;
        else delete data.telephone;
        ld.textContent = JSON.stringify(data);
      }
    } catch (err) {
      /* leave existing JSON-LD */
    }

    return s;
  }

  async function fetchStoreSettings(supabaseClient) {
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
      return normalize(cfg);
    } catch (err) {
      return cloneDefaults();
    }
  }

  global.SRStoreSettings = {
    DEFAULTS: DEFAULTS,
    SOCIAL_KEYS: SOCIAL_KEYS,
    ANNOUNCEMENT_STYLES: ANNOUNCEMENT_STYLES,
    normalize: normalize,
    cloneDefaults: cloneDefaults,
    equals: equals,
    validateDraft: validateDraft,
    locationLabel: locationLabel,
    activeSocialLinks: activeSocialLinks,
    applyToDocument: applyToDocument,
    fetchStoreSettings: fetchStoreSettings,
    cleanUrl: cleanUrl,
    cleanEmail: cleanEmail,
    cleanPhone: cleanPhone,
  };
})(typeof window !== "undefined" ? window : globalThis);
