---
date: 2026-09-23
type: dev-log
tags:
  - dev-log
  - bugfix
  - geometry
  - barriers
  - sidewalks
  - world-gen
ai-first: true
---

# 2026-09-23 - B107 Sidewalk Guardrail and Barrier Grounding Alignment

## For future agent
Documents the complete root-cause analysis, geometric reconciliation, and regression testing for Bug B107: guardrails, Armco barriers, dry-stone walls, and wood fences floating in midair and misaligned with the sidewalk.

---

## 🔍 Context & Problem Statement
- **User report**: *"i feel the fences and guardrails are not properly aligned with the sidewalk, at somne areas they seem to be floating"*
- **Visual symptoms**:
  - Armco W-beam posts, wood fence posts, and wall bases hovered in midair on hill crests, dips, and banked switchback curves.
  - Barriers sat 35 cm outside the sidewalk slab, hovering over the downward-sloping grass verge embankment.
  - Pedestrians walking along the sidewalk had an awkward 35 cm gap between the paver slab and the barrier.

---

## 🛠️ Root Cause Analysis

1. **Lateral Offset Mismatch**:
   - Barrier lateral offset was hardcoded to `CONFIG.ROAD_WIDTH * 0.5 + 2.2` (~5.90 m), which predated B103's sidewalk implementation.
   - The sidewalk outer edge is at `ROAD_WIDTH * 0.52 + CONFIG.SIDEWALK.width` (~5.55 m).
   - Guardrails were sitting 35 cm outside the sidewalk on the dropping verge embankment.

2. **Vertical Height Discrepancy & Artificial Lift**:
   - Barrier placement in `createFoliageAndProps` evaluated `calcTerrainY()` (which calls `groundHeightAt()` — the raw dirt under the sidewalk, 12 cm below the paver surface) and added an arbitrary `+ 0.05` artificial lift, compounding height discrepancy on the elevated sidewalk.

3. **Zero Post Embedment Geometry**:
   - `armcoPost` cylinder geometry had depth 1.1 m centered at origin translated `+0.55 m` vertically, so its base terminated at local $Y = 0.0$ with 0 cm embedment. Any crest, dip, or road banking exposed daylight under the post base (up to 48 cm hovering).
   - Wood split-rail posts had similar zero embedment.

4. **Wall Course Hover**:
   - Dry-stone and concrete courses in `createFoliageAndProps` and chunk streaming had row heights starting 8–11 cm above the ground.

5. **Streaming Chunk Inconsistency**:
   - `_streamBuildSequence` duplicated the hardcoded legacy lateral offset and course heights.

---

## 💡 Solution & Implementation

1. **Centralized Single Source of Truth**:
   - Added `ProceduralWorld.prototype.getBarrierLateralDistance()`:
     ```javascript
     ProceduralWorld.prototype.getBarrierLateralDistance = function() {
       const roadHalf = CONFIG.ROAD_WIDTH * 0.5;
       if (CONFIG.SIDEWALK && CONFIG.SIDEWALK.enabled) {
         return roadHalf + CONFIG.SIDEWALK.width - 0.10; // ~5.45m, 10cm inset from sidewalk outer edge
       }
       return roadHalf + 2.0;
     };
     ```

2. **Surface Height Evaluation & Lift Removal**:
   - Updated fence segment height in `createFoliageAndProps` and `_streamBuildSequence` to use `this.surfaceHeightNear(endA, pt, fenceDist)` and removed the artificial `+ 0.05` lift.

3. **Embedded Post Geometries**:
   - Deepened `armcoPost` depth from 1.1 m to 1.6 m, translated `(0, -1.05, 0)` so it embeds 50 cm beneath the surface down to $Y = -0.50$ m.
   - Wood split-rail posts updated to start at $-0.9$ m (30 cm embedment).

4. **Lowered Wall Course Heights**:
   - Lowered dry-stone courses to `[0.09, 0.31, 0.53, 0.75]`.
   - Lowered concrete courses to `[0.16, 0.50]`.

5. **Updated Surrounding Systems**:
   - Roadside street lamps updated to use `surfaceHeightNear()`.
   - Vehicle collision clamps (`getLateralClamp`, `addFenceGap`) updated to reference `getBarrierLateralDistance()`.

6. **Automated Regression Suite (`dev-checks.js`)**:
   - Check 31 (`barriers-flush-with-sidewalk`): raycasts sample barrier posts against sidewalk and terrain meshes. Passes if 0 posts float above surface.
   - Check 32 (`barriers-aligned-with-sidewalk`): verifies barrier post lateral offset matches target within tolerance.

---

## 🧪 Verification & Results

1. **Automated Headless Playwright Suite**:
   - Evaluated `runWorldChecks()` on live game build.
   - **All 37/37 checks passed (100% green)**.
   - `barriers-flush-with-sidewalk`: PASS (0/200 posts floating, worst float: 0.000m).
   - `barriers-aligned-with-sidewalk`: PASS (0/200 posts deviate >0.35m from target 5.45m).

2. **Visual Inspection**:
   - `fence_inspection_driving.png`: Driving view confirms guardrails sit flush on the sidewalk slab, pedestrians walk safely inside the barrier corridor, and gaps cleanly open at zebra crossings.
   - `fence_inspection_close_up.png`: Extreme close-up confirms post bases enter the sidewalk paver with 0 daylight and 0 gaps.
   - `fence_inspection_banked_curve.png`: Banking and slope transitions maintain flush alignment with the sidewalk.

3. **Android Asset Sync**:
   - Executed `./sync_android_assets.sh` to synchronize `game.js` and assets into `android/app/src/main/assets/`.
