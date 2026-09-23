---
date: 2026-09-13
type: architecture
tags:
  - architecture
  - last-mile-game
ai-first: true
---

# VisualStyleManager

## For future agent
Architecture note on the rendering/visual-style subsystem of [[Projects/Last-Mile Game|Last-Mile Game]], saved 2026-09-13 from a graphify scan (7 nodes).

## Overview
Manages rendering style/visual theme. Likely reacts to [[Architecture/RainSystem|RainSystem]] state (lighting/fog changes for weather) - TBD, unconfirmed.

## Links
- [[Architecture/RainSystem]]

## Fog override & posterize (B100)
- `VisualStyleManager.FOG_DENSITY` overrides the time-of-day fog density for Classic (0.009) and Enhanced (0.017); Cinematic uses the time-of-day value. `FogExp2` is 90% opaque at `sqrt(ln 10) / density` metres, so check any change at dusk and night.
- The Classic pixel shader posterizes in gamma space (4 steps). Linear-space posterize rounded everything under 12.5% brightness to black.
