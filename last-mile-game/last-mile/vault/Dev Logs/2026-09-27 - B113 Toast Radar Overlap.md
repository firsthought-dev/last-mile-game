# 2026-09-27 — B113 Toast/Radar Overlap + Radar Distance Line
On mobile, the notification panel (bottom 180px) slid under the radar box (bottom 124px, ~96px tall, z 55), which clipped delivery toasts. It now sits at bottom 236px in the mobile media query, 16px above the radar at 375×812. The radar header is now stacked, so the distance is on its own line. Android debug APK rebuilt. See BUGFIX_LOG B113.

**Status:** merged to main via PR #10 (`e66f223`). Browser-tested; on-device Android check pending.
