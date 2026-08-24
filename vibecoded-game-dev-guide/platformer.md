# Platformer (2D Side-Scrolling)

**Difficulty:** ⭐⭐⭐ Medium | **Reliable for 2D, fails fast in 3D or complex-map variants**

---

## A. Real Examples from the Community

### Chong-U's Pixel Platformer (tutorial case study)
- **Source:** YouTube tutorial by Chong-U (AI Oriented Dev) — basis for the previous guide in this collection
- **Engine:** Phaser 3 + Oak Woods asset pack
- **AI Tool:** Claude Code (Opus 4.5)
- **Time:** One session (~2–3 hours)
- **What worked:** Background parallax layers, physics-based player, all animation states (idle, run, jump, attack), infinite horizontal scrolling, decorative prop placement
- **What didn't:** Frame size miscalculation caused animation artifacts (ghost image alongside character) — root cause was Claude incorrectly assuming the spritesheet was square (448×392 px, not square)
- **Key unlock:** Playwright MCP server let Claude take screenshots and press keys to test the game automatically
- **Asset:** Oak Woods Environment by brullov ([brullov.itch.io/oak-woods](https://brullov.itch.io/oak-woods)) — free, 4.8/5 rating

### Classic 1980s Platform Recreation (failure case)
- **Source:** [TechRadar](https://www.techradar.com/computing/artificial-intelligence/i-asked-ai-to-recreate-my-classic-1980s-platform-game-and-it-failed-miserably-but-im-still-impressed-by-the-tech)
- **Game:** "Sprog!" — a caveman-jumps-over-holes sidescroller
- **Engine:** Claude Artifacts (HTML Canvas / CSS)
- **What failed:** CSS rendering can't achieve pixel-perfect recreation. The generated caveman character looked nothing like the original. The game became unplayable after attempts to fix graphics.
- **Lesson:** Recreating a *specific* game's look and feel from screenshots is impossible with current tools. Building *new* platformers with original art is much more tractable.

### Hedgietown / Hedgie's Easter Egg Hunt
- **Source:** [Chier Hu survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)
- **Creator:** Non-engineer designer (no coding background)
- **Engine:** Unity
- **AI Tool:** Claude Code
- **What worked:** Designer created a complete minigame without writing any code
- **Key insight:** Even complex engines like Unity are accessible to non-engineers via Claude Code when limited to C# scripting (not visual Blueprint/editor manipulation)

---

## B. Recommended Stack

**Best stack for a vibecoded platformer:**
- **Engine:** Phaser 3 (2D browser) — ideal for beginners and browser deployment
- **Physics:** Phaser's built-in Arcade Physics — handles platforms, gravity, and jump correctly on first try almost always
- **Alternative:** Godot 4 — better for complex maps, tilemaps, and eventual Steam release

**Asset packs that work well (Claude knows these):**
- Oak Woods Environment (brullov) — parallax BGs, character spritesheet, tileset — [brullov.itch.io/oak-woods](https://brullov.itch.io/oak-woods)
- Kenney Platformer Pack — CC0, clean tiles and characters
- LPC (Liberated Pixel Cup) sprite packs on OpenGameArt

**Testing:** Playwright MCP server — lets Claude press left/right/jump and take screenshots to verify physics and animations automatically. Install: `claude mcp add playwright npx @playwright/mcp@latest`

---

## C. Prompting Strategy

**The step-by-step order that works:**

1. **Background layers only** — load parallax backgrounds, confirm they display
2. **Ground tileset** — single flat row of tiles at bottom, confirm rendering
3. **Player physics** — player falls with gravity, lands on ground, no movement yet
4. **Movement** — left/right keys, check movement works before adding animation
5. **Jump** — jump key, confirm ground detection works for double-jump prevention
6. **Animations** — idle, run, jump states wired to physics states (this is where bugs hide)
7. **Scrolling** — camera follows player, background layers parallax at different speeds
8. **Attack** — separate session for attack animation and hitbox

**Why this order matters:** The Chong-U tutorial shows that when Claude tried to do all of this at once, animation artifacts appeared. Going step by step meant each system was verified before building on top of it.

**Spritesheet prompting:**
Before writing any code, have Claude analyze your spritesheet and produce an `assets.json`:
```
Study the character spritesheet at assets/character.png.
Count the frames per row and rows per animation.
Note the pixel dimensions of the full sheet.
Output an assets.json with:
- frameWidth and frameHeight (total_width / columns, total_height / rows)
- For each animation: name, startFrame, endFrame, frameRate, repeat (-1 for loop, 0 for once)
- Flag any rows that appear to be empty/padding frames
```
Then verify this JSON against the actual image before proceeding.

**Handling animation bugs:**
If you see a "ghost" image alongside your character, the `frameWidth` or `frameHeight` is wrong. Tell Claude:
```
There is a visual artifact — a ghost copy of the sprite appears to the left 
of the character. This indicates frameWidth or frameHeight is incorrect.
The full spritesheet is [W]×[H]px with [N] columns and [M] rows.
Recalculate: frameWidth = W/N, frameHeight = H/M.
Update the spritesheet loader and take a new screenshot to verify.
```

---

## D. Common Pitfalls

**Spritesheet frame size is wrong:** The #1 bug in Phaser platformers. Claude sometimes assumes spritesheets are square. Always specify dimensions explicitly. Always verify with a screenshot before building animation logic.

**Empty padding frames:** Many spritesheets have 1–2 empty frames at the end of a row as padding. If Claude doesn't account for these, the animation plays a blank frame — character appears to "flash." Tell Claude about empty frames explicitly.

**Ground tile renders too high/low:** Getting the tileset Y position right takes iteration. Use Playwright to take screenshots and describe the issue: "The ground row is floating 30px above the bottom of the screen — move it down."

**Platform edge cases:** Phaser's Arcade Physics has edge cases when a player walks off a ledge (sometimes they don't fall immediately). Test edge-walking specifically.

**Infinite scroll only goes right:** One-directional scrolling is easy; true back-and-forth scrolling requires camera bounds. Clarify which you want upfront.

**Jump feels bad:** AI-generated jump parameters (velocity, gravity) often produce jumps that feel floaty or abrupt. Tune `gravity`, `jumpVelocity`, and the `maxVelocityY` after the physics work correctly.

**Metroidvania trap:** Adding interconnected maps, locked doors, and backtracking dramatically increases complexity. See [metroidvania.md](metroidvania.md) — this is a different difficulty tier entirely.

---

## E. Kick-off Prompt Template

```
I'm building a 2D side-scrolling platformer in Phaser 3.
Single HTML file, Phaser 3 from CDN, no build tools.
Target: desktop browser (1280×720).

Assets: I'll use placeholder colored shapes for now — no image files.

Architecture — include this at the top of the file as a comment block (CLAUDE.md):
- all game objects and their purpose
- all keyboard controls
- all physics parameters

First session — build ONLY:
1. Static background (dark blue sky)
2. A row of green platform tiles at y=600, spanning the full width
3. Player character: orange rectangle (32×48px), spawns at (100, 400)
4. Gravity: player falls and lands on platform
5. Left/right arrow movement (speed: 200px/s), space to jump (velocity: -450)
6. Player cannot leave screen horizontally

No enemies, no scrolling, no animations yet.
Show me the game is physics-correct before we add anything else.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Physics correct (walk, jump, land) | 1–2 hours |
| Animations wired to physics states | 2–4 hours |
| Scrolling world + multiple platforms | 1 day |
| Enemies + hazards + collectibles | 1–2 days |
| Level design (2–3 levels) | 2–3 days |
| Polished release (art, sound, menu) | 1 week |

**"Done" at MVP:** Player walks, jumps, lands on platforms, can die and restart. Maybe 3 platforms and one type of hazard.

**"Done" polished:** 3+ levels, animated character with art, sound effects, music, collectibles, enemies, main menu, itch.io page.

---

*Sources: [Chong-U YouTube](https://www.youtube.com/@AIOrientedDev) · [brullov.itch.io/oak-woods](https://brullov.itch.io/oak-woods) · [TechRadar](https://www.techradar.com/computing/artificial-intelligence/i-asked-ai-to-recreate-my-classic-1980s-platform-game-and-it-failed-miserably-but-im-still-impressed-by-the-tech) · [Chier Hu Medium](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)*
