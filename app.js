/* ===== S & R Crafts Concrete Creations — demo store logic (vanilla JS) ===== */
(function () {
  "use strict";

  // --- Product data ---
  // Unsplash images (stable photo URLs) with a Lorem Picsum fallback per item.
  const PRODUCTS = [
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
  ];

  const SHIPPING_THRESHOLD = 50;
  const SHIPPING_FEE = 6;

  // --- State ---
  let cart = []; // { id, qty }
  let modalProduct = null;
  let modalQty = 1;

  // --- Helpers ---
  const $ = (sel) => document.querySelector(sel);
  const money = (n) => "$" + n.toFixed(2);
  const findProduct = (id) => PRODUCTS.find((p) => p.id === id);
  const fallback = (seed) => `https://picsum.photos/seed/sr-${seed}/800/600`;
  const imgError = "this.onerror=null;this.src='https://picsum.photos/seed/sr-'+this.dataset.seed+'/800/600';";

  // --- Elements ---
  const grid = $("#productGrid");
  const cartCount = $("#cartCount");
  const cartDrawer = $("#cartDrawer");
  const cartBackdrop = $("#cartBackdrop");
  const cartItemsEl = $("#cartItems");
  const cartTotalEl = $("#cartTotal");
  const toastEl = $("#toast");

  // --- Render product grid ---
  function renderProducts() {
    grid.innerHTML = PRODUCTS.map((p) => `
      <article class="card" data-id="${p.id}" tabindex="0" role="button" aria-label="Quick view: ${p.name}">
        <div class="card-img">
          ${p.tag ? `<span class="card-tag ${p.tagSoft ? "card-tag--soft" : ""}">${p.tag}</span>` : ""}
          <img src="${p.img}" data-seed="${p.seed}" onerror="${imgError}" alt="${p.name}" loading="lazy" />
          <div class="card-quick">Quick view</div>
        </div>
        <div class="card-body">
          <h3>${p.name}</h3>
          ${p.itemNo ? `<span class="card-item">Item #${p.itemNo}</span>` : ""}
          <p class="card-desc">${p.desc.split(".")[0]}.</p>
          <div class="card-foot">
            <span class="price">${money(p.price)}</span>
            <button class="add" data-add="${p.id}">Add</button>
          </div>
        </div>
      </article>
    `).join("");
  }

  // --- Toast ---
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  // --- Cart logic ---
  function addToCart(id, qty = 1) {
    const line = cart.find((l) => l.id === id);
    if (line) line.qty += qty;
    else cart.push({ id, qty });
    updateCart(true);
    toast(`${findProduct(id).name} added to cart`);
  }

  function setQty(id, qty) {
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    line.qty = qty;
    if (line.qty <= 0) cart = cart.filter((l) => l.id !== id);
    updateCart();
  }

  function removeFromCart(id) {
    cart = cart.filter((l) => l.id !== id);
    updateCart();
  }

  function cartCountTotal() {
    return cart.reduce((s, l) => s + l.qty, 0);
  }

  function cartSubtotal() {
    return cart.reduce((s, l) => s + findProduct(l.id).price * l.qty, 0);
  }

  function shippingFor(subtotal) {
    if (cart.length === 0) return 0;
    return subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  }

  function updateCart(bump) {
    const count = cartCountTotal();
    cartCount.textContent = count;
    cartCount.classList.toggle("show", count > 0);
    if (bump && count > 0) {
      cartCount.classList.remove("bump");
      void cartCount.offsetWidth; // reflow to restart animation
      cartCount.classList.add("bump");
    }

    cartDrawer.classList.toggle("empty", cart.length === 0);

    cartItemsEl.innerHTML = cart.map((l) => {
      const p = findProduct(l.id);
      return `
        <div class="cart-line" data-id="${p.id}">
          <img src="${p.img}" data-seed="${p.seed}" onerror="${imgError}" alt="${p.name}" />
          <div class="cart-line-info">
            <h4>${p.name}</h4>
            <span class="line-price">${money(p.price)}</span>
            <div class="cart-line-qty">
              <button data-dec="${p.id}" aria-label="Decrease">−</button>
              <span>${l.qty}</span>
              <button data-inc="${p.id}" aria-label="Increase">+</button>
            </div>
            <button class="cart-line-remove" data-remove="${p.id}">Remove</button>
          </div>
          <span class="line-total">${money(p.price * l.qty)}</span>
        </div>`;
    }).join("");

    cartTotalEl.textContent = money(cartSubtotal());
  }

  // --- Cart drawer open/close ---
  function openCart() {
    cartDrawer.classList.add("open");
    cartBackdrop.classList.add("open");
    document.body.classList.add("no-scroll");
  }
  function closeCart() {
    cartDrawer.classList.remove("open");
    cartBackdrop.classList.remove("open");
    if (!isCheckoutOpen()) document.body.classList.remove("no-scroll");
  }

  // --- Quick view modal ---
  const modalOverlay = $("#modalOverlay");
  function openModal(id) {
    modalProduct = findProduct(id);
    modalQty = 1;
    const img = $("#modalImg");
    img.src = modalProduct.img;
    img.dataset.seed = modalProduct.seed;
    img.onerror = function () { this.onerror = null; this.src = fallback(modalProduct.seed); };
    img.alt = modalProduct.name;
    $("#modalTitle").textContent = modalProduct.name;
    $("#modalPrice").textContent = money(modalProduct.price);
    $("#modalDesc").textContent = modalProduct.desc;
    const tagEl = $("#modalTag");
    tagEl.textContent = modalProduct.tag || "Hand-cast";
    $("#modalQty").textContent = modalQty;
    modalOverlay.classList.add("open");
    document.body.classList.add("no-scroll");
  }
  function closeModal() {
    modalOverlay.classList.remove("open");
    if (!isCartOpen() && !isCheckoutOpen()) document.body.classList.remove("no-scroll");
  }
  const isCartOpen = () => cartDrawer.classList.contains("open");

  // --- Checkout ---
  const checkoutEl = $("#checkout");
  const isCheckoutOpen = () => checkoutEl.classList.contains("open");

  function openCheckout() {
    if (cart.length === 0) { toast("Your cart is empty"); return; }
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

    $("#summaryItems").innerHTML = cart.map((l) => {
      const p = findProduct(l.id);
      return `
        <div class="summary-row">
          <img src="${p.img}" data-seed="${p.seed}" onerror="${imgError}" alt="${p.name}" />
          <div><div class="s-name">${p.name}</div><div class="s-qty">Qty ${l.qty}</div></div>
          <div class="s-price">${money(p.price * l.qty)}</div>
        </div>`;
    }).join("");

    $("#sumSubtotal").textContent = money(subtotal);
    $("#sumShipping").textContent = shipping === 0 ? "Free" : money(shipping);
    $("#sumTotal").textContent = money(total);
    $("#checkoutPayAmt").textContent = money(total);
  }

  function completeOrder(e) {
    e.preventDefault();
    const orderNum = "SR-" + Math.floor(100000 + Math.random() * 900000);
    $("#orderNum").textContent = orderNum;
    $("#checkoutForm").style.display = "none";
    $(".checkout-summary").style.display = "none";
    $("#checkoutSuccess").hidden = false;
    checkoutEl.scrollTop = 0;
    // Clear the cart after a successful (fake) purchase
    cart = [];
    updateCart();
  }

  // --- Event wiring ---
  function bind() {
    // Product grid: quick view on card, direct add on Add button
    grid.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) { e.stopPropagation(); addToCart(addBtn.dataset.add); return; }
      const card = e.target.closest(".card");
      if (card) openModal(card.dataset.id);
    });
    grid.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) {
        e.preventDefault();
        openModal(e.target.dataset.id);
      }
    });

    // Modal controls
    $("#modalClose").addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });
    $("#modalMinus").addEventListener("click", () => { modalQty = Math.max(1, modalQty - 1); $("#modalQty").textContent = modalQty; });
    $("#modalPlus").addEventListener("click", () => { modalQty++; $("#modalQty").textContent = modalQty; });
    $("#modalAdd").addEventListener("click", () => { addToCart(modalProduct.id, modalQty); closeModal(); openCart(); });

    // Cart controls
    $("#cartOpen").addEventListener("click", openCart);
    $("#cartClose").addEventListener("click", closeCart);
    cartBackdrop.addEventListener("click", closeCart);
    cartItemsEl.addEventListener("click", (e) => {
      const inc = e.target.closest("[data-inc]");
      const dec = e.target.closest("[data-dec]");
      const rem = e.target.closest("[data-remove]");
      if (inc) setQty(inc.dataset.inc, (cart.find((l) => l.id === inc.dataset.inc)?.qty || 0) + 1);
      if (dec) setQty(dec.dataset.dec, (cart.find((l) => l.id === dec.dataset.dec)?.qty || 0) - 1);
      if (rem) removeFromCart(rem.dataset.remove);
    });
    $("#cartCheckout").addEventListener("click", openCheckout);

    // Checkout
    $("#checkoutClose").addEventListener("click", closeCheckout);
    $("#checkoutForm").addEventListener("submit", completeOrder);
    $("#successDone").addEventListener("click", () => { closeCheckout(); });

    // Escape closes top-most layer
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (isCheckoutOpen()) closeCheckout();
      else if (modalOverlay.classList.contains("open")) closeModal();
      else if (isCartOpen()) closeCart();
    });
  }

  // --- Init ---
  renderProducts();
  updateCart();
  bind();
})();
