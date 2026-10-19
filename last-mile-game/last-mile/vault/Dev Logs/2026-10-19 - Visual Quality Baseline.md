# 2026-10-19 - Visual Quality Baseline

Started a visual quality overhaul. The goal is a richer stylized look that moves past flat low-poly, on web and Android, with Slow Roads as the quality reference.

- Captured a fixed set of reference frames for both visual styles at dawn, day, dusk and night, on desktop and phone screens, plus performance numbers. Every later change gets compared against these.
- The frames show the main problems to fix: washed-out colour in the Cinematic style, stray outlines on distant buildings in the Crisp style, and trees in mismatched styles.
- First fix (B145): far-away rocks and roadside barriers are no longer drawn when they are off screen. The game does about 60% less drawing work, looks the same, and now holds a steady 60 FPS on the Android emulator (it was 28 to 35 with stutters).
- Second fix (B147): on phones the game now draws at a lower internal resolution when it needs to, and goes back to sharper when there is headroom. The look stays soft and clean, and the saved effort goes toward richer visuals next.
- Third change (B148): the round leafy trees are now real foliage: layered clusters of leaves with branches showing, instead of flat dark blobs. The pines are unchanged. It runs at a steady 60 FPS on the Android emulator.
- Fourth change (B149): the road's centre line is now clearly visible all the way down the road, including on newly generated stretches, instead of only showing up close to the bike. The edge lines are also placed consistently along the whole route.
- Pines (B151): the pine trees are now fuller, layered firs, and they only grow on hilly stretches of the road, never mixed in with the leafy trees.
- Road surface and footpath (B152, B155): the asphalt shows wear (wheel tracks, patches, hairline cracks) and the footpath is textured, weathered concrete with a quieter kerb, so it no longer stands out against the road.
- Grass and ground (B150 to B168): the ground now uses a real grass photo texture across the whole landscape, and the district grass colours are warmer and more olive. Plants appear only along the footpath edge and as flower borders around houses, stalls and garages, always leaving the frontage and the way to the door clear.
- Plants use real free (CC0) plant models and photos rather than generated art. Slow Roads was used only as a reference for look and feel; nothing was copied from it.
- Still to do: check performance on a real Android phone before merging, and soften the haze on distant hills.

Project: [[Projects/Last-Mile Game]]
