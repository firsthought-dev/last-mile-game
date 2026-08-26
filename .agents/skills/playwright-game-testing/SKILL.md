---
name: playwright-game-testing
description: Visual automated testing and feedback loop for game development using browser automation and screenshots to verify rendering, physics, controls, sprites, and animations.
---

# Playwright Game Testing Skill

Visual automated testing and feedback loop workflow for 2D/3D browser games based on the vibe coding methodology.

## Core Feedback Loop Workflow

When building or iterating on game features, always follow the closed visual verification cycle:

```
1. Implement / Modify Game Code
         │
         ▼
2. Serve Locally (or launch dev server / static server)
         │
         ▼
3. Run Browser Testing (Browser subagent / Playwright)
         │
         ▼
4. Inspect Screenshots & DOM / Console
         │
         ▼
5. Analyze Visuals & Detect Artifacts
         │
         ▼
6. Patch Code & Re-verify until Confirmed
```

---

## Testing Responsibilities & Checkpoints

### 1. Visual Alignment & Artifact Detection
- **Spritesheet Frame Miscalculations / Ghost Slivers**: Check if edges from adjacent frames bleed into the sprite animation. Total sheet dimensions must divide evenly by rows and columns without rounding errors.
- **Floating Objects & Z-Ordering / Layering**: Verify that ground tiles, props, platforms, vehicles, or characters rest on solid surfaces and aren't hovering or rendering underneath backgrounds.
- **Parallax & Camera Scroll**: Check that background layers scroll smoothly at differentiated speeds and infinite bounds work as intended.

### 2. Control & Physics Verification
- **Input Simulation**: Send simulated key presses (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `Space`, `WASD`, etc.) and mouse clicks.
- **State Machine Transitions**: Verify that player transitions correctly between states (e.g., `idle` -> `run` -> `jump` -> `fall` -> `attack` / `drive` / `turn`).
- **Collision & Gravity**: Verify that characters or vehicles land on platforms/roads without falling through the floor or sticking unnaturally.

### 3. Iterative Self-Correction
- When visual bugs or runtime errors occur:
  1. Capture the exact visual screenshot or console log.
  2. Pinpoint the root cause (e.g. frame dimensions in asset index, collision box offset, tile coordinates, physics velocity).
  3. Patch the code and re-test immediately in the browser.

---

## Standard Interaction Scenarios

### Verifying Static Scene / Initial Load
1. Navigate to the game page.
2. Wait for assets, textures, and canvas to mount.
3. Take a screenshot to verify UI, canvas positioning, backgrounds, and player spawn point.

### Verifying Movement & Actions
1. Dispatch keydown/keyup events for directional controls.
2. Wait for physics frames (e.g., 200–500ms).
3. Capture screenshots mid-action to confirm animation frames and coordinate updates.

### Verifying UI / HUD / Game Over / Victory States
1. Trigger state transitions or interact with UI buttons.
2. Confirm modals, HUD meters, score overlays, and restart buttons function smoothly.

---

## Continuous Improvement Rule
Whenever a recurring sprite miscalculation or physics bug is solved, document the root cause and add preventive checks to project specifications and skills.
