# Shiplyp: Last Mile — Game Design Document (GDD v3.0)

**Project Name:** Shiplyp: Last Mile Chronicles  
**Build Status:** Matches the live build as of 2026-08-26 (`game.js`, single-file modular Three.js engine ~7,100 lines).  
**Supersedes:** `SHIPLYP_GDD_V2.md` (2026-08-24) & archived 2D prototypes.  
**Genre:** 3D Procedural Action Driving & Courier Delivery Simulator.  
**Core Aesthetic:** *Slow Roads* procedural serenity meets *Crazy Taxi* momentum, immersed in vibrant Indian cityscapes and highway culture.

---

## 1. High Concept & Executive Summary

**Shiplyp: Last Mile** puts you behind the wheel as an Indian courier navigating bustling cities, coastal flyovers, ghats, and heritage alleys. 

You select your city, difficulty tier, and vehicle at the **Dispatch Hub**, then hit the road to deliver authentic cargo (lunch tiffins, festival sweets, urgent legal hard drives, fresh chai combos) to roadside doorsteps before the countdown timer hits zero. 

The game runs directly inside any modern web browser in a single HTML page without installs, build tools, or heavy game engine bloat.

---

## 2. Core Gameplay Pillars

### 2.1 Procedural Infinite Variety 🟢 Shipped
- **5 Iconic Indian Regions:** Mumbai (Coastal Flyovers), New Delhi (Heritage Havelis & Ring Road), Kolkata (Ghats & Boulevards), Pune (Deccan Peths & Wadas), and Bengaluru (Gulmohar Avenues & Tech Corridors).
- **4 Road Surfaces & Physics:** Smooth Asphalt Expressway (1.0 grip), Mountain Ghats Gravel (0.75 grip), Monsoon Mud & Slush (0.52 grip), and Coastal Dune Sand (0.65 grip).
- **Dynamic 4-Phase Time of Day:** Dawn Golden Hour, Midday Sunlight, Twilight Dusk, and Midnight Starlight with dynamic sky gradients, sun/moon positions, atmospheric fog, vehicle headlights, and skyscraper window illumination.
- **4 Seasonal Palettes:** Autumn, Spring, Summer, and Winter with tuned foliage and ground colors.

### 2.2 Readable Risk, Hazards & Law Enforcement 🟢 Shipped
- **Vehicle Integrity & Potholes:** 0–100% health bar. Striking road potholes inflicts -14% damage with physics rumble.
- **Speed Cameras & E-Challans:** Speed traps flash and issue instant ₹150 fines if clocked above the legal limit.
- **Repair Bays (Pitstops):** Roadside garage bays provide instant 100% health restoration.
- **Wanted Level & Police System:** Striking roadside pedestrians or crossing animals (cows, stray dogs, goats) raises a 1–3 star Wanted Meter. Reaching 3 stars triggers an immediate police arrest and shift termination. Safe driving naturally decays the wanted meter over 12 seconds per star.

### 2.3 Momentum & Express Deliveries 🟢 Shipped
- **3D Parabolic Parcel Toss:** Tap Space or Click to toss parcels in a physics arc with dynamic aerodynamic particle trails into delivery drop rings while cruising.
- **On-Foot Courier Mode (`E`):** Car and truck drivers can step out into third-person walking mode, sprint up paved driveways directly to the doorstep, and earn lucrative time and tip bonuses.
- **Combo Streaks & Multipliers:** Chaining consecutive on-time deliveries builds a compound multiplier (`Reward × PayoutMult × (1 + Streak × 0.2)`).

### 2.4 Scalable Difficulty Tiers 🟢 Shipped
- **Relaxed Shift:** 55s timer, generous drop radius (7.5m), 1.0× payout.
- **City Standard:** 36s timer, standard drop radius (5.2m), 1.5× payout.
- **Rush Hour Express:** 22s timer, tight drop radius (3.6m), 2.5× payout.

---

## 3. Complete Vehicle Fleet

| Vehicle | Class / Model | Top Speed | Acceleration | Braking | Handling Dynamics | Delivery Style |
|---|---|---|---|---|---|---|
| **Raftaar GT Hatch** | Sports Hatchback (Swift/Nexon) | 44.0 m/s | 18.0 m/s² | 30.0 m/s² | Nimble, responsive, moderate drift | Saddle Toss or On-Foot (`E`) |
| **Gaja 500 Mini Truck** | Light Commercial (Tata Ace "Chhota Hathi") | 30.0 m/s | 12.0 m/s² | 26.0 m/s² | Heavy momentum, wide turning radius | Saddle Toss or On-Foot (`E`) |
| **Vayu Volt Scooter** | Electric Scooter (Chetak/Ola) | 34.0 m/s | 16.0 m/s² | 24.0 m/s² | Highly agile, tight slalom weaving | Mounted Saddle Toss |
| **Pawan Pedaler Bike** | Courier Bicycle | 22.0 m/s | 10.0 m/s² | 20.0 m/s² | Low speed, zero speed cam risk | Mounted Saddle Toss |

---

## 4. The Complete Delivery Mission System

Each city features 8 randomized authentic cargo orders tied to specific doorstep landmarks:

- **Mumbai:** Dabbawala tiffin lunch boxes, Bandra seaside Irani chai & maska bun, Nariman Point legal drives, Kulkarni Wada kaju katli, Worli sea face vada pav, Dadar thali, Powai villa dual chargers, Matunga A2 milk.
- **New Delhi:** Chandni Chowk parathas & kulhad lassi, Hauz Khas butter chicken, CP tech tower hard disks, Civil Lines morning gazette, Karol Bagh sweets, Lodhi chole bhature, Vasant Vihar chargers, Nizamuddin fresh milk.
- **Kolkata:** College Street kathi rolls, Howrah riverfront biryani & rasgullas, Park Street tech dispatches, Shobhabazar sandesh, Ballygunge Darjeeling tea, Salt Lake fish curry, Alipore espresso, Kumartuli fresh milk.
- **Pune:** Sadashiv Peth misal pav, Koregaon Park pastries, Hinjewadi tech drives, Kulkarni Wada festival sweets, Deccan Gymkhana tea, Shaniwar Peth puran poli, Baner hilltop espresso.
- **Bengaluru:** Malleswaram masala dosa & filter kaapi, Indiranagar bun maska, Whitefield legal dispatches, Basavanagudi Mysore Pak, Jayanagar tea, HSR Layout bisi bele bath, Koramangala tech chargers.

---

## 5. Dual-Engine Audio & Radio System

- **Dhaba FM (Hindi 90s Highway Classics):** 49 authentic direct-streamed MP3 tracks from Indian cinema legends (Udit Narayan, Kumar Sanu, Alka Yagnik, S.P. Balasubrahmanyam, Hariharan, Abhijeet, Altaf Raja).
- **Highway FM (English Polyphonic Synth):** 6 relaxing Rhodes/analog-synthesized chill arrangements of iconic road-trip anthems (*Hotel California*, *Clocks*, *Careless Whisper*, *Boulevard of Broken Dreams*, *Counting Stars*, *Take On Me*).
- **All FM (Mix):** Continuous 55-track blended playlist.
- **Independent Controls:** Dual audio toggles (`M` for Radio, `N` for Sound Effects) and Channel Switching (`L`) with persistent browser memory.

---

## 6. HUD & Telemetry Interface

- **Minimalist Slowroads Objective Line:** Live destination name, cargo description, distance countdown (meters), and precision timer clock.
- **Real-Time Radar Minimap:** Canvas-rendered circular radar showing road curvature, player orientation, and delivery waypoint blips.
- **Live Digital Telemetry:** Digital speedometer (KM/H), active transmission state (DRIVE / REVERSE), and trip distance odometer.
- **Wanted Star Meter:** Visual police alert status pulsing upon collisions.
- **Autopilot Indicator:** Push-button toggle for autonomous curve cruising (`F`).
- **Notification Stack:** Color-coded event banners (success, warning, danger, repair, e-challans).

---

## 7. Technical Specifications

- **Engine:** Pure Three.js r128 WebGL with zero bundler dependencies.
- **Terrain Generation:** 4-octave 2D Simplex Fractal Brownian Motion (FBM) with Domain Warping.
- **Road Curve Generation:** 3D Catmull-Rom Spline with cost-optimized slope, angle, and repulsor forces.
- **Dual-Mesh Embankment:** 1,200 longitudinal segment sampling ensuring exact vertex alignment between road asphalt and surrounding terrain.
- **Post-Processing Stack:** EffectComposer with UnrealBloomPass (0.94 threshold) and FXAA anti-aliasing.
- **Memory & State:** HTML5 LocalStorage persistence for user preferences, radio state, and channel selections.
