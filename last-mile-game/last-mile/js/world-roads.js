(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    CONFIG, PRNG, LANE_PAINT, addChunkedInstances, RoadSpatialGrid,
    GroundDetail, RealTextureFactory
  } = S;

  Object.assign(S.ProceduralWorld.prototype, {
    createRoadMesh() {
      const tubularSegments = CONFIG.ROAD_MESH_SEGMENTS;
      const roadWidth = CONFIG.ROAD_WIDTH;
      const shoulderWidth = CONFIG.ROAD_SHOULDER_WIDTH;
      const geom = new THREE.BufferGeometry();

      const positions = [];
      const colors = [];
      const normals = [];
      const uvs = [];
      const indices = [];

      const points = this.curve.getSpacedPoints(tubularSegments);
      // Cached so VehicleController can compute banking from the EXACT
      // same points-array finite-difference this mesh uses, instead of
      // curve.getTangentAt() — a structurally different tangent estimate
      // (Catmull-Rom's own parametric derivative vs finite differences of
      // arc-length-spaced points) that silently diverges from what's
      // actually rendered, worst measured at a full clamp-width difference
      // (-0.14 vs the true -0.1137 rad) on a real curve. See
      // BUGFIX_LOG.md's vehicle-sinks-into-road entry (Pattern 2, 4th
      // occurrence).
      this.roadSpacedPoints = points;
      this.initialRoadSpacedPoints = points;
      if (this.roadSpatialGrid) {
        this.roadSpatialGrid.build(points);
      }
      // Per-point banking angle + frame vectors, cached alongside
      // roadSpacedPoints so createLaneMarkingMeshes() (built right after
      // this) computes its decal ribbons from the EXACT same values the
      // road surface itself used, not a second recomputation that can
      // silently diverge (see the points-array comment above — same
      // failure class).
      this.roadBankingAngles = new Array(tubularSegments + 1);
      this.roadNormals = new Array(tubularSegments + 1);
      this.roadBinormals = new Array(tubularSegments + 1);
      this.roadBankedUp = new Array(tubularSegments + 1);
      const tCfg = CONFIG.ROAD_SURFACE;
      const seasonCfg = CONFIG.SEASONS[this.seasonKey] || CONFIG.SEASONS.autumn;
      const baseTarmac = new THREE.Color(tCfg.color);
      // Soft organic transition: verge color blends base tarmac with the shoulder terrain ground tone
      const shoulderSoilColor = new THREE.Color(seasonCfg.grassLight).lerp(baseTarmac, 0.40);
      const vergeColor = shoulderSoilColor.clone();

      // Lane paint used to be baked into this ribbon's own vertex colors —
      // first as a single column (a bright line that was actually a smooth
      // color gradient bleeding across most of the lane, since Gouraud
      // interpolation spreads linearly across a whole triangle), then as
      // tightly-paired columns to narrow that bleed. Both attempts still
      // rode on THIS mesh's own vertex density (1200 segments over ~5km,
      // ~4.2m apart), so the painted line's apparent width and position
      // wobbled with however much the banking/curvature happened to shift
      // between one road vertex and the next — worse on sharper curves,
      // which is exactly the unevenness reported. Checked slowroads.io's
      // own shipped assets directly (network tab, live CDN): their lane
      // paint (road_paint_dashed.webp, road_paint_solid.webp, etc.) are
      // separate decal textures, not part of the base road material at
      // all. This ribbon goes back to a plain 7-point tarmac/verge cross
      // section with no paint baked in; createLaneMarkingMeshes() below
      // adds the actual lines as their own thin, independent ribbon
      // meshes with a fixed physical width that can't drift with the
      // base road's vertex spacing.
      const laneHalf = roadWidth * 0.5;
      const offsets = [
        -laneHalf - shoulderWidth, // 0: Left Verge Outer
        -laneHalf,                   // 1: Left Tarmac Edge
        -laneHalf * 0.46 / 0.5,      // 2: Left Lane Tarmac
        0.0,                        // 3: Center
        laneHalf * 0.46 / 0.5,       // 4: Right Lane Tarmac
        laneHalf,                    // 5: Right Tarmac Edge
        laneHalf + shoulderWidth    // 6: Right Verge Outer
      ];
      for (let i = 0; i <= tubularSegments; i++) {
        const pt = points[i];

        let tangent;
        if (i === 0) {
          tangent = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
        } else if (i === tubularSegments) {
          tangent = new THREE.Vector3().subVectors(points[tubularSegments], points[tubularSegments - 1]).normalize();
        } else {
          tangent = new THREE.Vector3().subVectors(points[i + 1], points[i - 1]).normalize();
        }

        const worldUp = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
        const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

        // Dynamic Curvature Banking Angle (true 3D signed horizontal curvature)
        let curvature = 0;
        if (i < tubularSegments) {
          const nextTang = (i < tubularSegments - 1)
            ? new THREE.Vector3().subVectors(points[i + 2], points[i]).normalize()
            : new THREE.Vector3().subVectors(points[tubularSegments], points[tubularSegments - 1]).normalize();
          // Signed horizontal curvature (independent of world compass direction/quadrant)
          curvature = tangent.x * nextTang.z - tangent.z * nextTang.x;
        }

        const bankingAngle = THREE.MathUtils.clamp(curvature * 2.2, -0.10, 0.10);
        const bankedNormal = normal.clone().multiplyScalar(Math.cos(bankingAngle)).addScaledVector(binormal, Math.sin(bankingAngle)).normalize();
        const bankedUp = binormal.clone().multiplyScalar(Math.cos(bankingAngle)).addScaledVector(normal, -Math.sin(bankingAngle)).normalize();
        this.roadBankingAngles[i] = bankingAngle;
        this.roadNormals[i] = normal.clone();
        this.roadBinormals[i] = binormal.clone();
        this.roadBankedUp[i] = bankedUp.clone();

        const curPalette = this.getDistrictPalette(pt.z, seasonCfg);
        const curVergeColor = curPalette.grassLight.clone().lerp(baseTarmac, 0.40);

        for (let j = 0; j < offsets.length; j++) {
          const off = offsets[j];
          const isVerge = (j === 0 || j === 6);
          // The verge is offset along the UNBANKED normal, matching how the
          // terrain ribbon offsets its own slices. Using bankedNormal here
          // put the road's outer edge on a slightly different 3D line than
          // the terrain's matching slice on every banked curve, so the two
          // edges crossed each other instead of meeting.
          const p = pt.clone().addScaledVector(isVerge ? normal : bankedNormal, off);
          if (isVerge) {
            // The ribbon's outer verge used to sit at a fixed pt.y + 0.04,
            // while the terrain at that same lateral distance is a shoulder
            // slope ending ~0.28 lower — so the whole road floated ~0.32u
            // above the ground along its entire length, showing a continuous
            // dark sliver of exposed terrain down both shoulders. Take the
            // height from the shared ground function instead (never a second
            // copy of the formula — see BUGFIX_LOG.md Recurring Pattern 1),
            // plus a 2cm lift so the road slab wins the depth test rather
            // than sitting coplanar with the terrain and z-fighting into a
            // ragged sawtooth edge. Banking is deliberately not applied to
            // this Y: the terrain is unbanked, so the edge must meet it at
            // unbanked height.
            p.y = this.groundHeightAt(pt, p, off) + CONFIG.ROAD_VERGE_LIFT;
          } else {
            p.addScaledVector(bankedUp, 0.12);
          }
          positions.push(p.x, p.y, p.z);
          normals.push(bankedUp.x, bankedUp.y, bankedUp.z);
          uvs.push(off * 0.5, i * 0.3);

          if (j === 0 || j === 6) {
            // Plain tarmac/verge only — paint is a separate decal mesh now
            // (see createLaneMarkingMeshes), not baked into this ribbon.
            colors.push(curVergeColor.r, curVergeColor.g, curVergeColor.b);
          } else {
            colors.push(baseTarmac.r, baseTarmac.g, baseTarmac.b);
          }
        }

        if (i < tubularSegments) {
          const cols = offsets.length;
          const row1 = i * cols;
          const row2 = (i + 1) * cols;
          for (let j = 0; j < cols - 1; j++) {
            indices.push(row1 + j, row1 + j + 1, row2 + j);
            indices.push(row1 + j + 1, row2 + j + 1, row2 + j);
          }
        }
      }

      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      // Cache the last row of road cross-section vertices so streaming extension meshes
      // can snap their row 0 to them vertex-for-vertex, eliminating cracks in the road.
      const cols = offsets.length;
      const lastRowBase = tubularSegments * cols * 3;
      this._lastRoadEdgeVerts = [];
      for (let j = 0; j < cols; j++) {
        this._lastRoadEdgeVerts.push({
          x: positions[lastRowBase + j * 3],
          y: positions[lastRowBase + j * 3 + 1],
          z: positions[lastRowBase + j * 3 + 2]
        });
      }

      // Real photo asphalt (ambientcg Asphalt033) replacing the procedural
      // canvas-noise texture — SLOWROADS_PARITY_LOG.md item 6. Lane paint is
      // no longer part of this vertexColors buffer — see
      // createLaneMarkingMeshes() for the decal ribbons that render it.
      //
      // normalMap deliberately NOT wired in here — confirmed by direct
      // test (removing it live fixed a fully solid-black road instantly):
      // this ribbon's UV layout is custom per-vertex generated
      // (`off*0.5, i*0.3`, not a standard 0-1 planar UV), and
      // MeshStandardMaterial's auto-computed screen-space tangent basis
      // goes unstable on it, corrupting the perturbed normal and zeroing
      // out the lighting entirely. Same risk applies to the terrain ribbon
      // below (same custom-UV pattern) — normalMap skipped there too.
      const roadTex = RealTextureFactory.roadColor();
      const roadMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: (tCfg.roughness !== undefined) ? tCfg.roughness : 0.85,
        metalness: (tCfg.metalness !== undefined) ? tCfg.metalness : 0.05,
        map: roadTex,
        normalMap: RealTextureFactory.roadNormal(),
        normalScale: new THREE.Vector2(0.4, 0.4),
        // Pull road surface in front of coplanar terrain at the edge.
        // Without this the two surfaces z-fight at curves and the terrain
        // bleeds through the asphalt shoulder.
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });

      this.roadTarmac = baseTarmac.clone();     // the zone road network reuses it for cross-road surfaces
      this.roadMesh = new THREE.Mesh(geom, roadMaterial);
      this.roadMesh.receiveShadow = true;
      return this.roadMesh;
    },


    createLaneMarkingMeshes() {
      if (!this.roadSpacedPoints || !this.roadBankingAngles) return new THREE.Group();
      const group = new THREE.Group();
      group.add(this._buildRoadWear(0, this.roadSpacedPoints.length - 1));
      group.add(this._buildLaneRibbons(0, this.roadSpacedPoints.length - 1));
      this.laneMarkingsGroup = group;
      return group;
    },

    // Centre dashes + both edge lines for road segments startSeg..endSeg.

    _buildLaneRibbons(startSeg, endSeg) {
      const roadHalf = CONFIG.ROAD_WIDTH * 0.5, P = LANE_PAINT;
      const g = new THREE.Group();
      g.add(this._buildLaneRibbon(startSeg, endSeg, 0, P.centreHalfW, P.centre, true));
      g.add(this._buildLaneRibbon(startSeg, endSeg, -roadHalf, P.edgeHalfW, P.edge, false));
      g.add(this._buildLaneRibbon(startSeg, endSeg, roadHalf, P.edgeHalfW, P.edge, false));
      return g;
    },

    // Distance along the road to sample i. getSpacedPoints is uniform in arc length and the
    // streamed extension resamples the WHOLE route, so derive it from the curve rather than
    // caching it: the dash phase then stays continuous across every extension seam.

    _laneCum(i) {
      return i * (this.curve.getLength() / (this.roadSpacedPoints.length - 1));
    },


    _buildLaneRibbon(startSeg, endSeg, lateral, halfW, colorHex, dashed) {
      const pts = this.roadSpacedPoints, ba = this.roadBankingAngles, nr = this.roadNormals, bn = this.roadBinormals, bu = this.roadBankedUp;
      const P = LANE_PAINT;
      // Same banked frame createRoadMesh uses; 0.12 is the road slab lift, 0.02 the paint clearance.
      const lift = 0.12 + 0.02;
      const positions = [], normalsOut = [], indices = [];
      const frame = (i) => {
        const angle = ba[i] || 0;
        const bankedNormal = nr[i].clone().multiplyScalar(Math.cos(angle)).addScaledVector(bn[i], Math.sin(angle)).normalize();
        return { pt: pts[i], bankedNormal, up: bu[i] };
      };
      const A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), U = new THREE.Vector3();
      const put = (fa, fb, t, off) => {
        A.lerpVectors(fa.pt, fb.pt, t);
        N.lerpVectors(fa.bankedNormal, fb.bankedNormal, t).normalize();
        U.lerpVectors(fa.up, fb.up, t).normalize();
        B.copy(A).addScaledVector(N, off).addScaledVector(U, lift);
        positions.push(B.x, B.y, B.z); normalsOut.push(U.x, U.y, U.z);
      };
      for (let i = startSeg; i < endSeg; i++) {
        const fa = frame(i), fb = frame(i + 1);
        const L = fa.pt.distanceTo(fb.pt);
        const s0 = dashed ? this._laneCum(i) : 0;
        // Dashed: ~1 m steps so dash edges land where the metres say. Solid: one quad per segment.
        const n = dashed ? Math.max(1, Math.round(L)) : 1;
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          if (dashed && ((s0 + (t0 + t1) * 0.5 * L) % P.dashPeriod) >= P.dashOn) continue;
          const base = positions.length / 3;
          put(fa, fb, t0, lateral - halfW); put(fa, fb, t0, lateral + halfW);
          put(fa, fb, t1, lateral - halfW); put(fa, fb, t1, lateral + halfW);
          indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normalsOut, 3));
      geom.setIndex(indices);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.renderOrder = 1;
      mesh.userData.lanePaint = dashed ? 'centre' : 'edge';
      return mesh;
    },

    // Asphalt wear overlay (B152): wheel tracks, oil strip, edge grit, repair patches and hairline
    // cracks from a 4-tile atlas (assets/textures/road_wear.webp, scratch/asset-options/atlas/
    // build_roadwear.py), laid as a transparent ribbon under the lane paint. Positioned by global
    // arc length in WEAR_STEP quads so it is identical across the streamed extension.
    // Kill switch for A/B: localStorage.shiplyp_roadWear = '0'.

    _buildRoadWear(startSeg, endSeg) {
      const group = new THREE.Group();
      group.name = 'RoadWear';
      try {
        try { if (localStorage.getItem('shiplyp_roadWear') === '0') return group; } catch (e) { /* default on */ }
        const pts = this.roadSpacedPoints, ba = this.roadBankingAngles, nr = this.roadNormals, bn = this.roadBinormals, bu = this.roadBankedUp;
        const segLen = this.curve.getLength() / (pts.length - 1);
        const STEP = 4.0, BLOCK = 32.0, PER_BLOCK = BLOCK / STEP;
        const half = CONFIG.ROAD_WIDTH * 0.5, lift = 0.12 + 0.012;
        const kA = Math.floor(startSeg * segLen / STEP), kB = Math.floor(endSeg * segLen / STEP);
        const hash = (a) => { let h = Math.imul(a | 0, 374761393) ^ 0x9e3779b1; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0); };
        const frameAt = (s) => {
          const f = THREE.MathUtils.clamp(s / segLen, 0, pts.length - 1.0001), i = Math.floor(f), t = f - i;
          const angA = ba[i] || 0, angB = ba[i + 1] || 0;
          const nA = nr[i].clone().multiplyScalar(Math.cos(angA)).addScaledVector(bn[i], Math.sin(angA));
          const nB = nr[i + 1].clone().multiplyScalar(Math.cos(angB)).addScaledVector(bn[i + 1], Math.sin(angB));
          return { p: new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], t), n: nA.lerp(nB, t).normalize(), u: new THREE.Vector3().lerpVectors(bu[i], bu[i + 1], t).normalize() };
        };
        const positions = [], normalsOut = [], uvs = [], indices = [];
        let prev = null, prevBlock = -1, prevU = null;
        for (let k = kA; k <= kB; k++) {
          const s = k * STEP, block = Math.floor(k / PER_BLOCK), within = k - block * PER_BLOCK;
          const hsh = hash(block), variant = hsh & 3, flip = (hsh >>> 2) & 1;
          const fr = frameAt(s);
          const vv = within / PER_BLOCK;
          const L = fr.p.clone().addScaledVector(fr.n, -half).addScaledVector(fr.u, lift), R = fr.p.clone().addScaledVector(fr.n, half).addScaledVector(fr.u, lift);
          const u0 = variant / 4 + 0.004, u1 = (variant + 1) / 4 - 0.004;
          const uL = flip ? u1 : u0, uR = flip ? u0 : u1;
          // block boundary: restart the strip so each block samples its own tile
          if (prev && block !== prevBlock) {
            // close the previous block at v = 1 using this step's frame
            const base = positions.length / 3;
            const pu0 = prevU.uL, pu1 = prevU.uR;
            positions.push(prev.L.x, prev.L.y, prev.L.z, prev.R.x, prev.R.y, prev.R.z, L.x, L.y, L.z, R.x, R.y, R.z);
            for (let q = 0; q < 4; q++) normalsOut.push(fr.u.x, fr.u.y, fr.u.z);
            uvs.push(pu0, prev.v, pu1, prev.v, pu0, 1, pu1, 1);
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
          }
          if (prev && block === prevBlock) {
            const base = positions.length / 3;
            positions.push(prev.L.x, prev.L.y, prev.L.z, prev.R.x, prev.R.y, prev.R.z, L.x, L.y, L.z, R.x, R.y, R.z);
            for (let q = 0; q < 4; q++) normalsOut.push(fr.u.x, fr.u.y, fr.u.z);
            uvs.push(uL, prev.v, uR, prev.v, uL, vv, uR, vv);
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
          }
          prev = { L, R, v: vv }; prevBlock = block; prevU = { uL, uR };
        }
        if (!positions.length) return group;
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute('normal', new THREE.Float32BufferAttribute(normalsOut, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.setIndex(indices);
        const tex = new THREE.TextureLoader().load('assets/textures/road_wear.webp');
        tex.anisotropy = 4;
        const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 0.5;
        mesh.frustumCulled = false;
        mesh.userData.roadWear = true;
        group.add(mesh);
      } catch (err) {
        console.error('_buildRoadWear failed:', err);
      }
      return group;
    },

    // Scans the finished curve at the SAME sampling rate createTerrainMesh
    // uses (CONFIG.ROAD_MESH_SEGMENTS) for stretches where raw hillside
    // terrain clears the road by more than TUNNEL_OVERHEAD_THRESHOLD — the
    // condition that produces the "terrain wall" bug. Those stretches get a
    // tunnel bored through them instead: this.tunnelZones is consumed both
    // by createTunnelMeshes() (builds the bore) and createTerrainMesh()
    // (flattens the corridor so the hillside doesn't poke back through the
    // tube walls). Indices are into curve.getSpacedPoints(tubularSegments),
    // so they line up 1:1 with createTerrainMesh's own `i` loop variable.

    computeTunnelZones() {
      const tubularSegments = CONFIG.ROAD_MESH_SEGMENTS;
      const points = this.curve.getSpacedPoints(tubularSegments);
      const up = new THREE.Vector3(0, 1, 0);
      // Only bore a tunnel when the mountain ridge is truly overhead ABOVE THE ROAD
      // corridor itself. Previously, probing at ±9m took the worst value, which
      // mistook normal hillside rock cuttings (where the uphill slope at +9m is
      // naturally high while the road and downhill side are open to the sky) for
      // an underground tunnel, falsely boring long tubes through open scenic roads.
      const overhead = points.map((pt, i) => {
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(tubularSegments, i + 1)];
        const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
        
        const hCenter = this.getRawTerrainHeight(pt.x, pt.z) - pt.y;
        const pLeft = pt.clone().addScaledVector(normal, -3.2);
        const pRight = pt.clone().addScaledVector(normal, 3.2);
        const hLeft = this.getRawTerrainHeight(pLeft.x, pLeft.z) - pt.y;
        const hRight = this.getRawTerrainHeight(pRight.x, pRight.z) - pt.y;

        // Deep ridge pass: centerline exceeds 22m overhead, or both travel lanes are buried > 18m
        const isTunnelBuried = (hCenter > CONFIG.TUNNEL_OVERHEAD_THRESHOLD) || 
                               (hLeft > 18.0 && hRight > 18.0 && hCenter > 14.0);
        return isTunnelBuried ? Math.max(hCenter, (hLeft + hRight) * 0.5) : 0.0;
      });

      const zones = [];
      let runStart = -1;
      for (let i = 0; i <= tubularSegments; i++) {
        const over = overhead[i] > 0.0;
        if (over && runStart === -1) {
          runStart = i;
        } else if (!over && runStart !== -1) {
          if (i - runStart >= CONFIG.TUNNEL_MIN_RUN) zones.push({ start: runStart, end: i - 1 });
          runStart = -1;
        }
      }
      if (runStart !== -1 && tubularSegments - runStart >= CONFIG.TUNNEL_MIN_RUN) {
        zones.push({ start: runStart, end: tubularSegments });
      }

      // Pad each zone with a portal buffer, then merge any that now overlap
      // so two nearby hills don't produce two tunnels with a sliver of open
      // road wedged between their portals.
      const pad = CONFIG.TUNNEL_PAD;
      const padded = zones.map(z => ({
        start: Math.max(0, z.start - pad),
        end: Math.min(tubularSegments, z.end + pad)
      }));
      const merged = [];
      for (const z of padded) {
        const prev = merged[merged.length - 1];
        if (prev && z.start <= prev.end) prev.end = Math.max(prev.end, z.end);
        else merged.push({ ...z });
      }

      this.tunnelZones = merged;
      this.tunnelPoints = points; // cached — same array createTunnelMeshes/createTerrainMesh index into
    },

    // Is longitudinal sample index `i` inside a tunnel zone (optionally
    // padded further, e.g. so the terrain carve fades out past the portal)?

    isInTunnelZone(i, extraPad = 0) {
      if (!this.tunnelZones) return false;
      return this.tunnelZones.some(z => i >= z.start - extraPad && i <= z.end + extraPad);
    },


    // True where the zone road network opens a cross road (WI-05); never true without ?net=1.
    _inJunctionAtU(u, pad = 1) {
      return !!(this.roadNet && this.roadNet.inBox(u * this.curve.getLength(), pad));
    },

    _inTunnelAtU(u, pad = 1) {
      if (!this.roadSpacedPoints || !this.isInTunnelZone) return false;
      return this.isInTunnelZone(Math.round(u * (this.roadSpacedPoints.length - 1)), pad);
    },

    // Lateral distance from the road centerline to the continuous roadside barrier.
    // When sidewalks are enabled, aligns flush with the outer edge of the raised
    // footpath (10 cm inset from the outer boundary so posts and barrier courses
    // sit firmly on top of the paver slab). Otherwise sits on the natural verge.

    createTerrainMesh(season) {
      // Must match createRoadMesh's segment count exactly — see
      // CONFIG.ROAD_MESH_SEGMENTS. At 800 vs the road's 1200 the two
      // ribbons sampled the curve at different positions, so they only
      // lined up where samples coincided and tore apart in between.
      const tubularSegments = CONFIG.ROAD_MESH_SEGMENTS;
      const roadHalf = CONFIG.ROAD_WIDTH * 0.52; // ~3.85m
      // Lateral distance of the road ribbon's outer edge. The terrain needs
      // a vertex row at exactly this distance so the road edge lands on a
      // real terrain vertex rather than somewhere across a wide triangle.
      const vergeLat = CONFIG.ROAD_WIDTH * 0.5 + CONFIG.ROAD_SHOULDER_WIDTH;
      // Embankment zone (9m out to EMBANKMENT_BLEND=45m in groundHeightAt)
      // used to have only two slices out there — 20 and 40 — a 20m gap the
      // mesh bridges with a straight line. This terrain isn't just gentle
      // noise: groundHeightAt/createTerrainMesh both give raw hillside
      // height its own "cliff" color band once it exceeds 22 units, i.e.
      // the game already expects genuinely steep faces out here, and a
      // handful of sparse slices can never approximate a cliff with a
      // straight line no matter how they're spaced. Densified to roughly
      // every 3-4m, which is what actually closes the gap — props and the
      // on-foot walker are placed via groundHeightAt() (the true nonlinear
      // surface), so the rendered mesh has to track it this closely or
      // they float/sink relative to what's on screen. Verified by
      // raycasting the rendered mesh (see dev-checks.js
      // embankment-mesh-matches-formula): worst gap dropped from 4.27u
      // (2 slices out here) to <0.1u at this density.
      const lateralSlices = [
        -150.0, -105.0, -75.0, -55.0,
        -45.0, -41.0, -37.0, -33.0, -29.0, -25.0, -21.0, -17.0, -13.0, -9.0,
        -7.6, -6.5, -vergeLat, -roadHalf, roadHalf, vergeLat, 6.5, 7.6,
        9.0, 13.0, 17.0, 21.0, 25.0, 29.0, 33.0, 37.0, 41.0, 45.0,
        55.0, 75.0, 105.0, 150.0
      ];
      const sliceCount = lateralSlices.length;

      const positions = [];
      const colors = [];
      const normals = [];
      const uvs = [];
      const indices = [];

      const grassCol = new THREE.Color(season.grassColor);
      const grassLight = new THREE.Color(season.grassLight);
      const cliffCol = new THREE.Color(season.cliffColor);
      // Biome-aware shoulder soil color matching createRoadMesh's verge color
      const shoulderSoilColor = new THREE.Color(season.grassLight).lerp(new THREE.Color(0x2a2824), 0.35);

      const points = this.tunnelPoints || this.curve.getSpacedPoints(tubularSegments);

      for (let i = 0; i <= tubularSegments; i++) {
        const pt = points[i];

        let tangent;
        if (i === 0) {
          tangent = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
        } else if (i === tubularSegments) {
          tangent = new THREE.Vector3().subVectors(points[tubularSegments], points[tubularSegments - 1]).normalize();
        } else {
          tangent = new THREE.Vector3().subVectors(points[i + 1], points[i - 1]).normalize();
        }

        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
        const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

        // Mirrors createRoadMesh's banking exactly by reading from the
        // shared cached this.roadBankingAngles array (Single Source of Truth)
        const bankingAngle = (this.roadBankingAngles && this.roadBankingAngles[i] !== undefined)
          ? this.roadBankingAngles[i]
          : 0;

        // Synchronize terrain vertex colors with district biome palette (matching streaming extension)
        const curPalette = this.getDistrictPalette(pt.z, season);
        const curGrassCol = curPalette.grassColor;
        const curCliffCol = curPalette.cliffColor;
        const curSoilColor = curPalette.shoulderSoil;

        for (let j = 0; j < sliceCount; j++) {
          const latDist = lateralSlices[j];
          const absDist = Math.abs(latDist);
          // Pure-vertical banking correction at this lateral offset — same
          // formula as the vehicle's `bankedYOffset`, which only nudges Y,
          // matching how this loop already places X/Z via the unbanked
          // `normal` and only ever adjusts `finalY`.
          const bankedYOffset = latDist * binormal.y * Math.sin(bankingAngle);

          const worldPos = pt.clone().addScaledVector(normal, latDist);
          let finalY = pt.y;

          if (absDist <= roadHalf) {
            // 1. Under Asphalt: strictly 0.22m below road surface, banked with the road (continuous road corridor trench)
            finalY = pt.y - 0.22 + bankedYOffset;
            colors.push(curSoilColor.r, curSoilColor.g, curSoilColor.b);
          } else if (absDist <= 9.0) {
            // 2. Road Shoulder Verge: gentle downward slope matching groundHeightAt()
            const t = (absDist - roadHalf) / (9.0 - roadHalf);
            // Shared formula (Pattern 1): this used to be its own copy, which is
            // why flattening groundHeightAt didn't change the rendered verge.
            // 0.04 below it, matching the 0.22 vs 0.18 under-slab offset above.
            finalY = this.groundHeightAt(pt, worldPos, latDist) - 0.04;

            // Natural organic shoulder blending into biome landscape:
            // Starts at shoulderSoilColor at road edge (t=0), feathering outward into season grass/sand
            const blendT = THREE.MathUtils.smoothstep(t, 0.05, 0.95);
            const bladeNoise = 0.96 + this.simplex.noise2D(worldPos.x * 0.08, worldPos.z * 0.08) * 0.06;
            const r = THREE.MathUtils.lerp(curSoilColor.r, curGrassCol.r * bladeNoise, blendT);
            const g = THREE.MathUtils.lerp(curSoilColor.g, curGrassCol.g * bladeNoise, blendT);
            const b = THREE.MathUtils.lerp(curSoilColor.b, curGrassCol.b * bladeNoise, blendT);
            colors.push(r, g, b);
          } else {
            // 3. Embankment Carving: Smooth terrain transition from road edge to raw hills
            const rawH = this.getRawTerrainHeight(worldPos.x, worldPos.z);
            const inTunnel = this.isInTunnelZone && this.isInTunnelZone(i);

            if (inTunnel) {
              // Tunnel Corridor Mountain Cut:
              // Embankment slopes smoothly up into the mountain ridge ABOVE the tunnel roof
              const SHOULDER_TRANSITION = 9.0;
              const EMBANKMENT_BLEND = 45.0;
              const blendFactor = THREE.MathUtils.smoothstep(absDist, SHOULDER_TRANSITION, EMBANKMENT_BLEND);
              const mountainOverhead = Math.max(rawH, pt.y + 14.0);
              finalY = THREE.MathUtils.lerp(pt.y - 0.5, mountainOverhead, blendFactor);
              colors.push(curCliffCol.r * 0.9, curCliffCol.g * 0.9, curCliffCol.b * 0.9);
            } else {
              const SHOULDER_TRANSITION = 9.0;  // End of shoulder
              const EMBANKMENT_BLEND = 45.0;    // Fully back to raw terrain
              const blendFactor = THREE.MathUtils.smoothstep(absDist, SHOULDER_TRANSITION, EMBANKMENT_BLEND);
              const shoulderDrop = pt.y - 0.5;  // 50cm down from road surface
              finalY = THREE.MathUtils.lerp(shoulderDrop, rawH, blendFactor);

              if (rawH > 22.0) {
                colors.push(curCliffCol.r, curCliffCol.g, curCliffCol.b);
              } else {
                const nVal = 0.94 + this.simplex.noise2D(worldPos.x * 0.04, worldPos.z * 0.04) * 0.07;
                colors.push(curGrassCol.r * nVal, curGrassCol.g * nVal, curGrassCol.b * nVal);
              }
            }
          }

          // Road clearance guard: if this vertex lies within the drivable road corridor of ANY road segment,
          // it must never breach above that road segment's surface (prevents terrain from slicing across hairpins/switchbacks).
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

          positions.push(worldPos.x, finalY, worldPos.z);
          normals.push(0, 1, 0);
          // 0.15 -> 0.45: at 0.15 each texture tile stretched across ~6.7m
          // of ground, so individual grass blades read as smeared/blown-up
          // rather than fine detail at normal driving distance — user
          // asked directly for denser-looking grass. Tripling the tiling
          // frequency shrinks each tile to ~2.2m, closer to how fine real
          // turf actually reads from a moving vehicle.
          uvs.push(worldPos.x * 0.45, worldPos.z * 0.45);

          if (i < tubularSegments && j < sliceCount - 1) {
            const row1 = i * sliceCount + j;
            const row2 = (i + 1) * sliceCount + j;
            indices.push(row1, row1 + 1, row2);
            indices.push(row1 + 1, row2 + 1, row2);
          }
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);
      geom.computeVertexNormals();
      geom.computeTangents();

      // Real photo grass (ambientcg Grass005) replacing the procedural
      // canvas-noise texture — SLOWROADS_PARITY_LOG.md item 6. vertexColors
      // still multiplies over this (grass-green in the flat bands, the
      // cliffCol grey-brown in steep bands per the embankment logic above)
      // exactly as it did over the old texture — same mechanism, just a
      // real photo underneath instead of procedural speckle noise.
      const terrainMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.95,
        metalness: 0.0,
        map: RealTextureFactory.grassColor(),
        normalMap: RealTextureFactory.grassNormal(),
        normalScale: new THREE.Vector2(0.6, 0.6),
        // The warm scene IBL + AmbientLight 0.42 + HemisphereLight 0.22
        // together lift a #245e33 deep-green vertex colour to RGB(135,171,136)
        // pale mint after ACES tone-mapping — a photometric ablation on the
        // rendered pixel showed removing the environment map alone drops it
        // to (97,136,95), and combining that with a lower diffuse ambient
        // returns the terrain to a proper forest-green. Because roughness
        // is 0.95, the env map contribution here is diffuse irradiance, not
        // meaningful highlights, so dialing it down loses no useful lighting
        // — it only stops washing out the vertex-colored ground. Restricted
        // to terrain: trees, buildings, the car all keep full env intensity.
        envMapIntensity: 0.35
      });

      GroundDetail.apply(terrainMat);
      this.terrainMesh = new THREE.Mesh(geom, terrainMat);
      this.terrainMesh.receiveShadow = true;
      if (!this.terrainMeshes) this.terrainMeshes = [];
      this.terrainMeshes.push(this.terrainMesh);

      // Cache the LAST row of terrain vertices (24 slice positions at the
      // final tubular sample) so streaming's row 0 can snap to them
      // exactly. Without this, the extension re-derives Y from the
      // re-parameterized curve and lands off by a few decimetres per
      // vertex, creating the horizontal shelf visible along the ±45m
      // embankment past ~6km.
      const _lastRow = [];
      const _lastRowIdx = tubularSegments * sliceCount;
      const _computedNormals = geom.attributes.normal;
      for (let j = 0; j < sliceCount; j++) {
        const base = (_lastRowIdx + j) * 3;
        _lastRow.push({
          lat: lateralSlices[j],
          x: positions[base],
          y: positions[base + 1],
          z: positions[base + 2],
          nx: _computedNormals.getX(_lastRowIdx + j),
          ny: _computedNormals.getY(_lastRowIdx + j),
          nz: _computedNormals.getZ(_lastRowIdx + j),
          // remember the mesh + vertex index so the streaming path
          // can average the row-N normal back onto the previous mesh
          _mesh: this.terrainMesh,
          _idx: _lastRowIdx + j
        });
      }
      this._lastTerrainEdgeVerts = _lastRow;
      return this.terrainMesh;
    },

    // Builds a tunnel bore (arched cross-section extruded along the curve)
    // for every zone computeTunnelZones() found, plus a lamp every few
    // samples so the inside isn't pitch black. Returns a Group (possibly
    // empty — most seeds have zero tall-hill zones) to add/remove from the
    // Builds a premium highway tunnel bore with architectural portal facades,
    // overhead warm sodium tube lighting, and flush road slab meeting

    createTunnelMeshes() {
      const group = new THREE.Group();
      group.name = 'tunnels';
      this.tunnelGroup = group;
      if (!this.tunnelZones || !this.tunnelZones.length) return group;

      const points = this.tunnelPoints;
      const halfWidth = CONFIG.TUNNEL_HALF_WIDTH || 6.4;
      const wallHeight = 4.4;
      const archRadius = halfWidth + 0.8;
      const archSegs = 14;
      const apexHeight = wallHeight + archRadius; // ~11.6m

      // 1. Premium Materials
      const tileMat = new THREE.MeshStandardMaterial({
        color: 0xebf1f6, // Glazed reflective ceramic wainscot tile
        roughness: 0.16,
        metalness: 0.08,
        side: THREE.DoubleSide
      });

      const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b, // Vaulted dark reinforced concrete arch
        roughness: 0.90,
        metalness: 0.20,
        side: THREE.DoubleSide
      });

      const ribMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a, // Structural concrete arch support rings
        roughness: 0.85,
        metalness: 0.25
      });

      const curbMat = new THREE.MeshStandardMaterial({
        color: 0x64748b, // Raised concrete safety walkway
        roughness: 0.80
      });

      const amberReflectorMat = new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.4,
        roughness: 0.2
      });

      const whiteReflectorMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 2.2,
        roughness: 0.2
      });

      const sodiumMat = new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        emissive: 0xffb347,
        emissiveIntensity: 3.4,
        roughness: 0.2
      });

      const portalMat = new THREE.MeshStandardMaterial({
        color: 0x4a4742, // Natural architectural stone & reinforced concrete
        roughness: 0.94,
        metalness: 0.05,
        map: RealTextureFactory.rockColor(),
        normalMap: RealTextureFactory.rockNormal()
      });

      const archRingMat = new THREE.MeshStandardMaterial({
        color: 0x383532,
        roughness: 0.88,
        metalness: 0.1
      });

      const matrixMat = new THREE.MeshStandardMaterial({
        color: 0x10b981, // Glowing green LED electronic matrix board
        emissive: 0x10b981,
        emissiveIntensity: 2.8,
        roughness: 0.2
      });

      const cautionMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b, // Amber caution header strip
        emissive: 0xd97706,
        emissiveIntensity: 0.8,
        roughness: 0.4
      });

      const sosMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 2.2,
        roughness: 0.3
      });

      const exitSignMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x16a34a,
        emissiveIntensity: 2.6,
        roughness: 0.2
      });

      // Cross-sections for Lower Glazed Walls and Upper Vaulted Ceiling
      const lowerWallHeight = 2.6; // Ceramic subway tile wainscot height

      for (const zone of this.tunnelZones) {
        // --- A. Lower Glazed Ceramic Tile Walls (Left & Right) ---
        const tilePositions = [], tileNormals = [], tileUvs = [], tileIndices = [];
        const ceilPositions = [], ceilNormals = [], ceilUvs = [], ceilIndices = [];
        let tileRowIdx = 0, ceilRowIdx = 0;

        for (let i = zone.start; i <= zone.end; i++) {
          const pt = points[i];
          const prev = points[Math.max(zone.start, i - 1)];
          const next = points[Math.min(zone.end, i + 1)];
          const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
          const up = new THREE.Vector3(0, 1, 0);
          const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

          // Left and right lower tile wall vertices
          const lBot = pt.clone().addScaledVector(normal, -halfWidth); lBot.y = pt.y + 0.12;
          const lTop = pt.clone().addScaledVector(normal, -halfWidth); lTop.y = pt.y + 0.12 + lowerWallHeight;
          const rBot = pt.clone().addScaledVector(normal, halfWidth); rBot.y = pt.y + 0.12;
          const rTop = pt.clone().addScaledVector(normal, halfWidth); rTop.y = pt.y + 0.12 + lowerWallHeight;

          tilePositions.push(lBot.x, lBot.y, lBot.z, lTop.x, lTop.y, lTop.z);
          tilePositions.push(rBot.x, rBot.y, rBot.z, rTop.x, rTop.y, rTop.z);
          tileNormals.push(normal.x, 0, normal.z, normal.x, 0, normal.z);
          tileNormals.push(-normal.x, 0, -normal.z, -normal.x, 0, -normal.z);
          const uStep = (i - zone.start) * 0.4;
          tileUvs.push(uStep, 0, uStep, 1, uStep, 0, uStep, 1);

          if (i > zone.start) {
            const prevR = (tileRowIdx - 1) * 4;
            const currR = tileRowIdx * 4;
            // Left wall quad
            tileIndices.push(prevR, currR, prevR + 1, currR, currR + 1, prevR + 1);
            // Right wall quad
            tileIndices.push(prevR + 2, prevR + 3, currR + 2, currR + 2, prevR + 3, currR + 3);
          }
          tileRowIdx++;

          // --- Upper Vaulted Ceiling Arch ---
          const ceilSlice = [];
          ceilSlice.push({ lat: -halfWidth, h: lowerWallHeight });
          ceilSlice.push({ lat: -halfWidth, h: wallHeight });
          for (let s = 0; s <= archSegs; s++) {
            const theta = Math.PI - (Math.PI * s / archSegs);
            ceilSlice.push({ lat: Math.cos(theta) * archRadius, h: wallHeight + Math.sin(theta) * archRadius });
          }
          ceilSlice.push({ lat: halfWidth, h: wallHeight });
          ceilSlice.push({ lat: halfWidth, h: lowerWallHeight });

          const cRowStart = ceilPositions.length / 3;
          for (const { lat, h } of ceilSlice) {
            const wPos = pt.clone().addScaledVector(normal, lat);
            wPos.y = pt.y + 0.12 + h;
            ceilPositions.push(wPos.x, wPos.y, wPos.z);
            const nrm = new THREE.Vector3(-normal.x, 0, -normal.z).normalize().lerp(new THREE.Vector3(0, -1, 0), h / apexHeight);
            ceilNormals.push(nrm.x, nrm.y, nrm.z);
            ceilUvs.push(uStep, (lat + halfWidth) * 0.1);
          }

          if (i > zone.start) {
            const prevCRow = cRowStart - ceilSlice.length;
            for (let j = 0; j < ceilSlice.length - 1; j++) {
              const a = prevCRow + j, b = prevCRow + j + 1, c = cRowStart + j, d = cRowStart + j + 1;
              ceilIndices.push(a, c, b);
              ceilIndices.push(b, c, d);
            }
          }
        }

        const tileGeom = new THREE.BufferGeometry();
        tileGeom.setAttribute('position', new THREE.Float32BufferAttribute(tilePositions, 3));
        tileGeom.setAttribute('normal', new THREE.Float32BufferAttribute(tileNormals, 3));
        tileGeom.setAttribute('uv', new THREE.Float32BufferAttribute(tileUvs, 2));
        tileGeom.setIndex(tileIndices);
        const tileMesh = new THREE.Mesh(tileGeom, tileMat);
        tileMesh.receiveShadow = false;
        group.add(tileMesh);

        const ceilGeom = new THREE.BufferGeometry();
        ceilGeom.setAttribute('position', new THREE.Float32BufferAttribute(ceilPositions, 3));
        ceilGeom.setAttribute('normal', new THREE.Float32BufferAttribute(ceilNormals, 3));
        ceilGeom.setAttribute('uv', new THREE.Float32BufferAttribute(ceilUvs, 2));
        ceilGeom.setIndex(ceilIndices);
        const ceilMesh = new THREE.Mesh(ceilGeom, ceilingMat);
        ceilMesh.receiveShadow = false;
        group.add(ceilMesh);

        // --- B. Structural Reinforced Arch Support Ribs (every 10m) ---
        const ribGeom = new THREE.BoxGeometry(0.7, 0.45, 0.6);
        for (let i = zone.start + 3; i < zone.end - 2; i += 10) {
          const pt = points[i];
          const prev = points[Math.max(zone.start, i - 1)];
          const next = points[Math.min(zone.end, i + 1)];
          const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
          const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

          const ribGroup = new THREE.Group();
          ribGroup.position.copy(pt);
          ribGroup.position.y = pt.y + 0.12;

          // Left and Right Arch Rib Columns
          const colGeom = new THREE.BoxGeometry(0.65, wallHeight + 0.4, 0.65);
          const leftCol = new THREE.Mesh(colGeom, ribMat);
          leftCol.position.set(-halfWidth + 0.25, (wallHeight + 0.4) * 0.5, 0);
          const rightCol = new THREE.Mesh(colGeom, ribMat);
          rightCol.position.set(halfWidth - 0.25, (wallHeight + 0.4) * 0.5, 0);
          ribGroup.add(leftCol, rightCol);

          // Curved Arch Ceiling Rib Segments
          for (let s = 0; s <= 8; s++) {
            const theta = Math.PI - (Math.PI * s / 8);
            const rx = Math.cos(theta) * (archRadius - 0.15);
            const ry = wallHeight + Math.sin(theta) * (archRadius - 0.15);
            const ribSeg = new THREE.Mesh(ribGeom, ribMat);
            ribSeg.position.set(rx, ry, 0);
            ribSeg.rotation.z = theta - Math.PI / 2;
            ribGroup.add(ribSeg);
          }

          ribGroup.lookAt(ribGroup.position.clone().add(tangent));
          group.add(ribGroup);
        }

        // --- C. Continuous Raised Safety Walkways & Reflective Cat's Eyes ---
        const curbGeom = new THREE.BoxGeometry(1.1, 0.28, 4.0);
        const reflectorGeom = new THREE.BoxGeometry(0.12, 0.06, 0.18);

        for (let i = zone.start + 1; i < zone.end; i += 4) {
          const pt = points[i];
          const prev = points[Math.max(zone.start, i - 1)];
          const next = points[Math.min(zone.end, i + 1)];
          const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
          const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

          [-1, 1].forEach(side => {
            const curbPos = pt.clone().addScaledVector(normal, side * (halfWidth - 0.6));
            curbPos.y = pt.y + 0.12 + 0.14;

            const curb = new THREE.Mesh(curbGeom, curbMat);
            curb.position.copy(curbPos);
            curb.lookAt(curbPos.clone().add(tangent));
            group.add(curb);

            // Reflective Cat's Eye Stud on Curb Edge
            const studPos = pt.clone().addScaledVector(normal, side * (halfWidth - 1.15));
            studPos.y = pt.y + 0.12 + 0.28;
            const stud = new THREE.Mesh(reflectorGeom, side === -1 ? amberReflectorMat : whiteReflectorMat);
            stud.position.copy(studPos);
            stud.lookAt(studPos.clone().add(tangent));
            group.add(stud);
          });
        }

        // --- D. Dual Continuous Overhead Sodium Tube Light Rails ---
        const fixtureRailGeom = new THREE.BoxGeometry(0.45, 0.18, 5.0);
        const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
        const tubeGeom = new THREE.CylinderGeometry(0.06, 0.06, 4.6, 12);
        tubeGeom.rotateX(Math.PI / 2);

        for (let i = zone.start + 2; i < zone.end - 1; i += 5) {
          const pt = points[i];
          const prev = points[Math.max(zone.start, i - 1)];
          const next = points[Math.min(zone.end, i + 1)];
          const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
          const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

          // Dual parallel overhead rails: Left (-1.8m) and Right (+1.8m)
          [-1.8, 1.8].forEach(railOffset => {
            const fixturePos = pt.clone().addScaledVector(normal, railOffset);
            fixturePos.y = pt.y + 0.12 + apexHeight - 0.25;

            const fixture = new THREE.Group();
            const housing = new THREE.Mesh(fixtureRailGeom, fixtureMat);
            const tube = new THREE.Mesh(tubeGeom, sodiumMat);
            tube.position.y = -0.10;
            fixture.add(housing, tube);

            // Dynamic warm sodium point illumination every 15m
            if (i % 15 === 0 && railOffset > 0) {
              const tunnelLight = new THREE.PointLight(0xffb347, 1.6, 24.0, 1.2);
              tunnelLight.position.set(0, -0.3, 0);
              fixture.add(tunnelLight);
            }

            fixture.position.copy(fixturePos);
            fixture.lookAt(fixturePos.clone().add(tangent));
            group.add(fixture);
          });
        }

        // --- E. Emergency Niches & SOS Call Alcoves (every 35m) ---
        for (let i = zone.start + 15; i < zone.end - 15; i += 35) {
          const pt = points[i];
          const prev = points[Math.max(zone.start, i - 1)];
          const next = points[Math.min(zone.end, i + 1)];
          const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
          const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

          const sosPos = pt.clone().addScaledVector(normal, halfWidth - 0.2);
          sosPos.y = pt.y + 0.12 + 1.4;

          const sosGroup = new THREE.Group();
          // Orange SOS Call Box
          const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.65, 0.45), sosMat);
          box.position.set(0, 0, 0);
          // Green Emergency Exit Sign above
          const exitSign = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.55), exitSignMat);
          exitSign.position.set(0, 0.65, 0);
          sosGroup.add(box, exitSign);
          sosGroup.position.copy(sosPos);
          sosGroup.lookAt(pt.x, sosPos.y, pt.z);
          group.add(sosGroup);
        }

        // --- F. Grand Mountain Retaining Portals & Wing Walls (Entrance & Exit) ---
        [zone.start, zone.end].forEach((portalIdx, pIndex) => {
          const pt = points[portalIdx];
          const prev = points[Math.max(0, portalIdx - 1)];
          const next = points[Math.min(points.length - 1, portalIdx + 1)];
          const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
          if (pIndex === 1) tangent.negate(); // face outward at exit
          const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

          const portalGroup = new THREE.Group();
          portalGroup.position.copy(pt);
          portalGroup.position.y = pt.y + 0.12;

          // 1. Upper Mountain Retaining Headwall (sits strictly ABOVE the portal header)
          const upperHeadwallGeom = new THREE.BoxGeometry(halfWidth * 2 + 20.0, 7.0, 5.0);
          const upperHeadwall = new THREE.Mesh(upperHeadwallGeom, portalMat);
          upperHeadwall.position.set(0, apexHeight + 3.8 + 3.5, -0.5);

          // 2. Left & Right Mountain Retaining Abutments
          const abutmentGeom = new THREE.BoxGeometry(6.5, apexHeight + 4.0, 5.0);
          const leftAbutment = new THREE.Mesh(abutmentGeom, portalMat);
          leftAbutment.position.set(-(halfWidth + 5.0), (apexHeight + 4.0) * 0.5, -0.5);
          const rightAbutment = new THREE.Mesh(abutmentGeom, portalMat);
          rightAbutment.position.set(halfWidth + 5.0, (apexHeight + 4.0) * 0.5, -0.5);

          // 3. Heavy Architectural Chamfered Portal Pillars
          const pillarGeom = new THREE.BoxGeometry(3.6, apexHeight + 3.2, 5.4);
          const leftPillar = new THREE.Mesh(pillarGeom, archRingMat);
          leftPillar.position.set(-(halfWidth + 1.8), (apexHeight + 3.2) * 0.5, 0.4);
          const rightPillar = new THREE.Mesh(pillarGeom, archRingMat);
          rightPillar.position.set(halfWidth + 1.8, (apexHeight + 3.2) * 0.5, 0.4);

          // 3. Wide Flared Mountain Wing Walls (merges smoothly into roadside mountain embankments)
          const wingGeom = new THREE.BoxGeometry(14.0, apexHeight + 4.0, 3.5);
          const leftWing = new THREE.Mesh(wingGeom, portalMat);
          leftWing.position.set(-(halfWidth + 8.8), (apexHeight + 4.0) * 0.5, 2.8);
          leftWing.rotation.y = 0.52;
          const rightWing = new THREE.Mesh(wingGeom, portalMat);
          rightWing.position.set(halfWidth + 8.8, (apexHeight + 4.0) * 0.5, 2.8);
          rightWing.rotation.y = -0.52;

          // 4. Heavy Reinforced Concrete Arch Header
          const headerGeom = new THREE.BoxGeometry(halfWidth * 2 + 7.2, 3.8, 5.6);
          const headerBeam = new THREE.Mesh(headerGeom, archRingMat);
          headerBeam.position.set(0, apexHeight + 2.0, 0.4);

          // 5. Overhanging Concrete Visor Canopy
          const canopyGeom = new THREE.BoxGeometry(halfWidth * 2 + 8.0, 0.65, 3.2);
          const canopy = new THREE.Mesh(canopyGeom, archRingMat);
          canopy.position.set(0, apexHeight + 3.8, 2.2);
          canopy.rotation.x = 0.08;

          // 6. Amber Caution Clearance Hazard Bar
          const cautionGeom = new THREE.BoxGeometry(halfWidth * 2 + 2.2, 0.5, 0.35);
          const cautionBar = new THREE.Mesh(cautionGeom, cautionMat);
          cautionBar.position.set(0, apexHeight + 0.1, 2.8);

          // 7. Electronic LED Dot Matrix Display Board ("TUNNEL AHEAD / 70 KM/H / ⬇ ⬇")
          const matrixGeom = new THREE.BoxGeometry(halfWidth * 1.6, 1.1, 0.25);
          const matrixBoard = new THREE.Mesh(matrixGeom, matrixMat);
          matrixBoard.position.set(0, apexHeight + 1.8, 2.9);

          portalGroup.add(upperHeadwall, leftAbutment, rightAbutment, leftPillar, rightPillar, leftWing, rightWing, headerBeam, canopy, cautionBar, matrixBoard);
          portalGroup.lookAt(portalGroup.position.clone().add(tangent));
          group.add(portalGroup);
        });
      }

      this.tunnelGroup = group;
      return group;
    },

    // The road-hugging terrain ribbon above only extends ±40m from the
    // road centerline. Since the spline winds and loops back on itself
    // over its ~5km length, distant loops of road would otherwise render
    // as disconnected islands floating over open sky. This large, coarse
    // background plane fills that void with continuous ground so every
    // visible part of the world sits on land.

    createWorldFloor(season) {
      // Size and center the floor off the road spline's actual bounding
      // box (it's a random walk, not centered near the origin) with a
      // generous margin, instead of assuming a fixed origin-centered size —
      // otherwise large stretches of road fall outside the floor entirely.
      const b = this.worldBounds;
      const margin = 500.0;
      const spanX = (b.maxX - b.minX) + margin * 2;
      const spanZ = (b.maxZ - b.minZ) + margin * 2;
      const size = Math.max(spanX, spanZ, CONFIG.TERRAIN_SIZE);
      const centerX = (b.minX + b.maxX) / 2;
      const centerZ = (b.minZ + b.maxZ) / 2;

      // REVERTED: this was briefly raised to 700 segments (~9m cells) to
      // shrink a formula-vs-floor-mesh accuracy gap for distant background
      // buildings. That reasoning only weighed ONE-TIME WORLD-BUILD cost
      // (which did improve, thanks to the spatial-hash search below) and
      // completely missed the real cost: this mesh is STATIC but still
      // renders every single frame, and at 700 segments it was 647,522
      // triangles — 89% of the entire scene's per-frame triangle budget —
      // which measurably dropped real gameplay FPS from ~59.5 to ~42.6.
      // Solving a placement-ACCURACY problem by brute-forcing RENDER
      // density was the wrong lever: the floor is mostly invisible
      // backdrop (hidden under the ribbon for 0-45m, and visual smoothness
      // of distant terrain doesn't need per-formula precision). Back to
      // 400 — the residual accuracy gap this was chasing is handled where
      // it actually matters: buildings already have a 60-unit foundation
      // slab (B21) that absorbs it, and the specific rock-floating bug
      // reported alongside this FPS regression turned out to be an
      // unrelated fixed-offset-vs-random-rotation bug in rock placement
      // itself (see the boulder/rock spawn code), not a floor-resolution
      // problem at all. If distant-prop floating is ever reported again
      // for something WITHOUT its own foundation/offset fix, address that
      // prop's own placement, not this mesh's global render resolution.
      const segments = Math.min(400, Math.ceil(size / 15));

      const geom = new THREE.PlaneGeometry(size, size, segments, segments);
      geom.rotateX(-Math.PI / 2);
      geom.translate(centerX, 0, centerZ);

      const grassCol = new THREE.Color(season.grassColor);
      const grassLight = new THREE.Color(season.grassLight);
      const cliffCol = new THREE.Color(season.cliffColor);

      // Dense sample of the road curve, used to keep the floor from
      // burying the road on hills. Two earlier versions of this code
      // approximated a "clamp toward road height" with their own simplified
      // formula that only roughly agreed with the ribbon's actual
      // embankment math — close but not equal, leaving real multi-meter
      // gaps at the seam (measured directly: up to 18m even after tightening
      // the sample spacing).
      //
      // This used to be its own separate 260-point getSpacedPoints() call
      // — coarse enough (~19m between samples on a multi-km winding route)
      // that a floor vertex's TRUE nearest distance to the road could read
      // as significantly farther via straight-line distance to the nearest
      // of only 260 discrete points, wrongly classifying vertices near the
      // ribbon-coverage boundary as "past the ribbon" when they weren't —
      // measured a real 27-32u floating gap at exactly that boundary.
      // Reuses world.roadSpacedPoints (CONFIG.ROAD_MESH_SEGMENTS = 1200
      // points, cached by createRoadMesh, which always runs first in
      // buildWorldAndScene) instead: same dense sampling the ribbon and
      // road mesh themselves are built from, not a fourth independent
      // approximation of "how far is this point from the road."
      const roadSamples = this.roadSpacedPoints || this.curve.getSpacedPoints(CONFIG.ROAD_MESH_SEGMENTS);

      const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
      // createTerrainMesh (the close-up "ribbon" that actually renders the
      // ground right around the road) draws real terrain out to exactly
      // ±40m (its own lateralSlices array caps there). This floor plane
      // used to separately replicate the ribbon's embankment-blend formula
      // out to a nominal 45m using its OWN coarser road sampling (260
      // points here vs the ribbon's exact per-point `pt`) — two
      // independent formulas computing "the same" height were never
      // guaranteed to agree, and after removing their shared clamp (see
      // the commit that fixed buildings/props sinking into hillsides) the
      // small disagreement became large enough that this floor could
      // render ABOVE the ribbon+road, burying the road and vehicle under
      // floor terrain that was only ever meant to be hidden underneath it.
      // Simplest fix that can't diverge again: stay hidden everywhere the
      // ribbon actually draws, and only surface true terrain height past
      // that, where the ribbon has nothing to conflict with. Must equal
      // groundHeightAt's own EMBANKMENT_BLEND (45), not an independent
      // guess — that's the actual distance the ribbon (and every prop
      // placed via groundHeightAt) stops blending and starts reading raw
      // terrain directly. This was 40 and caused a real ~27u cliff for
      // anything sitting in the 40-45m gap; see the fix note below.
      const RIBBON_COVERAGE = 45.0;

      // Spatial hash over roadSamples so each floor vertex only checks
      // nearby cells instead of all 1200 points — switching roadSamples
      // from 260 to 1200 points above (needed for correctness: see the
      // comment on roadSamples) made the brute-force O(vertices x samples)
      // search ~4.6x slower (measured: +540ms/+63% on world build). Cell
      // size covers RIBBON_COVERAGE with one ring of neighbor cells so the
      // true nearest sample is never missed near the boundary that matters.
      const GRID_CELL = 50.0;
      const grid = new Map();
      const cellKey = (cx, cz) => cx + ',' + cz;
      for (let s = 0; s < roadSamples.length; s++) {
        const cx = Math.floor(roadSamples[s].x / GRID_CELL);
        const cz = Math.floor(roadSamples[s].z / GRID_CELL);
        const key = cellKey(cx, cz);
        let bucket = grid.get(key);
        if (!bucket) { bucket = []; grid.set(key, bucket); }
        bucket.push(s);
      }

      const pos = geom.attributes.position;
      const colors = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const rawH = this.getRawTerrainHeight(x, z);

        let nearestDistSq = Infinity;
        let nearestRoadY = Infinity;
        const vcx = Math.floor(x / GRID_CELL);
        const vcz = Math.floor(z / GRID_CELL);
        // Ring size 1 covers a 150x150 area around the vertex (3x3 cells of
        // 50), comfortably beyond RIBBON_COVERAGE(45) in every direction —
        // the true nearest sample within 45m can never fall outside it.
        for (let dcx = -1; dcx <= 1; dcx++) {
          for (let dcz = -1; dcz <= 1; dcz++) {
            const bucket = grid.get(cellKey(vcx + dcx, vcz + dcz));
            if (!bucket) continue;
            for (let bi = 0; bi < bucket.length; bi++) {
              const s = bucket[bi];
              const dx = x - roadSamples[s].x;
              const dz = z - roadSamples[s].z;
              const dSq = dx * dx + dz * dz;
              if (dSq < nearestDistSq) {
                nearestDistSq = dSq;
                nearestRoadY = roadSamples[s].y;
              }
            }
          }
        }
        // Fallback for the rare vertex with no road sample within the 3x3
        // neighborhood (far off in the world-floor margin, well past where
        // RIBBON_COVERAGE or the blend even matters) — brute force once,
        // correctness over speed for what's already an edge case.
        if (nearestDistSq === Infinity) {
          for (let s = 0; s < roadSamples.length; s++) {
            const dx = x - roadSamples[s].x;
            const dz = z - roadSamples[s].z;
            const dSq = dx * dx + dz * dz;
            if (dSq < nearestDistSq) {
              nearestDistSq = dSq;
              nearestRoadY = roadSamples[s].y;
            }
          }
        }


        const naturalY = rawH - 0.3;
        let finalY = naturalY;
        const dist = Math.sqrt(nearestDistSq);
        // BUGFIX (two rounds — read both, the first round was insufficient
        // on its own): this originally switched hard at dist<=40 between
        // "buried 25 under the road" and "true raw height," while the
        // ribbon/prop formula both actually cover out to 45
        // (EMBANKMENT_BLEND) — a mismatched boundary, not just a missing
        // blend, worth ~27-32u of real measured floating.
        //
        // Round 1 just moved the switch to the correct boundary (45). That
        // was NOT enough: floor mesh vertices are only ~15m apart (see
        // `segments` above), so ANY hard switch — even at the geometrically
        // correct distance — still compresses a 25+ unit jump into whatever
        // single quad happens to straddle it, and that quad interpolates
        // linearly between "deeply buried" and "true height" across its
        // ~15m width. Any building sitting on that one transitional quad
        // reads a wrong, blended-neither height — measured up to 38u still,
        // now at exactly the (correct) boundary instead of the old wrong
        // one. A hard switch cannot ever be made safe this way; the
        // transition itself has to be smooth AND has to finish (reach true
        // naturalY) at or before dist=45, since groundHeightAt — what every
        // prop placed out here actually uses — is unblended and constant
        // past that point (verified continuous 35->60m: 2.43, 4.55, 5.90,
        // 7.23, 8.23, 8.48, 8.25, 7.17, 6.30). Blending PAST 45 (an earlier,
        // reverted attempt) would leave the floor still ramping up while
        // props already sit at full natural height — the same bug in the
        // opposite direction.
        //
        // Fix: smoothstep from fully-buried at BLEND_START (25 — well
        // inside where the ribbon has real, visible geometry, so nothing is
        // ever placed relying on the floor there) up to fully-natural
        // exactly AT RIBBON_COVERAGE(45). By the boundary the floor has
        // already caught up to the same continuous value props use, so
        // there is nothing left to jump.
        //
        // BLEND_START is 40, not some wider margin — dev-checks.js's
        // `floor-hidden-under-ribbon` guards a real, separate invariant:
        // the floor must stay well below actual road level (>10u under)
        // everywhere within 40m, or it can visually poke through the
        // ribbon/road itself regardless of whether any prop relies on it.
        // A wider blend window (25->45, tried first) broke that guard —
        // this narrower 40->45 band is the widest that respects it.
        const BLEND_START = 40.0;
        const SAFETY_ZONE = 75.0;
        if (dist <= BLEND_START) {
          finalY = nearestRoadY - 25.0;
        } else if (dist < RIBBON_COVERAGE) {
          const blendT = THREE.MathUtils.smoothstep(dist, BLEND_START, RIBBON_COVERAGE);
          finalY = THREE.MathUtils.lerp(nearestRoadY - 25.0, naturalY, blendT);
        }
        // Strict safety clamp: within SAFETY_ZONE of the road, floor mesh must never rise above road surface
        if (dist < SAFETY_ZONE) {
          finalY = Math.min(finalY, nearestRoadY - 1.5);
        } else if (dist < SAFETY_ZONE + 20.0) {
          const safetyBlend = THREE.MathUtils.smoothstep(dist, SAFETY_ZONE, SAFETY_ZONE + 20.0);
          finalY = THREE.MathUtils.lerp(Math.min(finalY, nearestRoadY - 1.5), naturalY, safetyBlend);
        }
        pos.setY(i, finalY);

        const curPalette = this.getDistrictPalette(z, season);
        const curGrassCol = curPalette.grassColor;
        const curGrassLight = curPalette.grassLight;
        const curCliffCol = curPalette.cliffColor;

        if (rawH > 22.0) {
          colors.push(curCliffCol.r, curCliffCol.g, curCliffCol.b);
        } else {
          const mixT = (this.simplex.noise2D(x * 0.008, z * 0.008) + 1) / 2;
          const c = curGrassCol.clone().lerp(curGrassLight, mixT * 0.5);
          colors.push(c.r, c.g, c.b);
        }
      }
      geom.computeVertexNormals();
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      // Own clone of the shared real grass texture so this mesh's repeat
      // count (driven by its own, much larger, world-space size) doesn't
      // fight with the terrain ribbon's repeat setting on the cached
      // original. SLOWROADS_PARITY_LOG.md item 6.
      const floorGrassTex = RealTextureFactory.grassColorFloor();
      // Matches the terrain ribbon's 0.45 tiling density (see that comment)
      // so the background floor and the close-up ribbon read as the same
      // grass at the seam, not two different densities.
      floorGrassTex.repeat.set(size * 0.45, size * 0.45);

      const floorMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.95,
        metalness: 0.0,
        map: floorGrassTex
      });

      GroundDetail.apply(floorMat);
      this.floorMesh = new THREE.Mesh(geom, floorMat);
      // Floor mesh spans kilometers outside the 32m car shadow frustum; disabling receiveShadow eliminates massive PCF shadow overhead
      this.floorMesh.receiveShadow = false;
      return this.floorMesh;
    },

    // Reusable Roadside Scenic Mountain Viewpoint Pavilion or Chai Tapri stall

    createSkyDome(season, todKey = 'day') {
      const tod = CONFIG.TIME_OF_DAY[todKey] || CONFIG.TIME_OF_DAY.day;
      const skyTopHex = tod.skyTop;
      const skyHorizHex = tod.skyHorizon;
      const skyBotHex = tod.skyBottom;
      // Sky color used to be Gouraud-interpolated per-VERTEX, baked onto a
      // coarse sphere — every ring boundary was a visible kink where the
      // interpolation slope changed (the vertical blend uses a non-linear
      // easing, pow(normY,0.75), that a polygonal mesh can only ever
      // approximate piecewise). Raising the ring count (24→64) reduced but
      // did not eliminate it for high-range gradients like Dawn's
      // purple→orange→yellow sweep — the banding is fundamentally a
      // property of vertex-based color interpolation, not something you
      // can subdivide your way out of for an arbitrarily wide color range.
      // Computing the exact same gradient per-PIXEL in a fragment shader
      // removes the mechanism entirely, at any geometry resolution — this
      // is the real fix, not a bigger version of the band-aid.
      const geom = new THREE.SphereGeometry(750, 32, 24);

      const skyMat = new THREE.ShaderMaterial({
        uniforms: {
          topCol: { value: new THREE.Color(skyTopHex) },
          horizCol: { value: new THREE.Color(skyHorizHex) },
          botCol: { value: new THREE.Color(skyBotHex) }
        },
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topCol;
          uniform vec3 horizCol;
          uniform vec3 botCol;
          varying vec3 vPos;
          void main() {
            float normY = vPos.y / 750.0;
            vec3 col;
            if (normY > 0.0) {
              col = mix(horizCol, topCol, pow(normY, 0.75));
            } else {
              col = mix(horizCol, botCol, min(1.0, -normY * 1.5));
            }
            // Even an exactly-computed gradient still quantizes to 8 bits
            // per channel on write — a per-pixel hash dither breaks that
            // final quantization step into imperceptible grain instead of
            // visible bands (same technique as the post-process vignette).
            float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 128.0;
            gl_FragColor = vec4(col + dither, 1.0);
          }
        `,
        side: THREE.BackSide,
        depthWrite: false
      });

      this.skyMesh = new THREE.Mesh(geom, skyMat);

      // Real Astrophotography Starfield (Matching natural dark sky reference)
      const createPinpointStarTexture = () => {
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 16;
        const ctx = c.getContext('2d');
        const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.2, 'rgba(240, 248, 255, 0.95)');
        grad.addColorStop(0.45, 'rgba(210, 230, 255, 0.40)');
        grad.addColorStop(0.75, 'rgba(180, 210, 255, 0.05)');
        grad.addColorStop(1.0, 'rgba(180, 210, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(8, 8, 8, 0, Math.PI * 2);
        ctx.fill();
        return new THREE.CanvasTexture(c);
      };

      const starGeom = new THREE.BufferGeometry();
      const starPos = [];
      const starColors = [];
      const starPalette = [
        new THREE.Color(0xffffff), // Stellar pure white (65%)
        new THREE.Color(0xf1f5f9), // Silver starlight (15%)
        new THREE.Color(0xdbeafe), // Icy Sirius blue (10%)
        new THREE.Color(0xfef3c7), // Soft Capella warm (7%)
        new THREE.Color(0xfde68a)  // Subtle amber star (3%)
      ];

      const STAR_COUNT = 4500;
      for (let s = 0; s < STAR_COUNT; s++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * (Math.PI / 2.05); // Full upper celestial dome down to horizon
        const r = 1060 + Math.random() * 20;
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);
        starPos.push(x, y, z);

        const col = starPalette[Math.floor(Math.random() * starPalette.length)];
        // Astrophotography stellar distribution: 85% faint micro-dots, 12% medium, 3% bright
        const roll = Math.random();
        let brightness;
        if (roll < 0.85) {
          brightness = 0.25 + Math.random() * 0.35; // Faint background stardust
        } else if (roll < 0.97) {
          brightness = 0.65 + Math.random() * 0.20; // Medium star
        } else {
          brightness = 0.90 + Math.random() * 0.10; // Prominent bright pinpoint
        }
        starColors.push(col.r * brightness, col.g * brightness, col.b * brightness);
      }

      starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
      starGeom.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
      const starMat = new THREE.PointsMaterial({
        map: createPinpointStarTexture(),
        vertexColors: true,
        size: 1.5,
        sizeAttenuation: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: (tod.night ? 1.0 : (tod.id === 'dusk' ? 0.45 : 0.0))
      });
      this.starMesh = new THREE.Points(starGeom, starMat);
      this.skyMesh.add(this.starMesh);

      return this.skyMesh;
    },


    createMountainArches(scene, season) {
      const archGroup = new THREE.Group();
      archGroup.name = 'mountain-arches';

      if (!this.tunnelZones || !this.tunnelZones.length) {
        this.archGroup = archGroup;
        scene.add(archGroup);
        return archGroup;
      }

      const points = this.curve.getSpacedPoints(CONFIG.ROAD_MESH_SEGMENTS);

      // One arch just outside each tunnel portal (2 indices ≈ 10-15m before bore).
      const archIndices = [];
      for (const zone of this.tunnelZones) {
        archIndices.push(Math.max(0, zone.start - 2));
        archIndices.push(Math.min(points.length - 3, zone.end + 2));
      }

      const rockMat = new THREE.MeshStandardMaterial({
        color: season.cliffColor || 0x4a4038,
        roughness: 0.92,
        metalness: 0.05,
        map: RealTextureFactory.rockColor(),
        normalMap: RealTextureFactory.rockNormal()
      });

      for (const idx of archIndices) {
        if (idx >= points.length - 2) continue;

        const pt = points[idx];
        const prev = points[Math.max(0, idx - 1)];
        const next = points[Math.min(points.length - 1, idx + 1)];
        const tangent = new THREE.Vector3().subVectors(next, prev).normalize();

        const archNode = new THREE.Group();
        archNode.position.copy(pt);
        archNode.position.y = pt.y + 0.12;

        const spanRadius = 8.8;
        const archHeight = 8.5;
        const archSegs = 14;

        const curvePts = [];
        for (let s = 0; s <= archSegs; s++) {
          const theta = Math.PI - (Math.PI * s / archSegs);
          const x = Math.cos(theta) * spanRadius;
          const y = Math.sin(theta) * archHeight;
          curvePts.push(new THREE.Vector3(x, y, 0));
        }

        const archSpline = new THREE.CatmullRomCurve3(curvePts);
        const tubeGeom = new THREE.TubeGeometry(archSpline, 18, 1.8, 8, false);
        const archMesh = new THREE.Mesh(tubeGeom, rockMat);
        archMesh.castShadow = true;
        archMesh.receiveShadow = false;

        archNode.add(archMesh);
        archNode.lookAt(archNode.position.clone().add(tangent));
        archGroup.add(archNode);
      }

      this.archGroup = archGroup;
      scene.add(archGroup);
      return archGroup;
    },


    buildSidewalkRange(u0, u1) {
      const group = new THREE.Group();
      group.name = 'Sidewalks';
      try {
        if (!CONFIG.SIDEWALK || !CONFIG.SIDEWALK.enabled || !this.curve) return group;
        const W = CONFIG.SIDEWALK.width, KERB = CONFIG.SIDEWALK.kerb;
        const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
        const len = this.curve.getLength();
        const STEP = 1.5;
        const n = Math.max(2, Math.ceil(((u1 - u0) * len) / STEP));
        const bankAtU = (u) => {
          const b = this.roadBankingAngles; if (!b || !b.length) return 0;
          const f = THREE.MathUtils.clamp(u, 0, 1) * (b.length - 1), i = Math.floor(f);
          return THREE.MathUtils.lerp(b[i] || 0, b[Math.min(i + 1, b.length - 1)] || 0, f - i);
        };
        // Footpath weathering (B155): the top surface is a textured paving-slab ribbon (3 columns so the
        // kerb side can be grimier than the middle); kerb stripes and faces are toned down so the
        // footpath no longer glows against the worn asphalt. Kill switch: localStorage.shiplyp_sidewalkWear = '0'.
        let wear = true; try { wear = localStorage.getItem('shiplyp_sidewalkWear') !== '0'; } catch (e) { /* default on */ }
        const paver = wear ? new THREE.Color(0xb3ada1) : new THREE.Color(0xbdb7ab), paver2 = wear ? new THREE.Color(0xa7a195) : new THREE.Color(0xb1ab9f);
        const kerbW = new THREE.Color(wear ? 0xcbc8be : 0xf2f2ee), kerbB = new THREE.Color(wear ? 0x2b2d32 : 0x1a1c20), kerbSide = new THREE.Color(wear ? 0x7d786e : 0x9a958b);
        const TILE = 1.2, paversTex = wear ? RealTextureFactory._get('sidewalkPavers', 'assets/textures/sidewalk_pavers.webp') : null;
        const up = new THREE.Vector3(0, 1, 0);
        [-1, 1].forEach((side) => {
          const pos = [], col = [];
          const tpos = [], tcol = [], tuv = [];
          let prev = null, runS = 0;
          // Textured top strip between two cross-sections: inner (kerb) -> middle -> outer, with
          // shading across the width and a slab texture whose v follows distance along the road.
          const topStrip = (pr, cu, f, tone) => {
            const pm = new THREE.Vector3().addVectors(pr.inTop, pr.outTop).multiplyScalar(0.5);
            const cm = new THREE.Vector3().addVectors(cu.inTop, cu.outTop).multiplyScalar(0.5);
            const uM = (W * 0.5) / TILE, uO = W / TILE, v0 = pr.s / TILE, v1 = cu.s / TILE;
            const V = (p, u, v, sh) => ({ p, u, v, c: tone.clone().multiplyScalar(sh) });
            const rows = [
              [V(pr.inTop, 0, v0, 0.80), V(cu.inTop, 0, v1, 0.80), V(cm, uM, v1, 1.0), V(pm, uM, v0, 1.0)],
              [V(pm, uM, v0, 1.0), V(cm, uM, v1, 1.0), V(cu.outTop, uO, v1, 0.9), V(pr.outTop, uO, v0, 0.9)]
            ];
            for (const [a, b, c, d] of rows) {
              // f: a=prev.in, b=cur.in, c=cur.out, d=prev.out; otherwise swap b/d so faces still point up
              const q = f ? [a, c, b, a, d, c] : [a, c, d, a, b, c];
              for (const v of q) { tpos.push(v.p.x, v.p.y, v.p.z); tcol.push(v.c.r, v.c.g, v.c.b); tuv.push(v.u, v.v); }
            }
          };
          const quad = (a, b, c, d, color) => {
            // reversed order: faces must point up / away from the road for lighting and raycasts
            [a, c, b, a, d, c].forEach((v) => { pos.push(v.x, v.y, v.z); col.push(color.r, color.g, color.b); });
          };
          for (let k = 0; k <= n; k++) {
            const u = u0 + (u1 - u0) * (k / n);
            if (this._inTunnelAtU(u, 2) || this._inJunctionAtU(u, 0.5)) { prev = null; continue; }
            const pt = this.curve.getPointAt(THREE.MathUtils.clamp(u, 0, 1));
            const tg = this.curve.getTangentAt(THREE.MathUtils.clamp(u, 0, 1)).setY(0).normalize();
            const nrm = new THREE.Vector3().crossVectors(tg, up).normalize();
            const edgeY = pt.y + 0.12 + side * roadHalf * Math.sin(bankAtU(u));
            const pIn = pt.clone().addScaledVector(nrm, side * roadHalf);
            const pOut = pt.clone().addScaledVector(nrm, side * (roadHalf + W));
            const groundOut = this.groundHeightAt(pt, pOut, side * (roadHalf + W));
            const cur = {
              inBot: new THREE.Vector3(pIn.x, edgeY - 0.02, pIn.z),
              inTop: new THREE.Vector3(pIn.x, edgeY + KERB, pIn.z),
              outTop: new THREE.Vector3(pOut.x, edgeY + KERB, pOut.z),
              outBot: new THREE.Vector3(pOut.x, Math.min(groundOut, edgeY) - 0.05, pOut.z)
            };
            if (prev) runS += prev.inTop.distanceTo(cur.inTop); cur.s = runS;
            if (prev) {
              // winding so faces point away from the road centre / upward
              const f = side > 0;
              const kerbCol = (k % 2) ? kerbW : kerbB;
              if (f) {
                quad(prev.inBot, cur.inBot, cur.inTop, prev.inTop, kerbCol);
                if (wear) topStrip(prev, cur, true, (k % 4 < 2) ? paver : paver2); else quad(prev.inTop, cur.inTop, cur.outTop, prev.outTop, (k % 4 < 2) ? paver : paver2);
                quad(prev.outTop, cur.outTop, cur.outBot, prev.outBot, kerbSide);
              } else {
                quad(prev.inBot, prev.inTop, cur.inTop, cur.inBot, kerbCol);
                if (wear) topStrip(prev, cur, false, (k % 4 < 2) ? paver : paver2); else quad(prev.inTop, prev.outTop, cur.outTop, cur.inTop, (k % 4 < 2) ? paver : paver2);
                quad(prev.outTop, prev.outBot, cur.outBot, cur.outTop, kerbSide);
              }
            }
            prev = cur;
          }
          if (!pos.length && !tpos.length) return;
          if (pos.length) {
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
            geom.computeVertexNormals();
            const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide }));
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            group.add(mesh);
          }
          if (tpos.length) {
            const tg = new THREE.BufferGeometry();
            tg.setAttribute('position', new THREE.Float32BufferAttribute(tpos, 3));
            tg.setAttribute('color', new THREE.Float32BufferAttribute(tcol, 3));
            tg.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
            tg.computeVertexNormals();
            const tm = new THREE.MeshStandardMaterial({ vertexColors: true, map: paversTex, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide });
            const top = new THREE.Mesh(tg, tm);
            top.receiveShadow = true;
            top.frustumCulled = false;
            top.userData.sidewalkTop = true;
            group.add(top);
          }
        });
      } catch (err) {
        console.error('buildSidewalkRange failed:', err);
      }
      return group;
    },

    // Pine zones (B159): conifers only on hills, broadleaf everywhere else, and never mixed along one stretch.
    // The road itself is cut into flat ground, so hilliness is read from the terrain 55 m out: per 25 m bin the
    // higher of the two sides' height above the road, averaged over +/-150 m (so a whole stretch reads as hill or
    // lowland, not side by side), then the top ~35% of the route is "hills". Threshold = 65th percentile of the
    // initial route, kept for streamed extensions. `side` is accepted but unused: both sides share the zone.

    getBarrierLateralDistance() {
      const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
      if (CONFIG.SIDEWALK && CONFIG.SIDEWALK.enabled) {
        return roadHalf + CONFIG.SIDEWALK.width - 0.10;
      }
      return CONFIG.ROAD_WIDTH * 0.5 + 2.0;
    },

    // Raised footpath with a painted kerb along both road edges, for the road
    // between arc-length fractions u0..u1. Skips tunnel bores. Returns a Group.

    _barrierStyleAt(pos) {
      try { if (localStorage.getItem('shiplyp_barrierVariety') !== '1') return CONFIG.BARRIER_STYLE; } catch (e) { return CONFIG.BARRIER_STYLE; }
      const cx = Math.floor(pos.x / 400), cz = Math.floor(pos.z / 400);
      let h = (Math.imul(cx | 0, 374761393) + Math.imul(cz | 0, 668265263)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const r = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      return r < 0.5 ? 0 : (r < 0.72 ? 1 : (r < 0.95 ? 2 : 3));
    },

    // Structures that need clear footpath edges and a flower border: buildings plus tea stalls, repair shops, garages and
    // other fence-gap sites. Cached; extended when new props appear (streamed chunks).
  });
})();
