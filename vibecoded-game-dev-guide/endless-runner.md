# Endless Runner Games

**Difficulty:** ⭐⭐ Easy | **Simple loop, quick to prototype, strong mobile potential**

---

## A. Real Examples from the Community

### Deckroad (Runner × Card Game Hybrid)
- **Source:** [itch.io community thread](https://itch.io/t/6213388/deckroad-vibe-coded-with-claude-in-3-hours-runner-deckbuilding-with-zero-assets)
- **Engine:** Phaser 3
- **AI Tool:** Claude
- **Time:** ~3 hours
- **What made it notable:** The runner mechanic (obstacles, speed ramp, score) was built first, then card mechanics were layered on top at checkpoints. The runner loop was completed in under an hour.
- **Shipped:** Yes, itch.io

### Mobile Top-Down Runner (Abacus AI demo)
- **Source:** YouTube walkthrough — Abacus AI agent build session
- **Engine:** React Native + Expo
- **AI Tool:** Abacus AI agent
- **Time:** ~3 hours for full mobile APK
- **What worked:** The auto-scrolling movement loop and obstacle generation were among the first features the AI got right — the runner movement itself is mechanically simple.
- **Shipped:** Yes, APK installed on device

### Phaser Vertical Shooter (Troy Scott)
- **Source:** [Chier Hu survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992) · phaser.io news
- **Engine:** Phaser 3
- **AI Tool:** Claude (handled ~70% of work)
- **Time:** 3 hours
- **What worked:** Auto-scrolling parallax background, enemy wave patterns, collision detection — all handled without issues
- **Shipped:** Yes, browser-playable

### Vibe Jam 2026 Entries
- **Source:** itch.io Vibe Jam 2026 tag
- **Note:** Multiple endless runner entries submitted — this is one of the most common "first AI game" types because the core loop (move right, jump over obstacles, die, repeat) is so well-defined that Claude can implement it from a single clear description.

---

## B. Recommended Stack

Endless runners are among the most beginner-friendly genres for vibe coding. The game loop is short: scroll the world, generate obstacles, detect collisions, track score, game over. Almost any stack handles it.

**Best for browser:**
- **Phaser 3** — handles parallax backgrounds, sprite animation, and tweening cleanly. The auto-scrolling world pattern (moving the ground/obstacles instead of the character) is second nature to Phaser's game loop.
- **Single HTML file (Canvas API)** — works for extremely simple runners with no art. Under 200 lines of code for a functional prototype.

**Best for mobile:**
- **React Native + Expo** — easiest path to a real phone install. No physics engine needed for simple runners (just vertical position + gravity constant).
- **Godot 4** — if you want it on mobile AND desktop, export to both. GDScript handles runner logic cleanly.

**Asset tools:**
- Parallax backgrounds: Kenney.nl has free parallax sky/city/forest sets (CC0)
- Runner characters: any sprite with a run animation (Kenney's characters work)
- Obstacles: simple colored rectangles are fine for MVP
- Sound: jsfxr.com for jump/death SFX, freesound.org for background loops

---

## C. Prompting Strategy

**The runner loop in words:** The core mechanic is always: (1) character moves forward at constant speed (or world scrolls past), (2) obstacles spawn from the right and move left, (3) character can jump (one or two jumps), (4) collision with obstacle ends the game, (5) distance/score increases over time, (6) difficulty ramps (speed increases, obstacle frequency increases).

Give Claude this exact structure before anything else:

```
Build a side-scrolling endless runner in Phaser 3 (single HTML, CDN):
Canvas: 800x400

Game rules:
- Ground at y=350, extends infinitely (tiling sprite)
- Character: 40x60 rectangle (blue) sitting on ground
- Space bar or click to jump. Jump height: -400 velocity, gravity: 800
- Double jump allowed (second space while airborne)
- Obstacles: red rectangles (30x60) spawn at x=820, y=290 every 1.5–2s (random)
- Obstacles move left at 300px/s
- Collision with obstacle: stop game, show "Game Over" and score
- Score: distance traveled in meters (1 pixel = 0.1m)
- Speed increases by 10px/s every 10 seconds (cap at 600px/s)

First session: get the jump + obstacle loop working. No art, no sound, no menu.
```

**Parallax backgrounds:**
```
Add a 3-layer parallax background:
- Layer 1 (sky): solid color #87CEEB, stationary
- Layer 2 (clouds): white rectangles, scroll at 20px/s, wrap at x=-200
- Layer 3 (hills): dark green rectangles, scroll at 100px/s, wrap at x=-100
Ground tiles: gray rectangles, scroll at same speed as obstacles
```

**Procedural obstacle variety:**
```
Add 3 obstacle types, chosen randomly:
1. Low wall: 30x80 (jump over)
2. Ceiling spike: 30x50 from top (duck under — add Shift/Down to crouch)
3. Combo gap: no ground for 100px (must jump)
Spawn in sequence — never two ceilings in a row.
```

**High score persistence:**
```
Add localStorage high score:
- Show current score and best score during gameplay
- On game over, save if new high score
- Display "NEW BEST!" animation if record broken
```

**Mobile touch:**
```
Add touch controls:
- Tap anywhere to jump (same as space bar)
- No virtual buttons needed — just the tap
```

---

## D. Common Pitfalls

**Jump feel is everything.** The most complained-about issue in AI-built runners is "floaty" jump physics. You need to tune gravity and jump velocity manually:
- Start with gravity: 800, jump velocity: -400 in Phaser
- If it feels floaty, increase gravity to 1000–1200
- If it feels too stiff, reduce gravity to 600
Ask Claude to expose these as constants at the top of the file so you can tune without digging into game logic.

**Obstacle spawn randomness creates impossible sequences.** A purely random spawner can generate two obstacles so close together that no humanly-possible jump clears them. Add a minimum gap:
```
Minimum time between obstacle spawns: 1.2 seconds
After a ceiling obstacle, next obstacle must be ground-level (never two ceilings in a row)
```

**Double-jump state not resetting.** A common bug: if the player is standing on ground but the jump counter hasn't reset, the first jump works but second jump is permanently consumed. Always reset jump count in the `onCollideWithGround` callback, not just on landing.

**Difficulty curve.** AI-generated difficulty ramps are almost always too steep or too gradual. Common failure: the game becomes unplayably fast by second 30, or trivially easy for 2 minutes. Tune the ramp rate manually:
- Speed starts at 300px/s, increases 10px/s per 10 seconds
- Cap at 550px/s (human reaction time limit)
- Decrease spawn interval from 2.0s to 1.0s at 60 seconds

**No restart mechanism.** Claude often forgets a restart. After "Game Over," the player needs to press R or click to play again without a page reload. Ask for this explicitly: "Pressing Space or clicking 'Play Again' on the game-over screen fully resets game state and restarts."

**Mobile performance.** Endless runners with many objects on screen can drop below 60fps on low-end phones. Request object pooling for obstacles:
```
Use object pooling for obstacles: keep a pool of 5 obstacle objects,
move them back to x=900 and reuse rather than creating/destroying.
```

---

## E. Kick-off Prompt Template

```
I'm building an endless runner in Phaser 3 (single HTML file, CDN).
Canvas: 800x400. No external assets — use colored rectangles for everything.

Character: 40x60 blue rectangle
Ground: gray tiling bar at y=370, height 30
Obstacles: red rectangles (30x80) spawn from right edge

Rules:
- World scrolls left at 280px/s (starting speed)
- Character jumps with Space bar (velocity -380, gravity 900)
- Double jump: second Space while airborne
- Obstacle spawns every 1.8–2.5 seconds (random)
- Collision with obstacle → Game Over screen with score
- Score: time survived in seconds (show as "0.0s")
- Speed increases 10px/s every 8 seconds

First session — build ONLY:
1. Character visible on ground, gravity applied
2. Space bar makes character jump
3. One type of obstacle (red rectangle) moves from right to left
4. Obstacle disappears when it exits left edge
5. Score counter (time in seconds) displayed top-right

Do NOT add: double jump, menu, high score, sound, or art.
Confirm the basic run → obstacle → game over loop before anything else.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Jump + obstacle collision working | 1–2 hours |
| 3 obstacle types + difficulty ramp | 1 day |
| Parallax background + character animation | 1 day |
| High score + sound effects | 2–4 hours |
| Polished mobile release | 1 week |

**"Done" at MVP:** Character jumps, obstacles spawn and kill you, score counts, restart works.

**"Done" polished:** 3 obstacle types, animated character, parallax background, high score saved, jump SFX, mobile touch support, speed ramp.

**Token cost:** $0.50–$2.00 for a complete endless runner MVP. One of the cheapest genres.

**Why runners work so well for vibe coding:** The spec fits in 10 sentences. Claude has seen thousands of runner implementations in training data. There are almost no "gotcha" systems — no save corruption, no pathfinding, no state explosion. It is the cleanest possible introduction to AI-assisted game development.

---

*Sources: [Deckroad itch.io thread](https://itch.io/t/6213388/deckroad-vibe-coded-with-claude-in-3-hours-runner-deckbuilding-with-zero-assets) · [Chier Hu Medium survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992) · [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre)*
