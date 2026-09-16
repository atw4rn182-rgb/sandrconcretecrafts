package com.sandrconcretecrafts.pos.data

import com.sandrconcretecrafts.pos.BuildConfig

object PublicConfig {
    val apiBaseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/')
    val supabaseUrl: String = BuildConfig.SUPABASE_URL.trimEnd('/')
    val supabaseAnonKey: String = BuildConfig.SUPABASE_ANON_KEY.trim()
    val simulatedReader: Boolean = BuildConfig.SIMULATED_READER

    fun isConfigured(): Boolean {
        return supabaseUrl.isNotBlank() &&
            supabaseAnonKey.isNotBlank() &&
            !supabaseUrl.contains("YOUR_PROJECT_REF") &&
            !supabaseAnonKey.contains("YOUR_SUPABASE_ANON_KEY") &&
            apiBaseUrl.startsWith("https://")
    }
}
