# How to Vibe Code a 2D Game Using Claude Code & Agent Skills

**Based on the tutorial by Chong-U (AI Oriented Dev)**  
**Tools Used:** Claude Code · Phaser JS · Playwright MCP · VS Code

---

## Overview

This guide walks you through the complete workflow for building a 2D pixel platformer using AI-assisted "vibe coding" — the practice of directing an AI agent to write and iterate on game code for you. The approach centres on two powerful ideas:

1. **Agent Skills** — reusable instruction bundles that teach Claude how to handle a domain (in this case, Phaser JS game development)
2. **Playwright MCP** — a browser automation server that gives Claude "eyes" to visually test the game it is building

By the end of this workflow you will have a working 2D platformer with parallax scrolling backgrounds, animated character sprites, physics, movement controls, attack animations, and decorative props — all generated and debugged primarily through AI.

---

## Prerequisites

Before starting, ensure you have the following installed and configured:

- **Node.js 16+** — required for running `npx` commands
- **Claude Code CLI** — Anthropic's AI coding agent ([docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview))
- **VS Code** (recommended) — or any editor of your choice; Cursor also works
- **A Claude API subscription** with access to Opus models

---

## Part 1 — Understanding Agent Skills

### What Are Agent Skills?

Agent Skills are folders of structured instructions that Claude loads at runtime to improve performance on a specific domain. Think of them as reusable "mental frameworks" — rather than re-explaining how Phaser JS works in every prompt, you write the knowledge once into a skill file and Claude reads it automatically when needed.

Each skill lives in a folder and contains a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: phaser-game-dev
description: Teaches Claude how to build 2D games with Phaser JS, including spritesheet animation, physics, tilemaps, and parallax scrolling
---

# Phaser Game Dev Skill

[Instructions Claude follows when this skill is active...]
```

**Required frontmatter fields:**

- `name` — unique identifier (lowercase, hyphens only)
- `description` — tells Claude when and how to invoke the skill

### Skill Folder Locations

The tutorial uses two separate folder structures because different tools use slightly different conventions:

```
your-project/
├── .claude/          ← Skills for Claude Code
│   └── skills/
│       ├── phaser-game-dev/
│       │   └── SKILL.md
│       └── playwright-testing/
│           └── SKILL.md
└── .codex/           ← Skills for OpenAI Codex CLI (open standard, cross-compatible)
    └── skills/
        └── phaser-game-dev/
            └── SKILL.md
```

> **Note for Cursor users:** Cursor can import Claude Code skills directly. Go to **Settings → Rules → Skills and Agents** and point it at the `.claude` folder.

### The Two Key Skills

**1. Phaser JS Game Dev Skill**
This is the core skill. It teaches Claude how to:
- Parse and interpret spritesheets and their frame layouts
- Set up Phaser 3's scene lifecycle (`preload`, `create`, `update`)
- Configure physics (Arcade Physics)
- Build parallax scrolling backgrounds
- Load and animate tile-based ground layers
- Wire up keyboard input and animation state machines
- Avoid common frame-size miscalculation bugs (see Step 6)

**2. Playwright Game Testing Skill**
This supplementary skill enables Claude to:
- Launch a headless browser via the Playwright MCP server
- Navigate to `localhost` where the game is served
- Take screenshots at key moments to verify visual output
- Simulate key presses (arrow keys, space bar) to test controls
- Detect visual artifacts (ghost images, misaligned frames)
- Report findings and attempt self-correction

> **Where to get these skills:** The tutorial author (Chong-U) has made his skills available as part of his free resources and [BuilderPack](https://www.builderpack.ai/claude) membership. The Anthropic-official skill creator template is available at [github.com/anthropics/skills](https://github.com/anthropics/skills). The video also references a community "skill-creator" plugin available in the Claude marketplace.

---

## Part 2 — Setting Up the Playwright MCP Server

Playwright MCP is a Microsoft-maintained Model Context Protocol server that gives Claude browser automation capabilities.

### Installation

Add the following to your Claude Code MCP configuration file (`~/.claude.json` or your project's `.mcp.json`):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

Alternatively, install via the Claude Code CLI:

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

**Source:** [github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)

Once installed, Claude can invoke Playwright to open a browser, navigate to your local dev server, take screenshots, and simulate user input — all without you needing to do it manually.

---

## Part 3 — Setting Up the Status Line (Optional but Recommended)

A common mistake when vibe coding is accidentally using the wrong Claude model (e.g. Sonnet instead of Opus). The `cc-statusline` package by Chong-U adds a real-time status bar to your terminal showing which model is active, context usage, costs, and more.

### Installation

```bash
npx @chongdashu/cc-statusline@latest init
```

**Requirements:** Node.js 16+, `jq` installed (for token stats)

The statusline displays three lines of information:

- **Line 1:** Current directory · git branch · **active Claude model** · Claude Code version
- **Line 2:** Context usage % with progress bar · session timer
- **Line 3:** Total session cost · token consumption rate

Restart Claude Code after running `init` to activate it.

**Source:** [github.com/chongdashu/cc-statusline](https://github.com/chongdashu/cc-statusline)

> **Why this matters:** In the tutorial, the author accidentally runs the first prompt with Sonnet 4.5 instead of Opus 4.5. The statusline makes it impossible to miss this going forward. Always verify you are on Opus for complex generative tasks like game development.

To switch model inside Claude Code, type:
```
/model
```
Then select `claude-opus-4-5` (or whatever the latest Opus version is).

---

## Part 4 — Art Assets

### Recommended Asset Pack: Oak Woods Environment

The tutorial uses the free **Oak Woods — Environment Asset** by **brullov** (brullov studios), available on itch.io.

**Link:** [brullov.itch.io/oak-woods](https://brullov.itch.io/oak-woods)

**Cost:** Free (pay-what-you-want; $1 USD suggested). Commercial use permitted; redistribution/resale prohibited.

**What's included:**

| Asset Type | Details |
|---|---|
| **Backgrounds** | 3 layered PNG files, 320×180 px each, for parallax scrolling |
| **Character spritesheet** | Single PNG with all animations (idle, run, jump, fall, attack ×2, roll, death) |
| **Tileset** | Grass and rock tiles, 24×24 px each, 21 columns × 15 rows |
| **Decorations** | Shop (animated), fence ×2, grass ×3, lamp, rocks ×3, sign |

**Rating:** 4.8/5 from 122 community reviews.

### Understanding the Spritesheet

A spritesheet is a single image containing all animation frames laid out in a grid. Phaser reads it by knowing:

- **Frame width & height** — the size of each individual cell
- **Start frame & end frame** — which cells belong to which animation

For the Oak Woods character sheet, the layout is approximately:

```
Row 0 (frames 0–5):   Idle animation
Row 1 (frames 8–13):  Attack animation
Row 2 (frames ~14+):  Run animation
...and so on
```

> **Critical note from the tutorial:** AI can misread spritesheet dimensions, especially if it incorrectly assumes the sprite is square when it is not (Oak Woods character is 448×392 px — not square). Always visually verify the frame indices before building the game. The tutorial shows how to catch and correct these errors in Step 6.

### Folder Structure

Create this structure before starting:

```
your-project/
├── public/
│   └── assets/
│       └── oakwoods/
│           ├── background/
│           │   ├── background_layer_1.png
│           │   ├── background_layer_2.png
│           │   └── background_layer_3.png
│           ├── character/
│           │   └── char_blue.png
│           ├── decorations/
│           │   └── (all decoration PNGs)
│           └── tileset/
│               └── tileset.png
├── .claude/
│   └── skills/
└── .codex/
    └── skills/
```

Placing assets under `public/` ensures they are served correctly when deploying to a web server (no 404 loading errors).

---

## Step 1 — Create the Asset Index

Before writing any game code, you need to give Claude a structured map of all available assets. This is done by generating an `assets.json` file — an index that Claude can reference throughout the project without re-scanning the filesystem every time.

### The Prompt

```
Study the assets in the oakwoods folder and create an assets.json that is an
index of the assets. Account for the spritesheet animations. Account for the
tileset. Structure it so we can reference these assets in Phaser JS.

Use the phaser-game-dev skill.
```

### What Claude Produces

Claude will generate a JSON file similar to:

```json
{
  "backgrounds": {
    "layer1": "assets/oakwoods/background/background_layer_1.png",
    "layer2": "assets/oakwoods/background/background_layer_2.png",
    "layer3": "assets/oakwoods/background/background_layer_3.png"
  },
  "character": {
    "key": "char_blue",
    "path": "assets/oakwoods/character/char_blue.png",
    "frameWidth": 56,
    "frameHeight": 56,
    "animations": {
      "idle":   { "frames": [0, 5],   "frameRate": 8, "repeat": -1 },
      "run":    { "frames": [14, 20], "frameRate": 12, "repeat": -1 },
      "attack": { "frames": [8, 13],  "frameRate": 12, "repeat": 0 },
      "jump":   { "frames": [21, 23], "frameRate": 8, "repeat": 0 },
      "fall":   { "frames": [24, 26], "frameRate": 8, "repeat": 0 },
      "death":  { "frames": [27, 32], "frameRate": 8, "repeat": 0 }
    }
  },
  "tileset": {
    "key": "tileset",
    "path": "assets/oakwoods/tileset/tileset.png",
    "tileWidth": 24,
    "tileHeight": 24,
    "columns": 21,
    "rows": 15
  },
  "decorations": { ... }
}
```

### Verifying the Output

**Do not skip this step.** AI can get frame counts wrong, especially with spritesheets. Open the character PNG and manually count frames:

1. Count how many columns of frames exist per row
2. Verify start and end frame numbers for each animation
3. Check that `frameWidth` and `frameHeight` match the actual pixel dimensions of a single frame

In the tutorial, Claude initially gets some frame ranges wrong. The author corrects it:

```
Looking at the assets.json, there are a few mistakes. The idle animation
actually goes from frames 0 to 5. There are two empty frames at 6 and 7.
The attack runs from 8 to 13 — there are two empty frames in there. Please
verify and make the appropriate fixes.
```

**Tip:** Always explicitly tell Claude about empty/padding frames in the spritesheet. These silent gaps are the #1 cause of animation artifacts.

---

## Step 2 — Plan Mode: Design the Game Step by Step

Instead of asking Claude to build the entire game at once (one-shotting), use **Plan Mode** to break the work into verifiable stages.

### Activating Plan Mode

Press **Shift+Tab twice** in Claude Code to enter Plan Mode. In this mode, Claude will present a detailed implementation plan and ask for your approval before executing any code.

### Preparing a Reference Mockup

Save a screenshot or reference image of the final game you want to build (the tutorial uses a screenshot of the completed platformer). This gives Claude a visual target. If you don't have a mockup, tools like Nano Banana Pro can generate one from your tilesets and assets.

### The Prompt

```
Use the phaser-game-dev skill to replicate the [attached mockup image].

Plan it out first:
  Step 1: Add the three background layers with parallax scrolling
  Step 2: Add the tileset for a flat ground in a single tile layer  
  Step 3: Place the character and animate it with movement controls

That is the baseline. Remember to reference assets.json for the list of assets.
```

### What Plan Mode Produces

Claude will outline a multi-phase plan, e.g.:

```
Phase 1: Background Setup
  - Load 3 background layers in preload()
  - Create tileSprite objects for infinite horizontal scrolling
  - Set scroll factors for parallax effect (0.1, 0.3, 0.6)

Phase 2: Ground Tileset
  - Load tileset as staticGroup
  - Place a single row of tiles at y = game_height - tile_height
  - Enable Arcade Physics collision

Phase 3: Player Character
  - Load spritesheet using frame dimensions from assets.json
  - Create all animations from the index
  - Add physics body, gravity, keyboard input
  - Wire up animation state machine in update()

Shall I proceed?
```

Approve each phase individually. This gives you checkpoints to verify before Claude moves on.

---

## Step 3 — Phase 1: Background Layers

With the plan approved, Claude generates the Phaser scene code. The core background setup uses `tileSprite` objects — Phaser's built-in repeating texture type — to create infinite horizontal scrolling.

A typical Phaser 3 scene structure:

```javascript
class GameScene extends Phaser.Scene {
  preload() {
    this.load.image('bg1', 'assets/oakwoods/background/background_layer_1.png');
    this.load.image('bg2', 'assets/oakwoods/background/background_layer_2.png');
    this.load.image('bg3', 'assets/oakwoods/background/background_layer_3.png');
    this.load.spritesheet('char', 'assets/oakwoods/character/char_blue.png', {
      frameWidth: 56, frameHeight: 56
    });
    this.load.image('tileset', 'assets/oakwoods/tileset/tileset.png');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Parallax layers — each scrolls at a different speed
    this.bg1 = this.add.tileSprite(0, 0, W, H, 'bg1').setOrigin(0, 0).setScrollFactor(0);
    this.bg2 = this.add.tileSprite(0, 0, W, H, 'bg2').setOrigin(0, 0).setScrollFactor(0);
    this.bg3 = this.add.tileSprite(0, 0, W, H, 'bg3').setOrigin(0, 0).setScrollFactor(0);
  }

  update() {
    // In update(), shift tilePosition.x relative to camera scroll
    const camX = this.cameras.main.scrollX;
    this.bg1.tilePositionX = camX * 0.1;
    this.bg2.tilePositionX = camX * 0.3;
    this.bg3.tilePositionX = camX * 0.6;
  }
}
```

**Playwright verification:** After this phase, Playwright takes a screenshot and Claude confirms all three layers are visible and properly layered.

---

## Step 4 — Phase 2: Ground Tileset

Claude adds a row of tiles for the ground surface and enables physics collision between the player and the ground.

The Playwright MCP server verifies:
- Ground tiles are rendered at the bottom of the screen
- Physics collision body exists on the tile layer
- No gaps in the ground row

**Common issue:** The ground may render too high or too low. Claude uses iterative Playwright screenshots to nudge the Y position until the tiles sit exactly at the screen's bottom edge.

---

## Step 5 — Phase 3: Player Character with Controls

Claude adds the player sprite, registers all animations from `assets.json`, and wires up the keyboard controls.

### Animation State Machine

```javascript
// In update():
const onGround = this.player.body.blocked.down;

if (cursors.left.isDown) {
  this.player.setVelocityX(-160);
  this.player.setFlipX(true);
  if (onGround) this.player.play('run', true);

} else if (cursors.right.isDown) {
  this.player.setVelocityX(160);
  this.player.setFlipX(false);
  if (onGround) this.player.play('run', true);

} else {
  this.player.setVelocityX(0);
  if (onGround && !this.isAttacking) this.player.play('idle', true);
}

if (cursors.up.isDown && onGround) {
  this.player.setVelocityY(-400);
  this.player.play('jump', true);
}

if (!onGround && this.player.body.velocity.y > 0) {
  this.player.play('fall', true);
}
```

**Playwright verification:** Claude presses the right arrow key, takes screenshots, and confirms the character moves right and the run animation plays. It presses the up arrow and checks the jump animation fires.

---

## Step 6 — Bug Fixing: Animation Artifacts

This is the most common failure point. If the `frameWidth` or `frameHeight` in `assets.json` is wrong, every animation will display a "ghost" — a sliver of the adjacent frame bleeding into view.

### How to Identify the Bug

Playwright will capture a screenshot showing something like this alongside the character:

```
[ghost sliver] [character frame]
```

The presence of a ghost image to the left or above the main sprite is a definitive sign that the frame dimensions are incorrect.

### How to Fix It

Tell Claude explicitly:

```
There is an issue with the idle animation — it looks like the frame size is
miscalculated. Remember to refer to assets.json and fix the visual issue.
Take a screenshot once fixed to verify.
```

Claude will re-read `assets.json`, recalculate `frameWidth` and `frameHeight`, and patch the spritesheet loader call. In the tutorial, the root cause was Claude assuming the character sprite was square (it is not — 448×392 px is not square), leading to a wrong frame height calculation.

### Why This Happens

Phaser's `frameWidth` and `frameHeight` need to exactly divide the total sprite sheet dimensions. For Oak Woods:

- Total sheet width ÷ number of columns = frameWidth
- Total sheet height ÷ number of rows = frameHeight

Even a 1-pixel error cascades into broken animations for every animation in the game.

> **Skill improvement tip (from the tutorial):** After finding and fixing this bug, ask Claude to update the Phaser skill so the same mistake doesn't recur:
>
> ```
> How did you end up getting that calculation wrong? It never happened before.
> Please look at the phaser-game-dev SKILL.md and update it so this mistake
> doesn't happen again.
> ```
>
> This is a key principle: **skills are living documents**. Improve them continuously as you build projects.

---

## Step 7 — Adding Infinite Parallax Scrolling

At this stage the background is static. To make the world feel expansive, enable the camera to follow the player and the background layers to scroll infinitely.

### The Prompt

```
The background currently looks great, but I would like parallax scrolling
and the infinite ability to move to the right. Use the phaser-game-dev skill.
```

Claude will:

1. Enable the main camera to follow the player: `this.cameras.main.startFollow(this.player)`
2. Expand the world bounds so the camera can pan: `this.physics.world.setBounds(0, 0, worldWidth, H)`
3. Update the `tilePositionX` of each background layer in `update()` relative to `this.cameras.main.scrollX`

**Playwright verification:** Claude presses the right arrow for 3 seconds and takes a screenshot. It checks that the character has moved right, the background layers have scrolled, and there is no right boundary stopping movement.

---

## Step 8 — Fixing Remaining Animations

After adding scrolling, verify all animation states are correct. In the tutorial, the run and jump animations were still broken after the scrolling update due to a frame-height regression.

### The Prompt

```
The player animations are not correct. Idle is perfectly fine, but the
moving (run) and jumping animations are wrong — fix them. There is a
bleeding from the frame above causing the height to be wrong.
```

Include a screenshot of what you see so Claude can visually confirm the artifact.

**Context management note:** By this point you may be approaching 50–60% context usage. This is a good time to use the `/compact` command:

```
/compact
```

This summarises the conversation history into a compressed form, freeing up context without losing critical information. Claude Code will typically recover 30–40% additional context after compacting.

---

## Step 9 — Adding the Attack Animation

Once movement and animations are solid, add the attack mechanic.

### The Prompt

```
Add an action button where the character plays the slash/attack animation.
Use the phaser-game-dev skill and remember assets.json.
```

Claude will:

1. Add a `spaceBar` input listener
2. Create an `isAttacking` boolean flag
3. Play the `attack` animation on space bar press
4. Lock out other animations while attacking
5. Listen for the `animationcomplete` event to reset the flag

```javascript
this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

// In update():
if (Phaser.Input.Keyboard.JustDown(this.spaceBar) && !this.isAttacking) {
  this.isAttacking = true;
  this.player.play('attack');
  this.player.once('animationcomplete', () => {
    this.isAttacking = false;
  });
}
```

**Playwright verification:** Claude presses the space bar and takes a screenshot mid-animation to confirm the attack frames are displaying.

---

## Step 10 — Adding Decorative Props

The final polish step is placing the Oak Woods decorations (fence, grass clumps, rocks, lamp, sign) into the scene.

### The Prompt

```
Now let's add some of the props and decorations into the level to make it
look better. Reference assets.json for the list of decorations.
```

**Common issue:** Decorations often spawn floating above the ground because the Y coordinate doesn't account for the ground level. Playwright will catch this:

> "Decorations are visible but are floating above the ground."

Claude will then adjust Y positions so all props sit on the tile surface. This may require a few iterative rounds of prompt → screenshot → correction.

---

## Tips & Best Practices

### Always Work Step by Step

Resist the urge to one-shot the entire game in a single prompt. Iterative development lets you catch bugs before they compound. Game development is inherently incremental — the AI performs better with clear, scoped instructions.

### Use Model Wisely

For complex generative tasks (game logic, animation systems, bug diagnosis): **Opus 4.5** (or the latest Opus).  
For quick edits and minor fixes: Sonnet is acceptable and faster.

Always verify your active model with the `cc-statusline` status bar or by typing `/model`.

### The Playwright Feedback Loop

The Playwright MCP testing loop is the core productivity unlock:

```
Implement feature → serve locally → Playwright opens browser →
takes screenshot → Claude analyses image → identifies bug →
patches code → takes new screenshot → confirms fix
```

It is not perfect. Playwright can miss visual bugs if they're subtle, and sometimes incorrectly reports success. Use it as a first pass, then do a manual review of anything visually important.

### Keep `assets.json` as the Single Source of Truth

Every prompt that touches assets should include `remember to reference assets.json`. This prevents Claude from hallucinating wrong file paths or animation frame counts from its training data.

### Update Your Skills as You Go

After every significant bug fix or new technique you discover, ask Claude to update the relevant skill file to incorporate that knowledge. Skills are not one-time work — they improve with every project you build.

```
Please look at the phaser-game-dev SKILL.md and update it to prevent
[specific mistake] from happening again.
```

### Context Management

Monitor context usage in the status bar. When approaching 50%:

- Run `/compact` to compress conversation history
- After compacting, remind Claude of key facts: `"Remember to reference assets.json and use the phaser-game-dev skill."`

---

## Full Workflow Summary

| Step | Action | Key Prompt Keyword |
|------|--------|-------------------|
| 0 | Install tools, create folder structure | — |
| 1 | Generate `assets.json` index | `"create an assets.json"` |
| 1b | Verify & correct frame data | `"there are mistakes, idle goes from 0 to 5..."` |
| 2 | Enter Plan Mode, provide mockup | `Shift+Tab ×2` |
| 3 | Implement parallax background | `"add three background layers"` |
| 4 | Add tileset ground | `"add the tileset for flat ground"` |
| 5 | Add player + controls | `"place the character and animate it with controls"` |
| 6 | Fix animation artifacts | `"frame size is miscalculated, fix the visual issue"` |
| 7 | Enable infinite parallax scrolling | `"parallax scrolling and infinite ability to move right"` |
| 8 | Fix run/jump animations | `"run and jump animations are wrong"` |
| 9 | Add attack action | `"add an action button for the slash animation"` |
| 10 | Add decorative props | `"add props and decorations from assets.json"` |

---

## References & Further Resources

### Tools Used in This Tutorial

- **Phaser JS** — [phaser.io](https://phaser.io) · [GitHub](https://github.com/phaserjs/phaser) · [MDN Tutorial](https://developer.mozilla.org/en-US/docs/Games/Tutorials/2D_breakout_game_Phaser)
- **Playwright MCP** (Microsoft) — [github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) · [Claude Code setup guide](https://qaskills.sh/blog/playwright-mcp-server-claude-code-setup)
- **Oak Woods Asset Pack** (brullov) — [brullov.itch.io/oak-woods](https://brullov.itch.io/oak-woods)
- **cc-statusline** (Chong-U) — [github.com/chongdashu/cc-statusline](https://github.com/chongdashu/cc-statusline)

### Agent Skills Documentation

- **Anthropic official skills repo** — [github.com/anthropics/skills](https://github.com/anthropics/skills)
- **Agent Skills overview docs** — [platform.claude.com/docs/en/agents-and-tools/agent-skills/overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- **Creating custom skills (Anthropic support)** — [support.claude.com](https://support.claude.com/en/articles/12512198-creating-custom-skills)

### Creator Resources

- **Chong-U's public skills** — [github.com/chongdashu/cc-skills](https://github.com/chongdashu/cc-skills)
- **BuilderPack** (Phaser skill, Playwright skill, full source code from all videos) — [builderpack.ai](https://www.builderpack.ai/claude)
- **Chong-U YouTube channel** — AI Oriented Dev

### Claude Code Mechanics Used

- **Plan Mode** — Press `Shift+Tab` twice · [guide](https://codingcharly.dev/blog/claude-code-plan-mode)
- **`/compact` command** — Context compression · [guide](https://docs.bswen.com/blog/2026-05-13-compact-context-management/)
- **`/model` command** — Switch active model mid-session

---

*This guide is based on the publicly available YouTube tutorial by Chong-U (AI Oriented Dev). All asset credits go to their respective creators. All tool links have been independently verified as of August 2026.*
