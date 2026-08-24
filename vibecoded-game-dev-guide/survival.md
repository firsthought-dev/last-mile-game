# Survival Games

**Difficulty:** ⭐⭐⭐⭐ Hard | **Resource management is easy; world simulation and content are the challenge**

---

## A. Real Examples from the Community

### Broth & Bullets (MMORPG Survival)
- **Source:** [SpacetimeDB blog + community Discord](https://spacetimedb.com/blog)
- **Genre:** Multiplayer survival MMORPG (survival meets extraction shooter)
- **Backend:** SpacetimeDB (server-authoritative real-time database)
- **Notable:** Built with AI assistance during a SpacetimeDB game jam. Represents the ambition ceiling for vibe-coded survival — real-time multiplayer survival is one of the hardest possible builds.
- **What worked:** SpacetimeDB handles the entire server state, inventory sync, and player persistence — removing the hardest backend engineering problem. AI could focus on game logic rather than network architecture.
- **Shipped:** Yes (jam release)

### Survival genre (vibecode.game community)
- **Source:** [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre)
- **Pattern:** Single-player survival games with crafting loops (harvest resource → craft tool → harvest better resource) appear regularly. Most browser-based with minimal art.
- **Common failure:** Starting too ambitious (full open world, day/night cycle, multiple biomes) and getting stuck at the "game feels empty" phase.

### Farm Clicker (survival-adjacent)
- **Source:** [hagbart80.itch.io/farm-clicker](https://hagbart80.itch.io/farm-clicker)
- **Note:** Farm games are survival-adjacent — manage resources, survive seasons, expand. Simpler than full survival but shares the core loop.
- **Shipped:** Yes, itch.io

### Roguelite Survival (community pattern)
- **Source:** r/vibecoding, r/aigamedev
- **Pattern:** Survival + roguelite is a more achievable combination than open-world survival. Each "run" has a limited scope: survive 10 waves of enemies, manage 3 resources (food/water/health), roguelite upgrades between runs.
- **Why it works for vibe coding:** The bounded scope (one run = one session) matches AI context window limits. You don't need a persistent world.

---

## B. Recommended Stack

Full open-world survival (think Rust, Valheim, Don't Starve) is too complex for a solo vibe-coded game without months of work. The vibe coding community has converged on more achievable survival sub-genres:

**Roguelite survival (recommended for beginners):**
- **Phaser 3** — handles wave survival, item drops, basic crafting, and a finite play session (survive N waves) cleanly. Best for browser deployment.
- **Godot 4** — for more complex roguelite survival with animated characters and varied environments.

**Survival crafting (bounded map):**
- **Godot 4** — for a bounded island/zone with resource nodes, crafting, and a day/night cycle. The NavigationAgent2D and TileMap systems handle the spatial elements.
- **Python + Pygame** — surprisingly good for top-down survival with text-heavy crafting menus. Lower visual bar, higher AI accuracy.

**Multiplayer survival (advanced):**
- **SpacetimeDB + Godot or Unity** — SpacetimeDB removes the hardest part (server state, player persistence, real-time sync). Without SpacetimeDB, multiplayer survival requires a backend engineering project that dwarfs the game itself.

**What to avoid:** Unreal Engine for survival. The asset-heavy workflow and blueprint system make AI-assisted iteration nearly impossible for survival's complex interlocking systems.

---

## C. Prompting Strategy

**Define the survival loop precisely before coding.** "Survival game" is underspecified — it could mean anything. Be exact:

```
My survival game's core loop:

1. GATHER: Player moves around a bounded map, collects resources by pressing E near them.
   - Wood (from trees): 1–3 per tree, tree disappears on full harvest, respawns in 60s
   - Stone (from rocks): 1–2 per rock, same respawn rules
   - Food (from bushes): 1 per bush, respawn 30s
   
2. CRAFT: Open inventory (I key), combine resources into tools:
   - Axe: 3 wood → faster wood gathering (2×)
   - Pick: 3 stone → faster stone gathering (2×)  
   - Campfire: 5 wood + 2 stone → required to survive night

3. SURVIVE: Day/night cycle (60s per day, 40s day + 20s night)
   - Night: player takes 1 HP/sec if not near campfire
   - Player HP: 100. Death: game over, show score (days survived)
   
4. PROGRESS: Each day, more enemy spawns appear at night.

Define all these rules in gameRules.js before writing any other code.
```

**Day/night cycle prompt:**
```
Day/night cycle:
- Full day = 60 real seconds (40s day, 20s night)
- Day: orange-tinted light, ambient sound "birds.ogg"
- Night: dark blue overlay (Canvas: fillRect black at 0.7 opacity), "crickets.ogg"
- Transition: 5-second crossfade at dusk/dawn
- Display: "Day 3 | Night" or "Day 4 | Day" in top corner
- Night warning: at 35s into day, display "Night approaching" (amber text, 5s)
```

**Resource node system:**
```
Resource nodes:
- Trees: spawn at random positions on map, avoid 100px from spawn point
- Each tree is a green 24px circle. Pressing E within 48px: harvest
- Harvest removes 1 "durability" per press. Tree has 3 durability.
- When durability = 0: remove tree, schedule respawn in 60 real seconds
- Show "empty" indicator for 1 second before tree disappears
- Respawning trees appear with a "grow" animation (scale 0 → 1 over 0.5s)
```

**Crafting system:**
```
Crafting system:
- All recipes defined in recipes.js:
  [{id: "axe", name: "Stone Axe", requires: {wood: 3, stone: 2}, produces: "axe", category: "tools"}]
- Inventory: flat object tracking quantities: {wood: 0, stone: 0, food: 0}
- Crafting UI: show recipe, required materials (red if insufficient, green if met), Craft button
- On craft: deduct materials, add item to equipment slot
- Equipment affects game logic: Axe equipped → wood harvest gives 2 instead of 1
```

**Enemy wave system (for roguelite survival):**
```
Enemy waves:
- Wave N spawns at the start of night N
- Wave 1: 3 basic enemies (speed: 60px/s, hp: 10, damage: 5/s on contact)
- Each wave: +2 enemies, +5 HP per enemy, same speed (don't ramp speed until wave 5)
- Enemies spawn from map edges (random edge position)
- Enemies move toward player using simple "move toward" logic (no pathfinding needed for MVP)
- On player death: show wave reached + total score (resources gathered)
```

**Hunger/thirst (optional layer):**
```
Add hunger system:
- Player has Hunger: 100. Decreases 1/s during day, 2/s during night.
- Hunger 0: player takes 2 HP/s until they eat
- Food in inventory: press F to eat (restores 20 Hunger)
- UI: Hunger bar in bottom-left, red when below 25
Do NOT add thirst until hunger is tested and working.
```

---

## D. Common Pitfalls

**"Empty world" feeling.** Survival games with procedurally sparse resources feel desolate and unfun in the early game. The resource density needs to feel generous enough to engage the player immediately. Start with too many resources, then tune down — not the reverse.

**Crafting prerequisite chains that stall progress.** Crafting chains where you need Tool A to get Resource B to make Tool B to get Resource C create bottlenecks. The player dies waiting to gather. Design the first 5 minutes of the game (the critical onboarding window) so the player can craft a basic survival item within 60 seconds of starting.

**Day/night pacing.** The transition point between "too easy to survive the night" and "survive the night" is very abrupt in AI-generated survival games. The first night should be survivable by any player who engaged with the tutorial. If Night 1 kills most players, the game feels broken. Tune enemy wave 1 to be trivially beatable.

**Resource respawn desynchronization.** If resources respawn at fixed real-time intervals but the player doesn't know when they'll respawn, they'll clear an area and stand around waiting. Either make respawn visible (grow animation) or add enough resource nodes that the player is always moving.

**Inventory UI complexity.** Survival games need more UI than almost any other genre: HP, hunger, thirst, inventory, crafting menu, day counter, wave counter. Define the UI layout in a sketch (even just written) before asking Claude to implement it:
```
UI Layout:
- Top-left: HP bar (red, 200px wide)
- Top-right: Day counter + time of day
- Bottom-left: Hunger bar (orange)
- Bottom-center: Hotbar (5 slots, 50x50px each)
- Press I: toggle Inventory overlay + Crafting panel (side by side)
```

**Multiplayer survival without SpacetimeDB.** Attempting real-time multiplayer survival with websockets and manual state sync is one of the most difficult engineering tasks in this genre. Unless you're using SpacetimeDB or a similar backend-as-a-service, don't attempt multiplayer survival. Build the single-player version first and add multiplayer only if the game is compelling enough to warrant it.

---

## E. Kick-off Prompt Template

```
I'm building a top-down survival game (single player, browser, Phaser 3 + single HTML, CDN).
Canvas: 900x600. Map: scrollable world, 2400x1600 virtual size.

Core loop: Gather resources → craft basic tools → survive the night

Resources (circles on map, E key to harvest):
- Tree (green circle, 30px): gives Wood, 3 durability, respawn 45s
- Rock (gray circle, 25px): gives Stone, 2 durability, respawn 60s
Player inventory: tracks Wood and Stone counts (display top-left)

Day/night:
- 60 real seconds per cycle: 40s day (bright), 20s night (dark blue overlay, 0.6 opacity)
- Night: enemies spawn and move toward player
- Display current day and time (Day 1, Daytime / Night)

Player: 32x32 green rectangle, WASD movement 200px/s, HP 100

Enemies (night only): red 24px circles, spawn from random edge, 
move toward player 80px/s, deal 10 HP damage on contact, die in 1 hit (for MVP)

First session — build ONLY:
1. Scrollable map with 20 trees and 15 rocks scattered randomly
2. Player moves with WASD, camera follows
3. E key near resource: harvest (reduce durability, show count in inventory)
4. Resource disappears at 0 durability, respawns after timer
5. Day/night visual cycle (no enemies yet)

Do NOT add: enemies, crafting, HP damage, combat, or UI beyond the inventory count.
Confirm resource gathering works before any other system.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Resource gathering + day/night cycle | 2–4 hours |
| Basic crafting (3 recipes) | 1–2 days |
| Enemy wave system (survive the night) | 1–2 days |
| HP, hunger, combat loop | 1–3 days |
| Polished survival loop (art, sound, balance) | 1–3 weeks |
| Open world survival (multiple biomes, full crafting tree) | Several months |

**"Done" at MVP:** Player gathers 2 resources, crafts 1 item, survives 3 nights against simple enemies.

**"Done" polished:** Day/night cycle with atmosphere, 5+ resources, 10+ crafting recipes, 5 enemy types, wave scaling, UI with all survival bars, save/load, itch.io published.

**Recommended starting genre for survival fans:** Start with the roguelite survival variant (survive N waves, run ends, upgrade and run again) rather than persistent open-world survival. The bounded scope makes every session completable in 5–10 minutes, which is ideal for vibe-coded iteration and for players.

---

*Sources: [SpacetimeDB blog](https://spacetimedb.com/blog) · [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre) · [Farm Clicker itch.io](https://hagbart80.itch.io/farm-clicker) · [r/vibecoding](https://reddit.com/r/vibecoding)*
