---
date: 2026-09-13
type: architecture
tags:
  - architecture
  - last-mile-game
ai-first: true
---

# SoundEngine

## For future agent
Architecture note on the audio subsystem of [[Projects/Last-Mile Game|Last-Mile Game]], saved 2026-09-13 from a graphify scan (31 nodes).

## Overview
Handles game audio - engine sounds, ambient, SFX. Second-largest community after [[Architecture/ShiplypEngine|ShiplypEngine]], suggesting a fairly elaborate sound system (layered engine audio, weather audio tied to [[Architecture/RainSystem|RainSystem]]?). TBD - not yet manually reviewed.

## Current state (2026-09-27, B112)
`SoundEngine` in `game.js` is a singleton (`window.sound`) that only makes game audio: Web Audio SFX tones, the engine hum and wind noise, all run through one warm lowpass `masterFilter`.
- **No radio.** Playlists, the synth radio, the `<audio>` streamer and channel logic were removed in [[2026-09-27 - B112 Remove Radio|B112]].
- **Mute:** one flag, `sfxMuted`, saved in localStorage as `shiplyp_sfx_muted`. `toggleMute()` flips it, and `muted` reads it. Input comes from the `M` key, the HUD `#btn-hud-audio` pill, `#btn-dock-sound` and the hub mute button, all through `game.toggleMute()` and then `updateAudioHUDButtons()`.
- **Suspension:** `suspendForMenu()` and `resumeForGameplay()` set `suspended`, which silences everything outside a driving run, whatever the mute setting.

## Links
- [[Projects/Last-Mile Game]]
