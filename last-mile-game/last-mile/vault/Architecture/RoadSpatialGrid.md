---
date: 2026-09-13
type: architecture
tags:
  - architecture
  - last-mile-game
ai-first: true
---

# RoadSpatialGrid

## For future agent
Architecture note on the spatial-partitioning system for roads in [[Projects/Last-Mile Game|Last-Mile Game]], saved 2026-09-13 from a graphify scan (5 nodes). Pull this when reasoning about performance of road/collision lookups.

## Overview
Spatial grid used by [[Architecture/ProceduralWorld|ProceduralWorld]] to make road lookups (nearest segment, collision checks) fast instead of scanning every road piece.

## Links
- [[Architecture/ProceduralWorld]]
