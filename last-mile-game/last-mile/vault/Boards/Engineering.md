---

kanban-plugin: board

---

## 📥 Backlog

- [ ] 🟢 **Review Enhanced style fog override (0.017, ~89 m)** · @{2026-09-26}
	Same override pattern as the B100 Classic bug; check it at dusk and night. [[Architecture/VisualStyleManager]]
- [ ] 🟢 **Google Play Store Release Assets & Signing** · @{2026-09-28}
	Setup release keystore, icon/banner metadata packaging, and AAB generation for Google Play Store. [[Projects/Last-Mile Game]]
- [ ] 🟢 **AI Game Maker Prompt Orchestrator Prototype** · @{2026-10-05}
	Build prompt-to-Phaser/Three.js game generation pipeline with structured schema validation. [[Projects/AI Game Generation Tool & Multiplatform Distribution]]

## 🏃 Sprint

- [ ] 🔴 **Anul Agarwal Multiplatform Strategy & Milestone Tracking** · @{2026-09-22}
	Maintain continuous tracking against Anul Agarwal workflow blueprint across all sessions. [[Knowledge/Anul Agarwal AI Game Dev & Multiplatform Publishing Blueprint]]

## 🔨 In Progress

- [ ] 🟡 **Prop upgrade pass: tapri ✅ → houses ✅ → repair shop ✅ → lamps/poles ✅ → fences + guardrails ✅ → signs ✅** · @{2026-09-24}
	Modeled GLB props in Blender to replace box-built roadside props. Tapri polished (12.9k tris), 3 house variants in houses.glb, building-inside-house placement bug fixed. [[Projects/Last-Mile Game]]



## ✅ Done

- [x] B108/B109 far-road density: shared spawners stream lamps, poles, signs, milestones, repair shops, motor garage, bus shelters, gantries, monuments, city buildings #done
- [x] ~~🔴 **B107: Sidewalk Guardrail Lateral Offset Mismatch & Post Embedment Grounding**~~ ✅ 2026-09-23
	Centralized barrier lateral offset to `getBarrierLateralDistance()` (5.45 m, flush 10 cm inset from sidewalk outer boundary), removed `+0.05` artificial lift, deepened Armco posts to 1.6 m (-1.05 translation, 50 cm embedment), lowered wall course heights, added dev checks 31 & 32. 37/37 checks green. [[Dev Logs/2026-09-23 - B107 Sidewalk Guardrail and Barrier Grounding Alignment]]
- [x] ~~🔴 **B106: Android 15 (API 35) DecorView WindowInsetsController Crash Fix**~~ ✅ 2026-09-23
	Fixed startup NullPointerException on Android 15 by moving `setImmersiveMode()` after `setContentView()` and adopting `WindowCompat.getInsetsController()`. Tested and driving at 31 km/h. [[Architecture/AndroidStudioBridge]]
- [x] ~~🔴 **B105: Android WebView Performance & DevTools Remote Debugging**~~ ✅ 2026-09-23
	Removed redundant `LAYER_TYPE_HARDWARE` FBO blit from MainActivity.kt, enabled `WebView.setWebContentsDebuggingEnabled(true)`, generated Gradle 8.4 wrapper, and re-assembled `app-debug.apk`. [[Architecture/AndroidStudioBridge]] [[Dev Logs/2026-09-23 - B105 Android WebView Performance and DevTools Remote Debugging]]
- [x] ~~🔴 **B100: Classic style fog & night posterize**~~ ✅ 2026-09-23
	Classic fog 0.026 → 0.009; gamma-space posterize so darks no longer go black. 35/35 checks. [[Dev Logs/2026-09-23 - B100 Classic Style Fog and Night Posterize Fix]]
- [x] ~~🔴 **GitHub Pages: deploy current game, stop publishing vault**~~ ✅ 2026-09-23
	[PR #4](https://github.com/firsthought-dev/last-mile-game/pull/4) merged as `453c90f` and deployed. Site root serves the current game (runtime files 200; live load has 0 errors); `/last-mile/`, vault and Android paths return 404. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **Merge roadside-npcs → main**~~ ✅ 2026-09-23
	[PR #3](https://github.com/firsthought-dev/last-mile-game/pull/3) merged as `1d8634f`: roadside NPCs, career/save layer, onboarding, B80–B99. [[Projects/Last-Mile Game]]
- [x] ~~🟢 **verify_phase1.js reads speeds from CONFIG**~~ ✅ 2026-09-23
	BASE/CEIL read from CONFIG.VEHICLES.cycle, so tuning changes no longer break the script; STEER_PENALTY still hardcoded (not in CONFIG). 10/10 pass. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B99: Roadside NPCs floating / sinking**~~ ✅ 2026-09-23
	Height from nearest road point to current position, not spawn point. See BUGFIX_LOG B99. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B98: Physics-based cycle lean (tan θ = v·ω/g)**~~ ✅ 2026-09-23
	Lean from measured yaw rate, capped 32°; autopilot now leans through bends. [[Dev Logs/2026-09-23 - B96-B98 Cycle Speed, New Courier Bicycle Model and Physics Lean]] [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B97: New courier bicycle model with spinning wheels**~~ ✅ 2026-09-23
	Blender MCP: Shiplyp palette, Wheel_Front/Wheel_Rear on axle origins, box logo decal, 1.09 MB GLB. [[Dev Logs/2026-09-23 - B96-B98 Cycle Speed, New Courier Bicycle Model and Physics Lean]] [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B96: Cycle speed 32→52 km/h + hotkey ReferenceError fix**~~ ✅ 2026-09-23
	Was stuck at 22 km/h; steer penalty 15%; every hotkey except F was throwing. [[Dev Logs/2026-09-23 - B96-B98 Cycle Speed, New Courier Bicycle Model and Physics Lean]] [[Projects/Last-Mile Game]]
- [x] ~~🟡 **Add assertions to verify_phase1.js**~~ ✅ 2026-09-23
	Pass/fail checks on cruise speed, 30% steer penalty, recovery, maxSpeed ceiling, held escalation, coupe isolation, console errors; exits 1 on failure. Confirmed it fails against the old 6.11 cap. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B95: Fix Verification Pass & Cycle Speed Escalation Cap Fix**~~ ✅ 2026-09-23
	Re-verified B88–B94 via all scratch scripts; fixed dead B88 escalation (cycle.maxSpeed 6.11 → 10.56). 35/35 checks green. [[Dev Logs/2026-09-23 - B95 Fix Verification Pass and Cycle Speed Escalation Cap Fix]] [[Projects/Last-Mile Game]]
- [x] ~~🟡 **B94: Web Portal Ad SDK Integration & Distribution Packaging**~~ ✅ 2026-09-23
	Implemented modular adapter for GameDistribution, CrazyGames, and Poki HTML5 Ad SDKs (ads.js) with rewarded 2x shift earnings and ₹500 hub sponsor credit. Created one-click web portal zip packager (package_web_portal.sh). 35/35 checks green. [[Architecture/AdSdkAndMonetization]] [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B93: Mobile HUD Mystery Buttons Overhaul, Radar-Steering Collision Fix & Bicycle Telemetry Polish**~~ ✅ 2026-09-23
	Replaced cryptic 5-emoji row with [🤖 AUTO] and [⚙️ TOOLS] drawer (CAMERA, RECENTER, PHOTO, HORN), hid idle steering circle, fixed radar-steering bounding box collision (0px overlap), added dynamic PEDAL gear for bicycle, centered DROP button with 12px clearance. 35/35 checks green. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B92: Boot/Reload Vehicle Lock Desync & Inventory Reconciliation**~~ ✅ 2026-09-22
	Fixed exploit where refresh/style change granted locked Muscle Coupe for free. Implemented defensive profile reconciliation in save.js and Game.reconcileSelectedVehicle() across init, build, startDrive, hub, and dock switcher. 35/35 checks green. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B91: Delivery Cycle Smooth Ride & Dynamics Overhaul**~~ ✅ 2026-09-22
	Eliminated destructive speed drain on steering, added progressive steering filter (1.65 rad/s), soft critically-damped suspension (omega 13-14, zeta 1.05), realistic 1.1-1.45 Hz pedaling cadence with coasting glide, and cycle-specific steadycam framing (5.6m back, 2.1m up). 35/35 checks green. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B90: Intro Screen Arcade Typography Overhaul & Mobile Autopilot Control**~~ ✅ 2026-09-22
	Replaced sterile fine-print Dispatch Hub with Bebas Neue & Bungee arcade dispatch license, interactive mobile 🤖 AUTO pill with active cyan glow, audio chimes, haptics, and HUD toast. 0 overlaps across 5 devices, 35/35 checks green. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B89: Complete Game UI Overhaul to Pack 4 Comic & Arcade Dispatch**~~ ✅ 2026-09-22
	Replaced AI slop fonts with Russo One + Chakra Petch + Barlow, full comic ink & pop shadow system, tactile button clicks, mobile zero-overlap ergonomics verified across 5 devices, 35/35 checks green. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B88: Delivery Cycle Speed Escalation & Steering Penalty**~~ ✅ 2026-09-22
	Cycle speed escalation 22 -> 38 km/h over 120s, 30% max lateral steering reduction with 0.5s neutral recovery. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B87: Vehicle Price Pacing, Hub Card Wireframe Cleanup & FTU Banner Contrast**~~ ✅ 2026-09-22
	Reduced Muscle Coupe to ₹6,000, removed canvas wireframes on intro cards, restyled FTU explainer with high-contrast palette. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B86: Desi Horn, Postcard Photo Mode & Shift Milestone Loop**~~ ✅ 2026-09-22
	Procedural desi horn/bell audio synthesis, 1-tap postcard snapshot export, 5-delivery shift summary modal. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B85: Vehicle Progression Economy & Mobile Drag-to-Steer**~~ ✅ 2026-09-22
	Career earnings gating, bottom-sheet unlock modal, canvas 2D vehicle preview, touch drag-to-steer zone, 35/35 checks green. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B84: World Streaming Beyond 6km Floor & Seam Fixes**~~ ✅ 2026-09-21
	Switchback height bounds, in-situ floor carving down -25m, 150m mountain skirt, chunk seam snapping. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B83: Continuous Spatial Road Clearance Clamping**~~ ✅ 2026-09-21
	Continuous line-segment projection, 0 paved breaches across 4,203 scan points. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B82: Standalone Native Android Studio Wrapper**~~ ✅ 2026-09-21
	Hardware-accelerated WebView, compileSdk 35, offline asset loader, sync script. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B81: Zero-Overlap Mobile Touch HUD Ergonomics**~~ ✅ 2026-09-20
	Zero bounding box HUD collisions on mobile viewports. [[Projects/Last-Mile Game]]
- [x] ~~🔴 **B80: Mobile Auto-Rotate & Driving Physics Overhaul**~~ ✅ 2026-09-20
	Dynamic portrait FOV (75 deg), bike camber lean, multi-gear torque curves. [[Projects/Last-Mile Game]]

%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false,false,false,false]}
```
%%
