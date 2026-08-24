# Roguelike & Roguelite

**Difficulty:** ⭐⭐⭐ Medium | **One of the best-supported genres for vibe coding**

---

## A. Real Examples from the Community

### Spell Cascade
- **Source:** [yurukusa on itch.io](https://yurukusa.itch.io/spell-cascade) · [dev.to case study](https://dev.to/yurukusa/the-token-per-dollar-math-running-claude-max-for-30-days-2k1o)
- **Genre:** Vampire Survivors–style roguelite / bullet heaven
- **Engine:** Godot 4.3 (GDScript)
- **AI Tool:** Claude Code (Claude Max, $200/month)
- **Time:** 30 days (part of a larger 5-game sprint)
- **Lines of code:** 7,220 lines in Godot
- **What worked:** Iterative enemy wave system, spell combination logic, synergy system. Claude handled all combat math cleanly.
- **What didn't:** "Tests passed. Code compiled. Game launched. And the game was unplayable." — unit tests passed but gameplay was broken (zero damage, broken timing). Automated tests couldn't catch gameplay feel.
- **Shipped:** Yes, itch.io, v0.11.6 with 216 improvements
- **Key stat:** 235 commits over the project

### Azure Flame Dungeon
- **Source:** [yurukusa on itch.io](https://yurukusa.itch.io/azure-flame-dungeon) · [dev.to](https://dev.to/yurukusa)
- **Genre:** Terminal roguelike
- **Engine:** Python / Pygame
- **AI Tool:** Claude Code
- **Lines of code:** 22,000+
- **What worked:** Python + Pygame is an exceptional combination for roguelikes — extensive training data, text-serialized, headless-executable. Claude rarely hallucinates Python API calls.
- **What didn't:** Large codebase eventually crossed a complexity wall where context became difficult to manage
- **Shipped:** Yes, itch.io

### CODEX MORTIS (Steam)
- **Source:** [GIGAZINE report](https://gigazine.net/gsc_news/en/20251215-codex-mortis/)
- **Genre:** 2D bullet hell / Vampire Survivors–style roguelite
- **Engine:** Custom (TypeScript + PixiJS + bitECS + Electron — no traditional game engine)
- **AI Tools:** ChatGPT (art/character design), Claude Code Opus 4.1/4.5 (custom shaders, animations), generative AI (music)
- **Time:** ~3 months
- **100% AI-generated:** Assets, code, music, animations
- **What worked:** Consistent art style maintenance across ChatGPT sessions. "Giving a construction worker an exoskeleton."
- **What didn't:** User reviews on Steam were critical about animation quality and skeptical of AI-generated content
- **Shipped:** Yes — **on Steam** with a playable demo. This is one of the few fully-vibecoded roguelites on Steam.

---

## B. Recommended Stack

**For bullet heaven / Vampire Survivors style:**
- **Engine:** Godot 4 (GDScript) — best overall. Or TypeScript + PixiJS + bitECS for a frameworkless approach (see CODEX MORTIS).
- **Physics:** Godot's built-in Arcade physics handles hundreds of projectiles well. bitECS handles thousands of entities efficiently.
- **AI Tool:** Claude Code. This genre is logic-heavy (stat math, synergies, enemy AI) — exactly where Claude excels.

**For terminal roguelikes / dungeon crawlers:**
- **Engine:** Python + Pygame or Python + tcod (libtcod — the classic roguelike library)
- **Why Python:** Enormous training data, text-serialized, runs headlessly for AI testing, dead simple to iterate

**For visual roguelikes with procedural generation:**
- **Engine:** Godot 4 — procedural generation systems (BSP dungeons, wave-function collapse rooms) are well-documented in Claude's training data

**Asset Tools:**
- Kenney.nl RPG pack (free, CC0)
- Free LPC character sprites on OpenGameArt
- MusicGen or Mubert for procedural background music

---

## C. Prompting Strategy

**Start with the core loop only.** A roguelike has many systems — but the MVP is:
1. Player can move
2. Player can attack
3. One enemy type follows and damages player
4. Player dies, gets stats screen, restarts

Don't add: item drops, multiple enemy types, level generation, meta-progression, or synergies until that loop feels good.

**Spell/ability prompting:**
Each ability should be a separate prompt. Define it precisely:
```
Add a new spell: "Chain Lightning"
- Fires at nearest enemy
- Jumps to up to 3 additional enemies within 150px
- Each jump deals 70% of previous damage
- 0.8 second cooldown
- Add it to SPELLS array in spells.js
- Do NOT modify any other files
```

**Enemy behavior prompting:**
Request behaviors one at a time. "Add a slow heavy enemy that occasionally charges" is a good prompt. "Add 5 enemy types with different behaviors" is a bad one.

**Synergy systems:**
These are math-heavy and Claude handles them well. Define synergies as data (not code) first:
```
Add this synergy to SYNERGIES array:
{
  name: "Unstable Core",
  requires: ["fireball", "chain_lightning"],
  effect: "Fireball explosions trigger 1 chain lightning arc"
}
```
Then ask Claude to implement the trigger logic.

**Handling growing codebase:**
- Split into files: `player.js`, `enemies.js`, `spells.js`, `waves.js`, `ui.js`
- In CLAUDE.md, list every file and its single responsibility
- When editing, tell Claude "only modify `spells.js` — do not touch any other file"

---

## D. Common Pitfalls

**The green-test-broken-game trap:** Unit tests pass but the game is unplayable. AI can test that a function returns the right number but can't test whether the game feels good. Always playtest manually after every feature.

**Synergy combinatorics blow up:** Adding more spells and items exponentially increases interactions. Claude will attempt to handle all combinations in one function — this becomes unmaintainable. Use a data-driven approach (define synergies as JSON, write one generic resolver).

**Wave scaling math:** "Enemies get harder each wave" sounds simple but balancing this is hard. Claude generates plausible-looking formulas that result in either a boring early game or an impossible late game. Test every 5 waves manually.

**Roguelike becomes roguelite creep:** Every new feature you add ("let me add a meta-shop") makes the codebase more complex. Decide upfront: pure roguelike (no persistent progress) or roguelite (persistent upgrades). Don't mix them without planning.

**GDScript hallucination:** "LLMs barely know GDScript. It has ~850 classes that will happily let a model hallucinate Python idioms." — from Chier Hu's survey. Use a Godot MCP server or a SKILL.md that lists correct Godot 4 API calls to reduce this.

---

## E. Kick-off Prompt Template

```
I'm building a top-down bullet heaven roguelite in Godot 4.3 (GDScript).
Single player, browser export.

Architecture — create this file structure:
- scenes/Game.tscn (main scene)
- scenes/Player.tscn
- scenes/Enemy.tscn
- scripts/Player.gd
- scripts/Enemy.gd
- scripts/WaveManager.gd
- scripts/SpellSystem.gd
- CLAUDE.md listing all files and responsibilities

Core loop for this first session ONLY:
1. Top-down arena, 800x600 viewport
2. Player: WASD movement, 200px/sec
3. One auto-firing spell: basic projectile, fires toward nearest enemy every 0.5s
4. One enemy type: follows player, deals contact damage
5. Player has 100 HP — dies when HP reaches 0 and scene reloads
6. HUD: current HP and seconds survived

Do not add: item drops, multiple spells, enemy variety, or menus.
Confirm you understand the scope before writing code.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Core loop: move, shoot, one enemy | 2–3 hours |
| 3 spell types + basic wave scaling | 1 day |
| 5+ enemy types + synergies | 2–3 days |
| Polished release (art, sound, meta-progress) | 1–2 weeks |
| CODEX MORTIS level (Steam-ready) | 3 months |

**MVP "done":** Player survives waves of enemies, gains spells over time, dies with a stats screen. Clean and playable in 10–15 minutes.

**Polished "done":** 10+ spells, 5+ enemy types, synergy system, procedural unlocks, leaderboard or achievements, original art/sound.

**Token cost estimate:** $2–$10 for MVP, $50–$200 for a full roguelite. yurukusa's 30-game sprint cost $200/month flat on Claude Max.

---

*Sources: [yurukusa itch.io](https://yurukusa.itch.io) · [dev.to yurukusa](https://dev.to/yurukusa/the-token-per-dollar-math-running-claude-max-for-30-days-2k1o) · [CODEX MORTIS / GIGAZINE](https://gigazine.net/gsc_news/en/20251215-codex-mortis/) · [Chier Hu Medium](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)*
