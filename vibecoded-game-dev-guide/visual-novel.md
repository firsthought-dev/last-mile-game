# Visual Novel & Narrative Games

**Difficulty:** ⭐⭐⭐ Medium | **Excellent fit for AI — writing and logic are AI's native strengths**

---

## A. Real Examples from the Community

### Tidewater Cove
- **Source:** [Chier Hu survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)
- **Developer:** Brandon Wu
- **Engine:** Godot 4
- **AI Tool:** Claude Code (in a headless Docker + GitHub Actions workflow)
- **What made this notable:** Claude didn't just write the game — it "built development tools (visual editors, image processors) that it then used to work more effectively." The AI built its own pipeline.
- **Shipped:** Yes

### AI2U - With You Til The End
- **Source:** [itch.io AI-generated visual novel list](https://itch.io/games/genre-visual-novel/tag-ai-generated)
- **Genre:** Visual novel with AI-powered NPCs + escape room elements
- **Price:** $10.49
- **Shipped:** Yes, itch.io

### How to Date an Entity (and stay alive)
- **Source:** [itch.io AI-generated VN list](https://itch.io/games/genre-visual-novel/tag-ai-generated)
- **Developer:** SFour
- **Genre:** Visual novel / dating sim with survival horror elements
- **Shipped:** Yes, browser-playable

### How to date a Sleep Paralysis Demon (Demo)
- **Source:** [itch.io AI-generated VN list](https://itch.io/games/genre-visual-novel/tag-ai-generated)
- **Developer:** SFour
- **Genre:** Visual novel / horror dating sim
- **Shipped:** Yes (Demo), browser-playable

*(Note: The itch.io AI-generated visual novel tag has 3,291 entries as of 2026 — by far the largest genre on the platform for AI-tagged games.)*

---

## B. Recommended Stack

**Best tools for visual novels:**

**Ren'Py** — purpose-built visual novel engine, Python-based, free. Claude has extensive Ren'Py training data. Exports to Windows, Mac, Linux, Android, iOS, and web. This is the gold standard for VNs.

**Godot 4 + Dialogic plugin** — Dialogic (free, open-source) adds a visual dialogue editor to Godot. The Tidewater Cove project used this approach successfully. Better if you want game mechanics alongside the story (inventory, combat, puzzle integration).

**Single HTML file** — for simple branching dialogue without characters or art, a single-file approach (text + choices + CSS) can work surprisingly well for jams.

**For AI-powered NPCs (not just scripted dialogue):**
- Integrate an LLM API (OpenAI, Claude API) to generate NPC responses at runtime
- Requires backend/API key management — not beginner-friendly
- AI2U uses this approach

**Writing tools:**
- Use Claude to write the actual dialogue and branching story as a first step
- Use Ink (Inkle's scripting language) to structure branching narrative — Claude knows Ink syntax
- Use Twine for browser-based hypertext fiction

**Art tools:**
- VN character sprites: generate with Stable Diffusion or DALL-E (consistent style requires prompting discipline)
- Backgrounds: Midjourney or Adobe Firefly
- Free: ask Claude to describe scenes and use [ChatGPT DALL-E or Midjourney]; or use public domain art

---

## C. Prompting Strategy

**Start with the script, not the engine.** Have Claude write the full story outline and branching dialogue first, before touching any code.

**Story structure prompt:**
```
Write a branching visual novel script with this premise:
[Your premise in 2–3 sentences]

Requirements:
- 3 main chapters
- Each chapter has 2–3 meaningful choice points
- Choices lead to 3 possible endings (good, neutral, bad)
- Characters: [list 2–3 named characters with brief personality notes]

Output format: Ink script format
(character name: "dialogue text")
(=== scene_name ===)
(-> choice_label)
(* [Choice text] -> destination)
```

**For Ren'Py implementation:**
```
Implement this scene in Ren'Py:
- Define characters: mc (Main Character), aria (Aria, pink hair)
- Use the provided Ink script as the dialogue source
- For now, use solid colored rectangles for backgrounds and character art
- Show emotion changes via character name color in dialogue box
- Music: use royalty-free track from assets/music/main_theme.ogg

Only implement Chapter 1. Do not add menus, save system, or CGs yet.
```

**Branching choices:** Each major choice should be its own label/scene. Don't have Claude write the entire branching tree in one prompt — write one branch at a time.

**For Godot + Dialogic:**
```
Using the Dialogic plugin in Godot 4:
1. Create a new Dialogue Timeline for scene "forest_encounter"
2. Characters: Maya (avatar: sprites/maya.png) and Wolf (no avatar)
3. Implement this exchange: [paste dialogue]
4. At line 8, add a choice branch:
   Option A "Accept the offer" → leads to timeline "accept"
   Option B "Refuse" → leads to timeline "refuse"
```

**Variable tracking (flags):**
VNs need to remember player choices. Request a `flags.js` or Ren'Py store early:
```
Add a persistent flags system:
- store.agreed_to_help = False (Ren'Py) 
  or flags.agreedToHelp = false (JS)
- Set flags based on player choices
- Check flags in later scenes to change dialogue
- List all flags and their meanings in CLAUDE.md
```

---

## D. Common Pitfalls

**Art consistency is the hardest part.** If you're using AI art for characters, maintaining a consistent style across 20+ scenes and expressions is very difficult. Strategies:
- Use one base character model per character and layer expressions (eyes, mouth) — some VN tools support this natively
- Document your exact image generation prompts per character
- Use free CC0 character sprite packs (some available on itch.io for VN creators)

**Branching logic bugs:** A 3-ending story with 10 choice points has potentially hundreds of paths. Claude can miss combinations where flags conflict. Test every significant path manually.

**Audio synchronization:** Music that loops at the wrong point or dialogue text that advances too fast/slow hurts immersion. Specify timing explicitly:
```
Text scroll speed: 0.04 seconds per character (default Ren'Py cps)
Music loops seamlessly using loop_start/loop_end tags
Auto-advance mode: disabled by default (player clicks to advance)
```

**Save system complexity:** VNs need mid-story saves. Ren'Py has this built in. If building in JS/Godot, ask for it early — it's easier to add upfront than retrofit.

**Pacing:** AI-written VN dialogue tends to be verbose. Ask Claude to write at "80% of the words you'd naturally use — cut everything non-essential."

---

## E. Kick-off Prompt Template

```
I'm building a visual novel in Ren'Py.
Story: [2 sentence premise]

Characters:
- PLAYER (no avatar, first-person perspective)  
- ANYA: Mysterious antique dealer, cautious, dry humor
- MARCUS: Anya's assistant, enthusiastic, naive

Chapter 1 only. Placeholder art (colored rectangles).

First task: Write and implement Chapter 1 in Ren'Py (.rpy file):
- Scene: Antique shop interior (blue rectangle background)
- Anya and Marcus introduce themselves (8–10 lines each)
- One choice: Ask about the strange box OR ignore it
- Each choice leads to a different line from Anya then converges
- End with "To be continued in Chapter 2..."

Include a flags.rpy store file that will track player choices.
Do NOT implement: menus, save system, sound, or Chapter 2 yet.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Chapter 1 working with choices | 1–2 hours |
| 3 chapters + 3 endings | 2–3 days |
| Character art integrated | 1–2 days (art generation separate) |
| Sound + music | 1 day |
| Polished itch.io release | 1 week |

**"Done" at MVP:** One complete story path playable start to finish, at least one meaningful choice that affects the ending.

**"Done" polished:** 3 endings, all character sprites and expressions, original BGM, save/load system, gallery of CG artwork.

**Special note:** VNs have 3,291 AI-tagged entries on itch.io — the most of any AI game genre. This means the community knows this space well, but also that competition is fierce. Strong writing differentiates entries more than technical execution.

---

*Sources: [Chier Hu survey](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992) · [itch.io AI-generated VN](https://itch.io/games/genre-visual-novel/tag-ai-generated) · [AI2U itch.io](https://itch.io/games/genre-visual-novel/tag-ai-generated)*
