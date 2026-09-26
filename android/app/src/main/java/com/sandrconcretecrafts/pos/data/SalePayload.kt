package com.sandrconcretecrafts.pos.data

import org.json.JSONObject

/**
 * Reads the authoritative Pay Center total from the secure handoff JSON.
 * Does not re-sum line items. Does not invent $0.00 for a missing total.
 */
object SalePayload {
    fun amountCents(sale: JSONObject?): Int? {
        if (sale == null || !sale.has("amount_total_cents") || sale.isNull("amount_total_cents")) {
            return null
        }
        val raw = sale.opt("amount_total_cents")
        val cents = when (raw) {
            is Int -> raw
            is Long -> raw.toInt()
            is Number -> raw.toInt()
            is String -> raw.toIntOrNull()
            else -> null
        }
        return if (cents != null && cents >= 1) cents else null
    }

    fun amountLabel(sale: JSONObject?): String {
        val cents = amountCents(sale) ?: return "—"
        return money(cents)
    }

    fun takePaymentLabel(sale: JSONObject?): String {
        val cents = amountCents(sale) ?: return "Take Payment"
        return "Take Payment — " + money(cents)
    }

    fun money(cents: Int): String {
        if (cents < 1) return "—"
        return "$" + String.format("%.2f", cents / 100.0)
    }
}
