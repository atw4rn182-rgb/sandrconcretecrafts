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
    @Volatile
    var lastStage: String = "idle"
        private set
    @Volatile
    var lastErrorCode: String? = null
        private set
    @Volatile
    var backendLivemode: Boolean? = null
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
        lastErrorCode = null
        lastStage = "permission-check"
        readerClaimed.set(false)
        io.execute {
            try {
                lastStage = "terminal-init"
                terminalStatus = TerminalStatus.Initializing
                notifyPhase("Initializing Stripe Terminal")
                initialize()
                terminalStatus = TerminalStatus.Initialized
                notifyPhase("Stripe Terminal initialized")
                lastStage = "connection-token"
                notifyPhase("Requesting connection token")
                val session = api.refreshTerminalSession()
                backendLivemode = session.livemode
                tokenStatus = TokenStatus.Received
                if (useSimulatedReader() && session.livemode == true) {
                    connecting = false
                    terminalStatus = TerminalStatus.Failed
                    lastErrorCode = "TERMINAL_MODE_MISMATCH"
                    lastSafeError =
                        "Stage: connection-token\nTERMINAL_MODE_MISMATCH\nThis TEST APK is simulated only. The Terminal backend is LIVE. Online Checkout was not changed. Stop and use a TEST Terminal key/location/webhook for simulation."
                    onError(lastSafeError ?: "Terminal mode mismatch.")
                    return@execute
                }
                lastStage = "reader-discovery"
                main.post { startDiscovery(session.locationId, onReady, onError) }
            } catch (error: Exception) {
                connecting = false
                terminalStatus = TerminalStatus.Failed
                lastSafeError = sanitize(error.message ?: "Tap to Pay SDK did not start.")
                lastErrorCode = lastErrorCode ?: "INIT_FAILED"
                onError(formatError(lastStage, lastErrorCode, lastSafeError))
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
        if (discoverCancelable != null) {
            discoverCancelable?.cancel(noopCallback)
            discoverCancelable = null
        }
        lastStage = "reader-discovery"
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
                    lastStage = "reader-discovery"
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
        lastStage = "reader-connection"
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
                    lastStage = "reader-connection"
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
            "Stage: $lastStage",
            "Terminal initialized: ${if (terminalStatus == TerminalStatus.Initialized) "yes" else "no"}",
            "Terminal backend: ${backendLabel()}",
            "Connection token: ${label(tokenStatus)}",
            "Reader discovery: ${label(discoveryStatus)}",
            "Reader connection: ${label(connectionStatus)}",
            lastErrorCode?.let { "Last error code: $it" },
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

    private fun backendLabel(): String {
        return when (backendLivemode) {
            true -> "LIVE"
            false -> "TEST"
            null -> "unknown"
        }
    }

    private fun friendly(error: TerminalException): String {
        val code = error.errorCode.toString().substringAfterLast('.')
        lastErrorCode = code.ifBlank { "TERMINAL_EXCEPTION" }
        val message = sanitize(
            error.errorMessage.ifBlank { "Tap to Pay couldn’t finish. Please try again." }
        )
        return formatError(lastStage, lastErrorCode, message)
    }

    private fun formatError(stage: String, code: String?, message: String?): String {
        return listOfNotNull(
            "Stage: $stage",
            code?.takeIf { it.isNotBlank() },
            message?.takeIf { it.isNotBlank() }
        ).joinToString("\n")
    }

    private fun sanitize(raw: String): String {
        return raw
            .replace(Regex("(?i)(sk|rk|whsec|pst|pi|tml|eyJ)[_A-Za-z0-9\\-]{8,}"), "[redacted]")
            .replace(Regex("(?i)(client_secret|Bearer)\\s+[A-Za-z0-9_\\-\\.]+"), "[redacted]")
    }

    companion object {
        private val noopCallback = object : Callback {
            override fun onSuccess() = Unit
            override fun onFailure(e: TerminalException) = Unit
        }
    }
}
