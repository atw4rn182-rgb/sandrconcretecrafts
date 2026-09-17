package com.sandrconcretecrafts.pos.terminal

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.nfc.NfcAdapter
import androidx.core.content.ContextCompat
import com.sandrconcretecrafts.pos.BuildConfig
import com.stripe.stripeterminal.Terminal

/**
 * Fresh Android permission/state checks for Stripe Terminal 5.8.1.
 * Never caches a previous denial. Nearby Devices is not treated as Location.
 */
object TerminalPermissions {
    val locationPermissions = arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION
    )

    val nearbyPermissions = arrayOf(
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN
    )

    fun granted(context: Context, permission: String): Boolean {
        return ContextCompat.checkSelfPermission(context, permission) ==
            PackageManager.PERMISSION_GRANTED
    }

    fun fineLocationGranted(context: Context): Boolean {
        return granted(context, Manifest.permission.ACCESS_FINE_LOCATION)
    }

    fun nearbyGranted(context: Context): Boolean {
        return nearbyPermissions.all { granted(context, it) }
    }

    fun locationServicesOn(context: Context): Boolean {
        val manager = context.getSystemService(LocationManager::class.java) ?: return false
        return manager.isLocationEnabled
    }

    fun nfcAvailable(context: Context): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_NFC)
    }

    fun nfcEnabled(context: Context): Boolean {
        return NfcAdapter.getDefaultAdapter(context)?.isEnabled == true
    }

    fun missingRuntimePermissions(context: Context): Array<String> {
        val needed = LinkedHashSet<String>()
        if (!fineLocationGranted(context)) {
            needed.addAll(locationPermissions)
        }
        nearbyPermissions.forEach { permission ->
            if (!granted(context, permission)) needed.add(permission)
        }
        return needed.toTypedArray()
    }

    fun readyForTerminal(context: Context): Boolean {
        return fineLocationGranted(context) && nearbyGranted(context)
    }

    fun safeDiagnostics(context: Context, extra: String = ""): String {
        if (!BuildConfig.SIMULATED_READER) return ""
        val lines = mutableListOf(
            "TEST diagnostics",
            "Location fine: ${label(fineLocationGranted(context))}",
            "Location coarse: ${label(granted(context, Manifest.permission.ACCESS_COARSE_LOCATION))}",
            "Location services: ${if (locationServicesOn(context)) "on" else "off"}",
            "Nearby connect: ${label(granted(context, Manifest.permission.BLUETOOTH_CONNECT))}",
            "Nearby scan: ${label(granted(context, Manifest.permission.BLUETOOTH_SCAN))}",
            "NFC available: ${if (nfcAvailable(context)) "yes" else "no"}",
            "NFC enabled: ${if (nfcEnabled(context)) "yes" else "no"}",
            "Terminal initialized: ${if (Terminal.isInitialized()) "yes" else "no"}",
            "Simulated reader: yes"
        )
        if (extra.isNotBlank()) lines.add(extra)
        return lines.joinToString("\n")
    }

    private fun label(ok: Boolean): String = if (ok) "granted" else "denied"
}
