package com.sandrconcretecrafts.pos.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import com.sandrconcretecrafts.pos.data.PublicConfig
import com.sandrconcretecrafts.pos.data.SessionStore
import com.sandrconcretecrafts.pos.data.SrApi
import com.sandrconcretecrafts.pos.terminal.TerminalController
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class CollectViewModel(application: Application) : AndroidViewModel(application) {
    sealed class UiState {
        data class Working(val amountLabel: String, val title: String, val detail: String) : UiState()
        data class Ready(val amountLabel: String) : UiState()
        data class Success(val orderId: String, val amount: Int, val amountLabel: String) : UiState()
        data class Failed(val amountLabel: String, val message: String, val canRetry: Boolean) : UiState()
        data object Cancelled : UiState()
    }

    private val session = SessionStore(application)
    private val api = SrApi(session)
    private val terminal = TerminalController(application, api)
    private val io = Executors.newSingleThreadExecutor()
    private val started = AtomicBoolean(false)

    private val _state = MutableLiveData<UiState>()
    val state: LiveData<UiState> = _state

    private var sale: JSONObject? = null

    fun start(saleJson: String) {
        sale = JSONObject(saleJson)
        if (!started.compareAndSet(false, true)) return
        val amountLabel = amountLabel(sale)
        _state.postValue(
            UiState.Working(
                amountLabel,
                "Preparing Tap to Pay",
                "Checking permissions, then starting Stripe Terminal."
            )
        )
        if (!PublicConfig.isConfigured()) {
            started.set(false)
            _state.postValue(UiState.Failed(amountLabel, "Public configuration is missing.", false))
            return
        }
        if (session.accessToken.isNullOrBlank()) {
            started.set(false)
            _state.postValue(UiState.Failed(amountLabel, "Sign in required.", false))
            return
        }
        io.execute {
            try {
                api.requireActiveAdmin()
                _state.postValue(
                    UiState.Working(
                        amountLabel,
                        "Initializing Stripe Terminal",
                        if (PublicConfig.simulatedReader) {
                            "TEST — Simulated Reader. No PaymentIntent is created."
                        } else {
                            "Connecting this phone as a card reader."
                        }
                    )
                )
                terminal.connect(
                    onPhase = { phase ->
                        _state.postValue(
                            UiState.Working(
                                amountLabel,
                                phase,
                                if (PublicConfig.simulatedReader) {
                                    "TEST — Simulated Reader. No payment is being taken."
                                } else {
                                    "Connecting this phone as a card reader."
                                }
                            )
                        )
                    },
                    onReady = {
                        _state.postValue(UiState.Ready(amountLabel))
                    },
                    onError = { message ->
                        started.set(false)
                        _state.postValue(
                            UiState.Failed(amountLabel, withDiagnostics(message), true)
                        )
                    }
                )
            } catch (error: Exception) {
                started.set(false)
                _state.postValue(
                    UiState.Failed(
                        amountLabel,
                        withDiagnostics(error.message ?: "Couldn’t start Tap to Pay."),
                        true
                    )
                )
            }
        }
    }

    fun retry() {
        terminal.cancel()
        started.set(false)
        val json = sale?.toString() ?: return
        start(json)
    }

    fun cancel() {
        terminal.cancel()
        _state.postValue(UiState.Cancelled)
    }

    fun safeTerminalDiagnostics(): String {
        return terminal.safeDiagnostics()
    }

    private fun withDiagnostics(message: String): String {
        if (!PublicConfig.simulatedReader) return message
        val extra = terminal.safeDiagnostics()
        return if (extra.isBlank()) message else message + "\n\n" + extra
    }

    override fun onCleared() {
        io.shutdownNow()
        super.onCleared()
    }

    companion object {
        fun amountLabel(sale: JSONObject?): String {
            val items = sale?.optJSONArray("items") ?: return "$0.00"
            var total = 0
            for (i in 0 until items.length()) {
                val item = items.optJSONObject(i) ?: continue
                val qty = item.optInt("quantity", 1)
                val unit = item.optInt("unit_amount_cents", 0)
                total += if (item.optString("type") == "custom") unit * qty else 0
            }
            return if (total > 0) money(total) else "Sale"
        }

        fun money(cents: Int): String {
            return "$" + String.format("%.2f", cents / 100.0)
        }
    }
}
