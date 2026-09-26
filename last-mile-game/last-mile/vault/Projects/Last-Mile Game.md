---
date: 2026-09-13
type: project
tags:
  - project
  - active
ai-first: true
status: active
job:
---

# Last-Mile Game

## For future agent
This is the hub project note for the last-mile delivery driving game (codename Shiplyp), saved 2026-09-13 after scanning its Android/JS codebase with graphify. It links out to the engine subsystems below - pull this note first when reasoning about the project's overall shape before diving into a specific system.

## Overview
A driving/delivery game with a procedurally generated world, Android app shell, and JS game logic (`game.js`). Code lives at `last-mile/` (JS layer) and `last-mile/android/` (native Android layer). graphify's code-graph scan (2026-09-13) found 225 nodes / 557 edges across 14 communities.

## Architecture
Core subsystems in the game:

- [[Architecture/ShiplypEngine|ShiplypEngine]] - Central game loop orchestrator and lifecycle manager
- [[Architecture/ProceduralWorld|ProceduralWorld]] - Spline generation, road ribbons, 640m horizon landscape, streaming settlement extensions
- [[Architecture/SaveAndCareerSystem|SaveAndCareerSystem]] - Persistent `localStorage` wallet, ranks, streak multipliers, and fleet gating
- [[Architecture/AdSdkAndMonetization|AdSdkAndMonetization]] - Multi-network HTML5 ad adapter (GameDistribution, CrazyGames, Poki, mock fallback) & rewarded payouts
- [[Architecture/VehicleController|VehicleController]] - 4-wheel ground plane physics, suspension body roll, bicycle camber lean, and drag-to-steer
- [[Architecture/MobileTouchAndErgonomics|MobileTouchAndErgonomics]] - 4-quadrant zero-overlap layout, analog swipe controls, dynamic portrait FOV
- [[Architecture/OnboardingAndDeliveryFlow|OnboardingAndDeliveryFlow]] - First 60-seconds tutorial, closed-form ballistic express drop
- [[Architecture/AndroidStudioBridge|AndroidStudioBridge]] - Native Android Studio app wrapper (SDK 35), hardware-accelerated WebKit WebView, offline asset loader
- [[Architecture/SoundEngine|SoundEngine]] - Procedural harmonic engine hum, 4-gear RPM curve, pink-noise aerodynamic wind
- [[Architecture/VisualStyleManager|VisualStyleManager]] - Multi-tier visual styles (Classic, Enhanced, Cinematic) and post-processing
- [[Architecture/RoadSpatialGrid|RoadSpatialGrid]] - Continuous line-segment spatial partitioning for collision and clearance
- [[Architecture/RainSystem|RainSystem]] - Procedural precipitation and blizzard snow particle systems
- [[Architecture/PRNG|PRNG]] - Deterministic seed-based noise and spline distribution

## Key Milestones & Recent Releases
- **Merged to main (2026-09-23)**: [PR #3](https://github.com/firsthought-dev/last-mile-game/pull/3), merge commit `1d8634f` — all `roadside-npcs` work through B99 is now on `main`.
- **B95 (2026-09-23)**: Verification pass over B88–B94 (all scratch scripts re-run); fixed dead B88 cycle speed escalation (`cycle.maxSpeed` capped at base 22 km/h → 38 km/h ceiling), 35/35 checks green.
- **B94 (2026-09-23)**: Web Portal Ad SDK Integration (`ads.js`) with GameDistribution, CrazyGames, and Poki adapters, Rewarded 2x Shift Earnings bonus, ₹500 Dispatch Hub Sponsor Cash, and One-Click Distribution Packager (`package_web_portal.sh`), 35/35 checks green.
- **B93 (2026-09-23)**: Mobile HUD Mystery Buttons Overhaul ([🤖 AUTO] and [⚙️ TOOLS] drawer), Radar-Steering Collision Fix (dynamic drag indicator, 0px overlap), and Delivery Bicycle `PEDAL` Telemetry Polish, 35/35 checks green.
- **B92 (2026-09-22)**: Boot/Reload Vehicle Lock Desync (defensive profile reconciliation in `save.js`, engine inventory synchronization in `game.js`, locked vehicle gating in dock switcher), 35/35 checks green.
- **B91 (2026-09-22)**: Delivery Cycle Smooth Ride & Dynamics Overhaul (smooth progressive steering, 16 km/h cornering ceiling without speed bogging, critically-damped suspension, 1.1-1.45 Hz human pedaling cadence with coasting glide, cycle steadycam framing).
- **B90 (2026-09-22)**: Intro Screen Arcade Typography Overhaul (`Bebas Neue` + `Bungee`) & Mobile Autopilot Control (`🤖 AUTO` with active cyan glow, haptics, chimes, and HUD toast).
- **B89 (2026-09-22)**: Complete Game UI Overhaul to Pack 4 "Cell-Shaded Pop & Comic Dispatch" (Russo One + Chakra Petch + Barlow), comic ink & pop shadows, mobile zero-overlap layout geometry across 5 devices, 35/35 checks green.
- **B88 (2026-09-22)**: Delivery Cycle Speed Escalation (22 to 38 km/h over 120s) and 30% Lateral Steering Speed Reduction with 0.5s neutral recovery.
- **B87 (2026-09-22)**: Vehicle Price Adjustment to ₹6,000, removal of intro wireframes, and FTU onboarding explainer contrast fix.
- **B86 (2026-09-22)**: Desi Horn / Bicycle Bell audio synthesis, 1-tap Scenic Postcard Photo Mode, and 5-delivery Shift Milestone celebration modal.
- **B85 (2026-09-22)**: Career Progression Economy (wallet, ranks, stars, ₹12,000 Muscle Coupe gating), bottom-sheet unlock modal, canvas vector previews, mobile drag-to-steer, Target SDK 35.
- **B84 (2026-09-21)**: World Streaming Beyond 6km Fixes (switchback height-bounded clamps, in-situ floor carving down -25m, 150m mountain skirt, chunk seam snapping).
- **B83 (2026-09-21)**: Continuous Spatial Segment Road Clearance Clamping (0 paved breaches, 0 verge breaches across 4,203 scan points).
- **B82 (2026-09-21)**: Native Android Studio Project Wrapper (`last-mile/android/`) with compileSdk 35 and offline asset loader.
- **B81 (2026-09-20)**: Zero-Overlap Mobile Touch HUD layout (verified on iPhone 16, Galaxy A55, Pixel 9).
- **B80 (2026-09-20)**: Mobile Auto-Rotate, Uncluttered Portrait Mode ($75^\circ$ FOV), and Automotive/Bicycle Physics Overhaul.
- **B78 (2026-09-19)**: Fictionalized Regional Biomes (*The Grand Nilambari Corridor* with 5 scenic districts).
- **B75 (2026-09-18)**: 60+ FPS Rendering Pipeline (instanced rocks and foliage, fused `FilmPostShader`).

## Strategic Blueprint & Publishing
- [[Knowledge/Anul Agarwal AI Game Dev & Multiplatform Publishing Blueprint|Anul Agarwal AI Game Dev & Multiplatform Publishing Blueprint]]
- [[Projects/AI Game Generation Tool & Multiplatform Distribution|AI Game Generation Tool & Multiplatform Distribution Hub]]

## Links
- Live build (GitHub Pages): https://firsthought-dev.github.io/last-mile-game/ (deployed by `.github/workflows/static.yml`, which publishes only runtime files from `last-mile/` since PR #4)
- Android Studio Project: `last-mile/android/`
- Sync Script: `last-mile/sync_android_assets.sh`
- This vault's knowledge graph: `atlas.canvas` (vault root)

## Recent Dev Logs
- [[Dev Logs/2026-09-23 - B107 Sidewalk Guardrail and Barrier Grounding Alignment]]
- [[Dev Logs/2026-09-23 - B105 Android WebView Performance and DevTools Remote Debugging]]
- [[Dev Logs/2026-09-23 - B100 Classic Style Fog and Night Posterize Fix]]
- [[Dev Logs/2026-09-23 - B96-B98 Cycle Speed, New Courier Bicycle Model and Physics Lean]]
- [[Dev Logs/2026-09-23 - B95 Fix Verification Pass and Cycle Speed Escalation Cap Fix]]
- [[Dev Logs/2026-09-23 - B94 Web Portal Ad SDK Integration and Distribution Packaging]]
- [[Dev Logs/2026-09-23 - B93 Mobile HUD Mystery Buttons Overhaul, Radar Steering Collision Fix and Bicycle Telemetry Polish]]
- [[Dev Logs/2026-09-22 - B92 Boot Reload Vehicle Lock Desync and Inventory Reconciliation]]
- [[Dev Logs/2026-09-22 - B91 Delivery Cycle Smooth Ride and Dynamics Overhaul]]
- [[Dev Logs/2026-09-22 - B90 Intro Screen Arcade Typography Overhaul and Mobile Autopilot Control]]
- [[Dev Logs/2026-09-22 - B89 Comic Pop UI Overhaul and Multi-Device Zero-Overlap]]
- [[Dev Logs/2026-09-22 - B88 Delivery Cycle Speed Escalation and Steering Penalty]]
- [[Dev Logs/2026-09-22 - B87 Vehicle Price Pacing Intro Wireframe Cleanup and FTU Banner Contrast]]
- [[Dev Logs/2026-09-22 - B86 Desi Horn Postcard Photo Mode and Shift Milestone Loop]]
- [[Dev Logs/2026-09-22 - B85 Vehicle Progression Economy and Mobile Drag Steer]]
- [[Dev Logs/2026-09-21 - B82 Standalone Android Studio Project Wrapper SDK 35]]
- [[Dev Logs/2026-09-20 - B80-B81 Mobile Touch UI Overhaul and Driving Physics]]

## Related Tasks

```dataview
TABLE WITHOUT ID file.link AS "Task", status AS "Status"
FROM "Tasks"
WHERE contains(file.outlinks, this.file.link)
SORT date DESC
```

## Recent Activity
- 2026-09-27 — [[2026-09-27 - B111 Restore Mobile Steer Buttons|B111]]: mobile ◀▶ steering restored on cycle/scooter; merged PR #9 (`023f855`)

```dataview
LIST FROM "Daily"
WHERE contains(file.outlinks, this.file.link)
SORT date DESC
LIMIT 5
```
