package com.sandrconcretecrafts.pos.setup

import com.sandrconcretecrafts.pos.terminal.TerminalPermissions

/**
 * Pure Tap-to-Pay first-launch / repair state machine.
 * Location uses Stripe Terminal 5.8.1 rules: Coarse OR Fine is enough.
 */
object SetupGate {
    const val MIN_SDK = 33

    enum class Screen {
        WELCOME,
        ANDROID_UNSUPPORTED,
        NFC_UNAVAILABLE,
        NFC_OFF,
        LOCATION_PERMISSION,
        LOCATION_SETTINGS,
        LOCATION_SERVICES,
        SIGN_IN,
        TERMINAL_CONNECT,
        TERMINAL_MODE_MISMATCH,
        TERMINAL_FAILED,
        READY,
        SKIP
    }

    enum class Action {
        NONE,
        MARK_WELCOME,
        REQUEST_LOCATION,
        OPEN_APP_SETTINGS,
        OPEN_LOCATION_SERVICES,
        OPEN_NFC_SETTINGS,
        CONTINUE_TO_LOGIN,
        INIT_TERMINAL,
        CONTINUE
    }

    enum class TerminalPhase {
        IDLE,
        CONNECTING,
        READY,
        MODE_MISMATCH,
        FAILED
    }

    data class CheckItem(val label: String, val done: Boolean)

    data class View(
        val screen: Screen,
        val title: String,
        val body: String,
        val button: String,
        val action: Action,
        val checklist: List<CheckItem>,
        val skipWizard: Boolean
    ) {
        val stage: String
            get() = when (screen) {
                Screen.WELCOME -> "WELCOME"
                Screen.ANDROID_UNSUPPORTED -> "ANDROID_VERSION"
                Screen.NFC_UNAVAILABLE, Screen.NFC_OFF -> "NFC"
                Screen.LOCATION_PERMISSION, Screen.LOCATION_SETTINGS -> "PERMISSIONS"
                Screen.LOCATION_SERVICES -> "LOCATION_SERVICES"
                Screen.SIGN_IN -> "SIGN_IN"
                Screen.TERMINAL_CONNECT, Screen.TERMINAL_FAILED -> "TERMINAL_INIT"
                Screen.TERMINAL_MODE_MISMATCH -> "TERMINAL_MODE_MISMATCH"
                Screen.READY, Screen.SKIP -> "READY"
            }
        val reason: String
            get() = screen.name
    }

    data class Input(
        val welcomeSeen: Boolean,
        val completedOnce: Boolean,
        val sdkInt: Int,
        val minSdk: Int = MIN_SDK,
        val nfcAvailable: Boolean,
        val nfcEnabled: Boolean,
        val fineGranted: Boolean,
        val coarseGranted: Boolean,
        val servicesOn: Boolean,
        val alreadyRequestedLocation: Boolean,
        val rationaleLocation: Boolean,
        val signedIn: Boolean,
        val terminal: TerminalPhase,
        val terminalError: String = ""
    )

    fun locationGranted(fineGranted: Boolean, coarseGranted: Boolean): Boolean {
        return coarseGranted || fineGranted
    }

    fun locationBlock(
        fineGranted: Boolean,
        coarseGranted: Boolean,
        servicesOn: Boolean,
        alreadyRequested: Boolean,
        rationaleLocation: Boolean
    ): TerminalPermissions.Block {
        val granted = locationGranted(fineGranted, coarseGranted)
        return when {
            granted && !servicesOn -> TerminalPermissions.Block.LOCATION_SERVICES_DISABLED
            granted -> TerminalPermissions.Block.NONE
            alreadyRequested && !rationaleLocation -> TerminalPermissions.Block.LOCATION_SETTINGS_REQUIRED
            else -> TerminalPermissions.Block.LOCATION_DENIED
        }
    }

    fun deviceReady(
        sdkInt: Int,
        nfcAvailable: Boolean,
        nfcEnabled: Boolean,
        fineGranted: Boolean,
        coarseGranted: Boolean,
        servicesOn: Boolean,
        minSdk: Int = MIN_SDK
    ): Boolean {
        return sdkInt >= minSdk &&
            nfcAvailable &&
            nfcEnabled &&
            locationGranted(fineGranted, coarseGranted) &&
            servicesOn
    }

    fun evaluate(input: Input): View {
        val androidOk = input.sdkInt >= input.minSdk
        val granted = locationGranted(input.fineGranted, input.coarseGranted)
        val nfcOn = input.nfcAvailable && input.nfcEnabled
        val checks = checklist(androidOk, input.nfcAvailable, nfcOn, granted, input.servicesOn, input.terminal)
        if (!input.welcomeSeen) {
            return View(
                Screen.WELCOME,
                "S&R TAP TO PAY",
                "Let's get Tap to Pay ready.\n\nWe'll check the few settings needed to accept contactless payments on this phone.",
                "GET STARTED",
                Action.MARK_WELCOME,
                checks,
                false
            )
        }
        if (!androidOk) {
            return View(
                Screen.ANDROID_UNSUPPORTED,
                "This phone is not supported",
                "Tap to Pay needs Android 13 or newer.",
                "",
                Action.NONE,
                checks,
                false
            )
        }
        if (!input.nfcAvailable) {
            return View(
                Screen.NFC_UNAVAILABLE,
                "This phone cannot take tap payments",
                "This phone does not support NFC Tap to Pay.",
                "",
                Action.NONE,
                checks,
                false
            )
        }
        if (!input.nfcEnabled) {
            return View(
                Screen.NFC_OFF,
                "Turn on NFC",
                "NFC needs to be turned on to accept contactless payments.",
                "TURN ON NFC",
                Action.OPEN_NFC_SETTINGS,
                checks,
                false
            )
        }
        when (
            locationBlock(
                input.fineGranted,
                input.coarseGranted,
                input.servicesOn,
                input.alreadyRequestedLocation,
                input.rationaleLocation
            )
        ) {
            TerminalPermissions.Block.LOCATION_DENIED -> return View(
                Screen.LOCATION_PERMISSION,
                "Allow Location",
                "Tap to Pay needs Location permission to securely initialize contactless payments. Approximate Location is enough.",
                "ALLOW LOCATION",
                Action.REQUEST_LOCATION,
                checks,
                false
            )
            TerminalPermissions.Block.LOCATION_SETTINGS_REQUIRED -> return View(
                Screen.LOCATION_SETTINGS,
                "Open Android Settings",
                "Location needs to be enabled in Android Settings.",
                "OPEN SETTINGS",
                Action.OPEN_APP_SETTINGS,
                checks,
                false
            )
            TerminalPermissions.Block.LOCATION_SERVICES_DISABLED -> return View(
                Screen.LOCATION_SERVICES,
                "Turn on Location Services",
                "Turn on Location Services to continue.",
                "TURN ON LOCATION",
                Action.OPEN_LOCATION_SERVICES,
                checks,
                false
            )
            TerminalPermissions.Block.NONE -> Unit
        }
        if (input.terminal == TerminalPhase.MODE_MISMATCH) {
            return View(
                Screen.TERMINAL_MODE_MISMATCH,
                "TEST setup stopped",
                "TERMINAL_MODE_MISMATCH\nThis TEST app is simulated only. The Terminal backend is LIVE. Online Checkout was not changed.",
                "",
                Action.NONE,
                checks,
                false
            )
        }
        if (input.terminal == TerminalPhase.FAILED) {
            val detail = input.terminalError.ifBlank { "Tap to Pay could not finish connecting." }
            return View(
                Screen.TERMINAL_FAILED,
                "Couldn't finish setup",
                detail,
                "TRY AGAIN",
                Action.INIT_TERMINAL,
                checks,
                false
            )
        }
        if (input.terminal == TerminalPhase.READY) {
            return View(
                Screen.READY,
                "✓ TAP TO PAY READY",
                "This phone is ready to accept contactless payments.",
                "CONTINUE",
                Action.CONTINUE,
                checks,
                false
            )
        }
        if (input.terminal == TerminalPhase.CONNECTING) {
            return View(
                Screen.TERMINAL_CONNECT,
                "Setting up Tap to Pay",
                "Connecting Tap to Pay. This only takes a moment.",
                "",
                Action.NONE,
                checks,
                false
            )
        }
        if (input.completedOnce) {
            return View(
                Screen.SKIP,
                "✓ TAP TO PAY READY",
                "This phone is ready to accept contactless payments.",
                "CONTINUE",
                Action.CONTINUE,
                checks,
                true
            )
        }
        if (!input.signedIn) {
            return View(
                Screen.SIGN_IN,
                "Sign in to finish",
                "Use the same admin email you use on the S&R website.",
                "SIGN IN",
                Action.CONTINUE_TO_LOGIN,
                checks,
                false
            )
        }
        return View(
            Screen.TERMINAL_CONNECT,
            "Setting up Tap to Pay",
            "Connecting Tap to Pay. This only takes a moment.",
            "",
            Action.INIT_TERMINAL,
            checks,
            false
        )
    }

    private fun checklist(
        androidOk: Boolean,
        nfcAvailable: Boolean,
        nfcOn: Boolean,
        locationGranted: Boolean,
        servicesOn: Boolean,
        terminal: TerminalPhase
    ): List<CheckItem> {
        return listOf(
            CheckItem("Compatible Android version", androidOk),
            CheckItem("NFC available", nfcAvailable),
            CheckItem("NFC turned on", nfcOn),
            CheckItem("Location allowed", locationGranted),
            CheckItem("Location Services on", servicesOn),
            CheckItem("Connecting Tap to Pay", terminal == TerminalPhase.READY || terminal == TerminalPhase.CONNECTING)
        )
    }
}
