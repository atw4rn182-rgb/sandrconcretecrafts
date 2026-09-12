/* ===== S & R Crafts Concrete Creations — storefront (vanilla JS) ===== */
(function () {
  "use strict";

  // Demo catalog kept for local / pre-cutover use when USE_LIVE_CATALOG is not true.
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

  let products = liveMode ? [] : DEMO_PRODUCTS.slice();
  let catalogReady = !liveMode;
  let catalogError = null;
  let activeCategory = "all";
  let cart = [];
  let modalProduct = null;
  let modalQty = 1;

  const $ = (sel) => document.querySelector(sel);
  const money = (n) => "$" + Number(n).toFixed(2);
  const esc = (s) => (Cat && Cat.escapeHtml ? Cat.escapeHtml(s) : String(s == null ? "" : s));
  const escAttr = (s) => (Cat && Cat.escapeAttr ? Cat.escapeAttr(s) : esc(s));

  function findProduct(id) {
    return products.find((p) => p.id === id) || null;
  }

  function visibleProducts() {
    if (activeCategory === "all") return products.slice();
    return products.filter(function (p) {
      return (p.categories || []).some(function (c) {
        return c && (c.id === activeCategory || c.slug === activeCategory);
      });
    });
  }

  function collectCategories() {
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

  function unitPrice(p) {
    if (!p) return 0;
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
  const heroGalleryStatus = $("#heroGalleryStatus");
  const heroMosaic = $("#heroMosaic");
  const filterWrap = $("#collectionFilters");
  const filterChips = $("#filterChips");
  const navToggle = $("#navToggle");
  const aboutPhoto = $("#aboutPhoto");

  function closeNav() {
    document.body.classList.remove("nav-open");
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open menu");
    }
  }

  function toggleNav() {
    var open = !document.body.classList.contains("nav-open");
    document.body.classList.toggle("nav-open", open);
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
  }

  function renderHeroGallery() {
    if (!heroGalleryStatus || !heroMosaic) return;
    if (liveMode && !catalogReady && !catalogError) {
      heroMosaic.hidden = true;
      heroGalleryStatus.hidden = false;
      heroGalleryStatus.classList.remove("is-empty");
      heroGalleryStatus.textContent = "Loading pieces…";
      return;
    }
    if (liveMode && catalogError) {
      heroMosaic.hidden = true;
      heroGalleryStatus.hidden = false;
      heroGalleryStatus.classList.add("is-empty");
      heroGalleryStatus.textContent = "Gallery unavailable while the catalog loads.";
      return;
    }
    var picks = products.filter(function (p) {
      return p.img;
    });
    // Prefer featured, then first available photos
    picks.sort(function (a, b) {
      return Number(!!b.featured) - Number(!!a.featured);
    });
    picks = picks.slice(0, 3);
    if (!picks.length) {
      heroMosaic.hidden = true;
      heroGalleryStatus.hidden = false;
      heroGalleryStatus.classList.add("is-empty");
      heroGalleryStatus.textContent = "New pieces will appear here when published.";
      return;
    }
    heroGalleryStatus.hidden = true;
    heroMosaic.hidden = false;
    heroMosaic.innerHTML = picks
      .map(function (p) {
        return (
          '<figure class="hero-tile">' +
          '<img src="' +
          escAttr(safeImgSrc(p)) +
          '" alt="' +
          escAttr(p.alt || p.name) +
          '" loading="eager" />' +
          "<figcaption>" +
          esc(p.name) +
          "</figcaption>" +
          "</figure>"
        );
      })
      .join("");

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
          return { id: String(l.id), qty: Math.max(1, Number(l.qty) || 1) };
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
      var max = maxQtyFor(p);
      var qty = Math.min(line.qty, max);
      if (qty < 1) {
        removed += 1;
        return;
      }
      var existing = next.find(function (l) {
        return l.id === resolved;
      });
      if (existing) existing.qty = Math.min(max, existing.qty + qty);
      else next.push({ id: resolved, qty: qty });
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

  function addToCart(id, qty) {
    qty = qty == null ? 1 : qty;
    var p = findProduct(id);
    if (!p) {
      toast("That item is no longer available.");
      return;
    }
    if (!canPurchase(p)) {
      toast("That item is sold out.");
      return;
    }
    var max = maxQtyFor(p);
    var line = cart.find(function (l) {
      return l.id === id;
    });
    var nextQty = (line ? line.qty : 0) + qty;
    if (nextQty > max) {
      toast(
        p.trackInventory
          ? "Only " + max + " available."
          : "Quantity limit reached."
      );
      nextQty = max;
    }
    if (nextQty < 1) return;
    if (line) line.qty = nextQty;
    else cart.push({ id: id, qty: nextQty });
    updateCart(true);
    toast(p.name + " added to cart");
  }

  function setQty(id, qty) {
    var line = cart.find(function (l) {
      return l.id === id;
    });
    if (!line) return;
    var p = findProduct(id);
    if (!p || !canPurchase(p)) {
      removeFromCart(id);
      toast("Removed an unavailable item from your cart.");
      return;
    }
    var max = maxQtyFor(p);
    line.qty = Math.min(Math.max(0, qty), max);
    if (line.qty <= 0) cart = cart.filter(function (l) {
      return l.id !== id;
    });
    updateCart();
  }

  function removeFromCart(id) {
    cart = cart.filter(function (l) {
      return l.id !== id;
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
      return s + unitPrice(p) * l.qty;
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
          return (
            '<div class="cart-line cart-line--missing" data-id="' +
            escAttr(l.id) +
            '">' +
            "<p>Item no longer available</p>" +
            '<button class="cart-line-remove" data-remove="' +
            escAttr(l.id) +
            '">Remove</button>' +
            "</div>"
          );
        }
        var price = unitPrice(p);
        return (
          '<div class="cart-line" data-id="' +
          escAttr(p.id) +
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
          '<span class="line-price">' +
          esc(money(price)) +
          "</span>" +
          '<div class="cart-line-qty">' +
          '<button type="button" data-dec="' +
          escAttr(p.id) +
          '" aria-label="Decrease">−</button>' +
          "<span>" +
          esc(String(l.qty)) +
          "</span>" +
          '<button type="button" data-inc="' +
          escAttr(p.id) +
          '" aria-label="Increase">+</button>' +
          "</div>" +
          '<button type="button" class="cart-line-remove" data-remove="' +
          escAttr(p.id) +
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
  function openModal(id) {
    closeNav();
    modalProduct = findProduct(id);
    if (!modalProduct) {
      toast("That item is no longer available.");
      return;
    }
    modalQty = 1;
    const img = $("#modalImg");
    img.src = safeImgSrc(modalProduct);
    img.dataset.seed = modalProduct.seed;
    img.onerror = function () {
      this.onerror = null;
      this.src = fallback(modalProduct.seed);
    };
    img.alt = modalProduct.alt || modalProduct.name;
    $("#modalTitle").textContent = modalProduct.name;
    if (modalProduct.salePrice != null) {
      $("#modalPrice").innerHTML =
        esc(money(modalProduct.salePrice)) +
        ' <span class="price-was">' +
        esc(money(modalProduct.price)) +
        "</span>";
    } else {
      $("#modalPrice").textContent = money(unitPrice(modalProduct));
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
    modalOverlay.classList.add("open");
    document.body.classList.add("no-scroll");
  }
  function closeModal() {
    modalOverlay.classList.remove("open");
    if (!isCartOpen() && !isCheckoutOpen()) document.body.classList.remove("no-scroll");
  }
  const isCartOpen = () => cartDrawer.classList.contains("open");

  const checkoutEl = $("#checkout");
  const isCheckoutOpen = () => checkoutEl.classList.contains("open");

  async function refreshCatalogBeforeCheckout() {
    if (!liveMode || !Cat) return true;
    try {
      var fresh = await Cat.fetchStorefrontProducts();
      products = fresh;
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

  async function openCheckout() {
    if (cart.length === 0) {
      toast("Your cart is empty");
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
    renderCheckoutSummary();
    $("#checkoutForm").style.display = "";
    $("#checkoutSuccess").hidden = true;
    $(".checkout-summary").style.display = "";
    closeCart();
    checkoutEl.classList.add("open");
    document.body.classList.add("no-scroll");
    checkoutEl.scrollTop = 0;
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
        return (
          '<div class="summary-row">' +
          '<img src="' +
          escAttr(safeImgSrc(p)) +
          '" alt="' +
          escAttr(p.alt || p.name) +
          '" />' +
          "<div><div class=\"s-name\">" +
          esc(p.name) +
          '</div><div class="s-qty">Qty ' +
          esc(String(l.qty)) +
          "</div></div>" +
          '<div class="s-price">' +
          esc(money(unitPrice(p) * l.qty)) +
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
    if (navToggle) {
      navToggle.addEventListener("click", toggleNav);
    }
    document.querySelectorAll(".nav-links a").forEach(function (link) {
      link.addEventListener("click", closeNav);
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
        addToCart(addBtn.dataset.add);
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
    $("#modalAdd").addEventListener("click", function () {
      if (!modalProduct || !canPurchase(modalProduct)) return;
      addToCart(modalProduct.id, modalQty);
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
        setQty(
          inc.dataset.inc,
          (cart.find(function (l) {
            return l.id === inc.dataset.inc;
          }) || { qty: 0 }).qty + 1
        );
      }
      if (dec) {
        setQty(
          dec.dataset.dec,
          (cart.find(function (l) {
            return l.id === dec.dataset.dec;
          }) || { qty: 0 }).qty - 1
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
      catalogReady = true;
      catalogError = null;
      reconcileCart(true);
      renderProducts();
      updateCart();
    } catch (err) {
      products = [];
      catalogReady = false;
      catalogError = (err && err.message) || "Catalog request failed.";
      // Never fall back to demo products when live mode is on.
      renderProducts();
      updateCart();
    }
  }

  async function init() {
    bind();
    if (liveMode) {
      await loadLiveCatalog(false);
    } else {
      reconcileCart(false);
      renderProducts();
      updateCart();
    }
  }

  init();
})();
