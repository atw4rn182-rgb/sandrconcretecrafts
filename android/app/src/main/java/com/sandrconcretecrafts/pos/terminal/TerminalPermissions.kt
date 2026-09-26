package com.sandrconcretecrafts.pos.terminal

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.nfc.NfcAdapter
import android.os.Build
import androidx.core.content.ContextCompat
import com.sandrconcretecrafts.pos.BuildConfig

/**
 * Single authoritative Location / readiness check for Stripe Terminal 5.8.1.
 * Nearby Devices is diagnostic-only for Tap to Pay.
 */
object TerminalPermissions {
    val finePermission = Manifest.permission.ACCESS_FINE_LOCATION
    val coarsePermission = Manifest.permission.ACCESS_COARSE_LOCATION

    val locationRequestPermissions = arrayOf(finePermission, coarsePermission)

    val nearbyPermissions = arrayOf(
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN
    )

    enum class Block {
        NONE,
        FINE_DENIED,
        FINE_DENIED_COARSE_GRANTED,
        FINE_DENIED_SETTINGS_REQUIRED,
        LOCATION_SERVICES_DISABLED
    }

    data class LocationState(
        val fineCompat: Int,
        val fineNative: Int,
        val coarseCompat: Int,
        val rationaleFine: Boolean,
        val servicesOn: Boolean,
        val alreadyRequested: Boolean
    ) {
        val fineGranted: Boolean
            get() = fineCompat == PackageManager.PERMISSION_GRANTED &&
                fineNative == PackageManager.PERMISSION_GRANTED
        val coarseGranted: Boolean
            get() = coarseCompat == PackageManager.PERMISSION_GRANTED
        val readyForTerminal: Boolean
            get() = fineGranted && servicesOn
        val block: Block
            get() = when {
                fineGranted && !servicesOn -> Block.LOCATION_SERVICES_DISABLED
                fineGranted -> Block.NONE
                coarseGranted -> Block.FINE_DENIED_COARSE_GRANTED
                alreadyRequested && !rationaleFine -> Block.FINE_DENIED_SETTINGS_REQUIRED
                else -> Block.FINE_DENIED
            }
        val stage: String
            get() = when (block) {
                Block.NONE -> "LOCATION_OK"
                Block.LOCATION_SERVICES_DISABLED -> "LOCATION_SERVICES"
                else -> "PERMISSIONS"
            }
        val reason: String
            get() = when (block) {
                Block.NONE -> "FINE_GRANTED_SERVICES_ON"
                Block.FINE_DENIED -> "FINE_LOCATION_DENIED"
                Block.FINE_DENIED_COARSE_GRANTED -> "FINE_LOCATION_DENIED_COARSE_GRANTED"
                Block.FINE_DENIED_SETTINGS_REQUIRED -> "FINE_LOCATION_SETTINGS_REQUIRED"
                Block.LOCATION_SERVICES_DISABLED -> "LOCATION_SERVICES_DISABLED"
            }
    }

    fun rawResult(value: Int): String {
        return if (value == PackageManager.PERMISSION_GRANTED) {
            "PERMISSION_GRANTED"
        } else {
            "PERMISSION_DENIED"
        }
    }

    fun evaluate(context: Context, alreadyRequested: Boolean, rationaleFine: Boolean): LocationState {
        return LocationState(
            fineCompat = ContextCompat.checkSelfPermission(context, finePermission),
            fineNative = context.checkSelfPermission(finePermission),
            coarseCompat = ContextCompat.checkSelfPermission(context, coarsePermission),
            rationaleFine = rationaleFine,
            servicesOn = locationServicesOn(context),
            alreadyRequested = alreadyRequested
        )
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

    fun userMessage(state: LocationState): String {
        return when (state.block) {
            Block.NONE -> ""
            Block.FINE_DENIED ->
                "Precise Location has not been granted. Tap Allow and choose Precise, not Approximate."
            Block.FINE_DENIED_COARSE_GRANTED ->
                "Precise Location is required for Tap to Pay. Location is currently set to Approximate."
            Block.FINE_DENIED_SETTINGS_REQUIRED ->
                "Android will not show the Location dialog again. Open Settings, set Location to Precise, then return here."
            Block.LOCATION_SERVICES_DISABLED ->
                "Turn on Location services to use Tap to Pay. The app permission is already granted."
        }
    }

    fun settingsAction(state: LocationState): String {
        return if (state.block == Block.LOCATION_SERVICES_DISABLED) {
            android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS
        } else {
            android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS
        }
    }

    fun buildBanner(): String {
        return "TEST BUILD ${BuildConfig.VERSION_NAME}  code ${BuildConfig.VERSION_CODE}  ${BuildConfig.BUILD_ID}"
    }

    fun safeDiagnostics(context: Context, state: LocationState, extra: String = ""): String {
        if (!BuildConfig.SIMULATED_READER) return ""
        val nfc = nfcAvailable(context)
        val androidState = when {
            state.fineGranted -> "GRANTED"
            state.block == Block.FINE_DENIED_SETTINGS_REQUIRED -> "DENIED_DONT_ASK_AGAIN / settings-required"
            state.coarseGranted -> "DENIED (Approximate only)"
            else -> "DENIED"
        }
        val lines = mutableListOf(
            buildBanner(),
            "Build type: ${if (BuildConfig.DEBUG) "debug" else "release"}",
            "SIMULATED_READER: ${BuildConfig.SIMULATED_READER}",
            "Package: ${context.packageName}",
            "SDK_INT: ${Build.VERSION.SDK_INT}",
            "Target SDK: ${context.applicationInfo.targetSdkVersion}",
            "BLOCKED STAGE: ${state.stage}",
            "REASON: ${state.reason}",
            "Fine raw ContextCompat: ${rawResult(state.fineCompat)}",
            "Fine raw context.checkSelfPermission: ${rawResult(state.fineNative)}",
            "Coarse raw ContextCompat: ${rawResult(state.coarseCompat)}",
            "shouldShowRequestPermissionRationale(FINE): ${state.rationaleFine}",
            "Location services enabled: ${state.servicesOn}",
            "Android permission state: $androidState",
            "Nearby / Bluetooth Scan: ${rawResult(ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN))} / not required",
            "Bluetooth Connect: ${rawResult(ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT))} / not required",
            "NFC: ${if (nfc) "available" else "unavailable"}",
            "NFC enabled: ${if (!nfc) "n/a" else if (nfcEnabled(context)) "yes" else "no"}"
        )
        if (extra.isNotBlank()) lines.add(extra)
        return lines.joinToString("\n")
    }
}
