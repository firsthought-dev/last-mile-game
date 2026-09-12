# CLAUDE.md — Shiplyp: Last Mile (`last-mile-game`)

Always-loaded project context. This is not a workflow — it's the facts, contradictions, and hard constraints an agent needs before touching this codebase. Conditional workflows (asset sourcing, world-change verification) live in separate skills, loaded only when that task type comes up — see "Related skills" at the bottom.

---

## What this project is

Vanilla Three.js browser game, single-file engine: `game.js`, ~8,000+ lines, no build step, no bundler. `index.html` + `style.css` load it directly. `package.json`'s only dependency is Playwright, devDependency only, for testing — not part of the shipped game.

No Unity, no Unreal, no Bevy, no C# scaffolding — confirmed by the codebase itself.

The top-level `last-mile-game` folder is **not itself a git repository** (`git status` fails there — "not a git repository"). Real git history lives inside worktree checkouts under `.claude/worktrees/`. Confirm which directory is the actual working repo before assuming git commands work at the folder root.

---

## Two unresolved contradictions — do not silently pick a side

**1. Courier-vs-driving direction.** `SHIPLYP_GDD_V2.md` (2026-08-24/26) describes a full courier/delivery game: Dispatch Hub, cargo delivery, Wanted-level police, potholes, e-challans. `HANDOFF.md` (more recently edited) says Section 1 of a "Master Prompt" pivot already removed all of that from the live build. Treat `HANDOFF.md` as current truth and the GDD as stale pending a rewrite.

More importantly: `HANDOFF.md` states in its own words that whether this pivot is even the right direction has **not** been settled with the user — it explicitly instructs asking "what's wrong at a level above individual bugs — visual quality overall, driving feel, the fundamental direction of the courier-to-driving-game pivot," rather than assuming. If a task touches core game direction, ask first.

**2. Procedural-vs-asset-heavy visuals.** `SLOW_ROADS_SYSTEM_DESIGN.md` contains its own dated self-correction (2026-08-29): the original premise that slowroads.io is texture-free was verified false by live network inspection — slowroads actually loads 30+ real textures, modeled trees, and a textured car model. Shiplyp is currently 100% procedural primitives with zero external terrain textures — the opposite of the thing it's trying to visually match.

This is the real, verified gap if "match the slowroads look" ever comes up — closing it means real ground/road textures and tree meshes, not more shader tuning. Whether to actually pursue that direction is a decision for the user, not something to assume. `SLOWROADS_PARITY_LOG.md` is the authoritative, continuously-updated comparison reference per `HANDOFF.md`; it's gitignored and was not present in the currently synced copy of this folder — if it exists elsewhere on this machine, read it before doing visual-parity work rather than reconstructing conclusions from memory.

---

## Skills already installed — don't duplicate

`skills-lock.json` lists 26 skills already installed from `addyosmani/agent-skills`: `test-driven-development`, `debugging-and-error-recovery`, `code-review-and-quality`, `performance-optimization`, `frontend-ui-engineering`, `browser-testing-with-devtools`, `git-workflow-and-versioning`, `spec-driven-development`, `doubt-driven-development`, `constraint-driven-development`, `security-and-hardening`, `observability-and-instrumentation`, and 14 others. These are real, active, and already governing this project's workflow.

If a Three.js-specific skill set (`gamedev-skills/awesome-gamedev-agent-skills`) is ever added, install only what doesn't overlap — that router also ships its own `performance-optimization`, for example. Non-overlapping candidates: `web-engines`, `shaders`, `cameras`, `procedural-generation`, `game-feel`, `level-design`.

---

## Asset licensing

`sports-coupe.glb` and `muscle-coupe.glb` (current active vehicle roster) are user-supplied with **unverified license**, disclosed in `CREDITS_AND_REFERENCES.md`. `sedan-sports.glb`, `truck.glb`, `delivery.glb` are older Kenney (CC0) assets, possibly legacy pending the pivot. Any new asset needs its own `CREDITS_AND_REFERENCES.md` entry — see the asset-sourcing skill for the process.

---

## Active workstreams

Two feature worktrees exist under `.claude/worktrees/`: `progressive-visual-fidelity-c82335` and `tier2-graphics-exploration` — both concern visual-quality tiering, consistent with the unresolved visual-direction question above. Check which is active before starting new visual work, to avoid duplicating or conflicting with in-flight work.

---

## Dev server

Serve via the Browser pane's `preview_start` at `http://localhost:8091`. Standalone `server.py` / `run_game_server.py` also exist at root — confirm which is the current convention before assuming.

---

## Hard constraints

- No Unity, no Unreal, no C# scaffolding, no Bevy.
- No build step for the game itself — don't introduce a bundler unless explicitly asked.
- Never silently resolve the courier-vs-driving direction question or the procedural-vs-asset-heavy visual direction question. Ask.
- Don't reinstall or shadow the 26 already-installed skills.

---

## Related skills (trigger conditions, not always-on)

- **`shiplyp-asset-sourcing`** — load when adding, sourcing, or replacing any 3D model, vehicle, or prop asset.
- **`shiplyp-world-verification`** — load after any change touching road generation, terrain height, props, crossers, or vehicle placement, and after any change under `assets/models/`.

---

## Sources (read directly, not assumed)

`HANDOFF.md`, `SHIPLYP_GDD_V2.md`, `SLOW_ROADS_SYSTEM_DESIGN.md`, `GAME_ARCHITECTURE_AND_VISUALS_GUIDE.md`, `BUGFIX_LOG.md`, `skills-lock.json`, `package.json`, `.claude/worktrees/` listing.
