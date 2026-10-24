# B180–B187: Portal-ready build

**Date:** 2026-10-24

The game now ships everything it needs inside its own package. The 3D library and the fonts are bundled, so the website, the Android app and the web-portal download no longer depend on outside servers, and the Android app no longer needs an internet connection just to start. All three builds are made from one shared recipe, and the web build is cached between visits instead of being downloaded again each time.

Player-facing changes:
- **First-time players start driving straight away.** Players with no career history skip the start screen. Returning players still see it.
- **The game pauses and goes quiet when the tab is hidden.** Portals expect this.
- **Ads now pause and mute the game properly.** Before, the game could keep running and playing sound under an ad.
- **The game starts even when the browser blocks saved data**, as happens inside some portal pages.
- **Older saves missing some career fields no longer blank the start screen.**

Behind the scenes: automatic checks now run on every change to the web build. They confirm nothing is loaded from outside, the download stays within budget, and the game starts and drives on desktop and phone sizes.

Still to do for portals: the portal advertising kit set-up, accounts, and a real-phone performance check.

Related: [[Projects/Last-Mile Game]]
