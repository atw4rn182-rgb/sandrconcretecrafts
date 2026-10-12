#!/usr/bin/env node
/**
 * Catalog pagination + thumbnail checks. Uses in-memory fixtures only.
 * Does not insert products or touch production storage.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

["app.js", "admin/products.js", "admin/catalog-api.js", "js/storefront-catalog.js", "js/image-display.js", "admin/product-edit.js"].forEach(
  function (rel) {
    execFileSync(process.execPath, ["--check", path.join(root, rel)], { stdio: "pipe" });
    assert(true, "syntax " + rel);
  }
);

function pad(n) {
  return String(n).padStart(12, "0");
}

function makeRows(count) {
  var hearts = { id: "cat-hearts", name: "Hearts", slug: "hearts", active: true };
  var planters = { id: "cat-planters", name: "Planters", slug: "planters", active: true };
  var rows = [];
  for (var i = 0; i < count; i++) {
    var cat = i % 2 ? hearts : planters;
    var updated = new Date(Date.UTC(2026, 0, 1, 0, i, 0)).toISOString();
    rows.push({
      id: "00000000-0000-4000-8000-" + pad(i),
      title: i === 7 ? "Unique Mushroom House" : "Piece " + String(i).padStart(4, "0"),
      slug: "piece-" + i,
      description: "Handmade piece " + i,
      price: 18,
      painted_price: null,
      sale_price: null,
      quantity: 3,
      status: i % 29 === 0 ? "draft" : "published",
      product_type: "single",
      featured: i % 40 === 0,
      source_key: null,
      item_no: String(1000 + i),
      track_inventory: true,
      created_at: updated,
      updated_at: updated,
      published_at: updated,
      product_images: [
        {
          id: "img-" + i,
          image_url:
            "https://example.supabase.co/storage/v1/object/public/product-images/p/" + i + ".jpg",
          alt_text: "",
          sort_order: 0,
          is_primary: true,
        },
      ],
      product_categories: [{ category_id: cat.id, categories: cat }],
      product_badges: [],
    });
  }
  return rows;
}

function createClient(rows) {
  var calls = [];
  function run(state) {
    if (state.table === "product_categories") {
      var ids = [];
      state.ins.forEach(function (pair) {
        if (pair[0] === "product_id") ids = pair[1];
      });
      var linked = rows
        .filter(function (row) {
          return ids.indexOf(row.id) !== -1;
        })
        .map(function (row) {
          return {
            product_id: row.id,
            category_id: row.product_categories[0].category_id,
            categories: row.product_categories[0].categories,
          };
        });
      return { data: state.head ? null : linked, error: null, count: linked.length };
    }

    var list = rows.slice();
    state.eqs.forEach(function (pair) {
      if (pair[0] === "status") {
        list = list.filter(function (row) {
          return row.status === pair[1];
        });
      } else if (pair[0] === "product_categories.category_id") {
        list = list.filter(function (row) {
          return row.product_categories.some(function (pc) {
            return pc.category_id === pair[1];
          });
        });
      }
    });
    state.ilikes.forEach(function (pair) {
      var needle = String(pair[1] || "").replace(/%/g, "").toLowerCase();
      if (!needle) return;
      list = list.filter(function (row) {
        return String(row[pair[0]] || "").toLowerCase().indexOf(needle) !== -1;
      });
    });
    state.ins.forEach(function (pair) {
      list = list.filter(function (row) {
        return pair[1].indexOf(row[pair[0]]) !== -1;
      });
    });
    if (
      state.ors.some(function (clause) {
        return String(clause).indexOf("track_inventory") !== -1;
      })
    ) {
      list = list.filter(function (row) {
        return !row.track_inventory || Number(row.quantity) > 0;
      });
    }
    for (var o = state.orders.length - 1; o >= 0; o--) {
      var col = state.orders[o][0];
      var asc = state.orders[o][1];
      list.sort(function (a, b) {
        if (a[col] === b[col]) return 0;
        if (a[col] > b[col]) return asc ? 1 : -1;
        return asc ? -1 : 1;
      });
    }
    var total = list.length;
    if (state.range) {
      list = list.slice(state.range[0], state.range[1] + 1);
    } else if (state.limit) {
      list = list.slice(0, state.limit);
    }
    return { data: state.head ? null : list, error: null, count: total };
  }

  function from(table) {
    var state = {
      table: table,
      eqs: [],
      ilikes: [],
      ins: [],
      ors: [],
      orders: [],
      range: null,
      limit: 0,
      head: false,
    };
    calls.push(state);
    var api = {
      select: function (_sel, opts) {
        state.head = !!(opts && opts.head);
        return api;
      },
      eq: function (col, val) {
        state.eqs.push([col, val]);
        return api;
      },
      ilike: function (col, val) {
        state.ilikes.push([col, val]);
        return api;
      },
      in: function (col, val) {
        state.ins.push([col, val]);
        return api;
      },
      or: function (val) {
        state.ors.push(val);
        return api;
      },
      order: function (col, opts) {
        state.orders.push([col, !!(opts && opts.ascending)]);
        return api;
      },
      range: function (fromIndex, toIndex) {
        state.range = [fromIndex, toIndex];
        return api;
      },
      limit: function (n) {
        state.limit = n;
        return api;
      },
      then: function (ok, bad) {
        return Promise.resolve()
          .then(function () {
            return run(state);
          })
          .then(ok, bad);
      },
    };
    return api;
  }

  return {
    calls: calls,
    client: { from: from },
  };
}

function loadScript(rel, sandbox) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), sandbox);
}

const rows = makeRows(150);
const adminMock = createClient(rows);
const adminSandbox = {
  console: console,
  URL: URL,
  SRAdminAuth: {
    getClient: function () {
      return Promise.resolve(adminMock.client);
    },
  },
};
adminSandbox.window = adminSandbox;
adminSandbox.globalThis = adminSandbox;
vm.createContext(adminSandbox);
loadScript("admin/catalog-api.js", adminSandbox);
  const SRCatalog = adminSandbox.SRCatalog;

(async function () {
  assert(SRCatalog.PRODUCT_PAGE_SIZE === 50, "admin page size is 50");
  assert(SRCatalog.pageHasMore(50, 50, 50, 150) === true, "page 1 of 150 still has more");
  assert(SRCatalog.pageHasMore(50, 50, 100, 150) === true, "page 2 of 150 still has more");
  assert(SRCatalog.pageHasMore(50, 50, 150, 150) === false, "full catalog stops after 150");
  assert(SRCatalog.pageHasMore(0, 50, 150, 150) === false, "empty page stops");

  var loaded = [];
  var offset = 0;
  var requests = 0;
  var guard = 0;
  while (guard < 8) {
    guard += 1;
    requests += 1;
    var page = await SRCatalog.listProductsPage({ offset: offset, limit: 50, sort: "newest" });
    var merged = SRCatalog.mergeProductPage(loaded, page.products);
    loaded = merged.products;
    offset += page.products.length;
    if (!SRCatalog.pageHasMore(page.products.length, page.limit, loaded.length, page.total)) break;
  }
  assert(requests === 3, "150 products take 3 database pages (got " + requests + ")");
  assert(loaded.length === 150, "all 150 products loaded");
  assert(new Set(loaded.map(function (p) { return p.id; })).size === 150, "no duplicate ids");
  var expected = rows
    .slice()
    .sort(function (a, b) {
      return a.updated_at < b.updated_at ? 1 : -1;
    })
    .map(function (row) {
      return row.id;
    });
  assert(
    loaded.map(function (p) { return p.id; }).join() === expected.join(),
    "newest updated_at order is stable across pages"
  );
  assert(loaded.some(function (p) { return p.title === "Unique Mushroom House"; }), "older product is not skipped");

  var ranges = adminMock.calls
    .filter(function (call) {
      return call.table === "products" && call.range;
    })
    .map(function (call) {
      return call.range.join("-");
    });
  assert(ranges.indexOf("0-49") !== -1, "first query range is 0-49");
  assert(ranges.indexOf("50-99") !== -1, "second query range is 50-99");
  assert(ranges.indexOf("100-149") !== -1, "third query range is 100-149");
  assert(
    adminMock.calls.every(function (call) {
      return !call.range || call.range[1] - call.range[0] <= 99;
    }),
    "no query asks Supabase for the whole catalog"
  );

  var firstIds = loaded.slice(0, 50).map(function (p) { return p.title; });
  var found = await SRCatalog.listProductsPage({
    offset: 0,
    limit: 50,
    search: "Unique Mushroom House",
  });
  assert(found.total === 1, "search count is the whole catalog, not the loaded page");
  assert(found.products.length === 1 && found.products[0].title === "Unique Mushroom House", "search finds a product outside batch 1");
  assert(firstIds.indexOf("Unique Mushroom House") === -1, "that product is not in the newest 50");

  var cleared = await SRCatalog.listProductsPage({ offset: 0, limit: 50, search: "" });
  assert(cleared.products[0].title !== "Unique Mushroom House", "clearing search restores newest-first");
  assert(cleared.total === 150, "cleared search counts the full catalog");

  var catLoaded = [];
  var catOffset = 0;
  var catGuard = 0;
  while (catGuard < 8) {
    catGuard += 1;
    var catPage = await SRCatalog.listProductsPage({
      offset: catOffset,
      limit: 50,
      categoryId: "cat-hearts",
      sort: "newest",
    });
    catLoaded = SRCatalog.mergeProductPage(catLoaded, catPage.products).products;
    catOffset += catPage.products.length;
    if (!SRCatalog.pageHasMore(catPage.products.length, catPage.limit, catLoaded.length, catPage.total)) break;
  }
  var heartIds = rows
    .filter(function (row) {
      return row.product_categories[0].category_id === "cat-hearts";
    })
    .map(function (row) {
      return row.id;
    });
  assert(catLoaded.length === heartIds.length, "category filter walks every matching product");
  assert(
    catLoaded.every(function (p) {
      return (p.categories || []).some(function (c) {
        return c.id === "cat-hearts";
      });
    }),
    "category pages only include that category"
  );
  assert(
    catLoaded.some(function (p) {
      return p.title === "Unique Mushroom House";
    }),
    "category filter still finds products past the first page"
  );

  var doubled = SRCatalog.mergeProductPage(loaded.slice(0, 50), loaded.slice(0, 50));
  assert(doubled.products.length === 50 && doubled.duplicates === 50, "merging the same page does not duplicate cards");

  const storeRows = rows.map(function (row) {
    return Object.assign({}, row, { status: "published" });
  });
  const storeMock = createClient(storeRows);
  const storeSandbox = {
    console: console,
    URL: URL,
    location: { origin: "https://www.sandrconcretecrafts.com", href: "https://www.sandrconcretecrafts.com/" },
    SRSupabase: {
      isConfigured: function () {
        return true;
      },
      createClient: function () {
        return storeMock.client;
      },
    },
  };
  storeSandbox.window = storeSandbox;
  storeSandbox.globalThis = storeSandbox;
  vm.createContext(storeSandbox);
  loadScript("js/storefront-catalog.js", storeSandbox);
  const Cat = storeSandbox.SRStorefrontCatalog;
  assert(Cat.STOREFRONT_PAGE_SIZE === 24, "storefront page size is 24");

  var shop = [];
  var shopOffset = 0;
  var shopRequests = 0;
  var shopGuard = 0;
  while (shopGuard < 12) {
    shopGuard += 1;
    shopRequests += 1;
    var shopPage = await Cat.fetchStorefrontProductPage({ offset: shopOffset, limit: 24 });
    shop = Cat.mergeProductPage(shop, shopPage.products).products;
    shopOffset += shopPage.products.length;
    if (!Cat.pageHasMore(shopPage.products.length, shopPage.limit, shop.length, shopPage.total)) break;
  }
  assert(shopRequests === 7, "150 storefront products take 7 pages of 24 (got " + shopRequests + ")");
  assert(shop.length === 150, "storefront pages cover every published product");
  assert(new Set(shop.map(function (p) { return p.id; })).size === 150, "storefront pages have no duplicates");
  var shopRanges = storeMock.calls
    .filter(function (call) {
      return call.table === "products" && call.range;
    })
    .map(function (call) {
      return call.range[0];
    });
  assert(shopRanges[0] === 0 && shopRanges[1] === 24 && shopRanges[2] === 48, "storefront offsets advance by 24");

  var deep = await Cat.fetchStorefrontProductPage({
    offset: 0,
    limit: 24,
    categoryId: "cat-hearts",
  });
  assert(deep.total === 75, "storefront category count is the full match set");
  assert(deep.products.length === 24, "storefront category still pages");
  assert(
    deep.products.every(function (p) {
      return (p.categories || []).some(function (c) {
        return c.id === "cat-hearts";
      });
    }),
    "storefront category page is filtered in the query"
  );

  const imageSandbox = {
    console: console,
    URL: URL,
    location: { href: "https://www.sandrconcretecrafts.com/" },
  };
  imageSandbox.window = imageSandbox;
  imageSandbox.globalThis = imageSandbox;
  vm.createContext(imageSandbox);
  loadScript("js/image-display.js", imageSandbox);
  const Images = imageSandbox.SRImageDisplay;
  var original =
    "https://example.supabase.co/storage/v1/object/public/product-images/prod/photo.jpg";
  var thumb = Images.displayUrl(original, "adminThumb");
  assert(thumb === "/img/admin/prod/photo.jpg", "admin thumbs use one same-origin size");
  assert(thumb.indexOf("supabase") === -1, "thumbnail URL is not a Supabase request");
  assert(Images.displayUrl(original, "card") === "/img/card/prod/photo.jpg", "cards use one 600px route");
  assert(Images.displayUrl(original, "about") === "/img/card/prod/photo.jpg", "about photo uses the card size");
  assert(Images.displayUrl(original, "detail") === "/img/detail/prod/photo.jpg", "detail uses its own larger route");
  assert(Images.displayUrl("/assets/prod-01.png", "card") === "/assets/prod-01.png", "local assets stay unchanged");
  var tag = Images.imgTag(original, { preset: "card", alt: "Planter", width: 800, height: 800 });
  assert(tag.indexOf('loading="lazy"') !== -1, "card images lazy-load");
  assert(tag.indexOf('decoding="async"') !== -1, "card images decode async");
  assert(tag.indexOf("data-full=") === -1, "cards do not fall back to the stored original");
  assert(tag.indexOf("srcset=") === -1, "cards do not request a second image size");
  var eager = Images.imgTag(original, { preset: "card", alt: "", eager: true });
  assert(eager.indexOf('loading="eager"') !== -1 && eager.indexOf('fetchpriority="high"') !== -1, "above-the-fold images are prioritized");

  const productsJs = fs.readFileSync(path.join(root, "admin/products.js"), "utf8");
  const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const catalogJs = fs.readFileSync(path.join(root, "admin/catalog-api.js"), "utf8");
  const editJs = fs.readFileSync(path.join(root, "admin/product-edit.js"), "utf8");
  assert(productsJs.indexOf("listProductsPage") !== -1, "admin list uses database pages");
  assert(productsJs.indexOf("listProducts()") === -1, "admin products page does not fetch the full catalog");
  assert(appJs.indexOf("fetchStorefrontProductPage") !== -1, "storefront loads a page");
  assert(appJs.indexOf('aboutImg.loading = "lazy"') !== -1, "about photo waits until it is near the screen");
  assert(appJs.indexOf("fetchStorefrontProducts()") === -1, "storefront startup does not fetch every product");
  assert(appJs.indexOf("data-catalog-page") !== -1, "storefront page links are real anchors");
  assert(appJs.indexOf('rel="next"') !== -1, "storefront exposes a next-page link");
  assert(catalogJs.indexOf('cacheControl: "31536000"') !== -1, "new product photos are cached as immutable paths");
  assert(catalogJs.indexOf("prepareProductImageFile") !== -1, "uploads optimize before storage");
  assert(catalogJs.indexOf("upload(path, stored,") !== -1, "storage receives the prepared photo");
  assert(catalogJs.indexOf("imageOrientation: \"from-image\"") !== -1, "uploads correct photo orientation");
  assert(fs.readFileSync(path.join(root, "js/image-optimize.js"), "utf8").indexOf("MAX_EDGE = 1600") !== -1, "stored photos are capped at 1600px");
  assert(editJs.indexOf("editorThumb") !== -1 && editJs.indexOf("editorPreview") !== -1, "editor uses display sizes");
  assert(editJs.indexOf("lastDesktop === desktop") !== -1, "phone keyboard scroll fix remains");
  assert(fs.readFileSync(path.join(root, "admin/product-edit.html"), "utf8").indexOf('id="description"') !== -1, "description field remains");

  if (failed) {
    console.error(failed + " failed");
    process.exit(1);
  }
  console.log("catalog performance checks passed");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
