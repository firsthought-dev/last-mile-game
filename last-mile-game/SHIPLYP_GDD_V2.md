# Shiplyp: Last Mile — Game Design Document v2

**Status:** Matches the shipped build as of 2026-08-24 (`game.js`, single-file Three.js app).
**Supersedes:** `DELIVERY_GAME_GDD_1.md` (the 2D four-track Godot/Phaser design — never built; 0 of its 10 core mechanics exist in the current codebase; archived at `_archive-2d-prototype/`).
**Genre:** 3D procedural arcade driving + delivery, browser-based.
**Comparison:** *Slow Roads* meets *Crazy Taxi*, wrapped in a low-poly Indian-city aesthetic.

Every section below is marked:
- 🟢 **Built** — exists and works in `game.js` today, with a file:line reference.
- 🟡 **Recommended** — my proposal for what to add next, chosen to extend the existing 3D driving core rather than replace it.

---

## 1. Concept & Pitch

🟢 **Built.** A single continuous 3D driving delivery loop. You pick a city, a difficulty tier, and a vehicle, then drive a procedurally generated road network delivering cargo to waypoint markers before a shift timer runs out. Potholes, speed cameras, and repair bays punctuate the route. Deliveries chain into a streak multiplier. The whole thing runs in one HTML page — no build step, no engine, no install.

**Why this pitch, not the original one:** the four-track 2D vision (newspaper/milk/e-commerce/post-office mini-games) was never built and would require a ground-up rewrite in a different engine. What *was* built — procedural terrain, spline-based road generation, a working chase-cam driving feel, a real delivery loop — is a legitimate, distinctive game on its own. This document designs forward from that, instead of asking you to discard 4,000 lines of working code to chase a design that was abandoned in practice.

---

## 2. Core Pillars

### 2.1 Procedural Variety 🟢 Built
Five cities ([game.js:471-477](game.js:471)), each with distinct road-generation tuning (winding weight, max grade) and a paired season palette. Four road surfaces (asphalt/gravel/mud/sand) with different grip multipliers ([game.js:397-402](game.js:397)). Four time-of-day states with full sky/lighting/cloud changes ([game.js:404-469](game.js:404)). No two runs look identical — the road spline, terrain noise, and prop placement are seeded per session.

### 2.2 Readable Risk 🟢 Built
Health (0–100%) is the single vehicle-condition stat. Potholes cost 14% ([game.js:2208](game.js:2208)), speeding past a camera costs ₹150 ([game.js:2246](game.js:2246)), a repair bay heals to 100% ([game.js:2265](game.js:2265)). Every hit surfaces through one unified notification panel — no popup spam, no ambiguity about what just happened.

### 2.3 Momentum as Reward 🟢 Built
Consecutive on-time deliveries build a streak multiplier that compounds the payout ([game.js:2676](game.js:2676): `reward × payoutMult × (1 + streak × 0.2)`). The loop rewards *not stopping*, which fits a driving game better than a stop-and-go mini-game structure would.

### 2.4 Fair Difficulty Scaling 🟢 Built
Three tiers — Relaxed Shift (55s/delivery, ×1.0 payout), City Standard (36s, ×1.5), Rush Hour Express (22s, ×2.5) — trade time pressure for money ([game.js:487-489](game.js:487)). Picked once at the dispatch hub, not gated behind progression.

---

## 3. What's Actually in the Build

### 3.1 Vehicles 🟢 Built (partial — stats only, see §7.1 for recommended depth)

| Vehicle | ID | Top Speed | Accel | Brake |
|---|---|---|---|---|
| Raftaar GT Hatch | `swift` | 44.0 | 18.0 | 30.0 |
| Gaja 500 Mini-Truck | `chotahathi` | 30.0 | 12.0 | 26.0 |
| Vayu Volt Scooter | `scooter` | 34.0 | 16.0 | 24.0 |
| Pawan Pedaler Bike | `cycle` | 22.0 | 10.0 | 20.0 |

Source: [game.js:479-484](game.js:479). All four share identical handling logic and identical health/damage rules — the differentiation today is purely a speed/accel curve, selected once at the dispatch hub with no unlock gate.

### 3.2 The Delivery Loop 🟢 Built
- 8 named orders with flavor cargo text, cycled semi-randomly ([game.js:492-501](game.js:492))
- GPS waypoint arrow + distance readout ([index.html:130-134](index.html:130))
- Drop cargo via Space near the marker; reward scales with time remaining + streak
- Shift target: 12 deliveries ([game.js:2807](game.js:2807))
- Miss the timer → −₹25, streak resets to 1 ([game.js:2490-2495](game.js:2490))

### 3.3 Hazards 🟢 Built
- **Potholes** — random road-surface hits, −14% health, 800ms cooldown to prevent damage-spam
- **Speed cameras** — e-challan fine if clocked over the limit
- **Repair bays** — free full heal, placed periodically along the route
- Environment collision (trees/rocks/buildings) is intentionally **disabled** — collisions are restricted to potholes/debris only, per a prior explicit decision this session

### 3.4 Feedback & UI 🟢 Built
- Unified notification panel (warning/danger/success/neutral), auto-dismiss, bottom-right
- Live health bar, earnings counter, streak pill, delivery count
- Radio with real streaming station + synth fallback, user-preference-gated (no autoplay)
- Dispatch hub: region/difficulty/vehicle selection, fully responsive (375px–1600px+, fixed this session)
- In-shift dock bar: routes/environment/vehicles panels, time-of-day/season/road-surface pickers, all switchable mid-drive

### 3.5 Persistence 🟢 Built (minimal)
`localStorage` currently stores exactly one value: radio on/off preference ([game.js:166](game.js:166)). Earnings/streak/delivery-count survive a pause via an in-memory checkpoint but **do not survive a page reload** — there is no save file, no cross-session progress, no unlocks.

---

## 4. Technical Reality

🟢 **Built.** Single-file Three.js r128 application (~4,000 lines `game.js` + `style.css` + `index.html`). No build pipeline, no bundler, no engine (not Godot, not Phaser — the original GDD's entire §10 is moot). Procedural terrain via 4-octave FBM noise with domain warping ([game.js:528-542](game.js:528)); road spline generated via a cost-scored angle/slope/repulsor search ([game.js:544-658](game.js:544)); terrain-embankment carving with matched prop-height sampling (fixed this session). This is a real technical asset — it's what makes every drive feel different without hand-authored levels.

**Implication for scope:** every future feature should be addable within this single-file architecture without requiring an engine migration. That constrains what's realistic (see §7).

---

## 5. What's Explicitly Not Built

For the record, cross-checked against the old GDD so nothing gets silently assumed to exist:

- ❌ Toss / balance / measure / OTP / route-puzzle / sorting mechanics
- ❌ Dogs, cows, thieves, traffic AI, pedestrians
- ❌ Weather with gameplay effect (seasons are cosmetic only; road-surface grip is manually selected, not weather-driven)
- ❌ Star ratings, NPC memory, subscriber/relationship systems
- ❌ Levels, tracks, unlock chains, upgrade trees
- ❌ Company/agent management endgame
- ❌ Any monetization surface
- ❌ Cross-session save/progress

None of this is a defect — it's just outside what a single continuous arcade shift needs. The recommendations below are chosen to close the gaps that matter most for replay value, not to recreate the old GDD's scope.

---

## 6. My Recommendation

Keep the 3D driving core as the spine. Don't rebuild toward four 2D mini-game tracks — that throws away the one thing that's genuinely good and hard to redo (the procedural world). Instead, layer **persistence, vehicle differentiation, and light dynamic hazards** onto the existing loop. These three additions compound with what's already built instead of competing with it.

### 6.1 Why persistence first
Right now every session starts from zero — same 8 orders, same vehicle stats, nothing carried forward. A player who plays three times has three identical first sessions. The single highest-leverage change is making `localStorage` actually store progress (earnings history, best streak, unlocked vehicles/cities) — it's a small technical lift (the pattern already exists for the radio preference) with a large replay-value payoff.

### 6.2 Why vehicle differentiation second
Four vehicles that differ only in a speed curve is a menu, not a choice. Giving each vehicle one real tradeoff (see §7.1) makes the dispatch-hub selection screen — which is already fully built and responsive — actually matter.

### 6.3 Why light hazards third, not heavy simulation
Dogs/cows/thieves as full AI systems (per the old GDD) would be a significant scope addition. A cheaper version — static or lightly-scripted roadside events that cost time or health, reusing the existing pothole/notification plumbing — gets 80% of the flavor for a fraction of the build cost.

---

## 7. Recommended Feature Set

### 7.1 Vehicle Identity 🟡 Recommended
Give each vehicle one defining tradeoff instead of a flat stat block:

| Vehicle | Tradeoff |
|---|---|
| Cycle | Immune to speed-camera fines (too slow to trigger them); halves pothole damage (light weight); lowest top speed |
| Scooter | Fastest accel, but health degrades 2× faster from potholes (fragile) |
| Hatch | Balanced — the "no tradeoff" default, good for new players |
| Mini-Truck | −20% top speed, but delivery reward ×1.15 (implies bulk capacity) and repair-bay heal is instant vs. a short dwell time for others |

This reuses the existing `health`/`payoutMult` systems — no new state machine required, just per-vehicle multipliers read at the existing damage/reward calculation sites ([game.js:2208](game.js:2208), [game.js:2676](game.js:2676)).

### 7.2 Persistent Progress 🟡 Recommended
- Store cumulative lifetime earnings, best streak, and total deliveries in `localStorage`, keyed like the existing `shiplyp_radio_pref` ([game.js:166](game.js:166))
- Unlock the Mini-Truck and Delhi/Bengaluru cities behind a lifetime-earnings threshold (e.g. ₹5,000) instead of having everything available from the first launch — turns the dispatch hub into a light meta-progression screen rather than a static menu
- Add a simple "Best Shift" stat shown on the dispatch hub, so returning players have something to beat

### 7.3 Roadside Events 🟡 Recommended
Reuse the existing prop-placement pass ([game.js:1045](game.js:1045), where potholes/signs/repair-bays already spawn along the spline) to add two new light events:
- **Stray dog** — a static/lightly-animated roadside prop within honking range; press a key to honk and it scatters, otherwise it costs a small time penalty if you clip it. No pathfinding, no chase AI — just a timing micro-interaction using the notification system already built.
- **Flooded dip** (monsoon season only) — a visual puddle zone on `mud`/low-lying road segments that forces a brief top-speed cap, tying the already-cosmetic season system into actual gameplay for the first time.

### 7.4 Delivery Rating 🟡 Recommended
On each drop, compute a 1–5 star rating from data the game already tracks: time remaining (existing `maxOrderTimer` countdown) and current health (existing stat). No new NPC system needed — just a formula over existing values, surfaced through the existing notification/score-banner UI ([game.js:2684](game.js:2684)).

### 7.5 What I'd explicitly avoid
- A company/agent-management endgame (§7 of the old GDD) — wrong genre for a single-file arcade driving game; would require a UI and data model this build has no foundation for
- OTP/toss/balance mini-games — would require an entirely separate interaction layer disconnected from driving; better suited to the abandoned 2D prototype, not this codebase
- Real-money monetization — premature before there's a progression loop worth paying to skip

---

## 8. Suggested Build Order

1. Persistence layer (§7.2) — foundation everything else builds on
2. Vehicle tradeoffs (§7.1) — makes existing UI meaningful
3. Delivery rating (§7.4) — cheap, reuses existing data
4. Roadside dog event (§7.3) — first new hazard type, proves the pattern
5. Weather-gated flood dip (§7.3) — ties cosmetic season system into gameplay last, once the pattern from #4 is proven

Each step is additive to the current single-file architecture — none require a rewrite, an engine change, or new external dependencies.

---

**Document Version:** 2.0
**Author:** Compiled from live codebase audit, 2026-08-24
