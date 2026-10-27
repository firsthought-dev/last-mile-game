(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    CONFIG, PRNG, addChunkedInstances, barrierPostStations, buildBarrierGeometries,
    RockGeometryFactory, TreeBillboardFactory, ClumpTreeFactory, RoadGrassFactory,
    StreetFurnitureAsset, RealTextureFactory
  } = S;

  Object.assign(S.ProceduralWorld.prototype, {
    updateFoliageVisibility(vehiclePos) {
      if (!this.foliageGroup) return;
      this._foliageVisFrame = (this._foliageVisFrame || 0) + 1;
      if (this._foliageVisFrame % 10 !== 0) return;

      const MINOR_DIST_SQ = 350 * 350;  // minor props (poles, shelters, signs)
      const MAJOR_DIST_SQ = 750 * 750;  // skyscrapers
      const SKYSCRAPER_HEIGHT_THRESHOLD = 18; // bounding box height >= 18m → skyscraper

      const children = this.foliageGroup.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        // Crossers own their own visibility (updateCrossers culls them at
        // 130m). This pass runs AFTER it and forces visible=true on anything
        // inside 350m, so without this skip it resurrects every crosser in the
        // 130-350m band each 10th frame — drawn with a frozen pose, because
        // the cull path in updateCrossers skips their mixer update.
        if (child.userData && child.userData.isCrosser) continue;

        // Never cull instanced meshes, multi-instance billboard tree groups,
        // driveways, or delivery checkpoints — their vertices/instances span
        // the entire highway route or need to remain visible for navigation.
        if (child.isInstancedMesh ||
            child.userData?.isDriveway ||
            child.userData?.isTreeBatch ||
            child.userData?.isRock ||
            (child.userData && child.userData._isGlobalBatch)) {
          child.visible = true;
          continue;
        }

        const pos = child.position;
        // If an object's position is sitting at (0, 0, 0) while having complex children,
        // it is a root batch/group rather than an individual roadside prop.
        if (pos.x === 0 && pos.y === 0 && pos.z === 0 && child.children && child.children.length > 0) {
          // Check if any child has non-zero position or if it's a composite world mesh
          child.visible = true;
          continue;
        }

        const dx = pos.x - vehiclePos.x;
        const dz = pos.z - vehiclePos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq > MAJOR_DIST_SQ) {
          // Beyond 750m — hide individual props regardless of type.
          child.visible = false;
        } else if (distSq > MINOR_DIST_SQ) {
          // 350–750m — hide minor props but keep large landmark skyscrapers.
          const box = child.userData._foliageBox;
          if (box === undefined) {
            // Cache the height tag on first evaluation.
            let h = 0;
            if (child.geometry && child.geometry.boundingBox) {
              h = child.geometry.boundingBox.max.y - child.geometry.boundingBox.min.y;
            } else {
              // For groups use the child count as a cheap heuristic.
              h = child.children && child.children.length > 4 ? 20 : 0;
            }
            child.userData._foliageBox = h;
          }
          child.visible = (child.userData._foliageBox >= SKYSCRAPER_HEIGHT_THRESHOLD);
        } else {
          // Within 350m — always visible.
          child.visible = true;
        }
      }
    },


    updateStreaming(carPos, scene, season, difficulty = 'medium', vehicle = null) {
      if (!this.curve || !this.splineNodes || this.splineNodes.length < 10) return;

      // A previous stream's build is still running incrementally across
      // frames (see advanceStreamBuild) — keep feeding it instead of
      // re-checking distance/starting a second one on top of it.
      if (this._streamBuildGen) {
        this.advanceStreamBuild();
        return;
      }

      const lastNode = this.splineNodes[this.splineNodes.length - 1];
      const distToEnd = carPos.distanceTo(lastNode);

      // Throttle: one chunk build per 3 s maximum, on top of the in-flight
      // guard above. Kept as a safety margin so a build that finishes very
      // quickly (or a distance re-check right at the boundary) can't
      // immediately kick off another one back-to-back.
      const now = Date.now();
      if (this._lastStreamBuild && now - this._lastStreamBuild < 3000) return;

      // When the car gets within 1600m of the forward scout horizon, scout another 1000m ahead
      if (distToEnd < 1600) {
        this._lastStreamBuild = now;
        const oldLength = this.splineNodes.length;
        // World-space end of the geometry that already exists. Captured
        // BEFORE extendSpline/resample, because both destroy the old
        // indexing. buildExtensionMeshes matches against this point
        // geometrically instead of guessing the join from node counts.
        const prevEndPos = (this.roadSpacedPoints && this.roadSpacedPoints.length)
          ? this.roadSpacedPoints[this.roadSpacedPoints.length - 1].clone()
          : lastNode.clone();
        this.extendSpline(100); // add 1000m of new highway nodes
        const newLength = this.splineNodes.length;

        // Rescale vehicle splineProgress so it stays at the exact same physical road position
        // Prevents the car from jumping ~800m ahead in spline parameter space, which triggered
        // false "Return to Road" banner flashes and violent lateral barrier clamping/drifting.
        const veh = vehicle || (typeof window !== 'undefined' && window.game && window.game.vehicle);
        if (veh) {
          veh.splineProgress = veh.splineProgress * (oldLength / newLength);
          const newProj = veh.projectToRoad(veh.mesh.position, this.curve, veh.splineProgress);
          veh.splineProgress = newProj.u;
          veh.lateralOffset = newProj.latDist;
        }

        // Rescale delivery target splineU positions so they remain anchored to their physical houses
        if (this.deliveryTargets) {
          const scaleRatio = oldLength / newLength;
          for (const t of this.deliveryTargets) {
            if (t.splineU !== undefined) {
              t.splineU = t.splineU * scaleRatio;
            }
          }
        }

        // Recompute spaced points for the extended highway. Banking angles,
        // mesh building, and the terrain sweep are all spread across
        // frames by the generator below — only this resample stays
        // synchronous (measured ~3ms, negligible).
        const totalSegments = newLength * 3;
        this.roadSpacedPoints = this.curve.getSpacedPoints(totalSegments);
        this.roadBankingAngles = new Float32Array(totalSegments + 1);
        this.roadNormals = new Array(totalSegments + 1);
        this.roadBinormals = new Array(totalSegments + 1);
        this.roadBankedUp = new Array(totalSegments + 1);

        this._streamBuildGen = this._streamBuildSequence(scene, oldLength, newLength, totalSegments, season, difficulty, prevEndPos);
        this.advanceStreamBuild(); // start chewing through it this very frame
      }
    },

    // Runs everything that used to happen synchronously after extendSpline
    // (banking recompute, spatial grid rebuild, extension mesh geometry,
    // terrain sweep) as one generator, so advanceStreamBuild can spread it
    // across many frames instead of freezing the main thread for ~600ms+
    // in a single call. Nothing here changes the actual math — the
    // sub-generators (buildExtensionMeshes, sweepTerrainBelowRoad) already
    // yield internally at their own natural loop boundaries.

    *_streamBuildSequence(scene, oldLength, newLength, totalSegments, season, difficulty, prevEndPos) {
      for (let i = 0; i <= totalSegments; i++) {
        const pt = this.roadSpacedPoints[i];
        let tangent;
        if (i === 0) tangent = new THREE.Vector3().subVectors(this.roadSpacedPoints[1], this.roadSpacedPoints[0]).normalize();
        else if (i === totalSegments) tangent = new THREE.Vector3().subVectors(this.roadSpacedPoints[totalSegments], this.roadSpacedPoints[totalSegments - 1]).normalize();
        else tangent = new THREE.Vector3().subVectors(this.roadSpacedPoints[i + 1], this.roadSpacedPoints[i - 1]).normalize();

        const worldUp = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
        const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

        let curvature = 0;
        if (i < totalSegments) {
          const nextTang = (i < totalSegments - 1)
            ? new THREE.Vector3().subVectors(this.roadSpacedPoints[i + 2], this.roadSpacedPoints[i]).normalize()
            : new THREE.Vector3().subVectors(this.roadSpacedPoints[totalSegments], this.roadSpacedPoints[totalSegments - 1]).normalize();
          curvature = tangent.x * nextTang.z - tangent.z * nextTang.x;
        }

        const bankingAngle = THREE.MathUtils.clamp(curvature * 2.2, -0.10, 0.10);
        const bankedUp = binormal.clone().multiplyScalar(Math.cos(bankingAngle)).addScaledVector(normal, -Math.sin(bankingAngle)).normalize();
        this.roadBankingAngles[i] = bankingAngle;
        this.roadNormals[i] = normal.clone();
        this.roadBinormals[i] = binormal.clone();
        this.roadBankedUp[i] = bankedUp.clone();
        if (i % 100 === 0) yield;
      }

      // Rebuild road spatial grid for fast road corridor clearance lookups
      if (this.roadSpatialGrid) {
        this.roadSpatialGrid.build(this.roadSpacedPoints);
      }
      yield;

      // Generate forward extension meshes for road, lane markings, terrain, and roadside props
      yield* this.buildExtensionMeshes(scene, oldLength, newLength, season, difficulty, prevEndPos);
      scene.add(this.buildSidewalkRange(Math.max(0, oldLength / newLength), 1));
      scene.add(this.buildRoadsideGrass(Math.max(0, oldLength / newLength), 1));
      scene.add(this.buildGroundCover(Math.max(0, oldLength / newLength), 1, season));
      scene.add(this.buildHouseFlowers(Math.max(0, oldLength / newLength), 1));
      yield* this.sweepTerrainBelowRoad();
      yield* this.sweepFloorBelowRoad();
    },

    // Resumes the in-flight streaming build (if any) for up to budgetMs of
    // wall-clock time, then yields control back to the render loop. Called
    // every frame from Game._animateFrame regardless of distance-to-horizon,
    // so a build that spans many frames keeps making steady progress.

    *chunkedComputeVertexNormals(geometry, chunkSize = 800) {
      const index = geometry.index;
      const posAttr = geometry.attributes.position;
      if (!index || !posAttr) { geometry.computeVertexNormals(); return; }

      let normalAttr = geometry.attributes.normal;
      if (!normalAttr || normalAttr.count !== posAttr.count) {
        normalAttr = new THREE.BufferAttribute(new Float32Array(posAttr.count * 3), 3);
        geometry.setAttribute('normal', normalAttr);
      } else {
        for (let i = 0; i < normalAttr.count; i++) {
          normalAttr.setXYZ(i, 0, 0, 0);
          if ((i % chunkSize) === chunkSize - 1) yield;
        }
      }

      const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
      const nA = new THREE.Vector3(), nB = new THREE.Vector3(), nC = new THREE.Vector3();
      const cb = new THREE.Vector3(), ab = new THREE.Vector3();
      const triCount = index.count;
      for (let i = 0; i < triCount; i += 3) {
        const vA = index.getX(i), vB = index.getX(i + 1), vC = index.getX(i + 2);
        pA.fromBufferAttribute(posAttr, vA);
        pB.fromBufferAttribute(posAttr, vB);
        pC.fromBufferAttribute(posAttr, vC);
        cb.subVectors(pC, pB);
        ab.subVectors(pA, pB);
        cb.cross(ab);
        nA.fromBufferAttribute(normalAttr, vA);
        nB.fromBufferAttribute(normalAttr, vB);
        nC.fromBufferAttribute(normalAttr, vC);
        nA.add(cb); nB.add(cb); nC.add(cb);
        normalAttr.setXYZ(vA, nA.x, nA.y, nA.z);
        normalAttr.setXYZ(vB, nB.x, nB.y, nB.z);
        normalAttr.setXYZ(vC, nC.x, nC.y, nC.z);
        if ((i % (chunkSize * 3)) === (chunkSize * 3) - 3) yield;
      }

      const nrm = new THREE.Vector3();
      for (let i = 0; i < normalAttr.count; i++) {
        nrm.fromBufferAttribute(normalAttr, i);
        nrm.normalize();
        normalAttr.setXYZ(i, nrm.x, nrm.y, nrm.z);
        if ((i % chunkSize) === chunkSize - 1) yield;
      }
      normalAttr.needsUpdate = true;
    },

    // Post-stream road-clearance sweep.
    //
    // extendSpline appends control points to the CatmullRom curve, and
    // CatmullRom interpolation depends on neighboring control points — so
    // adding new tail nodes SHIFTS the shape of the curve near its old
    // tail. Every terrain mesh already baked is anchored to its build-time
    // curve; as the curve mutates over many streams, previously-clamped
    // embankment vertices at ±45m lateral end up sitting ABOVE the new
    // road path, especially where the freshly-shifted curve loops back
    // through what used to be raw hillside. Measured breaches: up to 10m
    // of terrain planted directly on top of the asphalt after ~70km.
    //
    // Cheap fix: after every stream extension, walk every terrain vertex
    // ever built, look up the current-curve nearest road point through
    // the spatial grid (built fresh this stream), and clamp any vertex
    // that lies within the drivable ribbon down 0.22m below the road.
    // Runs once per stream, not per frame, so cost is fine.

    *sweepTerrainBelowRoad() {
      if (!this.terrainMeshes || !this.terrainMeshes.length) return;
      if (!this.roadSpatialGrid) return;
      const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
      const vergeLat = CONFIG.ROAD_WIDTH * 0.5 + CONFIG.ROAD_SHOULDER_WIDTH;
      // Cover the full drivable ribbon plus verge — same envelope the
      // build-time guard uses so a swept vertex passes the same test the
      // stream's own inner-loop clearance did at build time.
      const clearRadius = vergeLat + 0.6;
      const clearRadiusPlus = clearRadius + 1.0;
      // Sweep every terrain mesh. Restricting to tail-adjacent meshes
      // was 10x cheaper but WRONG: the road weaves, and a freshly-added
      // curve segment can bend back through the territory of a mesh
      // that was built kilometres of arc length ago and has long since
      // aged out of the tail. Missing that mesh leaves visible
      // 2-3m-tall terrain wedges sticking through the road far behind
      // the player's current position. Correctness before FPS —
      // widening this back to a full walk.
      //
      // Per-vertex grid lookup is O(1) so total cost scales linearly
      // with total terrain vertex count. Runs at stream cadence
      // (every ~3s), not per frame.
      const nearTail = () => true;
      let clamped = 0, swept = 0;
      for (let mi = 0; mi < this.terrainMeshes.length; mi++) {
        const m = this.terrainMeshes[mi];
        if (!nearTail(m)) continue;
        swept++;
        const p = m.geometry.attributes.position;
        let changed = false;
        let clampedThisMesh = 0;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const nr = this.roadSpatialGrid.getNearestRoadPoint(x, z, clearRadiusPlus);
          if (!nr || nr.dist > clearRadius) continue;
          const ceiling = this.roadClearanceLimit({ x, y, z }, nr);
          // Height-aware: only clamp if within road-level corridor (< nr.y + 4.5m)
          // Prevents upper mountain bluffs, slopes, and upper road switchback tiers from being crushed 20m down to lower road height.
          if (y > ceiling && y < nr.y + 4.5) {
            p.setY(i, ceiling);
            clamped++;
            clampedThisMesh++;
            changed = true;
          }
          // The original (largest) terrain mesh can carry thousands of
          // vertices — without a yield inside this inner loop, sweeping
          // just that one mesh was itself a single ~150-200ms uninterruptible
          // block, defeating the per-mesh yield below for that mesh alone.
          if ((i & 511) === 511) yield;
        }
        if (changed) {
          p.needsUpdate = true;
          // computeVertexNormals() walks every face of the mesh and is a
          // single opaque call — it can't be chunked with yield the way the
          // loop above was, so on the largest (original) terrain mesh it was
          // itself a ~150-200ms uninterruptible block, undoing the point of
          // yielding above. The vertices it's fixing up here were just
          // clamped DOWN below the road surface specifically to hide them
          // under the asphalt (see clearRadius/ceiling above), so their
          // shading is invisible whenever only a small fraction of the mesh
          // was touched. Skip the full recompute in that case; still run it
          // when a large share of the mesh changed, since at that point a
          // visible normal seam is a real risk worth paying for.
          if (clampedThisMesh / p.count > 0.02) {
            yield* this.chunkedComputeVertexNormals(m.geometry);
          }
        }
        // This full-terrain-history walk grows with total distance driven
        // (every mesh ever streamed in gets re-swept every time), so its
        // cost isn't bounded — yielding per mesh lets the incremental
        // build driver (advanceStreamBuild) spread it across frames
        // instead of blocking the whole main thread in one go.
        yield;
      }
      this._lastSweepClamped = clamped;
      this._lastSweepMeshes = swept;

      // The floor mesh is NOT swept here — sweepFloorBelowRoad runs straight
      // after this pass in _streamBuildSequence and owns it. Keep it there:
      // the floor needs createFloorMesh's own 40/45/75/95 envelope, and a
      // second copy of "how high may the floor sit here" is exactly the drift
      // this file keeps getting bitten by.

      // Seam-normal blend across every adjacent mesh boundary.
      //
      // Each mesh recomputed its normals independently after any position
      // clamp above. At every seam, the row-N vertex of mesh i and the
      // row-0 vertex of mesh i+1 share XYZ (via the seam-snap in
      // buildExtensionMeshes) but their normals differ — each was
      // averaged over faces on only one side of the seam, so the two
      // paint different shades at identical world positions and a visible
      // band appears across the ground at the boundary (most obvious at
      // the initial→first-extension seam near 6km). Blending the two
      // normals into a single averaged value and stamping it onto BOTH
      // vertices makes the seam light identically on both sides.
      const sliceCount = (this._lastTerrainEdgeVerts && this._lastTerrainEdgeVerts.length) || 32;
      for (let mi = 0; mi + 1 < this.terrainMeshes.length; mi++) {
        const mPrev = this.terrainMeshes[mi];
        const mNext = this.terrainMeshes[mi + 1];
        const nPrev = mPrev.geometry.attributes.normal;
        const nNext = mNext.geometry.attributes.normal;
        const pPrev = mPrev.geometry.attributes.position;
        const pNext = mNext.geometry.attributes.position;
        const rowNStart = pPrev.count - sliceCount;
        // Cheap safety: only blend if the two rows are geometrically at
        // the same positions (seam-snap did its job). If they aren't
        // (mesh count boundary from something unrelated), skip.
        let same = true;
        for (let j = 0; j < sliceCount; j++) {
          const dx = pPrev.getX(rowNStart + j) - pNext.getX(j);
          const dz = pPrev.getZ(rowNStart + j) - pNext.getZ(j);
          if (dx * dx + dz * dz > 4) { same = false; break; }
        }
        if (!same) continue;
        for (let j = 0; j < sliceCount; j++) {
          const px = nPrev.getX(rowNStart + j), py = nPrev.getY(rowNStart + j), pz = nPrev.getZ(rowNStart + j);
          const nx = nNext.getX(j), ny = nNext.getY(j), nz = nNext.getZ(j);
          let ax = px + nx, ay = py + ny, az = pz + nz;
          const len = Math.hypot(ax, ay, az) || 1;
          ax /= len; ay /= len; az /= len;
          nPrev.setXYZ(rowNStart + j, ax, ay, az);
          nNext.setXYZ(j, ax, ay, az);
        }
        nPrev.needsUpdate = true;
        nNext.needsUpdate = true;
        yield;
      }
    },

    // Post-stream floor re-clamp.
    //
    // createFloorMesh bakes every floor vertex against the road as it exists
    // at world-build time: buried 25m under the ribbon within 40m, blended to
    // natural terrain height by 45m, and never above roadY-1.5 within 75m.
    // Streaming then grows the road for kilometres past that original spline,
    // and wherever the weaving new road re-enters the floor plane's footprint
    // those vertices were baked with NO road anywhere near them — so they sit
    // at raw terrain height, which on any cut/graded stretch is ABOVE the new
    // asphalt. The floor then renders on top of the road and the car, which
    // reads as the road breaking into disconnected fragments with the car
    // adrift on grass (measured: first breach at 8.5km on a 700-node spline,
    // peaking at 2.07m of floor over the asphalt).
    //
    // sweepTerrainBelowRoad cannot cover this: it walks `terrainMeshes`, and
    // floorMesh is deliberately not one of them — it needs the floor's own
    // -25/-1.5 offsets and 75m reach, not the ribbon's 0.22m/6.1m. So re-apply
    // createFloorMesh's own rules against the CURRENT road instead. Clamps
    // downward only, so repeated sweeps converge and can never raise the floor
    // back out from under geometry it is already meant to hide beneath.

    *sweepFloorBelowRoad() {
      if (!this.floorMesh || !this.floorMesh.geometry) return;
      const pts = this.roadSpacedPoints;
      if (!pts || pts.length < 2) return;

      // Identical to createFloorMesh's constants on purpose — two copies of
      // "how high may the floor sit here" that drift apart is the exact
      // failure this pass exists to clean up after.
      const RIBBON_COVERAGE = 45.0;
      const BLEND_START = 40.0;
      const SAFETY_ZONE = 75.0;
      const OUTER = SAFETY_ZONE + 20.0; // past this createFloorMesh leaves raw terrain

      // Coarse hash so the ~140k-vertex walk only pays the full nearest-point
      // search for the handful of vertices actually near the road. Cell size
      // >= OUTER with one neighbour ring means the true nearest sample can
      // never fall outside the searched 3x3 block.
      const CELL = 100.0;
      const key = (cx, cz) => cx + ',' + cz;
      const hash = new Map();
      for (let s = 0; s < pts.length; s++) {
        const k = key(Math.floor(pts[s].x / CELL), Math.floor(pts[s].z / CELL));
        let bucket = hash.get(k);
        if (!bucket) { bucket = []; hash.set(k, bucket); }
        bucket.push(s);
      }

      const pos = this.floorMesh.geometry.attributes.position;
      let lowered = 0;
      for (let i = 0; i < pos.count; i++) {
        if ((i & 1023) === 1023) yield;
        const x = pos.getX(i), z = pos.getZ(i);
        const vcx = Math.floor(x / CELL), vcz = Math.floor(z / CELL);

        let nearestSq = Infinity, roadY = 0;
        for (let dcx = -1; dcx <= 1; dcx++) {
          for (let dcz = -1; dcz <= 1; dcz++) {
            const bucket = hash.get(key(vcx + dcx, vcz + dcz));
            if (!bucket) continue;
            for (let bi = 0; bi < bucket.length; bi++) {
              const p = pts[bucket[bi]];
              const dx = x - p.x, dz = z - p.z;
              const dSq = dx * dx + dz * dz;
              if (dSq < nearestSq) { nearestSq = dSq; roadY = p.y; }
            }
          }
        }
        if (nearestSq === Infinity) continue;
        const dist = Math.sqrt(nearestSq);
        if (dist >= OUTER) continue;

        const naturalY = this.getRawTerrainHeight(x, z) - 0.3;
        let targetY = naturalY;
        if (dist <= BLEND_START) {
          targetY = roadY - 25.0;
        } else if (dist < RIBBON_COVERAGE) {
          targetY = THREE.MathUtils.lerp(roadY - 25.0, naturalY, THREE.MathUtils.smoothstep(dist, BLEND_START, RIBBON_COVERAGE));
        }
        if (dist < SAFETY_ZONE) {
          targetY = Math.min(targetY, roadY - 1.5);
        } else {
          targetY = THREE.MathUtils.lerp(Math.min(targetY, roadY - 1.5), naturalY, THREE.MathUtils.smoothstep(dist, SAFETY_ZONE, OUTER));
        }

        if (targetY < pos.getY(i)) { pos.setY(i, targetY); lowered++; }
      }

      this._lastFloorSweepLowered = lowered;
      if (lowered) {
        pos.needsUpdate = true;
        // Unlike the terrain sweep — whose clamps all end up hidden under the
        // asphalt — the 45-95m band here is VISIBLE floor (the ribbon only
        // draws out to ±40m), so these moved vertices really do need their
        // shading rebuilt or the re-clamped basin lights wrong.
        yield* this.chunkedComputeVertexNormals(this.floorMesh.geometry);
      }
    },


    *buildExtensionMeshes(scene, oldNodeCount, newNodeCount, season, difficulty = 'medium', prevEndPos = null) {
      const totalSegments = newNodeCount * 3;
      const endSeg = totalSegments;
      const points = this.roadSpacedPoints;
      if (!points || points.length <= endSeg) return;

      // Where the previously-built meshes actually stop.
      //
      // This used to be `round((oldNodeCount-1)/(newNodeCount-1) * totalSegments)`
      // — a SPLINE-NODE-COUNT ratio applied to an ARC-LENGTH-parameterized
      // index. Those two only agree when every node is equally spaced in arc
      // length, which is never true on a weaving, hilly spline. Each stream
      // therefore started the new ribbon tens of metres before or after the
      // old one ended: before => a second terrain ribbon laid straight over
      // the existing road and terrain (the "terrain bleeds into the road /
      // meshes overlapping" seam that reappeared every ~1km past the initial
      // ~6km build), after => a hole. The error also compounded, since each
      // rebuild re-derived the join from the same bad ratio.
      //
      // getSpacedPoints re-parameterizes the WHOLE curve every stream, so the
      // only stable reference is world space. CatmullRom interpolates its
      // control points, so the old endpoint still lies on the new curve —
      // matching it geometrically lands the join within a fraction of a
      // segment and is self-correcting across successive streams.
      let startSeg;
      if (prevEndPos) {
        let bestIdx = 0, bestSq = Infinity;
        for (let i = 0; i <= endSeg; i++) {
          const dx = points[i].x - prevEndPos.x;
          const dy = points[i].y - prevEndPos.y;
          const dz = points[i].z - prevEndPos.z;
          const sq = dx * dx + dy * dy + dz * dz;
          if (sq < bestSq) { bestSq = sq; bestIdx = i; }
        }
        startSeg = bestIdx;
      } else {
        startSeg = Math.max(0, Math.round(((oldNodeCount - 1) / (newNodeCount - 1)) * totalSegments));
      }
      startSeg = THREE.MathUtils.clamp(startSeg, 0, endSeg - 1);

      const roadWidth = CONFIG.ROAD_WIDTH;
      const shoulderWidth = CONFIG.ROAD_SHOULDER_WIDTH;
      const laneHalf = roadWidth * 0.5;
      const roadHalf = roadWidth * 0.52;
      const vergeLat = roadWidth * 0.5 + shoulderWidth;
      const offsets = [
        -vergeLat,
        -laneHalf,
        -laneHalf * 0.46 / 0.5,
        0.0,
        laneHalf * 0.46 / 0.5,
        laneHalf,
        vergeLat
      ];

      // Mirrors createRoadMesh's per-biome verge color logic.
      const seasonCfgExt = season || CONFIG.SEASONS.autumn;
      const baseTarmac = new THREE.Color(CONFIG.ROAD_SURFACE.color);

      // 1. Road extension mesh
      const roadGeom = new THREE.BufferGeometry();
      const rPositions = [], rNormals = [], rUvs = [], rColors = [], rIndices = [];

      for (let i = startSeg; i <= endSeg; i++) {
        const pt = points[i];
        const normal = this.roadNormals[i] || new THREE.Vector3(1, 0, 0);
        const binormal = this.roadBinormals[i] || new THREE.Vector3(0, 1, 0);
        const bankingAngle = this.roadBankingAngles[i] || 0;
        const bankedNormal = normal.clone().multiplyScalar(Math.cos(bankingAngle)).addScaledVector(binormal, Math.sin(bankingAngle)).normalize();
        const bankedUp = binormal.clone().multiplyScalar(Math.cos(bankingAngle)).addScaledVector(normal, -Math.sin(bankingAngle)).normalize();

        const curPalette = this.getDistrictPalette(pt.z, seasonCfgExt);
        const vergeColor = curPalette.grassLight.clone().lerp(baseTarmac, 0.40);

        for (let j = 0; j < offsets.length; j++) {
          const off = offsets[j];
          const isVerge = (j === 0 || j === 6);
          const p = pt.clone().addScaledVector(isVerge ? normal : bankedNormal, off);
          if (isVerge) {
            p.y = this.groundHeightAt(pt, p, off) + CONFIG.ROAD_VERGE_LIFT;
          } else {
            p.addScaledVector(bankedUp, 0.12);
          }
          rPositions.push(p.x, p.y, p.z);
          rNormals.push(bankedUp.x, bankedUp.y, bankedUp.z);
          rUvs.push(off * 0.5, i * 0.3);
          if (isVerge) {
            rColors.push(vergeColor.r, vergeColor.g, vergeColor.b);
          } else {
            rColors.push(baseTarmac.r, baseTarmac.g, baseTarmac.b);
          }
        }

        if (i < endSeg) {
          const cols = offsets.length;
          const row1 = (i - startSeg) * cols;
          const row2 = (i - startSeg + 1) * cols;
          for (let j = 0; j < cols - 1; j++) {
            rIndices.push(row1 + j, row1 + j + 1, row2 + j);
            rIndices.push(row1 + j + 1, row2 + j + 1, row2 + j);
          }
        }
        yield;
      }

      // Snap row 0 of road extension mesh to previous chunk's last road row vertex-for-vertex
      if (this._lastRoadEdgeVerts && this._lastRoadEdgeVerts.length === offsets.length) {
        for (let j = 0; j < offsets.length; j++) {
          const base = j * 3;
          const cached = this._lastRoadEdgeVerts[j];
          rPositions[base] = cached.x;
          rPositions[base + 1] = cached.y;
          rPositions[base + 2] = cached.z;
        }
      }

      // Re-cache last row of road vertices for the next extension chunk
      const roadLastRowBase = (endSeg - startSeg) * offsets.length * 3;
      this._lastRoadEdgeVerts = [];
      for (let j = 0; j < offsets.length; j++) {
        this._lastRoadEdgeVerts.push({
          x: rPositions[roadLastRowBase + j * 3],
          y: rPositions[roadLastRowBase + j * 3 + 1],
          z: rPositions[roadLastRowBase + j * 3 + 2]
        });
      }

      roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(rPositions, 3));
      roadGeom.setAttribute('color', new THREE.Float32BufferAttribute(rColors, 3));
      roadGeom.setAttribute('normal', new THREE.Float32BufferAttribute(rNormals, 3));
      roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
      roadGeom.setIndex(rIndices);
      roadGeom.computeVertexNormals();

      const roadMesh = new THREE.Mesh(roadGeom, this.roadMesh ? this.roadMesh.material : new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0.05, map: RealTextureFactory.roadColor() }));
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);

      // 1b. Lane markings for the extension: the same builder and constants as the initial road (B149).
      scene.add(this._buildRoadWear(startSeg, endSeg));
      scene.add(this._buildLaneRibbons(startSeg, endSeg));

      // 2. Terrain ribbon extension mesh (matching createTerrainMesh ±150m landscape skirt)
      // Dense 4m-spaced embankment slices 9–45m match createTerrainMesh exactly, with outer
      // skirt slices out to 150m ensuring continuous rolling mountain background past 6km.
      const lateralSlices = [
        -150.0, -105.0, -75.0, -55.0,
        -45.0, -41.0, -37.0, -33.0, -29.0, -25.0, -21.0, -17.0, -13.0, -9.0,
        -7.6, -6.5, -vergeLat, -roadHalf, roadHalf, vergeLat, 6.5, 7.6,
        9.0, 13.0, 17.0, 21.0, 25.0, 29.0, 33.0, 37.0, 41.0, 45.0,
        55.0, 75.0, 105.0, 150.0
      ];
      const sliceCount = lateralSlices.length;
      const tGeom = new THREE.BufferGeometry();
      const tPositions = [], tNormals = [], tUvs = [], tColors = [], tIndices = [];

      for (let i = startSeg; i <= endSeg; i++) {
        const pt = points[i];
        const normal = this.roadNormals[i] || new THREE.Vector3(1, 0, 0);
        const binormal = this.roadBinormals[i] || new THREE.Vector3(0, 1, 0);
        const bankingAngle = this.roadBankingAngles[i] || 0;

        const curPalette = this.getDistrictPalette(pt.z, seasonCfgExt);
        const grassCol = curPalette.grassColor;
        const grassLight = curPalette.grassLight;
        const cliffCol = curPalette.cliffColor;
        const shoulderSoil = curPalette.shoulderSoil;

        for (let j = 0; j < sliceCount; j++) {
          const latDist = lateralSlices[j];
          const absDist = Math.abs(latDist);
          const bankedYOffset = latDist * binormal.y * Math.sin(bankingAngle);
          const worldPos = pt.clone().addScaledVector(normal, latDist);
          let finalY = pt.y;

          if (absDist <= roadHalf) {
            // Hidden under road — strictly 0.22m below road surface (matches createTerrainMesh)
            finalY = pt.y - 0.22 + bankedYOffset;
            tColors.push(shoulderSoil.r, shoulderSoil.g, shoulderSoil.b);
          } else if (absDist <= 9.0) {
            const t = (absDist - roadHalf) / (9.0 - roadHalf);
            // Shared formula (Pattern 1): this used to be its own copy, which is
            // why flattening groundHeightAt didn't change the rendered verge.
            // 0.04 below it, matching the 0.22 vs 0.18 under-slab offset above.
            finalY = this.groundHeightAt(pt, worldPos, latDist) - 0.04;
            const blendT = THREE.MathUtils.smoothstep(t, 0.05, 0.95);
            const bladeNoise = 0.96 + this.simplex.noise2D(worldPos.x * 0.08, worldPos.z * 0.08) * 0.06;
            tColors.push(
              THREE.MathUtils.lerp(shoulderSoil.r, grassCol.r * bladeNoise, blendT),
              THREE.MathUtils.lerp(shoulderSoil.g, grassCol.g * bladeNoise, blendT),
              THREE.MathUtils.lerp(shoulderSoil.b, grassCol.b * bladeNoise, blendT)
            );
          } else {
            const rawH = this.getRawTerrainHeight(worldPos.x, worldPos.z);
            const blendFactor = THREE.MathUtils.smoothstep(absDist, 9.0, 45.0);
            // createTerrainMesh lifts the embankment ABOVE the tunnel roof so
            // cutting geometry never plunges down into the bore.
            const inTunnelExt = this.isInTunnelZone && this.isInTunnelZone(i);
            if (inTunnelExt) {
              const mountainOverhead = Math.max(rawH, pt.y + 14.0);
              finalY = THREE.MathUtils.lerp(pt.y - 0.5, mountainOverhead, blendFactor);
              tColors.push(cliffCol.r * 0.9, cliffCol.g * 0.9, cliffCol.b * 0.9);
            } else {
              const shoulderDrop = pt.y - 0.5;
              finalY = THREE.MathUtils.lerp(shoulderDrop, rawH, blendFactor);
              if (rawH > 22.0) {
                tColors.push(cliffCol.r, cliffCol.g, cliffCol.b);
              } else {
                const nVal = 0.94 + this.simplex.noise2D(worldPos.x * 0.04, worldPos.z * 0.04) * 0.07;
                tColors.push(grassCol.r * nVal, grassCol.g * nVal, grassCol.b * nVal);
              }
            }
          }

          // Road clearance guard: if this vertex lies within the drivable road corridor of ANY road segment,
          // clamp finalY below that road surface to eliminate terrain poking through the asphalt.
          // Height-aware: only clamp if within road level corridor (< +4.5m) so upper mountain bluffs and upper switchback tiers are never crushed.
          if (absDist > roadHalf) {
            const clearRadius = vergeLat + 0.6;
            const nearestRoad = this.roadSpatialGrid ? this.roadSpatialGrid.getNearestRoadPoint(worldPos.x, worldPos.z, clearRadius + 1.0) : null;
            if (nearestRoad && nearestRoad.dist < clearRadius) {
              const clearLimit = this.roadClearanceLimit(worldPos, nearestRoad);
              if (finalY > clearLimit && finalY < nearestRoad.y + 4.5) {
                finalY = clearLimit;
              }
            } else {
              const clearSq = clearRadius * clearRadius;
              for (let s = 0; s < points.length; s += 8) {
                const dx = worldPos.x - points[s].x;
                const dz = worldPos.z - points[s].z;
                if (dx * dx + dz * dz < clearSq) {
                  if (finalY > points[s].y - 0.22 && finalY < points[s].y + 4.5) {
                    finalY = points[s].y - 0.22;
                  }
                  break;
                }
              }
            }
          }

          tPositions.push(worldPos.x, finalY, worldPos.z);
          tNormals.push(0, 1, 0);
          // Must be the SAME world-space mapping createTerrainMesh uses.
          // This was `latDist * 0.05, i * 0.3`, which spans ~4.5 UV units
          // across the 90m ribbon where the initial mesh spans 40 — the
          // grass photo was stretched ~9x laterally the moment the world
          // streamed past its initial build, so past ~6km the ground read
          // as smeared and washed out while sharing the exact same material.
          tUvs.push(worldPos.x * 0.45, worldPos.z * 0.45);
        }

        if (i < endSeg) {
          const row1 = (i - startSeg) * sliceCount;
          const row2 = (i - startSeg + 1) * sliceCount;
          for (let j = 0; j < sliceCount - 1; j++) {
            tIndices.push(row1 + j, row1 + j + 1, row2 + j);
            tIndices.push(row1 + j + 1, row2 + j + 1, row2 + j);
          }
        }
        yield;
      }

      // Snap row 0 vertex positions to the previous mesh's last-row cache
      // (initial createTerrainMesh, or the previous streaming chunk), so
      // the two ribbons meet at identical world positions vertex-for-vertex
      // — kills the horizontal shelf/seam that appears every ~500m past
      // the initial build.
      if (this._lastTerrainEdgeVerts && this._lastTerrainEdgeVerts.length === sliceCount) {
        for (let j = 0; j < sliceCount; j++) {
          const base = j * 3;
          const cached = this._lastTerrainEdgeVerts[j];
          tPositions[base] = cached.x;
          tPositions[base + 1] = cached.y;
          tPositions[base + 2] = cached.z;
        }
      }

      // Re-cache row N of THIS chunk for the next streaming call.
      const _rowN = [];
      const _rowNStart = (endSeg - startSeg) * sliceCount;
      // Row-N normals will be re-blended when the NEXT chunk arrives —
      // we still need to know which mesh + vertex to write back to.
      for (let j = 0; j < sliceCount; j++) {
        const base = (_rowNStart + j) * 3;
        _rowN.push({
          lat: lateralSlices[j],
          x: tPositions[base],
          y: tPositions[base + 1],
          z: tPositions[base + 2],
          _mesh: null, // filled in right after mesh is created
          _idx: _rowNStart + j
        });
      }
      this._pendingRowN = _rowN;

      tGeom.setAttribute('position', new THREE.Float32BufferAttribute(tPositions, 3));
      tGeom.setAttribute('color', new THREE.Float32BufferAttribute(tColors, 3));
      tGeom.setAttribute('normal', new THREE.Float32BufferAttribute(tNormals, 3));
      tGeom.setAttribute('uv', new THREE.Float32BufferAttribute(tUvs, 2));
      tGeom.setIndex(tIndices);
      tGeom.computeVertexNormals();
      tGeom.computeTangents();

      // Seam normal blend: after computeVertexNormals ran on this chunk in
      // isolation, its row-0 vertices carry a normal averaged only over the
      // faces on THIS side of the seam — while the previous mesh's row-N
      // vertices carry a normal averaged only over faces on its side. The
      // two shared vertex positions therefore light differently, painting
      // a visible shading band across the ground at the boundary between
      // the initial mesh and the first extension (and again at every
      // extension boundary). The fix is to compute the true full-across
      // vertex normal — average of both sides' contributions — and stamp
      // it onto both meshes' shared vertex so they light identically.
      if (this._lastTerrainEdgeVerts && this._lastTerrainEdgeVerts.length === sliceCount) {
        const tNormalsAttr = tGeom.attributes.normal;
        for (let j = 0; j < sliceCount; j++) {
          const cached = this._lastTerrainEdgeVerts[j];
          if (!cached._mesh) continue;
          const prevNormAttr = cached._mesh.geometry.attributes.normal;
          const pnx = prevNormAttr.getX(cached._idx);
          const pny = prevNormAttr.getY(cached._idx);
          const pnz = prevNormAttr.getZ(cached._idx);
          const cnx = tNormalsAttr.getX(j);
          const cny = tNormalsAttr.getY(j);
          const cnz = tNormalsAttr.getZ(j);
          let ax = pnx + cnx, ay = pny + cny, az = pnz + cnz;
          const len = Math.hypot(ax, ay, az) || 1;
          ax /= len; ay /= len; az /= len;
          tNormalsAttr.setXYZ(j, ax, ay, az);
          prevNormAttr.setXYZ(cached._idx, ax, ay, az);
        }
        tNormalsAttr.needsUpdate = true;
        this._lastTerrainEdgeVerts[0]._mesh.geometry.attributes.normal.needsUpdate = true;
      }

      const terrainMesh = new THREE.Mesh(tGeom, this.terrainMesh ? this.terrainMesh.material : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02, map: RealTextureFactory.grassColor() }));
      terrainMesh.receiveShadow = true;
      scene.add(terrainMesh);
      if (!this.terrainMeshes) this.terrainMeshes = [];
      this.terrainMeshes.push(terrainMesh);

      // Bind the pending row-N cache to the new mesh so the NEXT extension
      // can blend normals across this seam too. Also refresh its cached
      // normal values from the (now seam-blended) attribute.
      if (this._pendingRowN) {
        const nAttr = tGeom.attributes.normal;
        this._pendingRowN.forEach(rec => {
          rec._mesh = terrainMesh;
          rec.nx = nAttr.getX(rec._idx);
          rec.ny = nAttr.getY(rec._idx);
          rec.nz = nAttr.getZ(rec._idx);
        });
        this._lastTerrainEdgeVerts = this._pendingRowN;
        this._pendingRowN = null;
      }

      // 3. Roadside props along the new segment (guardrails, villas, kiosks,
      // rocks and billboard trees), matching the initial build.
      const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.32 });
      const postMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.80, roughness: 0.40 });
      const railGeom = new THREE.BoxGeometry(0.08, 0.30, 4.2);
      const postGeom = new THREE.BoxGeometry(0.10, 1.1, 0.10);
      const streamRockGeom = RockGeometryFactory.createFacetedRockGeometry(42);

      const diffCfg = CONFIG.DIFFICULTY_TIERS[difficulty] || CONFIG.DIFFICULTY_TIERS.medium;
      const cityOrders = CONFIG.ORDERS_BY_CITY[this.cityKey] || CONFIG.ORDERS_BY_CITY.mumbai;
      const fenceDist = this.getBarrierLateralDistance();
      const newTrees = [];
      const isWinter = (seasonCfgExt.id === 'winter');

      // Was a linear scan over the FULL road points array (stride 2) on
      // every single call — correct (still checks every stretch of road,
      // catching adjacent loops of hairpin switchbacks the way the old
      // comment describes), but its cost scales with total road length
      // driven so far, not with this stream's new segment range. Called
      // many times per node (villa/kiosk/rock/tree checks), this was the
      // single biggest contributor to the streaming stutter on any drive
      // long enough to have built up a few thousand road points — one
      // "unlucky" node with several candidate placements could block the
      // main thread for 100-300ms by itself. this.roadSpatialGrid is
      // rebuilt fresh from these exact points right before this generator
      // runs (see _streamBuildSequence), so a bounded local-cell lookup
      // finds the same nearest point without walking the whole road.
      const clearsRoadExt = (pos, minClear) => {
        return !this.roadSpatialGrid.getNearestRoadPoint(pos.x, pos.z, minClear);
      };

      for (let i = startSeg; i <= endSeg; i++) {
        const pt = points[i];
        const normal = this.roadNormals[i] || new THREE.Vector3(1, 0, 0);
        const rng = () => (this.prng ? this.prng.next() : Math.random());
        const curPalette = this.getDistrictPalette(pt.z, seasonCfgExt);

        let tangent;
        if (i === 0) tangent = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
        else if (i === points.length - 1) tangent = new THREE.Vector3().subVectors(points[points.length - 1], points[points.length - 2]).normalize();
        else tangent = new THREE.Vector3().subVectors(points[i + 1], points[i - 1]).normalize();

        // 0. Street furniture — the same shared spawners the initial build
        // uses, on matching real-world spacing (streamed chunks used to get
        // none of these, which is why the road thinned out past ~6 km).
        try {
          const stepM = this.curve.getLength() / (points.length - 1);
          const crossed = (every, offset = 0) => i > startSeg && Math.floor((i * stepM + offset) / every) !== Math.floor(((i - 1) * stepM + offset) / every);
          const inTunnelHere = this.isInTunnelZone && this.isInTunnelZone(i, 4);
          if (!inTunnelHere) {
            if (crossed(100) && i + 3 < points.length && i > 0) {
              const nt = new THREE.Vector3().subVectors(points[i + 3], points[i - 1]).normalize();
              this.spawnCurveSign(pt, normal, tangent, tangent.x * nt.z - tangent.z * nt.x);
            }
            if (crossed(170)) this.spawnUtilityPole(pt, normal);
            if (crossed(200, 60)) this.spawnStreetLamp(pt, normal, -1);
            if (crossed(225, 110)) this.spawnMilestone(pt, normal, 1);
            if (crossed(480, 40)) this.spawnRepairShop(pt, normal, 1, 'cycle', true);
            if (crossed(480, 280)) this.spawnRepairShop(pt, normal, -1, 'motor', true);
            // Remaining initial-only props, same real-world spacing as the
            // first build (its 800 samples are ~10.5 m apart).
            const openRoadHere = !!(CONFIG.CITIES[this.cityKey]?.openRoad);
            if (!openRoadHere && crossed(550, 300)) this.spawnGantry(pt, normal, tangent);
            if (crossed(750, 180)) this.spawnBusShelter(pt, normal, 1);
            if (!openRoadHere && crossed(4200, 2000)) this.spawnMonument(pt, normal, 1);
            if (!openRoadHere && rng() > 0.15) {
              if (crossed(75)) this.spawnCityBuilding(pt, normal, 1);
              if (crossed(75, 37)) this.spawnCityBuilding(pt, normal, -1);
            }
          }
        } catch (err) {
          console.error('Streamed street furniture failed:', err);
        }

        // 1. Barriers — 4-style rotation matching createFoliageAndProps
        // (Armco / dry-stone / wood split-rail / Jersey concrete). Was
        // Armco-only every 4 nodes: any wooden split-rail fencing the
        // player saw for the first ~6km silently vanished the moment
        // streaming took over, replaced by a thin grey metal rail.
        // Only runs when the initial pass produced a barrier asset
        // cache (Earth cities), matches the initial's per-node cadence
        // (FENCE_STEP=1), and skips vertices inside tunnel zones.
        if (this._barrierAssets && !this.isInTunnelZone?.(i)) {
          const BA = this._barrierAssets;
          const nextPtBar = points[Math.min(points.length - 1, i + 1)];
          const avgSegStepBar = this.curve.getLength() / (points.length - 1);
          const railLenBar = avgSegStepBar * 1.08 + 0.6;
          const _fdummy = new THREE.Object3D();
          [-1, 1].forEach(side => {
            const fenceDistBar = side * this.getBarrierLateralDistance();
            const fencePosBar = pt.clone().addScaledVector(normal, fenceDistBar);
            const endA = fencePosBar.clone().addScaledVector(tangent, -railLenBar / 2);
            const endB = fencePosBar.clone().addScaledVector(tangent, railLenBar / 2);
            const yA = this.surfaceHeightNear(endA, pt, fenceDistBar);
            const yB = this.surfaceHeightNear(endB, nextPtBar, fenceDistBar);
            fencePosBar.y = (yA + yB) / 2;
            const offsetA = yA - fencePosBar.y;
            const offsetB = yB - fencePosBar.y;
            const tiltAngle = Math.atan2(yB - yA, railLenBar);

            if (this.isFenceGap(fencePosBar)) return;
            if (this.obstacles.some(o => o.type === 'building' && o.pos.distanceTo(fencePosBar) < o.radius + 2.5)) return;
            const segMeshes = [];
            this._streamFenceMeshes = this._streamFenceMeshes || [];
            this._streamFenceMeshes.push({ pos: fencePosBar.clone(), meshes: segMeshes });

            _fdummy.position.copy(fencePosBar);
            _fdummy.up.set(0, 1, 0);
            _fdummy.lookAt(fencePosBar.clone().add(normal));
            _fdummy.updateMatrix();
            const groupMatrix = _fdummy.matrix;

            const barrierStyle = this._barrierStyleAt(fencePosBar);
            const emit = (geom, mat, localM) => {
              const m = new THREE.Mesh(geom, mat);
              m.applyMatrix4(groupMatrix.clone().multiply(localM));
              scene.add(m);
              segMeshes.push(m);
            };

            if (barrierStyle === 0) {
              // Armco W-Beam
              barrierPostStations(railLenBar, offsetA, offsetB).forEach(([px, offset]) => {
                emit(BA.armcoPostGeom, BA.armcoPostMat, new THREE.Matrix4().makeTranslation(px, offset + 0.55, 0));
                emit(BA.armcoReflGeom, BA.armcoReflMat, new THREE.Matrix4().makeTranslation(px, offset + 0.78, 0.08));
              });
              emit(BA.armcoRailGeom, BA.armcoRailMat, new THREE.Matrix4().compose(
                new THREE.Vector3(0, 0.65, 0),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tiltAngle)),
                new THREE.Vector3(railLenBar, 1, 1)
              ));
            } else if (barrierStyle === 1) {
              // Dry-stone (4 courses, bottom course seated on surface)
              [0.09, 0.31, 0.53, 0.75].forEach((ry, rowIdx) => {
                const jitter = 1.0 - rowIdx * 0.04;
                emit(BA.stoneGeom, BA.stoneMat, new THREE.Matrix4().compose(
                  new THREE.Vector3(0, ry, 0),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tiltAngle)),
                  new THREE.Vector3(railLenBar, 1, jitter)
                ));
              });
            } else if (barrierStyle === 3) {
              // Jersey concrete (2 courses, base seated on surface)
              [0.16, 0.50].forEach((ry, rIdx) => {
                const bScaleZ = rIdx === 0 ? 1.0 : 0.75;
                emit(BA.concreteGeom, BA.concreteMat, new THREE.Matrix4().compose(
                  new THREE.Vector3(0, ry, 0),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tiltAngle)),
                  new THREE.Vector3(railLenBar, 1, bScaleZ)
                ));
              });
            } else {
              // Wood split-rail (2 posts + 2 rails)
              barrierPostStations(railLenBar, offsetA, offsetB).forEach(([px, offset]) => {
                emit(BA.postGeom, BA.postMat, new THREE.Matrix4().makeTranslation(px, offset + 0.6, 0));
              });
              [0.45, 0.85].forEach(ry => {
                emit(BA.railGeom, BA.railMat, new THREE.Matrix4().compose(
                  new THREE.Vector3(0, ry, 0),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tiltAngle)),
                  new THREE.Vector3(railLenBar, 1, 1)
                ));
              });
            }
          });
        }

        // 2. Architectural Mountain Villas, Turnout Bays & Parcel Drop Plinths (settlement waves every ~36 nodes)
        if (i % 36 === 0) {
          const orderIdx = Math.floor(i / 36) % cityOrders.length;
          const order = cityOrders[orderIdx];
          const houseSide = (Math.floor(i / 36) % 2 === 0 ? 1 : -1);
          const houseDist = houseSide * (CONFIG.ROAD_WIDTH * 0.5 + 13.0 + rng() * 6.0);
          const housePos = pt.clone().addScaledVector(normal, houseDist);
          housePos.y = this.groundHeightAt(pt, housePos, houseDist);

          if (clearsRoadExt(housePos, CONFIG.ROAD_WIDTH * 0.5 + 4.5, i) &&
              !this.obstacles.some(o => o.pos.distanceTo(housePos) < (o.radius + 5.5))) {
            // Rule 15: Prune any existing rocks or trees near the new villa site
            const HOUSE_CLEARANCE = 7.0;
            const overlapping = this.obstacles.filter(o =>
              (o.type === 'rock' || o.type === 'tree') && o.pos.distanceTo(housePos) < (o.radius + HOUSE_CLEARANCE)
            );
            overlapping.forEach(o => {
              if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh);
            });
            if (overlapping.length > 0) {
              this.obstacles = this.obstacles.filter(o => !overlapping.includes(o));
            }

            const isModernVilla = (Math.floor(i / 36) % 2 === 0);
            this.buildScenicVillaAndTurnout({
              pt, normal, tangent, houseSide, houseDist, order, isModernVilla, isWinter,
              u: i / Math.max(1, points.length - 1),
              tossRadius: diffCfg.tossRadius,
              targetParentGroup: this.foliageGroup || scene
            });
          }
        }

        // 3. Roadside Viewpoint Pavilions & Chai Tapris (every ~48 nodes, offset by 24)
        if (i % 48 === 24) {
          const isChai = (Math.floor(i / 48) % 2 === 0);
          const kioskSide = isChai ? -1 : 1;
          const kioskDist = CONFIG.ROAD_WIDTH * 0.5 + (isChai ? 5.2 : 7.2);
          const kioskPos = pt.clone().addScaledVector(normal, kioskSide * kioskDist);
          kioskPos.y = this.groundHeightAt(pt, kioskPos, kioskSide * kioskDist);

          if (clearsRoadExt(kioskPos, CONFIG.ROAD_WIDTH * 0.5 + 3.0, i) &&
              !this.obstacles.some(o => o.pos.distanceTo(kioskPos) < (o.radius + 3.2))) {
            // Rule 15: Prune any existing rocks or trees near the kiosk site
            const KIOSK_CLEARANCE = 4.5;
            const overlapping = this.obstacles.filter(o =>
              (o.type === 'rock' || o.type === 'tree') && o.pos.distanceTo(kioskPos) < (o.radius + KIOSK_CLEARANCE)
            );
            overlapping.forEach(o => {
              if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh);
            });
            if (overlapping.length > 0) {
              this.obstacles = this.obstacles.filter(o => !overlapping.includes(o));
            }

            this.buildViewpointOrChai({
              pt, normal, tangent, side: kioskSide, dist: kioskDist, isChaiTapri: isChai,
              targetParentGroup: this.foliageGroup || scene
            });
          }
        }

        // 3d. Roadside pedestrians.
        //
        // Streamed chunks used to spawn none at all, so every pedestrian in
        // the game lived on the initial ~8.4km spline and the world emptied
        // of people the moment streaming took over. Same cadence and cluster
        // shape as the initial build; yields because this is a generator and
        // a rig clone per pedestrian would otherwise hitch the stream.
        if (i % 16 === 0 && this.prng.next() > 0.2) {
          this.spawnPedestrianCluster(pt, normal, tangent);
          yield;
        }

        // 3e. Signalled zebra crossing — streamed chunks get these too, or
        // crossings would stop existing past the initial spline exactly the
        // way pedestrians did.
        // (crossings: see tryPlaceCrossingNear, called where stalls/houses are built)

        // 4. District Biome Rocks (scatter 12–40m off road, adaptive district rock color)
        if (i % 8 === 0) {
          [-1, 1].forEach(side => {
            if (rng() > 0.45) return;
            const rockLat = side * (CONFIG.ROAD_WIDTH * 0.5 + 6.0 + rng() * 26.0);
            const rp = pt.clone().addScaledVector(normal, rockLat);
            if (!clearsRoadExt(rp, CONFIG.ROAD_WIDTH * 0.5 + 2.5, i)) return;
            const rs = 0.4 + rng() * 1.6;
            const rockRadius = 1.2 * rs;
            // Rule 15: Check clearance against existing buildings before placing rock
            if (this.obstacles.some(o => o.type === 'building' && o.pos.distanceTo(rp) < (o.radius + rockRadius + 2.0))) return;

            rp.y = this.groundHeightAt(pt, rp, rockLat);
            const rockMatCurrent = new THREE.MeshStandardMaterial({
              color: curPalette.rockColor, vertexColors: true, roughness: 0.88, metalness: 0.04,
              map: RealTextureFactory.rockColor(), normalMap: RealTextureFactory.rockNormal()
            });
            const rock = new THREE.Mesh(streamRockGeom, rockMatCurrent);
            rock.scale.setScalar(rs);
            rock.rotation.set(rng() * 3, rng() * 3, 0);
            rock.position.set(rp.x, rp.y + rs * 0.3, rp.z);
            (this.foliageGroup || scene).add(rock);
            this.obstacles.push({ pos: rp.clone(), radius: rockRadius, type: 'rock', mesh: rock });
          });
        }

        // 5. Clustered Multi-Tier Trees (matching createFoliageAndProps density and fidelity)
        const treeDensity = curPalette.treeDensity !== undefined ? curPalette.treeDensity : 0.75;
        const treeLeaves = curPalette.treeLeaves && curPalette.treeLeaves.length > 0 ? curPalette.treeLeaves : [0x366247, 0x3c7652, 0x5baa78];

        // Near-road tree clusters (every 4 nodes)
        if (i % 4 === 0 && rng() < treeDensity) {
          [-1, 1].forEach(side => {
            if (rng() > 0.70) return;
            const nearDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 8.0 + rng() * 10.0);
            const nearPos = pt.clone().addScaledVector(normal, nearDist);
            const clusterCount = Math.floor(2 + rng() * 3); // 2 to 4 trees
            rng();
            const isPine = isWinter ? true : this._pineZoneAt(pt, normal, side);

            for (let ci = 0; ci < clusterCount; ci++) {
              const leafColHex = treeLeaves[Math.floor(rng() * treeLeaves.length)];
              const cOffset = new THREE.Vector3((rng() - 0.5) * 5.0, 0, (rng() - 0.5) * 5.0);
              const cPos = nearPos.clone().add(cOffset);
              const cLat = side * (CONFIG.ROAD_WIDTH * 0.5 + 8.0) + normal.dot(cOffset);
              cPos.y = this.groundHeightAt(pt, cPos, cLat);

              const scale = 0.85 + rng() * 0.6;
              const radius = 1.8 * scale;
              const treeClearance = (CONFIG.ROAD_WIDTH * 0.5) + (radius * 1.25) + 1.2;
              if (!clearsRoadExt(cPos, treeClearance, i)) continue;
              if (this.obstacles.some(o => o.type === 'building' && o.pos.distanceTo(cPos) < (o.radius + radius + 1.0))) continue;

              newTrees.push({
                kind: isPine ? 'pine' : 'broadleaf', worldHeight: 16.0, tintHex: leafColHex,
                pos: cPos.clone(), scale, rotY: rng() * Math.PI * 2, radius
              });
              this.obstacles.push({ pos: cPos.clone(), radius, type: 'tree' });
            }
          });
        }

        // Background forest clusters (every 6 nodes)
        if (i % 6 === 0 && rng() < treeDensity * 0.75) {
          [-1, 1].forEach(side => {
            if (rng() > 0.65) return;
            const bgDist = side * (24.0 + rng() * 60.0);
            const bgPos = pt.clone().addScaledVector(normal, bgDist);
            const bgClusterCount = Math.floor(3 + rng() * 4); // 3 to 6 trees
            rng();
            const bgIsPine = isWinter ? true : this._pineZoneAt(pt, normal, side);

            for (let ci = 0; ci < bgClusterCount; ci++) {
              const bgLeafHex = treeLeaves[Math.floor(rng() * treeLeaves.length)];
              const bgOffset = new THREE.Vector3((rng() - 0.5) * 9.0, 0, (rng() - 0.5) * 9.0);
              const cBgPos = bgPos.clone().add(bgOffset);
              const bgLat = bgDist + normal.dot(bgOffset);
              cBgPos.y = this.groundHeightAt(pt, cBgPos, bgLat);

              const bgScale = 0.9 + rng() * 0.65;
              const bgRadius = 2.2 * bgScale;
              const bgClearance = (CONFIG.ROAD_WIDTH * 0.5) + (bgRadius * 1.25) + 1.2;
              if (!clearsRoadExt(cBgPos, bgClearance, i)) continue;
              if (this.obstacles.some(o => o.type === 'building' && o.pos.distanceTo(cBgPos) < (o.radius + bgRadius + 1.0))) continue;

              newTrees.push({
                kind: bgIsPine ? 'pine' : 'broadleaf', worldHeight: 22.0, tintHex: bgLeafHex,
                pos: cBgPos.clone(), scale: bgScale, rotY: rng() * Math.PI * 2, radius: bgRadius
              });
              this.obstacles.push({ pos: cBgPos.clone(), radius: bgRadius, type: 'tree' });
            }
          });
        }
        yield;
      }

      if (newTrees.length > 0) {
        const treeBatch = TreeBillboardFactory.buildInstancedBatches(newTrees);
        (this.foliageGroup || scene).add(treeBatch);

        if (isWinter) {
          const snowCapGeom = new THREE.SphereGeometry(1, 6, 3);
          const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf0f5f9, roughness: 0.9, metalness: 0 });
          const snowCapMesh = new THREE.InstancedMesh(snowCapGeom, snowCapMat, newTrees.length);
          snowCapMesh.frustumCulled = false;
          const dummy = new THREE.Object3D();
          newTrees.forEach((t, idx) => {
            const capR = t.worldHeight * t.scale * 0.22;
            dummy.position.set(t.pos.x, t.pos.y + t.worldHeight * t.scale * 0.85, t.pos.z);
            dummy.scale.set(capR, capR * 0.48, capR);
            dummy.updateMatrix();
            snowCapMesh.setMatrixAt(idx, dummy.matrix);
          });
          snowCapMesh.instanceMatrix.needsUpdate = true;
          (this.foliageGroup || scene).add(snowCapMesh);
        }
      }

      // Rule 15 & 16: Unconditional final sweep for rock/tree overlaps with buildings and road corridor
      {
        const buildings = this.obstacles.filter(o => o.type === 'building');
        const stillOverlapping = this.obstacles.filter(o =>
          (o.type === 'rock' || o.type === 'tree') &&
          buildings.some(b => o.pos.distanceTo(b.pos) < (o.radius + b.radius + 0.5))
        );
        stillOverlapping.forEach(o => {
          if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh);
        });
        if (stillOverlapping.length > 0) {
          this.obstacles = this.obstacles.filter(o => !stillOverlapping.includes(o));
        }

        // Road corridor clearance sweep
        const minCorridorClear = CONFIG.ROAD_WIDTH * 0.5 + 1.0;
        const breachingRoad = this.obstacles.filter(o => {
          if (o.type === 'rock' || o.type === 'tree') {
            const reqDist = minCorridorClear + (o.radius || 1.0);
            return !clearsRoadExt(o.pos, reqDist);
          }
          return false;
        });
        breachingRoad.forEach(o => {
          if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh);
        });
        if (breachingRoad.length > 0) {
          this.obstacles = this.obstacles.filter(o => !breachingRoad.includes(o));
        }
      }
    },

    advanceStreamBuild(budgetMs = 6) {
      if (!this._streamBuildGen) return;
      const t0 = performance.now();
      let result = { done: false };
      while (!result.done && (performance.now() - t0) < budgetMs) {
        result = this._streamBuildGen.next();
      }
      if (result.done) {
        this._streamBuildGen = null;
      }
    },

    // Chunked reimplementation of THREE.BufferGeometry.computeVertexNormals()
    // for indexed geometry — same standard per-triangle accumulate-then-
    // normalize algorithm three.js uses internally, just spread across
    // yields so a single call on a large mesh (tens of thousands of
    // vertices) can't block the main thread for 100ms+ in one shot the way
    // the built-in synchronous call did.
  });
})();
