---
date: 2026-09-23
type: devlog
tags:
  - devlog
  - cycle
  - physics
  - assets
  - blender
ai-first: true
task: B96-B98
---

# B96–B98 — Cycle Speed, New Courier Bicycle Model & Physics Lean

## For future agent
Three linked cycle changes from one session. Full detail and verification numbers are in `BUGFIX_LOG.md` (B96, B97, B98). Links: [[Projects/Last-Mile Game]], [[Architecture/VehicleController]].

## B96 — Cycle too slow
- Measured: 22–23 km/h pedalling, 17 km/h while steering, 18 km/h on autopilot.
- Now: `cycle` preset carries `baseSpeed: 8.89` (32 km/h), `maxSpeed: 14.44` (52 km/h ramp ceiling), `rampSeconds: 120`. Steer penalty 15% (was 30%, and was being applied twice per step). Cycle autopilot cruises at 90% of cap.
- Also fixed: keydown listener used an undeclared `code`, so every hotkey except F threw.
- `scratch/verify_phase1.js` updated to the new constants.

## B97 — New courier bicycle model
- Source: `assets/models/base.glb` (Meshy, untextured, 35.7k tris, one mesh of 491 pieces). Built in Blender 5.2 via MCP; editable file `assets/models/delivery-cycle-source.blend`.
- Output `last-mile/assets/models/delivery-cycle.glb` (1.09 MB): nodes `Bike_Body`, `Wheel_Front`, `Wheel_Rear` (origins on axle centres from a least-squares circle fit, < 2 mm off).
- Shiplyp palette: shirt teal `#00D4BF`, cap/collar gold `#FFB833`, box marigold `#FF9F1C`, skin `#D49B72`, navy `#0F172A` (shorts, grips, pedals, saddle, tires, hair), frame slate `#334155`, chrome `#CBD5E1`, white (sneakers, new box-logo decal).
- Lesson: the rider's mesh pieces are texture-chart fragments, not body parts. Colour the rider per face by 3D region after `bisect_plane` cuts along each boundary; colour-by-piece gives jagged patchwork.
- `game.js`: wheels pushed into `this.wheels` by top-level node name only (GLTFLoader makes `Wheel_Front_1/_2` children for multi-material nodes). Cycle spin radius 0.365. Old trailer parcel stack removed. Cache-buster `?t=Date.now()`.

## B98 — Physics lean
- Lean = atan(v·ω/g) from measured yaw rate, capped 32°, through the existing roll spring. Recenter resets the yaw tracker.
- 35 km/h: 14° / 29° / 32° at 0.3 / 0.6 / 1.0 steer; autopilot ~19° in bends.

## Verification
- In-browser at 375×812: both wheels spin, chase camera frames rider + box, lean as above, 0 console errors.
- `scratch/run_dev_checks.js` 35/35. Android assets re-synced (`sync_android_assets.sh`).

## Open
- Switch the cycle cache-buster back to `ASSET_VERSION` before shipping (Date.now() re-downloads 1 MB every load).
- Parcel-depletion feedback no longer exists for the cycle (closed box). Could come back as a box-lid/fill indicator.
- Fork/handlebar doesn't visually steer (part of `Bike_Body`).
