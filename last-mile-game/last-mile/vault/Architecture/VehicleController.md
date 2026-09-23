---
date: 2026-09-13
type: architecture
tags:
  - architecture
  - last-mile-game
ai-first: true
---

# VehicleController

## For future agent
Architecture note on the player vehicle controller of [[Projects/Last-Mile Game|Last-Mile Game]], saved 2026-09-13 from a graphify scan (10 nodes).

## Overview
Player vehicle physics/input handling. Reads world data from [[Architecture/ProceduralWorld|ProceduralWorld]] / [[Architecture/RoadSpatialGrid|RoadSpatialGrid]] and may be affected by [[Architecture/RainSystem|RainSystem]] (wet-road handling - TBD, unconfirmed).

## Links
- [[Architecture/ProceduralWorld]]
- [[Architecture/RainSystem]]

## Cycle speed envelope (B88, fixed B95)
- Cycle target speed escalates linearly from 6.11 m/s (22 km/h) to 10.56 m/s (38 km/h) over 120 s of `cycleRideTime`, minus up to 30% under hard steer.
- The `cycle` preset `maxSpeed` **must stay at the ceiling (10.56)**: `effectiveMaxSpeed` derives from it and clamps both the throttle and autopilot escalation paths. Setting it to the base speed silently disables escalation (B95).

## Cycle speed envelope (B96 — supersedes the numbers above)
- `CONFIG.VEHICLES.cycle`: `baseSpeed` 8.89 m/s (32 km/h) → `maxSpeed` 14.44 m/s (52 km/h) over `rampSeconds` 120 of `cycleRideTime`. Throttle and autopilot both read these (no duplicated literals). `maxSpeed` must remain the ramp **ceiling** (B95 rule still applies).
- Steer penalty: up to 15%, updated once per step in the steering block. Cycle autopilot cruises at 90% of the current cap.
- `cycleRideTime` resets in `resetToSpline` when `preserveSpeed` is false (new shift), not on recenter.

## Cycle lean (B98)
- Lean = −atan(v·ω/g), ω = measured per-step heading change (clamped ±3 rad/s, smoothed), capped at 0.56 rad (32°), plus 12% of road banking, fed through the roll spring (ω 14, ζ 1.05). The mesh pivots at y = 0 (tire contact).
- `resetToSpline` / `snapToNearestRoadPoint` reset `_leanPrevHeading` / `_leanYawRate` so teleports don't read as a turn.

## Cycle model (B97)
- `delivery-cycle.glb` nodes: `Bike_Body` (rider + frame + box, one mesh), `Wheel_Front`, `Wheel_Rear` (origins on axles, glTF z +0.583 / −0.590, y 0.362). `buildModel()` pushes only the top-level wheel nodes into `this.wheels`; the spin uses radius 0.365 for the cycle.
- The rider is part of `Bike_Body`, so it leans with the bike; there are no arm bones to constrain.
