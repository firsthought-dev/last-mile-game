---
date: 2026-09-23
type: architecture
tags:
  - architecture
  - monetization
  - ads
  - web-portals
  - distribution
ai-first: true
status: active
subsystem: AdSdkAndMonetization
---

# Architecture: Ad SDK & Monetization Engine (`ads.js`)

## Overview
The `ShiplypAds` engine (`last-mile/ads.js`) provides a unified, zero-overhead abstraction layer connecting the Three.js game client to major HTML5 web gaming portal monetization SDKs, including:
1. **GameDistribution (Azerion)** — `gdsdk.showAd(...)`
2. **CrazyGames SDK (v2/v3)** — `CrazyGames.SDK.ad.requestAd(...)`
3. **Poki SDK (v2)** — `PokiSDK.commercialBreak()` & `PokiSDK.rewardedBreak()`
4. **Standalone / Offline / Mock Mode** — Safe, instant-fallback simulation when running in offline mode, Android WebView, or under client-side ad-blockers.

```
                    ┌────────────────────────────────────────────────────────┐
                    │                      Shiplyp Game Loop                 │
                    │               (Shift Summary / Hub / Gameplay)         │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │               ShiplypAds Engine (ads.js)               │
                    ├────────────────────────────────────────────────────────┤
                    │ • Rate Limiting & Cooldown Guards (90s interstitial)   │
                    │ • Game Pause & Audio Mute / Resume Orchestrator        │
                    │ • Provider Auto-Detector                               │
                    └───────┬───────────────────┬────────────────────┬───────┘
                            │                   │                    │
            ┌───────────────▼──┐       ┌────────▼───────┐     ┌──────▼────────┐
            │ GameDistribution │       │   CrazyGames   │     │  Mock Fallback│
            │      (gdsdk)     │       │   (SDK v2/v3)  │     │   (Offline)   │
            └──────────────────┘       └────────────────┘     └───────────────┘
```

---

## Key Invariants

1. **Never Throw / Never Deadlock**:
   Ad network failures, missing scripts, network timeouts, or aggressive browser ad-blockers must never halt gameplay, throw unhandled promise rejections, or trap the player in an unskippable modal. Every ad pathway has strict timeout guards and fallback resolution.

2. **Strict Game Loop & Audio Pause/Resume**:
   During interstitial and rewarded ad playback:
   - Three.js animation frame rendering continues (`this._adPaused = true`) without advancing vehicle physics, order countdown clocks, or spline progression.
   - Game sound (`SoundEngine`) is suspended/muted via `sound.mute()` to prevent audio clashes with commercial sound.
   - Upon ad finish, skip, or error, `onResumeGame()` and `onResumeAudio()` are guaranteed to execute.

3. **Polite Interstitial Cadence**:
   Interstitials are strictly throttled by `minInterstitialIntervalMs = 90000` (90 seconds). They only trigger during natural transition breaks (e.g., clicking Next Shift or returning to Dispatch Hub), never during active high-speed driving or parcel delivery approaches.

4. **Rewarded Economy Integration**:
   - **2x Shift Earnings**: When 5 deliveries trigger `showShiftSummary()`, a high-contrast arcade button offers double payout (`+₹X` credited directly to career wallet).
   - **Dispatch Hub Sponsor Cash**: Players short on funds for the ₹6,000 Muscle Coupe can claim ₹500 sponsor cash from the hub footer (protected by a 60-second cooldown timer).

---

## API Reference

```typescript
interface ShiplypAdsAPI {
  init(options?: AdOptions, hooks?: LifecycleHooks): ShiplypAdsAPI;
  getProvider(): 'gamedistribution' | 'crazygames' | 'poki' | 'mock';
  isRewardedAvailable(): boolean;
  showInterstitial(placement: string, callbacks?: AdCallbacks): boolean;
  showRewarded(rewardType: 'shift_double' | 'sponsor_cash', callbacks?: RewardedCallbacks): boolean;
  gameplayStart(): void;
  gameplayStop(): void;
  happyTime(): void;
}
```

---

## Distribution Packaging
The companion script `last-mile/package_web_portal.sh` packages `index.html`, `ads.js`, `game.js`, `save.js`, and `assets/` into a root-level `dist/shiplyp-web-portal.zip` meeting GameDistribution, CrazyGames, and itch.io standards.
