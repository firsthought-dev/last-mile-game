package com.shiplyp.lastmile

import android.util.Log
import android.webkit.JavascriptInterface

/**
 * Receives gameplay events from the page (telemetry.js picks this up as
 * window.ShiplypNativeTelemetry). For now it only writes debug logcat lines.
 * When Firebase is added, the analytics call goes where the log call is.
 *
 * addJavascriptInterface exposes this to every frame in the WebView, so the
 * method accepts only the known event names and short payloads.
 */
class TelemetryBridge {

    @JavascriptInterface
    fun logEvent(name: String?, json: String?) {
        if (name == null || json == null) return
        if (name !in ALLOWED_EVENTS || json.length > MAX_JSON) return
        if (BuildConfig.DEBUG) Log.i(TAG, "$name $json")
    }

    companion object {
        const val JS_NAME = "ShiplypNativeTelemetry"
        private const val TAG = "ShiplypTelemetry"
        private const val MAX_JSON = 1000

        // Keep in step with SCHEMA in telemetry.js.
        private val ALLOWED_EVENTS = setOf(
            "app_open", "shift_start", "order_complete", "order_fail",
            "session_end", "unlock", "first_open_to_first_order", "fps_sample"
        )
    }
}
