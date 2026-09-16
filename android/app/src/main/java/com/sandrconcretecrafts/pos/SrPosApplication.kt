package com.sandrconcretecrafts.pos

import android.app.Application
import com.stripe.stripeterminal.TerminalApplicationDelegate
import com.stripe.stripeterminal.taptopay.TapToPay

class SrPosApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (TapToPay.isInTapToPayProcess()) return
        TerminalApplicationDelegate.onCreate(this)
    }
}
