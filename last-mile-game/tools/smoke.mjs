// Headless-browser smoke test of a staged build.
//   node tools/smoke.mjs <dir> [--out <screens-dir>] [--no-storage] [--returning]
// Default = a first-time player (fresh storage): the game must start driving on its own
// (Play-now). --returning seeds a career save: the hub must show and wait for DRIVE.
// Serves <dir> under /portal/sub/ (portals host games in a sub-path), blocks every
// non-local request, starts a drive and holds the throttle for 10 s.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { serve } from './lib/serve.mjs';

const args = process.argv.slice(2);
const dir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const noStorage = args.includes('--no-storage');
const returning = args.includes('--returning');
const tag = noStorage ? ' (storage blocked)' : returning ? ' (returning player)' : '';
if (!dir) { console.error('usage: smoke.mjs <dir> [--out <dir>] [--no-storage]'); process.exit(2); }

const PROFILES = [
  { name: '1280x720', viewport: { width: 1280, height: 720 }, mobile: false },
  { name: '390x844', viewport: { width: 390, height: 844 }, mobile: true },
];
const BOOT_TIMEOUT = Number(process.env.SMOKE_BOOT_TIMEOUT || 120000);
// Software GL (CI) is slow; real GPU (a dev Mac) is fast. Metal only exists on macOS.
const LAUNCH_ARGS = process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const server = await serve(dir, { prefix: '/portal/sub/' });
const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
let failed = false;
const fail = (profile, msg) => { failed = true; console.error(`  FAIL [${profile}] ${msg}`); };

for (const p of PROFILES) {
  console.log(`smoke ${p.name}${tag}`);
  const ctx = await browser.newContext({ viewport: p.viewport, isMobile: p.mobile, hasTouch: p.mobile });
  const page = await ctx.newPage();
  const external = [];
  const bad = [];
  const errors = [];
  if (noStorage) {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
    });
  }
  if (returning) {
    await page.addInitScript(() => {
      localStorage.setItem('shiplyp_career_v1', JSON.stringify({ career: { deliveries: 3, shifts: 1 } }));
    });
  }
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(server.origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    external.push(u);
    return route.abort();
  });
  page.on('response', (r) => { if (r.url().startsWith(server.origin) && r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(server.url, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.game, null, { timeout: BOOT_TIMEOUT });
    if (returning) {
      // Returning players land on the hub and stay there until they press DRIVE.
      await page.waitForFunction(() => document.getElementById('btn-start-dispatch'), null, { timeout: BOOT_TIMEOUT });
      await page.waitForTimeout(3000);
      if (await page.evaluate(() => window.game.gameState === 'playing' || window.game._worldBuilt)) {
        fail(p.name, 'a returning player was sent straight into the drive (Play-now should be first-time only)');
      }
      await page.evaluate(() => document.getElementById('btn-start-dispatch').click());
    }
    // First-time players are never clicked for: the game has to start by itself.
    await page.waitForFunction(() => window.game.gameState === 'playing' && window.game.vehicle, null, { timeout: BOOT_TIMEOUT });
  } catch (e) {
    fail(p.name, `never reached gameState "playing": ${e.message.split('\n')[0]}`);
    await ctx.close();
    continue;
  }
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(10000);
  const state = await page.evaluate(async () => {
    await document.fonts.ready;
    // The latin-ext face (the one with the rupee sign) only loads when needed.
    const rupeeFaces = await document.fonts.load('700 20px Barlow', '₹');
    const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
    return {
      gameState: window.game.gameState,
      speed: window.game.vehicle.speed,
      barlowLoaded: fonts.includes('Barlow'),
      rupee: rupeeFaces.length > 0 && document.fonts.check('700 20px Barlow', '₹'),
    };
  });
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    // Diagnostic only: under software GL (CI) a frame can take over 30 s, so give it time and never fail the run on it.
    try {
      await page.screenshot({ path: path.join(outDir, `smoke-${p.name}${noStorage ? '-nostorage' : returning ? '-returning' : ''}.png`), timeout: 120000 });
    } catch (e) {
      console.warn(`  (screenshot skipped: ${e.message.split('\n')[0]})`);
    }
  }
  // Hidden tab: the game must freeze (and go quiet) while hidden, and move again after.
  const pos = () => page.evaluate(() => { const q = window.game.vehicle.mesh.position; return [q.x, q.z]; });
  const dist = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const frozenFrom = await pos();
  await page.waitForTimeout(2000);
  const frozenTo = await pos();
  const hiddenPaused = await page.evaluate(() => window.game._hiddenPaused);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // Poll rather than sleep: under software GL (CI) the first frames after resume can take well over 1.5 s.
  let resumedTo = await pos();
  for (let t = 0; t < 60 && !(dist(frozenTo, resumedTo) > 0.5); t++) {
    await page.waitForTimeout(500);
    resumedTo = await pos();
  }
  if (!hiddenPaused) fail(p.name, 'game did not pause when the tab was hidden');
  if (dist(frozenFrom, frozenTo) > 0.01) fail(p.name, `vehicle moved ${dist(frozenFrom, frozenTo).toFixed(2)} m while hidden`);
  if (!(dist(frozenTo, resumedTo) > 0.5)) fail(p.name, 'vehicle did not move again after the tab became visible');

  await page.keyboard.up('ArrowUp');

  if (external.length) fail(p.name, `${external.length} external request(s), e.g. ${external[0]}`);
  if (bad.length) fail(p.name, `local request(s) failed: ${bad.slice(0, 3).join(', ')}`);
  if (errors.length) fail(p.name, `console errors: ${errors.slice(0, 3).join(' | ')}`);
  if (state.gameState !== 'playing') fail(p.name, `gameState is ${state.gameState} after 10 s`);
  if (!(state.speed > 0)) fail(p.name, `vehicle did not move (speed ${state.speed})`);
  if (!state.barlowLoaded) fail(p.name, 'Barlow font did not load');
  if (!state.rupee) fail(p.name, 'Barlow has no usable ₹');
  console.log(`  speed ${Number(state.speed).toFixed(1)} m/s, Barlow ${state.barlowLoaded}, ₹ ${state.rupee}`);
  await ctx.close();
}

await browser.close();
await server.close();
if (failed) { console.error('smoke FAIL'); process.exit(1); }
console.log('smoke OK');
