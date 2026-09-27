---
date: 2026-09-13
type: project
tags:
  - project
  - active
status: active
job:
---

# Last-Mile Game

## Overview
Shiplyp is a delivery driving game set on a procedurally generated scenic road through India. It plays in the browser and as an Android app.

## Features
- **Endless scenic road** through fictional regional biomes (*The Grand Nilambari Corridor*, 5 districts), with villages, tea stalls, repair shops and roadside life.
- **Vehicles**: a delivery bicycle and an unlockable Muscle Coupe, with driving physics, suspension and bike lean.
- **Career**: wallet, ranks, streaks and vehicle unlocks, saved between sessions.
- **Deliveries**: Express Drops made straight from the vehicle, with a first-minute tutorial and a shift summary every 5 drops.
- **Mobile**: touch HUD with no overlapping controls, drag or button steering, and portrait mode.
- **Assists**: Auto Steer and Auto Drive.
- **Visual styles**: Classic, Enhanced and Cinematic.
- **Weather**: rain and snow.
- **Web portal ads**: GameDistribution, CrazyGames and Poki, with optional rewards.

## Key Milestones & Recent Releases
- **Merged to main (2026-09-23)**: [PR #3](https://github.com/firsthought-dev/last-mile-game/pull/3) — roadside NPCs, career/save, onboarding, B80–B99.
- **B95 (2026-09-23)**: verification pass over B88–B94; the bicycle's speed build-up works again.
- **B94 (2026-09-23)**: web portal ads with optional rewards (2x shift earnings, ₹500 sponsor cash), plus one-step portal packaging.
- **B93 (2026-09-23)**: clearer mobile HUD (🤖 AUTO and ⚙️ TOOLS); radar no longer covered by the steering area; PEDAL gear on the bicycle.
- **B92 (2026-09-22)**: locked vehicles can no longer be unlocked by reloading.
- **B91 (2026-09-22)**: smoother bicycle ride.
- **B90 (2026-09-22)**: arcade-style intro screen and a mobile autopilot button.
- **B89 (2026-09-22)**: comic/arcade UI overhaul, checked on 5 screen sizes.
- **B88 (2026-09-22)**: the bicycle speeds up over a run; hard steering slows it.
- **B87 (2026-09-22)**: Muscle Coupe cut to ₹6,000; cleaner intro cards; readable first-run banner.
- **B86 (2026-09-22)**: desi horn and bicycle bell, postcard photo mode, shift milestones.
- **B85 (2026-09-22)**: career economy and vehicle unlocks; mobile drag-to-steer.
- **B84 (2026-09-21)**: no gaps or seams in the world far down the road.
- **B83 (2026-09-21)**: scenery kept off the road.
- **B82 (2026-09-21)**: native Android app, works offline.
- **B81 (2026-09-20)**: mobile HUD with no overlapping controls.
- **B80 (2026-09-20)**: mobile auto-rotate, portrait mode, driving physics overhaul.
- **B78 (2026-09-19)**: fictional regional biomes.
- **B75 (2026-09-18)**: 60+ FPS rendering.

## Links
- Live build (GitHub Pages): https://firsthought-dev.github.io/last-mile-game/

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
- 2026-09-27 — [[2026-09-27 - B119 Pedestrian T-pose Arms Fix|B119]]: pedestrian T-pose arms fixed
- 2026-09-27 — [[2026-09-27 - B120 Pedestrians Keep Walking After Zebra Crossings|B120]]: zebra-crossing pedestrians cross once and carry on, with no pacing or idling
- 2026-09-27 — [[2026-09-27 - B121 Start Menu Fits Small Phones and Landscape|B121]]: start menu fits small phones and works in landscape
- 2026-09-27 — [[2026-09-27 - B122 Delivery Result Card No Longer Covers Speed Box|B122]]: delivery result card no longer covers the speed box on phones
- 2026-09-27 — [[2026-09-27 - B123 Delivery Info Readable on Phones|B123]]: delivery info in the top-left corner readable on phones
- 2026-09-27 — [[2026-09-27 - B124 Phone Wording, Settings Fixes, Loading Bar|B124]]: phone wording, Settings fixes, loading bar
- 2026-09-27 — [[2026-09-27 - B125 Settings Screen Matches Game Style|B125]]: Settings screen matches the game's style
- 2026-09-27 — [[2026-09-27 - B126 Laptop Start Menu and HUD Layout|B126]]: start menu and HUD fixed for laptop-sized windows
- 2026-09-27 — [[2026-09-27 - B127 Licence Cleanup and Unused Assets Removed|B127]]: branded old artwork and unused vehicles removed; vehicle roster (motorbike, cargo three-wheeler, original car) planned
- 2026-09-27 — [[2026-09-27 - B118 Mobile Time Weather Vehicle in Tools; WORLD Tab Removed|B118]]: mobile Time / Weather / Vehicle controls; WORLD tab removed
- 2026-09-27 — [[2026-09-27 - B117 Environment Panel Fix, Off-World Map and Road Types Removed|B117]]: Environment tab fixed; single City map on asphalt
- 2026-09-27 — [[2026-09-27 - B116 Two Visual Styles Crisp and Cinematic|B116]]: graphics styles are now Crisp and Cinematic
- 2026-09-27 — PR #10 merged to main: radio + photo mode removed, Auto Steer / Auto Drive, mobile toast fix
- 2026-09-27 — [[2026-09-27 - B114 Remove Photo Mode, Split Auto Steer and Auto Drive|B114]]: photo mode removed; Auto Steer + Auto Drive
- 2026-09-27 — [[2026-09-27 - B113 Toast Radar Overlap|B113]]: mobile toast/radar overlap fixed
- 2026-09-27 — [[2026-09-27 - B112 Remove Radio|B112]]: in-game radio removed; single audio mute
- 2026-09-27 — [[2026-09-27 - B111 Restore Mobile Steer Buttons|B111]]: mobile ◀▶ steering restored on cycle/scooter; merged PR #9

```dataview
LIST FROM "Daily"
WHERE contains(file.outlinks, this.file.link)
SORT date DESC
LIMIT 5
```
