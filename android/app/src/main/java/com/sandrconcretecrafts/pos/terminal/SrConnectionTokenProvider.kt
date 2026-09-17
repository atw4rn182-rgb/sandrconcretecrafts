package com.sandrconcretecrafts.pos.terminal

import com.sandrconcretecrafts.pos.data.SrApi
import com.stripe.stripeterminal.external.callable.ConnectionTokenCallback
import com.stripe.stripeterminal.external.callable.ConnectionTokenProvider
import com.stripe.stripeterminal.external.models.ConnectionTokenException
import java.util.concurrent.Executors

class SrConnectionTokenProvider(
    private val api: SrApi,
    private val onPhase: (Phase) -> Unit = {}
) : ConnectionTokenProvider {
    enum class Phase { Requested, Received, Failed }

    private val io = Executors.newSingleThreadExecutor()

    override fun fetchConnectionToken(callback: ConnectionTokenCallback) {
        onPhase(Phase.Requested)
        io.execute {
            try {
                val secret = api.fetchConnectionToken()
                onPhase(Phase.Received)
                callback.onSuccess(secret)
            } catch (error: Exception) {
                onPhase(Phase.Failed)
                callback.onFailure(
                    ConnectionTokenException(
                        error.message ?: "Couldn’t create a Terminal connection token.",
                        error
                    )
                )
            }
        }
    }
}
