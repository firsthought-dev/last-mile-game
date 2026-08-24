# Tower Defense

**Difficulty:** ⭐⭐⭐ Medium | **Well-supported, one impressive full AI agent example**

---

## A. Real Examples from the Community

### Crystal Keep (GodotIQ full AI agent)
- **Source:** [DEV Community article](https://dev.to/salvo10f/an-ai-agent-built-a-complete-3d-tower-defense-in-godot-heres-how-lpd)
- **Engine:** Godot 4 (3D)
- **AI Tool:** Claude Code via GodotIQ MCP server (36 tools across 9 categories)
- **What was built:** A fully playable 3D tower defense with:
  - 12×10 terrain map with S-shaped pathways
  - 4 distinct tower types, each with 3 upgrade levels
  - 4 enemy varieties + boss enemies every 5 waves, 20 total waves
  - Complete UI: main menu, tutorial, game over screen with stats
  - Camera controls, game speed adjustment (1×/2×/3×)
  - Visual effects: screen shake, damage popups
- **Approach:** Given a game design document and the Kenney Tower Defense Kit, the agent ran a "build, verify, fix, test" loop "hundreds of times"
- **Key feature:** GodotIQ let the agent simulate player input by "clicking on 3D positions" to test tower placement exactly as users would
- **What failed:** None documented — the article presents this as a success story

### Bitcoin Tower Defense
- **Source:** [paperstreetstudios.substack.com](https://paperstreetstudios.substack.com/p/from-zero-to-game-dev-hero)
- **Theme:** Bitcoin/crypto themed
- **AI Tools:** Grok, Cursor, GitHub Copilot
- **Time:** 7 days (MVP in 2 days, refinement days 3–7)
- **What worked:** "Zero experience to a working game in seven days"
- **What didn't:** "Mobile optimization took days of prompt-tweaking torture"
- **Shipped:** Yes. Acknowledged as "clunky" with "janky code" but functional.

### Defense of the Phasers
- **Source:** [cemkalyoncu.itch.io/dotp](https://cemkalyoncu.itch.io/dotp)
- **Engine:** Phaser 3 (name is a pun)
- **Shipped:** Yes, itch.io

### Vibe TD
- **Source:** [2b1r.itch.io/vibe-td](https://2b1r.itch.io/vibe-td)
- **Label:** Explicitly labeled as vibe-coded
- **Shipped:** Yes, itch.io

---

## B. Recommended Stack

**Best overall:** Godot 4 — the 3D Crystal Keep example shows what's possible. For 2D tower defense, Godot's built-in tilemap system, pathfinding (AStar2D/NavigationAgent2D), and scene instancing make it a natural fit.

**Browser-friendly:** Phaser 3 — works well for 2D tower defense. Grid-based placement, enemy path following, and tower targeting are all well within Phaser's capabilities. Deploys as a single HTML file.

**MCP Enhancement:** If you're using Godot, GodotIQ adds 36 additional tools including spatial intelligence, code analysis, and runtime game control. It was central to the Crystal Keep build.

**Asset Packs:**
- Kenney Tower Defense Kit (free, CC0) — the exact asset pack used to build Crystal Keep
- Kenney Assets at kenney.nl/assets — comprehensive free game art

---

## C. Prompting Strategy

**Tower defense has well-defined components — build them in order:**

1. **Grid/map** — display the playfield with defined path vs. buildable areas
2. **Enemy path** — enemies follow a fixed path from spawn to exit
3. **Enemy spawning** — wave-based spawner
4. **One tower type** — click to place, attacks nearest enemy in range
5. **Enemy health + removal** — enemies lose HP, die, disappear
6. **Lives + currency** — lose a life when enemy reaches exit, earn gold on kill
7. **Second tower type** — different attack style
8. **Wave progression** — harder enemies each wave
9. **UI** — lives, gold, wave counter, tower selection panel

**Pathfinding prompt:**
```
Enemies follow a fixed path defined as waypoints array:
const PATH = [{x:0,y:300},{x:200,y:300},{x:200,y:100},{x:600,y:100},{x:600,y:500}]
Implement path following using linear interpolation between waypoints.
Speed: 80px per second. Rotate enemy sprite to face movement direction.
Do NOT use Phaser's pathfinding — use the waypoints array directly.
```

**Tower targeting prompt:**
```
Towers attack enemies in range:
- Check all enemies each frame
- Find nearest enemy within tower.range (in pixels)
- If cooldown has expired, fire a projectile toward that enemy
- Projectile travels at 300px/s, disappears on hit
- Tower cannot target enemies that are dying
```

**For Godot NavigationAgent2D pathfinding:**
```
Use NavigationAgent2D for enemy pathfinding.
Enemies navigate from SpawnPoint (position A) to Base (position B).
Do not hardcode waypoints — use the navigation mesh baked in the scene.
Enemy.gd handles movement: call get_next_path_position() each physics frame.
```

---

## D. Common Pitfalls

**Mobile optimization is brutal:** The Bitcoin TD developer spent "days of prompt-tweaking torture" on mobile. Tower defense games have many objects on screen — performance tanks on mobile. Address this early:
- Request object pooling for projectiles
- Limit the number of enemies that evaluate pathfinding each frame
- Use Phaser's `setActive(false)` pattern for off-screen objects

**Towers attacking dead enemies:** Towers often continue targeting enemies that are dying (fading out) because the enemy object still exists. Add a `isDying` flag and filter targeting accordingly.

**Path-blocking:** Players placing towers on the enemy path (accidentally or intentionally) needs to be prevented. Add a validity check before placing a tower:
```
Before placing tower at (x, y), verify the path remains unblocked:
- Temporarily mark the cell as blocked
- Run pathfinding from spawn to exit
- If no path found, reject placement and show error message
- Otherwise confirm placement
```

**Wave balance:** AI-generated wave difficulty curves are almost always wrong. Test wave 1, wave 5, and wave 10 before shipping. Adjust enemy HP and speed multipliers manually.

**Currency economy:** AI often generates economies that are either too generous (towers become trivially cheap) or too stingy (players can't afford any towers until wave 5). Test the full economy loop.

---

## E. Kick-off Prompt Template

```
I'm building a 2D tower defense game in Phaser 3 (single HTML file, CDN).
Canvas: 900x600. Grid: 30x20 cells, each 30px.

Enemy path (hardcoded for now):
- Enemies enter from left edge (x=0, y=300)
- Path: (0,300) → (300,300) → (300,150) → (600,150) → (600,450) → (900,450)
- Enemies exit at right edge (x=900, y=450)

First session — build ONLY:
1. Display the grid (gray cells for buildable, beige for path cells)
2. One enemy type: red circle (20px radius), follows the path at 80px/s
3. One enemy spawns every 2 seconds, max 20 per wave
4. Enemy disappears when it reaches the exit (no lives system yet)

Do NOT add: towers, money, lives, waves, or UI yet.
Confirm enemies travel the correct path before we add towers.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Grid + enemy path working | 1–2 hours |
| One tower type + currency loop | 1 day |
| 3 tower types + wave system | 2–3 days |
| Polished release (UI, art, balancing) | 1–2 weeks |
| 3D tower defense (Godot, Crystal Keep quality) | Several weeks with MCP tools |

**"Done" at MVP:** 1–2 tower types, 5 waves, enemies die or reach the exit, lose condition clear.

**"Done" polished:** 4+ towers each with upgrades, 5+ enemy types including bosses, 20 waves, polished UI, Kenney assets replacing placeholders.

---

*Sources: [DEV Community Crystal Keep](https://dev.to/salvo10f/an-ai-agent-built-a-complete-3d-tower-defense-in-godot-heres-how-lpd) · [paperstreetstudios Bitcoin TD](https://paperstreetstudios.substack.com/p/from-zero-to-game-dev-hero) · [Defense of the Phasers](https://cemkalyoncu.itch.io/dotp) · [Vibe TD](https://2b1r.itch.io/vibe-td)*
