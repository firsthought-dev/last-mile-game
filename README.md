# 🚚 Shiplyp: Last Mile — 3D Scenic Courier Driving Experience

**Shiplyp: Last Mile** is a browser-based 3D scenic driving and last-mile courier experience. Cruise along the endless, procedurally generated Grand Western Ghats Corridor, deliver cargo to contemporary hillside villas and viewpoint pavilions, enjoy authentic streaming roadside radio, and watch the sun dip beneath the horizon in real-time.

---

## 🎮 Play Online

Play directly in your browser with zero installs or downloads:
👉 **[Play Shiplyp: Last Mile Live](https://firsthought-dev.github.io/last-mile-game/)**

---

## 🕹️ Controls

| Action | Shortcut Key | Description |
|---|---|---|
| **Accelerate / Reverse** | `W` / `S` or `↑` / `↓` | Drive forward / apply brakes / reverse gear |
| **Steer Left / Right** | `A` / `D` or `←` / `→` | Turn the wheels with progressive steering damping |
| **Express Drop (Driving)** | `Spacebar` / Click | Launch a precision ballistic parcel toss toward roadside delivery plinths |
| **Doorstep Delivery (Walking)** | `Spacebar` / Click | Complete doorstep dropoff when walking on foot |
| **On-Foot Courier Mode** | `E` | Step out of vehicle to deliver on foot / return to driver seat |
| **Autopilot (Cruise)** | `F` | Autonomous curve cruising and speed holding |
| **Return to Road (Recenter)** | `R` | Safely resets your vehicle back onto the tarmac |
| **Cycle Camera Mode** | `C` | Chase Cam / Far Chase / Cockpit Interior / Hood Bumper / Sky Drone |
| **Cycle Time of Day** | `T` | Dawn / Midday / Golden Sunset / Dusk / Midnight Starlight |
| **Toggle Weather** | `P` | Dynamic snowfall blizzard with wind drift / Rain / Clear skies |
| **Cycle Radio Station** | `L` | DHABA FM (Hindi 90s Classics) / HIGHWAY FM (Ambient Rhodes Synth) |
| **Mute Music / SFX** | `M` (Music) / `N` (SFX) | Independent audio channel mutes |
| **Controls & Settings** | `H` or `?` / `ESC` | Open in-game Controls Cheat Sheet & Audio Settings |

*📱 Full on-screen touch controls (steering, throttle, brakes, and delivery actions) automatically activate on mobile and tablet devices.*

---

## ✨ Key Features

- **Endless Procedural Highway:** Dynamic forward chunk streaming and 2D terrain gradient contour-routing delivering an authentic hillside mountain drive with continuous regional districts.
- **Realistic Driving Physics:** Pacejka lateral tire slip curve, 4-wheel independent terrain contact elevation, Ackermann steering knuckle articulation, and 2nd-order suspension body roll.
- **Modern Minimalist HUD:** Glassmorphism delivery mission capsule, dynamic curvature radar minimap with 2D waypoint projection and proximity sonar ripples.
- **Dynamic Atmosphere & Sky:** Continuous diurnal cycle, 4,500-pinpoint astrophotography starfield, atmospheric horizon fog, and dynamic automotive headlights.
- **Architectural Mountain Tunnels:** Structural concrete portals, glazed subway tile wainscot, vaulted ceilings, and continuous sodium tube lighting.
- **Dual-Engine Roadside Radio:** Real streaming Indian highway classics and real-time synthesized Web Audio ambient anthems.

---

## 📁 Repository Structure

```
├── .github/workflows/static.yml        ← GitHub Pages deployment action
├── index.html                          ← Root redirect for GitHub Pages
├── README.md                           ← Project overview and guide
└── last-mile-game/
    ├── index.html                      ← WebGL Canvas & responsive HUD interface
    ├── game.js                         ← Main game engine (Three.js r128)
    ├── style.css                       ← Glassmorphic HUD & telemetry styling
    └── assets/                         ← 3D vehicle models and PBR textures
```

---

## 🛠️ Built With

- **Three.js (r128)** — 3D WebGL Rendering
- **EffectComposer & UnrealBloomPass** — Cinematic bloom & FXAA anti-aliasing
- **Web Audio API & HTML5 Audio** — Dual-engine streaming radio & polyphonic Rhodes synthesizer
- **Simplex Noise & Multi-Octave FBM** — Procedural terrain, contour alignment & infinite road generation

---

## ⚖️ License

- Code is open-source under the MIT License.
