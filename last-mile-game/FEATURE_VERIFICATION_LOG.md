# Feature Verification Log

Running record of features/changes introduced to Shiplyp: Last Mile, and
whether they've been independently verified (not just committed). Updated
whenever a new feature lands or an existing one is re-checked. This is
separate from `BUGFIX_LOG.md` (which documents bug root-causes and
recurring failure patterns) — this tracks *coverage*, not causes.

Status legend:
- ✅ **Verified** — tested directly (in-browser, live gameplay or targeted
  script), with what was checked noted.
- ⚠️ **Partial** — some aspect checked, gaps noted.
- ❌ **Unverified** — exists in code/committed, not yet independently tested.

---

## Automated regression suite (`dev-checks.js`)

22 checks, run 2026-08-29: **22/22 passed.** Covers building/tree/rock/fence
road-overlap, terrain-seam continuity, road-verge/embankment mesh accuracy,
vehicle ground-height while driving (real physics, not synthetic), delivery
ring/pivot alignment, crosser height, GPS direction, autodrive toggle state,
driveway placement, fence-collision sliding, and route-start spawn.

**Not covered by the suite** (verify manually when touched): tunnels, radio,
HUD/UI, monuments, on-foot mode, wanted/police system, post-processing.

## Tunnels (hillside bore-through)

✅ **Verified** 2026-08-29 — introduced in `6e565e3` to end the recurring
"terrain wall" bug (see `BUGFIX_LOG.md` Pattern 3 — two prior clamp-based
fixes, including this session's own camera-height fix, kept resurfacing the
same class of bug; tunnels sidestep it by boring through hills tall enough
to loom over the road instead of continuing to clamp/fight the terrain
noise). Drove a real autopilot pass through the one tunnel zone present on
a test route (Mumbai, seed default): clean entry portal, enclosed interior
with correct lane markings and a wall-mounted lamp, curve tracked correctly,
clean exit back to open terrain with no seam/gap. Zero console errors
throughout entry → interior → exit.
Not yet checked: multiple tunnels on one route, a tunnel on a sharper curve
than this one, tunnel + season/time-of-day combinations other than
default.

## Radio: decade-based era selection + Hindi/English HUD toggle

✅ **Verified** 2026-08-29 (`fc56c14`) — all three era mappings confirmed
via direct `switchChannel()` calls at each time-of-day: dawn → Hotel
California (90s), day → Clocks (2000s), night → Counting Stars (2010s).
HUD `HIN/ENG` button confirmed clickable, toggles correctly. English
audio is synth-only by design (see commit message for the two real-audio
sources investigated and declined).

## Controls menu reorganization + [H]/[?] shortcut

✅ **Verified** 2026-08-29 (`df8181d`) — `H` opens Controls tab directly,
all four sections scroll and render without overlap, closing resumes the
live drive cleanly.

## Post-processing pipeline (bloom/FXAA/vignette), PBR ground materials

❌ **Unverified** — committed by the other session (`dc8bc84`), not
independently tested by me. Worth a visual pass (especially Pattern 6 in
BUGFIX_LOG.md — bloom/luminance blowout has recurred 3 times on bright/
emissive surfaces).

## Wanted/police system, on-foot courier mode, city skyline/monuments

❌ **Unverified this session** — skyline/monuments were built and verified
earlier (see game.js commit history), but not re-checked since. Wanted
system and on-foot mode are newer additions from the other session, not
yet independently tested.

---

*Add a new entry above whenever a feature lands or gets re-verified. Keep
entries short — what was checked and how, not a restatement of the commit
message.*
