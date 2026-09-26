#!/usr/bin/env node
/**
 * Inspect the packaged APK AndroidManifest, not only Gradle intermediates.
 */
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var { spawnSync } = require("child_process");

var root = path.join(__dirname, "..");
var apk = path.join(root, "android/app/build/outputs/apk/debug/app-debug.apk");
if (!fs.existsSync(apk)) {
  console.log("packaged APK not built yet; skip binary manifest inspect");
  process.exit(0);
}

function findAapt() {
  var sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(process.env.LOCALAPPDATA || "", "Android/Sdk");
  var buildTools = path.join(sdk, "build-tools");
  if (!fs.existsSync(buildTools)) return null;
  var versions = fs.readdirSync(buildTools).sort().reverse();
  for (var i = 0; i < versions.length; i++) {
    var exe = path.join(buildTools, versions[i], process.platform === "win32" ? "aapt.exe" : "aapt");
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

var aapt = findAapt();
assert.ok(aapt, "Android build-tools aapt is required to inspect the packaged APK");
var dumped = spawnSync(aapt, ["dump", "xmltree", apk, "AndroidManifest.xml"], {
  encoding: "utf8",
});
assert.strictEqual(dumped.status, 0, dumped.stderr || "aapt dump failed");
var text = String(dumped.stdout || "");
assert.match(text, /android.permission.ACCESS_FINE_LOCATION/);
assert.match(text, /android.permission.ACCESS_COARSE_LOCATION/);
assert.match(text, /android.permission.NFC/);
assert.match(text, /android.permission.INTERNET/);
assert.match(text, /android.permission.BLUETOOTH_SCAN/);
assert.match(text, /android.permission.BLUETOOTH_CONNECT/);
assert.doesNotMatch(
  text,
  /ACCESS_FINE_LOCATION[\s\S]{0,240}maxSdkVersion/
);
console.log("packaged APK Fine Location is uncapped");
console.log(text.split(/\r?\n/).filter(function (line) {
  return /permission|maxSdkVersion|versionCode|versionName/.test(line);
}).join("\n"));
