---
date: 2026-09-21
type: devlog
tags:
  - devlog
  - last-mile-game
  - android
ai-first: true
---

# 2026-09-21 - B82 Standalone Android Studio Project Wrapper SDK 35

## Summary
Configured standalone Android Studio project inside `last-mile/android/` with Kotlin 1.9.23, AGP 8.3.2, compileSdk 35, and hardware-accelerated WebKit WebView.

## Key Changes
1. **Hardware Acceleration**:
   - `setLayerType(View.LAYER_TYPE_HARDWARE, null)` for 60 FPS WebGL rendering.
2. **Offline Asset Serving**:
   - Integrated `WebViewAssetLoader` to serve models, audio, and scripts securely from `app/src/main/assets/`.
3. **Fullscreen & WakeLock**:
   - Immersive sticky mode with display cutout handling and screen keep-alive flag.
4. **Asset Sync Pipeline**:
   - Created `sync_android_assets.sh` for one-command bundle replication from web source.

## Links
- [[Projects/Last-Mile Game]]
- [[Architecture/AndroidStudioBridge]]
