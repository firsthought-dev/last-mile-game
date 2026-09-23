---
date: 2026-09-22
type: dev-log
tags:
  - game-dev
  - shiplyp
  - ui-ux
  - career-economy
project: "[[Projects/Last-Mile Game]]"
---

# 2026-09-22 - B87: Vehicle Price Pacing, Hub Card Cleanup & FTU Banner Contrast

## 🎯 Summary
Fine-tuned the early-game progression curve and cleaned up intro screen visual presentation:
1. **Vehicle Price Rebalance**: Reduced Muscle Coupe unlock cost from ₹12,000 to ₹6,000 across the economy and UI.
2. **Intro Vehicle Card Wireframe Removal**: Excised injected `<canvas class="veh-thumb-canvas">` thumbnails from the Dispatch Hub vehicle selection buttons, restoring clean typography cards on the intro screen while preserving `_drawVehicleThumb` for the bottom-sheet unlock modal.
3. **FTU Onboarding Banner High-Contrast Restyling**: Fixed the "white text on white/cream background" issue by giving `.hub-onboarding-banner` dark high-contrast typography (`#2c3846`), deep teal title (`#2b5e58`), and a softly tinted container background (`rgba(79, 125, 120, 0.08)`).

---

## 🛠️ Changes Made

### 1. Economy & Pricing (`last-mile/game.js`, `last-mile/save.js`)
- `game.js:12195`: Updated `VEH_META.musclecoupe.price` to `6000`.
- `game.js:11068`: Verified `VEH_META_SHEET.musclecoupe.price` at `6000`.
- `save.js:129`: Updated comment reference to `purchase('vehicles','musclecoupe',6000)`.

### 2. Dispatch Hub Vehicle Cards (`last-mile/game.js`)
- `game.js:12281-12323`: Removed `<canvas class="veh-thumb-canvas" ...>` from the `vehList.map` template and removed the `querySelectorAll('.veh-thumb-canvas')` draw loop.
- Maintained `_drawVehicleThumb(canvas, vehId)` method on the game engine instance for the `#unlock-sheet-hero` modal preview.

### 3. FTU Onboarding Banner Contrast (`last-mile/style.css`)
- Replaced light green gradient with soft translucent teal container: `background: rgba(79, 125, 120, 0.08);`, `border: 1px solid rgba(79, 125, 120, 0.28);`.
- Replaced light green title with deep teal `#2b5e58`.
- Replaced semi-transparent white body (`rgba(255, 255, 255, 0.75)`) with high-contrast slate `#2c3846`.

---

## 🧪 Verification & Evidence
- **Automated Playwright Browser Suite (`verify_changes.mjs`)**:
  - Banner Title computed color: `rgb(43, 94, 88)` (`#2b5e58`)
  - Banner Body computed color: `rgb(44, 56, 70)` (`#2c3846`)
  - Canvases in Hub: `0`
  - Muscle Coupe Price Display: `₹6,000` / `NEED ₹5,900 MORE`
  - Unlock Bottom Sheet Modal: Opens with `#unlock-sheet-hero` canvas and `₹6,000` cost.
  - In-Game World Dev Checks: **ALL 35/35 CHECKS PASS (100% GREEN)**.
- **Android Asset Sync**: Synced bundle to native Android assets via `./last-mile/sync_android_assets.sh`.
