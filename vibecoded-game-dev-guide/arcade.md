# Arcade & Classic Clones

**Difficulty:** ⭐ Easiest | **Best starting point for first-time vibe coders**

---

## A. Real Examples from the Community

### Minesweeper (Tabula Mag experiment)
- **Source:** Tabula Mag's 10-run Minesweeper experiment, cited in [Chier Hu's Medium survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)
- **Engine:** HTML/JS (Artifacts)
- **AI Tool:** Claude Code
- **Time:** ~2 minutes per generation
- **Cost:** $0.18–$0.28 per run
- **What worked:** Fast, reliable output. Core Minesweeper logic generated correctly on first try every time.
- **What didn't:** "Claude Code creates different applications each time it is run on the same requirements" — identical prompt, 10 different visual designs and UX choices
- **Shipped:** [lodestoned.itch.io/minesweeper-made-by-claude-ai](https://lodestoned.itch.io/minesweeper-made-by-claude-ai)
- **Key finding:** Demonstrated non-determinism. Useful for rapid prototyping, not reliable production pipelines.

### Space Invaders / Asteroids clones
- **Source:** TechRadar AI recreation article
- **Engine:** Claude Artifacts (HTML Canvas)
- **AI Tool:** Claude 3.x
- **Time:** Minutes
- **What worked:** "Claude excels at rapidly prototyping simple arcade games — Space Invaders, Asteroids clones in minutes"
- **What didn't:** Pixel-perfect recreation of specific retro games fails — "CSS blocks can never accurately create something down to the pixel level"
- **Key lesson:** Clones of classic mechanics = fast and reliable. Recreation of specific visual style = hard failure mode.

### Phaser Vertical Shooter (Troy Scott team)
- **Source:** [Chier Hu survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)
- **Engine:** Phaser 3
- **AI Tool:** Claude Code
- **Time:** 3 hours
- **What worked:** Claude handled ~70% of code generation cleanly
- **What didn't:** "Remaining 30% was debugging a subtle Phaser physics-group bug" — AI couldn't find it, human diagnosed
- **Shipped:** Yes

---

## B. Recommended Stack

**Engine:** Phaser 3 (browser) or HTML5 Canvas (pure JS)

Phaser 3 is the strongest choice for arcade games because it has been in LLM training data for years. Claude rarely hallucinates Phaser API calls. It handles sprites, input, collisions, and scene management out of the box.

For ultra-simple one-file games (Pong, Snake), raw HTML Canvas works and produces a single deployable `.html` file with zero dependencies.

**AI Tool:** Claude Code or Cursor — both work well here. For pure one-file browser output, Claude.ai Artifacts is the easiest path.

**Asset Tools:**
- Use placeholder rectangles and circles for prototyping (no art needed)
- Kenney.nl — free CC0 game assets, spritesheets, sound effects
- OpenGameArt.org — royalty-free

**Deployment:** GitHub Pages (free, instant), itch.io (free upload), Netlify (free static hosting)

---

## C. Prompting Strategy

**Initial prompt structure:**
```
You are building a [GAME NAME] clone in Phaser 3.

Tech stack:
- Phaser 3 (CDN, no build tool)
- Single HTML file
- No external assets — use colored rectangles and text

Game rules:
[2–3 sentences describing the core mechanic]

First feature only: [THE MOST BASIC PLAYABLE VERSION]
- [bullet: specific thing to build]
- [bullet: specific thing to build]
Do NOT add: sound, menus, or high scores yet.
```

**Iteration pattern:**
After each working version, add ONE thing:
1. Core mechanic (ball bouncing, ship moving)
2. Win/lose condition
3. Scoring
4. Game over screen
5. Sound (optional)
6. Polish

**What NOT to one-shot:** The full game including menus, levels, sound, and score saving. That prompt produces spaghetti.

**Handling context:** For 5-hour projects, use a CLAUDE.md:
```markdown
# [Game Name] — CLAUDE.md
Engine: Phaser 3 (single HTML file)
State: [brief description of current state]
DO NOT TOUCH: [list any functions/sections that work correctly]
Current task: [one thing]
```

---

## D. Common Pitfalls

**Physics group bugs:** Phaser's physics groups (StaticGroup, DynamicGroup) have edge cases Claude often gets wrong — especially when mixing physics types or adding/removing objects dynamically. Budget time to debug this manually.

**Canvas size / responsiveness:** Claude frequently generates fixed-width games (800×600) that look broken on phones. Add `<meta name="viewport">` and CSS scaling early.

**Score not persisting:** High score systems using `localStorage` are frequently generated with subtle bugs (reading before writing, wrong key names). Always test score persistence manually.

**"Winning" but the game isn't fun:** AI can make Pong where the ball is perfectly playable but not enjoyable — wrong speed, wrong ball size, wrong feel. Game feel is always your job to tune.

**Retro recreation trap:** Don't try to recreate a specific game pixel-for-pixel. Build the mechanics and accept that the visuals will be different.

---

## E. Kick-off Prompt Template

```
I want to build a Snake game in Phaser 3. Single HTML file, no build tools.
Use Phaser 3 loaded from CDN.

Game rules:
- Grid-based movement, snake grows when eating food
- Game over on wall collision or self-collision
- Food appears at random grid position when eaten

Technical details:
- Grid size: 20x20 cells, each cell 24px
- Move every 150ms
- Arrow keys for direction

First task only: Build the moving snake on a black grid with no food yet. 
I want to confirm movement works before adding food.

Include a CLAUDE.md comment block at the top of the file listing all 
functions and what they do.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Playable prototype (core mechanic only) | 30–60 min |
| Complete MVP (win/lose, score) | 2–4 hours |
| Polished release (menu, sounds, leaderboard) | 1–2 days |

**Token cost:** $0.20–$1.00 for a complete arcade game with Claude Code.

**"Done" at MVP:** Core loop works, score shows, game restarts cleanly, no crashes.

**"Done" polished:** Satisfying sound effects, smooth animation, readable UI, mobile-friendly, itch.io page with screenshots.

---

*Sources: [Chier Hu Medium](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992) · [TechRadar AI game](https://www.techradar.com/computing/artificial-intelligence/i-asked-ai-to-recreate-my-classic-1980s-platform-game-and-it-failed-miserably-but-im-still-impressed-by-the-tech) · [Tabula Mag Minesweeper](https://lodestoned.itch.io/minesweeper-made-by-claude-ai) · [GameDev AI Hub](https://gamedevaihub.com/vibe-coding-games/)*
