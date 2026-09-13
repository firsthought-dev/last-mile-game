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
