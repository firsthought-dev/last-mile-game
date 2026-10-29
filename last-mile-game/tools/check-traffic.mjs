// Headless soak test of the AI traffic (WI-06/07) on the real zone network: node tools/check-traffic.mjs dist/stage [minutes]
// Simulates N minutes with the player parked at a junction and asserts: 15+ agents reached, 4+ vehicle kinds,
// no watchdog removals (nothing got stuck), no two vehicles overlapping, and vehicles actually move through junctions.
import { chromium } from 'playwright';
import { serve } from './lib/serve.mjs';
const dir = process.argv[2], minutes = Number(process.argv[3] || 15);
if (!dir) { console.error('usage: check-traffic.mjs <staged-dir> [minutes]'); process.exit(2); }
const server = await serve(dir);
const LAUNCH = process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, args: LAUNCH });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
page.setDefaultTimeout(Number(process.env.SMOKE_BOOT_TIMEOUT || 120000));
await page.goto(`${server.url}?play=0`);
await page.waitForFunction(() => window.game && document.getElementById('btn-start-dispatch'));
await page.evaluate(() => document.getElementById('btn-start-dispatch').click());
await page.waitForFunction(() => window.game.vehicle && window.game._worldBuilt && window.game.gameState === 'playing');
const r = await page.evaluate((minutes) => {
  const S = window.Shiplyp, world = window.game.world, net = new S.RoadNetwork(world).build();
  const out = { fails: [] }, F = (m) => out.fails.push(m);
  const sys = new S.TrafficSystem({ vehicle: null }, net, { seed: 5927, audit: true });
  // park the player 70 m off the corner of a junction: close enough that traffic spawns around them, clear of every lane
  const j = net.junctions[1], T = j.tangent, nl = Math.hypot(T.x, T.z), nx = -T.z / nl, nz = T.x / nl;
  sys.fixedPlayer = { x: j.centre.x + (T.x / nl + nx) * 50, y: 0, z: j.centre.z + (T.z / nl + nz) * 50 };
  net._t = 0; const dt = 1 / 30, steps = Math.round(minutes * 60 / dt);
  const visits = new Map(); let inBox = 0;
  for (let i = 0; i < steps; i++) {
    net._t += dt; sys.update(dt);
    if (i % 30 === 0) for (const a of sys.agents) if (a.lane.kind === 'turn') visits.set(a.id, a.lane.junction);
  }
  const st = sys.stats;
  out.stats = { spawned: st.spawned, despawned: st.despawned, watchdog: st.watchdog, overlaps: st.overlaps, maxCount: st.maxCount, avgCount: +(st.sumCount / st.steps).toFixed(1), kinds: st.kinds, throughJunction: visits.size, minutes };
  if (st.maxCount < 15) F(`only ${st.maxCount} agents at once (need 15+)`);
  if (Object.keys(st.kinds).length < 4) F(`only ${Object.keys(st.kinds).length} vehicle kinds`);
  if (st.watchdog > 0) F(`${st.watchdog} agents were removed by the watchdog (stuck)`);
  if (st.overlaps > 0) F(`${st.overlaps} overlap samples`);
  if (visits.size < 20) F(`only ${visits.size} vehicles crossed a junction box`);
  if (st.collisions > 0) F(`${st.collisions} vehicle-vs-vehicle collisions`);
  // ---- player crash scenario: park the "player" on top of a moving vehicle and check the response
  const crashes = [];
  const fake = { vehicle: { mesh: { position: { x: sys.fixedPlayer.x, y: 0, z: sys.fixedPlayer.z } }, heading: 0, speed: 8 }, vehicleHandling: () => 'car', _onTrafficCrash(a, info) { crashes.push({ kind: a.kind, pen: info.pen, rel: info.relSpeed }); } };
  const sys2 = new S.TrafficSystem(fake, net, { seed: 77, audit: true }); net._t = 0;
  for (let i = 0; i < 30 * 40 && sys2.agents.length < 6; i++) { net._t += dt; sys2.update(dt); }
  const target = sys2.agents.find((a) => a.lane.kind === 'road' && a.v > 2);
  if (!target) F('no moving vehicle to crash into');
  else {
    const p0 = net.pose(target.lane, target.d); fake.vehicle.mesh.position.x = p0.x + 0.3; fake.vehicle.mesh.position.z = p0.z; fake.vehicle.heading = Math.atan2(p0.tx, p0.tz);
    net._t += dt; sys2.update(dt);
    if (!crashes.length) F('overlapping the player with a vehicle did not register a crash');
    if (!target.hit) F('the vehicle that was hit did not stop');
    for (let i = 0; i < 30 * 5; i++) { net._t += dt; sys2.update(dt); }
    if (sys2.agents.includes(target)) F('the crashed vehicle was not cleared after 5 s');
  }
  out.crash = { callbacks: crashes.length, first: crashes[0] || null };
  out.collisionLog = sys.collisionLog || [];
  out.stuck = sys.stuckLog || []; out.overlapLog = sys.overlapLog || [];
  return out;
}, minutes);
await browser.close(); await server.close();
if (r.collisionLog && r.collisionLog.length) console.log('collisions:\n' + r.collisionLog.join('\n'));
console.log(JSON.stringify(r.stats), 'crash test', JSON.stringify(r.crash)); if (r.overlapLog && r.overlapLog.length) console.log('overlaps:\n' + r.overlapLog.join('\n')); if (r.stuck && r.stuck.length) console.log('stuck samples:\n' + r.stuck.slice(0, 8).map((x) => JSON.stringify(x)).join('\n'));
if (r.fails.length) { console.error(r.fails.join('\n')); console.error('check-traffic FAIL'); process.exit(1); }
console.log('check-traffic OK');
