---
date: 2026-09-27
type: architecture
tags: [architecture, last-mile-game]
---
# Auto Assists (Auto Steer / Auto Drive)

Two mutually exclusive driver assists on the `Vehicle` in `game.js` (B114):

| Assist | Flag | Key | Desktop | Touch | Does |
|---|---|---|---|---|---|
| Auto Steer | `isAutodrive` | F | `#btn-hud-autodrive` | `#touch-btn-autopilot` (A-STEER) | Pure-pursuit steering along the road and curve-aware speed |
| Auto Drive | `isCruise` | G | `#btn-hud-cruise` | `#touch-btn-cruise` (A-DRIVE) | Curve-aware speed only; the player steers |

- `Vehicle._roadAhead(world)`: finds the spline point 10–36 m ahead (scaled with speed) and returns the heading difference to it.
- `Vehicle._applyAutoSpeed(turnDeflection, …)`: sets the target speed (cycle 90% / car 72% of the cap, cut to as low as 35% in sharp bends), then accelerates or brakes toward it.
- Auto Steer also skips the manual steering block and uses tighter tyre convergence (14.0).
- Auto Drive runs in the manual branch in place of the throttle chain, so manual steering, cycle lean and car drift all still apply.
- **Disengage:** pressing the brake (`down`/`s`) clears both, then calls `game.updateAutoAssistHUD()`.
- **Toggles:** `game.toggleAutodrive()` and `game.toggleCruise()` each turn the other one off. `dev-checks.js` still uses `toggleAutodrive` and `isAutodrive`.

Links: [[Projects/Last-Mile Game]] · [[Architecture/SoundEngine]]
