// Unit tests for the retention additions in last-mile/save.js (grace day, daily goal,
// local retention counters). Runs save.js in a vm with a controllable clock. Throwaway-safe.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../last-mile/save.js', 'utf8');
let failures = 0;
function test(name, fn) { try { fn(); console.log('ok   ', name); } catch (e) { failures++; console.log('FAIL ', name, '-', e.message); } }

function load(startISO) {
  const clock = { t: new Date(startISO + 'T12:00:00').getTime() };
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) super(clock.t); else super(...a); } static now() { return clock.t; } }
  const win = { Date: FakeDate }; win.window = win;
  vm.runInNewContext(src, Object.assign(win, { Date: FakeDate, Math, JSON, Object, Number, String, Array, Set, console, isNaN, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {} }), { filename: 'save.js' });
  const advance = (days) => { clock.t += days * 86400000; };
  return { Career: win.Career, advance, clock };
}
// Each visit is a fresh "session": checkIn is once per boot, so just call it.
const visit = (c) => c.Career.checkIn();

test('first visit starts streak at 1 and records first day', () => {
  const c = load('2026-10-01'); const r = visit(c);
  assert.strictEqual(r.event, 'first-visit'); assert.strictEqual(r.streak, 1);
  const rep = c.Career.retentionReport(); assert.strictEqual(rep.sessions, 1); assert.strictEqual(rep.firstDay, '2026-10-01');
});
test('consecutive day continues the streak', () => {
  const c = load('2026-10-01'); visit(c); c.advance(1); const r = visit(c);
  assert.strictEqual(r.event, 'continued'); assert.strictEqual(r.streak, 2);
});
test('same-day second open pays nothing and does not add a session', () => {
  const c = load('2026-10-01'); visit(c); const w = c.Career.wallet(); const r = visit(c);
  assert.strictEqual(r.event, 'same-day'); assert.strictEqual(r.bonus, 0); assert.strictEqual(c.Career.wallet(), w);
  assert.strictEqual(c.Career.retentionReport().sessions, 1);
});
test('one missed day is forgiven once (grace day)', () => {
  const c = load('2026-10-01'); visit(c); c.advance(1); visit(c); c.advance(2); const r = visit(c);
  assert.strictEqual(r.event, 'saved'); assert.strictEqual(r.streak, 3); assert.strictEqual(r.graceAvailable, false);
});
test('second missed day without refill resets the streak', () => {
  const c = load('2026-10-01'); visit(c); c.advance(1); visit(c); c.advance(2); visit(c); c.advance(2); const r = visit(c);
  assert.strictEqual(r.event, 'reset'); assert.strictEqual(r.streak, 1);
});
test('grace day comes back after 7 more streak days', () => {
  const c = load('2026-10-01'); visit(c); c.advance(2); const used = visit(c); assert.strictEqual(used.event, 'saved');
  let last; for (let i = 0; i < 7; i++) { c.advance(1); last = visit(c); }
  assert.strictEqual(last.graceAvailable, true);
  c.advance(2); const again = visit(c); assert.strictEqual(again.event, 'saved');
});
test('a gap of 3+ days resets even with grace available', () => {
  const c = load('2026-10-01'); visit(c); c.advance(3); const r = visit(c);
  assert.strictEqual(r.event, 'reset'); assert.strictEqual(r.streak, 1); assert.strictEqual(r.graceAvailable, true);
});
test('clock rolled backwards resets instead of crediting a streak', () => {
  const c = load('2026-10-10'); visit(c); c.advance(-3); const r = visit(c);
  assert.strictEqual(r.event, 'reset'); assert.strictEqual(r.streak, 1);
});
test('daily goal pays once on the 3rd delivery and resets next day', () => {
  const c = load('2026-10-01'); visit(c); const w0 = c.Career.wallet();
  const d = () => c.Career.recordDelivery({ payout: 0, stars: 2, streak: 1, orderId: 'x' + Math.random() });
  assert.strictEqual(d().dailyGoal.justCompleted, false); assert.strictEqual(d().dailyGoal.justCompleted, false);
  const third = d(); assert.strictEqual(third.dailyGoal.justCompleted, true); assert.strictEqual(c.Career.wallet() - w0, third.dailyGoal.bonus);
  const w1 = c.Career.wallet(); const fourth = d(); assert.strictEqual(fourth.dailyGoal.justCompleted, false); assert.strictEqual(c.Career.wallet(), w1);
  c.advance(1); visit(c); assert.strictEqual(c.Career.dailyGoal().done, 0); assert.strictEqual(c.Career.dailyGoal().paid, false);
});
test('retention report: D1 true, D7 unknown early, D7 false when skipped', () => {
  const c = load('2026-10-01'); visit(c); c.advance(1); visit(c);
  let rep = c.Career.retentionReport(); assert.strictEqual(rep.d1, true); assert.strictEqual(rep.d7, null);
  c.advance(7); visit(c); rep = c.Career.retentionReport(); assert.strictEqual(rep.d7, false); // played day 1 and day 8, not day 7
});
test('first-session deliveries and time-to-first-delivery are kept', () => {
  const c = load('2026-10-01'); visit(c);
  c.Career.recordDelivery({ payout: 10, stars: 1, streak: 1, orderId: 'a' }); c.Career.noteFirstDelivery(42000);
  const rep = c.Career.retentionReport(); assert.strictEqual(rep.firstSessionDeliveries, 1); assert.strictEqual(rep.timeToFirstDeliveryMs, 42000);
  c.Career.noteFirstDelivery(1); assert.strictEqual(c.Career.retentionReport().timeToFirstDeliveryMs, 42000);
});
test('an old save without the new fields loads with sane defaults', () => {
  const c = load('2026-10-01');
  assert.ok(c.Career.import(JSON.stringify({ version: 1, wallet: 500, lifetimeEarned: 900, career: { deliveries: 5 }, daily: { lastDay: '2026-09-30', streak: 4, bestStreak: 4, claimedDay: '2026-09-30' } })));
  const r = visit(c); assert.strictEqual(r.event, 'continued'); assert.strictEqual(r.streak, 5); assert.strictEqual(c.Career.state().career.deliveries, 5);
  assert.strictEqual(c.Career.retentionReport().sessions, 1);
});
test('corrupt metrics do not crash', () => {
  const c = load('2026-10-01');
  assert.ok(c.Career.import(JSON.stringify({ version: 1, metrics: { sessions: 'x', playDays: 'nope', firstSessionDeliveries: NaN }, daily: { goal: 5, graceAvailable: 'yes' } })));
  visit(c); assert.strictEqual(c.Career.retentionReport().sessions, 1);
});

test('backend seam: configureBackend persists, and a second load through the same backend sees it', () => {
  const store = {}; const be = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const a = load('2026-10-01'); assert.ok(a.Career.configureBackend(be)); visit(a);
  a.Career.recordDelivery({ payout: 100, stars: 3, streak: 1, orderId: 'seam1' }); a.Career.flush();
  const b = load('2026-10-01'); assert.ok(b.Career.configureBackend(be));
  assert.strictEqual(b.Career.state().career.deliveries, 1); assert.strictEqual(b.Career.wallet(), a.Career.wallet());
  assert.strictEqual(b.Career.state().daily.goal.done, 1); assert.strictEqual(b.Career.state().metrics.sessions, 1);
  assert.strictEqual(JSON.parse(store.shiplyp_career_v1).version, 1);
});
test('a backend that throws degrades to memory and does not break play', () => {
  const be = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  const c = load('2026-10-01'); c.Career.configureBackend(be); visit(c);
  c.Career.recordDelivery({ payout: 10, stars: 1, streak: 1, orderId: 'throw1' }); c.Career.flush();
  assert.strictEqual(c.Career.state().career.deliveries, 1);
});
test('export then import round-trips the whole profile (goal, grace and metrics included)', () => {
  const a = load('2026-10-01'); visit(a); a.advance(2); visit(a);
  a.Career.recordDelivery({ payout: 50, stars: 2, streak: 1, orderId: 'rt1' });
  const dump = a.Career.export(); const b = load('2026-10-03'); assert.ok(b.Career.import(dump));
  const strip = (o) => { const c = Object.assign({}, o); delete c.updatedAt; return JSON.stringify(c); };
  assert.strictEqual(strip(b.Career.state()), strip(JSON.parse(dump)));
});
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED'); process.exit(failures ? 1 : 0);
