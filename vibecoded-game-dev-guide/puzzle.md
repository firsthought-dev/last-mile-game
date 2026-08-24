# Puzzle Games

**Difficulty:** ⭐⭐ Easy | **Extremely strong genre for vibe coding — logic-heavy, no physics complexity**

---

## A. Real Examples from the Community

### Sokobot
- **Source:** [yurukusa on itch.io](https://yurukusa.itch.io) · [dev.to](https://dev.to/yurukusa)
- **Genre:** Sokoban-style puzzle with procedural level generation
- **Engine:** Single HTML file (vanilla JS)
- **AI Tool:** Claude Code
- **Time:** Part of 30-day 5-game sprint
- **What worked:** Procedural level generation, grid-based movement, undo system all generated correctly
- **Shipped:** Yes, itch.io + GitHub Pages

### Minesweeper (Tabula Mag 10-run experiment)
- **Source:** Cited in [Chier Hu survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)
- **Engine:** HTML/JS via Claude Artifacts
- **AI Tool:** Claude Code
- **Cost per generation:** $0.18–$0.28
- **Time per generation:** 1m47s–2m53s
- **What worked:** Logic generation was reliable. Rules were correctly implemented every run.
- **What didn't:** Every run produced a visually different game. Different flag designs, different board sizes, different win-condition UX. Not reproducible.
- **Shipped:** [lodestoned.itch.io/minesweeper-made-by-claude-ai](https://lodestoned.itch.io/minesweeper-made-by-claude-ai)

### Chaotic Word Game (BEVARA SAI KUMAR)
- **Source:** [Medium article](https://medium.com/@bevarasaikumar121/i-vibe-coded-a-chaotic-word-game-with-claude-ai-in-one-afternoon-and-published-it-for-free-ebc4ef681a39)
- **Genre:** Word puzzle game
- **AI Tool:** Claude AI
- **Time:** One afternoon
- **Shipped:** Yes, itch.io for free
- **What worked:** Complete puzzle game from concept to published in an afternoon

### Mirror Maze: The Last Light
- **Source:** [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre)
- **Genre:** Puzzle (mirror/light reflection)
- **AI Tools:** ChatGPT + Minds
- **Shipped:** Yes, browser-playable

---

## B. Recommended Stack

Puzzle games are the friendliest genre for vibe coding because they:
- Are logic-driven (Claude's strength)
- Have no complex physics
- Often work as single-file HTML
- Are easy to test headlessly or with simple screenshots

**Best stacks:**
- **Single HTML file** (vanilla JS + Canvas) — ideal for grid/tile puzzles, word games, card-based puzzles. Zero dependencies, instant deployment.
- **Phaser 3** — better for animated puzzles, particle effects, polished UI
- **Godot 4** — best for complex puzzle games with interconnected scenes or 3D puzzle elements

**Asset tools:**
- Puzzles are ideal for minimalist or abstract art — often no assets needed at all
- If you want art: Kenney.nl puzzle packs, or generate tiles with Stable Diffusion / DALL-E
- Sound: jsfxr.com (free 8-bit SFX generator, browser-based)

---

## C. Prompting Strategy

**The power of puzzles for vibe coding:** You can define the entire game logic as rules in text, which maps perfectly to how AI reasons. A well-defined puzzle is a short specification document that Claude can implement almost perfectly.

**Write the rules document first:**
```
Puzzle rules:
1. 8x8 grid of colored tiles
2. Player clicks two adjacent tiles to swap them
3. If 3+ same-colored tiles are in a row/column after swap, they disappear
4. Above tiles fall down to fill gaps
5. New tiles fall from the top to fill remaining gaps
6. Score: 10 points per tile cleared, +50 for 4-in-a-row, +100 for 5+
7. Game ends when no valid moves remain
```
Hand this to Claude and ask it to implement one rule at a time.

**Undo systems:** Puzzle games need undo. Ask for this early:
```
Add a full undo system using a history stack.
Push current game state to history before every move.
Ctrl+Z or 'U' key restores previous state.
Limit history to 50 states to prevent memory issues.
```

**Procedural level generation:** For Sokoban-style puzzles, Claude handles level generators well:
```
Add a procedural level generator:
- Create a 10x10 grid
- Place walls randomly (30% density, never blocking all paths)
- Ensure player can reach all box targets (BFS reachability check)
- Generate 3 difficulty levels: easy (2 boxes), medium (4), hard (6)
- Store levels as 2D arrays in levels.js
```

**Word games:** For word validation, use a dictionary. Ask Claude to:
1. Create a small curated word list (1,000–5,000 common words) inline
2. Or fetch from a public dictionary API (Free Dictionary API at `api.dictionaryapi.dev`)

---

## D. Common Pitfalls

**State management bugs:** Puzzles often have complex state (grid contents, player inventory, move history). Claude may track state inconsistently across functions — define a single `gameState` object upfront and mandate that all functions read/write only through it.

**Edge case blindness:** Claude generates happy-path logic well but misses edge cases: what happens when the board fills up? When a chain reaction clears the entire board? When an undo restores an illegal state? Test these explicitly.

**Procedural level unsolvability:** Procedurally generated puzzles can be unsolvable. For Sokoban-style games, always include a BFS/DFS solvability check before presenting a level to the player. Tell Claude to include this — it won't add it by default.

**Win condition timing:** Match-3 games especially have timing issues — animations, tile falls, and chain reactions need to complete before checking win/lose conditions. Ask Claude to use animation callbacks (Phaser's `tween.onComplete`) or timeouts carefully.

**Mobile touch on grid games:** If targeting mobile, swipe detection on a grid is tricky. Explicitly specify:
```
Add touch/swipe controls:
- Touchstart captures position
- Touchend calculates swipe direction (up/down/left/right)
- Threshold: minimum 20px movement to register as swipe
- No accidental diagonal swipes (larger axis wins)
```

---

## E. Kick-off Prompt Template

```
I'm building a Sokoban puzzle game in a single HTML file (vanilla JS, no libraries).
Canvas size: 600x600. Grid: 12x12. Each cell: 48px.

Game rules:
- Player (@) moves with arrow keys on a grid
- Player can push boxes (B) by walking into them
- A box on a target square (*) changes color to show it's placed
- Level complete when all targets are covered with boxes
- R key resets current level
- Undo system: U key undoes last move (up to 50 moves history)

Objects: player, boxes, walls, floor, target squares

First task: render a hardcoded level and get player movement working.
The level should be a 2D array in a separate `levels.js` file.
Include one simple test level with 2 boxes and 2 targets.

After movement is confirmed working, I'll ask for more levels and undo.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Core mechanic working (one level) | 1–2 hours |
| Undo + 5 hand-crafted levels | 1 day |
| Procedural generation + difficulty scaling | 1–2 days |
| Polished release (animations, sound, menu) | 1 week |

**"Done" at MVP:** 3–5 levels are playable, win condition is clear, undo works.

**"Done" polished:** 20+ levels, level select screen, move counter, best-move leaderboard, smooth animations, sound, exportable to itch.io.

**Token cost:** $0.50–$3.00 for a complete puzzle game MVP.

---

*Sources: [yurukusa itch.io](https://yurukusa.itch.io) · [Minesweeper itch.io](https://lodestoned.itch.io/minesweeper-made-by-claude-ai) · [Medium word game](https://medium.com/@bevarasaikumar121/i-vibe-coded-a-chaotic-word-game-with-claude-ai-in-one-afternoon-and-published-it-for-free-ebc4ef681a39) · [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre) · [Chier Hu Medium](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)*
