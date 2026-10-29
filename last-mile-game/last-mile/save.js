// ============================================================================
// SHIPLYP SAVE & CAREER LAYER
// Persistent profile: wallet, lifetime stats, courier rank, daily streak,
// per-order star records and unlocks.
//
// Everything the player earns across sessions lives here and NOWHERE else.
// `ShiplypEngine.earnings` stays exactly what it was — a per-shift counter
// shown on the HUD and rolled back by the resume checkpoint. This module is
// the bank behind it: money reaches the career wallet the instant a delivery
// is fulfilled, so a WebView process killed by Android mid-shift costs the
// player nothing.
//
// STORAGE BACKEND: localStorage by default, but every read/write goes through
// the `backend` indirection below. When the Android shell grows a native
// @JavascriptInterface save bridge, call ShiplypSave.configureBackend({...})
// once at boot and no game code changes at all. Any backend throwing (private
// browsing, WebView with storage disabled, quota exceeded) silently degrades
// to an in-memory profile for the session rather than breaking the game.
// ============================================================================

(function (global) {
  'use strict';

  const STORAGE_KEY = 'shiplyp_career_v1';
  const SCHEMA_VERSION = 1;
  const GRACE_REFILL_DAYS = 7;       // streak days earned before the grace day comes back
  const DAILY_GOAL_TARGET = 3;       // deliveries
  const DAILY_GOAL_BONUS = 150;      // rupees, paid once per day
  const PLAY_DAYS_CAP = 120;

  // Writes are debounced: a delivery fires several state changes in one frame
  // and there is no reason to serialize the profile more than once for them.
  // Anything that could be the last moment of the session (tab hidden, page
  // unloading, app backgrounded) flushes synchronously — see installLifecycleHooks.
  const WRITE_DEBOUNCE_MS = 700;

  // --------------------------------------------------------------------------
  // COURIER RANKS — derived from lifetime earnings, never stored. Storing a
  // derived value is how save files drift out of agreement with themselves.
  // Thresholds are deliberately front-loaded: the first three ranks should
  // land inside a new player's first two sessions, because the whole job of
  // this ladder is to make session two feel like a continuation of session one.
  // --------------------------------------------------------------------------
  const RANKS = [
    { id: 'trainee',   name: 'Trainee Runner',    from: 0 },
    { id: 'tiffin',    name: 'Tiffin Runner',     from: 2500 },
    { id: 'courier',   name: 'City Courier',      from: 10000 },
    { id: 'express',   name: 'Express Rider',     from: 30000 },
    { id: 'ghat',      name: 'Ghat Veteran',      from: 75000 },
    { id: 'dispatch',  name: 'Dispatch Lead',     from: 150000 },
    { id: 'legend',    name: 'Last-Mile Legend',  from: 400000 }
  ];

  // --------------------------------------------------------------------------
  // BACKEND
  // --------------------------------------------------------------------------
  const memoryStore = Object.create(null);
  const memoryBackend = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(memoryStore, k) ? memoryStore[k] : null; },
    setItem(k, v) { memoryStore[k] = String(v); },
    removeItem(k) { delete memoryStore[k]; }
  };

  let backend = memoryBackend;
  let backendIsDurable = false;

  try {
    // Feature-detect by actually writing: Safari private mode and some WebView
    // configurations expose a localStorage object whose setItem always throws,
    // so a `typeof localStorage` check proves nothing.
    const probe = '__shiplyp_probe__';
    global.localStorage.setItem(probe, '1');
    global.localStorage.removeItem(probe);
    backend = global.localStorage;
    backendIsDurable = true;
  } catch (e) {
    backend = memoryBackend;
    backendIsDurable = false;
  }

  // --------------------------------------------------------------------------
  // PROFILE SHAPE
  // --------------------------------------------------------------------------
  function todayKey() {
    // Local calendar date, not UTC: a player's "day" is their day. Format
    // YYYY-MM-DD so string comparison and Date parsing both work.
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function daysBetween(aKey, bKey) {
    const a = new Date(aKey + 'T00:00:00');
    const b = new Date(bKey + 'T00:00:00');
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  function defaultProfile() {
    return {
      version: SCHEMA_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),

      // Spendable balance. Separate from lifetimeEarned because spending must
      // never be able to demote a player's rank.
      wallet: 0,
      lifetimeEarned: 0,

      career: {
        deliveries: 0,
        shifts: 0,
        distanceKm: 0,
        bestStreak: 0,
        bestShiftEarnings: 0,
        perfectDeliveries: 0   // 3-star drops
      },

      daily: {
        lastDay: null,
        streak: 0,
        bestStreak: 0,
        claimedDay: null,      // day the streak bonus was last paid out
        // One free missed day. Spent when a single day is skipped, and handed
        // back once the streak has grown another GRACE_REFILL_DAYS. Free on
        // purpose: selling streak protection monetises a loss the game created.
        graceAvailable: true,
        graceRefillAt: 0,
        // Today's delivery goal. Pays for playing, where the check-in bonus
        // pays for opening the app.
        goal: { day: null, done: 0, paid: false }
      },

      // Local-only counters so retention can be read (D1/D7/D30) without any
      // network or analytics SDK. Nothing here ever leaves the device.
      metrics: {
        firstDay: null,
        sessions: 0,
        playDays: [],                  // day keys, capped to the last 120
        firstSessionDeliveries: 0,
        timeToFirstDeliveryMs: 0       // 0 until the first delivery lands
      },

      // orderId -> best stars (1-3). Sparse on purpose: an unattempted order
      // has no key rather than a zero, so "attempted" and "failed" stay
      // distinguishable if a later fail path wants to record one.
      stars: {},

      // One-time explainer/tutorial ids the player has already been shown.
      hints: {},

      selectedVehicle: 'cycle', // Active vehicle in fleet (defaults to free starter cycle)

      unlocks: {
        vehicles: ['cycle'],  // other vehicles are bought with Career.purchase('vehicles', id, price); prices live in game.js CONFIG.VEHICLES
        cities: ['mumbai']
      }
    };
  }

  // Merge a loaded profile onto the current defaults so a save written by an
  // older build never arrives missing a field the running build reads. This is
  // the cheap version of a migration system and it covers additive changes,
  // which is what almost every schema change actually is.
  function reconcile(loaded) {
    const base = defaultProfile();
    if (!loaded || typeof loaded !== 'object') return base;

    // `fresh` is a second copy of the defaults: Object.assign(base, loaded) below
    // replaces base.career/daily/unlocks with the saved objects, so merging into
    // base.career afterwards would never fill in a field the save lacks.
    const fresh = defaultProfile();
    const out = Object.assign(base, loaded);
    out.version = SCHEMA_VERSION;
    out.career = Object.assign(fresh.career, loaded.career || {});
    out.daily = Object.assign(fresh.daily, loaded.daily || {});
    // B146 fields: a save from before them gets the defaults, and a stale one cannot poison the maths.
    out.daily.goal = Object.assign({ day: null, done: 0, paid: false }, (loaded.daily && loaded.daily.goal) || {});
    out.daily.graceAvailable = loaded.daily && typeof loaded.daily.graceAvailable === 'boolean' ? loaded.daily.graceAvailable : true;
    out.daily.graceRefillAt = safeNum(out.daily.graceRefillAt, 0);
    out.metrics = Object.assign(fresh.metrics, loaded.metrics || {});
    out.metrics.playDays = Array.isArray(out.metrics.playDays) ? out.metrics.playDays.filter(d => typeof d === 'string').slice(-PLAY_DAYS_CAP) : [];
    out.metrics.sessions = safeNum(out.metrics.sessions, 0);
    out.metrics.firstSessionDeliveries = safeNum(out.metrics.firstSessionDeliveries, 0);
    out.metrics.timeToFirstDeliveryMs = safeNum(out.metrics.timeToFirstDeliveryMs, 0);
    out.unlocks = Object.assign(fresh.unlocks, loaded.unlocks || {});
    out.hints = (loaded.hints && typeof loaded.hints === 'object') ? loaded.hints : {};
    out.stars = (loaded.stars && typeof loaded.stars === 'object') ? loaded.stars : {};

    // Numbers arriving as strings or NaN from a corrupted/hand-edited save
    // would poison every later arithmetic op, so coerce defensively.
    out.wallet = safeNum(out.wallet, 0);
    out.lifetimeEarned = safeNum(out.lifetimeEarned, 0);
    for (const k of Object.keys(out.career)) out.career[k] = safeNum(out.career[k], 0);
    if (!Array.isArray(out.unlocks.vehicles)) out.unlocks.vehicles = fresh.unlocks.vehicles;
    if (!Array.isArray(out.unlocks.cities)) out.unlocks.cities = fresh.unlocks.cities;

    // Defensively clamp selectedVehicle to an unlocked vehicle (never allow locked vehicle on boot/reload)
    const validVehicles = out.unlocks.vehicles;
    if (typeof out.selectedVehicle !== 'string' || validVehicles.indexOf(out.selectedVehicle) === -1) {
      out.selectedVehicle = validVehicles[0] || 'cycle';
    }

    return out;
  }

  function safeNum(v, fallback) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  // --------------------------------------------------------------------------
  // LOAD / WRITE
  // --------------------------------------------------------------------------
  let profile = defaultProfile();
  let loaded = false;
  let writeTimer = null;
  let dirty = false;
  const listeners = new Set();

  function load() {
    let raw = null;
    try { raw = backend.getItem(STORAGE_KEY); } catch (e) { raw = null; }

    if (raw) {
      try {
        profile = reconcile(JSON.parse(raw));
      } catch (e) {
        // Unparseable save. Keep the corrupt string under a side key rather
        // than destroying it — if a player ever reports lost progress, that
        // copy is the only way to find out what happened.
        try { backend.setItem(STORAGE_KEY + '_corrupt', raw); } catch (e2) {}
        profile = defaultProfile();
      }
    } else {
      profile = defaultProfile();
    }

    loaded = true;
    return profile;
  }

  function writeNow() {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    if (!dirty) return true;
    profile.updatedAt = Date.now();
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(profile));
      dirty = false;
      return true;
    } catch (e) {
      // Quota or a backend that went away mid-session. Don't clear `dirty` —
      // the next flush gets another chance, and the in-memory profile is still
      // correct for the rest of this session.
      return false;
    }
  }

  function touch() {
    dirty = true;
    if (writeTimer) return;
    writeTimer = setTimeout(() => { writeTimer = null; writeNow(); }, WRITE_DEBOUNCE_MS);
    notify();
  }

  function notify() {
    for (const fn of listeners) {
      try { fn(profile); } catch (e) { /* a broken listener must not break the game loop */ }
    }
  }

  function installLifecycleHooks() {
    if (!global.addEventListener) return;
    // visibilitychange fires when Android backgrounds the WebView; pagehide
    // covers reload/navigation. Both are the last reliable moment to write.
    global.addEventListener('visibilitychange', () => {
      if (global.document && global.document.visibilityState === 'hidden') writeNow();
    });
    global.addEventListener('pagehide', writeNow);
    global.addEventListener('beforeunload', writeNow);
  }

  // --------------------------------------------------------------------------
  // RANK
  // --------------------------------------------------------------------------
  function rankFor(lifetimeEarned) {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) {
      if (lifetimeEarned >= RANKS[i].from) idx = i;
    }
    const current = RANKS[idx];
    const next = RANKS[idx + 1] || null;
    const span = next ? (next.from - current.from) : 0;
    const into = lifetimeEarned - current.from;
    return {
      id: current.id,
      name: current.name,
      index: idx,
      next: next ? { id: next.id, name: next.name, at: next.from } : null,
      toNext: next ? Math.max(0, next.from - lifetimeEarned) : 0,
      progress: next && span > 0 ? Math.min(1, into / span) : 1
    };
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------
  const Save = {
    RANKS,

    // Call once at boot. Idempotent.
    init() {
      if (!loaded) {
        load();
        installLifecycleHooks();
      }
      return this;
    },

    isDurable() { return backendIsDurable; },

    // Swap in a native bridge later: configureBackend({ getItem, setItem, removeItem }).
    // Reloads the profile through the new backend so the switch is complete,
    // not half-applied.
    configureBackend(impl) {
      if (!impl || typeof impl.getItem !== 'function' || typeof impl.setItem !== 'function') return false;
      backend = impl;
      backendIsDurable = true;
      load();
      notify();
      return true;
    },

    // Read-only snapshot. Callers get a copy so no UI code can accidentally
    // mutate career state without going through the methods that persist it.
    state() { return JSON.parse(JSON.stringify(profile)); },

    wallet() { return profile.wallet; },
    lifetimeEarned() { return profile.lifetimeEarned; },
    career() { return Object.assign({}, profile.career); },
    rank() { return rankFor(profile.lifetimeEarned); },

    on(fn) { if (typeof fn === 'function') listeners.add(fn); return () => listeners.delete(fn); },

    // ---- money ----------------------------------------------------------
    credit(amount, source) {
      const amt = Math.max(0, Math.round(safeNum(amount, 0)));
      if (!amt) return profile.wallet;
      profile.wallet += amt;
      profile.lifetimeEarned += amt;
      this._shiftEarned += amt;
      touch();
      return profile.wallet;
    },

    // Returns false and changes nothing when the player can't afford it, so
    // callers can use it directly as the purchase guard.
    spend(amount) {
      const amt = Math.max(0, Math.round(safeNum(amount, 0)));
      if (amt > profile.wallet) return false;
      profile.wallet -= amt;
      touch();
      return true;
    },

    // ---- shift lifecycle -------------------------------------------------
    _shiftEarned: 0,
    _shiftDeliveries: 0,

    beginShift() {
      profile.career.shifts += 1;
      this._shiftEarned = 0;
      this._shiftDeliveries = 0;
      touch();
      return profile.career.shifts;
    },

    endShift(info) {
      const km = safeNum(info && info.distanceKm, 0);
      if (km > 0) profile.career.distanceKm += km;
      if (this._shiftEarned > profile.career.bestShiftEarnings) {
        profile.career.bestShiftEarnings = this._shiftEarned;
      }
      // touch() before the flush, not after: writeNow() is a no-op when the
      // profile isn't marked dirty, and the fields above were mutated
      // directly rather than through credit()/addDistance().
      touch();
      writeNow();
      return { earned: this._shiftEarned, deliveries: this._shiftDeliveries, distanceKm: km };
    },

    shiftEarned() { return this._shiftEarned; },

    // ---- deliveries ------------------------------------------------------
    // One call does the whole job: banks the payout, counts the delivery,
    // records the star rating and tracks the best streak. Anything that adds
    // a new career consequence of a delivery belongs here, so the two delivery
    // paths (tossed parcel, doorstep drop) can never drift apart.
    recordDelivery(info) {
      const payout = Math.max(0, Math.round(safeNum(info && info.payout, 0)));
      const stars = Math.min(3, Math.max(1, Math.round(safeNum(info && info.stars, 1))));
      const streak = Math.max(0, Math.round(safeNum(info && info.streak, 0)));
      const orderId = info && info.orderId != null ? String(info.orderId) : null;

      profile.career.deliveries += 1;
      this._shiftDeliveries += 1;
      if (profile.metrics.sessions <= 1) profile.metrics.firstSessionDeliveries += 1;
      const goal = this._goalToday();
      goal.done += 1;
      if (stars >= 3) profile.career.perfectDeliveries += 1;
      if (streak > profile.career.bestStreak) profile.career.bestStreak = streak;

      if (orderId) {
        const best = safeNum(profile.stars[orderId], 0);
        if (stars > best) profile.stars[orderId] = stars;
      }

      const rankBefore = rankFor(profile.lifetimeEarned);
      this.credit(payout, 'delivery');
      const rankAfter = rankFor(profile.lifetimeEarned);

      let goalDone = false;
      if (goal.done >= DAILY_GOAL_TARGET && !goal.paid) {
        goal.paid = true;
        goalDone = true;
        this.credit(DAILY_GOAL_BONUS, 'daily_goal');
      }

      return {
        wallet: profile.wallet,
        stars,
        promoted: rankAfter.index > rankBefore.index ? rankAfter : null,
        dailyGoal: { done: Math.min(goal.done, DAILY_GOAL_TARGET), target: DAILY_GOAL_TARGET, justCompleted: goalDone, bonus: DAILY_GOAL_BONUS }
      };
    },

    recordShift(earnings) {
      const e = Math.max(0, Math.round(safeNum(earnings, 0)));
      profile.career.shifts += 1;
      if (e > profile.career.bestShiftEarnings) {
        profile.career.bestShiftEarnings = e;
      }
      touch();
      writeNow();
      return { shifts: profile.career.shifts, bestShiftEarnings: profile.career.bestShiftEarnings };
    },

    starsFor(orderId) { return safeNum(profile.stars[String(orderId)], 0); },

    addDistance(km) {
      const d = safeNum(km, 0);
      if (d > 0) { profile.career.distanceKm += d; touch(); }
      return profile.career.distanceKm;
    },

    // ---- daily streak ----------------------------------------------------
    // Call once per session at boot. Returns what happened so the caller can
    // decide whether to show anything; it never renders UI itself.
    checkIn() {
      const today = todayKey();
      const last = profile.daily.lastDay;
      let event = 'same-day';

      if (last === today) {
        return { event, streak: profile.daily.streak, bonus: 0, graceAvailable: profile.daily.graceAvailable };
      }

      if (!last) {
        profile.daily.streak = 1;
        event = 'first-visit';
      } else {
        const gap = daysBetween(last, today);
        if (gap === 1) {
          profile.daily.streak += 1;
          event = 'continued';
        } else if (gap === 2 && profile.daily.graceAvailable) {
          // One missed day is forgiven, once, then it has to be re-earned.
          profile.daily.streak += 1;
          profile.daily.graceAvailable = false;
          profile.daily.graceRefillAt = profile.daily.streak + GRACE_REFILL_DAYS;
          event = 'saved';
        } else {
          // Includes a negative gap — a device clock rolled backwards shouldn't
          // hand out a free streak, and shouldn't crash either.
          profile.daily.streak = 1;
          event = 'reset';
        }
      }

      if (!profile.daily.graceAvailable && profile.daily.streak >= profile.daily.graceRefillAt) {
        profile.daily.graceAvailable = true;
      }

      profile.daily.lastDay = today;
      if (profile.daily.streak > profile.daily.bestStreak) {
        profile.daily.bestStreak = profile.daily.streak;
      }

      // Local retention counters (see defaultProfile().metrics).
      const m = profile.metrics;
      m.sessions += 1;
      if (!m.firstDay) m.firstDay = today;
      if (m.playDays[m.playDays.length - 1] !== today) {
        m.playDays.push(today);
        if (m.playDays.length > PLAY_DAYS_CAP) m.playDays.splice(0, m.playDays.length - PLAY_DAYS_CAP);
      }

      // Streak bonus: scales, then caps. Capping matters — an uncapped daily
      // payout is the single easiest way to accidentally make the wallet
      // meaningless by month two.
      const bonus = Math.min(500, 100 * profile.daily.streak);
      profile.daily.claimedDay = today;
      this.credit(bonus, 'daily');
      touch();

      return { event, streak: profile.daily.streak, bonus, graceAvailable: profile.daily.graceAvailable };
    },

    // ---- daily goal --------------------------------------------------------
    // Rolls over by day key; never stores a derived "expired" flag.
    _goalToday() {
      const today = todayKey();
      const g = profile.daily.goal;
      if (g.day !== today) { g.day = today; g.done = 0; g.paid = false; }
      return g;
    },

    dailyGoal() {
      const g = this._goalToday();
      return { done: g.done, target: DAILY_GOAL_TARGET, bonus: DAILY_GOAL_BONUS, paid: g.paid };
    },

    // ---- retention read-out ------------------------------------------------
    // "Did this player come back on day N after first opening the game?"
    // Local and private; for a real cohort view the numbers would have to be
    // collected somewhere, which this build deliberately does not do.
    retentionReport() {
      const m = profile.metrics;
      const first = m.firstDay;
      const played = new Set(m.playDays);
      const plusDays = (n) => {
        if (!first) return null;
        const d = new Date(first + 'T12:00:00'); d.setDate(d.getDate() + n);
        const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0');
        return `${y}-${mo}-${da}`;
      };
      const age = first ? daysBetween(first, todayKey()) : 0;
      const ret = (n) => (age >= n ? played.has(plusDays(n)) : null); // null = too early to tell
      return {
        firstDay: first,
        ageDays: age,
        sessions: m.sessions,
        daysPlayed: played.size,
        d1: ret(1), d7: ret(7), d30: ret(30),
        firstSessionDeliveries: m.firstSessionDeliveries,
        timeToFirstDeliveryMs: m.timeToFirstDeliveryMs,
        streak: profile.daily.streak,
        bestStreak: profile.daily.bestStreak,
        graceAvailable: profile.daily.graceAvailable
      };
    },

    noteFirstDelivery(ms) {
      const v = Math.round(safeNum(ms, 0));
      if (v > 0 && !profile.metrics.timeToFirstDeliveryMs) { profile.metrics.timeToFirstDeliveryMs = v; touch(); }
    },

    dailyStreak() { return profile.daily.streak; },

    // ---- active vehicle selection -----------------------------------------
    // Guaranteed to always return an unlocked vehicle. If the profile holds
    // a corrupted, missing, or locked vehicle key, it automatically falls back
    // to the player's first unlocked starter vehicle.
    selectedVehicle() {
      if (!this.isUnlocked('vehicles', profile.selectedVehicle)) {
        profile.selectedVehicle = (profile.unlocks.vehicles && profile.unlocks.vehicles[0]) || 'cycle';
        touch();
      }
      return profile.selectedVehicle;
    },

    setSelectedVehicle(id) {
      if (this.isUnlocked('vehicles', id)) {
        profile.selectedVehicle = id;
        touch();
        return true;
      }
      return false;
    },

    defaultVehicle() {
      return (profile.unlocks.vehicles && profile.unlocks.vehicles[0]) || 'cycle';
    },

    unlocked(kind) {
      const list = profile.unlocks[kind];
      return Array.isArray(list) ? list.slice() : [];
    },

    // ---- one-time hints --------------------------------------------------
    hasSeenHint(id) { return !!(profile.hints && profile.hints[id]); },

    markHintSeen(id) {
      if (!profile.hints) profile.hints = {};
      if (profile.hints[id]) return;
      profile.hints[id] = true;
      touch();
    },

    // ---- unlocks ---------------------------------------------------------
    // The mechanism exists and is persisted; what is actually gated is a
    // design decision made in game.js, not here. Today every hub vehicle
    // ships unlocked.
    isUnlocked(kind, id) {
      const list = profile.unlocks[kind];
      return Array.isArray(list) ? list.indexOf(id) !== -1 : false;
    },

    unlock(kind, id) {
      if (!profile.unlocks[kind]) profile.unlocks[kind] = [];
      if (profile.unlocks[kind].indexOf(id) === -1) {
        profile.unlocks[kind].push(id);
        touch();
        return true;
      }
      return false;
    },

    // Buy-and-unlock in one atomic step, so a failed debit can never leave
    // the player holding an item they didn't pay for.
    purchase(kind, id, cost) {
      if (this.isUnlocked(kind, id)) return { ok: false, reason: 'owned' };
      if (!this.spend(cost)) return { ok: false, reason: 'funds', short: Math.round(cost) - profile.wallet };
      this.unlock(kind, id);
      writeNow();
      return { ok: true, wallet: profile.wallet };
    },

    // ---- maintenance -----------------------------------------------------
    flush() { return writeNow(); },

    reset() {
      profile = defaultProfile();
      dirty = true;
      writeNow();
      notify();
      return profile;
    },

    export() { return JSON.stringify(profile); },

    import(json) {
      try {
        profile = reconcile(JSON.parse(json));
        dirty = true;
        writeNow();
        notify();
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  global.ShiplypSave = Save.init();
  global.Career = global.ShiplypSave;

})(typeof window !== 'undefined' ? window : this);
