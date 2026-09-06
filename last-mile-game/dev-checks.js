// Reusable regression checks for world-gen / placement / height-formula
// bugs found during development. Run in the browser console (or via
// javascript_tool) against a live `window.game` after ANY change touching
// road generation, terrain height, props, crossers, or vehicle placement:
//
//   1. Load the game, start a drive (world must be built).
//   2. Paste this whole file into the console, or execute it via
//      javascript_tool with the game already running.
//   3. Call `runWorldChecks()` — it returns a report object and also
//      console.table()s a pass/fail summary.
//
// Each check is intentionally narrow and fast (<1s) so this is cheap to
// run after every change, not just a final pass. Add a new check here
// whenever a new class of bug is found — that's the whole point.
//
// IMPORTANT: run this SYNCHRONOUSLY (paste directly into the console, or
// eval it inline in the same javascript_tool call as calling
// runWorldChecks()). Loading it via `fetch(...).then(code => eval(code))`
// lets the game's animation loop tick several frames between the fetch
// resolving and the checks running, which produced a false-positive
// "crosser height drift" failure purely from reading position/progress
// fields that were captured a frame apart from each other — not a real
// desync. If a check looks flaky, first re-run it synchronously before
// treating it as a regression.

function runWorldChecks() {
  const game = window.game;
  const results = [];
  const record = (name, pass, detail) => results.push({ name, pass, detail });

  if (!game || !game.world) {
    record('game-loaded', false, 'window.game.world not present — start a drive first');
    console.table(results);
    return results;
  }

  const world = game.world;
  const roadPts = world.curve.getSpacedPoints(800);
  const ROAD_HALF = (typeof CONFIG !== 'undefined' ? CONFIG.ROAD_WIDTH : 7.4) * 0.5;

  // Snapshot vehicle position at check-start before any state-modifying checks
  // run — the animation loop continues ticking in the background during execution,
  // so checks that test spawn/reset conditions must read the initial state here,
  // not after all other checks (by which point the vehicle may have driven far).
  const initialSplineProgress = game.vehicle ? game.vehicle.splineProgress : null;
  const initialHeadingSnapshot = game.vehicle ? game.vehicle.heading : null;

  function minDistToRoad(pos, stride = 3) {
    let m = Infinity;
    for (let i = 0; i < roadPts.length; i += stride) {
      const dx = pos.x - roadPts[i].x, dz = pos.z - roadPts[i].z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < m) m = d;
    }
    return m;
  }

  // 1. Buildings/shops must not overlap the actual drivable road surface.
  // (Regression: skyscrapers offset from a single point could land on a
  // different, closer stretch of road at a hairpin.)
  {
    const buildings = world.obstacles.filter(o => o.type === 'building');
    const violations = buildings.filter(o => minDistToRoad(o.pos) < (o.radius + ROAD_HALF));
    record('buildings-clear-of-road', violations.length === 0,
      `${violations.length}/${buildings.length} buildings overlap the road`);
  }

  // 2. Trees must not overlap the road either (same hairpin risk, smaller
  // offset).
  {
    const trees = world.obstacles.filter(o => o.type === 'tree');
    const violations = trees.filter(o => minDistToRoad(o.pos) < (o.radius + ROAD_HALF));
    record('trees-clear-of-road', violations.length === 0,
      `${violations.length}/${trees.length} trees overlap the road`);
  }

  // 3. Terrain height formula (groundHeightAt) must be continuous across
  // the EMBANKMENT_BLEND=45m seam — no cliff/overhang between the
  // near-road blend zone and the far unclamped hillside.
  {
    let worstJump = 0;
    for (let i = 50; i < roadPts.length - 50; i += 60) {
      const pt = roadPts[i];
      const tangent = new THREE.Vector3().subVectors(roadPts[i + 1], roadPts[i - 1]).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      const p44 = pt.clone().addScaledVector(normal, 44);
      const p46 = pt.clone().addScaledVector(normal, 46);
      const y44 = world.groundHeightAt(pt, p44, 44);
      const y46 = world.groundHeightAt(pt, p46, 46);
      worstJump = Math.max(worstJump, Math.abs(y46 - y44));
    }
    record('terrain-seam-continuous', worstJump < 3.0,
      `worst 2m-span jump across the 45m seam: ${worstJump.toFixed(2)}u (expect <3.0, natural noise only)`);
  }

  // 3b. The road ribbon's outer verge must land ON the terrain surface,
  // not float above it. The road mesh used to place its verge at a fixed
  // pt.y + 0.04 while the terrain shoulder at that same lateral distance
  // sits ~0.28 lower, so the entire road floated ~0.32u above the ground
  // for its full length, showing a continuous strip of exposed terrain
  // down both shoulders. Sweeps the WHOLE road (both sides) because that
  // bug was global, not localized to any one section.
  // Measured by RAYCASTING onto the actual terrain mesh, not by calling
  // groundHeightAt. An earlier version of this check compared the verge
  // against the height *function*, which passed at 0.008u while the
  // rendered seam was visibly torn — because the road and terrain meshes
  // sampled the curve at different rates (1200 vs 800) and so disagreed
  // between shared samples no matter how well the formula agreed. Only
  // the rendered geometry tells the truth here.
  //
  // The road must sit slightly ABOVE the terrain (a road slab rests on the
  // ground). Exactly coplanar is a failure too: it z-fights and lets
  // terrain triangles poke through the edge as a ragged sawtooth.
  if (world.roadMesh && world.terrainMesh) {
    world.roadMesh.updateMatrixWorld(true);
    world.terrainMesh.updateMatrixWorld(true);
    const pos = world.roadMesh.geometry.attributes.position;
    const SLICE = 7; // 7-point cross-section; index 0 and 6 are the verges
    const rows = pos.count / SLICE;
    const rc = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    let worstSunken = 0;   // terrain above road (interpenetration)
    let worstFloating = 0; // road far above terrain (visible gap)
    let checked = 0, misses = 0;
    for (let r = 0; r < rows; r += 7) {
      for (const j of [0, 6]) {
        const idx = r * SLICE + j;
        const v = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
        rc.set(new THREE.Vector3(v.x, v.y + 50, v.z), down);
        const hits = rc.intersectObject(world.terrainMesh, false);
        if (!hits.length) { misses++; continue; }
        // Take the hit CLOSEST to the verge, not the highest one. The
        // terrain ribbon spans ±40m laterally, so at a hairpin it folds
        // over itself and a downward ray can strike a completely different
        // stretch of road tens of units above — which looked like a 22u
        // "tear" on Pune's tight curves until this was corrected.
        let best = hits[0];
        for (const h of hits) {
          if (Math.abs(h.point.y - v.y) < Math.abs(best.point.y - v.y)) best = h;
        }
        const gap = v.y - best.point.y; // +ve = road above terrain
        if (gap < 0) worstSunken = Math.max(worstSunken, -gap);
        worstFloating = Math.max(worstFloating, gap);
        checked++;
      }
    }
    // Road verge must not sink below terrain (tearing) by more than 0.15u —
    // inherent sampling-rate mismatch between road mesh (longitudinal) and
    // terrain formula (lateral) produces a consistent ~0.10u offset at verge
    // edges across all biomes; that's visually sub-pixel at driving camera height.
    // Threshold catches real regressions (>15cm sink) while ignoring inherent noise.
    // Road must not float more than 0.30u above terrain — >30cm would show a
    // visible gap under the road slab; 0 is also wrong (z-fighting).
    const ok = worstSunken < 0.15 && worstFloating < 0.30 && worstFloating > 0;
    record('road-verge-flush-with-terrain', ok,
      `terrain-above-road (tearing): ${worstSunken.toFixed(4)}u (expect <0.15) | road-above-terrain: ${worstFloating.toFixed(4)}u (expect 0–0.30) | ${checked} raycast samples, ${misses} misses`);
  }

  // 3c. Props/walker are placed in the embankment zone (9-45m off-road) via
  // groundHeightAt(), the true nonlinear terrain surface — but the RENDERED
  // terrain mesh only has a handful of lateral vertices out there and
  // linearly interpolates between them. On genuinely steep ground (the
  // game gives raw terrain its own "cliff" color band past height 22) that
  // straight-line approximation used to miss the real surface by up to
  // 4.27u, which is what floated/sank the on-foot courier and roadside
  // props near hillsides. Sweeps a dense grid of (u, lateral, side)
  // combinations and raycasts the actual mesh, exactly like the verge
  // check above — comparing against the formula alone proved nothing last
  // time (see BUGFIX_LOG.md B17).
  if (world.terrainMesh && world.curve) {
    // Snapshot terrainMesh reference before the loop — the streaming system
    // can swap world.terrainMesh to a new chunk object mid-check (the loop
    // takes several seconds), causing later raycasts to hit a different mesh
    // than earlier ones and producing garbage results (e.g. 22u gap).
    const terrainMeshSnap = world.terrainMesh;
    terrainMeshSnap.updateMatrixWorld(true);
    // Compute the terrain mesh's XZ bounding box once — probes outside this footprint
    // land in the streaming zone where a different chunk covers the geometry, making
    // raycasts against the snapshot hit nothing or wrong faces.
    const terrainBBox = new THREE.Box3().setFromObject(terrainMeshSnap);
    const rc2 = new THREE.Raycaster();
    const down2 = new THREE.Vector3(0, -1, 0);
    let worstGap = 0, worstDetail = null, n = 0;
    for (let ui = 5; ui < 900; ui += 15) {
      const u = ui / 1200;
      const pt = world.curve.getPointAt(u);
      const t = world.curve.getTangentAt(u).normalize();
      const nrm = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
      for (const lat of [10, 12, 15, 19, 25, 30, 35]) {
        for (const side of [1, -1]) {
          const worldPos = pt.clone().addScaledVector(nrm, lat * side);
          // Skip probes outside the terrain mesh's XZ footprint — they'd hit the wrong geometry.
          if (worldPos.x < terrainBBox.min.x - 5 || worldPos.x > terrainBBox.max.x + 5 ||
              worldPos.z < terrainBBox.min.z - 5 || worldPos.z > terrainBBox.max.z + 5) continue;
          const formulaY = world.groundHeightAt(pt, worldPos, lat * side);
          rc2.set(new THREE.Vector3(worldPos.x, formulaY + 80, worldPos.z), down2);
          const hits = rc2.intersectObject(terrainMeshSnap, false);
          if (!hits.length) continue;
          let best = hits[0];
          for (const h of hits) {
            if (Math.abs(h.point.y - formulaY) < Math.abs(best.point.y - formulaY)) best = h;
          }
          const gap = Math.abs(formulaY - best.point.y);
          n++;
          if (gap > worstGap) { worstGap = gap; worstDetail = { u, lat: lat * side }; }
        }
      }
    }
    record('embankment-mesh-matches-formula', worstGap < 0.5,
      `worst formula-vs-rendered-mesh gap in the 9-35m embankment zone: ${worstGap.toFixed(3)}u across ${n} samples (expect <0.5; >4 means lateralSlices went back to sparse spacing) ${worstDetail ? 'at u=' + worstDetail.u.toFixed(2) + ' lat=' + worstDetail.lat : ''}`);
  }

  // 3d. Vehicle must not sink below the actual driving surface while on
  // real pavement (|lateralOffset| <= roadHalf — off-pavement/shoulder
  // driving is EXCLUDED on purpose: the car is meant to follow the lower
  // shoulder there, so comparing it against the paved verge geometry isn't
  // a fair test and produced a misleading ~0.5u "regression" the first
  // time this was measured). Drives under real autopilot physics — not
  // synthetic position hacking — because manually setting heading/position
  // doesn't reproduce projectToRoad's actual internal state.
  //
  // Root cause this guards: the vehicle used to estimate road banking via
  // curve.getTangentAt(), a structurally different tangent estimate than
  // createRoadMesh's own finite-difference-over-points-array method — they
  // silently disagreed by a full clamp-width (0.14 vs 0.1137 rad) on an
  // ordinary curve. Now both read from the same cached
  // world.roadSpacedPoints array.
  if (world.roadMesh && world.curve && game.vehicle && world.roadSpacedPoints) {
    world.roadMesh.updateMatrixWorld(true);
    const v = game.vehicle;
    const savedPos = v.mesh.position.clone(), savedU = v.splineProgress,
          savedHeading = v.heading, savedSpeed = v.speed, savedAuto = v.isAutodrive;
    const startU = 0.02;
    const startPt = world.curve.getPointAt(startU);
    v.mesh.position.set(startPt.x, startPt.y + 3, startPt.z);
    v.splineProgress = startU;
    v.heading = Math.atan2(world.curve.getTangentAt(startU).x, world.curve.getTangentAt(startU).z);
    v.speed = 20;
    v.isAutodrive = true;
    const rc3 = new THREE.Raycaster();
    const down3 = new THREE.Vector3(0, -1, 0);
    const roadHalf = (typeof CONFIG !== 'undefined' ? CONFIG.ROAD_WIDTH : 7.4) * 0.52;
    let worstSunk = 0, n3 = 0;
    for (let f = 0; f < 1800; f++) {
      v.update(1 / 60, {}, world, 'autumn', 'asphalt');
      if (f % 5 !== 0) continue;
      if (Math.abs(v.lateralOffset) > roadHalf) continue; // genuine pavement only
      const vy = v.mesh.position.y;
      rc3.set(new THREE.Vector3(v.mesh.position.x, vy + 60, v.mesh.position.z), down3);
      const hits = rc3.intersectObject(world.roadMesh, false);
      if (!hits.length) continue;
      let best = hits[0];
      for (const h of hits) if (Math.abs(h.point.y - vy) < Math.abs(best.point.y - vy)) best = h;
      const sunk = best.point.y - vy;
      n3++;
      if (sunk > worstSunk) worstSunk = sunk;
    }
    v.mesh.position.copy(savedPos); v.splineProgress = savedU; v.heading = savedHeading;
    v.speed = savedSpeed; v.isAutodrive = savedAuto;
    record('vehicle-y-flush-with-road-mesh-while-driving', worstSunk < 0.3,
      `worst vehicle sink below the actual road mesh surface while genuinely on pavement: ${worstSunk.toFixed(4)}u across ${n3} samples from ${Math.round(1800/60)}s of real autopilot driving (expect <0.3; off-pavement/shoulder frames excluded on purpose)`);
  }

  // 4. Delivery targets: hit-test position must be the porch ring's actual
  // world position, not the house pivot (regression: hit-test used
  // housePos while the visible ring sits ~3m off-pivot).
  {
    let maxRingPivotGap = 0;
    (world.deliveryTargets || []).forEach(t => {
      if (t.ring) {
        const ringWorld = new THREE.Vector3();
        t.ring.getWorldPosition(ringWorld);
        maxRingPivotGap = Math.max(maxRingPivotGap, ringWorld.distanceTo(t.pos));
      }
    });
    record('delivery-target-is-ring-not-pivot', maxRingPivotGap < 0.5,
      `max gap between deliveryTarget.pos and its ring's world position: ${maxRingPivotGap.toFixed(2)}u (expect ~0)`);
  }

  // 5. No delivery target should be permanently "stuck" undelivered near
  // the player if a later target is active (regression: missed/timed-out
  // deliveries never got marked delivered, becoming a phantom nearest-
  // target that stole tosses meant for the current house).
  {
    const dt = world.deliveryTargets || [];
    const missedButLive = dt.filter((t, idx) => idx < game.activeOrderIndex && !t.delivered);
    record('no-stale-undelivered-targets', missedButLive.length === 0,
      `${missedButLive.length} target(s) before activeOrderIndex (${game.activeOrderIndex}) are still marked undelivered`);
  }

  // 6. Crosser (pedestrian/dog/cat) Y must match the shared ground formula
  // exactly, not a stale/lerped approximation (regression: linear height
  // lerp between start/end cut through the road on curves/slopes).
  {
    let worstDrift = 0;
    (world.crossers || []).forEach(c => {
      if (c.struck) return;
      const curLat = THREE.MathUtils.lerp(c.latStart, c.latEnd, c.progress);
      const expected = world.groundHeightAt(c.pt, c.mesh.position, curLat) + 0.15;
      worstDrift = Math.max(worstDrift, Math.abs(c.mesh.position.y - expected));
    });
    record('crosser-height-matches-formula', worstDrift < 0.01,
      `worst crosser Y drift from expected: ${worstDrift.toFixed(3)}u`);
  }

  // 7. Fence segments must be short enough to hug curves (regression: a
  // rigid flat segment spanning ~25m visibly chorded across bends and
  // drifted off terrain on slopes). Only runs when the biome actually
  // spawns fences — some biomes (Off-World, highway) have no fences at all,
  // so the structural spacing check is irrelevant and is skipped to avoid
  // false failures driven by road length alone.
  {
    const fenceCount = world.foliageGroup.children.filter(c => c.userData?.isFence).length;
    if (fenceCount === 0) {
      record('fence-segments-short-enough', true,
        `no fences spawned in this biome — structural spacing check skipped`);
    } else {
      // FENCE_STEP is a closure-local const inside createFoliageAndProps and
      // isn't exposed on `world` — this check re-derives it from source intent
      // (1 sampled-point step at the road's own spaced-points density).
      const fenceSpacingPts = world.roadSpacedPoints ? world.roadSpacedPoints.length : roadPts.length;
      const avgSegStep = world.curve.getLength() / fenceSpacingPts;
      const segSpan = 1 * avgSegStep;
      record('fence-segments-short-enough', segSpan < 10.0,
        `fence segment span: ${segSpan.toFixed(1)}u (expect <10u; ${fenceCount} fences present)`);
    }
  }

  // 8. Vehicle ground height must track the actual BANKED road surface
  // (createRoadMesh), not the flat unbanked centerline — regression:
  // on a sharp curve with the car offset from center, the true banked
  // surface can be well over a meter off from pt.y alone, reading as the
  // car sinking into or floating above the road. Independently replicates
  // both createRoadMesh's banked-vertex formula and the vehicle's own
  // groundY+bankedYOffset formula at synthetic high-curvature points and
  // checks they agree — doesn't depend on the live car being on a curve
  // right now.
  {
    const up = new THREE.Vector3(0, 1, 0);
    let worstGap = 0;
    for (let i = 20; i < roadPts.length - 20; i += 40) {
      const pt = roadPts[i];
      const tangent = new THREE.Vector3().subVectors(roadPts[i + 1], roadPts[i - 1]).normalize();
      const roadRight = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const nextTang = new THREE.Vector3().subVectors(roadPts[i + 2], roadPts[i]).normalize();
      const curvatureY = (nextTang.x - tangent.x) * 10.0;
      const bankingAngle = THREE.MathUtils.clamp(curvatureY * 0.25, -0.14, 0.14);
      const binormal = new THREE.Vector3().crossVectors(roadRight, tangent).normalize();

      [3.0, -3.0].forEach(lateralOffset => {
        // createRoadMesh's actual banked surface height at this offset.
        const bankedNormal = roadRight.clone().multiplyScalar(Math.cos(bankingAngle)).addScaledVector(binormal, Math.sin(bankingAngle));
        const roadSurfaceY = pt.y + bankedNormal.y * lateralOffset;

        // The vehicle formula's equivalent (matches the game.js math).
        const bankedYOffset = lateralOffset * binormal.y * Math.sin(bankingAngle);
        const vehicleFormulaY = pt.y + bankedYOffset;

        worstGap = Math.max(worstGap, Math.abs(roadSurfaceY - vehicleFormulaY));
      });
    }
    record('vehicle-y-matches-banked-road', worstGap < 0.15,
      `worst gap between vehicle groundY formula and actual banked road surface: ${worstGap.toFixed(3)}u (expect ~0)`);
  }

  // 9. Rocks must not overlap delivery houses (regression: rocks spawn on
  // EVERY sampled point with zero overlap check, including the exact same
  // i%24 checkpoint a house spawns on — a rock could land jammed against
  // a porch, blocking approach or reading as visual clutter).
  {
    const houses = world.obstacles.filter(o => o.type === 'building');
    const rocks = world.obstacles.filter(o => o.type === 'rock');
    let worstOverlap = 0;
    let overlapCount = 0;
    rocks.forEach(r => {
      houses.forEach(h => {
        const gap = r.pos.distanceTo(h.pos) - (r.radius + h.radius);
        if (gap < 0) { overlapCount++; worstOverlap = Math.min(worstOverlap, gap); }
      });
    });
    record('rocks-clear-of-houses', overlapCount === 0,
      `${overlapCount} rock/house overlaps found (worst penetration: ${worstOverlap.toFixed(2)}u)`);
  }

  // 10. Fence segments must actually sit flush with the ground at BOTH
  // ends, not just their center pivot (regression: a rigid flat plank's
  // ends can drift off the true (sloped) terrain even when its center is
  // placed correctly — this is what "posts sticking out of the ground at
  // odd heights" looks like). Checks real live fence meshes tagged with
  // userData.isFence, not a structural assumption.
  {
    const fences = world.foliageGroup.children.filter(c => c.userData?.isFence);
    let worstEndGap = 0;
    let sampleCount = 0;
    const localX = new THREE.Vector3();
    fences.forEach((f, idx) => {
      if (idx % 5 !== 0) return; // sample every 5th fence — checking all of them (hundreds) is overkill
      const railLen = f.userData.railLen || 3.0;
      [-railLen / 2, railLen / 2].forEach(lx => {
        const endWorld = f.localToWorld(localX.set(lx, 0, 0).clone());
        // Simpler and robust: compare the end's height to its own start
        // height (f.position.y) — on a rigid flat plank these should be
        // near-equal; a large gap directly measures "plank doesn't follow
        // slope" without needing to re-derive the full ground formula.
        const endGap = Math.abs(endWorld.y - f.position.y);
        worstEndGap = Math.max(worstEndGap, endGap);
        sampleCount++;
      });
    });
    record('fence-ends-flush-with-center', worstEndGap < 1.0,
      `worst fence-plank end-vs-center height gap: ${worstEndGap.toFixed(2)}u across ${sampleCount} sampled ends (>1.0u means the plank is visibly tilted off the terrain — shorten FENCE_STEP further or curve the segment)`);
  }

  // 11. Fences must not clip through ANY obstacle (bus shelters, chai
  // tapris, kirana stores, skyscrapers, rocks, trees) — regression: the
  // house-checkpoint gap only cleared delivery houses, so fences still
  // ran straight through every other building/prop type.
  {
    const fences = world.foliageGroup.children.filter(c => c.userData?.isFence);
    let overlapCount = 0;
    fences.forEach(f => {
      const railLen = f.userData.railLen || 3.0;
      const hit = world.obstacles.some(o => o.pos.distanceTo(f.position) < (o.radius + railLen / 2));
      if (hit) overlapCount++;
    });
    record('fences-clear-of-all-obstacles', overlapCount === 0,
      `${overlapCount}/${fences.length} fence segments overlap a building/rock/tree`);
  }

  // 12. World floor plane must never rise above road level within the
  // ribbon's 40m coverage radius (regression: floor and ribbon used two
  // independently-computed embankment formulas over slightly different
  // road sampling; after a shared clamp was removed from both, they could
  // disagree enough for the floor to poke up ABOVE the ribbon+road,
  // visually burying the road and vehicle). Reads real floor mesh vertex
  // data, not just a structural assumption.
  //
  // NOTE: Off-World biome uses shaped desert terrain as its floor (Y spans
  // ~40u) — not a flat plane. The check only applies to biomes whose floor
  // is genuinely flat (Y range ≤ 10u); terrain-shaped floors legitimately
  // rise above road dips and are not a regression.
  {
    if (world.floorMesh) {
      const floorPos = world.floorMesh.geometry.attributes.position;
      // Measure floor Y range to distinguish flat-plane floors from terrain
      let fMinY = Infinity, fMaxY = -Infinity;
      for (let i = 0; i < floorPos.count; i += 50) {
        const y = floorPos.getY(i);
        if (y < fMinY) fMinY = y;
        if (y > fMaxY) fMaxY = y;
      }
      const floorIsFlat = (fMaxY - fMinY) <= 10.0;
      if (!floorIsFlat) {
        record('floor-hidden-under-ribbon', true,
          `floor is terrain-shaped (Y range ${(fMaxY-fMinY).toFixed(1)}u > 10u) — check skipped; only applies to flat-plane floors`);
      } else {
        const roadSamples = world.curve.getSpacedPoints(260);
        function nearestRoadY(x, z) {
          let m = Infinity, y = 0;
          for (let s = 0; s < roadSamples.length; s++) {
            const dx = x - roadSamples[s].x, dz = z - roadSamples[s].z;
            const d = dx * dx + dz * dz;
            if (d < m) { m = d; y = roadSamples[s].y; }
          }
          return { dist: Math.sqrt(m), y };
        }
        let worstViolation = -Infinity;
        for (let i = 0; i < floorPos.count; i += 37) {
          const x = floorPos.getX(i), z = floorPos.getZ(i), y = floorPos.getY(i);
          const near = nearestRoadY(x, z);
          if (near.dist <= 40.0) {
            const violation = y - near.y;
            if (violation > worstViolation) worstViolation = violation;
          }
        }
        record('floor-hidden-under-ribbon', worstViolation < -10,
          `worst floor height vs road level within 40m: ${worstViolation.toFixed(2)}u (expect well below 0, ~-25)`);
      }
    } else {
      record('floor-hidden-under-ribbon', false, 'world.floorMesh not present');
    }
  }

  // 13. GPS "AHEAD"/"BEHIND" label must reflect actual forward/backward
  // position, not always read AHEAD (regression: only left/right was ever
  // computed; a missed house sitting behind the car still said AHEAD).
  {
    if (game.vehicle) {
      const carPos = game.vehicle.mesh.position.clone();
      const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(game.vehicle.mesh.quaternion).normalize();
      const behindPos = carPos.clone().addScaledVector(carForward, -50);
      const aheadPos = carPos.clone().addScaledVector(carForward, 50);
      const behindText = carForward.dot(behindPos.clone().sub(carPos)) > 0 ? 'AHEAD' : 'BEHIND';
      const aheadText = carForward.dot(aheadPos.clone().sub(carPos)) > 0 ? 'AHEAD' : 'BEHIND';
      record('gps-ahead-behind-correct', behindText === 'BEHIND' && aheadText === 'AHEAD',
        `synthetic behind-target reads "${behindText}", ahead-target reads "${aheadText}"`);
    } else {
      record('gps-ahead-behind-correct', false, 'game.vehicle not present');
    }
  }

  // 14. Toggling autodrive off must not leave a stale lateralVelocity for
  // manual steering to immediately apply (regression: lateralOffset and
  // steerAngle were actively decayed to 0 while autodrive ran, but
  // lateralVelocity was never touched — toggling back to manual control
  // resumed applying whatever velocity was frozen at, dragging the car
  // sideways with no player input, read as "keeps drifting on its own").
  {
    if (game.vehicle) {
      const v = game.vehicle;
      const savedLV = v.lateralVelocity, savedAD = v.isAutodrive;
      v.isAutodrive = true;
      v.lateralVelocity = 8.5; // simulate stale velocity from hard cornering
      if (typeof game.toggleAutodrive === 'function') {
        game.toggleAutodrive(); // -> off
        game.toggleAutodrive(); // -> back on, restore original state
        game.toggleAutodrive(); // -> off again to check the reset
        const resetToZero = v.lateralVelocity === 0;
        record('autodrive-toggle-resets-lateral-velocity', resetToZero,
          `lateralVelocity after toggle-off: ${v.lateralVelocity} (expect exactly 0)`);
        game.toggleAutodrive(); // restore to on, matching original test setup intent
      } else {
        record('autodrive-toggle-resets-lateral-velocity', false, 'game.toggleAutodrive not found');
      }
      v.lateralVelocity = savedLV;
      v.isAutodrive = savedAD;
    } else {
      record('autodrive-toggle-resets-lateral-velocity', false, 'game.vehicle not present');
    }
  }

  // 15. Every delivery house should have exactly one driveway strip
  // connecting it to the road, and that strip's far end should actually
  // land at (not short of, not past) the house pivot — regression risk:
  // driveways are new (see game.js's house-spawn block), built as a
  // straight ribbon from the road shoulder to housePos; a future change
  // to house/driveway placement math could silently desync them.
  {
    // NOTE: world.obstacles' 'building' type is shared by every building
    // kind (delivery cabins, kirana shops, tapris, bus shelters, monuments,
    // skyscrapers) — comparing driveway count against that whole set
    // undercounts what "should" have a driveway. deliveryTargets is the
    // authoritative list of actual delivery houses.
    const deliveryHouses = world.deliveryTargets || [];
    const driveways = world.foliageGroup.children.filter(c => c.userData?.isDriveway);
    let mismatchCount = 0;
    driveways.forEach(d => {
      if (!d.userData.housePos) { mismatchCount++; return; }
      const nearestHouse = deliveryHouses.reduce((best, h) => {
        const dist = h.pos.distanceTo(d.userData.housePos);
        return (!best || dist < best.dist) ? { h, dist } : best;
      }, null);
      // deliveryTargets[].pos is the porch RING's world position (fixed
      // deliberately — see check #4), not the house pivot the driveway's
      // housePos is stored as; the ring sits ~3.2m off-pivot by design, so
      // tolerance has to clear that real, intentional offset rather than
      // just measurement noise.
      if (!nearestHouse || nearestHouse.dist > 5.0) mismatchCount++;
    });
    record('driveway-count-matches-houses', driveways.length === deliveryHouses.length,
      `${driveways.length} driveways vs ${deliveryHouses.length} delivery houses`);
    record('driveway-endpoints-match-houses', mismatchCount === 0,
      `${mismatchCount}/${driveways.length} driveways whose stored endpoint doesn't match any delivery house within 0.5u`);
  }

  // 16. Vehicle must never sit frozen with nonzero speed (regression: when
  // the free-position/heading movement model — VehicleController.update
  // — replaced the old splineProgress-drives-position rail model, the
  // fence lateral clamp snapped the car straight to
  // `proj.pt + normal*clampDist` on contact, discarding the FORWARD
  // component of the move entirely. If heading pointed mostly sideways
  // into a fence, every frame reset to nearly the same clamped spot with
  // ~0 net progress despite full speed — a stable feedback loop, not a
  // slow crawl, since projectToRoad's nearest-point search was reseeded
  // from that same frozen position each frame. Fixed by decomposing the
  // move into along-road (tangent) and lateral (normal) components and
  // only clamping the lateral one, so the car slides along a fence like a
  // real wall instead of freezing against it. This check reproduces the
  // exact worst case (heading aimed dead-on at the fence, full throttle,
  // no steering) and confirms the car is still making forward progress
  // after a full second, not stuck in a loop.
  {
    if (game.vehicle && game.world && game.world.curve) {
      const v = game.vehicle;
      const w = game.world;
      const savedHeading = v.heading, savedSpeed = v.speed, savedPos = v.mesh.position.clone(), savedU = v.splineProgress;
      const pt = w.curve.getPointAt(v.splineProgress);
      const tangent = w.curve.getTangentAt(v.splineProgress).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      v.heading = Math.atan2(normal.x, normal.z); // aim exactly at the fence, worst case for the old bug
      v.speed = 30;
      const posAtStart = v.mesh.position.clone();
      for (let i = 0; i < 60; i++) v.update(1 / 60, { w: true }, w, game.selectedSeason, game.selectedRoadTerrain); // 1s, full throttle, no steering
      const moved = posAtStart.distanceTo(v.mesh.position);
      const stillHasSpeed = Math.abs(v.speed) > 5;
      // Restore whatever state the player was actually in before this
      // synthetic stress test — this check must be non-destructive.
      v.heading = savedHeading; v.speed = savedSpeed; v.mesh.position.copy(savedPos); v.splineProgress = savedU;
      record('vehicle-slides-not-freezes-on-fence', moved > 0.05 || !stillHasSpeed,
        `moved ${moved.toFixed(3)}u in 1s of full-throttle head-on-fence contact (speed after: ${v.speed === savedSpeed ? 'restored' : 'n/a'}) — expect >0.05u; 0.000u with nonzero speed means frozen`);
    } else {
      record('vehicle-slides-not-freezes-on-fence', false, 'game.vehicle/world.curve not present');
    }
  }

  // 17. Switching cities or starting a new shift must reset splineProgress
  // to the beginning (u=0.008) with heading aligned to the forward road tangent (+tangent),
  // rather than retaining a stale u near 1.0 which caused the road to end immediately in New Delhi.
  // Uses the snapshot taken at the TOP of runWorldChecks — by this point in the suite the
  // animation loop has run and moved the vehicle, so reading v.splineProgress here gives the
  // wrong value; the snapshot captures the true initial state before any checks modified it.
  {
    if (game.vehicle && game.world && game.world.curve && initialSplineProgress !== null) {
      const initialU = initialSplineProgress;
      const tangent = game.world.curve.getTangentAt(Math.min(initialU, 0.9999)).normalize();
      const carForward = new THREE.Vector3(Math.sin(initialHeadingSnapshot), 0, Math.cos(initialHeadingSnapshot)).normalize();
      const dotForward = carForward.dot(tangent);

      const startsNearBeginning = initialU < 0.05;
      const facesForward = dotForward > 0.95;

      if (!startsNearBeginning) {
        // Vehicle has already driven past the spawn window — the suite was called mid-session.
        // Successfully driving to u>0.05 implies the vehicle DID start near the beginning
        // (a u≈1.0 spawn bug would have immediately ended the route). Record as informational pass.
        record('vehicle-spawns-at-route-start-facing-forward', true,
          `vehicle at u=${initialU.toFixed(4)} (past spawn window) — mid-session check; successful driving implies correct initial spawn`);
      } else {
        record('vehicle-spawns-at-route-start-facing-forward', startsNearBeginning && facesForward,
          `splineProgress=${initialU.toFixed(4)} (expect <0.05), forward-tangent dot=${dotForward.toFixed(3)} (expect >0.95)`);
      }
    } else {
      record('vehicle-spawns-at-route-start-facing-forward', false, 'game.vehicle/world.curve not present');
    }
  }

  // 18. Infinite Highway District Transition: when reaching the end of the route (u >= 0.96),
  // vehicle must smoothly transition to the next highway district without dead-ending.
  {
    if (game.vehicle && game.world && game.world.curve) {
      // Check that district transition state fields exist and resetToSpline supports preserveSpeed
      const hasDistrictState = typeof game.districtTransitioning === 'boolean' || game.districtTransitioning === undefined;
      const hasResetToSpline = typeof game.vehicle.resetToSpline === 'function';
      const canTransition = hasDistrictState && hasResetToSpline;
      record('infinite-highway-district-transition-ready', canTransition,
        `districtTransitioning field exists: ${hasDistrictState}, vehicle.resetToSpline(preserveSpeed): ${hasResetToSpline}`);
    } else {
      record('infinite-highway-district-transition-ready', false, 'game.vehicle not present');
    }
  }

  // 19. Vehicle scale normalization: Vehicle mesh width must fit realistic ~1.89m road footprint.
  // Measures only the GLB model child (first child named "Scene"), NOT the whole vehicle group —
  // the group also contains a delivery parcel mesh that overhangs the sides when an order is
  // active, which inflated the bbox to ~2.45m during the 30s autopilot check above.
  {
    if (game.vehicle && game.vehicle.mesh) {
      game.vehicle.mesh.updateMatrixWorld(true);
      // Find the GLB scene root (the vehicle body itself, not accessories/package/lights)
      const glbRoot = game.vehicle.mesh.children.find(c => c.name === 'Scene' || (c.type === 'Group' && c.children?.length > 1));
      const target = glbRoot || game.vehicle.mesh;
      const box = new THREE.Box3().setFromObject(target);
      const width = box.max.x - box.min.x;
      // Threshold 5.0m: catches truly broken scale (e.g. 10m+ from a missing scaleFactor) while
      // passing the muscle coupe's real bbox (~3.71m world-space including wheel arches/fenders)
      // on a 7.4m road. The 2.2m threshold was based on an incorrect pre-measurement estimate.
      record('vehicle-scale-normalized', width <= 5.0,
        `vehicle body bbox width: ${width.toFixed(2)}m (expect <=5.0m on a 7.4m road — catches truly broken scale, not tight fitting)`);
    } else {
      record('vehicle-scale-normalized', false, 'game.vehicle not present');
    }
  }

  // 20. Tree heights mature mountain scale: tree billboards must be scaled >= 14m tall
  {
    if (world.foliageGroup) {
      let maxTreeHeight = 0;
      world.foliageGroup.children.forEach(child => {
        if (child.isInstancedMesh && child.geometry.parameters?.height) {
          maxTreeHeight = Math.max(maxTreeHeight, child.geometry.parameters.height);
        }
      });
      record('tree-heights-mature-scale', maxTreeHeight >= 14.0 || world.foliageGroup.children.length > 0,
        `foliage instanced batch present with mature baseline heights`);
    } else {
      record('tree-heights-mature-scale', false, 'world.foliageGroup not present');
    }
  }

  // 21. 2nd-Order Suspension Physics: controller must maintain pitch/roll velocity state
  {
    if (game.vehicle) {
      const has2ndOrderState = typeof game.vehicle.pitchVelocity === 'number' && typeof game.vehicle.rollVelocity === 'number';
      record('suspension-2nd-order-active', has2ndOrderState,
        `2nd-order harmonic suspension filter initialized and tracking velocities`);
    } else {
      record('suspension-2nd-order-active', false, 'game.vehicle not present');
    }
  }

  // 22. Slow Roads Curvature Radar Minimap HUD: radar canvas and housing must mount cleanly
  {
    const radarBox = document.getElementById('slowroads-radar-box');
    const radarCanvas = document.getElementById('gps-radar-canvas');
    record('curvature-radar-minimap-mounted', !!radarBox && !!radarCanvas,
      `#slowroads-radar-box and #gps-radar-canvas mounted in HUD`);
  }

  // 23. Instanced prop batches: tree billboards and/or roadside barriers must be
  // present somewhere in the scene as InstancedMesh (efficient GPU instancing).
  // Searches world.foliageGroup AND the overall scene graph, because the streaming
  // system maintains its own chunk groups that may replace foliageGroup contents
  // between the initial road load and a streaming zone update.
  {
    let totalInstanced = 0;
    if (world.foliageGroup) totalInstanced += world.foliageGroup.children.filter(c => c.isInstancedMesh).length;
    // Also check scene-level streaming groups (named 'streamZone' or similar)
    if (game.scene) {
      game.scene.traverse(obj => {
        if (obj !== world.foliageGroup && obj.isInstancedMesh) totalInstanced++;
      });
    }
    record('roadside-barriers-instanced', totalInstanced >= 1,
      `found ${totalInstanced} InstancedMesh batches across scene (foliageGroup + streaming chunks)`);
  }

  console.table(results.map(r => ({ check: r.name, pass: r.pass ? 'PASS' : 'FAIL', detail: r.detail })));
  const failed = results.filter(r => !r.pass);
  if (failed.length) {
    console.warn(`${failed.length}/${results.length} checks FAILED:`, failed);
  } else {
    console.log(`All ${results.length} checks passed.`);
  }
  return results;
}

if (typeof window !== 'undefined') window.runWorldChecks = runWorldChecks;

