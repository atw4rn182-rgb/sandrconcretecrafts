"use strict";

function invalid(message, code) {
  var err = new Error(message);
  err.code = code;
  err.status = 400;
  throw err;
}

function assertClientTotalMatchesOrder(sale, order) {
  if (!sale || sale.amount_total_cents == null) {
    invalid("amount_total_cents is required for Tap to Pay.", "TOTAL_REQUIRED");
  }
  if (!order || !Number.isSafeInteger(Number(order.amount_total))) {
    invalid("The server sale total is invalid.", "TOTAL_INVALID");
  }
  if (Number(sale.amount_total_cents) !== Number(order.amount_total)) {
    invalid("Displayed total does not match the server total.", "TOTAL_MISMATCH");
  }
  return Number(order.amount_total);
}

module.exports = {
  assertClientTotalMatchesOrder: assertClientTotalMatchesOrder,
};
