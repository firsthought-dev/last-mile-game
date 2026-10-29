# Keep JavaScript interface methods: the page calls them by name, and R8 would
# otherwise rename or drop methods that no Kotlin code calls.
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
# The telemetry bridge, by name, so a rename of the class cannot go unnoticed.
-keepclassmembers class com.shiplyp.lastmile.TelemetryBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebKit and WebView classes
-keep class android.webkit.** { *; }
-keep class androidx.webkit.** { *; }
