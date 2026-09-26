package com.sandrconcretecrafts.pos.data

import android.content.Intent
import android.net.Uri
import android.util.Base64
import com.sandrconcretecrafts.pos.terminal.ErrorSource
import com.sandrconcretecrafts.pos.terminal.EventTrace
import org.json.JSONObject

/**
 * Single Admin → Android handoff parser. Version 2 is required.
 * Path, extras, and payload amounts must match. No silent $0.00.
 */
object CollectPayloadParser {
    const val VERSION = 2
    const val EXTRA_PAYLOAD = "p"
    const val EXTRA_VERSION = "handoff_version"
    const val EXTRA_AMOUNT = "amount_total_cents"
    private val pathPattern = Regex("^/v(\\d+)/(\\d+)$")

    data class Amounts(
        val pathVersion: Int?,
        val pathAmount: Int?,
        val extraVersion: Int?,
        val extraAmount: Int?,
        val payloadVersion: Int?,
        val payloadAmount: Int?
    ) {
        fun label(value: Int?): String = value?.toString() ?: "absent"
    }

    sealed class Result {
        data class Ok(
            val sale: JSONObject,
            val amountCents: Int,
            val version: Int,
            val amounts: Amounts
        ) : Result() {
            val payloadPresent: Boolean get() = true
            val amountFieldPresent: Boolean get() = true
        }

        data class Error(
            val reason: String,
            val payloadPresent: Boolean,
            val amountFieldPresent: Boolean,
            val amounts: Amounts
        ) : Result() {
            val userMessage: String
                get() = listOf(
                    "SOURCE: ${ErrorSource.HANDOFF_PAYLOAD}",
                    "BLOCKED STAGE: PAYLOAD_VALIDATION",
                    "REASON: $reason",
                    "Expected field: amount_total_cents",
                    "HANDOFF VERSION: ${amounts.label(amounts.payloadVersion ?: amounts.extraVersion ?: amounts.pathVersion)}",
                    "PATH AMOUNT: ${amounts.label(amounts.pathAmount)}",
                    "EXTRA AMOUNT: ${amounts.label(amounts.extraAmount)}",
                    "PAYLOAD AMOUNT: ${amounts.label(amounts.payloadAmount)}",
                    "expected version=$VERSION"
                ).joinToString("\n")
        }
    }

    fun parse(intent: Intent?, trace: Boolean = true): Result {
        val data = intent?.data
        if (trace) {
            EventTrace.add("COLLECT_ACTIVITY_CREATED")
            EventTrace.add("intent_action=${safe(intent?.action)}")
            EventTrace.add("intent_scheme=${safe(data?.scheme)}")
            EventTrace.add("intent_host=${safe(data?.host)}")
            EventTrace.add("intent_path=${safe(data?.path)}")
            EventTrace.add("intent_data_present=${data != null}")
        }

        val path = parsePath(data)
        val extraPayload = intent?.getStringExtra(EXTRA_PAYLOAD)
            ?: intent?.getStringExtra("payload")
        val queryPayload = runCatching {
            data?.getQueryParameter("p") ?: data?.getQueryParameter("payload")
        }.getOrNull()
        val extraVersion = if (intent?.hasExtra(EXTRA_VERSION) == true) {
            intent.getIntExtra(EXTRA_VERSION, -1)
        } else {
            null
        }
        val extraAmount = if (intent?.hasExtra(EXTRA_AMOUNT) == true) {
            intent.getIntExtra(EXTRA_AMOUNT, -1)
        } else {
            null
        }
        val raw = listOf(extraPayload, queryPayload).firstOrNull { !it.isNullOrBlank() }
        val sale = raw?.let { decodeToJson(it) }
        val payloadVersion = if (sale != null && sale.has("handoff_version") && !sale.isNull("handoff_version")) {
            sale.optInt("handoff_version", -1)
        } else {
            null
        }
        val payloadAmount = positiveCents(sale?.opt("amount_total_cents"))
        val amounts = Amounts(
            pathVersion = path.first,
            pathAmount = path.second,
            extraVersion = extraVersion,
            extraAmount = extraAmount,
            payloadVersion = payloadVersion,
            payloadAmount = payloadAmount
        )

        if (trace) {
            EventTrace.add("payload_parameter_present=${!raw.isNullOrBlank()}")
            EventTrace.add("handoff_version=${amounts.label(extraVersion ?: payloadVersion ?: path.first)}")
            EventTrace.add("path_amount=${amounts.label(path.second)}")
            EventTrace.add("extra_amount=${amounts.label(extraAmount)}")
            EventTrace.add("payload_amount=${amounts.label(payloadAmount)}")
        }

        val queryOnlyLegacy = !queryPayload.isNullOrBlank() &&
            extraPayload.isNullOrBlank() &&
            extraVersion == null &&
            path.first == null
        if (queryOnlyLegacy) {
            return fail("LEGACY_HANDOFF", !raw.isNullOrBlank(), payloadAmount != null, amounts)
        }

        val versions = listOfNotNull(path.first, extraVersion, payloadVersion)
        if (versions.isEmpty()) {
            return fail("HANDOFF_VERSION_MISSING", !raw.isNullOrBlank(), payloadAmount != null, amounts)
        }
        if (versions.any { it != versions[0] }) {
            return fail("HANDOFF_DATA_MISMATCH", !raw.isNullOrBlank(), payloadAmount != null, amounts)
        }
        if (versions[0] != VERSION) {
            return fail("HANDOFF_VERSION_MISMATCH", !raw.isNullOrBlank(), payloadAmount != null, amounts)
        }

        val centsList = listOfNotNull(path.second, extraAmount, payloadAmount)
        if (centsList.isEmpty()) {
            return fail("AMOUNT_TOTAL_MISSING", !raw.isNullOrBlank(), false, amounts)
        }
        if (centsList.any { it != centsList[0] }) {
            return fail("HANDOFF_DATA_MISMATCH", !raw.isNullOrBlank(), true, amounts)
        }
        if (sale == null || payloadAmount == null) {
            return fail("AMOUNT_TOTAL_MISSING", sale != null, payloadAmount != null, amounts)
        }

        EventTrace.add("HANDOFF_OK version=${versions[0]} amount_total_cents=${centsList[0]}")
        EventTrace.add("ANDROID_PARSED_TOTAL=${centsList[0]}")
        return Result.Ok(
            sale = sale,
            amountCents = centsList[0],
            version = versions[0],
            amounts = amounts
        )
    }

    private fun fail(
        reason: String,
        payloadPresent: Boolean,
        amountFieldPresent: Boolean,
        amounts: Amounts
    ): Result.Error {
        EventTrace.add("HANDOFF_ERROR reason=$reason")
        EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.HANDOFF_PAYLOAD}")
        return Result.Error(reason, payloadPresent, amountFieldPresent, amounts)
    }

    fun parsePath(data: Uri?): Pair<Int?, Int?> {
        val path = data?.path ?: return null to null
        val match = pathPattern.matchEntire(path) ?: return null to null
        return match.groupValues[1].toInt() to match.groupValues[2].toInt()
    }

    private fun decodeToJson(raw: String): JSONObject? {
        val trimmed = raw.trim()
        if (trimmed.startsWith("{")) {
            return runCatching { JSONObject(trimmed) }.getOrNull()
        }
        return runCatching {
            val padded = trimmed.replace('-', '+').replace('_', '/')
            val pad = (4 - padded.length % 4) % 4
            val bytes = Base64.decode(padded + "=".repeat(pad), Base64.DEFAULT)
            JSONObject(String(bytes, Charsets.UTF_8))
        }.getOrNull()
    }

    private fun positiveCents(raw: Any?): Int? {
        val cents = when (raw) {
            is Int -> raw
            is Long -> raw.toInt()
            is Number -> raw.toInt()
            is String -> raw.toIntOrNull()
            else -> null
        }
        return if (cents != null && cents >= 1) cents else null
    }

    private fun safe(value: String?): String {
        return value?.take(40)?.replace(Regex("[^A-Za-z0-9:/.\\-_]"), "_") ?: "none"
    }
}
