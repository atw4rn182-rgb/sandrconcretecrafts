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
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class TerminalController(
    private val application: Application,
    private val api: SrApi
) {
    enum class TokenStatus { Idle, Requested, Received, Failed }
    enum class DiscoveryStatus { Idle, Starting, Searching, ReaderFound, Failed }
    enum class ConnectionPhase { Idle, Connecting, Connected, Failed }
    enum class TerminalStatus { Idle, Initializing, Initialized, Failed }

    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()

    @Volatile
    private var discoverCancelable: Cancelable? = null
    @Volatile
    private var paymentCancelable: Cancelable? = null
    @Volatile
    private var connecting = false
    @Volatile
    var terminalStatus: TerminalStatus = TerminalStatus.Idle
        private set
    @Volatile
    var tokenStatus: TokenStatus = TokenStatus.Idle
        private set
    @Volatile
    var discoveryStatus: DiscoveryStatus = DiscoveryStatus.Idle
        private set
    @Volatile
    var connectionStatus: ConnectionPhase = ConnectionPhase.Idle
        private set
    @Volatile
    var lastSafeError: String? = null
        private set

    private val readerClaimed = AtomicBoolean(false)
    private var phaseListener: ((String) -> Unit)? = null

    fun connect(onPhase: (String) -> Unit, onReady: () -> Unit, onError: (String) -> Unit) {
        phaseListener = onPhase
        if (Terminal.isInitialized()) {
            val reader = runCatching { Terminal.getInstance().connectedReader }.getOrNull()
            if (reader != null) {
                terminalStatus = TerminalStatus.Initialized
                connectionStatus = ConnectionPhase.Connected
                discoveryStatus = DiscoveryStatus.ReaderFound
                onPhase("Reader already connected")
                onReady()
                return
            }
        }
        if (connecting) return
        connecting = true
        lastSafeError = null
        readerClaimed.set(false)
        io.execute {
            try {
                terminalStatus = TerminalStatus.Initializing
                notifyPhase("Initializing Stripe Terminal")
                initialize()
                terminalStatus = TerminalStatus.Initialized
                notifyPhase("Stripe Terminal initialized")
                notifyPhase("Loading Terminal location")
                val locationId = api.refreshTerminalLocation()
                main.post { startDiscovery(locationId, onReady, onError) }
            } catch (error: Exception) {
                connecting = false
                terminalStatus = TerminalStatus.Failed
                lastSafeError = error.message
                onError(error.message ?: "Tap to Pay SDK did not start.")
            }
        }
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
            discoverCancelable = null
            connecting = false
            readerClaimed.set(false)
        }
    }

    fun initialize() {
        if (Terminal.isInitialized()) {
            terminalStatus = TerminalStatus.Initialized
            return
        }
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

    private fun initializeOnMain() {
        if (Terminal.isInitialized()) {
            terminalStatus = TerminalStatus.Initialized
            return
        }
        Terminal.init(
            application,
            LogLevel.ERROR,
            SrConnectionTokenProvider(api) { phase ->
                tokenStatus = when (phase) {
                    SrConnectionTokenProvider.Phase.Requested -> TokenStatus.Requested
                    SrConnectionTokenProvider.Phase.Received -> TokenStatus.Received
                    SrConnectionTokenProvider.Phase.Failed -> TokenStatus.Failed
                }
                notifyPhase(
                    when (phase) {
                        SrConnectionTokenProvider.Phase.Requested -> "Connection token requested"
                        SrConnectionTokenProvider.Phase.Received -> "Connection token received"
                        SrConnectionTokenProvider.Phase.Failed -> "Connection token failed"
                    }
                )
            },
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
        terminalStatus = TerminalStatus.Initialized
    }

    private fun startDiscovery(locationId: String, onReady: () -> Unit, onError: (String) -> Unit) {
        if (runCatching { Terminal.getInstance().connectedReader }.getOrNull() != null) {
            connectionStatus = ConnectionPhase.Connected
            connecting = false
            onReady()
            return
        }
        if (discoverCancelable != null) return
        discoveryStatus = DiscoveryStatus.Starting
        notifyPhase("Starting simulated reader discovery")
        val config = DiscoveryConfiguration.TapToPayDiscoveryConfiguration(
            isSimulated = useSimulatedReader()
        )
        discoveryStatus = DiscoveryStatus.Searching
        notifyPhase("Searching for simulated Tap to Pay reader")
        discoverCancelable = Terminal.getInstance().discoverReaders(
            config,
            object : DiscoveryListener {
                override fun onUpdateDiscoveredReaders(readers: List<Reader>) {
                    val reader = readers.firstOrNull() ?: return
                    if (!readerClaimed.compareAndSet(false, true)) return
                    discoveryStatus = DiscoveryStatus.ReaderFound
                    notifyPhase("Simulated reader found")
                    connectReader(reader, locationId, onReady, onError)
                }
            },
            object : Callback {
                override fun onSuccess() = Unit

                override fun onFailure(e: TerminalException) {
                    connecting = false
                    discoverCancelable = null
                    discoveryStatus = DiscoveryStatus.Failed
                    lastSafeError = friendly(e)
                    onError(lastSafeError ?: friendly(e))
                }
            }
        )
    }

    private fun connectReader(
        reader: Reader,
        locationId: String,
        onReady: () -> Unit,
        onError: (String) -> Unit
    ) {
        connectionStatus = ConnectionPhase.Connecting
        notifyPhase("Connecting simulated reader")
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
                    discoverCancelable = null
                    connectionStatus = ConnectionPhase.Connected
                    notifyPhase("Simulated reader connected")
                    onReady()
                }

                override fun onFailure(e: TerminalException) {
                    connecting = false
                    readerClaimed.set(false)
                    connectionStatus = ConnectionPhase.Failed
                    lastSafeError = friendly(e)
                    onError(lastSafeError ?: friendly(e))
                }
            }
        )
    }

    private fun useSimulatedReader(): Boolean {
        return PublicConfig.simulatedReader
    }

    fun safeDiagnostics(): String {
        return listOf(
            "Terminal: ${label(terminalStatus)}",
            "Connection token: ${label(tokenStatus)}",
            "Reader discovery: ${label(discoveryStatus)}",
            "Reader connection: ${label(connectionStatus)}",
            lastSafeError?.let { "Last error: $it" }
        ).filterNotNull().joinToString("\n")
    }

    private fun notifyPhase(message: String) {
        val listener = phaseListener ?: return
        if (Looper.myLooper() == Looper.getMainLooper()) listener(message)
        else main.post { listener(message) }
    }

    private fun label(status: Enum<*>): String {
        return when (status.name) {
            "Idle" -> "Idle"
            "Initializing" -> "Initializing"
            "Initialized" -> "Initialized"
            "Requested" -> "Requested"
            "Received" -> "Received"
            "Starting" -> "Starting"
            "Searching" -> "Searching"
            "ReaderFound" -> "Reader found"
            "Connecting" -> "Connecting"
            "Connected" -> "Connected"
            "Failed" -> "Failed"
            else -> status.name
        }
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
