---
date: 2026-09-23
type: dev-log
tags:
  - dev-log
  - last-mile-game
  - mobile-hud
  - ui-ux
  - b93
ai-first: true
---

# 2026-09-23 — B93 Mobile HUD Mystery Buttons Overhaul, Radar Steering Collision Fix & Bicycle Telemetry Polish

## For future agent
Dev log for the resolution of mobile HUD mystery meat navigation, radar/steering layout collision, and delivery bicycle gear telemetry polish in [[Projects/Last-Mile Game|Last-Mile Game]].

## What Was Fixed

### 1. Mystery Meat Navigation Overhaul
- **Symptom**: User reported: *"who's supposed to understand what these buttons mean? I can't uinderstand shit, not a single thing, uinless I play with each button. Is this intendeD?"*.
- **Root Cause**: In commit B89's responsive styling pass, `.touch-util-btn .util-text { display: none; }` stripped all text labels from utility buttons to prevent collisions with the mission capsule. On touchscreens without hover tooltips, players were confronted with five tiny (24px) ambiguous emoji squares (`📯`, `📷`, `↺`, `🎥`, `🤖 AUTO`).
- **Fix**:
  - Replaced the squished 5-emoji row with two clean, readable pill buttons: `[🤖 AUTO]` and `[⚙️ TOOLS]`.
  - Built a comic pop Quick Tools drawer (`#touch-tools-drawer`) that opens on tapping `TOOLS`.
  - Contains four comfortably sized (≥36px height) tap targets with full labels and icons:
    - `🎥 CAMERA VIEW` (cycles third-person, hood, drone camera views)
    - `↺ RECENTER CAR` (returns vehicle to road)
    - `📷 PHOTO MODE` (scenic postcard photo mode)
    - `🔔 HORN / BELL` (sounds cycle bell or automotive horn)
  - Auto-closes on option tap and outside tap. Set `.touch-utility-cluster` to `z-index: 9500` and `.onboarding-hint` to `z-index: 45` to prevent onboarding banners from occluding the drawer.

### 2. Radar & Steering Indicator Collision Fix
- **Symptom**: User reported: *"also why is the sliding wheel over the map and why is it even overlappingg?"*.
- **Root Cause**:
  - `.drag-steer-indicator` was styled with `opacity: 0.5` by default, permanently rendering a faint gray circle when idle.
  - `#touch-drag-steer` was styled with `height: 40%`, extending across the bottom 340px of screen height. This placed the centered circle directly on top of the `.slowroads-radar-box` minimap (`bottom: 96px; left: 12px;`).
  - Swiping or resting a thumb on the steering ring physically blocked the minimap.
- **Fix**:
  - Made `.drag-steer-indicator` invisible (`opacity: 0`) when idle.
  - Dynamically positions the indicator under the user's thumb at `(e.clientX, e.clientY)` on `pointerdown` with smooth fade-in (`opacity: 1`), removing it cleanly on pointer release.
  - Constrained `#touch-drag-steer` height to `112px` (below `bottom: 112px`) in mobile portrait viewports, and elevated `.slowroads-radar-box` to `bottom: 124px; left: 12px;`.
  - Verified bounding boxes are strictly disjoint: **0px overlap**, radar completely free from thumb occlusion.

### 3. Bicycle Gear Telemetry Polish
- **Symptom**: Telemetry readout showed `DRIVE / 0.4 KM` when riding a delivery bicycle.
- **Root Cause**: `<span class="telemetry-gear">DRIVE</span>` was hardcoded in HTML without vehicle-type awareness.
- **Fix**: Updated `#telemetry-gear` dynamically in `startDrive()` and the animation loop. For `cycle`, displays `PEDAL` when moving (>2 km/h) or `CRUISE` when stationary/coasting, and `DRIVE`, `PARK`, or `REVERSE` for motorized vehicles.

### 4. Pedal Cluster & Drop Button Clearance
- **Fix**: Updated `.touch-pedal-cluster` to `align-items: center` with `margin-bottom: 6px` on `touch-action-drop`, centering the glowing `DROP` button cleanly above the gas/brake pedal pair with 12px vertical clearance to prevent accidental taps while braking.

## Verification Evidence
1. **Automated Playwright Suite (`scratch/verify_hud_overhaul.js`)**:
   - `Check 1: Idle drag indicator opacity = 0 (PASS)`
   - `Check 2: Utility buttons text = [🤖 AUTO] and [⚙️ TOOLS] (PASS)`
   - `Check 3: Telemetry gear text = "PEDAL" (PASS)`
   - `Check 4: Radar top=633 bottom=728, SteerZone top=740 bottom=852, overlap = false (PASS)`
   - `Check 5: Tools drawer display = flex, all 4 items present (PASS)`
   - `Check 6: Drawer closes on option tap (PASS)`
   - `Check 7: Active drag indicator opacity during touch = 1 (PASS)`
2. **In-Engine Regression Suite (`dev-checks.js`)**:
   - **35/35 checks PASS (100% green)**.
3. **Screenshots Inspected**:
   - `hud_portrait_idle.png`: Clean HUD with no ghost circle and clear `AUTO` / `TOOLS` pills.
   - `hud_tools_drawer_open.png`: Crisp popup drawer with high-contrast labeled options.
   - `hud_drag_active.png`: Steering indicator active at bottom of screen with zero radar overlap.
4. **Android Assets Synced**: Ran `./last-mile/sync_android_assets.sh`.

## Links
- [[Projects/Last-Mile Game]]
- [[Architecture/MobileTouchAndErgonomics]]
- [[Daily/2026-09-23]]
