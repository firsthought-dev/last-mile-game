---
date: 2026-09-22
type: devlog
tags:
  - devlog
  - last-mile-game
  - economy
  - mobile
ai-first: true
---

# 2026-09-22 - B85 Vehicle Progression Economy & Mobile Drag Steer

## Summary
Implemented career progression gating, bottom-sheet unlock modal, mobile drag-to-steer controls for bicycle, and verified 35/35 regression checks.

## Key Changes
1. **Career Economy Fleet Gating**:
   - Starting fleet is locked to `['cycle']` (Delivery Bicycle).
   - Muscle Coupe (`musclecoupe`) requires ₹12,000 career earnings.
   - Dispatch selector shows remaining deficit (`NEED ₹X MORE`) and `CLAIM SHIFT` CTA.
2. **Unlock Sheet Bottom Modal (`_showUnlockSheet`)**:
   - Shows top speed, acceleration, braking stats, account balance impact, and confirmation button.
3. **In-Card Vector Canvas Thumbnails (`_drawVehicleThumb`)**:
   - Renders crisp vector illustrations dynamically onto vehicle selection cards.
4. **Mobile Drag-to-Steer Zone**:
   - Added `.touch-drag-steer` zone for delivery cycle with continuous analog input $[-1 \dots 1]$ and haptic feedback.
5. **Easy Mode Road Clearance**:
   - Adjusted `CONFIG.DIFFICULTY_TIERS.easy.minHouseDist` to `5.2m` guaranteeing clean roadside clearance.
6. **Android SDK 35**:
   - Upgraded `compileSdk` and `targetSdk` to 35 in `build.gradle.kts` for Google Play compliance.

## Verification
- Headless Playwright automated verification: **35/35 checks PASS (100% Green)**.
- Synced assets to Android shell via `./sync_android_assets.sh`.

## Links
- [[Projects/Last-Mile Game]]
- [[Architecture/SaveAndCareerSystem]]
- [[Architecture/MobileTouchAndErgonomics]]
