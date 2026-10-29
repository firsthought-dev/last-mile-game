// Headless check of the zone road network (WI-05) on the real world: node tools/check-roadnet.mjs dist/stage
//  - every lane has a successor and a predecessor (portals count at the zone edge), and the links are symmetric
//  - lane joins are continuous (gap, heading step)
//  - every entry portal can reach every other exit portal
//  - every junction's signal cycles through all phases, and the two groups are never green together
import { chromium } from 'playwright';
import { serve } from './lib/serve.mjs';
const dir = process.argv[2];
if (!dir) { console.error('usage: check-roadnet.mjs <staged-dir>'); process.exit(2); }
const server = await serve(dir);
const LAUNCH = process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, args: LAUNCH });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
page.setDefaultTimeout(Number(process.env.SMOKE_BOOT_TIMEOUT || 120000));
await page.goto(`${server.url}?play=0`);
await page.waitForFunction(() => window.game && document.getElementById('btn-start-dispatch'));
await page.evaluate(() => document.getElementById('btn-start-dispatch').click());
await page.waitForFunction(() => window.game.vehicle && window.game._worldBuilt && window.game.gameState === 'playing');
const r = await page.evaluate(() => {
  const net = new window.Shiplyp.RoadNetwork(window.game.world).build(), out = { fails: [] };
  const lanes = [...net.lanes.values()], F = (m) => out.fails.push(m);
  out.junctions = net.junctions.length; out.lanes = lanes.length;
  if (net.junctions.length < 3) F(`only ${net.junctions.length} junctions (need 3 to 5)`);
  for (const l of lanes) {
    if (!l.succ.length) F(`${l.id} has no successor`);
    if (!l.pred.length) F(`${l.id} has no predecessor`);
    for (const s of l.succ) if (!s.portal && !s.pred.includes(l)) F(`${l.id} -> ${s.id} not mirrored`);
    for (const s of l.succ) {
      if (s.portal) continue;
      const a = l.pts[l.pts.length - 1], b = s.pts[0], gap = Math.hypot(a.x - b.x, a.z - b.z), ang = Math.abs(Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz)) * 180 / Math.PI;
      if (gap > 0.05) F(`${l.id} -> ${s.id} gap ${gap.toFixed(2)} m`);
      if (ang > 2) F(`${l.id} -> ${s.id} heading step ${ang.toFixed(1)} deg`);
    }
  }
  const entries = lanes.filter((l) => l.pred.some((p) => p.portal)), exits = new Set(lanes.filter((l) => l.succ.some((p) => p.portal)).map((l) => l.id));
  out.entries = entries.length; out.exits = exits.size;
  for (const e of entries) {
    const seen = new Set([e.id]), q = [e];
    while (q.length) { const x = q.shift(); for (const s of x.succ) if (!s.portal && !seen.has(s.id)) { seen.add(s.id); q.push(s); } }
    for (const x of exits) if (!seen.has(x)) { // an entry only reaches its own road's reverse exit via a U-turn, which the network forbids; everything else must be reachable
      const n = net.junctions.length, isReverse = x.replace('.out', '.in') === e.id || (e.id === 'F0' && x === 'B0') || (e.id === 'B' + n && x === 'F' + n);
      if (!isReverse) F(`entry ${e.id} cannot reach exit ${x}`);
    }
  }
  const cyc = net.signalCycle(); out.cycle = cyc;
  for (const j of net.junctions) {
    const seen = { main: new Set(), cross: new Set() };
    for (let t = 0; t < cyc; t += 0.1) {
      const m = net.signalState(j, 'main', t), c = net.signalState(j, 'cross', t);
      seen.main.add(m); seen.cross.add(c);
      if ((m === 'green' || m === 'amber') && (c === 'green' || c === 'amber')) F(`${j.id} both groups open at t=${t.toFixed(1)}`);
    }
    for (const g of ['main', 'cross']) for (const st of ['green', 'amber', 'red']) if (!seen[g].has(st)) F(`${j.id} ${g} never ${st}`);
  }
  return out;
});
await browser.close(); await server.close();
console.log(`road network: ${r.junctions} junctions, ${r.lanes} lanes, ${r.entries} entries, ${r.exits} exits, signal cycle ${r.cycle} s`);
if (r.fails.length) { console.error(r.fails.slice(0, 20).join('\n')); console.error(`check-roadnet FAIL (${r.fails.length})`); process.exit(1); }
console.log('check-roadnet OK');
