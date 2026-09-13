# Keep JavaScript interface methods if any are called from JS
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebKit and WebView classes
-keep class android.webkit.** { *; }
-keep class androidx.webkit.** { *; }
