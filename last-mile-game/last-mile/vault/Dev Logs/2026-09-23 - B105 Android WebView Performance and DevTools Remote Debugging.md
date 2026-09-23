---
date: 2026-09-23
type: dev-log
tags:
  - dev-log
  - bugfix
  - android
  - webview
  - performance
ai-first: true
---

# 2026-09-23 - B105 Android WebView Performance and DevTools Remote Debugging

## Context
When running the Shiplyp Android Studio project (`last-mile/android/`) on an Android Virtual Device (AVD), the game rendered at an extremely low framerate (~1.5 FPS), skipping 38–44 Choreographer frames per second.

## Investigation & Root Causes
1. **CPU Software Rasterizer (SwiftShader)**:
   Inspection via `adb shell dumpsys SurfaceFlinger` revealed the emulator's OpenGL ES driver was:
   `GLES: Google, Android Emulator OpenGL ES Translator (ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)), SwiftShader driver-5.0.0))`
   The AVD (`Pixel_10` running `android-37.2` 16KB experimental system image with `hw.gpu.mode=auto`) failed to bind macOS host GPU (Metal) and fell back to CPU LLVM emulation.
2. **Redundant Layer Type Overhead**:
   `MainActivity.kt` called `setLayerType(View.LAYER_TYPE_HARDWARE, null)` on the `WebView`. Android WebViews composite directly into hardware-accelerated windows; forcing an explicit hardware layer allocated an unnecessary offscreen FBO backing texture, forcing a redundant blit on every frame.
3. **No DevTools Inspection**:
   `WebView.setWebContentsDebuggingEnabled(true)` was not configured, preventing engineers from using Chrome DevTools (`chrome://inspect`) to inspect WebGL performance, logs, or frame execution.

## Fixes Implemented
1. **Optimized `MainActivity.kt`**:
   - Removed `setLayerType(View.LAYER_TYPE_HARDWARE, null)`.
   - Added `if (BuildConfig.DEBUG) { WebView.setWebContentsDebuggingEnabled(true) }` to expose the `@webview_devtools_remote` debugging socket.
2. **Gradle Wrapper (`./gradlew`) Generation**:
   - Generated standard `./gradlew` script in `last-mile/android/` using Gradle 8.4.
3. **Rebuilt & Installed APK**:
   - Executed `./gradlew assembleDebug` and deployed via `adb install -r`.
   - Verified `@webview_devtools_remote` active via ADB.

## Recommendations for Full 60 FPS
1. **Real Physical Android Device**: Test on physical hardware connected via USB/Wi-Fi ADB where native Adreno/Mali GPU hardware acceleration is active.
2. **AVD Graphics Configuration**: Set **Graphics: Hardware - GLES 2.0** (Host GPU) in Android Studio Device Manager, or use a stable Android 14/15 (API 34/35) system image.
3. **Classic Style**: In resource-constrained environments, use the "Classic" visual mode (single-pass retro pixelation without normals pre-pass or bloom).
