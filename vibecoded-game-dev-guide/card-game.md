# Card Games & Deck-Builders

**Difficulty:** ⭐⭐⭐ Medium | **Logic-heavy — great AI fit, but state management is complex**

---

## A. Real Examples from the Community

### Deckroad
- **Source:** [itch.io community thread](https://itch.io/t/6213388/deckroad-vibe-coded-with-claude-in-3-hours-runner-deckbuilding-with-zero-assets)
- **Genre:** Endless runner × deck-builder hybrid — cards at checkpoints procedurally generate the next track section
- **Engine:** Phaser 3 (graphics API, no external assets)
- **AI Tool:** Claude (vibe coding session)
- **Time:** ~3 hours of prompting
- **Art style:** 4-color palette, ASCII rain, scanlines, CRT shutdown animation — all code-generated, zero image files
- **Audio:** Web Audio oscillators (synthesized in code, no audio files)
- **Features built:** 12 cards, daily challenge mode (Wordle-style shared seed), emoji scorecards, procedural narrator
- **What worked:** Minimalist aesthetic translated code-native elements into compelling design. Procedural generation within tight time.
- **What didn't:** Community questioned whether "vibe coding" framing minimized genuine creative effort
- **Shipped:** Yes, itch.io

### Nezumi Swarm / Aetheric Empire card game (in development)
- **Source:** [DEV Community](https://dev.to/peter_vanonselen_e86eab6/cards-chaos-and-the-subtle-art-of-claude-code-p2e)
- **Genre:** Turn-based card strategy with two asymmetric factions
- **AI Tools:** Claude Code, Claude, Codex, ChatGPT, Gemini (multiple models tried)
- **Status:** In progress
- **What worked:** Card refactoring, territorial/terraforming archetypes, 1,299-line planning document
- **What didn't:** "Everything, everywhere, all at once" approach — tried to implement multiple 20-card decks + turn structure + creature abilities + combat + opponent interaction simultaneously. Caused total failure.
- **Lesson:** "Start with testable Lego pieces before Royal Albert Hall"

### Dice Odyssey
- **Source:** [leseau.itch.io/dice-odyssey](https://leseau.itch.io/dice-odyssey) (shared by user)
- **Genre:** Dice/slot hybrid with RPG progression — similar to Luck Be a Landlord slot mechanics crossed with dungeon crawling
- **Concept:** Roguelite structure with dice rolls driving combat/reward outcomes
- **Note:** This game type (dice-as-cards, slot-as-roguelite) is a growing niche — the shared seed / daily run structure pioneered by Slay the Spire clones translates well to vibe coding

### Luck Be a Landlord–style slot/incremental
- **Source:** Community knowledge + [Luck Be a Landlord Wikipedia](https://en.wikipedia.org/wiki/Luck_Be_a_Landlord)
- **Genre:** Incremental slot machine with synergy discovery
- **Why AI-friendly:** This is essentially a data-driven synergy table — each symbol has effects, combinations trigger bonuses. Claude handles data-driven design extremely well.

---

## B. Recommended Stack

**Best for browser card games:**
- **Engine:** Phaser 3 — handles card dragging, flip animations, hand management cleanly
- **Alternative:** Single HTML file (vanilla JS) — simpler for turn-based card games without animations

**For dice/slot mechanics:**
- Single HTML file is sufficient — slot machines are essentially randomized UI state machines
- Godot 4 for a desktop release with polished animation

**For deck-building roguelites (Slay the Spire style):**
- **Engine:** Godot 4 — the scene system handles dungeon rooms, shop, and card reward screens well
- Card data: JSON file defining all cards (name, cost, effect, art path) — the foundation you build everything on

**Asset tools:**
- Deckroad used zero assets — all visuals generated via Phaser's graphics API. This is viable and removes the asset bottleneck entirely.
- For real card art: generate via DALL-E / Stable Diffusion, or use Kenney card packs (CC0)
- For dice faces: SVG or Unicode dice symbols (⚀ ⚁ ⚂ ⚃ ⚄ ⚅)

---

## C. Prompting Strategy

**Define cards as data first.** Before writing any code, create a `cards.json`:
```json
[
  {
    "id": "fireball",
    "name": "Fireball",
    "cost": 2,
    "type": "attack",
    "effect": "deal_damage",
    "value": 8,
    "description": "Deal 8 damage."
  },
  {
    "id": "shield",
    "name": "Iron Shield",
    "cost": 1,
    "type": "skill",
    "effect": "add_block",
    "value": 5,
    "description": "Gain 5 Block."
  }
]
```
Then ask Claude: "Implement a card renderer and hand display using this JSON file as the data source. No game logic yet — just display cards in a hand."

**The correct implementation order:**
1. Display a hardcoded hand of 5 cards from JSON
2. Click a card to select/play it (no effect yet)
3. Implement one card effect type (e.g., `deal_damage`)
4. Add player + enemy HP bars
5. Basic combat turn loop (player plays cards → enemy attacks)
6. Mana/energy system
7. Draw pile + discard pile
8. End of combat: card reward screen
9. Second combat room
10. Deck-building: add chosen card to deck

**Adding new cards:** This is where data-driven design pays off:
```
Add this card to cards.json and implement its effect in CardEffects.js:
{
  "id": "chain_lightning",
  "name": "Chain Lightning",
  "cost": 2,
  "type": "attack",
  "effect": "chain_damage",
  "value": 4,
  "chains": 3,
  "description": "Deal 4 damage to a random enemy, 3 times."
}
```

**Synergy systems (Luck Be a Landlord style):**
Define synergy triggers as data:
```json
{
  "name": "Fire Mastery",
  "requires": ["fireball", "fire_orb"],
  "effect": "fire_spells_deal_extra_2_damage"
}
```
Ask Claude to implement one generic synergy resolver that evaluates all synergy data at combat start.

**For dice games:**
```
Build a slot-machine style dice roller:
- 5 dice, each with 6 faces (1–6)
- Player can reroll up to 2 remaining dice per turn
- Combinations trigger effects (three-of-a-kind, straights, full house)
- Combo table defined in combos.json — do not hardcode combos in logic
```

---

## D. Common Pitfalls

**"Everything at once" failure mode:** The Nezumi Swarm developer's clearest lesson: attempting to build multiple card decks + all mechanics simultaneously caused total breakdown. One card effect type at a time. Always.

**State explosion:** A deck-building game has multiple interacting state machines: draw pile, hand, discard pile, exhaust pile, energy, block, buffs/debuffs. Claude sometimes conflates these or creates inconsistent state transitions. Define each pile as a separate array and make Claude document the flow explicitly.

**Card targeting UI:** "Click a card then click an enemy to target" involves two-step input that is surprisingly complex to implement correctly. Ask for this specifically, not as part of a larger feature.

**Shuffle inconsistency:** JavaScript's default `Math.random()` is not seeded. For daily challenges (Wordle-style), you need a seeded random function:
```
Use the mulberry32 seeded PRNG function.
Seed = today's date as YYYYMMDD integer.
Use this seeder for all shuffle operations so two players with the same seed 
see the same card order.
```

**Animation blocking game logic:** Card flip, play, and death animations must complete before game state updates. If not managed with callbacks, clicks during animations corrupt state. Explicitly request: "All animations must use callbacks — no state changes until animation completes."

---

## E. Kick-off Prompt Template

```
I'm building a Slay the Spire–style deck-building card game.
Engine: Phaser 3, single HTML file, Phaser 3 from CDN.

Data-first architecture:
1. All cards defined in cards.json (I'll provide this)
2. All enemies defined in enemies.json
3. Game logic reads these files at startup

cards.json (include this exactly):
[
  {"id":"strike","name":"Strike","cost":1,"effect":"damage","value":6,"description":"Deal 6 damage."},
  {"id":"defend","name":"Defend","cost":1,"effect":"block","value":5,"description":"Gain 5 Block."},
  {"id":"bash","name":"Bash","cost":2,"effect":"damage_and_vulnerable","value":8,"description":"Deal 8 damage. Apply 2 Vulnerable."}
]

Starting deck: 3× Strike, 3× Defend, 1× Bash

First session — build ONLY:
1. Render the 3 starting cards in a hand row at the bottom of screen
2. Player stats on left: 70/70 HP, 3/3 Energy
3. One enemy on right: Louse, 12 HP, shows "Attack: 6" as intent
4. Click a card to "play" it — log to console which card was played
5. End Turn button advances to enemy attack phase (deal damage to player)

No card effects, no actual damage, no discard/draw yet.
Confirm the visual layout before implementing any game logic.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Cards displaying + click interactions | 1–2 hours |
| Combat loop: play cards → enemy attacks | 1 day |
| Draw pile, hand, discard implemented | 1–2 days |
| 10 cards + 3 enemy types | 2–3 days |
| Roguelite structure (rooms, shops, rewards) | 1 week |
| Polished release (art, sound, balance) | 2–3 weeks |

**"Done" at MVP:** 5–10 cards, one combat loop that works correctly, simple enemy, deck visible between runs.

**"Done" polished:** 30+ cards, 10+ enemy types, synergy system, 3 acts with boss encounters, class selection, persistent unlocks.

---

*Sources: [Deckroad itch.io thread](https://itch.io/t/6213388/deckroad-vibe-coded-with-claude-in-3-hours-runner-deckbuilding-with-zero-assets) · [DEV Community card game](https://dev.to/peter_vanonselen_e86eab6/cards-chaos-and-the-subtle-art-of-claude-code-p2e) · [Dice Odyssey](https://leseau.itch.io/dice-odyssey) · [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre)*
