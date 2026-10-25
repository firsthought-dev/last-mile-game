// Unit tests for last-mile/telemetry.js: schema, privacy defaults, backend seam, caps. Runs in a vm.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../last-mile/telemetry.js', 'utf8');
let failures = 0;
function test(name, fn) { try { fn(); console.log('ok   ', name); } catch (e) { failures++; console.log('FAIL ', name, '-', e.message); } }

function load(extra = {}) {
  const store = {}; const listeners = {};
  const win = { Date, Math, JSON, Object, Number, String, Array, console: { info() {}, log() {}, warn() {} },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { search: '' }, document: { hidden: false, addEventListener: (t, f) => { listeners[t] = f; } }, addEventListener: (t, f) => { listeners[t + ':win'] = f; } };
  win.window = win; Object.assign(win, extra);
  vm.runInNewContext(src, win, { filename: 'telemetry.js' });
  return { T: win.ShiplypTelemetry, win, store, listeners };
}
const EIGHT = ['app_open', 'shift_start', 'order_complete', 'order_fail', 'session_end', 'unlock', 'first_open_to_first_order', 'fps_sample'];

test('schema is exactly the eight playbook events that apply before monetization', () => {
  assert.deepStrictEqual(Object.keys(load().T.SCHEMA).sort(), EIGHT.slice().sort());
});
test('no backend by default: events are validated and kept in memory only', () => {
  const { T } = load(); assert.strictEqual(T.hasBackend(), false);
  assert.strictEqual(T.track('app_open', { platform: 'web', returning: true, streak: 3 }), true);
  assert.strictEqual(T.recent().length, 1);
});
test('backend receives validated params: numbers rounded, booleans 0/1, strings cut, unknown params dropped', () => {
  const { T } = load(); const got = []; assert.ok(T.configureBackend({ logEvent: (n, p) => got.push([n, p]) }));
  T.track('order_complete', { order_no: 2, stars: 3, late: false, payout: 123.456, vehicle: 'x'.repeat(100), secret: 'nope', time_left_pct: NaN });
  assert.deepStrictEqual(got[0][0], 'order_complete');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(got[0][1])), { order_no: 2, stars: 3, late: 0, payout: 123.46, vehicle: 'x'.repeat(40) });
});
test('unknown event names are dropped', () => {
  const { T } = load(); const got = []; T.configureBackend({ logEvent: (n) => got.push(n) });
  assert.strictEqual(T.track('purchase_made', { a: 1 }), false); assert.strictEqual(got.length, 0); assert.strictEqual(T.counters().dropped, 1);
});
test('a throwing backend never throws into the game', () => {
  const { T } = load(); T.configureBackend({ logEvent() { throw new Error('boom'); } });
  assert.doesNotThrow(() => T.track('unlock', { kind: 'vehicle', id: 'motorbike', price: 1500 }));
});
test('setEnabled(false) stops delivery, is remembered, and survives a reload', () => {
  const a = load(); const got = []; a.T.configureBackend({ logEvent: (n) => got.push(n) });
  a.T.setEnabled(false); a.T.track('shift_start', { shift_no: 1 }); assert.strictEqual(got.length, 0);
  const b = load(); b.win.localStorage.setItem('shiplyp_telemetry_off', '1'); // same storage key a real reload would see
  const c = load({ localStorage: b.win.localStorage }); assert.strictEqual(c.T.isEnabled(), false);
  a.T.setEnabled(true); a.T.track('shift_start', { shift_no: 2 }); assert.strictEqual(got.length, 1);
});
test('blocked storage still works', () => {
  const { T } = load({ localStorage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } } });
  assert.strictEqual(T.isEnabled(), true); assert.doesNotThrow(() => T.setEnabled(false));
});
test('per-session cap stops a flood', () => {
  const { T } = load(); const got = []; T.configureBackend({ logEvent: () => got.push(1) });
  for (let i = 0; i < 1000; i++) T.track('order_fail', { reason: 'missed_throw' });
  assert.strictEqual(got.length, 400); assert.ok(T.counters().dropped >= 600);
});
test('session_end carries duration and counters, and fires once for hidden + pagehide', () => {
  const { T, listeners, win } = load(); const got = []; T.configureBackend({ logEvent: (n, p) => got.push([n, p]) });
  T.track('shift_start', { shift_no: 1 }); T.track('order_complete', { order_no: 1 }); T.track('order_fail', { reason: 'missed_throw' });
  win.document.hidden = true; listeners.visibilitychange(); listeners['pagehide:win']();
  const ends = got.filter(g => g[0] === 'session_end'); assert.strictEqual(ends.length, 1);
  assert.deepStrictEqual([ends[0][1].orders, ends[0][1].fails, ends[0][1].shifts, ends[0][1].reason], [1, 1, 1, 'hidden']);
});
test('fps_sample: one aggregated event per 30 s window with avg, p5 and min', () => {
  let now = 1000000; class D extends Date { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } }
  const { T } = load({ Date: D }); const got = []; T.configureBackend({ logEvent: (n, p) => got.push([n, p]) });
  for (let i = 0; i < 70; i++) { T.fpsSample(i % 10 === 0 ? 20 : 60, { pixel_ratio: 1.5, style: 'crisp', vehicle: 'cycle' }); now += 500; }
  const f = got.filter(g => g[0] === 'fps_sample'); assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0][1].min, 20); assert.ok(f[0][1].avg > 50 && f[0][1].avg < 60); assert.strictEqual(f[0][1].style, 'crisp'); assert.strictEqual(f[0][1].pixel_ratio, 1.5);
});
test('fps_sample ignores nonsense readings and tiny windows', () => {
  const { T } = load(); const got = []; T.configureBackend({ logEvent: (n) => got.push(n) });
  T.fpsSample(0); T.fpsSample(NaN); T.fpsSample(9999); for (let i = 0; i < 3; i++) T.fpsSample(60); T.endSession('test');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(got)), ['session_end']);
});
test('a native bridge is picked up automatically and receives JSON', () => {
  const got = []; const { T } = load({ ShiplypNativeTelemetry: { logEvent: (n, j) => got.push([n, JSON.parse(j)]) } });
  assert.strictEqual(T.hasBackend(), true); T.track('first_open_to_first_order', { ms: 41234.5 });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(got[0])), ['first_open_to_first_order', { ms: 41234.5 }]);
});
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED'); process.exit(failures ? 1 : 0);
