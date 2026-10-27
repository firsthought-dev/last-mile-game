(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};

  function barrierPostStations(len, offA, offB) {
    const n = Math.max(1, Math.ceil(len / 3.2));
    const out = [];
    for (let k = 0; k < n; k++) {
      const f = k / n;
      out.push([-len / 2 + len * f, offA + (offB - offA) * f]);
    }
    return out;
  }

  // Splits one big instanced batch into spatial chunks so the renderer can cull
  // each chunk on its own. A single InstancedMesh is culled as one object, so a
  // km-long scatter of rocks or guardrail posts was drawn in full every frame,
  // including the parts behind the camera (B145). Chunks share the source
  // geometry's GPU buffers; only the bounding sphere differs per chunk.
  function addChunkedInstances(parent, geom, mat, matrices, { cell = 320, castShadow = false, onChunk = null } = {}) {
    if (!matrices.length) return [];
    if (!geom.boundingSphere) geom.computeBoundingSphere();
    const baseR = geom.boundingSphere.radius, baseC = geom.boundingSphere.center;
    const cells = new Map();
    const p = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion();
    matrices.forEach((m) => {
      m.decompose(p, q, sc);
      const key = Math.floor(p.x / cell) + ',' + Math.floor(p.z / cell);
      let c = cells.get(key); if (!c) { c = []; cells.set(key, c); }
      c.push(m);
    });
    const meshes = [];
    cells.forEach((list) => {
      const sub = new THREE.BufferGeometry();
      Object.keys(geom.attributes).forEach((k) => sub.setAttribute(k, geom.attributes[k]));
      if (geom.index) sub.setIndex(geom.index);
      sub.groups = geom.groups;
      sub.userData.sourceType = geom.type;
      // Bounding sphere around every instance of this chunk.
      const box = new THREE.Box3(), pt = new THREE.Vector3();
      let maxScale = 1;
      list.forEach((m) => { m.decompose(p, q, sc); pt.copy(baseC).applyMatrix4(m); box.expandByPoint(pt); maxScale = Math.max(maxScale, sc.x, sc.y, sc.z); });
      const sph = new THREE.Sphere(); box.getBoundingSphere(sph);
      sph.radius += baseR * maxScale;
      sub.boundingSphere = sph;
      const mesh = new THREE.InstancedMesh(sub, mat, list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = castShadow;
      mesh.frustumCulled = true;
      if (onChunk) onChunk(mesh, list);
      parent.add(mesh);
      meshes.push(mesh);
    });
    return meshes;
  }

  // Road paint (B149). One set of numbers and one builder (`_buildLaneRibbon`) for BOTH the
  // initial road and the streamed extension, so the two can never drift apart again.
  // Widths are deliberately wider than real paint (10-15 cm): at 12 cm the dashes were
  // sub-pixel beyond a few metres and only "appeared" as the player rode up to them.
  const LANE_PAINT = {
    centreHalfW: 0.17, edgeHalfW: 0.10,        // metres, half-width
    centre: 0xd6c36e, edge: 0xb4bac2,          // pale, to stay under the bloom threshold
    dashOn: 3.0, dashPeriod: 8.0               // metres along the road
  };

  function buildBarrierGeometries() {
    const alongX = (shape, halfLen = 0.5) => {
      // extrude a YZ-plane profile (shape x = depth z, shape y = height) along X
      const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1 });
      g.rotateY(Math.PI / 2);
      g.translate(-halfLen, 0, 0);
      g.computeVertexNormals();
      return g;
    };
    // Galvanised W-beam: two ridges, 0.31 m tall, sheet ~8 mm thick.
    const wOuter = [], wInner = [];
    const W_H = 0.31, W_D = 0.085, T = 0.008, N = 24;
    for (let k = 0; k <= N; k++) {
      const y = -W_H / 2 + W_H * k / N;
      const z = W_D * 0.5 * (1 - Math.cos((k / N) * Math.PI * 4)) * 0.5;
      wOuter.push(new THREE.Vector2(z, y));
      wInner.push(new THREE.Vector2(z - T, y));
    }
    const wShape = new THREE.Shape([...wOuter, ...wInner.reverse()]);
    const armcoRail = alongX(wShape);
    // I-section steel post, 1.4 m tall (1.1 m above ground, 0.3 m embedded into pavement/ground).
    const iShape = new THREE.Shape([
      [-0.05, -0.05], [0.05, -0.05], [0.05, -0.04], [0.008, -0.04], [0.008, 0.04], [0.05, 0.04],
      [0.05, 0.05], [-0.05, 0.05], [-0.05, 0.04], [-0.008, 0.04], [-0.008, -0.04], [-0.05, -0.04]
    ].map(([x, y]) => new THREE.Vector2(x, y)));
    const armcoPost = new THREE.ExtrudeGeometry(iShape, { depth: 1.6, bevelEnabled: false });
    armcoPost.rotateX(-Math.PI / 2);
    armcoPost.translate(0, -1.05, 0);
    armcoPost.computeVertexNormals();
    // Amber reflector: small wedge.
    const armcoRefl = new THREE.CylinderGeometry(0.035, 0.045, 0.1, 4);
    armcoRefl.rotateY(Math.PI / 4);
    // Concrete course: tapered with chamfered top edges; two stacked courses
    // (the lower at full depth, the upper scaled 0.75) read as a Jersey barrier.
    const jShape = new THREE.Shape([
      [-0.13, -0.18], [0.13, -0.18], [0.12, 0.10], [0.095, 0.16], [0.07, 0.18],
      [-0.07, 0.18], [-0.095, 0.16], [-0.12, 0.10]
    ].map(([x, y]) => new THREE.Vector2(x, y)));
    const concrete = alongX(jShape);
    // Dry-stone course: subdivided box with a position-hashed lump so shared
    // vertices move together and the stretched course reads as irregular stones.
    const stone = new THREE.BoxGeometry(1, 0.22, 0.32, 14, 2, 2).toNonIndexed();
    const sp = stone.attributes.position;
    const h = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };
    for (let k = 0; k < sp.count; k++) {
      const x = sp.getX(k), y = sp.getY(k), z = sp.getZ(k);
      const r = h(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100));
      if (Math.abs(y) > 0.1) sp.setY(k, y + (r - 0.5) * 0.05);
      if (Math.abs(z) > 0.15) sp.setZ(k, z + (r - 0.5) * 0.06);
    }
    stone.computeVertexNormals();
    // Courses are stretched ~6-11x along X per instance: tile the UVs so the
    // rock texture reads as stones rather than smeared streaks.
    const suv = stone.attributes.uv;
    for (let k = 0; k < suv.count; k++) suv.setX(k, suv.getX(k) * 9.0);
    // Wood post: turned round post with a chamfered cap and 0.3 m ground embedment.
    const woodPost = new THREE.LatheGeometry([
      [0.0, -0.9], [0.075, -0.9], [0.08, -0.3], [0.08, 0.5], [0.07, 0.56], [0.03, 0.62], [0.0, 0.63]
    ].map(([x, y]) => new THREE.Vector2(x, y)), 10);
    // Split rail: slightly flattened round rail along X.
    const woodRail = new THREE.CylinderGeometry(0.05, 0.05, 1, 8, 1);
    woodRail.rotateZ(Math.PI / 2);
    woodRail.scale(1, 1.0, 0.8);
    return { armcoRail, armcoPost, armcoRefl, concrete, stone, woodPost, woodRail };
  }

  function makeVehicleAsset(glbPath, applyMaterials, label, postLoad) {
    const asset = {
      template: null,
      loading: false,
      pendingControllers: [],
      load() {
        if (this.template || this.loading || typeof THREE.GLTFLoader === 'undefined') return;
        this.loading = true;
        new THREE.GLTFLoader().load(glbPath, (gltf) => {
          gltf.scene.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = true;
            applyMaterials(child);
          });
          if (postLoad) postLoad(gltf.scene);
          this.template = gltf.scene;
          this.pendingControllers.forEach((vc) => vc.buildModel());
          this.pendingControllers.length = 0;
        }, undefined, (err) => {
          console.warn(`${label}: failed to load ${glbPath}, falling back to procedural model`, err);
        });
      },
      clone() { return this.template ? this.template.clone(true) : null; }
    };
    asset.load();
    return asset;
  }

  // Cache key for .glb models, which (unlike game.js/style.css) get no
  // automatic busting. This used to be `Date.now()`, which is not a cache key
  // at all — it made every launch a cache MISS and re-downloaded 14MB of
  // models each time, most painfully on the Android WebView's cold start.
  // Bump this by hand whenever a file under assets/models/ changes; that
  // invalidates the old copy exactly when it should and never otherwise.
  const ASSET_VERSION = '11';

  // 0f. MUSCLE COUPE — reworked in Blender (B129) from a user-supplied model:
  // all badges and lettering removed; our own grille, lamps, hood and tail;
  // new wheels and interior. Source: assets/models/muscle-coupe-source.blend.
  // Paint: the "Default Metallic Paint" slot is recoloured to dusty slate-blue.
  // The replacement keeps the source material's side: the body is a single
  // skin exported double-sided, and a default (front-side) material culls
  // the roof, pillars and door panels when seen from the first-person cabin.
  const MuscleCoupeAsset = makeVehicleAsset('assets/models/muscle-coupe.glb?v=' + ASSET_VERSION, (child) => {
    if (child.material && child.material.name && child.material.name.startsWith('Default Metallic Paint')) {
      child.material = new THREE.MeshStandardMaterial({ color: 0x5c7285, metalness: 0.55, roughness: 0.35, side: child.material.side });
    }
  }, 'MuscleCoupeAsset');

  // 0g. DELIVERY CYCLE — Blender-exported GLB with corrected Y-up orientation.
  const DeliveryCycleAsset = makeVehicleAsset('assets/models/delivery-cycle.glb?v=' + ASSET_VERSION, () => {}, 'DeliveryCycleAsset');

  // 0g1. MOTORBIKE — built in Blender (B133): commuter bike with the courier
  // seated on it, baked as static geometry. Wheel_Front/Wheel_Rear spin about
  // their axle origins. Source: assets/models/motorbike-source.blend.
  const MotorbikeAsset = makeVehicleAsset('assets/models/motorbike.glb?v=' + ASSET_VERSION, () => {}, 'MotorbikeAsset');

  // 0g1b. CARGO RICKSHAW — built in Blender (B172): blue cab, orange cargo bed
  // with boxes, courier at the handlebar (same rider mesh as the cycle).
  // Wheel_Front / Wheel_Rear_L / Wheel_Rear_R spin about their axle origins.
  const RickshawAsset = makeVehicleAsset('assets/models/rickshaw.glb?v=' + ASSET_VERSION, () => {}, 'RickshawAsset');

  // 0g2. CHAI TAPRI — static roadside tea-stall prop. Origin at ground centre,
  // counter facing +Z (the road, once buildViewpointOrChai's lookAt runs).
  // Stalls built before it loads show the old box stand-in, swapped via `pending`.
  const ChaiTapriAsset = {
    template: null,
    pending: [],
    load() {
      if (typeof THREE.GLTFLoader === 'undefined') return;
      new THREE.GLTFLoader().load('assets/models/chai-tapri.glb?v=tapri2', (gltf) => {
        gltf.scene.traverse((child) => {
          if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
        });
        this.template = gltf.scene;
        this.pending.forEach((fn) => {
          try { fn(); } catch (err) { console.error('ChaiTapriAsset: swap failed', err); }
        });
        this.pending.length = 0;
      }, undefined, (err) => {
        console.warn('ChaiTapriAsset: failed to load chai-tapri.glb, keeping box stand-in', err);
      });
    },
    clone() { return this.template ? this.template.clone(true) : null; }
  };
  ChaiTapriAsset.load();

  // 0g3. DELIVERY HOUSES — three variants in one GLB (cottage, two-storey,
  // pink gable). Each house node carries a `DropSpot_*` empty marking where the
  // delivery ring goes; fronts face +Z (the road after the house group's lookAt).
  const HousesAsset = {
    template: null,
    pending: [],
    windowMat: null,
    VARIANTS: ['House_Cottage', 'House_TwoStorey', 'House_PinkGable'],
    load() {
      if (typeof THREE.GLTFLoader === 'undefined') return;
      new THREE.GLTFLoader().load('assets/models/houses.glb?v=houses4', (gltf) => {
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material && child.material.name === 'House_Window') {
            child.material.emissive = new THREE.Color(0xffb24a);
            child.material.emissiveIntensity = 0.0;
            this.windowMat = child.material;
          }
        });
        this.template = gltf.scene;
        this.pending.forEach((fn) => {
          try { fn(); } catch (err) { console.error('HousesAsset: swap failed', err); }
        });
        this.pending.length = 0;
      }, undefined, (err) => {
        console.warn('HousesAsset: failed to load houses.glb, keeping built-in villas', err);
      });
    },
    clone(name) {
      const src = this.template && this.template.getObjectByName(name);
      if (!src) return null;
      const c = src.clone(true);
      c.position.set(0, 0, 0);
      c.rotation.set(0, 0, 0);
      c.scale.set(1, 1, 1);
      return c;
    }
  };
  HousesAsset.load();

  // 0g4. CYCLE REPAIR SHOP — replaces the box repair garage. Open front faces +Z
  // (the road after the garage group's lookAt); green service mat sits in front.
  const RepairShopAsset = {
    template: null,
    pending: [],
    load() {
      if (typeof THREE.GLTFLoader === 'undefined') return;
      new THREE.GLTFLoader().load('assets/models/cycle-repair-shop.glb?v=shop1', (gltf) => {
        gltf.scene.traverse((child) => {
          if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
        });
        this.template = gltf.scene;
        this.pending.forEach((fn) => {
          try { fn(); } catch (err) { console.error('RepairShopAsset: swap failed', err); }
        });
        this.pending.length = 0;
      }, undefined, (err) => {
        console.warn('RepairShopAsset: failed to load cycle-repair-shop.glb, keeping box garage', err);
      });
    },
    clone() { return this.template ? this.template.clone(true) : null; }
  };
  RepairShopAsset.load();

  // 0g4b. MOTOR GARAGE — second repair-stop type (cars/two-wheelers), placed on
  // its own spacing on the other side of the road from the cycle repair shops.
  const MotorGarageAsset = {
    template: null,
    pending: [],
    load() {
      if (typeof THREE.GLTFLoader === 'undefined') return;
      new THREE.GLTFLoader().load('assets/models/motor-garage.glb?v=garage1', (gltf) => {
        gltf.scene.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
        this.template = gltf.scene;
        this.pending.forEach((fn) => { try { fn(); } catch (err) { console.error('MotorGarageAsset: swap failed', err); } });
        this.pending.length = 0;
      }, undefined, (err) => { console.warn('MotorGarageAsset: failed to load motor-garage.glb', err); });
    },
    clone() { return this.template ? this.template.clone(true) : null; }
  };
  MotorGarageAsset.load();

  // 0g5. STREET FURNITURE — `StreetLamp` (arm reaches toward +Z, the road after
  // the lamp group's lookAt) and `UtilityPole` (cross-arms along X, i.e. parallel
  // to the road). Origins at the base.
  const StreetFurnitureAsset = {
    template: null,
    pending: [],
    lensMat: null,
    load() {
      if (typeof THREE.GLTFLoader === 'undefined') return;
      new THREE.GLTFLoader().load('assets/models/street-furniture.glb?v=street1', (gltf) => {
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          if (child.material && child.material.name === 'Lamp_Lens') {
            child.material.emissive = new THREE.Color(0xffb24a);
            child.material.emissiveIntensity = 0.0;
            this.lensMat = child.material;
          }
        });
        this.template = gltf.scene;
        this.pending.forEach((fn) => {
          try { fn(); } catch (err) { console.error('StreetFurnitureAsset: swap failed', err); }
        });
        this.pending.length = 0;
      }, undefined, (err) => {
        console.warn('StreetFurnitureAsset: failed to load street-furniture.glb, keeping box poles', err);
      });
    },
    clone(name) {
      const src = this.template && this.template.getObjectByName(name);
      if (!src) return null;
      const c = src.clone(true);
      c.position.set(0, 0, 0);
      c.rotation.set(0, 0, 0);
      return c;
    }
  };
  StreetFurnitureAsset.load();

  // 0h. COURIER — rigged, animated character (Mixamo base, retextured) shared by
  // the on-foot player walker and crosser NPCs, so both use one consistent model
  // instead of separate procedural rigs. Ships with real Walking/Running clips.
  // Must be cloned with THREE.SkeletonUtils.clone (not Object3D.clone) — a plain
  // clone shares skeleton bone references across instances and breaks per-instance
  // animation/deformation for SkinnedMesh.
  const CourierAsset = {
    template: null,
    animations: null,
    loading: false,
    pendingControllers: [],
    load() {
      if (this.template || this.loading || typeof THREE.GLTFLoader === 'undefined') return;
      this.loading = true;
      // courier-crowd.glb, not courier.glb: the original is a 35k-tri, 7-mesh
      // hero model, and every pedestrian pays 7 draw calls for it. The crowd
      // build is decimated to 5.7k tris and merged down to 5 meshes (Eyes
      // folded into Body — it already shared Bodymat — and Eyelashes dropped),
      // keeping all 67 bones, all five clips, and the Body/Top/Bottom/Hair
      // materials the per-NPC tinting recolours.
      new THREE.GLTFLoader().load('assets/models/courier-crowd.glb?v=' + ASSET_VERSION, (gltf) => {
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
        });
        this.template = gltf.scene;
        this.animations = gltf.animations;
        this.pendingControllers.forEach((cb) => cb());
        this.pendingControllers.length = 0;
      }, undefined, (err) => {
        console.warn('CourierAsset: failed to load courier-crowd.glb', err);
      });
    },
    // Returns { root, mixer, actions } — actions keyed by clip name (Walking/Running/Riding/TPose).
    clone() {
      if (!this.template || typeof THREE.SkeletonUtils === 'undefined') return null;
      const root = THREE.SkeletonUtils.clone(this.template);
      const mixer = new THREE.AnimationMixer(root);
      const actions = {};
      this.animations.forEach((clip) => { actions[clip.name] = mixer.clipAction(clip); });
      return { root, mixer, actions };
    }
  };
  CourierAsset.load();

  S.barrierPostStations = barrierPostStations;
  S.addChunkedInstances = addChunkedInstances;
  S.LANE_PAINT = LANE_PAINT;
  S.buildBarrierGeometries = buildBarrierGeometries;
  S.makeVehicleAsset = makeVehicleAsset;
  S.ASSET_VERSION = ASSET_VERSION;
  S.MuscleCoupeAsset = MuscleCoupeAsset;
  S.DeliveryCycleAsset = DeliveryCycleAsset;
  S.MotorbikeAsset = MotorbikeAsset;
  S.RickshawAsset = RickshawAsset;
  S.ChaiTapriAsset = ChaiTapriAsset;
  S.HousesAsset = HousesAsset;
  S.RepairShopAsset = RepairShopAsset;
  S.MotorGarageAsset = MotorGarageAsset;
  S.StreetFurnitureAsset = StreetFurnitureAsset;
  S.CourierAsset = CourierAsset;
})();
