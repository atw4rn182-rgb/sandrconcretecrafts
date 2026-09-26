package com.sandrconcretecrafts.pos.data

import org.json.JSONObject

/**
 * Reads the authoritative Pay Center total from the secure handoff JSON.
 * Does not re-sum line items. Does not read secrets.
 */
object SalePayload {
    fun amountCents(sale: JSONObject?): Int? {
        if (sale == null || !sale.has("amount_total_cents") || sale.isNull("amount_total_cents")) {
            return null
        }
        val cents = sale.optInt("amount_total_cents", 0)
        return if (cents >= 1) cents else null
    }

    fun amountLabel(sale: JSONObject?): String {
        val cents = amountCents(sale) ?: return "$0.00"
        return money(cents)
    }

    fun takePaymentLabel(sale: JSONObject?): String {
        val cents = amountCents(sale) ?: return "Take Payment"
        return "Take Payment — " + money(cents)
    }

    fun money(cents: Int): String {
        val safe = if (cents < 0) 0 else cents
        return "$" + String.format("%.2f", safe / 100.0)
    }
}
