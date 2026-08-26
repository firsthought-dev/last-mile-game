# 🚚 Shiplyp: Last Mile — The Complete Game, Architecture & Visuals Guide

> **Welcome to the Definitive Guide to Shiplyp: Last Mile.**  
> This document explains every single control, mechanic, technology, and visual trick behind the game in clear, everyday English — with zero unnecessary jargon!

---

## 📑 Table of Contents
1. [What is Shiplyp: Last Mile?](#1-what-is-shiplyp-last-mile)
2. [Complete Controls Cheat Sheet](#2-complete-controls-cheat-sheet)
3. [All Technologies & Tools Used (The Engine Under the Hood)](#3-all-technologies--tools-used)
4. [Every Game Detail & Feature Explained](#4-every-game-detail--feature-explained)
   - [The Vehicle Fleet](#41-the-vehicle-fleet)
   - [The 5 Cities & Regional Cargo](#42-the-5-cities--regional-cargo)
   - [Road Surfaces & Seasons](#43-road-surfaces--seasons)
   - [Lighting & Times of Day](#44-lighting--times-of-day)
   - [Hazards: Potholes, Speed Cameras & Repair Bays](#45-hazards-potholes-speed-cameras--repair-bays)
   - [Dynamic Crossers & The Wanted System](#46-dynamic-crossers--the-wanted-system)
   - [On-Foot Delivery Mode](#47-on-foot-delivery-mode)
   - [3D Parabolic Parcel Toss](#48-3d-parabolic-parcel-toss)
   - [Autopilot / Autonomous Cruising](#49-autopilot--autonomous-cruising)
   - [Dual-Engine Radio & Audio System](#410-dual-engine-radio--audio-system)
   - [Difficulty Tiers & Shift Economy](#411-difficulty-tiers--shift-economy)
5. [The Architecture & Technical Secrets Behind the Visuals](#5-the-architecture--technical-secrets-behind-the-visuals)
   - [How Procedural Worlds are Generated](#51-how-procedural-worlds-are-generated)
   - [How Roads Curve (Spline Math Made Simple)](#52-how-roads-curve-spline-math-made-simple)
   - [The "Sandwich" Road & Terrain Mesh Secret](#53-the-sandwich-road--terrain-mesh-secret)
   - [Why Buildings Never Float on Hills (Foundation Slabs)](#54-why-buildings-never-float-on-hills)
   - [The Cinematic Lighting & Sky Dome](#55-the-cinematic-lighting--sky-dome)
   - [Post-Processing & Glow (Bloom & FXAA)](#56-post-processing--glow-bloom--fxaa)
   - [The Chase Camera & Smooth Spring Arm](#57-the-chase-camera--smooth-spring-arm)
   - [Performance Magic: Spatial Hashing (Zero Lag)](#58-performance-magic-spatial-hashing-zero-lag)

---

## 1. What is Shiplyp: Last Mile?

**Shiplyp: Last Mile** is a 3D procedural driving and courier action game set across India’s vibrant cities and scenic highways. 

You play as an express courier delivering authentic goods — like piping-hot dabbawala lunches, morning filter coffee, wedding sweets, and urgent hard drives — to doorsteps before the clock runs out. Along the way, you navigate winding ghats, dodge potholes, avoid speed traps, watch out for crossing cows and pedestrians, and groove to authentic highway radio stations.

The entire game runs **100% inside your web browser** using a single lightweight HTML/JS package. There are no app store downloads, no long loading screens, and no heavy game engines required.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          THE CORE GAMEPLAY LOOP                        │
│                                                                        │
│   [Pick Shift & City]  ──►  [Drive / Autopilot on 3D Roads]            │
│            ▲                                 │                         │
│            │                                 ▼                         │
│   [Cash Out / Upgrade] ◄── [Toss Parcel or Walk to Doorstep]           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Controls Cheat Sheet

You can play using your **Keyboard**, **Mouse**, or on-screen **HUD Touch Buttons**.

### 🚗 Driving & Movement Controls
| Action | Keyboard Keys | Description |
|---|---|---|
| **Accelerate / Drive Forward** | `W` or `↑ (Up Arrow)` | Powers the engine forward. In walking mode, walks forward. |
| **Brake / Reverse** | `S` or `↓ (Down Arrow)` | Slows down the vehicle, applies brakes, or shifts into reverse gear. |
| **Steer Left** | `A` or `← (Left Arrow)` | Turns the steering wheel left. In walking mode, turns/strafes left. |
| **Steer Right** | `D` or `→ (Right Arrow)` | Turns the steering wheel right. In walking mode, turns/strafes right. |

### 📦 Delivery & Action Controls
| Action | Keyboard / Mouse | Description |
|---|---|---|
| **Toss Parcel (In Vehicle)** | `Spacebar` or `Left Click` | Launches an arcing 3D parcel with smoke trails toward the delivery target when within 35 meters. |
| **Deliver Package (On Foot)** | `Spacebar` or `Left Click` | Drops the package right at the customer's front door marker when walking. |
| **Step Out / Enter Vehicle** | `E` | Lets car and mini-truck drivers get out of their vehicle to walk deliveries to the door for extra tips and time bonuses! |

### 🛠️ Driving Assists & Quality-of-Life Controls
| Action | Shortcut Key | HUD Button | Description |
|---|---|---|---|
| **Autopilot (Self-Driving)** | `F` | `AUTOPILOT` | Lets the AI take the wheel! The car automatically steers through bends and eases off the gas around tight corners. |
| **Return to Road (Recenter)** | `R` | `RECENTER` | Instantly puts your car back onto the tarmac if you ever slide off-road into a ditch. |
| **Cycle Camera Angle** | `C` | `CAM` | Cycles between 3 cameras: **Elevated Chase Cam**, **Hood Bumper Cam**, and **Panoramic Sky Cam**. |
| **Cycle Time of Day** | `T` | `TOD` | Cycles between **Dawn Golden Hour**, **Midday Daylight**, **Twilight Dusk**, and **Midnight Starlight**. |
| **Toggle Delivery Status** | `V` | `STATUS` | Opens or closes the on-screen mission status and delivery manifest. |
| **Settings & Dispatch Tuning** | `Escape` | `CONFIG` | Opens the gameplay configuration menu. |

### 📻 Music & Audio Controls
| Action | Shortcut Key | HUD Button | Description |
|---|---|---|---|
| **Cycle Radio Station** | `L` | Station Name | Switches between **DHABA FM** (Hindi 90s MP3s), **HIGHWAY FM** (English Polyphonic Synth), and **ALL FM** (Mix). |
| **Mute / Unmute Radio** | `M` | `RADIO` | Silences background music without turning off sound effects. |
| **Mute / Unmute Sound Effects** | `N` | `SFX` | Silences engine beeps, potholes, and alerts without stopping your music. |
| **Previous Track** | — | `PREV` | Plays the previous song on the station. |
| **Play / Pause Radio** | — | `PLAY` | Pauses or resumes the active music track. |
| **Next Track** | — | `NEXT` | Skips to the next song on the station. |

---

## 3. All Technologies & Tools Used

Shiplyp is built with modern, ultra-clean web standards that squeeze high-performance 3D graphics out of plain JavaScript:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             TECHNOLOGY STACK                             │
├────────────────────────────────┬─────────────────────────────────────────┤
│ Layer                          │ Technologies Used                       │
├────────────────────────────────┼─────────────────────────────────────────┤
│ 3D Rendering & Scene Graph     │ Three.js (r128 WebGL Engine)            │
│ 3D Asset Loading               │ THREE.GLTFLoader (CC0 3D Models)        │
│ Post-Processing & Lighting FX  │ EffectComposer, UnrealBloomPass, FXAA   │
│ Procedural Math & Generation   │ 2D Simplex Noise, 4-Octave FBM, PRNG    │
│ Audio Systems                  │ Web Audio API (Synth) + HTML5 Audio MP3 │
│ 2D Graphics & Minimap          │ HTML5 2D Canvas API                     │
│ Styling & User Interface       │ Vanilla CSS3, Glassmorphism, CSS Grid   │
│ Fonts & Typography             │ Google Fonts (Outfit & Space Mono)      │
│ State & Persistence            │ Browser LocalStorage API                │
└────────────────────────────────┴─────────────────────────────────────────┘
```

- **Three.js (r128)**: The industry-standard WebGL 3D graphics library that draws all the 3D meshes, trees, cars, roads, and skies directly on your graphics card.
- **GLTF 3D Models**: Uses lightweight, beautifully sculpted CC0 3D car models (Kenney Car Kit) for the Sports Sedan, Tata Ace pickup truck, and delivery van.
- **Post-Processing Pipeline**:
  - `EffectComposer`: A master pipeline that applies cinematic visual effects after the 3D world is drawn.
  - `UnrealBloomPass`: Gives neon lights, streetlamps, car headlights, and glowing skyscraper windows a warm, movie-like glow.
  - `FXAAShader`: Fast Approximate Anti-Aliasing that smooths out rough pixel edges on road lines and building corners.
- **Web Audio API**: Generates warm, real-time musical synthesizer notes modeled after vintage Rhodes electric pianos for English road-trip anthems.
- **HTML5 Streaming Audio**: Streams high-bitrate, authentic 90s Bollywood MP3 tracks over the internet.
- **HTML5 2D Canvas**: Powering both the circular Radar Minimap and custom micro-speckle ground textures (grass blades, asphalt granules, stone textures) on the fly without heavy image downloads.

---

## 4. Every Game Detail & Feature Explained

### 4.1 The Vehicle Fleet
Each vehicle has distinct handling, top speed, braking force, and delivery styles:

1. **Raftaar GT Hatch (Sports Hatchback)**
   - *Top Speed:* 44 m/s (Fastest in the fleet)
   - *Handling:* Tight grip, quick acceleration, sports tuned.
   - *Delivery Mode:* Supports both drive-by parcel tossing and on-foot courier walking (`E`).
2. **Gaja 500 Mini-Truck (Tata Ace "Chhota Hathi")**
   - *Top Speed:* 30 m/s
   - *Handling:* Heavy commercial pickup feel with realistic body momentum.
   - *Delivery Mode:* Supports both drive-by parcel tossing and on-foot courier walking (`E`).
3. **Vayu Volt Scooter (Electric Two-Wheeler)**
   - *Top Speed:* 34 m/s
   - *Handling:* Featherweight agility, perfect for weaving through tight traffic and slalom curves.
   - *Delivery Mode:* Riders stay mounted in the saddle and toss packages directly on the fly.
4. **Pawan Pedaler Bike (Courier Bicycle)**
   - *Top Speed:* 22 m/s
   - *Handling:* Eco-friendly pedal power. Immune to speed camera fines!
   - *Delivery Mode:* Mounted saddle toss.

---

### 4.2 The 5 Cities & Regional Cargo
Every city generates a unique road layout and 8 authentic cargo missions:

- **🌊 Mumbai (Marine Drive & Coastal Flyovers):**  
  *Vibe:* Seaside breezes and sweeping coastal overpasses.  
  *Cargo:* Hot Dabbawala tiffin lunches, Bandra Irani chai & maska bun, Nariman Point legal drives, Kulkarni Wada kaju katli sweets, and Worli sea face vada pav.
- **🏛️ New Delhi (Ring Road & Heritage Havelis):**  
  *Vibe:* Wide avenues, historical gates, and winter morning fog.  
  *Cargo:* Chandni Chowk stuffed parathas & lassi, Hauz Khas butter chicken, CP tech disks, and Civil Lines morning gazettes.
- **🌁 Kolkata (Historic Boulevards & Riverfront Ghats):**  
  *Vibe:* Tram-lined boulevards and classic colonial architecture.  
  *Cargo:* College Street kathi rolls, Howrah riverfront biryani & rasgullas, and Shobhabazar sandesh boxes.
- **🏰 Pune (Deccan Peths & Wada Alleys):**  
  *Vibe:* Historic wadas, winding hill climbs, and student hubs.  
  *Cargo:* Sadashiv Peth spicy misal pav, Koregaon Park artisanal bakery items, Hinjewadi tech drives, and Shaniwar Peth puran poli.
- **🌳 Bengaluru (Gulmohar Avenues & Tech Corridors):**  
  *Vibe:* Lush green canopies, blooming trees, and bustling tech parks.  
  *Cargo:* Malleswaram hot masala dosa & filter kaapi, Indiranagar bun maska, Whitefield server drives, and Basavanagudi Mysore Pak.

---

### 4.3 Road Surfaces & Seasons
The physical road grip actively changes how your vehicle drives:

- **🛣️ Asphalt Expressway (1.0× Grip):** Smooth tarmac with maximum tire traction and high-speed cornering stability.
- **🪨 Mountain Ghats Gravel (0.75× Grip):** Loose rocky terrain requiring gentle steering to prevent sliding.
- **🌧️ Monsoon Mud & Slush (0.52× Grip):** Slippery drift surface where rear tires break loose under hard acceleration.
- **🏖️ Coastal Dune Sand (0.65× Grip):** Soft sand verges that pull at steering and require throttle control.

**Seasonal Visuals:** The world supports 4 distinct seasons (**Autumn**, **Spring**, **Summer**, and **Winter**), altering tree leaf colors, fog tint, and hillside vegetation.

---

### 4.4 Lighting & Times of Day
With the press of `T` (or the HUD button), the game shifts across 4 times of day:

- **🌅 Dawn (Golden Hour):** Warm orange horizon, soft sunlight angles, and pastel sky gradients.
- **☀️ Midday (Daylight):** Bright crisp sun, vibrant blue skies, and high visibility.
- **🌇 Dusk (Twilight):** Dramatic violet-and-magenta sky with glowing orange horizon bands.
- **🌙 Night (Midnight Starlight):** Deep navy starfield, glowing vehicle headlights illuminating the asphalt ahead, and skyscrapers with illuminated window textures.

---

### 4.5 Hazards: Potholes, Speed Cameras & Repair Bays
- **🕳️ Potholes:** Realistic cracked road depressions. Hitting one deals **-14% vehicle damage** with an audible suspension thud and screen shake.
- **📸 Speed Camera Gantries:** Speed traps set along straightaways. Cruising past them above the speed limit triggers an instant camera flash and a **₹150 E-Challan fine**.
- **🔧 Repair Bays (Pitstops):** Blue sheet-metal roadside garages. Pulling into the repair pad instantly repairs your vehicle back to **100% Health**.

---

### 4.6 Dynamic Crossers & The Wanted System
The roadside is alive with crossing pedestrians and animals:

- **Pedestrians:** Men in dhotis/kurtas and women in colorful sarees or jeans walking across roads with animated leg swings.
- **Animals:** Indian humpback cows, stray dogs, and village goats.
- **🚨 The Wanted Meter (1 to 3 Stars):**  
  Striking a pedestrian or animal immediately adds **1 Wanted Star** and flashes an emergency police warning.  
  - *1 to 2 Stars:* Police alert state.
  - *3 Stars (Max Wanted):* Triggers an immediate **Police Arrest / Shift Over** screen.
  - *Clean Driving Decay:* Driving safely without hitting anyone gradually decays your wanted level by 1 star every **12 seconds**.

---

### 4.7 On-Foot Delivery Mode
When driving a Car or Mini-Truck, you can stop the vehicle and press **`E`** to hop out:

- Your courier appears in a delivery uniform with real-time walking leg animations.
- You can walk up paved driveways directly to the doorstep delivery ring.
- Delivering on foot gives you a **generous time extension (+15s)** and a **special doorstep tip bonus**!
- Pressing `E` again hops right back into the driver's seat.

---

### 4.8 3D Parabolic Parcel Toss
For high-speed couriers who love momentum:

- When approaching within 35 meters of a destination house, an on-screen **`SPACE / DROP CARGO`** reticle appears.
- Pressing Space tosses a 3D parcel with physical gravity that arcs through the air.
- The parcel leaves a dynamic **aerodynamic particle smoke trail** behind it as it swoops into the delivery drop ring.

---

### 4.9 Autopilot / Autonomous Cruising
Pressing **`F`** engages the intelligent autonomous driver:

- The car tracks the upcoming road curve ahead using dynamic speed lookahead.
- It automatically steers through complex bends and slows down smoothly around hairpin switchbacks.
- You can lean back, change radio stations, and enjoy the scenery while the car drives itself!

---

### 4.10 Dual-Engine Radio & Audio System
Shiplyp features two complete sound engines in one:

1. **Dhaba FM (49 Authentic Hindi MP3s):** Real streamed tracks by Indian legends (Udit Narayan, Kumar Sanu, Alka Yagnik, Hariharan, SPB, Altaf Raja).
2. **Highway FM (English Polyphonic Synth):** Chill lofi/Rhodes piano arrangements of road trip favorites (*Hotel California*, *Clocks*, *Careless Whisper*, *Boulevard of Broken Dreams*, *Counting Stars*, *Take On Me*).
3. **All FM (Mix):** A seamless shuffle of all 55 songs.
4. **Independent Audio Control:** You can mute the music (`M`) while keeping game sounds on, or mute sound effects (`N`) while keeping your radio blasting.

---

### 4.11 Difficulty Tiers & Shift Economy
- **Relaxed Shift:** 55-second timers, wide drop rings (7.5m), 1.0× payout.
- **City Standard:** 36-second timers, standard drop rings (5.2m), 1.5× payout.
- **Rush Hour Express:** 22-second timers, tight precision drop rings (3.6m), 2.5× payout.
- **Combo Streaks:** Completing deliveries without letting the timer expire builds a combo streak multiplier that boosts your cash rewards higher and higher!

---

## 5. The Architecture & Technical Secrets Behind the Visuals

Here is how the game’s 3D engine creates beautiful, seamless worlds on the fly using mathematics and clever graphics design:

---

### 5.1 How Procedural Worlds are Generated
Instead of storing gigabytes of 3D map files, the game generates the entire world dynamically using mathematical formulas:

```
[Random Seed / String] ──► [PRNG (Deterministic Randomizer)]
                                 │
                                 ▼
                     [2D Simplex Noise Generator]
                                 │
                                 ▼
               [4-Octave Fractal Brownian Motion (FBM)]
                                 │
                                 ▼
                  [Infinite Rolling Hills & Valleys]
```

1. **Deterministic PRNG:** A random number generator seeded with a unique string (like `"mumbai"` or `"delhi"`). This ensures that every run on the same seed generates the exact same mountains and curves.
2. **Domain Warping & 4-Octave FBM:** The game stacks 4 layers ("octaves") of noise on top of each other — big rolling mountains, medium hills, small mounds, and fine surface bumps — all warped smoothly to look like real natural landscape.

---

### 5.2 How Roads Curve (Spline Math Made Simple)
How does the road wind through the mountains without plunging straight into rock walls?

- The game picks 500 milestone points across the terrain.
- For each step, it calculates a **Cost Score**: it searches for the smoothest path with gentle slopes and nice scenic curves while repelling away from steep mountain peaks.
- It then feeds these points into a smooth mathematical 3D curve called a **Catmull-Rom Spline**. This turns individual waypoints into a silky-smooth, continuous highway.

---

### 5.3 The "Sandwich" Road & Terrain Mesh Secret
In many driving games, roads either float awkwardly above the dirt or sink into hillsides. Shiplyp solves this with a **Dual-Mesh Stitching Architecture**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │                ROAD CROSS-SECTION ANATOMY                   │
 ├─────────────────────────────────────────────────────────────┤
 │                                                             │
 │   Left Hillside       Verge    Road Slab    Verge     Right │
 │   (World Floor)     (Shoulder) (Asphalt)  (Shoulder)  Floor │
 │        \               │           │          │          /  │
 │         \____.________/ ═══════════ \________._________ /   │
 │              ▲                          ▲                   │
 │       Terrain Embankment Ribbon  (Matches Road Vertices)    │
 └─────────────────────────────────────────────────────────────┘
```

1. **The Road Ribbon:** Generated with **1,200 cross-sections** along the spline. The center carries banked asphalt, while the outer verges sit exactly flush on the shoulder.
2. **The Terrain Ribbon:** A custom-carved skirt matching the exact same 1,200 longitudinal points. It flattens right under the road and gently blends outward into the surrounding hills up to 45 meters away.
3. **The World Floor:** A wide-area landscape mesh that connects smoothly at the 45-meter boundary using a smooth transition formula (`smoothstep`).
4. **The 2cm Lift Rule (`ROAD_VERGE_LIFT`):** The road slab is placed exactly 2 centimeters above the terrain mesh. If two surfaces are at the exact same millimeter height, their pixels flicker back and forth ("Z-fighting"). That tiny 2cm lift guarantees the clean asphalt edges always look crisp and sharp!

---

### 5.4 Why Buildings Never Float on Hills
When houses, shops, or skyscrapers sit on steep hills, how do we stop the downhill side of the building from floating in mid-air?

- **60-Meter Foundation Slabs:** Every building has a solid foundation base extending **60 units down** into the ground. Even on a 45-degree slope, the foundation stays firmly anchored into the dirt like real hillside architecture.
- **Rotation-Accurate Rock Math:** For rocks (12-sided dodecahedrons), the game calculates the exact lowest point among all 20 vertices after applying random 3D rotations, ensuring the boulder base always sits perfectly flush on the soil.
- **Global Clearance Checking:** When placing roadside tea stalls, general stores, or temples, the generator runs a global clearance circle (`clearsRoad`) to make sure props never accidentally spawn across hairpin road loops.

---

### 5.5 The Cinematic Lighting & Sky Dome
- **Dynamic Sky Dome:** A giant inverted sphere surrounds the world. A custom vertex color gradient smoothly transitions between sky-top and horizon colors depending on whether it is Dawn, Midday, Dusk, or Night.
- **Directional Sun/Moon:** Casts light that matches the time of day, paired with soft environmental ambient light that illuminates mountain shadows.
- **Window Glow Management:** Skyscraper window materials automatically switch on their warm emissive glow during Dusk and Night, giving cities a bustling nighttime skyline.

---

### 5.6 Post-Processing & Glow (Bloom & FXAA)
To give the game a modern, polished look:
- **Unreal Bloom Pass:** Highlights bright surfaces (streetlamps, neon shop signs, sun reflections) and makes them glow with a soft cinematic halo. The bloom threshold is precisely tuned to `0.94` so bright colors glow without washing out the entire screen.
- **FXAA (Anti-Aliasing):** Smooths out diagonal lines on the road and building edges, removing jagged "staircase" pixel artifacts for a clean, sharp look.

---

### 5.7 The Chase Camera & Smooth Spring Arm
The camera follows your vehicle with a **Spring-Arm Smoothing System**:
- Instead of snapping rigidly to the car, the camera softly glides (**Linear Interpolation / Lerp**) behind the vehicle, giving high-speed turns a dynamic, fluid cinematic feel.
- **Ground-Clip Protection:** The camera constantly checks the carved ground height below itself. If you drive over a hill crest, the camera automatically lifts upward so it never clips under the ground.

---

### 5.8 Performance Magic: Spatial Hashing (Zero Lag)
How does a browser render thousands of trees, rocks, buildings, and kilometers of road at a steady **60 FPS**?

- **Spatial Hashing:** During world generation, instead of testing every single tree against thousands of road points (which would cause massive lag), the world is divided into a **50-meter 2D grid bucket system**.
- Any building or prop only checks its immediate 3×3 neighbor grid cells. This turns heavy world calculations into lightning-fast sub-second lookups!
- **Optimized Mesh Geometry:** Background terrain uses balanced polygon budgets, ensuring high visual detail where you drive while keeping GPU memory light.

---

## 🏁 Summary

Shiplyp: Last Mile combines **procedural math**, **clever dual-mesh graphics engineering**, **rich cultural atmosphere**, and **arcade delivery gameplay** into an instantly playable, high-performance browser experience.

Have fun on the road, courier! 🚀
