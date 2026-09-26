package com.sandrconcretecrafts.pos.ui

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.sandrconcretecrafts.pos.BuildConfig
import com.sandrconcretecrafts.pos.R
import com.sandrconcretecrafts.pos.data.PublicConfig
import com.sandrconcretecrafts.pos.data.SessionStore
import com.sandrconcretecrafts.pos.data.SrApi
import com.sandrconcretecrafts.pos.databinding.ActivitySetupBinding
import com.sandrconcretecrafts.pos.setup.SetupGate
import com.sandrconcretecrafts.pos.setup.SetupStore
import com.sandrconcretecrafts.pos.terminal.EventTrace
import com.sandrconcretecrafts.pos.terminal.TerminalController
import com.sandrconcretecrafts.pos.terminal.TerminalPermissions

class SetupActivity : AppCompatActivity() {
    private lateinit var binding: ActivitySetupBinding
    private lateinit var setupStore: SetupStore
    private lateinit var session: SessionStore
    private var requestedLocationThisSession = false
    private var terminalStarted = false
    private var terminalPhase = SetupGate.TerminalPhase.IDLE
    private var terminalError = ""
    private var showDiagnostics = BuildConfig.SIMULATED_READER
    private var leaving = false
    private var terminal: TerminalController? = null
    private val permission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        requestedLocationThisSession = true
        render()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySetupBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setupStore = SetupStore(this)
        session = SessionStore(this)
        EventTrace.add("APP_OPEN path=launcher")
        EventTrace.add("BUILD_VERIFIED code=${BuildConfig.VERSION_CODE} id=${BuildConfig.BUILD_ID}")
        binding.diagnosticsToggle.setOnClickListener {
            showDiagnostics = !showDiagnostics
            refreshDiagnostics(currentView())
        }
        binding.primary.setOnClickListener { onPrimary() }
        render()
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        render()
    }

    private fun currentView(): SetupGate.View {
        val location = TerminalPermissions.evaluateAndTrace(
            this,
            requestedLocationThisSession,
            shouldShowRequestPermissionRationale(TerminalPermissions.coarsePermission),
            "SetupActivity"
        )
        return SetupGate.evaluate(
            SetupGate.Input(
                welcomeSeen = setupStore.welcomeSeen,
                completedOnce = setupStore.completedOnce,
                sdkInt = Build.VERSION.SDK_INT,
                nfcAvailable = TerminalPermissions.nfcAvailable(this),
                nfcEnabled = TerminalPermissions.nfcEnabled(this),
                fineGranted = location.fineGranted,
                coarseGranted = location.coarseGranted,
                servicesOn = location.servicesOn,
                alreadyRequestedLocation = requestedLocationThisSession,
                rationaleLocation = location.rationaleLocation,
                signedIn = !session.accessToken.isNullOrBlank(),
                terminal = terminalPhase,
                terminalError = terminalError
            )
        )
    }

    private fun render() {
        val view = currentView()
        if (view.skipWizard) {
            finishSetup(view)
            return
        }
        if (leaving) return
        binding.title.text = view.title
        binding.body.text = view.body
        binding.checklist.text = view.checklist.joinToString("\n") { item ->
            (if (item.done) "✓ " else "○ ") + item.label
        }
        binding.checklistCard.visibility =
            if (view.screen == SetupGate.Screen.WELCOME) View.GONE else View.VISIBLE
        binding.busy.visibility =
            if (view.screen == SetupGate.Screen.TERMINAL_CONNECT) View.VISIBLE else View.GONE
        if (view.button.isBlank()) {
            binding.primary.visibility = View.GONE
        } else {
            binding.primary.visibility = View.VISIBLE
            binding.primary.text = view.button
        }
        refreshDiagnostics(view)
        if (view.action == SetupGate.Action.INIT_TERMINAL && !terminalStarted) {
            startTerminal()
        }
    }

    private fun onPrimary() {
        when (currentView().action) {
            SetupGate.Action.MARK_WELCOME -> {
                setupStore.welcomeSeen = true
                render()
            }
            SetupGate.Action.REQUEST_LOCATION -> {
                permission.launch(TerminalPermissions.locationRequestPermissions)
            }
            SetupGate.Action.OPEN_APP_SETTINGS -> openAppSettings()
            SetupGate.Action.OPEN_LOCATION_SERVICES -> {
                startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            }
            SetupGate.Action.OPEN_NFC_SETTINGS -> {
                startActivity(Intent(Settings.ACTION_NFC_SETTINGS))
            }
            SetupGate.Action.CONTINUE_TO_LOGIN -> goLogin()
            SetupGate.Action.INIT_TERMINAL -> startTerminal()
            SetupGate.Action.CONTINUE -> finishSetup(currentView())
            SetupGate.Action.NONE -> Unit
        }
    }

    private fun startTerminal() {
        if (terminalStarted) return
        if (session.accessToken.isNullOrBlank()) return
        terminalStarted = true
        terminalPhase = SetupGate.TerminalPhase.CONNECTING
        render()
        val controller = terminal ?: TerminalController(application, SrApi(session)).also { terminal = it }
        controller.connect(
            onPhase = {
                terminalPhase = SetupGate.TerminalPhase.CONNECTING
                runOnUiThread { render() }
            },
            onReady = {
                terminalPhase = SetupGate.TerminalPhase.READY
                setupStore.completedOnce = true
                runOnUiThread { render() }
            },
            onError = { message ->
                terminalStarted = false
                val mismatch = message.contains("TERMINAL_MODE_MISMATCH")
                terminalPhase = if (mismatch) {
                    SetupGate.TerminalPhase.MODE_MISMATCH
                } else {
                    SetupGate.TerminalPhase.FAILED
                }
                terminalError = message
                runOnUiThread { render() }
            }
        )
    }

    private fun finishSetup(view: SetupGate.View) {
        if (leaving) return
        leaving = true
        if (view.screen == SetupGate.Screen.READY || view.skipWizard) {
            setupStore.completedOnce = true
            setupStore.welcomeSeen = true
        }
        val payload = CollectActivity.payloadFrom(intent)
        if (!payload.isNullOrBlank() && !session.accessToken.isNullOrBlank()) {
            startActivity(Intent(this, CollectActivity::class.java).apply {
                data = intent.data
                intent.extras?.let { putExtras(it) }
                putExtra("p", payload)
            })
            finish()
            return
        }
        if (session.accessToken.isNullOrBlank()) {
            goLogin()
            return
        }
        startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(PublicConfig.apiBaseUrl + "/admin/payments.html"))
        )
        finish()
    }

    private fun goLogin() {
        startActivity(Intent(this, LoginActivity::class.java).apply {
            data = intent.data
            intent.extras?.let { putExtras(it) }
            putExtra(EXTRA_FROM_SETUP, true)
        })
        finish()
    }

    private fun openAppSettings() {
        startActivity(
            Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null)
            )
        )
    }

    private fun refreshDiagnostics(view: SetupGate.View) {
        if (!BuildConfig.SIMULATED_READER) {
            binding.diagnosticsToggle.visibility = View.GONE
            binding.diagnostics.visibility = View.GONE
            return
        }
        binding.diagnosticsToggle.visibility = View.VISIBLE
        binding.diagnosticsToggle.text = if (showDiagnostics) {
            getString(R.string.hide_test_diagnostics)
        } else {
            getString(R.string.test_diagnostics)
        }
        if (!showDiagnostics) {
            binding.diagnostics.visibility = View.GONE
            return
        }
        val location = TerminalPermissions.evaluate(
            this,
            requestedLocationThisSession,
            shouldShowRequestPermissionRationale(TerminalPermissions.coarsePermission)
        )
        val extra = listOf(
            "BLOCKED STAGE: ${view.stage}",
            "REASON: ${view.reason}",
            "Setup welcome seen: ${setupStore.welcomeSeen}",
            "Setup completed once: ${setupStore.completedOnce}",
            terminal?.safeDiagnostics().orEmpty()
        ).filter { it.isNotBlank() }.joinToString("\n")
        binding.diagnostics.visibility = View.VISIBLE
        binding.diagnostics.text = TerminalPermissions.safeDiagnostics(this, location, extra)
    }

    companion object {
        const val EXTRA_FROM_SETUP = "from_setup"

        fun needsDeviceRepair(
            location: TerminalPermissions.LocationState,
            nfcAvailable: Boolean,
            nfcEnabled: Boolean,
            sdkInt: Int = Build.VERSION.SDK_INT
        ): Boolean {
            return !SetupGate.deviceReady(
                sdkInt,
                nfcAvailable,
                nfcEnabled,
                location.fineGranted,
                location.coarseGranted,
                location.servicesOn
            )
        }

        fun needsWizard(
            welcomeSeen: Boolean,
            completedOnce: Boolean,
            location: TerminalPermissions.LocationState,
            nfcAvailable: Boolean,
            nfcEnabled: Boolean,
            sdkInt: Int = Build.VERSION.SDK_INT
        ): Boolean {
            val view = SetupGate.evaluate(
                SetupGate.Input(
                    welcomeSeen = welcomeSeen,
                    completedOnce = completedOnce,
                    sdkInt = sdkInt,
                    nfcAvailable = nfcAvailable,
                    nfcEnabled = nfcEnabled,
                    fineGranted = location.fineGranted,
                    coarseGranted = location.coarseGranted,
                    servicesOn = location.servicesOn,
                    alreadyRequestedLocation = location.alreadyRequested,
                    rationaleLocation = location.rationaleLocation,
                    signedIn = true,
                    terminal = SetupGate.TerminalPhase.IDLE
                )
            )
            return !view.skipWizard
        }
    }
}
