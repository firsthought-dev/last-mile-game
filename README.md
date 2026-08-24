# Last Mile: Shiplyp Chronicles — 3D Procedural Delivery Driver

**An AI-developed 3D driving game** built with Three.js, procedural terrain generation, and delivery mechanics.

---

## 🎮 Current Game: 3D Procedural Driver

**Shiplyp: Last Mile — Indian Courier 3D Action Driving** is a single-player 3D game where you pilot a delivery vehicle across procedurally generated landscapes, navigating road hazards and meeting delivery time targets.

### Core Mechanics

- **Driving** — Arrow keys / WASD to steer and accelerate; realistic physics and suspension
- **Procedural Terrain** — Infinite procedurally generated world using Simplex noise
- **Delivery Routes** — Route splines guide you to destinations; GPS indicator shows direction ([LEFT]/[RIGHT])
- **Hazards** — Potholes damage vehicle; speed cameras issue fines (e-challans); repair bays restore health
- **Scoring** — Earnings in ₹ INR; combo streaks for on-time deliveries; health/cash UI
- **Notifications** — Unified event panel shows collisions, fines, deliveries, and repairs

### How to Run Locally

```bash
# Serve on port 8091
python3 -m http.server 8091 --directory last-mile-game

# Then open http://localhost:8091 in your browser
```

Or use the Claude Code dev server:
```bash
claude code --name last-mile-game
```

---

## 🛠️ Recent Fixes (This Session)

All bugs fixed via iterative testing with Playwright MCP and visual verification:

1. **Reversed driving view** — Car was facing backward; fixed mesh.lookAt() orientation
2. **Inverted steering** — Left/right controls flipped; corrected basis vector signs
3. **Console warnings** — 50+ shader warnings from invalid material properties
4. **Collision spam** — Damage/sound fired every frame when pinned; added cooldown
5. **Radio auto-play** — Music started without user consent; now localStorage-backed
6. **Camera framing** — Chase cam too close; pulled back and adjusted look-ahead
7. **Acceleration curve** — Ramp too aggressive (157 km/h in 2s); softened to 6s
8. **Environment collisions** — Trees/rocks/buildings blocked free driving; disabled
9. **Notifications** — Scattered popups replaced with unified panel (warning/danger/success/neutral)

**Status:** Game is now fully playable with correct controls and visual feedback.

---

## 📋 Known Limitations & Next Priority

### Unfinished (Per Design Spec)

From `ROAD_GENERATION_IMPLEMENTATION_SPEC.md`:

- **Terrain carving** — Roads float on top of terrain; should be carved into embankments
- **Infinite road** — Capped at ~5km (500 nodes); infinite pooling not implemented
- **Road banking** — Curves feel flat; no superelevation on turns
- **One-pedal regen** — Braking is abrupt; no smooth coast-down
- **Autodrive** — No PID-based autonomous driving mode

### Priority Roadmap

1. **Terrain carving** (high impact) — Blend terrain to road embankments for cohesive landscape
2. **Infinite pooling** (functional blocker) — 16-chunk treadmill to enable true endless driving
3. **Road banking** (game feel) — Compute curvature, apply superelevation to turns
4. **One-pedal regen + autodrive** (polish) — Smooth coast-down and autonomous mode
5. **Code organization** (maintenance) — Split 3.7KB monolith into scene/terrain/entities modules

---

## 📁 Project Structure

```
last-mile-game/
├── index.html              ← Entry point (loads game.js + style.css)
├── game.js                 ← Main engine (3,700 lines, Three.js)
├── style.css               ← HUD & UI styling (glassmorphic design)
├── assets/
│   ├── chhota_haathi_cover.jpg
│   └── shiplyp_hub_backdrop.jpg
├── ROAD_GENERATION_IMPLEMENTATION_SPEC.md
├── SLOW_ROADS_SYSTEM_DESIGN.md
└── _archive-2d-prototype/  ← Legacy 2D modular system (not used)
```

**Note:** `_archive-2d-prototype/` contains the original modular 2D delivery-sim design (src/). It was superseded by the current 3D procedural driver approach.

---

## 🎓 Vibeoding Approach

This game was built and debugged using **AI-assisted "vibeoding"** — iterative AI-human collaboration with Playwright MCP for visual verification. The workflow:

1. Describe the desired feature or fix
2. AI implements the code
3. Playwright takes screenshots and verifies visuals
4. AI diagnoses issues and iterates
5. Commit when verified

See `vibe-code-2d-game-guide.md` for the complete methodology and Playwright setup guide.

---

## 🔗 References

- **Three.js** — [threejs.org](https://threejs.org)
- **Simplex Noise** — Procedural terrain generation
- **Spline-based routing** — Used for road generation and camera following
- **Playwright MCP** — [github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)

---

**Last Updated:** August 24, 2026 | **Status:** Playable, actively developed
