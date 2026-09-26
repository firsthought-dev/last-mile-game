# 2026-09-27 — B114 Remove Photo Mode; Split Auto Steer / Auto Drive
- Photo/postcard mode removed completely (HUD, touch drawer, `P` key, modal).
- The single AUTO/Autopilot control is now two exclusive assists:
  - **Auto Steer** (`F`, A-STEER): the original autopilot, which steers and controls speed.
  - **Auto Drive** (`G`, A-DRIVE): speed only. It speeds up on straights and eases off for bends ahead; the player steers.
- Braking turns off either one. See [[Architecture/Auto Assists]] and BUGFIX_LOG B114.

**Status:** merged to main via PR #10 (`e66f223`). Browser-tested; on-device Android check pending.
