var fs = require("fs");
var html = fs.readFileSync("admin/appearance.html", "utf8");
var model = fs.readFileSync("js/appearance.js", "utf8");
var adminJs = fs.readFileSync("admin/appearance.js", "utf8");
var idx = fs.readFileSync("index.html", "utf8");
var shell = fs.readFileSync("admin/admin-shell.js", "utf8");
var api = fs.readFileSync("admin/catalog-api.js", "utf8");
var css = fs.readFileSync("styles.css", "utf8");
var decorCss = fs.readFileSync("css/seasonal-decor.css", "utf8");

var checks = [
  ["heroFileInput", html.indexOf("heroFileInput") >= 0],
  ["Change Hero Image", html.indexOf("Change Hero Image") >= 0],
  ["Restore Current Saved", html.indexOf("Restore Current Saved") >= 0],
  ["Restore Default Hero", html.indexOf("Restore Default Hero") >= 0],
  ["Desktop preview toggle", html.indexOf('data-device="desktop"') >= 0],
  ["Mobile preview toggle", html.indexOf('data-device="mobile"') >= 0],
  ["Halloween theme", html.indexOf("halloween") >= 0],
  ["Christmas theme", html.indexOf("christmas") >= 0],
  ["Fourth of July", html.indexOf("fourth_of_july") >= 0],
  ["Easter theme", html.indexOf("easter") >= 0],
  ["Thanksgiving theme", html.indexOf("thanksgiving") >= 0],
  ["holiday decor toggle", html.indexOf("holidayDecorationsToggle") >= 0],
  ["decoration intensity", html.indexOf("decoration_intensity") >= 0],
  ["Save Appearance", html.indexOf("Save Appearance") >= 0],
  ["Preview Storefront", html.indexOf("Preview Storefront") >= 0],
  ["appearance.js on index", idx.indexOf("appearance.js") >= 0],
  ["data-appearance-hero", idx.indexOf("data-appearance-hero") >= 0],
  ["seasonal-decor.css on index", idx.indexOf("seasonal-decor.css") >= 0],
  ["seasonal-decor.css on appearance", html.indexOf("seasonal-decor.css") >= 0],
  ["nav Appearance link", shell.indexOf("appearance.html") >= 0],
  ["uploadHeroImage API", api.indexOf("uploadHeroImage") >= 0],
  ["site-assets bucket", api.indexOf("site-assets") >= 0],
  ["hero positions model", model.indexOf("hero_position_desktop_x") >= 0],
  ["season CSS halloween", css.indexOf('data-season="halloween"') >= 0],
  ["season CSS thanksgiving", css.indexOf('data-season="thanksgiving"') >= 0],
  ["season decor SVG layers", decorCss.indexOf("halloween-hero.svg") >= 0],
  ["thanksgiving decor SVG", decorCss.indexOf("thanksgiving-hero.svg") >= 0],
  ["accent follows terracotta var", css.indexOf("--accent: var(--terracotta)") >= 0],
  ["accent follows turquoise var", css.indexOf("--accent: var(--turquoise)") >= 0],
  ["no hardcoded terracotta accent hex", css.indexOf('data-accent="terracotta"]') >= 0 && !/data-accent="terracotta"\][^{]*\{\s*--accent:\s*#c45c32/.test(css)],
  ["no secrets in appearance files", !/SERVICE_ROLE|sk_live_|sk_test_|rk_live_/.test(html + model + adminJs)],
];

var fail = 0;
checks.forEach(function (c) {
  console.log((c[1] ? "PASS" : "FAIL") + ": " + c[0]);
  if (!c[1]) fail++;
});
if (fail) process.exit(1);
console.log("structure OK");
