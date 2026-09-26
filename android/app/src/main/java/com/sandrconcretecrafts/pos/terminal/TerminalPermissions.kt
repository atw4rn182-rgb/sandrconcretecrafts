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
 * Single authoritative Location check for Stripe Terminal 5.8.1.
 * Stripe 5.8.0+ accepts ACCESS_COARSE_LOCATION; Fine is optional GPS.
 * Nearby Devices is diagnostic-only for Tap to Pay.
 */
object TerminalPermissions {
    const val STRIPE_SDK_VERSION = "5.8.1"

    val finePermission = Manifest.permission.ACCESS_FINE_LOCATION
    val coarsePermission = Manifest.permission.ACCESS_COARSE_LOCATION

    val locationRequestPermissions = arrayOf(coarsePermission)

    val nearbyPermissions = arrayOf(
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN
    )

    enum class Block {
        NONE,
        LOCATION_DENIED,
        LOCATION_SETTINGS_REQUIRED,
        LOCATION_SERVICES_DISABLED
    }

    enum class LocationLevel { NONE, APPROXIMATE, PRECISE }

    data class LocationState(
        val fineCompat: Int,
        val fineNative: Int,
        val coarseCompat: Int,
        val rationaleLocation: Boolean,
        val servicesOn: Boolean,
        val alreadyRequested: Boolean
    ) {
        val fineGranted: Boolean
            get() = fineCompat == PackageManager.PERMISSION_GRANTED &&
                fineNative == PackageManager.PERMISSION_GRANTED
        val coarseGranted: Boolean
            get() = coarseCompat == PackageManager.PERMISSION_GRANTED
        val locationGranted: Boolean
            get() = coarseGranted || fineGranted
        val locationLevel: LocationLevel
            get() = when {
                fineGranted -> LocationLevel.PRECISE
                coarseGranted -> LocationLevel.APPROXIMATE
                else -> LocationLevel.NONE
            }
        val requirementSatisfied: Boolean
            get() = locationGranted
        val readyForTerminal: Boolean
            get() = locationGranted && servicesOn
        val block: Block
            get() = when {
                locationGranted && !servicesOn -> Block.LOCATION_SERVICES_DISABLED
                locationGranted -> Block.NONE
                alreadyRequested && !rationaleLocation -> Block.LOCATION_SETTINGS_REQUIRED
                else -> Block.LOCATION_DENIED
            }
        val stage: String
            get() = when (block) {
                Block.NONE -> "LOCATION_OK"
                Block.LOCATION_SERVICES_DISABLED -> "LOCATION_SERVICES"
                else -> "PERMISSIONS"
            }
        val reason: String
            get() = when (block) {
                Block.NONE -> if (fineGranted) "LOCATION_PRECISE_GRANTED" else "LOCATION_APPROXIMATE_GRANTED"
                Block.LOCATION_DENIED -> "LOCATION_DENIED"
                Block.LOCATION_SETTINGS_REQUIRED -> "LOCATION_SETTINGS_REQUIRED"
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

    fun evaluate(
        context: Context,
        alreadyRequested: Boolean,
        rationaleLocation: Boolean
    ): LocationState {
        return LocationState(
            fineCompat = ContextCompat.checkSelfPermission(context, finePermission),
            fineNative = context.checkSelfPermission(finePermission),
            coarseCompat = ContextCompat.checkSelfPermission(context, coarsePermission),
            rationaleLocation = rationaleLocation,
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
            Block.LOCATION_DENIED ->
                "Tap to Pay needs Location permission. Approximate Location is enough."
            Block.LOCATION_SETTINGS_REQUIRED ->
                "Location needs to be enabled in Android Settings."
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
            state.locationGranted -> "GRANTED"
            state.block == Block.LOCATION_SETTINGS_REQUIRED -> "DENIED_DONT_ASK_AGAIN / settings-required"
            else -> "DENIED"
        }
        val source = if (state.block == Block.NONE) {
            "SOURCE: APP PERMISSION GATE — SATISFIED"
        } else {
            "SOURCE: APP PERMISSION GATE"
        }
        val lines = mutableListOf(
            buildBanner(),
            "Build type: ${if (BuildConfig.DEBUG) "debug" else "release"}",
            "SIMULATED_READER: ${BuildConfig.SIMULATED_READER}",
            "Stripe Terminal SDK version: $STRIPE_SDK_VERSION",
            "Package: ${context.packageName}",
            "SDK_INT: ${Build.VERSION.SDK_INT}",
            "Target SDK: ${context.applicationInfo.targetSdkVersion}",
            source,
            "BLOCKED STAGE: ${state.stage}",
            "REASON: ${state.reason}",
            "Location requirement result: ${if (state.requirementSatisfied) "SATISFIED" else "NOT SATISFIED"}",
            "Location permission: ${if (state.locationGranted) "GRANTED" else "DENIED"}",
            "Location permission level: ${state.locationLevel.name}",
            "Fine raw ContextCompat: ${rawResult(state.fineCompat)}",
            "Fine raw context.checkSelfPermission: ${rawResult(state.fineNative)}",
            "Coarse raw ContextCompat: ${rawResult(state.coarseCompat)}",
            "shouldShowRequestPermissionRationale(LOCATION): ${state.rationaleLocation}",
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
