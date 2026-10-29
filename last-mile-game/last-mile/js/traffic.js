(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};

  // ============================================================================
  // AI TRAFFIC (WI-06 / WI-07): agents drive the zone road network's lane graph.
  //  - generic NPC vehicles from npc-vehicles.glb, drawn as instanced meshes (2 draw calls per kind)
  //  - follow the lane ahead with a safe gap, stop at red, take a random turn at each junction
  //  - junction rules: enter only on green (or amber when they cannot stop), only when no conflicting
  //    turn is occupied or reserved, and only when the road beyond has room
  //  - a watchdog removes any agent stuck for too long, so nothing can freeze the simulation
  // Seeded, so the same seed gives the same traffic. Active only with ?net=1 for now.
  // ============================================================================
  const T = {
    TARGET: 20, MAX: 24,
    SPAWN_MIN: 60, SPAWN_MAX: 230, DESPAWN: 300,
    WATCHDOG_S: 40,             // stopped this long (red phases and queues are shorter) = removed
    JUNCTION_SPEED: 4.5,
    HEADWAY: 1.2, MIN_GAP: 2.0, DECEL: 3.5, BRAKE: 7.0
  };
  const KINDS = {
    scooter:    { rad: 0.4, w: 0.34, v: 7.5, half: 0.9, acc: 3.4, colors: [0xb91c1c, 0x1d4ed8, 0xe7e5e4, 0x16a34a, 0x0f172a, 0xca8a04] },
    hatchback:  { rad: 0.85, w: 0.20, v: 8.5, half: 1.9, acc: 2.6, colors: [0xf5f5f4, 0xd6d3d1, 0x6b7280, 0x1f2937, 0xb91c1c, 0x1d4ed8, 0xe5e7eb] },
    sedan:      { rad: 0.9, w: 0.10, v: 8.5, half: 2.2, acc: 2.6, colors: [0xf5f5f4, 0xd6d3d1, 0x374151, 0x111827, 0x7f1d1d] },
    suv:        { rad: 0.97, w: 0.07, v: 8.0, half: 2.3, acc: 2.4, colors: [0xf5f5f4, 0x111827, 0x6b7280, 0x1e3a5f] },
    cab:        { rad: 0.85, w: 0.09, v: 7.5, half: 2.1, acc: 2.4, colors: [0xf7c600] },
    auto:       { rad: 0.75, w: 0.10, v: 6.5, half: 1.3, acc: 2.2, colors: [0xf7c600, 0x16a34a] },
    tempo:      { rad: 0.8, w: 0.04, v: 6.5, half: 1.7, acc: 1.8, colors: [0x1d4ed8, 0xf5f5f4, 0xea580c] },
    bus_single: { rad: 1.25, w: 0.04, v: 6.5, half: 5.2, acc: 1.4, colors: [0xc2410c] },
    bus_double: { rad: 1.25, w: 0.02, v: 6.0, half: 5.0, acc: 1.2, colors: [0xb91c1c] }
  };
  const KIND_NAMES = Object.keys(KINDS);

  const mulberry = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  class TrafficSystem {
    constructor(game, net, opts) {
      this.game = game; this.net = net; this.opt = Object.assign({}, T, opts || {});
      this.rand = mulberry((opts && opts.seed) || 5927);
      this.agents = []; this.nextId = 1; this.spawnClock = 0;
      this.occ = new Map();                // lane id -> agents on it, kept sorted by d
      this.reserved = new Map();           // connector id -> agent that has claimed it
      this.stats = { collisions: 0, playerHits: 0, spawned: 0, despawned: 0, watchdog: 0, overlaps: 0, maxCount: 0, steps: 0, sumCount: 0, kinds: {} };
      this.roadLanes = [...net.lanes.values()].filter((l) => l.kind === 'road');
      this.render = null;                  // set by attachRender()
      this.playerPos = null;
    }

    // ---------- rendering: one InstancedMesh pair per kind -----------------------------------
    attachRender(scene, gltf) {
      const group = new THREE.Group(); group.name = 'Traffic'; this.render = { group, kinds: {} };
      const paintMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.05 });
      const fixedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
      for (const name of KIND_NAMES) {
        const node = gltf.scene.getObjectByName('npc_' + name); if (!node) continue;
        const meshes = []; node.traverse((o) => { if (o.isMesh) meshes.push(o); });
        const entry = { instances: [], count: 0 };
        for (const m of meshes) {
          const isPaint = m.material && m.material.name === 'Paint';
          const im = new THREE.InstancedMesh(m.geometry, isPaint ? paintMat : fixedMat, this.opt.MAX);
          im.frustumCulled = false; im.castShadow = false; im.count = 0; im.visible = false;
          if (isPaint) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.opt.MAX * 3), 3);   // not setColorAt: it sizes the buffer from count, which is 0 here
          entry.instances.push({ im, isPaint }); group.add(im);
        }
        this.render.kinds[name] = entry;
      }
      scene.add(group);
    }
    _draw() {
      if (!this.render) return;
      const per = {}; for (const n of KIND_NAMES) per[n] = [];
      for (const a of this.agents) per[a.kind].push(a);
      const m4 = new THREE.Matrix4(), c = new THREE.Color();
      for (const n of KIND_NAMES) {
        const e = this.render.kinds[n]; if (!e) continue; const list = per[n];
        for (const inst of e.instances) {
          inst.im.count = list.length; inst.im.visible = list.length > 0;
          list.forEach((a, i) => {
            const p = this.net.pose(a.lane, a.d), yaw = Math.atan2(p.tx, p.tz);
            m4.makeRotationY(yaw); m4.setPosition(p.x, p.y, p.z); inst.im.setMatrixAt(i, m4);
            if (inst.isPaint) { c.setHex(a.color); inst.im.setColorAt(i, c); }
          });
          inst.im.instanceMatrix.needsUpdate = true; if (inst.im.instanceColor) inst.im.instanceColor.needsUpdate = true;
        }
      }
    }

    // ---------- collisions (WI-08) ------------------------------------------------------------
    // A vehicle body is a row of circles along its length. Two bodies collide when any pair of circles overlaps.
    _circles(x, z, tx, tz, half, rad) {
      const n = Math.max(2, Math.round((half * 2) / (rad * 1.6))), out = [], len = Math.hypot(tx, tz) || 1, ux = tx / len, uz = tz / len;
      for (let i = 0; i < n; i++) { const f = (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2) * (half - rad); out.push([x + ux * f, z + uz * f]); }
      return out;
    }
    _overlap(A, ra, B, rb) {
      let best = null;
      for (const p of A) for (const q of B) { const dx = q[0] - p[0], dz = q[1] - p[1], d = Math.hypot(dx, dz), pen = ra + rb - d; if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx: d > 1e-4 ? dx / d : 1, nz: d > 1e-4 ? dz / d : 0 }; }
      return best;
    }
    _crash(a, reason) { if (a.hit) return; a.hit = 0.001; a.v *= 0.25; if (a.claim) { if (this.reserved.get(a.claim) === a) this.reserved.delete(a.claim); a.claim = null; } if (reason === 'npc') this.stats.collisions++; }
    _checkCollisions(dt) {
      const net = this.net;
      const poses = this.agents.map((a) => net.pose(a.lane, a.d));
      // vehicle vs vehicle (rare: the gap logic prevents it; this stops any pile-up from freezing the simulation)
      const circ = this.agents.map((a, i) => this._circles(poses[i].x, poses[i].z, poses[i].tx, poses[i].tz, a.half, a.rad));
      for (let i = 0; i < this.agents.length; i++) for (let k = i + 1; k < this.agents.length; k++) {
        const A = this.agents[i], B = this.agents[k];
        if (Math.abs(poses[i].x - poses[k].x) > A.half + B.half + 1 || Math.abs(poses[i].z - poses[k].z) > A.half + B.half + 1) continue;
        if (this._overlap(circ[i], A.rad, circ[k], B.rad)) {
          if (!A.hit && !B.hit && this.opt.audit && (this.collisionLog = this.collisionLog || []).length < 8) this.collisionLog.push(`${A.kind}#${A.id} ${A.lane.id}@${A.d.toFixed(1)}/${A.lane.len.toFixed(0)} v${A.v.toFixed(1)} vs ${B.kind}#${B.id} ${B.lane.id}@${B.d.toFixed(1)}/${B.lane.len.toFixed(0)} v${B.v.toFixed(1)}`);
          this._crash(A, 'npc'); this._crash(B, 'npc');
        }
      }
      // player vs vehicle
      const veh = this.game && this.game.vehicle, cb = this.game && this.game._onTrafficCrash;
      if (!veh || !veh.mesh || !cb) return;
      const hv = veh.heading, ptx = Math.sin(hv), ptz = Math.cos(hv), pp = veh.mesh.position;
      const handling = this.game.vehicleHandling ? this.game.vehicleHandling() : 'car';
      const pHalf = handling === 'car' ? 2.0 : handling === 'threeWheeler' ? 1.4 : 0.9, pRad = handling === 'car' ? 1.0 : handling === 'threeWheeler' ? 0.8 : 0.4;
      const pc = this._circles(pp.x, pp.z, ptx, ptz, pHalf, pRad);
      for (let i = 0; i < this.agents.length; i++) {
        const A = this.agents[i];
        if (Math.abs(poses[i].x - pp.x) > A.half + pHalf + 1 || Math.abs(poses[i].z - pp.z) > A.half + pHalf + 1) continue;
        const o = this._overlap(pc, pRad, circ[i], A.rad);
        if (!o) continue;
        const rel = Math.hypot(veh.speed * ptx - A.v * poses[i].tx, veh.speed * ptz - A.v * poses[i].tz);
        this.stats.playerHits++;
        this._crash(A, 'player');
        cb.call(this.game, A, { pen: o.pen, nx: o.nx, nz: o.nz, relSpeed: rel });
      }
    }

    // ---------- helpers -----------------------------------------------------------------------
    _occ(lane) { return this.occ.get(lane.id) || []; }
    _add(a) { let l = this.occ.get(a.lane.id); if (!l) this.occ.set(a.lane.id, l = []); l.push(a); }
    _remove(a) { const l = this.occ.get(a.lane.id); if (l) { const i = l.indexOf(a); if (i >= 0) l.splice(i, 1); } if (a.claim) { if (this.reserved.get(a.claim) === a) this.reserved.delete(a.claim); a.claim = null; } }
    _pickKind() { let r = this.rand(), acc = 0; for (const n of KIND_NAMES) { acc += KINDS[n].w; if (r < acc) return n; } return 'hatchback'; }
    _chooseNext(a) {
      const lane = a.lane;
      if (lane.kind === 'turn') return lane.succ[0];
      const opts = lane.succ.filter((s) => !s.portal);
      if (!opts.length) return null;
      // straight 60 %, the others share the rest
      const straight = opts.reduce((best, c) => { const e = c.pts[c.pts.length - 1], s0 = c.pts[0]; const cross = Math.abs(s0.tx * e.tz - s0.tz * e.tx); return !best || cross < best.cross ? { c, cross } : best; }, null).c;
      if (opts.length === 1 || this.rand() < 0.6) return straight;
      const rest = opts.filter((c) => c !== straight); return rest[Math.floor(this.rand() * rest.length)];
    }
    _leader(a) {
      // nearest agent ahead on this lane, then on the lane(s) beyond (two hops)
      let best = null, gap = 1e9;
      for (const b of this._occ(a.lane)) if (b !== a && b.d > a.d && b.d - a.d < gap) { gap = b.d - a.d; best = b; }
      if (best) return { b: best, gap: gap - a.half - best.half };
      let lane = a.lane, base = lane.len - a.d, nxt = a.next;
      for (let hop = 0; hop < 2 && nxt; hop++) {
        let first = null, fd = 1e9; for (const b of this._occ(nxt)) if (b !== a && b.d < fd) { fd = b.d; first = b; }
        if (first) return { b: first, gap: base + fd - a.half - first.half };
        base += nxt.len; nxt = nxt.succ && nxt.succ.find((s) => !s.portal);
        if (nxt && nxt.kind === 'road' && hop === 0) { /* fall through to one more hop */ }
      }
      return null;
    }
    _playerAhead(a, p) {
      const pl = this.playerPos; if (!pl) return null;
      const dx = pl.x - p.x, dz = pl.z - p.z, along = dx * p.tx + dz * p.tz, lat = Math.abs(-dx * p.tz + dz * p.tx);
      if (along > 0 && along < 28 && lat < 2.3) return along - 2.6 - a.half;
      return null;
    }
    _whyNot(a, c) {
      for (const id of c.conflicts || []) { const oc = this.occ.get(id) || []; if (oc.length) return 'conflict-occ ' + id + ' ' + oc.map((b) => b.kind + '@' + b.d.toFixed(1) + ' v' + b.v.toFixed(2) + ' stuck' + b.stuck.toFixed(0)).join(','); const r = this.reserved.get(id); if (r && r !== a) return 'conflict-reserved ' + id + ' by ' + r.kind + ' on ' + r.lane.id + '@' + r.d.toFixed(1) + ' v' + r.v.toFixed(2); }
      const r0 = this.reserved.get(c.id); if (r0 && r0 !== a) return 'self-reserved by ' + r0.kind;
      const out = c.succ[0]; if (out && !out.portal) for (const b of this._occ(out)) if (b.d < a.half + b.half + 5) return 'out-lane ' + out.id + ' ' + b.kind + '@' + b.d.toFixed(1) + ' v' + b.v.toFixed(2);
      for (const b of this._occ(c)) if (b.d < a.half + b.half + 3) return 'on-connector ' + b.kind;
      return 'player/other';
    }
    _canEnter(a, c) {
      // fairness: a vehicle that has waited much longer for a conflicting turn goes first
      const mine = a.wait || 0; if (this.waitPrev) for (const id of c.conflicts || []) if ((this.waitPrev.get(id) || 0) > mine + 4) return false;
      for (const id of c.conflicts || []) { if ((this.occ.get(id) || []).length) return false; const r = this.reserved.get(id); if (r && r !== a) return false; }
      const r0 = this.reserved.get(c.id); if (r0 && r0 !== a) return false;
      const out = c.succ[0]; if (out && !out.portal) for (const b of this._occ(out)) if (b.d < a.half + b.half + 5) return false;   // no room beyond the box
      for (const b of this._occ(c)) if (b.d < a.half + b.half + 3) return false;
      if (this.playerPos) for (let i = 0; i < c.pts.length; i += 3) { if (Math.hypot(c.pts[i].x - this.playerPos.x, c.pts[i].z - this.playerPos.z) < 3.5) return false; }
      return true;
    }

    // ---------- spawning / removal ------------------------------------------------------------
    _spawn() {
      const pl = this.playerPos; if (!pl || this.agents.length >= this.opt.TARGET) return;
      for (let tries = 0; tries < 12; tries++) {
        const lane = this.roadLanes[Math.floor(this.rand() * this.roadLanes.length)];
        const d = this.rand() * lane.len, p = this.net.pose(lane, d), dist = Math.hypot(p.x - pl.x, p.z - pl.z);
        if (dist < this.opt.SPAWN_MIN || dist > this.opt.SPAWN_MAX) continue;
        if (lane.toJunction && lane.len - d < 14) continue;
        if (this._occ(lane).some((b) => Math.abs(b.d - d) < 18)) continue;
        // never appear on top of a vehicle on another lane (for example at the end of a turn that feeds this lane)
        if (this.agents.some((b) => { const q = this.net.pose(b.lane, b.d); return Math.hypot(q.x - p.x, q.z - p.z) < b.half + 8; })) continue;
        const kind = this._pickKind(), K = KINDS[kind], palette = K.colors;
        const a = { id: this.nextId++, kind, lane, d, v: Math.min(K.v, 4), vmax: K.v * (0.85 + this.rand() * 0.2), half: K.half, rad: K.rad, hit: 0, acc: K.acc, color: palette[Math.floor(this.rand() * palette.length)], next: null, stuck: 0, claim: null, age: 0 };
        a.next = this._chooseNext(a); this.agents.push(a); this._add(a);
        this.stats.spawned++; this.stats.kinds[kind] = (this.stats.kinds[kind] || 0) + 1;
        return;
      }
    }
    _kill(a, why) { this._remove(a); const i = this.agents.indexOf(a); if (i >= 0) this.agents.splice(i, 1); this.stats.despawned++; if (why === 'watchdog') this.stats.watchdog++; }

    // ---------- one simulation step -----------------------------------------------------------
    update(dt) {
      dt = Math.min(dt, 0.1);
      const net = this.net, t = net._t || 0, o = this.opt;
      const veh = this.game && this.game.vehicle; this.playerPos = veh && veh.mesh ? veh.mesh.position : (this.fixedPlayer || null);
      this.spawnClock += dt; if (this.spawnClock > 0.4) { this.spawnClock = 0; this._spawn(); }
      for (const l of this.occ.values()) l.sort((x, y) => x.d - y.d);
      this.waitPrev = this.waitNow || new Map(); this.waitNow = new Map();
      for (const a of this.agents.slice()) {
        const lane = a.lane, p = net.pose(lane, a.d); a.age += dt;
        if (this.playerPos && Math.hypot(p.x - this.playerPos.x, p.z - this.playerPos.z) > o.DESPAWN) { this._kill(a, 'far'); continue; }
        if (!a.next && !lane.succ.some((s) => s.portal)) a.next = this._chooseNext(a);
        else if (!a.next && lane.kind !== 'turn') a.next = this._chooseNext(a);
        let target = a.vmax;
        if (a.hit) { a.hit += dt; target = 0; if (a.hit > 4) { this._kill(a, 'wreck'); continue; } }   // a crashed vehicle stops, then is cleared so nothing piles up
        if (lane.kind === 'turn') target = Math.min(target, o.JUNCTION_SPEED);
        const distEnd = lane.len - a.d - a.half;          // front bumper to the end of this lane
        // approaching a junction turn: slow to junction speed
        if (a.next && a.next.kind === 'turn') target = Math.min(target, Math.sqrt(o.JUNCTION_SPEED * o.JUNCTION_SPEED + 2 * 2.0 * Math.max(0, distEnd)));
        // signal and junction entry
        if (lane.toJunction && a.next && a.next.kind === 'turn') {
          const j = net.junctions.find((q) => q.id === lane.toJunction), st = net.signalState(j, lane.group, t);
          const canStop = distEnd > (a.v * a.v) / (2 * 4.5) + 0.5;
          let hold = false;
          if (st === 'red' || (st === 'amber' && canStop)) { hold = true; if (a.claim) { if (this.reserved.get(a.claim) === a) this.reserved.delete(a.claim); a.claim = null; } }   // a held vehicle gives up its claim, so cross traffic is not starved
          else if (distEnd < 10) {
            // only the vehicle at the front of the lane may claim the turn; one behind it would block the leader
            const front = !this._occ(lane).some((b) => b !== a && b.d > a.d);
            if (!front) { if (a.claim) { if (this.reserved.get(a.claim) === a) this.reserved.delete(a.claim); a.claim = null; } }
            else if (this._canEnter(a, a.next)) { if (!a.claim) { a.claim = a.next.id; this.reserved.set(a.next.id, a); } a.wait = 0; }
            else if (!a.claim) { hold = true; if (a.v < 0.3) a.wait = (a.wait || 0) + dt; this.waitNow.set(a.next.id, Math.max(this.waitNow.get(a.next.id) || 0, a.wait || 0)); } }
          if (hold) target = Math.min(target, Math.sqrt(2 * o.DECEL * Math.max(0, distEnd - 0.8)));
        }
        // leader and player
        const L = this._leader(a);
        if (L) { const g = L.gap - o.MIN_GAP; target = Math.min(target, Math.max(0, Math.min(g / o.HEADWAY, L.b.v + Math.max(0, g) * 0.6))); }
        const pg = this._playerAhead(a, p); if (pg !== null) target = Math.min(target, Math.max(0, pg / o.HEADWAY));
        // speed
        if (a.v < target) a.v = Math.min(target, a.v + a.acc * dt); else a.v = Math.max(target, a.v - o.BRAKE * dt);
        a.stuck = a.v < 0.15 ? a.stuck + dt : 0;
        if (a.stuck > o.WATCHDOG_S) {
          if (this.opt.audit && (this.stuckLog = this.stuckLog || []).length < 25) {
            const Lr = this._leader(a), jj = lane.toJunction && net.junctions.find((q) => q.id === lane.toJunction);
            this.stuckLog.push({ kind: a.kind, lane: lane.id, d: +a.d.toFixed(1), len: +lane.len.toFixed(1), next: a.next && a.next.id, claim: a.claim, sig: jj ? net.signalState(jj, lane.group, t) : null, leader: Lr ? { kind: Lr.b.kind, lane: Lr.b.lane.id, d: +Lr.b.d.toFixed(1), v: +Lr.b.v.toFixed(2), gap: +Lr.gap.toFixed(1) } : null, canEnter: a.next && a.next.kind === 'turn' ? this._canEnter(a, a.next) : null, why: a.next && a.next.kind === 'turn' ? this._whyNot(a, a.next) : null });
          }
          this._kill(a, 'watchdog'); continue;
        }
        a.d += a.v * dt;
        if (a.d >= lane.len) {
          const nxt = a.next;
          if (!nxt) { this._kill(a, 'exit'); continue; }                  // reached a portal
          this._remove(a); a.d -= lane.len; a.lane = nxt; a.next = null; this._add(a);
          if (nxt.kind !== 'turn' && a.claim) a.claim = null;
          if (nxt.kind === 'turn') a.claim = nxt.id;                      // keep the claim while inside the box
          if (nxt.kind === 'road' && a.claim) { this.reserved.delete(a.claim); a.claim = null; }
          a.next = this._chooseNext(a);
        }
      }
      this._checkCollisions(dt);
      // clear stale reservations
      for (const [id, a] of this.reserved) if (!this.agents.includes(a)) this.reserved.delete(id);
      // bookkeeping and an overlap audit (centre distance below 60 % of the summed half-lengths)
      this.stats.steps++; this.stats.sumCount += this.agents.length; this.stats.maxCount = Math.max(this.stats.maxCount, this.agents.length);
      if (this.opt.audit) {
        const poses = this.agents.map((a) => net.pose(a.lane, a.d));
        for (let i = 0; i < poses.length; i++) for (let k = i + 1; k < poses.length; k++) {
          const dx = poses[i].x - poses[k].x, dz = poses[i].z - poses[k].z, lim = (this.agents[i].half + this.agents[k].half) * 0.8;
          const pi = poses[i], al = Math.abs(dx * pi.tx + dz * pi.tz), lat = Math.abs(-dx * pi.tz + dz * pi.tx);
          // overlap = bodies share the same stretch of road AND sit within a vehicle width of each other sideways
          if (al < lim && lat < 1.6) {
            this.stats.overlaps++;
            if ((this.overlapLog = this.overlapLog || []).length < 12) { const A = this.agents[i], B = this.agents[k]; this.overlapLog.push(`${A.kind}#${A.id} ${A.lane.id}@${A.d.toFixed(1)}/${A.lane.len.toFixed(0)} v${A.v.toFixed(1)} vs ${B.kind}#${B.id} ${B.lane.id}@${B.d.toFixed(1)}/${B.lane.len.toFixed(0)} v${B.v.toFixed(1)} dist ${Math.sqrt(dx * dx + dz * dz).toFixed(1)} lim ${lim.toFixed(1)}`); }
          }
        }
      }
      this._draw();
    }
  }

  // Load the vehicle models, then build and attach a TrafficSystem to the game.
  TrafficSystem.start = function (game) {
    const sys = new TrafficSystem(game, game.roadNet, { seed: 5927, TARGET: game.quality ? game.quality.tier.aiCap : T.TARGET });
    game.traffic = sys;
    if (typeof THREE.GLTFLoader === 'undefined') return sys;
    new THREE.GLTFLoader().load('assets/models/npc-vehicles.glb?v=' + (window.__BUILD_V || 1), (gltf) => sys.attachRender(game.scene, gltf),
      undefined, (err) => console.warn('TrafficSystem: failed to load npc-vehicles.glb', err));
    return sys;
  };

  TrafficSystem.T = T; TrafficSystem.KINDS = KINDS;
  S.TrafficSystem = TrafficSystem;
})();
