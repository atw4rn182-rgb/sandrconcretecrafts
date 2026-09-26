package com.sandrconcretecrafts.pos.terminal

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.nfc.NfcAdapter
import androidx.core.content.ContextCompat
import com.sandrconcretecrafts.pos.BuildConfig

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
        return needed.toTypedArray()
    }

    fun readyForTerminal(context: Context): Boolean {
        return fineLocationGranted(context) && locationServicesOn(context)
    }

    fun grantedLabel(granted: Boolean): String {
        return if (granted) "granted" else "denied"
    }

    fun safeDiagnostics(context: Context, extra: String = ""): String {
        if (!BuildConfig.SIMULATED_READER) return ""
        val nfc = nfcAvailable(context)
        val lines = mutableListOf(
            "App version: ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
            "Location fine: ${grantedLabel(fineLocationGranted(context))}",
            "Location coarse: ${grantedLabel(granted(context, Manifest.permission.ACCESS_COARSE_LOCATION))}",
            "Location services: ${if (locationServicesOn(context)) "on" else "off"}",
            "Nearby / Bluetooth Scan: ${grantedLabel(granted(context, Manifest.permission.BLUETOOTH_SCAN))} / not required for Tap to Pay",
            "Bluetooth Connect: ${grantedLabel(granted(context, Manifest.permission.BLUETOOTH_CONNECT))} / not required for Tap to Pay",
            "NFC: ${if (nfc) "available" else "unavailable"}",
            "NFC enabled: ${if (!nfc) "n/a" else if (nfcEnabled(context)) "yes" else "no"}",
            "Simulation mode: ON"
        )
        if (extra.isNotBlank()) lines.add(extra)
        return lines.joinToString("\n")
    }
}
