package com.sandrconcretecrafts.pos.data

import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class SrApi(private val session: SessionStore) {
    data class TerminalToken(val locationId: String)
    data class PaymentSession(
        val orderId: String,
        val paymentIntentId: String,
        val clientSecret: String,
        val amount: Int
    )

    fun login(email: String, password: String) {
        val body = JSONObject()
            .put("email", email.trim())
            .put("password", password)
        val token = postJson(
            "${PublicConfig.supabaseUrl}/auth/v1/token?grant_type=password",
            body,
            mapOf(
                "apikey" to PublicConfig.supabaseAnonKey,
                "Authorization" to "Bearer ${PublicConfig.supabaseAnonKey}"
            )
        )
        saveSession(token)
        requireActiveAdmin()
    }

    fun requireActiveAdmin() {
        val userId = session.userId ?: throw IllegalStateException("Sign in required.")
        val url =
            "${PublicConfig.supabaseUrl}/rest/v1/admin_users?select=user_id,active,role&user_id=eq.$userId&active=eq.true&limit=1"
        val rows = getJsonArray(
            url,
            mapOf(
                "apikey" to PublicConfig.supabaseAnonKey,
                "Authorization" to "Bearer ${session.accessToken}"
            )
        )
        if (rows.length() < 1) {
            session.clear()
            throw IllegalStateException("Active admin access is required.")
        }
    }

    fun fetchConnectionToken(): String {
        val pair = requestConnectionToken()
        lastLocationId = pair.locationId
        return pair.secret
    }

    fun refreshTerminalLocation(): String {
        val pair = requestConnectionToken()
        lastLocationId = pair.locationId
        return pair.locationId
    }

    fun createPaymentIntent(sale: JSONObject): PaymentSession {
        requireActiveAdmin()
        val json = postJson(
            "${PublicConfig.apiBaseUrl}/api/admin/terminal/payment-intent",
            sale,
            adminHeaders()
        )
        val secret = json.optString("client_secret")
        val orderId = json.optString("order_id")
        val intentId = json.optString("payment_intent_id")
        val amount = json.optInt("amount")
        if (secret.isBlank() || orderId.isBlank() || !intentId.startsWith("pi_") || amount < 1) {
            throw IllegalStateException("Couldn’t prepare the Terminal payment.")
        }
        return PaymentSession(orderId, intentId, secret, amount)
    }

    fun locationId(): String {
        return lastLocationId ?: throw IllegalStateException("Connect a Terminal session first.")
    }

    fun awaitLocationId(timeoutMs: Long = 20000): String {
        lastLocationId?.let { return it }
        return refreshTerminalLocation()
    }

    private data class ConnectionTokenPair(val secret: String, val locationId: String)

    private fun requestConnectionToken(): ConnectionTokenPair {
        requireActiveAdmin()
        val json = postJson(
            "${PublicConfig.apiBaseUrl}/api/admin/terminal/connection-token",
            JSONObject(),
            adminHeaders()
        )
        val secret = json.optString("secret")
        val locationId = json.optString("location_id")
        if (secret.isBlank()) throw IllegalStateException("Stripe returned no connection token.")
        if (!locationId.startsWith("tml_")) {
            throw IllegalStateException("Stripe Terminal Location is not configured on the server.")
        }
        return ConnectionTokenPair(secret, locationId)
    }

    private fun adminHeaders(): Map<String, String> {
        val token = session.accessToken ?: throw IllegalStateException("Sign in required.")
        return mapOf(
            "Authorization" to "Bearer $token",
            "Content-Type" to "application/json"
        )
    }

    private fun saveSession(token: JSONObject) {
        val access = token.optString("access_token")
        val refresh = token.optString("refresh_token")
        val user = token.optJSONObject("user")
        val id = user?.optString("id").orEmpty()
        if (access.isBlank() || id.isBlank()) {
            throw IllegalStateException("Couldn’t sign in.")
        }
        session.accessToken = access
        session.refreshToken = refresh
        session.userId = id
    }

    private fun postJson(url: String, body: JSONObject, headers: Map<String, String>): JSONObject {
        val connection = open(url, "POST", headers)
        OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }
        return readObject(connection)
    }

    private fun getJsonArray(url: String, headers: Map<String, String>): JSONArray {
        val connection = open(url, "GET", headers)
        val text = readText(connection)
        return JSONArray(text)
    }

    private fun open(url: String, method: String, headers: Map<String, String>): HttpURLConnection {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 20000
        connection.readTimeout = 20000
        connection.doInput = true
        if (method == "POST") connection.doOutput = true
        headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }
        if (!connection.requestProperties.containsKey("Content-Type") && method == "POST") {
            connection.setRequestProperty("Content-Type", "application/json")
        }
        return connection
    }

    private fun readObject(connection: HttpURLConnection): JSONObject {
        val text = readText(connection)
        return JSONObject(if (text.isBlank()) "{}" else text)
    }

    private fun readText(connection: HttpURLConnection): String {
        val stream = if (connection.responseCode >= 400) connection.errorStream else connection.inputStream
        val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
        if (connection.responseCode >= 400) {
            val json = runCatching { JSONObject(text) }.getOrNull()
            val message = json?.optString("error").orEmpty().ifBlank {
                "Request failed (${connection.responseCode})."
            }
            throw IllegalStateException(message)
        }
        return text
    }

    companion object {
        @Volatile
        private var lastLocationId: String? = null
    }
}
