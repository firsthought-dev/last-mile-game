(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const { addChunkedInstances } = S;

  const RockGeometryFactory = {
    // B178: rocks were 144-triangle dodecahedra with one sine of displacement and pinched spherical UVs, which read as smooth lumps.
    // Now ~320 triangles with three octaves of ridged noise (so they have real edges and planes), a flat-ish bed, per-face box
    // UVs for the photo rock + normal map (no pole pinching), and baked vertex colour: darker underside / contact AO, faint
    // strata bands, and a moss tint on up-facing faces. Materials must set vertexColors.
    createFacetedRockGeometry(seed = 1) {
      const geom = new THREE.DodecahedronGeometry(1.3, 2);
      const pos = geom.attributes.position;
      const v = new THREE.Vector3();
      const n3 = (x, y, z, k) => Math.sin(x * k + seed) * Math.cos(y * k + seed * 1.7) * Math.sin(z * k + seed * 0.6);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const r = 1 - 0.55 * Math.abs(n3(v.x, v.y, v.z, 2.3)) - 0.22 * Math.abs(n3(v.x, v.y, v.z, 5.1)) - 0.08 * Math.abs(n3(v.x, v.y, v.z, 11.0));
        v.multiplyScalar(0.62 + 0.55 * r);
        if (v.y < 0) v.y *= 0.55;
        v.y -= 0.0;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geom.computeVertexNormals();
      const uvs = [], cols = [], nrm = geom.attributes.normal, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
      for (let t = 0; t < pos.count; t += 3) {
        a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
        fn.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
        const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
        const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
        const moss = THREE.MathUtils.clamp((fn.y - 0.45) * 2.2, 0, 1) * (0.5 + 0.5 * Math.sin(mid.x * 4.0 + mid.z * 3.0 + seed));
        for (const p of [a, b, c]) {
          if (ay >= ax && ay >= az) uvs.push(p.x * 0.55, p.z * 0.55); else if (ax >= az) uvs.push(p.z * 0.55, p.y * 0.55); else uvs.push(p.x * 0.55, p.y * 0.55);
          const ao = THREE.MathUtils.clamp(0.62 + 0.38 * THREE.MathUtils.smoothstep(p.y, -1.0, 0.55), 0.55, 1.0);
          const strata = 0.93 + 0.07 * Math.sin(p.y * 8.0 + 1.3 * Math.sin(p.x * 3.0 + seed));
          const k = ao * strata;
          cols.push(k * (1 - 0.18 * moss), k * (1 - 0.02 * moss + 0.04 * moss), k * (1 - 0.30 * moss));
        }
      }
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      return geom;
    }
  };

  // --------------------------------------------------------------------------
  // Billboard trees — replaces the ConeGeometry/DodecahedronGeometry
  // primitive trees per SHIPLYP_VISUAL_ENHANCEMENT_BRIEF.md section 3.3.
  // Even with correct smooth shading, a
  // primitive-geometry tree still reads as a stacked cone or a round ball —
  // the actual gap against slowroads.io's trees is silhouette and texture
  // detail (individual needle/leaf-cluster edges), not shading smoothness.
  // No real-world alpha-cut tree photo was available to source reliably —
  // authored instead, procedurally, at build time (not runtime): a
  // needle-cluster pine silhouette and an irregular-blob broadleaf
  // silhouette, both with a real alpha channel, both with the trunk baked
  // into the same sprite so no separate trunk mesh is needed.
  // Cross-billboard technique (two perpendicular textured planes sharing
  // one alpha-cut texture) — a standard Y-axis-locked impostor: gives
  // reasonable coverage from any horizontal viewing angle without a
  // per-frame camera-facing update for every tree in the scene (hundreds
  // of them; this project's own history flags exactly this kind of
  // per-frame-cost-vs-one-time-cost tradeoff, see the world-floor segment
  // count note in createWorldFloor). Actually CHEAPER than the geometry it
  // replaces: 2 flat planes (4 triangles) vs. up to 3 stacked cones
  // (30+ triangles) per tree.
  const TreeBillboardFactory = {
    _textures: null,
    _loader: null,
    load() {
      if (this._textures) return this._textures;
      this._loader = this._loader || new THREE.TextureLoader();
      // Do NOT set tex.encoding here. Assigning THREE.sRGBEncoding on a
      // texture synchronously right after calling .load() — before the
      // image itself has finished the async fetch — rendered these
      // textures as solid black (confirmed directly: same mesh, same
      // material, only removing this line fixed it; a plain color
      // material on the same geometry rendered fine, isolating the bug to
      // this specific texture setup, not the billboard mesh/material
      // itself). The renderer's own outputEncoding (sRGBEncoding, set in
      // initThree) already handles the final display color correctly
      // without this.
      const load = (url) => this._loader.load(url);
      this._textures = {
        pine: load('assets/textures/tree_pine.webp'),
        broadleaf: load('assets/textures/tree_broadleaf.webp')
      };
      return this._textures;
    },
    _geomCache: null,
    _matCache: null,
    // worldHeight: the tree's total height in world units (trunk included,
    // since it's baked into the sprite) at scale 1.
    //
    // Geometry AND material are cached/shared per (kind, worldHeight) /
    // (kind, tintHex) — see buildInstancedBatches below for why this
    // matters more than it sounds: individual THREE.Mesh instances (the
    // original version of this factory) are one draw call each regardless
    // of shared geometry, and clustering trees (4-8x instance count) pushed
    // that to 8556 separate tree meshes, at ~22 FPS. InstancedMesh is the
    // actual fix — draw calls collapse to one per (kind, worldHeight, tint)
    // bucket regardless of instance count.
    getGeometry(kind, worldHeight) {
      this._geomCache = this._geomCache || new Map();
      const key = `${kind}:${worldHeight}`;
      let geom = this._geomCache.get(key);
      if (!geom) {
        const aspect = kind === 'pine' ? (512 / 900) : (512 / 768);
        geom = new THREE.PlaneGeometry(worldHeight * aspect, worldHeight);
        geom.translate(0, worldHeight / 2, 0); // pivot at the base, matching how the old trunk-based groups were positioned
        this._geomCache.set(key, geom);
      }
      return geom;
    },
    getMaterial(kind, tintHex) {
      this._matCache = this._matCache || new Map();
      const textures = this.load();
      const tex = kind === 'pine' ? textures.pine : textures.broadleaf;
      const tint = tintHex != null ? tintHex : 0xffffff;
      const key = `${kind}:${tint}`;
      let mat = this._matCache.get(key);
      if (!mat) {
        mat = new THREE.MeshLambertMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.35, // hard cutout, not blended — avoids draw-order/sorting issues between the two crossed planes
          side: THREE.DoubleSide,
          color: tint // subtle per-tint seasonal variation without needing separate texture files per season
        });
        this._matCache.set(key, mat);
      }
      return mat;
    },
    // `descriptors`: [{ kind, worldHeight, pos, scale, rotY, tintHex }, ...]
    // (already overlap/road-clearance-filtered by the caller). Groups by
    // (kind, worldHeight, tintHex) and builds one InstancedMesh PER PLANE
    // per group (2 planes per cross-billboard) — e.g. 2 kinds x 2 heights x
    // ~4 tints x 2 planes = ~32 draw calls total for potentially thousands
    // of trees, instead of 2 draw calls per tree.
    buildInstancedBatches(descriptors) {
      const group = new THREE.Group();
      if (ClumpTreeFactory.enabled()) {
        const leafy = descriptors.filter(d => d.kind === 'broadleaf');
        descriptors = descriptors.filter(d => d.kind !== 'broadleaf');
        group.add(ClumpTreeFactory.build(leafy));
      }
      if (ConiferFactory.enabled()) {
        const pines = descriptors.filter(d => d.kind === 'pine');
        descriptors = descriptors.filter(d => d.kind !== 'pine');
        group.add(ConiferFactory.build(pines));
      }
      const buckets = new Map();
      for (const d of descriptors) {
        const key = `${d.kind}:${d.worldHeight}:${d.tintHex}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(d);
      }

      const dummy = new THREE.Object3D();
      for (const [key, items] of buckets) {
        const [kind, worldHeightStr, tintStr] = key.split(':');
        const worldHeight = Number(worldHeightStr);
        const tintHex = Number(tintStr);
        const geom = this.getGeometry(kind, worldHeight);
        const mat = this.getMaterial(kind, tintHex);

        for (const planeRotY of [0, Math.PI / 2]) {
          const inst = new THREE.InstancedMesh(geom, mat, items.length);
          inst.instanceMatrix.setUsage(THREE.StaticDrawUsage); // trees never move once placed
          for (let i = 0; i < items.length; i++) {
            const d = items[i];
            dummy.position.copy(d.pos);
            dummy.rotation.set(0, d.rotY + planeRotY, 0);
            dummy.scale.setScalar(d.scale);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
          }
          inst.instanceMatrix.needsUpdate = true;
          inst.frustumCulled = false; // per-instance culling isn't computed for InstancedMesh by default in this three version; cheap enough at this triangle count
          group.add(inst);
        }
      }
      group.userData.isTreeBatch = true;
      return group;
    }
  };

  // Leaf-clump broadleaf trees (B148). A tree is a tapering trunk, a few branches and
  // ~14 clumps; each clump is two crossed quads showing a leaf-ball from a small atlas
  // (tree_clumps_d diffuse + alpha, tree_clumps_n normal map with a domed normal baked in
  // so a flat card lights like a round ball of leaves). ~120 triangles per tree, against
  // 4 for the old crossed billboards, but it reads as foliage instead of a flat sprite.
  // Geometry is generated here from a seed; the atlases were authored for this project.
  // Trees are chunked (addChunkedInstances) so only the ones near the camera are drawn.
  const ClumpTreeFactory = {
    VARIANTS: 4,
    _geoms: null,
    _tex: null,
    _mats: null,
    enabled() {
      try { return localStorage.getItem('shiplyp_clumpTrees') !== '0'; } catch (e) { return true; }
    },
    _textures() {
      if (this._tex) return this._tex;
      const loader = new THREE.TextureLoader();
      const mats = () => { if (this._mats) this._mats.leaf.needsUpdate = true; };
      const d = loader.load('assets/textures/tree_clumps_d.webp', () => { d.encoding = THREE.sRGBEncoding; d.needsUpdate = true; mats(); });
      const n = loader.load('assets/textures/tree_clumps_n.webp');
      d.anisotropy = n.anisotropy = 4;
      this._tex = { d, n };
      return this._tex;
    },
    _material() {
      if (this._mats) return this._mats;
      const t = this._textures();
      this._mats = {
        leaf: new THREE.MeshStandardMaterial({
          map: t.d, normalMap: t.n, normalScale: new THREE.Vector2(0.9, 0.9),
          color: 0x9aa88a, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, metalness: 0
        }),
        wood: new THREE.MeshLambertMaterial({ vertexColors: true })
      };
      return this._mats;
    },
    _rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    _buildVariant(seed) {
      const rnd = this._rng(seed), V = THREE.Vector3;
      const wp = [], wn = [], wc = [], wi = [];
      const tube = (p0, p1, r0, r1, seg) => {
        const d = new V().subVectors(p1, p0), len = d.length(); d.normalize();
        const ref = Math.abs(d.z) < 0.9 ? new V(0, 0, 1) : new V(1, 0, 0);
        const u = new V().crossVectors(d, ref).normalize(), v = new V().crossVectors(d, u);
        const base = wp.length / 3;
        for (let ring = 0; ring < 2; ring++) {
          const c = ring ? p1 : p0, r = ring ? r1 : r0;
          for (let i = 0; i < seg; i++) {
            const a = (i / seg) * Math.PI * 2, nx = Math.cos(a), ny = Math.sin(a);
            const n = new V().addScaledVector(u, nx).addScaledVector(v, ny);
            wp.push(c.x + n.x * r, c.y + n.y * r, c.z + n.z * r); wn.push(n.x, n.y, n.z);
            const sh = 0.82 + 0.18 * (nx * 0.5 + 0.5) + (rnd() - 0.5) * 0.05;
            wc.push(0.15 * sh, 0.12 * sh, 0.095 * sh);
          }
        }
        for (let i = 0; i < seg; i++) {
          const a = base + i, b = base + (i + 1) % seg, c2 = base + seg + i, d2 = base + seg + (i + 1) % seg;
          wi.push(a, c2, b, b, c2, d2);
        }
      };
      const H = 4.2 + rnd() * 0.6;
      const lean = new V((rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5, 0);
      const top = new V(lean.x, lean.y, H);
      tube(new V(0, 0, 0), top, 0.32, 0.12, 7);
      const ends = [];
      const nb = 5;
      for (let i = 0; i < nb; i++) {
        const az = i * (Math.PI * 2 / nb) + (rnd() - 0.5) * 0.8, z0 = H * (0.55 + rnd() * 0.35);
        const base = new V(lean.x * z0 / H, lean.y * z0 / H, z0), Lb = 1.3 + rnd() * 1.0;
        const end = new V(base.x + Math.cos(az) * Lb, base.y + Math.sin(az) * Lb, base.z + 0.9 + rnd() * 1.3);
        tube(base, end, 0.11, 0.04, 5); ends.push(end);
      }
      const centres = ends.map(e => [e, 1.5 + rnd() * 0.4]);
      centres.push([new V(top.x, top.y, H + 1.7), 1.9]);
      for (let i = 0; i < 8; i++) {
        const a = rnd() * Math.PI * 2, rr = 0.5 + rnd() * 1.7;
        centres.push([new V(Math.cos(a) * rr, Math.sin(a) * rr, H + 0.3 + rnd() * 2.6), 1.25 + rnd() * 0.4]);
      }
      const lp = [], lu = [];
      const m4 = new THREE.Matrix4(), rz = new THREE.Matrix4(), rx = new THREE.Matrix4();
      for (const [c, r] of centres) {
        const tile = Math.floor(rnd() * 6), row = Math.floor(tile / 3), colIdx = tile % 3;
        const u0 = colIdx / 3, u1 = (colIdx + 1) / 3, v1 = 1 - row / 2, v0 = 1 - (row + 1) / 2;
        const yaw = rnd() * Math.PI;
        for (let k = 0; k < 2; k++) {
          rz.makeRotationZ(yaw + k * Math.PI / 2 + (rnd() - 0.5) * 0.4);
          rx.makeRotationX((rnd() - 0.5) * 0.7);
          m4.multiplyMatrices(rz, rx);
          const q = [[-r, 0, -r], [r, 0, -r], [r, 0, r], [-r, 0, r]].map(a => new V(a[0], a[1], a[2]).applyMatrix4(m4).add(c));
          const uvq = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
          for (const i of [0, 1, 2, 0, 2, 3]) { lp.push(q[i].x, q[i].y, q[i].z); lu.push(uvq[i][0], uvq[i][1]); }
        }
      }
      const wood = new THREE.BufferGeometry();
      wood.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      wood.setAttribute('normal', new THREE.Float32BufferAttribute(wn, 3));
      wood.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
      wood.setIndex(wi);
      const leaves = new THREE.BufferGeometry();
      leaves.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      leaves.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2));
      leaves.computeVertexNormals();
      // three is Y-up, the generator above is Z-up: rotate both into place and measure height.
      const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
      wood.applyMatrix4(rot); leaves.applyMatrix4(rot);
      leaves.computeBoundingBox(); wood.computeBoundingSphere(); leaves.computeBoundingSphere();
      return { wood, leaves, height: leaves.boundingBox.max.y };
    },
    // Low shrubs for the ground cover (B153): two crossed clump cards per shrub, one per atlas tile.
    shrubGeoms() {
      if (this._shrub) return this._shrub;
      this._shrub = [];
      for (let tile = 0; tile < 6; tile++) {
        const row = Math.floor(tile / 3), col = tile % 3, u0 = col / 3, u1 = (col + 1) / 3, v1 = 1 - row / 2, v0 = 1 - (row + 1) / 2;
        const pos = [], uv = [];
        for (let k = 0; k < 2; k++) {
          const a = k * Math.PI / 2, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
          const q = [[-cx, 0, -cz], [cx, 0, cz], [cx, 1, cz], [-cx, 1, -cz]], uvq = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
          for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(q[i][0], q[i][1], q[i][2]); uv.push(uvq[i][0], uvq[i][1]); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals(); g.computeBoundingSphere();
        this._shrub.push(g);
      }
      return this._shrub;
    },
    shrubMaterial() { return this._material().leaf; },
    _variants() {
      if (!this._geoms) { this._geoms = []; for (let i = 0; i < this.VARIANTS; i++) this._geoms.push(this._buildVariant(1013 + i * 7919)); }
      return this._geoms;
    },
    // descriptors: the broadleaf entries of TreeBillboardFactory.buildInstancedBatches
    build(descriptors) {
      const group = new THREE.Group();
      if (!descriptors.length) return group;
      const mats = this._material(), variants = this._variants();
      const dummy = new THREE.Object3D(), col = new THREE.Color();
      const byVariant = variants.map(() => []);
      for (const d of descriptors) {
        const vi = Math.abs(Math.floor(d.pos.x * 12.9898 + d.pos.z * 78.233)) % variants.length;
        const v = variants[vi];
        dummy.position.copy(d.pos); dummy.rotation.set(0, d.rotY, 0);
        dummy.scale.setScalar((d.worldHeight * (d.scale || 1)) / v.height);
        dummy.updateMatrix();
        const m = dummy.matrix.clone();
        // seasonal tint, pulled toward white so the painted greens are not greyed out
        m._tint = col.setHex(d.tintHex != null ? d.tintHex : 0xffffff).lerp(new THREE.Color(0xffffff), 0.55).clone();
        byVariant[vi].push(m);
      }
      byVariant.forEach((mats4, vi) => {
        const v = variants[vi];
        addChunkedInstances(group, v.leaves, mats.leaf, mats4, {
          cell: 260,
          onChunk: (mesh, list) => { list.forEach((m, i) => mesh.setColorAt(i, m._tint)); mesh.instanceColor.needsUpdate = true; }
        });
        addChunkedInstances(group, v.wood, mats.wood, mats4, { cell: 260 });
      });
      return group;
    }
  };

  // Tiered conifers (B151). A trunk plus ~10 tiers of drooping branch cards; each card is a
  // feathery needle spray from an original atlas (tree_conifer_d diffuse + alpha,
  // tree_conifer_n normal map). ~150 triangles per tree, against 4 for the old crossed
  // billboard, but it has real layered silhouettes and lights like a fir. Same instancing,
  // chunk culling and per-instance seasonal tint as ClumpTreeFactory.
  // Kill switch for A/B: localStorage.shiplyp_conifers = '0'.
  const ConiferFactory = {
    VARIANTS: 4, _geoms: null, _tex: null, _mats: null,
    enabled() { try { return localStorage.getItem('shiplyp_conifers') !== '0'; } catch (e) { return true; } },
    _material() {
      if (this._mats) return this._mats;
      const loader = new THREE.TextureLoader();
      const d = loader.load('assets/textures/tree_conifer_d.webp', () => { d.encoding = THREE.sRGBEncoding; d.needsUpdate = true; if (this._mats) this._mats.leaf.needsUpdate = true; });
      const n = loader.load('assets/textures/tree_conifer_n.webp');
      d.anisotropy = n.anisotropy = 4;
      this._mats = {
        leaf: new THREE.MeshStandardMaterial({ map: d, normalMap: n, normalScale: new THREE.Vector2(0.8, 0.8), color: 0x8fa38f, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 }),
        wood: new THREE.MeshLambertMaterial({ vertexColors: true })
      };
      return this._mats;
    },
    _rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    _buildVariant(seed) {
      const rnd = this._rng(seed), V = THREE.Vector3;
      const H = 14, lean = new V((rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7, 0);
      const trunkTop = H - 0.4;
      // trunk: 6-sided tapering tube (Z-up here, rotated to Y-up at the end)
      const wp = [], wn = [], wc = [], wi = [], seg = 6;
      for (let ring = 0; ring < 2; ring++) {
        const z = ring ? trunkTop : 0, r = ring ? 0.05 : 0.34, ox = ring ? lean.x : 0, oy = ring ? lean.y : 0;
        for (let i = 0; i < seg; i++) {
          const a = (i / seg) * Math.PI * 2, nx = Math.cos(a), ny = Math.sin(a);
          wp.push(ox + nx * r, oy + ny * r, z); wn.push(nx, ny, 0);
          const sh = 0.8 + 0.2 * (nx * 0.5 + 0.5); wc.push(0.15 * sh, 0.11 * sh, 0.085 * sh);
        }
      }
      for (let i = 0; i < seg; i++) { const a = i, b = (i + 1) % seg, c = seg + i, d = seg + (i + 1) % seg; wi.push(a, c, b, b, c, d); }
      const lp = [], lu = [];
      const tiers = 10;
      const addCard = (p0, dir, side, len, wid, tile) => {
        const u0 = tile / 4, u1 = (tile + 1) / 4;
        const hw = wid / 2;
        const q = [
          new V().copy(p0).addScaledVector(side, -hw), new V().copy(p0).addScaledVector(side, hw),
          new V().copy(p0).addScaledVector(dir, len).addScaledVector(side, hw * 0.92), new V().copy(p0).addScaledVector(dir, len).addScaledVector(side, -hw * 0.92)
        ];
        const uvq = [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
        for (const i of [0, 1, 2, 0, 2, 3]) { lp.push(q[i].x, q[i].y, q[i].z); lu.push(uvq[i][0], uvq[i][1]); }
      };
      for (let i = 0; i < tiers; i++) {
        const t = i / (tiers - 1), zt = 3.4 + t * (H - 3.4 - 1.0);                // B177: lowest tier at 3.4 (was 2.0) so the skirt clears the ground on slopes
        const L = 4.2 * Math.pow(1 - t, 0.85) + 0.7;
        const K = 5 + Math.round(5 * (1 - t)), off = rnd() * Math.PI * 2;
        const p0 = new V(lean.x * zt / trunkTop, lean.y * zt / trunkTop, zt);
        for (let j = 0; j < K; j++) {
          const az = off + (j / K) * Math.PI * 2 + (rnd() - 0.5) * 0.35;
          const droop = THREE.MathUtils.degToRad(24 - 10 * t + (rnd() - 0.5) * 10);
          const dir = new V(Math.cos(droop) * Math.cos(az), Math.cos(droop) * Math.sin(az), -Math.sin(droop));
          const side = new V(-Math.sin(az), Math.cos(az), 0);
          const len = L * (0.85 + rnd() * 0.3), wid = len * (0.95 + rnd() * 0.25);
          addCard(p0.clone().add(new V(0, 0, (rnd() - 0.5) * 0.3)), dir, side, len, wid, Math.floor(rnd() * 4));
        }
      }
      // leader: two crossed upright sprays at the top
      for (let k = 0; k < 2; k++) {
        const az = k * Math.PI / 2 + rnd() * 0.4, side = new V(-Math.sin(az), Math.cos(az), 0);
        addCard(new V(lean.x, lean.y, H - 2.6), new V(0, 0, 1), side, 2.9, 1.4, Math.floor(rnd() * 4));
      }
      const wood = new THREE.BufferGeometry();
      wood.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      wood.setAttribute('normal', new THREE.Float32BufferAttribute(wn, 3));
      wood.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
      wood.setIndex(wi);
      const leaves = new THREE.BufferGeometry();
      leaves.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      leaves.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2));
      leaves.computeVertexNormals();
      const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
      wood.applyMatrix4(rot); leaves.applyMatrix4(rot);
      leaves.computeBoundingBox(); wood.computeBoundingSphere(); leaves.computeBoundingSphere();
      return { wood, leaves, height: leaves.boundingBox.max.y };
    },
    _variants() {
      if (!this._geoms) { this._geoms = []; for (let i = 0; i < this.VARIANTS; i++) this._geoms.push(this._buildVariant(2203 + i * 6271)); }
      return this._geoms;
    },
    build(descriptors) {
      const group = new THREE.Group();
      if (!descriptors.length) return group;
      const mats = this._material(), variants = this._variants();
      const dummy = new THREE.Object3D(), col = new THREE.Color(), white = new THREE.Color(0xffffff);
      const byVariant = variants.map(() => []);
      for (const d of descriptors) {
        const vi = Math.abs(Math.floor(d.pos.x * 12.9898 + d.pos.z * 78.233)) % variants.length;
        const v = variants[vi];
        dummy.position.copy(d.pos); dummy.rotation.set(0, d.rotY, 0);
        dummy.scale.setScalar((d.worldHeight * (d.scale || 1)) / v.height);
        dummy.updateMatrix();
        const m = dummy.matrix.clone();
        m._tint = col.setHex(d.tintHex != null ? d.tintHex : 0xffffff).lerp(white, 0.62).clone();
        byVariant[vi].push(m);
      }
      byVariant.forEach((list, vi) => {
        const v = variants[vi];
        addChunkedInstances(group, v.leaves, mats.leaf, list, { cell: 260, onChunk: (mesh, l) => { l.forEach((m, i) => mesh.setColorAt(i, m._tint)); mesh.instanceColor.needsUpdate = true; } });
        addChunkedInstances(group, v.wood, mats.wood, list, { cell: 260 });
      });
      return group;
    }
  };


  // Roadside grass overhang (B150). Tufts grow at the outer footpath edge and the barrier
  // base and lean in over the footpath. Each tuft is 3 crossed quads (6 tris) using one of
  // 4 tufts in an original atlas (assets/textures/grass_tufts.webp, built by
  // scratch/asset-options/atlas/build_grass.py). Instanced and chunk-culled like the trees.
  // Kill switch for A/B: localStorage.shiplyp_roadGrass = '0'.
  const RoadGrassFactory = {
    _geoms: null, _mat: null,
    enabled() { try { return localStorage.getItem('shiplyp_roadGrass') !== '0'; } catch (e) { return true; } },
    material() {
      if (this._mat) return this._mat;
      const loader = new THREE.TextureLoader();
      const t = loader.load('assets/textures/grass_tufts.webp', () => { t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; if (this._mat) this._mat.needsUpdate = true; });
      t.anisotropy = 4;
      this._mat = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide });
      return this._mat;
    },
    // Dense plant PATCHES (B165): each card is a packed cluster of ~40 real Poly Haven plants baked in Blender
    // (assets/textures/grass_patches.webp, 3x2 tiles of 512x256). 2 crossed upright quads, 1 x 0.5 per unit scale.
    patchGeoms() {
      if (this._patchGeoms) return this._patchGeoms;
      this._patchGeoms = [];
      for (let t = 0; t < 6; t++) {
        const col = t % 3, row = Math.floor(t / 3), u0 = col / 3, u1 = (col + 1) / 3, v1 = 1 - row / 2, v0 = 1 - (row + 1) / 2;
        const pos = [], uv = [];
        for (let k = 0; k < 2; k++) {
          const a = k * Math.PI / 2, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
          const q = [[-cx, 0, -cz], [cx, 0, cz], [cx, 0.5, cz], [-cx, 0.5, -cz]], uvq = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
          for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(q[i][0], q[i][1], q[i][2]); uv.push(uvq[i][0], uvq[i][1]); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0).flatMap(() => [0, 1, 0]), 3));
        g.computeBoundingSphere();
        this._patchGeoms.push(g);
      }
      return this._patchGeoms;
    },
    patchMaterial() {
      if (this._patchMat) return this._patchMat;
      const t = new THREE.TextureLoader().load('assets/textures/grass_patches.webp', () => { t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; if (this._patchMat) this._patchMat.needsUpdate = true; });
      t.anisotropy = 4;
      return (this._patchMat = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
    },
    geoms() {
      if (this._geoms) return this._geoms;
      this._geoms = [];
      for (let v = 0; v < 6; v++) {                                   // 0-3 grass, 4 white flowers, 5 yellow flowers
        const pos = [], uv = [], u0 = v / 6, u1 = (v + 1) / 6;
        for (let k = 0; k < 3; k++) {
          const a = k * Math.PI / 3, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
          const q = [[-cx, 0, -cz], [cx, 0, cz], [cx, 1, cz], [-cx, 1, -cz]], uvq = [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
          for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(q[i][0], q[i][1], q[i][2]); uv.push(uvq[i][0], uvq[i][1]); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        // Normals point up so tufts take the sun like the ground they grow from.
        g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0).flatMap(() => [0, 1, 0]), 3));
        g.computeBoundingSphere();
        this._geoms.push(g);
      }
      return this._geoms;
    }
  };


  // Layered ground shader (B156). Slow Roads' ground is NOT one colour texture: it is the terrain colour
  // multiplied by a greyscale blade-detail map (fine, near), a patch-variation map (warm/cool and light/dark
  // patches), and a coarser mottling for the distance, blended by camera distance. This does the same with
  // original maps (assets/textures/ground_blades.webp, ground_variation.webp; scratch/asset-options/atlas/
  // build_ground.py). World-space mapping, so the terrain's custom UVs are not involved. Kill switch:
  // localStorage.shiplyp_groundDetail = '0'.
  const GroundDetail = {
    _tex: null,
    enabled() { try { return localStorage.getItem('shiplyp_groundDetail') !== '0'; } catch (e) { return true; } },
    textures() {
      if (this._tex) return this._tex;
      const loader = new THREE.TextureLoader();
      const wrap = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
      this._tex = { grass: wrap(loader.load('assets/textures/ground_grass004.webp')), vari: wrap(loader.load('assets/textures/ground_variation.webp')) };
      return this._tex;
    },
    apply(mat) {
      if (!this.enabled()) return mat;
      const T = this.textures();
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uGrass = { value: T.grass };
        shader.uniforms.uVari = { value: T.vari };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vShpWorld;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShpWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vShpWorld;\nuniform sampler2D uGrass;\nuniform sampler2D uVari;')
          .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float shpDist = length(vViewPosition);
            vec2 w = vShpWorld.xz;
            vec3 vA = texture2D(uVari, w / 61.0).rgb;
            vec3 vB = texture2D(uVari, w / 11.0 + 0.37).rgb;
            // Real photographic lawn (ambientCG Grass004, CC0) in three scales so it covers the WHOLE landscape:
            // near (blades readable close), mid, and a far layer that never fades out. The texture is divided by its
            // own mean colour, so the terrain's season/biome colours still drive the overall tint and the photo only
            // adds the real grass detail (yellow flecks, blade structure).
            const vec3 GM = vec3(0.378, 0.426, 0.190);
            vec3 g1 = texture2D(uGrass, w / 2.6).rgb / GM;
            vec3 g2 = texture2D(uGrass, vec2(w.y, -w.x) / 10.5 + 0.3).rgb / GM;
            vec3 g3 = texture2D(uGrass, w / 47.0 + 0.7).rgb / GM;
            float nearF = 1.0 - smoothstep(25.0, 90.0, shpDist);
            float midF = 1.0 - smoothstep(70.0, 320.0, shpDist);
            vec3 detail = mix(vec3(1.0), g1, 0.95 * nearF) * mix(vec3(1.0), g2, 0.75 * midF) * mix(vec3(1.0), g3, 0.65);
            // warm olive-yellow <-> deeper green patches, plus light/dark patches and rare dry/clover specks
            vec3 tint = mix(vec3(1.10, 1.02, 0.70), vec3(0.76, 0.96, 0.70), vA.g);
            float lum = 0.74 + 0.52 * mix(vA.r, vB.r, 0.45);
            float speck = (vB.b - 0.5) * 0.30;
            diffuseColor.rgb *= detail * mix(vec3(1.0), tint, 0.85) * lum * (1.0 + speck);
          }`);
      };
      mat.needsUpdate = true;
      return mat;
    }
  };

  // Real sourced CC0 photo textures (ambientcg.com — Grass005, Rock064,
  // Asphalt033, WoodSiding013) replacing the flat-color / canvas-noise
  // materials for the ground/rock/road/fence, per
  // SLOWROADS_PARITY_LOG.md item 6. Same lazy-load-and-cache shape as
  // TreeBillboardFactory, same rule learned from that bug: never assign
  // `.encoding` synchronously right after `.load()` — that rendered the
  // tree sprites solid black because the image hadn't finished its async
  // fetch yet when the assignment ran.
  const RealTextureFactory = {
    _cache: null,
    _loader: null,
    _get(key, url) {
      this._cache = this._cache || new Map();
      this._loader = this._loader || new THREE.TextureLoader();
      let tex = this._cache.get(key);
      if (!tex) {
        tex = this._loader.load(url);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        this._cache.set(key, tex);
      }
      return tex;
    },
    grassColor() { return this._get('grassColor', 'assets/textures/grass_color.webp'); },
    // Separate cache key/instance (NOT texture.clone() of grassColor()) —
    // the world floor needs its own `.repeat` scale, different from the
    // terrain ribbon's. Cloning a texture before its async image load
    // completes copies `.image` as undefined at that instant, and the
    // clone never receives the original's later load callback — confirmed
    // directly: `floorMesh.material.map.image` was `undefined` at runtime
    // despite the source texture rendering correctly elsewhere. Loading
    // the same URL again is cheap (the browser's own HTTP cache dedupes
    // the actual network fetch) and gives a fully independent, properly
    // self-loading Texture instance instead.
    grassColorFloor() { return this._get('grassColorFloor', 'assets/textures/grass_color.webp'); },
    grassNormal() { return this._get('grassNormal', 'assets/textures/grass_normal.webp'); },
    rockColor() { return this._get('rockColor', 'assets/textures/rock_color.webp'); },
    rockNormal() { return this._get('rockNormal', 'assets/textures/rock_normal.webp'); },
    roadColor() { return this._get('roadColor', 'assets/textures/road_color.webp'); },
    roadNormal() { return this._get('roadNormal', 'assets/textures/road_normal.webp'); },
    woodColor() { return this._get('woodColor', 'assets/textures/wood_color.webp'); },
    woodNormal() { return this._get('woodNormal', 'assets/textures/wood_normal.webp'); },
    pathPaversColor() { return this._get('pathPaversC', 'assets/textures/path_pavers_c.webp'); },
    pathPaversNormal() { return this._get('pathPaversN', 'assets/textures/path_pavers_n.webp'); },
    edgeStoneColor() { return this._get('edgeStoneC', 'assets/textures/edge_stone_c.webp'); },
    edgeStoneNormal() { return this._get('edgeStoneN', 'assets/textures/edge_stone_n.webp'); }
  };

  // --------------------------------------------------------------------------
  // 4.5. ROAD SPATIAL HASH GRID (Accurate hairpin/switchback road clearance queries)
  // --------------------------------------------------------------------------
  class RoadSpatialGrid {
    constructor(cellSize = 25.0) {
      this.cellSize = cellSize;
      this.grid = new Map();
      this.points = [];
    }

    _key(cx, cz) {
      return `${cx},${cz}`;
    }

    build(roadSpacedPoints) {
      this.grid.clear();
      this.points = roadSpacedPoints || [];
      if (!this.points.length) return;

      const cs = this.cellSize;
      for (let i = 0; i < this.points.length; i++) {
        const pt = this.points[i];
        const cx = Math.floor(pt.x / cs);
        const cz = Math.floor(pt.z / cs);
        const key = this._key(cx, cz);
        let cell = this.grid.get(key);
        if (!cell) {
          cell = [];
          this.grid.set(key, cell);
        }
        cell.push(i);
      }
    }

    getNearestRoadPoint(x, z, maxDist = 30.0) {
      if (!this.points.length) return null;
      const cs = this.cellSize;
      const minCx = Math.floor((x - maxDist) / cs);
      const maxCx = Math.floor((x + maxDist) / cs);
      const minCz = Math.floor((z - maxDist) / cs);
      const maxCz = Math.floor((z + maxDist) / cs);

      let nearest = null;
      let minSq = maxDist * maxDist;

      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          const cell = this.grid.get(this._key(cx, cz));
          if (!cell) continue;
          for (let k = 0; k < cell.length; k++) {
            const idx = cell[k];
            const p1 = this.points[idx];

            // 1. Point distance check
            const dx1 = x - p1.x;
            const dz1 = z - p1.z;
            const dSq1 = dx1 * dx1 + dz1 * dz1;
            if (dSq1 < minSq) {
              minSq = dSq1;
              nearest = { point: p1, dist: Math.sqrt(dSq1), distSq: dSq1, y: p1.y, index: idx };
            }

            // 2. Continuous line-segment projection to adjacent road point (eliminates discretization gaps)
            if (idx + 1 < this.points.length) {
              const p2 = this.points[idx + 1];
              const vx = p2.x - p1.x;
              const vz = p2.z - p1.z;
              const segLenSq = vx * vx + vz * vz;
              if (segLenSq > 0.001) {
                const t = Math.max(0, Math.min(1, ((x - p1.x) * vx + (z - p1.z) * vz) / segLenSq));
                const projX = p1.x + t * vx;
                const projZ = p1.z + t * vz;
                const projY = p1.y + t * (p2.y - p1.y);
                const pdx = x - projX;
                const pdz = z - projZ;
                const pDistSq = pdx * pdx + pdz * pdz;
                if (pDistSq < minSq) {
                  minSq = pDistSq;
                  nearest = { point: { x: projX, y: projY, z: projZ }, dist: Math.sqrt(pDistSq), distSq: pDistSq, y: projY, index: idx };
                }
              }
            }
          }
        }
      }
      return nearest;
    }
  }

  // --------------------------------------------------------------------------
  // 5. SLOW ROADS PROCEDURAL TERRAIN & DUAL-GRID ARCHITECTURE
  // --------------------------------------------------------------------------

  S.RockGeometryFactory = RockGeometryFactory;
  S.TreeBillboardFactory = TreeBillboardFactory;
  S.ClumpTreeFactory = ClumpTreeFactory;
  S.ConiferFactory = ConiferFactory;
  S.RoadGrassFactory = RoadGrassFactory;
  S.GroundDetail = GroundDetail;
  S.RealTextureFactory = RealTextureFactory;
  S.RoadSpatialGrid = RoadSpatialGrid;
})();
