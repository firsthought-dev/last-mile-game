# Idle Games & Clicker Games

**Difficulty:** ⭐⭐ Easy | **Trivial to start, surprisingly complex to balance**

---

## A. Real Examples from the Community

### Vibe Code Sim
- **Source:** [vibecodesim.com](https://www.vibecodesim.com/)
- **Genre:** Satirical idle clicker / resource management sim
- **Concept:** 90-day simulation where "AI writes the code, you write the prompts." Manages projects, health/sanity, and resource generation. Pokes fun at AI coding culture.
- **Engine:** Modern web app (JS, browser-based)
- **Shipped:** Yes, at vibecodesim.com

### Farm Clicker
- **Source:** [hagbart80.itch.io/farm-clicker](https://hagbart80.itch.io/farm-clicker/comments)
- **Genre:** Farm idle/clicker
- **Shipped:** Yes, itch.io

### Pixel Vanguard Idle
- **Source:** [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre)
- **Genre:** Idle with action elements
- **AI Tools:** ChatGPT, Claude, Minds, Gemini
- **Shipped:** Yes, browser-playable

### BombIdle
- **Source:** [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre)
- **Genre:** Idle with bomb/destruction theme
- **AI Tool:** Claude
- **Shipped:** Yes

### Click Me Godot
- **Source:** [grandinquisitor.itch.io/click-me-godot](https://grandinquisitor.itch.io/click-me-godot)
- **Engine:** Godot
- **Genre:** Clicker
- **Shipped:** Yes, itch.io

---

## B. Recommended Stack

Idle games are pure logic — resource accumulation, rates, unlock conditions, prestige resets. No physics, no animation systems, no pathfinding. This makes them ideal for vibe coding.

**Best stack:**
- **Single HTML file** (vanilla JS) — idle games are the canonical use case for single-file browser games. No engine needed. Entire game fits in one `.html` file. Deploys anywhere.
- **Persist state with `localStorage`** — essential for idle games. Players must be able to close and return to find their progress.
- **Alternative:** Phaser 3 if you want animated idle elements (auto-miners visually digging, etc.)

**For mobile idle games:**
- React Native + Expo (as in the Abacus shooter case, but much simpler here since no physics or rendering complexity)

---

## C. Prompting Strategy

**Define the resource graph first.** An idle game is fundamentally a graph of resources and converters:
```
Resources:
- Coins (primary currency)
- Gems (premium currency)
- Wood (crafting material)
- Stone (crafting material)

Converters (buildings):
- Lumber Mill: costs 50 Coins, generates 1 Wood/sec
- Quarry: costs 75 Coins, generates 1 Stone/sec
- Workshop: costs 1 Wood + 1 Stone, generates 0.5 Gems/sec
```

Give Claude this structure as a data file (`gameData.js`) before writing any UI. Then build:
1. Display current resource amounts
2. Click button to earn +1 of a resource
3. Buy one building type
4. Building generates resources passively each second
5. Second building type
6. Unlock condition (building B requires X of resource A)
7. Prestige/reset mechanic

**Save system — ask for this early:**
```
Add a save/load system using localStorage:
- Save game state every 30 seconds automatically
- Save when browser tab closes (beforeunload event)
- Load on page open — restore all resource amounts and building counts
- Add a manual "Save" button and a "Reset" button (with confirmation dialog)
- Save format: JSON stringified gameState object
```

**Offline progress:** Players expect to earn resources while the tab is closed:
```
Calculate offline progress on load:
- Record Date.now() in save data when saving
- On load, calculate elapsed seconds since last save
- Apply passive generation rates × elapsed seconds (cap at 24 hours)
- Show "You earned X resources while away!" popup
```

**Prestige system:**
```
Add a prestige mechanic:
- Button appears when player has earned 1,000,000 lifetime Coins
- Confirm dialog: "Reset everything for 1 Gem multiplier?"
- On confirm: reset all resources and buildings, increase all generation rates by +5%
- Track prestige count and total multiplier in stats panel
```

---

## D. Common Pitfalls

**Floating point precision:** Idle games accumulate tiny fractions every frame. JavaScript's floating point arithmetic produces strings like "0.3000000000000001 Coins." Fix:
```
Always display resources with:
Math.floor(value) for whole numbers, or
value.toFixed(2) for decimals
```

**Save corruption:** If you save partial state (some variables but not others), loading produces broken states. Always save the entire `gameState` object at once, never piecemeal.

**Offline progress griefing:** Capping offline progress (24 hours max) prevents abuse. Without a cap, a player who opens the game after a month gets billions of resources instantly, breaking balance.

**Tab visibility performance:** Idle games should slow or stop their tick interval when the tab is hidden (don't consume CPU for a background tab). Use the Page Visibility API:
```
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearInterval(gameLoop);
  else restartGameLoop();
});
```
Ask Claude to add this from the start.

**Number formatting:** At large numbers, show abbreviations (1K, 1M, 1B, 1T). Ask Claude to add a `formatNumber(n)` utility function early.

**Prestige breaking everything:** Prestige resets are a common source of save corruption bugs. Test the full reset → play → prestige cycle manually before shipping.

---

## E. Kick-off Prompt Template

```
I'm building a cookie-clicker-style idle game.
Single HTML file, vanilla JavaScript, no libraries.

Game concept: You click to produce Widgets. Spend Widgets on factories 
that auto-produce more Widgets.

Data (define in gameData.js file):
const BUILDINGS = [
  {id: "cursor", name: "Cursor", cost: 10, rate: 0.1, description: "Clicks for you"},
  {id: "farm", name: "Widget Farm", cost: 100, rate: 0.5, description: "Grows widgets"},
  {id: "factory", name: "Factory", cost: 1000, rate: 4, description: "Manufactures widgets"}
]

First session ONLY:
1. Display: "0 Widgets" counter, large
2. "Click to make a Widget" button — click adds 1 Widget
3. Building list showing all 3 buildings with name, cost, rate, count owned
4. Click "Buy" button on a building: deducts cost, increments count, 
   adds its rate to passive generation
5. Passive generation ticks every second

Do NOT add: save/load, offline progress, achievements, prestige, or sound.
Confirm the basic click → earn → buy loop works before anything else.
```

---

## F. Effort & Scope Guide

| Milestone | Time (Hobbyist) |
|---|---|
| Click → earn → buy one building | 1 hour |
| 5 buildings + unlock conditions | 1 day |
| Save/load + offline progress | 1 day |
| Achievements + prestige | 2–3 days |
| Polished release (art, music, mobile) | 1 week |

**"Done" at MVP:** Clicking earns resources, 3 buildings auto-generate, save/load works.

**"Done" polished:** 10+ buildings, prestige system, offline earnings, achievements, number formatting, sound, mobile-friendly UI.

**Token cost:** Among the cheapest genre — $0.50–$2.00 for a complete idle game MVP.

---

*Sources: [vibecodesim.com](https://www.vibecodesim.com/) · [vibecode.game](https://vibecode.game/vibe-coded-games/by-genre) · [Farm Clicker itch.io](https://hagbart80.itch.io/farm-clicker) · [Click Me Godot](https://grandinquisitor.itch.io/click-me-godot)*
