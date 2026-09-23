---
date: 2026-09-22
type: dev-log
tags:
  - dev-log
  - last-mile-game
  - vehicle-physics
  - cycle-smoothness
  - camera-dynamics
ai-first: true
---

# 2026-09-22 - B91 Delivery Cycle Smooth Ride and Dynamics Overhaul

## Summary
Addressed user report ("anyway that damn cycle can ride a bit smoother? :O") by identifying and resolving all physics, steering, visual, and camera causes of jerkiness, speed stutter, and visual vibration on the Delivery Cycle:

1. **Eliminated Destructive Speed Choke**:
   - Removed an unintended multiplicative speed drain (`this.speed *= (1.0 - this.cycleSteerSpeedPenalty * dt * 3.0)`) that was causing speed to collapse from 4.7 m/s to 2.0 m/s in ~1s during turning.
   - Cleanly unified `cycleSteerSpeedPenalty` to gracefully cap `cycleMax = targetBaseSpeed * (1.0 - penalty)` (preserving the 30% reduction under hard steer, e.g. 22 km/h -> 16 km/h) without chopping forward momentum.

2. **Progressive Steering Inertia & Turn Rate Balancing**:
   - Added smoothed steering input filter (`this.smoothSteerInput` with exponential decay `1.0 - Math.exp(-8.5 * dt)`) to eliminate sudden snap/whip turns on keyboard and touch.
   - Tuned `cycleBaseTurn` from twitchy 2.8 rad/s (~160°/s) to 1.65 rad/s for fluid, responsive path-following that avoids spinouts.
   - Smoothed handlebar steer angle and camber lean response (`1.0 - Math.exp(-12.0 * dt)`).

3. **Organic Pedaling Cadence & Gliding**:
   - Replaced high-frequency 7.0 Hz (420 RPM!) mesh vibration with realistic human pedaling cadence (~65–85 RPM / 1.1–1.45 Hz).
   - Softened rocking amplitudes to gentle organic levels (0.002–0.005 rad).
   - Pedaling rock now only engages when forward drive (`keys.up || keys.w`) is active; the bike glides smoothly when coasting.

4. **Soft Critically-Damped Suspension**:
   - Softened 2nd-order suspension filter from rigid `omega = 22.0–24.0` down to `omega = 13.0–14.0`.
   - Set damping ratio to critical damping `zeta = 1.05` to eliminate road elevation ringing and chatter.

5. **Cycle-Specific Chase Camera**:
   - Tuned chase camera framing to 5.6m back (from 7.8m) and 2.1m up (from 2.6m) to center the courier and cargo trolley.
   - Softened camera spring lerp rates (8.5 pos, 11.0 look) for steadycam-like fluid tracking.

## Verification
- **Automated Telemetry**: Confirmed cruising speed remains at 22 km/h (6.11 m/s), turning speed gracefully caps at 16 km/h (4.32 m/s, 70% of base), zero speed stutter, smooth progressive yaw rate (no spinning out).
- **verify_phase1.js**: All tests PASSED (Cruising speed, 30% penalty under hard steer, neutral recovery, escalation, Muscle Coupe 54 m/s isolation, 0 console errors).
- **dev-checks.js**: **35/35 PASSED (100% green)**.
- **Visual Inspection**: Captured `cycle_cruising_smooth.png` and `cycle_cornering_smooth.png` verifying camera framing, clean road surface, and natural cornering lean.
- Synced to Android assets bundle (`./last-mile/sync_android_assets.sh`).
