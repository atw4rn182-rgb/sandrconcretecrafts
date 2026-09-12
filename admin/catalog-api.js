/**
 * Catalog data helpers for admin product/category management.
 * Uses authenticated Supabase client (anon key + session). Never service-role.
 */
(function (global) {
  "use strict";

  var BUCKET = "product-images";
  var ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  var MAX_BYTES = 10 * 1024 * 1024;

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
    var price = Number(input.price);
    var saleRaw = input.sale_price;
    var sale =
      saleRaw === "" || saleRaw == null ? null : Number(saleRaw);
    var quantity = Number(input.quantity);
    var status = input.status || "draft";
    var productType = input.product_type || "single";
    var imageCount = Number(input.imageCount || 0);
    var trackInventory = !!input.track_inventory;
    var itemNo = String(input.item_no || "").trim() || null;

    if (!title) errors.push("Please add a product title.");
    if (!description) errors.push("Please add a short description.");
    if (!isFinite(price) || price < 0) errors.push("Price must be zero or greater.");
    if (sale != null && (!isFinite(sale) || sale < 0)) {
      errors.push("Sale price must be zero or greater.");
    }
    if (sale != null && isFinite(price) && sale > price) {
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

  global.SRCatalog = {
    BUCKET: BUCKET,
    MAX_BYTES: MAX_BYTES,
    ALLOWED_TYPES: ALLOWED_TYPES,
    PRODUCT_STATUS_FILTERS: PRODUCT_STATUS_FILTERS,
    slugify: slugify,
    money: money,
    escapeHtml: escapeHtml,
    friendlyDbError: friendlyDbError,
    primaryImage: primaryImage,
    normalizeProductStatusFilter: normalizeProductStatusFilter,
    listProducts: listProducts,
    getProduct: getProduct,
    listCategories: listCategories,
    listBadges: listBadges,
    countProducts: countProducts,
    getDashboardCounts: getDashboardCounts,
    listRecentProducts: listRecentProducts,
    listInventoryAttention: listInventoryAttention,
    countInventoryAttention: countInventoryAttention,
    validateProductInput: validateProductInput,
    createProduct: createProduct,
    updateProduct: updateProduct,
    syncProductCategories: syncProductCategories,
    syncProductBadges: syncProductBadges,
    validateImageFile: validateImageFile,
    uploadProductImage: uploadProductImage,
    syncProductImages: syncProductImages,
    deleteProduct: deleteProduct,
    createCategory: createCategory,
    updateCategory: updateCategory,
    storagePathFromPublicUrl: storagePathFromPublicUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
