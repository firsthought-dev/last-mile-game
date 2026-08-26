// Full-matrix world audit: every city x season x road surface.
// Verifies against RENDERED GEOMETRY (raycast), not height formulas —
// see BUGFIX_LOG.md B17 for why the formula-based check was worthless.
window.__sweep = function (opts) {
  opts = opts || {};
  const g = window.game;
  const CITIES = ['mumbai', 'delhi', 'kolkata', 'pune', 'bangalore'];
  const SEASONS = ['autumn', 'spring', 'summer', 'winter'];
  const SURFACES = ['asphalt', 'gravel', 'mud', 'sand'];
  const only = opts.only || null; // {city,season,surface} to run a single combo

  const down = new THREE.Vector3(0, -1, 0);
  const rc = new THREE.Raycaster();

  // Nearest-hit raycast onto a mesh. Takes the hit closest to refY because
  // the terrain ribbon spans +/-40m and folds over itself at hairpins, so
  // the topmost hit can be a different stretch of road entirely (B17).
  function surfaceYAt(mesh, x, y, z) {
    rc.set(new THREE.Vector3(x, y + 60, z), down);
    const hits = rc.intersectObject(mesh, false);
    if (!hits.length) return null;
    let best = hits[0];
    for (const h of hits) {
      if (Math.abs(h.point.y - y) < Math.abs(best.point.y - y)) best = h;
    }
    return best.point.y;
  }

  function auditWorld() {
    const w = g.world;
    const out = {};
    w.roadMesh.updateMatrixWorld(true);
    w.terrainMesh.updateMatrixWorld(true);

    // --- 1. Road verge vs terrain (the B16/B17 seam) ---
    {
      const pos = w.roadMesh.geometry.attributes.position;
      const SLICE = 7, rows = pos.count / SLICE;
      let tearing = 0, floating = 0, n = 0, misses = 0;
      for (let r = 0; r < rows; r += 5) {
        for (const j of [0, 6]) {
          const i = r * SLICE + j;
          const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
          const ty = surfaceYAt(w.terrainMesh, vx, vy, vz);
          if (ty === null) { misses++; continue; }
          const gap = vy - ty;
          if (gap < 0) tearing = Math.max(tearing, -gap);
          floating = Math.max(floating, gap);
          n++;
        }
      }
      out.seam = { tearing: +tearing.toFixed(4), floating: +floating.toFixed(4), n, misses };
    }

    // --- 2. Props sit ON the ground (no floating / no burial) ---
    // Sample every registered obstacle and compare its stored base height
    // against the rendered terrain directly beneath it.
    {
      const byType = {};
      (w.obstacles || []).forEach(o => {
        const ty = surfaceYAt(w.terrainMesh, o.pos.x, o.pos.y, o.pos.z);
        if (ty === null) return;
        const d = o.pos.y - ty;
        const t = o.type || 'unknown';
        if (!byType[t]) byType[t] = { worst: 0, n: 0 };
        if (Math.abs(d) > Math.abs(byType[t].worst)) byType[t].worst = +d.toFixed(3);
        byType[t].n++;
      });
      out.props = byType;
    }

    // --- 3. Delivery houses: porch ring must rest on the ground ---
    {
      let worst = 0, n = 0;
      (w.deliveryTargets || []).forEach(t => {
        const ty = surfaceYAt(w.terrainMesh, t.pos.x, t.pos.y, t.pos.z);
        if (ty === null) return;
        const d = t.pos.y - ty;
        if (Math.abs(d) > Math.abs(worst)) worst = +d.toFixed(3);
        n++;
      });
      out.houses = { worstRingVsGround: worst, n };
    }

    // --- 4. Props must stay upright (the lookAt-tilt bug class) ---
    {
      const up = new THREE.Vector3(0, 1, 0);
      let worstTiltDeg = 0, n = 0;
      w.foliageGroup.children.forEach(c => {
        if (!c.isGroup || c.children.length < 3) return;
        const lu = up.clone().applyQuaternion(c.quaternion);
        const deg = lu.angleTo(up) * 180 / Math.PI;
        if (deg > worstTiltDeg) worstTiltDeg = +deg.toFixed(2);
        n++;
      });
      out.upright = { worstTiltDeg, n };
    }

    // --- 5. Road surface itself must be above the terrain everywhere ---
    {
      const pos = w.roadMesh.geometry.attributes.position;
      const SLICE = 7, rows = pos.count / SLICE;
      let worstSunken = 0, n = 0;
      for (let r = 0; r < rows; r += 11) {
        for (const j of [1, 3, 5]) { // inner driving surface
          const i = r * SLICE + j;
          const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
          const ty = surfaceYAt(w.terrainMesh, vx, vy, vz);
          if (ty === null) continue;
          const gap = vy - ty;
          if (gap < 0) worstSunken = Math.max(worstSunken, -gap);
          n++;
        }
      }
      out.roadSurface = { worstSunkenBelowTerrain: +worstSunken.toFixed(4), n };
    }

    return out;
  }

  const results = [];
  const combos = [];
  if (only) {
    combos.push(only);
  } else {
    CITIES.forEach(c => SEASONS.forEach(s => SURFACES.forEach(t =>
      combos.push({ city: c, season: s, surface: t }))));
  }

  combos.forEach(cb => {
    g.selectedCity = cb.city;
    g.selectedSeason = cb.season;
    g.selectedRoadTerrain = cb.surface;
    g.buildWorldAndScene();
    const a = auditWorld();
    a.combo = cb.city + '/' + cb.season + '/' + cb.surface;
    results.push(a);
  });

  return results;
};
'sweep loaded';
