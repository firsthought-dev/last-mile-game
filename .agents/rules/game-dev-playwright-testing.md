# Workspace Rules: Playwright Visual Testing & Vibe Coding Workflow

Whenever developing or updating game features in this workspace:
1. **Reference Asset Indexes**: Always adhere to the established asset coordinates and indices (`assets.json` or equivalent specs).
2. **Apply Playwright Game Testing Skill**: Follow the visual feedback loop from `playwright-game-testing`:
   - After implementing or modifying gameplay code, launch a browser subagent/Playwright session.
   - Capture screenshots and inspect DOM/canvas render state.
   - Test user inputs (keyboard controls, clicks) and physics state transitions.
   - Check for animation artifacts (ghost slivers, wrong frame sizes, floating objects, clipping).
   - Iteratively patch and visually re-verify until the gameplay state is verified.
3. **Continuous Knowledge Improvement**: When resolving animation or layout bugs, record learnings to prevent recurring miscalculations.
