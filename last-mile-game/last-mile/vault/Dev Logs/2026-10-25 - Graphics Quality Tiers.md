# 2026-10-25 - Graphics Quality Tiers

Part of the Mumbai-Pune city direction, on its own branch. Not merged.

## What changed for players
- New setting: **Settings > Display & Sound > Graphics quality**, with Auto, Medium and High.
- **Auto** picks Medium on most phones and High on desktops. If a High device keeps running slowly, it moves to Medium once and remembers that.
- **Medium** is lighter: no sun shadows, a lower render resolution limit, and a steady 30 fps.
- **High** looks the same as before.

## Why
The lighter look is meant to make room on mid-range phones for the city work coming next (traffic and busier streets).

## Status
- Desktop checks pass in both tiers.
- Not yet checked on real phones.
- Medium still draws more than its target on the busiest stretches. Choosing what to trim from the scene is an open decision.

[[Projects/Last-Mile Game]] · [[2026-10-25 - Mumbai-Pune Direction Phase 0]]
