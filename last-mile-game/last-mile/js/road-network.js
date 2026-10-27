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

    _mkLane(id, kind, pts, extra) {
      let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const l = Object.assign({ id, kind, pts, len, step: len / (pts.length - 1), succ: [], pred: [] }, extra || {});
      this.lanes.set(id, l);
      return l;
    }

    // Lane polyline along a curve between arc positions sFrom -> sTo, offset to the left of travel.
    _alongCurve(curve, curveLen, sFrom, sTo) {
      const n = Math.max(2, Math.round(Math.abs(sTo - sFrom) / this.opt.STEP) + 1), travel = Math.sign(sTo - sFrom) || 1, pts = [];
      for (let i = 0; i < n; i++) {
        const s = sFrom + (sTo - sFrom) * i / (n - 1), u = Math.min(1, Math.max(0, s / curveLen));
        const p = curve.getPointAt(u), t = curve.getTangentAt(u), tx = t.x * travel, tz = t.z * travel, [lx, lz] = leftOf(tx, tz);
        pts.push({ x: p.x + lx * this.laneOffset, y: p.y, z: p.z + lz * this.laneOffset, tx, tz });
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
        this.junctions.push({ id: 'J' + i, s, centre: P.clone(), tangent: T.clone(), cross, crossLen: cross.getLength(), phaseOffset: (i * 7.3) % 27, ins: {}, outs: {} });
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
          const inL = this._mkLane(`${j.id}.${name}.in`, 'road', this._alongCurve(j.cross, cl, far, near), { toJunction: j.id, group: 'cross' });
          const outL = this._mkLane(`${j.id}.${name}.out`, 'road', this._alongCurve(j.cross, cl, near, far), { fromJunction: j.id });
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

    // Opt-in debug overlay: lane lines (road = cyan, turns = yellow) and a flat grey patch for each
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
