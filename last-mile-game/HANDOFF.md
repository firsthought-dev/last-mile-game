# HANDOFF — Live Session State

**Read this file FIRST if you are picking up this project cold** (new
session, context reset, different AI agent). This file is updated
continuously — before and after every real unit of work in this session,
not batched at the end — so it should always reflect what's actually true
right now, not what was true when a session started.

`SLOWROADS_PARITY_LOG.md` is the detailed historical record (what was
tried, what broke, why, verification evidence) — read it second, for
depth on anything mentioned here. This file is the fast-orientation
layer: where things stand *right now*, what's mid-flight, what's next.

---

## Right now (as of this update)

- **Branch:** `slowroads-implementation-test`
- **Last commit:** `a859abb` — "Revert speed-based turn-rate nerf, fix
  camera direction, smooth pitch snap" (this was a concurrent session's
  work, not mine — see "Other sessions" below)
- **Uncommitted changes:** `last-mile-game/game.js` has ~178 lines of
  uncommitted diff right now. **This is not my work in this update** — it
  belongs to another concurrent Claude Code session actively working the
  same repo (see below). Do not discard it; if you need to edit game.js,
  re-read it fresh first and check `git diff` before assuming a clean
  baseline.
- **No task of mine is currently mid-edit.** My last completed, committed
  piece of work was the fence/stone-wall height-continuity fix (verified
  numerically, see SLOWROADS_PARITY_LOG.md section 3i).

## Important context: this repo has multiple concurrent sessions

Throughout this work, **another Claude Code session (or sessions) has
been actively editing this same repo in parallel**, on unrelated work
(vehicle drift physics, camera direction, intro-screen blur/banding
fixes, a road-edge-stripe removal). This is not a hypothetical — it has
caused real git lock contention and required careful `git commit --
<specific paths>` usage to avoid stomping on the other session's
in-flight changes. **If you're a fresh agent picking this up: check `git
status` and `git log` before assuming you know the current state, and
expect the file to have changed since whatever context you were given.**

## User's current sentiment (important — read before doing more feature work)

The user said, as of the most recent message: *"not happy with the
outcome, we're nowhere near where I'm trying to get this game, maybe our
vision doesn't match."* This followed a string of narrow, verified
bug-fixes (fence height, vehicle sourcing, delivery-theme removal,
palette desaturation) that were each individually correct but apparently
not adding up to what the user actually wants the game to be.

**Do not just keep making narrow fixes without addressing this.** The
right next move (if not already done by the time you're reading this) is
to actually ask the user what's wrong at a level above individual bugs —
visual quality overall, driving feel, the fundamental direction of the
courier-to-driving-game pivot, or something not yet articulated. Do not
assume the answer and start implementing based on a guess.

---

## Master Prompt status (SHIPLYP_MASTER_PROMPT.md, in Downloads)

- **Section 1 (remove delivery/courier theme):** Done, re-verified live.
  Dispatch UI, WANTED system, cargo toss, potholes, NPC traffic all
  removed. Some dead code disclosed-not-deleted (see parity log 3b, 3d).
- **Section 2 (vehicle roster):** Done for now. Roster is Sports Coupe +
  Muscle Coupe (both user-supplied files, unverified license, disclosed
  in CREDITS_AND_REFERENCES.md). GT Hatch (Kenney sedan) and a Kenney SUV
  were both explored and dropped. See parity log 3f/3g for the full
  sourcing saga (Sketchfab/itch/TurboSquid/free3d/Meshy all dead ends;
  Kenney and user-supplied FBX/OBJ files were the only workable paths).
- **Section 3 (world visuals):** Palette desaturation done. Two-layer
  roadside ground (vivid green strip + khaki dominant) done, verified via
  vertex-color buffer inspection. Dry-stone-wall barrier done, and its
  height-continuity bug (see below) is fixed and verified. "Visible blade
  detail" (real grass-blade geometry, not just color) was explicitly
  NOT done — flagged as a real gap, not silently skipped.
- **Fence/stone-wall height bug (section 3i in parity log):** User caught
  that barriers looked inconsistent in height after I'd called section 3
  "done." Real two-layer bug: (1) each ~6m fence segment anchored its
  flat rail to one center-point height with no continuity constraint
  between segments, and (2) my first fix attempt had a closure-scoping
  bug that used the wrong reference point for a segment's far end. Fixed
  properly, verified via direct world-space measurement (0.000m gap
  between genuinely adjacent segments, both wood and stone variants).

## Known disclosed gaps (not silently missing — just not done)

- Real billboard grass-blade geometry (roadside "visible blade detail")
  — only approximated via vertex-color noise, not real geometry.
- A screenshot specifically of a stone-wall stretch was never captured
  (the numeric height-continuity check stood in for it — see parity log
  3h/3i for why).
- Several delivery-era functions/state variables are still defined in
  game.js but unreachable (toggleStatusPanel, wantedLevel, etc.) —
  disclosed dead code, not deleted, due to scope of a full removal.
- Texture compression on the two new vehicle models is basic (1024px cap,
  no atlasing/KTX2) — ~12.5MB combined, heavier than the Kenney assets.

## Files that matter

- `game.js` — the whole engine, ~8000+ lines, single file.
- `SLOWROADS_PARITY_LOG.md` — gitignored, local-only, detailed history.
  **Keep updating this per its own stated update rule** (write entries as
  work happens, not retroactively) — this file (HANDOFF.md) doesn't
  replace it, it's a faster on-ramp that points into it.
- `CREDITS_AND_REFERENCES.md` — tracked in git, licensing disclosures for
  all 3D assets including the two unverified-license user-supplied
  vehicle models.
- `assets/models/*.glb` — sports-coupe.glb, muscle-coupe.glb (new this
  session), sedan-sports.glb/truck.glb/delivery.glb (Kenney, older).

## How to verify anything in this game live

Dev server runs via the Browser pane's `preview_start`, serving
`last-mile-game/` at `http://localhost:8091`. **Always cache-bust**
(`?t=<random>` on the page URL) after editing `game.js`/`index.html`/
`style.css`/anything in `assets/models/` — none of these have automatic
cache-busting except `game.js`/`style.css`'s own `?t=Date.now()` query
already baked into `index.html`'s loader script; `.glb` model URLs
specifically needed manual `?t=` added to their loader calls this
session after a stale-cache bug wasted real time (see parity log 3g).
