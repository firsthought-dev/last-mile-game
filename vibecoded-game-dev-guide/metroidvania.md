# Metroidvania Games

**Difficulty:** ⭐⭐⭐⭐ Hard | **One detailed community failure post-mortem — read it before starting**

---

## A. Real Examples from the Community

### Unnamed Metroidvania (Godot Forum Post-Mortem)
- **Source:** Godot Community Forums — developer post-mortem (cited in Chier Hu survey)
- **Engine:** Godot 4
- **AI Tool:** Claude
- **Outcome:** Abandoned. The most detailed documented metroidvania failure in the vibe coding community.
- **What failed:**
  1. **Backtracking logic** — "Claude couldn't keep track of which ability unlocks which door across the entire map." The game relies on remembering, globally, what the player has and hasn't unlocked. With 40+ rooms and 8+ abilities, this becomes a graph problem that broke across multiple sessions.
  2. **Room persistence** — enemies that were killed needed to stay dead (or respawn on return, consistently). Getting this right required tracking state for every room the player had visited — Claude kept losing track of which rooms had been initialized.
  3. **Map design coherence** — the developer had Claude generate rooms procedurally, then discovered the rooms didn't connect in ways that created interesting backtracking loops. Metroidvania map design is a human design skill, not a code generation skill.
- **Key lesson:** "Metroidvanias require a consistent game-world mental model that Claude loses track of across sessions."

### Hollow Knight–style attempts (community pattern)
- **Source:** r/vibecoding, r/aigamedev
- **Pattern:** Multiple developers have attempted Hollow Knight–style metroidvanias. Common progress: working platformer (movement, wall jump, dash, attack), one room that looks beautiful, then the project stalls when connecting rooms and implementing the ability-gate system.
- **Success rate:** Very low. No shipped metroidvania with full backtracking logic appears in the community survey data.

### Platformer + ability gating (partial success)
- **Source:** Community pattern + Chong-U platformer tutorial
- **What works:** Building the platformer foundation (see `platformer.md`) — movement, combat, animated sprites — works well with AI. The metroidvania-specific layer (interconnected map + ability gates + world state persistence) is where success breaks down.
- **Practical takeaway:** Build the best platformer you can, and leave the metroidvania backtracking layer for a later version once the foundation is solid.

---

## B. Recommended Stack

Metroidvanias require the engine with the best support for interconnected scenes, persistent state across scenes, and tilemap editing:

**Best and only serious recommendation: Godot 4**
- Godot's scene system is designed for connected rooms. Each room is a scene, and the `SceneManager` autoload persists state as you transition.
- Tilemap system with TileSet allows visual room design in the Godot editor.
- `GlobalState` autoload script (a single .gd file) handles which abilities the player has collected and which rooms have been visited.
- The Godot community has metroidvania templates available (free on GitHub) that handle the room transition and global state boilerplate — start from one of these.

**What NOT to use:**
- Single HTML file — Metroidvania state management (50+ rooms, 8+ abilities, save persistence) is too complex for a single file without an organized module structure.
- Phaser 3 — manageable for a few rooms, but Phaser doesn't have built-in scene persistence, making room-state tracking error-prone.
- Unity — possible but the editor workflow is less friendly for AI-assisted rapid iteration than Godot.

**Tooling:**
- **Tiled** (free) — design rooms as tilemaps, export as JSON, import to Godot. This separates map design (your job) from code generation (AI's job).
- **LDtk** (free, by the Dead Cells developer) — alternative level editor with native Godot import. The LDtk importer for Godot is actively maintained and well-documented.

---

## C. Prompting Strategy

**The metroidvania post-mortem's core lesson is architectural.** The failure wasn't in any individual system — movement worked, combat worked, individual rooms worked. The failure was that Claude couldn't maintain a coherent "game world map" in its context across sessions. The solution is to make that world model explicit in code, not implicit in Claude's memory.

**Mandatory: GlobalState autoload before anything else:**
```
Create GlobalState.gd as an Autoload singleton (add to Project Settings → Autoloads):

extends Node

# Abilities player has collected
var has_double_jump := false
var has_dash := false
var has_wall_jump := false
var has_swim := false

# Room state (which enemies are dead, which items collected)
var visited_rooms := {}  # { "room_forest_01": { enemies_dead: [0,2], item_collected: true } }

# Player progress
var player_hp := 100
var player_max_hp := 100
var save_point_room := "room_start"
var save_point_position := Vector2(100, 300)

func mark_enemy_dead(room_id: String, enemy_index: int) -> void:
    if not visited_rooms.has(room_id):
        visited_rooms[room_id] = {"enemies_dead": [], "item_collected": false}
    visited_rooms[room_id]["enemies_dead"].append(enemy_index)

func has_visited(room_id: String) -> bool:
    return visited_rooms.has(room_id)

func save_game() -> void:
    # Serialize to JSON, write to user://save.json
    pass

func load_game() -> void:
    # Load from user://save.json
    pass
```

**Room transition system:**
```
Room transitions:
- Each room scene has "door" Area2D nodes at edges (left, right, up, down)
- Door has exported properties: target_scene (path) and target_spawn (Vector2)
- When player enters door area: fade to black, change_scene_to_file(target_scene), 
  place player at target_spawn
- Room script's _ready(): load enemy states from GlobalState.visited_rooms[room_id]
  (enemies already dead from previous visit → set them as dead immediately)
- Room script: on enemy death → GlobalState.mark_enemy_dead(room_id, enemy.index)

IMPORTANT: Every room must have a string constant ROOM_ID = "room_forest_01"
Define all room IDs in a separate RoomIDs.gd constants file.
Never hardcode room paths as strings inline — always use RoomIDs constants.
```

**Ability gate system:**
```
Ability gates — two types:
1. PASSIVE GATE: Player physically cannot reach area without ability
   (e.g., a wall jump notch that's only reachable via wall jump)
   Implementation: just a ledge placed at the right height. No code needed.

2. ACTIVE GATE: Door that explicitly checks ability
   Implementation: Door script checks GlobalState.has_double_jump before opening.
   If ability not collected: show locked indicator (lock icon), door stays closed.
   If ability collected: door opens (plays animation), stays open permanently 
   (save in GlobalState.visited_rooms[room_id].item_collected = true)
   
Define ALL gate requirements in ability_gates.json (never hardcoded):
[{"door_id": "forest_to_cave", "requires_ability": "has_swim"}]
```

**Ability unlock flow:**
```
Ability pickup item:
- Place AbilityPickup node in a room (exported: ability_name string, ability_display_name)
- On player contact:
  1. Check if already collected (GlobalState.visited_rooms[room_id].item_collected)
     If yes: don't give ability again (on respawn this runs again)
  2. If no: GlobalState[ability_name] = true
  3. Mark room item as collected in GlobalState
  4. Show ability unlock screen (pause game, display ability name + description, press continue)
  5. Immediately test: if has_double_jump, player can now execute second jump
```

**Map tracking (minimap):**
```
Minimap:
- Simple 2D grid texture (one pixel per room, 4x4px on screen)
- visited_rooms keys drive which rooms are shown
- Current room: bright white. Adjacent known rooms: dim white. Unvisited: black.
- Ability gate doors: show as colored border on room border (e.g., swim = blue border)
- Update minimap texture every time GlobalState.visited_rooms changes
```

---

## D. Common Pitfalls

**The backtracking trap.** The Godot forum developer's failure was specifically about ability-gate logic breaking as the map grew. The fix is to make gates pure data lookups (check `GlobalState.has_swim`) rather than stateful objects. If the gate checks the GlobalState singleton, it can never be wrong — it just reads current state.

**Room state not persisting on return visit.** The most common implementation bug: player kills 3 enemies in a room, goes to next room, comes back, enemies are alive again. Fix by reading enemy state from GlobalState in every room's `_ready()` function. This is why the GlobalState setup must happen first.

**Softlocking.** A softlock is when the player gets into a game state they can't escape without resetting — trapped in a room without the ability to leave. Metroidvanias are uniquely susceptible. Prevention:
- Every area the player can enter, they must be able to exit with their CURRENT abilities (not future abilities)
- Test every room entry/exit with "minimum viable ability set" before shipping
- Add a "respawn at last save point" option in the pause menu

**Session-to-session architectural drift.** In a metroidvania, Claude is told in session 3 that room transitions work one way, then in session 7, generates room transition code that conflicts with the session-3 architecture. Use `CLAUDE.md` aggressively:
```markdown
# METROIDVANIA PROJECT
## Architecture Rules (NEVER deviate)
- GlobalState singleton manages ALL ability flags and room states
- Room transitions: ONLY via Door.gd script → SceneManager.go_to_room()
- Enemy death: ALWAYS calls GlobalState.mark_enemy_dead(ROOM_ID, index)
- Save/load: ONLY GlobalState.save_game() / GlobalState.load_game()

## Room IDs (do not invent new formats)
- room_start, room_forest_01, room_forest_02, room_cave_01, room_boss_cave
```

**Art consistency across many rooms.** A metroidvania has 20–50+ rooms. AI-generated art for each room will look visually inconsistent. Either: (a) use a single tileset for all rooms (Kenney Medieval or similar CC0 tileset) and differentiate rooms by layout rather than art style, or (b) use Tiled/LDtk with a fixed palette.

---

## E. Kick-off Prompt Template

```
I'm building a metroidvania in Godot 4 (GDScript).
Architecture: Each room is a separate .tscn scene. 
GlobalState autoload manages all persistent state.

Step 1 (today): Create the GlobalState autoload and prove room transitions work.

Create these files:
1. GlobalState.gd (Autoload, added to Project Settings):
   - Variables: has_double_jump (false), has_dash (false)
   - Dictionary: visited_rooms = {}
   - Method: mark_enemy_dead(room_id, index)
   
2. RoomStart.tscn: Player spawns here. One exit door (right edge).
   Room ID constant: ROOM_ID = "room_start"
   
3. RoomForest01.tscn: Player enters from left. One entrance, one exit (right).
   Room ID constant: ROOM_ID = "room_forest_01"

4. Door.gd: On player contact → fade out → load target scene → 
   place player at target_spawn position

Player: 32x32 blue rectangle, WASD/arrow movement, gravity + jump (Space)
No abilities yet, no enemies, no combat.

Test: Player can walk from RoomStart through the door into RoomForest01,
then back to RoomStart. Position is correct on both sides.

Do NOT add: enemies, abilities, combat, minimap, or save system.
Prove room transitions work first.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Room transition system proven | 2–4 hours |
| GlobalState + ability flags working | 1 day |
| First ability + one gate using it | 1–2 days |
| 5 rooms with coherent backtracking | 3–5 days |
| Complete game with all abilities | 2–4 weeks |
| Polished release (art, music, map) | 2–3 months |

**"Done" at MVP:** 5 interconnected rooms, 2 abilities that gate progress, player can backtrack correctly, one boss or challenge area.

**"Done" polished:** 20+ rooms, 5 abilities, minimap, save points, animated character with ability animations, original music, published on itch.io.

**The honest difficulty assessment:** Metroidvanias have the worst success rate of any genre in the community data. The architectural complexity of interconnected world state is genuinely hard for AI to maintain across sessions. The prompting strategy above was designed specifically to address the failure documented in the Godot forum post-mortem — by making the world state explicit in GlobalState, you prevent the coherence loss that sank previous attempts. But it still requires more planning, more CLAUDE.md discipline, and more careful session management than any other genre in this guide.

---

*Sources: Godot Community Forums metroidvania post-mortem (via [Chier Hu survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)) · [r/vibecoding](https://reddit.com/r/vibecoding) · [r/aigamedev](https://reddit.com/r/aigamedev)*
