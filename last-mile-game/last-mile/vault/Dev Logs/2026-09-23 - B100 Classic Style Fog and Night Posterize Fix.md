---
date: 2026-09-23
type: devlog
tags:
  - devlog
  - visuals
  - shaders
ai-first: true
task: B100
---

# B100 — Classic Style Fog & Night Posterize Fix

## For future agent
Player report: in the Classic (pixelated) style the road ahead was unreadable at dusk (orange-red fog wall) and the asphalt went black at night. Links: [[Architecture/VisualStyleManager]], [[Projects/Last-Mile Game]].

## Root causes
- `VisualStyleManager.FOG_DENSITY.classic = 0.026` overrode the time-of-day fog. `FogExp2` is 90% opaque at `sqrt(ln 10) / density`, so ~58 m for Classic against ~290 m for Cinematic at dusk.
- The pixel shader posterized in linear space with 4 steps, so anything under 12.5% brightness rounded to black.

## Fix
- `FOG_DENSITY.classic` → 0.009 (~170 m of readable road, still hazier than Cinematic).
- Posterize in gamma space: `pow(c, 1/2.2)` → quantize → `pow(g, 2.2)`.

## Verification
Screenshots of Classic at dusk/day/night after the fog settles: road readable in all three, and the near road is dark asphalt instead of black. `run_dev_checks.js` 35/35, `verify_phase1.js` pass, 0 page errors.

## Open
- Enhanced still uses fog 0.017 (~89 m). It wasn't reported, but it has the same override pattern.
