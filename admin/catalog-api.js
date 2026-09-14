/**
 * Catalog data helpers for admin product/category management.
 * Uses authenticated Supabase client (anon key + session). Never service-role.
 */
(function (global) {
  "use strict";

  var BUCKET = "product-images";
  var SITE_ASSETS_BUCKET = "site-assets";
  var ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  var MAX_BYTES = 10 * 1024 * 1024;
  var HERO_MAX_BYTES = 10 * 1024 * 1024;
  var HERO_MAX_EDGE = 2400;
  var HERO_MIN_WIDTH = 800;
  var HERO_MIN_HEIGHT = 450;

  function client() {
    return SRAdminAuth.getClient();
  }

  function friendlyDbError(error, fallback) {
    if (!error) return fallback || "Something went wrong. Please try again.";
    var msg = String(error.message || "");
    var code = String(error.code || "");
    if (code === "42501" || /permission|rls|policy/i.test(msg)) {
      return "You don’t have permission to save this yet. Ask your web helper to run the latest admin catalog migration in Supabase.";
    }
    if (code === "23505" || /duplicate|unique/i.test(msg)) {
      return "That slug is already used by another product. Please choose a different one.";
    }
    if (code === "42P01" || /does not exist/i.test(msg)) {
      return "Catalog tables aren’t ready yet. Run the Supabase migrations first.";
    }
    if (/JWT|session|auth/i.test(msg)) {
      return "Your session expired. Please sign in again.";
    }
    return fallback || "We couldn’t save your changes. Please try again.";
  }

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return "$0.00";
    return "$" + v.toFixed(2);
  }

  /**
   * Parse owner-entered dollar amounts for numeric(10,2) columns.
   * Treats blank as missing (does NOT coerce "" → 0 — that silently saved $0.00).
   * Accepts 18, 18.00, 18.50, $125.99, and 1,250.00.
   */
  function parseMoneyInput(raw, opts) {
    var options = opts || {};
    var label = options.label || "Price";
    var required = !!options.required;
    var text = String(raw == null ? "" : raw).trim();

    if (!text) {
      if (required) {
        return { ok: false, value: null, error: "Please enter a " + label.toLowerCase() + "." };
      }
      return { ok: true, value: null, error: null };
    }

    // Strip currency symbols / grouping commas owners commonly type or paste.
    var cleaned = text.replace(/\$/g, "").replace(/,/g, "").replace(/\s+/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
      return {
        ok: false,
        value: null,
        error: label + " must look like 18 or 18.50.",
      };
    }

    var num = Number(cleaned);
    if (!isFinite(num)) {
      return {
        ok: false,
        value: null,
        error: label + " must look like 18 or 18.50.",
      };
    }
    if (num < 0) {
      return {
        ok: false,
        value: null,
        error: label + " can’t be negative.",
      };
    }
    if (num > 99999999.99) {
      return {
        ok: false,
        value: null,
        error: label + " is too large.",
      };
    }

    // Store as dollars with 2-decimal precision (matches numeric(10,2)).
    var cents = Math.round(num * 100);
    return { ok: true, value: cents / 100, error: null };
  }

  function formatMoneyInput(n) {
    if (n == null || n === "") return "";
    var v = Number(n);
    if (!isFinite(v)) return "";
    return v.toFixed(2);
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function primaryImage(images) {
    if (!images || !images.length) return null;
    var p = images.find(function (img) {
      return img.is_primary;
    });
    return p || images.slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    })[0];
  }

  async function listProducts() {
    var supabase = await client();
    var result = await supabase
      .from("products")
      .select(
        "id, title, slug, description, price, sale_price, quantity, status, product_type, featured, source_key, item_no, track_inventory, created_at, updated_at, published_at, product_images(id, image_url, alt_text, sort_order, is_primary), product_categories(category_id, categories(id, name, slug, active)), product_badges(badge_id, badges(id, name, slug, label, active))"
      )
      .order("updated_at", { ascending: false });

    if (result.error) throw new Error(friendlyDbError(result.error, "Couldn’t load products."));
    return (result.data || []).map(normalizeProductRow);
  }

  function normalizeProductRow(row) {
    var images = (row.product_images || []).slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    var categories = (row.product_categories || [])
      .map(function (pc) {
        return pc.categories;
      })
      .filter(Boolean);
    var badges = (row.product_badges || [])
      .map(function (pb) {
        return pb.badges;
      })
      .filter(Boolean);
    return Object.assign({}, row, {
      images: images,
      categories: categories,
      badges: badges,
      primary: primaryImage(images),
    });
  }

  async function getProduct(id) {
    var supabase = await client();
    var result = await supabase
      .from("products")
      .select(
        "id, title, slug, description, price, sale_price, quantity, status, product_type, featured, source_key, item_no, track_inventory, created_at, updated_at, published_at, product_images(id, image_url, alt_text, sort_order, is_primary, created_at), product_categories(category_id, categories(id, name, slug, active)), product_badges(badge_id, badges(id, name, slug, label, active))"
      )
      .eq("id", id)
      .maybeSingle();
    if (result.error) throw new Error(friendlyDbError(result.error, "Couldn’t load this product."));
    if (!result.data) throw new Error("That product wasn’t found.");
    return normalizeProductRow(result.data);
  }

  async function listCategories(includeInactive) {
    var supabase = await client();
    var q = supabase
      .from("categories")
      .select("id, name, slug, description, active, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (!includeInactive) q = q.eq("active", true);
    var result = await q;
    if (result.error) throw new Error(friendlyDbError(result.error, "Couldn’t load categories."));
    return result.data || [];
  }

  async function listBadges(includeInactive) {
    var supabase = await client();
    var q = supabase
      .from("badges")
      .select("id, name, slug, label, active, sort_order")
      .order("sort_order", { ascending: true });
    if (!includeInactive) q = q.eq("active", true);
    var result = await q;
    if (result.error) throw new Error(friendlyDbError(result.error, "Couldn’t load badges."));
    return result.data || [];
  }

  async function ensureUniqueSlug(base, excludeId) {
    var supabase = await client();
    var slug = base || "product";
    var attempt = slug;
    var n = 2;
    while (n < 50) {
      var q = supabase.from("products").select("id").eq("slug", attempt).maybeSingle();
      var result = await q;
      if (result.error && result.error.code !== "PGRST116") {
        // maybeSingle returns null data without error when not found
      }
      if (result.error) throw new Error(friendlyDbError(result.error, "Couldn’t check slug."));
      if (!result.data || (excludeId && result.data.id === excludeId)) return attempt;
      attempt = slug + "-" + n;
      n += 1;
    }
    return slug + "-" + Date.now();
  }

  function validateProductInput(input, opts) {
    var errors = [];
    var title = String(input.title || "").trim();
    var description = String(input.description || "").trim();
    var priceParsed = parseMoneyInput(input.price, { required: true, label: "Price" });
    var saleParsed = parseMoneyInput(input.sale_price, {
      required: false,
      label: "Sale price",
    });
    var price = priceParsed.value;
    var sale = saleParsed.value;
    var quantity = Number(input.quantity);
    var status = input.status || "draft";
    var productType = input.product_type || "single";
    var imageCount = Number(input.imageCount || 0);
    var trackInventory = !!input.track_inventory;
    var itemNo = String(input.item_no || "").trim() || null;

    if (!title) errors.push("Please add a product title.");
    if (!description) errors.push("Please add a short description.");
    if (!priceParsed.ok) errors.push(priceParsed.error);
    if (!saleParsed.ok) errors.push(saleParsed.error);
    if (
      priceParsed.ok &&
      saleParsed.ok &&
      sale != null &&
      price != null &&
      sale > price
    ) {
      errors.push("Sale price can’t be higher than the regular price.");
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      errors.push("Quantity must be a whole number zero or greater.");
    }
    if (
      trackInventory &&
      ((opts && opts.publishing) || status === "published") &&
      quantity < 1
    ) {
      errors.push(
        "Enter stock quantity before publishing with inventory tracking, or turn tracking off."
      );
    }
    if (["draft", "published", "sold_out", "hidden"].indexOf(status) === -1) {
      errors.push("Choose a valid status.");
    }
    if (["single", "bundle"].indexOf(productType) === -1) {
      errors.push("Choose a valid product type.");
    }
    if ((opts && opts.publishing) || status === "published") {
      if (!title || !description) {
        /* already covered */
      }
      if (imageCount < 1) errors.push("Add at least one photo before publishing.");
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      value: {
        title: title,
        description: description,
        price: price,
        sale_price: sale,
        quantity: quantity,
        status: status,
        product_type: productType,
        featured: !!input.featured,
        item_no: itemNo,
        track_inventory: trackInventory,
        slug: String(input.slug || "").trim() || slugify(title),
        category_ids: input.category_ids || [],
        badge_ids: input.badge_ids || [],
      },
    };
  }

  async function createProduct(fields) {
    var supabase = await client();
    var slug = await ensureUniqueSlug(slugify(fields.slug || fields.title));
    var payload = {
      title: fields.title,
      slug: slug,
      description: fields.description,
      price: fields.price,
      sale_price: fields.sale_price,
      quantity: fields.quantity,
      status: fields.status || "draft",
      product_type: fields.product_type || "single",
      featured: !!fields.featured,
      item_no: fields.item_no,
      track_inventory: !!fields.track_inventory,
      published_at:
        fields.status === "published" ? new Date().toISOString() : null,
    };
    var result = await supabase.from("products").insert(payload).select("*").single();
    if (result.error) throw new Error(friendlyDbError(result.error, "Couldn’t create the product."));
    return result.data;
  }

  async function updateProduct(id, fields, previous) {
    var supabase = await client();
    var slug = String(fields.slug || "").trim() || previous.slug;
    if (slug !== previous.slug) {
      slug = await ensureUniqueSlug(slugify(slug), id);
    }
    var publishedAt = previous.published_at;
    if (fields.status === "published" && !publishedAt) {
      publishedAt = new Date().toISOString();
    }
    var payload = {
      title: fields.title,
      slug: slug,
      description: fields.description,
      price: fields.price,
      sale_price: fields.sale_price,
      quantity: fields.quantity,
      status: fields.status,
      product_type: fields.product_type,
      featured: !!fields.featured,
      item_no: fields.item_no,
      track_inventory: !!fields.track_inventory,
      published_at: publishedAt,
    };
    var result = await supabase
      .from("products")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (result.error) throw new Error(friendlyDbError(result.error, "Couldn’t update the product."));
    return result.data;
  }

  async function syncProductCategories(productId, categoryIds) {
    var supabase = await client();
    var ids = Array.from(new Set((categoryIds || []).filter(Boolean)));
    var existing = await supabase
      .from("product_categories")
      .select("category_id")
      .eq("product_id", productId);
    if (existing.error) throw new Error(friendlyDbError(existing.error));
    var current = (existing.data || []).map(function (r) {
      return r.category_id;
    });
    var toAdd = ids.filter(function (id) {
      return current.indexOf(id) === -1;
    });
    var toRemove = current.filter(function (id) {
      return ids.indexOf(id) === -1;
    });
    if (toRemove.length) {
      var del = await supabase
        .from("product_categories")
        .delete()
        .eq("product_id", productId)
        .in("category_id", toRemove);
      if (del.error) throw new Error(friendlyDbError(del.error, "Couldn’t update categories."));
    }
    if (toAdd.length) {
      var ins = await supabase.from("product_categories").insert(
        toAdd.map(function (category_id) {
          return { product_id: productId, category_id: category_id };
        })
      );
      if (ins.error) throw new Error(friendlyDbError(ins.error, "Couldn’t update categories."));
    }
  }

  async function syncProductBadges(productId, badgeIds) {
    var supabase = await client();
    var ids = Array.from(new Set((badgeIds || []).filter(Boolean)));
    var existing = await supabase
      .from("product_badges")
      .select("badge_id")
      .eq("product_id", productId);
    if (existing.error) throw new Error(friendlyDbError(existing.error));
    var current = (existing.data || []).map(function (r) {
      return r.badge_id;
    });
    var toAdd = ids.filter(function (id) {
      return current.indexOf(id) === -1;
    });
    var toRemove = current.filter(function (id) {
      return ids.indexOf(id) === -1;
    });
    if (toRemove.length) {
      var del = await supabase
        .from("product_badges")
        .delete()
        .eq("product_id", productId)
        .in("badge_id", toRemove);
      if (del.error) throw new Error(friendlyDbError(del.error, "Couldn’t update badges."));
    }
    if (toAdd.length) {
      var ins = await supabase.from("product_badges").insert(
        toAdd.map(function (badge_id) {
          return { product_id: productId, badge_id: badge_id };
        })
      );
      if (ins.error) throw new Error(friendlyDbError(ins.error, "Couldn’t update badges."));
    }
  }

  function validateImageFile(file) {
    if (!file) return "Choose an image file.";
    if (!ALLOWED_TYPES[file.type]) {
      return "Use JPEG, PNG, WebP, GIF, or AVIF images.";
    }
    if (file.size > MAX_BYTES) return "Each photo must be 10 MB or smaller.";
    return null;
  }

  function publicUrlForPath(supabase, path) {
    var result = supabase.storage.from(BUCKET).getPublicUrl(path);
    return result.data && result.data.publicUrl;
  }

  function storagePathFromPublicUrl(url) {
    if (!url) return null;
    var marker = "/object/public/" + BUCKET + "/";
    var idx = String(url).indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(String(url).slice(idx + marker.length));
  }

  async function uploadProductImage(productId, file, onProgress) {
    var err = validateImageFile(file);
    if (err) throw new Error(err);
    var supabase = await client();
    var ext = ALLOWED_TYPES[file.type];
    var path =
      productId +
      "/" +
      (global.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(16).slice(2)) +
      "." +
      ext;

    if (typeof onProgress === "function") onProgress("uploading");
    var up = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (up.error) {
      throw new Error(
        friendlyDbError(up.error, "Photo upload failed. Please try again.")
      );
    }
    return {
      path: path,
      image_url: publicUrlForPath(supabase, path),
      alt_text: "",
    };
  }

  /**
   * Replace image rows for a product.
   * images: [{ id?, image_url, alt_text, sort_order, is_primary, storage_path? }]
   * removedIds: existing DB ids to delete (also removes storage objects when possible)
   */
  async function syncProductImages(productId, images, removedExisting) {
    var supabase = await client();
    var warnings = [];

    // Delete removed existing rows + storage objects
    for (var i = 0; i < (removedExisting || []).length; i++) {
      var rem = removedExisting[i];
      var path = rem.storage_path || storagePathFromPublicUrl(rem.image_url);
      if (rem.id) {
        var delRow = await supabase.from("product_images").delete().eq("id", rem.id);
        if (delRow.error) {
          warnings.push("Couldn’t remove one saved photo record.");
          continue;
        }
      }
      if (path) {
        var delFile = await supabase.storage.from(BUCKET).remove([path]);
        if (delFile.error) {
          warnings.push("A photo file may still be in storage; you can retry cleanup later.");
        }
      }
    }

    // Clear primary flags first to satisfy unique index when rewriting
    var clear = await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId);
    if (clear.error) {
      // ignore if no rows
    }

    var existingKeep = (images || []).filter(function (img) {
      return img.id;
    });
    var fresh = (images || []).filter(function (img) {
      return !img.id;
    });

    for (var e = 0; e < existingKeep.length; e++) {
      var img = existingKeep[e];
      var upd = await supabase
        .from("product_images")
        .update({
          alt_text: img.alt_text || "",
          sort_order: img.sort_order || 0,
          is_primary: false,
        })
        .eq("id", img.id)
        .eq("product_id", productId);
      if (upd.error) throw new Error(friendlyDbError(upd.error, "Couldn’t update photo details."));
    }

    if (fresh.length) {
      var ins = await supabase.from("product_images").insert(
        fresh.map(function (img) {
          return {
            product_id: productId,
            image_url: img.image_url,
            alt_text: img.alt_text || "",
            sort_order: img.sort_order || 0,
            is_primary: false,
          };
        })
      );
      if (ins.error) throw new Error(friendlyDbError(ins.error, "Couldn’t save new photos."));
    }

    // Set primary last
    var primary = (images || []).find(function (img) {
      return img.is_primary;
    }) || (images || [])[0];
    if (primary) {
      var target = primary.id
        ? await supabase
            .from("product_images")
            .update({ is_primary: true })
            .eq("id", primary.id)
            .eq("product_id", productId)
        : await supabase
            .from("product_images")
            .update({ is_primary: true })
            .eq("product_id", productId)
            .eq("image_url", primary.image_url);

      if (target.error) {
        throw new Error(friendlyDbError(target.error, "Couldn’t set the main photo."));
      }
    }

    return { warnings: warnings };
  }

  async function deleteProduct(id, images) {
    var supabase = await client();
    var paths = (images || [])
      .map(function (img) {
        return storagePathFromPublicUrl(img.image_url);
      })
      .filter(Boolean);

    var del = await supabase.from("products").delete().eq("id", id);
    if (del.error) throw new Error(friendlyDbError(del.error, "Couldn’t delete the product."));

    if (paths.length) {
      await supabase.storage.from(BUCKET).remove(paths);
      // Non-fatal if storage cleanup fails — rows already gone via cascade
    }
  }

  /**
   * Status change with publish rules (title, price, ≥1 photo when publishing).
   * Hiding / sold_out keep images and product data.
   */
  async function changeProductStatus(product, nextStatus) {
    if (!product || !product.id) throw new Error("That product wasn’t found.");
    if (["draft", "published", "sold_out", "hidden"].indexOf(nextStatus) === -1) {
      throw new Error("Choose a valid status.");
    }

    var imageCount = Array.isArray(product.images)
      ? product.images.length
      : product.primary
        ? 1
        : 0;

    if (nextStatus === "published") {
      var check = validateProductInput(
        {
          title: product.title,
          description: product.description,
          price: product.price,
          sale_price: product.sale_price,
          quantity: product.quantity,
          status: "published",
          product_type: product.product_type || "single",
          featured: product.featured,
          item_no: product.item_no,
          track_inventory: product.track_inventory,
          imageCount: imageCount,
        },
        { publishing: true }
      );
      if (!check.ok) {
        throw new Error(check.errors[0] || "Couldn’t publish this product.");
      }
    }

    return updateProduct(
      product.id,
      {
        title: product.title,
        slug: product.slug,
        description: product.description,
        price: product.price,
        sale_price: product.sale_price,
        quantity: product.quantity,
        item_no: product.item_no,
        track_inventory: product.track_inventory,
        product_type: product.product_type || "single",
        status: nextStatus,
        featured: product.featured,
      },
      product
    );
  }

  /**
   * Delete one image row and its storage object when the path belongs to this product.
   */
  async function deleteProductImage(productId, image) {
    if (!productId || !image || !image.id) {
      throw new Error("That photo wasn’t found.");
    }
    var supabase = await client();
    var path = image.storage_path || storagePathFromPublicUrl(image.image_url);
    if (path && String(path).indexOf(String(productId) + "/") !== 0) {
      // Refuse deleting another product's storage object.
      path = null;
    }

    var del = await supabase
      .from("product_images")
      .delete()
      .eq("id", image.id)
      .eq("product_id", productId);
    if (del.error) {
      throw new Error(friendlyDbError(del.error, "Couldn’t remove that photo."));
    }

    if (path) {
      var rem = await supabase.storage.from(BUCKET).remove([path]);
      if (rem.error) {
        return {
          warnings: [
            "Photo removed from the product, but the file may still be in storage.",
          ],
        };
      }
    }
    return { warnings: [] };
  }

  /**
   * Persist sort_order / primary flags for existing images (same product only).
   */
  async function reorderProductImages(productId, images) {
    if (!productId) throw new Error("That product wasn’t found.");
    var list = (images || []).filter(function (img) {
      return img && img.id;
    });
    if (!list.length) return { warnings: [] };

    var supabase = await client();
    var clear = await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId);
    if (clear.error) {
      throw new Error(friendlyDbError(clear.error, "Couldn’t update photo order."));
    }

    for (var i = 0; i < list.length; i++) {
      var img = list[i];
      var upd = await supabase
        .from("product_images")
        .update({
          sort_order: Number(img.sort_order) || i,
          alt_text: img.alt_text || "",
          is_primary: false,
        })
        .eq("id", img.id)
        .eq("product_id", productId);
      if (upd.error) {
        throw new Error(friendlyDbError(upd.error, "Couldn’t update photo order."));
      }
    }

    var primary =
      list.find(function (img) {
        return img.is_primary;
      }) || list[0];
    if (primary && primary.id) {
      var setPrimary = await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", primary.id)
        .eq("product_id", productId);
      if (setPrimary.error) {
        throw new Error(friendlyDbError(setPrimary.error, "Couldn’t set the main photo."));
      }
    }
    return { warnings: [] };
  }

  async function createCategory(input) {
    var supabase = await client();
    var name = String(input.name || "").trim();
    if (!name) throw new Error("Please enter a category name.");
    var slug = await (async function () {
      var base = slugify(name) || "category";
      var attempt = base;
      var n = 2;
      while (n < 40) {
        var check = await supabase.from("categories").select("id").eq("slug", attempt).maybeSingle();
        if (check.error) throw new Error(friendlyDbError(check.error));
        if (!check.data) return attempt;
        attempt = base + "-" + n;
        n += 1;
      }
      return base + "-" + Date.now();
    })();
    var result = await supabase
      .from("categories")
      .insert({
        name: name,
        slug: slug,
        description: String(input.description || "").trim() || null,
        active: input.active !== false,
        sort_order: Number(input.sort_order) || 0,
      })
      .select("*")
      .single();
    if (result.error) throw new Error(friendlyDbError(result.error, "Couldn’t create category."));
    return result.data;
  }

  async function updateCategory(id, input) {
    var supabase = await client();
    var name = String(input.name || "").trim();
    if (!name) throw new Error("Please enter a category name.");
    var result = await supabase
      .from("categories")
      .update({
        name: name,
        description: String(input.description || "").trim() || null,
        active: !!input.active,
        sort_order: Number(input.sort_order) || 0,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (result.error) throw new Error(friendlyDbError(result.error, "Couldn’t update category."));
    return result.data;
  }

  async function countProducts(filter) {
    var supabase = await client();
    var q = supabase.from("products").select("id", { count: "exact", head: true });
    if (filter && filter.status) {
      q = q.eq("status", filter.status);
    }
    if (filter && filter.track_inventory === true) {
      q = q.eq("track_inventory", true);
    }
    if (filter && filter.quantity === 0) {
      q = q.eq("quantity", 0);
    }
    var result = await q;
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t load product counts."));
    }
    return typeof result.count === "number" ? result.count : 0;
  }

  async function getDashboardCounts() {
    var statuses = ["draft", "published", "sold_out", "hidden"];
    var results = await Promise.all(
      [countProducts({})].concat(
        statuses.map(function (status) {
          return countProducts({ status: status });
        })
      )
    );
    return {
      total: results[0],
      draft: results[1],
      published: results[2],
      sold_out: results[3],
      hidden: results[4],
    };
  }

  async function listRecentProducts(limit) {
    var supabase = await client();
    var lim = Math.min(Math.max(Number(limit) || 8, 1), 20);
    var result = await supabase
      .from("products")
      .select(
        "id, title, slug, price, sale_price, status, quantity, track_inventory, updated_at, product_images(id, image_url, alt_text, sort_order, is_primary)"
      )
      .order("updated_at", { ascending: false })
      .limit(lim);
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t load recent products."));
    }
    return (result.data || []).map(normalizeProductRow);
  }

  /**
   * Published products that track inventory and currently have zero stock.
   * Untracked inventory is never returned here.
   */
  async function listInventoryAttention(limit) {
    var supabase = await client();
    var lim = Math.min(Math.max(Number(limit) || 12, 1), 40);
    var result = await supabase
      .from("products")
      .select(
        "id, title, slug, price, sale_price, status, quantity, track_inventory, updated_at, product_images(id, image_url, alt_text, sort_order, is_primary)"
      )
      .eq("status", "published")
      .eq("track_inventory", true)
      .eq("quantity", 0)
      .order("updated_at", { ascending: false })
      .limit(lim);
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t load inventory alerts."));
    }
    return (result.data || []).map(normalizeProductRow);
  }

  async function countInventoryAttention() {
    return countProducts({
      status: "published",
      track_inventory: true,
      quantity: 0,
    });
  }

  var PRODUCT_STATUS_FILTERS = ["draft", "published", "sold_out", "hidden"];

  function normalizeProductStatusFilter(raw) {
    var value = String(raw || "")
      .trim()
      .toLowerCase();
    if (!value || value === "all" || value === "total") return "";
    if (PRODUCT_STATUS_FILTERS.indexOf(value) === -1) return null;
    return value;
  }

  async function listOrders(opts) {
    opts = opts || {};
    var supabase = await client();
    var q = supabase
      .from("orders")
      .select(
        "id, stripe_session_id, stripe_payment_intent, payment_status, amount_total, currency, customer_name, customer_email, customer_phone, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_state, shipping_postal_code, shipping_country, fulfillment_status, fulfillment_method, tracking_number, carrier, shipped_at, completed_at, created_at, updated_at, order_items(id, product_id, product_name, quantity, unit_amount, amount_total)"
      )
      .order("created_at", { ascending: false });

    if (opts.needsShipping) {
      q = q
        .eq("payment_status", "paid")
        .eq("fulfillment_status", "unfulfilled")
        .eq("fulfillment_method", "ship");
    } else if (opts.paymentStatus) {
      q = q.eq("payment_status", opts.paymentStatus);
    }
    if (opts.fulfillmentStatus) {
      q = q.eq("fulfillment_status", opts.fulfillmentStatus);
    }
    if (opts.limit) {
      q = q.limit(Number(opts.limit));
    }

    var result = await q;
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t load orders."));
    }
    return (result.data || []).map(function (row) {
      var items = Array.isArray(row.order_items) ? row.order_items.slice() : [];
      return Object.assign({}, row, { items: items, order_items: items });
    });
  }

  async function getOrder(id) {
    var supabase = await client();
    var result = await supabase
      .from("orders")
      .select(
        "id, stripe_session_id, stripe_payment_intent, payment_status, amount_total, currency, customer_name, customer_email, customer_phone, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_state, shipping_postal_code, shipping_country, shipping_address, metadata, fulfillment_status, fulfillment_method, tracking_number, carrier, shipped_at, completed_at, created_at, updated_at, order_items(id, product_id, product_name, quantity, unit_amount, amount_total, created_at)"
      )
      .eq("id", id)
      .maybeSingle();
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t load that order."));
    }
    if (!result.data) throw new Error("That order wasn’t found.");
    var items = Array.isArray(result.data.order_items)
      ? result.data.order_items.slice()
      : [];
    return Object.assign({}, result.data, { items: items, order_items: items });
  }

  async function countOrders(opts) {
    opts = opts || {};
    var supabase = await client();
    var q = supabase.from("orders").select("id", { count: "exact", head: true });
    if (opts.paymentStatus) q = q.eq("payment_status", opts.paymentStatus);
    if (opts.needsShipping) {
      q = q
        .eq("payment_status", "paid")
        .eq("fulfillment_status", "unfulfilled")
        .eq("fulfillment_method", "ship");
    }
    var result = await q;
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t count orders."));
    }
    return result.count || 0;
  }

  /**
   * Lightweight paid-order rows for dashboard aggregates (no line items).
   */
  async function listPaidOrdersLite() {
    var supabase = await client();
    var result = await supabase
      .from("orders")
      .select(
        "id, payment_status, amount_total, currency, customer_name, customer_email, customer_phone, fulfillment_status, fulfillment_method, created_at, shipping_city, shipping_state"
      )
      .eq("payment_status", "paid")
      .order("created_at", { ascending: false });
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t load sales data."));
    }
    return result.data || [];
  }

  async function updateOrderFulfillment(id, patch) {
    var supabase = await client();
    var body = {};
    if (patch.fulfillment_status != null) {
      body.fulfillment_status = String(patch.fulfillment_status);
    }
    if (patch.fulfillment_method != null) {
      body.fulfillment_method = String(patch.fulfillment_method);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "tracking_number")) {
      body.tracking_number = patch.tracking_number
        ? String(patch.tracking_number).trim()
        : null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "carrier")) {
      body.carrier = patch.carrier ? String(patch.carrier).trim() : null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "shipped_at")) {
      body.shipped_at = patch.shipped_at;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "completed_at")) {
      body.completed_at = patch.completed_at;
    }
    var result = await supabase
      .from("orders")
      .update(body)
      .eq("id", id)
      .select(
        "id, fulfillment_status, fulfillment_method, tracking_number, carrier, shipped_at, completed_at, updated_at"
      )
      .maybeSingle();
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t update fulfillment."));
    }
    if (!result.data) throw new Error("That order wasn’t found.");
    return result.data;
  }

  async function getSalesGoals() {
    var supabase = await client();
    var result = await supabase
      .from("site_settings")
      .select("id, config")
      .limit(1)
      .maybeSingle();
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t load sales goals."));
    }
    var goals =
      result.data &&
      result.data.config &&
      result.data.config.sales_goals
        ? result.data.config.sales_goals
        : {};
    var weekly = Number(goals.weekly_cents);
    var annual = Number(goals.annual_cents);
    return {
      id: result.data && result.data.id,
      weekly_cents: isFinite(weekly) && weekly >= 0 ? Math.round(weekly) : 30000,
      annual_cents: isFinite(annual) && annual >= 0 ? Math.round(annual) : 1000000,
      config: (result.data && result.data.config) || {},
    };
  }

  async function saveSalesGoals(weeklyCents, annualCents) {
    var current = await getSalesGoals();
    if (!current.id) {
      throw new Error("Site settings aren’t set up yet.");
    }
    var weekly = Math.round(Number(weeklyCents));
    var annual = Math.round(Number(annualCents));
    if (!isFinite(weekly) || weekly < 0) {
      throw new Error("Enter a valid weekly goal.");
    }
    if (!isFinite(annual) || annual < 0) {
      throw new Error("Enter a valid annual goal.");
    }
    var nextConfig = Object.assign({}, current.config || {}, {
      sales_goals: {
        weekly_cents: weekly,
        annual_cents: annual,
      },
    });
    var supabase = await client();
    var result = await supabase
      .from("site_settings")
      .update({ config: nextConfig })
      .eq("id", current.id)
      .select("id, config")
      .maybeSingle();
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t save sales goals."));
    }
    return {
      weekly_cents: weekly,
      annual_cents: annual,
    };
  }

  async function getSiteSettingsRow() {
    var supabase = await client();
    var result = await supabase
      .from("site_settings")
      .select("id, config")
      .limit(1)
      .maybeSingle();
    if (result.error) {
      throw new Error(friendlyDbError(result.error, "Couldn’t load site settings."));
    }
    return {
      id: result.data && result.data.id,
      config: (result.data && result.data.config) || {},
    };
  }

  async function getAppearance() {
    var row = await getSiteSettingsRow();
    var appearance =
      typeof SRAppearance !== "undefined"
        ? SRAppearance.normalize(row.config && row.config.appearance)
        : Object.assign(
            {},
            {
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
            },
            (row.config && row.config.appearance) || {}
          );
    return {
      id: row.id,
      appearance: appearance,
      config: row.config || {},
    };
  }

  async function saveAppearance(appearanceInput, options) {
    var opts = options || {};
    var current = await getAppearance();
    if (!current.id) {
      throw new Error("Site settings aren’t set up yet.");
    }
    var appearance =
      typeof SRAppearance !== "undefined"
        ? SRAppearance.normalize(appearanceInput)
        : appearanceInput;

    var previousPath = current.appearance && current.appearance.hero_storage_path;
    var pendingFile = opts.pendingHeroFile || null;

    if (pendingFile) {
      var uploaded = await uploadHeroImage(pendingFile);
      appearance.hero_image_url = uploaded.image_url;
      appearance.hero_storage_path = uploaded.path;
    }

    if (opts.useDefaultHero) {
      appearance.hero_image_url = null;
      appearance.hero_storage_path = null;
    }

    appearance =
      typeof SRAppearance !== "undefined"
        ? SRAppearance.normalize(appearance)
        : appearance;

    var nextConfig = Object.assign({}, current.config || {}, {
      appearance: appearance,
    });
    var supabase = await client();
    var result = await supabase
      .from("site_settings")
      .update({ config: nextConfig })
      .eq("id", current.id)
      .select("id, config")
      .maybeSingle();
    if (result.error) {
      // If we uploaded a new hero but failed to save settings, try to remove the orphan.
      if (pendingFile && appearance.hero_storage_path) {
        try {
          await supabase.storage
            .from(SITE_ASSETS_BUCKET)
            .remove([appearance.hero_storage_path]);
        } catch (cleanupErr) {
          /* ignore */
        }
      }
      throw new Error(friendlyDbError(result.error, "Couldn’t save appearance."));
    }

    // After successful save, remove previous uploaded hero if replaced or restored to default.
    if (
      previousPath &&
      previousPath !== appearance.hero_storage_path &&
      String(previousPath).indexOf("hero/") === 0
    ) {
      try {
        await supabase.storage.from(SITE_ASSETS_BUCKET).remove([previousPath]);
      } catch (cleanupErr) {
        /* non-fatal */
      }
    }

    return appearance;
  }

  function validateHeroImageFile(file) {
    if (!file) return "Choose a hero image.";
    if (!ALLOWED_TYPES[file.type]) {
      return "Use JPEG, PNG, WebP, GIF, or AVIF for the hero image.";
    }
    if (file.size > HERO_MAX_BYTES) {
      return "Hero image must be 10 MB or smaller.";
    }
    return null;
  }

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("That image couldn’t be read. Try another file."));
      };
      img.src = url;
    });
  }

  /**
   * Resize oversized heroes client-side (max edge 2400) as JPEG/WebP when possible.
   * Returns { file, width, height, warning }.
   */
  async function prepareHeroImageFile(file) {
    var err = validateHeroImageFile(file);
    if (err) throw new Error(err);

    var img = await loadImageFromFile(file);
    var width = img.naturalWidth || img.width;
    var height = img.naturalHeight || img.height;
    var warning = null;

    if (width < HERO_MIN_WIDTH || height < HERO_MIN_HEIGHT) {
      warning =
        "This image is smaller than recommended (" +
        width +
        "×" +
        height +
        "). It may look soft or pixelated on large screens.";
    }

    var needsResize = width > HERO_MAX_EDGE || height > HERO_MAX_EDGE;
    if (!needsResize || typeof document === "undefined") {
      return { file: file, width: width, height: height, warning: warning };
    }

    var scale = Math.min(HERO_MAX_EDGE / width, HERO_MAX_EDGE / height, 1);
    var tw = Math.max(1, Math.round(width * scale));
    var th = Math.max(1, Math.round(height * scale));
    var canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    var ctx = canvas.getContext("2d");
    if (!ctx) {
      return { file: file, width: width, height: height, warning: warning };
    }
    ctx.drawImage(img, 0, 0, tw, th);

    var outType =
      file.type === "image/png" || file.type === "image/webp"
        ? file.type
        : "image/jpeg";
    var quality = outType === "image/png" ? undefined : 0.86;

    var blob = await new Promise(function (resolve) {
      canvas.toBlob(function (b) {
        resolve(b);
      }, outType, quality);
    });

    if (!blob) {
      return { file: file, width: width, height: height, warning: warning };
    }

    var name = String(file.name || "hero").replace(/\.[^.]+$/, "");
    var ext = ALLOWED_TYPES[outType] || "jpg";
    var next = new File([blob], name + "-hero." + ext, { type: outType });
    return { file: next, width: tw, height: th, warning: warning };
  }

  function publicUrlForSiteAsset(supabase, path) {
    var result = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path);
    return result.data && result.data.publicUrl;
  }

  async function uploadHeroImage(file) {
    var prepared = await prepareHeroImageFile(file);
    var supabase = await client();
    var ext = ALLOWED_TYPES[prepared.file.type] || "jpg";
    var path =
      "hero/" +
      (global.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(16).slice(2)) +
      "." +
      ext;

    var up = await supabase.storage.from(SITE_ASSETS_BUCKET).upload(path, prepared.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: prepared.file.type,
    });
    if (up.error) {
      throw new Error(
        friendlyDbError(
          up.error,
          "Hero upload failed. If this is the first time, the site-assets storage migration may still need to be applied."
        )
      );
    }
    return {
      path: path,
      image_url: publicUrlForSiteAsset(supabase, path),
      width: prepared.width,
      height: prepared.height,
      warning: prepared.warning,
    };
  }

  global.SRCatalog = {
    BUCKET: BUCKET,
    MAX_BYTES: MAX_BYTES,
    ALLOWED_TYPES: ALLOWED_TYPES,
    PRODUCT_STATUS_FILTERS: PRODUCT_STATUS_FILTERS,
    slugify: slugify,
    money: money,
    parseMoneyInput: parseMoneyInput,
    formatMoneyInput: formatMoneyInput,
    escapeHtml: escapeHtml,
    friendlyDbError: friendlyDbError,
    primaryImage: primaryImage,
    normalizeProductStatusFilter: normalizeProductStatusFilter,
    listProducts: listProducts,
    fetchProducts: listProducts,
    getProduct: getProduct,
    fetchProduct: getProduct,
    listCategories: listCategories,
    fetchCategories: listCategories,
    listBadges: listBadges,
    fetchBadges: listBadges,
    countProducts: countProducts,
    getDashboardCounts: getDashboardCounts,
    listRecentProducts: listRecentProducts,
    listInventoryAttention: listInventoryAttention,
    countInventoryAttention: countInventoryAttention,
    listOrders: listOrders,
    getOrder: getOrder,
    countOrders: countOrders,
    listPaidOrdersLite: listPaidOrdersLite,
    updateOrderFulfillment: updateOrderFulfillment,
    getSalesGoals: getSalesGoals,
    saveSalesGoals: saveSalesGoals,
    getAppearance: getAppearance,
    saveAppearance: saveAppearance,
    validateHeroImageFile: validateHeroImageFile,
    prepareHeroImageFile: prepareHeroImageFile,
    uploadHeroImage: uploadHeroImage,
    SITE_ASSETS_BUCKET: SITE_ASSETS_BUCKET,
    validateProductInput: validateProductInput,
    createProduct: createProduct,
    updateProduct: updateProduct,
    changeProductStatus: changeProductStatus,
    syncProductCategories: syncProductCategories,
    saveProductCategories: syncProductCategories,
    syncProductBadges: syncProductBadges,
    saveProductBadges: syncProductBadges,
    validateImageFile: validateImageFile,
    uploadProductImage: uploadProductImage,
    syncProductImages: syncProductImages,
    deleteProductImage: deleteProductImage,
    reorderProductImages: reorderProductImages,
    deleteProduct: deleteProduct,
    createCategory: createCategory,
    updateCategory: updateCategory,
    storagePathFromPublicUrl: storagePathFromPublicUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
