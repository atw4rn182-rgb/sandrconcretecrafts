var fs = require("fs");
var code = fs.readFileSync("js/appearance.js", "utf8");
var g = {};
eval(code.replace(/typeof window !== "undefined" \? window : globalThis/, "g"));
var A = g.SRAppearance;
var d = A.cloneDefaults();
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
assert(d.accent === "terracotta", "default accent");
assert(d.hero_image_url === null, "default hero url null");
assert(A.resolveHeroUrl(d) === "/assets/hero-porch-fullbleed.jpg", "default hero path");
assert(d.hero_position_desktop_x === "right", "desktop x");
assert(d.hero_position_mobile_x === "center", "mobile x");
assert(A.desktopObjectPosition(d) === "78% 50%", "desktop pos");
assert(A.mobileObjectPosition(d) === "50% 50%", "mobile pos");
assert(A.automaticSeasonalTheme(new Date(2026, 9, 15)) === "halloween", "oct");
assert(A.automaticSeasonalTheme(new Date(2026, 11, 5)) === "christmas", "dec");
assert(A.automaticSeasonalTheme(new Date(2026, 6, 4)) === "fourth_of_july", "jul");
assert(A.automaticSeasonalTheme(new Date(2026, 5, 20)) === "fourth_of_july", "jun20");
assert(A.automaticSeasonalTheme(new Date(2026, 3, 1)) === "easter", "easter");
assert(A.automaticSeasonalTheme(new Date(2026, 1, 10)) === "off", "feb");
assert(
  A.resolveSeasonalTheme(
    { seasonal_mode: "automatic", seasonal_theme: "christmas" },
    new Date(2026, 1, 10)
  ) === "off",
  "auto feb"
);
assert(
  A.resolveSeasonalTheme({ seasonal_mode: "manual", seasonal_theme: "christmas" }) ===
    "christmas",
  "manual"
);
assert(A.normalize({ accent: "neon" }).accent === "terracotta", "bad accent");
assert(A.normalize({ hero_storage_path: "../etc" }).hero_storage_path === null, "path traversal");
assert(A.normalize({ hero_storage_path: "hero/ok.jpg" }).hero_storage_path === "hero/ok.jpg", "ok path");
assert(A.equals(d, A.cloneDefaults()), "equals");
var up = A.upcomingSeasonReminder(new Date(2026, 8, 14));
assert(up && up.key === "halloween", "upcoming from sep");

var mig = fs.readFileSync(
  "supabase/migrations/20260914000002_site_assets_hero.sql",
  "utf8"
);
assert(mig.indexOf("site-assets") >= 0, "migration bucket");
assert(mig.indexOf("is_active_admin") >= 0, "migration admin");
assert(mig.indexOf("hero") >= 0, "migration hero folder");

var html = fs.readFileSync("admin/appearance.html", "utf8");
assert(html.indexOf("Change Hero Image") >= 0, "hero upload ui");
assert(html.indexOf("Restore Default Hero") >= 0, "restore default");
assert(html.indexOf("hero_position_desktop_x") >= 0, "desktop position");
assert(html.indexOf("hero_position_mobile_x") >= 0, "mobile position");

var api = fs.readFileSync("admin/catalog-api.js", "utf8");
assert(api.indexOf("uploadHeroImage") >= 0, "upload helper");
assert(api.indexOf("SITE_ASSETS_BUCKET") >= 0, "site assets bucket");
assert(api.indexOf("prepareHeroImageFile") >= 0, "prepare hero");

console.log("appearance + hero logic OK");
