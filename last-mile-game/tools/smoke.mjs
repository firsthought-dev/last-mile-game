// Headless-browser smoke test of a staged build.
//   node tools/smoke.mjs <dir> [--out <screens-dir>] [--no-storage]
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
  console.log(`smoke ${p.name}${noStorage ? ' (storage blocked)' : ''}`);
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
    // Either the hub (click Start) or straight into the drive (first-time players).
    await page.waitForFunction(() => window.game && (window.game.gameState === 'playing' || document.getElementById('btn-start-dispatch')), null, { timeout: BOOT_TIMEOUT });
    const startsInDrive = await page.evaluate(() => window.game.gameState === 'playing');
    if (!startsInDrive) await page.evaluate(() => document.getElementById('btn-start-dispatch').click());
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
    await page.screenshot({ path: path.join(outDir, `smoke-${p.name}${noStorage ? '-nostorage' : ''}.png`) });
  }
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
