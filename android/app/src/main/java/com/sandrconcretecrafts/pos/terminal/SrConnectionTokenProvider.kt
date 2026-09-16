package com.sandrconcretecrafts.pos.terminal

import com.sandrconcretecrafts.pos.data.SrApi
import com.stripe.stripeterminal.external.callable.ConnectionTokenCallback
import com.stripe.stripeterminal.external.callable.ConnectionTokenProvider
import com.stripe.stripeterminal.external.models.ConnectionTokenException

class SrConnectionTokenProvider(
    private val api: SrApi
) : ConnectionTokenProvider {
    override fun fetchConnectionToken(callback: ConnectionTokenCallback) {
        try {
            val secret = api.fetchConnectionToken()
            callback.onSuccess(secret)
        } catch (error: Exception) {
            callback.onFailure(
                ConnectionTokenException(
                    error.message ?: "Couldn’t create a Terminal connection token.",
                    error
                )
            )
        }
    }
}
