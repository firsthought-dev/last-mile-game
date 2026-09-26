# 2026-09-27 — B111 Restore Mobile Steer Buttons
Cycle/scooter hid the ◀▶ touch steer cluster (`d7101bc`) in favour of an invisible drag zone, so mobile players saw no steering. Removed the CSS hide rule in `style.css`; the buttons show for all vehicles and the drag zone stays as an optional input. The radar stays docked above them (bottom 124px), so there is still no overlap. See BUGFIX_LOG B111.

**Status:** merged to main via PR #9 (`023f855`). Browser-checked at 390×844 and 360×780; on-device Android check pending.
