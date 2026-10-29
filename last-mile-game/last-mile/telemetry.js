// ============================================================================
// SHIPLYP TELEMETRY
// A small, fixed set of gameplay events (playbook section 4), validated here
// and handed to a swappable backend. Same shape as save.js: nothing in the
// game knows where the events go.
//
// BACKENDS: none by default, so on the web nothing leaves the device. When the
// Android shell exposes `window.ShiplypNativeTelemetry.logEvent(name, json)`,
// init() picks it up on its own. A Firebase bridge later only has to implement
// that one method natively. Anything else: ShiplypTelemetry.configureBackend({ logEvent(name, params) }).
//
// PRIVACY: events carry gameplay numbers and short ids (vehicle, city) only. No
// user id, device id, location, or free text. Players can switch it off with
// setEnabled(false) (remembered on the device). The privacy policy must name
// whatever backend is plugged in.
// ============================================================================

(function (global) {
  'use strict';

  const OFF_KEY = 'shiplyp_telemetry_off';
  const MAX_EVENTS_PER_SESSION = 400;   // a stuck loop must not flood the backend
  const RING_SIZE = 100;                // recent events kept in memory, for tests and the debug overlay
  const FPS_WINDOW_MS = 30000;          // one fps_sample per 30 s of play
  const FPS_MIN_SAMPLES = 8;            // a window shorter than 4 s of play says nothing
  const MAX_STR = 40;

  // name -> { param: 's' (short string) | 'n' (finite number) | 'b' (sent as 0 or 1) }.
  // Anything not listed here is dropped, so the schema below is the whole contract.
  const SCHEMA = {
    app_open:                  { platform: 's', returning: 'b', streak: 'n', build: 's' },
    shift_start:               { shift_no: 'n', vehicle: 's', city: 's', difficulty: 's' },
    order_complete:            { order_no: 'n', stars: 'n', late: 'b', payout: 'n', time_left_pct: 'n', vehicle: 's' },
    order_fail:                { reason: 's', spare_left: 'n', vehicle: 's' },
    session_end:               { reason: 's', duration_s: 'n', orders: 'n', fails: 'n', shifts: 'n' },
    unlock:                    { kind: 's', id: 's', price: 'n' },
    first_open_to_first_order: { ms: 'n' },
    fps_sample:                { avg: 'n', p5: 'n', min: 'n', samples: 'n', pixel_ratio: 'n', style: 's', vehicle: 's' }
  };

  let backend = null;
  let enabled = true;
  let started = 0;
  let debug = false;
  let sent = 0, dropped = 0;
  const ring = [];
  const session = { orders: 0, fails: 0, shifts: 0 };
  let fpsBuf = [], fpsWindowStart = 0, lastEndAt = -1e9;

  function round(n) { return Math.round(n * 100) / 100; }

  function clean(name, params) {
    const spec = SCHEMA[name];
    if (!spec) return null;
    const out = {};
    const p = params && typeof params === 'object' ? params : {};
    for (const k of Object.keys(spec)) {
      if (!(k in p)) continue;
      const v = p[k];
      if (spec[k] === 's') {
        if (v == null) continue;
        out[k] = String(v).slice(0, MAX_STR);
      } else if (spec[k] === 'b') {
        out[k] = v ? 1 : 0;
      } else if (typeof v === 'number' && isFinite(v)) {
        out[k] = round(v);
      }
    }
    return out;
  }

  function deliver(name, params) {
    if (sent >= MAX_EVENTS_PER_SESSION) { dropped++; return false; }
    sent++;
    ring.push({ t: Date.now(), name, params });
    if (ring.length > RING_SIZE) ring.shift();
    if (debug) { try { console.info('[telemetry]', name, JSON.stringify(params)); } catch (e) { /* ignore */ } }
    if (enabled && backend) {
      try { backend.logEvent(name, params); } catch (e) { /* a broken backend must never break the game */ }
    }
    return true;
  }

  function emitSessionEnd(reason) {
    const now = Date.now();
    if (now - lastEndAt < 1000) return;   // pagehide often follows visibilitychange
    lastEndAt = now;
    flushFps();
    Telemetry.track('session_end', { reason, duration_s: (now - started) / 1000, orders: session.orders, fails: session.fails, shifts: session.shifts });
  }

  function flushFps(ctx) {
    if (fpsBuf.length >= FPS_MIN_SAMPLES) {
      const s = fpsBuf.slice().sort((a, b) => a - b);
      const avg = s.reduce((a, b) => a + b, 0) / s.length;
      Telemetry.track('fps_sample', Object.assign({ avg, p5: s[Math.floor(s.length * 0.05)], min: s[0], samples: s.length }, Telemetry._fpsCtx));
    }
    fpsBuf = []; fpsWindowStart = 0;
  }

  const Telemetry = {
    SCHEMA,
    _fpsCtx: {},

    init() {
      if (started) return this;
      started = Date.now();
      try { enabled = global.localStorage.getItem(OFF_KEY) !== '1'; } catch (e) { enabled = true; }
      try { debug = /[?&]telemetry=debug\b/.test(global.location.search) || global.localStorage.getItem('shiplyp_telemetry_debug') === '1'; } catch (e) { debug = false; }
      const native = global.ShiplypNativeTelemetry;
      if (native && typeof native.logEvent === 'function') {
        backend = { logEvent(name, params) { native.logEvent(name, JSON.stringify(params)); } };
      }
      if (global.document && global.document.addEventListener) {
        global.document.addEventListener('visibilitychange', () => { if (global.document.hidden) emitSessionEnd('hidden'); });
        global.addEventListener('pagehide', () => emitSessionEnd('pagehide'));
      }
      return this;
    },

    // backend: { logEvent(name, params) }. Params are already validated.
    configureBackend(impl) {
      if (!impl || typeof impl.logEvent !== 'function') return false;
      backend = impl;
      return true;
    },

    hasBackend() { return !!backend; },
    isEnabled() { return enabled; },
    setEnabled(on) {
      enabled = !!on;
      try { if (enabled) global.localStorage.removeItem(OFF_KEY); else global.localStorage.setItem(OFF_KEY, '1'); } catch (e) { /* storage blocked: lasts for this session */ }
    },

    track(name, params) {
      const p = clean(name, params);
      if (!p) { dropped++; return false; }
      if (name === 'order_complete') session.orders++;
      else if (name === 'order_fail') session.fails++;
      else if (name === 'shift_start') session.shifts++;
      return deliver(name, p);
    },

    // Feed the game's ~0.5 s fps readout. Emits one fps_sample per 30 s of play.
    // ctx (optional): { pixel_ratio, style, vehicle } copied onto the sample.
    fpsSample(fps, ctx) {
      if (!(fps > 0 && fps < 500)) return;
      const now = Date.now();
      if (!fpsWindowStart) fpsWindowStart = now;
      if (ctx) this._fpsCtx = ctx;
      fpsBuf.push(fps);
      if (now - fpsWindowStart >= FPS_WINDOW_MS) flushFps();
    },

    recent() { return ring.slice(); },
    counters() { return { sent, dropped, orders: session.orders, fails: session.fails, shifts: session.shifts }; },
    endSession(reason) { emitSessionEnd(reason || 'manual'); }
  };

  global.ShiplypTelemetry = Telemetry.init();
})(typeof window !== 'undefined' ? window : globalThis);
