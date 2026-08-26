# 🚚 Shiplyp: Last Mile — 3D Indian Courier Driving Game

**Shiplyp: Last Mile** is a browser-based 3D action driving and procedural delivery game set across Mumbai, Delhi, Kolkata, Pune, and Bengaluru. Pilot iconic Indian vehicles, cruise through scenic mountain ghats and coastal flyovers, dodge hazards, and deliver authentic regional cargo before the shift timer runs out!

---

## 🎮 Play Online

Play directly in your browser with zero installs or downloads:
👉 **[Play Shiplyp: Last Mile Live](https://firstthought-dev.github.io/last-mile-game/)**

---

## 🕹️ Controls

| Action | Shortcut Key | Description |
|---|---|---|
| **Accelerate / Reverse** | `W` / `S` or `↑` / `↓` | Drive forward / apply brakes / reverse gear |
| **Steer Left / Right** | `A` / `D` or `←` / `→` | Turn the wheels |
| **Toss Parcel (In Vehicle)** | `Spacebar` / Click | Launch an arcing 3D parcel with smoke trails into delivery rings |
| **Deliver Package (On Foot)** | `Spacebar` / Click | Complete doorstep dropoff when walking |
| **Step Out / Enter Vehicle** | `E` | Hop out of cars/trucks into 3rd-person walking courier mode |
| **Autopilot (Self-Driving)** | `F` | AI autonomous curve cruising and speed control |
| **Return to Road (Recenter)** | `R` | Safely resets your vehicle back onto the tarmac |
| **Cycle Camera Mode** | `C` | Elevated Chase Cam / Hood Bumper Cam / Panoramic Sky Cam |
| **Cycle Time of Day** | `T` | Dawn / Midday / Twilight / Midnight Starlight |
| **Cycle Radio Station** | `L` | DHABA FM (Hindi 90s MP3s) / HIGHWAY FM (English Synth) / ALL FM |
| **Mute Music / SFX** | `M` (Radio) / `N` (SFX) | Independent audio channel mutes |

---

## 📚 Key Documentation

- **[Game Architecture & Visuals Guide](last-mile-game/GAME_ARCHITECTURE_AND_VISUALS_GUIDE.md)** — Plain English guide covering controls, the full tech stack, gameplay systems, and the 3D graphics rendering pipeline.
- **[Shiplyp GDD v3.0](last-mile-game/SHIPLYP_GDD_V2.md)** — Complete Game Design Document.
- **[Credits, References & Attributions](last-mile-game/CREDITS_AND_REFERENCES.md)** — Attributions for creators, AI models (Claude & Antigravity), open-source libraries, CC0 assets, and music.

---

## 📁 Repository Structure

```
├── index.html                           ← Root redirect for GitHub Pages
├── README.md                            ← Project overview and guide
└── last-mile-game/
    ├── index.html                       ← WebGL Canvas & responsive HUD interface
    ├── game.js                          ← Main game engine (Three.js r128)
    ├── style.css                        ← Glassmorphic HUD & telemetry styling
    ├── dev-checks.js                    ← Automated regression verification suite
    ├── GAME_ARCHITECTURE_AND_VISUALS_GUIDE.md
    ├── SHIPLYP_GDD_V2.md
    ├── CREDITS_AND_REFERENCES.md
    └── assets/                          ← CC0 3D models and backdrops
```

---

## 🛠️ Built With

- **Three.js (r128)** — 3D WebGL Rendering
- **EffectComposer & UnrealBloomPass** — Cinematic bloom & FXAA anti-aliasing
- **Web Audio API & HTML5 Audio** — Dual-engine streaming MP3 radio & analog synthesizer
- **Simplex Noise & 4-Octave FBM** — Procedural terrain & infinite road generation
- **Kenney Car Kit** — CC0 Public Domain 3D Vehicle Models

---

## ⚖️ License

- Code is open-source under the MIT License.
- 3D vehicle assets by Kenney ([kenney.nl](https://kenney.nl)) under CC0 1.0 Universal.
