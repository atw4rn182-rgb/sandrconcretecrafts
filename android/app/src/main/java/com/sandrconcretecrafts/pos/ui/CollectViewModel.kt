package com.sandrconcretecrafts.pos.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import com.sandrconcretecrafts.pos.data.PublicConfig
import com.sandrconcretecrafts.pos.data.SalePayload
import com.sandrconcretecrafts.pos.data.SessionStore
import com.sandrconcretecrafts.pos.data.SrApi
import com.sandrconcretecrafts.pos.terminal.TerminalController
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class CollectViewModel(application: Application) : AndroidViewModel(application) {
    sealed class UiState {
        data class Working(val amountLabel: String, val title: String, val detail: String) : UiState()
        data class Ready(val amountLabel: String, val takePaymentLabel: String) : UiState()
        data class Success(val orderId: String, val amount: Int, val amountLabel: String) : UiState()
        data class Failed(val amountLabel: String, val message: String, val canRetry: Boolean) : UiState()
        data object Cancelled : UiState()
    }

    private val session = SessionStore(application)
    private val api = SrApi(session)
    private val terminal = TerminalController(application, api)
    private val io = Executors.newSingleThreadExecutor()
    private val started = AtomicBoolean(false)
    private val collecting = AtomicBoolean(false)

    private val _state = MutableLiveData<UiState>()
    val state: LiveData<UiState> = _state

    private var sale: JSONObject? = null

    fun start(saleJson: String) {
        sale = JSONObject(saleJson)
        if (!started.compareAndSet(false, true)) return
        val amountLabel = SalePayload.amountLabel(sale)
        if (SalePayload.amountCents(sale) == null) {
            started.set(false)
            _state.postValue(
                UiState.Failed(
                    amountLabel,
                    "This sale has no total. Return to Payments and start Take Payment again.",
                    false
                )
            )
            return
        }
        _state.postValue(
            UiState.Working(
                amountLabel,
                "Preparing Tap to Pay",
                "SOURCE: ANDROID_PERMISSION_CHECK\nLocation gate already evaluated. Starting Stripe Terminal."
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
                            "TEST — Simulated Reader. Preparing the reader, not charging yet."
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
                                    "TEST — Simulated Reader. Connecting the reader, not charging yet."
                                } else {
                                    "Connecting this phone as a card reader."
                                }
                            )
                        )
                    },
                    onReady = {
                        _state.postValue(
                            UiState.Ready(amountLabel, SalePayload.takePaymentLabel(sale))
                        )
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

    fun takePayment() {
        val currentSale = sale
        val expected = SalePayload.amountCents(currentSale)
        val amountLabel = SalePayload.amountLabel(currentSale)
        if (currentSale == null || expected == null) {
            _state.postValue(
                UiState.Failed(amountLabel, "This sale has no total. Return to Payments.", false)
            )
            return
        }
        if (!collecting.compareAndSet(false, true)) return
        _state.postValue(
            UiState.Working(
                amountLabel,
                "Creating payment",
                if (PublicConfig.simulatedReader) {
                    "TEST — Simulated payment. No real card will be charged."
                } else {
                    "Preparing the charge on the S&R server."
                }
            )
        )
        io.execute {
            try {
                val payment = api.createPaymentIntent(currentSale)
                if (payment.amount != expected) {
                    collecting.set(false)
                    _state.postValue(
                        UiState.Failed(
                            amountLabel,
                            "The server total did not match this sale. No card was charged.",
                            true
                        )
                    )
                    return@execute
                }
                _state.postValue(
                    UiState.Working(
                        amountLabel,
                        if (PublicConfig.simulatedReader) "Simulated tap in progress" else "Ask the customer to tap",
                        if (PublicConfig.simulatedReader) {
                            "TEST — Simulated Reader. Completing a test payment for $amountLabel."
                        } else {
                            "Hold the card or phone to this Pixel until it finishes."
                        }
                    )
                )
                terminal.collect(
                    payment.clientSecret,
                    onSuccess = {
                        collecting.set(false)
                        _state.postValue(
                            UiState.Success(
                                payment.orderId,
                                payment.amount,
                                SalePayload.money(payment.amount)
                            )
                        )
                    },
                    onError = { message ->
                        collecting.set(false)
                        _state.postValue(UiState.Failed(amountLabel, withDiagnostics(message), true))
                    }
                )
            } catch (error: Exception) {
                collecting.set(false)
                _state.postValue(
                    UiState.Failed(
                        amountLabel,
                        withDiagnostics(error.message ?: "Couldn’t start the payment."),
                        true
                    )
                )
            }
        }
    }

    fun retry() {
        terminal.cancel()
        started.set(false)
        collecting.set(false)
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

}
