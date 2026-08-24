# Slow Roads Engine: Complete Technical & Design Reference

> **Purpose:** This document provides the exact mathematical, graphical, architectural, and UI specifications of *Slow Roads* (`slowroads.io` by Anslo). A coding agent can use these specifications to replicate the exact look, feel, physics, UI, and procedural generation in WebGL (Three.js), Godot 4, or Unity.

---

## 1. Visual Style & Rendering Pipeline (How to Achieve the Exact Look)

The signature *Slow Roads* aesthetic is defined by **clean, low-poly minimalism, procedural palette shading (zero photo-textures), and soft atmospheric scattering**.

```
[Procedural Sky Gradient]
        │
        ▼
[Analytical Distance Fog (Matched to Horizon)]
        │
        ▼
[Smooth/Flat-Shaded Terrain (Vertex Colors + Slope Normal Blending)]
        │
        ▼
[Instanced Foliage Meshes (Low-Poly Trees, Bushes, Rocks)]
        │
        ▼
[Post-Processing: ACES Filmic Tone Mapping + Light Bloom + FXAA/SMAA]
```

### 1.1 Shader & Material Architecture (No Heavy Textures)
* **No Bitmap Textures:** The terrain and roads do NOT use diffuse texture files (like grass.png or asphalt.png). Instead, all surfaces use **pure procedural GLSL/Spatial shaders** driven by world height, slope normals, and spline coordinates.
* **Terrain Color Blending (Slope & Elevation Tri-Color):**
  * **Low/Flat Slope ($N_y > 0.8$):** Base grass color (`#43A047` in Spring, `#D4A373` in Autumn).
  * **Steep Slope ($N_y < 0.6$):** Exposed rock/cliff color (`#5D4037` or `#546E7A`).
  * **High Elevation ($Y > Y_{\text{snow\_line}}$):** Peak snow color (`#ECEFF1`).
  * *Transition:* Use `smoothstep()` in the fragment shader to interpolate colors without hard seams.
* **Road Surface Shader:**
  * Dark charcoal matte asphalt (`#1E1E24`).
  * Solid or dashed white/yellow road stripes generated mathematically using UV coordinates:
    ```glsl
    // Fragment Shader Road Stripe Example
    float centerLine = step(abs(vUv.x - 0.5), 0.015) * step(0.5, fract(vUv.y * 10.0));
    vec3 roadColor = mix(vec3(0.12), vec3(0.95), centerLine);
    ```

### 1.2 Atmospheric Lighting & Distance Fog
* **Horizon-Matched Exponential Fog:**
  * Fog formula: $\text{FogFactor} = 1.0 - e^{-\text{depth} \times \text{density}}$.
  * **Key Rule:** The fog color must *exactly match* the bottom color of the procedural skybox gradient at the horizon. This makes distant chunks fade into the sky with zero visible clipping.
* **Sun & Day/Night Cycle:**
  * Single directional light representing the sun/moon.
  * Ambient light changes dynamically: Warm golden tint at sunrise/sunset, crisp white at noon, deep indigo (`#0D1B2A`) at night.
* **Vehicle Headlights:**
  * Two forward-projecting SpotLights (cone angle $\approx 35^\circ$, soft penumbra $0.5$) with attenuation. Headlights cast dynamic shadows on road barriers and roadside trees.

### 1.3 Post-Processing Profile
* **Tone Mapping:** ACES Filmic Tone Mapping (prevents color blowouts and gives cinematic pastel grading).
* **Bloom:** Subtle, high-threshold bloom (threshold: $0.85$, strength: $0.2$) for sunset glints and headlight reflections.
* **Anti-Aliasing:** FXAA or SMAA pass to smooth jagged low-poly edges.

---

## 2. User Interface (UI) & HUD Design

*Slow Roads* uses an **ultra-minimalist, distraction-free "glassmorphism" UI**. The HUD is virtually invisible during normal driving and provides only essential telemetry.

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Esc: Settings ⚙]                               [Camera: 🎥 (C)]       │
│                                                                        │
│                                                                        │
│                               (DRIVING VIEW)                           │
│                                                                        │
│                                                                        │
│                                                                        │
│             ┌────────────────────────────────────────────┐             │
│             │  [F: AUTODRIVE OFF]  •  084 KM/H  •  1.4 KM│             │
│             └────────────────────────────────────────────┘             │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 HUD Elements
1. **Bottom-Center Telemetry Capsule:**
   * Floating rounded pill container (`border-radius: 9999px`).
   * Translucent dark glass background: `rgba(20, 20, 25, 0.65)` with CSS `backdrop-filter: blur(12px)`.
   * **Telemetry Display:**
     * **Autodrive Pill:** Clickable tag (Green when active, subtle gray when off).
     * **Speedometer:** Clean monospace numbers (e.g. `084 KM/H` or `052 MPH`).
     * **Distance Traveled:** Cumulative odometer counter (e.g. `12.8 KM`).
2. **Auto-Hiding HUD (Immersive Mode):**
   * If the player does not move the mouse or change settings for 5 seconds, all UI elements fade to `opacity: 0.1` or `0.0`. Touching any key or mouse instantly restores full opacity.
3. **Seed Sharing Notification:**
   * Clicking the seed code or pressing copy triggers a clean, pill-shaped toast notification at the top-center: *"Seed copied to clipboard!"*.

### 2.2 Settings Modal Design
* **Layout:** Centered modal dialog with a frosted-glass backdrop.
* **Tabs:**
  1. **Environment:** Sliders for Time of Day (0:00 - 24:00), Weather/Haze, Season selector (Spring, Summer, Autumn, Winter), and Planet selector (Earth, Moon, Mars).
  2. **Vehicle:** Sliders for Max Speed, Steering Sensitivity, Suspension Stiffness, Drift Assist.
  3. **Graphics:** Segmented buttons for Quality Presets (Low, Medium, High, Ultra), Draw Distance slider, Foliage Density, Dynamic Shadows toggle.
  4. **Audio:** Master Volume, Engine Sound, Ambient Wind/Birds, Lo-Fi Radio toggle.

---

## 3. Vehicle Physics Model (The "Zen" Driving Feel)

The physics are intentionally **arcade-forgiving** rather than a punishing simulator like *Assetto Corsa*.

### 3.1 One-Pedal Regenerative Braking
* **Acceleration:** Applied with smooth exponential rise:
  $$v_{t} = v_{t-1} + (v_{\text{target}} - v_{t-1}) \cdot (1 - e^{-k_{\text{accel}} \cdot \Delta t})$$
* **Regen Braking (Key Lifted):** When `W` or `Up` is released, the vehicle automatically applies drag:
  $$v_{t} = v_{t-1} \cdot e^{-k_{\text{drag}} \cdot \Delta t}$$
  * This allows the player to navigate hairpin turns simply by easing off the throttle.
* **Active Brake / Reverse:** `S` or `Down` applies high friction until speed hits $0$, then seamlessly transitions to slow reverse.

### 3.2 Drift & Stability Control
* **Lateral Friction Curve:**
  * Under normal driving, tires have high lateral grip ($F_{\text{lat}} = 1.0$), making the car stick perfectly to road splines.
* **Drift Initiation:**
  * When the player double-taps `W` or holds the handbrake (`Space`), lateral grip drops to $F_{\text{lat}} = 0.4$.
  * The vehicle enters a controllable power-slide based on steering input and angular momentum.
  * Re-centering the steering smoothly restores grip without causing a snap-oversteer spinout.

### 3.3 Instant Reset Mechanic (`R` Key)
* When `R` is pressed:
  1. Raycast down to find the nearest point on the road spline.
  2. Teleport vehicle to spline center position $+ 0.5\text{m}$ elevation.
  3. Re-orient vehicle rotation to align with the spline's forward tangent vector.
  4. Reset linear and angular velocities to $0$.

### 3.4 Autodrive / Autopilot PID Controller (`F` Key)
* Samples a target look-ahead point on the road spline at distance $D = \text{clamp}(\text{speed} \times 0.5, 10\text{m}, 50\text{m})$.
* Uses a **PID steering controller**:
  $$\text{SteerAngle} = K_p \cdot \text{Error}_{\text{angle}} + K_d \cdot \frac{d(\text{Error}_{\text{angle}})}{dt}$$
* Automatically modulates speed: decelerates into sharp curves and accelerates on long straights.

---

## 4. Camera System & Dynamic Game Feel

* **Spring-Arm Damped Follow Cam:**
  * Camera position lags slightly behind the car using spherical linear interpolation (`slerp` or dampening factor $\tau \approx 0.06$).
  * Height: $2.2\text{m}$, Distance: $5.5\text{m}$ behind rear bumper.
* **Speed-Based Dynamic FOV:**
  * Base FOV ($60^\circ$ at $0\text{ km/h}$) stretches smoothly up to $78^\circ$ at top speed ($120\text{ km/h}$).
* **Cornering Roll / Pitch:**
  * Subtle camera tilt (up to $2.5^\circ$) in the direction of the turn to accentuate centrifugal force.
* **Cockpit / Hood View (`C` Key):**
  * Positions camera directly above the front bumper with zero spring lag for a pure sense of speed.

---

## 5. Procedural Generation Pipeline (Splines + Noise)

```
[Seeded PRNG (e.g. PCG32)] ──► [Continuous 3D Spline Points]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     [Road Mesh Extruder]                         [Terrain Heightmap Mask]
     - Width: 8.0m                                - 2D Simplex Noise
     - Camber / Banking on turns                  - Smoothstep Road Carving
     - Dynamic Barrier Placement                  - Instanced Trees / Rocks
```

### 5.1 Deterministic Road Spline Generation
1. Road path is generated as a continuous series of 3D nodes placed every $50\text{m} - 80\text{m}$.
2. Interpolate nodes using **Centripetal Catmull-Rom Splines** to prevent self-intersections and loops.
3. Maximum curvature is clamped:
   $$\kappa = \frac{1}{R} \le \kappa_{\text{max}}$$
   *(Ensures the road never produces impossible $90^\circ$ or $180^\circ$ kinks).*
4. Road edges automatically spawn low-poly guardrails on segments where the adjacent terrain drop-off exceeds $5\text{m}$.

### 5.2 Terrain Heightmap & Road Carving
* Base terrain elevation:
  $$H_{\text{raw}}(x, z) = \sum_{i=1}^{4} \frac{1}{2^i} \cdot \text{SimplexNoise}(2^i \cdot f \cdot x, 2^i \cdot f \cdot z)$$
* Road Carving Blend (eliminates floating roads and hillside clipping):
  $$d = \text{DistanceToSpline}(x, z)$$
  $$w = \text{smoothstep}(\text{RoadWidth} \times 0.5, \text{RoadWidth} \times 2.5, d)$$
  $$H_{\text{final}}(x, z) = \text{lerp}(H_{\text{spline}}(t), H_{\text{raw}}(x, z), w)$$

---

## 6. Seed String & Coordinate Encoding

The seed hash in the URL (e.g., `#O2-5927cd04@0`) is formatted as:
```
#[EnvironmentPreset]-[PRNG_HexSeed]@[DistanceKm]
```
* **Environment Presets:**
  * `O1` / `O2`: Mountainous Alpine / Autumn Haze
  * `S1` / `S2`: Summer Plains / Rolling Green Hills
  * `W1`: Winter Snow / Overcast Frost
  * `M1`: Moon / Cratered Basalt (Low Gravity)
  * `R1`: Mars / Red Dunes (Dusty Atmosphere)
* **PRNG Hex Seed:** 32-bit hex integer initializing all random noise seeds.
* **Distance `@0`:** Starting coordinate along the infinite spline ribbon.

---

## 7. Implementation Checklist for Coding Agent

When implementing this engine, follow this step-by-step milestone path:

- [ ] **Milestone 1: Math & Spline Foundation**
  - Implement deterministic PRNG (`PCG32` or `Mulberry32`).
  - Implement Catmull-Rom 3D curve with tangent, normal, and binormal calculation.
- [ ] **Milestone 2: Procedural Mesh Extrusion**
  - Extrude road ribbon mesh along the spline with correct UV tiling.
  - Implement chunked terrain grid with road carving smoothstep blend.
- [ ] **Milestone 3: Shaders & Atmosphere**
  - Write slope/height vertex color terrain shader.
  - Setup skybox gradient + matching exponential distance fog.
  - Add ACES tone mapping and subtle bloom.
- [ ] **Milestone 4: Vehicle Physics & Controls**
  - Implement arcade one-pedal regen braking and steering lerp.
  - Implement drift mode and instant reset (`R`).
  - Implement Autodrive (`F`) with spline-following PID controller.
- [ ] **Milestone 5: Minimalist Glassmorphism UI**
  - Build bottom telemetry capsule (Speed, Distance, Autodrive toggle).
  - Add auto-hiding UI timer on inactivity.
  - Build modal settings dialog with environment/season sliders.
