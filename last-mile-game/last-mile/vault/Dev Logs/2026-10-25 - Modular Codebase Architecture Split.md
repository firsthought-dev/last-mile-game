# Modular Codebase Architecture Split

**Date:** 2026-10-25

The single large game script was split into 17 smaller browser scripts. This is a code-organisation change: the game is meant to play the same for players, and future changes can now be made in smaller, focused files.

- **No build step added:** the game still runs as plain browser scripts, loaded in order, with no bundler.
- **Areas of the code:** world generation, roads, props, traffic, vehicles, visual effects, audio, assets, and the main game loop, each in its own file.
- **Staging and packaging updated:** the web build, the portal bundle, and the Android asset sync all pick up the new files.

**Verification:**
- The web staging, packaging and size checks pass.
- Smoke tests pass on desktop, mobile, and returning-player runs.
- The Android debug build compiles.
- The internal regression suite reports one failing check, a house-frontage placement check that also fails on the main branch before this change.
