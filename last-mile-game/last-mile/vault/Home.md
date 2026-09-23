---
date: 2026-09-22
tags:
  - home
  - dashboard
  - cockpit
aliases:
  - Dashboard
  - Cockpit
---

# 🚀 Shiplyp Master Cockpit

> **High-Level Executive HUD**: One-screen operational view of the entire codebase, current engineering status, active tasks, and publishing roadmap.

---

## ⚡ Live Executive Summary

| Metric | Current Status | Reference Link |
| :--- | :--- | :--- |
| **Project** | **Shiplyp (Last-Mile Indian Courier Driving Game)** | [[Projects/Last-Mile Game\|🎮 Project Hub]] |
| **Current Build** | **B86 Live (Desi Horn, Postcard Photo Mode, Shift Loop)** | [[Dev Logs/2026-09-22 - B86 Desi Horn Postcard Photo Mode and Shift Milestone Loop\|📝 Latest Dev Log]] |
| **Automated Tests** | **35 / 35 Checks Passing (100% Green)** | `scratch/verify_portrait.js` |
| **Active Target** | **Google Play Store SDK 35 & Web Game Portals** | [[Knowledge/Anul Agarwal AI Game Dev & Multiplatform Publishing Blueprint\|💡 Publishing Blueprint]] |
| **Active Sprint** | **Web Portal Ad SDK Module & ZIP Exporter** | [[Boards/Engineering\|📋 Engineering Board]] |

---

## 🏛️ The 4 Core Architecture Pillars

```
+-----------------------------------------------------------------------------------+
|                                 SHIPLYP ENGINE                                    |
+-------------------------+-------------------------+-------------------------------+
| 🏗️ Core World & Engine  | 🎮 Gameplay & Economy   | 📱 Mobile & Native Android    |
| • [[Architecture/ShiplypEngine|ShiplypEngine]]         | • [[Architecture/SaveAndCareerSystem|Career Save Layer]]      | • [[Architecture/MobileTouchAndErgonomics|Mobile Touch & Drag-Steer]]  |
| • [[Architecture/ProceduralWorld|Procedural World]]       | • [[Architecture/OnboardingAndDeliveryFlow|Onboarding & Express Drop]]| • [[Architecture/AndroidStudioBridge|Android Studio (SDK 35)]]  |
| • [[Architecture/VisualStyleManager|Visual Shaders]]       | • Vehicle Fleet Gating   | • Zero-Overlap 4-Quadrant HUD |
| • [[Architecture/SoundEngine|Web Audio Synthesis]]  | • 5-Drop Shift Milestones| • Dynamic Portrait 75° FOV    |
+-------------------------+-------------------------+-------------------------------+
|                          🚀 Commercialization & Distribution                      |
| • [[Knowledge/Anul Agarwal AI Game Dev & Multiplatform Publishing Blueprint|Anul Agarwal Multiplatform Strategy]] · [[Projects/AI Game Generation Tool & Multiplatform Distribution|AI Game Maker Tool Hub]]             |
+-----------------------------------------------------------------------------------+
```

---

## 📋 High-Priority Work & Next Steps

```dataview
TABLE WITHOUT ID
  file.link AS "Note",
  type AS "Type",
  date AS "Date"
FROM "Dev Logs"
SORT file.name DESC
LIMIT 5
```

---

## 🗺️ Visual Architecture Map

Open **[[atlas.canvas|🗺️ Visual System Atlas (atlas.canvas)]]** to view the full 2D interactive architecture flowchart with color-coded subsystems and directional data flow.

---

## 🛠️ Quick Commands & Entrypoints

| Action | Path / Command |
| :--- | :--- |
| **Local Game Server** | `http://localhost:8085/last-mile/index.html` |
| **Sync Assets to Android** | `./last-mile/sync_android_assets.sh` |
| **Android Studio Project** | `last-mile/android/` |
| **Automated Regression Suite**| `dev-checks.js` (`runWorldChecks()`) |
