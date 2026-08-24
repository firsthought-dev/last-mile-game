# Horror Games

**Difficulty:** ⭐⭐⭐ Medium | **Atmosphere > mechanics — AI excels at writing dread**

---

## A. Real Examples from the Community

### How to Date a Sleep Paralysis Demon (Demo)
- **Source:** [itch.io AI-generated VN list](https://itch.io/games/genre-visual-novel/tag-ai-generated)
- **Developer:** SFour
- **Genre:** Visual novel / horror dating sim
- **Engine:** Ren'Py
- **What worked:** Horror atmosphere in a VN context is primarily about text tone, pacing, and sound — all things AI handles well. The "horror dating sim" subgenre is a thriving itch.io niche.
- **Shipped:** Yes (Demo), browser-playable

### How to Date an Entity (and stay alive)
- **Source:** [itch.io AI-generated VN list](https://itch.io/games/genre-visual-novel/tag-ai-generated)
- **Developer:** SFour
- **Genre:** Visual novel / dating sim with survival horror elements
- **Price:** Free
- **Note:** Same developer, same horror-romance genre. Shows specialization works — SFour has built a mini-brand around AI-assisted horror VNs.
- **Shipped:** Yes, browser-playable

### Mirror Maze: The Last Light
- **Source:** [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre)
- **Genre:** Puzzle horror (mirror/light mechanics with horror atmosphere)
- **AI Tools:** ChatGPT + Minds
- **What worked:** Environmental horror — oppressive atmosphere, dark aesthetic, light-as-mechanic creating tension — layered over a puzzle game foundation.
- **Shipped:** Yes, browser-playable

### Community horror pattern (r/vibecoding)
- **Source:** r/vibecoding + itch.io
- **Pattern:** Horror is predominantly VN-adjacent (text-heavy, choice-driven, atmosphere-first) in the vibe coding community. Mechanical horror (jump scares, AI enemy behavior, stealth systems) is less common because the fear mechanics require more technical complexity.
- **Common subgenres:** text horror, horror VN, RPG Maker-adjacent horror, atmospheric puzzle horror

---

## B. Recommended Stack

Horror games in the vibe coding community are almost always one of two types: **atmospheric visual novels** (text + image + sound = dread) or **atmospheric puzzle games** (light, darkness, and mystery). The rare third type is a survival horror game with an AI enemy — technically the hardest.

**For horror VNs (most common):**
- **Ren'Py** — the gold standard. Horror VNs live on text pacing and sound cues, and Ren'Py handles both natively. Atmospheric effects (screen shake, distortion filters) are built in.
- **Twine** — for pure text horror / interactive fiction without character sprites. Closest to classic horror text adventures.

**For atmospheric puzzle horror:**
- **Phaser 3** — handles darkness/light mechanics well (use masks, lighting effects, fog of war shaders).
- **Single HTML file (Canvas)** — sufficient for minimalist horror (text on black screen, timed reveals, ambient sound).

**For survival horror (hardest):**
- **Godot 4** — best option for enemy AI, stealth mechanics, line-of-sight detection. Has built-in NavigationAgent2D for enemy pathfinding and Area2D for detection zones.
- This is significantly harder to vibe-code than the other two types — it requires working AI behavior, stealth state machines, and tightly tuned horror pacing.

**Sound — more important in horror than any other genre:**
- Ambient loops: freesound.org (search "horror ambience" — huge free library)
- Jump scare SFX: freesound.org, jsfxr.com (8-bit but surprisingly effective for lo-fi horror)
- Ren'Py has AudioChannel control for layering ambient + music + SFX simultaneously

---

## C. Prompting Strategy

**Horror is about withholding information.** The mechanics serve the atmosphere, not the other way around. AI is very good at this because atmosphere is primarily achieved through writing and pacing.

**Start with the writing, not the code:**
```
Write a horror visual novel opening scene with this premise:
[Your premise — 2 sentences]

Tone: Dread through implication. Never show the monster directly.
Pacing: Short paragraphs. Sentences fragment at moments of fear.
Technique: Use the second person ("you hear..."). Build tension through 
small wrong details before anything overtly supernatural.

Output: Ren'Py script format, first 3 scenes.
Scene 1: Arrival (establish "something is wrong")
Scene 2: First discovery (confirm something is wrong, don't explain what)
Scene 3: First choice point (investigate or leave)
```

**Atmosphere mechanics in Phaser 3 (for puzzle horror):**
```
Implement a darkness/light horror mechanic:
- Canvas is black by default (fill with black each frame)
- Player has a flashlight: draw a circular light cone at player position
- Light radius: 120px at full (slowly shrinks to 80px over 30 seconds — battery draining)
- Objects in darkness: not visible (don't render sprite if outside light radius)
- Add a "shadow flicker" effect: every 8–15 seconds (random), 
  light flickers for 3 frames (radius drops to 40px then recovers)
```

**Enemy AI (for survival horror):**
```
Implement a horror enemy:
- Enemy state machine: PATROL → ALERT → HUNT → SEARCH → PATROL
- PATROL: follows fixed waypoints, has 90° vision cone, range 200px
- ALERT: player entered vision cone — freeze for 0.5s, then transition to HUNT
- HUNT: move toward player's last known position at 1.5× patrol speed
- SEARCH: if player not found in 10s after reaching last known position → SEARCH
  During SEARCH: check random nearby tiles for 10 more seconds
- HUNT catches player: game over
- Enemy sound: distinct audio cue when transitioning PATROL→ALERT ("thud", "breath change")
```

**Sound design via code:**
```
Add horror atmosphere sound design:
- Background ambient loop: low drone (audio/ambient.ogg), loop forever, volume 0.3
- Heartbeat SFX: plays when enemy is within 300px of player, volume scales with proximity
  (0.1 at 300px → 0.8 at 50px)
- Door creak: plays when player approaches a door (within 64px)
- Jump scare: audio/scare.ogg plays with screen flash (white overlay, 0.1s) when triggered
```

**Text pacing in horror:**
```
Horror VN dialogue rule: 
- Add 0.5s pause between every sentence (not just between speaker turns)
- Key horror reveals: add 2s pause before the reveal line
- Use ellipses to extend dread: "Something is... moving behind you."
- Show dialogue letter by letter (cps 30 — slower than normal VN pacing)
- "Sound" of silence: show blank dialogue box for 1.5s at high-tension moments
```

**Choice design for horror:**
```
Horror choice rule: Never give the player a "safe" option that removes all tension.
Good choice: "Go deeper into the basement" vs. "Check the front door first"
Bad choice: "Investigate the noise" vs. "Run away to safety"

The second choice format breaks horror by letting players opt out. 
Both options should feel dangerous — just differently dangerous.
```

---

## D. Common Pitfalls

**Jump scares instead of dread.** AI will default to jump scares (sudden loud noise + image) if you don't specify otherwise. Jump scares are the laziest horror design. Specify "build atmospheric dread through implication — the player's imagination does the work, not sudden stimuli."

**Over-explaining the horror.** AI tends to over-describe monsters and threats. Horror is strongest when the threat is vague. Review all AI-written horror text and remove any line that directly describes what the monster looks like or why it kills. Replace with: "there is something wrong about its shape" or "you don't look at it directly."

**Enemy AI that the player can exploit trivially.** Survival horror requires enemies that are consistent and learnable, but not trivially dodgeable. If the patrol path is visible, players will just wait out the cycle. Add randomization:
```
Enemy patrol path: fixed waypoints with random 1–3 second wait time at each point.
Turn speed: 180°/s (not instant) — player can exploit this to dodge.
Vision cone update: checks for player every 3 frames, not every frame.
```

**Horror audio playing at wrong moments.** Horror games have more audio events than any genre. A jump scare SFX that plays at the wrong moment (player is already safe) destroys immersion. Implement audio as a state machine, not triggered events:
```
AudioManager states:
- CALM: ambient loop at 0.3 volume, no heartbeat
- TENSE: ambient loop at 0.5 volume + slow heartbeat (when enemy is in same room)
- CRITICAL: heartbeat fast + ambient at 0.8 + music stops (enemy is within 150px)
- JUMPSCARE: all audio ducks 0.05, scare.ogg plays, then ramps back up
Transition between states with 0.5s crossfade. Never cut audio abruptly.
```

**Ren'Py horror on mobile.** Mobile players often play with sound off. Visual horror cues (screen flash, color tint shift, camera shake) must carry the scare when audio is muted. Design every scare to work silently.

---

## E. Kick-off Prompt Template

```
I'm building a horror visual novel in Ren'Py.

Setting: An old lighthouse on a remote coast. Player is the new keeper.
Tone: Slow-burn cosmic horror. Dread through wrongness, not gore.

Characters:
- KEEPER (player, no avatar, second-person narration)
- VOICE (disembodied, no sprite — italicized dialogue in red)
- FORMER_KEEPER (appears only in journal entries and one late-game scene)

Chapter 1 only. Placeholder art (color rectangles for backgrounds).

Atmospheric requirements:
- Text CPS (chars per second): 25 (slower than default)
- Add 0.3s pause between every paragraph  
- Background: dark navy rectangle (night, foggy coast)
- Persistent ambient sound: low_drone.ogg (fade in at scene start)

Scene structure:
Scene 1: Arrival at lighthouse (3 narration beats, establish wrongness)
Scene 2: Discover journal from previous keeper (2 journal entries with unsettling details)
Scene 3: First choice — "Read more" OR "Go to bed" (both lead to same nightmare)
Scene 4: Nightmare sequence (red color grading, fragmented text, end with "You wake up.")

Output: Complete .rpy file for these 4 scenes.
Do NOT implement: menus, save system, character sprites, or Chapter 2.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Horror VN: 1 chapter + atmosphere | 2–4 hours |
| Full horror VN: 3 chapters + 3 endings | 2–4 days |
| Puzzle horror: darkness mechanic + 3 puzzles | 1–3 days |
| Survival horror with enemy AI | 1–2 weeks |

**"Done" at MVP (VN):** One complete chapter playable, atmosphere established, one meaningful choice, one ending.

**"Done" polished (VN):** 3 chapters, 3 endings, original ambient music, character sprites, atmospheric effects (screen shake, color filters), published on itch.io.

**The horror genre's advantage for vibe coding:** Atmosphere is primarily about writing and pacing — both things AI does extremely well. The "hardest" part of horror (making the player feel dread) is achievable with good prompting for AI-written text, good sound design (which requires only sourcing audio, not coding), and simple visual techniques (darkness, color grading) rather than complex programming.

---

*Sources: [itch.io AI-generated VN list](https://itch.io/games/genre-visual-novel/tag-ai-generated) · [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre) · [r/vibecoding](https://reddit.com/r/vibecoding)*
