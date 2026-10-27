(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const { CONFIG, PRNG, SimplexNoise, RoadSpatialGrid } = S;

  class ProceduralWorld {
    constructor(seed = '5927cd04', seasonKey = 'autumn', cityKey = 'mumbai') {
      this.seed = seed;
      this.seasonKey = seasonKey;
      this.cityKey = cityKey;
      this.prng = new PRNG(seed);
      this.simplex = new SimplexNoise(this.prng);
      this.splineNodes = [];
      this.curve = null;
      this.roadMesh = null;
      this.terrainMesh = null;
      this.skyMesh = null;
      this.roadSpatialGrid = new RoadSpatialGrid(25.0);
      this.foliageGroup = new THREE.Group();
      this.windowMaterials = [];
      this.trafficVehicles = [];
      this.deliveryTargets = [];
      this.crossers = [];
      this.patrons = [];
      this.trafficSignals = [];

      this.districtSimplexMap = new Map();
      this.generateSpline();
    }

    // Deterministic district seed derivation and SimplexNoise cache

    getDistrictSimplex(districtIndex) {
      if (districtIndex <= 1) return this.simplex;
      if (!this.districtSimplexMap.has(districtIndex)) {
        const seedStr = typeof this.seed === 'string' ? this.seed : String(this.seed);
        const distSeed = `${seedStr}_dist_${districtIndex}`;
        this.districtSimplexMap.set(districtIndex, new SimplexNoise(new PRNG(distSeed)));
      }
      return this.districtSimplexMap.get(districtIndex);
    }

    // Core 4-Octave FBM + Domain Warping for a specific Simplex instance

    evalRawTerrainNoise(simplexInstance, x, z) {
      const warpX = simplexInstance.noise2D(x * 0.0015, z * 0.0015) * 45.0;
      const warpZ = simplexInstance.noise2D(z * 0.0015, x * 0.0015) * 45.0;
      const wx = x + warpX;
      const wz = z + warpZ;

      let h = 0;
      h += simplexInstance.noise2D(wx * 0.002, wz * 0.002) * 38.0;
      h += simplexInstance.noise2D(wx * 0.006, wz * 0.006) * 16.0;
      h += simplexInstance.noise2D(wx * 0.018, wz * 0.018) * 5.5;
      h += simplexInstance.noise2D(wx * 0.045, wz * 0.045) * 1.5;
      h *= 0.3;
      return h;
    }

    // 1. C1 Continuous Blended Terrain Evaluator across Districts (4 km intervals with 1 km Hermite blend)

    getRawTerrainHeight(x, z) {
      const DISTRICT_SPAN = 4000.0;
      const BLEND_SPAN = 1000.0;

      // Longitudinal corridor distance along +Z
      const coord = Math.max(0, z);
      const districtFloat = coord / DISTRICT_SPAN;
      const baseDistrict = Math.floor(districtFloat) + 1;
      const distBoundary = baseDistrict * DISTRICT_SPAN;
      const blendStart = distBoundary - (BLEND_SPAN * 0.5); // e.g. 3500m, 7500m
      const blendEnd = distBoundary + (BLEND_SPAN * 0.5);   // e.g. 4500m, 8500m

      if (coord <= blendStart) {
        // Pure current district
        const sx = this.getDistrictSimplex(baseDistrict);
        return this.evalRawTerrainNoise(sx, x, z);
      } else if (coord >= blendEnd) {
        // Pure next district
        const sx = this.getDistrictSimplex(baseDistrict + 1);
        return this.evalRawTerrainNoise(sx, x, z);
      } else {
        // C1 Continuous Hermite blend between baseDistrict and baseDistrict + 1
        const tLinear = (coord - blendStart) / BLEND_SPAN;
        const t = THREE.MathUtils.smoothstep(tLinear, 0.0, 1.0);
        const sA = this.getDistrictSimplex(baseDistrict);
        const sB = this.getDistrictSimplex(baseDistrict + 1);
        const hA = this.evalRawTerrainNoise(sA, x, z);
        const hB = this.evalRawTerrainNoise(sB, x, z);
        return THREE.MathUtils.lerp(hA, hB, t);
      }
    }

    // Dynamic District Biome Palette Evaluator (interpolating colors along corridor)

    getDistrictPalette(z, defaultSeason) {
      const defSeason = defaultSeason || (CONFIG.SEASONS && CONFIG.SEASONS[this.seasonKey]) || (CONFIG.SEASONS && CONFIG.SEASONS.autumn) || { grassColor: 0x276638, grassLight: 0x3a874d, cliffColor: 0x8a7458 };
      if (defSeason.id === 'winter' || this.seasonKey === 'winter') {
        const baseGrass = new THREE.Color(defSeason.grassColor);
        const baseLight = new THREE.Color(defSeason.grassLight);
        const baseCliff = new THREE.Color(defSeason.cliffColor);
        const baseSoil = new THREE.Color(defSeason.grassLight).lerp(new THREE.Color(0x2a2824), 0.20);
        return {
          grassColor: baseGrass,
          grassLight: baseLight,
          cliffColor: baseCliff,
          shoulderSoil: baseSoil,
          treeLeaves: defSeason.treeLeaves || [0x4a6b58],
          rockColor: defSeason.snowRockColor || 0xbec4cc,
          treeDensity: 0.75,
          districtName: 'Northern Frost & Evergreen'
        };
      }

      const DISTRICT_SPAN = 4000.0;
      const BLEND_SPAN = 1000.0;
      const coord = Math.max(0, z);
      const districtFloat = coord / DISTRICT_SPAN;
      const baseDistIdx = Math.floor(districtFloat);
      const biomes = CONFIG.DISTRICT_BIOMES || [];
      const biomeA = biomes[baseDistIdx % biomes.length] || defSeason;
      const biomeB = biomes[(baseDistIdx + 1) % biomes.length] || defSeason;

      const distBoundary = (baseDistIdx + 1) * DISTRICT_SPAN;
      const blendStart = distBoundary - (BLEND_SPAN * 0.5);

      let t = 0;
      if (coord > blendStart) {
        const tLinear = Math.min(1.0, (coord - blendStart) / BLEND_SPAN);
        t = THREE.MathUtils.smoothstep(tLinear, 0.0, 1.0);
      }

      const colA_grass = new THREE.Color(biomeA.grassColor || defaultSeason.grassColor);
      const colB_grass = new THREE.Color(biomeB.grassColor || defaultSeason.grassColor);
      const colA_light = new THREE.Color(biomeA.grassLight || defaultSeason.grassLight);
      const colB_light = new THREE.Color(biomeB.grassLight || defaultSeason.grassLight);
      const colA_cliff = new THREE.Color(biomeA.cliffColor || defaultSeason.cliffColor);
      const colB_cliff = new THREE.Color(biomeB.cliffColor || defaultSeason.cliffColor);
      const colA_soil = new THREE.Color(biomeA.shoulderSoil || biomeA.grassLight).lerp(new THREE.Color(0x2a2824), 0.35);
      const colB_soil = new THREE.Color(biomeB.shoulderSoil || biomeB.grassLight).lerp(new THREE.Color(0x2a2824), 0.35);

      return {
        grassColor: colA_grass.clone().lerp(colB_grass, t),
        grassLight: colA_light.clone().lerp(colB_light, t),
        cliffColor: colA_cliff.clone().lerp(colB_cliff, t),
        shoulderSoil: colA_soil.clone().lerp(colB_soil, t),
        treeLeaves: (t < 0.5 ? biomeA.treeLeaves : biomeB.treeLeaves) || defaultSeason.treeLeaves,
        rockColor: new THREE.Color(biomeA.rockColor || 0x6b5c48).lerp(new THREE.Color(biomeB.rockColor || 0x6b5c48), t).getHex(),
        treeDensity: THREE.MathUtils.lerp(biomeA.treeDensity || 0.75, biomeB.treeDensity || 0.75, t),
        districtName: (t < 0.5 ? biomeA.name : biomeB.name) || 'Nilambari Corridor'
      };
    }

    // 2D terrain gradient and contour vector calculation for scenic hillside routing

    getTerrainGradient(x, z, delta = 5.0) {
      const hR = this.getRawTerrainHeight(x + delta, z);
      const hL = this.getRawTerrainHeight(x - delta, z);
      const hD = this.getRawTerrainHeight(x, z + delta);
      const hU = this.getRawTerrainHeight(x, z - delta);
      const gx = (hR - hL) / (2 * delta);
      const gz = (hD - hU) / (2 * delta);
      const len = Math.hypot(gx, gz);
      return { gx, gz, len };
    }

    // Shared ground-height formula (road surface / shoulder / embankment
    // blend to raw hillside), used both for prop placement during world
    // gen (calcTerrainY closure below mirrors this) and for repositioning
    // dynamic actors like road crossers every frame. `pt` is the road
    // curve point this offset is measured from; `worldPos` is the actual
    // x/z being evaluated (pt + normal*latDist); `latDist` is the signed
    // lateral offset from the road centerline.

    groundHeightAt(pt, worldPos, latDist) {
      const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
      const SHOULDER_TRANSITION = 9.0;
      const EMBANKMENT_BLEND = 45.0;
      const absDist = Math.abs(latDist);
      if (absDist <= roadHalf) {
        return pt.y - 0.18;
      } else if (absDist <= SHOULDER_TRANSITION) {
        // Flattened verge: a level shelf at the road-edge height (following the
        // road's banking, so it never rises above the low inner edge of a bend)
        // out past the sidewalk, then a smooth ease down to the same pt.y - 0.5
        // the embankment branch below starts from (continuous at 9 m). Was a
        // straight 0.3 m drop under the slab edge plus a further slope, which
        // read as a steep rolled-off "bank" along every road edge.
        const bank = this._bankingNear(pt);
        const edgeY = pt.y + 0.12 + Math.sign(latDist) * roadHalf * Math.sin(bank) - 0.03;
        const shelfEnd = roadHalf + (CONFIG.SIDEWALK ? CONFIG.SIDEWALK.width : 1.7) + 0.3;
        if (absDist <= shelfEnd) return edgeY;
        return THREE.MathUtils.lerp(edgeY, pt.y - 0.5, THREE.MathUtils.smoothstep(absDist, shelfEnd, SHOULDER_TRANSITION));
      } else if (absDist <= EMBANKMENT_BLEND) {
        const rawH = this.getRawTerrainHeight(worldPos.x, worldPos.z);
        const blendFactor = THREE.MathUtils.smoothstep(absDist, SHOULDER_TRANSITION, EMBANKMENT_BLEND);
        const shoulderDrop = pt.y - 0.5;
        return THREE.MathUtils.lerp(shoulderDrop, rawH, blendFactor);
      } else {
        // Was `rawH - 0.3` — a hard step discontinuity right at the
        // EMBANKMENT_BLEND boundary (0.3 units), since the branch just
        // inside returns `rawH` with blendFactor=1. Any object whose
        // lateral distance oscillates around 45m (e.g. the on-foot walker,
        // whose Y snaps straight to this value every frame with no lerp)
        // visibly jumps/snaps at that seam. Fade the -0.3 lip in over a
        // few meters past the boundary instead of applying it immediately.
        const FAR_BLEND = 3.0;
        const rawH = this.getRawTerrainHeight(worldPos.x, worldPos.z);
        const farT = THREE.MathUtils.smoothstep(absDist, EMBANKMENT_BLEND, EMBANKMENT_BLEND + FAR_BLEND);
        return rawH - 0.3 * farT;
      }
    }

    // Highest the terrain may sit near a road sample: that segment's banked
    // edge height (lateral offset clamped to the road edge), minus a margin.
    // Was a flat nearest.y - 0.22 that ignored banking, which crushed the
    // flattened verge shelf on the high (outer) side of every bend.

    roadClearanceLimit(worldPos, near) {
      const pts = this.roadSpacedPoints, b = this.roadBankingAngles;
      if (!pts || pts.length < 3 || near.index == null) return near.y - 0.22;
      const i = Math.min(near.index, pts.length - 2);
      const tx = pts[i + 1].x - pts[i].x, tz = pts[i + 1].z - pts[i].z;
      const tl = Math.hypot(tx, tz) || 1;
      const lat = (worldPos.x - near.point.x) * (-tz / tl) + (worldPos.z - near.point.z) * (tx / tl);
      const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
      const bank = (b && b[near.index] !== undefined) ? b[near.index] : 0;
      return near.y + 0.12 + THREE.MathUtils.clamp(lat, -roadHalf, roadHalf) * Math.sin(bank) - 0.05;
    }

    // Banking angle at the road sample nearest `pt` (0 until the road exists).

    _bankingNear(pt) {
      const b = this.roadBankingAngles;
      if (!b || !this.roadSpatialGrid || !this.roadSpatialGrid.points || !this.roadSpatialGrid.points.length) return 0;
      const near = this.roadSpatialGrid.getNearestRoadPoint(pt.x, pt.z, 12.0);
      if (!near) return 0;
      const v = b[near.index];
      return (v === undefined) ? (b[near.index - 1] || 0) : v;
    }


    surfaceHeightNear(pos, fallbackPt, fallbackLat) {
      const pts = this.roadSpacedPoints;
      const near = (this.roadSpatialGrid && pts && pts.length > 2)
        ? this.roadSpatialGrid.getNearestRoadPoint(pos.x, pos.z, 40.0)
        : null;
      if (!near) return this.groundHeightAt(fallbackPt, pos, fallbackLat);
      const i = Math.min(near.index, pts.length - 2);
      const tx = pts[i + 1].x - pts[i].x, tz = pts[i + 1].z - pts[i].z;
      const tl = Math.hypot(tx, tz) || 1;
      // normal = tangent x up, matching VehicleController.projectToRoad
      const nx = -tz / tl, nz = tx / tl;
      const lat = (pos.x - near.point.x) * nx + (pos.z - near.point.z) * nz;
      const roadPt = this._surfaceScratchPt || (this._surfaceScratchPt = new THREE.Vector3());
      roadPt.set(near.point.x, near.point.y, near.point.z);
      return this.getRoadSurfaceHeight(roadPt, pos, lat, near.index / (pts.length - 1));
    }

    // Exact Road Surface Height (includes road slab +0.12 and true 3D banking)

    getRoadSurfaceHeight(pt, worldPos, latDist, u = 0) {
      const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
      const absDist = Math.abs(latDist);

      let bankingAngle = 0;
      if (this.roadBankingAngles && this.roadSpacedPoints && this.roadSpacedPoints.length > 2) {
        const segs = this.roadSpacedPoints.length - 1;
        const rawIdx = THREE.MathUtils.clamp(u * segs, 0, segs - 1);
        const i0 = Math.floor(rawIdx), i1 = Math.min(i0 + 1, segs - 1);
        const frac = rawIdx - i0;
        bankingAngle = THREE.MathUtils.lerp(this.roadBankingAngles[i0] || 0, this.roadBankingAngles[i1] || 0, frac);
      }

      if (absDist <= roadHalf) {
        return pt.y + 0.12 + latDist * Math.sin(bankingAngle);
      } else {
        // Off the carriageway, match what's RENDERED: the road mesh's verge skirt
        // slopes linearly from the (banked) road edge down to the unbanked
        // terrain over ~1.6 m, and past that the terrain is exactly
        // groundHeightAt. The previous shoulder formula added banking the
        // rendered terrain doesn't have (Rule #1 removed it from the terrain),
        // floating things by up to ~0.35 m on the outside of bends and sinking
        // them on the inside; measured against raycasts on a 5.7-degree bend.
        const groundY = this.groundHeightAt(pt, worldPos, latDist);
        const past = absDist - roadHalf;
        if (CONFIG.SIDEWALK && CONFIG.SIDEWALK.enabled && past <= CONFIG.SIDEWALK.width && !this._inTunnelAtU(u, 2)) {
          return pt.y + 0.12 + Math.sign(latDist) * roadHalf * Math.sin(bankingAngle) + CONFIG.SIDEWALK.kerb;
        }
        const SKIRT = 1.6;
        if (past < SKIRT) {
          const edgeY = pt.y + 0.12 + Math.sign(latDist) * roadHalf * Math.sin(bankingAngle);
          return THREE.MathUtils.lerp(edgeY, groundY, past / SKIRT);
        }
        return groundY;
      }
    }


    generateSpline() {
      this.splineNodes = [];
      const nodeCount = CONFIG.ROAD_POINTS_COUNT; // 500 nodes
      const stepDist = 12.0; // Slow Roads 12m Sweeping Guide Steps

      let curX = 0;
      let curZ = 0;
      let curAngle = 0;
      let curY = this.getRawTerrainHeight(0, 0) + 0.8;

      const angleHistory = [];
      const repulsors = [];

      // City tuning parameters for regional topography (Slow Roads silky curves)
      let windingWeight = 0.40;
      const maxGrade = 0.045; // Strict 4.5% max highway grade (eliminates sudden steep hills & bumpy crests)

      if (this.cityKey === 'pune') {
        windingWeight = 0.55;
      } else if (this.cityKey === 'mumbai') {
        windingWeight = 0.45;
      } else if (this.cityKey === 'delhi') {
        windingWeight = 0.28;
      } else if (this.cityKey === 'kolkata') {
        windingWeight = 0.35;
      } else { // bangalore
        windingWeight = 0.48;
      }

      // Broadened sweeping turn candidate deltas (allows agile avoidance of bluffs)
      const candidateDeltas = [-0.32, -0.22, -0.14, -0.07, 0.0, 0.07, 0.14, 0.22, 0.32];

      for (let i = 0; i < nodeCount; i++) {
        this.splineNodes.push(new THREE.Vector3(curX, curY, curZ));
        angleHistory.push(curAngle);
        if (i % 8 === 0) {
          repulsors.push(new THREE.Vector2(curX, curZ));
        }

        // Long-term macro corridor bias (drifting gently forward while weaving)
        const macroNoise = this.simplex.noise2D(curX * 0.0004, curZ * 0.0004) * 1.5;
        const targetBias = macroNoise * windingWeight;

        // 2D terrain gradient and contour alignment for scenic hillside routing
        const grad = this.getTerrainGradient(curX, curZ, 5.0);
        let contourX = 0, contourZ = 0;
        let hasHillside = false;
        if (grad.len > 0.035) {
          hasHillside = true;
          // Unit contour vector perpendicular to gradient: (-gz, gx)
          const c1x = -grad.gz / grad.len;
          const c1z = grad.gx / grad.len;
          // Choose forward-facing contour vector
          const dot1 = c1x * Math.sin(curAngle) + c1z * Math.cos(curAngle);
          if (dot1 >= 0) {
            contourX = c1x; contourZ = c1z;
          } else {
            contourX = -c1x; contourZ = -c1z;
          }
        }

        let bestAngle = curAngle;
        let bestScore = Infinity;
        let bestCandidateY = curY;

        for (let k = 0; k < candidateDeltas.length; k++) {
          const delta = candidateDeltas[k];
          const candAngle = curAngle + delta;

          // 1. Tiered Angular Checks (Prevents hairpin self-intersections)
          let angleViolated = false;
          if (angleHistory.length >= 5) {
            const sumTurn5 = Math.abs(candAngle - angleHistory[angleHistory.length - 5]);
            if (sumTurn5 > 1.20) angleViolated = true;
          }
          if (angleHistory.length >= 15) {
            const sumTurn15 = Math.abs(candAngle - angleHistory[angleHistory.length - 15]);
            if (sumTurn15 > 2.40) angleViolated = true;
          }
          if (angleHistory.length >= 30) {
            const sumTurn30 = Math.abs(candAngle - angleHistory[angleHistory.length - 30]);
            if (sumTurn30 > 3.20) angleViolated = true;
          }

          if (angleViolated) continue;

          const dirX = Math.sin(candAngle);
          const dirZ = Math.cos(candAngle);

          // 2. Multi-Step Lookahead Terrain Cut Avoidance
          // Proactively detect rising hills up to 120m ahead before getting trapped
          let cutPenalty = 0;
          const lookaheadDists = [20.0, 45.0, 80.0, 120.0];
          const lookaheadWeights = [18.0, 12.0, 7.0, 4.0];

          for (let ld = 0; ld < lookaheadDists.length; ld++) {
            const dist = lookaheadDists[ld];
            const lx = curX + dirX * dist;
            const lz = curZ + dirZ * dist;
            const lh = this.getRawTerrainHeight(lx, lz);
            const allowedMaxH = curY + maxGrade * dist + 0.5;
            if (lh > allowedMaxH) {
              const excess = lh - allowedMaxH;
              cutPenalty += (excess * excess) * lookaheadWeights[ld];
            }
          }

          // 3. Hillside Contour Alignment ("Hillside Drive" feel)
          // When terrain slopes, reward steering along constant-elevation contours
          let contourBonus = 0;
          if (hasHillside) {
            const contourAlign = dirX * contourX + dirZ * contourZ;
            const slopeWeight = Math.min(1.0, grad.len / 0.20);
            contourBonus = -contourAlign * slopeWeight * 18.0;
          }

          // 4. Candidate Position & Longitudinal Slope Grade
          const candX = curX + dirX * stepDist;
          const candZ = curZ + dirZ * stepDist;
          const rawTerrainY = this.getRawTerrainHeight(candX, candZ);
          let candY = (rawTerrainY > curY) ? (rawTerrainY + 0.6) : THREE.MathUtils.lerp(curY, rawTerrainY + 0.6, 0.35);

          // 5. Repulsor Distance Force (Anti-looping)
          let repulsorForce = 0;
          for (let r = 0; r < repulsors.length; r++) {
            const d = repulsors[r].distanceTo(new THREE.Vector2(candX, candZ));
            if (d < 60.0) {
              repulsorForce += (60.0 - d) * 3.5;
            }
          }

          // 6. Multi-Factor Cost Scoring
          const angleCost = Math.abs(candAngle - curAngle - targetBias * 0.15) * 3.5;
          const fillPenalty = Math.max(0, (curY - 1.0) - rawTerrainY) * 2.0;
          const score = angleCost + repulsorForce + cutPenalty + contourBonus + fillPenalty;

          if (score < bestScore) {
            bestScore = score;
            bestAngle = candAngle;
            bestCandidateY = candY;
          }
        }

        curAngle = THREE.MathUtils.lerp(curAngle, bestAngle, 0.38);
        // Strict highway grade clamp
        const yDelta = Math.max(-maxGrade * stepDist, Math.min(maxGrade * stepDist, bestCandidateY - curY));
        curY += yDelta;
        curX += Math.sin(curAngle) * stepDist;
        curZ += Math.cos(curAngle) * stepDist;
      }

      // 3-Pass Rolling Gaussian Smoothing across all spline nodes (Slow Roads signature silky smooth road profile)
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 1; i < this.splineNodes.length - 1; i++) {
          const prev = this.splineNodes[i - 1];
          const cur = this.splineNodes[i];
          const next = this.splineNodes[i + 1];
          cur.x = prev.x * 0.20 + cur.x * 0.60 + next.x * 0.20;
          cur.y = prev.y * 0.20 + cur.y * 0.60 + next.y * 0.20;
          cur.z = prev.z * 0.20 + cur.z * 0.60 + next.z * 0.20;
        }
      }

      this.angleHistory = angleHistory;
      this.repulsors = repulsors;
      this.lastScoutAngle = curAngle;
      this.curve = new THREE.CatmullRomCurve3(this.splineNodes, false, 'centripetal');
      this.computeTunnelZones();

      // Bounding box of the actual road extent
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const n of this.splineNodes) {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.z < minZ) minZ = n.z;
        if (n.z > maxZ) maxZ = n.z;
      }
      this.worldBounds = { minX, maxX, minZ, maxZ };
    }

    // Incremental Forward Highway Spline Scout (Infinite Highway Streaming)

    extendSpline(count = 50) {
      const stepDist = 12.0;
      let windingWeight = 0.40;
      const maxGrade = 0.045; // Strict 4.5% max grade

      if (this.cityKey === 'pune') {
        windingWeight = 0.55;
      } else if (this.cityKey === 'mumbai') {
        windingWeight = 0.45;
      } else if (this.cityKey === 'delhi') {
        windingWeight = 0.28;
      } else if (this.cityKey === 'kolkata') {
        windingWeight = 0.35;
      } else { // bangalore
        windingWeight = 0.48;
      }

      // Broadened sweeping turn candidate deltas (allows agile avoidance of bluffs)
      const candidateDeltas = [-0.32, -0.22, -0.14, -0.07, 0.0, 0.07, 0.14, 0.22, 0.32];
      let lastNode = this.splineNodes[this.splineNodes.length - 1];
      let curX = lastNode.x, curY = lastNode.y, curZ = lastNode.z;
      let curAngle = this.lastScoutAngle || 0;
      const startIndex = this.splineNodes.length;

      for (let i = 0; i < count; i++) {
        const macroNoise = this.simplex.noise2D(curX * 0.0004, curZ * 0.0004) * 1.5;
        const targetBias = macroNoise * windingWeight;

        // 2D terrain gradient and contour alignment for scenic hillside routing
        const grad = this.getTerrainGradient(curX, curZ, 5.0);
        let contourX = 0, contourZ = 0;
        let hasHillside = false;
        if (grad.len > 0.035) {
          hasHillside = true;
          const c1x = -grad.gz / grad.len;
          const c1z = grad.gx / grad.len;
          const dot1 = c1x * Math.sin(curAngle) + c1z * Math.cos(curAngle);
          if (dot1 >= 0) {
            contourX = c1x; contourZ = c1z;
          } else {
            contourX = -c1x; contourZ = -c1z;
          }
        }

        let bestAngle = curAngle;
        let bestScore = Infinity;
        let bestCandidateY = curY;

        for (let k = 0; k < candidateDeltas.length; k++) {
          const delta = candidateDeltas[k];
          const candAngle = curAngle + delta;

          let angleViolated = false;
          if (this.angleHistory && this.angleHistory.length >= 5) {
            const sumTurn5 = Math.abs(candAngle - this.angleHistory[this.angleHistory.length - 5]);
            if (sumTurn5 > 1.20) angleViolated = true;
          }
          if (this.angleHistory && this.angleHistory.length >= 15) {
            const sumTurn15 = Math.abs(candAngle - this.angleHistory[this.angleHistory.length - 15]);
            if (sumTurn15 > 2.40) angleViolated = true;
          }
          if (this.angleHistory && this.angleHistory.length >= 30) {
            const sumTurn30 = Math.abs(candAngle - this.angleHistory[this.angleHistory.length - 30]);
            if (sumTurn30 > 3.20) angleViolated = true;
          }

          if (angleViolated) continue;

          const dirX = Math.sin(candAngle);
          const dirZ = Math.cos(candAngle);

          // Multi-Step Lookahead Terrain Cut Avoidance
          // Proactively detect rising hills up to 120m ahead before getting trapped
          let cutPenalty = 0;
          const lookaheadDists = [20.0, 45.0, 80.0, 120.0];
          const lookaheadWeights = [18.0, 12.0, 7.0, 4.0];

          for (let ld = 0; ld < lookaheadDists.length; ld++) {
            const dist = lookaheadDists[ld];
            const lx = curX + dirX * dist;
            const lz = curZ + dirZ * dist;
            const lh = this.getRawTerrainHeight(lx, lz);
            const allowedMaxH = curY + maxGrade * dist + 0.5;
            if (lh > allowedMaxH) {
              const excess = lh - allowedMaxH;
              cutPenalty += (excess * excess) * lookaheadWeights[ld];
            }
          }

          // Hillside Contour Alignment ("Hillside Drive" feel)
          let contourBonus = 0;
          if (hasHillside) {
            const contourAlign = dirX * contourX + dirZ * contourZ;
            const slopeWeight = Math.min(1.0, grad.len / 0.20);
            contourBonus = -contourAlign * slopeWeight * 18.0;
          }

          const candX = curX + dirX * stepDist;
          const candZ = curZ + dirZ * stepDist;

          const rawTerrainY = this.getRawTerrainHeight(candX, candZ);
          let candY = (rawTerrainY > curY) ? (rawTerrainY + 0.6) : THREE.MathUtils.lerp(curY, rawTerrainY + 0.6, 0.35);

          let repulsorForce = 0;
          if (this.repulsors) {
            for (let r = Math.max(0, this.repulsors.length - 30); r < this.repulsors.length; r++) {
              const d = this.repulsors[r].distanceTo(new THREE.Vector2(candX, candZ));
              if (d < 60.0) {
                repulsorForce += (60.0 - d) * 3.5;
              }
            }
          }

          const angleCost = Math.abs(candAngle - curAngle - targetBias * 0.15) * 3.5;
          const fillPenalty = Math.max(0, (curY - 1.0) - rawTerrainY) * 2.0;
          const score = angleCost + repulsorForce + cutPenalty + contourBonus + fillPenalty;

          if (score < bestScore) {
            bestScore = score;
            bestAngle = candAngle;
            bestCandidateY = candY;
          }
        }

        curAngle = THREE.MathUtils.lerp(curAngle, bestAngle, 0.38);
        const yDelta = Math.max(-maxGrade * stepDist, Math.min(maxGrade * stepDist, bestCandidateY - curY));
        curY += yDelta;
        curX += Math.sin(curAngle) * stepDist;
        curZ += Math.cos(curAngle) * stepDist;

        this.splineNodes.push(new THREE.Vector3(curX, curY, curZ));
        this.angleHistory.push(curAngle);
        if (this.splineNodes.length % 8 === 0) {
          this.repulsors.push(new THREE.Vector2(curX, curZ));
        }
      }

      // Smooth the newly appended nodes seamlessly with the existing spline
      for (let pass = 0; pass < 3; pass++) {
        for (let i = Math.max(1, startIndex - 2); i < this.splineNodes.length - 1; i++) {
          const prev = this.splineNodes[i - 1];
          const cur = this.splineNodes[i];
          const next = this.splineNodes[i + 1];
          cur.x = prev.x * 0.20 + cur.x * 0.60 + next.x * 0.20;
          cur.y = prev.y * 0.20 + cur.y * 0.60 + next.y * 0.20;
          cur.z = prev.z * 0.20 + cur.z * 0.60 + next.z * 0.20;
        }
      }

      this.lastScoutAngle = curAngle;
      this.curve = new THREE.CatmullRomCurve3(this.splineNodes, false, 'centripetal');
    }


    getLateralClamp(splineProgress, side) {
      const TOTAL_POINTS = 800; // matches createFoliageAndProps' getSpacedPoints(800)
      const i = Math.round(splineProgress * TOTAL_POINTS);
      const avgSegStep = (this.curve ? this.curve.getLength() : 5000) / TOTAL_POINTS;

      // Inside tunnel bore, widen lateral clamp to the tunnel walls (5.0m)
      const meshIdx = Math.round(splineProgress * CONFIG.ROAD_MESH_SEGMENTS);
      if (this.isInTunnelZone && this.isInTunnelZone(meshIdx, 2)) {
        const tunnelHalf = CONFIG.TUNNEL_HALF_WIDTH || 6.2;
        return tunnelHalf - 1.05 - 0.15; // 5.00m clean glancing against concrete tunnel wall
      }

      const nearestHouseCheckpoint = Math.round(i / 24) * 24;
      const houseCheckpointSide = (nearestHouseCheckpoint % 48 === 0) ? 1 : -1;
      const distToHouse = Math.abs(i - nearestHouseCheckpoint) * avgSegStep;
      const FENCE_GAP_RADIUS = 18.0;
      const FENCE_LATERAL_DIST = this.getBarrierLateralDistance();
      const CAR_HALF_WIDTH = 1.05; // accounts for 1.9m chassis width + side mirrors
      const BARRIER_MARGIN = 0.15; // clearance buffer so car panels/mirrors glance along fence without penetrating posts
      // With sidewalks the kerb is the edge of the drivable road (vehicles stay
      // off the footpath, where pedestrians walk); otherwise the fence line.
      const baseClamp = (CONFIG.SIDEWALK && CONFIG.SIDEWALK.enabled)
        ? CONFIG.ROAD_WIDTH * 0.52 - CAR_HALF_WIDTH - 0.1   // 2.70m (bicycles get +0.65 in the vehicle)
        : FENCE_LATERAL_DIST - CAR_HALF_WIDTH - BARRIER_MARGIN; // 4.70m from centerline

      // Smooth hermite taper at delivery house openings — eliminates abrupt 3.3m teleport/collision step
      const isOpenRoad = !!(CONFIG.CITIES[this.cityKey]?.openRoad);
      if (!isOpenRoad && side === houseCheckpointSide && distToHouse < FENCE_GAP_RADIUS) {
        const t = Math.max(0, Math.min(1, 1 - distToHouse / FENCE_GAP_RADIUS));
        const smoothT = t * t * (3 - 2 * t);
        return THREE.MathUtils.lerp(baseClamp, 8.0, smoothT);
      }
      return baseClamp;
    }

    // Appearance presets for rigged pedestrians.
    //
    // Built ONCE and shared: every NPC assigned a given variant points at the
    // same five materials. The previous code cloned all five per instance, so
    // 114 pedestrians meant 570 material objects and 570 uniform sets with no
    // sort batching. Cloning from the template preserves each material's type,
    // defines and maps, so Three.js reuses the compiled shader program and the
    // mobile WebView never takes a recompile stall mid-drive.
    //
    // Bodymat also covers the eyes (they share its atlas region), which is why
    // skin tints stay close to white — they multiply the diffuse map rather
    // than replacing it, so fabric weave, hair strands and face detail survive.

    addFenceGap(pt, normal, side, halfLen) {
      this.fenceGapSites = this.fenceGapSites || [];
      const fenceLat = this.getBarrierLateralDistance();
      const sides = side === 0 ? [-1, 1] : [side];
      sides.forEach((sd) => {
        const c = pt.clone().addScaledVector(normal, sd * fenceLat);
        this.fenceGapSites.push({ pos: c, r: halfLen });
        if (this._streamFenceMeshes) {
          this._streamFenceMeshes = this._streamFenceMeshes.filter((f) => {
            if (f.pos.distanceTo(c) < halfLen + 3.0) {
              f.meshes.forEach((m) => { if (m.parent) m.parent.remove(m); });
              return false;
            }
            return true;
          });
        }
      });
    }


    isFenceGap(pos) {
      return !!(this.fenceGapSites && this.fenceGapSites.some((g) => g.pos.distanceTo(pos) < g.r + 3.0));
    }

    // ---- Shared street-furniture spawners (initial build AND streamed chunks) ----
    // Lateral placement: lamps, curve signs and milestones stand on the sidewalk
    // (clear of the guardrail at getBarrierLateralDistance()); electric poles
    // stand just behind the guardrail.
  }

  S.ProceduralWorld = ProceduralWorld;
})();
