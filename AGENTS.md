# Project Guidelines: AI Game Dev with Visual Verification

## MANDATORY: update BUGFIX_LOG.md after every bug fix or feature, every time

Not optional, not "when convenient," not only for changes made by whichever
agent happens to be reading this file. Every time last-mile-game/game.js
(or any other tracked file in that project) changes — whether you wrote the
fix, the user wrote it directly, or it arrived via a commit from a
different session/agent — check whether `last-mile-game/BUGFIX_LOG.md` is
missing an entry for it before considering the work finished. This applies
even to changes you didn't make yourself: if you notice `git log` has moved
past what the log documents (compare the latest commit's diff against the
log's most recent entry), catching that up is part of the task, not a
side quest.

For each entry, include:
- **Symptom** (what was actually observed/reported)
- **Root cause** (traced, not guessed)
- **Fix** (file/function, and the actual mechanism — not just "fixed it")
- **Verification** (what was actually run/measured to confirm it)
- Whether it's a **new occurrence of an existing Recurring Pattern** below,
  or a genuinely new pattern worth adding as its own entry.

If a fix reveals a *new* recurring mistake-shape (not just a one-off bug),
add it to the "Recurring bug patterns" section in `BUGFIX_LOG.md` **and**
summarize it into the numbered list below — both files, not just one.
`BUGFIX_LOG.md` holds the full reasoning; this file holds the condensed
version that's actually read every session. A pattern lesson that only
exists in one of the two files will get missed the next time it matters.

Skipping this is exactly how B18 (see `BUGFIX_LOG.md`) almost went
undocumented — a real commit landed, was reviewed and verified working, and
the log update was nearly treated as a separate, skippable step instead of
part of finishing the work.

## Visual Testing & Feedback Loop
For all game development tasks in this workspace:
- Load and follow the [playwright-game-testing](file:///.agents/skills/playwright-game-testing/SKILL.md) skill.
- After implementing or modifying game features, verify the visual rendering, controls, animations, and physics via browser inspection and screenshots.
- Specifically inspect for:
  - Sprite animation artifacts & frame size miscalculations ("ghost slivers")
  - Layering and z-ordering (no floating props or clipped surfaces)
  - Keyboard/input handling and state machine transitions
  - Smooth camera tracking and parallax scrolling
- Patch any detected visual bugs immediately and re-verify before finalizing work.
- Verify with real data, not just a screenshot, wherever a numeric check is
  possible (read actual object positions/pixel values via the browser's JS
  console instead of eyeballing a compressed image) — see
  `last-mile-game/BUGFIX_LOG.md`'s "async injection produces false
  positives" note for a case where even that needed a second look.

## Before touching last-mile-game: read BUGFIX_LOG.md first

`last-mile-game/BUGFIX_LOG.md` is the full, chronological bug/fix history
for that project across every contributor — read it, specifically the
"Recurring bug patterns" section, before making changes to terrain height,
vehicle/camera positioning, or post-processing. Do not blindly re-derive a
fix from scratch in an area that has already broken more than once; check
whether you're about to repeat one of these first:

1. **Duplicated height formulas drift apart (8+ occurrences, the single
   most-repeated mistake in this project).** If you're about to write
   `pt.y - 0.18 - ...` or any hand-rolled ground-height calculation
   anywhere new, stop — call `World.groundHeightAt()` instead. Any new
   smoothly-varying value derived from world position (height, color,
   anything) belongs in one shared function that everything else calls,
   not a second approximation of the same thing.

   **This includes mesh vertex generation, not just prop placement.**
   `World.groundHeightAt(pt, worldPos, latDist)` is the single source of
   truth for "where is the ground here." Anything that must meet the
   ground takes its Y from it:
   - **Road generation:** `createRoadMesh`'s outer verge vertices
     (cross-section indices 0 and 6) **must** call `groundHeightAt()`, and
     must **not** apply banking — to the Y *or* to the offset direction.
     The terrain is unbanked, so a banked verge cannot sit flush against
     it. Only the inner road surface (indices 1–5) carries the banked
     `+0.12` slab offset. A fixed vertical offset at the verge floats the
     *entire* road above the terrain along its whole length (bug B16).

   **Calling the same height function is NOT enough for two meshes to
   meet.** B16 did that and the seam still tore. Road and terrain must
   also share:
   - **`CONFIG.ROAD_MESH_SEGMENTS`** — the longitudinal sampling rate for
     both `createRoadMesh` and `createTerrainMesh`. They were 1200 vs 800,
     so the two ribbons evaluated the same formula at different points on
     the curve and only touched where samples coincided.
   - **`CONFIG.ROAD_SHOULDER_WIDTH`** — the terrain's `lateralSlices` must
     contain a row at exactly `±(ROAD_WIDTH*0.5 + ROAD_SHOULDER_WIDTH)` so
     the road's edge lands on a real terrain vertex, not mid-triangle.
   - **`CONFIG.ROAD_VERGE_LIFT`** — a 2cm lift so the road slab wins the
     depth test. **Exactly coplanar is a bug**, not the goal: it z-fights
     and lets terrain poke through the edge as a ragged sawtooth.

   If you change `ROAD_WIDTH`, `ROAD_SHOULDER_WIDTH`, or either segment
   count, all of the above must move together.
   - **Prop placement:** use the `calcTerrainY` helper inside the
     world-gen loop, which now simply delegates to `groundHeightAt()`.
     Don't reintroduce a local copy of the formula.
   - **Carve width invariant:** the flat carve half-width
     (`ROAD_WIDTH * 0.52`) must stay **≥** the road's painted half-width
     (`ROAD_WIDTH * 0.5`), and the shoulder zone (out to 9.0) must extend
     past the ribbon's outer edge (`ROAD_WIDTH * 0.5 + 1.8`). If
     `ROAD_WIDTH` or `shoulderWidth` is ever changed, re-check both.

   Guarded by `road-verge-flush-with-terrain` in `dev-checks.js`, which
   **raycasts the actual terrain mesh** along the full road and fails if
   terrain is above the road at all, or if the road floats more than 8cm.

   ⚠️ **Verify geometry against geometry.** The first version of that
   guard compared the verge to `groundHeightAt()` and passed at 0.008u
   while the seam was visibly torn on screen — two meshes can both call
   the same formula and still not touch. Raycast the rendered mesh. And
   when raycasting a ribbon that spans ±40m laterally, take the hit
   **nearest** the sample rather than the first/highest: at a hairpin the
   ribbon folds over itself, and the top hit can be a different stretch of
   road tens of units away.

   **A hard switch at the geometrically correct boundary is still not
   enough — the transition itself must be smooth.** `createWorldFloor`
   moving its buried/natural switch from the wrong distance (40) to the
   right one (45, matching `RIBBON_COVERAGE`/`EMBANKMENT_BLEND`) fixed the
   *location* of the bug but not the bug: floor mesh vertices are ~15m
   apart, so a dozens-of-units jump still compresses into whatever single
   quad straddles the switch, and anything sitting on that one quad reads
   a wrong, blended-neither height. Blend with `smoothstep`, and make the
   blend **finish exactly at the boundary the unblended formula begins
   from** — don't blend past it (props already show pure formula output
   there, so a floor still ramping up past the boundary floats/sinks in
   the opposite direction) and don't blend too far before it either if
   another invariant (e.g. "floor must stay >10u below road within 40m")
   caps how early the ramp can start.
2. **"Vehicle sinks into / floats above the road"** has had 3 independent
   root causes so far (ignoring lateral offset, camera clamp using raw vs.
   carved terrain, ignoring road banking). If it happens again, check
   whether it's genuinely a 4th cause before assuming it's a regression of
   one of the first three.
3. **Camera can end up inside/under terrain** — any camera clamp must
   reference the carved road height, not raw noise terrain.
4. **A geometrically/mathematically "more correct" fix can still be a
   regression** if it doesn't match this project's actual conditions (e.g.
   its typically wide viewports). Verify against the real reported symptom
   under the real conditions in use, not against formula correctness in
   the abstract — and verify in **screen space**, not internal state (see
   `BUGFIX_LOG.md` entry A3).
5. **A partial CSS property override can silently reintroduce a bug in one
   specific viewport/condition** (e.g. `overflow-x` without `overflow-y` —
   CSS couples them). Check all breakpoints, not just the one you're
   fixing.
6. **Bloom/luminance blowout on bright or emissive surfaces** (3
   occurrences). Any new bright, saturated, or emissive material should be
   checked against the bloom pass (threshold tuned to 0.94 for this exact
   reason) before being considered done.
7. **When you remove a clamp/cap that was making something artificially
   safe, re-audit what it was silently hiding** — removing the terrain
   height clamp took a building from "invisibly buried" to "visibly
   standing in the road," which was a pre-existing, unrelated placement bug
   the clamp had been masking, not something the fix itself broke.
8. **A boundary/collision clamp must correct only the specific axis that's
   violated, never rebuild the whole position from scratch.** The vehicle's
   fence clamp used to snap straight to `nearestPoint + normal*clampDist`
   on contact — discarding the along-road component of the move too, which
   created a genuine frozen-forever deadlock (nonzero speed, zero net
   motion) whenever heading pointed mostly sideways into the fence.
   Decompose into components and clamp only the offending one.
9. **`Object3D.lookAt(pt)` tilts the whole object (pitch/roll), not just
   yaw, whenever `pt.y` differs from the object's own Y** — true almost
   everywhere on this project's hilly terrain. Bit 7 different roadside
   props independently before anyone caught it as a pattern. Flatten the
   target first: `group.lookAt(pt.x, group.position.y, pt.z)`, unless you
   deliberately want pitch/roll toward the target (rare — orient with
   tangent/normal vectors directly instead if you do, as the fence/walker
   code in this project already does).
10. **Local cross-section normal offsets (`pt + normal*dist`) do not
    guarantee clearance on hairpin switchbacks.** When the road curve
    loops back nearby, props and buildings offset locally along the
    cross-section normal can collide with adjacent road segments. Always
    check `clearsRoad(pos, clearanceRadius)` on roadside buildings and
    use speed-scaled lookahead arcs (`10m + speed * 0.7`) rather than fixed
    spline fractions for path following/autopilot.
11. **Rendering/performance: nothing in this project uses `THREE.LOD`,
    `THREE.InstancedMesh`, or any explicit culling — verified by grep, not
    assumed.** `createFoliageAndProps` eagerly builds one full mesh per
    prop for the *entire* route at world-gen; the only culling active is
    Three.js's default per-object frustum culling (skips draw calls, does
    nothing for CPU/memory). If prop density keeps increasing (background
    trees added for exactly this reason — see BUGFIX_LOG B24), the next
    lever is `THREE.InstancedMesh` for repeated tree/rock/pole geometry —
    native, high-leverage, low-risk — before anything custom. Don't build
    a custom streaming/culling system without first checking what the
    actual engine (confirm from `index.html`'s script tags — this project
    is plain Three.js r128, no bundler, not Roblox/Unity/Godot) already
    provides.
12. **Per-prop unique material instances (used for color variation) fight
    `InstancedMesh`'s shared-material model.** If Part 3/4-style
    instancing or material-unification work ever lands, decide how
    per-instance color works (instance color attributes, not one material
    per mesh) before migrating material types — these two changes are
    coupled, not independent.
13. **Don't touch the bloom/post-processing pipeline without full
    regression rigor.** This exact area has regressed three separate
    times (A31, A32, and the B14-adjacent vignette-banding chase). A
    "quick tweak" here has a track record of not staying quick.
14. **"Build time improved" and "render/FPS improved" are different
    budgets — verifying one says nothing about the other.** Raising the
    world floor's mesh resolution to fix a placement-accuracy gap was
    checked against one-time world-build time only, which genuinely did
    improve; it silently made the mesh 89% of the scene's per-frame
    triangle budget and cost ~17fps in real gameplay (B25). Any geometry/
    resolution change must be checked against actual per-frame cost
    (`renderer.info.render.triangles`/`.calls`, or a real FPS measurement
    over a few seconds of driving) — not just how long generation took.
15. **A per-obstacle-type overlap-prevention check must run against
    every type sharing that check's category, not just the one it was
    written for.** Delivery houses and skyscrapers both register as
    `type: 'building'`, but only delivery-house placement pruned nearby
    rocks/trees — skyscrapers (larger radius, up to ~8u) had no
    equivalent, so rocks could overlap them freely (B25). When adding a
    new prop that shares an existing `type`, check whether that type
    already has bespoke overlap-prevention logic elsewhere, and if so
    whether the new prop needs the same treatment.
16. **When placement order between two independently-scheduled loops
    (e.g. `[-1,1].forEach(side)`, where one side runs to completion
    before the other starts) makes a per-placement "prune what came
    before me" fix incomplete, don't keep chasing the exact sequencing —
    add one unconditional final sweep after everything is placed.**
    Correct by construction regardless of order, and cheap at world-gen
    time (B25's rock/skyscraper fix needed this after a placement-time
    prune closed 19/20 cases but missed a same-index cross-`side` one).

The vehicle moves with **free position + heading** (added turning,
reversing, real maneuvering — not a rail/lateral-drift model). Ground
height, banking, the fence clamp, and GPS still work off a per-frame
projection onto the nearest road point (`VehicleController.projectToRoad()`),
not a spline parameter driving position directly. If you touch vehicle
movement, re-read `BUGFIX_LOG.md` entry B17 in full first — it documents
exactly what a naive change here breaks.

`last-mile-game/dev-checks.js` is the reusable regression suite
(`runWorldChecks()`) covering most of the above — run it against the live
game after touching any of these areas, **synchronously** (paste/eval
directly; loading it via `fetch().then()` produces false-positive timing
artifacts, see `BUGFIX_LOG.md`'s "Test infrastructure" section).
