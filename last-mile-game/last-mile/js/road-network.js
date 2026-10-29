(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const { CONFIG } = S;

  // ============================================================================
  // ROAD NETWORK (WI-05): the zone graph chosen in WI-04 (option b).
  //
  // The existing route spline stays the single source of road geometry. This module samples it
  // once into an explicit lane graph for a zone: four-way junctions on the main road, a short
  // cross road through each, lanes as baked polylines with stored successor/predecessor links,
  // turn connectors inside each junction box, portals at the zone edge, and a two-phase signal
  // per junction. Left-hand traffic. Pure data: nothing here draws the road or moves a vehicle
  // (the debug overlay below is opt-in).
  // ============================================================================
  const NET = {
    BOX_HALF: 10,               // junction box half-size (m); WI-04 decision, 5-6 m turn arcs
    ARM_END: 120,               // main road lanes continue this far past the outer junctions
    CROSS_ARM: 110,             // cross road length either side of the centre
    STEP: 2,                    // baked polyline spacing (m)
    SITE_WINDOWS: [[260, 340], [480, 560], [720, 800], [960, 1040]],   // metres along the route
    GREEN: [11, 8],             // main / cross green (s)
    AMBER: 2.5, ALL_RED: 1.5
  };

  const leftOf = (tx, tz) => { const l = Math.hypot(tx, tz) || 1; return [tz / l, -tx / l]; };   // left of a heading (x/z, y up)

  class RoadNetwork {
    constructor(world, opts) {
      this.world = world;
      this.opt = Object.assign({}, NET, opts || {});
      this.laneOffset = CONFIG.ROAD_WIDTH / 4;
      this.lanes = new Map();
      this.junctions = [];
      this._grid = new Map();
      this._cell = 10;
    }

    // Pick junction positions: the straightest 5 m station inside each window.
    _sites() {
      const curve = this.world.curve, L = curve.getLength(), out = [];
      for (const [a, b] of this.opt.SITE_WINDOWS) {
        if (b + this.opt.BOX_HALF > L) continue;
        let best = null;
        for (let s = a; s <= b; s += 5) {
          const t0 = curve.getTangentAt(Math.max(0, s - 12) / L), t1 = curve.getTangentAt(Math.min(L, s + 12) / L);
          const k = Math.abs(Math.atan2(t0.x * t1.z - t0.z * t1.x, t0.x * t1.x + t0.z * t1.z));
          if (!best || k < best.k) best = { s, k };
        }
        out.push(best.s);
      }
      return out;
    }

    // Cross-road height profile, sampled every 4 m: flat at the main road's slab through the box and the
    // first 40 m, then easing toward the hillside at no more than 5 % so it never climbs like the slope.
    _profile(P, cross) {
      const len = cross.getLength(), mid = len / 2, y0 = P.y + 0.12, step = 4, n = Math.ceil(len / step) + 1, ys = [];
      for (let i = 0; i < n; i++) {
        const s = Math.min(len, i * step), o = Math.abs(s - mid), p = cross.getPointAt(s / len);
        const raw = this.world._baseTerrainHeight(p.x, p.z) - 0.3;
        const g = Math.max(0, o - 40) * 0.05;
        ys.push(y0 + Math.max(-g, Math.min(g, raw - y0)));
      }
      return { ys, step, len };
    }
    crossY(j, s) {
      const { ys, step } = j.prof, f = Math.max(0, Math.min(ys.length - 1, s / step)), i = Math.min(ys.length - 2, Math.floor(f));
      return ys[i] + (ys[i + 1] - ys[i]) * (f - i);
    }
    // Ground grading beside the cross roads: level with the road surface under it (0.2 m below the slab),
    // easing back to the natural hillside over 24 m.
    adjustHeight(x, z, h) {
      const R = this.opt.CROSS_ARM + 30;
      for (const j of this.junctions) {
        const dx = x - j.centre.x, dz = z - j.centre.z;
        if (dx * dx + dz * dz > R * R) continue;
        const len = j.prof.len, mid = len / 2;
        // the cross road is a straight line through the junction centre: project onto it
        const along = dx * j.dirX + dz * j.dirZ, sp = Math.max(0, Math.min(len, mid + along)), bs = sp;
        const ex = dx - (sp - mid) * j.dirX, ez = dz - (sp - mid) * j.dirZ, bd = ex * ex + ez * ez;
        const d = Math.sqrt(bd), core = CONFIG.ROAD_WIDTH / 2 + 1.5, fade = 24;
        if (d >= core + fade) continue;
        const t = d <= core ? 1 : 1 - (d - core) / fade, w = t * t * (3 - 2 * t);
        return h + (this.crossY(j, bs) - 0.2 - h) * w;
      }
      return h;
    }

    _mkLane(id, kind, pts, extra) {
      let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const l = Object.assign({ id, kind, pts, len, step: len / (pts.length - 1), succ: [], pred: [] }, extra || {});
      this.lanes.set(id, l);
      return l;
    }

    // Lane polyline along a curve between arc positions sFrom -> sTo, offset to the left of travel.
    _alongCurve(curve, curveLen, sFrom, sTo, yAt) {
      const n = Math.max(2, Math.round(Math.abs(sTo - sFrom) / this.opt.STEP) + 1), travel = Math.sign(sTo - sFrom) || 1, pts = [];
      for (let i = 0; i < n; i++) {
        const s = sFrom + (sTo - sFrom) * i / (n - 1), u = Math.min(1, Math.max(0, s / curveLen));
        const p = curve.getPointAt(u), t = curve.getTangentAt(u), tx = t.x * travel, tz = t.z * travel, [lx, lz] = leftOf(tx, tz);
        pts.push({ x: p.x + lx * this.laneOffset, y: yAt ? yAt(s) + 0.02 : p.y + 0.12, z: p.z + lz * this.laneOffset, tx, tz });
      }
      return pts;
    }

    _connector(a, b) {   // cubic Bezier from the end pose of one lane to the start pose of the next
      const A = new THREE.Vector3(a.x, a.y, a.z), B = new THREE.Vector3(b.x, b.y, b.z), k = A.distanceTo(B) / 3;
      const dA = new THREE.Vector3(a.tx, 0, a.tz).normalize(), dB = new THREE.Vector3(b.tx, 0, b.tz).normalize();
      const c = new THREE.CubicBezierCurve3(A, A.clone().addScaledVector(dA, k), B.clone().addScaledVector(dB, -k), B);
      const n = Math.max(3, Math.round(c.getLength() / 1) + 1), pts = [];
      for (let i = 0; i < n; i++) { const f = i / (n - 1), p = c.getPoint(f), t = c.getTangent(f); pts.push({ x: p.x, y: p.y, z: p.z, tx: t.x, tz: t.z }); }
      return pts;
    }

    build() {
      const world = this.world, main = world.curve, L = main.getLength(), BOX = this.opt.BOX_HALF;
      const sites = this._sites();
      if (!sites.length) return this;
      // junctions with their cross road
      sites.forEach((s, i) => {
        const P = main.getPointAt(s / L), T = main.getTangentAt(s / L), nl = Math.hypot(T.x, T.z), nx = -T.z / nl, nz = T.x / nl;
        const cross = new THREE.CatmullRomCurve3([-1, -0.5, 0, 0.5, 1].map((f) => new THREE.Vector3(P.x + nx * f * this.opt.CROSS_ARM, P.y, P.z + nz * f * this.opt.CROSS_ARM)), false, 'centripetal');
        cross.arcLengthDivisions = 300;
        const prof = this._profile(P, cross);
        const crossPts = []; for (let i = 0, n = prof.ys.length; i < n; i++) crossPts.push(cross.getPointAt(Math.min(1, i * prof.step / prof.len)));
        this.junctions.push({ prof, crossPts, dirX: nx, dirZ: nz, id: 'J' + i, s, centre: P.clone(), tangent: T.clone(), cross, crossLen: cross.getLength(), phaseOffset: (i * 7.3) % 27, ins: {}, outs: {} });
      });
      const J = this.junctions;
      // main-road lanes. fwd travels +s (arm 'mN' faces -s ... named by the direction the traffic comes FROM)
      const bounds = [J[0].s - this.opt.ARM_END, ...J.map((j) => j.s), J[J.length - 1].s + this.opt.ARM_END];
      for (let k = 0; k <= J.length; k++) {
        const a = k === 0 ? bounds[0] : J[k - 1].s + BOX, b = k === J.length ? bounds[bounds.length - 1] : J[k].s - BOX;
        const f = this._mkLane(`F${k}`, 'road', this._alongCurve(main, L, a, b));
        const r = this._mkLane(`B${k}`, 'road', this._alongCurve(main, L, b, a));
        if (k < J.length) { f.toJunction = J[k].id; f.group = 'main'; J[k].ins.mainFwd = f; r.fromJunction = J[k].id; J[k].outs.mainBwd = r; }
        if (k > 0) { f.fromJunction = J[k - 1].id; J[k - 1].outs.mainFwd = f; r.toJunction = J[k - 1].id; r.group = 'main'; J[k - 1].ins.mainBwd = r; }
        if (k === 0) { f.pred.push({ portal: true, id: 'entry:F0' }); r.succ.push({ portal: true, id: 'exit:B0' }); }
        if (k === J.length) { f.succ.push({ portal: true, id: 'exit:F' + k }); r.pred.push({ portal: true, id: 'entry:B' + k }); }
      }
      // cross-road lanes
      for (const j of J) {
        const cl = j.crossLen, mid = cl / 2;
        for (const [name, dir] of [['crossPos', 1], ['crossNeg', -1]]) {
          const far = mid + dir * (this.opt.CROSS_ARM), near = mid + dir * BOX;
          const inL = this._mkLane(`${j.id}.${name}.in`, 'road', this._alongCurve(j.cross, cl, far, near, (q) => this.crossY(j, q)), { toJunction: j.id, group: 'cross' });
          const outL = this._mkLane(`${j.id}.${name}.out`, 'road', this._alongCurve(j.cross, cl, near, far, (q) => this.crossY(j, q)), { fromJunction: j.id });
          inL.pred.push({ portal: true, id: 'entry:' + inL.id }); outL.succ.push({ portal: true, id: 'exit:' + outL.id });
          j.ins[name] = inL; j.outs[name] = outL;
        }
      }
      // turn connectors: every in-lane to every out-lane of a different arm (no U-turns)
      const armOf = { mainFwd: 'main', mainBwd: 'main', crossPos: 'cross', crossNeg: 'cross' };
      for (const j of J) {
        j.connectors = [];
        for (const [inName, inL] of Object.entries(j.ins)) for (const [outName, outL] of Object.entries(j.outs)) {
          // an in-lane that arrives travelling +s (mainFwd) leaves through mainFwd; arriving mainBwd leaves through mainBwd.
          // U-turns: same road, opposite direction (mainFwd in -> mainBwd out), and cross likewise.
          const uTurn = (armOf[inName] === armOf[outName]) && (inName.endsWith('Fwd') ? 'mainBwd' : inName.endsWith('Bwd') ? 'mainFwd' : inName === 'crossPos' ? 'crossPos' : 'crossNeg') === outName;
          if (uTurn) continue;
          const a = inL.pts[inL.pts.length - 1], b = outL.pts[0];
          const c = this._mkLane(`${inL.id}>${outL.id}`, 'turn', this._connector(a, b), { junction: j.id, group: inL.group, from: inL.id, to: outL.id });
          c.pred.push(inL); c.succ.push(outL); inL.succ.push(c); outL.pred.push(c); j.connectors.push(c);
        }
      }
      // conflict table: two connectors of one junction conflict when they merge into the same out lane or cross
      const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
      for (const j of J) {
        for (const c of j.connectors) c.conflicts = [];
        for (let a = 0; a < j.connectors.length; a++) for (let b = a + 1; b < j.connectors.length; b++) {
          const A = j.connectors[a], B = j.connectors[b];
          if (A.from === B.from) continue;                       // one in-lane splitting is not a conflict
          let hit = A.to === B.to;
          for (let i = 0; i < A.pts.length - 1 && !hit; i++) for (let k = 0; k < B.pts.length - 1; k++) if (segX(A.pts[i], A.pts[i + 1], B.pts[k], B.pts[k + 1])) { hit = true; break; }
          if (hit) { A.conflicts.push(B.id); B.conflicts.push(A.id); }
        }
      }
      // spatial index
      for (const l of this.lanes.values()) l.pts.forEach((p, idx) => {
        const k = Math.floor(p.x / this._cell) + ',' + Math.floor(p.z / this._cell);
        (this._grid.get(k) || this._grid.set(k, []).get(k)).push({ l, idx });
      });
      return this;
    }

    pose(lane, d) {
      const l = typeof lane === 'string' ? this.lanes.get(lane) : lane;
      const f = Math.min(l.pts.length - 1, Math.max(0, d / l.step)), i = Math.min(l.pts.length - 2, Math.floor(f)), w = f - i, a = l.pts[i], b = l.pts[i + 1];
      return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, z: a.z + (b.z - a.z) * w, tx: a.tx + (b.tx - a.tx) * w, tz: a.tz + (b.tz - a.tz) * w };
    }

    nearest(x, z, maxDist = 8) {
      const c = this._cell, cx = Math.floor(x / c), cz = Math.floor(z / c); let best = null, bd = maxDist * maxDist;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const e of (this._grid.get((cx + i) + ',' + (cz + j)) || [])) {
        const p = e.l.pts[e.idx], d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      return best && { lane: best.l, s: best.idx * best.l.step, dist: Math.sqrt(bd) };
    }

    // Two-phase signal. t = seconds. Returns 'green' | 'amber' | 'red' for a lane group at junction j.
    signalState(j, group, t) {
      const o = this.opt, cycle = o.GREEN[0] + o.GREEN[1] + 2 * (o.AMBER + o.ALL_RED);
      let x = ((t + j.phaseOffset) % cycle + cycle) % cycle;
      const seq = [['main', 'green', o.GREEN[0]], ['main', 'amber', o.AMBER], [null, 'red', o.ALL_RED], ['cross', 'green', o.GREEN[1]], ['cross', 'amber', o.AMBER], [null, 'red', o.ALL_RED]];
      for (const [g, st, dur] of seq) { if (x < dur) return g === group ? st : 'red'; x -= dur; }
      return 'red';
    }
    signalCycle() { const o = this.opt; return o.GREEN[0] + o.GREEN[1] + 2 * (o.AMBER + o.ALL_RED); }


    _crossYFor(curve, s) { const j = this.junctions.find((q) => q.cross === curve); return this.crossY(j, s); }

    inBox(s, pad = 0) { for (const j of this.junctions) if (Math.abs(s - j.s) < this.opt.BOX_HALF + pad) return true; return false; }
    nearJunction(p, r) { for (const j of this.junctions) if (Math.hypot(p.x - j.centre.x, p.z - j.centre.z) < r) return true; return false; }
    // Circles that keep plants and ground cover off the cross roads.
    corridorCircles() {
      if (this._circles) return this._circles;
      const out = [], r = CONFIG.ROAD_WIDTH / 2 + 2.2;
      for (const j of this.junctions) for (let s = 0; s <= j.crossLen; s += 4) out.push({ pos: j.cross.getPointAt(s / j.crossLen), r });
      return (this._circles = out);
    }

    // Cross-road surface: a tarmac ribbon along each cross road with the main road's own material,
    // plus edge lines and centre dashes (none inside the junction box).
    buildSurface() {
      const g = new THREE.Group(); g.name = 'CrossRoads';
      const w = this.world, base = w.roadMesh && w.roadMesh.material;
      const mat = base ? base.clone() : new THREE.MeshStandardMaterial({ color: 0x3a3d44 });
      mat.vertexColors = false; if (w.roadTarmac) mat.color.copy(w.roadTarmac);
      const half = CONFIG.ROAD_WIDTH / 2, BOX = this.opt.BOX_HALF;
      const ribbon = (curve, len, lo, hi, s0, s1, lift) => {
        const pos = [], uv = [], idx = []; let n = 0;
        const step = 2;
        for (let s = s0; s <= s1 + 1e-6; s += step) {
          const u = Math.min(1, Math.max(0, s / len)), p = curve.getPointAt(u), t = curve.getTangentAt(u), lx = -t.z, lz = t.x, ll = Math.hypot(lx, lz) || 1;
          for (const off of [lo, hi]) {
            const x = p.x + lx / ll * off, z = p.z + lz / ll * off;
            pos.push(x, this._crossYFor(curve, s) + lift, z); uv.push(off * 0.5, s * 0.3);
          }
          if (n) idx.push(2 * n - 2, 2 * n, 2 * n - 1, 2 * n - 1, 2 * n, 2 * n + 1);
          n++;
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx); geo.computeVertexNormals(); return geo;
      };
      const paint = new THREE.MeshBasicMaterial({ color: 0xe8e6dc, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      for (const j of this.junctions) {
        const len = j.crossLen, mid = len / 2, a = Math.max(0, mid - this.opt.CROSS_ARM), b = Math.min(len, mid + this.opt.CROSS_ARM);
        const m = new THREE.Mesh(ribbon(j.cross, len, -half, half, a, b, 0.04), mat); m.receiveShadow = true; m.userData.crossRoad = j.id; g.add(m);
        // edge lines + centre dashes outside the box, merged into ONE mesh per junction
        const acc = { pos: [], uv: [], idx: [] };
        const add = (geo) => { const base = acc.pos.length / 3, p = geo.attributes.position.array; for (let i = 0; i < p.length; i++) acc.pos.push(p[i]); for (const k of geo.index.array) acc.idx.push(base + k); };
        for (const [lo, hi, dashed] of [[-half + 0.05, -half + 0.2, false], [half - 0.2, half - 0.05, false], [-0.09, 0.09, true]]) {
          const segs = dashed ? [] : [[a, mid - BOX], [mid + BOX, b]];
          if (dashed) for (const [s0, s1] of [[a, mid - BOX], [mid + BOX, b]]) for (let s = s0; s + 3 <= s1; s += 8) segs.push([s, s + 3]);
          for (const [s0, s1] of segs) add(ribbon(j.cross, len, lo, hi, s0, s1, 0.07));
        }
        const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3)); pg.setIndex(acc.idx);
        g.add(new THREE.Mesh(pg, paint));
      }
      return g;
    }

    // Signal heads: for every approach, a pole on the left kerb just before the stop line with a three-lamp
    // head facing the approaching traffic. Poles and heads are one merged mesh per junction; the lamps are a
    // second mesh whose vertex colours change with the phase (2 draw calls per junction).
    buildSignals() {
      const g = new THREE.Group(); g.name = 'Signals'; this._signals = [];
      const pole = new THREE.MeshLambertMaterial({ color: 0x3b3f45 }), lampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
      const box = (pos, nor, idx, col, cx, cy, cz, sx, sy, sz, yaw) => {
        const bg = new THREE.BoxGeometry(sx, sy, sz); bg.rotateY(yaw); bg.translate(cx, cy, cz);
        const p = bg.attributes.position, n = bg.attributes.normal, base = pos.length / 3;
        for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(0.23, 0.25, 0.28); }
        for (const k of bg.index.array) idx.push(base + k);
      };
      for (const j of this.junctions) {
        const pos = [], nor = [], idx = [], col = [];
        const lampPos = [], lampCol = [], lampIdx = [], heads = [];
        const ins = Object.values(j.ins);
        for (const inL of ins) {
          const e = inL.pts[inL.pts.length - 1], tx = e.tx, tz = e.tz, [lx, lz] = leftOf(tx, tz);
          // stop line is the lane end; the pole stands 1 m before it, beside the left kerb of the lane
          const px = e.x - tx * 1.0 + lx * (this.laneOffset + 1.4), pz = e.z - tz * 1.0 + lz * (this.laneOffset + 1.4), py = e.y;
          const yaw = Math.atan2(-tx, -tz);                      // head faces back toward oncoming traffic
          box(pos, nor, idx, col, px, py + 1.9, pz, 0.12, 3.8, 0.12, 0);
          box(pos, nor, idx, col, px, py + 3.9, pz, 0.34, 1.05, 0.26, yaw);
          const lampIds = [];
          for (let k = 0; k < 3; k++) {         // red top, amber, green bottom
            const cy = py + 4.2 - k * 0.32, fx = px - tx * 0.14, fz = pz - tz * 0.14, hw = 0.11;
            const base = lampPos.length / 3, rx = -tz, rz = tx;     // across the face
            lampPos.push(fx - rx * hw, cy - hw, fz - rz * hw, fx + rx * hw, cy - hw, fz + rz * hw, fx + rx * hw, cy + hw, fz + rz * hw, fx - rx * hw, cy + hw, fz - rz * hw);
            for (let q = 0; q < 4; q++) lampCol.push(0.1, 0.1, 0.1);
            lampIdx.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
            lampIds.push(base);
          }
          heads.push({ group: inL.group, lampIds });
        }
        const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); pg.setIndex(idx);
        const polesMesh = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ vertexColors: true })); polesMesh.castShadow = true; g.add(polesMesh);
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lampCol, 3)); lg.setIndex(lampIdx);
        const lampMesh = new THREE.Mesh(lg, lampMat); g.add(lampMesh);
        this._signals.push({ j, heads, lampMesh, last: '' });
      }
      this._t = 0; this.update(0);
      return g;
    }

    update(dt) {
      if (!this._signals) return;
      this._t += dt;
      const ON = { red: [1, 0.15, 0.12], amber: [1, 0.7, 0.1], green: [0.15, 1, 0.35] }, OFF = { red: [0.22, 0.04, 0.04], amber: [0.22, 0.14, 0.02], green: [0.03, 0.2, 0.07] };
      for (const sg of this._signals) {
        const st = { main: this.signalState(sg.j, 'main', this._t), cross: this.signalState(sg.j, 'cross', this._t) };
        const key = st.main + st.cross;
        if (key === sg.last) continue;
        sg.last = key;
        const col = sg.lampMesh.geometry.attributes.color;
        for (const h of sg.heads) {
          const s = st[h.group];
          ['red', 'amber', 'green'].forEach((name, k) => {
            const c = (s === name ? ON : OFF)[name], base = h.lampIds[k];
            for (let q = 0; q < 4; q++) col.setXYZ(base + q, c[0], c[1], c[2]);
          });
        }
        col.needsUpdate = true;
      }
    }

    // Opt-in debug overlay (?net=1&netdebug=1): lane lines (road = cyan, turns = yellow) and a flat grey patch for each
    // cross road and junction box so a screenshot shows the layout. Not the final road surface.
    debugGroup() {
      const g = new THREE.Group(); g.name = 'RoadNetDebug';
      const road = [], turn = [];
      for (const l of this.lanes.values()) {
        const arr = l.kind === 'turn' ? turn : road;
        for (let i = 0; i < l.pts.length - 1; i++) arr.push(l.pts[i].x, l.pts[i].y + 0.35, l.pts[i].z, l.pts[i + 1].x, l.pts[i + 1].y + 0.35, l.pts[i + 1].z);
      }
      const mk = (a, col) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: col })); };
      g.add(mk(road, 0x22d3ee)); g.add(mk(turn, 0xfacc15));
      const mat = new THREE.MeshBasicMaterial({ color: 0x3a3d44 });
      for (const j of this.junctions) {
        const w = CONFIG.ROAD_WIDTH, pos = [], idx = []; let n = 0;
        const cl = j.crossLen;
        for (let s = 0; s <= cl; s += 4) { const u = s / cl, p = j.cross.getPointAt(u), t = j.cross.getTangentAt(u), lx = -t.z, lz = t.x;
          pos.push(p.x + lx * w / 2, p.y + 0.12, p.z + lz * w / 2, p.x - lx * w / 2, p.y + 0.12, p.z - lz * w / 2); if (n) idx.push(2 * n - 2, 2 * n - 1, 2 * n, 2 * n - 1, 2 * n + 1, 2 * n); n++; }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
        const m = new THREE.Mesh(geo, mat); m.material.side = THREE.DoubleSide; g.add(m);
      }
      return g;
    }
  }

  RoadNetwork.NET = NET;
  S.RoadNetwork = RoadNetwork;
})();
