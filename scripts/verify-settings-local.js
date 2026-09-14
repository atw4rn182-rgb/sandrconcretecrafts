var fs = require("fs");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var code = fs.readFileSync("js/store-settings.js", "utf8");
var g = {};
eval(code.replace(/typeof window !== "undefined" \? window : globalThis/, "g"));
var S = g.SRStoreSettings;

var d = S.cloneDefaults();
assert(d.business.city === "Milan", "default city");
assert(d.business.state === "NM", "default state");
assert(d.announcement.enabled === false, "announce off");
assert(d.fulfillment.pickup_enabled === true, "pickup on");

var n = S.normalize({
  business: { name: " Test Shop ", city: "Milan", state: "New Mexico" },
  contact: { email: "Hi@Example.COM", email_enabled: true, phone: "505-555-1212", phone_enabled: true },
  social: { facebook: "facebook.com/test", instagram: "javascript:alert(1)" },
  announcement: { enabled: true, text: "  Hello  ", style: "sale" },
  appearance: { seasonal_theme: "halloween" },
  sales_goals: { weekly_cents: 1 },
});
assert(n.business.state === "NM", "NM normalize");
assert(n.contact.email === "hi@example.com", "email normalize");
assert(n.social.facebook.indexOf("https://") === 0, "facebook url");
assert(n.social.instagram === "", "block javascript url");
assert(n.announcement.style === "sale", "announce style");
assert(!n.appearance, "appearance not in normalize output object keys wait");
assert(Object.keys(n).indexOf("appearance") < 0, "no appearance key");
assert(Object.keys(n).indexOf("sales_goals") < 0, "no sales_goals key");

var err = S.validateDraft({
  business: { name: "S&R" },
  contact: { email: "bad", email_enabled: true },
  social: {},
  announcement: { enabled: false, text: "" },
  fulfillment: {},
  storefront: {},
});
assert(err.length > 0, "invalid email caught");

var html = fs.readFileSync("admin/settings.html", "utf8");
assert(html.indexOf("Save Settings") >= 0, "save btn");
assert(html.indexOf("Business Information") >= 0, "biz section");
assert(html.indexOf("Store Announcement") >= 0, "announce");

var shell = fs.readFileSync("admin/admin-shell.js", "utf8");
assert(shell.indexOf("settings.html") >= 0, "nav settings");
assert(shell.indexOf("Coming soon") < 0 || shell.indexOf("Settings <em>Coming soon") < 0, "settings enabled");

var idx = fs.readFileSync("index.html", "utf8");
assert(idx.indexOf("store-settings.js") >= 0, "store settings script");
assert(idx.indexOf("storeAnnouncement") >= 0, "announce banner");
assert(idx.indexOf("footerSocial") >= 0, "footer social");

var api = fs.readFileSync("admin/catalog-api.js", "utf8");
assert(api.indexOf("saveStoreSettings") >= 0, "save api");
assert(api.indexOf("appearance: appearance") >= 0 || api.indexOf("appearance:appearance") >= 0 || api.indexOf("config.appearance") >= 0 || api.indexOf("appearance: appearance") >= 0, "appearance preserved path exists");
assert(api.indexOf("sales_goals") >= 0, "sales goals untouched elsewhere");

console.log("store settings OK");
