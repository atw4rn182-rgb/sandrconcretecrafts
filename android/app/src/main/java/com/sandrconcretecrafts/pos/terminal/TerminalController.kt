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
import com.stripe.stripeterminal.external.models.DeviceType
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
                EventTrace.add("READER_CONNECT_SUCCESS already_connected=true")
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
                EventTrace.add("TERMINAL_INIT_START")
                notifyPhase(phaseCopy("Initializing Stripe Terminal", "INITIALIZING TAP TO PAY"))
                initialize()
                terminalStatus = TerminalStatus.Initialized
                EventTrace.add("TERMINAL_INIT_SUCCESS")
                notifyPhase(phaseCopy("Stripe Terminal initialized", "INITIALIZING TAP TO PAY"))
                lastStage = "connection-token"
                EventTrace.add("CONNECTION_TOKEN_REQUEST_START")
                notifyPhase(phaseCopy("Requesting connection token", "CONNECTING"))
                val session = api.refreshTerminalSession()
                backendLivemode = session.livemode
                tokenStatus = TokenStatus.Received
                EventTrace.add("CONNECTION_TOKEN_SUCCESS backend=${if (session.livemode == true) "LIVE" else if (session.livemode == false) "TEST" else "unknown"}")
                if (useSimulatedReader() && session.livemode == true) {
                    connecting = false
                    terminalStatus = TerminalStatus.Failed
                    lastErrorCode = "TERMINAL_MODE_MISMATCH"
                    EventTrace.add("TERMINAL_MODE_MISMATCH backend=LIVE")
                    EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.TERMINAL_MODE_GATE}")
                    lastSafeError =
                        "SOURCE: ${ErrorSource.TERMINAL_MODE_GATE}\nStage: connection-token\nTERMINAL_MODE_MISMATCH\nThis TEST APK is simulated only. The Terminal backend is LIVE. Online Checkout was not changed. Stop and use a TEST Terminal key/location/webhook for simulation."
                    onError(lastSafeError ?: "Terminal mode mismatch.")
                    return@execute
                }
                if (!useSimulatedReader() && session.livemode == false) {
                    connecting = false
                    terminalStatus = TerminalStatus.Failed
                    lastErrorCode = "TERMINAL_MODE_MISMATCH"
                    EventTrace.add("TERMINAL_MODE_MISMATCH backend=TEST")
                    EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.TERMINAL_MODE_GATE}")
                    lastSafeError =
                        "SOURCE: ${ErrorSource.TERMINAL_MODE_GATE}\nStage: connection-token\nTERMINAL_MODE_MISMATCH\nThis production app requires a LIVE Terminal backend. The backend is TEST. Online Checkout was not changed."
                    onError(lastSafeError ?: "Terminal mode mismatch.")
                    return@execute
                }
                lastStage = "device-support"
                notifyPhase(phaseCopy("Checking Tap to Pay support", "CONNECTING"))
                assertTapToPaySupported()
                lastStage = "reader-discovery"
                main.post { startDiscovery(session.locationId, onReady, onError) }
            } catch (error: Exception) {
                connecting = false
                terminalStatus = TerminalStatus.Failed
                if (lastStage == "connection-token") {
                    EventTrace.add("CONNECTION_TOKEN_ERROR")
                } else {
                    EventTrace.add("TERMINAL_INIT_ERROR class=${error.javaClass.simpleName}")
                }
                if (error is TerminalException) {
                    onError(formatStripeError(lastStage, error))
                } else {
                    lastSafeError = sanitize(error.message ?: "Tap to Pay SDK did not start.")
                    lastErrorCode = lastErrorCode ?: "INIT_FAILED"
                    onError(formatStripeError(lastStage, lastErrorCode, lastSafeError))
                }
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
        EventTrace.add("DISCOVERY_START method=TapToPayDiscoveryConfiguration simulated=${useSimulatedReader()}")
        notifyPhase(phaseCopy("Starting simulated reader discovery", "CONNECTING"))
        val config = DiscoveryConfiguration.TapToPayDiscoveryConfiguration(
            isSimulated = useSimulatedReader()
        )
        if (!useSimulatedReader() && config.isSimulated) {
            connecting = false
            discoveryStatus = DiscoveryStatus.Failed
            lastErrorCode = "SIMULATED_READER_FORBIDDEN"
            onError("SOURCE: ANDROID_PERMISSION_CHECK\nBLOCKED STAGE: READER_DISCOVERY\nProduction cannot use a simulated reader.")
            return
        }
        discoveryStatus = DiscoveryStatus.Searching
        notifyPhase(phaseCopy("Searching for simulated Tap to Pay reader", "CONNECTING"))
        discoverCancelable = Terminal.getInstance().discoverReaders(
            config,
            object : DiscoveryListener {
                override fun onUpdateDiscoveredReaders(readers: List<Reader>) {
                    EventTrace.add("DISCOVERY_SUCCESS reader_count=${readers.size}")
                    val reader = readers.firstOrNull() ?: return
                    if (!readerClaimed.compareAndSet(false, true)) return
                    discoveryStatus = DiscoveryStatus.ReaderFound
                    notifyPhase(phaseCopy("Simulated reader found", "CONNECTING"))
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
                    EventTrace.add("DISCOVERY_ERROR code=${e.errorCode}")
                    EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.STRIPE_SDK}")
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
        EventTrace.add("READER_CONNECT_START")
        notifyPhase(phaseCopy("Connecting simulated reader", "CONNECTING"))
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
                    EventTrace.add("READER_CONNECT_SUCCESS")
                    notifyPhase(phaseCopy("Simulated reader connected", "READY"))
                    onReady()
                }

                override fun onFailure(e: TerminalException) {
                    connecting = false
                    readerClaimed.set(false)
                    connectionStatus = ConnectionPhase.Failed
                    lastStage = "reader-connection"
                    EventTrace.add("READER_CONNECT_ERROR code=${e.errorCode}")
                    EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.STRIPE_SDK}")
                    lastSafeError = friendly(e)
                    onError(lastSafeError ?: friendly(e))
                }
            }
        )
    }

    private fun useSimulatedReader(): Boolean {
        return PublicConfig.simulatedReader
    }

    private fun phaseCopy(test: String, production: String): String {
        return if (useSimulatedReader()) test else production
    }

    private fun assertTapToPaySupported() {
        val config = DiscoveryConfiguration.TapToPayDiscoveryConfiguration(
            isSimulated = useSimulatedReader()
        )
        val result = Terminal.getInstance().supportsReadersOfType(
            DeviceType.TAP_TO_PAY_DEVICE,
            config
        )
        if (result.isSupported) {
            EventTrace.add("DEVICE_SUPPORT=SUPPORTED")
            return
        }
        EventTrace.add("DEVICE_SUPPORT=UNSUPPORTED")
        val error = result.error
        if (error != null) throw error
        throw IllegalStateException("This phone is not supported for Tap to Pay.")
    }

    fun safeDiagnostics(): String {
        return listOf(
            "Stage: $lastStage",
            "Terminal initialized: ${if (terminalStatus == TerminalStatus.Initialized) "yes" else "no"}",
            "BACKEND: ${backendLabel()}",
            "CONNECTION TOKEN: ${connectionTokenLabel()}",
            "Reader discovery: ${label(discoveryStatus)}",
            "Reader connection: ${label(connectionStatus)}",
            lastErrorCode?.let { "Last error code: $it" },
            lastSafeError?.let { "Last error: $it" }
        ).filterNotNull().joinToString("\n")
    }

    private fun connectionTokenLabel(): String {
        return when (tokenStatus) {
            TokenStatus.Received -> "SUCCESS"
            TokenStatus.Failed -> "FAILED"
            TokenStatus.Requested -> "REQUESTED"
            TokenStatus.Idle -> "IDLE"
        }
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
        return formatStripeError(lastStage, error)
    }

    private fun formatStripeError(stage: String, error: TerminalException): String {
        val code = error.errorCode.toString().substringAfterLast('.').ifBlank { "TERMINAL_EXCEPTION" }
        val message = sanitize(
            error.errorMessage.ifBlank { "Tap to Pay couldn’t finish. Please try again." }
        )
        return formatStripeError(stage, code, message)
    }

    private fun formatStripeError(stage: String, code: String?, message: String?): String {
        lastErrorCode = code
        lastSafeError = message
        val blocked = when (stage) {
            "terminal-init", "permission-check" -> "TERMINAL_INIT"
            "connection-token" -> "SERVER_CONNECTION_TOKEN"
            "reader-discovery" -> "READER_DISCOVERY"
            "reader-connection" -> "READER_CONNECTION"
            else -> stage
        }
        EventTrace.add("UI_ERROR_SOURCE=${ErrorSource.STRIPE_SDK} stage=$blocked")
        return listOfNotNull(
            "SOURCE: ${ErrorSource.STRIPE_SDK}",
            "BLOCKED STAGE: $blocked",
            "ERROR CODE: ${code ?: "unknown"}",
            "ERROR CLASS: TerminalException",
            "STRIPE MESSAGE: ${message ?: "Tap to Pay couldn’t finish."}",
            "SDK: ${TerminalPermissions.STRIPE_SDK_VERSION}"
        ).joinToString("\n")
    }

    private fun formatError(stage: String, code: String?, message: String?): String {
        return formatStripeError(stage, code, message)
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
