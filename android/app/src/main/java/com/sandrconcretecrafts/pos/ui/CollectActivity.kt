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
import com.sandrconcretecrafts.pos.data.PublicConfig
import com.sandrconcretecrafts.pos.data.SessionStore
import com.sandrconcretecrafts.pos.databinding.ActivityCollectBinding
import com.sandrconcretecrafts.pos.setup.SetupStore
import com.sandrconcretecrafts.pos.terminal.TerminalPermissions
import java.net.URLDecoder

class CollectActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCollectBinding
    private val viewModel: CollectViewModel by viewModels()
    private var startedCollect = false
    private var showDiagnostics = false
    private var sentToSetup = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCollectBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.diagnosticsToggle.setOnClickListener {
            showDiagnostics = !showDiagnostics
            refreshDiagnostics()
        }

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
        refreshDiagnostics()
        if (!startedCollect) continueIfReady()
        else if (needsRepair()) sendToSetup()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        startedCollect = false
        sentToSetup = false
        continueIfReady()
    }

    private fun currentState(): TerminalPermissions.LocationState {
        return TerminalPermissions.evaluate(
            this,
            false,
            shouldShowRequestPermissionRationale(TerminalPermissions.finePermission)
        )
    }

    private fun needsRepair(): Boolean {
        val setup = SetupStore(this)
        return SetupActivity.needsWizard(
            setup.welcomeSeen,
            setup.completedOnce,
            currentState(),
            TerminalPermissions.nfcAvailable(this),
            TerminalPermissions.nfcEnabled(this)
        )
    }

    private fun continueIfReady() {
        val state = currentState()
        refreshDiagnostics(state)
        if (needsRepair()) {
            sendToSetup()
            return
        }
        if (!startedCollect) {
            startedCollect = true
            startFromIntent()
        }
    }

    private fun sendToSetup() {
        if (sentToSetup) return
        sentToSetup = true
        startActivity(Intent(this, SetupActivity::class.java).apply {
            data = intent.data
            intent.extras?.let { putExtras(it) }
            payloadFrom(intent)?.let { putExtra("p", it) }
        })
        finish()
    }

    private fun startFromIntent() {
        val payload = payloadFrom(intent)
        if (payload.isNullOrBlank()) {
            binding.status.text = "Open Take Payment"
            binding.detail.text = "Open Take Payment from S&R Payments on this phone."
            binding.busy.visibility = View.GONE
            binding.takePayment.visibility = View.GONE
            binding.cancel.visibility = View.GONE
            binding.backToPos.visibility = View.VISIBLE
            refreshDiagnostics()
            return
        }
        viewModel.start(payload)
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
        refreshDiagnostics()
    }

    private fun refreshDiagnostics(state: TerminalPermissions.LocationState = currentState()) {
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
        binding.diagnostics.visibility = View.VISIBLE
        binding.diagnostics.text = TerminalPermissions.safeDiagnostics(
            this,
            state,
            viewModel.safeTerminalDiagnostics()
        )
    }

    private fun openPayments(query: String?) {
        val url = PublicConfig.apiBaseUrl + "/admin/payments.html" +
            if (query.isNullOrBlank()) "" else "?$query"
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        finish()
    }

    companion object {
        fun payloadFrom(intent: Intent?): String? {
            val extra = intent?.getStringExtra("p") ?: intent?.getStringExtra("payload")
            if (!extra.isNullOrBlank()) return extra
            val data = intent?.data ?: return null
            val raw = data.getQueryParameter("p") ?: data.getQueryParameter("payload") ?: return null
            return URLDecoder.decode(raw, Charsets.UTF_8.name())
        }
    }
}
