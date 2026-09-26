---
date: 2026-09-23
type: dev-log
tags:
  - dev-log
  - bugfix
  - android
  - webview
  - performance
---

# 2026-09-23 - B105 Android Performance and Remote Debugging

## Summary
The game ran very slowly in the Android emulator. Most of that came from the emulator itself, which wasn't using the computer's graphics card. The app also had a setting that added extra rendering work on every frame; removing it makes the app faster everywhere. Debug builds can now be inspected from Chrome's developer tools.

For realistic frame rates, test on a real phone or set the emulator to use the host graphics card. On low-end devices, the Classic visual style is the lightest option.

## Links
- [[Projects/Last-Mile Game]]
