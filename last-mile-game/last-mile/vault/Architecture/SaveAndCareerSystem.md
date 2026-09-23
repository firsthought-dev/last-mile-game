---
date: 2026-09-22
type: architecture
tags:
  - architecture
  - last-mile-game
  - career
  - save-system
ai-first: true
---

# Save & Career System (`save.js`)

## For future agent
Architecture documentation for the persistent career progression and player wallet save layer in [[Projects/Last-Mile Game|Last-Mile Game]], implemented 2026-09-22. Reference this before modifying player progression, unlocking mechanics, delivery fee payouts, or rank tiers.

## Overview
The career and save system provides zero-dependency client-side persistence via `localStorage` (key: `shiplyp_career_save_v1`). It manages:
1. **Financial Wallet & Career Earnings**: Tracks lifetime earnings (`careerEarnings`) vs current liquid balance (`walletBalance`).
2. **Rank Progression**: Dynamic tier title based on cumulative earnings (Intern → Junior Courier → Senior Driver → Fleet Lead → Corridor Master).
3. **Streak & Multipliers**: Tracks on-time delivery chains and daily consecutive driving streaks.
4. **Star Ratings**: Performance-based delivery evaluation (5 stars for pristine delivery time and zero collision impact).
5. **Fleet Gating & Unlocks**: Controls unlocked vehicles (`unlockedVehicles: ['cycle', ...]`), price checks, and shortfall calculations.

## Data Schema (`CareerState`)
```json
{
  "version": 1,
  "walletBalance": 1250,
  "careerEarnings": 1250,
  "totalDeliveries": 3,
  "currentStreak": 3,
  "bestStreak": 3,
  "rank": "Junior Courier",
  "starsEarned": 14,
  "unlockedVehicles": ["cycle"],
  "selectedVehicle": "cycle",
  "lastPlayedDate": "2026-09-22"
}
```

## Fleet Economy Gating
- **Delivery Cycle (`cycle`)**: Default unlocked (₹0).
- **Muscle Coupe (`musclecoupe`)**: Gated behind ₹12,000 career earnings.
  - Shortfall prompt: Displays `NEED ₹X MORE` and dynamic `CLAIM SHIFT` call to action.
  - Interactive bottom-sheet modal (`_showUnlockSheet`) displays vehicle stats (Top Speed, Accel, Braking), balance deduction, and confirmation.

## Integration Points
- `game.js`: Calls `CareerManager.onDeliveryComplete(reward, stars)` upon ballistic package drop plinth trigger.
- `save.js`: Exposes `CareerManager` singleton with safe serialization, migration fallbacks, and test reset hooks (`resetProgress()`).

## Links
- [[Projects/Last-Mile Game]]
- [[Dev Logs/2026-09-22 - B85 Vehicle Progression Economy and Mobile Drag Steer]]
