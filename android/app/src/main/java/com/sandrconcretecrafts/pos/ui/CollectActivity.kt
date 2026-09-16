package com.sandrconcretecrafts.pos.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.sandrconcretecrafts.pos.data.PublicConfig
import com.sandrconcretecrafts.pos.data.SessionStore
import com.sandrconcretecrafts.pos.databinding.ActivityCollectBinding
import java.net.URLDecoder

class CollectActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCollectBinding
    private val viewModel: CollectViewModel by viewModels()
    private val permission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        if (granted.values.all { it }) startFromIntent()
        else showFailed("Location permission is required for Stripe Terminal.")
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

        if (hasLocationPermission()) startFromIntent()
        else permission.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        startFromIntent()
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
                binding.cancel.text = getString(com.sandrconcretecrafts.pos.R.string.cancel)
                binding.cancel.setOnClickListener { viewModel.cancel() }
                binding.backToPos.visibility = View.GONE
            }
            is CollectViewModel.UiState.Success -> {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                binding.amount.text = state.amountLabel
                binding.status.text = "Payment received"
                binding.detail.text = "The sale is recorded. You can send a receipt from Payments."
                binding.busy.visibility = View.GONE
                binding.cancel.visibility = View.GONE
                binding.backToPos.visibility = View.VISIBLE
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
                binding.cancel.text = if (state.canRetry) "Try again" else getString(com.sandrconcretecrafts.pos.R.string.cancel)
                binding.cancel.setOnClickListener {
                    if (state.canRetry) viewModel.retry() else viewModel.cancel()
                }
                binding.backToPos.setOnClickListener { openPayments("tap=failed") }
            }
            CollectViewModel.UiState.Cancelled -> openPayments("tap=cancel")
        }
    }

    private fun showFailed(message: String) {
        binding.status.text = "Tap to Pay isn’t ready"
        binding.detail.text = message
        binding.busy.visibility = View.GONE
        binding.cancel.visibility = View.GONE
        binding.backToPos.visibility = View.VISIBLE
    }

    private fun openPayments(query: String?) {
        val url = PublicConfig.apiBaseUrl + "/admin/payments.html" +
            if (query.isNullOrBlank()) "" else "?$query"
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        finish()
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
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
