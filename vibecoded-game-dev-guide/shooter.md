# Shooter (Top-Down, Space, Twin-Stick, Bullet Hell)

**Difficulty:** ⭐⭐⭐ Medium | **Strong community track record, one major real-world mobile example**

---

## A. Real Examples from the Community

### Mobile Top-Down Shooter — Abacus AI (YouTube case study)
- **Source:** YouTube video by content creator using Abacus AI agent
- **Genre:** Top-down mobile shooter (wave-based, arena)
- **Engine:** React Native + Expo (chosen by the AI — not typical)
- **AI Tool:** Abacus AI Agent ($10–$20/month)
- **Time:** ~3 hours total (30–40 min of actual typing; rest was waiting)
- **What worked:**
  - Entire core game built: joystick, auto-shoot, multiple weapons, health/score, enemies
  - AI added intelligent enemy pathfinding (obstacle avoidance at multiple angles), smooth camera follow, mini-map — unrequested
  - 5 different level layout types (symmetric, maze, pillars, fortress, bunkers) that rotate every 5 waves
  - AdMob integration (rewarded ad on death + interstitial) implemented correctly
  - Pixel art sprite generation (Nanabanana 2 model: player + 4 zombie types, 4-frame idle/walk animations)
  - APK built and installed on real phone via Expo Application Services
- **What didn't:**
  - React Native + Expo Go can't run native modules (like Google Mobile Ads) — required full APK build to test ads
  - ~2,000+ credits wasted going in circles on the native module issue before diagnosis
  - Sprite files were JPEG saved with PNG extension — caused first APK build failure
  - Joystick spawned off-center initially
  - Players could spawn inside walls
- **Key lesson:** When the AI picks an unconventional stack (React Native for a game), question it — but also trust it if the output works. The ad integration eventually worked in native build.
- **Shipped:** Prototype on phone. Not on Play Store yet (needs AAB, real AdMob IDs, privacy policy, store listing).

### Phaser Vertical Shooter (Troy Scott)
- **Source:** [Chier Hu's Claude Code game dev survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992) · [phaser.io tutorial](https://phaser.io/news/2026/02/phaser-claude-code-tutorial)
- **Genre:** Vertical shooter (shmup)
- **Engine:** Phaser 3
- **AI Tool:** Claude Code
- **Time:** 3 hours
- **What worked:** Claude handled ~70% of code generation — enemy patterns, bullet physics, score system
- **What didn't:** "Remaining 30% was debugging a subtle Phaser physics-group bug" — required human diagnosis
- **Shipped:** Yes

### Neon Drift + Gunslinger: Last Stand (Vibecode.game collection)
- **Source:** [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre)
- **Engine:** Various
- **AI Tools:** Claude + Minds platform
- **Genre:** Top-down shooter variants
- **Shipped:** Yes, browser-playable

### Space Explorer (vibe coding experiment)
- **Source:** [drbaumberg.itch.io/space-explorer-vibe-coding](https://drbaumberg.itch.io/space-explorer-vibe-coding)
- **Genre:** Space exploration/shooter
- **Engine:** Not specified
- **AI Tool:** Not specified
- **Shipped:** Yes, itch.io

---

## B. Recommended Stack

**Browser-based (recommended for beginners):**
- **Engine:** Phaser 3
- **Why:** Phaser has deep training data coverage. Its arcade physics, group management, and scene system handle the standard shooter requirements cleanly.
- **Deployment:** Single HTML file → itch.io, GitHub Pages, Netlify

**Desktop/Mobile native:**
- **Engine:** Godot 4 — export to mobile (Android/iOS) or desktop with minimal effort
- **Alternative:** React Native + Expo (as the Abacus case shows — works for simple arcade shooters, but native modules like ads require a full build)

**Framework-free browser:**
- HTML5 Canvas + vanilla JS — works for very simple shooters, generates a single deployable file

**Asset Tools:**
- Kenney.nl Space Shooter pack (free, CC0 — sprites, backgrounds, effects)
- OpenGameArt bullet sprite packs
- Mubert or Udio for background music
- Nanabanana Pro (pixel art generation) for custom characters

---

## C. Prompting Strategy

**Always start with player movement only.** Don't ask for enemies, bullets, or UI in the first prompt.

```
Step 1: Player ship that moves with arrow keys, stays within screen bounds
Step 2: Player can shoot bullets upward with spacebar (or auto-fires)
Step 3: One enemy type appears at top, moves down
Step 4: Collision detection — bullet kills enemy, enemy kills player
Step 5: Score and lives display
Step 6: Wave system — more enemies each wave
```

**Enemy patterns — prompt each separately:**
- "Add a zigzag enemy that moves left-right while descending"
- "Add a diving enemy that targets the player's X position"
- "Add a formation enemy that moves with siblings"

Never say "add 5 enemy types" in one prompt.

**For mobile/joystick controls:**
Explicitly specify the joystick library or method. If using Phaser:
```
Add a virtual joystick using Phaser's built-in pointer input.
Left thumb area (bottom-left quadrant): movement joystick
Auto-firing is already implemented — do not change it.
```

**For ads (mobile):**
This requires a native build. Tell Claude upfront:
```
This game will be built as a native Android APK with Expo/EAS.
We will need AdMob integration. Use Google Mobile Ads for React Native.
Note: Expo Go preview will NOT work for ad testing — APK build required.
```
Knowing this upfront saves the 2,000-credit circle that the Abacus case study experienced.

**For boss enemies:** Treat bosses as their own session. A boss fight is essentially a puzzle game within a shooter. Define the phases explicitly:
```
Add a boss with 3 phases:
Phase 1 (100–60% HP): shoots 3-spread shot every 2 seconds
Phase 2 (60–30% HP): adds circular bullet ring every 4 seconds
Phase 3 (30–0% HP): increases movement speed and shot frequency by 50%
HP bar displayed at top of screen during boss fight.
```

---

## D. Common Pitfalls

**Physics group performance:** Phaser StaticGroup vs DynamicGroup vs plain GameObjects matters significantly for performance. Claude sometimes creates physics bodies for every bullet unnecessarily — this tanks performance at 50+ projectiles. Explicitly request object pooling:
```
Use an object pool for bullets — reuse GameObjects rather than 
creating/destroying them. Maximum pool size: 100 bullets.
```

**Hitbox mismatch:** Generated hitboxes are often the full sprite size, making the game feel unfair. Specify hitbox sizes:
```
Player hitbox: 16x16 centered on sprite (sprite is 48x48)
Enemy hitboxes: 80% of sprite size
```

**Difficulty cliff:** Auto-generated wave scaling (enemies × wave number) creates games that are trivially easy for 5 waves then brutally hard at wave 6. Hand-tune the scaling formula after Claude generates it.

**Mobile touch controls latency:** In the Abacus case, joystick position was wrong initially. Always test touch controls on device early.

**Native module trap (mobile):** If your game needs native SDK features (AdMob, in-app purchases, push notifications), you cannot test with Expo Go. You must build an APK/IPA. Know this before spending hours debugging.

---

## E. Kick-off Prompt Templates

**Browser shooter (Phaser 3):**
```
I'm building a top-down space shooter in Phaser 3, single HTML file, 
no build tools. Phaser 3 from CDN.

Game concept: Player ship shoots upward, waves of enemy ships descend.
Art style: placeholder colored rectangles (no assets needed yet).

First session — build ONLY these:
1. Black 800x600 canvas
2. Player ship (white rectangle, 40x60px) at bottom center
3. Arrow keys for left/right movement, stays in bounds
4. Auto-fires bullets (yellow rectangles, 6x16px) upward every 0.3s
5. Include CLAUDE.md comment block listing all game objects

Do NOT add: enemies, score, sound, or menu. Confirm scope before coding.
```

**Mobile shooter (Godot → Android):**
```
I'm building a top-down mobile shooter in Godot 4. 
Target: Android export (portrait orientation, 1080x1920 virtual res).

Architecture:
- scenes/Game.tscn (main), scenes/Player.tscn, scenes/Enemy.tscn
- scripts/Player.gd, scripts/Enemy.gd, scripts/GameManager.gd
- CLAUDE.md

First session ONLY:
1. Virtual joystick (bottom-left), auto-shoot toward nearest enemy
2. Player moves in 8 directions
3. One basic enemy: spawns at top, moves toward player
4. HP bar in top-left corner

Do not add multiple enemy types, weapons, or UI polish yet.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Player + shooting (no enemies) | 1 hour |
| Basic enemies + collision + score | 2–3 hours |
| Wave system + multiple enemy types | 1 day |
| Boss fight + difficulty curve | 1–2 days |
| Mobile build with ads (APK) | 3 hours (Abacus case) to 1 week |
| Play Store submission-ready | 1–2 weeks additional |

**Cost estimate (Abacus AI case):** ~3 hours on $20/month plan, but 2,000+ credits lost to the native module debugging cycle.

**"Done" at MVP:** Player shoots, enemies come in waves, you can die and restart, score displays.

**"Done" polished:** Multiple weapon types, 5+ enemy types with different behaviors, boss fights, power-up pickups, original art, sound, mobile controls if applicable.

---

*Sources: [Abacus AI YouTube](https://www.youtube.com/watch?v=5A8i3Ym_Ibw) · [Chier Hu Medium](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992) · [phaser.io tutorial](https://phaser.io/news/2026/02/phaser-claude-code-tutorial) · [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre) · [GIGAZINE CODEX MORTIS](https://gigazine.net/gsc_news/en/20251215-codex-mortis/)*
