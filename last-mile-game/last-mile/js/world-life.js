(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    CONFIG, PRNG, CourierAsset, CrowdAsset, CROSSING_AT_CLUSTER_CHANCE
  } = S;

  Object.assign(S.ProceduralWorld.prototype, {
    updateTraffic(dt) {
      // No-op: NPC traffic vehicles removed. Kept as a stable call target
      // (animate() still calls this every frame) rather than also editing
      // every call site.
    },

    // How far off the road centerline the vehicle may legally drift at
    // this point on the route, on the given side (+1/-1, matching the
    // same normal-direction convention `side` uses during fence
    // placement in createFoliageAndProps). Mirrors that exact placement
    // logic — same i%24/i%48 house-checkpoint math, same FENCE_GAP_RADIUS
    // — so the clamp only opens where a fence gap actually was left open,
    // and stays tight to the fence line everywhere else. The fences exist
    // specifically to mark "you can't get through here except at a
    // delivery house," so the vehicle needs to actually be stopped by
    // them, not just visually pass through.

    _pedestrianVariants() {
      if (this._pedVariants) return this._pedVariants;
      const tpl = CourierAsset.template;
      if (!tpl) return null;

      // Match on the base name: a re-export can hand back `Bodymat.002` when
      // duplicate datablocks existed, and an exact-name check would then miss
      // every slot and silently ship one uniform crowd.
      const slot = (n) => String(n || '').replace(/\.\d{3}$/, '');
      const src = {};
      tpl.traverse((c) => {
        if (c.isMesh && c.material && c.material.name && !src[slot(c.material.name)]) src[slot(c.material.name)] = c.material;
      });
      if (!Object.keys(src).length) return null;

      const SKIN   = [0xfff0e0, 0xf0d1ab, 0xd9a273, 0xc68a62, 0xa9714b, 0x8d5524];
      const TOP    = [0xd97706, 0x2563eb, 0x059669, 0xc2410c, 0xca8a04, 0xe7e5e4, 0x0f766e, 0x9f1239,
                      0x7c3aed, 0x0891b2, 0xb91c1c, 0x4338ca, 0x166534, 0xfbbf24, 0x64748b, 0xf472b6];
      const BOTTOM = [0x334155, 0x1e293b, 0x3f3f46, 0x6b7280, 0x854d0e, 0x475569, 0x1e3a5f, 0x44403c];
      const HAIR   = [0x121011, 0x1c1512, 0x3b2417, 0x5c3a21, 0x6b7280, 0xd6d3d1];
      const SHOES  = [0x2a2421, 0x1c1917, 0x44403c, 0x7c2d12, 0x1e293b, 0x78350f];

      // The crowd textures are dark (shirt about 25% bright, trousers 36%), and a colour is
      // multiplied onto them, so every outfit came out near-black. Brighten each slot's
      // texture once (cached) so the colours below read as picked. Only NPC copies are
      // changed; the template and the player's courier keep the original textures.
      const GAIN = { Topmat: 3.2, Bottommat: 2.3, Hairmat: 1.6, Shoesmat: 1.3, Bodymat: 1.3 };
      const lit = {};
      const lighten = (name, map) => {
        if (!map || !map.image || !GAIN[name]) return map;
        if (lit[name]) return lit[name];
        try {
          const im = map.image, cv = document.createElement('canvas');
          cv.width = im.width; cv.height = im.height;
          const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
          const d = cx.getImageData(0, 0, cv.width, cv.height), px = d.data, k = GAIN[name];
          for (let i = 0; i < px.length; i += 4) { px[i] = Math.min(255, px[i] * k); px[i + 1] = Math.min(255, px[i + 1] * k); px[i + 2] = Math.min(255, px[i + 2] * k); }
          cx.putImageData(d, 0, 0);
          const t = new THREE.CanvasTexture(cv);
          t.flipY = map.flipY; t.encoding = map.encoding; t.wrapS = map.wrapS; t.wrapT = map.wrapT; t.anisotropy = map.anisotropy;
          t.needsUpdate = true;
          return (lit[name] = t);
        } catch (e) { return map; }
      };

      const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
      const variants = [];
      for (let i = 0; i < 24; i++) {
        const set = {};
        const s1 = i * 7 + 3, s2 = i * 13 + 5, s3 = i * 11 + 7, s4 = i * 17 + 1, s5 = i * 19 + 9;
        for (const name in src) {
          const m = src[name].clone();
          m.map = lighten(name, m.map);
          if (name === 'Bodymat') m.color.set(pick(SKIN, s1));
          else if (name === 'Topmat') m.color.set(pick(TOP, s2));
          else if (name === 'Bottommat') m.color.set(pick(BOTTOM, s3));
          else if (name === 'Hairmat') m.color.set(pick(HAIR, s4));
          else if (name === 'Shoesmat') m.color.set(pick(SHOES, s5));
          set[name] = m;
        }
        variants.push(set);
      }
      this._pedVariants = variants;
      return variants;
    },

    // Rigged pedestrian, or null when courier-crowd.glb hasn't loaded yet.
    // A method rather than a closure local so the streaming builder can reach
    // it too — roadside pedestrians used to stop existing past the initial
    // spline entirely.

    // 40 pedestrian looks from the crowd part library: gender, outfit and colours picked from a
    // fixed seed, so the same looks come back every load. Each look is ONE merged skinned mesh
    // with its own tinted atlas. null while the library has not loaded (the old crowd is used).
    _crowdVariants() {
      if (this._crowdVars !== undefined) return this._crowdVars;
      if (!CrowdAsset || !CrowdAsset.template) return null;
      const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const SKIN = [0xffe3cc, 0xf0cba2, 0xd9a273, 0xc68a62, 0xa9714b, 0x8d5524, 0x74441f];
      const TOP_M = [0xd97706, 0x2563eb, 0x059669, 0xc2410c, 0xe7e5e4, 0x0f766e, 0x9f1239, 0x7c3aed, 0x0891b2, 0x4338ca, 0x64748b, 0xfbbf24, 0xf5f5f4, 0x7f1d1d];
      const TOP_F = [0xdb2777, 0x0d9488, 0xca8a04, 0x7c3aed, 0xdc2626, 0x16a34a, 0xf472b6, 0xea580c, 0x1d4ed8, 0xfde68a, 0xa21caf, 0xe11d48];
      const BOT_M = [0x334155, 0x1e293b, 0x3f3f46, 0x6b7280, 0x854d0e, 0x475569, 0x1e3a5f, 0x44403c, 0xd6d3d1];
      const BOT_F = [0x1e293b, 0x7f1d1d, 0x14532d, 0xb45309, 0x581c87, 0x0f766e, 0xbe185d, 0x334155, 0x92400e];
      const HAIR = [0x1a1412, 0x24180f, 0x3b2417, 0x4a3320, 0x6b7280, 0xd6d3d1];
      const SHOES = [0x2a2421, 0x1c1917, 0x44403c, 0x7c2d12, 0x1e293b, 0xe7e5e4, 0x78350f];
      const out = [];
      for (let i = 0; i < 40; i++) {
        const r = rng(1000 + i * 7919), pick = (a) => a[Math.floor(r() * a.length)];
        const female = r() < 0.42;
        const kurta = r() < (female ? 0.45 : 0.30);
        const top = kurta ? 'Top_Kurta_' : 'Top_Tee_';
        let bottom;
        if (female) { const q = r(); bottom = kurta ? 'Bottom_Long_F' : (q < 0.45 ? 'Bottom_Skirt_F' : q < 0.7 ? 'Bottom_Saree_F' : 'Bottom_Long_F'); }
        else bottom = (kurta || r() < 0.55) ? 'Bottom_Long_M' : 'Bottom_Shorts_M';
        const hair = female ? (r() < 0.5 ? 'Hair_Bun_F' : 'Hair_Long_F') : 'Hair_Short_M';
        const g = female ? 'F' : 'M';
        const names = ['Body_' + g, 'Shoes', top + g, bottom, hair].filter((n) => CrowdAsset.parts[n]);
        const topC = pick(female ? TOP_F : TOP_M);
        // a saree or skirt takes a colour that differs from the blouse, so the outfit reads as two pieces
        const botC = bottom.indexOf('Saree') >= 0 || bottom.indexOf('Skirt') >= 0 ? pick(TOP_F) : pick(female ? BOT_F : BOT_M);
        const tex = CrowdAsset.tintedTexture({ Body: pick(SKIN), Top: topC, Bottom: botC, Hair: pick(HAIR), Shoes: pick(SHOES) });
        const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, skinning: true });
        out.push({ geometry: CrowdAsset.geometryFor(names), material, female });
      }
      this._crowdVars = out;
      return out;
    },

    buildPedestrian() {
      let rig = null, crowd = null;
      const cv = this._crowdVariants();
      if (cv && cv.length) { crowd = cv[Math.floor(this.prng.range(0, cv.length))]; rig = CrowdAsset.build(crowd.geometry, crowd.material); }
      if (!rig) rig = CourierAsset.clone();
      if (!rig) return null;
      const root = rig.root;
      root.userData.mixer = rig.mixer;
      root.userData.actions = rig.actions;

      const variants = crowd ? null : this._pedestrianVariants();
      if (variants && variants.length) {
        const v = variants[Math.floor(this.prng.range(0, variants.length))];
        const slot = (n) => String(n || '').replace(/\.\d{3}$/, '');
        root.traverse((c) => {
          if (c.isMesh && c.material && v[slot(c.material.name)]) c.material = v[slot(c.material.name)];
        });
      }

      root.scale.setScalar(this.prng.range(0.92, 1.08));
      if (crowd && crowd.female) root.scale.multiply(new THREE.Vector3(0.93, 0.96, 0.93));
      const walk = rig.actions['Walking'];
      if (walk) {
        walk.setEffectiveTimeScale(this.prng.range(0.85, 1.2));
        walk.play();
      }
      // courier-crowd.glb's Walking clip has broken arm tracks: every
      // keyframe on the shoulders and upper arms is baked to the T-pose bind
      // quaternion (Shoulder tracks have 2 identical keyframes; Arm tracks
      // have 87 identical keyframes). Legs animate fine. The Idle clip has
      // proper "arms at sides" values on those same bones, so we cache those
      // as the base pose and add a procedural forward-back shoulder swing on
      // top per frame (see updateCrossers) to keep the walk from reading as
      // a stiff zombie shuffle.
      const idleClip = rig.actions['Idle']?.getClip();
      const armBase = [];
      let leftShoulder = null, rightShoulder = null;
      if (idleClip) {
        const boneMap = new Map();
        root.traverse((b) => { if (b.isBone) boneMap.set(b.name, b); });
        const trackFor = (boneName) => idleClip.tracks.find(t => t.name === `${boneName}.quaternion`);
        // Keep the upper arms and forearms fixed at Idle (their tracks in
        // Walking are also stuck on the bind pose, so overwriting them keeps
        // the elbow angle sensible). Shoulders get the swing on top.
        ['mixamorigLeftArm', 'mixamorigRightArm',
         'mixamorigLeftForeArm', 'mixamorigRightForeArm'].forEach((name) => {
          const bone = boneMap.get(name);
          const track = trackFor(name);
          if (bone && track && track.values.length >= 4) {
            armBase.push({
              bone,
              q: new THREE.Quaternion(track.values[0], track.values[1], track.values[2], track.values[3])
            });
          }
        });
        const shoulderEntry = (boneName, sign) => {
          const bone = boneMap.get(boneName);
          const track = trackFor(boneName);
          if (!bone || !track || track.values.length < 4) return null;
          return {
            bone,
            baseQ: new THREE.Quaternion(track.values[0], track.values[1], track.values[2], track.values[3]),
            sign
          };
        };
        // Left arm swings opposite to right (contralateral to the leg swing).
        leftShoulder = shoulderEntry('mixamorigLeftShoulder', 1);
        rightShoulder = shoulderEntry('mixamorigRightShoulder', -1);
      }
      root.userData.armBase = armBase;
      root.userData.leftShoulder = leftShoulder;
      root.userData.rightShoulder = rightShoulder;
      root.userData.armSwingPhase = Math.random() * Math.PI * 2;
      root.userData.hitRadius = 1.1;
      root.userData.walkSpeed = this.prng.range(1.0, 1.8);
      root.userData.isCrosser = true;
      return root;
    },


    // One cluster of pedestrians strolling the verge at a road sample.
    // Shared by the initial build and the streaming builder.

    spawnPedestrianCluster(pt, normal, tangent, count) {
      if (!this.foliageGroup) return 0;
      const clusterSize = count || Math.floor(this.prng.range(1, 4));
      let spawned = 0;
      for (let c = 0; c < clusterSize; c++) {
        const mesh = this.buildPedestrian();
        if (!mesh) break;

        const side = this.prng.next() > 0.5 ? 1 : -1;
        // On the sidewalk when there is one (road edge +0.35..1.35 m, clear of the
        // kerb and the guardrail at +2.2), otherwise behind the guardrail.
        const lat = (CONFIG.SIDEWALK && CONFIG.SIDEWALK.enabled)
          ? side * (CONFIG.ROAD_WIDTH * 0.52 + 0.35 + this.prng.range(0, 1.0))
          : side * (CONFIG.ROAD_WIDTH * 0.5 + 2.9 + this.prng.range(0, 1.6));
        const range = this.prng.range(14.0, 30.0);
        const jitter = this.prng.range(-18.0, 18.0);
        const dir = this.prng.next() > 0.5 ? 1 : -1;

        const startPos = pt.clone().addScaledVector(tangent, jitter - range * dir).addScaledVector(normal, lat);
        const endPos = pt.clone().addScaledVector(tangent, jitter + range * dir).addScaledVector(normal, lat);
        startPos.y = this.groundHeightAt(pt, startPos, lat) + 0.15;
        endPos.y = this.groundHeightAt(pt, endPos, lat) + 0.15;

        const progress = this.prng.next();
        mesh.position.lerpVectors(startPos, endPos, progress);
        mesh.position.y = this.groundHeightAt(pt, mesh.position, lat) + 0.15;
        mesh.lookAt(endPos.x, mesh.position.y, endPos.z);
        this.foliageGroup.add(mesh);

        // Follow the road's curve at a constant lateral offset (arc-length
        // metres, stable across streaming) instead of a straight chord, which
        // on bends drifted off the sidewalk onto the verge or toward the road.
        let along = null;
        const near = this.roadSpatialGrid ? this.roadSpatialGrid.getNearestRoadPoint(pt.x, pt.z, 6.0) : null;
        if (near && this.curve && this.roadSpacedPoints && this.roadSpacedPoints.length > 1) {
          const sMid = (near.index / (this.roadSpacedPoints.length - 1)) * this.curve.getLength() + jitter;
          along = { sA: sMid - range * dir, sB: sMid + range * dir, lat };
        }

        this.crossers.push({
          mesh,
          kind: 'pedestrian',
          start: startPos,
          end: endPos,
          pt: pt.clone(),
          normal: normal.clone(),
          latStart: lat,
          latEnd: lat,
          progress,
          speed: mesh.userData.walkSpeed * 0.75,
          hitRadius: mesh.userData.hitRadius,
          struck: false,
          legPhase: this.prng.next() * Math.PI * 2,
          pathLen: along ? Math.abs(along.sB - along.sA) : startPos.distanceTo(endPos),
          along
        });
        spawned++;
      }
      // B132: occasionally also offer a signalled crossing where a group of
      // pedestrians walks (~15% more crossings overall). Same placement rules
      // (tryPlaceCrossingNear: spacing, straight/unbanked, no tunnels). The
      // gate is a hash of the position, not this.prng, so it doesn't shift
      // the rest of the world layout.
      if (spawned > 0) {
        const h = Math.sin(pt.x * 12.9898 + pt.z * 78.233) * 43758.5453;
        if (h - Math.floor(h) < CROSSING_AT_CLUSTER_CHANCE) this.tryPlaceCrossingNear(pt);
      }
      return spawned;
    },

    // Zebra crossing + signal post at a road position.
    //
    // Placed from a WORLD point rather than a loop index on purpose: the
    // initial build walks getSpacedPoints(800) while the road frames
    // (roadNormals / roadBankedUp / roadSpacedPoints) are indexed by a
    // different, denser sampling, and the streaming builder uses a third. The
    // spatial grid maps a position back to the right frame index for all of
    // them.
    // Fence gaps: only in front of tea stalls, delivery houses, repair shops and
    // at zebra crossings. `side` is the road side (+1/-1) of the opening, or 0
    // for both sides. Streamed fence pieces already emitted in the gap are removed.

    tryPlaceCrossingNear(roadPt) {
      try {
        if (!this.roadSpatialGrid || !this.roadSpacedPoints || !this.roadBankingAngles) return null;
        const MIN_SPACING = 185.0; // B132: was 220 (~15% more crossings, same site rules)
        this.crossingSites = this.crossingSites || [];
        if (this.crossingSites.some((p) => p.distanceTo(roadPt) < MIN_SPACING)) return null;
        const near = this.roadSpatialGrid.getNearestRoadPoint(roadPt.x, roadPt.z, 14.0);
        if (!near || near.index == null) return null;
        const i = near.index, pts = this.roadSpacedPoints, b = this.roadBankingAngles;
        const span = Math.max(2, Math.round(15.0 / Math.max(0.5, pts[1] ? pts[0].distanceTo(pts[1]) : 5)));
        for (let k = i - span; k <= i + span; k++) {
          if (k < 1 || k >= pts.length - 1) return null;
          if (Math.abs(b[k] || 0) > 0.05) return null;
        }
        const meshIdx = Math.round((i / (pts.length - 1)) * CONFIG.ROAD_MESH_SEGMENTS);
        if (this.isInTunnelZone && this.isInTunnelZone(meshIdx, 6)) return null;
        const crossing = this.buildZebraCrossing(roadPt, null);
        if (crossing !== null) this.crossingSites.push(roadPt.clone());
        return crossing;
      } catch (err) {
        console.error('tryPlaceCrossingNear failed:', err);
        return null;
      }
    },


    buildZebraCrossing(worldPt, scene) {
      if (!this.roadSpatialGrid || !this.roadSpacedPoints || !this.roadNormals) return null;
      const near = this.roadSpatialGrid.getNearestRoadPoint(worldPt.x, worldPt.z, 14.0);
      if (!near || near.index == null) return null;
      const i = near.index;
      const pts = this.roadSpacedPoints;
      if (i < 1 || i >= pts.length - 1) return null;

      const pt = pts[i];
      const normal = this.roadNormals[i];
      const binormal = this.roadBinormals[i];
      const bankedUp = this.roadBankedUp[i];
      if (!normal || !binormal || !bankedUp) return null;
      const bankingAngle = this.roadBankingAngles[i] || 0;
      const bankedNormal = normal.clone().multiplyScalar(Math.cos(bankingAngle))
        .addScaledVector(binormal, Math.sin(bankingAngle)).normalize();
      const tangent = new THREE.Vector3().subVectors(pts[i + 1], pts[i - 1]).normalize();

      // Same 0.12 slab lift + paint clearance the lane markings use; anything
      // less z-fights with the asphalt.
      const LIFT = 0.12 + 0.02;
      const DEPTH = 4.0;
      const STRIPE_W = 0.55;
      const PERIOD = 1.0;
      const roadHalf = CONFIG.ROAD_WIDTH * 0.5;

      const positions = [];
      const indices = [];
      let v = 0;
      // B132: each stripe is split along its depth and every vertex is set on
      // the rendered road surface (+2.5 cm). A single flat quad at pt's height
      // sank under the road's crown and vertical curve, so only fragments of
      // the paint showed and the crossing was hard to see from any distance.
      const SEGS = 4;
      const wp = new THREE.Vector3();
      for (let lat = -roadHalf + 0.35; lat <= roadHalf - STRIPE_W - 0.3; lat += PERIOD) {
        for (let k = 0; k <= SEGS; k++) {
          const dDepth = -1 + 2 * k / SEGS;
          for (const dLat of [0, STRIPE_W]) {
            // Built LOCAL to pt, with the mesh positioned there below. World-space
            // verts on an object still sitting at the origin make
            // updateFoliageVisibility measure distance from (0,0,0), which culled
            // every crossing the instant it was added.
            const p = new THREE.Vector3()
              .addScaledVector(bankedNormal, lat + dLat)
              .addScaledVector(tangent, dDepth * DEPTH * 0.5)
              .addScaledVector(bankedUp, LIFT);
            wp.copy(pt).add(p);
            const surf = this.surfaceHeightNear ? this.surfaceHeightNear(wp, pt, lat + dLat) : null;
            if (Number.isFinite(surf)) p.y = Math.max(p.y, surf + 0.025 - pt.y);
            positions.push(p.x, p.y, p.z);
          }
          if (k > 0) indices.push(v - 2, v - 1, v + 1, v - 2, v + 1, v);
          v += 2;
        }
      }
      if (!positions.length) return null;

      // One merged geometry per crossing — a mesh per stripe would be seven
      // extra draw calls for a few square metres of paint.
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setIndex(indices);
      geom.computeVertexNormals();
      const zebra = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
        color: 0xd0d4da, side: THREE.DoubleSide, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      }));
      zebra.renderOrder = 1;
      zebra.position.copy(pt);
      // B132: drawn out to the landmark range (750 m) like the signal post,
      // instead of popping in at the 350 m minor-prop cull.
      zebra.userData._foliageBox = 20;
      (this.foliageGroup || scene).add(zebra);
      this.addFenceGap(pt, normal, 0, 4.0);

      // Signal post on the verge.
      const side = this.prng.next() > 0.5 ? 1 : -1;
      const postLat = side * (roadHalf + 1.4);
      // B176: stand the post beside the crossing's end, not on its centre line - that line is also the axis of the house
      // gate/path the crossing was placed for (houses call tryPlaceCrossingNear), so a post there blocks the entrance.
      const postPos = pt.clone().addScaledVector(normal, postLat).addScaledVector(tangent, side * 4.3);
      postPos.y = this.groundHeightAt(pt, postPos, postLat);

      const post = new THREE.Group();
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x3f4550, roughness: 0.7, metalness: 0.3 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 3.1, 8), poleMat);
      pole.position.y = 1.55;
      post.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.8 }));
      head.position.y = 3.15;
      post.add(head);

      // Unlit base colours stay dark so an off lamp never crosses the 0.94
      // bloom threshold; the lit one is driven by emissive, same as the
      // vehicle headlight/taillight lenses.
      // B132: the head faces along the road (both directions) instead of
      // across it, so approaching riders see the lamps rather than the side
      // of the box. A thin backplate in the head's plane frames the lamps
      // from either side against sky and trees.
      const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.98, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.9 }));
      backplate.position.set(0, 3.15, 0);
      post.add(backplate);
      const lampGeom = new THREE.SphereGeometry(0.095, 10, 8);
      const lamps = [];
      [['red', 0xff3b30, 0.30], ['amber', 0xffb300, 0.0], ['green', 0x27d17c, -0.30]].forEach(([name, hex, dy]) => {
        // fog:false so the lamp colour still reads through haze at distance.
        const mat = new THREE.MeshStandardMaterial({ color: 0x14161a, emissive: hex, emissiveIntensity: 0.0, roughness: 0.4, fog: false });
        for (const face of [1, -1]) {
          const lamp = new THREE.Mesh(lampGeom, mat);
          lamp.position.set(0, 3.15 + dy, 0.13 * face);
          post.add(lamp);
        }
        lamps.push({ name, mat, hex });
      });

      post.scale.setScalar(1.4); // B132: ~1.4x so it reads from a distance (not a giant)
      post.userData._foliageBox = 20;  // landmark range, same as before (5+ children)
      post.position.copy(postPos);
      post.lookAt(postPos.x + tangent.x, postPos.y, postPos.z + tangent.z);
      (this.foliageGroup || scene).add(post);
      this.obstacles.push({ pos: postPos.clone(), radius: 0.7, type: 'pole' });

      const signal = {
        lamps,
        phase: Math.floor(this.prng.range(0, 3)), // staggered so a route isn't in lockstep
        t: this.prng.range(0, 4),
        durations: [11.0, 2.5, 8.0] // GO, AMBER, STOP(+walk)
      };
      this.trafficSignals = this.trafficSignals || [];
      this.trafficSignals.push(signal);
      this.crossingInfo = this.crossingInfo || [];
      const crossingEntry = { s: (i / (pts.length - 1)) * this.curve.getLength(), signal, pt: pt.clone() };
      this.crossingInfo.push(crossingEntry);
      this._applySignalPhase(signal);

      // Two pedestrians waiting at the kerb, one each side. They run the same
      // wander brain as the roadside walkers (_stepWanderer), starting in
      // 'waitSignal': cross once on the STOP phase, then carry on along the
      // far sidewalk — left, right, or to a house / tea stall / garage —
      // instead of shuttling back and forth over the same crossing.
      const walkLat = (CONFIG.SIDEWALK && CONFIG.SIDEWALK.enabled)
        ? CONFIG.ROAD_WIDTH * 0.52 + 0.85
        : roadHalf + 1.6;
      for (let k = 0; k < 2; k++) {
        const mesh = this.buildPedestrian();
        if (!mesh) break;
        const latA = walkLat * (k === 0 ? 1 : -1);
        const depthOff = this.prng.range(-1.2, 1.2);
        const sHere = crossingEntry.s + depthOff;
        const startPos = new THREE.Vector3();
        this._alongPoint(sHere, latA, startPos);
        const endPos = new THREE.Vector3();
        this._alongPoint(sHere, -latA, endPos);
        startPos.y = this.surfaceHeightNear(startPos, pt, latA) + 0.02;
        endPos.y = startPos.y;
        mesh.position.copy(startPos);
        mesh.lookAt(endPos.x, mesh.position.y, endPos.z);
        (this.foliageGroup || scene).add(mesh);
        this.crossers.push({
          mesh, kind: 'pedestrian', start: startPos, end: endPos,
          pt: pt.clone(), normal: normal.clone(),
          latStart: latA, latEnd: latA, progress: 1,
          speed: mesh.userData.walkSpeed * 0.9,
          hitRadius: mesh.userData.hitRadius, struck: false,
          legPhase: this.prng.next() * Math.PI * 2,
          pathLen: 0.5,
          along: { sA: sHere, sB: sHere, lat: latA },
          wander: { mode: 'waitSignal', crossing: crossingEntry }
        });
      }
      return signal;
    },


    _applySignalPhase(s) {
      const lit = s.phase === 0 ? 'green' : (s.phase === 1 ? 'amber' : 'red');
      // B132: off lamps glow faintly so all three read as a signal head; the
      // lit one is clearly brighter (and blooms in the cinematic style).
      for (const l of s.lamps) l.mat.emissiveIntensity = (l.name === lit) ? 1.8 : 0.12;
    },


    updateTrafficSignals(dt) {
      if (!this.trafficSignals) return;
      for (let i = 0; i < this.trafficSignals.length; i++) {
        const s = this.trafficSignals[i];
        s.t += dt;
        if (s.t >= s.durations[s.phase]) {
          s.t = 0;
          s.phase = (s.phase + 1) % 3;
          this._applySignalPhase(s);
        }
      }
    },

    // Tea-stall patrons stand still, so they aren't crossers and updateCrossers
    // never sees them — but their Idle clip still needs stepping. Same distance
    // cull as the strollers so a route's worth of stalls isn't skinning rigs
    // kilometres behind the car.

    updatePatrons(dt, vehiclePos) {
      if (!this.patrons || !this.patrons.length) return;
      const CULL_SQ = 130 * 130;
      const tmp = new THREE.Vector3();
      for (let i = 0; i < this.patrons.length; i++) {
        const p = this.patrons[i];
        p.obj.getWorldPosition(tmp);
        const near = tmp.distanceToSquared(vehiclePos) < CULL_SQ;
        p.obj.visible = near;
        if (near) p.mixer.update(dt);
      }
    },

    // Walking vs standing clip for a rigged pedestrian (no-op if already set).

    _setWalkAnim(c, walking) {
      if (c._animWalking === walking) return;
      c._animWalking = walking;
      const a = (c.mesh.userData && c.mesh.userData.actions) || {};
      if (a.Walking && a.Idle) {
        if (walking) { a.Idle.fadeOut(0.25); a.Walking.paused = false; a.Walking.reset().fadeIn(0.25).play(); }
        else { a.Walking.fadeOut(0.25); a.Idle.reset().fadeIn(0.25).play(); }
      } else if (a.Walking) {
        a.Walking.paused = !walking;
      }
    },

    // Which side of the road (+1/-1, tangent x up convention) `pos` is on,
    // relative to the road point nearest `roadPt`.

    _sideOf(roadPt, pos) {
      const pts = this.roadSpacedPoints;
      const near = (this.roadSpatialGrid && pts && pts.length > 2) ? this.roadSpatialGrid.getNearestRoadPoint(roadPt.x, roadPt.z, 8.0) : null;
      if (!near) return 0;
      const i = Math.min(near.index, pts.length - 2);
      const tx = pts[i + 1].x - pts[i].x, tz = pts[i + 1].z - pts[i].z, tl = Math.hypot(tx, tz) || 1;
      return Math.sign((pos.x - near.point.x) * (-tz / tl) + (pos.z - near.point.z) * (tx / tl));
    },

    // Somewhere a roadside pedestrian can walk to: kind 'stall' | 'house' | 'shop'.
    // `pos` may be a live Vector3 (a delivery house's ring target moves if its
    // model swaps in after load).

    addPedDestination(kind, roadPt, pos, facePos) {
      const s = this._arcS(roadPt);
      const side = this._sideOf(roadPt, pos);
      if (s === null || !side) return;
      this.pedDestinations = this.pedDestinations || [];
      this.pedDestinations.push({ kind, s, side, pos, facePos: facePos || null });
    },

    // Arc-length (metres) of the road point nearest `pos`.

    _arcS(pos) {
      const pts = this.roadSpacedPoints;
      const near = (this.roadSpatialGrid && pts && pts.length > 1) ? this.roadSpatialGrid.getNearestRoadPoint(pos.x, pos.z, 20.0) : null;
      return near ? (near.index / (pts.length - 1)) * this.curve.getLength() : null;
    },


    _alongPoint(s, lat, out) {
      const u = THREE.MathUtils.clamp(s / this.curve.getLength(), 0, 1);
      const p = this.curve.getPointAt(u);
      const tg = this.curve.getTangentAt(u);
      const tl = Math.hypot(tg.x, tg.z) || 1;
      out.set(p.x + (-tg.z / tl) * lat, p.y, p.z + (tg.x / tl) * lat);
      return { tx: tg.x / tl, tz: tg.z / tl };
    },

    // Roadside pedestrian brain. At the end of each stretch of sidewalk they
    // pick: keep walking, turn back, pause and look around, visit a nearby tea
    // stall (walk up to the counter, stand a while, come back), or use a nearby
    // zebra crossing (wait for the STOP phase, cross, carry on the other side).

    _stepWanderer(c, dt) {
      const W = c.wander || (c.wander = { mode: 'walk' });
      const A = c.along;
      const tmp = this._wanderTmp || (this._wanderTmp = new THREE.Vector3());
      const face = (dx, dz) => { if (dx || dz) c.mesh.rotation.set(0, Math.atan2(dx, dz), 0); };
      const startFree = (to, mode, next) => {
        W.from = c.mesh.position.clone(); W.to = to.clone(); W.t = 0;
        W.dist = Math.max(0.1, Math.hypot(to.x - W.from.x, to.z - W.from.z));
        W.mode = mode; W.next = next;
      };
      const walkTo = (sTarget, then) => {
        const sCur = THREE.MathUtils.lerp(A.sA, A.sB, THREE.MathUtils.clamp(c.progress, 0, 1));
        // Stay on the built road: past either end _alongPoint clamps, and the
        // walker would tread in place there forever.
        const sMax = this.curve.getLength() - 5;
        A.sA = sCur; A.sB = THREE.MathUtils.clamp(sTarget, 5, Math.max(5, sMax)); c.progress = 0;
        c.pathLen = Math.max(0.5, Math.abs(A.sB - A.sA));
        W.mode = 'walk'; W.then = then;
      };
      // Walk off left or right along the sidewalk, reversing if that way
      // runs out of road.
      const stroll = (d) => {
        const sCur = A.sB;
        const len = 20 + Math.random() * 30;
        const sMax = this.curve.getLength() - 5;
        if (sCur + d * len > sMax || sCur + d * len < 5) d = -d;
        walkTo(sCur + d * len, null);
      };
      // `moveOn`: just crossed, or just left a stall/house/garage. They carry
      // on with their journey (left, right, or another place) — never stand
      // around on the kerb, and never cross straight back.
      const chooseNext = (moveOn = false) => {
        const sCur = A.sB;
        const dir = Math.sign(A.sB - A.sA) || 1;
        const side = Math.sign(A.lat) || 1;
        // Nearby places on this side of the road (houses, tea stalls, repair
        // shops, motor garages), not the one just visited.
        const dests = (this.pedDestinations || []).filter((d) => d.side === side && Math.abs(d.s - sCur) < 90 && d !== W.lastDest);
        const crossing = moveOn ? null : (this.crossingInfo || []).find((ci) => Math.abs(ci.s - sCur) < 70 && ci !== W.lastCrossing);
        const r = Math.random();
        if (dests.length && r < 0.5) {
          W.dest = dests[Math.floor(Math.random() * dests.length)];
          walkTo(W.dest.s, 'dest'); return;
        }
        if (moveOn) { stroll(Math.random() < 0.5 ? 1 : -1); return; }
        if (crossing && r < 0.65) { W.crossing = crossing; walkTo(crossing.s, 'cross'); return; }
        if (r < 0.7 && !W.pausedLast) { W.mode = 'idle'; W.pausedLast = true; W.timer = 1 + Math.random() * 2; W.then = null; return; }
        W.pausedLast = false;
        stroll(r < 0.8 ? -dir : dir);
      };
      const arriveWalk = () => {
        const then = W.then; W.then = null;
        if (then === 'dest' && W.dest) {
          W.returnPos = c.mesh.position.clone();
          startFree(W.dest.pos, 'toStall', null);
        } else if (then === 'cross' && W.crossing) {
          W.mode = 'waitSignal';
          this._alongPoint(A.sB, -A.lat, tmp);
          face(tmp.x - c.mesh.position.x, tmp.z - c.mesh.position.z);
        } else {
          chooseNext();
        }
      };

      switch (W.mode) {
        case 'walk': {
          this._setWalkAnim(c, true);
          c.progress += (c.speed * dt) / (c.pathLen || 1);
          if (c.progress >= 1) { c.progress = 1; arriveWalk(); }
          const s = THREE.MathUtils.lerp(A.sA, A.sB, THREE.MathUtils.clamp(c.progress, 0, 1));
          const t = this._alongPoint(s, A.lat, tmp);
          c.mesh.position.x = tmp.x; c.mesh.position.z = tmp.z;
          const f = Math.sign(A.sB - A.sA) || 1;
          if (W.mode === 'walk') face(f * t.tx, f * t.tz);
          break;
        }
        case 'idle':
        case 'atStall': {
          this._setWalkAnim(c, false);
          W.timer -= dt;
          if (W.timer <= 0) {
            if (W.mode === 'atStall') { W.lastDest = W.dest; W.inside = false; startFree(W.returnPos, 'fromStall', null); }
            else chooseNext();
          }
          break;
        }
        case 'waitSignal': {
          this._setWalkAnim(c, false);
          const sig = W.crossing && W.crossing.signal;
          if (!sig || sig.phase === 2) {
            const sHere = A.sB;
            this._alongPoint(sHere, -A.lat, tmp);
            startFree(tmp, 'crossing', null);
          }
          break;
        }
        case 'toStall':
        case 'fromStall':
        case 'crossing': {
          this._setWalkAnim(c, true);
          W.t += (c.speed * dt) / W.dist;
          const k = Math.min(1, W.t);
          c.mesh.position.x = THREE.MathUtils.lerp(W.from.x, W.to.x, k);
          c.mesh.position.z = THREE.MathUtils.lerp(W.from.z, W.to.z, k);
          face(W.to.x - W.from.x, W.to.z - W.from.z);
          if (k >= 1) {
            if (W.mode === 'toStall') {
              W.mode = 'atStall';
              const k = W.dest.kind;
              // Houses: go inside for a while (hidden), then come back out.
              W.inside = (k === 'house');
              W.timer = k === 'house' ? 15 + Math.random() * 30 : (k === 'shop' ? 5 + Math.random() * 8 : 6 + Math.random() * 10);
              if (W.dest.facePos) face(W.dest.facePos.x - c.mesh.position.x, W.dest.facePos.z - c.mesh.position.z);
            } else if (W.mode === 'crossing') {
              A.lat = -A.lat; A.sA = A.sB; W.lastCrossing = W.crossing; chooseNext(true);
            } else {
              chooseNext(true);
            }
          }
          break;
        }
        default:
          W.mode = 'walk';
      }
    },


    updateCrossers(dt) {
      // Crossers beyond 130m are sub-2px tall and fully occluded by fog.
      // Skip expensive per-limb trig math and matrix updates beyond that
      // threshold — patrol progress still advances so they don't teleport
      // when re-entering range. Empirically this was the single largest
      // win: frame time 27.18ms → 17.70ms (35% speedup) before any other
      // change.
      const vehiclePos = this._vehiclePos || (this._vehiclePos = new THREE.Vector3());
      if (this._game && this._game.vehicle && this._game.vehicle.mesh) {
        vehiclePos.copy(this._game.vehicle.mesh.position);
      }
      const CULL_DIST_SQ = 130 * 130;

      for (let i = this.crossers.length - 1; i >= 0; i--) {
        const c = this.crossers[i];
        if (c.struck) continue; // frozen at impact position until cleanup below

        // Signalled crossers wait at the kerb unless their light says STOP
        // (phase 2). One already off the kerb keeps going regardless — a
        // pedestrian stranded mid-carriageway when the light changes is worse
        // than one who finishes the crossing. Holds the walk cycle and the
        // progress only; position and culling below still run, or a waiting
        // pedestrian would never become visible again once culled.
        let curLat = c.latStart;
        if (c.along && this.curve) {
          this._stepWanderer(c, dt);
        } else {
        let hold = false;
        if (c.signal) {
          const midCrossing = c.progress > 0.02 && c.progress < 0.98;
          hold = (c.signal.phase !== 2 && !midCrossing);
          // Stand (Idle clip) while waiting instead of freezing mid-stride.
          this._setWalkAnim(c, !hold);
        }

        if (!hold) {
          c.progress += (c.speed * dt) / (c.pathLen || (c.pathLen = c.start.distanceTo(c.end)));
        }
        if (c.progress >= 1.0) {
          // Reached the far side — walk back the other way so the same
          // crosser keeps patrolling instead of despawning mid-street.
          c.progress = 0;
          const tmp = c.start;
          c.start = c.end;
          c.end = tmp;
          const tmpLat = c.latStart;
          c.latStart = c.latEnd;
          c.latEnd = tmpLat;
          if (c.along) { const t2 = c.along.sA; c.along.sA = c.along.sB; c.along.sB = t2; }
          // flatten: an un-flattened lookAt on sloped terrain pitches/rolls the
          // whole figure (see the lookAt-tilt pattern used throughout).
          c.mesh.lookAt(c.end.x, c.mesh.position.y, c.end.z);
        }

        // X/Z still lerp in a straight line (fine — that's genuinely
        // straight in world space), but Y is recomputed from the current
        // lateral offset via the shared ground formula rather than lerped
        // between the two endpoint heights, which cut through the road
        // surface whenever the true profile between them isn't flat.
        curLat = THREE.MathUtils.lerp(c.latStart, c.latEnd, c.progress);
        c.mesh.position.x = THREE.MathUtils.lerp(c.start.x, c.end.x, c.progress);
        c.mesh.position.z = THREE.MathUtils.lerp(c.start.z, c.end.z, c.progress);
        }

        // Distance cull: skip expensive limb-swing math for far-away crossers.
        const distSq = vehiclePos.distanceToSquared(c.mesh.position);
        if (distSq > CULL_DIST_SQ) {
          c.mesh.visible = false;
          continue;
        }
        c.mesh.visible = !(c.wander && c.wander.inside);

        // Ground height must come from the road point nearest to where the
        // walker IS, not c.pt (its spawn point): roadside walkers patrol up to
        // ~50m along the road, and on a grade the spawn point's height is
        // metres off there, so they floated or sank.
        let footY;
        try {
          footY = this.surfaceHeightNear(c.mesh.position, c.pt, curLat);
        } catch (err) {
          console.error('Crosser ground height failed:', err);
          footY = this.groundHeightAt(c.pt, c.mesh.position, curLat);
        }
        c.mesh.position.y = footY + 0.02;

        if (c.mesh.userData.mixer) {
          // Animation LOD: skinning a 67-bone rig is the expensive half, and
          // past ~40m nobody can read a gait cycle. Step distant rigs every
          // third frame with the accumulated dt so they still move, at a third
          // of the cost — this is the cheapest headroom available on mobile.
          if (distSq < 1600) {
            c.mesh.userData.mixer.update(dt);
          } else {
            c._lodAccum = (c._lodAccum || 0) + dt;
            c._lodTick = ((c._lodTick || 0) + 1) % 3;
            if (c._lodTick === 0) {
              c.mesh.userData.mixer.update(c._lodAccum);
              c._lodAccum = 0;
            }
          }
          // T-pose arm fix (see buildPedestrian for why): pin the upper
          // arms/forearms to their Idle-clip pose and drive the shoulders
          // with a procedural forward/back swing on top of Idle's base
          // quaternion, so walking pedestrians don't shuffle stiff-armed.
          const armBase = c.mesh.userData.armBase;
          if (armBase && armBase.length) {
            for (let a = 0; a < armBase.length; a++) {
              armBase[a].bone.quaternion.copy(armBase[a].q);
            }
          }
          const ls = c.mesh.userData.leftShoulder;
          const rs = c.mesh.userData.rightShoulder;
          if (ls && rs) {
            // Sync roughly with the leg cadence (~1.6 Hz walk cycle).
            c.mesh.userData.armSwingPhase += dt * 5.0;
            const swing = Math.sin(c.mesh.userData.armSwingPhase) * 0.42;
            const swingQ = this._swingQ || (this._swingQ = new THREE.Quaternion());
            // Pre-multiply the swing onto the base quaternion so the rotation
            // is applied in the parent (spine) frame, not the bone's local
            // frame. In spine space, X is left/right, so a rotation about X
            // swings the whole arm forward/back rather than pendulum-side.
            const axis = this._swingAxis || (this._swingAxis = new THREE.Vector3(1, 0, 0));
            swingQ.setFromAxisAngle(axis, swing * ls.sign);
            ls.bone.quaternion.multiplyQuaternions(swingQ, ls.baseQ);
            swingQ.setFromAxisAngle(axis, swing * rs.sign);
            rs.bone.quaternion.multiplyQuaternions(swingQ, rs.baseQ);
          }
        } else {
          c.legPhase += dt * 9.0;
          const swing = Math.sin(c.legPhase) * 0.35;
          if (c.mesh.userData.legs) {
            c.mesh.userData.legs.forEach((leg, idx) => {
              leg.rotation.x = (idx % 2 === 0 ? swing : -swing);
            });
          }
          if (c.mesh.userData.arms) {
            c.mesh.userData.arms.forEach((arm, idx) => {
              arm.rotation.x = (idx % 2 === 0 ? -swing * 0.8 : swing * 0.8);
            });
          }
        }
      }
    },

    // Infinite Highway Streaming Engine (Slow Roads Parity)
    // Dynamic foliage distance envelope — throttled every 10 frames (~160ms).
    // Minor roadside props beyond 350m and skyscrapers beyond 750m are invisible
    // inside atmospheric fog (density 0.003–0.005). Hiding them from Three.js's
    // CPU frustum traversal dropped frame time by ~4.5ms in profiling.
    // Call once per frame from Game.animate(); the frame-skip guard makes it
    // effectively free every other 9 frames.
  });
})();
