package com.sandrconcretecrafts.pos.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.sandrconcretecrafts.pos.BuildConfig
import com.sandrconcretecrafts.pos.R
import com.sandrconcretecrafts.pos.data.PublicConfig
import com.sandrconcretecrafts.pos.data.SessionStore
import com.sandrconcretecrafts.pos.data.SrApi
import com.sandrconcretecrafts.pos.databinding.ActivityLoginBinding
import com.sandrconcretecrafts.pos.setup.SetupStore
import com.sandrconcretecrafts.pos.terminal.TerminalPermissions
import java.util.concurrent.Executors

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private val io = Executors.newSingleThreadExecutor()
    private var showDiagnostics = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.diagnosticsToggle.setOnClickListener {
            showDiagnostics = !showDiagnostics
            refreshDiagnostics()
        }
        refreshDiagnostics()

        val session = SessionStore(this)
        if (!PublicConfig.isConfigured()) {
            showError(getString(R.string.config_missing))
        } else if (!session.accessToken.isNullOrBlank()) {
            continueAfterAuth()
            return
        }

        binding.signIn.setOnClickListener {
            val email = binding.email.text?.toString().orEmpty()
            val password = binding.password.text?.toString().orEmpty()
            if (email.isBlank() || password.isBlank()) {
                showError("Enter your admin email and password.")
                return@setOnClickListener
            }
            binding.signIn.isEnabled = false
            io.execute {
                try {
                    SrApi(session).login(email, password)
                    runOnUiThread { continueAfterAuth() }
                } catch (error: Exception) {
                    runOnUiThread {
                        binding.signIn.isEnabled = true
                        showError(error.message ?: "Couldn’t sign in.")
                    }
                }
            }
        }
    }

    private fun continueAfterAuth() {
        val setup = SetupStore(this)
        val location = TerminalPermissions.evaluate(this, false, false)
        if (SetupActivity.needsWizard(
                setup.welcomeSeen,
                setup.completedOnce,
                location,
                TerminalPermissions.nfcAvailable(this),
                TerminalPermissions.nfcEnabled(this)
            )
        ) {
            startActivity(Intent(this, SetupActivity::class.java).apply {
                data = intent.data
                intent.extras?.let { putExtras(it) }
            })
            finish()
            return
        }
        if (CollectActivity.payloadFrom(intent).isNullOrBlank()) {
            startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(PublicConfig.apiBaseUrl + "/admin/payments.html")
                )
            )
            finish()
            return
        }
        val next = Intent(this, CollectActivity::class.java)
        intent?.data?.let { next.data = it }
        intent?.extras?.let { next.putExtras(it) }
        startActivity(next)
        finish()
    }

    private fun refreshDiagnostics() {
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
            false,
            shouldShowRequestPermissionRationale(TerminalPermissions.finePermission)
        )
        binding.diagnostics.visibility = View.VISIBLE
        binding.diagnostics.text = TerminalPermissions.safeDiagnostics(this, location)
    }

    private fun showError(message: String) {
        binding.error.visibility = View.VISIBLE
        binding.error.text = message
    }

    override fun onDestroy() {
        io.shutdownNow()
        super.onDestroy()
    }
}
