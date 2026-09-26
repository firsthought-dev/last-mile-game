# 🚚 Shiplyp: Last Mile — 3D Scenic Courier Driving Experience

**Shiplyp: Last Mile** is a browser-based 3D scenic driving and last-mile courier experience. Cruise along the endless, procedurally generated Grand Western Ghats Corridor, deliver cargo to hillside villas and viewpoint pavilions, earn your way from a delivery cycle to faster vehicles, and watch the sun dip beneath the horizon in real time. It runs in the browser and as an Android app.

---

## 🎮 Play Online

Play directly in your browser with zero installs or downloads:
👉 **[Play Shiplyp: Last Mile Live](https://firsthought-dev.github.io/last-mile-game/)**

---

## 🕹️ Controls

| Action | Key | Description |
|---|---|---|
| **Accelerate / Brake / Reverse** | `W` / `S` or `↑` / `↓` | Drive forward, brake, and hold `S` from a stop to reverse |
| **Steer Left / Right** | `A` / `D` or `←` / `→` | Progressive steering |
| **Drop Parcel** | `Spacebar` | Toss the parcel toward the glowing delivery ring |
| **Auto Steer** | `F` | Autopilot: steers along the road and controls speed |
| **Auto Drive** | `G` | Cruise: controls speed only (slows for bends) while you steer |
| **Return to Road** | `R` | Resets your vehicle back onto the road |
| **Cycle Camera** | `C` | Chase / Far Chase / First-Person / Hood / Sky |
| **Cycle Time of Day** | `T` | Dawn / Day / Dusk / Night |
| **Horn / Bell** | `H` | Honk (or ring the bicycle bell) |
| **Mute / Unmute Audio** | `M` | Turns all game sound on or off |
| **Controls Cheat Sheet** | `?` or `O` | Opens the controls list |
| **Settings / Close** | `Esc` | Opens settings, or closes the open menu |
| **Start Driving** | `Enter` | Starts from the main menu |

Braking turns off Auto Steer and Auto Drive, and only one of them can be on at a time.

*📱 On phones and tablets, touch controls appear automatically: ◀ ▶ steering, gas and brake pedals, a DROP button, A-STEER / A-DRIVE, and a Tools menu (camera, recenter, horn). On the delivery cycle you can also drag across the left half of the screen to steer.*

---

## ✨ Key Features

- **Endless Procedural Highway:** Forward chunk streaming and terrain-following road routing for a continuous hillside mountain drive through changing regional districts.
- **Delivery Career:** Earn money per drop, build delivery streaks, climb courier ranks, and unlock vehicles (from the Delivery Cycle to the Muscle Coupe). Progress is saved locally.
- **Two Visual Styles:** **Crisp** (sharp outlines, lighter to run) or **Cinematic** (bloom and colour grade), picked from the start screen.
- **Driver Assists:** Auto Steer (full autopilot) and Auto Drive (speed-only cruise control).
- **Realistic Driving Physics:** Tyre-slip handling, drift for cars, and separate bicycle handling with lean.
- **Minimal HUD:** Delivery mission capsule, road radar minimap, and telemetry readout.
- **Dynamic Atmosphere & Sky:** Time-of-day cycle, starfield, horizon fog, weather, and vehicle headlights.
- **Mountain Tunnels:** Concrete portals, tiled walls, and continuous tunnel lighting.
- **Mobile & Android:** Full touch controls, plus a native Android app wrapper.

---

## 📁 Repository Structure

```
├── .github/workflows/static.yml        ← GitHub Pages deployment (publishes the game files below)
├── index.html                          ← Root redirect for GitHub Pages
├── README.md                           ← Project overview and guide
└── last-mile-game/
    ├── assets/                         ← Source 3D models (.blend) and shared assets
    └── last-mile/                      ← The game
        ├── index.html                  ← WebGL canvas and HUD
        ├── game.js                     ← Main game engine (Three.js r128)
        ├── save.js                     ← Career save (wallet, rank, streaks, unlocks)
        ├── ads.js                      ← Web portal ad SDK integration
        ├── style.css                   ← HUD and menu styling
        ├── assets/                     ← Vehicle models, textures, style previews
        ├── android/                    ← Android Studio app wrapper
        └── vault/                      ← Public project notes (Obsidian)
```

---

## 🛠️ Built With

- **Three.js (r128)** — 3D WebGL Rendering
- **EffectComposer & UnrealBloomPass** — Cinematic bloom & FXAA anti-aliasing
- **Web Audio API** — Synthesized engine, wind and sound effects
- **Simplex Noise & Multi-Octave FBM** — Procedural terrain, contour alignment & infinite road generation

---

## ⚖️ License

- Code is open-source under the MIT License.
