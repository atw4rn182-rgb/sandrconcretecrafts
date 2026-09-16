/* ===== S&R Concrete Crafts — storefront (vanilla JS) ===== */
(function () {
  "use strict";

  // Demo catalog kept only when USE_LIVE_CATALOG is not true.
  // When live catalog is enabled, this array is never used as a fallback.
  const DEMO_PRODUCTS = [
    {
      id: "cow",
      name: "Highland Cow Head Wall Mount",
      price: 10,
      itemNo: "3-30",
      tag: "Bestseller",
      tagSoft: false,
      desc: "A bold Highland cow head wall mount with long flowing hair and sweeping horns, finished in a smooth glossy white. A statement piece for any wall, indoors or on a covered porch.",
      img: "assets/prod-01.png",
      seed: "cow",
    },
    {
      id: "raccoon",
      name: "Bespectacled Raccoon Planter",
      price: 12,
      itemNo: "22-36",
      tag: "",
      tagSoft: false,
      desc: "An adorable bespectacled raccoon planter cast in raw cement — ready for a small succulent or to paint your own way. Sold unpainted.",
      img: "assets/prod-02.png",
      seed: "raccoon",
    },
    {
      id: "bigfoot",
      name: "Bigfoot Footprint Stepping Stone",
      price: 8,
      itemNo: "22-23",
      tag: "",
      tagSoft: false,
      desc: "A rugged Bigfoot footprint stepping stone with a flag, mountains, and Sasquatch scene. Raw concrete, perfect for a garden path. Sold unpainted.",
      img: "assets/prod-03.png",
      seed: "bigfoot",
    },
    {
      id: "turtle",
      name: "Turtle Stepping Stone Paver",
      price: 15,
      tag: "",
      tagSoft: false,
      desc: "A detailed turtle stepping stone paver with a textured shell, cast in solid concrete to anchor any garden walkway. Sold unpainted.",
      img: "assets/prod-04.png",
      seed: "turtle",
    },
    {
      id: "deer-skull",
      name: "Deer Skull & Flag Wall Plaque",
      price: 15,
      itemNo: "D-29",
      tag: "",
      tagSoft: false,
      desc: "A deer skull and American flag wall plaque with crisp, layered detail. Cast and ready to hang or paint to match your space. Sold unpainted.",
      img: "assets/prod-05.png",
      seed: "deer-skull",
    },
    {
      id: "pirate-skull",
      name: "Pirate Skull & Swords Wall Hanging",
      price: 20,
      itemNo: "D-22",
      tag: "",
      tagSoft: false,
      desc: "A pirate skull with crossed swords and bandana — a chunky wall hanging cast in cement. Sold unpainted and ready to finish.",
      img: "assets/prod-06.png",
      seed: "pirate-skull",
    },
    {
      id: "snowman-tray",
      name: "Snowman Sectioned Tray",
      price: 12,
      itemNo: "C-28",
      tag: "",
      tagSoft: false,
      desc: "A charming snowman serving tray with sectioned wells for snacks, dips, or trinkets. Cast in cement. Sold unpainted.",
      img: "assets/prod-07.png",
      seed: "snowman-tray",
    },
    {
      id: "feather-dish",
      name: "Feather Trinket Dish",
      price: 15,
      tag: "",
      tagSoft: false,
      desc: "A hand-painted feather trinket dish in turquoise, silver, and cream — the perfect catch-all for rings, keys, and small treasures.",
      img: "assets/prod-08.png",
      seed: "feather-dish",
    },
    {
      id: "eagle",
      name: "Hand-Painted Bald Eagle Figurine",
      price: 20,
      tag: "",
      tagSoft: false,
      desc: "A majestic hand-painted bald eagle perched among pines, with a second eagle in flight. A finished, ready-to-display piece.",
      img: "assets/prod-09.png",
      seed: "eagle",
    },
    {
      id: "crystal-skull",
      name: "Crystal & Pearl Skull",
      price: 15,
      tag: "New",
      tagSoft: true,
      desc: "A serene blue skull accented with pearls and raw crystal clusters around the eyes. A hand-finished decorative piece with a soft, ethereal look.",
      img: "assets/prod-10.png",
      seed: "crystal-skull",
    },
    {
      id: "succulent-skull",
      name: "Succulent Skull Planter",
      price: 18,
      tag: "Bestseller",
      tagSoft: false,
      desc: "A hand-painted skull planter crowned with bright succulents and pebble detailing. A little cheeky, a lot of charm — ready to display.",
      img: "assets/prod-11.png",
      seed: "succulent-skull",
    },
    {
      id: "lion",
      name: "Lion Head Wall Mount",
      price: 20,
      tag: "",
      tagSoft: false,
      desc: "A richly hand-painted lion head wall mount with a full golden mane. A warm, regal accent for any room.",
      img: "assets/prod-12.png",
      seed: "lion",
    },
    {
      id: "rooster",
      name: "Rooster Garden Planter",
      price: 18,
      tag: "",
      tagSoft: false,
      desc: "A cheerful hand-painted rooster planter in fiery reds, oranges, and deep green. A farmhouse favorite for herbs or blooms.",
      img: "assets/prod-13.png",
      seed: "rooster",
    },
    {
      id: "headdress-skull",
      name: "Tribal Skull Headdress Plaque",
      price: 18,
      tag: "New",
      tagSoft: true,
      desc: "A striking tribal skull with a red-and-yellow feathered headdress, hand-painted in fine detail. Ready to hang.",
      img: "assets/prod-14.png",
      seed: "headdress-skull",
    },
    {
      id: "frenchie",
      name: "French Bulldog Figurine",
      price: 15,
      tag: "",
      tagSoft: false,
      desc: "A sweet sitting French bulldog figurine, hand-painted with personality. Available in several coat colors — inspired by our own frenchies!",
      img: "assets/prod-15.png",
      seed: "frenchie",
    },
    {
      id: "evil-skulls",
      name: "See / Hear / Speak No Evil Skull Trio",
      price: 15,
      tag: "",
      tagSoft: false,
      desc: "A trio of 'see no, hear no, speak no evil' skulls in a glossy bronze glaze with crisp white skeleton hands. Sold as a set of three.",
      img: "assets/prod-16r.png",
      seed: "evil-skulls",
    },
    {
      id: "mushroom-jars",
      name: "Mushroom Stash Jars (1-Up Set)",
      price: 18,
      tag: "New",
      tagSoft: true,
      desc: "A playful set of mushroom stash jars with lift-off caps in classic green 1-Up and red. Hand-painted — equal parts cute and functional.",
      img: "assets/prod-17r.png",
      seed: "mushroom-jars",
    },
  ].map(normalizeDemoProduct);

  function normalizeDemoProduct(p) {
    return {
      id: p.id,
      sourceKey: "legacy:" + p.id,
      legacyId: p.id,
      name: p.name,
      desc: p.desc,
      price: p.price,
      paintedPrice: null,
      salePrice: null,
      effectivePrice: p.price,
      itemNo: p.itemNo || "",
      tag: p.tag || "",
      tagSoft: !!p.tagSoft,
      img: p.img,
      alt: p.name,
      seed: p.seed || p.id,
      status: "published",
      soldOut: false,
      trackInventory: false,
      quantity: 0,
      featured: p.tag === "Bestseller",
      categories: [],
      productType: "single",
    };
  }

  const SHIPPING_THRESHOLD = 50;
  const SHIPPING_FEE = 6;
  const CART_KEY = "sr_cart_v1";

  const Cat = window.SRStorefrontCatalog || null;
  const liveMode = !!(Cat && Cat.useLiveCatalog && Cat.useLiveCatalog());

  function stripeCheckoutEnabled() {
    var env = window.__SR_ENV__ || {};
    // Build writes a real boolean; also accept the string "true".
    return (
      env.USE_STRIPE_CHECKOUT === true ||
      String(env.USE_STRIPE_CHECKOUT || "").toLowerCase() === "true"
    );
  }

  let products = liveMode ? [] : DEMO_PRODUCTS.slice();
  let storefrontCategories = [];
  let catalogReady = !liveMode;
  let catalogError = null;
  let activeCategory = "all";
  let cart = [];
  let modalProduct = null;
  let modalQty = 1;
  let modalFinish = "raw";
  let verifiedCheckoutReturn = false;

  const $ = (sel) => document.querySelector(sel);
  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return "—";
    return "$" + v.toFixed(2);
  }
  const esc = (s) => (Cat && Cat.escapeHtml ? Cat.escapeHtml(s) : String(s == null ? "" : s));
  const escAttr = (s) => (Cat && Cat.escapeAttr ? Cat.escapeAttr(s) : esc(s));

  function findProduct(id) {
    return products.find((p) => p.id === id) || null;
  }

  function visibleProducts() {
    var list = products.slice();
    var p = prefs();
    if (!p.show_sold_out) {
      list = list.filter(function (item) {
        return canPurchase(item);
      });
    }
    if (p.featured_first) {
      list.sort(function (a, b) {
        return Number(!!b.featured) - Number(!!a.featured);
      });
    }
    if (activeCategory === "all") return list;
    return list.filter(function (item) {
      return (item.categories || []).some(function (c) {
        return c && (c.id === activeCategory || c.slug === activeCategory);
      });
    });
  }

  function categoriesFromProducts() {
    var map = {};
    products.forEach(function (p) {
      (p.categories || []).forEach(function (c) {
        if (!c || !c.id || c.active === false) return;
        if (!map[c.id]) map[c.id] = { id: c.id, name: c.name || c.slug || "Category", slug: c.slug };
      });
    });
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        return String(a.name).localeCompare(String(b.name));
      });
  }

  function collectCategories() {
    if (liveMode) return storefrontCategories.slice();
    return categoriesFromProducts();
  }

  async function loadStorefrontCategories() {
    if (!liveMode || !Cat || !Cat.fetchStorefrontCategories) {
      storefrontCategories = categoriesFromProducts();
      return;
    }
    storefrontCategories = await Cat.fetchStorefrontCategories();
  }

  function normalizeFinish(value) {
    var finish = String(value == null ? "raw" : value).toLowerCase();
    return finish === "painted" ? "painted" : "raw";
  }

  function finishLabel(finish) {
    return normalizeFinish(finish) === "painted" ? "Painted" : "Raw Concrete";
  }

  function hasPaintedOption(p) {
    return !!(p && p.paintedPrice != null && Number(p.paintedPrice) > 0);
  }

  function lineKey(id, finish) {
    return String(id) + "::" + normalizeFinish(finish);
  }

  function unitPrice(p, finish) {
    if (!p) return 0;
    if (normalizeFinish(finish) === "painted") {
      return hasPaintedOption(p) ? Number(p.paintedPrice) : 0;
    }
    return p.effectivePrice != null ? Number(p.effectivePrice) : Number(p.price) || 0;
  }

  function canPurchase(p) {
    return !!(p && !p.soldOut && p.status !== "sold_out");
  }

  function maxQtyFor(p) {
    if (!p || !canPurchase(p)) return 0;
    if (p.trackInventory) return Math.max(0, Number(p.quantity) || 0);
    return 99;
  }

  function fallback(seed) {
    return "https://picsum.photos/seed/sr-" + encodeURIComponent(seed || "item") + "/800/600";
  }

  function safeImgSrc(p) {
    var url = p && p.img;
    if (Cat && Cat.isSafeImageUrl && !Cat.isSafeImageUrl(url)) {
      return fallback(p && p.seed);
    }
    if (Cat && Cat.normalizeImageUrl) {
      var n = Cat.normalizeImageUrl(url);
      return n || fallback(p && p.seed);
    }
    return url || fallback(p && p.seed);
  }

  const grid = $("#productGrid");
  const cartCount = $("#cartCount");
  const cartDrawer = $("#cartDrawer");
  const cartBackdrop = $("#cartBackdrop");
  const cartItemsEl = $("#cartItems");
  const cartTotalEl = $("#cartTotal");
  const toastEl = $("#toast");
  const catalogStatus = $("#catalogStatus");
  const filterWrap = $("#collectionFilters");
  const filterChips = $("#filterChips");
  const navToggle = $("#navToggle");
  const navPanel = $("#primaryNav");
  const aboutPhoto = $("#aboutPhoto");
  var navOutsideArmed = false;

  function closeNav() {
    navOutsideArmed = false;
    document.body.classList.remove("nav-open");
    if (navPanel) {
      navPanel.classList.remove("is-open");
      navPanel.setAttribute("aria-hidden", "true");
    }
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open menu");
    }
  }

  function openNav() {
    document.body.classList.add("nav-open");
    if (navPanel) {
      navPanel.classList.add("is-open");
      navPanel.setAttribute("aria-hidden", "false");
    }
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", "true");
      navToggle.setAttribute("aria-label", "Close menu");
    }
    // Arm outside-tap close after this gesture finishes (avoids same-tap close).
    window.setTimeout(function () {
      if (document.body.classList.contains("nav-open")) navOutsideArmed = true;
    }, 0);
  }

  function toggleNav(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (document.body.classList.contains("nav-open")) closeNav();
    else openNav();
  }

  function renderHeroGallery() {
    // Lifestyle hero replaced the product mosaic; still seed About photo from catalog.
    var picks = products.filter(function (p) {
      return p.img;
    });
    picks.sort(function (a, b) {
      return Number(!!b.featured) - Number(!!a.featured);
    });
    if (aboutPhoto && picks[0]) {
      aboutPhoto.style.backgroundImage =
        'url("' + String(safeImgSrc(picks[0])).replace(/"/g, "") + '")';
      aboutPhoto.classList.add("has-image");
    }
  }

  function renderFilters() {
    if (!filterWrap || !filterChips) return;
    var cats = collectCategories();
    if (!cats.length) {
      filterWrap.hidden = true;
      filterChips.innerHTML = "";
      activeCategory = "all";
      return;
    }
    // Reset filter if the selected category disappeared
    if (
      activeCategory !== "all" &&
      !cats.some(function (c) {
        return c.id === activeCategory;
      })
    ) {
      activeCategory = "all";
    }
    filterWrap.hidden = false;
    var chips = [{ id: "all", name: "All" }].concat(cats);
    filterChips.innerHTML = chips
      .map(function (c) {
        var active = activeCategory === c.id;
        return (
          '<button type="button" class="filter-chip' +
          (active ? " is-active" : "") +
          '" data-category="' +
          escAttr(c.id) +
          '" aria-pressed="' +
          (active ? "true" : "false") +
          '">' +
          esc(c.name) +
          "</button>"
        );
      })
      .join("");
  }

  function loadCartRaw() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(function (l) {
          return {
            id: String(l.id),
            finish: normalizeFinish(l.finish),
            qty: Math.max(1, Number(l.qty) || 1),
          };
        })
        .filter(function (l) {
          return l.id;
        });
    } catch (e) {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {
      /* ignore quota */
    }
  }

  function reconcileCart(notice) {
    var raw = loadCartRaw();
    var next = [];
    var removed = 0;
    var remapped = 0;
    raw.forEach(function (line) {
      var resolved =
        Cat && Cat.resolveCartProductId
          ? Cat.resolveCartProductId(line.id, products)
          : findProduct(line.id)
            ? line.id
            : null;
      if (!resolved) {
        removed += 1;
        return;
      }
      if (resolved !== line.id) remapped += 1;
      var p = findProduct(resolved);
      if (!p || !canPurchase(p)) {
        removed += 1;
        return;
      }
      var finish = normalizeFinish(line.finish);
      if (finish === "painted" && !hasPaintedOption(p)) {
        removed += 1;
        return;
      }
      var max = maxQtyFor(p);
      var alreadyKept = next.reduce(function (sum, kept) {
        return kept.id === resolved ? sum + kept.qty : sum;
      }, 0);
      var qty = Math.min(line.qty, Math.max(0, max - alreadyKept));
      if (qty < 1) {
        removed += 1;
        return;
      }
      var existing = next.find(function (l) {
        return l.id === resolved && l.finish === finish;
      });
      if (existing) existing.qty = Math.min(max, existing.qty + qty);
      else next.push({ id: resolved, finish: finish, qty: qty });
    });
    cart = next;
    saveCart();
    if (notice && (removed || remapped)) {
      var parts = [];
      if (remapped) parts.push("updated " + remapped + " saved item" + (remapped === 1 ? "" : "s"));
      if (removed) parts.push("removed " + removed + " unavailable item" + (removed === 1 ? "" : "s"));
      toast("Cart " + parts.join(" and ") + ".");
    }
  }

  function showCatalogStatus(kind, message, retryable) {
    if (!catalogStatus) return;
    if (!kind) {
      catalogStatus.hidden = true;
      catalogStatus.innerHTML = "";
      catalogStatus.className = "catalog-status";
      return;
    }
    catalogStatus.hidden = false;
    catalogStatus.className = "catalog-status catalog-status--" + kind;
    var html = "<p>" + esc(message) + "</p>";
    if (retryable) {
      html +=
        '<button type="button" class="btn btn-ghost catalog-retry" id="catalogRetry">Try again</button>';
    }
    catalogStatus.innerHTML = html;
    var btn = $("#catalogRetry");
    if (btn) btn.addEventListener("click", function () {
      loadLiveCatalog(true);
    });
  }

  function priceHtml(p) {
    if (hasPaintedOption(p)) {
      return (
        '<span class="price">From ' +
        esc(money(Math.min(unitPrice(p, "raw"), unitPrice(p, "painted")))) +
        "</span>"
      );
    }
    if (p.salePrice != null) {
      return (
        '<span class="price">' +
        esc(money(p.salePrice)) +
        '</span><span class="price-was">' +
        esc(money(p.price)) +
        "</span>"
      );
    }
    return '<span class="price">' + esc(money(unitPrice(p))) + "</span>";
  }

  function shortDesc(desc) {
    var d = String(desc || "").trim();
    if (!d) return "";
    var first = d.split(".")[0];
    return first ? first + "." : d;
  }

  function renderProducts() {
    renderHeroGallery();
    renderFilters();
    if (!grid) return;
    if (liveMode && !catalogReady && !catalogError) {
      grid.innerHTML = "";
      showCatalogStatus("loading", "Loading the collection…", false);
      return;
    }
    if (liveMode && catalogError) {
      grid.innerHTML = "";
      showCatalogStatus(
        "error",
        catalogError + " The shop catalog could not be loaded.",
        true
      );
      return;
    }
    if (!products.length) {
      grid.innerHTML = "";
      showCatalogStatus(
        "empty",
        liveMode
          ? "No products are published yet. Check back soon, or ask the shop owner to publish items in admin."
          : "No products to show.",
        false
      );
      return;
    }
    var list = visibleProducts();
    if (!list.length) {
      grid.innerHTML = "";
      showCatalogStatus("empty", "No pieces in this category right now.", false);
      return;
    }
    showCatalogStatus(null);
    grid.innerHTML = list
      .map(function (p) {
        var sold = !canPurchase(p);
        var tag =
          p.tag
            ? '<span class="card-tag ' +
              (p.tagSoft ? "card-tag--soft" : "") +
              '">' +
              esc(p.tag) +
              "</span>"
            : "";
        var soldBadge = sold
          ? '<span class="card-sold" aria-hidden="true">Sold out</span>'
          : "";
        var lowStock = "";
        if (
          prefs().show_low_stock &&
          !sold &&
          p.trackInventory &&
          Number(p.quantity) > 0 &&
          Number(p.quantity) <= 3
        ) {
          lowStock =
            '<span class="card-low-stock">Only ' +
            esc(String(p.quantity)) +
            " left</span>";
        }
        var addBtn = sold
          ? '<button class="add add--disabled" type="button" disabled aria-disabled="true">Unavailable</button>'
          : '<button class="add" type="button" data-add="' +
            escAttr(p.id) +
            '">Add</button>';
        return (
          '<article class="card' +
          (sold ? " card--sold-out" : "") +
          (p.featured ? " card--featured" : "") +
          '" data-id="' +
          escAttr(p.id) +
          '" tabindex="0" role="button" aria-label="Quick view: ' +
          escAttr(p.name) +
          '">' +
          '<div class="card-img">' +
          tag +
          soldBadge +
          '<img src="' +
          escAttr(safeImgSrc(p)) +
          '" data-seed="' +
          escAttr(p.seed) +
          '" alt="' +
          escAttr(p.alt || p.name) +
          '" loading="lazy" />' +
          '<div class="card-quick">Quick view</div>' +
          "</div>" +
          '<div class="card-body">' +
          "<h3>" +
          esc(p.name) +
          "</h3>" +
          (p.itemNo
            ? '<span class="card-item">Item #' + esc(p.itemNo) + "</span>"
            : "") +
          lowStock +
          '<p class="card-desc">' +
          esc(shortDesc(p.desc)) +
          "</p>" +
          '<div class="card-foot">' +
          '<div class="card-prices">' +
          priceHtml(p) +
          "</div>" +
          addBtn +
          "</div>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2400);
  }

  function storefrontShareUrl() {
    var canonical = document.querySelector('link[rel="canonical"]');
    try {
      return new URL(canonical && canonical.href ? canonical.href : window.location.href).href;
    } catch (err) {
      return window.location.href;
    }
  }

  function productShareUrl(product) {
    var base = storefrontShareUrl();
    if (!product || !product.id) return base;
    try {
      var url = new URL(base);
      url.searchParams.set("product", product.id);
      url.hash = "";
      return url.toString();
    } catch (err) {
      return base;
    }
  }

  async function shareLink(opts) {
    opts = opts || {};
    var url = opts.url || storefrontShareUrl();
    var title = opts.title || document.title;
    var text = opts.text || "Take a look at S&R Concrete Crafts.";
    var copiedLabel = opts.copiedLabel || "Shop link copied";
    var status = $("#shareStatus");
    var manual = $("#shareManual");
    var input = $("#shareUrl");
    if (manual) manual.hidden = true;

    if (navigator.share) {
      try {
        await navigator.share({ title: title, text: text, url: url });
        if (status) status.textContent = "Share options opened.";
        return;
      } catch (err) {
        if (err && err.name === "AbortError") {
          if (status) status.textContent = "Share canceled.";
          return;
        }
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        toast(copiedLabel);
        if (status) status.textContent = copiedLabel + ".";
        return;
      } catch (err) {
        /* expose a selectable link below */
      }
    }

    if (manual && input) {
      input.value = url;
      manual.hidden = false;
      input.focus();
      input.select();
      if (status) status.textContent = "Copy the selected shop link.";
    }
  }

  function shareStorefront() {
    return shareLink({
      url: storefrontShareUrl(),
      text: "Take a look at S&R Concrete Crafts.",
      copiedLabel: "Shop link copied",
    });
  }

  function shareProduct(product) {
    if (!product) return Promise.resolve();
    return shareLink({
      url: productShareUrl(product),
      title: product.name || document.title,
      text: "Take a look at " + (product.name || "this piece") + " from S&R Concrete Crafts.",
      copiedLabel: "Piece link copied",
    });
  }

  function requestedProductId() {
    try {
      return new URL(window.location.href).searchParams.get("product");
    } catch (err) {
      return null;
    }
  }

  function openSharedProduct() {
    var id = requestedProductId();
    if (id && findProduct(id)) openModal(id);
  }

  function initReviewBanner() {
    var banner = $("#reviewBanner");
    var link = $("#reviewBannerLink");
    var close = $("#reviewBannerClose");
    if (!banner || !link || !link.getAttribute("href")) return;
    var artwork = link.querySelector("img");
    var artworkReady = false;
    if (artwork) {
      var hideMissingArtwork = function () {
        artwork.hidden = true;
        banner.hidden = true;
      };
      artwork.addEventListener("error", hideMissingArtwork);
      if (artwork.complete && !artwork.naturalWidth) hideMissingArtwork();
      else artworkReady = !artwork.hidden;
    }
    if (!artworkReady) return;

    try {
      if (sessionStorage.getItem("sr_review_banner_dismissed") === "1") return;
    } catch (err) {
      /* session storage can be unavailable */
    }

    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var scrollHideTimer = null;
    var importantUiOpen = function () {
      return (
        document.body.classList.contains("nav-open") ||
        document.body.classList.contains("no-scroll")
      );
    };
    var updateVisibility = function (scrolling) {
      if (banner.getAttribute("data-dismissed") === "1") return;
      var hide = !!scrolling || importantUiOpen();
      banner.classList.toggle("is-scroll-hidden", hide);
    };
    var reveal = function () {
      if (banner.getAttribute("data-dismissed") === "1") return;
      banner.hidden = false;
      if (reducedMotion) {
        banner.classList.add("is-ready");
      } else {
        window.requestAnimationFrame(function () {
          banner.classList.add("is-ready");
        });
      }
      updateVisibility(false);
    };
    window.setTimeout(reveal, verifiedCheckoutReturn || reducedMotion ? 0 : 1800);

    if (close) {
      close.addEventListener("click", function () {
        banner.hidden = true;
        banner.setAttribute("data-dismissed", "1");
        try {
          sessionStorage.setItem("sr_review_banner_dismissed", "1");
        } catch (err) {
          /* dismissal still lasts for this page */
        }
      });
    }

    window.addEventListener("scroll", function () {
      updateVisibility(true);
      window.clearTimeout(scrollHideTimer);
      scrollHideTimer = window.setTimeout(function () {
        updateVisibility(false);
      }, reducedMotion ? 0 : 420);
    }, { passive: true });
    updateVisibility(false);
  }

  function addToCart(id, qty, finish) {
    qty = qty == null ? 1 : qty;
    finish = normalizeFinish(finish);
    var p = findProduct(id);
    if (!p) {
      toast("That item is no longer available.");
      return;
    }
    if (!canPurchase(p)) {
      toast("That item is sold out.");
      return;
    }
    if (finish === "painted" && !hasPaintedOption(p)) {
      toast("Painted finish isn’t available for that item.");
      return;
    }
    var max = maxQtyFor(p);
    var line = cart.find(function (l) {
      return l.id === id && l.finish === finish;
    });
    var otherQty = cart.reduce(function (sum, l) {
      return l.id === id && l !== line ? sum + l.qty : sum;
    }, 0);
    var nextQty = (line ? line.qty : 0) + qty;
    var lineMax = Math.max(0, max - otherQty);
    if (nextQty > lineMax) {
      toast(
        p.trackInventory
          ? "Only " + max + " available."
          : "Quantity limit reached."
      );
      nextQty = lineMax;
    }
    if (nextQty < 1) return;
    if (line) line.qty = nextQty;
    else cart.push({ id: id, finish: finish, qty: nextQty });
    updateCart(true);
    toast(
      p.name +
        (hasPaintedOption(p) ? " — " + finishLabel(finish) : "") +
        " added to cart"
    );
  }

  function setQty(key, qty) {
    var line = cart.find(function (l) {
      return lineKey(l.id, l.finish) === key;
    });
    if (!line) return;
    var p = findProduct(line.id);
    if (!p || !canPurchase(p)) {
      removeFromCart(key);
      toast("Removed an unavailable item from your cart.");
      return;
    }
    var max = maxQtyFor(p);
    var otherQty = cart.reduce(function (sum, item) {
      return item.id === line.id && item !== line ? sum + item.qty : sum;
    }, 0);
    line.qty = Math.min(Math.max(0, qty), Math.max(0, max - otherQty));
    if (line.qty <= 0) cart = cart.filter(function (l) {
      return lineKey(l.id, l.finish) !== key;
    });
    updateCart();
  }

  function removeFromCart(key) {
    cart = cart.filter(function (l) {
      return lineKey(l.id, l.finish) !== key;
    });
    updateCart();
  }

  function cartCountTotal() {
    return cart.reduce(function (s, l) {
      return s + l.qty;
    }, 0);
  }

  function cartSubtotal() {
    return cart.reduce(function (s, l) {
      var p = findProduct(l.id);
      if (!p) return s;
      return s + unitPrice(p, l.finish) * l.qty;
    }, 0);
  }

  function shippingFor(subtotal) {
    if (cart.length === 0) return 0;
    return subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  }

  function updateCart(bump) {
    saveCart();
    var count = cartCountTotal();
    cartCount.textContent = count;
    cartCount.classList.toggle("show", count > 0);
    if (bump && count > 0) {
      cartCount.classList.remove("bump");
      void cartCount.offsetWidth;
      cartCount.classList.add("bump");
    }

    cartDrawer.classList.toggle("empty", cart.length === 0);

    cartItemsEl.innerHTML = cart
      .map(function (l) {
        var p = findProduct(l.id);
        if (!p) {
          var missingKey = lineKey(l.id, l.finish);
          return (
            '<div class="cart-line cart-line--missing" data-key="' +
            escAttr(missingKey) +
            '">' +
            "<p>Item no longer available</p>" +
            '<button class="cart-line-remove" data-remove="' +
            escAttr(missingKey) +
            '">Remove</button>' +
            "</div>"
          );
        }
        var key = lineKey(p.id, l.finish);
        var price = unitPrice(p, l.finish);
        var finishHtml =
          hasPaintedOption(p) || l.finish === "painted"
            ? '<span class="line-finish">' + esc(finishLabel(l.finish)) + "</span>"
            : "";
        return (
          '<div class="cart-line" data-key="' +
          escAttr(key) +
          '">' +
          '<img src="' +
          escAttr(safeImgSrc(p)) +
          '" alt="' +
          escAttr(p.alt || p.name) +
          '" />' +
          '<div class="cart-line-info">' +
          "<h4>" +
          esc(p.name) +
          "</h4>" +
          finishHtml +
          '<span class="line-price">' +
          esc(money(price)) +
          "</span>" +
          '<div class="cart-line-qty">' +
          '<button type="button" data-dec="' +
          escAttr(key) +
          '" aria-label="Decrease">−</button>' +
          "<span>" +
          esc(String(l.qty)) +
          "</span>" +
          '<button type="button" data-inc="' +
          escAttr(key) +
          '" aria-label="Increase">+</button>' +
          "</div>" +
          '<button type="button" class="cart-line-remove" data-remove="' +
          escAttr(key) +
          '">Remove</button>' +
          "</div>" +
          '<span class="line-total">' +
          esc(money(price * l.qty)) +
          "</span>" +
          "</div>"
        );
      })
      .join("");

    cartTotalEl.textContent = money(cartSubtotal());
  }

  function openCart() {
    closeNav();
    cartDrawer.classList.add("open");
    cartBackdrop.classList.add("open");
    document.body.classList.add("no-scroll");
  }
  function closeCart() {
    cartDrawer.classList.remove("open");
    cartBackdrop.classList.remove("open");
    if (!isCheckoutOpen()) document.body.classList.remove("no-scroll");
  }

  const modalOverlay = $("#modalOverlay");
  let modalReturnFocus = null;
  function modalFocusableElements() {
    return Array.from(
      modalOverlay.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (el) {
      return !el.closest("[hidden]");
    });
  }
  function openModal(id) {
    closeNav();
    modalProduct = findProduct(id);
    if (!modalProduct) {
      toast("That item is no longer available.");
      return;
    }
    modalReturnFocus = document.activeElement;
    modalQty = 1;
    modalFinish = "raw";
    const img = $("#modalImg");
    img.src = safeImgSrc(modalProduct);
    img.dataset.seed = modalProduct.seed;
    img.onerror = function () {
      this.onerror = null;
      this.src = fallback(modalProduct.seed);
    };
    img.alt = modalProduct.alt || modalProduct.name;
    $("#modalTitle").textContent = modalProduct.name;
    var finishChoice = $("#modalFinishChoice");
    if (hasPaintedOption(modalProduct)) {
      finishChoice.hidden = false;
      $("#modalRawPrice").textContent = money(unitPrice(modalProduct, "raw"));
      $("#modalPaintedPrice").textContent = money(unitPrice(modalProduct, "painted"));
      document.querySelectorAll('input[name="modalFinish"]').forEach(function (input) {
        input.checked = input.value === "raw";
      });
      $("#modalPrice").textContent = money(unitPrice(modalProduct, "raw"));
    } else if (modalProduct.salePrice != null) {
      finishChoice.hidden = true;
      $("#modalPrice").innerHTML =
        esc(money(modalProduct.salePrice)) +
        ' <span class="price-was">' +
        esc(money(modalProduct.price)) +
        "</span>";
    } else {
      finishChoice.hidden = true;
      $("#modalPrice").textContent = money(unitPrice(modalProduct, "raw"));
    }
    $("#modalDesc").textContent = modalProduct.desc;
    const tagEl = $("#modalTag");
    tagEl.textContent =
      modalProduct.tag ||
      (modalProduct.soldOut ? "Sold out" : "Hand-cast");
    $("#modalQty").textContent = modalQty;
    var addBtn = $("#modalAdd");
    if (!canPurchase(modalProduct)) {
      addBtn.disabled = true;
      addBtn.textContent = "Unavailable";
    } else {
      addBtn.disabled = false;
      addBtn.textContent = "Add to Cart";
    }
    var shareBtn = $("#modalShare");
    if (shareBtn) shareBtn.hidden = false;
    modalOverlay.classList.add("open");
    modalOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    window.setTimeout(function () {
      var target = hasPaintedOption(modalProduct)
        ? modalOverlay.querySelector('input[name="modalFinish"]:checked')
        : $("#modalClose");
      if (target) target.focus();
    }, 50);
  }
  function closeModal() {
    var restoreFocus = modalReturnFocus;
    modalReturnFocus = null;
    modalOverlay.classList.remove("open");
    modalOverlay.setAttribute("aria-hidden", "true");
    if (!isCartOpen() && !isCheckoutOpen()) document.body.classList.remove("no-scroll");
    if (restoreFocus && document.contains(restoreFocus)) restoreFocus.focus();
  }
  const isCartOpen = () => cartDrawer.classList.contains("open");

  const checkoutEl = $("#checkout");
  const isCheckoutOpen = () => checkoutEl.classList.contains("open");

  async function refreshCatalogBeforeCheckout() {
    if (!liveMode || !Cat) return true;
    try {
      var fresh = await Cat.fetchStorefrontProducts();
      products = fresh;
      try {
        await loadStorefrontCategories();
      } catch (categoryErr) {
        storefrontCategories = [];
      }
      catalogReady = true;
      catalogError = null;
      reconcileCart(true);
      renderProducts();
      updateCart();
      return true;
    } catch (err) {
      toast("Couldn’t refresh prices before checkout. Please try again.");
      return false;
    }
  }

  function syncCheckoutButtonLabel() {
    var btn = $("#cartCheckout");
    if (!btn) return;
    var enabled = stripeCheckoutEnabled();
    var env = window.__SR_ENV__ || {};
    btn.textContent = enabled ? "Checkout" : "Checkout (demo)";
    btn.setAttribute("data-use-stripe-checkout", enabled ? "true" : "false");
    btn.setAttribute(
      "data-sr-build-commit",
      env.BUILD_COMMIT ? String(env.BUILD_COMMIT) : ""
    );
    var note = $("#cartCheckoutNote");
    if (note) {
      note.textContent = enabled
        ? "Secure checkout · You’ll finish payment on Stripe’s page"
        : "Demo checkout only · No real payment is processed";
    }
  }

  var stripeCheckoutBusy = false;

  async function startStripeCheckout() {
    if (stripeCheckoutBusy) return;
    if (cart.length === 0) {
      toast("Your cart is empty");
      return;
    }
    if (!liveMode) {
      toast(
        "Real checkout needs the live catalog. Demo checkout is still available when Stripe is off."
      );
      return;
    }

    var ok = await refreshCatalogBeforeCheckout();
    if (!ok) return;
    reconcileCart(true);
    if (cart.length === 0) {
      toast("Your cart no longer has available items.");
      updateCart();
      return;
    }

    var items = cart
      .map(function (l) {
        var p = findProduct(l.id);
        if (!p || !canPurchase(p)) return null;
        return { id: l.id, finish: l.finish, quantity: l.qty };
      })
      .filter(Boolean);

    if (!items.length) {
      toast("Your cart no longer has available items.");
      return;
    }

    stripeCheckoutBusy = true;
    var btn = $("#cartCheckout");
    var prevLabel = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Starting checkout…";
    }

    try {
      var res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items: items }),
      });
      var data = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        data = null;
      }

      if (!res.ok || !data || !data.url) {
        // Client only gates on USE_STRIPE_CHECKOUT (see stripeCheckoutEnabled).
        // Never read or act on STRIPE_ALLOW_LIVE here — that is server-only.
        if (data && data.code === "STRIPE_NOT_CONFIGURED") {
          toast(
            "Stripe isn’t configured on the server yet — opening demo checkout."
          );
          await openDemoCheckout();
          return;
        }
        if (data && data.code === "STRIPE_LIVE_BLOCKED") {
          toast(
            "Checkout couldn’t start — the server isn’t ready for live payments yet. Please try again shortly."
          );
          return;
        }
        toast(
          (data && data.error) || "Couldn’t start checkout. Please try again."
        );
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      toast("Couldn’t reach checkout. Please try again.");
    } finally {
      stripeCheckoutBusy = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevLabel || "Checkout";
      }
    }
  }

  async function openDemoCheckout() {
    var ok = await refreshCatalogBeforeCheckout();
    if (!ok) return;
    reconcileCart(true);
    if (cart.length === 0) {
      toast("Your cart no longer has available items.");
      updateCart();
      return;
    }
    renderCheckoutSummary();
    $("#checkoutForm").style.display = "";
    $("#checkoutSuccess").hidden = true;
    $(".checkout-summary").style.display = "";
    closeCart();
    checkoutEl.classList.add("open");
    document.body.classList.add("no-scroll");
    checkoutEl.scrollTop = 0;
  }

  async function openCheckout() {
    if (cart.length === 0) {
      toast("Your cart is empty");
      return;
    }

    // Feature flag: Stripe Checkout Session redirect when enabled.
    // If the flag is off (or Stripe isn’t ready), keep the demo checkout UI.
    if (stripeCheckoutEnabled()) {
      await startStripeCheckout();
      return;
    }

    await openDemoCheckout();
  }

  async function handleCheckoutReturn() {
    var params;
    var status;
    try {
      params = new URLSearchParams(window.location.search);
      status = params.get("checkout");
      if (!status) return;
      if (status === "success") {
        var sessionId = params.get("session_id");
        var verified = false;
        if (sessionId) {
          var response = await fetch(
            "/api/verify-checkout-session?session_id=" +
              encodeURIComponent(sessionId),
            { headers: { Accept: "application/json" } }
          );
          var result = await response.json().catch(function () {
            return null;
          });
          verified = response.ok && result && result.verified === true;
        }
        if (verified) {
          verifiedCheckoutReturn = true;
          cart = [];
          updateCart();
          toast("Payment received — thank you!");
        } else {
          toast("Payment couldn’t be verified yet. Your cart was kept.");
        }
      } else if (status === "cancel") {
        toast("Checkout canceled. Your cart is still here.");
      }
    } catch (e) {
      if (status === "success") {
        toast("Payment couldn’t be verified yet. Your cart was kept.");
      }
    } finally {
      if (status && params) {
        params.delete("checkout");
        params.delete("session_id");
        var next = params.toString();
        var url =
          window.location.pathname +
          (next ? "?" + next : "") +
          window.location.hash;
        window.history.replaceState({}, "", url);
      }
    }
  }
  function closeCheckout() {
    checkoutEl.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }

  function renderCheckoutSummary() {
    const subtotal = cartSubtotal();
    const shipping = shippingFor(subtotal);
    const total = subtotal + shipping;

    $("#summaryItems").innerHTML = cart
      .map(function (l) {
        var p = findProduct(l.id);
        if (!p) return "";
        var finish =
          hasPaintedOption(p) || l.finish === "painted"
            ? '<div class="s-finish">' + esc(finishLabel(l.finish)) + "</div>"
            : "";
        return (
          '<div class="summary-row">' +
          '<img src="' +
          escAttr(safeImgSrc(p)) +
          '" alt="' +
          escAttr(p.alt || p.name) +
          '" />' +
          "<div><div class=\"s-name\">" +
          esc(p.name) +
          "</div>" +
          finish +
          '<div class="s-qty">Qty ' +
          esc(String(l.qty)) +
          "</div></div>" +
          '<div class="s-price">' +
          esc(money(unitPrice(p, l.finish) * l.qty)) +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    $("#sumSubtotal").textContent = money(subtotal);
    $("#sumShipping").textContent = shipping === 0 ? "Free" : money(shipping);
    $("#sumTotal").textContent = money(total);
    $("#checkoutPayAmt").textContent = money(total);
  }

  function completeOrder(e) {
    e.preventDefault();
    // Honest demo: no payment, no stock reservation, no real order.
    $("#orderNum").textContent = "DEMO-ONLY";
    var successTitle = $("#checkoutSuccess h2");
    var successCopy = $("#checkoutSuccess p");
    if (successTitle) successTitle.textContent = "Demo checkout only";
    if (successCopy) {
      successCopy.textContent =
        "No order was placed and no payment was processed. Real ordering isn’t connected yet — this walkthrough is for layout only.";
    }
    $("#checkoutForm").style.display = "none";
    $(".checkout-summary").style.display = "none";
    $("#checkoutSuccess").hidden = false;
    checkoutEl.scrollTop = 0;
    cart = [];
    updateCart();
  }

  function bind() {
    var shareButton = $("#storeShare");
    if (shareButton) shareButton.addEventListener("click", shareStorefront);
    var productShare = $("#modalShare");
    if (productShare) {
      productShare.addEventListener("click", function () {
        shareProduct(modalProduct);
      });
    }

    if (navToggle) {
      navToggle.addEventListener("click", toggleNav);
    }
    if (navPanel) {
      navPanel.setAttribute("aria-hidden", "true");
    }
    document.querySelectorAll(".nav-links a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
    document.addEventListener("click", function (e) {
      if (!navOutsideArmed || !document.body.classList.contains("nav-open")) return;
      if (e.target.closest("#navToggle") || e.target.closest("#primaryNav")) return;
      closeNav();
    });
    window.addEventListener("resize", function () {
      if (window.matchMedia("(min-width: 961px)").matches) closeNav();
    });

    if (filterChips) {
      filterChips.addEventListener("click", function (e) {
        var chip = e.target.closest("[data-category]");
        if (!chip) return;
        activeCategory = chip.getAttribute("data-category") || "all";
        renderProducts();
      });
    }

    grid.addEventListener("click", function (e) {
      var addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        e.stopPropagation();
        if (addBtn.disabled) return;
        var product = findProduct(addBtn.dataset.add);
        if (hasPaintedOption(product)) openModal(addBtn.dataset.add);
        else addToCart(addBtn.dataset.add, 1, "raw");
        return;
      }
      var card = e.target.closest(".card");
      if (card) openModal(card.dataset.id);
    });
    grid.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) {
        e.preventDefault();
        openModal(e.target.dataset.id);
      }
    });

    $("#modalClose").addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", function (e) {
      if (e.target === modalOverlay) closeModal();
    });
    $("#modalMinus").addEventListener("click", function () {
      modalQty = Math.max(1, modalQty - 1);
      $("#modalQty").textContent = modalQty;
    });
    $("#modalPlus").addEventListener("click", function () {
      if (!modalProduct) return;
      var max = maxQtyFor(modalProduct);
      if (modalQty >= max) {
        toast(modalProduct.trackInventory ? "Only " + max + " available." : "Quantity limit reached.");
        return;
      }
      modalQty += 1;
      $("#modalQty").textContent = modalQty;
    });
    document.querySelectorAll('input[name="modalFinish"]').forEach(function (input) {
      input.addEventListener("change", function () {
        if (!modalProduct || !input.checked) return;
        modalFinish = normalizeFinish(input.value);
        $("#modalPrice").textContent = money(unitPrice(modalProduct, modalFinish));
      });
    });
    $("#modalAdd").addEventListener("click", function () {
      if (!modalProduct || !canPurchase(modalProduct)) return;
      addToCart(modalProduct.id, modalQty, modalFinish);
      closeModal();
      openCart();
    });

    $("#cartOpen").addEventListener("click", openCart);
    $("#cartClose").addEventListener("click", closeCart);
    cartBackdrop.addEventListener("click", closeCart);
    cartItemsEl.addEventListener("click", function (e) {
      var inc = e.target.closest("[data-inc]");
      var dec = e.target.closest("[data-dec]");
      var rem = e.target.closest("[data-remove]");
      if (inc) {
        var incLine = cart.find(function (l) {
          return lineKey(l.id, l.finish) === inc.dataset.inc;
        });
        setQty(
          inc.dataset.inc,
          (incLine || { qty: 0 }).qty + 1
        );
      }
      if (dec) {
        var decLine = cart.find(function (l) {
          return lineKey(l.id, l.finish) === dec.dataset.dec;
        });
        setQty(
          dec.dataset.dec,
          (decLine || { qty: 0 }).qty - 1
        );
      }
      if (rem) removeFromCart(rem.dataset.remove);
    });
    $("#cartCheckout").addEventListener("click", openCheckout);

    $("#checkoutClose").addEventListener("click", closeCheckout);
    $("#checkoutForm").addEventListener("submit", completeOrder);
    $("#successDone").addEventListener("click", function () {
      closeCheckout();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Tab" && modalOverlay.classList.contains("open")) {
        var focusable = modalFocusableElements();
        if (!focusable.length) {
          e.preventDefault();
          return;
        }
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        var activeInside = modalOverlay.contains(document.activeElement);
        if (e.shiftKey && (!activeInside || document.activeElement === first)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (!activeInside || document.activeElement === last)) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.key !== "Escape") return;
      if (isCheckoutOpen()) closeCheckout();
      else if (modalOverlay.classList.contains("open")) closeModal();
      else if (isCartOpen()) closeCart();
      else if (document.body.classList.contains("nav-open")) closeNav();
    });
  }

  async function loadLiveCatalog(isRetry) {
    catalogError = null;
    catalogReady = false;
    if (isRetry) renderProducts();
    showCatalogStatus("loading", "Loading the collection…", false);
    try {
      products = await Cat.fetchStorefrontProducts();
      try {
        await loadStorefrontCategories();
      } catch (categoryErr) {
        // Keep the independently loaded products purchasable under ALL.
        storefrontCategories = [];
      }
      catalogReady = true;
      catalogError = null;
      reconcileCart(true);
      renderProducts();
      updateCart();
      openSharedProduct();
    } catch (err) {
      products = [];
      storefrontCategories = [];
      catalogReady = false;
      catalogError = (err && err.message) || "Catalog request failed.";
      // Never fall back to demo products when live mode is on.
      renderProducts();
      updateCart();
    }
  }

  async function loadAppearance() {
    try {
      if (typeof SRAppearance === "undefined") return;
      var client =
        typeof SRSupabase !== "undefined" && SRSupabase.isConfigured()
          ? SRSupabase.createClient()
          : null;
      var appearance = await SRAppearance.fetchAppearance(client);
      SRAppearance.applyToDocument(appearance);
    } catch (err) {
      if (typeof SRAppearance !== "undefined") {
        SRAppearance.applyToDocument(SRAppearance.cloneDefaults());
      }
    }
  }

  var storeSettings = null;

  async function loadStoreSettings() {
    try {
      if (typeof SRStoreSettings === "undefined") {
        storeSettings = null;
        return;
      }
      var client =
        typeof SRSupabase !== "undefined" && SRSupabase.isConfigured()
          ? SRSupabase.createClient()
          : null;
      storeSettings = await SRStoreSettings.fetchStoreSettings(client);
      SRStoreSettings.applyToDocument(storeSettings);
    } catch (err) {
      storeSettings =
        typeof SRStoreSettings !== "undefined"
          ? SRStoreSettings.cloneDefaults()
          : null;
      if (storeSettings && typeof SRStoreSettings !== "undefined") {
        SRStoreSettings.applyToDocument(storeSettings);
      }
    }
  }

  function prefs() {
    return (
      (storeSettings && storeSettings.storefront) || {
        show_sold_out: true,
        featured_first: true,
        show_low_stock: true,
        show_about: true,
        show_social_links: true,
      }
    );
  }

  async function init() {
    bind();
    syncCheckoutButtonLabel();
    await handleCheckoutReturn();
    // Theme + settings first so paint settles quickly; catalog can follow.
    await loadAppearance();
    await loadStoreSettings();
    initReviewBanner();
    if (liveMode) {
      await loadLiveCatalog(false);
    } else {
      reconcileCart(false);
      renderProducts();
      updateCart();
      openSharedProduct();
    }
  }

  init();
})();
