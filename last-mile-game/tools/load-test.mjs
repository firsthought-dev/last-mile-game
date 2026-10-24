// How long until a player can play, cold cache, on a normal and a throttled "mobile" link.
//   node tools/load-test.mjs <dir> [--runs 3] [--out dist/load-report.json]
// Times are milliseconds from navigation start (median of --runs). "hub" uses ?play=0
// (the DRIVE screen); "playing" is a first-time player's run (Play-now, no clicks).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { serve } from './lib/serve.mjs';

const args = process.argv.slice(2);
const dir = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const runs = args.includes('--runs') ? Number(args[args.indexOf('--runs') + 1]) : 3;
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'dist/load-report.json';
if (!dir) { console.error('usage: load-test.mjs <dir> [--runs N] [--out file]'); process.exit(2); }

const PROFILES = [
  { name: 'desktop', viewport: { width: 1280, height: 720 }, mobile: false, net: null, cpu: 1 },
  // ~1.6 Mbps down, 150 ms RTT, 4x slower CPU: a mid-range phone on a weak 4G link.
  { name: 'mobile', viewport: { width: 390, height: 844 }, mobile: true, net: { down: 1.6e6 / 8, up: 0.75e6 / 8, latency: 150 }, cpu: 4 },
];
const LAUNCH_ARGS = process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const server = await serve(dir, { prefix: '/' });
const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });

async function once(profile, query, waitFn) {
  const ctx = await browser.newContext({ viewport: profile.viewport, isMobile: profile.mobile, hasTouch: profile.mobile });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (profile.net) {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: profile.net.latency, downloadThroughput: profile.net.down, uploadThroughput: profile.net.up,
    });
  }
  if (profile.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });

  const types = new Map();
  const bytes = {};
  cdp.on('Network.responseReceived', (e) => types.set(e.requestId, e.type));
  cdp.on('Network.loadingFinished', (e) => {
    const t = types.get(e.requestId) || 'Other';
    bytes[t] = (bytes[t] || 0) + e.encodedDataLength;
  });

  await page.goto(server.url + query, { waitUntil: 'commit' });
  await page.waitForFunction(waitFn, null, { timeout: 300000, polling: 100 });
  const t = await page.evaluate(() => ({
    now: performance.now(),
    fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || null,
  }));
  await ctx.close();
  return { ...t, bytes };
}

const report = {};
for (const p of PROFILES) {
  const hub = [], play = [], fcp = [];
  let bytes = {};
  for (let i = 0; i < runs; i++) {
    const h = await once(p, 'index.html?play=0', () => window.game && document.getElementById('btn-start-dispatch'));
    hub.push(h.now); fcp.push(h.fcp);
    const g = await once(p, 'index.html', () => window.game && window.game.gameState === 'playing' && window.game.vehicle);
    play.push(g.now); bytes = g.bytes;
  }
  report[p.name] = {
    firstPaintMs: Math.round(median(fcp.filter(Boolean))),
    hubReadyMs: Math.round(median(hub)),
    playingMs: Math.round(median(play)),
    runs,
    transferredKB: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round(v / 1024)])),
  };
}
await browser.close();
await server.close();

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log('profile   firstPaint  hubReady  playing   (ms, median of ' + runs + ')');
for (const [k, v] of Object.entries(report)) {
  console.log(`${k.padEnd(9)} ${String(v.firstPaintMs).padStart(10)} ${String(v.hubReadyMs).padStart(9)} ${String(v.playingMs).padStart(8)}`);
}
console.log('transferred (first-time run, KB):', JSON.stringify(report.mobile.transferredKB));
