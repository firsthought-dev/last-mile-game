---
date: 2026-09-13
type: architecture
tags:
  - architecture
  - last-mile-game
ai-first: true
---

# ShiplypEngine

## For future agent
Architecture note on the core engine of [[Projects/Last-Mile Game|Last-Mile Game]], saved 2026-09-13 from a graphify code-graph scan (46 nodes, the largest single community in the codebase). Pull this when reasoning about how the engine ties the other subsystems together.

## Overview
The largest cluster in the codebase - likely the central orchestrator that the other subsystems ([[Architecture/ProceduralWorld|ProceduralWorld]], [[Architecture/VehicleController|VehicleController]], [[Architecture/SoundEngine|SoundEngine]], [[Architecture/VisualStyleManager|VisualStyleManager]]) plug into. TBD: exact responsibilities - not yet manually reviewed, only surfaced by community detection.

## Notes
- (speculation, confidence: medium) Given its size relative to other communities, this is probably the main game-loop / update-tick owner.

## Links
- [[Projects/Last-Mile Game]]
