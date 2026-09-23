---
date: 2026-09-22
tags:
  - knowledge
  - business
  - ai-gamedev
  - publishing
  - monetization
aliases:
  - Anul Agarwal Blueprint
  - AI Game Dev & Publishing Matrix
---

# Anul Agarwal (Momo Games) AI Game Dev & Multiplatform Publishing Blueprint

> **Strategic Directive**: Read this note at the start of strategic planning sessions to measure progress across game development, AI tool productization, and multiplatform publishing channels.

---

## 👤 Executive Profile: Anul Agarwal & Momo Games
- **Founder**: Anul Agarwal (Momo Games), solo indie game developer based in India.
- **Core Formula**: AI-accelerated development (ChatGPT / LLMs + Unity/Phaser + Generative Art) → Zero user-acquisition spend via Web Gaming Portals (GameDistribution, etc.) → High CPM Ad Monetization + Licensing.
- **Breakout Case Study**: Watermelon/Suika Game clone built with ChatGPT (code + 2D art) generated **1.1M+ plays on GameDistribution** and **\$25,000 in revenue** from a single title.
- **Portfolio Scale**: **\$150,000+ in revenue across 8 months** with low ongoing overhead.
- **Media & Community**: Substack (*Gameplay Level Up*), Medium (*"How I make $$$ by developing web-games"*, *"How I make games with ChatGPT + Unity"*), LinkedIn viral dev logs, and FireDEV Podcast.

---

## ⚙️ Deconstructing the Workflow: Manual vs. Automated Tool vs. Shiplyp Status

| Component | What Anul Does (Manual) | What a Dedicated AI Tool Would Do | Shiplyp (Current Project State) | Next Milestones to Achieve |
| :--- | :--- | :--- | :--- | :--- |
| **Game Concept & Design** | Manual ideation, cloning viral mechanics (Suika, Endless Runners). | Prompt $\to$ Genre/mechanic design doc + seed rules + scoring schema. | Done: Procedural Indian Courier Driving / Express Drops mechanic. | Modular level generator & custom delivery mission prompts. |
| **Code Generation** | Pastes prompts into ChatGPT; copies code into Unity scripts; manual debugging. | Structured prompt orchestration engine outputting clean, typed game modules (Phaser/Three.js). | Done: Three.js r128 modular architecture (`VehicleController`, `ProceduralWorld`, `RoadSpatialGrid`). | AI-assisted runtime procedural difficulty & route generator. |
| **2D/3D Art & Assets** | Generates images via Midjourney/DALL-E; manually cuts & imports sprites. | Automated pipeline: Prompt $\to$ style-consistent sprite sheet / 3D low-poly GLTF $\to$ engine atlas. | Done: Procedural materials + GLTF vehicle assets + `sprite-gen` skill integrated. | Automated procedural texture palette & billboard sprite generation. |
| **Audio & SFX** | Manual sourcing / basic synthesis. | Prompt $\to$ Procedural Web Audio API sound synthesizers & dynamic chiptune/engine SFX. | Done: Procedural Web Audio engine (`SoundEngine.js` synthesizer, throttle pitch, screech, horn). | Dynamic radio station generator & localized audio chatter. |
| **Controls & UX** | Unity standard inputs (Desktop/Mobile). | Responsive viewport adapter: dynamic camera FOV, zero-overlap touch clusters, portrait & landscape auto-switching. | Done: Zero-overlap mobile touch HUD, portrait/landscape auto-rotation, analog drag-to-steer. | Gamepad API & customizable on-screen button layouts. |
| **Distribution & Porting** | Manual build export & manual uploads to GameDistribution. | One-click build & deploy pipeline targeting Web Portals, Android AAB, iOS, and PWA. | Done: WebGL Web app + Native Android Studio WebView wrapper (`compileSdk 35`). | One-click GameDistribution / CrazyGames / Poki bundle export. |
| **Monetization Setup** | Manual SDK script injection for pre-roll & interstitial ads. | Pre-configured SDK templates (GameDistribution, AdSense for H5, AdMob, CrazyGames SDK). | In-Progress: Career progression fleet economy (₹12,000 unlocks). | Integrate GameDistribution HTML5 Ad SDK & Rewarded Video ads. |

---

## 🌐 Complete Multiplatform Publishing Ecosystem

```
                               ┌──────────────────────────────────────────────┐
                               │       Shiplyp / AI Web Game Engine           │
                               └──────────────────────┬───────────────────────┘
                                                      │
         ┌────────────────────────────┬───────────────┴───────────────┬────────────────────────────┐
         │                            │                               │                            │
         ▼                            ▼                               ▼                            ▼
┌──────────────────┐        ┌──────────────────┐            ┌──────────────────┐        ┌──────────────────┐
│   Web Portals    │        │   Mobile Stores  │            │     Desktop      │        │  Social / Instant│
├──────────────────┤        ├──────────────────┤            ├──────────────────┤        ├──────────────────┤
│• GameDistribution│        │• Google Play AAB │            │• Steam (Electron/│        │• Telegram Games  │
│• CrazyGames      │        │• Apple App Store │            │  Tauri Wrapper)  │        │• Discord Activ.  │
│• Poki            │        │• Samsung Galaxy  │            │• itch.io Standal.│        │• Facebook Instant│
│• Y8 / ArmorGames │        │• Amazon Appstore │            │• Web PWA         │        │• WeChat MiniGame │
│• Newgrounds      │        │                  │            │                  │        │                  │
└──────────────────┘        └──────────────────┘            └──────────────────┘        └──────────────────┘
```

### 1. Web Game Portals (Zero-CAC Organic Reach)
- **GameDistribution (Azerion)**: Primary network used by Anul. Distributes across thousands of publisher sites. Revenue share based on CPM impressions.
- **CrazyGames**: Direct developer portal, high rev-share, dedicated developer dashboard, supports Rewarded Ads & Banner Ads.
- **Poki**: Curated platform with massive global organic traffic; requires high polish and mobile/desktop cross-play capability.
- **Y8 / Armor Games / Newgrounds / Kongregate**: Legacy & hardcore web communities for viral testing and feedback.
- **itch.io / GameJolt**: Indie community testing ground for prototype validation.

### 2. Mobile App Stores
- **Google Play Store**: Native Android wrapper (AndroidX WebKit `WebViewAssetLoader`, hardware acceleration, 60fps, offline-first).
- **Apple App Store**: WKWebView wrapper with iOS App Store provisioning.
- **Alternative Stores**: Samsung Galaxy Store, Amazon Appstore, Xiaomi GetApps (high reach in emerging markets).

### 3. Monetization Engines
- **Web Ad SDKs**:
  - `GameDistribution SDK`: `gdsdk.showAd()` for pre-roll & mid-roll breaks.
  - `CrazyGames SDK`: `window.CrazyGames.SDK.ad.requestAd("rewarded")`.
  - `Google AdSense for Games (H5 Games Ads)`: Direct programmatic ad insertion.
- **Rewarded Video Mechanics**:
  - Watch ad for 2x Shift Delivery Earnings (₹ Multiplier).
  - Watch ad for instant vehicle unlock or fuel/nitro refill.
- **In-App Purchases (IAP)**:
  - Google Play Billing via native Android bridge interface (`@JavascriptInterface`).

---

## 🛠️ The AI Game Making Tool: Productization Blueprint

### Architecture of the Tool:
1. **Core Runtime**: Lightweight, modular browser engine (Phaser.js or Three.js).
2. **LLM Orchestration Layer**:
   - Structured JSON schema outputs for Game Rules, Level Splines, Physics parameters.
   - Guardrails preventing hallucinated syntax and enforcing engine-level performance invariants.
3. **Asset Generation Microservices**:
   - 2D Sprite & Texture Generator (Flux/SDXL/Midjourney API with palette quantization and transparent alpha unmixing).
   - Procedural 3D Mesh Generator or parameterized low-poly asset kit.
   - Procedural Web Audio / Sound FX generator.
4. **Export & Publishing Packager**:
   - Target 1: `web-portal.zip` (clean single-bundle HTML5 + auto-detected Ad SDK).
   - Target 2: `android-project.zip` (ready-to-compile Gradle/Android Studio wrapper).
   - Target 3: `pwa/` (Offline ServiceWorker manifest).

---

## 📊 Continuous Progress Scorecard (Updated Every Session)

- [x] **Core Game Physics & 3D Rendering**: Three.js r128, Catmull-Rom procedural roads, terrain raycast clearance, continuous spatial grid.
- [x] **Zero-Overlap Mobile Touch Controls & Ergonomics**: Drag-to-steer, auto-rotation portrait & landscape, dynamic FOV.
- [x] **Progression Economy & Vehicle Gating**: Career earnings balance, vehicle unlock bottom-sheet, vehicle stat comparisons.
- [x] **Standalone Native Android Wrapper**: `last-mile/android/` with Kotlin, `compileSdk 35`, hardware acceleration, `WebViewAssetLoader`.
- [x] **Automated Regression Suite**: Playwright headless browser test harness with 35/35 automated invariant checks.
- [ ] **Web Portal Ad SDK Integration**: Add modular wrapper for GameDistribution / CrazyGames / Poki SDKs.
- [ ] **One-Click Build & Export Script**: Automation script to package `.zip` for GameDistribution / CrazyGames / itch.io.
- [ ] **Google Play Store Release Pipeline**: Release keystore signing, icon/banner asset packaging, and AAB generation.
- [ ] **Standalone AI Game Making Tool (MVP)**: Prompt-to-playable game generator prototype using Phaser/Three.js.
