---
date: 2026-09-22
type: devlog
tags:
  - devlog
  - last-mile-game
  - vehicle
  - progression
  - economy
  - career
ai-first: true
---

# 2026-09-22 - B92 Boot Reload Vehicle Lock Desync and Inventory Reconciliation

## Summary
Fixed a progression economy exploit where refreshing the browser after the First Time User Experience (FTUE) and toggling visual graphic styles granted players the locked Muscle Coupe for free. Implemented a defensive vehicle profile reconciler in `save.js` and engine synchronization guards in `game.js` so that unpurchased vehicles can never spawn into the scene on reload or mode change.

## Root Cause
1. **Hardcoded Constructor Default**: In `Game` constructor, `this.selectedVehicle = 'musclecoupe';` remained hardcoded from early development.
2. **Missing Profile Reconciliation**: On page refresh, `Career` reloaded its profile (`unlocks.vehicles = ['cycle']`), but `Game` never cross-referenced `this.selectedVehicle` with `Career.isUnlocked()`.
3. **Bypassed UI Selection Guard**: In the Dispatch Hub modal, click guards prevented manually selecting a locked vehicle card. However, clicking a visual style card (`Classic`, `Enhanced`, `Cinematic`) and then clicking `DRIVE` / `START` bypassed the vehicle card click handler, allowing the default `'musclecoupe'` in memory to spawn into the 3D scene.
4. **Dock Bar Vehicle Switcher**: The in-game dock bar vehicle switcher lacked lock validation, allowing direct switching to locked cars mid-drive.

## Key Changes
1. **`last-mile/save.js` (Career & Save Layer)**:
   - Added `selectedVehicle: 'cycle'` to `defaultProfile()`.
   - In `reconcile(loaded)`, defensively verified `out.selectedVehicle`: if invalid or not in `out.unlocks.vehicles`, it automatically falls back to `out.unlocks.vehicles[0] || 'cycle'`.
   - Added public methods: `Career.selectedVehicle()`, `Career.setSelectedVehicle(id)`, `Career.defaultVehicle()`, and `Career.unlocked(kind)`.
   - Aliased `global.Career = global.ShiplypSave;`.

2. **`last-mile/game.js` (Engine Layer)**:
   - Updated `VehicleController` constructor default to `'cycle'`.
   - In `Game` constructor, initialized `this.selectedVehicle` from `Career.selectedVehicle() || 'cycle'`.
   - Implemented `Game.reconcileSelectedVehicle()`: validates `this.selectedVehicle` against `Career.isUnlocked('vehicles', id)` and clamps to player's active unlocked vehicle.
   - Invoked `reconcileSelectedVehicle()` before `init()` stage 5, `buildWorldAndScene()`, `startDrive()`, and `renderDispatchHub()`.
   - Synchronized vehicle selection with `Career.setSelectedVehicle()` when picking vehicles in the hub or unlocking in `_showUnlockSheet()`.
   - In `renderDockPanelContent('vehicle')`, added lock gating with warning feedback and `.veh-dock-locked` styling.

3. **`last-mile/style.css`**:
   - Added `.dock-sq-btn.veh-dock-locked` styling (`opacity: 0.55; filter: grayscale(0.6); cursor: not-allowed;`).
   - Refined mobile narrow screen (Galaxy A55 <= 380px) delivery capsule to maintain >80px clear sky gap (measured at **111px**).

## Verification
- **Automated Reproduction & Reconciliation Suite (`scratch/verify_vehicle_lock_sync.js`)**:
  - Initial load defaults to `'cycle'`.
  - Post-FTUE profile simulation (deliveries: 1, wallet: ₹358, only cycle unlocked).
  - Page refresh: Dispatch Hub correctly highlights Cycle and keeps Muscle Coupe locked.
  - Visual style changed to `Classic`.
  - START clicked without touching vehicle card: in-game driving vehicle strictly confirmed `'cycle'` (PASS).
  - Dock bar locked vehicle click rejected (PASS).
  - Synchronous `runWorldChecks()` passed **35/35 checks (100% green)**.
- **Multi-Device Zero-Overlap Suite (`scratch/verify_ui_pack4.js`)**:
  - 0 overlaps across Desktop (1440x900), iPhone 16 (393x852), Pixel 9 (412x924), Galaxy A55 (360x800), and Mobile Landscape (852x393).
- **Android Project Sync**: Synced bundle to `android/app/src/main/assets/` via `./sync_android_assets.sh`.

## Links
- [[Projects/Last-Mile Game]]
- [[Architecture/SaveAndCareerSystem]]
- [[Daily/2026-09-22]]
