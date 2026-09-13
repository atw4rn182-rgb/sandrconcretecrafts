/**
 * Server-only catalog lookups for Stripe Checkout.
 * Uses the public anon key + RLS (published / sold_out reads only).
 * Never trusts client-supplied prices.
 */
"use strict";

function env(name) {
  return String(process.env[name] || "").trim();
}

function supabaseConfig() {
  var url =
    env("SUPABASE_URL") ||
    env("NEXT_PUBLIC_SUPABASE_URL") ||
    env("PUBLIC_SUPABASE_URL");
  var anonKey =
    env("SUPABASE_ANON_KEY") ||
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    env("PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("Catalog lookup is not configured on the server.");
  }
  return { url: url.replace(/\/$/, ""), anonKey: anonKey };
}

function dollarsToCents(amount) {
  var n = Number(amount);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function effectiveUnitCents(row) {
  var price = Number(row.price);
  var sale =
    row.sale_price == null || row.sale_price === ""
      ? null
      : Number(row.sale_price);
  var dollars =
    sale != null && isFinite(sale) && isFinite(price) && sale < price
      ? sale
      : price;
  return dollarsToCents(dollars);
}

/**
 * Fetch one storefront-visible product by id.
 * Returns null when missing or not publicly purchasable.
 */
async function fetchPublicProduct(productId) {
  var id = String(productId || "").trim();
  if (!id) return null;

  var cfg = supabaseConfig();
  var endpoint =
    cfg.url +
    "/rest/v1/products?" +
    new URLSearchParams({
      id: "eq." + id,
      select:
        "id,title,description,price,sale_price,quantity,status,track_inventory,product_images(image_url,is_primary,sort_order)",
      limit: "1",
    }).toString();

  var res = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: cfg.anonKey,
      Authorization: "Bearer " + cfg.anonKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    var detail = "";
    try {
      detail = await res.text();
    } catch (e) {
      detail = "";
    }
    throw new Error(
      "Couldn’t look up that product." +
        (detail && detail.length < 180 ? " " + detail : "")
    );
  }

  var rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0];
}

function primaryImageUrl(row) {
  var images = Array.isArray(row.product_images) ? row.product_images.slice() : [];
  images.sort(function (a, b) {
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  var primary = images.find(function (img) {
    return img.is_primary;
  });
  var pick = primary || images[0];
  var url = pick && pick.image_url ? String(pick.image_url).trim() : "";
  if (!url) return null;
  if (!/^https:\/\//i.test(url)) return null;
  return url;
}

/**
 * Validate quantity against inventory rules.
 */
function assertPurchasable(row, quantity) {
  if (!row) {
    return { ok: false, error: "That product isn’t available." };
  }
  if (row.status !== "published") {
    return { ok: false, error: "That product isn’t available for purchase." };
  }
  var qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return { ok: false, error: "Choose a valid quantity." };
  }
  if (row.track_inventory) {
    var stock = Number(row.quantity);
    if (!isFinite(stock) || stock < 1) {
      return { ok: false, error: "That product is sold out." };
    }
    if (qty > stock) {
      return {
        ok: false,
        error: "Only " + stock + " available for “" + (row.title || "this item") + "”.",
      };
    }
  }
  var unitCents = effectiveUnitCents(row);
  if (unitCents == null || unitCents < 1) {
    return { ok: false, error: "That product doesn’t have a valid price yet." };
  }
  return { ok: true, quantity: qty, unitCents: unitCents };
}

module.exports = {
  fetchPublicProduct: fetchPublicProduct,
  primaryImageUrl: primaryImageUrl,
  assertPurchasable: assertPurchasable,
  effectiveUnitCents: effectiveUnitCents,
  dollarsToCents: dollarsToCents,
};
