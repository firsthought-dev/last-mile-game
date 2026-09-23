---
date: 2026-09-23
type: devlog
tags:
  - devlog
  - verification
  - physics
  - cycle
ai-first: true
task: B95
---

# B95 — Fix Verification Pass (B88–B94) & Cycle Speed Escalation Cap Fix

## For future agent
Re-verification of every fix logged in the vault for B88–B94 by re-running all `scratch/` Playwright scripts against the live build. Everything held except B88's cycle speed escalation, which had been silently dead. Links: [[Projects/Last-Mile Game]], [[Architecture/VehicleController]].

## Verification results
| Fix | Script | Result |
|---|---|---|
| World/system regressions | `scratch/run_dev_checks.js` | ✅ 35/35 |
| B88 speed escalation | `scratch/verify_phase1.js` | ❌ → ✅ after fix (see below) |
| B91 cycle smooth ride | `scratch/test_cycle_smoothness.js` | ✅ ~16 km/h cornering, no speed collapse |
| B92 vehicle lock desync | `scratch/verify_vehicle_lock_sync.js` | ✅ all steps |
| B93 HUD overhaul | `scratch/verify_hud_overhaul.js` | ✅ 7/7 checks |
| B94 ad SDK | `scratch/verify_ad_sdk.js` | ✅ sponsor +₹500, cooldown, 2x bonus, interstitial |
| B89/B93 layout | `scratch/verify_ui_pack4.js` | ✅ 0 overlaps × 5 viewports |
| B94 packaging / Android sync | manual inspection | ✅ `ads.js` + `save.js` included in both |

## Bug found: cycle never escalated past 22 km/h
- `verify_phase1.js` read 19 km/h at "60s" and 18 km/h at "120s (max 38)". The script only logs, never asserts, so it had been reported green since B88.
- Root cause: the `cycle` preset's `maxSpeed` was `6.11` (the escalation base). `effectiveMaxSpeed` derives from it and clamps both the throttle and autopilot escalation paths.
- Fix: `cycle.maxSpeed: 10.56` (38 km/h ceiling) in `game.js`. Probe with throttle held at max ride time: 22 → 29 → 33 km/h, converging on 38.
- Full suite re-run after fix: all green, Muscle Coupe 54 m/s unchanged, 0 console errors. Android assets re-synced.

## Follow-up
- ✅ Done: `scratch/verify_phase1.js` now asserts cruise speed, 30% steer penalty, recovery, `maxSpeed` = 10.56 ceiling, escalation after 6 s held at max ride time (> base + 0.5 m/s, ≤ ceiling), coupe isolation and zero console errors; exits 1 on failure. Verified it fails with the old 6.11 cap.
