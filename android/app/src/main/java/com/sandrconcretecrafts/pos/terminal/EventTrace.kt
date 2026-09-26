package com.sandrconcretecrafts.pos.terminal

import com.sandrconcretecrafts.pos.BuildConfig
import java.util.ArrayList
import java.util.Collections

/**
 * TEST-only chronological trace. Never stores secrets.
 */
object EventTrace {
    private const val LIMIT = 40
    private val events = Collections.synchronizedList(ArrayList<String>())
    private var seq = 0

    fun add(event: String) {
        if (!BuildConfig.SIMULATED_READER) return
        val safe = sanitize(event)
        synchronized(events) {
            seq += 1
            events.add(String.format("%02d %s", seq, safe))
            while (events.size > LIMIT) events.removeAt(0)
        }
    }

    fun render(): String {
        if (!BuildConfig.SIMULATED_READER) return ""
        synchronized(events) {
            if (events.isEmpty()) return "EVENT TRACE\n(none yet)"
            return "EVENT TRACE\n" + events.joinToString("\n")
        }
    }

    fun resetForTests() {
        synchronized(events) {
            events.clear()
            seq = 0
        }
    }

    private fun sanitize(raw: String): String {
        return raw
            .replace(Regex("(?i)(sk|rk|whsec|pst|pi|tml|eyJ)[_A-Za-z0-9\\-]{8,}"), "[redacted]")
            .replace(Regex("(?i)(client_secret|Bearer)\\s+[A-Za-z0-9_\\-\\.]+"), "[redacted]")
    }
}

object ErrorSource {
    const val APP_SETUP_GATE = "APP_SETUP_GATE"
    const val ANDROID_PERMISSION_CHECK = "ANDROID_PERMISSION_CHECK"
    const val TERMINAL_INITIALIZATION = "TERMINAL_INITIALIZATION"
    const val STRIPE_SDK = "STRIPE_SDK"
    const val READER_DISCOVERY = "READER_DISCOVERY"
    const val READER_CONNECTION = "READER_CONNECTION"
    const val SERVER_CONNECTION_TOKEN = "SERVER_CONNECTION_TOKEN"
    const val SERVER_PAYMENT_INTENT = "SERVER_PAYMENT_INTENT"
    const val TERMINAL_MODE_GATE = "TERMINAL_MODE_GATE"
}
