package com.sandrconcretecrafts.pos.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import com.sandrconcretecrafts.pos.BuildConfig
import com.sandrconcretecrafts.pos.R
import com.sandrconcretecrafts.pos.data.CollectPayloadParser
import com.sandrconcretecrafts.pos.data.PublicConfig
import com.sandrconcretecrafts.pos.data.SalePayload
import com.sandrconcretecrafts.pos.data.SessionStore
import com.sandrconcretecrafts.pos.databinding.ActivityCollectBinding
import com.sandrconcretecrafts.pos.terminal.ErrorSource
import com.sandrconcretecrafts.pos.terminal.EventTrace
import com.sandrconcretecrafts.pos.terminal.TerminalPermissions

class CollectActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCollectBinding
    private val viewModel: CollectViewModel by viewModels()
    private var startedCollect = false
    private var sentToSetup = false
    private var parsed: CollectPayloadParser.Result? = null
    private var locationEvaluated = false
    private var lastLocation: TerminalPermissions.LocationState? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCollectBinding.inflate(layoutInflater)
        setContentView(binding.root)
        EventTrace.add("APP_OPEN path=deep-link-or-collect")
        EventTrace.add("BUILD_VERIFIED code=${BuildConfig.VERSION_CODE} id=${BuildConfig.BUILD_ID}")
        paintCollectIdentity()
        parsed = CollectPayloadParser.parse(intent)
        paintHandoffPanel(parsed)

        if (SessionStore(this).accessToken.isNullOrBlank()) {
            startActivity(Intent(this, LoginActivity::class.java).apply {
                data = intent.data
                intent.extras?.let { putExtras(it) }
            })
            finish()
            return
        }

        viewModel.state.observe(this) { render(it) }
        binding.cancel.setOnClickListener { viewModel.cancel() }
        binding.backToPos.setOnClickListener { openPayments(null) }
        continueIfReady()
    }

    override fun onResume() {
        super.onResume()
        paintHandoffPanel(parsed)
        val current = parsed
        if (current is CollectPayloadParser.Result.Error) {
            showPayloadFailure(current)
            return
        }
        if (needsRepair()) {
            sendToSetup()
            return
        }
        val failed = viewModel.state.value as? CollectViewModel.UiState.Failed
        if (failed != null && failed.canRetry && lastLocation?.readyForTerminal == true) {
            EventTrace.add("STALE_UI_CLEARED reason=location-satisfied")
            viewModel.retry()
            return
        }
        if (!startedCollect) continueIfReady()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        startedCollect = false
        sentToSetup = false
        locationEvaluated = false
        parsed = CollectPayloadParser.parse(intent)
        paintHandoffPanel(parsed)
        continueIfReady()
    }

    private fun paintCollectIdentity() {
        if (!BuildConfig.SIMULATED_READER) {
            binding.collectBanner.visibility = View.GONE
            return
        }
        binding.collectBanner.visibility = View.VISIBLE
        binding.collectBanner.text =
            "TEST BUILD ${BuildConfig.VERSION_NAME}\nCODE ${BuildConfig.VERSION_CODE}\n${BuildConfig.BUILD_ID}\nCOLLECT CODE ${BuildConfig.VERSION_CODE}\n${BuildConfig.BUILD_ID}"
    }

    private fun continueIfReady() {
        val current = parsed ?: CollectPayloadParser.parse(intent).also { parsed = it }
        paintHandoffPanel(current)
        if (current is CollectPayloadParser.Result.Error) {
            showPayloadFailure(current)
            return
        }
        val ok = current as CollectPayloadParser.Result.Ok
        binding.amount.text = SalePayload.money(ok.amountCents)
        if (needsRepair()) {
            sendToSetup()
            return
        }
        if (!startedCollect) {
            startedCollect = true
            viewModel.start(ok.sale.toString())
        }
    }

    private fun showPayloadFailure(error: CollectPayloadParser.Result.Error) {
        startedCollect = true
        binding.amount.text = "—"
        binding.status.text = "Tap to Pay didn’t get the sale"
        binding.detail.text = error.userMessage
        binding.busy.visibility = View.GONE
        binding.takePayment.visibility = View.GONE
        binding.cancel.visibility = View.GONE
        binding.backToPos.visibility = View.VISIBLE
        binding.openSettings.visibility = View.GONE
        paintHandoffPanel(error)
    }

    private fun evaluateLocation(): TerminalPermissions.LocationState {
        locationEvaluated = true
        val state = TerminalPermissions.evaluateAndTrace(
            this,
            false,
            shouldShowRequestPermissionRationale(TerminalPermissions.coarsePermission),
            "CollectActivity"
        )
        lastLocation = state
        return state
    }

    private fun needsRepair(): Boolean {
        if (parsed !is CollectPayloadParser.Result.Ok) return false
        return SetupActivity.needsDeviceRepair(
            evaluateLocation(),
            TerminalPermissions.nfcAvailable(this),
            TerminalPermissions.nfcEnabled(this)
        )
    }

    private fun sendToSetup() {
        if (sentToSetup) return
        sentToSetup = true
        startActivity(Intent(this, SetupActivity::class.java).apply {
            data = intent.data
            intent.extras?.let { putExtras(it) }
        })
        finish()
    }

    private fun render(state: CollectViewModel.UiState) {
        when (state) {
            is CollectViewModel.UiState.Working -> {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                binding.amount.text = state.amountLabel
                binding.status.textSize = 22f
                binding.status.text = state.title
                binding.detail.text = state.detail
                binding.busy.visibility = View.VISIBLE
                binding.takePayment.visibility = View.GONE
                binding.cancel.visibility = View.VISIBLE
                binding.cancel.text = getString(R.string.cancel)
                binding.cancel.setOnClickListener { viewModel.cancel() }
                binding.backToPos.visibility = View.GONE
                binding.openSettings.visibility = View.GONE
            }
            is CollectViewModel.UiState.Ready -> {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                binding.amount.text = state.amountLabel
                binding.status.textSize = 28f
                binding.status.text = getString(R.string.tap_ready_title)
                binding.detail.text = getString(R.string.tap_ready_copy)
                binding.busy.visibility = View.GONE
                binding.takePayment.visibility = View.VISIBLE
                binding.takePayment.isEnabled = true
                binding.takePayment.text = state.takePaymentLabel
                binding.takePayment.setOnClickListener { viewModel.takePayment() }
                binding.cancel.visibility = View.GONE
                binding.backToPos.visibility = View.VISIBLE
                binding.openSettings.visibility = View.GONE
                binding.backToPos.setOnClickListener { openPayments(null) }
            }
            is CollectViewModel.UiState.Success -> {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                binding.amount.text = state.amountLabel
                binding.status.text = "Payment received"
                binding.detail.text = "The sale is recorded. You can send a receipt from Payments."
                binding.busy.visibility = View.GONE
                binding.takePayment.visibility = View.GONE
                binding.cancel.visibility = View.GONE
                binding.backToPos.visibility = View.VISIBLE
                binding.openSettings.visibility = View.GONE
                binding.backToPos.setOnClickListener {
                    openPayments("paid=${state.orderId}&amount=${state.amount}")
                }
            }
            is CollectViewModel.UiState.Failed -> {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                binding.amount.text = state.amountLabel
                binding.status.text = "Tap to Pay didn’t finish"
                binding.detail.text = state.message
                binding.busy.visibility = View.GONE
                binding.takePayment.visibility = View.GONE
                binding.cancel.visibility = View.VISIBLE
                binding.backToPos.visibility = View.VISIBLE
                binding.openSettings.visibility = View.GONE
                binding.cancel.text = if (state.canRetry) "Try again" else getString(R.string.cancel)
                binding.cancel.setOnClickListener {
                    if (state.canRetry) viewModel.retry() else viewModel.cancel()
                }
                binding.backToPos.setOnClickListener { openPayments("tap=failed") }
            }
            CollectViewModel.UiState.Cancelled -> openPayments("tap=cancel")
        }
        paintHandoffPanel(parsed)
    }

    private fun paintHandoffPanel(result: CollectPayloadParser.Result?) {
        if (!BuildConfig.SIMULATED_READER) {
            binding.handoffPanel.visibility = View.GONE
            binding.diagnosticsToggle.visibility = View.GONE
            binding.diagnostics.visibility = View.GONE
            return
        }
        val location = lastLocation
        val ok = result as? CollectPayloadParser.Result.Ok
        val error = result as? CollectPayloadParser.Result.Error
        val source = when {
            error != null -> ErrorSource.HANDOFF_PAYLOAD
            location != null && location.block != TerminalPermissions.Block.NONE -> location.source
            else -> ErrorSource.ANDROID_PERMISSION_CHECK
        }
        val lines = listOf(
            "TEST BUILD ${BuildConfig.VERSION_NAME}",
            "CODE ${BuildConfig.VERSION_CODE}",
            BuildConfig.BUILD_ID,
            "SCREEN: CollectActivity",
            "SOURCE: $source",
            "HANDOFF VERSION: ${ok?.version ?: error?.versionReceived ?: "absent"}",
            "PAYLOAD PRESENT: ${if (ok != null || error?.payloadPresent == true) "YES" else "NO"}",
            "AMOUNT FIELD PRESENT: ${if (ok != null || error?.amountFieldPresent == true) "YES" else "NO"}",
            "AMOUNT_TOTAL_CENTS: ${ok?.amountCents?.toString() ?: error?.amountValue ?: "INVALID"}",
            "DISPLAY TOTAL: ${ok?.let { SalePayload.money(it.amountCents) } ?: "—"}",
            "COARSE: ${location?.let { if (it.coarseGranted) "GRANTED" else "DENIED" } ?: "NOT EVALUATED"}",
            "FINE: ${location?.let { if (it.fineGranted) "GRANTED" else "DENIED" } ?: "NOT EVALUATED"}",
            "LOCATION REQUIREMENT: ${location?.let { if (it.requirementSatisfied) "SATISFIED" else "NOT SATISFIED" } ?: "NOT EVALUATED"}",
            "LOCATION SERVICES: ${location?.let { if (it.servicesOn) "ON" else "OFF" } ?: "NOT EVALUATED"}",
            "TERMINAL INIT REACHED: ${if (viewModel.terminalInitReached()) "YES" else "NO"}",
            "LAST EVENT:",
            EventTrace.render(),
            viewModel.safeTerminalDiagnostics()
        )
        binding.handoffPanel.visibility = View.VISIBLE
        binding.handoffPanel.text = lines.filter { it.isNotBlank() }.joinToString("\n")
        binding.diagnosticsToggle.visibility = View.GONE
        binding.diagnostics.visibility = View.GONE
    }

    private fun openPayments(query: String?) {
        val url = PublicConfig.apiBaseUrl + "/admin/payments.html" +
            if (query.isNullOrBlank()) "" else "?$query"
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        finish()
    }

    companion object {
        fun payloadFrom(intent: Intent?): String? {
            return when (val parsed = CollectPayloadParser.parse(intent, false)) {
                is CollectPayloadParser.Result.Ok -> parsed.sale.toString()
                is CollectPayloadParser.Result.Error -> null
            }
        }
    }
}
