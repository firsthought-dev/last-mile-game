(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const Comic = S.Comic;
  if (!Comic) return;

  // ---------------------------------------------------------------------------
  // COMIC CALLOUTS IN THE GAME  (window.Shiplyp.Callouts)
  //
  // The game-side half of the comic work. comic.js is the kit (it draws a piece
  // on request and never reads game state); this file decides WHEN and WHAT:
  // the line pools, the order-kind x timing-band house reactions, the NPC bubble
  // manager (pins a bubble to a pedestrian's head every frame), the chase told
  // with callouts, and the banner placement. The game never pauses for any of it.
  //
  // Hooks (each is a guarded one-liner in the host file):
  //   engine-hud.js       showScoreBanner / _placeScorePopups  -> banner(), placeSlot()
  //   engine-delivery.js  _showDeliveryResult / fulfillDelivery -> dropBanner(), houseReaction()
  //                       _spendSpareParcel                     -> onMissedThrow()
  //   police.js           setStars / reportOffence / orderClockTick / openEncounter
  //   engine-core.js      district entered -> showScorePopup (already a banner)
  // Everything else (the sidewalk proximity check, chase upkeep) runs from this
  // file's own rAF loop, which does nothing unless a game is in the playing state.
  // ---------------------------------------------------------------------------

  // ---- tuning ----------------------------------------------------------------
  const T = {
    npcCooldownMs: 5000,       // quiet time after an NPC bubble ends
    npcShowMs: 2600,
    edgeShowMs: 3200,
    houseShowMs: 2900,
    redWindowMs: 60000,        // this many ms to count red-light jumps for the police-watch pool
    redWatchAt: 3,             // the 3rd jump inside the window switches pools
    sidewalkKmh: 45,           // riding faster than this past a pedestrian draws a comment
    sidewalkLateral: 3.6,      // m, sideways from the rider to the pedestrian (a rider in the kerb-side lane passes a sidewalk walker at ~2.5 m)
    patronLateral: 7.0,        // tea-stall patrons stand further back
    sidewalkAlong: 2.5,        // m, either side of the rider
    pedCoolMs: 20000,          // per pedestrian
    probeMs: 160,              // proximity / chase upkeep period
    photoSecs: 5,              // photo finish = a LATE drop with this many seconds or fewer left
    houseLift: 2.0,            // m above the drop ring: door / window height
    tauntMs: 14000,            // chase: another cop shout while the stars stay up
    crowdMs: 9000,             // chase: another crowd remark
    speedLineStars: 3          // speed lines under the HUD from this many stars
  };

  // ---- line pools ---------------------------------------------------------------
  // House reactions: kind x timing band. {item} = the order's `short` name.
  const HOUSE = {
    meal: {
      green: ['Still steaming! I could CRY!', '{item}, piping hot! You legend!', 'Hot food! HAPPY DANCE!'],
      photo: ['WHEW! I was about to eat the curtains!', 'One more second and it was FREE!'],
      yellow: ['Warm-ish. My tummy forgives you.', 'Not mad. Just HUNGRY.'],
      red: ['My {item} grew a beard waiting!', 'Lunch? This is DINNER now!', 'My stomach filed a complaint!'],
      missed: ['Too late! I already made toast.']
    },
    brew: {
      green: ['Hot {item}! My soul just woke up!', 'This fast? Are you MAGIC?'],
      photo: ['Caffeine arrived. Crisis averted!'],
      yellow: ['Lukewarm, but still love.'],
      red: ['This {item} is ICED now. Thanks?', 'I fell back asleep waiting!'],
      missed: ['I made my own. It was terrible.']
    },
    fresh: {
      green: ['So fresh it still says good morning!', 'Crisp! Cold! PERFECT!'],
      photo: ['Phew! Still fresh, just!'],
      yellow: ['Fresh enough. I\'ll allow it.'],
      red: ['Did these {item} age on the way?!', 'Fresh-ish. Heavy on the ish.'],
      missed: ['I went to the market myself. Ugh.']
    },
    sweets: {
      green: ['SWEETS! Party starts NOW!', 'Box not even dented! HERO!'],
      photo: ['Just in time! The guests are at the door!'],
      yellow: ['Guests here, sweets here. Close one!'],
      red: ['The party started without dessert!', 'Grandma is NOT impressed.'],
      missed: ['Party\'s over. So is my patience.']
    },
    news: {
      green: ['Today\'s news, still warm!', 'Headlines AND speed? Wow!'],
      photo: ['Just in time for breakfast!'],
      yellow: ['Morning news at... late morning. Fine.'],
      red: ['This news is HISTORY now!', 'I already heard it all on the radio!'],
      missed: ['I read tomorrow\'s paper instead.']
    },
    docs: {
      green: ['The papers! The meeting is SAVED!', 'Fast AND not crumpled? 10/10!'],
      photo: ['Ten seconds to the meeting! PHEW!'],
      yellow: ['On time. My lawyer approves.'],
      red: ['The deadline called. It\'s crying.'],
      missed: ['Meeting\'s over. I signed a napkin.']
    },
    tech: {
      green: ['{item}! My laptop LIVES!', 'Fast AND not dropped? HERO!'],
      photo: ['1% battery! You saved me at 1%!'],
      yellow: ['Laptop at 5%. We made it.'],
      red: ['I\'ve been staring at a black screen for an HOUR!', 'My laptop died. Rest in peace.'],
      missed: ['It\'s dead. I\'m writing on paper now.']
    },
    medical: {   // relief and thanks only
      green: ['First aid is HERE! You\'re a real hero!'],
      photo: ['Right on time. Thank you, rider!'],
      yellow: ['Got it. Thank you!'],
      red: ['Here at last! Everyone\'s okay.'],
      missed: ['We managed. Faster next time, okay?']
    },
    parcel: {    // fallback when an order has no kind
      green: ['Already?! I haven\'t found my slippers!', 'Ordered. Doorbell. Done. MAGIC?!'],
      photo: ['PHEW! Cutting it close much?'],
      yellow: ['Right on time. Not bad, not legend.'],
      red: ['Did a SNAIL bring this?!', 'FINALLY! I aged a year!'],
      missed: ['I\'ve moved on. Goodbye.']
    }
  };
  // Face by band (long-supported phone emoji). Medical keeps to relief.
  const FACE = { green: '\u{1F60D}', photo: '\u{1F605}', yellow: '\u{1F44C}', red: '\u{1F624}', missed: '\u{1F62D}' };
  const FACE_MED = { green: '\u{1F60C}', photo: '\u{1F642}', yellow: '\u{1F642}', red: '\u{1F60C}', missed: '\u{1F642}' };
  const EXTRAS = { green: ['\u{1F495}'], photo: ['\u{1F4A6}'], yellow: [], red: ['\u{1F4A8}'], missed: ['\u{1F494}'] };
  const ITEM = { meal: '\u{1F35B}', brew: '☕', fresh: '\u{1F353}', sweets: '\u{1F36C}', news: '\u{1F4F0}', docs: '\u{1F4C4}', tech: '\u{1F50B}', medical: '\u{1F48A}', parcel: '\u{1F4E6}' };

  // HUD banners (kind-neutral): the sub line of the drop banner, by band.
  const BANNER = {
    green: ['EXPRESS!', 'A rocket with a delivery bag!', 'Ordered. Doorbell. Done.'],
    photo: ['BUZZER-BEATER DELIVERY!', 'On time. Technically. Barely.', 'Photo finish! Frame that one.'],
    yellow: ['Still earned some extra!', 'Right on time!', 'Solid! Not bad at all.'],
    red: ['Late, but we\'ll take it.', 'Better late than never!'],
    missed: ['Half pay. Full lesson.', 'The clock won this round.']
  };
  const BAND_KIND = { green: 'green', photo: 'orange', yellow: 'yellow', red: 'red', missed: 'cyan' };
  const STREAK_WORD = { 3: 'HAT-TRICK!', 5: 'ON FIRE!', 10: 'UNSTOPPABLE!' };

  const NPC = {
    red: ['Red means STOP, not "go faster"!', 'Since when is red a suggestion?!', 'The zebra crossing is offended!', 'Racing to meet the police?', 'Nice! Now do it at green.'],
    redWatch: ['Again?! The cops know your name now.', 'Collecting red lights, are we?', 'Smile! The police are taking notes.'],
    sidewalk: ['Sidewalk, not a runway!', 'Was that a bike or a missile?!', 'Slow down, hotshot!', 'My hair just did a 180!', 'I felt that in my sandals!'],
    tea: ['MY TEA! You owe me a tea!', 'Half my tea is on my shirt now!'],
    sidewalkKind: {
      meal: ['Your curry is sloshing, hotshot!'],
      tech: ['Careful! That bag looks important!'],
      docs: ['Careful! That bag looks important!'],
      sweets: ['Mind the sweets! SWEETS!']
    },
    missedThrow: {
      meal: ['Lunch, meet gutter.'],
      tech: ['That\'s a hard disk, not a frisbee!'],
      docs: ['That\'s a hard disk, not a frisbee!'],
      fresh: ['Fruit salad, anyone?'],
      other: ['Butterfingers!']
    }
  };
  const CHASE = {
    edge: {
      1: ['Hey! Slow it down, speedy!', 'I saw that!'],
      2: ['PULL OVER, delivery boy!', 'Your parcel can wait, I can\'t!'],
      3: ['Stop right there, rocket!', 'I\'ve got a whistle and I\'m not afraid to use it!'],
      4: ['Backup! He\'s on a bike!', 'This is my cardio for the YEAR!'],
      5: ['GOTCHA! Pull over, NOW!']
    },
    crowd: ['Run, delivery hero, RUN!', 'Ooh, someone\'s in trouble!', 'Five stars... the BAD kind!'],
    siren: 'WEE-OO WEE-OO!',
    lost: ['Clean getaway... for now.', 'Squeaky clean record!']
  };

  // ---- helpers --------------------------------------------------------------------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => performance.now();
  const game = () => window.game || null;
  const police = () => window.ShiplypPolice || null;
  const plain = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const cap1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // Shuffled deck per pool: every line is used once before any repeats, and the
  // first line of a new deck is never the last one dealt.
  const decks = {};
  function deal(key, pool) {
    if (!pool || !pool.length) return '';
    let d = decks[key];
    if (!d) d = decks[key] = { left: [], last: null };
    if (!d.left.length) {
      const a = pool.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
      if (a.length > 1 && a[a.length - 1] === d.last) { const t = a[0]; a[0] = a[a.length - 1]; a[a.length - 1] = t; }
      d.left = a;
    }
    d.last = d.left.pop();
    return d.last;
  }

  // ---- state ---------------------------------------------------------------------------
  const st = {
    npc: null,            // the one speech bubble on screen: { api, anchor, until, ped, behindOk }
    house: null,          // the house reaction: { bubble, emoji, ref, until, size }
    lastNpcEnd: 0,
    bannerUntil: 0,
    reds: [],             // timestamps of red-light jumps
    pedCool: new WeakMap(),
    burst: null, burstCap: null, burstUntil: 0, burstRec: null,
    sirenAt: 0, sirenSide: Math.random() < 0.5 ? 'left' : 'right', siren: null,
    speed: null, under: null,
    pendingEdge: null, nextEdge: 0, nextCrowd: 0,
    lastProbe: 0, live: false
  };

  // ---- screen projection ------------------------------------------------------------------
  const _c = new THREE.Vector3();
const _a = new THREE.Vector3();
  function size() {
    const l = Comic.layer();
    return { W: l.clientWidth || window.innerWidth, H: l.clientHeight || window.innerHeight };
  }
  // World point -> container pixels. `behind` = on the far side of the camera;
  // the x/y then point to the side it is on, so a clamped bubble still leans that way.
  function project(g, x, y, z, sz) {
    const cam = g.camera;
    _c.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
    const behind = _c.z > -0.05;
    _c.applyMatrix4(cam.projectionMatrix);
    if (behind) return { x: _c.x < 0 ? sz.W + 90 : -90, y: sz.H * 0.5, behind: true, on: false, near: false };
    const px = (_c.x * 0.5 + 0.5) * sz.W, py = (-_c.y * 0.5 + 0.5) * sz.H;
    // on = inside the frame; near = in front of the camera and not far outside it: on a portrait phone a
    // walker 5 m to the side is outside the narrow view, and a bubble hugging that screen edge still reads
    return { x: px, y: py, behind: false, on: px > sz.W * 0.06 && px < sz.W * 0.94 && py > sz.H * 0.12 && py < sz.H * 0.9, near: px > -sz.W * 0.3 && px < sz.W * 1.3 && py > sz.H * 0.08 && py < sz.H * 0.95 };
  }
  function treeVisible(o) { while (o) { if (o.visible === false) return false; o = o.parent; } return true; }

  // Head height of a pedestrian root, measured once from its bounding box and
  // cached (the Phase 0 build merges a person into one skinned mesh, so never
  // look for child meshes by name).
  const heights = new WeakMap();
  function headHeight(obj) {
    let h = heights.get(obj);
    if (h) return h;
    h = 1.9;
    try {
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      if (!box.isEmpty()) {
        const m = obj.matrixWorld.elements;
        const hh = box.max.y - m[13];
        if (hh > 1.0 && hh < 3.0) h = hh + 0.12;
      }
    } catch (e) { /* keep default */ }
    heights.set(obj, h);
    return h;
  }
  function headAnchor(obj) {
    const h = headHeight(obj);
    return (out) => { const m = obj.matrixWorld.elements; return out.set(m[12], m[13] + h, m[14]); };
  }

  // ---- gates ------------------------------------------------------------------------------
  function onboarding(g) { return !!(g && g._onboardingActive); }
  function houseActive(t) { return !!(st.house && t < st.house.until); }
  function slotFree(t) { return !st.npc && !houseActive(t); }
  // NPC bubble rules: one at a time, a cooldown, none while a banner or house
  // reaction shows, none during the first-delivery onboarding.
  function npcOk(g, t) {
    return !onboarding(g) && slotFree(t) && t >= st.bannerUntil && t - st.lastNpcEnd >= T.npcCooldownMs && !(police() && police().isPaused());
  }

  // ---- screen tier ----------------------------------------------------------------------------
  // Sized by height and aspect ratio as well as width: a 667 px tall phone and a landscape phone
  // are tight whatever their width. (The banner's CSS size follows the same split in style.css.)
  //   phone   : the short side is under 520 px
  //   land    : landscape and under 600 px tall (a phone on its side)
  //   short   : under 700 px tall
  //   compact : land or short (house reactions shrink to a very short line)
  function tier(sz) {
    sz = sz || size();
    const land = sz.W > sz.H && sz.H < 600;
    const short = sz.H < 700;
    return { W: sz.W, H: sz.H, phone: Math.min(sz.W, sz.H) < 520, land, short, compact: land || short };
  }

  // ---- the protected zone -----------------------------------------------------------------------
  // The rider, the road ahead of the rider (about the middle 40% of the width, from the rider up to
  // the horizon) and the road radar are never covered by a callout. Neither is the HUD (capsules,
  // chips, touch controls, the notification) or another callout. Every callout asks for a clear
  // spot with findSpot() and shrinks, takes a smaller form or is dropped when there is none.
  const HUD_SEL = ['#slowroads-radar-box', '.telemetry-digits-box', '.telemetry-controls-col', '.slowroads-top-bar', '.touch-btn', '#touch-tools-drawer', '#onboarding-hint', '#police-wanted.on',
    '#delivery-mission-capsule', '#drop-action-prompt', '.slowroads-dock', '#notification-panel .notification-item'];
  const _bx = new THREE.Box3();
  const _bp = new THREE.Vector3();
  function vehicleRect(g, sz) {
    const m = g.vehicle && g.vehicle.mesh, cam = g.camera;
    if (!m || !cam) return null;
    m.updateMatrixWorld(true);
    _bx.setFromObject(m);
    if (_bx.isEmpty()) return null;
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (let i = 0; i < 8; i++) {
      _bp.set(i & 1 ? _bx.max.x : _bx.min.x, i & 2 ? _bx.max.y : _bx.min.y, i & 4 ? _bx.max.z : _bx.min.z).applyMatrix4(cam.matrixWorldInverse);
      if (_bp.z > -0.05) continue;
      _bp.applyMatrix4(cam.projectionMatrix);
      const x = (_bp.x * 0.5 + 0.5) * sz.W, y = (-_bp.y * 0.5 + 0.5) * sz.H;
      if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y;
    }
    return r > l ? { l: Math.max(0, l), t: Math.max(0, t), r: Math.min(sz.W, r), b: Math.min(sz.H, b) } : null;
  }
  function visRect(e, base, anyOpacity) {   // anyOpacity: a piece that is about to fade in still counts
    const q = e.getBoundingClientRect();
    if (!q.width || !q.height) return null;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || (!anyOpacity && parseFloat(cs.opacity) < 0.05)) return null;
    return { l: q.left - base.left, t: q.top - base.top, r: q.right - base.left, b: q.bottom - base.top };
  }
  // The fixed part of the zone: rider, road ahead, HUD. `skipNote` leaves out the notification (when it is the one being placed).
  function staticZone(g, sz, skipNote) {
    const out = [];
    const base = Comic.layer().getBoundingClientRect();
    const v = g ? vehicleRect(g, sz) : null;
    if (v) {
      out.push({ l: v.l - 8, t: v.t - 8, r: v.r + 8, b: v.b + 8 });
      const cTop = sz.H * 0.35;
      if (v.t > cTop + 4) out.push({ l: sz.W * 0.3, t: cTop, r: sz.W * 0.7, b: v.t });
    }
    for (let i = 0; i < HUD_SEL.length; i++) {
      if (skipNote && HUD_SEL[i].indexOf('notification') >= 0) continue;
      const list = document.querySelectorAll(HUD_SEL[i]);
      for (let k = 0; k < list.length; k++) { const r = visRect(list[k], base, HUD_SEL[i].indexOf('notification') >= 0); if (r) out.push(r); }
    }
    // the star chip fades in just after the callouts for a new star are placed: count it as soon as there is a star
    const chip = document.getElementById('police-wanted');
    if (chip && police() && police().stars() > 0 && !chip.classList.contains('on')) { const r = visRect(chip, base, true); if (r) out.push(r); }
    return out;
  }
  // Everything a new callout has to stay clear of. `except` = the piece being placed (its own rect never blocks it).
  function zone(g, sz, except, skipNote) {
    const out = staticZone(g, sz, skipNote);
    for (let i = 0; i < live.length; i++) if (live[i] !== except && live[i].rect) out.push(live[i].rect);
    return out;
  }
  let zoneAt = 0, zoneList = null;
  function cachedZone(g, sz, except) {   // per-frame callers (pinned bubbles): the static part is re-measured every 120 ms
    const t = now();
    if (!zoneList || t - zoneAt > 120) { zoneList = staticZone(g, sz, false); zoneAt = t; }
    const out = zoneList.slice();
    for (let i = 0; i < live.length; i++) if (live[i] !== except && live[i].rect) out.push(live[i].rect);
    return out;
  }
  const hits = (a, list, pad) => {
    pad = pad == null ? 2 : pad;
    for (let i = 0; i < list.length; i++) { const q = list[i]; if (a.l < q.r + pad && a.r > q.l - pad && a.t < q.b + pad && a.b > q.t - pad) return true; }
    return false;
  };
  // Nearest clear w x h box to `want` (centre) or, without one, the highest. Scans a grid; null when nothing fits.
  function findSpot(w, h, blocked, o) {
    o = o || {};
    const m = o.margin != null ? o.margin : 8;
    const R = o.region || { l: m, t: m, r: size().W - m, b: size().H - m };
    const step = 8;
    let best = null, bestC = 1e18;
    const ls = [];
    for (let l = R.l; l + w <= R.r; l += step) ls.push(l);
    if (R.r - w >= R.l) ls.push(R.r - w);
    for (let t = R.t; t + h <= R.b; t += step) {
      for (let i = 0; i < ls.length; i++) {
        const l = ls[i];
        if (hits({ l, t, r: l + w, b: t + h }, blocked, 3)) continue;
        const c = o.want ? Math.hypot(l + w / 2 - o.want.x, t + h / 2 - o.want.y) : t;
        if (c < bestC) { bestC = c; best = { l, t }; }
      }
    }
    return best;
  }

  // ---- what is on screen: at most two callouts, house reaction > banner > chase > NPC bubble -------
  // A callout that is made of several drawn pieces (a house reaction = emoji + bubble) counts as one.
  const live = [];
  const PRIO = { house: 4, banner: 3, chase: 2, npc: 1 };
  function release(rec) { const i = live.indexOf(rec); if (i >= 0) live.splice(i, 1); }
  function admit(kind, name, until, drop) {
    const t = now();
    for (let i = live.length - 1; i >= 0; i--) if (live[i].until <= t) live.splice(i, 1);
    for (let i = live.length - 1; i >= 0; i--) if (live[i].name === name) live[i].drop();
    while (live.length >= 2) {
      let low = live[0];
      for (let i = 1; i < live.length; i++) if (live[i].prio < low.prio) low = live[i];
      if (low.prio >= PRIO[kind]) return null;
      low.drop();
    }
    const rec = { kind, name, prio: PRIO[kind], until, rect: null, drop: null };
    rec.drop = () => { release(rec); try { drop(); } catch (e) { /* already gone */ } };
    live.push(rec);
    return rec;
  }

  // ---- banners ----------------------------------------------------------------------------
  // One banner at a time: the newest replaces the one showing. It is sized by screen (CSS --cb-k),
  // placed in the clear spot nearest the top right, and shrinks (then loses its sub line) before it
  // would cover the rider, the road or the map; with no clear spot it is dropped.
  let cur = null;   // { rec, api, baseK }
  function fit(root, sz) {
    const title = root.querySelector('.comic-banner-title');
    const sub = root.querySelector('.comic-banner-sub');
    if (!title) return;
    const ml = parseFloat(getComputedStyle(root).marginLeft) || 0;
    const room = sz.W - 16 - ml - 14;   // 14 = skew + shadow
    let tries = 0;
    while (tries++ < 6 && root.offsetWidth > room) {
      const fs = parseFloat(getComputedStyle(title).fontSize) * 0.9;
      root.style.setProperty('--cb-fs', fs.toFixed(1) + 'px');
      if (sub) sub.style.letterSpacing = '0.03em';
    }
  }
  const BANNER_STEPS = [{ k: 1 }, { k: 0.82 }, { k: 0.68 }, { k: 0.68, mini: true }, { k: 0.52, mini: true }];
  function placeBanner() {
    const b = cur;
    if (!b || !b.api.el.isConnected) return;
    const root = b.api.el, slot = b.slot;
    const g = game(), sz = size(), T_ = tier(sz);
    const blocked = zone(g, sz, b.rec);
    for (let i = 0; i < BANNER_STEPS.length; i++) {
      const s = BANNER_STEPS[i];
      root.style.setProperty('--cb-k', (b.baseK * s.k).toFixed(3));
      root.style.removeProperty('--cb-fs');
      root.classList.toggle('comic-banner--mini', !!s.mini);
      fit(root, sz);
      const k = b.baseK * s.k;
      const ml = parseFloat(getComputedStyle(root).marginLeft) || 0;
      const w = ml + root.offsetWidth + 12, h = Math.max(root.offsetHeight, 100 * k) + 12;
      const want = { x: sz.W - 12 - w / 2, y: (T_.phone ? Math.max(120, sz.H * 0.16) : 70) + h / 2 };
      const spot = findSpot(w, h, blocked, { want });
      if (!spot) continue;
      slot.style.right = 'auto';
      slot.style.left = Math.round(spot.l) + 'px';
      slot.style.top = Math.round(spot.t + 6 + (h - 12 - root.offsetHeight) / 2) + 'px';
      b.rec.rect = { l: spot.l, t: spot.t, r: spot.l + w, b: spot.t + h };
      return;
    }
    b.rec.drop();   // nowhere clear on this screen right now
  }
  const NO_API = { el: null, dismiss() {}, get done() { return true; } };
  function banner(opts) {
    const o = Object.assign({}, opts, { title: plain(opts.title), sub: opts.sub ? plain(opts.sub) : opts.sub });
    if (o.delay > 0) {   // a delayed banner takes the slot when its time comes, not before
      const d = o.delay; delete o.delay;
      setTimeout(() => banner(o), d);
      return NO_API;
    }
    const t = now();
    const dur = o.duration === 0 ? 2600 : (o.duration || 2600);
    let api = null;
    const rec = admit('banner', 'banner', t + dur + 300, () => { if (api) api.dismiss(); if (cur && cur.rec === rec) cur = null; });
    if (!rec) return NO_API;
    // each banner gets its own slot, so one still fading out is not dragged along when the next is placed
    const slot = document.createElement('div');
    slot.className = 'comic-banner-slot';
    slot.style.right = 'auto';
    Comic.layer().appendChild(slot);
    setTimeout(() => { if (slot.parentNode) slot.parentNode.removeChild(slot); }, dur + 900);
    api = Comic.banner(Object.assign({}, o, { max: 1, container: slot }));
    cur = { rec, api, slot, baseK: parseFloat(getComputedStyle(api.el).getPropertyValue('--cb-k')) || 1 };
    st.live = true;
    st.bannerUntil = Math.max(st.bannerUntil, t + dur);
    placeBanner();
    return api;
  }
  function placeSlot() { placeBanner(); }

  // ---- notifications ----------------------------------------------------------------------
  // addNotification() keeps one item. Its slot (a row in the top middle, set by the HUD layout in style.css) is clear of the
  // rider, the road ahead, the map and every other HUD piece by construction. This only double-checks that on this screen and,
  // if the slot is taken (an odd window), narrows the panel and moves it to the nearest clear spot, or hides the notice.
  function placeNote() {
    const panel = document.getElementById('notification-panel');
    if (!panel || !panel.querySelector('.notification-item')) return;
    const g = game(), sz = size(), base = Comic.layer().getBoundingClientRect();
    panel.style.left = panel.style.top = panel.style.bottom = panel.style.right = panel.style.margin = panel.style.width = '';
    panel.style.visibility = '';
    const blocked = zone(g, sz, null, true);
    const slot = panel.getBoundingClientRect();
    const item = panel.querySelector('.notification-item').getBoundingClientRect();
    const mine = { l: item.left - base.left, t: item.top - base.top, r: item.right - base.left, b: item.bottom - base.top };
    if (!hits(mine, blocked, 0)) return true;
    const tries = [1, 0.8, 0.65, 0.5, 0.4];
    for (let i = 0; i < tries.length; i++) {
      const w0 = Math.max(110, Math.round(slot.width * tries[i]));
      panel.style.width = w0 + 'px';
      const q = panel.getBoundingClientRect();
      const w = q.width + 6, h = q.height + 6;
      const spot = findSpot(w, h, blocked, { want: { x: slot.left - base.left + slot.width / 2, y: slot.top - base.top + h / 2 } });
      if (!spot) continue;
      panel.style.margin = '0';
      panel.style.right = 'auto';
      panel.style.left = Math.round(spot.l + base.left + 3) + 'px';
      panel.style.top = Math.round(spot.t + base.top + 3) + 'px';
      return true;
    }
    panel.style.width = '';
    panel.style.visibility = 'hidden';   // no clear spot on this screen right now: a notice is lost before the rider is covered
    return false;
  }

  // ---- delivery: banner + house reaction ---------------------------------------------------
  function bandOf(ratio, secs, missed) {
    if (missed) return 'missed';
    if (ratio > 0.55) return 'green';
    if (ratio > 0.25) return 'yellow';
    return secs <= T.photoSecs ? 'photo' : 'red';
  }
  const money = (n) => Math.round(n).toLocaleString('en-IN');

  // The one banner of a drop: amount, streak on the burst, delivery number and a
  // band line (or the streak word on a milestone). Replaces the old result card
  // and the "DELIVERY #n COMPLETE" notification. Returns true when it drew.
  function dropBanner(g, d) {
    const band = bandOf(d.timeLeftRatio, d.timeLeftRatio * (g.maxOrderTimer || 0), d.missed);
    const word = !d.missed && STREAK_WORD[d.streak];
    const line = word || deal('b:' + band, BANNER[band]);
    banner({
      title: '+₹' + money(d.earnedBonus) + ' DROP!',
      sub: '#' + g.deliveriesMade + ' · ' + line,
      kind: BAND_KIND[band],
      burst: d.streak >= 2 ? d.streak + 'x' : '★',
      key: 'drop', duration: 3000
    });
    return true;
  }

  function endHouse() {
    const h = st.house;
    if (!h) return;
    st.house = null;
    release(h.rec);
    if (h.bubble) h.bubble.dismiss();
    h.emoji.dismiss();
  }
  // Very short lines for short screens and landscape, where a full line would not fit clear of the rider.
  const SHORT = { green: 'YAY!', photo: 'PHEW!', yellow: 'OK!', red: 'FINALLY!', missed: 'TOO LATE!' };
  function houseReaction(g, d) {
    if (!g || !g.camera || !d.target || !d.target.pos) return;
    const order = d.target.order || {};
    const kind = HOUSE[order.kind] ? order.kind : 'parcel';
    const band = bandOf(d.timeLeftRatio, d.timeLeftRatio * (g.maxOrderTimer || 0), d.missed);
    const text = cap1(deal('h:' + kind + ':' + band, HOUSE[kind][band]).replace('{item}', order.short || 'order'));
    endHouse();
    if (st.npc) { st.npc.api.dismiss(); st.npc = null; }
    const sz = size(), T_ = tier(sz);
    const t = now();
    const rec = admit('house', 'house', t + T.houseShowMs + 300, endHouse);
    if (!rec) return;
    // the house reaction has first pick of the clear space: the banner (placed a moment ago) steps aside and is placed again after
    if (cur) cur.rec.rect = null;
    const blocked = zone(g, sz, rec);
    const ref = d.target.pos;
    const pr = project(g, ref.x, ref.y + T.houseLift, ref.z, sz);
    const want = T_.phone ? { x: sz.W * 0.5, y: sz.H * 0.14 } : { x: clamp(pr.x, 0, sz.W), y: clamp(pr.y, 0, sz.H) };
    const face = (kind === 'medical' ? FACE_MED : FACE)[band];
    const tries = [];
    if (!T_.compact) {
      if (T_.phone) tries.push({ px: 44, mw: 112, text }, { px: 44, mw: 92, text });
      else tries.push({ px: 84, mw: 230, text }, { px: 72, mw: 190, text });
    }
    tries.push({ px: T_.phone ? 44 : 64, mw: 100, text: SHORT[band] });
    tries.push({ px: T_.phone ? 44 : 64 }, { px: 34 });   // emoji only
    for (let i = 0; i < tries.length; i++) {
      const a = tries[i];
      let bubble = null, w = a.px + 16, h = a.px + 16, bh = 0;
      if (a.text) {
        bubble = Comic.bubble({ text: a.text, size: T_.phone ? 'sm' : 'md', maxWidth: a.mw, silent: true, duration: T.houseShowMs, group: 'house' });
        bubble.hide();
        const bs = bubble.size();
        bh = bs.h;
        w = Math.max(bs.w, a.px) + 10; h = bh + 30 + a.px + 10;
      }
      const spot = findSpot(w, h, blocked, { want, margin: 10 });
      if (!spot) { if (bubble) bubble.destroy(); continue; }
      const ex = spot.l + w / 2, ey = bubble ? spot.t + bh + 30 + a.px / 2 : spot.t + h / 2;
      const emoji = Comic.emojiBurst({
        face, item: ITEM[kind], extras: kind === 'medical' || a.px < 60 ? [] : EXTRAS[band],
        mood: band, size: a.px, x: ex, y: ey, duration: T.houseShowMs, label: text, group: 'house'
      });
      if (bubble) { bubble.updatePosition(ex, ey - a.px / 2 - 4, { width: sz.W, height: sz.H }); bubble.show(); }
      rec.rect = { l: spot.l, t: spot.t, r: spot.l + w, b: spot.t + h };
      st.house = { bubble, emoji, until: t + T.houseShowMs, px: a.px, rec };
      st.live = true;
      placeBanner();
      return;
    }
    rec.drop();   // not even the emoji fits clear of the rider on this screen
    placeBanner();
  }

  // ---- NPC bubbles ----------------------------------------------------------------------------
  function say(g, text, anchor, opts) {
    opts = opts || {};
    const sz = size(), T_ = tier(sz);
    const first = new THREE.Vector3();
    const p = anchor(first);
    if (!p) return false;
    const pr = project(g, p.x, p.y, p.z, sz);
    if (pr.behind) return false;
    const until = now() + (opts.ms || T.npcShowMs);
    const rec = admit('npc', 'npc', until + 300, () => {
      if (st.npc && st.npc.rec === rec) { const n = st.npc; st.npc = null; n.api.dismiss(); st.lastNpcEnd = now(); }
    });
    if (!rec) return false;
    const api = Comic.bubble({ text, size: T_.phone ? 'sm' : 'md', maxWidth: T_.phone ? 120 : 230, x: pr.x, y: pr.y, duration: 0 });
    st.npc = { api, anchor, until, obj: opts.obj || null, side: 'above', rec };
    st.live = true;
    return true;
  }
  function endNpc(t) {
    const n = st.npc;
    if (!n) return;
    st.npc = null;
    release(n.rec);
    n.api.dismiss();
    st.lastNpcEnd = t;
  }
  // Pedestrian roots in the world (kind 'pedestrian'); visible and on screen only.
  function eachPed(g, fn) {
    const list = g.world && g.world.crossers;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.kind !== 'pedestrian' || c.struck || !c.mesh || !treeVisible(c.mesh)) continue;
      fn(c);
    }
  }
  // Nearest on-screen pedestrian to the rider; `prefer` = a crossing the person is waiting at.
  function pickPed(g, crossing) {
    const sz = size();
    const vp = g.vehicle.mesh.position;
    const tmp = new THREE.Vector3();
    let best = null, bestD = 1e9;
    eachPed(g, (c) => {
      const m = c.mesh.matrixWorld.elements;
      const dx = m[12] - vp.x, dz = m[14] - vp.z;
      let d = dx * dx + dz * dz;
      if (d > 45 * 45) return;
      if (crossing && c.wander && c.wander.crossing === crossing) d *= 0.25;   // the people at THIS crossing first
      if (d >= bestD) return;
      const pr = project(g, m[12], m[13] + headHeight(c.mesh), m[14], sz);
      if (!pr.near) return;
      best = c; bestD = d;
    });
    return best;
  }

  function pedSay(g, c, text) {
    if (!say(g, text, headAnchor(c.mesh), { obj: c.mesh })) return false;
    st.pedCool.set(c, now() + T.pedCoolMs);
    return true;
  }
  function kindOfActive(g) {
    const orders = (S.CONFIG && S.CONFIG.ORDERS_BY_CITY && (S.CONFIG.ORDERS_BY_CITY[g.selectedCity] || S.CONFIG.ORDERS_BY_CITY.mumbai)) || [];
    const o = orders.length ? orders[(g.activeOrderIndex || 0) % orders.length] : null;
    return (o && o.kind) || 'parcel';
  }

  // police.js reportOffence -> here. A red-light jump gets a bubble from a person
  // standing at that crossing; with nobody on screen, a small banner instead.
  function onOffence(type, crossing) {
    if (type !== 'redLight') return;
    const g = game(); if (!g || g.gameState !== 'playing' || !g.vehicle || !g.camera) return;
    const t = now();
    st.reds = st.reds.filter((x) => t - x < T.redWindowMs);
    st.reds.push(t);
    if (!npcOk(g, t)) return;
    const text = st.reds.length >= T.redWatchAt ? deal('n:redWatch', NPC.redWatch) : deal('n:red', NPC.red);
    // The star burst that just fired already holds the callout slots; the bystander's line is the point of
    // a red-light jump, so it takes the place of the siren word (the WANTED burst stays).
    for (const r of live.slice()) if (r.name === 'siren') r.drop();
    const c = pickPed(g, crossing);
    if (c && pedSay(g, c, text)) return;
    banner({ title: 'RED LIGHT!', sub: text, kind: 'orange', burst: '!', duration: 2600, key: 'red' });
    st.lastNpcEnd = t;
  }
  function onMissedThrow(g) {
    if (!g || g.gameState !== 'playing' || !g.camera) return;
    const t = now();
    if (!npcOk(g, t)) return;
    const kind = kindOfActive(g);
    const pool = NPC.missedThrow[kind] || NPC.missedThrow.other;
    const c = pickPed(g, null);
    if (c) pedSay(g, c, deal('n:throw:' + (NPC.missedThrow[kind] ? kind : 'other'), pool));
  }

  // Riding fast past someone on the sidewalk (and tea-stall patrons): callout only,
  // never a wanted star (B144).
  const _f = new THREE.Vector3();
  function probe(g, t) {
    const v = g.vehicle;
    if (!v || !v.mesh || !g.world) return;
    if (Math.abs(v.speed || 0) * 3.6 < T.sidewalkKmh) return;
    if (!npcOk(g, t)) return;
    _f.set(0, 0, 1).applyQuaternion(v.mesh.quaternion);
    const fx = _f.x, fz = _f.z;
    const vp = v.mesh.position;
    const grid = g.world.roadSpatialGrid;
    const half = (S.CONFIG && S.CONFIG.ROAD_WIDTH ? S.CONFIG.ROAD_WIDTH : 7.4) * 0.5 + 0.3;
    let best = null, bestLat = 1e9, tea = false;
    const consider = (obj, key, maxLat, isTea, cooldownOwner) => {
      const m = obj.matrixWorld.elements;
      const dx = m[12] - vp.x, dz = m[14] - vp.z;
      if (dx * dx + dz * dz > 100) return;
      const along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
      if (lat > maxLat || Math.abs(along) > T.sidewalkAlong || lat >= bestLat) return;
      if ((st.pedCool.get(cooldownOwner) || 0) > t) return;
      if (grid && !isTea) {      // on the sidewalk, not crossing the carriageway
        const near = grid.getNearestRoadPoint(m[12], m[14], 8.0);
        if (near && near.point && Math.hypot(m[12] - near.point.x, m[14] - near.point.z) < half) return;
      }
      best = { obj, key: cooldownOwner }; bestLat = lat; tea = isTea;
    };
    eachPed(g, (c) => consider(c.mesh, c, T.sidewalkLateral, false, c));
    const pat = g.world.patrons;
    if (pat) for (let i = 0; i < pat.length; i++) { const p = pat[i]; if (p.obj && treeVisible(p.obj)) consider(p.obj, p, T.patronLateral, true, p); }
    if (!best) return;
    const sz = size();
    const m = best.obj.matrixWorld.elements;
    if (!project(g, m[12], m[13] + headHeight(best.obj), m[14], sz).near) return;
    let pool = tea ? NPC.tea : NPC.sidewalk;
    let key = tea ? 'n:tea' : 'n:side';
    const kv = !tea && NPC.sidewalkKind[kindOfActive(g)];
    if (kv && Math.random() < 0.3) { pool = kv; key = 'n:side:' + kindOfActive(g); }
    if (say(g, deal(key, pool), headAnchor(best.obj), { obj: best.obj })) st.pedCool.set(best.key, t + T.pedCoolMs);
  }

  // ---- the chase ------------------------------------------------------------------------------
  function underLayer() {
    if (st.under && st.under.isConnected) return st.under;
    const app = document.getElementById('game-app') || document.body;
    const d = document.createElement('div');
    d.id = 'comic-under';
    d.className = 'comic-layer comic-layer--under';
    const hud = document.getElementById('in-game-hud');
    if (hud && hud.parentNode === app) app.insertBefore(d, hud); else app.appendChild(d);
    st.under = d;
    return d;
  }
  function hideBurst() {
    if (st.burst) { st.burst.dismiss(); st.burst = null; }
    if (st.burstCap) { st.burstCap.dismiss(); st.burstCap = null; }
    if (st.burstRec) { release(st.burstRec); st.burstRec = null; }
  }
  function hideSpeed() { if (st.speed) { st.speed.dismiss(); st.speed = null; } }
  function sirenSfx(g, sz) {
    const t = now();
    if (t - st.sirenAt < 1500) return;
    const T_ = tier(sz);
    const side = st.sirenSide === 'left' ? 'right' : 'left';
    const rec = admit('chase', 'siren', t + 2400, () => { const s = st.siren; if (s) { s.dismiss(); st.siren = null; } });
    if (!rec) return;
    st.sirenAt = t;
    st.sirenSide = side;
    const word = Comic.sfx({ text: CHASE.siren, color: 'siren', from: side, x: sz.W / 2, y: sz.H / 2, scale: 1, rotate: side === 'left' ? -6 : 6 });
    const ow = word.el.offsetWidth || 300, oh = word.el.offsetHeight || 60;
    const scales = T_.phone ? [0.5, 0.42, 0.34] : [1, 0.8, 0.62, 0.5, 0.4];
    const blocked = zone(g, sz, rec);
    const want = { x: sz.W * (side === 'left' ? 0.18 : 0.82), y: sz.H * 0.5 };
    for (let i = 0; i < scales.length; i++) {
      const w = ow * scales[i] * 1.12 + 16, h = oh * scales[i] * 1.12 + 14;
      const spot = findSpot(w, h, blocked, { want });
      if (!spot) continue;
      word.el.style.setProperty('--sc', String(scales[i]));
      word.el.style.left = Math.round(spot.l + w / 2) + 'px';
      word.el.style.top = Math.round(spot.t + h / 2) + 'px';
      rec.rect = { l: spot.l, t: spot.t, r: spot.l + w, b: spot.t + h };
      st.siren = word;
      const s = word;
      setTimeout(() => { s.dismiss(); if (st.siren === s) { st.siren = null; release(rec); } }, 2200);
      return;
    }
    word.dismiss();
    release(rec);
  }
  function edgeSay(g, stars, t) {
    const sz = size(), T_ = tier(sz);
    if (T_.land) return;   // landscape phones: only the badge and the siren word
    const text = deal('c:edge' + stars, CHASE.edge[clamp(stars, 1, 5)]);
    const until = t + T.edgeShowMs;
    const rec = admit('chase', 'edge', until + 300, () => {
      if (st.npc && st.npc.rec === rec) { const n = st.npc; st.npc = null; n.api.dismiss(); }
    });
    if (!rec) return;
    st.nextEdge = t + T.tauntMs;
    const api = Comic.bubble({ edge: st.sirenSide, text, size: T_.phone ? 'sm' : 'md', y: sz.H * 0.3, maxWidth: T_.phone ? 120 : 210, duration: 0 });
    const u = { width: sz.W, height: sz.H };
    const blocked = zone(g, sz, rec);
    const pref = sz.H * 0.3;
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) api.setMaxWidth(90);
      const ys = [];
      for (let y = sz.H * 0.12; y <= sz.H * 0.5; y += 8) ys.push(y);
      ys.sort((a, b) => Math.abs(a - pref) - Math.abs(b - pref));
      for (let i = 0; i < ys.length; i++) {
        const r = api.edgeRect(ys[i], u);
        if (hits(r, blocked, 3)) continue;
        api.updateEdge(ys[i], u);
        rec.rect = r;
        st.npc = { api, anchor: null, until, rec };
        st.live = true;
        return;
      }
    }
    api.destroy();
    release(rec);
  }

  // police.js setStars -> here. A star gained puts a small WANTED badge beside the star chip (and, on big
  // screens with room, the offence as a caption), then the siren word. The chip itself keeps showing the level.
  function badgeSpot(g, sz, size0, rec) {
    const chip = document.getElementById('police-wanted');
    const base = Comic.layer().getBoundingClientRect();
    const q = chip ? chip.getBoundingClientRect() : null;
    const c = q && q.width ? { l: q.left - base.left, t: q.top - base.top, r: q.right - base.left, b: q.bottom - base.top } : { l: sz.W - 190, t: 56, r: sz.W - 16, b: 96 };
    const blocked = zone(g, sz, rec); blocked.push(c);
    const onRight = (c.l + c.r) / 2 > sz.W / 2;
    const sizes = [size0, size0 * 0.82, size0 * 0.66];
    for (let i = 0; i < sizes.length; i++) {
      const w = sizes[i] + 14, h = sizes[i] * 0.86 + 14;
      const want = { x: onRight ? c.l - w / 2 - 6 : c.r + w / 2 + 6, y: (c.t + c.b) / 2 + (i ? h * 0.3 : 0) };
      const spot = findSpot(w, h, blocked, { want });
      if (spot) return { size: sizes[i], x: spot.l + w / 2, y: spot.t + h / 2, rect: { l: spot.l, t: spot.t, r: spot.l + w, b: spot.t + h } };
    }
    return null;
  }
  function onStars(prev, stars, reason) {
    const g = game();
    if (!g || g.gameState !== 'playing' || !g.camera) return;
    const t = now();
    const sz = size(), T_ = tier(sz);
    if (stars > prev) {
      if (st.burst) { st.burst.setStars(stars); st.burstUntil = t + 3300; if (st.burstRec) st.burstRec.until = t + 3600; }
      else {
        const rec = admit('chase', 'wanted', t + 3600, hideBurst);
        if (rec) {
          const size0 = T_.phone ? 72 : sz.W >= 1000 ? 120 : 96;
          const spot = badgeSpot(g, sz, size0, rec);
          if (spot) {
            st.burst = Comic.wanted({ stars, x: spot.x, y: spot.y, size: spot.size, group: 'wanted' });
            st.burstRec = rec;
            rec.rect = spot.rect;
            st.burstUntil = t + 3300;
            if (reason && !T_.phone && !T_.compact) {   // the offence line, only where there is room for it
              const cap = Comic.caption(reason, { kind: 'paper', x: 0, y: 0, tilt: 1, silent: true, group: 'wanted' });
              const w = cap.el.offsetWidth + 16, h = cap.el.offsetHeight + 14;
              const cs = findSpot(w, h, zone(g, sz, null), { want: { x: spot.x, y: spot.rect.b + h / 2 + 4 } });
              if (cs) { cap.el.style.left = Math.round(cs.l + 4) + 'px'; cap.el.style.top = Math.round(cs.t + 4) + 'px'; st.burstCap = cap; rec.rect = { l: Math.min(spot.rect.l, cs.l), t: spot.rect.t, r: Math.max(spot.rect.r, cs.l + w), b: Math.max(spot.rect.b, cs.t + h) }; }
              else cap.dismiss();
            }
          } else rec.drop();
        }
      }
      st.live = true;
      sirenSfx(g, sz);
      st.pendingEdge = { at: t + (stars >= 5 ? 0 : 1500), stars, until: t + 5500 };
      st.nextCrowd = Math.max(st.nextCrowd, t + 4500);
    } else if (stars === 0 && prev > 0 && !(police() && police().isPaused())) {
      hideBurst(); hideSpeed();
      if (st.siren) { st.siren.dismiss(); st.siren = null; }
      st.pendingEdge = null;
      banner({ title: "LOST 'EM!", sub: deal('c:lost', CHASE.lost), kind: 'green', burst: '★', key: 'lost', duration: 2800 });
    } else if (stars > 0 && st.burst) {
      st.burst.setStars(stars);
    }
  }

  function chaseTick(g, t) {
    const P = police();
    const stars = P ? P.stars() : 0;
    if (P && P.isPaused()) {          // the settle-up box owns the screen
      hideBurst(); hideSpeed();
      st.pendingEdge = null;
      return;
    }
    if (st.burst && t > st.burstUntil) hideBurst();
    if (stars >= T.speedLineStars && !st.speed) {
      st.speed = Comic.speedLines(underLayer(), { cx: 0.5, cy: 0.58, count: 56, inner: 0.34, alpha: 0.5 });
    } else if (stars < T.speedLineStars && st.speed) hideSpeed();
    if (stars < 1) { st.pendingEdge = null; return; }
    const pe = st.pendingEdge;
    if (pe && t >= pe.at) {
      if (t > pe.until) st.pendingEdge = null;
      else if (slotFree(t) && !onboarding(g)) { edgeSay(g, Math.max(stars, 1), t); if (st.npc) st.pendingEdge = null; }
    }
    if (stars >= 2 && !st.pendingEdge) {
      if (t >= st.nextEdge && slotFree(t) && !onboarding(g)) edgeSay(g, stars, t);
      else if (t >= st.nextCrowd && npcOk(g, t) && !tier().land) {
        const c = pickPed(g, null);
        st.nextCrowd = t + T.crowdMs * (0.8 + Math.random() * 0.4);
        if (c) pedSay(g, c, deal('c:crowd', CHASE.crowd));
      }
    }
  }

  // police.js openEncounter -> here: the settle-up box gets its sound word.
  function onEncounter(wrap, where) {
    if (!wrap) return;
    st.pendingEdge = null;
    if (st.npc) { release(st.npc.rec); st.npc.api.dismiss(); st.npc = null; }
    try {
      const w = window.innerWidth;
      const word = Comic.sfx({ container: wrap, text: where === 'caught' ? 'GOTCHA!' : 'TWEEEET!', color: where === 'caught' ? 'yellow' : 'cyan', from: 'right', x: w * 0.5, y: Math.round(window.innerHeight * 0.16), rotate: -6, scale: w < 600 ? 0.8 : 1, silent: true });
      setTimeout(() => word.dismiss(), 1800);
    } catch (e) { /* decoration only */ }
  }
  // Order clock hit zero (police.js): the missed-delivery notice as a banner.
  function timesUp(fine) {
    const g = game();
    if (!g || g.gameState !== 'playing') return false;
    banner({ title: "TIME'S UP!", sub: (fine > 0 ? '−₹' + fine + ' FINE · ' : '') + 'HALF PAY, STREAK LOST', kind: 'red', burst: '!', key: 'timesup', duration: 3600 });
    return true;
  }

  // ---- per-frame upkeep ---------------------------------------------------------------------
  function teardown() {
    endHouse();
    if (st.npc) { st.npc.api.destroy(); st.npc = null; }
    hideBurst(); hideSpeed();
    live.length = 0; cur = null;
    document.querySelectorAll('.comic-banner-slot').forEach((n) => n.remove());
    if (st.siren) { st.siren.dismiss(); st.siren = null; }
    st.pendingEdge = null;
    Comic.clear();
    st.live = false;
  }
  function frame() {
    requestAnimationFrame(frame);
    const g = game();
    if (!g || g.gameState !== 'playing' || !g.camera || !g.vehicle) { if (st.live) teardown(); return; }
    const t = now();
    const sz = (st.npc || st.house) ? size() : null;
    if (st.house && t >= st.house.until) endHouse();
    const n = st.npc;
    if (n) {
      if (t >= n.until) endNpc(t);
      else if (n.anchor) {
        const v = n.anchor(_a);
        const pr = v && n.obj && treeVisible(n.obj) ? project(g, v.x, v.y, v.z, sz) : null;
        if (!pr || pr.behind) endNpc(t);
        else {
          // keep the bubble clear of the rider, the road and the map: try the other side of the head, else hide it
          const zn = cachedZone(g, sz, n.rec), u = { width: sz.W, height: sz.H };
          const sides = n.side === 'below' ? ['below', 'above'] : ['above', 'below'];
          let used = null;
          for (let i = 0; i < 2 && !used; i++) {
            const r = n.api.rectFor(pr.x, pr.y, Object.assign({ side: sides[i] }, u));
            if (!hits(r, zn, 2)) { used = sides[i]; n.rec.rect = r; }
          }
          if (used) { n.side = used; n.api.updatePosition(pr.x, pr.y, Object.assign({ side: used }, u)); n.api.show(); }
          else { n.api.hide(); n.rec.rect = null; }
        }
      }
    }
    if (t - st.lastProbe >= T.probeMs) { st.lastProbe = t; probe(g, t); chaseTick(g, t); }
  }

  S.Callouts = {
    version: 1, T, LINES: { HOUSE, BANNER, NPC, CHASE },
    banner, placeSlot, placeNote, tier, dropBanner, houseReaction, onOffence, onMissedThrow, onStars, onEncounter, timesUp,
    bandOf, teardown,
    // QA: the protected zone right now (rider, road ahead, HUD, live pieces) in layer pixels
    zone: () => { const g = game(); return g ? zone(g, size(), null) : []; },
    // QA: what is on screen right now
    state: () => ({ npc: !!st.npc, house: !!st.house, burst: !!st.burst, speed: !!st.speed, reds: st.reds.length, pieces: live.length }),
    gates: () => { const g = game(), t = now(); return { npc: !!st.npc, house: houseActive(t), bannerLeft: Math.round(st.bannerUntil - t), sinceNpcEnd: Math.round(t - st.lastNpcEnd), onboarding: onboarding(g), paused: !!(police() && police().isPaused()), ok: npcOk(g, t) }; }
  };

  // A comic hook must never be able to break the game: a throw here would otherwise abort the delivery
  // or the police flow that called it. Every public function swallows its own errors (and logs once).
  for (const k of Object.keys(S.Callouts)) {
    const fn = S.Callouts[k];
    if (typeof fn !== 'function') continue;
    let warned = false;
    S.Callouts[k] = function () {
      try { return fn.apply(this, arguments); }
      catch (e) { if (!warned) { warned = true; console.warn('[comic] ' + k + ' failed:', e); } }
    };
  }

  // Fonts download on first use: start them now so the first callout is not drawn in the fallback face.
  Comic.preload();
  requestAnimationFrame(frame);
})();
