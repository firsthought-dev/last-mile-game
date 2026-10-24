# Modular Codebase Architecture Split

**Date:** 2026-10-25

The monolithic 14,337-line `game.js` script was separated into 17 modular browser scripts organized under `last-mile/js/`. The game runs identically for players while making the codebase substantially cleaner, faster to navigate, and safe to extend.

- **Zero Bundler Overhead:** Preserved vanilla browser script execution without adding Webpack, Vite, or Node bundling steps. Scripts are loaded in sequence with cache-busting version tags.
- **Dedicated Subsystems:**
  - `core.js`: Game constants, configuration, math helpers, and vehicle properties.
  - `audio.js`: Sound synthesis engine and audio singleton.
  - `assets.js`: 3D model loaders, barrier geometry builders, and chunked instance management.
  - `factories.js`: Road grass, rocks, foliage billboard factories, and spatial partitioning grids.
  - `world-*.js`: Procedural world generation split into core math, roads/bridges/tunnels, props/landmarks, traffic/pedestrian AI, and streaming sequences.
  - `vehicle.js`: Vehicle physics, road projection, and handling.
  - `fx.js`: Weather systems and visual style post-processing.
  - `engine-*.js`: ShiplypEngine game lifecycle split into core rendering/camera, delivery target management, HUD/menus, player controls, and environment loops.
  - `boot.js`: Engine startup listener.
- **Continuous Staging & Packaging:** `stage_web.sh`, `package_web_portal.sh`, and `sync_android_assets.sh` updated to automatically stage the modular scripts across web builds, portal ZIP packages, and Android assets.

**Verification:**
- `npm run ci` passed 100% green across all stages, including asset packaging and desktop/mobile smoke tests.
- Visual and physics checks (`dev-checks.js`) confirmed 41/41 tests passing.
- In-game deliveries tested via headless Playwright drives with 100% toss success.

Related: [[Projects/Last-Mile Game]], [[Architecture/Modular Engine Architecture]], [[Architecture/Build Pipeline]]
