---
date: 2026-09-22
type: architecture
tags:
  - architecture
  - last-mile-game
  - onboarding
  - gameplay
ai-first: true
---

# Onboarding & Delivery Loop Architecture

## For future agent
Architecture documentation for the first-60-seconds onboarding tutorial flow and the closed-form ballistic express drop delivery mechanics in [[Projects/Last-Mile Game|Last-Mile Game]].

## Overview
Replaced legacy clunky on-foot courier disembarking with 100% vehicle-centric gameplay. Deliveries are executed via drive-by Express Ballistic Drops with proximity detection (<75m) and radar waypoint guidance.

## First-60-Seconds Onboarding State Machine
Structured step-by-step introduction for first-time drivers:
1. **Step 1: Ignition & Throttle**: Prompts player to accelerate (`[W] / [▲]`) and steer toward the highway.
2. **Step 2: Road Radar & Target Acquisition**: Highlights the amber diamond `◆` on the GPS curvature radar minimap as the delivery villa approaches.
3. **Step 3: Approach & Ballistic Express Drop**: When within $65\text{m}$, ambient breathing amber border appears and `[SPACE]` / `DROP` action button pulses.
4. **Step 4: Payout & Streak Celebration**: Package flies in an arc onto the plinth, triggering confetti particle burst, fee payout (e.g. ₹85), and streak multiplier.

## Closed-Form Ballistic Trajectory
Calculates 3D parabolic launch velocity $(v_x, v_y, v_z)$ from vehicle position to destination parcel plinth ring:
$$\vec{v} = \frac{\vec{P}_{\text{target}} - \vec{P}_{\text{vehicle}}}{t_{\text{flight}}} + \frac{1}{2}\vec{g} t_{\text{flight}}$$
Ensures parcels land dead-center on the delivery plinth with authentic gravity arc from up to 65m away while cruising at high speed.

## Links
- [[Projects/Last-Mile Game]]
- [[Architecture/ShiplypEngine]]
- [[Architecture/SaveAndCareerSystem]]
