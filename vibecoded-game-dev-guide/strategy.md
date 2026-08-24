# Strategy Games

**Difficulty:** ⭐⭐⭐⭐ Hard | **Turn-based strategy is achievable; RTS is not recommended for solo vibe-coders**

---

## A. Real Examples from the Community

### Lucca Sanwald's RTS Attempt (Failure Post-Mortem)
- **Source:** [Lucca Sanwald DEV Community article](https://dev.to/) + Chier Hu survey
- **Genre:** Real-time strategy (RTS) — attempted
- **AI Tool:** Claude
- **Outcome:** Abandoned. The developer attempted to build an RTS with multiple unit types, pathfinding, resource gathering, and base building simultaneously. The pathfinding system alone (A* for multiple units with dynamic obstacles) required more precision than AI could deliver in iterative sessions.
- **Key lesson:** "AI is great at getting individual systems to work in isolation but struggles to keep them coherent as they interact." An RTS has 5–8 deeply interdependent systems that must interact correctly at runtime.
- **Shipped:** No

### Stellar Throne (Turn-Based 4X)
- **Source:** [vibecode.game community](https://vibecode.game/vibe-coded-games/by-genre)
- **Genre:** 4X strategy (eXplore, eXpand, eXploit, eXterminate) — space themed
- **AI Tools:** Multiple (ChatGPT + Claude)
- **What worked:** The turn-based structure meant Claude had unlimited thinking time between turns — AI unit pathfinding on a hex grid only needs to run once per turn, not 60 times per second.
- **Status:** Partial — reached a working prototype
- **Key insight:** Turn-based reduces the "coherence under pressure" problem that killed the RTS attempt

### Tower-Defense as Strategy
- **Source:** See `tower-defense.md`
- **Note:** Tower defense is a genre that community members build when they want strategy without the complexity of full RTS. Crystal Keep (fully AI-built in Godot 4) shipped with 4 tower types, upgrade trees, and 20 waves — all the strategic depth of early Warcraft without the pathfinding/unit-control complexity.

### Battle Games (vibecode.game)
- **Source:** [vibecode.game genre listing](https://vibecode.game/vibe-coded-games/by-genre)
- **Multiple entries:** Chess variants, autobattlers, and tactical grid games appear frequently. These are the most achievable "strategy" games for vibe coders because the turn-based rules map directly to AI-readable specifications.

---

## B. Recommended Stack

The most important decision in strategy game development is turn-based vs. real-time. This decision affects every other technical choice:

**Turn-based strategy (recommended):**
- **Phaser 3** — hex or square grid, unit placement, turn system. Well within Phaser's capabilities. Claude generates clean tile-based game code.
- **Single HTML file** — for simpler strategy (chess variant, autobattler, 2D tactics). A complete turn-based tactics game can live in one file.
- **Godot 4** — for more complex turn-based with animated abilities, camera movement, and multiple map screens.

**Auto-battler/autochess:**
- **Single HTML file** — autobattlers are fundamentally a simulation that runs fast-forwarded. No real-time input during combat. All of Teamfight Tactics' combat logic can be specified as a rules document.
- **Phaser 3** — for animated autobattler battles.

**4X strategy:**
- **Godot 4** — scene system handles multiple game phases (exploration map, city management screen, combat). The data-management complexity of 4X requires Godot's organized file structure.
- Single HTML becomes unmaintainable at 4X scale.

**What NOT to attempt:** Real-time strategy with multiple simultaneous units + pathfinding + fog of war + resource gathering. The Lucca Sanwald post-mortem is the warning. These systems must update at 60fps simultaneously, and coherence breaks down when any one of them is slightly wrong.

---

## C. Prompting Strategy

**The key distinction: what decisions does the player make?**

Strategy games are about decisions. Define the decision space before anything else:

```
Player decisions in my game (one per type of interaction):
1. WHERE to place units (before battle starts)
2. WHICH unit to move on their turn (click to select)
3. WHERE to move that unit (click destination tile)
4. WHICH ability to use (from unit's ability list)
5. WHICH target for the ability (click enemy or tile)

That's the complete decision tree. Everything else is display and calculation.
```

**Turn-based tactics (Fire Emblem/XCOM style):**
```
Turn system:
- Two sides: Player and Enemy
- Player turn: move any unacted unit, then end turn
- Enemy turn: all enemies act (simple AI), then return control to player
- Unit state: has_moved, has_acted (reset at start of each player turn)
- "End Turn" button: ends player turn, triggers enemy phase

Unit actions:
- MOVE: click unit → show movement range (diamond pattern, radius = unit.move)
  → click valid tile → unit moves there, has_moved = true
- ATTACK: after moving, click Attack → show attack range (unit.range)
  → click enemy in range → calculate damage, apply HP

Damage formula: (attacker.strength + weapon.damage) - defender.defense
Minimum damage: 1 (always do at least 1)
```

**Grid and movement range:**
```
Grid: 12x8 tile map (64px per tile)
Movement range calculation:
- BFS from unit position, max distance = unit.move_range
- Mark tiles as: REACHABLE (green tint), BLOCKED (wall/other unit), OUT_OF_RANGE
- Diagonal movement: NOT allowed (Manhattan distance only)
- Show range when unit is selected, hide when deselected

Attack range: separate BFS from unit position, max distance = unit.attack_range
- Can attack through walls? No.
- Can attack own units? No.
- Show attack range in red tint (separate from movement range)
```

**Enemy AI (simple but effective):**
```
Enemy AI (turn-based):
For each enemy unit (in order of initiative):
1. Find all player units in attack range → if found, attack the lowest-HP one
2. If no player in attack range → find nearest player unit
   Move toward that player (one step at a time, closest valid tile)
   If now in attack range after moving → attack
3. If no player in move+attack range → stay still

Enemy AI must NOT cheat: only see tiles in their vision range.
Vision range = unit.vision (default 4 tiles).
```

**Autobattler variant (simpler):**
```
Autobattler (Teamfight Tactics style):

PREP PHASE (30 seconds): Player places units on their side of the board
COMBAT PHASE: Automatic — units fight until one side is eliminated

Combat simulation:
- All units act simultaneously every 1 second (no individual turns)
- Each unit: find nearest enemy → if in attack range: attack → else: move 1 tile closer
- Attack: roll (unit.damage - target.defense), minimum 1
- Dead units removed immediately
- Display: show HP bars above each unit, show attack animations (flash red)
- Result: surviving side wins the round. Show win/loss banner.

Define all units in units.json. AI should never hardcode unit stats.
```

**4X game core loop:**
```
My 4X game has 4 phases (each is its own screen/scene):

1. EXPLORE: Move scout unit on hex map to reveal tiles (fog of war)
2. EXPAND: Settle a city on a revealed tile (costs 1 settler unit)
3. EXPLOIT: Each settled city produces 1 resource/turn based on adjacent tiles
4. EXTERMINATE: Encounter enemy cities, capture or destroy them

Build one phase at a time. Start with EXPLORE only.
Phase 1 complete = hex map visible, scout moves, fog of war reveals tiles.
```

---

## D. Common Pitfalls

**RTS pathfinding.** If your game has multiple units moving simultaneously toward different targets with dynamic obstacle avoidance — this is the #1 scope trap. A single enemy with hardcoded waypoints is fine. Five units pathfinding around each other and the player's buildings in real-time is not a vibe-coding project. Turn-based eliminates this problem entirely.

**Fog of war implementation.** Fog of war (hiding unexplored or out-of-vision tiles) is more complex than it looks. You need: a "has been seen" state, a "currently visible" state, and a rendering layer that shows known-but-not-visible tiles as dimmed versions of their last known state. Ask for this as a standalone system, not as part of a larger feature:
```
Implement fog of war as a separate rendering layer:
- Every tile has three visibility states: UNSEEN (black), SEEN_BEFORE (dark tint), VISIBLE (full brightness)
- Update visibility state after every move: run vision calculation from unit positions
- Vision calculation: BFS from each friendly unit, radius = unit.vision
- Render order: game objects first, then visibility overlay on top
```

**Unit z-ordering.** In grid strategy games, units "passing through" other units visually overlap in wrong z-order. Explicitly set render depth based on grid row:
```
All sprites: setDepth(unit.gridY) each frame
This ensures units in lower rows render on top of units in higher rows,
producing correct visual overlap in a top-down perspective.
```

**"End Turn" button UX.** Players accidentally click "End Turn" before they're done. Add a confirmation:
```
If player has units that haven't moved yet and clicks "End Turn":
Show: "2 units haven't acted. End turn anyway?" [Confirm] [Cancel]
Never confirm-dialog if all units have already acted.
```

**Enemy AI being too dumb or too smart.** "Always attack lowest HP" is correct but makes the AI feel robotic and exploitable (the player just keeps their highest-HP unit as bait). Add one randomization layer: 80% of the time attack lowest HP, 20% attack a random valid target.

---

## E. Kick-off Prompt Template

```
I'm building a turn-based tactics game (browser, Phaser 3, single HTML file, CDN).
Canvas: 768x512. Grid: 12x8 tiles, 64px each.

This is Fire Emblem–style tactics: player and enemy trade turns, units move and attack.

Units (define in units.js):
const UNIT_TYPES = {
  knight:  {name:"Knight",  hp:20, strength:5, defense:3, move:3, range:1, sprite_color:0x4488ff},
  archer:  {name:"Archer",  hp:12, strength:4, defense:1, move:3, range:2, sprite_color:0x44ff88},
  enemy:   {name:"Goblin",  hp:10, strength:3, defense:1, move:2, range:1, sprite_color:0xff4444}
}

Starting scenario:
- Player units: 2 Knights at (1,4) and (2,5), 1 Archer at (1,6)
- Enemy units: 3 Goblins at (10,3), (10,4), (10,5)
- Map: all floor tiles except column 6 has walls at rows 2–5 (a wall in the middle)

Turn system:
- Player turn: select and move/attack any unit
- Enemy turn (auto): each goblin moves toward nearest player, attacks if adjacent

First session — build ONLY:
1. Render 12x8 grid with wall tiles at column 6 rows 2–5 (gray) vs floor (beige)
2. Draw units as colored circles (use sprite_color from unit type)
3. Click a player unit: show movement range (green tint, move=3 tiles, no diagonal)
4. Click a valid tile: move unit there

Do NOT add: attack, enemy turns, HP, UI panels, or win conditions.
Confirm unit selection and movement works before anything else.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Unit selection + movement | 2–4 hours |
| Combat + HP bars | 1–2 days |
| Enemy AI turn | 1–2 days |
| 3+ unit types + 3 maps | 2–3 days |
| Full campaign (5 missions) | 1–2 weeks |
| Polished release (art, sound, balance) | 3–6 weeks |

**"Done" at MVP:** 3 player units, 3 enemy units, movement and attack work, win/lose conditions clear.

**"Done" polished:** 6+ unit types, 10+ maps with varied terrain, upgrade system, victory screen, sound, published on itch.io or Steam.

**The RTS warning:** Every vibe-coder who wants to build strategy eventually thinks "what if I just make it real-time?" The Lucca Sanwald failure is the answer. Real-time pathfinding, fog of war updates at 60fps, simultaneous unit movement, and resource collection running in parallel — each system is achievable alone, but their interaction under real-time pressure is where AI-assisted development breaks down. Turn-based is not a compromise. It is a design choice that happens to also be achievable.

---

*Sources: [DEV Community Lucca Sanwald RTS](https://dev.to/) · [Chier Hu survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992) · [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre) · [Crystal Keep tower defense](https://dev.to/salvo10f/an-ai-agent-built-a-complete-3d-tower-defense-in-godot-heres-how-lpd)*
