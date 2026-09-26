package com.sandrconcretecrafts.pos.data

import android.content.Intent
import android.util.Base64
import com.sandrconcretecrafts.pos.terminal.ErrorSource
import com.sandrconcretecrafts.pos.terminal.EventTrace
import org.json.JSONObject

/**
 * Single Admin → Android handoff parser. Version 2 is required.
 * Do not silently treat a missing amount as $0.00.
 */
object CollectPayloadParser {
    const val VERSION = 2
    const val EXTRA_PAYLOAD = "p"
    const val EXTRA_VERSION = "handoff_version"
    const val EXTRA_AMOUNT = "amount_total_cents"

    sealed class Result {
        data class Ok(
            val sale: JSONObject,
            val amountCents: Int,
            val version: Int,
            val payloadPresent: Boolean,
            val amountFieldPresent: Boolean
        ) : Result()

        data class Error(
            val reason: String,
            val payloadPresent: Boolean,
            val amountFieldPresent: Boolean,
            val amountValue: String,
            val versionReceived: String
        ) : Result() {
            val userMessage: String
                get() = listOf(
                    "SOURCE: ${ErrorSource.HANDOFF_PAYLOAD}",
                    "BLOCKED STAGE: PAYLOAD_VALIDATION",
                    "REASON: $reason",
                    "Expected field: amount_total_cents",
                    "Raw field present: ${if (amountFieldPresent) "YES" else "NO"}",
                    "HANDOFF VERSION: $versionReceived",
                    "expected=$VERSION"
                ).joinToString("\n")
        }
    }

    fun parse(intent: Intent?, trace: Boolean = true): Result {
        if (trace) {
            EventTrace.add("COLLECT_ACTIVITY_CREATED")
            EventTrace.add("intent_action=${safe(intent?.action)}")
            EventTrace.add("intent_scheme=${safe(intent?.data?.scheme)}")
            EventTrace.add("intent_host=${safe(intent?.data?.host)}")
            EventTrace.add("intent_path=${safe(intent?.data?.path)}")
            EventTrace.add("intent_data_present=${intent?.data != null}")
        }

        val extraPayload = intent?.getStringExtra(EXTRA_PAYLOAD)
            ?: intent?.getStringExtra("payload")
        val queryPayload = runCatching {
            intent?.data?.getQueryParameter("p") ?: intent?.data?.getQueryParameter("payload")
        }.getOrNull()
        val raw = listOf(extraPayload, queryPayload).firstOrNull { !it.isNullOrBlank() }
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

        if (trace) {
            EventTrace.add("payload_parameter_present=${!raw.isNullOrBlank()}")
            EventTrace.add("handoff_version=${extraVersion ?: "absent"}")
            EventTrace.add("amount_total_cents_present=${extraAmount != null}")
            if (extraAmount != null) {
                EventTrace.add("amount_total_cents=$extraAmount")
            }
        }

        if (raw.isNullOrBlank()) {
            val reason = if (extraAmount != null && extraAmount >= 1) {
                "AMOUNT_TOTAL_MISSING"
            } else {
                "AMOUNT_TOTAL_MISSING"
            }
            EventTrace.add("HANDOFF_ERROR reason=$reason")
            EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.HANDOFF_PAYLOAD}")
            return Result.Error(
                reason = reason,
                payloadPresent = false,
                amountFieldPresent = extraAmount != null,
                amountValue = extraAmount?.toString() ?: "INVALID",
                versionReceived = extraVersion?.toString() ?: "absent"
            )
        }

        return parseRaw(raw, extraVersion, extraAmount)
    }

    fun parseRaw(
        raw: String,
        extraVersion: Int? = null,
        extraAmount: Int? = null
    ): Result {
        val sale = decodeToJson(raw) ?: return Result.Error(
            reason = "AMOUNT_TOTAL_INVALID",
            payloadPresent = true,
            amountFieldPresent = extraAmount != null,
            amountValue = extraAmount?.toString() ?: "INVALID",
            versionReceived = extraVersion?.toString() ?: "absent"
        )

        val receivedVersion = when {
            sale.has("handoff_version") && !sale.isNull("handoff_version") ->
                sale.optInt("handoff_version", -1)
            extraVersion != null -> extraVersion
            else -> -1
        }
        if (receivedVersion != VERSION) {
            EventTrace.add("HANDOFF_ERROR reason=HANDOFF_VERSION_MISMATCH received=$receivedVersion")
            EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.HANDOFF_PAYLOAD}")
            return Result.Error(
                reason = "HANDOFF_VERSION_MISMATCH",
                payloadPresent = true,
                amountFieldPresent = sale.has("amount_total_cents") || extraAmount != null,
                amountValue = readableAmount(sale, extraAmount),
                versionReceived = if (receivedVersion < 0) "absent" else receivedVersion.toString()
            )
        }

        if (!sale.has("amount_total_cents") || sale.isNull("amount_total_cents")) {
            EventTrace.add("HANDOFF_ERROR reason=AMOUNT_TOTAL_MISSING")
            EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.HANDOFF_PAYLOAD}")
            return Result.Error(
                reason = "AMOUNT_TOTAL_MISSING",
                payloadPresent = true,
                amountFieldPresent = false,
                amountValue = extraAmount?.toString() ?: "INVALID",
                versionReceived = receivedVersion.toString()
            )
        }

        val cents = positiveCents(sale.opt("amount_total_cents"))
        if (cents == null) {
            EventTrace.add("HANDOFF_ERROR reason=AMOUNT_TOTAL_INVALID")
            EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.HANDOFF_PAYLOAD}")
            return Result.Error(
                reason = "AMOUNT_TOTAL_INVALID",
                payloadPresent = true,
                amountFieldPresent = true,
                amountValue = sale.opt("amount_total_cents")?.toString() ?: "INVALID",
                versionReceived = receivedVersion.toString()
            )
        }
        if (extraAmount != null && extraAmount != cents) {
            EventTrace.add("HANDOFF_ERROR reason=AMOUNT_TOTAL_INVALID extra=$extraAmount json=$cents")
            EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.HANDOFF_PAYLOAD}")
            return Result.Error(
                reason = "AMOUNT_TOTAL_INVALID",
                payloadPresent = true,
                amountFieldPresent = true,
                amountValue = cents.toString(),
                versionReceived = receivedVersion.toString()
            )
        }

        EventTrace.add("HANDOFF_OK version=$receivedVersion amount_total_cents=$cents")
        EventTrace.add("ANDROID_PARSED_TOTAL=$cents")
        return Result.Ok(
            sale = sale,
            amountCents = cents,
            version = receivedVersion,
            payloadPresent = true,
            amountFieldPresent = true
        )
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

    private fun readableAmount(sale: JSONObject, extraAmount: Int?): String {
        return when {
            extraAmount != null -> extraAmount.toString()
            sale.has("amount_total_cents") -> sale.opt("amount_total_cents")?.toString() ?: "INVALID"
            else -> "INVALID"
        }
    }

    private fun safe(value: String?): String {
        return value?.take(40)?.replace(Regex("[^A-Za-z0-9:/.\\-_]"), "_") ?: "none"
    }
}
