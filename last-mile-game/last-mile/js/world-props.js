(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    CONFIG, PRNG, addChunkedInstances, barrierPostStations, buildBarrierGeometries,
    RockGeometryFactory, TreeBillboardFactory, ClumpTreeFactory, RoadGrassFactory,
    GroundDetail, RealTextureFactory, ChaiTapriAsset, HousesAsset, RepairShopAsset,
    MotorGarageAsset, StreetFurnitureAsset, CourierAsset
  } = S;

  Object.assign(S.ProceduralWorld.prototype, {
    createFoliageAndProps(scene, season, difficulty = 'medium') {
      this.foliageGroup.clear();
      this.deliveryTargets = [];
      this.trafficVehicles = [];
      this.repairBays = [];
      this.obstacles = [];
      this.crossers = [];
      // Rebuilding foliage removes the patron rigs with it — drop the stale
      // mixer references too or updatePatrons keeps skinning orphans.
      this.patrons = [];
      this.trafficSignals = [];
      this.crossingSites = [];
      this.fenceGapSites = [];
      this.pedDestinations = [];
      this.crossingInfo = [];

      const diffCfg = CONFIG.DIFFICULTY_TIERS[difficulty] || CONFIG.DIFFICULTY_TIERS.medium;
      const cityCfg = CONFIG.CITIES[this.cityKey] || CONFIG.CITIES.mumbai;
      const isOpenRoad = !!cityCfg.openRoad;

      // Reusable Low-Poly Foliage & Prop Geometries
      // Trees are TreeBillboardFactory sprites (see SLOWROADS_PARITY_LOG.md item 5).
      // Pool of 6 distinct rock shapes (different seeds → different silhouettes)
      // so clusters never look like copies of the same stamp.
      const rockGeomPool = [2, 11, 23, 37, 53, 71].map(s => RockGeometryFactory.createFacetedRockGeometry(s));
      const isWinter = (season.id === 'winter');
      // Rock color: frost-grey for winter, warm sandy for everything else
      const rockBaseColor = isWinter ? (season.snowRockColor || 0xbec4cc) : 0x7a5c3a;
      const rockMat = new THREE.MeshStandardMaterial({
        color: rockBaseColor, vertexColors: true,
        roughness: isWinter ? 0.75 : 0.85,
        metalness: 0.05,
        map: RealTextureFactory.rockColor(),
        normalMap: RealTextureFactory.rockNormal()
      });
      const poleMat = new THREE.MeshStandardMaterial({
        color: 0x4a4e52,
        flatShading: true,
        roughness: 0.7,
        metalness: 0.25
      });

      // Skyscraper window-grid texture, generated once on a canvas and
      // reused (tinted per-building via material color) across every tower
      // so the city skyline doesn't need per-building unique geometry.
      const skyscraperWindowTex = (() => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 32, 64);
        const cols = 4, rows = 10;
        const cw = 32 / cols, rh = 64 / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (this.prng.next() > 0.4) {
              ctx.fillStyle = this.prng.next() > 0.15 ? '#ffe08a' : '#9fd0ff';
              ctx.fillRect(c * cw + 1, r * rh + 1, cw - 2, rh - 2);
            }
          }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      })();
      // Single fixed glass tint for every skyscraper — previously a random
      // pick from a 6-color palette, which occasionally read as an odd
      // stray-colored blob poking through the treeline at a distance.
      const SKYSCRAPER_GLASS_COLOR = 0x9fc4d8;
      // Low/mid-rise shophouse & apartment colors, tightened to a small,
      // cohesive sandstone/cream set (was 7 widely varied vivid hues —
      // same "random blob through the trees" problem as the skyscrapers).
      const LOWRISE_PALETTE = [0xd9c9a8, 0xe8b04b, 0xc9a876];
      // Daytime facade map (B174): the emissive map above is black in daylight, so towers read as blank boxes. Same 4x10 window grid,
      // but EVERY cell is a recessed window (cells that glow at night are a touch darker); no prng, so world generation is unchanged.
      const skyscraperDayTex = (() => {
        const src = skyscraperWindowTex.image, canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 64;
        const ctx = canvas.getContext('2d'), sctx = src.getContext('2d');
        ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, 32, 64);
        const cols = 4, rows = 10, cw = 32 / cols, rh = 64 / rows;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const lit = sctx.getImageData(c * cw + cw / 2, r * rh + rh / 2, 1, 1).data[0] > 40;
          ctx.fillStyle = lit ? '#46586a' : '#6c7f90'; ctx.fillRect(c * cw + 1, r * rh + 1.5, cw - 2, rh - 3);
          ctx.fillStyle = '#d8d3c8'; ctx.fillRect(c * cw + 1, r * rh + rh - 1.5, cw - 2, 1);        // sill
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      })();
      this._skylineKit = { tex: skyscraperWindowTex, dayTex: skyscraperDayTex, glass: SKYSCRAPER_GLASS_COLOR, lowrise: LOWRISE_PALETTE };

      const sampledPoints = this.curve.getSpacedPoints(800);
      // getSpacedPoints divides the curve into equal-arc-length segments,
      // so this spacing is exact (not an approximation) — used to size
      // fence segments so they tile edge-to-edge without gaps.
      const avgSegStep = this.curve.getLength() / sampledPoints.length;
      // Each fence segment is a single rigid flat plank, leveled only at
      // its center point — it doesn't bend to follow the road. At
      // FENCE_STEP=4 a segment spans ~25m, long enough to visibly chord
      // straight across curves (crossing diagonally over sharp bends) and
      // to drift off the true ground height on slopes (floating at one
      // end, buried at the other). FENCE_STEP=1 keeps each plank to a
      // single sample step (~avgSegStep, matching the road/terrain mesh's
      // own resolution) so it hugs the curve and terrain closely.
      const FENCE_STEP = 1; // sampled-point indices between fence segments

      // Skyscrapers are offset from a single road point (pt) along that
      // point's normal — safe on a straight stretch, but on a winding
      // mountain road the curve can loop back and pass much closer to
      // that same world-space offset elsewhere (hairpins, switchbacks).
      // A "safe" 34-78m offset measured from one point can land the
      // building right on top of a different stretch of road. Check
      // against the whole sampled curve (strided for speed — this runs
      // per-candidate during world gen) before committing to a spot.
      // Points along every tunnel zone (in world space, generous margin
      // past the bore's own half-width) — trees/rocks/buildings placed
      // inside a tunnel's footprint would clip straight through its walls
      // or root out of the flattened portal ground, so they're excluded
      // the same way regular road clearance is.
      const tunnelExclusionPoints = [];
      if (this.tunnelZones && this.tunnelZones.length && this.tunnelPoints) {
        for (const zone of this.tunnelZones) {
          for (let i = zone.start; i <= zone.end; i += 2) tunnelExclusionPoints.push(this.tunnelPoints[i]);
        }
      }
      const tunnelClearance = CONFIG.TUNNEL_HALF_WIDTH + 10.0;
      const tunnelClearanceSq = tunnelClearance * tunnelClearance;

      const clearsRoad = (pos, minClearance) => {
        const minClearanceSq = minClearance * minClearance;
        for (let s = 0; s < sampledPoints.length; s += 1) {
          const dx = pos.x - sampledPoints[s].x;
          const dz = pos.z - sampledPoints[s].z;
          if (dx * dx + dz * dz < minClearanceSq) return false;
        }
        for (const tp of tunnelExclusionPoints) {
          const dx = pos.x - tp.x;
          const dz = pos.z - tp.z;
          if (dx * dx + dz * dz < tunnelClearanceSq) return false;
        }
        return true;
      };

      // Trees are built during the main loop below but not added to the
      // scene immediately — see the deferred-resolution pass after the
      // loop for why (buildings placed later in the same iteration would
      // otherwise be invisible to the overlap check).
      const pendingTrees = [];
      let pendingRocks = [];
      // Same deferral, same reason, for fences — the house-checkpoint gap
      // below only opens a gap near delivery houses, but fences also
      // clipped through bus shelters/chai tapris/kirana stores/skyscrapers
      // (registered as 'building' obstacles at various points later in
      // the same iteration, or in different iterations entirely). Resolve
      // against the FULL obstacle list once everything is placed instead.
      const pendingFences = [];
      // Reusable scratch objects for the instanced-fence matrix math below
      // — avoids allocating a fresh Object3D/Matrix4 per fence segment
      // (FENCE_STEP=1 means one segment per sampled road point, ~1200+ of
      // these per side of the route).
      const _fenceDummy = new THREE.Object3D();

      for (let i = 2; i < sampledPoints.length - 2; i++) {
        const pt = sampledPoints[i];
        const u = i / sampledPoints.length;
        // WI-05: no fence, tree, building, pole or pedestrian right at a junction: the gap is the
        // cross road's mouth, and the same skip keeps props off the cross road itself.
        if (this.roadNet && this.roadNet.nearJunction(pt, this.roadNet.opt.BOX_HALF + 4)) continue;
        const tangent = new THREE.Vector3().subVectors(sampledPoints[i + 1], sampledPoints[i - 1]).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        // Terrain height for prop placement. This was a hand-written copy of
        // the embankment formula that happened to match groundHeightAt
        // branch-for-branch — precisely the duplication that BUGFIX_LOG.md
        // calls the project's single most-repeated bug (Recurring Pattern 1:
        // copies drift apart the moment one side is tuned). Delegated to the
        // one shared function so props derive their height from the same
        // surface the terrain mesh and road verge use, by construction.
        const calcTerrainY = (pos, latDist) => this.groundHeightAt(pt, pos, latDist);

        // Inside a tunnel bore's footprint, skip roadside foliage/rock
        // placement entirely — clearsRoad() above already keeps the bigger
        // building-class props out, but trees are placed directly off
        // `pt`/`normal` without going through it, and would otherwise root
        // right through the tunnel's own walls.
        const inTunnel = tunnelExclusionPoints.length > 0 && tunnelExclusionPoints.some(tp => {
          const dx = pt.x - tp.x, dz = pt.z - tp.z;
          return dx * dx + dz * dz < tunnelClearanceSq;
        });

        // Shoulder pedestrians who patrol UP AND DOWN the roadside — this is
        // now the ONLY pedestrian mechanic (potholes, rumble strips, and
        // road-crossing pedestrians/dogs/cats were removed per the
        // slowroads-style pivot: no hazards, no road-crossing NPCs, just a
        // populated roadside). Reuses updateCrossers (it only ever lerps
        // mesh position between `start`/`end` and ping-pongs at either
        // end), with both endpoints offset along the road TANGENT at a
        // fixed lateral distance instead of straddling the road on the
        // NORMAL. latStart === latEnd here on purpose: no lateral movement,
        // they stay on the shoulder the whole patrol. Density raised
        // significantly (i%47->i%16, probability 0.5->0.2, plus a 2-4
        // person cluster per spawn point) per explicit "quite a few" density
        // instruction — this is now a much denser roll than the original
        // sparse solo-walker spacing.
        if (!isOpenRoad && i % 16 === 0 && this.prng.next() > 0.2 && !inTunnel) {
          this.spawnPedestrianCluster(pt, normal, tangent);
        }

        // 1b. Signalled zebra crossing. Rarer than the strolling clusters, and
        // never inside a tunnel bore or on an open-road stretch with no reason
        // for anyone to be crossing.
        // (Zebra crossings are placed by tryPlaceCrossingNear at tea stalls,
        // bus shelters and delivery houses, not at fixed intervals.)

        // 2. Roadside Chevron Turn Warning Signs (Yellow/Black <<< >>> on metal poles)
        if (i % 14 === 0 && i > 0 && i < sampledPoints.length - 4) {
          const nextTang = new THREE.Vector3().subVectors(sampledPoints[i + 3], sampledPoints[i - 1]).normalize();
          this.spawnCurveSign(pt, normal, tangent, tangent.x * nextTang.z - tangent.z * nextTang.x);
        }

        // 3. Roadside Electric Utility Poles
        if (!isOpenRoad && i % 24 === 0) this.spawnUtilityPole(pt, normal);

        // 4. Overhead Traffic Police Speed Radar Gantries
        if (!isOpenRoad && i % 52 === 0 && i > 15) this.spawnGantry(pt, normal, tangent);

        // 5. Roadside Garage & Pitstop Repair Bay
        if (!isOpenRoad && i % 45 === 0 && i > 20) this.spawnRepairShop(pt, normal, 1, 'cycle');
        // Motor garages: their own spacing, on the other side of the road.
        if (!isOpenRoad && i % 45 === 22 && i > 20 && !inTunnel) this.spawnRepairShop(pt, normal, -1, 'motor');

        // 6. Dense Multi-Tiered Pine & Broadleaf Forests, Rocks, Fences & Lanterns (Left and Right)
        [-1, 1].forEach(side => {
          const spawnTree = (this.prng.next() > 0.55) && !inTunnel;

          // Dense near-road rock scatter: small pebbles along the shoulders.
          if (!inTunnel && this.prng.next() > 0.08) {
            // 0.4–34m offset, pebble scale.
            const rockDist = side * (CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(0.4, 34.0));
            const rPos = pt.clone().addScaledVector(normal, rockDist);
            const clusterCount = Math.floor(this.prng.range(3, 8));
            for (let ci = 0; ci < clusterCount; ci++) {
              const cOffset = new THREE.Vector3((this.prng.next() - 0.5) * 3.0, 0, (this.prng.next() - 0.5) * 3.0);
              const cPos = rPos.clone().add(cOffset);
              const rockScale = this.prng.range(0.02, 0.16);
              // Must include the road half-width. This read `1.3 + rockScale *
              // 0.8` — and since rockScale is range(0.02, 0.16) that is only
              // 1.32-1.43m of required clearance, while the driveable surface
              // extends to ROAD_WIDTH * 0.5 = 3.70m from the centreline. So the
              // guard was waving through rocks sitting well inside the asphalt.
              //
              // rockDist above starts at ROAD_WIDTH * 0.5 + 0.4, which looks
              // safe on its own, but cOffset then shifts each cluster member by
              // up to +/-1.5m in x and z — landing them near 2.6m — and on the
              // inside of a bend the nearest road sample can be closer still.
              // Measured before this fix: 14 rocks on the asphalt in mumbai,
              // closest 3.11m. See dev-checks
              // rocks-clear-of-road. Matches the correct form already used by
              // the other rock spawner (search: ROAD_WIDTH * 0.5 + 1.6).
              const requiredClearance = CONFIG.ROAD_WIDTH * 0.5 + 1.3 + rockScale * 0.8;
              if (!clearsRoad(cPos, requiredClearance)) continue;

              // True signed lateral distance of cPos from the road centerline.
              const cDist = normal.dot(cOffset) + rockDist;
              cPos.y = calcTerrainY(cPos, cDist);

              // Pick a distinct rock shape from the pool so clusters look varied.
              const geomIdx = Math.floor(this.prng.next() * rockGeomPool.length);
              const chosenGeom = rockGeomPool[geomIdx];
              const sX = rockScale * this.prng.range(0.7, 1.4);
              const sY = rockScale * this.prng.range(0.6, 1.1);
              const sZ = rockScale * this.prng.range(0.7, 1.4);
              const scaleVec = new THREE.Vector3(sX, sY, sZ);
              const rotX = this.prng.next() * 3, rotY = this.prng.next() * 3;
              const rotMat = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotX, rotY, 0));
              const posAttr = chosenGeom.attributes.position;
              let minY = Infinity;
              const v = new THREE.Vector3();
              for (let vi = 0; vi < posAttr.count; vi++) {
                v.set(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi)).applyMatrix4(rotMat).multiply(scaleVec);
                if (v.y < minY) minY = v.y;
              }
              const finalPos = new THREE.Vector3(cPos.x, cPos.y - minY - 0.45 * Math.abs(minY), cPos.z);      // B178: bed the rock into the ground (the road/terrain mesh and the height formula differ by up to ~0.4 m, which left boulders hovering)
              const rockMat4 = new THREE.Matrix4();
              rockMat4.makeRotationFromEuler(new THREE.Euler(rotX, rotY, 0));
              rockMat4.scale(scaleVec);
              rockMat4.setPosition(finalPos);
              pendingRocks.push({
                geomIdx,
                matrix: rockMat4,
                pos: finalPos,
                radius: 1.2 * rockScale,
                type: 'rock'
              });
            }
          }

          // Minimum offset kept clear of the vehicle's own max lateral drift
          const nearDist = CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(8.0, 18.0);
          const nearPos = pt.clone().addScaledVector(normal, side * nearDist);
          nearPos.y = calcTerrainY(nearPos, side * nearDist);

          if (spawnTree) {
            this.prng.next();                                              // keep the seeded sequence unchanged
            const isPine = season.id === 'winter' ? true : this._pineZoneAt(pt, normal, side);
            const clusterCount = Math.floor(this.prng.range(3, 7));
            for (let ci = 0; ci < clusterCount; ci++) {
              const leafColHex = season.treeLeaves[Math.floor(this.prng.range(0, season.treeLeaves.length))];
              const cOffset = new THREE.Vector3((this.prng.next() - 0.5) * 5.0, 0, (this.prng.next() - 0.5) * 5.0);
              const cPos = nearPos.clone().add(cOffset);
              cPos.y = calcTerrainY(cPos, side * nearDist);

              const scale = this.prng.range(0.85, 1.45);
              pendingTrees.push({
                kind: isPine ? 'pine' : 'broadleaf', worldHeight: 16.0, tintHex: leafColHex,
                pos: cPos.clone(), scale, rotY: this.prng.next() * Math.PI * 2,
                radius: 1.8 * scale
              });
            }
          } // end spawnTree

          // Background trees
          if (i % 4 === 0 && this.prng.next() > 0.45 && !inTunnel) {
            const bgDist = side * this.prng.range(24.0, 90.0);
            const bgPos = pt.clone().addScaledVector(normal, bgDist);
            bgPos.y = calcTerrainY(bgPos, bgDist);
            this.prng.next();
            const bgIsPine = season.id === 'winter' ? true : this._pineZoneAt(pt, normal, Math.sign(bgDist));

            const bgClusterCount = Math.floor(this.prng.range(4, 9));
            for (let ci = 0; ci < bgClusterCount; ci++) {
              const bgLeafHex = season.treeLeaves[Math.floor(this.prng.range(0, season.treeLeaves.length))];
              const bgOffset = new THREE.Vector3((this.prng.next() - 0.5) * 9.0, 0, (this.prng.next() - 0.5) * 9.0);
              const cBgPos = bgPos.clone().add(bgOffset);
              cBgPos.y = calcTerrainY(cBgPos, bgDist);
              const bgScale = this.prng.range(0.9, 1.55);
              pendingTrees.push({
                kind: bgIsPine ? 'pine' : 'broadleaf', worldHeight: 22.0, tintHex: bgLeafHex,
                pos: cBgPos.clone(), scale: bgScale, rotY: this.prng.next() * Math.PI * 2,
                radius: 2.2 * bgScale
              });
            }
          }

          // City/Earth large background boulder formations — pushed far behind
          // the treeline (55–120m) so they read as distant landscape, not
          // roadside rubble.
          if (i % 6 === 0 && this.prng.next() > 0.50 && !inTunnel) {
            const bgBoulderDist = side * this.prng.range(90.0, 180.0);
            const bgBoulderPos = pt.clone().addScaledVector(normal, bgBoulderDist);
            const bgBoulderCount = Math.floor(this.prng.range(1, 4));
            for (let ci = 0; ci < bgBoulderCount; ci++) {
              const bgOff = new THREE.Vector3((this.prng.next() - 0.5) * 10.0, 0, (this.prng.next() - 0.5) * 10.0);
              const cBgPos = bgBoulderPos.clone().add(bgOff);
              const boulderScale = this.prng.range(0.8, 3.6);
              if (!clearsRoad(cBgPos, CONFIG.ROAD_WIDTH * 0.5 + 4.0)) continue;
              const bgLatDist = normal.dot(bgOff) + bgBoulderDist;
              cBgPos.y = calcTerrainY(cBgPos, bgLatDist);
              const bgGeomIdx = Math.floor(this.prng.next() * rockGeomPool.length);
              const bgChosenGeom = rockGeomPool[bgGeomIdx];
              const sX = boulderScale * this.prng.range(0.7, 1.4);
              const sY = boulderScale * this.prng.range(0.6, 1.1);
              const sZ = boulderScale * this.prng.range(0.7, 1.4);
              const scaleVec = new THREE.Vector3(sX, sY, sZ);
              const rotX = this.prng.next() * 3, rotY = this.prng.next() * 3;
              const bgRotMat = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotX, rotY, 0));
              const bgPosAttr = bgChosenGeom.attributes.position;
              let bgMinY = Infinity;
              const bgV = new THREE.Vector3();
              for (let vi = 0; vi < bgPosAttr.count; vi++) {
                bgV.set(bgPosAttr.getX(vi), bgPosAttr.getY(vi), bgPosAttr.getZ(vi)).applyMatrix4(bgRotMat).multiply(scaleVec);
                if (bgV.y < bgMinY) bgMinY = bgV.y;
              }
              const finalRockPos = new THREE.Vector3(cBgPos.x, cBgPos.y - bgMinY, cBgPos.z);
              const rockMat4 = new THREE.Matrix4();
              rockMat4.makeRotationFromEuler(new THREE.Euler(rotX, rotY, 0));
              rockMat4.scale(scaleVec);
              rockMat4.setPosition(finalRockPos);
              pendingRocks.push({
                geomIdx: bgGeomIdx,
                matrix: rockMat4,
                pos: finalRockPos,
                radius: 1.4 * boulderScale,
                type: 'rock'
              });
            }
          }

          // City Skyline: procedural skyscrapers set well back beyond the
          // treeline so they read as a backdrop rather than roadside clutter.
          // Spaced out per side so towers don't visually collide with each
          // other at close draw distance.
          if (!isOpenRoad && i % 7 === (side > 0 ? 0 : 3) && this.prng.next() > 0.15) {
            const placed = this.spawnCityBuilding(pt, normal, side, clearsRoad);
            if (!placed) return;
            pendingRocks = pendingRocks.filter(r =>
              r.pos.distanceTo(placed.pos) >= (r.radius + placed.footprintRadius + 1.5 + 2.0)
            );
          }

          // Roadside Split-Rail Wooden Fences — continuous guardrail along
          // both shoulders, broken only right where a delivery house sits
          // so the gap itself reads as "turn in here" (houses always spawn
          // at i % 24 === 0, alternating sides via i % 48 — see the cabin
          // block below). Gaps are cut in the deferred pass from this.fenceGapSites
          // (tea stalls, houses, repair shops, zebra crossings), not guessed here.
          if (i % FENCE_STEP === 0 && !inTunnel) {

            {
              // Continuous roadside barrier: placed via getBarrierLateralDistance()
              // flush along the outer edge of the raised sidewalk paver slab (or natural verge).
              const fenceDist = side * this.getBarrierLateralDistance();
              const fencePos = pt.clone().addScaledVector(normal, fenceDist);
              const railLen = FENCE_STEP * avgSegStep * 1.08 + 0.6; // overlap so straight rails still meet on curves

              // Sample rendered surface height at BOTH ends of this short (~6m)
              // segment using surfaceHeightNear() so the barrier follows the actual
              // rendered sidewalk surface (or banked verge) rather than the raw
              // ground under the slab. Eliminates floating posts/rails across bends and slopes.
              const nextPt = sampledPoints[Math.min(i + 1, sampledPoints.length - 1)];
              const endA = fencePos.clone().addScaledVector(tangent, -railLen / 2);
              const endB = fencePos.clone().addScaledVector(tangent, railLen / 2);
              const yA = this.surfaceHeightNear(endA, pt, fenceDist);
              const yB = this.surfaceHeightNear(endB, nextPt, fenceDist);
              fencePos.y = (yA + yB) / 2;
              const offsetA = yA - fencePos.y;
              const offsetB = yB - fencePos.y;
              const tiltAngle = Math.atan2(yB - yA, railLen);

              // Was one THREE.Group per segment with 4 individual Mesh
              // children (2 posts + 2 rails, or 4 stone rows) — at
              // FENCE_STEP=1 over a ~5km route on both shoulders, that's
              // thousands of separate draw calls (confirmed live: 5022
              // individual BoxGeometry meshes + 2196 CylinderGeometry
              // meshes, almost entirely this fence, ~2000 total draw
              // calls/frame, tanking framerate to ~18-22fps while driving).
              // Same fix already proven for trees (TreeBillboardFactory):
              // compute each piece's WORLD matrix now, defer only the
              // decision of which segments survive the obstacle-overlap
              // check below, then batch every surviving piece into a
              // handful of InstancedMesh draw calls after the loop.
              //
              // The rail/wall-row geometries are unit-length (X=1) so a
              // per-instance non-uniform scale (baked into the matrix)
              // stretches each one to its actual railLen — the same
              // technique the old per-segment BoxGeometry(railLen,...)
              // achieved by baking length into the geometry itself, just
              // moved into the instance matrix instead.
              _fenceDummy.position.copy(fencePos);
              _fenceDummy.up.set(0, 1, 0);
              // Same axis-swap reasoning as the old fenceGroup.lookAt call:
              // targeting along the road normal (not the tangent) puts
              // local +X along the tangent, so the rail runs alongside the
              // road instead of straight across it.
              _fenceDummy.lookAt(fencePos.clone().add(normal));
              _fenceDummy.updateMatrix();
              const groupMatrix = _fenceDummy.matrix;

              // Barrier Styles: 0: Galvanized Steel W-Beam Armco Guardrail, 1: Dry-stone wall, 2: Wood split-rail, 3: Concrete Jersey barrier
              const barrierStyle = this._barrierStyleAt(fencePos);
              const matrices = { posts: [], rails: [], stoneRows: [], concreteRows: [], armcoRails: [], armcoPosts: [], armcoReflectors: [] };

              if (barrierStyle === 0) {
                // Galvanized Steel W-Beam Armco Highway Guardrail with Reflectors (Slow Roads Highway reference)
                barrierPostStations(railLen, offsetA, offsetB).forEach(([px, offset]) => {
                  const postLocal = new THREE.Matrix4().makeTranslation(px, offset + 0.55, 0);
                  matrices.armcoPosts.push(groupMatrix.clone().multiply(postLocal));

                  const reflLocal = new THREE.Matrix4().makeTranslation(px, offset + 0.78, 0.08);
                  matrices.armcoReflectors.push(groupMatrix.clone().multiply(reflLocal));
                });
                const railLocal = new THREE.Matrix4().compose(
                  new THREE.Vector3(0, 0.65, 0),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tiltAngle)),
                  new THREE.Vector3(railLen, 1, 1)
                );
                matrices.armcoRails.push(groupMatrix.clone().multiply(railLocal));
              } else if (barrierStyle === 1) {
                // Dry-stone wall (4 courses, bottom course seated firmly on surface)
                const rowHeights = [0.09, 0.31, 0.53, 0.75];
                rowHeights.forEach((ry, rowIdx) => {
                  const jitter = 1.0 - rowIdx * 0.04;
                  const local = new THREE.Matrix4().compose(
                    new THREE.Vector3(0, ry, 0),
                    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tiltAngle)),
                    new THREE.Vector3(railLen, 1, jitter)
                  );
                  matrices.stoneRows.push(groupMatrix.clone().multiply(local));
                });
              } else if (barrierStyle === 3) {
                // Modern Concrete Highway Barrier (Jersey Barrier profile, base seated on surface)
                [0.16, 0.50].forEach((ry, rIdx) => {
                  const bScaleZ = rIdx === 0 ? 1.0 : 0.75;
                  const local = new THREE.Matrix4().compose(
                    new THREE.Vector3(0, ry, 0),
                    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tiltAngle)),
                    new THREE.Vector3(railLen, 1, bScaleZ)
                  );
                  matrices.concreteRows.push(groupMatrix.clone().multiply(local));
                });
              } else {
                // Wood split-rail fence
                barrierPostStations(railLen, offsetA, offsetB).forEach(([px, offset]) => {
                  const local = new THREE.Matrix4().makeTranslation(px, offset + 0.6, 0);
                  matrices.posts.push(groupMatrix.clone().multiply(local));
                });
                [0.45, 0.85].forEach(ry => {
                  const local = new THREE.Matrix4().compose(
                    new THREE.Vector3(0, ry, 0),
                    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tiltAngle)),
                    new THREE.Vector3(railLen, 1, 1)
                  );
                  matrices.rails.push(groupMatrix.clone().multiply(local));
                });
              }

              pendingFences.push({ matrices, pos: fencePos.clone(), radius: railLen / 2 });
            }
          }

          // Indian Highway Milestone Markers (National Highway Standard: Yellow Dome + White Base)
          if (i % 32 === 0 && side === 1 && !inTunnel) this.spawnMilestone(pt, normal, side);

          // Street lamps (skipped in tunnels, which have their own lighting).
          if (i % 28 === 0 && side === -1 && !inTunnel) this.spawnStreetLamp(pt, normal, side);

          // Roadside Bus Shelter & Waiting Passengers
          if (i % 72 === 0 && side === 1 && !this.spawnBusShelter(pt, normal, side, clearsRoad)) return;

          // Roadside Dhaba / Chai Tapri with Customers drinking tea
          if (i % 34 === 0 && side === -1) {
            const tapriDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 4.6);
            const tapriPos = pt.clone().addScaledVector(normal, tapriDist);

            if (clearsRoad(tapriPos, CONFIG.ROAD_WIDTH * 0.5 + 2.8) &&
                !this.obstacles.some(o => o.pos.distanceTo(tapriPos) < (o.radius + 2.6))) {
              this.buildViewpointOrChai({
                pt, normal, tangent, side, dist: CONFIG.ROAD_WIDTH * 0.5 + 4.6,
                isChaiTapri: true, targetParentGroup: this.foliageGroup
              });
            }
          }

          // Roadside Scenic Mountain Viewpoint Pavilion & Kiosk
          if (!isOpenRoad && i % 48 === 0 && side === 1) {
            const kiranaDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 6.8);
            const kiranaPos = pt.clone().addScaledVector(normal, kiranaDist);

            if (clearsRoad(kiranaPos, CONFIG.ROAD_WIDTH * 0.5 + 3.2) &&
                !this.obstacles.some(o => o.pos.distanceTo(kiranaPos) < (o.radius + 2.8))) {
              this.buildViewpointOrChai({
                pt, normal, tangent, side, dist: CONFIG.ROAD_WIDTH * 0.5 + 6.8,
                isChaiTapri: false, targetParentGroup: this.foliageGroup
              });
            }
          }

          // City-specific landmark monument — rare (a couple per route),
          // one distinct silhouette per city, hand-built in this game's
          // own low-poly style rather than an imported asset (checked a
          // Unity Asset Store monument pack for this — paid, FBX/Unity
          // format, no fit for a single-file browser Three.js project).
          if (!isOpenRoad && i % 400 === 0 && i > 50 && side === 1 && !this.spawnMonument(pt, normal, side, clearsRoad)) return;

          // Firewood Log Stacks along forest verges.
          if (i % 38 === 0 && this.prng.next() > 0.5) {
            const logDist = side * (CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(2.6, 4.5));
            const logPos = pt.clone().addScaledVector(normal, logDist);
            logPos.y = calcTerrainY(logPos, logDist);

            const logGroup = new THREE.Group();
            const logMat = new THREE.MeshLambertMaterial({ color: 0x7c4f28 });
            // Stack of 6 cylindrical timber logs
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3 - r; c++) {
                const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 6), logMat);
                log.rotateZ(Math.PI / 2);
                log.position.set(0, 0.15 + r * 0.22, (c - (2 - r) / 2) * 0.28);
                logGroup.add(log);
              }
            }
            logGroup.position.copy(logPos);
            logGroup.lookAt(logPos.clone().add(tangent));
            this.foliageGroup.add(logGroup);
          }

          // Boulders & Rocks. Runs on every point (unlike most props, which
          // are gated to specific i%N checkpoints). We also check distance
          // against all delivery house checkpoints so rocks never spawn
          // anywhere near a house footprint or driveway.
          if (this.prng.next() > 0.65 && !inTunnel) {
            const nearestHouseCheckpoint = Math.round(i / 24) * 24;
            const distToHouse = Math.abs(i - nearestHouseCheckpoint) * avgSegStep;
            const ROCK_HOUSE_GAP = 14.0; // meters — house obstacle radius (3.5) plus porch & driveway clearance
            const nearHouseZone = !isOpenRoad && distToHouse < ROCK_HOUSE_GAP;

            const rockDist = side * (CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(2.0, 24.0));
            const rockPos = pt.clone().addScaledVector(normal, rockDist);
            const overlapsExisting = this.obstacles.some(o => o.pos.distanceTo(rockPos) < (o.radius + 1.6)) ||
                                     pendingRocks.some(r => r.pos.distanceTo(rockPos) < (r.radius + 1.6));
            // Varying sizes, small pebble to large boulder.
            const rockScale = this.prng.range(0.4, 2.2);
            // Curve-aware clearance: a fixed lateral offset from `pt` can
            // still land inside the road ribbon a few meters up/down the
            // curve where it bends back toward this lateral position, so
            // clearsRoad() guards it (without it, rocks ended up on the road).
            const requiredClearance = CONFIG.ROAD_WIDTH * 0.5 + 1.6 + rockScale * 0.8;

            if (!nearHouseZone && !overlapsExisting && clearsRoad(rockPos, requiredClearance)) {
              const groundY = calcTerrainY(rockPos, rockDist);
              const sGeomIdx = Math.floor(this.prng.next() * rockGeomPool.length);
              const sChosenGeom = rockGeomPool[sGeomIdx];
              const sX = rockScale * this.prng.range(0.7, 1.4);
              const sY = rockScale * this.prng.range(0.6, 1.1);
              const sZ = rockScale * this.prng.range(0.7, 1.4);
              const scaleVec = new THREE.Vector3(sX, sY, sZ);
              const rotX = this.prng.next() * 3, rotY = this.prng.next() * 3;
              const rotMat = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotX, rotY, 0));
              const posAttr = sChosenGeom.attributes.position;
              let minY = Infinity;
              const v = new THREE.Vector3();
              for (let vi = 0; vi < posAttr.count; vi++) {
                v.set(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi)).applyMatrix4(rotMat).multiply(scaleVec);
                if (v.y < minY) minY = v.y;
              }
              const finalRockPos = new THREE.Vector3(rockPos.x, groundY - minY - 0.45 * Math.abs(minY), rockPos.z);
              const rockMat4 = new THREE.Matrix4();
              rockMat4.makeRotationFromEuler(new THREE.Euler(rotX, rotY, 0));
              rockMat4.scale(scaleVec);
              rockMat4.setPosition(finalRockPos);
              pendingRocks.push({
                geomIdx: sGeomIdx,
                matrix: rockMat4,
                pos: finalRockPos,
                radius: 1.2 * rockScale,
                type: 'rock'
              });
            }
          }
        });

        // 7. Modern Procedural Scenic Villas & Mountain Drop Points
        // User invariant: strictly no deliveries or homes near, inside, or parallel to tunnels
        const inOrNearTunnel = this.isInTunnelZone && this.isInTunnelZone(i, 35);
        if (!isOpenRoad && i % 24 === 0 && !inOrNearTunnel) {
          const cityOrders = CONFIG.ORDERS_BY_CITY[this.cityKey] || CONFIG.ORDERS_BY_CITY.mumbai;
          const orderIdx = Math.floor(i / 24) % cityOrders.length;
          const order = cityOrders[orderIdx];
          const houseSide = (i % 48 === 0 ? 1 : -1);
          
          const houseDist = houseSide * (CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(diffCfg.minHouseDist, diffCfg.maxHouseDist));
          const housePos = pt.clone().addScaledVector(normal, houseDist);
          housePos.y = calcTerrainY(housePos, houseDist);

          // Verify euclidean clearance to any tunnel center point
          const nearTunnelTube = this.tunnelZones && this.tunnelZones.some(z => {
            for (let ti = Math.max(0, z.start - 8); ti <= Math.min(tubularSegments, z.end + 8); ti += 4) {
              const tp = this.tunnelPoints ? this.tunnelPoints[ti] : null;
              if (tp && tp.distanceTo(housePos) < 45.0) return true;
            }
            return false;
          });
          if (!nearTunnelTube) {
            // Prune overlapping obstacles with a generous clearance margin
            const HOUSE_CLEARANCE = 5.8;
            const overlappingObstacles = this.obstacles.filter(o => o.pos.distanceTo(housePos) < (o.radius + HOUSE_CLEARANCE));
            overlappingObstacles.forEach(o => {
              if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh);
              if (o.repairBay) this.repairBays = this.repairBays.filter(b => b !== o.repairBay);
            });
            this.obstacles = this.obstacles.filter(o => o.pos.distanceTo(housePos) >= (o.radius + HOUSE_CLEARANCE));
            pendingRocks = pendingRocks.filter(r => r.pos.distanceTo(housePos) >= (r.radius + HOUSE_CLEARANCE));

            const isModernVilla = (Math.floor(i / 24) % 2 === 0);
            this.buildScenicVillaAndTurnout({
              pt, normal, tangent, houseSide, houseDist, order, isModernVilla, isWinter, u,
              tossRadius: diffCfg.tossRadius, targetParentGroup: this.foliageGroup
            });
          }
        }
      }

      // Resolve tree/building overlaps now that every building (garages,
      // stalls, cabins, monuments, skyline) has been placed and registered
      // in this.obstacles — a tree queued anywhere in the loop above can
      // now see buildings regardless of which ran first for a given index.
      // Filter first, build InstancedMesh batches after — building the
      // actual mesh per descriptor here (the original approach) meant one
      // THREE.Mesh draw call per tree regardless of shared geometry;
      // clustering pushed that to 8556 separate draw calls at ~22 FPS.
      // buildInstancedBatches collapses all accepted trees into ~32 draw
      // calls total (one InstancedMesh per kind/height/tint/plane bucket)
      // regardless of instance count.
      const acceptedTrees = [];
      pendingTrees.forEach((d) => {
        const overlapsBuilding = this.obstacles.some(o =>
          o.type === 'building' && o.pos.distanceTo(d.pos) < (o.radius + d.radius + 1.0)
        );
        if (overlapsBuilding) return;
        if (this._inCompound(d.pos.x, d.pos.z, d.radius + 0.5)) return;                  // B180: nothing grows inside or through a house's boundary wall
        // Same hairpin/switchback risk as skyscrapers, just at a shorter
        // offset — the curve can loop back near a tree's local placement.
        // Billboard sweep clearance: account for camera rotation sweep width (radius * 1.25 + 1.2)
        const treeSweepClearance = (CONFIG.ROAD_WIDTH * 0.5) + (d.radius * 1.25) + 1.2;
        if (!clearsRoad(d.pos, treeSweepClearance)) return;
        acceptedTrees.push(d);
        this.obstacles.push({ pos: d.pos, radius: d.radius, type: 'tree' });
      });
      this.foliageGroup.add(TreeBillboardFactory.buildInstancedBatches(acceptedTrees));

      if (isWinter && acceptedTrees.length > 0) {
        const snowCapGeom = new THREE.SphereGeometry(1, 6, 3);
        const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf0f5f9, roughness: 0.9, metalness: 0 });
        const snowCapMesh = new THREE.InstancedMesh(snowCapGeom, snowCapMat, acceptedTrees.length);
        snowCapMesh.frustumCulled = false;
        const dummy = new THREE.Object3D();
        acceptedTrees.forEach((t, idx) => {
          const capR = t.worldHeight * t.scale * 0.22;
          dummy.position.set(t.pos.x, t.pos.y + t.worldHeight * t.scale * 0.85, t.pos.z);
          dummy.scale.set(capR, capR * 0.48, capR);
          dummy.updateMatrix();
          snowCapMesh.setMatrixAt(idx, dummy.matrix);
        });
        snowCapMesh.instanceMatrix.needsUpdate = true;
        this.foliageGroup.add(snowCapMesh);
      }

      // Resolve fence overlaps against the now-complete obstacle list
      // (buildings/shops/skyscrapers/rocks/trees). The house-checkpoint
      // gap above already opens a wide, intentional gap right at delivery
      // houses — this pass is a tight clearance check against everything
      // else, so fences stop clipping through bus shelters, chai tapris,
      // kirana stores, skyscrapers, and rocks without diluting the "gap
      // means delivery house" visual cue with gaps at every other prop.
      // Final rock/tree-vs-building overlap sweep. The per-placement-site
      // pruning above (skyscraper block, delivery-house block) only
      // removes obstacles placed BEFORE that building in loop order — a
      // rock and building can still both spawn on the same iteration's
      // OTHER `side` (side=-1 runs to completion, including its own
      // rocks, before side=1 even starts, so a side=1 skyscraper's prune
      // pass can miss a side=-1 rock at the same i if the specific
      // ordering/margin doesn't line up) or via some other ordering this
      // session didn't fully trace. Rather than keep chasing the exact
      // sequencing, sweep once, unconditionally, after every prop for the
      // whole route has been placed — this is correct regardless of
      // placement order, at the cost of one O(rocks x buildings) pass
      // (a few hundred x a few hundred, trivial at world-gen time).
      {
        const buildings = this.obstacles.filter(o => o.type === 'building');
        const stillOverlapping = this.obstacles.filter(o =>
          (o.type === 'rock' || o.type === 'tree') &&
          buildings.some(b => o.pos.distanceTo(b.pos) < (o.radius + b.radius))
        );
        stillOverlapping.forEach(o => { if (o.mesh) this.foliageGroup.remove(o.mesh); });
        if (stillOverlapping.length) {
          this.obstacles = this.obstacles.filter(o => !stillOverlapping.includes(o));
        }
        pendingRocks = pendingRocks.filter(r =>
          !buildings.some(b => r.pos.distanceTo(b.pos) < (r.radius + b.radius)) && !this._inCompound(r.pos.x, r.pos.z, r.radius + 0.3)
        );
        {
          const inWalls = this.obstacles.filter(o => (o.type === 'rock' || o.type === 'tree') && this._inCompound(o.pos.x, o.pos.z, (o.radius || 1) + 0.3));
          inWalls.forEach(o => { if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh); });
          if (inWalls.length) this.obstacles = this.obstacles.filter(o => !inWalls.includes(o));
        }

        // Rule 16: Unconditional road corridor clearance sweep - prune any prop breaching the asphalt corridor
        const minCorridorClear = CONFIG.ROAD_WIDTH * 0.5 + 1.0;
        this.obstacles = this.obstacles.filter(o => {
          if (o.type === 'rock' || o.type === 'tree') {
            const reqDist = minCorridorClear + (o.radius || 1.0);
            if (!clearsRoad(o.pos, reqDist)) {
              if (o.mesh) this.foliageGroup.remove(o.mesh);
              return false;
            }
          }
          return true;
        });
        pendingRocks = pendingRocks.filter(r => {
          const reqDist = minCorridorClear + (r.radius || 1.0);
          return clearsRoad(r.pos, reqDist);
        });
      }

      // Build InstancedMesh batches for all accepted rocks (6 distinct rock geometry shapes)
      // Collapses ~7,700 individual rock meshes down to 6 GPU draw calls total
      for (let k = 0; k < rockGeomPool.length; k++) {
        const groupRocks = pendingRocks.filter(r => r.geomIdx === k);
        if (groupRocks.length > 0) {
          groupRocks.forEach((r) => {
            this.obstacles.push({
              pos: r.pos.clone(),
              radius: r.radius,
              type: 'rock',
              mesh: { getWorldPosition: (v) => v.copy(r.pos) }
            });
          });
          addChunkedInstances(this.foliageGroup, rockGeomPool[k], rockMat, groupRocks.map(r => r.matrix), {
            onChunk: (mesh) => { mesh.userData.isRock = true; }
          });
        }
      }

      {
        const acceptedPosts = [];
        const acceptedRails = [];
        const acceptedStoneRows = [];
        const acceptedConcreteRows = [];
        const acceptedArmcoRails = [];
        const acceptedArmcoPosts = [];
        const acceptedArmcoReflectors = [];
        pendingFences.forEach(({ matrices, pos, radius }) => {
          if (this.isFenceGap(pos)) return;
          // Never run the fence through a building; poles, lamps, rocks and
          // trees no longer punch holes in it.
          const hitsBuilding = this.obstacles.some(o => o.type === 'building' && o.pos.distanceTo(pos) < (o.radius + Math.min(radius, 2.5)));
          if (hitsBuilding) return;
          acceptedPosts.push(...matrices.posts);
          acceptedRails.push(...matrices.rails);
          acceptedStoneRows.push(...matrices.stoneRows);
          if (matrices.concreteRows) acceptedConcreteRows.push(...matrices.concreteRows);
          if (matrices.armcoRails) acceptedArmcoRails.push(...matrices.armcoRails);
          if (matrices.armcoPosts) acceptedArmcoPosts.push(...matrices.armcoPosts);
          if (matrices.armcoReflectors) acceptedArmcoReflectors.push(...matrices.armcoReflectors);
        });

        const buildFenceBatch = (matrices, geom, mat, castShadow) => {
          addChunkedInstances(this.foliageGroup, geom, mat, matrices, { castShadow });
        };

        const fWoodTex = RealTextureFactory.woodColor();
        const fWoodNormal = RealTextureFactory.woodNormal();
        const BG = buildBarrierGeometries();
        buildFenceBatch(
          acceptedPosts,
          BG.woodPost,
          new THREE.MeshStandardMaterial({ color: 0x8a7a68, map: fWoodTex, normalMap: fWoodNormal, roughness: 0.85 }),
          false
        );
        buildFenceBatch(
          acceptedRails,
          BG.woodRail,
          new THREE.MeshStandardMaterial({ color: 0x9a8a76, map: fWoodTex, normalMap: fWoodNormal, roughness: 0.85 }),
          false
        );
        // Master Prompt section 3's dry-stone-wall barrier variant — same real rock
        // texture, now one InstancedMesh for all rows/segments combined
        // Courses are stretched ~6-11x along X per instance; repeat the rock
        // texture along X so it reads as stones instead of smeared streaks.
        // (buildBarrierGeometries tiles the stone course UVs 9x along X; the
        // shared rock textures only need to repeat rather than clamp.)
        const stoneTex = RealTextureFactory.rockColor();
        const stoneNormal = RealTextureFactory.rockNormal();
        [stoneTex, stoneNormal].forEach((t) => { if (t) t.wrapS = THREE.RepeatWrapping; });
        buildFenceBatch(
          acceptedStoneRows,
          BG.stone,
          new THREE.MeshStandardMaterial({ color: 0x7a756c, map: stoneTex, normalMap: stoneNormal, roughness: 0.95, flatShading: true }),
          true
        );
        // Modern Highway Concrete Barrier (Jersey barrier variant)
        buildFenceBatch(
          acceptedConcreteRows,
          BG.concrete,
          new THREE.MeshStandardMaterial({ color: 0xc9c5bc, roughness: 0.9, metalness: 0.02 }),
          true
        );
        // Galvanized Steel W-Beam Armco Guardrails (Slow Roads Highway reference)
        buildFenceBatch(
          acceptedArmcoRails,
          BG.armcoRail,
          new THREE.MeshStandardMaterial({ color: 0xaab4be, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }),
          true
        );
        buildFenceBatch(
          acceptedArmcoPosts,
          BG.armcoPost,
          new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.80, roughness: 0.40 }),
          false
        );
        buildFenceBatch(
          acceptedArmcoReflectors,
          BG.armcoRefl,
          new THREE.MeshBasicMaterial({ color: 0xffb300 }),
          false
        );

        // Cache barrier geometries + materials for the streaming extension
        // path so future chunks emit the SAME 4-style rotation (Armco /
        // dry-stone / wood split-rail / Jersey concrete) instead of the
        // Armco-only strip that used to replace them past ~6km.
        this._barrierAssets = {
          postGeom: BG.woodPost,
          postMat: new THREE.MeshStandardMaterial({ color: 0x8a7a68, map: fWoodTex, normalMap: fWoodNormal, roughness: 0.85 }),
          railGeom: BG.woodRail,
          railMat: new THREE.MeshStandardMaterial({ color: 0x9a8a76, map: fWoodTex, normalMap: fWoodNormal, roughness: 0.85 }),
          stoneGeom: BG.stone,
          stoneMat: new THREE.MeshStandardMaterial({ color: 0x7a756c, map: stoneTex, normalMap: stoneNormal, roughness: 0.95, flatShading: true }),
          concreteGeom: BG.concrete,
          concreteMat: new THREE.MeshStandardMaterial({ color: 0xc9c5bc, roughness: 0.9, metalness: 0.02 }),
          armcoRailGeom: BG.armcoRail,
          armcoRailMat: new THREE.MeshStandardMaterial({ color: 0xaab4be, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }),
          armcoPostGeom: BG.armcoPost,
          armcoPostMat: new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.80, roughness: 0.40 }),
          armcoReflGeom: BG.armcoRefl,
          armcoReflMat: new THREE.MeshBasicMaterial({ color: 0xffb300 })
        };
      }

      // NPC/traffic vehicles (rickshaws/buses/mini-trucks) removed per the
      // slowroads-style pivot — open road, no AI traffic. `trafficVehicles`
      // stays an always-empty array (see updateTraffic below) rather than
      // being deleted outright, since it's still a harmless no-op read from
      // the animate() loop and the minimap draw call.
      scene.add(this.foliageGroup);
    },

    // Rock arch portals — placed only at tunnel entrance and exit points
    // to frame the opening and hide the seam where terrain meets the bore.

    buildGroundCover(u0, u1, season) {
      const group = new THREE.Group();
      group.name = 'GroundCover';
      try {
        try { if (localStorage.getItem('shiplyp_groundCover') !== '1') return group; } catch (e) { return group; }   // OFF by default: plants only on the footpath and around houses (user, B168)
        if (!this.curve || this.seasonKey === 'winter') return group;
        const len = this.curve.getLength(), STEP = 2.0;
        const n = Math.max(2, Math.ceil(((u1 - u0) * len) / STEP));
        const tuftGeoms = RoadGrassFactory.patchGeoms(), tuftMat = RoadGrassFactory.patchMaterial();
        const shrubGeoms = ClumpTreeFactory.shrubGeoms(), shrubMat = ClumpTreeFactory.shrubMaterial();
        const tufts = tuftGeoms.map(() => []), shrubs = shrubGeoms.map(() => []);
        const up = new THREE.Vector3(0, 1, 0), dummy = new THREE.Object3D();
        const buildings = (this.obstacles || []).filter(o => o.type === 'building');
        const hash = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
        const blocked = (pos, absLat, margin) => {
          if (this._onAccessPath(pos, 3.4) || this._nearStructure(pos, 1.3)) return true;   // walkway + the paved frontage of every house/stall/garage stay clear (B167)
          if (this.roadSpatialGrid && absLat > 4 && this.roadSpatialGrid.getNearestRoadPoint(pos.x, pos.z, absLat - 3.0)) return true;
          for (const o of buildings) if (o.pos.distanceTo(pos) < o.radius + margin) return true;
          return false;
        };
        [-1, 1].forEach((side) => {
          for (let k = 0; k <= n; k++) {
            const u = u0 + (u1 - u0) * (k / n), sm = Math.round(u * len);
            if (this._inTunnelAtU(u, 3)) continue;
            const pu = THREE.MathUtils.clamp(u, 0, 1);
            const pt = this.curve.getPointAt(pu);
            const tg = this.curve.getTangentAt(pu).setY(0).normalize();
            const nrm = new THREE.Vector3().crossVectors(tg, up).normalize();
            // Dense PATCHES, not single plants (B165): rows every ~1.1 m out to 14 m, then every ~2.4 m out to 34 m;
            // each card is a packed cluster of real plants, so the cover is continuous. Thins (never bare) with distance.
            const LAT = [6.7, 7.8, 8.9, 10.0, 11.1, 12.2, 13.3, 14.4, 16.8, 19.2, 21.6, 24.0, 26.4, 28.8, 31.2, 33.6];
            for (let rI = 0; rI < LAT.length; rI++) {
              const r1 = hash(sm * 5 + rI, side + 41), r2 = hash(sm * 7 + rI, side + 43), r3 = hash(sm * 11 + rI, side + 47), r4 = hash(sm * 13 + rI, side + 53);
              if (rI >= 8 && r1 > 0.78 - rI * 0.012) continue;                   // outer rows thin out a little
              const absLat = LAT[rI] + (r2 - 0.5) * (rI < 8 ? 0.9 : 1.8);
              const pos = pt.clone().addScaledVector(nrm, side * absLat).addScaledVector(tg, (r3 - 0.5) * STEP * 0.8);
              if (blocked(pos, absLat, 1.5)) continue;
              pos.y = this.groundHeightAt(pt, pos, side * absLat) - 0.04;
              const sc = (1.7 + r4 * 0.5) * (1 + (absLat - 6) * 0.018);               // wider cards further out so the cover keeps up
              dummy.position.copy(pos); dummy.rotation.set(0, r3 * Math.PI * 2, 0); dummy.scale.set(sc, sc * (0.9 + r2 * 0.25), sc); dummy.updateMatrix();
              const m = dummy.matrix.clone(); const g = 0.93 + r4 * 0.16;
              m._tint = new THREE.Color(g, g, g * 0.97);
              tufts[Math.floor(r2 * 6 + r4 * 3) % 6].push(m);
            }
            // a low shrub every so often, set back from the road
            if (hash(sm, side + 60) < 0.035) {
              const r1 = hash(sm, side + 61), r2 = hash(sm, side + 62), r3 = hash(sm, side + 63);
              const absLat = 8.5 + 17 * r1;
              const pos = pt.clone().addScaledVector(nrm, side * absLat).addScaledVector(tg, (r2 - 0.5) * STEP);
              if (!blocked(pos, absLat, 2.5)) {
                pos.y = this.groundHeightAt(pt, pos, side * absLat) - 0.05;
                const w = 1.3 + r3 * 1.3, h = w * (0.65 + r2 * 0.3);
                dummy.position.copy(pos); dummy.rotation.set(0, r3 * Math.PI * 2, 0); dummy.scale.set(w, h, w); dummy.updateMatrix();
                const m = dummy.matrix.clone();
                m._tint = new THREE.Color(0.8 + r2 * 0.2, 0.85 + r3 * 0.15, 0.78 + r1 * 0.1);
                shrubs[Math.floor(r3 * 6) % 6].push(m);
              }
            }
          }
        });
        const colour = (mesh, list) => { list.forEach((m, i) => mesh.setColorAt(i, m._tint)); mesh.instanceColor.needsUpdate = true; };
        tufts.forEach((list, v) => addChunkedInstances(group, tuftGeoms[v], tuftMat, list, { cell: 200, onChunk: colour }));
        shrubs.forEach((list, v) => addChunkedInstances(group, shrubGeoms[v], shrubMat, list, { cell: 240, onChunk: colour }));
      } catch (err) {
        console.error('buildGroundCover failed:', err);
      }
      return group;
    },

    // Grass tufts along both sides of the footpath for u0..u1, leaning in over its outer edge.
    // Uses its own hash RNG so it never disturbs the world's seeded prng sequence.

    buildRoadsideGrass(u0, u1) {
      const group = new THREE.Group();
      group.name = 'RoadsideGrass';
      try {
        if (!RoadGrassFactory.enabled() || !this.curve || !CONFIG.SIDEWALK || !CONFIG.SIDEWALK.enabled) return group;
        const W = CONFIG.SIDEWALK.width, KERB = CONFIG.SIDEWALK.kerb;
        const roadHalf = CONFIG.ROAD_WIDTH * 0.52, outerEdge = roadHalf + W;
        const len = this.curve.getLength();
        const STEP = 0.9;
        const n = Math.max(2, Math.ceil(((u1 - u0) * len) / STEP));
        const geoms = RoadGrassFactory.geoms(), mat = RoadGrassFactory.material();
        const buckets = geoms.map(() => []);
        const up = new THREE.Vector3(0, 1, 0), dummy = new THREE.Object3D();
        const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), tilted = new THREE.Vector3(), lean = new THREE.Vector3();
        const bankAtU = (u) => {
          const b = this.roadBankingAngles; if (!b || !b.length) return 0;
          const f = THREE.MathUtils.clamp(u, 0, 1) * (b.length - 1), i = Math.floor(f);
          return THREE.MathUtils.lerp(b[i] || 0, b[Math.min(i + 1, b.length - 1)] || 0, f - i);
        };
        const hash = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
        [-1, 1].forEach((side) => {
          for (let k = 0; k <= n; k++) {
            const u = u0 + (u1 - u0) * (k / n), sm = Math.round(u * len);
            // Even, continuous fringe: only a very gentle thinning so it never reads as random clumps.
            const thin = 0.5 + 0.5 * Math.sin(sm / 120 + side * 1.7);
            if (hash(sm, side + 11) > 0.86 + 0.14 * thin) continue;
            if (this._inTunnelAtU(u, 2)) continue;
            const pu = THREE.MathUtils.clamp(u, 0, 1);
            const pt = this.curve.getPointAt(pu);
            const tg = this.curve.getTangentAt(pu).setY(0).normalize();
            const nrm = new THREE.Vector3().crossVectors(tg, up).normalize();
            const r1 = hash(sm * 7, side + 5), r2 = hash(sm * 13, side + 9), r3 = hash(sm * 17, side + 21), r4 = hash(sm * 19, side + 31);
            // OUTER edge of the footpath (barrier side), standing on the ground just OUTSIDE it: the base is set back
            // by half the card width, so the whole plant clears the walkway instead of overlapping it.
            // Cards are square (real plant sprites from the Poly Haven atlas); SIZES are real-world-ish plant widths.
            const vi = k % 4;                                              // ferns and broadleaf weeds only along the footpath
            const S = [1.45, 1.45, 1.15, 1.15][vi] * (0.85 + r3 * 0.3);
            const topY = pt.y + 0.12 + side * roadHalf * Math.sin(bankAtU(u)) + KERB;
            const absLat = outerEdge + S * 0.47 + 0.08 + r1 * 0.3;
            const lat = side * absLat;
            const pos = pt.clone().addScaledVector(nrm, lat);
            if (this._nearStructure(pos, 6.0)) continue;                     // no footpath tufts along the whole frontage of garages, homes, tea stalls (B164/B166)
            pos.y = Math.min(this.groundHeightAt(pt, pos, lat), topY);
            const leanA = THREE.MathUtils.degToRad(5 + r3 * 4);             // barely leaning toward the footpath, no overhang onto it
            lean.copy(nrm).multiplyScalar(-side);
            tilted.copy(up).multiplyScalar(Math.cos(leanA)).addScaledVector(lean, Math.sin(leanA)).normalize();
            q1.setFromUnitVectors(up, tilted);
            q2.setFromAxisAngle(tilted, r4 * Math.PI * 2);
            dummy.position.copy(pos);
            dummy.quaternion.copy(q2).multiply(q1);
            dummy.scale.set(S, S, S);
            dummy.updateMatrix();
            const m = dummy.matrix.clone();
            const g = 1.0 + (r4 - 0.5) * 0.12;                           // very light brightness variation
            m._tint = new THREE.Color(1.3 * g, 1.34 * g, 1.1 * g);       // the real leaf photos are dull; lift them to sit with the lit scene
            buckets[vi].push(m);                                      // variants cycle evenly, no random runs
          }
        });
        buckets.forEach((mats, v) => addChunkedInstances(group, geoms[v], mat, mats, {
          cell: 220,
          onChunk: (mesh, list) => { list.forEach((m, i) => mesh.setColorAt(i, m._tint)); mesh.instanceColor.needsUpdate = true; }
        }));
      } catch (err) {
        console.error('buildRoadsideGrass failed:', err);
      }
      return group;
    },

    // Rendered surface height (road slab + banking on the carriageway, verge /
    // terrain beyond it) at an arbitrary world position, using the nearest road
    // segment rather than a caller-supplied spline point. For anything that
    // walks or stands: groundHeightAt() alone is the ground UNDER the road slab
    // and ignores banking, which sank crossers up to ~0.5 m into the asphalt.

    buildHouseFlowers(u0, u1) {
      const group = new THREE.Group();
      group.name = 'HouseFlowers';
      try {
        try { if (localStorage.getItem('shiplyp_houseFlowers') === '0') return group; } catch (e) { /* default on */ }
        const grid = this.roadSpatialGrid, pts = this.roadSpacedPoints;
        if (!grid || !pts || !this.curve) return group;
        const geoms = RoadGrassFactory.geoms(), mat = RoadGrassFactory.material();
        const buckets = geoms.map(() => []);
        const dummy = new THREE.Object3D();
        const hash = (a, b, c) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
        const structs = this._structures(), L = this.curve.getLength(), segLen = L / (pts.length - 1);
        for (const st of structs) {
          if (st.corridor) continue;
          const near = grid.getNearestRoadPoint(st.pos.x, st.pos.z, 46);
          if (!near) continue;
          const u = near.index * segLen / L;
          if (u < u0 - 0.002 || u > u1) continue;
          if (this._inTunnelAtU && this._inTunnelAtU(u, 3)) continue;
          const sx = Math.round(st.pos.x * 3), sz = Math.round(st.pos.z * 3);
          const rIn = st.r + 1.4, rOut = st.r + 5.0, area = Math.PI * (rOut * rOut - rIn * rIn);
          const n = Math.min(900, Math.round(area * 2.4));
          const p0 = pts[near.index], p1 = pts[Math.min(near.index + 1, pts.length - 1)];
          const side = Math.sign((p1.x - p0.x) * (st.pos.z - p0.z) - (p1.z - p0.z) * (st.pos.x - p0.x)) || 1;
          for (let i = 0; i < n; i++) {
            const a = hash(sx, sz, i * 3) * Math.PI * 2, rad = rIn + (rOut - rIn) * Math.sqrt(hash(sx, sz, i * 3 + 1));
            const pos = new THREE.Vector3(st.pos.x + Math.cos(a) * rad, 0, st.pos.z + Math.sin(a) * rad);
            const nr = grid.getNearestRoadPoint(pos.x, pos.z, 7.0);
            if (nr) continue;                                           // never on the footpath or road
            if (this._onAccessPath(pos, 2.4)) continue;                  // keep the walkway to the door clear (B167)
            if (this._onCompoundWall(pos.x, pos.z, 0.55)) continue;      // no tufts through the boundary wall (B180)
            let hit = false; for (const o of structs) { if (o.pos === st.pos) continue; const dx = o.pos.x - pos.x, dz = o.pos.z - pos.z, rr = o.r + 1.0; if (dx * dx + dz * dz < rr * rr) { hit = true; break; } }
            if (hit) continue;
            const lat = Math.hypot(pos.x - near.point.x, pos.z - near.point.z);
            pos.y = this.groundHeightAt(near.point, pos, side * lat) - 0.02;
            const r1 = hash(sx, sz, i * 5 + 11), r2 = hash(sx, sz, i * 5 + 12), r3 = hash(sx, sz, i * 5 + 13);
            const h = 0.42 + r1 * 0.4, w = h * (1.0 + r2 * 0.2);
            dummy.position.copy(pos); dummy.rotation.set(0, r3 * Math.PI * 2, 0); dummy.scale.set(w, h, w); dummy.updateMatrix();
            const m = dummy.matrix.clone(); const g = 0.95 + r2 * 0.2;
            m._tint = new THREE.Color(1.3 * g, 1.34 * g, 1.12 * g);
            buckets[r3 < 0.82 ? 4 + (r2 > 0.5 ? 1 : 0) : Math.floor(r1 * 4) % 4].push(m);       // ~82% flowering sorrel, the rest leafy filler
          }
        }
        // Road furniture (poles, signs, beacons) is scattered along the road with no knowledge of the entrance gates, and about half
        // the gates ended up with a pole right on their axis (B176). Slide such small prop groups sideways, clear of the gate walls.
        for (const tg of (this.deliveryTargets || [])) {
          const pi = tg.pathInfo; if (!pi || tg.splineU < u0 - 0.002 || tg.splineU > u1 || pi._furnitureMoved) continue;
          pi._furnitureMoved = true;
          const gp = pi.pt.clone().addScaledVector(pi.normal, pi.startT + 0.7 * (Math.sign(pi.endT - pi.startT) || 1));
          for (const o of this.foliageGroup.children) {
            if (!o.isGroup || !o.children || o.children.length < 1 || o.children.length > 12 || o.userData.isCrosser || o.userData.isDriveway || o.userData.housePos) continue;
            const dx = o.position.x - gp.x, dz = o.position.z - gp.z, dT = dx * pi.tangent.x + dz * pi.tangent.z, dN = dx * pi.normal.x + dz * pi.normal.z;
            if (Math.abs(dT) > 2.4 || Math.abs(dN) > 2.2) continue;
            const move = (dT >= 0 ? 1 : -1) * 4.4 - dT;
            o.position.addScaledVector(pi.tangent, move);
            const ob = this.obstacles.find((x) => x.mesh === o); if (ob) ob.pos.addScaledVector(pi.tangent, move);
          }
        }
        // Lawn tufts inside each boundary wall (B180): a band of the game's own flowering/leafy tufts hugging the inside of the wall
        // all round, plus the front corners. Own group name so 'house-frontage-clear' does not count them, but still keeps 6.3 m clear
        // of the drop ring and off the path.
        const lawnGroup = new THREE.Group(); lawnGroup.name = 'CompoundFlowers'; group.add(lawnGroup);
        const lbuckets = geoms.map(() => []);
        for (const tg of (this.deliveryTargets || [])) {
          const pi = tg.pathInfo, c = pi && pi.compound; if (!c || tg.splineU < u0 - 0.002 || tg.splineU > u1) continue;
          const sx = Math.round(pi.pt.x * 3), sz = Math.round(pi.pt.z * 3), tLo = Math.min(c.tF, c.tB), tHi = Math.max(c.tF, c.tB);
          const bands = [   // [tMin, tMax, latMin, latMax]
            [tLo + 0.45, tHi - 0.45, c.W - 1.35, c.W - 0.5], [tLo + 0.45, tHi - 0.45, -c.W + 0.5, -c.W + 1.35],     // side walls
            [tHi - 1.35, tHi - 0.5, -c.W + 0.5, c.W - 0.5],                                                         // back wall
            [tLo + 0.45, tLo + 1.4, 2.5, c.W - 0.5], [tLo + 0.45, tLo + 1.4, -c.W + 0.5, -2.5]];                    // front wall, either side of the gate
          let k = 0;
          for (const [t0b, t1b, l0, l1] of bands) {
            const n = Math.round((t1b - t0b) * (l1 - l0) * 5.5);
            for (let i = 0; i < n; i++, k++) {
              const t = t0b + hash(sx, sz, 2000 + k * 3) * (t1b - t0b), lat = l0 + hash(sx, sz, 2001 + k * 3) * (l1 - l0);
              const pos = pi.pt.clone().addScaledVector(pi.normal, t).addScaledVector(pi.tangent, lat);
              if (Math.hypot(pos.x - tg.pos.x, pos.z - tg.pos.z) < 6.3) continue;
              pos.y = this.groundHeightAt(pi.pt, pos, t) - 0.02;
              const r1 = hash(sx, sz, 2002 + k * 3), r2 = hash(sx, sz, 5000 + k), r3 = hash(sx, sz, 7000 + k);
              const h = 0.4 + r1 * 0.38, w = h * (1.0 + r2 * 0.2);
              dummy.position.copy(pos); dummy.rotation.set(0, r3 * Math.PI * 2, 0); dummy.scale.set(w, h, w); dummy.updateMatrix();
              const m = dummy.matrix.clone(), g = 0.95 + r2 * 0.2; m._tint = new THREE.Color(1.3 * g, 1.34 * g, 1.12 * g);
              lbuckets[r3 < 0.82 ? 4 + (r2 > 0.5 ? 1 : 0) : Math.floor(r1 * 4) % 4].push(m);
            }
          }
        }
        lbuckets.forEach((list, v) => addChunkedInstances(lawnGroup, geoms[v], mat, list, { cell: 200, onChunk: (mesh, l) => { l.forEach((m, i) => mesh.setColorAt(i, m._tint)); mesh.instanceColor.needsUpdate = true; } }));
        // Planter plants (B176): the SAME flowering/leafy tufts as the rest of the world, standing in the entrance pots. Own group name so
        // the 'house-frontage-clear' rule (no wild plants on the drop frontage) does not count them.
        const planterGroup = new THREE.Group(); planterGroup.name = 'PlanterPlants'; group.add(planterGroup);
        const pbuckets = geoms.map(() => []);
        for (const tg of (this.deliveryTargets || [])) {
          const pi = tg.pathInfo; if (!pi || tg.splineU < u0 - 0.002 || tg.splineU > u1) continue;
          const dirS = Math.sign(pi.endT - pi.startT) || 1, sx = Math.round(pi.pt.x * 3), sz = Math.round(pi.pt.z * 3);
          for (const sd of [-1, 1]) {
            const t = pi.endT - dirS * 0.7, base = pi.pt.clone().addScaledVector(pi.normal, t).addScaledVector(pi.tangent, sd * 1.95);
            base.y = this.groundHeightAt(pi.pt, base, t) + 0.6;
            for (let i = 0; i < 7; i++) {
              const r1 = hash(sx, sz, 900 + sd * 20 + i), r2 = hash(sx, sz, 940 + sd * 20 + i), r3 = hash(sx, sz, 980 + sd * 20 + i), a = r1 * Math.PI * 2, rad = Math.sqrt(r2) * 0.2;
              const h = 0.36 + r3 * 0.22, w = h * 1.05;
              dummy.position.set(base.x + Math.cos(a) * rad, base.y, base.z + Math.sin(a) * rad); dummy.rotation.set(0, r1 * 6.28, 0); dummy.scale.set(w, h, w); dummy.updateMatrix();
              const m = dummy.matrix.clone(), g = 0.95 + r2 * 0.2; m._tint = new THREE.Color(1.3 * g, 1.34 * g, 1.12 * g);
              pbuckets[r3 < 0.8 ? 4 + (r2 > 0.5 ? 1 : 0) : Math.floor(r1 * 4) % 4].push(m);
            }
          }
        }
        pbuckets.forEach((list, v) => addChunkedInstances(planterGroup, geoms[v], mat, list, { cell: 200, onChunk: (mesh, l) => { l.forEach((m, i) => mesh.setColorAt(i, m._tint)); mesh.instanceColor.needsUpdate = true; } }));
        // Flower beds along both kerbs of every entrance path (B173): two dense strips, never on the slabs themselves.
        for (const tg of (this.deliveryTargets || [])) {
          const pi = tg.pathInfo; if (!pi || tg.splineU < u0 - 0.002 || tg.splineU > u1) continue;
          const sx = Math.round(pi.pt.x * 3), sz = Math.round(pi.pt.z * 3), span = Math.abs(pi.endT - pi.startT);
          const n = Math.round(span * 2 * 1.0 * 9);
          for (let i = 0; i < n; i++) {
            const sgn = i % 2 ? 1 : -1, along = hash(sx, sz, i * 7) * span, off = 1.7 + hash(sx, sz, i * 7 + 1) * 0.9;
            const t = pi.startT + Math.sign(pi.endT - pi.startT) * along;
            const pos = pi.pt.clone().addScaledVector(pi.normal, t).addScaledVector(pi.tangent, sgn * off);
            if (Math.hypot(pos.x - tg.pos.x, pos.z - tg.pos.z) < 6.3) continue;   // the drop point's frontage stays bare (B167)
            pos.y = this.groundHeightAt(pi.pt, pos, t) - 0.02;
            const r1 = hash(sx, sz, i * 7 + 2), r2 = hash(sx, sz, i * 7 + 3), r3 = hash(sx, sz, i * 7 + 4);
            const h = 0.4 + r1 * 0.35, w = h * (1.0 + r2 * 0.2);
            dummy.position.copy(pos); dummy.rotation.set(0, r3 * Math.PI * 2, 0); dummy.scale.set(w, h, w); dummy.updateMatrix();
            const m = dummy.matrix.clone(); const g = 0.95 + r2 * 0.2;
            m._tint = new THREE.Color(1.3 * g, 1.34 * g, 1.12 * g);
            buckets[r3 < 0.85 ? 4 + (r2 > 0.5 ? 1 : 0) : Math.floor(r1 * 4) % 4].push(m);
          }
        }
        buckets.forEach((list, v) => addChunkedInstances(group, geoms[v], mat, list, { cell: 200, onChunk: (mesh, l) => { l.forEach((m, i) => mesh.setColorAt(i, m._tint)); mesh.instanceColor.needsUpdate = true; } }));
      } catch (err) {
        console.error('buildHouseFlowers failed:', err);
      }
      return group;
    },

    // Ground cover (B153): grass tufts, flowering tufts and low shrubs scattered across the verge
    // and hillside, dense near the road and thinning with distance. Built AFTER the props so it
    // can keep clear of buildings; never lands on another stretch of road (the route loops).
    // Own hash RNG (never the world prng). Kill switch: localStorage.shiplyp_groundCover = '0'.

    _pineBin(k) {
      const bins = this._pineBins || (this._pineBins = []);
      if (bins[k] !== undefined) return bins[k];
      const L = this.curve.getLength(), u = Math.min(1, (k * 25) / L), up = new THREE.Vector3(0, 1, 0);
      const pt = this.curve.getPointAt(u), tg = this.curve.getTangentAt(u).setY(0).normalize(), n = new THREE.Vector3().crossVectors(tg, up).normalize();
      let best = -1e9;
      for (const sd of [-1, 1]) { const far = pt.clone().addScaledVector(n, sd * 55); best = Math.max(best, this.groundHeightAt(pt, far, sd * 55) - pt.y); }
      return (bins[k] = best);
    },

    _pineScore(k) {
      const maxK = Math.floor(this.curve.getLength() / 25); let sum = 0, cnt = 0;
      for (let j = k - 6; j <= k + 6; j++) { if (j < 0 || j > maxK) continue; sum += this._pineBin(j); cnt++; }
      return cnt ? sum / cnt : 0;
    },

    _pineThreshold() {
      if (this._pineThr !== undefined) return this._pineThr;
      const maxK = Math.floor(this.curve.getLength() / 25), sc = [];
      for (let k = 0; k <= maxK; k++) sc.push(this._pineScore(k));
      sc.sort((x, y) => x - y);
      return (this._pineThr = sc[Math.floor(0.65 * (sc.length - 1))]);
    },
    // Zone label per 25 m bin: above the threshold = hill. Short runs are merged into their neighbours until every
    // run is at least PINE_MIN_RUN long, so a stretch is wholly pine or wholly broadleaf, never a patchwork.

    _pineLabels() {
      if (this._pineLab) return this._pineLab;
      const maxK = Math.floor(this.curve.getLength() / 25), thr = this._pineThreshold(), MIN = 24;        // 24 bins = 600 m
      const lab = []; for (let k = 0; k <= maxK; k++) lab.push(this._pineScore(k) > thr);
      for (let pass = 0; pass < 12; pass++) {
        let changed = false, i = 0;
        while (i <= maxK) {
          let j = i; while (j + 1 <= maxK && lab[j + 1] === lab[i]) j++;
          if (j - i + 1 < MIN) {                                          // flip a short run to match its longer neighbour
            const left = i > 0 ? lab[i - 1] : null, right = j < maxK ? lab[j + 1] : null;
            const to = left === null ? right : (right === null ? left : left);
            if (to !== null && to !== lab[i]) { for (let k = i; k <= j; k++) lab[k] = to; changed = true; }
          }
          i = j + 1;
        }
        if (!changed) break;
      }
      return (this._pineLab = lab);
    },

    _pineZoneAt(pt, normal, side) {
      const grid = this.roadSpatialGrid, pts = this.roadSpacedPoints;
      if (!grid || !pts || !pts.length) return false;
      const near = grid.getNearestRoadPoint(pt.x, pt.z, 12);
      const idx = near ? near.index : 0, segLen = this.curve.getLength() / (pts.length - 1);
      const k = Math.round(idx * segLen / 25), lab = this._pineLabels();
      return k < lab.length ? lab[k] : this._pineScore(k) > this._pineThreshold();
    },

    // Roadside variety (B154): the barrier style changes by stretch of road. A deterministic hash of
    // the 400 m map cell the barrier stands in (never the world prng), so the initial build and the
    // streamed extensions always agree. 0 = steel guardrail (most common), 1 = dry-stone wall,
    // 2 = timber split-rail, 3 = concrete Jersey barrier. OPT-IN (user did not ask for the barrier itself to
    // change): off by default, so the route keeps CONFIG.BARRIER_STYLE everywhere. Enable for A/B with
    // localStorage.shiplyp_barrierVariety = '1'.

    _structures() {
      const obs = this.obstacles || [], gaps = this.fenceGapSites || [];
      if (this._structCache && this._structCache.o === obs.length && this._structCache.g === gaps.length && this._structCache.d === (this.deliveryTargets || []).length) return this._structCache.list;
      const list = [];
      for (const o of obs) if (o.type === 'building' && o.radius < 14) list.push({ pos: o.pos, r: o.radius });
      for (const g of gaps) list.push({ pos: g.pos, r: Math.min(g.r, 12) });
      for (const t of (this.deliveryTargets || [])) { const tp = t.pos || t.position || t.housePos; if (tp) list.push({ pos: tp, r: 5.5 }); }   // house frontage: gate, plinth, steps
      if (this.roadNet) for (const c of this.roadNet.corridorCircles()) list.push({ pos: c.pos, r: c.r, corridor: true });   // WI-05: cross roads
      // Access path (B167): a clear walkway from the road to the structure, so plants go AROUND the way in, not across it.
      const grid = this.roadSpatialGrid;
      if (grid) for (const st of list) { const n = grid.getNearestRoadPoint(st.pos.x, st.pos.z, 24); st.b = n ? n.point : null; }
      this._structCache = { o: obs.length, g: gaps.length, d: (this.deliveryTargets || []).length, list };
      return list;
    },
    // True when `pos` lies within `halfW` of the walkway line from any structure to the road in front of it.

    _onAccessPath(pos, halfW) {
      const l = this._structures();
      for (let i = 0; i < l.length; i++) {
        const s = l[i]; if (!s.b || s.corridor) continue;
        const ax = s.pos.x, az = s.pos.z, dx = s.b.x - ax, dz = s.b.z - az, len2 = dx * dx + dz * dz; if (len2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((pos.x - ax) * dx + (pos.z - az) * dz) / len2));
        const px = ax + dx * t - pos.x, pz = az + dz * t - pos.z; if (px * px + pz * pz < halfW * halfW) return true;
      }
      return false;
    },
    // Is (x,z) inside any house compound (boundary-wall rectangle), grown by `margin`? Used to keep trees and rocks off the lawn and the walls.

    _inCompound(x, z, margin = 0) {
      const l = this.houseCompounds; if (!l) return false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i], dx = x - c.pt.x, dz = z - c.pt.z, n = dx * c.normal.x + dz * c.normal.z, t = dx * c.tangent.x + dz * c.tangent.z;
        if (n > c.t0 - margin && n < c.t1 + margin && Math.abs(t) < c.W + margin) return true;
      }
      return false;
    },
    // True when (x,z) is on or within `band` of the boundary wall line itself (not the open lawn inside, not far outside).

    _onCompoundWall(x, z, band = 0.6) {
      const l = this.houseCompounds; if (!l) return false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i], dx = x - c.pt.x, dz = z - c.pt.z, n = dx * c.normal.x + dz * c.normal.z, t = dx * c.tangent.x + dz * c.tangent.z;
        if (n > c.t0 - band && n < c.t1 + band && Math.abs(t) < c.W + band && !(n > c.t0 + band && n < c.t1 - band && Math.abs(t) < c.W - band)) return true;
      }
      return false;
    },

    _nearStructure(pos, margin) {
      const l = this._structures();
      for (let i = 0; i < l.length; i++) { const s = l[i]; const dx = s.pos.x - pos.x, dz = s.pos.z - pos.z, rr = s.r + margin; if (dx * dx + dz * dz < rr * rr) return true; }
      return false;
    },

    // Densely packed flower tufts in a ring around every house, garage and stall near the road (B164).

    buildViewpointOrChai({ pt, normal, tangent, side, dist, isChaiTapri, targetParentGroup = null }) {
      const calcTerrainY = (pos, latDist) => this.groundHeightAt(pt, pos, latDist);
      const kioskPos = pt.clone().addScaledVector(normal, side * dist);
      kioskPos.y = calcTerrainY(kioskPos, side * dist);

      const kioskGroup = new THREE.Group();

      if (isChaiTapri) {
        const stallModel = ChaiTapriAsset.clone();
        if (stallModel) {
          kioskGroup.add(stallModel);
        } else {
          // Box stand-in until chai-tapri.glb arrives, then swapped in place.
          const standIn = new THREE.Group();
          const tRoof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 3.2), new THREE.MeshLambertMaterial({ color: 0xb45309 }));
          tRoof.position.set(0, 2.5, 0);
          tRoof.rotateX(0.08);
          standIn.add(tRoof);

          const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 1.2), new THREE.MeshLambertMaterial({ color: 0x451a03 }));
          counter.position.set(0, 0.5, 0.4);
          standIn.add(counter);

          const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.45, 8), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
          kettle.position.set(-0.9, 1.2, 0.4);
          standIn.add(kettle);
          kioskGroup.add(standIn);

          ChaiTapriAsset.pending.push(() => {
            const model = ChaiTapriAsset.clone();
            if (!model) return;
            kioskGroup.remove(standIn);
            kioskGroup.add(model);
          });
        }

        // Patron: the same rigged courier used for roadside pedestrians,
        // standing on the Idle clip with a cutting-chai glass. Was a
        // BoxGeometry torso and a Dodecahedron head, which read as a crate
        // with a rock on it at the distance you actually pass a tapri.
        //
        // The model loads async, so a stall built before it arrives gets the
        // glass and an empty spot; CourierAsset.pendingControllers re-runs this
        // once the template lands, matching how every other rig here is built.
        const patron = new THREE.Group();
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 6), new THREE.MeshLambertMaterial({ color: 0xc2410c }));
        cup.position.set(0.28, 1.15, 0.22);
        patron.add(cup);

        const addPatronRig = () => {
          const rig = this.buildPedestrian();
          if (!rig) return;
          // Idle, not Walking — buildPedestrian starts the walk cycle for
          // strollers, so stop it before the standing clip is faded in.
          const actions = rig.userData.actions || {};
          if (actions['Walking']) actions['Walking'].stop();
          if (actions['Idle']) actions['Idle'].play();
          rig.rotation.y = Math.PI; // face the counter
          // Not a crosser — updateCrossers never sees it, so it must not be
          // skipped by the foliage visibility pass the way strollers are.
          rig.userData.isCrosser = false;
          patron.add(rig);
          this.patrons = this.patrons || [];
          this.patrons.push({ mixer: rig.userData.mixer, obj: rig });
        };
        if (CourierAsset.template) addPatronRig();
        else CourierAsset.pendingControllers.push(addPatronRig);

        patron.position.set(0.7, 0, 1.4);
        kioskGroup.add(patron);
      } else {
        const baseMat = new THREE.MeshStandardMaterial({
          color: 0x3d352e, roughness: 0.88, metalness: 0.1, flatShading: true
        });
        const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.4, 4.0), baseMat);
        basePlinth.position.set(0, 0.2, 0);
        kioskGroup.add(basePlinth);

        const timberMat = new THREE.MeshStandardMaterial({ color: 0x271911, roughness: 0.72, metalness: 0.05 });
        const cedarMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.65 });

        [[-1.9, -1.6], [1.9, -1.6], [-1.9, 1.6], [1.9, 1.6]].forEach(([px, pz]) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 0.22), timberMat);
          post.position.set(px, 1.45, pz);
          kioskGroup.add(post);
        });

        const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.3, 0.12), cedarMat);
        backWall.position.set(0, 1.45, -1.55);
        kioskGroup.add(backWall);

        const sideWallL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 3.0), cedarMat);
        sideWallL.position.set(-1.85, 1.45, 0);
        kioskGroup.add(sideWallL);

        const counterMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.5 });
        const counter = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.95, 0.65), counterMat);
        counter.position.set(0, 0.7, 0.85);
        kioskGroup.add(counter);

        const urnMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
        const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 10), urnMat);
        urn.position.set(-0.9, 1.35, 0.85);
        kioskGroup.add(urn);

        const roofMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4, metalness: 0.15 });
        const roof = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, 4.4), roofMat);
        roof.position.set(0, 2.85, 0.2);
        roof.rotateX(-0.06);
        kioskGroup.add(roof);

        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xffedd5, emissive: 0xffaa44, emissiveIntensity: 2.2, roughness: 0.2
        });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lampMat);
        lamp.position.set(0, 2.5, 0.7);
        kioskGroup.add(lamp);

        const crateMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
        [[-1.4, 0.35, 1.8], [-0.8, 0.35, 1.8], [1.3, 0.35, 1.6]].forEach(([cx, cy, cz]) => {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), crateMat);
          crate.position.set(cx, cy, cz);
          kioskGroup.add(crate);
        });
      }

      kioskGroup.position.copy(kioskPos);
      kioskGroup.lookAt(pt.x, kioskPos.y, pt.z); // flatten lookAt (Pattern 8)

      const parent = targetParentGroup || this.foliageGroup;
      parent.add(kioskGroup);
      this.obstacles.push({ pos: kioskPos.clone(), radius: 2.8, type: 'building', mesh: kioskGroup });
      this.addFenceGap(pt, normal, side, 3.5);
      if (isChaiTapri) {
        // Where a passing pedestrian stands to buy chai: in front of the
        // counter, left of the resident patron at local (0.7, 0, 1.4).
        kioskGroup.updateMatrixWorld(true);
        this.addPedDestination('stall', pt, kioskGroup.localToWorld(new THREE.Vector3(-0.5, 0, 1.45)), kioskPos.clone());
      }
      this.tryPlaceCrossingNear(pt);

      return { kioskGroup, kioskPos };
    },

    // Reusable Architectural Mountain Villa, Turnout Bay & Parcel Drop Plinth

    buildScenicVillaAndTurnout({
      pt, normal, tangent, houseSide, houseDist, order, isModernVilla, isWinter, u, tossRadius = 5.5, targetParentGroup = null
    }) {
      // B173: the house sits HOUSE_SETBACK further back than the old placement, which had the plinth touching the footpath
      // and left no room for an entrance. The drop ring now sits at the porch (end of the path).
      const HOUSE_SETBACK = 4.5;
      // The old gravel bay drew one prng value per segment for its colour jitter. Keep drawing them so every later house
      // and prop in world generation lands exactly where it did before (the ring must match `main`).
      const legacySegs = Math.max(4, Math.round(Math.abs(houseDist - houseSide * (CONFIG.ROAD_WIDTH * 0.5 - 0.25)) / 2.8));
      for (let i = 0; i <= legacySegs; i++) this.prng.next();
      houseDist += houseSide * HOUSE_SETBACK;
      const calcTerrainY = (pos, latDist) => this.groundHeightAt(pt, pos, latDist);
      const housePos = pt.clone().addScaledVector(normal, houseDist);
      housePos.y = calcTerrainY(housePos, houseDist);

      // Paved entrance path (B173): real concrete paving slabs from the road shoulder up to the house, stone kerb edging either side and a flower-bed strip beyond each kerb (plants added by
      // buildPathBeds). The path is a constant 2.8 m wide (a flare made the kerbs kink); nothing is ever planted on it.
      // Starts at the OUTER edge of the footpath (the footpath itself already carries pedestrians over to the gate), so the
      // kerbs never poke through it; the drop-kerb ramp is the first slab.
      const fpOuter = (CONFIG.SIDEWALK && CONFIG.SIDEWALK.enabled) ? CONFIG.ROAD_WIDTH * 0.52 + CONFIG.SIDEWALK.width + 0.12 : CONFIG.ROAD_WIDTH * 0.5 + 0.8;
      const startT = houseSide * fpOuter;
      const endT = houseDist - houseSide * 3.9;                       // stops at the front edge of the house plinth
      const dirP = Math.sign(endT - startT) || 1, sMesh = startT - dirP * 0.3, eMesh = endT + dirP * 0.9;   // B179: run 0.3 m under the footpath and 0.9 m under the porch slab so no terrain shows at either end
      const pathLen = Math.abs(eMesh - sMesh);
      const segments = Math.max(6, Math.round(pathLen / 0.7));           // short steps so the kerbs follow the verge easing smoothly
      const PT = 1.8;                                                  // paving texture repeat in metres
      const positions = [], uvs = [], colors = [], indices = [];
      const edgeL = [], edgeR = [], bedL = [], bedR = [];              // per-segment centre/width for the kerbs and beds
      const slabWarm = new THREE.Color(0x6e665a), slabCool = new THREE.Color(0x5e5a54);

      for (let s = 0; s <= segments; s++) {
        const frac = s / segments;
        const t = THREE.MathUtils.lerp(sMesh, eMesh, frac);
        const centerPos = pt.clone().addScaledVector(normal, t);
        centerPos.y = calcTerrainY(centerPos, t) + 0.10;
        const w = 2.8;
        const left = centerPos.clone().addScaledVector(tangent, -w * 0.5);
        left.y = calcTerrainY(left, t) + 0.10;
        const right = centerPos.clone().addScaledVector(tangent, w * 0.5);
        right.y = calcTerrainY(right, t) + 0.10;
        positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
        const dAlong = frac * pathLen;
        uvs.push(-w * 0.5 / PT, dAlong / PT, w * 0.5 / PT, dAlong / PT);
        const c = slabWarm.clone().lerp(slabCool, (Math.sin(s * 2.1) * 0.5 + 0.5) * 0.6);
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        edgeL.push({ p: left, t, w, frac }); edgeR.push({ p: right, t, w, frac });
      }
      for (let s = 0; s < segments; s++) {
        const a = s * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
      const driveGeom = new THREE.BufferGeometry();
      driveGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      driveGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      driveGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      driveGeom.setIndex(indices);
      driveGeom.computeVertexNormals();
      const driveMat = new THREE.MeshStandardMaterial({
        map: RealTextureFactory.pathPaversColor(), normalMap: RealTextureFactory.pathPaversNormal(), normalScale: new THREE.Vector2(0.8, 0.8),
        vertexColors: true, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide
      });
      const driveMesh = new THREE.Mesh(driveGeom, driveMat);
      driveMesh.receiveShadow = true;
      driveMesh.userData.isDriveway = true;
      driveMesh.userData.housePos = housePos.clone();

      // Stone kerb edging: a raised bar (top + two sides) along each edge of the path.
      const kPos = [], kUv = [], kInd = [];
      const KW = 0.20, KH = 0.14, KT = 1.4;
      const addKerb = (edge, outSign) => {
        for (let s = 0; s < edge.length; s++) {
          const e = edge[s]; const inner = e.p, outer = e.p.clone().addScaledVector(tangent, outSign * KW);
          const yb = inner.y - 0.02, yt = inner.y + KH;
          const along = (e.frac * pathLen) / KT;
          const iB = new THREE.Vector3(inner.x, yb, inner.z), iT = new THREE.Vector3(inner.x, yt, inner.z);
          const oB = new THREE.Vector3(outer.x, yb, outer.z), oT = new THREE.Vector3(outer.x, yt, outer.z);
          [iB, iT, oT, oB].forEach((v, k) => { kPos.push(v.x, v.y, v.z); kUv.push(k === 0 || k === 3 ? 0 : 0.5, along * (k < 2 ? 1 : 1)); });
        }
        const base = kPos.length / 3 - edge.length * 4;
        for (let s = 0; s < edge.length - 1; s++) {
          const a0 = base + s * 4, a1 = base + (s + 1) * 4;
          const q = (p0, p1, p2, p3) => kInd.push(p0, p1, p2, p0, p2, p3);
          q(a0 + 1, a0 + 2, a1 + 2, a1 + 1);                       // top
          q(a0 + 0, a0 + 1, a1 + 1, a1 + 0);                       // inner face
          q(a0 + 3, a1 + 3, a1 + 2, a0 + 2);                       // outer face
        }
      };
      const kerbOk = (e) => (e.t - startT) * dirP >= -0.01 && (e.t - endT) * dirP <= 0.05;   // kerbs only along the visible path, not under the footpath / porch
      addKerb(edgeL.filter(kerbOk), -1); addKerb(edgeR.filter(kerbOk), +1);
      const kerbGeom = new THREE.BufferGeometry();
      kerbGeom.setAttribute('position', new THREE.Float32BufferAttribute(kPos, 3));
      kerbGeom.setAttribute('uv', new THREE.Float32BufferAttribute(kUv, 2));
      kerbGeom.setIndex(kInd);
      kerbGeom.computeVertexNormals();
      const kerbMesh = new THREE.Mesh(kerbGeom, new THREE.MeshStandardMaterial({
        map: RealTextureFactory.edgeStoneColor(), normalMap: RealTextureFactory.edgeStoneNormal(), roughness: 0.95, side: THREE.DoubleSide, color: 0x7a7063
      }));
      kerbMesh.receiveShadow = true;
      driveMesh.add(kerbMesh);
      // Remember the path so buildPathBeds() can lay the flower beds along it once the rest of the world exists.
      const pathInfo = { pt: pt.clone(), normal: normal.clone(), tangent: tangent.clone(), houseSide, startT, endT };

      // Entrance props (B175): gate pillars with a swung-open leaf and low walls where the path meets the footpath, terracotta
      // planters either side of the door end, a letterbox post and a lantern post. One merged vertex-coloured mesh per house;
      // purely decorative (no obstacles, nothing on the slabs). Variation comes from a hash of the road point, not this.prng.
      {
        const hs = (k) => { let h = (Math.imul(Math.round(pt.x * 5) | 0, 374761393) + Math.imul(Math.round(pt.z * 5) | 0, 668265263) + Math.imul(k, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
        const dirS = Math.sign(endT - startT) || 1;
        const at = (t, lat) => { const p = pt.clone().addScaledVector(normal, t).addScaledVector(tangent, lat); p.y = calcTerrainY(p, t); return p; };
        const ang = Math.atan2(normal.x * dirS, normal.z * dirS);                       // yaw that points local +Z along the path toward the house
        const parts = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        const put = (geo, p, dy, yaw, sx, sy, sz, hex, rx = 0) => {
          q.setFromEuler(e.set(rx, ang + yaw, 0, 'YXZ')); m4.compose(new THREE.Vector3(p.x, p.y + dy, p.z), q, new THREE.Vector3(sx, sy, sz));
          parts.push({ g: geo.clone().applyMatrix4(m4), c: new THREE.Color(hex) });
        };
        const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(0.5, 0.4, 1, 8), blob = new THREE.IcosahedronGeometry(0.5, 0);
        const stone = [0x756b5e, 0x6a6155, 0x82766a][Math.floor(hs(1) * 3)], iron = 0x2b2f33, terra = [0xb5532f, 0xc2623a, 0xa0482a][Math.floor(hs(2) * 3)];
        const t0 = startT + dirS * 0.7;
        for (const sd of [-1, 1]) {
          const pp = at(t0, sd * 1.72);
          put(box, pp, 0.62, 0, 0.34, 1.24, 0.34, stone);                                 // pillar
          put(box, pp, 1.3, 0, 0.46, 0.1, 0.46, 0x574f45);                              // cap
          put(box, pp, 1.46, 0, 0.2, 0.2, 0.2, 0xf3e2b0); parts[parts.length - 1].lamp = true;   // lantern (glows at dusk/night)
        }
        // Boundary wall (B180): a compound wall right round the premises - front wall either side of the gate, side walls back
        // along the house, and a back wall behind it - leaving a lawn strip all round for flower tufts. Wall height follows the
        // ground (each 1.25 m panel is sunk 0.6 m below its lowest corner so slopes never leave gaps), with a cap slab and piers.
        const CW = 8.0, wF = t0, wB = houseDist + houseSide * 7.2, capHex = 0x574f45;
        const wall = (tA, lA, tZ, lZ) => {
          const len = Math.hypot(tZ - tA, lZ - lA), n = Math.max(1, Math.round(len / 1.25)), seg = len / n;
          const alongLat = Math.abs(lZ - lA) > Math.abs(tZ - tA);
          for (let k = 0; k < n; k++) {
            const f0 = k / n, f1 = (k + 1) / n, fm = (f0 + f1) / 2;
            const p0 = at(tA + (tZ - tA) * f0, lA + (lZ - lA) * f0), p1 = at(tA + (tZ - tA) * f1, lA + (lZ - lA) * f1), pm = at(tA + (tZ - tA) * fm, lA + (lZ - lA) * fm);
            const lo = Math.min(p0.y, p1.y, pm.y) - 0.6, hi = Math.max(p0.y, p1.y, pm.y) + 1.0, h = hi - lo;
            put(box, pm, (hi + lo) / 2 - pm.y, 0, alongLat ? seg + 0.04 : 0.24, h, alongLat ? 0.24 : seg + 0.04, stone);
            put(box, pm, hi - pm.y + 0.04, 0, alongLat ? seg + 0.04 : 0.36, 0.08, alongLat ? 0.36 : seg + 0.04, capHex);
            if (k % 4 === 0) put(box, p0, (hi + 0.1 + lo) / 2 - p0.y, 0, 0.42, h + 0.1, 0.42, stone);
          }
        };
        for (const sd of [-1, 1]) {
          wall(wF, sd * 1.95, wF, sd * CW);                                              // front wall, from the gate pillar out to the corner
          wall(wF, sd * CW, wB, sd * CW);                                                // side wall
        }
        wall(wB, -CW, wB, CW);                                                           // back wall
        for (const [ct, cl] of [[wF, -CW], [wF, CW], [wB, -CW], [wB, CW]]) { const cp = at(ct, cl); put(box, cp, 0.62, 0, 0.5, 1.5, 0.5, stone); put(box, cp, 1.4, 0, 0.62, 0.1, 0.62, capHex); }   // corner piers
        pathInfo.compound = { tF: wF, tB: wB, W: CW };
        this.houseCompounds = this.houseCompounds || [];
        this.houseCompounds.push({ pt: pt.clone(), normal: normal.clone(), tangent: tangent.clone(), t0: Math.min(wF, wB), t1: Math.max(wF, wB), W: CW });
        // gate leaf, hinged on one pillar and swung open about 75 degrees (towards the house)
        const side0 = hs(3) > 0.5 ? -1 : 1, gp = at(t0, side0 * 1.72), gy = ang + side0 * 1.3;
        const hinge = new THREE.Vector3(gp.x + Math.sin(gy) * 0.6, gp.y, gp.z + Math.cos(gy) * 0.6);
        put(box, hinge, 0.28, side0 * 1.3, 0.04, 0.05, 1.15, iron); put(box, hinge, 0.92, side0 * 1.3, 0.04, 0.05, 1.15, iron);   // rails
        for (let k = 0; k < 6; k++) { const o = new THREE.Vector3(hinge.x + Math.sin(gy) * (k - 2.5) * 0.19, hinge.y, hinge.z + Math.cos(gy) * (k - 2.5) * 0.19); put(box, o, 0.6, side0 * 1.3, 0.04, 0.78, 0.04, iron); }
        // planters flanking the door end of the path
        for (const sd of [-1, 1]) {
          const pp = at(endT - dirS * 0.7, sd * 1.95);
          put(cyl, pp, 0.28, 0, 0.55, 0.56, 0.55, terra);                              // pot; its plants are the game's own flowering tufts (see buildHouseFlowers)
          put(cyl, pp, 0.58, 0, 0.62, 0.06, 0.62, 0x8f3d22);                            // rim
          put(cyl, pp, 0.6, 0, 0.48, 0.03, 0.48, 0x3a2a1c);                             // soil
        }
        // letterbox post and a lantern post beside the gate
        const mp = at(t0 + dirS * 0.4, (hs(4) > 0.5 ? 1 : -1) * 2.35);
        put(box, mp, 0.55, 0, 0.1, 1.1, 0.1, 0x4a3a2a); put(box, mp, 1.2, 0, 0.42, 0.26, 0.24, [0xc23b2c, 0x2f5fa0, 0x2a7d52][Math.floor(hs(9) * 3)]);
        const lp = at(endT - dirS * 2.2, (hs(4) > 0.5 ? -1 : 1) * 2.35);
        put(box, lp, 0.7, 0, 0.08, 1.4, 0.08, iron); put(box, lp, 1.55, 0, 0.26, 0.3, 0.26, 0xf3e2b0); parts[parts.length - 1].lamp = true;
        // wheelie bins, a parked bicycle against the lawn side and a washing line behind the house front (B176)
        const sideA = hs(4) > 0.5 ? 1 : -1, tB = endT - dirS * 0.9;
        const binP = at(tB, -sideA * 3.2), binP2 = at(tB - dirS * 0.55, -sideA * 3.25);
        put(cyl, binP, 0.36, 0.2, 0.46, 0.72, 0.46, 0x2f7d4a); put(box, binP, 0.74, 0.2, 0.52, 0.06, 0.52, 0x23603a);
        put(cyl, binP2, 0.36, -0.1, 0.46, 0.72, 0.46, 0x2f5fa0); put(box, binP2, 0.74, -0.1, 0.52, 0.06, 0.52, 0x23477a);
        const torus = new THREE.TorusGeometry(0.32, 0.025, 5, 14), bk = at(tB - dirS * 0.2, sideA * 3.4), bikeC = [0xc23b2c, 0x2f5fa0, 0x2a7d52, 0xd9a21b][Math.floor(hs(11) * 4)];
        for (const wz of [-0.55, 0.55]) put(torus, new THREE.Vector3(bk.x + Math.sin(ang) * wz, bk.y, bk.z + Math.cos(ang) * wz), 0.33, Math.PI / 2, 1, 1, 1, 0x1d1f22);
        const bz = (z) => new THREE.Vector3(bk.x + Math.sin(ang) * z, bk.y, bk.z + Math.cos(ang) * z);
        put(box, bz(0.02), 0.68, 0, 0.035, 0.035, 0.65, bikeC);                      // top tube
        put(box, bz(0.05), 0.5, 0, 0.035, 0.035, 0.78, bikeC, -0.4);                 // down tube
        put(box, bz(-0.43), 0.535, 0, 0.03, 0.03, 0.5, bikeC, -1.04);                // rear stay
        put(box, bz(0.5), 0.5, 0, 0.03, 0.03, 0.62, 0x55595e, -1.25);                // fork
        put(box, bz(-0.3), 0.78, 0, 0.03, 0.3, 0.03, 0x55595e);                      // seat post
        put(box, bz(-0.3), 0.95, 0, 0.1, 0.045, 0.24, 0x1d1f22);                     // saddle
        put(box, bz(0.55), 0.84, 0, 0.46, 0.03, 0.03, 0x55595e);                     // handlebar
        put(box, bz(0.66), 0.95, 0, 0.3, 0.16, 0.22, 0x8a6a3c);                      // front basket
        const wl1 = at(endT + dirS * 0.4, sideA * 5.4), wl2 = at(endT + dirS * 3.6, sideA * 5.4);
        put(box, wl1, 1.0, 0, 0.07, 2.0, 0.07, 0x6b5a45); put(box, wl2, 1.0, 0, 0.07, 2.0, 0.07, 0x6b5a45);
        const wm = new THREE.Vector3((wl1.x + wl2.x) / 2, Math.max(wl1.y, wl2.y), (wl1.z + wl2.z) / 2);
        put(box, wm, 1.9, 0, 0.015, 0.015, 3.2, 0xcfcfcf);                            // the line
        const cloth = [0xe8e4d8, 0xc23b2c, 0x2f5fa0, 0xe8b04b, 0xf0f0f0, 0x7a4a8a];
        for (let k = 0; k < 5; k++) {
          const f = (k - 2) * 0.62, cp = new THREE.Vector3(wm.x + (wl2.x - wl1.x) / 3.2 * f, wm.y, wm.z + (wl2.z - wl1.z) / 3.2 * f);
          put(box, cp, 1.52, 0, 0.02, 0.62 + hs(20 + k) * 0.25, 0.46, cloth[Math.floor(hs(30 + k) * cloth.length)]);
        }
        // merge: solid props into one vertex-coloured mesh, lantern boxes into a second one whose emissive follows the window glow
        const mergeParts = (list) => {
          const pos = [], nor = [], col = [], idx = [];
          for (const pr of list) {
            const g = pr.g, pa = g.attributes.position, na = g.attributes.normal, o = pos.length / 3;
            for (let i = 0; i < pa.count; i++) { pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); nor.push(na.getX(i), na.getY(i), na.getZ(i)); col.push(pr.c.r, pr.c.g, pr.c.b); }
            if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + o); else for (let i = 0; i < pa.count; i++) idx.push(o + i);
            g.dispose();
          }
          const pg = new THREE.BufferGeometry();
          pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
          pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); pg.setIndex(idx);
          return pg;
        };
        if (!HousesAsset.propMat) HousesAsset.propMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
        const propMesh = new THREE.Mesh(mergeParts(parts.filter((p) => !p.lamp)), HousesAsset.propMat); propMesh.castShadow = true; propMesh.receiveShadow = true;
        driveMesh.add(propMesh);
        const lamps = parts.filter((p) => p.lamp);
        if (lamps.length) {
          if (!HousesAsset.lampMat) HousesAsset.lampMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, emissive: 0xffcf80, emissiveIntensity: 0 });
          if (this.windowMaterials && !this.windowMaterials.includes(HousesAsset.lampMat)) this.windowMaterials.push(HousesAsset.lampMat);
          driveMesh.add(new THREE.Mesh(mergeParts(lamps), HousesAsset.lampMat));
        }
      }

      // Procedural Modern Architectural Drop Point
      const houseGroup = new THREE.Group();
      let ring;

      if (isModernVilla) {
        // Style A: Modern Cantilevered Mountain Villa
        const concreteMat = new THREE.MeshStandardMaterial({ color: 0x484c54, roughness: 0.92, metalness: 0.08 });
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.9, 7.4), concreteMat);
        plinth.position.y = 0.45;
        plinth.receiveShadow = true;
        houseGroup.add(plinth);

        const darkPanelMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, roughness: 0.72, metalness: 0.28 });
        const mainVol = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.4, 6.2), darkPanelMat);
        mainVol.position.y = 2.6;
        mainVol.castShadow = true;
        houseGroup.add(mainVol);

        const cedarMat = new THREE.MeshStandardMaterial({
          color: 0x935c34,
          roughness: 0.78,
          metalness: 0.06,
          map: RealTextureFactory.woodColor()
        });
        const cedarAccent = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.42, 6.24), cedarMat);
        cedarAccent.position.set(-2.4, 2.6, 0);
        cedarAccent.castShadow = true;
        houseGroup.add(cedarAccent);

        const deck = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.28, 3.4), cedarMat);
        deck.position.set(0, 0.76, 4.3);
        deck.receiveShadow = true;
        houseGroup.add(deck);

        const balustradeMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.42,
          roughness: 0.12,
          metalness: 0.88
        });
        const balustrade = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.75, 0.06), balustradeMat);
        balustrade.position.set(0, 1.25, 5.95);
        houseGroup.add(balustrade);

        const glassMat = new THREE.MeshStandardMaterial({
          color: 0xfff3e0,
          emissive: 0xffa000,
          emissiveIntensity: 0.78,
          roughness: 0.14,
          metalness: 0.86
        });
        const glassWall = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 0.08), glassMat);
        glassWall.position.set(1.1, 2.4, 3.12);
        houseGroup.add(glassWall);

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.5, metalness: 0.8 });
        [-0.3, 1.1, 2.5].forEach(fx => {
          const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.62, 0.1), frameMat);
          mullion.position.set(fx, 2.4, 3.13);
          houseGroup.add(mullion);
        });

        const roofMat = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.62, metalness: 0.35 });
        const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.22, 8.6), roofMat);
        roofSlab.position.set(0, 4.4, 0.8);
        roofSlab.castShadow = true;
        houseGroup.add(roofSlab);
        if (isWinter) {
          const snowSlabMat = new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.88, metalness: 0 });
          const snowSlab = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.10, 8.8), snowSlabMat);
          snowSlab.position.set(0, 4.52, 0.8);
          houseGroup.add(snowSlab);
        }

        const soffit = new THREE.Mesh(
          new THREE.BoxGeometry(8.8, 0.04, 0.12),
          new THREE.MeshStandardMaterial({ color: 0xffedd5, emissive: 0xffa000, emissiveIntensity: 1.6, roughness: 0.2 })
        );
        soffit.position.set(0, 4.28, 4.9);
        houseGroup.add(soffit);

        const plinthStand = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.55), frameMat);
        plinthStand.position.set(2.4, 1.25, 4.5);
        houseGroup.add(plinthStand);

        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 8), frameMat);
        bollard.position.set(2.8, 1.65, 4.5);
        const lantern = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.25, 0.2),
          new THREE.MeshStandardMaterial({ color: 0xfff0db, emissive: 0xff9f1c, emissiveIntensity: 2.4, roughness: 0.2 })
        );
        lantern.position.set(2.8, 2.25, 4.5);
        houseGroup.add(bollard);
        houseGroup.add(lantern);

        const ringGeom = new THREE.RingGeometry(1.4, 1.9, 24);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
        ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.set(0, 0.92, 4.3);
        houseGroup.add(ring);
      } else {
        // Style B: Contemporary Ghats Estate Bungalow
        const stoneWallMat = new THREE.MeshStandardMaterial({ color: 0xe5e1d8, roughness: 0.94, metalness: 0.04 });
        const estateBase = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.6, 6.6), new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.9 }));
        estateBase.position.y = 0.3;
        houseGroup.add(estateBase);

        const estateBody = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.2, 5.8), stoneWallMat);
        estateBody.position.y = 2.2;
        estateBody.castShadow = true;
        houseGroup.add(estateBody);

        const slateRoofMat = new THREE.MeshStandardMaterial({ color: 0x272b33, roughness: 0.65, metalness: 0.35 });
        const roofGeom = new THREE.ConeGeometry(5.8, 2.2, 4);
        roofGeom.rotateY(Math.PI / 4);
        const roof = new THREE.Mesh(roofGeom, slateRoofMat);
        roof.position.y = 4.4;
        roof.scale.set(1.15, 0.95, 0.95);
        roof.castShadow = true;
        houseGroup.add(roof);
        if (isWinter) {
          const snowRoofMat = new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.88, metalness: 0 });
          const snowRoofGeom = new THREE.ConeGeometry(6.1, 2.4, 4);
          snowRoofGeom.rotateY(Math.PI / 4);
          const snowRoof = new THREE.Mesh(snowRoofGeom, snowRoofMat);
          snowRoof.position.y = 4.35;
          snowRoof.scale.set(1.15, 0.97, 0.97);
          houseGroup.add(snowRoof);
        }

        const timberFrameMat = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.6, metalness: 0.4 });
        const porchTerrace = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 2.6), timberFrameMat);
        porchTerrace.position.set(0, 0.55, 3.8);
        houseGroup.add(porchTerrace);

        [-2.2, 2.2].forEach(colX => {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), timberFrameMat);
          col.position.set(colX, 1.85, 4.8);
          houseGroup.add(col);
        });

        const pergolaBeam = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.16, 0.2), timberFrameMat);
        pergolaBeam.position.set(0, 3.15, 4.8);
        houseGroup.add(pergolaBeam);

        const warmGlassMat = new THREE.MeshStandardMaterial({
          color: 0xffedd5,
          emissive: 0xffa000,
          emissiveIntensity: 0.85,
          roughness: 0.15,
          metalness: 0.85
        });
        [-1.8, 1.8].forEach(wx => {
          const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.08), warmGlassMat);
          win.position.set(wx, 2.1, 2.92);
          houseGroup.add(win);
        });

        const teakDoor = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 2.2, 0.08),
          new THREE.MeshStandardMaterial({ color: 0x6e3d1f, roughness: 0.75, metalness: 0.05, map: RealTextureFactory.woodColor() })
        );
        teakDoor.position.set(0, 1.5, 2.92);
        houseGroup.add(teakDoor);

        const mailStand = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), timberFrameMat);
        mailStand.position.set(1.9, 1.05, 4.2);
        houseGroup.add(mailStand);

        const lantern = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.26, 0.2),
          new THREE.MeshStandardMaterial({ color: 0xfff0db, emissive: 0xffa000, emissiveIntensity: 2.2, roughness: 0.2 })
        );
        lantern.position.set(1.9, 2.2, 4.2);
        houseGroup.add(lantern);

        const ringGeom = new THREE.RingGeometry(1.4, 1.9, 24);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
        ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.set(0, 0.72, 3.8);
        houseGroup.add(ring);
      }

      // The drop ring stays where the house model puts it (at the porch, end of the entrance path). It used to be held at its
      // old world position, which left it 4.5 m out on the lawn away from the house.

      // Modeled house: replaces the built-in villa/bungalow above (kept as the
      // stand-in until houses.glb loads). Variant is derived from u rather than
      // this.prng so choosing it doesn't shift the rest of world generation.
      const houseVariant = HousesAsset.VARIANTS[Math.floor(Math.abs(u || 0) * 100003) % HousesAsset.VARIANTS.length];
      let targetEntry = null;
      const useHouseModel = () => {
        try {
          const model = HousesAsset.clone(houseVariant);
          if (!model) return;
          houseGroup.children.slice().forEach((ch) => { if (ch !== ring) houseGroup.remove(ch); });
          houseGroup.add(model);
          let spot = null;
          model.traverse((o) => { if (!spot && /^DropSpot/.test(o.name || '')) spot = o; });
          if (spot) ring.position.set(spot.position.x, spot.position.y + 0.02, spot.position.z);
          if (HousesAsset.windowMat && this.windowMaterials && !this.windowMaterials.includes(HousesAsset.windowMat)) {
            this.windowMaterials.push(HousesAsset.windowMat);
          }
          if (targetEntry) {
            houseGroup.updateMatrixWorld(true);
            ring.getWorldPosition(targetEntry.pos);
          }
        } catch (err) {
          console.error('Delivery house model swap failed:', err);
        }
      };
      if (HousesAsset.template) useHouseModel();
      else HousesAsset.pending.push(useHouseModel);

      this.obstacles.push({ pos: housePos.clone(), radius: 4.8, type: 'building' });
      houseGroup.position.copy(housePos);

      // Flatten look target to housePos's own Y so roofs and cantilevered decks stay level (Pattern 8)
      houseGroup.lookAt(pt.x, housePos.y, pt.z);
      houseGroup.updateMatrixWorld(true);

      const ringWorldPos = new THREE.Vector3();
      ring.getWorldPosition(ringWorldPos);

      const parent = targetParentGroup || this.foliageGroup;
      parent.add(driveMesh);
      parent.add(houseGroup);

      targetEntry = {
        order: order,
        pos: ringWorldPos,
        ring: ring,
        delivered: false,
        splineU: u,
        tossRadius: tossRadius,
        pathInfo: pathInfo
      };
      this.deliveryTargets.push(targetEntry);
      this.addFenceGap(pt, normal, houseSide, 4.5);
      this.addPedDestination('house', pt, targetEntry.pos, housePos.clone());
      this.tryPlaceCrossingNear(pt);

      return { houseGroup, driveMesh, housePos, targetEntry };
    },


    _furnitureLat(kind) {
      const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
      const onSidewalk = CONFIG.SIDEWALK && CONFIG.SIDEWALK.enabled;
      if (kind === 'pole') return this.getBarrierLateralDistance() + 1.1;
      if (!onSidewalk) return CONFIG.ROAD_WIDTH * 0.5 + 1.8;
      if (kind === 'lamp') return roadHalf + 0.45;
      if (kind === 'sign') return roadHalf + 0.6;
      return roadHalf + 0.9; // milestone
    },


    _addWithModel(group, asset, name, onModel) {
      const use = () => {
        const model = name ? asset.clone(name) : asset.clone();
        if (!model) return;
        group.clear();
        group.add(model);
        if (onModel) onModel(model);
      };
      if (asset.template) use(); else asset.pending.push(use);
    },


    spawnCurveSign(pt, normal, tangent, curvature) {
      if (Math.abs(curvature) <= 0.015) return;
      // curvature > 0 = the road turns toward +normal (the rider's right). The
      // sign stands on the OUTSIDE of the bend (B137), so opposite that side,
      // and its chevrons point the way the road turns.
      const turnDir = curvature > 0 ? 1 : -1;
      const lat = -turnDir * this._furnitureLat('sign');
      const pos = pt.clone().addScaledVector(normal, lat);
      pos.y = this.surfaceHeightNear(pos, pt, lat);
      const g = this.buildChevronSign(turnDir);
      g.position.copy(pos);
      const look = pt.clone().addScaledVector(tangent, -6.0); look.y = pos.y;
      g.lookAt(look);
      this.foliageGroup.add(g);
      this.obstacles.push({ pos: pos.clone(), radius: 0.9, type: 'sign' });
    },


    spawnUtilityPole(pt, normal) {
      const lat = this._furnitureLat('pole');
      const pos = pt.clone().addScaledVector(normal, lat);
      pos.y = this.groundHeightAt(pt, pos, lat);
      const g = new THREE.Group();
      g.position.copy(pos);
      this._addWithModel(g, StreetFurnitureAsset, 'UtilityPole');
      g.lookAt(pt.x, pos.y, pt.z); // flatten (Pattern 8): cross-arms parallel to the road
      this.foliageGroup.add(g);
      this.obstacles.push({ pos: pos.clone(), radius: 0.9, type: 'pole' });
    },


    spawnStreetLamp(pt, normal, side) {
      const lat = side * this._furnitureLat('lamp');
      const pos = pt.clone().addScaledVector(normal, lat);
      pos.y = this.surfaceHeightNear(pos, pt, lat);
      const g = new THREE.Group();
      g.position.copy(pos);
      this._addWithModel(g, StreetFurnitureAsset, 'StreetLamp', () => {
        if (StreetFurnitureAsset.lensMat && !this.windowMaterials.includes(StreetFurnitureAsset.lensMat)) {
          this.windowMaterials.push(StreetFurnitureAsset.lensMat);
        }
      });
      g.lookAt(pt.x, pos.y, pt.z); // arm reaches toward the road (+Z after lookAt)
      this.foliageGroup.add(g);
      this.obstacles.push({ pos: pos.clone(), radius: 0.8, type: 'pole' });
    },


    spawnMilestone(pt, normal, side) {
      if (!this._milestoneKit) {
        this._milestoneKit = {
          base: new THREE.CylinderGeometry(0.32, 0.35, 0.8, 12),
          dome: new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          band: new THREE.CylinderGeometry(0.325, 0.325, 0.12, 12),
          white: new THREE.MeshLambertMaterial({ color: 0xf8fafc }),
          yellow: new THREE.MeshLambertMaterial({ color: 0xfacc15 }),
          black: new THREE.MeshBasicMaterial({ color: 0x0f172a })
        };
      }
      const K = this._milestoneKit;
      const lat = side * this._furnitureLat('milestone');
      const pos = pt.clone().addScaledVector(normal, lat);
      pos.y = this.surfaceHeightNear(pos, pt, lat);
      const g = new THREE.Group();
      const base = new THREE.Mesh(K.base, K.white); base.position.y = 0.4; g.add(base);
      const dome = new THREE.Mesh(K.dome, K.yellow); dome.position.y = 0.8; g.add(dome);
      const band = new THREE.Mesh(K.band, K.black); band.position.y = 0.55; g.add(band);
      g.position.copy(pos);
      g.lookAt(pt.x, pos.y, pt.z);
      this.foliageGroup.add(g);
    },

    // Roadside repair stop: kind 'cycle' (cycle/puncture repair shop) or
    // 'motor' (motor garage). Registers the repair zone, a fence gap, and a
    // pedestrian destination. Returns false if the spot is taken.

    spawnRepairShop(pt, normal, side, kind = 'cycle', checkClearance = false) {
      const dist = CONFIG.ROAD_WIDTH * 0.5 + (kind === 'motor' ? 5.4 : 4.8);
      const pos = pt.clone().addScaledVector(normal, side * dist);
      if (checkClearance && this.obstacles.some((o) => o.type === 'building' && o.pos.distanceTo(pos) < o.radius + 6.0)) return false;
      pos.y = this.groundHeightAt(pt, pos, side * dist);
      const g = new THREE.Group();
      this._addWithModel(g, kind === 'motor' ? MotorGarageAsset : RepairShopAsset, null);
      g.position.copy(pos);
      g.lookAt(pt.x, pos.y, pt.z); // open front faces the road
      this.foliageGroup.add(g);
      const repairBay = { pos: pos.clone(), radius: 7.5, visitedRecently: false };
      this.repairBays.push(repairBay);
      this.obstacles.push({ pos: pos.clone(), radius: kind === 'motor' ? 4.6 : 4.0, type: 'building', mesh: g, repairBay });
      this.addFenceGap(pt, normal, side, kind === 'motor' ? 4.8 : 4.0);
      g.updateMatrixWorld(true);
      this.addPedDestination('shop', pt, g.localToWorld(new THREE.Vector3(0.6, 0, kind === 'motor' ? 3.0 : 2.6)), pos.clone());
      return true;
    },


    _clearOfRoad(pos, minClear) {
      return !this.roadSpatialGrid || !this.roadSpatialGrid.getNearestRoadPoint(pos.x, pos.z, minClear);
    },


    spawnGantry(pt, normal, tangent) {
      if (!this._gantryPoleMat) this._gantryPoleMat = new THREE.MeshStandardMaterial({ color: 0x4a4e52, flatShading: true, roughness: 0.7, metalness: 0.25 });
      const gantryGroup = new THREE.Group();
      const gantryHeight = 5.2;
      const gantrySpan = CONFIG.ROAD_WIDTH + 2.8;

      // Side pillars
      [-gantrySpan / 2, gantrySpan / 2].forEach(xOff => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, gantryHeight, 8), this._gantryPoleMat);
        pillar.position.set(xOff, gantryHeight / 2, 0);
        gantryGroup.add(pillar);
      });

      // Overhead Crossbeam
      const beam = new THREE.Mesh(new THREE.BoxGeometry(gantrySpan, 0.35, 0.35), this._gantryPoleMat);
      beam.position.set(0, gantryHeight - 0.2, 0);
      gantryGroup.add(beam);

      // Speed Limit 75 Sign Board
      const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      signBoard.position.set(0, gantryHeight + 0.5, 0);
      const innerRing = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      innerRing.rotateX(Math.PI / 2);
      innerRing.position.set(0, gantryHeight + 0.5, 0.02);
      gantryGroup.add(signBoard);
      gantryGroup.add(innerRing);

      // Camera Lens Units with Strobes
      [-1.4, 1.4].forEach(cx => {
        const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.5), new THREE.MeshLambertMaterial({ color: 0x111827 }));
        camBox.position.set(cx, gantryHeight - 0.45, 0.2);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8), new THREE.MeshBasicMaterial({ color: 0x00f5d4 }));
        lens.rotateX(Math.PI / 2);
        lens.position.set(cx, gantryHeight - 0.45, 0.48);
        gantryGroup.add(camBox);
        gantryGroup.add(lens);
      });

      gantryGroup.position.copy(pt);
      gantryGroup.lookAt(pt.clone().add(tangent));
      this.foliageGroup.add(gantryGroup);

      this.obstacles.push({ pos: pt.clone().addScaledVector(normal, -gantrySpan / 2), radius: 0.8, type: 'gantry' });
      this.obstacles.push({ pos: pt.clone().addScaledVector(normal, gantrySpan / 2), radius: 0.8, type: 'gantry' });
      return true;
    },


    spawnBusShelter(pt, normal, side, clearFn = this._clearOfRoad.bind(this)) {
      const shelterDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 4.2);
      const shelterPos = pt.clone().addScaledVector(normal, shelterDist);

      // Skip if overlapping another obstacle or if too close to any road section (hairpins)
      if (!clearFn(shelterPos, CONFIG.ROAD_WIDTH * 0.5 + 3.0)) return null;
      if (this.obstacles.some(o => o.pos.distanceTo(shelterPos) < (o.radius + 2.8))) return null;

      shelterPos.y = this.groundHeightAt(pt, shelterPos, shelterDist);

      const shelterGroup = new THREE.Group();
      // Charcoal steel cantilever canopy
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });
      const sRoof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 2.6), steelMat);
      sRoof.position.set(0, 2.6, 0);
      shelterGroup.add(sRoof);

      // Architectural steel uprights
      [-2.1, 2.1].forEach(px => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), steelMat);
        col.position.set(px, 1.3, -1.1);
        shelterGroup.add(col);
      });

      // Frosted architectural glass panel
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0xa5b4fc,
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: 0.52
      });
      const sScreen = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.3, 0.06), screenMat);
      sScreen.position.set(0, 1.25, -1.1);
      shelterGroup.add(sScreen);

      // Slatted teak wood bench
      const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.45), benchMat);
      bench.position.set(0, 0.5, -0.6);
      shelterGroup.add(bench);
      [-1.5, 1.5].forEach(bx => {
        const bLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), steelMat);
        bLeg.position.set(bx, 0.25, -0.6);
        shelterGroup.add(bLeg);
      });

      // Waiting Passenger Figure (Low-Poly Human)
      const humanGroup = new THREE.Group();
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
      const clothMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
      const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.65, 0.28), clothMat);
      torso.position.set(0, 0.95, 0);
      humanGroup.add(torso);
      // Head
      const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), skinMat);
      head.position.set(0, 1.45, 0);
      humanGroup.add(head);
      // Legs
      [-0.12, 0.12].forEach(lx => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), pantsMat);
        leg.position.set(lx, 0.35, 0.15);
        humanGroup.add(leg);
      });
      humanGroup.position.set(0.6, 0, -0.6);
      shelterGroup.add(humanGroup);

      shelterGroup.position.copy(shelterPos);
      shelterGroup.lookAt(pt.x, shelterPos.y, pt.z); // flatten: see BUGFIX_LOG.md lookAt-tilt pattern
      this.foliageGroup.add(shelterGroup);
      this.obstacles.push({ pos: shelterPos.clone(), radius: 2.8, type: 'building', mesh: shelterGroup });
      this.tryPlaceCrossingNear(pt);
      return true;
    },


    spawnCityBuilding(pt, normal, side, clearFn = this._clearOfRoad.bind(this)) {
      const kit = this._skylineKit;
      if (!kit) return null;
      const bldgDist = side * this.prng.range(34.0, 78.0);
      const bldgPos = pt.clone().addScaledVector(normal, bldgDist);

      const width = this.prng.range(7.0, 13.0);
      const depth = this.prng.range(7.0, 13.0);

      // Skip this spawn if the curve loops back near this world-space
      // spot elsewhere (see clearsRoad above) — better to drop an
      // occasional skyscraper than plant one in the roadway.
      const footprintRadius = Math.max(width, depth) * 0.5;
      if (!clearFn(bldgPos, CONFIG.ROAD_WIDTH * 0.6 + footprintRadius + 4.0)) return null;

      bldgPos.y = this.groundHeightAt(pt, bldgPos, bldgDist);

      // Real Indian streetscapes are mostly low/mid-rise shophouses
      // and apartment blocks with the occasional tower punching up —
      // not a uniform wall of skyscrapers. Weight the roll heavily
      // toward short buildings so towers read as landmarks.
      const heightRoll = this.prng.next();
      let height, isGlass;
      if (heightRoll < 0.55) {
        height = this.prng.range(8.0, 20.0);
        isGlass = false;
      } else if (heightRoll < 0.85) {
        height = this.prng.range(20.0, 40.0);
        isGlass = this.prng.next() > 0.5;
      } else {
        height = this.prng.range(40.0, 90.0);
        isGlass = true;
      }
      const isLowRise = height < 20.0;

      // Skyscrapers all share one fixed glass tint (shiny/reflective
      // via the material below); low-rise buildings still draw from
      // a small cohesive palette for street-level variety.
      const bodyColor = isGlass ? kit.glass : kit.lowrise[Math.floor(this.prng.range(0, kit.lowrise.length))];
      const accentColor = isGlass ? kit.glass : kit.lowrise[Math.floor(this.prng.range(0, kit.lowrise.length))];

      const bldgGroup = new THREE.Group();

      const makeFacadeMat = (w, h, color) => {
        // Windows use an emissiveMap rather than a color map so they
        // glow at a constant brightness independent of scene lighting —
        // otherwise the tower reads as a flat dark silhouette at night
        // since ambient/directional light is too dim to reveal a map.
        const tex = kit.tex.clone();
        tex.repeat.set(Math.max(1, Math.round(w / 3.2)), Math.max(1, Math.round(h / 4.0)));
        tex.needsUpdate = true;
        const dayTex = kit.dayTex.clone(); dayTex.repeat.copy(tex.repeat); dayTex.needsUpdate = true;
        // Window glow only reads as lit windows once ambient light is
        // low enough to need it (dusk/night) — left on at a fixed
        // 0.85 intensity through daylight hours, every building in
        // the skyline blows out under bloom since a near-white
        // emissive surface always exceeds the bloom luminance
        // threshold regardless of how bright the sun already is.
        // Start dark; Game.applyWindowGlow (tied to time-of-day,
        // same as vehicle headlights) sets the real intensity.
        let mat;
        if (isGlass) {
          // Shiny reflective glass curtain-wall look: high shininess/
          // specular highlight, slight transparency, cool blue tint.
          mat = new THREE.MeshStandardMaterial({
            color,
            map: dayTex,
            flatShading: true,
            emissiveMap: tex,
            emissive: 0xffffff,
            emissiveIntensity: 0.0,
            roughness: 0.15,
            metalness: 0.6,
            transparent: true,
            opacity: 0.92
          });
        } else {
          mat = new THREE.MeshStandardMaterial({
            color,
            map: dayTex,
            flatShading: true,
            emissiveMap: tex,
            emissive: 0xffffff,
            emissiveIntensity: 0.0
          });
        }
        this.windowMaterials.push(mat);
        return mat;
      };

      // Four massing archetypes so the skyline doesn't read as one
      // repeated box at different sizes — stepped-tier and podium
      // towers are common in dense Indian commercial districts.
      const archetype = isLowRise ? 0 : Math.floor(this.prng.range(0, 4));
      const parts = [];   // {w,h,d,x,y,z,accent} of each massing block, for the architectural detail pass below (B174)

      if (archetype === 0) {
        // Plain slab tower
        const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), makeFacadeMat(width, height, bodyColor));
        body.position.y = height / 2;
        bldgGroup.add(body);
        parts.push({ w: width, h: height, d: depth, x: 0, y: height / 2, z: 0 });
      } else if (archetype === 1) {
        // Stepped-tier tower: wide base, narrower upper block set back
        const baseH = height * 0.55;
        const topH = height - baseH;
        const base = new THREE.Mesh(new THREE.BoxGeometry(width, baseH, depth), makeFacadeMat(width, baseH, bodyColor));
        base.position.y = baseH / 2;
        bldgGroup.add(base);
        const top = new THREE.Mesh(new THREE.BoxGeometry(width * 0.62, topH, depth * 0.62), makeFacadeMat(width * 0.62, topH, accentColor));
        top.position.y = baseH + topH / 2;
        bldgGroup.add(top);
        parts.push({ w: width, h: baseH, d: depth, x: 0, y: baseH / 2, z: 0 }, { w: width * 0.62, h: topH, d: depth * 0.62, x: 0, y: baseH + topH / 2, z: 0 });
      } else if (archetype === 2) {
        // Podium + tower: squat wide podium floors, slender tower rising off it
        const podiumH = Math.min(10.0, height * 0.18);
        const towerH = height - podiumH;
        const podium = new THREE.Mesh(new THREE.BoxGeometry(width * 1.35, podiumH, depth * 1.35), makeFacadeMat(width * 1.35, podiumH, accentColor));
        podium.position.y = podiumH / 2;
        bldgGroup.add(podium);
        const tower = new THREE.Mesh(new THREE.BoxGeometry(width * 0.68, towerH, depth * 0.68), makeFacadeMat(width * 0.68, towerH, bodyColor));
        tower.position.y = podiumH + towerH / 2;
        bldgGroup.add(tower);
        parts.push({ w: width * 1.35, h: podiumH, d: depth * 1.35, x: 0, y: podiumH / 2, z: 0 }, { w: width * 0.68, h: towerH, d: depth * 0.68, x: 0, y: podiumH + towerH / 2, z: 0 });
      } else {
        // Twin-block tower: two slim offset blocks of differing height
        const hA = height;
        const hB = height * this.prng.range(0.55, 0.8);
        const blockA = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, hA, depth), makeFacadeMat(width * 0.55, hA, bodyColor));
        blockA.position.set(-width * 0.24, hA / 2, 0);
        bldgGroup.add(blockA);
        const blockB = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, hB, depth * 0.9), makeFacadeMat(width * 0.55, hB, accentColor));
        blockB.position.set(width * 0.28, hB / 2, -depth * 0.05);
        bldgGroup.add(blockB);
        parts.push({ w: width * 0.55, h: hA, d: depth, x: -width * 0.24, y: hA / 2, z: 0 }, { w: width * 0.55, h: hB, d: depth * 0.9, x: width * 0.28, y: hB / 2, z: -depth * 0.05 });
      }

      // Architectural detail pass (B174): corner pilasters, floor bands, parapet rims, shopfront + awning, crown and spire,
      // merged into ONE vertex-coloured mesh per building so the skyline costs a single extra draw call each. Uses a
      // position-hashed rng, never this.prng, so world generation stays byte-identical.
      {
        const hs = (k) => { let h = (Math.imul(Math.round(bldgPos.x * 7) | 0, 374761393) + Math.imul(Math.round(bldgPos.z * 7) | 0, 668265263) + Math.imul(k, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
        const boxes = [];
        const add = (w, h, d, x, y, z, hex) => boxes.push({ w, h, d, x, y, z, c: new THREE.Color(hex) });
        const roadDir = new THREE.Vector3(-normal.x * side, 0, -normal.z * side);
        const faceX = Math.abs(roadDir.x) > Math.abs(roadDir.z);
        const awningHex = [0xc2442e, 0x2f7d6d, 0xd9a21b, 0x3d5a98][Math.floor(hs(1) * 4)];
        const stone = isGlass ? 0x56626e : 0xcfc6b6, dark = 0x3b4148;
        parts.forEach((pt2, pi) => {
          const top = pt2.y + pt2.h / 2, bot = pt2.y - pt2.h / 2, hw = pt2.w / 2, hd = pt2.d / 2;
          // parapet rim around the roof edge
          add(pt2.w + 0.3, 0.7, 0.35, pt2.x, top + 0.35, pt2.z + hd, stone); add(pt2.w + 0.3, 0.7, 0.35, pt2.x, top + 0.35, pt2.z - hd, stone);
          add(0.35, 0.7, pt2.d, pt2.x + hw, top + 0.35, pt2.z, stone); add(0.35, 0.7, pt2.d, pt2.x - hw, top + 0.35, pt2.z, stone);
          // corner pilasters
          const pil = isGlass ? 0.45 : 0.7;
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(pil, pt2.h, pil, pt2.x + sx * hw, pt2.y, pt2.z + sz * hd, isGlass ? dark : stone);
          // floor bands every ~3 storeys (concrete buildings only)
          if (!isGlass) for (let y = bot + 9.6; y < top - 2; y += 9.6) add(pt2.w + 0.35, 0.4, pt2.d + 0.35, pt2.x, y, pt2.z, stone);
          else for (let y = bot + 16; y < top - 4; y += 16) add(pt2.w + 0.2, 0.5, pt2.d + 0.2, pt2.x, y, pt2.z, dark);
        });
        const base = parts[0];
        if (isLowRise && base) {
          // shopfront band and awning on the street side
          const sw = faceX ? 0.5 : base.w * 0.96, sd = faceX ? base.d * 0.96 : 0.5;
          const sgn = faceX ? Math.sign(roadDir.x) || 1 : Math.sign(roadDir.z) || 1;
          const sx = faceX ? base.x + sgn * (base.w / 2 + 0.05) : base.x, sz = faceX ? base.z : base.z + sgn * (base.d / 2 + 0.05);
          add(sw, 3.0, sd, sx, 1.5, sz, dark);
          const aw = faceX ? 1.3 : base.w * 0.9, ad = faceX ? base.d * 0.9 : 1.3;
          add(aw, 0.18, ad, faceX ? sx + sgn * 0.65 : sx, 3.2, faceX ? sz : sz + sgn * 0.65, awningHex);
          // first-floor balcony strip
          if (hs(2) > 0.4 && base.h > 9) add(faceX ? 1.1 : base.w * 0.8, 0.22, faceX ? base.d * 0.8 : 1.1, faceX ? sx + sgn * 0.55 : sx, 6.4, faceX ? sz : sz + sgn * 0.55, stone);
          // stair-head box on the roof
          add(2.6, 2.4, 2.6, base.x - base.w * 0.25, base.h + 1.2 + 0.7, base.z - base.d * 0.2, stone);
        } else if (parts.length) {
          const tp = parts.reduce((a, b) => (b.y + b.h / 2 > a.y + a.h / 2 ? b : a));
          const topY = tp.y + tp.h / 2;
          // crown: a setback plant room, then a slender spire on the tallest towers
          add(tp.w * 0.45, 3.2, tp.d * 0.45, tp.x, topY + 0.7 + 1.6, tp.z, dark);
          if (height > 55 || hs(3) > 0.6) add(0.35, 11, 0.35, tp.x, topY + 0.7 + 3.2 + 5.5, tp.z, 0x8a939c);
        }
        // merge every box into one vertex-coloured BufferGeometry
        const pos = [], nor = [], col = [], idx = [];
        const tmp = new THREE.BoxGeometry(1, 1, 1);
        const tp0 = tmp.attributes.position, tn0 = tmp.attributes.normal, ti0 = tmp.index.array;
        boxes.forEach((b) => {
          const o = pos.length / 3;
          for (let i = 0; i < tp0.count; i++) {
            pos.push(tp0.getX(i) * b.w + b.x, tp0.getY(i) * b.h + b.y, tp0.getZ(i) * b.d + b.z);
            nor.push(tn0.getX(i), tn0.getY(i), tn0.getZ(i)); col.push(b.c.r, b.c.g, b.c.b);
          }
          for (let i = 0; i < ti0.length; i++) idx.push(ti0[i] + o);
        });
        tmp.dispose();
        const dg = new THREE.BufferGeometry();
        dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        dg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        dg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        dg.setIndex(idx);
        if (!kit.detailMat) kit.detailMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
        bldgGroup.add(new THREE.Mesh(dg, kit.detailMat));
      }

      // Parapet / rooftop cap
      const capMat = new THREE.MeshStandardMaterial({ color: 0x6b7480, flatShading: true });
      const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 0.9, depth * 0.7), capMat);
      cap.position.y = height + 0.45;
      bldgGroup.add(cap);

      // Rooftop water tank (common Indian skyline silhouette), antenna, or bare.
      // Low-rise buildings get a water tank far more often — it's the
      // defining rooftop silhouette of Indian residential/shop blocks.
      const roofProp = this.prng.next();
      const tankThreshold = isLowRise ? 0.3 : 0.66;
      if (roofProp > tankThreshold) {
        const tankMat = new THREE.MeshStandardMaterial({ color: 0x3f6b8a, flatShading: true });
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 8), tankMat);
        tank.position.set(width * 0.25, height + 1.7, depth * 0.2);
        bldgGroup.add(tank);
      } else if (roofProp > 0.33) {
        const antennaMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, flatShading: true });
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6.0, 6), antennaMat);
        antenna.position.set(0, height + 3.4, 0);
        bldgGroup.add(antenna);
      }

      // Foundation slab: buildings sit at a single anchor point on
      // sloped hillside terrain, but the box geometry has a flat
      // bottom — on a slope that either buries the downhill corner
      // or leaves a visible gap under the uphill corner. A tall
      // foundation extending well underground fills that gap from
      // any slope angle without needing to sample the terrain footprint.
      const foundationMat = new THREE.MeshStandardMaterial({ color: 0x5f5348, flatShading: true });
      const foundation = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 60.0, depth * 0.96), foundationMat);
      foundation.position.y = -30.0;
      bldgGroup.add(foundation);

      bldgGroup.position.copy(bldgPos);
      bldgGroup.rotation.y = this.prng.range(-0.06, 0.06);
      this.foliageGroup.add(bldgGroup);

      // Register so later shops/trees (which do check this.obstacles)
      // don't get placed clipping into the skyscraper's footprint —
      // skyscrapers previously weren't registered at all.
      this.obstacles.push({ pos: bldgPos.clone(), radius: footprintRadius + 1.5, type: 'building', mesh: bldgGroup });

      // Registering only protects obstacles placed AFTER this point —
      // it does nothing for rocks/trees already placed at an EARLIER
      // sampled point that this skyscraper's own footprint (up to
      // ~10+ units) can still reach backward into, since bldgDist
      // ranges widely (34-78) and isn't tied to the same index a
      // nearby rock used. This is the delivery-house prune pattern
      // (see the `if (i % 24 === 0)` house block) applied to
      // skyscrapers too — measured via dev-checks.js
      // `rocks-clear-of-houses`: every city with a skyscraper
      // (`type==='building'`) failed this the same way, since only
      // delivery houses (also `type==='building'`, radius 3.5) were
      // ever pruned against, never the larger skyscraper footprints.
      const SKYSCRAPER_CLEARANCE = 2.0;
      const overlappingNearSkyscraper = this.obstacles.filter(o =>
        o !== this.obstacles[this.obstacles.length - 1] &&
        (o.type === 'rock' || o.type === 'tree') &&
        o.pos.distanceTo(bldgPos) < (o.radius + footprintRadius + 1.5 + SKYSCRAPER_CLEARANCE)
      );
      overlappingNearSkyscraper.forEach(o => { if (o.mesh) this.foliageGroup.remove(o.mesh); });
      if (overlappingNearSkyscraper.length) {
        this.obstacles = this.obstacles.filter(o => !overlappingNearSkyscraper.includes(o));
      }
      return { pos: bldgPos, footprintRadius };
    },


    spawnMonument(pt, normal, side, clearFn = this._clearOfRoad.bind(this)) {
      const monDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 9.0);
      const monPos = pt.clone().addScaledVector(normal, monDist);

      if (!clearFn(monPos, CONFIG.ROAD_WIDTH * 0.5 + 4.5)) return null;
      if (this.obstacles.some(o => o.pos.distanceTo(monPos) < (o.radius + 4.0))) return null;

      monPos.y = this.groundHeightAt(pt, monPos, monDist);

      const monGroup = new THREE.Group();

      if (this.cityKey === 'mumbai') {
        // Gateway of India — basalt-yellow triumphal archway with
        // domed corner turrets, built as a gate frame (pillars +
        // lintel) so the arch opening reads without needing CSG.
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0xd4b483 });
        [-2.6, 2.6].forEach(px => {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.5, 1.4), stoneMat);
          pillar.position.set(px, 3.75, 0);
          monGroup.add(pillar);
          const turretDome = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 8), stoneMat);
          turretDome.position.set(px, 8.3, 0);
          monGroup.add(turretDome);
        });
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.6, 1.4), stoneMat);
        lintel.position.set(0, 7.3, 0);
        monGroup.add(lintel);
        const centerDome = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 10), stoneMat);
        centerDome.position.set(0, 9.2, 0);
        monGroup.add(centerDome);
      } else if (this.cityKey === 'delhi') {
        // India Gate — sandstone triumphal arch with an eternal-flame
        // accent at the base.
        const sandMat = new THREE.MeshLambertMaterial({ color: 0xc2703d });
        [-2.4, 2.4].forEach(px => {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8.0, 1.6), sandMat);
          pillar.position.set(px, 4.0, 0);
          monGroup.add(pillar);
        });
        const arch = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.8, 1.6), sandMat);
        arch.position.set(0, 7.9, 0);
        monGroup.add(arch);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
        flame.position.set(0, 0.6, 1.2);
        monGroup.add(flame);
      } else if (this.cityKey === 'kolkata') {
        // Victoria Memorial — white marble dome on a colonnaded base.
        const marbleMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
        const base = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.2, 5.5), marbleMat);
        base.position.set(0, 1.6, 0);
        monGroup.add(base);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), marbleMat);
        dome.position.set(0, 3.2, 0);
        monGroup.add(dome);
        const finial = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.0, 6), marbleMat);
        finial.position.set(0, 5.9, 0);
        monGroup.add(finial);
      } else if (this.cityKey === 'pune') {
        // Mangalpura Fortress — fortress gate: dark teak door studded with
        // brass bosses, set in a stone wall.
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x57534e });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(7.5, 6.0, 1.6), wallMat);
        wall.position.set(0, 3.0, 0);
        monGroup.add(wall);
        const doorMat = new THREE.MeshLambertMaterial({ color: 0x422006 });
        const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.6, 0.3), doorMat);
        door.position.set(0, 2.3, 0.95);
        monGroup.add(door);
        const bossMat = new THREE.MeshLambertMaterial({ color: 0xca8a04 });
        for (let bx = -1; bx <= 1; bx++) {
          for (let by = 0; by < 4; by++) {
            const boss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), bossMat);
            boss.position.set(bx * 1.1, 0.8 + by * 1.1, 1.12);
            monGroup.add(boss);
          }
        }
      } else {
        // Vrushabhpur (and default) — Pillared Hall: granite-pink
        // pillared facade under a white central dome.
        const graniteMat = new THREE.MeshLambertMaterial({ color: 0xd6a8a8 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.0, 4.5), graniteMat);
        base.position.set(0, 1.5, 0);
        monGroup.add(base);
        for (let cx = -2.8; cx <= 2.8; cx += 1.4) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.0, 8), new THREE.MeshLambertMaterial({ color: 0xf1e4e4 }));
          col.position.set(cx, 1.5, 2.35);
          monGroup.add(col);
        }
        const domeMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
        dome.position.set(0, 3.0, 0);
        monGroup.add(dome);
      }

      monGroup.position.copy(monPos);
      monGroup.lookAt(pt.x, monPos.y, pt.z); // flatten: see BUGFIX_LOG.md lookAt-tilt pattern
      this.foliageGroup.add(monGroup);
      this.obstacles.push({ pos: monPos.clone(), radius: 4.0, type: 'building', mesh: monGroup });
      return true;
    },
    // Curve warning sign: yellow board, black border, three black chevrons
    // pointing `dir` (+1 = board's +X), on a pole with black/white base bands.
    // Geometry + materials are shared across every sign.

    buildChevronSign(dir) {
      if (!this._chevronKit) {
        const chev = new THREE.Shape([[-0.09, -0.24], [0.02, -0.24], [0.16, 0.0], [0.02, 0.24], [-0.09, 0.24], [0.05, 0.0]]
          .map(([x, y]) => new THREE.Vector2(x, y)));
        const chevGeom = new THREE.ExtrudeGeometry(chev, { depth: 0.015, bevelEnabled: false });
        this._chevronKit = {
          post: new THREE.CylinderGeometry(0.045, 0.05, 2.2, 10),
          band: new THREE.CylinderGeometry(0.052, 0.052, 0.2, 10),
          board: new THREE.BoxGeometry(1.2, 0.72, 0.04),
          border: new THREE.BoxGeometry(1.26, 0.78, 0.03),
          chev: chevGeom,
          steel: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.7, roughness: 0.35 }),
          yellow: new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.5 }),
          black: new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.6 }),
          white: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 })
        };
      }
      const K = this._chevronKit;
      const g = new THREE.Group();
      const post = new THREE.Mesh(K.post, K.steel); post.position.y = 1.1; g.add(post);
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(K.band, k % 2 ? K.white : K.black); b.position.y = 0.1 + k * 0.2; g.add(b);
      }
      const border = new THREE.Mesh(K.border, K.black); border.position.set(0, 1.85, 0.03); g.add(border);
      const board = new THREE.Mesh(K.board, K.yellow); board.position.set(0, 1.85, 0.045); g.add(board);
      [-0.3, 0.0, 0.3].forEach((x) => {
        const c = new THREE.Mesh(K.chev, K.black);
        c.position.set(x, 1.85, 0.066);
        if (dir < 0) c.rotation.y = Math.PI;
        if (dir < 0) c.position.z = 0.081;
        g.add(c);
      });
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    },

    // A crossing only where people have a reason to cross (next to a tea stall,
    // bus shelter or delivery house), on a straight, unbanked stretch, clear of
    // tunnels and at least MIN_SPACING from the previous one.
  });
})();
