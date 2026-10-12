"use strict";

var assert = require("assert");
var opt = require("./image-optimize.js");

assert.strictEqual(opt.MAX_EDGE, 1600);
assert.strictEqual(opt.QUALITY, 0.82);

var phone = opt.targetDimensions(3000, 4000);
assert.strictEqual(phone.width, 1200);
assert.strictEqual(phone.height, 1600);
assert.strictEqual(phone.resized, true);

var wide = opt.targetDimensions(4000, 3000);
assert.strictEqual(wide.width, 1600);
assert.strictEqual(wide.height, 1200);

var small = opt.targetDimensions(800, 600);
assert.deepStrictEqual(small, { width: 800, height: 600, resized: false });

var square = opt.targetDimensions(1600, 1600);
assert.strictEqual(square.resized, false);

assert.strictEqual(opt.classify({ type: "image/jpeg", bytes: 2.8e6, width: 3000, height: 4000 }).action, "optimize");
assert.strictEqual(opt.classify({ type: "image/jpeg", bytes: 100 * 1024, width: 1200, height: 900 }).action, "passthrough");
assert.strictEqual(opt.classify({ type: "image/jpeg", bytes: 100 * 1024, width: 3000, height: 4000 }).action, "optimize");
assert.strictEqual(opt.classify({ type: "image/gif", bytes: 80 * 1024, width: 400, height: 400 }).action, "passthrough");
assert.strictEqual(opt.classify({ type: "image/tiff", bytes: 1000, width: 100, height: 100 }).action, "reject");
assert.strictEqual(opt.classify({ type: "image/jpeg", bytes: 26 * 1024 * 1024, width: 100, height: 100 }).action, "reject");
assert.strictEqual(opt.classify({ type: "image/jpeg", bytes: 0 }).action, "reject");

assert.strictEqual(
  opt.preferOptimized({ originalBytes: 2800000, optimizedBytes: 280000, resized: true }),
  true
);
assert.strictEqual(
  opt.preferOptimized({ originalBytes: 120000, optimizedBytes: 115000, resized: false }),
  false
);
assert.strictEqual(
  opt.preferOptimized({ originalBytes: 800000, optimizedBytes: 500000, resized: false }),
  true
);

console.log("image optimize checks passed");
