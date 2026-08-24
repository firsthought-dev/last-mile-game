# The Vibecoded Game Dev Guide

**A community-sourced reference for building games with AI assistance**  
*Synthesized from r/vibecoding, r/aigamedev, r/ClaudeCode, r/gamedev, r/indiegamedev, Godot Forum, itch.io devlogs, GitHub repos, and shipped-game postmortems — August 2026*

---

## What This Guide Is

This is a practical handbook for building games using AI coding tools — what the community calls "vibe coding." It documents what actually works, what fails, and what people have shipped. Every claim cites a real source.

**What vibe coding means here:** You describe what you want in plain language. An AI agent (Claude Code, Cursor, GPT-4o, etc.) writes the code. You test, redirect, and iterate. No programming experience required to start — but the smarter you are about structuring your asks, the farther you get.

**The honest headline:** The community has shipped hundreds of games this way. Puzzle games, roguelikes, bullet hells, and multiplayer browsers games all have strong success rates. Complex 3D, RTS, and metroidvania-scale projects hit a hard wall. This guide tells you where that wall is for each genre.

---

## How to Use This Guide

1. **Pick your genre** from the Quick-Start table below
2. **Open that genre file** — it's self-contained with real examples, a recommended stack, prompting strategy, pitfalls, and a copy-paste kick-off prompt
3. **Check the Tool Comparison table** if you're deciding which AI tool to use
4. **Come back to INDEX.md** for cross-genre patterns and the universal rules that apply everywhere

---

## Quick-Start by Genre

| Genre | Difficulty | Best Engine | Best AI Tool | Genre File |
|---|---|---|---|---|
| Arcade / Classic Clone | ⭐ Easiest | Phaser 3 / HTML Canvas | Claude Code or Cursor | [arcade.md](arcade.md) |
| Puzzle | ⭐⭐ Easy | Phaser 3 / Godot 4 | Claude Code | [puzzle.md](puzzle.md) |
| Idle / Clicker | ⭐⭐ Easy | HTML + Vanilla JS | Any | [idle-clicker.md](idle-clicker.md) |
| Endless Runner | ⭐⭐ Easy | Phaser 3 | Claude Code / Cursor | [endless-runner.md](endless-runner.md) |
| Platformer | ⭐⭐⭐ Medium | Godot 4 / Phaser 3 | Claude Code | [platformer.md](platformer.md) |
| Roguelike / Roguelite | ⭐⭐⭐ Medium | Godot 4 / Python+Pygame | Claude Code | [roguelike.md](roguelike.md) |
| Shooter (top-down / bullet hell) | ⭐⭐⭐ Medium | Phaser 3 / Godot 4 | Claude Code | [shooter.md](shooter.md) |
| Tower Defense | ⭐⭐⭐ Medium | Godot 4 / Phaser 3 | Claude Code + GodotIQ | [tower-defense.md](tower-defense.md) |
| Card / Deck-Building | ⭐⭐⭐ Medium | Phaser 3 / Godot 4 | Claude Code | [card-game.md](card-game.md) |
| Visual Novel | ⭐⭐⭐ Medium | Godot 4 (Dialogic) / Ren'Py | Claude Code | [visual-novel.md](visual-novel.md) |
| Simulation | ⭐⭐⭐ Medium | Godot 4 / Python | Claude Code | [simulation.md](simulation.md) |
| RPG | ⭐⭐⭐⭐ Hard | Godot 4 | Claude Code | [rpg.md](rpg.md) |
| Horror | ⭐⭐⭐⭐ Hard | Godot 4 | Claude Code | [horror.md](horror.md) |
| Survival | ⭐⭐⭐⭐ Hard | Godot 4 | Claude Code | [survival.md](survival.md) |
| Multiplayer | ⭐⭐⭐⭐ Hard | Phaser 3 + SpacetimeDB | Claude Code | [multiplayer.md](multiplayer.md) |
| Strategy / RTS / 4X | ⭐⭐⭐⭐⭐ Expert | Godot 4 | Claude Code | [strategy.md](strategy.md) |
| Metroidvania | ⭐⭐⭐⭐⭐ Expert | Godot 4 | Claude Code | [metroidvania.md](metroidvania.md) |

---

## Tool Comparison Table

| Tool | Best For | Cost | Key Strength | Key Weakness |
|---|---|---|---|---|
| **Claude Code** | Complex multi-file projects, long sessions | ~$20/mo (Sonnet) or $200/mo (Max) | Best at refactoring, context, CLAUDE.md | Can hallucinate niche APIs |
| **Cursor** | VS Code users, quick iteration | Free / $20–60/mo | IDE integration, autocomplete | Agent mode less autonomous |
| **Bolt.new** | Browser prototypes, no local setup | Free (150K tokens/day) / $20–25/mo | Instant playable output | Hard to scale past prototype |
| **Rosebud AI** | Complete beginners, 2D web games | Free tier + paid | Purpose-built for games | Limited engine control |
| **GDevelop AI Agent** | No-code, visual event-driven games | Free (40 credits/mo) | No coding needed at all | Limited genre range |
| **Replit Agent** | Hosted full-stack with backend | Free (limited) / $20–25/mo | Built-in hosting | Can lose context in big projects |
| **GPT-4o (Codex CLI)** | Short tasks, well-known stacks | Per token | Broad training data | Less agentic than Claude Code |

**Community consensus (mid-2026):** Claude Code with Sonnet 4.6 handles ~90% of game dev work; switch to Opus only for gnarly refactors or architecture decisions. The $200/month Claude Max flat-rate subscription is worth it only if you're building daily.

---

## Universal Rules (Apply to Every Genre)

These emerged from hundreds of community projects. Ignore them at your cost.

### 1. Commit after every working change
"Git is your real undo button." — multiple community members. Every working state deserves a commit before the next feature. When (not if) the AI breaks something, `git checkout` is your recovery.

### 2. One feature at a time
Asking Claude to "add enemies, a scoring system, level progression, and a main menu" in one prompt reliably produces broken code. One scoped feature per prompt, verify it works, then move on.

### 3. Write a CLAUDE.md before you start
Put your game's architecture, file structure, and "DO NOT MODIFY" sections into a file called `CLAUDE.md` at the project root. Claude Code reads it automatically. "Every minute you spend on CLAUDE.md saves ten minutes of correcting AI-generated code." — Chier Hu, Medium (via extensive community survey)

### 4. The 70% Problem is real
AI gets you 70% of the way fast. The last 30% — polish, game feel, subtle bugs — takes disproportionate effort. Budget for it.

### 5. Start a fresh chat for each major feature
Extended chats degrade. The model "quietly skips steps and forgets entire chunks of functionality" after 40–50 messages. When starting something fundamentally new (new scene, new system), start a new session and paste in context from CLAUDE.md.

### 6. Use `/compact` before you hit the wall
In Claude Code, run `/compact` when your context approaches 50%. It compresses the conversation without losing key decisions. After compacting, remind Claude of the current state with a brief summary.

### 7. Text-based > visual
AI works best on text. Roguelikes with ASCII output, narrative games, logic-heavy puzzle games — these succeed most reliably. Pixel-perfect graphics, animation timing, and "game feel" are always the hardest parts.

### 8. Test visually with Playwright or screenshots
Claude can't press Play. Use the Playwright MCP server (`claude mcp add playwright npx @playwright/mcp@latest`) to give Claude browser eyes — it can take screenshots, press keys, and verify visual output automatically.

### 9. Pin your engine version
Fast-moving stacks (Bevy, Three.js TSL, Godot 4.x) change APIs frequently. Claude's training data may be one or two versions behind. Pin your version in the project README and in CLAUDE.md.

### 10. Ugly MVPs don't sell in games
Unlike web apps, first impressions matter enormously in games. Even a 1-day game jam entry needs readable UI and at least placeholder art. Factor this into your timeline.

---

## Vibe Jam 2026: The Community Benchmark

The 2026 Cursor Vibe Jam set a useful benchmark for what AI-assisted game development can produce at scale:

- **945 submissions** (some sources say ~1,000+)
- **240,000+ players** engaged
- **$40,000 prize pool** ($25K gold, $10K silver, $5K bronze)
- **Required:** 90% AI-generated code minimum
- **Sponsors:** Cursor, Bolt.new, Glif, Tripo AI

Genres that dominated: arcade clones, puzzle games, casual runners, and roguelites. 3D and strategy entries were rare and generally placed lower.

---

## The Revenue Reality

The most transparent case study came from developer **yurukusa**, who documented 30 days of building with Claude Max ($200/month):

- 5 games shipped across Godot and Python
- 50,000+ lines of code generated
- 1,079 sessions logged
- $4.99 total revenue

**Source:** [dev.to/yurukusa](https://dev.to/yurukusa/the-token-per-dollar-math-running-claude-max-for-30-days-2k1o)

This isn't a failure story — it's a baseline. Skills improve substantially (yurukusa reported 9× token efficiency by day 30). But if you're building games to make money quickly, manage expectations accordingly.

---

## Genre Files in This Guide

- [arcade.md](arcade.md) — Classic clones: Pong, Snake, Breakout, Space Invaders, Asteroids
- [puzzle.md](puzzle.md) — Logic puzzles, Sokoban variants, match-3, minesweeper
- [idle-clicker.md](idle-clicker.md) — Idle games, incremental mechanics, clicker loops
- [endless-runner.md](endless-runner.md) — Auto-runners, dodge games, procedural scrollers
- [platformer.md](platformer.md) — Side-scrolling platformers, 2D action
- [roguelike.md](roguelike.md) — Roguelikes, roguelites, dungeon crawlers, bullet heaven
- [shooter.md](shooter.md) — Top-down shooters, bullet hell, space shooters, twin-stick
- [tower-defense.md](tower-defense.md) — Tower defense with wave management
- [card-game.md](card-game.md) — Card games, deck-builders, tabletop digital
- [visual-novel.md](visual-novel.md) — Story games, branching narrative, dialogue systems
- [simulation.md](simulation.md) — City builders, farm sims, management games
- [rpg.md](rpg.md) — RPGs, action-RPGs, dungeon crawlers with progression
- [horror.md](horror.md) — Horror games, atmospheric narrative, survival horror
- [survival.md](survival.md) — Survival mechanics, crafting, resource management
- [multiplayer.md](multiplayer.md) — Real-time multiplayer, browser-based shared worlds
- [strategy.md](strategy.md) — Turn-based strategy, 4X, RTS
- [metroidvania.md](metroidvania.md) — Metroidvanias, Soulslike, large interconnected maps

---

*Sources: r/vibecoding · r/aigamedev · r/ClaudeCode · r/gamedev · Godot Forum · Medium · itch.io devlogs · GitHub*
