/**
 * Public storefront catalog helpers (anon key + RLS only).
 * Never uses service-role. Safe for unauthenticated browsing.
 */
(function (global) {
  "use strict";

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/`/g, "&#96;");
  }

  /** Allow https, same-origin root-relative, or relative asset paths. Block javascript: etc. */
  function isSafeImageUrl(url) {
    var raw = String(url == null ? "" : url).trim();
    if (!raw) return false;
    if (/[\s<>"'`]/.test(raw)) return false;
    if (/^(javascript|data|vbscript|blob):/i.test(raw)) return false;
    if (raw.charAt(0) === "/" || raw.indexOf("assets/") === 0 || raw.indexOf("./assets/") === 0) {
      return !raw.includes("://");
    }
    try {
      var u = new URL(raw, global.location && global.location.origin);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch (e) {
      return false;
    }
  }

  function normalizeImageUrl(url) {
    var raw = String(url == null ? "" : url).trim();
    if (!isSafeImageUrl(raw)) return "";
    if (raw.indexOf("assets/") === 0) return "/" + raw;
    return raw;
  }

  function primaryImage(images) {
    if (!images || !images.length) return null;
    var p = images.find(function (img) {
      return img.is_primary;
    });
    return (
      p ||
      images.slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
      })[0]
    );
  }

  function badgePresentation(badges, featured) {
    var active = (badges || []).filter(function (b) {
      return b && b.active !== false;
    });
    var badge = active[0];
    if (badge) {
      var slug = String(badge.slug || "").toLowerCase();
      return {
        tag: badge.label || badge.name || "",
        tagSoft: /new|handmade|one/.test(slug),
      };
    }
    if (featured) {
      return { tag: "Featured", tagSoft: false };
    }
    return { tag: "", tagSoft: false };
  }

  function mapRow(row) {
    var images = (row.product_images || []).slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    var primary = primaryImage(images);
    var badges = (row.product_badges || [])
      .map(function (pb) {
        return pb.badges;
      })
      .filter(Boolean);
    var categories = (row.product_categories || [])
      .map(function (pc) {
        return pc.categories;
      })
      .filter(Boolean);
    var sourceKey = row.source_key || null;
    var legacyId =
      sourceKey && String(sourceKey).indexOf("legacy:") === 0
        ? String(sourceKey).slice("legacy:".length)
        : null;
    var price = Number(row.price) || 0;
    var painted =
      row.painted_price == null || row.painted_price === ""
        ? null
        : Number(row.painted_price);
    if (!isFinite(painted) || painted <= 0) painted = null;
    var sale =
      row.sale_price == null || row.sale_price === ""
        ? null
        : Number(row.sale_price);
    var hasSale = sale != null && isFinite(sale) && sale < price;
    var track = !!row.track_inventory;
    var qty = Number(row.quantity);
    if (!isFinite(qty) || qty < 0) qty = 0;
    var soldOut =
      row.status === "sold_out" || (track && qty < 1);
    var badgeInfo = badgePresentation(badges, !!row.featured);
    var imgUrl = primary ? normalizeImageUrl(primary.image_url) : "";
    var alt =
      (primary && primary.alt_text) || row.title || "Product photo";

    return {
      id: row.id,
      sourceKey: sourceKey,
      legacyId: legacyId,
      name: row.title || "",
      desc: row.description || "",
      price: price,
      paintedPrice: painted,
      salePrice: hasSale ? sale : null,
      effectivePrice: hasSale ? sale : price,
      itemNo: row.item_no || "",
      tag: badgeInfo.tag,
      tagSoft: badgeInfo.tagSoft,
      img: imgUrl,
      alt: alt,
      seed: legacyId || String(row.slug || row.id || "item").slice(0, 40),
      status: row.status,
      soldOut: soldOut,
      trackInventory: track,
      quantity: qty,
      featured: !!row.featured,
      categories: categories,
      productType: row.product_type || "single",
    };
  }

  function useLiveCatalog() {
    var env = global.__SR_ENV__ || {};
    return String(env.USE_LIVE_CATALOG || "").toLowerCase() === "true";
  }

  var STOREFRONT_PAGE_SIZE = 24;
  var STOREFRONT_SELECT =
    "id, title, slug, description, price, painted_price, sale_price, quantity, status, product_type, featured, source_key, item_no, track_inventory, published_at, updated_at, product_images(id, image_url, alt_text, sort_order, is_primary), product_categories(category_id, categories(id, name, slug, active)), product_badges(badge_id, badges(id, name, slug, label, active))";

  function mergeProductPage(existing, incoming) {
    var seen = {};
    var products = [];
    (existing || []).forEach(function (product) {
      if (!product || !product.id || seen[product.id]) return;
      seen[product.id] = true;
      products.push(product);
    });
    var added = [];
    var duplicates = 0;
    (incoming || []).forEach(function (product) {
      if (!product || !product.id || seen[product.id]) {
        duplicates += 1;
        return;
      }
      seen[product.id] = true;
      products.push(product);
      added.push(product);
    });
    return { products: products, added: added, duplicates: duplicates };
  }

  function pageHasMore(returnedCount, limit, loadedCount, total) {
    var returned = Number(returnedCount) || 0;
    var size = Number(limit) || 0;
    var loaded = Number(loadedCount) || 0;
    if (!returned) return false;
    if (typeof total === "number" && isFinite(total) && loaded >= total) return false;
    if (size && returned < size) return false;
    return true;
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || "")
    );
  }

  function storefrontClient() {
    if (!global.SRSupabase || !SRSupabase.isConfigured()) {
      throw new Error(
        "Store catalog isn’t configured. Set SUPABASE_URL and SUPABASE_ANON_KEY, then rebuild."
      );
    }
    var client = SRSupabase.createClient();
    if (!client) {
      throw new Error("Couldn’t start the catalog connection. Please try again.");
    }
    return client;
  }

  /**
   * One page of public products. Filters and range run in Supabase.
   */
  async function fetchStorefrontProductPage(opts) {
    opts = opts || {};
    var limit = Math.min(Math.max(Number(opts.limit) || STOREFRONT_PAGE_SIZE, 1), 60);
    var offset = Math.max(Number(opts.offset) || 0, 0);
    var categoryId = opts.categoryId ? String(opts.categoryId) : "";
    var client = storefrontClient();
    var select = categoryId
      ? STOREFRONT_SELECT.replace("product_categories(", "product_categories!inner(")
      : STOREFRONT_SELECT;
    var q = client.from("products").select(select, { count: "exact" });
    if (opts.hideSoldOut) {
      q = q.eq("status", "published").or("track_inventory.eq.false,quantity.gt.0");
    } else {
      q = q.in("status", ["published", "sold_out"]);
    }
    if (categoryId) q = q.eq("product_categories.category_id", categoryId);
    if (opts.featuredFirst !== false) q = q.order("featured", { ascending: false });
    q = q
      .order("published_at", { ascending: false })
      .order("title", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    var result = await q;
    if (result.error) {
      throw new Error(result.error.message || "Couldn’t load products from the catalog.");
    }
    return {
      products: (result.data || []).map(mapRow),
      total: typeof result.count === "number" ? result.count : (result.data || []).length,
      offset: offset,
      limit: limit,
    };
  }

  /**
   * Load specific products for the cart or a shared link without paging the catalog.
   * Accepts uuids and legacy cart ids.
   */
  async function fetchStorefrontProductsByIds(ids) {
    var uuids = [];
    var legacy = [];
    var seen = {};
    (ids || []).forEach(function (raw) {
      var id = String(raw || "");
      if (!id || seen[id]) return;
      seen[id] = true;
      if (isUuid(id)) uuids.push(id);
      else legacy.push(id.indexOf("legacy:") === 0 ? id : "legacy:" + id);
    });
    if (!uuids.length && !legacy.length) return [];
    var client = storefrontClient();
    var merged = [];
    var found = {};
    function take(rows) {
      (rows || []).forEach(function (row) {
        var mapped = mapRow(row);
        if (!mapped.id || found[mapped.id]) return;
        found[mapped.id] = true;
        merged.push(mapped);
      });
    }
    if (uuids.length) {
      var byId = await client
        .from("products")
        .select(STOREFRONT_SELECT)
        .in("id", uuids)
        .in("status", ["published", "sold_out"]);
      if (byId.error) {
        throw new Error(byId.error.message || "Couldn’t load products from the catalog.");
      }
      take(byId.data);
    }
    if (legacy.length) {
      var byKey = await client
        .from("products")
        .select(STOREFRONT_SELECT)
        .in("source_key", legacy)
        .in("status", ["published", "sold_out"]);
      if (byKey.error) {
        throw new Error(byKey.error.message || "Couldn’t load products from the catalog.");
      }
      take(byKey.data);
    }
    return merged;
  }

  async function fetchStorefrontProducts() {
    if (!global.SRSupabase || !SRSupabase.isConfigured()) {
      throw new Error(
        "Store catalog isn’t configured. Set SUPABASE_URL and SUPABASE_ANON_KEY, then rebuild."
      );
    }
    var client = SRSupabase.createClient();
    if (!client) {
      throw new Error("Couldn’t start the catalog connection. Please try again.");
    }

    var result = await client
      .from("products")
      .select(
        "id, title, slug, description, price, painted_price, sale_price, quantity, status, product_type, featured, source_key, item_no, track_inventory, published_at, updated_at, product_images(id, image_url, alt_text, sort_order, is_primary), product_categories(category_id, categories(id, name, slug, active)), product_badges(badge_id, badges(id, name, slug, label, active))"
      )
      .in("status", ["published", "sold_out"])
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false })
      .order("title", { ascending: true });

    if (result.error) {
      throw new Error(
        result.error.message || "Couldn’t load products from the catalog."
      );
    }

    return (result.data || []).map(mapRow);
  }

  /**
   * All ACTIVE categories from the database (not derived from assigned products).
   * Public RLS already limits this to active rows.
   */
  async function fetchStorefrontCategories() {
    if (!global.SRSupabase || !SRSupabase.isConfigured()) {
      throw new Error(
        "Store catalog isn’t configured. Set SUPABASE_URL and SUPABASE_ANON_KEY, then rebuild."
      );
    }
    var client = SRSupabase.createClient();
    if (!client) {
      throw new Error("Couldn’t start the catalog connection. Please try again.");
    }

    var result = await client
      .from("categories")
      .select("id, name, slug, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (result.error) {
      throw new Error(
        result.error.message || "Couldn’t load categories from the catalog."
      );
    }

    return (result.data || [])
      .filter(function (row) {
        return row && row.id;
      })
      .map(function (row) {
        return {
          id: row.id,
          name: row.name || row.slug || "Category",
          slug: row.slug || "",
          sort_order: Number(row.sort_order) || 0,
        };
      });
  }

  /**
   * Map a saved cart id (legacy slug id or uuid) onto the current catalog.
   * Returns product id or null if unavailable.
   */
  function resolveCartProductId(rawId, products) {
    var id = String(rawId || "");
    if (!id) return null;
    var byId = products.find(function (p) {
      return p.id === id;
    });
    if (byId) return byId.id;
    var byLegacy = products.find(function (p) {
      return p.legacyId === id || p.sourceKey === "legacy:" + id;
    });
    if (byLegacy) return byLegacy.id;
    if (id.indexOf("legacy:") === 0) {
      var sk = products.find(function (p) {
        return p.sourceKey === id;
      });
      if (sk) return sk.id;
    }
    return null;
  }

  global.SRStorefrontCatalog = {
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
    isSafeImageUrl: isSafeImageUrl,
    normalizeImageUrl: normalizeImageUrl,
    useLiveCatalog: useLiveCatalog,
    STOREFRONT_PAGE_SIZE: STOREFRONT_PAGE_SIZE,
    mergeProductPage: mergeProductPage,
    pageHasMore: pageHasMore,
    fetchStorefrontProducts: fetchStorefrontProducts,
    fetchStorefrontProductPage: fetchStorefrontProductPage,
    fetchStorefrontProductsByIds: fetchStorefrontProductsByIds,
    fetchStorefrontCategories: fetchStorefrontCategories,
    resolveCartProductId: resolveCartProductId,
    mapRow: mapRow,
  };
})(typeof window !== "undefined" ? window : globalThis);
