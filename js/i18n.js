/**
 * Public storefront English / Spanish UI strings only.
 * Does not translate seller-written product titles, descriptions, or Admin.
 */
(function (global) {
  var STORAGE_KEY = "sr-storefront-lang";
  var listeners = [];
  var lang = "en";

  var STRINGS = {
    en: {
      "meta.title": "S&R Concrete Crafts — Handmade Concrete Decor in Milan, NM",
      "nav.skip": "Skip to collection",
      "nav.home": "Home",
      "nav.shop": "Shop",
      "nav.about": "About",
      "nav.openMenu": "Open menu",
      "nav.closeMenu": "Close menu",
      "nav.openCart": "Open cart",
      "nav.closeCart": "Close cart",
      "lang.label": "Language",
      "brand.handmadeIn": "Handmade in",
      "hero.title": "Handcrafted concrete for home & garden",
      "hero.lead": "Beautifully imperfect pieces, made with care in Milan, New Mexico.",
      "hero.shop": "Shop the Collection",
      "hero.share": "Share our shop",
      "share.copyLabel": "Select and copy this shop link",
      "share.lookStore": "Take a look at S&R Concrete Crafts.",
      "share.lookPiece": "Take a look at {name} from S&R Concrete Crafts.",
      "share.copiedShop": "Shop link copied",
      "share.copiedPiece": "Piece link copied",
      "share.opened": "Share options opened.",
      "share.canceled": "Share canceled.",
      "share.copySelected": "Copy the selected shop link.",
      "products.eyebrow": "The Collection",
      "products.title": "Cast in concrete",
      "products.lead": "Browse the live shop. Tap any piece for a closer look.",
      "products.filter": "Filter by category",
      "products.all": "All",
      "products.loading": "Loading the collection…",
      "products.retry": "Try again",
      "products.emptyLive": "No products are published yet. Check back soon.",
      "products.empty": "No products to show.",
      "products.emptyCategory": "No pieces in this category right now.",
      "products.loadError": "The shop catalog could not be loaded.",
      "products.catalogFailed": "Catalog request failed.",
      "card.soldOut": "Sold out",
      "card.unavailable": "Unavailable",
      "card.add": "Add",
      "card.quickView": "Quick view",
      "card.quickViewOf": "Quick view: {name}",
      "card.itemNo": "Item #{n}",
      "card.onlyLeft": "Only {n} left",
      "card.from": "From {price}",
      "finish.painted": "Painted",
      "finish.raw": "Raw Concrete",
      "modal.close": "Close quick view",
      "modal.chooseFinish": "Choose a finish",
      "modal.qty": "Qty",
      "modal.decrease": "Decrease quantity",
      "modal.increase": "Increase quantity",
      "modal.add": "Add to Cart",
      "modal.share": "Share this piece",
      "modal.handCast": "Hand-cast",
      "cart.title": "Your Cart",
      "cart.emptyTitle": "Your cart is feeling light.",
      "cart.emptyHint": "Add a hand-cast piece to get started.",
      "cart.total": "Total",
      "cart.checkout": "Checkout",
      "cart.checkoutDemo": "Checkout (demo)",
      "cart.starting": "Starting checkout…",
      "cart.noteStripe": "Secure checkout · You’ll finish payment on Stripe’s page",
      "cart.noteDemo": "Demo checkout only · No real payment is processed",
      "cart.remove": "Remove",
      "cart.decrease": "Decrease",
      "cart.increase": "Increase",
      "cart.missing": "Item no longer available",
      "cart.fulfillmentPickup": "Local Pickup",
      "cart.fulfillmentShipping": "Shipping available",
      "toast.unavailable": "That item is no longer available.",
      "toast.soldOut": "That item is sold out.",
      "toast.noPainted": "Painted finish isn’t available for that item.",
      "toast.onlyAvailable": "Only {n} available.",
      "toast.qtyLimit": "Quantity limit reached.",
      "toast.added": "{name} added to cart",
      "toast.addedFinish": "{name} — {finish} added to cart",
      "toast.removedUnavailable": "Removed an unavailable item from your cart.",
      "toast.emptyCart": "Your cart is empty",
      "toast.needLive": "Real checkout needs the live catalog. Demo checkout is still available when Stripe is off.",
      "toast.cartGone": "Your cart no longer has available items.",
      "toast.refreshFail": "Couldn’t refresh prices before checkout. Please try again.",
      "toast.stripeMissing": "Stripe isn’t configured on the server yet — opening demo checkout.",
      "toast.stripeBlocked": "Checkout couldn’t start — the server isn’t ready for live payments yet. Please try again shortly.",
      "toast.checkoutFail": "Couldn’t start checkout. Please try again.",
      "toast.checkoutReach": "Couldn’t reach checkout. Please try again.",
      "toast.paid": "Payment received — thank you!",
      "toast.verifyFail": "Payment couldn’t be verified yet. Your cart was kept.",
      "toast.canceled": "Checkout canceled. Your cart is still here.",
      "toast.cartUpdated": "Cart {parts}.",
      "toast.cartUpdatedItems": "updated {n} saved item",
      "toast.cartUpdatedItemsPlural": "updated {n} saved items",
      "toast.cartRemovedItems": "removed {n} unavailable item",
      "toast.cartRemovedItemsPlural": "removed {n} unavailable items",
      "toast.cartJoin": " and ",
      "checkout.close": "Close checkout",
      "checkout.title": "Checkout (demo)",
      "checkout.sub": "No payment is processed and no real order is placed. Stock is not reserved. Real ordering is not connected yet.",
      "checkout.contact": "Contact",
      "checkout.name": "Full name",
      "checkout.namePh": "Your name",
      "checkout.email": "Email",
      "checkout.emailPh": "you@example.com",
      "checkout.shipping": "Shipping",
      "checkout.address": "Address",
      "checkout.addressPh": "Street address",
      "checkout.city": "City",
      "checkout.zip": "ZIP",
      "checkout.payment": "Payment (demo fields)",
      "checkout.card": "Card number",
      "checkout.expiry": "Expiry",
      "checkout.cvc": "CVC",
      "checkout.continue": "Continue demo ·",
      "checkout.summary": "Order summary",
      "checkout.subtotal": "Subtotal",
      "checkout.shippingLine": "Shipping",
      "checkout.total": "Total",
      "checkout.demoNote": "This is a layout walkthrough only.",
      "checkout.successTitle": "Demo checkout only",
      "checkout.successCopy": "No order was placed (DEMO-ONLY). Payment and inventory are not connected yet.",
      "checkout.successCopyDone": "No order was placed and no payment was processed. Real ordering isn’t connected yet — this walkthrough is for layout only.",
      "checkout.keepShopping": "Keep shopping",
      "checkout.qty": "Qty {n}",
      "checkout.free": "Free",
      "story.label": "Our story",
      "story.eyebrow": "Painted or raw",
      "story.copy": "Choose finished painted pieces, or raw concrete you can leave natural or paint yourself — indoors or outdoors.",
      "about.eyebrow": "About",
      "about.title": "Raw material, made warm",
      "about.body": "S&R Concrete Crafts creates handmade concrete pieces in Milan, New Mexico. We cast planters, decor, seasonal pieces, and Southwestern-inspired designs one small batch at a time. Choose from painted, finished pieces or raw concrete designs you can leave natural or paint yourself. Raw concrete pieces can be used indoors or outdoors, giving you the freedom to customize them to fit your own style. Custom orders are welcome. We’re at the Farmer’s Market every Saturday, and we offer local delivery and meetups for customers in the local area.",
      "about.aside": "It’s not your grandma’s ceramics.",
      "trust.label": "Why shop with us",
      "trust.based": "Based in",
      "trust.batches": "Handcrafted in Small Batches",
      "trust.durable": "Durable Concrete Made to Last",
      "trust.local": "Local Roots, Thoughtful Goods",
      "footer.handCastIn": "Hand-cast in",
      "footer.review": "Leave a Google review",
      "review.label": "Leave a Google review",
      "review.dismiss": "Dismiss review invitation",
      "review.bannerAlt": "Leave a review. Click here. Your support means everything.",
      "review.feedback": "Share private feedback",
      "review.feedbackSubject": "Private feedback for {name}",
    },
    es: {
      "meta.title": "S&R Concrete Crafts — Decoración de concreto hecha a mano en Milan, NM",
      "nav.skip": "Ir a la colección",
      "nav.home": "Inicio",
      "nav.shop": "Tienda",
      "nav.about": "Nosotros",
      "nav.openMenu": "Abrir menú",
      "nav.closeMenu": "Cerrar menú",
      "nav.openCart": "Abrir carrito",
      "nav.closeCart": "Cerrar carrito",
      "lang.label": "Idioma",
      "brand.handmadeIn": "Hecho en",
      "hero.title": "Concreto hecho a mano para casa y jardín",
      "hero.lead": "Piezas con carácter, hechas con cuidado en Milan, Nuevo México.",
      "hero.shop": "Ver la colección",
      "hero.share": "Compartir la tienda",
      "share.copyLabel": "Selecciona y copia este enlace",
      "share.lookStore": "Mira S&R Concrete Crafts.",
      "share.lookPiece": "Mira {name} de S&R Concrete Crafts.",
      "share.copiedShop": "Enlace de la tienda copiado",
      "share.copiedPiece": "Enlace de la pieza copiado",
      "share.opened": "Opciones para compartir abiertas.",
      "share.canceled": "Se canceló compartir.",
      "share.copySelected": "Copia el enlace seleccionado.",
      "products.eyebrow": "La colección",
      "products.title": "Piezas de concreto",
      "products.lead": "Mira la tienda. Toca cualquier pieza para verla de cerca.",
      "products.filter": "Filtrar por categoría",
      "products.all": "Todas",
      "products.loading": "Cargando la colección…",
      "products.retry": "Intentar de nuevo",
      "products.emptyLive": "Aún no hay productos publicados. Vuelve pronto.",
      "products.empty": "No hay productos para mostrar.",
      "products.emptyCategory": "No hay piezas en esta categoría por ahora.",
      "products.loadError": "No se pudo cargar el catálogo de la tienda.",
      "products.catalogFailed": "No se pudo cargar el catálogo.",
      "card.soldOut": "Agotado",
      "card.unavailable": "No disponible",
      "card.add": "Agregar",
      "card.quickView": "Vista rápida",
      "card.quickViewOf": "Vista rápida: {name}",
      "card.itemNo": "Pieza #{n}",
      "card.onlyLeft": "Solo quedan {n}",
      "card.from": "Desde {price}",
      "finish.painted": "Pintado",
      "finish.raw": "Concreto natural",
      "modal.close": "Cerrar vista rápida",
      "modal.chooseFinish": "Elige un acabado",
      "modal.qty": "Cant.",
      "modal.decrease": "Disminuir cantidad",
      "modal.increase": "Aumentar cantidad",
      "modal.add": "Agregar al carrito",
      "modal.share": "Compartir esta pieza",
      "modal.handCast": "Hecho a mano",
      "cart.title": "Tu carrito",
      "cart.emptyTitle": "Tu carrito está vacío.",
      "cart.emptyHint": "Agrega una pieza hecha a mano para empezar.",
      "cart.total": "Total",
      "cart.checkout": "Pagar",
      "cart.checkoutDemo": "Pagar (demo)",
      "cart.starting": "Abriendo el pago…",
      "cart.noteStripe": "Pago seguro · Terminas en la página de Stripe",
      "cart.noteDemo": "Solo demostración · No se cobra de verdad",
      "cart.remove": "Quitar",
      "cart.decrease": "Disminuir",
      "cart.increase": "Aumentar",
      "cart.missing": "Este artículo ya no está disponible",
      "cart.fulfillmentPickup": "Recoger en persona",
      "cart.fulfillmentShipping": "Envío disponible",
      "toast.unavailable": "Ese artículo ya no está disponible.",
      "toast.soldOut": "Ese artículo está agotado.",
      "toast.noPainted": "Ese artículo no tiene acabado pintado.",
      "toast.onlyAvailable": "Solo hay {n} disponibles.",
      "toast.qtyLimit": "Llegaste al límite de cantidad.",
      "toast.added": "{name} se agregó al carrito",
      "toast.addedFinish": "{name} — {finish} se agregó al carrito",
      "toast.removedUnavailable": "Quitamos un artículo que ya no está disponible.",
      "toast.emptyCart": "Tu carrito está vacío",
      "toast.needLive": "El pago real necesita el catálogo en vivo. La demostración sigue disponible si Stripe está apagado.",
      "toast.cartGone": "Tu carrito ya no tiene artículos disponibles.",
      "toast.refreshFail": "No se pudieron actualizar los precios. Inténtalo de nuevo.",
      "toast.stripeMissing": "Stripe aún no está configurado — abriendo la demostración.",
      "toast.stripeBlocked": "No se pudo iniciar el pago. El servidor aún no está listo. Inténtalo en un momento.",
      "toast.checkoutFail": "No se pudo iniciar el pago. Inténtalo de nuevo.",
      "toast.checkoutReach": "No se pudo conectar al pago. Inténtalo de nuevo.",
      "toast.paid": "Pago recibido. ¡Gracias!",
      "toast.verifyFail": "Aún no se pudo confirmar el pago. Tu carrito se quedó igual.",
      "toast.canceled": "Cancelaste el pago. Tu carrito sigue aquí.",
      "toast.cartUpdated": "Carrito: {parts}.",
      "toast.cartUpdatedItems": "se actualizó {n} artículo guardado",
      "toast.cartUpdatedItemsPlural": "se actualizaron {n} artículos guardados",
      "toast.cartRemovedItems": "se quitó {n} artículo no disponible",
      "toast.cartRemovedItemsPlural": "se quitaron {n} artículos no disponibles",
      "toast.cartJoin": " y ",
      "checkout.close": "Cerrar pago",
      "checkout.title": "Pago (demostración)",
      "checkout.sub": "No se cobra y no se hace un pedido de verdad. No se reserva inventario. El pedido real aún no está conectado.",
      "checkout.contact": "Contacto",
      "checkout.name": "Nombre completo",
      "checkout.namePh": "Tu nombre",
      "checkout.email": "Correo",
      "checkout.emailPh": "tucorreo@ejemplo.com",
      "checkout.shipping": "Envío",
      "checkout.address": "Dirección",
      "checkout.addressPh": "Calle y número",
      "checkout.city": "Ciudad",
      "checkout.zip": "Código postal",
      "checkout.payment": "Pago (campos de demostración)",
      "checkout.card": "Número de tarjeta",
      "checkout.expiry": "Vence",
      "checkout.cvc": "CVC",
      "checkout.continue": "Seguir la demo ·",
      "checkout.summary": "Resumen del pedido",
      "checkout.subtotal": "Subtotal",
      "checkout.shippingLine": "Envío",
      "checkout.total": "Total",
      "checkout.demoNote": "Esto es solo un recorrido de la pantalla.",
      "checkout.successTitle": "Solo demostración",
      "checkout.successCopy": "No se hizo ningún pedido (SOLO-DEMO). El pago y el inventario aún no están conectados.",
      "checkout.successCopyDone": "No se hizo ningún pedido ni se cobró. El pedido real aún no está conectado; esto es solo para ver la pantalla.",
      "checkout.keepShopping": "Seguir comprando",
      "checkout.qty": "Cant. {n}",
      "checkout.free": "Gratis",
      "story.label": "Nuestra historia",
      "story.eyebrow": "Pintado o natural",
      "story.copy": "Elige piezas pintadas y listas, o concreto natural para dejarlo así o pintarlo tú — adentro o afuera.",
      "about.eyebrow": "Acerca de",
      "about.title": "Material crudo, hecho cálido",
      "about.body": "S&R Concrete Crafts crea piezas de concreto hechas a mano en Milan, Nuevo México. Hacemos macetas, decoración, piezas de temporada y diseños de inspiración sureña, en lotes pequeños. Elige piezas pintadas y terminadas, o diseños de concreto natural para dejarlos así o pintarlos tú. Las piezas naturales sirven adentro o afuera, para que las adaptes a tu estilo. También hacemos pedidos especiales. Estamos en el mercado de agricultores todos los sábados, y ofrecemos entrega local y puntos de encuentro en la zona.",
      "about.aside": "No es la cerámica de tu abuela.",
      "trust.label": "Por qué comprar aquí",
      "trust.based": "De",
      "trust.batches": "Hecho a mano en lotes pequeños",
      "trust.durable": "Concreto duradero, hecho para durar",
      "trust.local": "Raíces locales, piezas con cuidado",
      "footer.handCastIn": "Hecho a mano en",
      "footer.review": "Deja una reseña en Google",
      "review.label": "Deja una reseña en Google",
      "review.dismiss": "Cerrar la invitación a reseñar",
      "review.bannerAlt": "Deja una reseña. Haz clic aquí. Tu apoyo lo es todo.",
      "review.feedback": "Enviar un comentario privado",
      "review.feedbackSubject": "Comentario privado para {name}",
    },
  };

  function normalize(value) {
    return String(value || "").toLowerCase() === "es" ? "es" : "en";
  }

  function readStored() {
    try {
      return normalize(global.localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      return "en";
    }
  }

  function interpolate(text, vars) {
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (_, key) {
      return vars[key] == null ? "" : String(vars[key]);
    });
  }

  function t(key, vars) {
    var dict = STRINGS[lang] || STRINGS.en;
    var text = dict[key];
    if (text == null) text = STRINGS.en[key];
    if (text == null) return key;
    return interpolate(text, vars);
  }

  function applyStatic() {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang === "es" ? "es" : "en";
    document.documentElement.setAttribute("data-lang", lang);
    document.title = t("meta.title");
    var locale = document.querySelector('meta[property="og:locale"]');
    if (locale) locale.setAttribute("content", lang === "es" ? "es_US" : "en_US");

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      String(el.getAttribute("data-i18n-attr") || "")
        .split("|")
        .forEach(function (pair) {
          var idx = pair.indexOf(":");
          if (idx < 1) return;
          el.setAttribute(pair.slice(0, idx), t(pair.slice(idx + 1)));
        });
    });
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      btn.setAttribute(
        "aria-pressed",
        btn.getAttribute("data-lang-btn") === lang ? "true" : "false"
      );
    });
  }

  function setLang(next) {
    var resolved = normalize(next);
    if (resolved === lang) {
      applyStatic();
      return;
    }
    lang = resolved;
    try {
      global.localStorage.setItem(STORAGE_KEY, lang);
    } catch (err) {
      /* private mode */
    }
    applyStatic();
    listeners.forEach(function (fn) {
      try {
        fn(lang);
      } catch (err) {
        /* keep other listeners */
      }
    });
  }

  function init() {
    lang = readStored();
    applyStatic();
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-lang-btn]");
      if (!btn) return;
      e.preventDefault();
      setLang(btn.getAttribute("data-lang-btn"));
    });
  }

  global.SRStorefrontI18n = {
    STORAGE_KEY: STORAGE_KEY,
    t: t,
    getLang: function () {
      return lang;
    },
    setLang: setLang,
    applyStatic: applyStatic,
    onChange: function (fn) {
      if (typeof fn === "function") listeners.push(fn);
    },
    init: init,
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
