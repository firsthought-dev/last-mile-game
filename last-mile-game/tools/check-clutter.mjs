// Clutter check: on every screen shape the HUD panels sit in their own slots, and the rider, the road ahead and
// the road radar stay visible; notifications do not stack and comic callouts stay few.
//   node tools/check-clutter.mjs [dir=dist/stage] [--full] [--shots <dir>] [--dpr <n>] [--json <file>] [--vp WxH,WxH] [--scen a,b]
// Fast (default, for `npm run ci`): 7 viewports x 5 scenarios (plain driving, a drop with everything going off at once,
// three notifications within a second, a 3-star chase, every HUD panel on screen at once).
// --full: all 19 audited viewports x all scenarios (also near-target, onboarding, forced DROP button).
// Fails when: the rider is more than 10% covered, more than 5% of the road ahead is covered, the radar is covered at all
// (or off screen), two HUD panels overlap by more than 2 px, a HUD panel reaches past the screen, more than one
// notification shows at once, more than two comic callouts show at once, or the page scrolls sideways.
// Serves <dir> like the smoke test and blocks every non-local request.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { serve } from './lib/serve.mjs';

const args = process.argv.slice(2);
const val = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const FULL = args.includes('--full');
const dir = args.find((a, i) => !a.startsWith('--') && !['--shots', '--dpr', '--json', '--vp', '--scen', '--road'].includes(args[i - 1])) || 'dist/stage';
const shotsDir = val('--shots');
const jsonOut = val('--json');
const DPR = Number(val('--dpr') || 1);
const VERBOSE = args.includes('--verbose');   // print every sample with what covers the rider / road
const BOOT_TIMEOUT = Number(process.env.CLUTTER_BOOT_TIMEOUT || 240000);
const LIMITS = { vehicle: 10, road: Number(val('--road') || 5), radar: 0, notif: 1, pieces: 2, overlapPx: 2 };
const LAUNCH_ARGS = process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

// name: [w, h, touch HUD]
const ALL = {
  '440x956': [440, 956, 1], '430x932': [430, 932, 1], '393x852': [393, 852, 1], '390x844': [390, 844, 1], '375x667': [375, 667, 1],
  '360x800': [360, 800, 1], '412x915': [412, 915, 1], '360x640': [360, 640, 1], '956x440': [956, 440, 1], '844x390': [844, 390, 1],
  '667x375': [667, 375, 1], '800x360': [800, 360, 1], '768x1024': [768, 1024, 1], '820x1180': [820, 1180, 1], '1024x768': [1024, 768, 1],
  '1280x720': [1280, 720, 0], '1440x900': [1440, 900, 0], '1920x1080': [1920, 1080, 0], '2560x1080': [2560, 1080, 0]
};
const FAST = ['440x956', '375x667', '360x640', '844x390', '667x375', '1024x768', '1440x900'];
const SCEN_FAST = ['drive', 'drop-all', 'notes3', 'chase3', 'hud-all'];
const SCEN_FULL = ['drive', 'near', 'drop', 'drop+forced-btn', 'drop-all', 'notes3', 'chase3', 'hud-all', 'onb-hint', 'onb-first-drop'];
const ONLY = val('--vp') ? val('--vp').split(',') : null;   // e.g. --vp 375x667,844x390
const VPS = ONLY || (FULL ? Object.keys(ALL) : FAST);
const SCENS = val('--scen') ? val('--scen').split(',') : (FULL ? SCEN_FULL : SCEN_FAST);

// ---- in-page: where everything is ---------------------------------------------------------
const MEASURE = () => {
  const g = window.game, W = innerWidth, H = innerHeight;
  const cv = g.renderer.domElement, cr = cv.getBoundingClientRect();
  // vehicle box -> screen rect
  g.camera.updateMatrixWorld(true); g.vehicle.mesh.updateMatrixWorld(true);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, vis = true;
  const _v = new THREE.Vector3();
  g.vehicle.mesh.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    let hid = false; for (let q = o; q; q = q.parent) if (q.visible === false) { hid = true; break; }
    if (hid) return;
    const pos = o.geometry.attributes.position, stride = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += stride) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(g.camera);
      if (_v.z > 1) { vis = false; continue; }
      const sx = cr.left + (_v.x * 0.5 + 0.5) * cr.width, sy = cr.top + (-_v.y * 0.5 + 0.5) * cr.height;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
  });
  const veh = { l: Math.max(0, x0), t: Math.max(0, y0), r: Math.min(W, x1), b: Math.min(H, y1) };
  const cTop = H * 0.35;
  const cor = veh.t > cTop + 4 ? { l: W * 0.3, r: W * 0.7, t: cTop, b: veh.t } : null;
  // painted elements
  const col = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(',').map(parseFloat); return p.length > 3 ? p[3] : 1; };
  const nameOf = (e) => {
    let s = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '');
    const c = (typeof e.className === 'string' ? e.className : (e.className && e.className.baseVal) || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    if (c) s += '.' + c;
    return s;
  };
  const owner = (e) => {   // a readable owner: nearest ancestor with an id or key class
    let o = e;
    while (o && o !== document.body) {
      const k = o.id || '';
      const cl = typeof o.className === 'string' ? o.className : '';
      if (k || /comic-banner|comic-bubble|comic-emoji|comic-caption|comic-wanted|comic-siren|comic-burst|notification-item|touch-btn|touch-util|slowroads-|onboarding|score-popup|modal|pd-|drop-/.test(cl)) return nameOf(o);
      o = o.parentElement;
    }
    return nameOf(e);
  };
  const items = [];   // {rect, name, owner, light}
  const lights = [];
  const effOpacity = (e) => { let o = 1; while (e && e !== document.documentElement) { o *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; } return o; };
  const all = document.body.querySelectorAll('*');
  for (const e of all) {
    if (e === cv || e.tagName === 'SCRIPT' || e.tagName === 'STYLE' || e.tagName === 'LINK') continue;
    if (e.closest('#game-loader,#hud-headless-hooks,.hud-headless-hooks,.comic-live')) continue;
    if (e.closest('svg') && e.tagName.toLowerCase() === 'svg') continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const inSvg = !!e.closest('svg') && e.tagName.toLowerCase() !== 'svg';
    let rect = null, paint = false;
    if (inSvg) {
      if (e.tagName.toLowerCase() === 'g' || e.tagName.toLowerCase() === 'defs') continue;
      if (e.closest('defs,mask,clipPath,pattern')) continue;
      const fill = cs.fill, stroke = cs.stroke;
      paint = (fill && fill !== 'none' && col(fill) > 0.05) || (stroke && stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) || /url/.test(fill);
      if (!paint) continue;
    } else if (['CANVAS', 'IMG', 'VIDEO'].includes(e.tagName)) paint = true;
    else {
      const bgc = col(cs.backgroundColor), bgi = cs.backgroundImage !== 'none';
      const bw = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      paint = bgc > 0.05 || bgi || (bw > 0 && col(cs.borderTopColor) > 0.05);
    }
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && paint) rect = r;
    // text of the element itself (direct text nodes), measured per text node
    const textRects = [];
    if (!inSvg) for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) {
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 1 && q.height > 1) textRects.push(q);
    }
    const eo = effOpacity(e);
    if (eo < 0.06) continue;
    const mk = (q, kind) => ({ l: q.left, t: q.top, r: q.right, b: q.bottom, name: nameOf(e), owner: owner(e), kind, op: eo, text: (e.textContent || '').trim().slice(0, 22) });
    const addIt = (q, kind) => {
      const it = mk(q, kind);
      const area = Math.max(0, Math.min(it.r, W) - Math.max(it.l, 0)) * Math.max(0, Math.min(it.b, H) - Math.max(it.t, 0));
      if (area <= 0) return;
      // light layers: speed-line lines, full-screen tints/vignettes, faint pointer-less backdrops
      const bgc = col(cs.backgroundColor);
      const isUnder = !!e.closest('.comic-layer--under,#comic-under,#police-siren');
      const big = area > W * H * 0.7;
      const faint = kind === 'box' && bgc > 0 && bgc < 0.3 && cs.backgroundImage === 'none' && !(parseFloat(cs.borderTopWidth) > 0) && cs.pointerEvents === 'none';
      if (isUnder || big || faint) { it.light = true; lights.push(it); } else items.push(it);
    };
    if (rect) addIt(rect, inSvg ? 'svg' : (rect === r && ['CANVAS', 'IMG'].includes(e.tagName) ? 'media' : 'box'));
    for (const q of textRects) addIt(q, 'text');
  }
  const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  // union coverage on a 2px grid
  const cover = (R, list) => {
    if (!R) return { pct: 0, area: 0 };
    const step = 2; let tot = 0, hit = 0;
    const rel = list.filter(it => inter(it, R) > 0);
    for (let y = R.t + step / 2; y < R.b; y += step) for (let x = R.l + step / 2; x < R.r; x += step) {
      tot++;
      for (let i = 0; i < rel.length; i++) { const it = rel[i]; if (x >= it.l && x <= it.r && y >= it.t && y <= it.b) { hit++; break; } }
    }
    return { pct: tot ? 100 * hit / tot : 0, area: tot * step * step * (hit / (tot || 1)) };
  };
  const vc = cover(veh, items), cc = cover(cor, items), vl = cover(veh, lights), cl = cover(cor, lights);
  // offenders: area of each element's rects inside vehicle+corridor, grouped by owner
  const byOwner = {};
  for (const it of items) {
    const a = inter(it, veh) + (cor ? inter(it, cor) : 0);
    if (a > 0) { const o = byOwner[it.owner] || (byOwner[it.owner] = { owner: it.owner, area: 0, sample: it.text }); o.area += a; }
  }
  const offenders = Object.values(byOwner).sort((a, b) => b.area - a.area).slice(0, 5).map(o => ({ owner: o.owner, areaPx: Math.round(o.area), text: o.sample }));
  const lightOwners = {};
  for (const it of lights) { const a = inter(it, veh) + (cor ? inter(it, cor) : 0); if (a > 0) { lightOwners[it.owner] = (lightOwners[it.owner] || 0) + a; } }
  // radar
  const rd = document.getElementById('slowroads-radar-box');
  let radar = { present: !!rd, visible: false, inViewport: false, coveredPct: null, rect: null, by: [] };
  if (rd) {
    const q = rd.getBoundingClientRect(), cs = getComputedStyle(rd);
    radar.visible = cs.display !== 'none' && cs.visibility !== 'hidden' && q.width > 0 && effOpacity(rd) > 0.5;
    radar.rect = [q.left, q.top, q.right, q.bottom].map(Math.round);
    radar.inViewport = q.left >= -1 && q.top >= -1 && q.right <= W + 1 && q.bottom <= H + 1 && q.width > 0;
    const others = items.filter(it => !rd.contains(document.elementFromPoint(Math.min(W - 1, Math.max(0, (it.l + it.r) / 2)), Math.min(H - 1, Math.max(0, (it.t + it.b) / 2)))) );
    // simpler & honest: items not inside the radar element itself, by owner name
    const notRadar = items.filter(it => !/radar/.test(it.owner) && !/radar/.test(it.name));
    const rc = cover({ l: q.left, t: q.top, r: q.right, b: q.bottom }, notRadar);
    radar.coveredPct = rc.pct;
    const by = {};
    const qq = { l: q.left, t: q.top, r: q.right, b: q.bottom };
    for (const it of notRadar) { const a = inter(it, qq); if (a > 0) by[it.owner + '|' + it.name + '|' + it.kind] = (by[it.owner + '|' + it.name + '|' + it.kind] || 0) + a; }
    radar.by = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ':' + Math.round(v));
  }
  // callouts
  const effOp = effOpacity;
  const liveEls = (sel) => [...document.querySelectorAll(sel)].filter(e => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && !e.classList.contains('comic-out') && effOp(e) > 0.1 && e.getBoundingClientRect().width > 0; });
  const notes = liveEls('#notification-stack .notification-item:not(.removing)');
  const pieces = new Set(liveEls('#comic-layer .comic-piece').map((e, i) => e.dataset.comicGroup || ('p' + i)));
  // ---- HUD panels: every visible piece of the HUD and where it is ----
  const PANELS = [
    ['order-card', '#delivery-mission-capsule'], ['system-chips', '.slowroads-top-bar'],
    ['a-steer', '#touch-btn-autopilot'], ['a-drive', '#touch-btn-cruise'], ['tools', '#touch-btn-tools'], ['tools-drawer', '#touch-tools-drawer'],
    ['steer-left', '#touch-steer-left'], ['steer-right', '#touch-steer-right'], ['accel', '#touch-pedal-gas'], ['brake', '#touch-pedal-brake'], ['drop-btn', '#touch-btn-drop'],
    ['radar', '#slowroads-radar-box'], ['speed', '.telemetry-digits-box'], ['auto-pills', '.telemetry-controls-col'],
    ['wanted', '#police-wanted'], ['notification', '#notification-panel .notification-item:not(.removing)'], ['hint', '#onboarding-hint.visible'],
    ['drop-prompt', '#drop-action-prompt'], ['dock', '.slowroads-dock'], ['score-popup', '.score-popup-banner']
  ];
  const panels = [];
  for (const [pn, sel] of PANELS) {
    for (const e of document.querySelectorAll(sel)) {
      const c = getComputedStyle(e), q = e.getBoundingClientRect();
      if (c.display === 'none' || c.visibility === 'hidden' || q.width < 2 || q.height < 2 || effOpacity(e) < 0.3) continue;
      panels.push({ name: pn, l: q.left, t: q.top, r: q.right, b: q.bottom });
    }
  }
  const overlaps = [], outside = [];
  for (let i = 0; i < panels.length; i++) {
    const a = panels[i];
    if (a.l < -1 || a.t < -1 || a.r > W + 1 || a.b > H + 1) outside.push(a.name);
    for (let k = i + 1; k < panels.length; k++) {
      const b = panels[k];
      const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (w > 2 && h > 2) overlaps.push(`${a.name}/${b.name} ${Math.round(w)}x${Math.round(h)}`);
    }
  }
  return {
    dbg: (() => { const n = document.getElementById('notification-panel'); const q = n.getBoundingClientRect(); return `np[${Math.round(q.left)},${Math.round(q.top)},${Math.round(q.right)},${Math.round(q.bottom)}] style=${n.getAttribute('style')} zone=${JSON.stringify(window.Shiplyp.Callouts.zone().filter((z) => z.b > 90 && z.t < 160).map((z) => [z.l, z.t, z.r, z.b].map(Math.round)))}`; })(),
    panels: panels.length, overlaps, outside, rects: panels.map((q) => `${q.name}[${Math.round(q.l)},${Math.round(q.t)},${Math.round(q.r)},${Math.round(q.b)}]`),
    vehiclePct: +vc.pct.toFixed(1), corridorPct: +cc.pct.toFixed(1),
    vehicleRect: [veh.l, veh.t, veh.r, veh.b].map(Math.round),
    offenders,
    radar: { present: !!rd, visible: radar.visible, inViewport: radar.inViewport, coveredPct: radar.coveredPct, by: radar.by },
    notifCount: notes.length, pieceCount: pieces.size,
    scrollW: document.documentElement.scrollWidth, vw: W, scrollX: document.documentElement.scrollWidth > W + 1 || document.body.scrollWidth > W + 1
  };
};

// sampler: the most notifications / distinct comic callouts on screen at once, over time
const MON = () => {
  const M = window.__mon = { notif: 0, pieces: 0 };
  setInterval(() => {
    const op = (e) => { let o = 1; while (e && e !== document.documentElement) { o *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; } return o; };
    const n = [...document.querySelectorAll('#notification-stack .notification-item')].filter((e) => !e.classList.contains('removing') && op(e) > 0.1).length;
    const p = new Set([...document.querySelectorAll('#comic-layer .comic-piece')].filter((e) => !e.classList.contains('comic-out') && getComputedStyle(e).display !== 'none' && op(e) > 0.1).map((e, i) => e.dataset.comicGroup || ('p' + i))).size;
    if (n > M.notif) M.notif = n;
    if (p > M.pieces) M.pieces = p;
  }, 40);
};
const MON_RESET = () => { window.__mon.notif = 0; window.__mon.pieces = 0; };

async function placeBefore(p, idx, back, speed) {
  await p.evaluate(([idx, back, speed]) => {
    const g = window.game, v = g.vehicle, c = g.world.curve, t = g.world.deliveryTargets[idx], L = c.getLength();
    const u = Math.max(0.001, t.splineU - back / L), pt = c.getPointAt(u), tg = c.getTangentAt(u);
    v.mesh.position.copy(pt).add(new THREE.Vector3(0, 0.39, 0));
    v.velocityHeading = Math.atan2(tg.x, tg.z); v.heading = v.velocityHeading; v.splineProgress = u; v.speed = speed;
  }, [idx, back, speed]);
  await p.waitForTimeout(1500);
}
async function placeAtS(p, s, back, speed) {
  await p.evaluate(([s, back, speed]) => {
    const g = window.game, v = g.vehicle, c = g.world.curve, L = c.getLength();
    const u = Math.max(0.0005, (s - back) / L), pt = c.getPointAt(u), tg = c.getTangentAt(u);
    v.mesh.position.copy(pt).add(new THREE.Vector3(0, 0.39, 0));
    v.velocityHeading = Math.atan2(tg.x, tg.z); v.heading = v.velocityHeading; v.splineProgress = u; v.speed = speed;
  }, [s, back, speed]);
  await p.waitForTimeout(800);
}

// ---- run ------------------------------------------------------------------------------------
const server = await serve(dir, { prefix: '/portal/sub/' });
const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const rows = [];
const errors = [];

async function openPage(name, tier = 'high') {
  const [w, h, touch] = ALL[name];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: DPR, isMobile: !!touch, hasTouch: !!touch });
  await ctx.addInitScript((t) => { try { localStorage.setItem('shiplyp_qualityTier', t); } catch (e) { /* storage blocked */ } }, tier);
  const page = await ctx.newPage();
  page.setDefaultTimeout(BOOT_TIMEOUT);
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(server.origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  await page.goto(server.url + '?play=0', { waitUntil: 'load' });
  await page.waitForFunction(() => window.game && document.getElementById('btn-start-dispatch'));
  return { ctx, page, errs };
}
async function startDrive(p) {
  await p.evaluate(() => { window.game.selectedVehicle = 'motorbike'; document.getElementById('btn-start-dispatch').click(); });
  await p.waitForFunction(() => window.game && window.game.vehicle && window.game._worldBuilt && window.game.gameState === 'playing');
}

// Measure at each moment of `at` (ms after the scenario began); the worst of them stands for the scenario.
async function observe(p, name, scen, at, afterEach) {
  let worst = null, t0 = 0;
  for (let i = 0; i < at.length; i++) {
    await p.waitForTimeout(at[i] - t0); t0 = at[i];
    const m = await p.evaluate(MEASURE);
    const mon = await p.evaluate(() => ({ ...window.__mon }));
    const rad = m.radar.present && m.radar.visible && m.radar.inViewport ? m.radar.coveredPct : 100;
    const cand = { ovl: m.overlaps, out: m.outside, npanels: m.panels, veh: m.vehiclePct, cor: m.corridorPct, radar: rad, notif: Math.max(m.notifCount, mon.notif), pieces: Math.max(m.pieceCount, mon.pieces), scroll: m.scrollX, off: m.offenders.slice(0, 2).map((o) => o.owner + ':' + o.areaPx).join(' ') };
    if (VERBOSE) console.log(`  [${name} ${scen} +${at[i]}ms] panels ${m.panels} ovl ${m.overlaps.join(', ') || '-'} out ${m.outside.join(', ') || '-'} {${m.rects.join(' ')}} ${m.dbg} rider ${m.vehiclePct}% road ${m.corridorPct}% notif ${cand.notif} pieces ${cand.pieces} ` + m.offenders.map((o) => o.owner + ':' + o.areaPx).join(' '));
    if (!worst) worst = cand;
    else {
      for (const k of ['veh', 'cor', 'radar', 'notif', 'pieces']) worst[k] = Math.max(worst[k], cand[k]);
      worst.scroll = worst.scroll || cand.scroll;
      worst.ovl = [...new Set([...worst.ovl, ...cand.ovl])]; worst.out = [...new Set([...worst.out, ...cand.out])];
      worst.npanels = Math.max(worst.npanels, cand.npanels);
      if (cand.veh >= worst.veh) worst.off = cand.off;
    }
    if (shotsDir && VERBOSE) await p.screenshot({ path: path.join(shotsDir, `${name}-${scen}-t${at[i]}.png`), timeout: 120000 }).catch(() => {});
    if (shotsDir && i === at.length - 1) await p.screenshot({ path: path.join(shotsDir, `${name}-${scen}.png`), timeout: 120000 }).catch(() => {});
    if (afterEach) await afterEach(p);
  }
  return worst;
}
function record(name, scen, w) {
  const fails = [];
  if (w.veh > LIMITS.vehicle) fails.push(`rider ${w.veh}% covered`);
  if (w.cor > LIMITS.road) fails.push(`road ${w.cor}% covered`);
  if (w.ovl.length) fails.push('HUD panels overlap: ' + w.ovl.slice(0, 3).join('; '));
  if (w.out.length) fails.push('HUD panel off screen: ' + w.out.join(', '));
  if (w.radar > LIMITS.radar) fails.push(`radar ${w.radar.toFixed(0)}% covered`);
  if (w.notif > LIMITS.notif) fails.push(`${w.notif} notifications`);
  if (w.pieces > LIMITS.pieces) fails.push(`${w.pieces} comic callouts`);
  if (w.scroll) fails.push('horizontal scroll');
  rows.push({ viewport: name, scenario: scen, panels: w.npanels, overlaps: w.ovl, outside: w.out, veh: w.veh, cor: w.cor, radar: w.radar, notif: w.notif, pieces: w.pieces, scroll: w.scroll, pass: !fails.length, fails, offenders: w.off });
}

for (const name of VPS) {
  console.log(`check-clutter ${name} ...`);
  let s1 = null;
  try {
    s1 = await openPage(name);
    const p = s1.page;
    await startDrive(p);
    await p.evaluate(() => { const g = window.game; g._onboardingActive = false; g._dismissOnboardingHint && g._dismissOnboardingHint(); });
    await p.evaluate(MON);
    await p.waitForTimeout(1500);
    for (const sc of SCENS.filter((x) => !x.startsWith('onb'))) {
      await p.evaluate(MON_RESET);
      if (sc === 'drive') { await placeBefore(p, 0, 140, 10); record(name, sc, await observe(p, name, sc, [600], null)); }
      else if (sc === 'near') { await placeBefore(p, 0, 14, 0); record(name, sc, await observe(p, name, sc, [500], null)); }
      else if (sc === 'drop' || sc === 'drop+forced-btn') {
        await placeBefore(p, 0, 14, 0);
        await p.evaluate(() => { const g = window.game; g.streakCount = 2; g.orderTimer = g.maxOrderTimer * 0.92; g.fulfillDelivery(g.world.deliveryTargets[0]); });
        if (sc === 'drop') record(name, sc, await observe(p, name, sc, [500, 1000], null));
        else {
          await p.evaluate(() => { const st = document.createElement('style'); st.id = '__forceDrop'; st.textContent = 'html body.touch-controls-active #touch-btn-drop{display:flex!important} html body:not(.touch-controls-active) #drop-action-prompt{display:flex!important}'; document.head.appendChild(st); });
          record(name, sc, await observe(p, name, sc, [300], null));
          await p.evaluate(() => { const e = document.getElementById('__forceDrop'); if (e) e.remove(); });
        }
        await p.waitForTimeout(3600);
      } else if (sc === 'drop-all') {
        // a drop (banner + house reaction + confetti) with a promotion banner, a district banner and three notifications on its heels
        await placeBefore(p, 1, 14, 0);
        await p.evaluate(MON_RESET);
        await p.evaluate(() => {
          const g = window.game, S = window.Shiplyp;
          g.streakCount = 3; g.orderTimer = g.maxOrderTimer * 0.9;
          g.fulfillDelivery(g.world.deliveryTargets[1]);
          S.Callouts.banner({ title: 'PROMOTED!', sub: 'SENIOR RIDER', kind: 'orange', burst: '★', delay: 900, key: 'promo', duration: 4200 });
          setTimeout(() => g.showScorePopup(150, 'DISTRICT 2: CLOUDSPIRE RIDGE'), 350);
          setTimeout(() => g._spendSpareParcel(), 150);
          setTimeout(() => g.addNotification('✓ BIKE UNLOCKED!', 'success', 4000), 500);
          setTimeout(() => g.addNotification('⚡ NEW SHIFT STARTED', 'success', 3000), 800);
        });
        record(name, sc, await observe(p, name, sc, [400, 1300, 2200], null));
        await p.waitForTimeout(6000);
      } else if (sc === 'hud-all') {
        // every HUD piece at once: stars (WANTED chip), a notification, the onboarding hint, the DROP button / prompt, in motion
        await placeBefore(p, 0, 14, 0);
        await p.evaluate(MON_RESET);
        await p.evaluate(() => {
          const g = window.game;
          g.vehicle.speed = 9;
          g._showOnboardingHint('toss');
          g.addNotification('MISSED THROW — 2 SPARE PARCELS LEFT', 'warning', 6000);
          window.ShiplypPolice.debug.setStars(3);
          const st = document.createElement('style'); st.id = '__forceDrop';
          st.textContent = 'html body.touch-controls-active #touch-btn-drop{display:flex!important} html body:not(.touch-controls-active) #drop-action-prompt{display:flex!important}';
          document.head.appendChild(st);
          const f = document.getElementById('hud-fps-pill'); if (f) f.removeAttribute('hidden');
        });
        record(name, sc, await observe(p, name, sc, [600, 1500], async (pg) => { await pg.evaluate(() => { window.game.vehicle.speed = 9; }); }));
        await p.evaluate(() => { const e = document.getElementById('__forceDrop'); if (e) e.remove(); const f = document.getElementById('hud-fps-pill'); if (f) f.setAttribute('hidden', ''); window.game._dismissOnboardingHint(); window.ShiplypPolice.debug.setStars(0); });
        await p.waitForTimeout(1500);
      } else if (sc === 'notes3') {
        await placeBefore(p, 0, 120, 8);
        await p.evaluate(MON_RESET);
        await p.evaluate(() => {
          const g = window.game;
          g.addNotification('✓ BIKE UNLOCKED!', 'success', 4000);
          setTimeout(() => g.addNotification('⚡ NEW SHIFT STARTED', 'success', 3000), 400);
          setTimeout(() => g.addNotification('MISSED THROW — 2 SPARE PARCELS LEFT', 'warning', 3500), 800);
        });
        record(name, sc, await observe(p, name, sc, [500, 1200], null));
        await p.waitForTimeout(4000);
      } else if (sc === 'chase3') {
        const ci = await p.evaluate(() => window.game.world.crossingInfo.slice(0, 2).map((c) => c.s));
        await placeAtS(p, ci[0], 3, 0);
        await p.evaluate(MON_RESET);
        await p.evaluate(() => {
          window.game.vehicle.speed = 9;
          const C = window.Shiplyp.Callouts, o = C.onStars;
          C.onStars = (a, b, r) => o(a, b, b > a ? 'Jumped a red light' : r);
          window.ShiplypPolice.debug.setStars(3);
        });
        record(name, sc, await observe(p, name, sc, [800, 2400, 3800, 6200], async (pg) => { await pg.evaluate(() => { window.game.vehicle.speed = 9; }); }));
      }
    }
    if (s1.errs.length) errors.push(`[${name}] ${s1.errs.slice(0, 3).join(' | ')}`);
    await s1.ctx.close(); s1 = null;
    // onboarding scenarios need a fresh save
    if (SCENS.some((x) => x.startsWith('onb'))) {
      const s2 = await openPage(name);
      const p = s2.page;
      await startDrive(p);
      await p.evaluate(MON);
      await p.waitForTimeout(2500);
      await placeBefore(p, 0, 14, 0);
      await p.waitForTimeout(800);
      record(name, 'onb-hint', await observe(p, name, 'onb-hint', [100], null));
      await p.evaluate(MON_RESET);
      await p.evaluate(() => { const g = window.game; g.orderTimer = g.maxOrderTimer * 0.9; g.fulfillDelivery(g.world.deliveryTargets[0]); });
      record(name, 'onb-first-drop', await observe(p, name, 'onb-first-drop', [1000], null));
      if (s2.errs.length) errors.push(`[${name}/onboarding] ${s2.errs.slice(0, 3).join(' | ')}`);
      await s2.ctx.close();
    }
  } catch (e) {
    errors.push(`[${name}] ${String(e.message || e).split('\n')[0]}`);
    if (s1) await s1.ctx.close().catch(() => {});
  }
}
await browser.close();
await server.close();

// ---- report ---------------------------------------------------------------------------------
const pad = (v, n) => String(v).padEnd(n);
console.log('\n' + pad('viewport', 10) + pad('scenario', 17) + pad('rider%', 8) + pad('road%', 7) + pad('radar%', 8) + pad('notif', 7) + pad('pieces', 8) + pad('panels', 8) + pad('scroll', 8) + 'result');
for (const r of rows) {
  console.log(pad(r.viewport, 10) + pad(r.scenario, 17) + pad(r.veh, 8) + pad(r.cor, 7) + pad(Number(r.radar).toFixed(0), 8) + pad(r.notif, 7) + pad(r.pieces, 8) + pad(r.panels, 8) + pad(r.scroll ? 'YES' : 'no', 8) + (r.pass ? 'ok' : 'FAIL ' + r.fails.join(', ')));
}
const bad = rows.filter((r) => !r.pass);
if (jsonOut) { fs.mkdirSync(path.dirname(jsonOut), { recursive: true }); fs.writeFileSync(jsonOut, JSON.stringify({ rows, errors }, null, 1)); }
if (errors.length) { console.error('\nconsole/page errors:'); errors.forEach((e) => console.error('  ' + e)); }
const expect = VPS.length * SCENS.length;
if (rows.length < expect) console.error(`\nonly ${rows.length} of ${expect} scenario runs completed`);
if (bad.length || errors.length || rows.length < expect) {
  console.error(`\ncheck-clutter FAIL (${bad.length} failing case${bad.length === 1 ? '' : 's'})`);
  for (const r of bad) console.error(`  ${r.viewport} ${r.scenario}: ${r.fails.join(', ')}${r.offenders ? '  [' + r.offenders + ']' : ''}`);
  process.exit(1);
}
console.log(`\ncheck-clutter OK (${rows.length} cases, ${VPS.length} viewports)`);
