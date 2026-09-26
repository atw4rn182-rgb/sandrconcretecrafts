"use strict";

var assert = require("assert");
var pos = require("./pos-totals");

var base = pos.quote({
  lines: [800, 500, 400, 600],
  discountMilli: 0,
  taxMilli: 0,
});
assert.strictEqual(base.subtotal, 2300);
assert.strictEqual(base.discount, 0);
assert.strictEqual(base.tax, 0);
assert.strictEqual(base.total, 2300);

var off5 = pos.quote({ lines: [800, 500, 400, 600], discountMilli: 5000, taxMilli: 0 });
assert.strictEqual(off5.discount, 115);
assert.strictEqual(off5.total, 2185);

var off10 = pos.quote({ lines: [800, 500, 400, 600], discountMilli: 10000, taxMilli: 0 });
assert.strictEqual(off10.discount, 230);
assert.strictEqual(off10.total, 2070);

var custom = pos.quote({ lines: [800, 500, 400, 600], discountMilli: 12500, taxMilli: 0 });
assert.strictEqual(custom.discount, 288);
assert.strictEqual(custom.total, 2012);

var cents = pos.quote({ lines: [899, 550], discountMilli: 0, taxMilli: 0 });
assert.strictEqual(cents.subtotal, 1449);
assert.strictEqual(cents.total, 1449);

var taxed = pos.quote({
  lines: [800, 500, 400, 600],
  discountMilli: 10000,
  taxMilli: 7875,
});
assert.strictEqual(taxed.discount, 230);
assert.strictEqual(taxed.tax, 163);
assert.strictEqual(taxed.total, 2233);

var none = pos.quote({ lines: [], discountMilli: 10000, taxMilli: 5000 });
assert.strictEqual(none.total, 0);

assert.strictEqual(pos.parsePercentToMilli("10").value, 10000);
assert.strictEqual(pos.parsePercentToMilli("7.875").value, 7875);
assert.strictEqual(pos.parsePercentToMilli("101").ok, false);
assert.strictEqual(pos.parsePercentToMilli("-5").ok, false);
assert.strictEqual(pos.percentLabel(10000), "10");
assert.strictEqual(pos.percentLabel(7875), "7.875");

console.log("pos totals integer-cent math: ok");
