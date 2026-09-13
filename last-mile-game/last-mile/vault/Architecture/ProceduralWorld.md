---
date: 2026-09-13
type: architecture
tags:
  - architecture
  - last-mile-game
ai-first: true
---

# ProceduralWorld

## For future agent
Architecture note on the procedural world/road generation subsystem of [[Projects/Last-Mile Game|Last-Mile Game]], saved 2026-09-13 from a graphify code-graph scan (39 nodes). Pull this when working on world gen, road layout, or spatial queries.

## Overview
Generates the driving world procedurally. Closely tied to [[Architecture/RoadSpatialGrid|RoadSpatialGrid]] (spatial partitioning for road lookups) and [[Architecture/PRNG|PRNG]] (deterministic randomness so the world is reproducible). Weather ([[Architecture/RainSystem|RainSystem]]) likely reacts to world state generated here.

## Links
- [[Projects/Last-Mile Game]]
- [[Architecture/RoadSpatialGrid]]
- [[Architecture/PRNG]]
- [[Architecture/RainSystem]]
