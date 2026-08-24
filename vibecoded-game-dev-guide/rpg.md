# RPG & Role-Playing Games

**Difficulty:** ⭐⭐⭐⭐ Hard | **Highest complexity genre — requires careful system isolation**

---

## A. Real Examples from the Community

### Azure Flame Dungeon
- **Source:** [Chier Hu survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)
- **Genre:** Dungeon-crawler RPG
- **Engine:** Python + Pygame
- **Lines of Code:** 22,000+
- **What worked:** Grew to enormous size through iterative AI sessions — each session added a new system (inventory, combat, leveling, spells). The Python text-serialized format was easy for Claude to read and edit accurately.
- **Key lesson:** At 22,000 lines, the codebase was still manageable for Claude because Pygame uses plain Python files, not binary assets.
- **Shipped:** Yes

### Spell Cascade
- **Source:** [Chier Hu survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992) · Godot community
- **Genre:** Roguelite RPG / spell-caster
- **Engine:** Godot 4.3
- **Lines of Code:** 7,220
- **Commits:** 235
- **Notable stat:** Yurukusa, the developer, ran 5 games in 30 days. This was the most complex. The commit count shows iterative, steady development — not one big session.
- **Revenue:** Listed at $4.99 on itch.io. Part of a developer earning money from AI-assisted games.
- **Shipped:** Yes, itch.io

### CODEX MORTIS
- **Source:** [CODEX MORTIS Steam page](https://store.steampowered.com/app/2900760/CODEX_MORTIS/)
- **Genre:** Tactical RPG
- **Engine:** TypeScript + PixiJS + bitECS
- **Time:** ~3 months, 100% AI-generated code (no manual coding)
- **Notable:** Shipped on Steam — the clearest case of a full commercial RPG built via vibe coding. Used bitECS (Entity Component System) for game state management.
- **Shipped:** Yes, Steam

### Dice Odyssey
- **Source:** [leseau.itch.io/dice-odyssey](https://leseau.itch.io/dice-odyssey)
- **Genre:** Dice/slot hybrid with RPG progression — roguelite dungeon structure, dice rolls drive combat and rewards, character progression between runs
- **Note:** The RPG and card-game genres increasingly overlap in the vibe coding community. Dice Odyssey blends slot machine mechanics, Luck Be a Landlord-style synergy discovery, and RPG dungeon crawling.
- **Shipped:** Yes, itch.io

---

## B. Recommended Stack

RPGs are the most data-heavy and system-heavy genre. Every choice matters because mistakes at the architecture level compound over time.

**Best for desktop RPG:**
- **Godot 4** — scene-based architecture matches RPG structure naturally. Each "room" is a scene, enemies are instanced nodes, items are resources. The built-in save system handles serialization. GDScript is readable enough for Claude to generate correctly.
- **Python + Pygame** — best for dungeon crawlers and text-heavy RPGs without complex visual animation. Favored by developers who want maximum AI editability (Azure Flame Dungeon approach).

**Best for browser RPG:**
- **Phaser 3** — handles tile-based maps, sprite animation, and turn-based combat. Use Tiled (free map editor) to define maps as JSON, which Claude can read and modify.
- **TypeScript + PixiJS + bitECS** — what CODEX MORTIS used. ECS architecture is particularly well-suited to RPGs because each entity (player, enemy, NPC) is just a collection of components (position, health, inventory) rather than a class hierarchy.

**Data-driven content (mandatory for RPG):**
- Define ALL items, spells, enemies, and skills as JSON or data objects before writing systems
- This is non-negotiable for RPGs — hardcoded content leads to unmaintainable spaghetti
- CODEX MORTIS stored all game content in structured data; the AI systems just operated on that data

---

## C. Prompting Strategy

**RPGs require the most upfront planning of any genre.** Skipping planning leads to the "Nezumi Swarm failure" — trying to implement combat + inventory + leveling + story simultaneously and getting total breakdown.

**Define all game systems in a planning document before coding:**
```
RPG Systems (implement in this exact order, one at a time):

1. WORLD: Tile-based map, player moves with arrow keys, camera follows
2. COMBAT: Turn-based. Player attacks = roll d6 + strength modifier. 
           Enemy attacks = roll d4 + enemy_power.
3. HP SYSTEM: Player has 20 HP, enemies have hp defined in enemies.json
4. INVENTORY: Collect items, show in panel, equip weapons/armor
5. LEVELING: Gain XP from kills, level up every 100 XP, +2 to one stat
6. SPELLS: Mana resource, cast from hotbar, defined in spells.json
7. DIALOGUE: NPC conversations with branching, using Ink syntax
8. SAVE: Save player position, inventory, HP, level to localStorage

Do NOT attempt to implement more than one system per session.
```

**Data files to create before any code:**
```json
// enemies.json
[
  {"id": "goblin", "name": "Goblin", "hp": 8, "power": 2, "xp": 15, "loot_table": ["coin", "dagger"]},
  {"id": "troll", "name": "Cave Troll", "hp": 25, "power": 6, "xp": 50, "loot_table": ["big_club", "troll_hide"]}
]

// items.json
[
  {"id": "dagger", "name": "Dagger", "type": "weapon", "damage_bonus": 2, "description": "A short blade."},
  {"id": "health_potion", "name": "Health Potion", "type": "consumable", "effect": "heal", "value": 15}
]

// spells.json
[
  {"id": "fireball", "name": "Fireball", "mana_cost": 5, "damage": 12, "target": "single", "description": "Hurls a ball of fire."}
]
```

**Combat prompting:** Turn-based combat is where most RPG implementations fail. Be explicit:
```
Implement turn-based combat:
- Player selects: Attack, Spell, Item, or Flee
- Attack: roll 1d6 + player.strength, subtract from enemy.hp. 
  Display: "You hit Goblin for 7 damage! (5 HP remaining)"
- Enemy turn always follows player turn (even if enemy dies — show death first)
- Enemy AI: always Attack (simple for MVP)
- Combat ends: enemy HP ≤ 0 (enemy dies, award XP + loot) OR player HP ≤ 0 (game over)
- Flee: 50% chance to escape. Success: return to map. Fail: enemy attacks once.
```

**World map and tile-based movement:**
```
World: 20x15 tile map (each tile 32x32px)
Map defined in map.json as 2D array:
0 = floor (walkable), 1 = wall (blocked), 2 = door (interactive), 3 = enemy spawn
Player: @ character, starts at tile (3, 3)
Arrow keys move one tile at a time. Cannot move into walls.
Enemies: defined by spawn points in map, use pathfinding to pursue player.
```

**Progression and balance:**
```
Leveling curve:
- Level 1→2: 100 XP
- Level 2→3: 250 XP  
- Level N→N+1: 100 * (N^1.5) XP
On level up: show "LEVEL UP!" message, player selects +2 to Strength, Dexterity, or Wisdom
Stats affect: Strength (attack damage), Dexterity (dodge chance), Wisdom (spell power)
```

---

## D. Common Pitfalls

**"Everything at once" collapse.** The Nezumi Swarm post-mortem (from the card-game.md case study, but the lesson applies equally here) is the canonical RPG failure: the developer tried to implement two full factions, turn structure, creature abilities, combat, and opponent interaction simultaneously. The project collapsed. RPG systems must be built and verified one at a time.

**GDScript API hallucinations.** In Godot, Claude sometimes generates valid-looking but non-existent GDScript API calls, especially for input handling and physics. Always run Godot's scene and check the output console for errors after each session. The `@export` annotation, signal syntax, and coroutine patterns changed between Godot 3 and 4 — specify "Godot 4.x GDScript" in every prompt.

**Save system as an afterthought.** RPGs have the most complex save requirements of any genre: player position, map state (which enemies died, which doors opened, which items were collected), inventory, XP, level, quest flags. If you add the save system after all these systems exist, serializing them correctly is enormously complex. Build the save system after the SECOND system is implemented (not last):
```
After HP system is working:
Add save/load that serializes: player.position, player.hp, player.xp, player.level
As JSON to localStorage. Even though inventory doesn't exist yet, 
structure the save object to include an "inventory" array (empty for now).
This way we never have to retrofit the save format.
```

**Enemy pathfinding at scale.** RPG enemies that "pursue the player" need pathfinding. Running A* on every enemy every frame for 20+ enemies causes performance issues. Options: use Godot's NavigationAgent2D (built-in, efficient), or run A* less frequently (every 500ms rather than every frame), or use simple "move toward player" heuristic for dumb enemies.

**Loot tables and economy balance.** AI-generated loot tables are almost always too generous (gold floods the economy, players become OP) or too stingy (no resources → frustration). Define explicit drop rates:
```
Gold per enemy: min 5, max 15 (random int)
Equipment drop rate: 15% per kill
Rare item drop rate: 2% per kill
Economy target: player should be able to afford one upgrade every ~10 minutes of play
```

**Context decay in long RPG sessions.** RPGs are the genre most affected by context decay — Claude "quietly forgets" that the inventory system exists when working on combat 40 messages later. Maintain a `CLAUDE.md` in the project root:
```markdown
# PROJECT: My RPG
## Systems Implemented (DO NOT re-implement)
- [x] Tile map movement (map.js)
- [x] Combat (combat.js)
- [x] HP system (player.js)
- [ ] Inventory (not yet built)
## Current Task
Add basic inventory panel showing collected items.
```

---

## E. Kick-off Prompt Template

```
I'm building a top-down tile-based RPG in Godot 4 (GDScript).

Genre: dungeon crawler. Single dungeon floor, turn-based combat, 
no story for now — just the core mechanics.

Data files (I'll provide these as JSON resources):
- enemies.json: [{"id":"goblin","name":"Goblin","hp":8,"power":2,"xp":15}]
- items.json: [{"id":"sword","name":"Sword","type":"weapon","damage_bonus":3}]

Systems to build (IN ORDER, one per session):

Session 1 (today): World + Movement
- TileMap: 15x10 grid, 32x32 tiles
- Tile types: floor (walkable), wall (blocked), stairs (next level)
- Player: @ sprite, moves with arrow keys one tile at a time
- Camera follows player
- Simple test map: room with walls around edges, one corridor

Session 2: Combat
Session 3: Inventory
Session 4: Leveling
Session 5: Save/Load

Today only: implement Session 1. 
Show a simple dungeon room, player moves around, camera follows.
Do NOT implement enemies, combat, or any other system yet.
Confirm movement works before anything else.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Player movement + basic map | 2–4 hours |
| Combat loop (one enemy type) | 1–2 days |
| Inventory system | 1–2 days |
| Leveling + multiple enemy types | 2–3 days |
| Full dungeon with multiple floors | 1 week |
| Polished release (art, sound, story, balance) | 1–3 months |

**"Done" at MVP:** Player explores one dungeon floor, fights 2–3 enemy types, collects items, levels up once, can die and restart.

**"Done" polished:** 3+ dungeon levels, 10+ enemy types, 20+ items, spell system, NPC dialogue, save/load, art, sound, published on itch.io.

**Token cost estimate:** $5–$20 for a feature-complete RPG MVP across multiple sessions. The highest token cost of any genre, but also the richest outcome if executed methodically.

**The key insight from CODEX MORTIS:** A 100% AI-coded RPG on Steam is possible, but it took 3 months and required treating the AI as a rigorous coding partner with careful task scoping — not a "just build it" tool. The developer wrote detailed system specifications and verified each one before proceeding to the next.

---

*Sources: [Chier Hu Medium survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992) · [CODEX MORTIS Steam](https://store.steampowered.com/app/2900760/CODEX_MORTIS/) · [Dice Odyssey itch.io](https://leseau.itch.io/dice-odyssey) · [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre)*
