# HANDOFF — Live Session State

**Read this file FIRST if you are picking up this project cold** (new
session, context reset, a different AI agent than whoever wrote this).
It is updated continuously — before and after every real unit of work,
not batched at the end of a session — so it should always reflect what's
actually true right now, not what was true when some earlier session
started. See the mandatory-update rule in `AGENTS.md`.

This file is the fast-orientation layer: where things stand *right now*,
what's mid-flight, what to check before assuming a clean baseline. For
depth on *why* something is the way it is, read (in this order):
1. `BUGFIX_LOG.md` — root causes, recurring failure patterns.
2. `FEATURE_VERIFICATION_LOG.md` — what's been independently verified vs.
   just committed.
3. `dev-checks.js` — the automated regression suite; run it after
   touching terrain/road/vehicle/camera code.

---

## Right now (as of this update)

- **Branch:** `main`
- **Last commit before this update:** `7b2698c` — "Add running feature
  verification log"
- This file did not exist on `main` before this commit. It's being added
  here specifically because a session working a separate long-running
  branch (`slowroads-implementation-test` — a parallel effort converting
  this game from a delivery/courier game toward a slowroads.io-style pure
  driving experience) built the same convention there first, and the user
  asked for the practice itself to be mandatory across every session,
  not just that one branch. Establishing it here too rather than letting
  it be branch-specific.

## Important context: multiple branches, genuinely diverged

This repo has at least three lines of active work that do not share
history in any meaningful recent sense:
- `main` — the delivery/courier game as originally conceived: dispatch
  system, WANTED/police mechanic, cargo toss, radio, tunnels, touch
  controls. This is what `BUGFIX_LOG.md`/`FEATURE_VERIFICATION_LOG.md`
  document.
- `slowroads-implementation-test` — a from-scratch pivot away from the
  delivery/courier framing toward a slowroads.io-style pure driving game:
  dispatch UI removed, vehicle roster replaced with user-supplied models,
  world-visual palette desaturated, roadside barriers reworked. Tracked
  in that branch's own `SLOWROADS_PARITY_LOG.md` (gitignored, local-only
  — not visible from `main`).
- Other `claude/*` branches exist too (e.g.
  `claude/meshy-vehicles-category-*`, `claude/slowroads-topography-*`) —
  check `git branch -a` and don't assume any one branch reflects the
  "current" state of the project as a whole.

**If you're a fresh agent and unsure which branch the user means by "the
game" or "this session's work," ask — don't assume `main` is the active
one just because it's the default.** The user has been actively directing
work on `slowroads-implementation-test` for an extended session; `main`
may be comparatively stale relative to what the user is actually looking
at day to day.

**Do not merge `slowroads-implementation-test` into `main` (or vice
versa) without the user explicitly asking for that specific merge.** They
represent different, currently-incompatible visions for the game
(delivery/courier vs. pure driving) — this was a deliberate, explicit
instruction, not an oversight to "fix" by unifying the branches.

## What to do with this file going forward

Per the hard rule now in `AGENTS.md`: update this file's "Right now"
section (and add to a running log below it, once one exists) every time
you complete a real unit of work — a fix, a feature, a decision, a
dead-end investigated and abandoned — not just at the end of a session.
Keep entries specific enough that a cold read tells you what actually
changed and why, not just "made progress."
