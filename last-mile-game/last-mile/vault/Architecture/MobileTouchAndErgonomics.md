---
date: 2026-09-22
type: architecture
tags:
  - architecture
  - last-mile-game
  - mobile
  - touch-ui
ai-first: true
---

# Mobile Touch Controls & Zero-Overlap HUD Ergonomics

## For future agent
Architecture note for mobile viewport responsiveness, touch input clusters, drag-to-steer physics, and zero-overlap layout geometry in [[Projects/Last-Mile Game|Last-Mile Game]]. Read this before adjusting CSS layout coordinates, touch event handlers, or camera aspect ratio calculations.

## Overview
Shiplyp is designed for seamless dual-mode play: desktop keyboard/mouse and mobile touchscreen (portrait and landscape orientations).

## Core Touch Subsystems

### 1. Zero-Overlap 4-Quadrant HUD Layout
- **Top-Left**: Floating Mission Capsule (order destination, dynamic distance, earnings reward fee).
- **Top-Right**: Telemetry Box (speedometer, `PEDAL`/`DRIVE` gear, streak multiplier) + Utility Pills (`[🤖 AUTO]` and `[⚙️ TOOLS]` opening `#touch-tools-drawer` with labeled `CAMERA VIEW`, `RECENTER CAR`, `PHOTO MODE`, and `HORN / BELL` actions).
- **Bottom-Left**: Steering Zone (`◀` `▶` touch buttons for cars, plus dedicated `.touch-drag-steer` swipe zone bounded strictly below `112px` height, with `.slowroads-radar-box` elevated to `bottom: 124px; left: 12px;` to guarantee 0px collision).
- **Bottom-Right**: Throttle (`▲`) and Brake (`▼`) dual pedals + glowing amber pulsating **DROP** action button centered cleanly above the pedal pair with 12px clearance (`align-items: center; margin-bottom: 6px;`).
- Guaranteed $>114\text{px}$ clear central viewport sky clearance on all phone sizes (tested on iPhone 16, Galaxy A55, Pixel 9).

### 2. Bicycle Analog Drag-to-Steer
- When driving the delivery bicycle (`cycle`), touch steering switches to an analog swipe bar (`.touch-drag-steer`).
- Dynamic Indicator Ring: Invisible (`opacity: 0`) when idle; appears dynamically under the player's thumb (`opacity: 1`) on `pointerdown` and tracks touch movements without ever obscuring the radar.
- Swiping horizontally directly modulates `keys.steerInput` across continuous range $[-1.0 \dots 1.0]$.
- Triggers hardware haptic vibration feedback (`navigator.vibrate(8)`) at touch down.

### 3. Dynamic Camera Vertical FOV Adaptation
- Desktop / Landscape Viewport: $58^\circ$ base FOV.
- Portrait Viewport ($\text{aspect} < 1.0$): Automatically scales up to $75^\circ$ vertical FOV to maintain deep forward road sightlines and prevent claustrophobic vehicle framing.

## Links
- [[Projects/Last-Mile Game]]
- [[Architecture/VehicleController]]
- [[Dev Logs/2026-09-20 - B80-B81 Mobile Touch UI Overhaul and Driving Physics]]
