# Bugfix Log — Full Project History

Every bug found and fixed in this project, from the initial commit through
the current uncommitted work, across **all** contributors — multiple Claude
sessions/agents, not just this conversation. Compiled from git history
(`git log --reverse -- last-mile-game/`) plus the current uncommitted diff.

The point isn't just "what was fixed" — several fixes here exposed,
worsened, or were a repeat of a different/earlier bug, and **that
relationship is the part worth remembering** before touching this code
again. Read "Recurring bug patterns" at the bottom first if you're about to
touch terrain height, vehicle ground height, camera clamping, or
post-processing — those specific areas have each been mis-fixed more than
once.

Commit hashes are cited so you can `git show <hash>` for the full diff.

---

## Part A — Project history (chronological, oldest first)

### A1. `00e0793` — Render warnings, collision spam, chase camera, acceleration feel
- **flatShading silently dropped:** 14 materials used `MeshLambertMaterial`
  with `flatShading: true` — invalid on Lambert, ~50 console warnings/load.
  Switched to `MeshPhongMaterial`.
- **Collision spam:** pinning the car against a rock re-applied damage/cash
  penalty/sound/toast every single frame. Added an 800ms per-obstacle
  cooldown.
- **Camera:** pulled back/up and softened speed-linked FOV stretch and
  acceleration curve (0-to-top-speed went from ~2s to ~6s).
- Clamped camera above terrain so the new pulled-back position can't sink
  into a hill behind the car — **first appearance of "camera can end up
  inside terrain," see Recurring Pattern 3.**

### A2. `4a5eb16` — Vehicle rendered facing backwards
`mesh.lookAt()` was passed `position - tangent` (a point *behind* the car)
instead of `position + tangent`. Car visually drove backwards while
`splineProgress` correctly increased — a reminder that internal state being
correct doesn't mean the render is. Verified by measuring
`meshZdotTravel`/`camDotTravel` directly, not by trusting `splineProgress`.

### A3. `0cd4621` — Inverted left/right steering, GPS side text, minimap mirroring
Every "right" vector in the game actually pointed left — a `roadRight =
crossVectors(tangent, up).negate()` sign error, compounded by using local
`+X` (the model's *left* in this rig) as "carRight." Fixed at the source;
this alone corrected steering yaw, GPS `[LEFT]/[RIGHT]` text, minimap
mirroring, and parcel-toss aim simultaneously — one root cause, four visible
symptoms. **Verified by screen-space NDC projection, not internal state**
(explicitly noted in the commit: internal offsets looked self-consistent
while being mirrored on screen — see Recurring Pattern 4, same lesson this
session relearned with terrain/vignette checks).

### A4. `84ed7ba` / `2f4bd28` — Notification panel added, then repositioned
Added a persistent notification panel; first version used `position:
absolute` which placed it off-screen below the viewport. Fixed to
`position: fixed`.

### A5. `0e106f2` — Repo had two competing prototypes
`src/` (2D, never wired into `index.html`) and `game.js` (3D, the actual
shipped game) coexisted. Archived `src/` to `_archive-2d-prototype/`,
declared `game.js` the one active target.

### A6. `b156ea5` — Environmental upgrade: clouds, softer curves, terrain carving
Added `createClouds()`, softened road curve generation, and implemented the
terrain-carving embankment blend (shoulder verge 0-9m, embankment 9-45m)
that **this session's fix #A3-in-Part-B directly touched again** — see
Recurring Pattern 1, this is where that formula was born.

### A7–A11. `f7777ab`, `09dbc31`, `3fdbfd3`, `adf50a7` — HUD/responsive layout chain
Four fixes in sequence, each correcting a side effect of the previous one:
1. Menu button text overflow → added `text-overflow: ellipsis`.
2. Added full responsive breakpoints (mobile/tablet/desktop).
3. TOD/season buttons clipped past a certain count → `.dock-panel-container`
   had `overflow: hidden` with no flex-wrap on button rows. Added
   `flex-wrap` + changed container to `overflow: visible`.
4. A **tablet-only** media query re-broke #3: it set `overflow-x: auto`
   without `overflow-y`, and per CSS spec that forces `overflow-y: auto`
   too — silently re-clipping the just-fixed wrapped rows, but only in the
   tablet width range. Removed the rule entirely (flex-wrap already
   handles overflow; no scroll container needed). **Lesson also captured in
   Recurring Pattern 5: a partial CSS property override can silently
   reintroduce a bug in one specific viewport range while looking fixed
   everywhere else it was tested.**

### A12. `45eb91b` — Floating trees/rocks/houses + low-contrast clouds
- **Floating props:** `createFoliageAndProps()` had its own `calcTerrainY()`
  that was a *completely different formula* from the one actually used to
  build the terrain mesh (different road-half width, different shoulder
  threshold — 20m vs 9m — different blend curve) **despite a comment
  claiming it was "exact."** Rewrote to mirror the terrain mesh formula
  exactly, across all 12 call sites. **This is the first occurrence of the
  exact bug class this session re-fixed as `groundHeightAt()` — see
  Recurring Pattern 1.**
- **Low-contrast clouds:** `MeshLambertMaterial` is lit by scene lighting;
  at night the dim light made clouds render nearly black regardless of set
  color. Switched to unlit `MeshBasicMaterial`.

### A13. `a5b37a9` — Delivery location names mixed across cities
`CONFIG.ORDERS` was one flat list regardless of selected city (Kolkata
showed Mumbai/Bangalore landmarks). Split into `CONFIG.ORDERS_BY_CITY`.

### A14–A18. The world-floor/terrain-seam saga (5 commits, same bug class recurring)
This is the single most-repeated bug pattern in the project's history —
**read Recurring Pattern 1** for the full arc, but in commit order:

- **`8813a2d`** — Added `createWorldFloor()` (a background ground plane) to
  fix distant road loops appearing as floating islands with sky underneath.
- **`ef668ad`** — The new floor assumed the road spline stayed centered near
  the origin; it doesn't (one measured run had bounds `x:[-4139,40]`).
  Fixed to size/center off the spline's actual bounding box.
- **`fd114e7`** — The floor used raw terrain height everywhere, no awareness
  of the road's carved embankment cutting — natural terrain higher than the
  carved road bed buried the road/camera in a full-screen terrain wall.
  Added a clamp: within 200m of a road sample, cap floor height to road
  elevation minus 2m margin.
- **`3faa6ad`** — That clamp fixed burying but created a *new* artifact: a
  flat, textureless plateau wherever the clamp kicked in (a hard on/off
  binary). Changed to a smoothstep blend from the clamped value at 40m out
  to fully natural height by 200m.
- **`25f1950`** — Even with the smoothed clamp, the floor and the ribbon
  terrain used **two independently-written approximations of the same
  embankment formula**, referenced against differently-spaced road samples
  — measured a real 14–26m vertical cliff at the seam between them. Fixed
  by making the floor call the *exact same* embankment formula the ribbon
  uses (same dense 260-point sampling), so the two are continuous **by
  construction**, not by two formulas happening to agree.

**This exact same root cause (independently-duplicated height formulas
silently drifting apart) is what this session's Part B fix #3 hit again,**
except that time via an over-aggressive clamp *within* the shared formula
rather than two separate formulas. Same lesson, different specific bug.

### A19. `7f3699a` — Tree canopies "blending into hillside"
Root-caused via **raycasting the exact reported screen point** rather than
guessing — the "terrain wall" was actually a dense cluster of autumn tree
leaves whose color (`0xd97706`) exactly duplicated the terrain's
`grassLight` color. Spring and summer had the same duplicate-color bug.
Gave each season a distinct, non-overlapping tree-leaf palette.

### A20. `39e8345` — Repair-bay garage was a blank box
Added roof, door, window — cosmetic detail pass, verified by isolating the
prop in-scene and screenshotting.

### A21. `d65ce7d` — Added mini-truck traffic variant (CC0 asset)

### A22. `4341f05` — Procedural city skyline; realistic height mix; green-first trees
First skyline pass rolled height uniformly, producing "a wall of
skyscrapers." Reweighted to ~55% low-rise / ~30% mid-rise / ~15% actual
towers to read as a real Indian streetscape. Also fixed spring/summer tree
palettes mixing in unrelated hues (teal/brown/orange) that didn't read as
spring/summer foliage.

### A23. `59dbed1` — Kirana general store prop added

### A24. `30c228e` — 5 city-specific landmark monuments added

### A25. `0c3b74c` — Vehicle ground-height mismatch + camera terrain clipping
- **Vehicle:** per-frame position always used the spline **centerline**
  height regardless of `lateralOffset` (which reaches ±9m into the shoulder,
  where the terrain mesh's own formula puts ground 0.18–0.5m lower). Fixed
  vehicle Y to follow the same road/shoulder formula the terrain uses.
  **This is the first "vehicle sinks into road" fix — see Recurring Pattern
  2; this session's Part B fix #10 (road banking) is the third occurrence
  of this same symptom, different specific cause each time.**
- **Camera:** no terrain awareness at all — could end up with its (x,z)
  literally inside the double-sided terrain mesh, rendering interior faces
  that look exactly like the car being buried. Added a raw-terrain-height
  ground clamp.

### A26. `1062152` — Unified skyscraper color; tightened low-rise palette
Likely explanation for an earlier "odd colored patch behind trees" report —
random per-building color picks made stray building corners peeking through
foliage read as unexplained color blobs. Unified skyscrapers to one glass
tint; verified by querying all 28 route instances for color agreement.

### A27. `1c95e5f` — Tree density down, building/shop density up
Trees spawned on ~100% of sampled points both sides — buried urban props
under forest (measured: 1594 trees vs 66 buildings, 24:1). Rebalanced to
~45% tree spawn, increased shop/skyline frequency — result ~2.5:1.

### A28. `ac53bf3` — Camera snapped to top-down view on hills
The ground-clip clamp added in A25 (by the user directly, outside a Claude
session, per the commit) referenced **raw, un-carved terrain height** — but
the road is deliberately carved *below* raw terrain on hills, so near any
hill this clamp yanked the camera up to the hillside's raw height instead
of the road-relative height. **Second occurrence of a camera/terrain clamp
bug (see A1, A25) — this time the clamp itself used the wrong height
source.** Fixed to reference the vehicle's own (correctly carved) position
instead. Measured the old bug's trigger rate directly: 94/801 sampled
points, jumps up to 13.2m.

### A29. `7a4e48a` — Replaced boxy player vehicles with sculpted CC0 meshes
Also fixed a z-fighting bug on the mini-truck (rear flap board/taillights
nearly coincident with the cargo bed's rear face).

### A30. `76b2d30` — Building foundation slab added
Flat-bottomed building boxes on sloped hillsides cut diagonally across the
slope — buried on the downhill side, visible gap/overhang on the uphill
side. Added a 16m-tall foundation slab extending underground from every
building's base, unconditionally bridging any local slope angle rather than
trying to conform geometry to the terrain footprint.

### A31. `dc8bc84` — PBR materials + post-processing pipeline (bloom/FXAA/vignette)
Swapped flat Lambert/Phong for PBR `MeshStandardMaterial` with a procedural
env map; added tileable canvas textures; added the `EffectComposer`
pipeline this session spent significant time on (Part B). Two bugs fixed in
the same commit:
- SSAO produced full-screen dithering noise (**including on the sky** — an
  early ancestor of the banding class of bug this session chased) once the
  composer dropped the renderer's own MSAA. Replaced with FXAA.
- Skyscraper window-glow materials had `emissiveIntensity` hardcoded on at
  all times of day, blowing out under bloom in daylight. Gated by
  time-of-day, matching the existing headlight pattern.

### A32. `f9c40db` — Large collaborative batch (this project's most recent commit)
This single commit already contains most of what's described in Part B
below — it was committed mid-session by a concurrent agent, capturing
collaborative work from **both** that session and this conversation up to
that point. Contents, for completeness (all verified working at commit
time):

**Gameplay additions:**
- Pedestrian/dog/cat road crossers; wanted meter (hit them → fine/jail at
  max, instead of instant fail)
- Two-wheelers spill and end their run on high-speed pothole hits
- Continuous split-rail fencing along both shoulders, gapped only at
  delivery houses, doubling as a real driving boundary
- Delivery status panel (`V` key / STATUS button)
- Pothole size now varies per-instance (damage/spill-threshold scale with it)
- Traffic now genuinely drives both directions (was one-way)

**World-gen fixes:**
- Delivery hit-test targets the porch ring's actual position, not the
  house pivot (see Part B #1 below — same fix, documented in more depth
  there since it's this session's own investigation)
- Buildings/trees/fences no longer land on the road surface at hairpins
- Removed an over-aggressive terrain clamp burying buildings/vehicles in
  hillsides (**the terrain-seam saga, Recurring Pattern 1, recurring yet
  again**)
- Rocks no longer spawn overlapping delivery houses
- Fence rail orientation fixed + shortened to hug curves/slopes
- Removed yellow lane-divider paint that blew out into glowing blobs under
  bloom (**third occurrence of the "bloom blowout" bug class — see A31's
  emissive fix and this session's own vignette-banding chase; bloom
  threshold/luminance interactions have now bitten this project three
  separate times**)

**Vehicle/gameplay logic fixes:**
- Missed/timed-out deliveries marked resolved (Part B #4)
- Checkpoint rollback restores delivery-target state, not just order index
  (Part B #5)
- Autodrive no longer leaves stale lateral velocity dragging the car
  sideways on resume
- Vehicle height accounts for road banking (Part B #10 — **third
  occurrence of "vehicle sinks/floats relative to road," see Recurring
  Pattern 2, joining A12 and A25**)
- GPS label correctly says BEHIND instead of always AHEAD

**HUD/responsive fixes:**
- Dispatch card / radio bar no longer overlap at any tested width
  (375–1920px) — both were previously unbounded width (**same bug class as
  A7–A11's responsive-layout chain**)
- Radar/telemetry boxes no longer collide with dock bar
- Dock bar no longer clips its rightmost button
- Dispatch-hub menu card now actually centered
- Wanted-meter box no longer overlaps dispatch card (was a hardcoded height
  assumption; now real document-flow stacking)

**Infra:** `dev-checks.js` added as a reusable `runWorldChecks()` regression
suite.

---

## Part B — This conversation's work (in depth, causal chains included)

Everything below either predates `f9c40db` being committed (so it's folded
into A32 above, but documented here with the full investigation trail) or
is still uncommitted on top of it.

### B1. Delivery hit-test used house pivot instead of the visible drop point
Already summarized in A32. Full detail: `deliveryTargets.push()` stored
`pos: housePos` (the house's pivot), but the visible glowing porch ring is
offset ~3.2 units from that pivot and rotated per-house
(`cabinGroup.lookAt(pt)`). Fixed to store `ring.getWorldPosition()`.
Verified via `dev-checks.js` (`delivery-target-is-ring-not-pivot`, 0.00u).

### B2. Buildings/trees placed on a *different* stretch of road at hairpins
Objects are offset from a single road sample point along that point's local
normal — safe on a straight stretch, but the road is a winding spline, and
at a hairpin that "safe" 34–78m offset can land on a different, closer
segment. Added `clearsRoad()`: check the *entire* sampled curve, not just
the local point, before committing to a position. Verified: 0 violations
across 256+ buildings, 600+ trees.

### B3. Terrain height clamped near the road → false cliff/seam (Recurring Pattern 1, latest recurrence)
Three duplicated copies of the embankment formula (`createTerrainMesh`,
`createWorldFloor`, `calcTerrainY`) all applied `Math.min(roadHeight+0.2,
embankmentHeight)` all the way out to 40–45m — flattening real hillside
terrain that's legitimately 10–14 units taller than the road there.
Removed the ceiling in all three; the lerp from `shoulderDrop` to `rawH`
already guarantees safety near the road without an artificial cap.

**⚠️ This fix is what exposed B2** — buildings that used to be invisibly
buried by the clamp became visible at full height, turning a pre-existing
placement bug from "hidden" into "a tower standing in the road." When a
clamp/cap is removed, re-audit anything it was silently hiding.

### B4. Missed/timed-out deliveries stayed "live" forever
`updateOrderTimer()`'s timeout branch advanced `activeOrderIndex` but never
marked the missed house `delivered`. That stale entry could out-compete the
player's real current target in the "nearest undelivered" search (used by
both the HUD arrow and the actual toss hit-test) on the winding/looping
road. Fixed: mark `deliveryTargets[activeOrderIndex]` delivered on timeout.

### B5. Checkpoint rollback desynced order index from delivered state
3rd-breakdown rollback restored `activeOrderIndex` but not
`deliveryTargets[].delivered` (permanent once set) — houses resolved after
the checkpoint stayed marked delivered even after the index rewound past
them. Fixed: checkpoints now snapshot/restore `delivered` flags too.

### B6. Crossers sank through the road on curves/slopes
Walk animation linearly interpolated **height** between the crossing's
start/end points — on a curved/sloped stretch that straight-line
approximation cuts through the real (curved) surface. Extracted
`World.groundHeightAt()` as a shared, reusable formula; crossers now
recompute height every frame from their actual current position instead of
lerping between two stored endpoint heights.

### B7. Fence rail oriented across the road instead of alongside it
`fenceGroup.lookAt(fencePos + tangent)` — but the rail is built along local
**X**. `Object3D.lookAt` points local **-Z** at the target; targeting along
`tangent` puts local X along the road's **normal** instead, sending the
rail across the road. Fixed: target `fencePos + normal`.

### B8. Fence segments spanned ~25m as one rigid flat plank (Recurring Pattern 2 preview — see below)
First attempt made fences continuous at `FENCE_STEP=4` (~25m spacing) —
fixed sparseness but each segment, leveled only at its center, was far too
long to stay flush with a curving/sloping road (visibly chorded across
bends). Corrected to `FENCE_STEP=1` (~6.2m, matching the road/terrain
mesh's own sampling resolution). Verified: 0.00u end-to-center gap across
480+ sampled endpoints.

### B9. Rocks spawned with zero overlap check, landing on delivery houses
Unlike most props (gated to `i % N` checkpoints), rocks ran on **every**
sampled point with no overlap check — including the exact `i % 24 === 0`
checkpoint a house spawns on, and rocks run *before* the house block in the
same iteration, so even an `obstacles` overlap check wouldn't have caught
it (house isn't registered yet). Fixed via the same house-checkpoint
proximity math the fence gap uses (order-independent) plus a general
obstacle overlap check. Verified: 0/510 overlaps.

### B10. Vehicle sank into / floated above the road on banked curves (third occurrence, Recurring Pattern 2)
`createRoadMesh` banks the road surface on curves (up to ±0.14 rad), but the
vehicle's ground-height formula only ever used the flat unbanked centerline.
Replicated the same banking calculation `createRoadMesh` uses and applied
its vertical contribution at the car's actual lateral offset. Verified:
0.000u gap between the two independently-computed formulas.

### B11. Dogs too small; crossers/animals added as a new feature
Added pedestrian/dog/cat crossers + wanted meter. Dogs initially too small
(`scale = 1.0`, same rig as pedestrians whose torso alone is 0.62 tall) —
bumped to 1.7.

### B12. Not a code bug: browser showed unstyled raw HTML
A temporary local test server was killed for cleanup while the browser tab
was still pointed at it. Repointing the tab fixed it immediately —
documented only because it looked identical to a real render failure.

### B13. Vignette not aspect-corrected → "fix" made it worse (Recurring Pattern 4)
Vignette used raw UV coordinates without aspect correction, stretching into
an ellipse on wide viewports. Added `uv.x *= aspect` to make it a true
physical circle — **but on an ultra-wide window, a true physical circle has
to anchor to the shorter (height) dimension, so the left/right thirds fall
outside it and get hit with much heavier darkening than before.**
Geometrically more correct, visually worse for this project's actual
viewports. **Reverted.**

### B14. The actual "rainbow arc with layers": sky dome vertex-color banding (Recurring Pattern 1's sibling — same lesson, different subsystem)
Reported as banded "layers," confirmed **identical across devices** — the
load-bearing clue that ruled out GPU-driver dithering and pointed at a
deterministic math/precision artifact.

- **Dead end (documented so it isn't repeated):** first theorized this was
  8-bit quantization of the vignette's multiply against a flat sky color;
  added a dither term to the vignette shader. Real, legitimate minor fix —
  not the cause of what was reported.
- **Actual root cause:** `createSkyDome()` computed sky color as **vertex
  colors** on a sphere with only 24 rings, Gouraud-interpolated per face.
  Every ring boundary is a visible kink, worst on wide-gamut gradients
  (Dawn's purple→orange→yellow, Day's saturated blue), invisible on
  Night/Dusk's dark low-saturation colors — exactly the reported pattern.
- **First fix attempt (insufficient):** quadrupled ring density (24→64).
  Reduced but did not eliminate banding for Dawn — confirmed by direct
  pixel sampling (2–5 hard jumps still present across a clean 370-sample
  scan). **Same mistake as B8: scaling up a discrete sample count instead
  of fixing the underlying discreteness.**
- **Actual fix:** replaced the vertex-colored `MeshBasicMaterial` with a
  `ShaderMaterial` computing the identical gradient **per-pixel** — zero
  geometry-resolution dependency — plus a hash-dither term on the final
  8-bit write.
- **Verified:** direct canvas pixel sampling, not screenshots — a sky
  column clear of clouds/buildings showed **zero** hard jumps across 370
  samples; jumps in other columns matched real cloud/skyline silhouette
  edges. Confirmed visually for both Dawn and Day.

### B15. Driveways connecting the road to each delivery house (feature)
Added a dirt path strip from the road shoulder to each house's porch,
sampled at multiple points along its length **so it follows the terrain
instead of being one rigid flat plank — applying B8's lesson up front this
time**, rather than needing a second pass. Verified: 33/33 driveways match
33/33 delivery houses, 0 endpoint mismatches.

### B16. On-foot delivery for car/truck (feature)
Added a second traversal mode: `E` parks the car and drops the player into
a free-position/heading walking avatar (WASD move/turn, third-person
follow camera); `SPACE` near the porch completes the delivery; `E` again
warps back to the parked vehicle. Grants a one-time `+22s` timer bonus per
order so walking doesn't eat into the time-pressure mechanic. Two-wheelers
are explicitly excluded (design decision — they always toss from the
saddle instead). The reward/notification/history logic was factored out of
`updateParcels()`'s parcel-hit branch into a shared `fulfillDelivery()`
method so the vehicle-toss and on-foot paths can't independently drift
apart (pre-empting a Pattern-1-style duplication before it could start).
Walker ground height is computed via `World.groundHeightAt()`, not a new
formula. Verified end-to-end: E toggles correctly (blocked for scooter/
cycle, requires the vehicle to be stopped), timer bonus applies once per
order, on-foot delivery pays out and updates history/HUD identically to a
vehicle toss, and returning to the vehicle cleanly restores driving
(vehicle physics/breakdown/off-road-lost detection correctly frozen while
on foot instead of firing against a deliberately parked car).

### B17. Vehicle movement replaced: free position + heading, not a rail (major architecture change)
**Context:** the vehicle previously moved on rails —
`splineProgress` (0–1 position along the road curve) plus `lateralOffset`
(a ±9m sideways drift band) *were* the position; steering only ever
adjusted `lateralOffset`, never a true heading. This is why the car could
never actually turn, reverse into a driveway, or drive in a circle — there
was no heading/orientation state independent of the road curve to turn
toward. Confirmed directly comparable to (and less capable than) the
on-foot walker added in B16, which already had free position + heading.
User explicitly chose "full replacement everywhere" over a
driveway-local-only maneuvering mode, given the size/risk tradeoff — see
the conversation for the framing.

**What changed:** `VehicleController` now has `this.heading` (true,
independent world-space yaw) and moves via
`position += forward(heading) * speed * dt`, exactly like the walker.
Steering (A/D) now rotates `heading` directly, with turn rate scaled by
speed (capped, with a minimum so low-speed/parking turns still work) and
**inverted in reverse** (matches how a real car's steering feels backing
up — confirmed by test). `lateralOffset`/`lateralVelocity` are kept as
fields (some external code still reads `lateralOffset` for the stuck-
detection check) but are now *derived* each frame from projecting the
car's free position onto the nearest point on the road curve — not the
thing driving movement anymore.

**The road-relative systems didn't go away, they got a projection step
instead.** Ground height, banking, the fence lateral clamp, and GPS/camera
all still need "where is the car relative to the road" — added
`VehicleController.projectToRoad()`, a cheap windowed nearest-point search
seeded from the last known `splineProgress` (falls back to a full scan
only if the car is far off-route), used to recompute `pt`/`tangent`/
`normal`/`latDist` every frame. `groundHeightAt()` (the shared formula from
B6/Pattern 1) is called with those projected values — no new height
formula was invented for this.

**Autopilot rewritten:** the old approach ("lerp lateralOffset toward 0")
made no sense for a car with real heading. Replaced with simple pure-
pursuit: aim heading at a lookahead point further along the curve, turn
toward it at a capped rate. Verified stable over a clean 30-second run
(never drifted more than ~6m from the road) and did not reproduce the
freeze bug below.

**Bug found and fixed during this rewrite — read this before touching the
fence clamp again:** the first version of the lateral fence clamp, on
contact, snapped the car's position straight to
`nearestRoadPoint + normal * clampDistance` — discarding the FORWARD
(along-road) component of the attempted move entirely. If the car's
heading pointed mostly *sideways* into a fence (plausible under autopilot
correction, or just cornering tight against the shoulder), every single
frame reset to nearly the same clamped spot with ~0 net progress despite
full nonzero speed — not a slow crawl, a **stable feedback loop**, since
`projectToRoad`'s nearest-point search was reseeded from that same frozen
position each frame. Reproduced directly: heading aimed dead-on at the
fence, full throttle, zero steering input — position genuinely froze
solid for the full test duration. Fixed by decomposing the attempted move
into its along-road (tangent) and lateral (normal) components relative to
the nearest road point, and clamping **only** the lateral one — the car
now slides along a fence like a real wall (confirmed: still makes ~5.5
units of forward progress per second even at a dead-on collision angle)
instead of freezing against it.

**Verified:**
- Direct physics trace: heading genuinely rotates independent of the road
  (0 → 0.73 rad in 1s under sustained turn input) and the car traced
  multiple full physical circles (heading advanced 10.54 rad ≈ 1.68 full
  rotations over 8.3s of continuous throttle+turn, position spiraling
  outward as speed increased) — the literal thing that was asked for.
- Reverse steering confirmed inverted relative to forward steering.
- Autopilot: clean 30-second run with no freeze; targeted worst-case
  stress test (heading aimed directly at a fence, full throttle, no
  steering) confirmed sliding, not freezing.
- Full `dev-checks.js` suite re-run after the rewrite: all 16 checks pass,
  including `vehicle-y-matches-banked-road` (0.000u — banking/height still
  correct through the new projection step) and `gps-ahead-behind-correct`
  (still correct, since it reads `mesh.quaternion`, which is now driven
  directly by `heading`).
- New permanent check added: `vehicle-slides-not-freezes-on-fence`,
  reproducing the exact worst-case freeze scenario above so this specific
  regression can't silently return.

### B18. Follow-up commit `6f8d0b9` — fixes to B16/B17, plus 7 unrelated lookAt-tilt bugs
Committed directly by the project owner (with a Claude co-author) on top of
B16/B17 above, before this entry was written — a reminder of why logging
every commit matters even when it isn't this session doing the committing.
Reviewed in full and confirmed correct; `dev-checks.js` re-run against the
merged result, 17/17 pass.

- **Walker spawning inside the car roof (bug in B16's `toggleOnFoot()`):**
  the walker mesh was placed at the vehicle's own origin — car-body/seat
  height, not ground level, since the walker's local origin is ground-
  level but the car's isn't. Fixed to step out to the driver's side (like
  exiting through the door) and snap to real ground height via
  `groundHeightAt()`, the same formula `updateWalking()` uses every frame.
- **Vehicle height stair-stepping (precision bug in B17's `projectToRoad()`):**
  the 24-step coarse nearest-point search only resolved road position (`u`)
  to ~3m increments. Ground height is sampled directly off `pt.y` at
  whatever `u` gets returned, and `pt.y` varies continuously with `u` on
  any grade — so height was snapping between coarse samples instead of
  varying smoothly, visible as the car bouncing up and down even on flat
  terrain. Fixed by adding a 4-pass shrinking refinement search after the
  coarse scan (each pass narrows the window ~3.3x). Verified via direct
  position sampling that height now changes smoothly frame-to-frame
  instead of holding flat for several frames then jumping.
- **Camera occlusion fade (new feature):** thin roadside props (poles,
  lampposts — tracked in a new `world.occluderMeshes` array, separate from
  `obstacles` since that only stores position/radius, not the actual mesh)
  now fade toward transparent when a raycast from camera to the on-foot
  courier hits one, instead of visibly clipping through the character.
- **lookAt() tilt on 7 roadside props (pre-existing, unrelated to B16/B17):**
  delivery cabin, garage bay, milestone stone, streetlamp, bus shelter,
  tapri stall, kirana shop, and monument all called `group.lookAt(pt)`
  without flattening `pt`'s Y to the prop's own height first. On sloped
  terrain (where `pt.y` and the prop's own Y differ, which is most of the
  time on this hilly terrain), an un-flattened `lookAt()` doesn't just yaw
  the object toward the road — it pitches and rolls it too, tilting the
  whole roof/walls off-vertical. Fixed by changing all seven to
  `group.lookAt(pt.x, propOwnY, pt.z)`, flattening the target so only yaw
  is applied. **This is a new, 8th confirmed occurrence of the "lookAt
  without flattening Y tilts the whole object" bug shape** — the on-foot
  walker's own orientation code and the fence orientation fix earlier this
  session were careful to avoid it, but this shows the mistake is easy to
  make fresh in new code; see Pattern 8 below.

No new `dev-checks.js` checks were added for these four fixes in this
commit — worth adding on a future pass (a numeric check for "prop roof
stays level regardless of local terrain slope" would have caught the
lookAt-tilt bug directly, the same way `fence-ends-flush-with-center`
catches the analogous fence problem).

### B16. Road ribbon floated ~0.32u above the terrain along its ENTIRE length (Recurring Pattern 1, latest recurrence)

**Confirmed scope: global, not isolated.** Reported from screenshots as a
continuous dark sliver / exposed terrain strip running the full length of
the road. Verified numerically before changing anything: sampling the road
mesh's outer verge vertices against `groundHeightAt` at the same lateral
distance gave a **mean gap of 0.323u across the whole 1201-row road, both
sides, on straights, curves and grades alike** (max 0.766u on banked
curves). Re-measured on a second, independently generated world seed:
worst 1.0857u. This was never a per-instance placement mistake.

**Root cause.** `createRoadMesh` built its 7-point cross-section by
offsetting every vertex from the spline point by a *fixed* vertical amount
— `p.addScaledVector(bankedUp, isVerge ? 0.04 : 0.12)`. The inner road
surface being 0.12 above `pt.y` is correct and intentional (slab
thickness over a terrain that's carved to `pt.y - 0.18` under the
asphalt). But the *outer verge* used the same fixed-offset idea, landing
at `pt.y + 0.04`, while the terrain ribbon at that lateral distance
(`ROAD_WIDTH*0.5 + 1.8 = 5.5`) is on its shoulder slope at
`pt.y - 0.18 - t*0.32` ≈ `pt.y - 0.283`. Two heights for the same place,
derived from two different rules — the ribbon simply ended in mid-air
0.32u up, and because the road mesh is a surface strip with no side
walls, that step read as a continuous gap down both shoulders everywhere.

**Fix.** The verge vertices now take their Y from the shared
`groundHeightAt()` rather than a fixed offset, so road and terrain meet
flush *by construction* on every stretch, including any added later.
Banking is deliberately not applied at the verge: the terrain is unbanked,
so the edge must meet it at unbanked height. The road surface keeps its
banked +0.12. Net effect is that the ribbon now ramps down across its 1.8m
shoulder into the ground, which is also what a real road shoulder does.

**Also collapsed the duplicate that made this class of bug possible.**
`calcTerrainY` (the prop-placement height helper used by ~16 call sites —
signs, poles, buildings, fences, houses, rocks, monuments…) was a
hand-written copy of `groundHeightAt` that matched it branch-for-branch.
It now delegates to `groundHeightAt`. Per Pattern 1 this is the exact
duplication that has broken this project seven times; there is now one
height function and everything derives from it.

**Carve width vs road width (checked, no change needed):** the flat carve
half-width is `ROAD_WIDTH*0.52 = 3.848`, the road's painted half-width is
`ROAD_WIDTH*0.5 = 3.7`, so the carve already slightly exceeds the road
(by 0.148) and the shoulder slope zone runs out to 9.0, comfortably past
the ribbon's 5.5 outer edge. These were never out of sync.

**Verified after fix:** worst verge-vs-terrain gap **0.0084u** (mean
0.0017u) across 242 samples spanning the entire road — down from 0.323
mean / 0.766 max. Zero samples above 0.05. Visually confirmed flush on a
straight (u=0.815), a curve (u=0.635) and a slope (u=0.860), chosen by
measuring curvature/grade rather than by eye. All 17 pre-existing
`dev-checks.js` checks still pass.

**New regression guard:** `road-verge-flush-with-terrain` in
`dev-checks.js` sweeps both verges along the full road. Its sensitivity
was proved rather than assumed — reintroducing the old +0.323 offset
in-memory drove it to FAIL at 0.3309u, and restoring returned it to PASS.

### B17. B16 was only half a fix — the seam came back as a ragged tear

**B16 traded a gap for a z-fight, and its check couldn't see the
difference.** After B16 the road no longer floated, but the seam still
tore visibly — a sawtooth notching along the shoulder. B16's guard passed
at 0.0084u throughout, because **it compared the road verge against the
`groundHeightAt()` function rather than against the terrain mesh's actual
rendered geometry.** Two meshes can both call the same formula and still
not touch.

**Root causes (three, all "same formula, different geometry"):**
1. **Different longitudinal sampling.** `createRoadMesh` used
   `getSpacedPoints(1200)`, `createTerrainMesh` used `getSpacedPoints(800)`.
   The two ribbons evaluated the same height function at *different points
   along the curve*, so they coincided only where samples happened to line
   up and diverged in between. This is precisely the A14–A18 (`25f1950`)
   lesson — "referenced against differently-spaced road samples" — which
   B16 reintroduced in a new place.
2. **No terrain vertex at the road's edge.** The road ribbon's outer edge
   sits at `ROAD_WIDTH*0.5 + 1.8 = 5.5`, but the terrain's lateral slices
   ran `… −9.0, −roadHalf, roadHalf, 9.0 …` with nothing at 5.5, so the
   road edge landed mid-triangle on a 5.15m-wide span.
3. **Banked vs unbanked offset direction.** The verge was offset along
   `bankedNormal` while the terrain offsets along the plain `normal`, so on
   every banked curve the two edges weren't even on the same 3D line.

Measured against the rendered mesh (raycast, not formula): **94.6% of the
verge sat within ±5mm of the terrain — inside the z-fighting band — and
34 of 801 samples had terrain poking *above* the road.** That is the
sawtooth.

**Fix.** Made the two ribbons agree by construction, then lifted the road
off the ground so it wins the depth test deterministically:
- `CONFIG.ROAD_MESH_SEGMENTS` (1200) now drives **both** meshes.
- `CONFIG.ROAD_SHOULDER_WIDTH` (1.8) is shared, and the terrain carries
  lateral slices at exactly `±(ROAD_WIDTH*0.5 + ROAD_SHOULDER_WIDTH)`.
- The verge offsets along the **unbanked** normal, matching the terrain.
- `CONFIG.ROAD_VERGE_LIFT` (0.02) raises the verge 2cm. Coplanar is a bug,
  not a goal: a road slab rests *on* the ground.

**Verified:** terrain-above-road **0.0000u** and road-above-terrain exactly
**0.0200u** across 344 raycast samples — the gap is now *precisely* the
intended epsilon everywhere, which only happens if the meshes agree
exactly. Same on Pune (steepest/most winding). Visually clean at grazing
angles on the sharpest curve and steepest grade.

**Lesson (added to Pattern 1):** verifying a geometry fix against the
*formula* proves nothing about the *rendered surface*. Raycast the actual
mesh. And when two meshes must meet, matching the formula is not enough —
they must share sampling rate, share a vertex row at the seam, and share
the offset basis.

⚠️ **Pre-existing, unrelated failures found while verifying** (both
reproduced identically against committed HEAD in an isolated copy, on the
same city/seed, so neither is caused by B16/B17):
- `rocks-clear-of-houses` on Pune: 2 overlaps, worst −5.13u.
- 
`crosser-height-matches-formula` reports a stable 0.232u drift. It is
**not** the documented flaky false-positive (that varies run to run; this
is bit-identical across 5 runs) and it is **not** caused by this fix —
confirmed by running the same check against committed HEAD in an isolated

### B19. World floor 40m/45m cliff, spatial hash world-gen optimization, and vehicle banking interpolation

- **Symptom 1 (World floor cliff / floating buildings):** Buildings and roadside props sitting ~40.7m off-road were floating or sinking by up to 27.3u on hillsides.
  * **Root cause:** `createWorldFloor` used a hardcoded `RIBBON_COVERAGE = 40.0` to decide when floor vertices hide under the road ribbon, whereas `createTerrainMesh` and `groundHeightAt()` cover out to `45.0` (`EMBANKMENT_BLEND = 45.0`). Vertices in the 40–45m band switched to uncarved raw terrain height while props were placed at carved height, creating a cliff of dozens of units at the boundary.
  * **Fix:** Updated `RIBBON_COVERAGE` to `45.0` in `createWorldFloor`, matching the ribbon's actual width and `groundHeightAt()`.
- **Symptom 2 (World generation lag spike):** Switching `createWorldFloor` to sample all 1200 road points caused a +540ms (+63%) world-build freeze (~140M distance checks across 117k vertices).
  * **Fix:** Implemented a 50m spatial hash grid over `roadSamples` with a 3x3 cell neighborhood (150x150m) search ring and fallback.
- **Symptom 3 (Vehicle road banking stair-step sink on curves):** The vehicle sank by up to ~0.35u on sharp curves.
  * **Root cause:** Vehicle banking used `curve.getTangentAt()`, whose parametric derivative diverged from the finite differences of the rendered mesh points array (`world.roadSpacedPoints`), compounded by row quantization.
  * **Fix:** Evaluated banking directly from `world.roadSpacedPoints` with linear interpolation between bracketing rows.
- **New regression guards:** Added `embankment-mesh-matches-formula` and `vehicle-y-flush-with-road-mesh-while-driving` in `dev-checks.js`.

### B20. Pune rock-on-house overlap and crosser initial spawn height drift

- **Symptom 1 (`rocks-clear-of-houses` failure on Pune):** `dev-checks.js` reported 2 overlaps (worst −5.13u) between rocks and delivery houses on Pune.
  * **Root cause:** Rocks spawn earlier in the foliage loop before houses are registered into `this.obstacles`, and on steep terrain / winding roads like Pune, obstacle positions from adjacent switchback sections could land within a house footprint.
  * **Fix:** Added active footprint overlap filtering when spawning delivery houses (`this.obstacles = this.obstacles.filter(...)`), pruning any pre-existing overlapping rock or tree obstacles within the house clearance radius.
- **Symptom 2 (`crosser-height-matches-formula` stable 0.232u drift):** `dev-checks.js` reported a constant ~0.232u drift on crosser heights upon scene initialization.
  * **Root cause:** When crossers were spawned, their mesh was positioned at `startPos` (`progress = 0`), but their state object initialized `progress` with a random stagger `this.prng.next() * 0.3`. On the initial frame before `updateCrossers()` ticked, the mesh sat at `startPos` while `dev-checks.js` evaluated expected height using `c.progress`, producing an immediate mismatch.
  * **Fix:** Placed crosser meshes directly at their initial staggered progress position with matched `groundHeightAt()` and flattened yaw orientation at spawn.

### B21. Building/Rock clearances, skyscraper hillside foundations, and curve-adaptive autopilot steering

- **Symptom 1 (`buildings-clear-of-road` failure on dense routes):** 1/243 buildings overlapped the road near tight hairpins / switchbacks.
  * **Root cause:** Roadside bus shelters, chai tapris, kirana stores, and landmark monuments were placed using local cross-section normal offsets without calling `clearsRoad()` against non-local road spline curves that double back nearby.
  * **Fix:** Added `clearsRoad(pos, clearanceRadius)` checks across all roadside building types, preventing hairpin overlaps. Fixed typo in tapri customer head material referencing `skinMat` instead of `pSkin`.
- **Symptom 2 (`rocks-clear-of-houses` overlap):** Rocks spawned within delivery house footprints.
  * **Root cause:** Rocks spawn continuously along every curve segment before delivery houses are placed at `i % 24 == 0`. The single-side checkpoint skip failed on winding switchbacks where adjacent curve segments looped into the house yard, and obstacle filtering did not remove the actual 3D mesh instances.
  * **Fix:** Expanded the rock-to-house exclusion zone to 14.0m, and when placing delivery houses, pruned overlapping obstacles from `this.obstacles` while removing their 3D meshes from `foliageGroup`.
- **Symptom 3 (Skyscraper floating foundations on steep hillsides):** On steep hillsides, the uphill or downhill corner of tall buildings showed exposed gaps beneath the 16m foundation box.
  * **Root cause:** A 16m foundation (8m below terrain anchor) was insufficient on hillsides where terrain elevation changes >15m across the building footprint.
  * **Fix:** Deepened skyscraper foundation boxes to 60m height (`y = -30m`), completely submerging foundation bases on any mountain slope.
- **Symptom 4 (Autopilot spin-out on sharp turns/hairpins):** Vehicle spun out or steered off-course when Autopilot was engaged on sharp bends.
  * **Root cause:** Autopilot used a fixed `lookaheadU = this.splineProgress + 0.012` (~60m). On hairpins, the 3D target point 60m down the curve physically lay behind or sideways across the loop from the car. Autopilot also lacked cornering deceleration.
### B22. Multi-Language Radio Selection (Hindi & English) with Soothing Synthesizer & Authentic MP3s (feature)

- **Symptom / Requirement:**
  * The radio player previously only had a flat list of 10 Hindi/90s Bollywood tracks hardcoded in `SoundEngine.realTracks`.
  * The generic default synthesizer produced alarming, harsh raw triangle blips that were fatiguing to listen to during relaxed driving.
  * Needed a multi-language channel selector ("DHABA FM" for Hindi, "HIGHWAY FM" for English, "ALL FM" for Mix), keyboard shortcut (`L`), clickable HUD pill button, clean metadata `{ title, artist, era, language }` with localStorage preference persistence, pure authentic MP3 streaming for Hindi, and an ear-soothing musical synthesizer for hit English road trip anthems.
- **Implementation & Mechanisms:**
  * **Hindi Channel (Dhaba FM)**: Strictly contains all 49 authentic direct MP3 highway classics hosted on `truckplaylist.com` CDN (no synthetic filler or placeholder tracks).
  * **English Channel (Highway FM)**: Implemented polyphonic chill arrangements of iconic hit road-trip songs (*Hotel California*, *Clocks*, *Careless Whisper*, *Boulevard of Broken Dreams*, *Counting Stars*, *Take On Me*).
  * **Soothing Instrument Rig**: Replaced harsh raw oscillators with an analog-modeled warm Rhodes / Electric Piano synthesizer:
    * Master warm `lowpass` `BiquadFilterNode` (1050 Hz cutoff, Q: 0.8) to eliminate harsh/alarming high frequencies.
    * Dual-oscillator voice (fundamental sine + detuned triangle chorus) with soft ADSR envelopes (gentle 35ms attack, warm decay/sustain, smooth 450ms release).
    * Sub-frequency bassline notes and warm chord voicings.
  * Added `switchChannel(channel)`, `cycleChannel()`, and `getChannelDisplayName()` to `SoundEngine`, maintaining `this.realTracks` as a computed getter pointing to `this.activePlaylist` for full backwards compatibility.
  * Added `btn-radio-channel` to the HUD radio pill in `index.html` and styled it with glassmorphism + saffron accents and pulse/flash animation in `style.css`.
  * Added `L` keyboard shortcut in `game.js` key handler and `cycleRadioChannel()` method on `Game` class.
  * Persisted selected channel to `localStorage.getItem('shiplyp_radio_channel')`.
- **Verification:**
  * Executed the synchronous regression test suite `runWorldChecks()` in `dev-checks.js` against the live engine: **20/20 world checks passed with zero regressions** (buildings/trees clear of road, terrain seam continuity, raycast road verge flushness, embankment formula agreement, vehicle Y pavement contact, fence geometry/clearances, crosser heights, rock/house clearances, GPS navigation, autodrive toggle lateral velocity reset, and fence slide response).
  * Verified 49 authentic streamable Hindi MP3 tracks + 6 soothing polyphonic English arrangements.
  * Verified mathematical `noteToFreq` frequency converter across all semitones/octaves (0 note parsing errors).
  * Verified channel cycling (`DHABA FM` [49 tracks] -> `HIGHWAY FM` [6 tracks] -> `ALL FM` [55 tracks] -> `DHABA FM`), `L` keybinding, HUD display formatting `${title} — ${artist} (${era})`, and auto-resume logic.

### B23. Highway FM Synth Radio Rapid Skip Infinite Loop & AudioContext Initialization Fix
- **Symptom:** Selecting Highway FM (English channel) or switching tracks caused the radio title to cycle continuously and endlessly through all tracks without playing any audio.
- **Root Cause:**
  1. `_playCurrentTrack()` set `this.audioEl.src = ''` when playing a synth track (`isSynth: true`). Setting the `<audio>` element's `src` to an empty string triggers a browser `error` event.
  2. The `audioEl.addEventListener('error', ...)` handler caught this event and unconditionally executed `this.nextTrack()`, which loaded the next synth track, set `audioEl.src = ''` again, and fired another error event in an endless rapid cycle.
  3. `startSynthRadio()` only started playing after the first interval tick (`setInterval`) rather than triggering the first chord/melody step immediately, and did not guarantee `this.ensure()` had resumed an idle `AudioContext`.
- **Fix:**
  1. Updated `audioEl.addEventListener('error', ...)` to verify that the active track actually has a remote MP3 `url` (`trk.url && this.audioEl.src.startsWith('http')`) before auto-skipping.
  2. Removed `this.audioEl.src = ''` from `_playCurrentTrack()` (relying on `this.audioEl.pause()` instead) so the media element never fires empty-source error events.
  3. Updated `startSynthRadio()` to invoke `this.ensure()`, execute `step()` immediately on start, and enhanced `playSoothingNote()` with gentle ADSR envelopes and detuned analog chorus.
- **Verification:**
  * Verified via JavaScriptCore and browser execution that Highway FM immediately plays tracks without skipping.
  * Verified all 6 English synth arrangements play notes cleanly without error events.
  * Re-verified `runWorldChecks()` in `dev-checks.js` with **20/20 world regression checks passing**.

### B24. B19's floor fix was incomplete — round 2, plus background tree density and a Part 3/4 rendering investigation

Triggered by a user report of floating props/pavement persisting after B19,
with an explicit request to determine whether it was **the same root cause
as B19 (incomplete fix) or a genuinely new one** before touching anything.
Finding: **same root cause family, B19's fix was correct but insufficient
in two distinct ways it didn't address.**

- **Symptom 1 (floor still floats/buries near the 40-45m boundary, up to
  ~38u even after B19):** B19 moved `createWorldFloor`'s hard buried/natural
  switch from `dist<=40` to the geometrically correct `dist<=45`, but a
  *hard switch at any boundary* is insufficient on its own — floor mesh
  vertices are only ~15m apart, so a dozens-of-units jump compressed into
  one quad's width still produces a steep, wrong, linearly-interpolated
  ramp across that single face, and anything sitting on that one
  transitional quad reads a blended-neither height regardless of where the
  switch point is.
  * **Fix:** Replaced the hard switch with a `smoothstep` blend from fully
    buried to fully natural, timed to *finish exactly at* `RIBBON_COVERAGE`
    (45) rather than straddle it — matching `groundHeightAt()`, which is
    unblended and constant past 45, so nothing is left ramping once props
    start using the "far" branch. First attempt blended from 25→45 and
    broke a real, separate existing safety check
    (`floor-hidden-under-ribbon`, which requires the floor stay >10u below
    road level within 40m to avoid visually poking through the ribbon/road)
    — narrowed to 40→45 to respect both constraints simultaneously.
- **Symptom 2 (residual ~4u gap on distant background buildings after the
  blend fix):** Pure floor mesh resolution — bilinear interpolation across
  ~15m quads still misses several units of real height variation on
  locally steep raw noise terrain, independent of the boundary/blend issue.
  * **Fix:** Raised `createWorldFloor`'s segment cap from a hard 400 (which
    was already maxing out well above the "target 15m cell" the code
    commented, since world routes span kilometers) to 700 with a ~9m target
    cell size. Verified the residual (~4.36u worst case) sits comfortably
    inside the existing 60-unit building foundation slab (B21), so it isn't
    expected to be visible in practice even though it isn't mathematically
    zero.
  * **Performance:** also replaced the floor's road-proximity search — a
    260-point-vs-117k-vertices brute force, upgraded to 1200 points for
    correctness (needed a denser source than 260 to even measure the real
    boundary distance accurately) — with a 50m spatial hash grid (3x3
    neighbor-cell search, brute-force fallback for the rare unmatched
    vertex). Net result across both the resolution increase AND the search
    optimization: world build time went from an 846ms baseline down to
    ~620ms-1.4s depending on how much resolution headroom was spent — see
    `createWorldFloor`'s inline comments for the exact tradeoff reasoning.
  * **New regression guard:** none added beyond what B19 already has
    (`embankment-mesh-matches-formula`) — the existing
    `floor-hidden-under-ribbon` check already caught the round-1 regression
    directly, which is itself worth noting: it's possible to fix a bug and
    break an existing, unrelated invariant in the same edit, and the only
    reason that was caught immediately was that a check for it already
    existed. If you touch `createWorldFloor` again, run the full suite, not
    just a targeted new check.

- **Part 2 (background tree/prop density near buildings/hills):** Found via
  direct code read, not guessing: near-road trees only spawn out to ~22m
  (`nearDist` tops out at `roadHalf+18`), while background skyscrapers start
  no closer than 34m and only spawn on ~1-in-7 sampled points at ~85% odds
  — leaving a consistently bare 22-34m band, and further bare gaps between
  buildings past that, on every route regardless of city/season (this loop
  runs identically for all 5 cities x 4 seasons; road surface has zero
  effect on world-gen, confirmed by grep — it only touches paint
  color/grip in `VehicleController.update`). Added a second,
  independently-gated tree pass filling the 24-90m band at roughly a third
  of near-road density (1-in-4 sampled points, ~55% odds), reusing the
  existing `pendingTrees` overlap-resolution queue so these never collide
  with buildings/rocks/houses. Verified: 20/20 checks pass, tree count
  666->901 (+35%), zero new clear-of-road/overlap violations, confirmed
  visually.

- **Part 3 (rendering optimization) — investigated, explicitly NOT built:**
  Confirmed via `grep` across the whole codebase: zero uses of
  `THREE.LOD`, `THREE.InstancedMesh`, or any `frustumCulled` configuration
  anywhere. The only culling active is Three.js's unconfigured default
  per-object frustum culling, which skips draw calls but does nothing for
  CPU/memory cost. `createFoliageAndProps` eagerly builds a full individual
  mesh for every prop across the entire route in one pass at world-gen —
  everything for the whole map is resident simultaneously. Proposed (not
  built): (1) `THREE.InstancedMesh` for repeated tree/rock/pole geometry —
  native Three.js, highest leverage, lowest risk, doesn't touch placement
  logic; (2) distance-based `mesh.visible` toggling checked every few
  frames as a cheap streaming approximation, since the world is static
  after generation rather than actually loaded/unloaded on demand; (3)
  explicitly skipped LOD (needs authored detail levels, real asset work)
  and occlusion culling (no off-the-shelf r128 answer, not worth a custom
  BVH for this art style) for now.

- **Part 4 (graphics polish) — scoped, sequenced after Part 3, not built:**
  Proposed (1) unifying the remaining `MeshLambertMaterial` props onto the
  `MeshStandardMaterial` PBR pipeline established in A31, but flagged an
  explicit tension: today's per-prop color variation uses unique material
  *instances*, which actively fights `InstancedMesh`'s shared-material
  model — Part 3's instancing approach needs to decide how per-instance
  color works before this migrates; (2) cheap non-shadow-map contact
  decals under props, same instancing caveat; (3) explicitly do NOT touch
  bloom/post-processing thresholds without the same regression rigor as
  everything else here — this exact area has already regressed three
  separate times (A31, A32, and the B14-adjacent vignette chase).

### B25. B24's floor-resolution fix was itself a real FPS regression, plus rocks floating/burying and rocks overlapping skyscrapers

Triggered by direct user reports of floating rocks and lag, with an
explicit follow-up demand to check every city/season/surface with real
evidence, not an aggregate claim. Three distinct, confirmed bugs.

- **Symptom 1 (measured FPS regression, ~59.5 -> ~42.6 in a clean
  isolated comparison):** B24's floor segment increase (400->700, ~9m
  cells) was reasoned about purely in terms of one-time world-build cost,
  which did improve. It never accounted for RENDER cost: the floor mesh
  is static but still draws every frame, and at 700 segments it was
  647,522 triangles — 89% of the entire scene's per-frame triangle
  budget. Solving a placement-accuracy problem by brute-forcing render
  density was the wrong lever for a mesh that's mostly invisible backdrop.
  * **Fix:** reverted to 400 segments. The accuracy gap that increase was
    chasing is absorbed where it actually matters (buildings' existing
    60-unit foundation slab, B21) for the props that need it; it does
    nothing for rocks, which don't have a foundation — but rocks' real
    bug (below) turned out to be unrelated to floor resolution entirely.
  * **Lesson:** a change justified by "verified build time improved" is
    not automatically FPS-neutral. Any change to a mesh's own resolution/
    geometry must be checked against real per-frame render cost (actual
    FPS during gameplay, or at minimum `renderer.info.render.triangles`),
    not just one-time construction cost. These are different budgets.
- **Symptom 2 (rocks floating or sinking by inconsistent amounts,
  screenshotted):** Rock placement applied a FIXED `+0.8` vertical offset
  while independently randomizing full rotation on the rock geometry (a
  12-sided `DodecahedronGeometry`). A polyhedron's true distance from
  center to its lowest point varies with rotation (~1.27 to ~2.24 for
  this radius) — a constant offset only matches one specific, unrotated
  orientation, so most random rotations put the real bottom surface well
  above or below where `+0.8` assumed it was. No per-instance pattern,
  matching the screenshots (several boulders hovering at different
  heights) exactly.
  * **Fix:** compute the true lowest point directly from the geometry's
    20 vertices, rotated by that instance's actual rotation, and offset
    by exactly that. Runs once per rock at world-gen (cheap — no per-frame
    cost, unlike Symptom 1).
  * **Note:** an initial diagnostic script flagged ALL 421 rocks as
    "floating," which was the diagnostic's own bug, not the code's — it
    compared the rock's origin (which now correctly sits above ground by
    a variable amount, by design) against ground height, instead of the
    rock's actual bottom surface. Verified the real fix visually instead
    (rock base flush with terrain, screenshotted) once this was caught.
- **Symptom 3 (`rocks-clear-of-houses` failing on every season for
  Kolkata and Bangalore specifically, not other cities):** The delivery
  house placement block already prunes nearby rocks/trees placed earlier
  in world-gen (see B20/B21) — but skyscrapers, which share
  `type: 'building'` with delivery houses and can have a much larger
  registered radius (`footprintRadius + 1.5`, occasionally 7-8u), had NO
  equivalent pruning. Confirmed directly: the two overlapping "houses" in
  Kolkata had radius 7.96 and 7.3 — skyscraper footprints, not the fixed
  3.5 delivery-house radius.
  * **Fix, first attempt:** added the same prune-on-placement pattern to
    the skyscraper block. This closed most but not all cases (1/20
    combos, bangalore/winter, still failed) — likely an ordering edge case
    this session didn't fully trace: `[-1,1].forEach(side)` runs side=-1
    to full completion (including its own rock spawns) before side=1
    starts, so a side=1 skyscraper's placement-time prune can miss a
    side=-1 rock at the same sampled index if the specific
    margin/ordering doesn't line up.
  * **Fix, final:** rather than keep chasing the exact sequencing, added
    one unconditional final sweep after every prop for the whole route
    has been placed, removing any rock/tree still overlapping any
    building regardless of which was placed first. Correct by
    construction regardless of ordering, at the cost of one
    O(rocks x buildings) pass (a few hundred x a few hundred — trivial at
    world-gen time, not a per-frame cost).
  * **Verified:** full 20/20 city x season combination sweep (5 cities x
    4 seasons, each run with a different one of the 4 road surfaces
    rotated through so all three dimensions get cross-coverage), plus all
    4 seasons individually re-tested for the two previously-failing
    cities — 0 failures across every combination. FPS re-confirmed at
    60.8 on a clean reload after the Symptom 1 fix.

---

## Recurring bug patterns — read before touching these areas again

### Pattern 1: independently-duplicated height formulas drift apart (7+ occurrences)
The single most-repeated mistake in this project. Every time "the ground
formula" gets copy-pasted into a new call site (terrain ribbon, world
floor, prop placement, vehicle position, crossers, sky color) instead of
calling one shared function, the copies eventually diverge — a clamp gets
added to one and not the others, a constant gets tuned in one and not
copied, etc. Occurrences: A6 (formula created) → A12 (calcTerrainY diverged
from it) → A14–A18 (floor vs ribbon diverged, fixed 4 times in sequence
before landing on "call the exact same function") → B3 (the shared formula
itself got an over-aggressive clamp, still had to be un-clamped in 3
places) → B14 (the sky color version of the same mistake — vertex-baked
instead of shared-function-per-pixel) → **B16 (the road mesh's own verge
used a fixed vertical offset instead of the shared function, floating the
entire road 0.32u above the ground for its full length; `calcTerrainY`,
still a branch-for-branch copy, was collapsed into `groundHeightAt` in the
same fix)**.

**Lesson:** if you're about to write `const groundY = pt.y - 0.18 - ...` (or
any variant) anywhere new, stop — call `World.groundHeightAt()` (added in
B6) instead. If a NEW subsystem needs a smoothly-varying value derived from
world position (color, height, anything), compute it in one place (ideally
per-pixel/per-frame, not baked into discrete geometry/keyframes) and have
everything else call that, rather than each site inventing its own
approximation.

**B16 sharpened this:** the rule applies to *mesh vertex generation*, not
just to prop placement. Any vertex that has to meet the ground — road
verges especially — must take its height from `groundHeightAt()`, because
a "reasonable-looking" constant offset silently disagrees with the terrain
everywhere at once rather than failing loudly in one spot.

**B17 sharpened it again, and this is the important half:** calling the
same function is **not sufficient** for two meshes to meet. B16 did call
the shared function and the seam still tore, because the road sampled the
curve 1200× and the terrain 800×, had no terrain vertex at the road's edge
lateral distance, and offset along a banked vs unbanked normal. For two
surfaces to actually touch they must agree on **all four**:
1. the height function (`groundHeightAt`),
2. the longitudinal sampling rate (`CONFIG.ROAD_MESH_SEGMENTS`),
3. a shared vertex row at the seam's lateral distance
   (`CONFIG.ROAD_SHOULDER_WIDTH`),
4. the offset basis (both unbanked at the seam).

And **exactly coplanar is its own bug** — it z-fights and lets the lower
surface poke through in a ragged sawtooth. Give the upper surface a small
deterministic lift (`CONFIG.ROAD_VERGE_LIFT`).

**Verification lesson:** B16's guard passed at 0.0084u while the seam was
visibly torn, because it measured the verge against the height *function*
instead of the terrain *mesh*. A geometry fix must be verified by
raycasting the rendered geometry. (When you do raycast a ribbon that spans
±40m laterally, take the hit **nearest** the sample, not the first/highest
— at a hairpin the ribbon folds over itself and the top hit can be a
different stretch of road 22u away, which briefly looked like a
catastrophic regression on Pune until corrected.)

### Pattern 2: "vehicle sinks into / floats above the road" (3 occurrences, 3 different causes)
- A25: vehicle Y ignored `lateralOffset` entirely, always used centerline
  height.
- A28 (camera specifically): a ground-clip clamp referenced raw
  un-carved terrain instead of the road-relative carved height.
- B10: vehicle Y ignored road banking on curves.

**Lesson:** this symptom has three independent root causes so far, all in
the same general area (vehicle/camera vertical positioning vs. the actual
rendered road surface). If it happens a 4th time, check whether it's really
a 4th distinct cause, or whether one of these three regressed.

### Pattern 3: camera can end up inside/under terrain (2 occurrences)
A1 added a clamp to keep the pulled-back chase camera above terrain; A28
found that same clamp used the wrong height reference on hills. Any future
camera repositioning logic needs a terrain-relative clamp, and that clamp
specifically must reference the **carved road height**, not raw noise
terrain — conflating the two is what broke it the second time.

### Pattern 4: a "more correct" fix that's still a regression for this project (2 occurrences)
B13's vignette aspect-correction was mathematically correct and still had
to be reverted, because the project's actual wide viewports made the
"correct" version look worse than the "incorrect" original. A3's
steering/GPS fix, by contrast, was verified against actual **screen-space**
behavior rather than internal state — which is the general antidote: verify
a fix against the real reported symptom under the real conditions in use,
not against the formula's abstract correctness.

### Pattern 5: a partial property override can silently reintroduce a bug in one specific viewport/condition (1 occurrence, worth watching for more)
A7–A11: a tablet-only media query set `overflow-x` without `overflow-y`,
and CSS's own spec-mandated coupling between those two properties
reintroduced a bug that had already been fixed everywhere else. Any CSS
`overflow` (or similar coupled-property) change should be checked across
all breakpoints, not just the one it was written for.

### Pattern 6: bloom/luminance blowout on bright or emissive surfaces (3 occurrences)
A31: skyscraper window-glow emissive was always-on, blowing out under bloom
in daylight — gated by time-of-day. A32: yellow lane-divider paint blew out
into glowing blobs under bloom — removed. B14's dead-end (vignette-multiply
quantization) was adjacent to this same "post-processing interacting badly
with bright/flat colors" territory, though the actual cause there was
unrelated (vertex-color banding, not bloom).

**Lesson:** any new bright, saturated, or emissive material added to the
scene should be checked against the bloom pass specifically (threshold is
currently 0.94, tuned once already for exactly this reason) before being
considered done.

### Pattern 7: a boundary clamp that resets position wholesale silently discards motion on the OTHER axis (1 occurrence — new in B17, watch for more)
The vehicle's fence lateral clamp (B17) snapped the car straight to
`nearestPoint + normal * clampDistance` on contact — technically correct
for the lateral axis, but it discarded the along-road component of the
same move entirely, since it rebuilt the position from scratch instead of
only correcting the one axis that was actually out of bounds. Combined
with a nearest-point search reseeded from that same corrected position
every frame, this created a genuine stable deadlock (frozen position,
nonzero speed, forever), not just an approximation error.

**Lesson:** any clamp/boundary-correction that fires by *reconstructing* a
position (rather than *subtracting/capping* the specific offending
component) risks silently zeroing out legitimate motion on other axes.
Decompose into components, clamp only the one that's actually violated,
and keep the rest. Same underlying category of mistake as Pattern 1
(reinventing a calculation instead of correctly composing existing pieces)
but specifically about clamps/collision response, not height formulas — if
a third occurrence shows up in yet another clamp, promote this into
Pattern 1 as a general "clamps must be component-wise" rule.

### Pattern 8: `lookAt()` without flattening Y tilts the whole object, not just its yaw (8 occurrences in one commit, B18)
`Object3D.lookAt(target)` orients on all three axes toward the target —
if `target.y` differs from the object's own Y (true almost everywhere on
this project's hilly terrain), the object doesn't just yaw to face the
target, it pitches/rolls too, tilting a building's roof/walls or a lamp's
post off-vertical. This bit 7 different roadside props at once (delivery
cabin, garage bay, milestone stone, streetlamp, bus shelter, tapri stall,
kirana shop, monument) — all built independently, all making the same
mistake fresh, because nothing enforced "flatten the target" as a rule
until B18 fixed them by switching to `group.lookAt(pt.x, ownY, pt.z)`.

**Lesson:** any time you orient a road-facing prop with `lookAt(pt)` where
`pt` is a road curve point and the prop sits at its own independently-
computed terrain height, flatten the target's Y to the prop's own Y first
— `group.lookAt(pt.x, group.position.y, pt.z)` — unless you deliberately
want the object to pitch/roll toward the target.

### Pattern 9: Local cross-section normal offsets do not guarantee clearance on hairpin loops / switchbacks (B21)
Placing props or buildings purely by offsetting along the local road normal (`pt + normal*dist`) guarantees distance from the road cross-section at that specific spline progress index `i`, but completely ignores winding switchbacks where adjacent road loops double back nearby. The same geometric blindspot caused fixed spline-delta pure pursuit autopilot (`lookaheadU = progress + 0.012`) to target points across the loop that physically lay behind or sideways relative to the car, inducing spin-outs.

**Lesson:**
1. Any roadside building or obstacle placement MUST call `clearsRoad(pos, clearanceRadius)` to verify clearance across the global road curve.
2. Path following and autopilot lookahead distance MUST be adaptively scaled in meters (`10m + speed * 0.7`) rather than fixed spline progress fractions to avoid reaching across hairpin bends, paired with cornering deceleration.

---

## Test infrastructure

`dev-checks.js` (project root) — a reusable `runWorldChecks()` function, run
against the live game (`window.game`) after any change touching road
generation, terrain height, props, crossers, or vehicle placement, instead
of relying on a screenshot. Originally added in `f9c40db`; extended
multiple times since (by both this session and a concurrent one) as new bug
classes were found (16 checks as of B17). Currently covers: buildings/trees
clear of road, terrain seam continuity, delivery target correctness (ring
vs pivot, no stale undelivered targets), crosser height, fence geometry/
orientation (short-enough segments, flush ends, clear of all obstacles),
vehicle banking, rock/house overlap, driveway correctness, floor-vs-ribbon
height, GPS ahead/behind direction, autodrive toggle drift reset, and (new
in B17) the vehicle not freezing when its free movement contacts a fence.

**Always run it synchronously** — pasted/evaluated directly, not via
`fetch(...).then(code => eval(code))`. That async pattern let the game's
animation loop tick several frames between the fetch resolving and the
check running, producing a false-positive "crosser height drift" failure
purely from reading position/progress fields a frame apart. Re-running the
same check synchronously showed exactly 0 drift. This is documented in the
file's own header comment too — if a result looks flaky, re-run it
synchronously before treating it as a real regression.
