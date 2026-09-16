package com.sandrconcretecrafts.pos.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.sandrconcretecrafts.pos.R
import com.sandrconcretecrafts.pos.data.PublicConfig
import com.sandrconcretecrafts.pos.data.SessionStore
import com.sandrconcretecrafts.pos.data.SrApi
import com.sandrconcretecrafts.pos.databinding.ActivityLoginBinding
import java.util.concurrent.Executors

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private val io = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val session = SessionStore(this)
        if (!PublicConfig.isConfigured()) {
            showError(getString(R.string.config_missing))
        } else if (!session.accessToken.isNullOrBlank()) {
            continueToCollect()
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
                    runOnUiThread { continueToCollect() }
                } catch (error: Exception) {
                    runOnUiThread {
                        binding.signIn.isEnabled = true
                        showError(error.message ?: "Couldn’t sign in.")
                    }
                }
            }
        }
    }

    private fun continueToCollect() {
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

    private fun showError(message: String) {
        binding.error.visibility = View.VISIBLE
        binding.error.text = message
    }

    override fun onDestroy() {
        io.shutdownNow()
        super.onDestroy()
    }
}
