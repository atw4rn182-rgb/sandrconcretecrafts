package com.sandrconcretecrafts.pos.setup

import android.content.Context

/**
 * Remembers first-launch welcome and a completed setup pass.
 * Does not store tokens or secrets. Permissions are always re-checked live.
 */
class SetupStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    var welcomeSeen: Boolean
        get() = prefs.getBoolean(WELCOME, false)
        set(value) {
            prefs.edit().putBoolean(WELCOME, value).apply()
        }

    var completedOnce: Boolean
        get() = prefs.getBoolean(COMPLETED, false)
        set(value) {
            prefs.edit().putBoolean(COMPLETED, value).apply()
        }

    companion object {
        private const val PREFS = "sr_pos_setup"
        private const val WELCOME = "welcome_seen"
        private const val COMPLETED = "completed_once"
    }
}
