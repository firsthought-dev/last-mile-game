# Procedural Road & Topography Engine: Complete Implementation Specification

> **Target Codebase:** `last-mile-game/game.js`  
> **Objective:** Upgrade the current static/straight road generator to an authentic, infinite, organically winding procedural road and terrain engine based on the engineering architecture of *Slow Roads* (Anslo) and modern procedural driving systems.

---

## 1. Problem Diagnosis: Why Current Roads Feel Straight

In the current `game.js`, road generation relies on a single forward-stepping loop:
```javascript
// Current limitation in generateSpline():
curAngle = THREE.MathUtils.lerp(curAngle, targetAngle, 0.14);
curX += Math.sin(curAngle) * stepDist;
curZ += Math.cos(curAngle) * stepDist;
```
**Why this produces mostly straight roads:**
1. **Fixed Directional Bias:** It accumulates along $+Z$ with tightly clamped sine perturbations ($\pm 0.62\text{ rad}$), preventing sweeping S-bends, switchbacks, and natural mountain elevation changes.
2. **Terrain Unawareness:** The road does not sample the underlying heightmap gradient. Instead, the terrain is molded around a pre-calculated curve, leading to flat corridors.
3. **Finite Pre-Generated Buffer:** It generates a fixed array of nodes (`CONFIG.ROAD_POINTS_COUNT`) rather than an infinite procedural stream with object pooling.

---

## 2. The Solution: Anslo's 10m Incremental Gradient-Following Algorithm

Instead of generating a static sine-curve along $+Z$, the road must **grow organically through the noise landscape in 10-meter increments**, sampling the terrain gradient to minimize steepness while avoiding loops.

```
                    ┌──────────────────────────────┐
                    │ 3D Multi-Octave Noise Field  │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  10m Incremental Step Scout   │
                    │  - Sample 5 Candidate Angles │
                    │  - Compute Longitudinal Grade│
                    │  - Compute Lateral Bank Tilt │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   [Tiered Angular Check]                    [Repulsor Distance Force]
   (Cumulative Turn < 200°)                  (Avoid Trapped Pockets)
              │                                         │
              └────────────────────┬────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Commit Node to Spline Pool  │
                    │  (Recycle Tail -> Head)      │
                    └──────────────────────────────┘
```

### 2.1 The Incremental Routing Math
At each step $i$:
1. **Sample 5 Candidate Forward Directions:**
   $$\theta_k = \theta_{\text{prev}} + \Delta\theta_k \quad \text{where } \Delta\theta_k \in \{-30^\circ, -15^\circ, 0^\circ, +15^\circ, +30^\circ\}$$
2. **Score Each Candidate:**
   $$\text{Score}(\theta_k) = w_1 \cdot |\text{Slope}_{\text{longitudinal}}| + w_2 \cdot |\Delta\theta_k| + w_3 \cdot \text{RepulsorForce}(x_k, z_k)$$
3. **Select Minimum Score & Clamp Slope:**
   * Maximum longitudinal grade is clamped to $\le 8\%$ ($0.08$).
   * If all ground candidates exceed $15\%$ slope or hit water, trigger **Bridge Mode** (cast ray across ravine).

### 2.2 Preventing Self-Intersections (Tiered Angular Windows)
* Maintain a running history of heading angles over 3 distance windows:
  * **Short window ($50\text{m}$):** Max cumulative turn $\le 90^\circ$.
  * **Medium window ($150\text{m}$):** Max cumulative turn $\le 160^\circ$.
  * **Long window ($300\text{m}$):** Max cumulative turn $\le 200^\circ$.
* If any window exceeds threshold, abandon candidate path and place an invisible **Repulsor Point** to prevent backtracking.

---

## 3. Dynamic Road Banking & Mesh Extrusion

To make curves feel exhilarating to drive, the road mesh must compute dynamic **camber / banking**:

```glsl
// Superelevation (Banking Angle) Formula:
float banking = clamp((velocity * velocity) / (curvatureRadius * 9.81), -0.15, 0.15);
```

### 3.1 Road Vertex Cross-Section
For each point along the spline:
* Calculate Tangent $\vec{T}$, Normal $\vec{N} = \vec{T} \times \vec{\text{Up}}$, and Binormal $\vec{B} = \vec{N} \times \vec{T}$.
* Apply banking rotation matrix around $\vec{T}$.
* Extrude cross-section:
  * Left Verge ($-6\text{m}$) $\rightarrow$ Left Road Edge ($-4\text{m}$) $\rightarrow$ Center ($0\text{m}$) $\rightarrow$ Right Road Edge ($+4\text{m}$) $\rightarrow$ Right Verge ($+6\text{m}$).

---

## 4. Terrain Heightmap Blending (Road Carving)

Terrain elevation $H(x, z)$ combines multi-octave FBM Simplex Noise with a distance-to-spline carving falloff:

```javascript
function getBlendedHeight(x, z, spline) {
  const rawTerrain = getFbmNoiseHeight(x, z);
  const { distToSpline, splineY } = getNearestSplineData(x, z, spline);

  const ROAD_HALF_WIDTH = 4.0;
  const SHOULDER_WIDTH = 12.0;
  const EMBANKMENT_WIDTH = 45.0;

  if (distToSpline <= ROAD_HALF_WIDTH) {
    // Under asphalt: exact spline elevation
    return splineY;
  } else if (distToSpline <= SHOULDER_WIDTH) {
    // Road shoulder: smooth grade matching verge
    const t = (distToSpline - ROAD_HALF_WIDTH) / (SHOULDER_WIDTH - ROAD_HALF_WIDTH);
    return THREE.MathUtils.lerp(splineY, splineY - 0.2, t);
  } else {
    // Embankment cut/fill transition to raw hills
    const blendFactor = THREE.MathUtils.smoothstep(distToSpline, SHOULDER_WIDTH, EMBANKMENT_WIDTH);
    return THREE.MathUtils.lerp(splineY, rawTerrain, blendFactor);
  }
}
```

---

## 5. Infinite "Treadmill" Object Pooling

To allow endless driving without frame drops:
1. Divide the world into a circular ring of **16 dynamic chunks** ($128\text{m} \times 128\text{m}$).
2. Track the vehicle's spline position index $S_{\text{current}}$.
3. When the vehicle moves $64\text{m}$ forward:
   * Detach the furthest chunk behind the player.
   * Generate the next $128\text{m}$ of road nodes ahead.
   * Re-populate the recycled chunk with new road mesh, terrain vertices, and instanced Indian props (palm trees, chai stalls, hoardings).

---

## 6. Physics & Game Feel Upgrades

### 6.1 Four-Wheel Analytical Suspension (Zero Engine Overhead)
```javascript
// Update loop for each wheel (i = 0..3):
const wheelRoadY = sampleRoadHeightAt(wheel.worldX, wheel.worldZ);
const suspensionCompression = Math.max(0, (wheel.restY - wheelRoadY));
const springForce = suspensionCompression * SPRING_CONSTANT;
const damperForce = (wheel.verticalVelocity) * DAMPER_CONSTANT;
const totalUpwardForce = springForce - damperForce;

// Derive chassis pitch and roll directly from the 4 wheel height deltas
chassis.rotation.x = THREE.MathUtils.lerp(chassis.rotation.x, pitchAngle, 0.1);
chassis.rotation.z = THREE.MathUtils.lerp(chassis.rotation.z, rollAngle + bankingAngle, 0.1);
```

### 6.2 EV One-Pedal Regen Braking Curve
* **Accelerating (`W` held):** Smooth exponential acceleration up to top speed.
* **Coasting (`W` released):** Apply automatic regenerative deceleration ($v_t = v_{t-1} \times e^{-0.8 \cdot dt}$).
* **Drift / Power-Slide (Double-tap `W` / Hold `Space`):** Reduce rear lateral tire friction by $60\%$ for smooth oversteer around hairpin bends.

### 6.3 Instant Reset (`R`) & Autodrive (`F`)
* **`R` Key:** Teleport car to current spline node center $+0.5\text{m}$, aligned with tangent vector.
* **`F` Key:** Spline-following PID controller targeting look-ahead point $D = \text{clamp}(v \times 0.5, 15\text{m}, 60\text{m})$.

---

## 7. Step-by-Step Implementation Action Plan

- [ ] **Step 1: Replace `generateSpline()` in `game.js`**
  - Implement 10m incremental gradient-following loop with tiered angle checks.
  - Add slope scoring and repulsor point array.
- [ ] **Step 2: Add Dynamic Road Banking to `createRoadMesh()`**
  - Compute curvature radius from spline tangents.
  - Apply banking rotation to cross-section vertices.
- [ ] **Step 3: Update `createTerrainMesh()` with Road Carving Formula**
  - Integrate smoothstep road embankment blend (`getBlendedHeight`).
- [ ] **Step 4: Implement 16-Chunk Treadmill Object Pool**
  - Cycle chunk geometry buffer as player advances.
- [ ] **Step 5: Hook up One-Pedal Regen & Autodrive PID Controller**
  - Implement smooth coast deceleration and spline-following cruise.
- [ ] **Step 6: Integrate Minimalist Glassmorphism HUD & Sunset Backdrop**
  - Add frosted glass telemetry pill with auto-hide timer.
