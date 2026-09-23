---
date: 2026-09-23
type: devlog
tags:
  - devlog
  - monetization
  - ads
  - web-portals
  - packaging
  - distribution
ai-first: true
task: B94
status: completed
---

# 2026-09-23 — B94 Web Portal Ad SDK Integration & Distribution Packaging

## 🎯 Executive Summary
Following the [[Knowledge/Anul Agarwal AI Game Dev & Multiplatform Publishing Blueprint|Anul Agarwal Multiplatform Publishing Blueprint]] and the [[Boards/Engineering|Engineering Roadmap]], implemented a production-grade, multi-network HTML5 Web Portal Ad SDK adapter (`last-mile/ads.js`) and a zero-friction distribution packager (`last-mile/package_web_portal.sh`). The game now supports GameDistribution (`gdsdk`), CrazyGames SDK (`CrazyGames.SDK`), Poki SDK (`PokiSDK`), and intelligent offline/ad-blocker mock fallback. Rewarded video ad placements provide high-value economy rewards (2x Shift Earnings bonus and ₹500 Dispatch Hub Sponsor cash) directly wired to the persistent career wallet (`Career.credit`).

---

## 🛠️ Systems Implemented

### 1. Unified Ad SDK Adapter (`last-mile/ads.js`)
- **Auto-Detection**: Dynamically checks window environment for GameDistribution (`window.gdsdk`), CrazyGames (`window.CrazyGames.SDK`), Poki (`window.PokiSDK`), or defaults to simulated Mock mode.
- **Strict Invariants**:
  - Never throws unhandled exceptions; ad network errors or ad-blockers never soft-lock game loops.
  - Rate limits interstitials with `minInterstitialIntervalMs = 90000` (90s).
  - Synchronously coordinates game state: pauses physics/timers during ads via `_adPaused` and mutes audio via `sound.mute()` / `sound.unmute()`.
- **Platform Lifecycle Hooks**: Dispatches `gameplayStart()`, `gameplayStop()`, and `happyTime()` (on 3-star delivery completion) across partner SDKs.

### 2. Rewarded Economy Mechanics
- **Shift Milestone 2x Payout**: Added high-impact arcade button `#shift-double-btn` to `showShiftSummary()` (every 5 deliveries), doubling shift earnings and updating live bank balance (`#shift-wallet-val`).
- **Dispatch Hub Sponsor Cash (+₹500)**: Added `#btn-hub-sponsor` to Dispatch Hub footer with 60s debounce cooldown, giving players an active path to unlock the ₹6,000 Muscle Coupe.

### 3. One-Click Distribution Packager (`package_web_portal.sh`)
- Generates `dist/shiplyp-web-portal.zip` with `index.html` at the zip archive root (mandatory for GameDistribution, CrazyGames, and itch.io).
- Packages runtime files, textures, 3D GLTF models, and CSS while excluding dev tools and system metadata.

---

## 🔬 Automated Verification
- `scratch/verify_ad_sdk.js`:
  - Verified `window.ShiplypAds` initialization and provider detection.
  - Verified ₹500 Sponsor Cash reward credit and 60s cooldown debounce.
  - Verified 2x Shift Earnings payout credit and button state lock.
  - Verified gameplay lifecycle hooks (`gameplayStart`, `gameplayStop`, `happyTime`).
  - Executed `dev-checks.js` (`runWorldChecks()`): **35/35 checks green (100% PASS)**.
- Android Asset Sync: Ran `./last-mile/sync_android_assets.sh` including `ads.js`.
