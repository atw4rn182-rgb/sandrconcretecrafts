/**
 * Post to Socials — Admin share workflow for one or many products.
 *
 * No platform account is connected yet, so nothing is published from here.
 * Each platform uses the phone's share menu (photos + caption) or an official
 * share link. A platform with a `publish` function and `connected: true`
 * (from a future server status) can post directly without changing the sheet.
 */
(function (global) {
  "use strict";

  var SITE = "https://www.sandrconcretecrafts.com";
  var MAX_PRODUCTS = 10;
  var DEFAULT_INTRO =
    "New inventory drop from S&R Concrete Crafts! Check out our newest pieces.";
  var SINGLE_INTRO =
    "New inventory drop from S&R Concrete Crafts! Check out our newest piece.";
  var HASHTAGS = "#SandRConcreteCrafts #Handmade #ConcreteDecor";

  var PLATFORMS = [
    {
      id: "facebook",
      label: "Facebook",
      connected: false,
      publish: null,
      shareHint: "Opens your phone’s share menu. Choose Facebook.",
      webLink: function (link) {
        return "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(link);
      },
      setupNote: "Automatic posting needs a Facebook Page connected through a Meta app.",
    },
    {
      id: "instagram",
      label: "Instagram",
      connected: false,
      publish: null,
      shareHint: "Opens your phone’s share menu. Choose Instagram, then paste the caption.",
      webLink: null,
      setupNote:
        "Automatic posting needs an Instagram Business account linked to a Facebook Page and Meta app review.",
    },
    {
      id: "tiktok",
      label: "TikTok",
      connected: false,
      publish: null,
      shareHint: "Opens your phone’s share menu. Choose TikTok, then paste the caption.",
      webLink: null,
      setupNote: "Automatic posting needs TikTok Content Posting API approval.",
    },
  ];

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function money(value) {
    var n = Number(value);
    return isFinite(n) && n > 0 ? "$" + n.toFixed(2) : "";
  }

  function shownPrice(product) {
    var price = Number(product.price) || 0;
    var sale = product.sale_price == null ? null : Number(product.sale_price);
    return sale != null && isFinite(sale) && sale > 0 && sale < price ? sale : price;
  }

  function isPublic(product) {
    return product && (product.status === "published" || product.status === "sold_out");
  }

  /** Single product: its own page. Several: their shared category, else the shop. */
  function linkFor(products) {
    var list = products || [];
    if (list.length === 1 && list[0] && list[0].id) {
      return SITE + "/?product=" + encodeURIComponent(list[0].id);
    }
    var common = null;
    list.forEach(function (product) {
      var slugs = ((product && product.categories) || [])
        .filter(function (c) {
          return c && c.slug && c.active !== false;
        })
        .map(function (c) {
          return String(c.slug);
        });
      common =
        common === null
          ? slugs
          : common.filter(function (slug) {
              return slugs.indexOf(slug) !== -1;
            });
    });
    if (common && common.length) return SITE + "/?category=" + encodeURIComponent(common[0]);
    return SITE + "/";
  }

  function buildCaption(products, link) {
    var list = products || [];
    var lines = [list.length === 1 ? SINGLE_INTRO : DEFAULT_INTRO, ""];
    list.forEach(function (product) {
      var price = money(shownPrice(product));
      lines.push("• " + String(product.title || "New piece").trim() + (price ? " — " + price : ""));
    });
    lines.push("");
    lines.push((list.length === 1 ? "Shop it here: " : "Shop the new pieces: ") + link);
    lines.push("");
    lines.push(HASHTAGS);
    return lines.join("\n");
  }

  function photoUrl(product) {
    var raw = product && product.primary && product.primary.image_url;
    if (!raw) return "";
    return global.SRImageDisplay ? global.SRImageDisplay.displayUrl(raw, "detail") : raw;
  }

  function fileSlug(title) {
    return (
      String(title || "piece")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "piece"
    );
  }

  function toJpeg(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            function (out) {
              URL.revokeObjectURL(url);
              if (out) resolve(out);
              else reject(new Error("Photo conversion failed."));
            },
            "image/jpeg",
            0.9
          );
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Photo could not be read."));
      };
      img.src = url;
    });
  }

  // Instagram and TikTok accept JPEG/PNG from the share menu, not WebP.
  async function photoFile(product, index) {
    var url = photoUrl(product);
    if (!url) return null;
    var response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) return null;
    var blob = await response.blob();
    if (!/^image\/(jpeg|png)$/i.test(blob.type)) blob = await toJpeg(blob);
    var ext = /png$/i.test(blob.type) ? "png" : "jpg";
    return new File([blob], "sandr-" + fileSlug(product.title) + "-" + (index + 1) + "." + ext, {
      type: blob.type,
    });
  }

  function canShareFiles(files) {
    try {
      return !!(
        navigator.share &&
        navigator.canShare &&
        files.length &&
        navigator.canShare({ files: files })
      );
    } catch (err) {
      return false;
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        /* fall through to the selection copy */
      }
    }
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    area.remove();
    return ok;
  }

  var state = null;

  function close() {
    if (!state) return;
    document.removeEventListener("keydown", state.onKey);
    state.root.remove();
    document.body.classList.remove("action-sheet-open");
    var done = state.onClose;
    state = null;
    if (typeof done === "function") done();
  }

  function setStatus(message, kind) {
    if (!state) return;
    var el = state.root.querySelector("[data-social-status]");
    el.textContent = message || "";
    el.className = "social-status" + (kind ? " social-status--" + kind : "");
  }

  function selectedPlatforms() {
    if (!state) return [];
    return PLATFORMS.filter(function (platform) {
      var box = state.root.querySelector('[data-platform-check="' + platform.id + '"]');
      return box && box.checked;
    });
  }

  function captionText() {
    return state ? state.root.querySelector("#socialCaption").value : "";
  }

  function paintSteps() {
    if (!state) return;
    var wrap = state.root.querySelector("[data-social-steps]");
    var platforms = selectedPlatforms();
    if (!platforms.length) {
      wrap.innerHTML = '<p class="social-muted">Choose at least one platform above.</p>';
      return;
    }
    var nativeReady = state.filesReady && canShareFiles(state.files);
    wrap.innerHTML = platforms
      .map(function (platform) {
        var result = state.results[platform.id] || "";
        var action = platform.connected && platform.publish ? "Post to " : "Share to ";
        var disabled = !state.filesReady && !platform.webLink;
        return (
          '<div class="social-step">' +
          '<button type="button" class="btn btn-primary btn-block" data-share-platform="' +
          esc(platform.id) +
          '"' +
          (disabled ? " disabled" : "") +
          ">" +
          esc(action + platform.label) +
          "</button>" +
          '<p class="social-muted">' +
          esc(
            nativeReady || !platform.webLink
              ? platform.shareHint
              : "Opens Facebook’s share page with the product link."
          ) +
          "</p>" +
          (result ? '<p class="social-step-result">' + esc(result) + "</p>" : "") +
          "</div>"
        );
      })
      .join("");
  }

  async function shareTo(platformId) {
    if (!state) return;
    var platform = PLATFORMS.find(function (p) {
      return p.id === platformId;
    });
    if (!platform) return;
    var caption = captionText().trim();
    if (!caption) {
      setStatus("Add a caption first.", "err");
      return;
    }
    if (platform.connected && typeof platform.publish === "function") {
      setStatus("Posting to " + platform.label + "…");
      try {
        await platform.publish({ products: state.products, caption: caption, link: state.link });
        state.results[platform.id] = "Posted.";
        setStatus("");
      } catch (err) {
        state.results[platform.id] = (err && err.message) || "Posting failed. Nothing was posted.";
        setStatus("");
      }
      paintSteps();
      return;
    }
    var copied = await copyText(caption);
    if (canShareFiles(state.files)) {
      try {
        await navigator.share({ files: state.files, text: caption, title: "S&R Concrete Crafts" });
        state.results[platform.id] =
          "Share menu opened" + (copied ? " — caption copied, paste it if the app didn’t fill it in." : ".");
        setStatus("Finish the post in " + platform.label + ". Nothing is posted until you tap Share there.", "ok");
      } catch (err) {
        if (err && err.name === "AbortError") {
          state.results[platform.id] = "Canceled. Nothing was posted.";
          setStatus("");
        } else {
          state.results[platform.id] = "The share menu didn’t open. Use Download photos and Copy caption below.";
        }
      }
      paintSteps();
      return;
    }
    if (platform.webLink) {
      global.open(platform.webLink(state.link), "_blank", "noopener");
      state.results[platform.id] = copied
        ? "Facebook opened in a new tab. Caption copied — paste it into the post."
        : "Facebook opened in a new tab.";
      paintSteps();
      return;
    }
    state.results[platform.id] =
      "This browser can’t hand photos to " +
      platform.label +
      ". Download the photos, copy the caption, and post from the " +
      platform.label +
      " app.";
    paintSteps();
  }

  async function downloadPhotos() {
    if (!state || !state.files.length) return;
    state.files.forEach(function (file) {
      var url = URL.createObjectURL(file);
      var a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 4000);
    });
    setStatus(state.files.length === 1 ? "Photo downloaded." : state.files.length + " photos downloaded.", "ok");
  }

  async function preparePhotos() {
    var current = state;
    var files = [];
    for (var i = 0; i < current.products.length; i++) {
      try {
        var file = await photoFile(current.products[i], i);
        if (file) files.push(file);
      } catch (err) {
        /* a missing photo should not block the others */
      }
      if (state !== current) return;
    }
    current.files = files;
    current.filesReady = true;
    var missing = current.products.length - files.length;
    var label = current.root.querySelector("[data-photo-status]");
    label.textContent = files.length
      ? files.length + (files.length === 1 ? " photo ready" : " photos ready") +
        (missing ? " · " + missing + " without a photo" : "")
      : "No photos could be prepared. You can still copy the caption.";
    current.root.querySelector("[data-download-photos]").disabled = !files.length;
    paintSteps();
  }

  function sheetHtml(products, link, caption) {
    var hidden = products.filter(function (p) {
      return !isPublic(p);
    });
    return (
      '<div class="action-sheet-backdrop" data-social-close></div>' +
      '<div class="action-sheet-panel social-panel" role="dialog" aria-modal="true" aria-labelledby="socialTitle">' +
      '<div class="admin-more-handle" aria-hidden="true"></div>' +
      '<h2 id="socialTitle">Post to Socials</h2>' +
      '<p class="action-sheet-sub">' +
      esc(products.length === 1 ? "1 product selected" : products.length + " products in one post") +
      "</p>" +
      '<ul class="social-photos">' +
      products
        .map(function (p) {
          var url = p.primary && p.primary.image_url;
          var img =
            url && global.SRImageDisplay
              ? global.SRImageDisplay.imgTag(url, { preset: "adminThumb", alt: "", width: 64, height: 64 })
              : '<span class="social-photo-empty">No photo</span>';
          return '<li class="social-photo">' + img + "<span>" + esc(p.title || "Untitled") + "</span></li>";
        })
        .join("") +
      "</ul>" +
      '<p class="social-muted" data-photo-status>Preparing photos…</p>' +
      (hidden.length
        ? '<p class="social-warn">' +
          esc(
            hidden.length === 1
              ? "“" + (hidden[0].title || "One product") + "” isn’t published, so shoppers can’t open it yet."
              : hidden.length + " selected products aren’t published, so shoppers can’t open them yet."
          ) +
          "</p>"
        : "") +
      '<label class="social-field" for="socialCaption"><span>Caption</span></label>' +
      '<textarea id="socialCaption" class="social-caption" rows="8">' +
      esc(caption) +
      "</textarea>" +
      '<div class="social-caption-tools">' +
      '<button type="button" class="btn btn-ghost btn-small" data-reset-caption>Reset caption</button>' +
      '<button type="button" class="btn btn-ghost btn-small" data-copy-caption>Copy caption</button>' +
      "</div>" +
      '<p class="social-link">Link: <a href="' +
      esc(link) +
      '" target="_blank" rel="noopener">' +
      esc(link.replace(/^https:\/\//, "")) +
      "</a></p>" +
      '<fieldset class="social-platforms"><legend>Where to share</legend>' +
      PLATFORMS.map(function (platform) {
        return (
          '<label class="social-platform">' +
          '<input type="checkbox" data-platform-check="' +
          esc(platform.id) +
          '" checked />' +
          "<span><strong>" +
          esc(platform.label) +
          "</strong><em>" +
          esc(platform.connected ? "Connected" : "Share menu · not connected") +
          "</em></span></label>"
        );
      }).join("") +
      "</fieldset>" +
      '<div class="social-steps" data-social-steps></div>' +
      '<p class="social-status" data-social-status role="status" aria-live="polite"></p>' +
      '<div class="social-secondary">' +
      '<button type="button" class="btn btn-ghost btn-block" data-download-photos disabled>Download photos</button>' +
      '<button type="button" class="btn btn-ghost btn-block" data-social-close>Cancel</button>' +
      "</div>" +
      '<details class="social-setup"><summary>About automatic posting</summary>' +
      "<p>Nothing is posted automatically yet. You finish each post in the app.</p><ul>" +
      PLATFORMS.map(function (platform) {
        return "<li><strong>" + esc(platform.label) + ":</strong> " + esc(platform.setupNote) + "</li>";
      }).join("") +
      "</ul></details>" +
      "</div>"
    );
  }

  /**
   * Open the share sheet for products from the Admin list.
   * Products need id, title, price, sale_price, status, categories, primary.
   */
  function open(products, options) {
    options = options || {};
    close();
    var list = (products || []).filter(function (p) {
      return p && p.id;
    });
    if (!list.length) return;
    list = list.slice(0, MAX_PRODUCTS);
    var link = linkFor(list);
    var caption = buildCaption(list, link);
    var root = document.createElement("div");
    root.className = "action-sheet social-sheet";
    root.innerHTML = sheetHtml(list, link, caption);
    document.body.appendChild(root);
    document.body.classList.add("action-sheet-open");
    state = {
      root: root,
      products: list,
      link: link,
      defaultCaption: caption,
      files: [],
      filesReady: false,
      results: {},
      onClose: options.onClose,
      onKey: function (event) {
        if (event.key === "Escape") close();
      },
    };
    document.addEventListener("keydown", state.onKey);
    root.addEventListener("click", function (event) {
      var target = event.target;
      if (target.closest("[data-social-close]")) {
        close();
        return;
      }
      var shareBtn = target.closest("[data-share-platform]");
      if (shareBtn) {
        shareTo(shareBtn.getAttribute("data-share-platform"));
        return;
      }
      if (target.closest("[data-reset-caption]")) {
        root.querySelector("#socialCaption").value = state.defaultCaption;
        setStatus("Caption reset.");
        return;
      }
      if (target.closest("[data-copy-caption]")) {
        copyText(captionText()).then(function (ok) {
          setStatus(ok ? "Caption copied." : "Select the caption and copy it.", ok ? "ok" : "err");
        });
        return;
      }
      if (target.closest("[data-download-photos]")) downloadPhotos();
    });
    root.addEventListener("change", function (event) {
      if (event.target.closest("[data-platform-check]")) paintSteps();
    });
    paintSteps();
    preparePhotos();
    var first = root.querySelector("#socialCaption");
    if (first && global.matchMedia && global.matchMedia("(min-width: 900px)").matches) first.focus();
  }

  global.SRSocialShare = {
    MAX_PRODUCTS: MAX_PRODUCTS,
    PLATFORMS: PLATFORMS,
    DEFAULT_INTRO: DEFAULT_INTRO,
    linkFor: linkFor,
    buildCaption: buildCaption,
    open: open,
    close: close,
  };
})(typeof window !== "undefined" ? window : globalThis);
