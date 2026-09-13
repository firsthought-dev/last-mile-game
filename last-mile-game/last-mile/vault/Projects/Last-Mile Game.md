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
Core subsystems, sized by graphify's community node-count (roughly, complexity/surface area):

- [[Architecture/ShiplypEngine|ShiplypEngine]] (46 nodes) - the core engine
- [[Architecture/ProceduralWorld|ProceduralWorld]] (39 nodes) - world/road generation
- [[Architecture/SoundEngine|SoundEngine]] (31 nodes) - audio
- `game.js` (28 nodes) - top-level JS game loop
- [[Architecture/VehicleController|VehicleController]] (10 nodes) - player/vehicle physics
- [[Architecture/VisualStyleManager|VisualStyleManager]] (7 nodes) - rendering/visual style
- [[Architecture/RoadSpatialGrid|RoadSpatialGrid]] (5 nodes) - spatial partitioning for roads
- [[Architecture/RainSystem|RainSystem]] (5 nodes) - weather effects
- [[Architecture/PRNG|PRNG]] (5 nodes) - deterministic randomness
- `MainActivity` (21 nodes) - Android entry point
- `.initHUD` (25 nodes) - HUD initialization

## Key Decisions

## Known Issues
- **Fixed 2026-09-13** — [[Debugging/Floor mesh buries the streamed road|Floor mesh buries the streamed road]]: past ~8.5 km the background floor plane rendered up to 2.07 m over the asphalt, making the road look fragmented and the car look adrift on grass. Rendering bug, not physics.


## Links
- Code graph viewer (force-graph): `last-mile/android/graphify-out/graph.html`
- This vault's knowledge graph: `atlas.canvas` (vault root)

## Related Tasks

```dataview
TABLE WITHOUT ID file.link AS "Task", status AS "Status"
FROM "Tasks"
WHERE contains(file.outlinks, this.file.link)
SORT date DESC
```

## Recent Activity

```dataview
LIST FROM "Daily"
WHERE contains(file.outlinks, this.file.link)
SORT date DESC
LIMIT 5
```
