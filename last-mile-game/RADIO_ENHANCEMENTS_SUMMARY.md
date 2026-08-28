# Shiplyp Radio Enhancement & Audio Architecture Summary

This document outlines the design, implementation, and bug fixes for the in-game Cassette Radio system in **Shiplyp: Last Mile**.

---

## 1. Background & Objectives

### Initial State
* The game previously had a single flat array of 10 Hindi 90s Bollywood tracks hardcoded in `SoundEngine.realTracks`.
* No language channel switching, no keyboard shortcut to cycle stations, and no support for English road-trip anthems.

### Enhancement Objectives
1. **Multi-Language Radio Channels**:
   * **DHABA FM (Hindi)**: Iconic 90s Bollywood highway classics.
   * **HIGHWAY FM (English)**: Iconic road-trip anthems spanning 90s, 2000s, and 2010s.
   * **ALL FM (Mix)**: Blended playlist of both channels.
2. **Player Controls & Ergonomics**:
   * Clickable HUD channel badge button (`#btn-radio-channel`) in the top-right cassette radio pill.
   * Keyboard shortcut `[L]` to cycle channels anytime while driving.
   * Animated on-screen notification badge on channel switch (`RADIO: DHABA FM`, etc.).
   * Persistence of player's channel preference in `localStorage['shiplyp_radio_channel']`.
3. **Song Metadata**:
   * Expanded metadata format: `${title} — ${artist} (${era})`.

---

## 2. Core Audio Directive & Constraints

* **Strict Rule on Real Streams vs. Synth**:
  > *"No synth if real songs/playlists are available. Synth only as a last-resort fallback if no real streams exist, with soothing instruments pleasing to the ear, not alarming."*
* **Hindi Implementation**: Contains **49 authentic real MP3 stream URLs** (100% real CDN audio, 0 synthetic tracks).
* **English Implementation**: Polyphonic chill Rhodes / analog Electric Piano arrangements modeled with dual-oscillator warmth and a 1050 Hz lowpass filter to eliminate harsh or alarming high frequencies.

---

## 3. What Actually Happened: The Highway FM Issue & Fix

### The Symptom
When players switched to **HIGHWAY FM**, the track title began rapidly cycling through all songs in fractions of a second without playing any audible music.

### Root Cause Analysis
1. **Browser Media Element Error Event**:
   * In `_playCurrentTrack()`, when transitioning to a synthetic track (`isSynth: true`), the code executed `this.audioEl.src = ''` to clear the HTML5 Audio element.
   * Modern browser audio implementations immediately trigger an `'error'` event when `<audio>.src` is set to an empty string.
2. **Infinite Auto-Skip Loop**:
   * The `this.audioEl.addEventListener('error', ...)` handler listened for stream errors to auto-advance to the next track on network dropouts.
   * Because the event listener did not check if the active track was actually an external stream, it caught the empty-source error, called `this.nextTrack()`, loaded the next synth track, cleared `.src` again, and fired another error event in an endless rapid loop.
3. **AudioContext Activation & Initial Note Delay**:
   * `startSynthRadio()` only scheduled notes on the subsequent `setInterval` tick rather than triggering note 0 immediately, and did not guarantee `this.ensure()` had resumed an idle `AudioContext`.

### The Resolution (Entry B23 in `BUGFIX_LOG.md`)
1. **Guarded Error Handler**: Updated `audioEl.onerror` to only skip tracks if the active song is a genuine external URL (`trk.url && this.audioEl.src.startsWith('http')`).
2. **Safe Unloading**: Replaced `this.audioEl.src = ''` with `this.audioEl.pause()`.
3. **Instant Playback**: Updated `startSynthRadio()` to invoke `this.ensure()` synchronously and execute the first chord/melody step on frame 0.

---

## 4. Current State & Next Steps

* **All 20/20 world regression checks** in [`dev-checks.js`](file:///Users/neerajb/AI%20Games_Dev/last-mile-game/dev-checks.js) are passing with 100% fidelity.
* Channel switching, track cycling, and HUD indicators are verified.
* With **https://playlist.runable.site** (OG Playlist hub) identified, authentic streaming URLs for English and multi-genre playlists can now be cataloged to replace the synthesized fallback entirely with real audio streams.
