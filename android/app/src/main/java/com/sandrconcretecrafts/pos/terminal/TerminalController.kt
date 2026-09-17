package com.sandrconcretecrafts.pos.terminal

import android.app.Application
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import com.sandrconcretecrafts.pos.data.PublicConfig
import com.sandrconcretecrafts.pos.data.SrApi
import com.stripe.stripeterminal.Terminal
import com.stripe.stripeterminal.external.callable.Callback
import com.stripe.stripeterminal.external.callable.Cancelable
import com.stripe.stripeterminal.external.callable.DiscoveryListener
import com.stripe.stripeterminal.external.callable.PaymentIntentCallback
import com.stripe.stripeterminal.external.callable.ReaderCallback
import com.stripe.stripeterminal.external.callable.TapToPayReaderListener
import com.stripe.stripeterminal.external.callable.TerminalListener
import com.stripe.stripeterminal.external.models.CollectPaymentIntentConfiguration
import com.stripe.stripeterminal.external.models.ConfirmPaymentIntentConfiguration
import com.stripe.stripeterminal.external.models.ConnectionConfiguration
import com.stripe.stripeterminal.external.models.ConnectionStatus
import com.stripe.stripeterminal.external.models.DiscoveryConfiguration
import com.stripe.stripeterminal.external.models.PaymentIntent
import com.stripe.stripeterminal.external.models.PaymentStatus
import com.stripe.stripeterminal.external.models.Reader
import com.stripe.stripeterminal.external.models.TapToPayUxConfiguration
import com.stripe.stripeterminal.external.models.TerminalException
import com.stripe.stripeterminal.log.LogLevel
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class TerminalController(
    private val application: Application,
    private val api: SrApi
) {
    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var discoverCancelable: Cancelable? = null
    @Volatile
    private var paymentCancelable: Cancelable? = null
    @Volatile
    private var connecting = false
    @Volatile
    private var discoveryStarted = false
    @Volatile
    private var readerDiscovered = false
    @Volatile
    private var lastSafeError: String? = null

    fun initialize() {
        if (Terminal.isInitialized()) return
        if (Looper.myLooper() == Looper.getMainLooper()) {
            initializeOnMain()
            return
        }
        val latch = CountDownLatch(1)
        var error: Exception? = null
        main.post {
            try {
                initializeOnMain()
            } catch (e: Exception) {
                error = e
            } finally {
                latch.countDown()
            }
        }
        if (!latch.await(20, TimeUnit.SECONDS)) {
            throw IllegalStateException("Tap to Pay SDK did not start.")
        }
        error?.let { throw it }
    }

    fun connect(onReady: () -> Unit, onError: (String) -> Unit) {
        initialize()
        main.post { connectOnMain(onReady, onError) }
    }

    fun collect(
        clientSecret: String,
        onSuccess: (PaymentIntent) -> Unit,
        onError: (String) -> Unit
    ) {
        main.post {
            Terminal.getInstance().retrievePaymentIntent(
                clientSecret,
                object : PaymentIntentCallback {
                    override fun onSuccess(paymentIntent: PaymentIntent) {
                        paymentCancelable = Terminal.getInstance().processPaymentIntent(
                            paymentIntent,
                            CollectPaymentIntentConfiguration.Builder().build(),
                            ConfirmPaymentIntentConfiguration.Builder().build(),
                            object : PaymentIntentCallback {
                                override fun onSuccess(processed: PaymentIntent) {
                                    paymentCancelable = null
                                    onSuccess(processed)
                                }

                                override fun onFailure(e: TerminalException) {
                                    paymentCancelable = null
                                    onError(friendly(e))
                                }
                            }
                        )
                    }

                    override fun onFailure(e: TerminalException) {
                        onError(friendly(e))
                    }
                }
            )
        }
    }

    fun cancel() {
        main.post {
            paymentCancelable?.cancel(noopCallback)
            discoverCancelable?.cancel(noopCallback)
            connecting = false
        }
    }

    private fun initializeOnMain() {
        if (Terminal.isInitialized()) return
        Terminal.init(
            application,
            LogLevel.ERROR,
            SrConnectionTokenProvider(api),
            object : TerminalListener {
                override fun onConnectionStatusChange(status: ConnectionStatus) = Unit
                override fun onPaymentStatusChange(status: PaymentStatus) = Unit
            },
            null
        )
        Terminal.getInstance().setTapToPayUxConfiguration(
            TapToPayUxConfiguration.Builder()
                .colors(
                    TapToPayUxConfiguration.ColorScheme.Builder()
                        .primary(TapToPayUxConfiguration.Color.Value(Color.parseColor("#C45C32")))
                        .success(TapToPayUxConfiguration.Color.Value(Color.parseColor("#3F6B4A")))
                        .error(TapToPayUxConfiguration.Color.Value(Color.parseColor("#9B3A2A")))
                        .build()
                )
                .darkMode(TapToPayUxConfiguration.DarkMode.LIGHT)
                .build()
        )
    }

    private fun connectOnMain(onReady: () -> Unit, onError: (String) -> Unit) {
        if (Terminal.getInstance().connectedReader != null) {
            onReady()
            return
        }
        if (connecting) return
        connecting = true
        discoveryStarted = true
        readerDiscovered = false
        lastSafeError = null
        val config = DiscoveryConfiguration.TapToPayDiscoveryConfiguration(
            isSimulated = useSimulatedReader()
        )
        discoverCancelable = Terminal.getInstance().discoverReaders(
            config,
            object : DiscoveryListener {
                override fun onUpdateDiscoveredReaders(readers: List<Reader>) {
                    val reader = readers.firstOrNull() ?: return
                    readerDiscovered = true
                    connectReader(reader, onReady, onError)
                }
            },
            object : Callback {
                override fun onSuccess() = Unit

                override fun onFailure(e: TerminalException) {
                    connecting = false
                    lastSafeError = friendly(e)
                    onError(lastSafeError ?: friendly(e))
                }
            }
        )
    }

    private fun connectReader(reader: Reader, onReady: () -> Unit, onError: (String) -> Unit) {
        val locationId = try {
            api.locationId()
        } catch (error: Exception) {
            connecting = false
            onError(error.message ?: "Stripe Terminal Location is not configured.")
            return
        }
        val config = ConnectionConfiguration.TapToPayConnectionConfiguration(
            locationId,
            true,
            object : TapToPayReaderListener {}
        )
        Terminal.getInstance().connectReader(
            reader,
            config,
            object : ReaderCallback {
                override fun onSuccess(reader: Reader) {
                    connecting = false
                    onReady()
                }

                override fun onFailure(e: TerminalException) {
                    connecting = false
                    lastSafeError = friendly(e)
                    onError(lastSafeError ?: friendly(e))
                }
            }
        )
    }

    private fun useSimulatedReader(): Boolean {
        // Honor SR_SIMULATED_READER from local.properties. Default remains true.
        // A real Tap-to-Pay test requires an explicit false rebuild — never inferred.
        return PublicConfig.simulatedReader
    }

    fun safeDiagnostics(): String {
        return listOf(
            "Discovery started: ${if (discoveryStarted) "yes" else "no"}",
            "Reader discovered: ${if (readerDiscovered) "yes" else "no"}",
            lastSafeError?.let { "Last Terminal error: $it" }
        ).filterNotNull().joinToString("\n")
    }

    private fun friendly(error: TerminalException): String {
        val message = error.errorMessage.ifBlank { "Tap to Pay couldn’t finish. Please try again." }
        val code = error.errorCode.toString().substringAfterLast('.')
        if (code.isBlank() || message.contains(code)) return message
        return "$message ($code)"
    }

    companion object {
        private val noopCallback = object : Callback {
            override fun onSuccess() = Unit
            override fun onFailure(e: TerminalException) = Unit
        }
    }
}
