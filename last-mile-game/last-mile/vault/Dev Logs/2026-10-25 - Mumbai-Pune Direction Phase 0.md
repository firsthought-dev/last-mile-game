# Mumbai-Pune Direction: Phase 0

**Date:** 2026-10-25

Work started on a new direction for the game: one city that blends Mumbai's density with Pune's gentler streets and hills, with traffic that drives itself, real collisions, and a subtle comic look. Name and zone list are still working titles and not final.

This note grows as Phase 0 units land. Nothing here changes how the game plays yet.

- **Branch and plan:** work happens on its own branch, started from the modular code base. The game stays playable the whole time.
- **Retention and release work runs alongside the city work**, not after it, so progress can be measured from the start.
- **Open decision:** whether AI vehicle traffic returns after being removed in August. Nothing that depends on it is built until that is answered.
- **Baseline measured:** the current sharp-outline look is heavier than the target for mid-range phones, so lighter ways to draw outlines will be tested before more is added to the scene.
- **A start-up layout issue was found** for first-time players (some garden plants sit in front of delivery houses). Evidence is gathered; the fix waits for a go-ahead.
- **Junction prototype:** a four-way junction was prototyped two different ways on a side branch, to choose how roads with crossings will be represented. The choice is pending.
- **Streak forgiveness and a daily goal arrive** (from an earlier unmerged experiment): one missed day no longer wipes the streak, and delivering three parcels in a day pays a bonus. The hub shows today's goal. Progress on a new device or after reinstall is unchanged (still on-device).
- **Gameplay measurements:** a small set of anonymous play events (opens, shifts, deliveries, misses, unlocks, session length, smoothness samples) is now recorded inside the game. On the web nothing leaves the device; on Android it only appears in debug logs for now. Players can switch it off.
- **Android release prep:** automatic cloud backup of game data is switched off, and release-build rules keep the new event hook working.
- **Easier first delivery:** new players now start further back from their first house, slow down near it, get put back on the approach if they drive past, and lose nothing for dropping too early. Testing with real new players is still to do.
- **More varied pedestrians:** crowds now mix men and women, different skin tones and outfits (tees, long tunics, shorts, long trousers, skirts, sarees) with long or tied-up hair, and read in real colours instead of near-black. Each person is drawn with far fewer GPU draw calls.
- **Traffic vehicle shapes:** simple generic shapes for scooters, cars, an SUV, a cab, an auto, a goods tempo and two buses were blocked out, to be refined from street photos.

Related: [[Projects/Last-Mile Game]], [[2026-10-25 - Modular Codebase Architecture Split]]
