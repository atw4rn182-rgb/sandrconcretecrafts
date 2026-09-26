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
 * SATISFIED when Coarse OR Fine is granted. Fine is not required.
 */
object TerminalPermissions {
    const val STRIPE_SDK_VERSION = "5.8.1"

    val finePermission = Manifest.permission.ACCESS_FINE_LOCATION
    val coarsePermission = Manifest.permission.ACCESS_COARSE_LOCATION
    val phonePermission = Manifest.permission.READ_PHONE_STATE

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
        val coarseNative: Int,
        val phoneCompat: Int,
        val rationaleLocation: Boolean,
        val servicesOn: Boolean,
        val alreadyRequested: Boolean
    ) {
        val fineGranted: Boolean
            get() = fineCompat == PackageManager.PERMISSION_GRANTED ||
                fineNative == PackageManager.PERMISSION_GRANTED
        val coarseGranted: Boolean
            get() = coarseCompat == PackageManager.PERMISSION_GRANTED ||
                coarseNative == PackageManager.PERMISSION_GRANTED
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
        val gateResult: String
            get() = if (requirementSatisfied) "SATISFIED" else "DENIED"
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
        val source: String
            get() = when (block) {
                Block.NONE -> ErrorSource.ANDROID_PERMISSION_CHECK
                Block.LOCATION_SERVICES_DISABLED -> ErrorSource.ANDROID_PERMISSION_CHECK
                else -> ErrorSource.APP_SETUP_GATE
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
            coarseNative = context.checkSelfPermission(coarsePermission),
            phoneCompat = ContextCompat.checkSelfPermission(context, phonePermission),
            rationaleLocation = rationaleLocation,
            servicesOn = locationServicesOn(context),
            alreadyRequested = alreadyRequested
        )
    }

    fun evaluateAndTrace(
        context: Context,
        alreadyRequested: Boolean,
        rationaleLocation: Boolean,
        caller: String
    ): LocationState {
        EventTrace.add("APP_LOCATION_GATE_ENTERED caller=$caller")
        val state = evaluate(context, alreadyRequested, rationaleLocation)
        EventTrace.add("COARSE_PERMISSION=${if (state.coarseGranted) "GRANTED" else "DENIED"}")
        EventTrace.add("FINE_PERMISSION=${if (state.fineGranted) "GRANTED" else "DENIED"}")
        EventTrace.add("LOCATION_REQUIREMENT=${if (state.requirementSatisfied) "SATISFIED" else "NOT SATISFIED"}")
        EventTrace.add("LOCATION_LEVEL=${state.locationLevel.name}")
        EventTrace.add("LOCATION_SERVICES=${if (state.servicesOn) "ON" else "OFF"}")
        EventTrace.add("APP_LOCATION_GATE_RESULT=${state.gateResult}")
        if (state.block != Block.NONE) {
            EventTrace.add("UI_ERROR_SOURCE=${state.source}")
        }
        return state
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
                "SOURCE: ${ErrorSource.APP_SETUP_GATE}\nTap to Pay needs Location permission. Approximate Location is enough."
            Block.LOCATION_SETTINGS_REQUIRED ->
                "SOURCE: ${ErrorSource.APP_SETUP_GATE}\nLocation needs to be enabled in Android Settings."
            Block.LOCATION_SERVICES_DISABLED ->
                "SOURCE: ${ErrorSource.ANDROID_PERMISSION_CHECK}\nTurn on Location services to use Tap to Pay. The app permission is already granted."
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
        return "TEST BUILD ${BuildConfig.VERSION_NAME}\nCODE ${BuildConfig.VERSION_CODE}\n${BuildConfig.BUILD_ID}"
    }

    fun safeDiagnostics(context: Context, state: LocationState, extra: String = ""): String {
        val nfc = nfcAvailable(context)
        val lines = mutableListOf(
            buildBanner(),
            "Build type: ${if (BuildConfig.DEBUG) "debug" else "release"}",
            "SIMULATED_READER: ${BuildConfig.SIMULATED_READER}",
            "Stripe Terminal SDK version: $STRIPE_SDK_VERSION",
            "Package: ${context.packageName}",
            "SDK_INT: ${Build.VERSION.SDK_INT}",
            "Target SDK: ${context.applicationInfo.targetSdkVersion}",
            "SOURCE: ${state.source}",
            "BLOCKED STAGE: ${state.stage}",
            "REASON: ${state.reason}",
            "APP_LOCATION_GATE_RESULT: ${state.gateResult}",
            "Location requirement: ${if (state.requirementSatisfied) "SATISFIED" else "NOT SATISFIED"}",
            "Location permission: ${if (state.locationGranted) "GRANTED" else "DENIED"}",
            "Location level: ${state.locationLevel.name}",
            "ACCESS_COARSE_LOCATION ContextCompat: ${rawResult(state.coarseCompat)}",
            "ACCESS_COARSE_LOCATION native: ${rawResult(state.coarseNative)}",
            "ACCESS_FINE_LOCATION ContextCompat: ${rawResult(state.fineCompat)}",
            "ACCESS_FINE_LOCATION native: ${rawResult(state.fineNative)}",
            "Location services: ${if (state.servicesOn) "ON" else "OFF"}",
            "NFC: ${if (nfc) "AVAILABLE" else "UNAVAILABLE"}",
            "NFC enabled: ${if (!nfc) "n/a" else if (nfcEnabled(context)) "ENABLED" else "DISABLED"}",
            "Nearby / Bluetooth Scan: ${rawResult(ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN))} / diagnostic only",
            "Bluetooth Connect: ${rawResult(ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT))} / diagnostic only",
            "Phone / READ_PHONE_STATE: ${rawResult(state.phoneCompat)} / not requested; diagnostic only",
            EventTrace.render()
        )
        if (extra.isNotBlank()) lines.add(extra)
        return lines.joinToString("\n")
    }
}
