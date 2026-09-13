---
date: 2026-09-13
type: debug
tags:
  - debug
  - last-mile-game
  - resolved
ai-first: true
status: fixed
confidence: high
---

# Floor mesh buries the streamed road

## For future agent
Root-cause note for the "car drives on grass / road breaks into disconnected fragments past ~8.5 km" bug in [[Projects/Last-Mile Game|Last-Mile Game]], diagnosed and fixed 2026-09-13. The car was never actually off the road — the background floor plane was rendering up to 2.07 m *on top of* the asphalt. Read this before touching `createFloorMesh`, `sweepTerrainBelowRoad`, or the streaming path in [[Architecture/ProceduralWorld|ProceduralWorld]].

## Symptom
Past roughly 8.5 km of a drive, the road visually breaks into disconnected dark fragments scattered on grass and the car appears to be driving across open field — while the HUD stays completely normal (cruise speed held, no off-road warning, no "Return to Road" banner). Reproduced identically on web and Android.

## Why it looked like a physics bug (and wasn't)
It is a **rendering / stale-baked-geometry bug**, not a vehicle or road-generation bug. The car really is on the asphalt the whole time — which is exactly why every HUD indicator reads normal. Measured during the failure: distance from road centreline stayed ~1 m. That mismatch (looks catastrophic, telemetry says fine) is what made it hard to spot by reading vehicle/physics code.

## Root cause
`createFloorMesh` bakes each floor vertex's height against the road **as it exists at world-build time** (the initial `ROAD_POINTS_COUNT: 700` × 12 m ≈ 8.36 km spline):

- within 40 m of the road → buried 25 m under the ribbon
- 40–45 m → blended up to natural terrain height
- within 75 m → hard safety clamp, never above `roadY - 1.5`
- past 95 m → left at raw terrain height

`extendSpline` then streams the road on for kilometres past that original spline. Wherever the weaving new road re-enters the floor plane's XZ footprint, those vertices were baked with **no road anywhere near them**, so they sit at raw terrain height. On any cut/graded stretch that is *above* the new asphalt, so the floor renders over the road and the car. Where the floor happens to dip back below the asphalt, the road pops back into view — producing the disconnected-fragments look.

`sweepTerrainBelowRoad` exists to fix exactly this class of problem after each stream, but it iterates `this.terrainMeshes`, and **`floorMesh` is not in that array** — so the one mesh that most needed re-clamping was the only one excluded.

## Evidence (seed `5927cd04`, mumbai)
| | before | after |
|---|---|---|
| buried road samples | 9 | 0 |
| first breach | 8526 m | — |
| max floor-over-asphalt | 2.07 m | 0.00 m |

Every breach was past the 8360 m initial spline — none before it.

Ruled out along the way (worth not re-testing): CatmullRom curve drift on extension is only **0.44 m max**, not metres; the `splineProgress` node-count rescale is accurate to ~0.01%; terrain-ribbon breaches were 0.

## Fix
Added `*sweepFloorBelowRoad()` to [[Architecture/ProceduralWorld|ProceduralWorld]], called from `_streamBuildSequence` right after `sweepTerrainBelowRoad()`. It re-applies `createFloorMesh`'s own constants (40/45/75/95, −25/−1.5) against the **current** road, using a 100 m spatial hash so the ~140 k-vertex walk only pays full cost near the road, and yields like the other stream passes so it never blocks a frame.

It clamps **downward only** — so repeated sweeps converge, and it can never lift the floor back out from under geometry it is meant to hide beneath.

## Deduplication (2026-09-13, later)
A second agent independently added a floor-carving block *inside* `sweepTerrainBelowRoad`, so the floor was being clamped twice per stream by two mechanisms. Both clamped downward-only, so nothing was corrupted — but it was double cost and two copies of the same rule. The inline block was removed; `sweepFloorBelowRoad` is the single owner.

Kept the inline version's genuinely separate fix: the terrain clamp is now height-bounded (`y > ceiling && y < nr.y + 4.5`) so tall bluffs above a switchback are no longer crushed down to road level.

Why this one was kept: the removed block only swept the bounding box of the last 450 road points (missing burial where the road loops back into the floor footprint elsewhere), cut off hard at exactly 75 m with no outer blend (the hard-switch failure `createFloorMesh`'s own comments warn about), and never recomputed floor normals.

## Applied to
One shared `game.js` powers every platform (Android is a WebView loading the same file via `sync_android_assets.sh`), so the same patch covers all of them:
- `last-mile/game.js` (web)
- `last-mile/android/app/src/main/assets/game.js` (Android, synced)
- `game.js` (repo-root deployment served by `server.py`)

`dev-checks.js` `runWorldChecks()`: 35/35 after the fix.

## Links
- [[Projects/Last-Mile Game]]
- [[Architecture/ProceduralWorld]]
