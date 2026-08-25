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
     must **not** apply banking to that Y — the terrain is unbanked, so a
     banked verge cannot sit flush against it. Only the inner road surface
     (indices 1–5) carries the banked `+0.12` slab offset. A fixed
     vertical offset at the verge floats the *entire* road above the
     terrain along its whole length, which is exactly the bug B16 fixed.
   - **Prop placement:** use the `calcTerrainY` helper inside the
     world-gen loop, which now simply delegates to `groundHeightAt()`.
     Don't reintroduce a local copy of the formula.
   - **Carve width invariant:** the flat carve half-width
     (`ROAD_WIDTH * 0.52`) must stay **≥** the road's painted half-width
     (`ROAD_WIDTH * 0.5`), and the shoulder zone (out to 9.0) must extend
     past the ribbon's outer edge (`ROAD_WIDTH * 0.5 + 1.8`). If
     `ROAD_WIDTH` or `shoulderWidth` is ever changed, re-check both.

   Guarded by `road-verge-flush-with-terrain` in `dev-checks.js`, which
   sweeps both verges along the full road and fails if any sample drifts
   more than 0.05u from the terrain surface.
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
