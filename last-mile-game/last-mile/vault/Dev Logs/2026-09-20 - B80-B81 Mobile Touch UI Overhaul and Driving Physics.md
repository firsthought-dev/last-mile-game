---
date: 2026-09-20
type: devlog
tags:
  - devlog
  - last-mile-game
  - mobile
  - physics
ai-first: true
---

# 2026-09-20 - B80/B81 Mobile Touch UI Overhaul & Driving Physics

## Summary
Overhauled mobile touch UI ergonomics for zero bounding-box collisions, added responsive portrait FOV adaptation, and overhauled vehicle driving physics.

## Key Changes
1. **Zero-Overlap Thumb & HUD Ergonomics**:
   - 4-quadrant layout with steering cluster bottom-left, pedal + DROP cluster bottom-right, delivery capsule top-left, telemetry top-right.
   - Verified 0 bounding-box collisions across iPhone 16, Galaxy A55, and Pixel 9.
2. **Driving Physics & Bike Lean**:
   - Multi-gear progressive torque curves, pitch dive on brake, squat on accel.
   - Bicycle camber lean ($\theta \sim -0.38\text{ rad}$) inward into turns with pedaling cadence momentum band.
3. **Responsive Portrait Dynamic FOV**:
   - Dynamically scales vertical FOV from $58^\circ$ up to $75^\circ$ in portrait mode.
4. **Pure Driving Delivery Action**:
   - Removed legacy on-foot walking mode; all deliveries executed via drive-by ballistic Express Drops.

## Links
- [[Projects/Last-Mile Game]]
- [[Architecture/MobileTouchAndErgonomics]]
- [[Architecture/VehicleController]]
