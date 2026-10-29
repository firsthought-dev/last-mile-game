# 2026-10-28 - Comic Callouts In Game

Part of the comic callouts work, on its own branch. Not merged. The game never pauses for any of these; the 3D world keeps its normal look.

## What players see
- **Delivery banner.** Each drop shows one comic banner in the top-right: the amount, the delivery number, a short quip for how fast it was (express, on time, late, photo finish, missed) and the streak on the star burst. It replaces the old result card and the "delivery complete" notice, so a drop shows one banner instead of two panels.
- **The customer answers.** On every drop, a speech bubble pops up at the house with a phone emoji in a comic burst. The line depends on what was ordered (a meal, a drink, fresh produce, sweets, news, papers, electronics, first aid) and how fast you were. First aid gets relief and thanks only.
- **Confetti only on express drops.**
- **Pedestrians react.** Jump a red light and a person waiting at that crossing speaks up; with nobody in sight you get a small banner instead. Ride fast past someone on the footpath and they complain (tea-stall customers too). These never add wanted stars. One bubble at a time, a short quiet gap between them, no line repeats until the pool is used up, and a third red light within a minute gets a police-watch line. Off during the first delivery.
- **The police chase is told with callouts.** A WANTED burst with the reason, "WEE-OO WEE-OO" lettering, a shout from the unseen officer on the siren side that gets bolder with every star, speed lines under the HUD from three stars, and bystanders cheering or gasping. "LOST 'EM!" when the stars wear off. The settle-up box is restyled in the same comic look: the officer speaks from a bubble and the answers are comic buttons; nothing about how it plays changed.
- Other moment notices (promotion, time's up, district entered) are comic banners too. System messages (locked vehicle, sponsor cooldown, ad unavailable) stay plain.

## Follow-up: no clutter on any screen (2026-10-29)
- Callouts no longer cover the rider, the road ahead or the map on any screen size, from small phones to wide desktops, portrait and landscape. One notification at a time: a new one replaces the one showing (B215).
- One comic banner at a time, smaller on phones and smaller again on short and landscape screens; a house reaction shrinks to a short line or just the emoji where there is no room; the chase shows a small WANTED badge next to the star chip. At most two callouts on screen at once.
- A permanent automated check now runs in the build and fails if a screen shape gets cluttered again.
- The in-game HUD now scales with the screen and gives every panel its own place, so the order card, speed, WANTED stars, road map and controls no longer overlap on any phone, tablet or desktop, portrait or landscape, and the road and rider stay clear.

## Notes
- Every order now has a kind and a short name so lines match the cargo.
- No setting for callout frequency; the limits above are the only control.
- Not yet seen on a real phone or on older emoji fonts.

[[Projects/Last-Mile Game]]
