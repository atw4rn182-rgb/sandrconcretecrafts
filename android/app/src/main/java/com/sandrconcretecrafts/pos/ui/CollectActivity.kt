package com.sandrconcretecrafts.pos.ui

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import com.sandrconcretecrafts.pos.BuildConfig
import com.sandrconcretecrafts.pos.R
import com.sandrconcretecrafts.pos.data.PublicConfig
import com.sandrconcretecrafts.pos.data.SessionStore
import com.sandrconcretecrafts.pos.databinding.ActivityCollectBinding
import com.sandrconcretecrafts.pos.terminal.TerminalPermissions
import java.net.URLDecoder

class CollectActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCollectBinding
    private val viewModel: CollectViewModel by viewModels()
    private var waitingForPermissions = false
    private var startedCollect = false
    private var requestedPermissionsThisSession = false
    private val permission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        // Re-read Android's current grant state. Do not trust a stale denial.
        continueIfReady()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCollectBinding.inflate(layoutInflater)
        setContentView(binding.root)

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
        binding.openSettings.setOnClickListener { openAppSettings() }
        continueIfReady()
    }

    override fun onResume() {
        super.onResume()
        refreshDiagnostics()
        if (waitingForPermissions) continueIfReady()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        startedCollect = false
        continueIfReady()
    }

    private fun continueIfReady() {
        refreshDiagnostics()
        val missing = TerminalPermissions.missingRuntimePermissions(this)
        if (missing.isNotEmpty()) {
            waitingForPermissions = true
            if (shouldRequest(missing)) {
                requestedPermissionsThisSession = true
                permission.launch(missing)
            } else {
                showPermissionBlocked(missing)
            }
            return
        }
        if (!TerminalPermissions.locationServicesOn(this)) {
            waitingForPermissions = true
            showPermissionNeeded(
                "Turn on Location in Android Settings. Stripe Terminal needs the phone’s location, not just the app permission."
            )
            return
        }
        waitingForPermissions = false
        if (!startedCollect) {
            startedCollect = true
            startFromIntent()
        }
    }

    private fun shouldRequest(missing: Array<String>): Boolean {
        return !requestedPermissionsThisSession ||
            missing.any { shouldShowRequestPermissionRationale(it) }
    }

    private fun startFromIntent() {
        val payload = payloadFrom(intent)
        if (payload.isNullOrBlank()) {
            showFailed("Open Take Payment from S&R Payments on this phone.")
            return
        }
        viewModel.start(payload)
    }

    private fun render(state: CollectViewModel.UiState) {
        when (state) {
            is CollectViewModel.UiState.Working -> {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                binding.amount.text = state.amountLabel
                binding.status.text = state.title
                binding.detail.text = state.detail
                binding.busy.visibility = View.VISIBLE
                binding.cancel.visibility = View.VISIBLE
                binding.cancel.text = getString(R.string.cancel)
                binding.cancel.setOnClickListener { viewModel.cancel() }
                binding.backToPos.visibility = View.GONE
                binding.openSettings.visibility = View.GONE
            }
            is CollectViewModel.UiState.Success -> {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                binding.amount.text = state.amountLabel
                binding.status.text = "Payment received"
                binding.detail.text = "The sale is recorded. You can send a receipt from Payments."
                binding.busy.visibility = View.GONE
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
                binding.status.text = "Payment didn’t finish"
                binding.detail.text = state.message
                binding.busy.visibility = View.GONE
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

    private fun showPermissionBlocked(missing: Array<String>) {
        val needsLocation = missing.contains(Manifest.permission.ACCESS_FINE_LOCATION)
        val needsNearby = missing.any { it in TerminalPermissions.nearbyPermissions }
        val message = when {
            needsLocation ->
                "Location is still off for S&R Tap to Pay. Open Settings, allow Location, then return here."
            needsNearby ->
                "Nearby Devices is still off. Open Settings, allow Nearby Devices, then return here."
            else ->
                "A required permission is still off. Open Settings, then return here."
        }
        showPermissionNeeded(message)
    }

    private fun showPermissionNeeded(message: String) {
        binding.status.text = "Tap to Pay isn’t ready"
        binding.detail.text = message
        binding.busy.visibility = View.GONE
        binding.cancel.visibility = View.GONE
        binding.backToPos.visibility = View.VISIBLE
        binding.openSettings.visibility = View.VISIBLE
        refreshDiagnostics()
    }

    private fun showFailed(message: String) {
        binding.status.text = "Tap to Pay isn’t ready"
        binding.detail.text = message
        binding.busy.visibility = View.GONE
        binding.cancel.visibility = View.GONE
        binding.backToPos.visibility = View.VISIBLE
        refreshDiagnostics()
    }

    private fun refreshDiagnostics() {
        if (!BuildConfig.SIMULATED_READER) {
            binding.diagnostics.visibility = View.GONE
            return
        }
        binding.diagnostics.visibility = View.VISIBLE
        binding.diagnostics.text = TerminalPermissions.safeDiagnostics(
            this,
            viewModel.safeTerminalDiagnostics()
        )
    }

    private fun openAppSettings() {
        startActivity(
            Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null)
            )
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
