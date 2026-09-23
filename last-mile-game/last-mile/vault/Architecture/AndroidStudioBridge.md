---
date: 2026-09-22
type: architecture
tags:
  - architecture
  - last-mile-game
  - android
  - native
ai-first: true
---

# Android Studio Bridge & Native Shell (`last-mile/android/`)

## For future agent
Architecture documentation for the standalone native Android Studio wrapper project in `last-mile/android/`. Reference this before modifying Gradle dependencies, AndroidManifest properties, or WebKit WebView bridge settings.

## Overview
The Android application wrapper packages the Three.js web game into a standalone native Android app targeting Google Play Store release.

## Technical Specifications
- **Gradle Plugin**: AGP 8.3.2
- **Kotlin**: 1.9.23
- **compileSdk / targetSdk**: 35 (Android 15 compliant for Google Play Store requirements)
- **minSdk**: 26 (Android 8.0 Oreo)
- **Hardware Acceleration**: Explicitly enabled on WebView (`setLayerType(View.LAYER_TYPE_HARDWARE, null)`).
- **Fullscreen Immersive Sticky Mode**: Edge-to-edge rendering hiding navigation and status bars with cutout/notch support.
- **WakeLock**: `FLAG_KEEP_SCREEN_ON` enabled to prevent screen timeout while driving.

## Offline Asset Pipeline (`sync_android_assets.sh`)
- All game bundles (`game.js`, `save.js`, `index.html`, `style.css`, 3D GLB models, textures, audio) are hosted locally inside `app/src/main/assets/`.
- `WebViewAssetLoader` intercepts requests to `https://appassets.androidplatform.net/assets/` and serves local files securely with 0 network latency.
- Fast synchronization script:
```bash
./sync_android_assets.sh
```

## Links
- [[Projects/Last-Mile Game]]
- [[Dev Logs/2026-09-21 - B82 Standalone Android Studio Project Wrapper SDK 35]]
