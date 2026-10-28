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
    burst: null, burstCap: null, burstUntil: 0, burstRect: null,
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

  // ---- banners ----------------------------------------------------------------------------
  // Banner slot placement (the B89 zero-overlap rule): the slot starts under the
  // CAM / DAY chips (top right); wherever it would cross another piece of HUD it
  // drops below it. Measured every time, since the HUD changes height.
  const AVOID = ['.slowroads-telemetry-box', '.slowroads-top-bar', '.touch-util-btn', '#onboarding-hint', '#police-wanted.on', '#delivery-mission-capsule'];
  function placeSlot() {
    const slot = Comic.bannerSlot();
    slot.style.top = '';
    const base = Comic.layer().getBoundingClientRect();
    for (let pass = 0; pass < 4; pass++) {
      const r = slot.getBoundingClientRect();
      if (!r.height) return;
      let push = 0;
      for (let i = 0; i < AVOID.length; i++) {
        const list = document.querySelectorAll(AVOID[i]);
        for (let k = 0; k < list.length; k++) {
          const q = list[k].getBoundingClientRect();
          if (!q.width || !q.height) continue;
          if (r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top) push = Math.max(push, q.bottom - r.top + 8);
        }
      }
      if (!push) return;
      const cur = parseFloat(slot.style.top) || (r.top - base.top);
      slot.style.top = Math.round(cur + push) + 'px';
    }
  }
  // Shrink a banner's lettering until it fits the screen (phones, long district names).
  // Measured on layout width (offsetWidth), not on the screen rect: the slide-in animation
  // moves the rect while it plays.
  function fit(root) {
    const title = root.querySelector('.comic-banner-title');
    const sub = root.querySelector('.comic-banner-sub');
    if (!title) return;
    const slot = root.parentNode;
    const cs = getComputedStyle(slot);
    const room = Comic.layer().clientWidth - (parseFloat(cs.right) || 0) - 8 - (parseFloat(getComputedStyle(root).marginLeft) || 0) - 14; // 14 = skew + shadow
    let tries = 0;
    while (tries++ < 6 && root.offsetWidth > room) {
      const fs = parseFloat(getComputedStyle(title).fontSize) * 0.9;
      root.style.setProperty('--cb-fs', fs.toFixed(1) + 'px');
      if (sub) sub.style.letterSpacing = '0.03em';
    }
  }
  function banner(opts) {
    const o = Object.assign({}, opts, { title: plain(opts.title), sub: opts.sub ? plain(opts.sub) : opts.sub });
    const api = Comic.banner(o);
    fit(api.el);
    placeSlot();
    st.live = true;
    st.bannerUntil = Math.max(st.bannerUntil, now() + (o.duration === 0 ? 2600 : (o.duration || 2600)));
    return api;
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
    h.bubble.dismiss();
    h.emoji.dismiss();
  }
  function houseReaction(g, d) {
    if (!g || !g.camera || !d.target || !d.target.pos) return;
    const order = d.target.order || {};
    const kind = HOUSE[order.kind] ? order.kind : 'parcel';
    const band = bandOf(d.timeLeftRatio, d.timeLeftRatio * (g.maxOrderTimer || 0), d.missed);
    const text = cap1(deal('h:' + kind + ':' + band, HOUSE[kind][band]).replace('{item}', order.short || 'order'));
    endHouse();
    if (st.npc) { st.npc.api.dismiss(); st.npc = null; }
    const sz = size();
    const px = sz.W < 600 ? 66 : 84;
    const t = now();
    const ref = d.target.pos;
    const pr = project(g, ref.x, ref.y + T.houseLift, ref.z, sz);
    const emoji = Comic.emojiBurst({
      face: (kind === 'medical' ? FACE_MED : FACE)[band], item: ITEM[kind], extras: kind === 'medical' ? [] : EXTRAS[band],
      mood: band, size: px, x: pr.x, y: pr.y, duration: T.houseShowMs, label: text
    });
    const bubble = Comic.bubble({ text, size: 'md', maxWidth: sz.W < 600 ? 190 : 250, x: pr.x, y: pr.y - px / 2 - 4, silent: true, duration: T.houseShowMs });
    st.house = { bubble, emoji, ref, until: t + T.houseShowMs, px };
    st.live = true;
    pinHouse(g, sz);
  }
  function pinHouse(g, sz) {
    const h = st.house;
    const pr = project(g, h.ref.x, h.ref.y + T.houseLift, h.ref.z, sz);
    const m = 8 + h.px / 2;
    const ex = clamp(pr.x, m, sz.W - m), ey = clamp(pr.y, m, sz.H - m);
    h.emoji.updatePosition(ex, ey, { width: sz.W, height: sz.H });
    const bh = h.bubble.size().h;
    const sr = Comic.bannerSlot().getBoundingClientRect();   // keep the bubble clear of a banner showing in the slot
    const top = sr.height ? Math.max(8, sr.bottom - Comic.layer().getBoundingClientRect().top + 10) : 8;
    if (ey - h.px / 2 - 4 - 26 - bh < top) h.bubble.updatePosition(ex, ey + h.px / 2 + 4, { width: sz.W, height: sz.H, side: 'below' });
    else h.bubble.updatePosition(ex, ey - h.px / 2 - 4, { width: sz.W, height: sz.H });
  }

  // ---- NPC bubbles ----------------------------------------------------------------------------
  function say(g, text, anchor, opts) {
    opts = opts || {};
    const sz = size();
    const first = new THREE.Vector3();
    const p = anchor(first);
    if (!p) return false;
    const pr = project(g, p.x, p.y, p.z, sz);
    if (pr.behind) return false;
    const api = Comic.bubble({ text, size: 'md', maxWidth: sz.W < 600 ? 190 : 230, x: pr.x, y: pr.y, duration: 0 });
    // keep clear of the WANTED burst + caption: if the bubble would sit on them, hang it below the speaker's head instead
    let side = 'above';
    const R = st.burst && st.burstRect;
    if (R) {
      const bz = api.size(), cx = clamp(pr.x, bz.w / 2 + 10, sz.W - bz.w / 2 - 10), cy = pr.y - 26 - bz.h / 2;
      if (cx - bz.w / 2 < R.r && cx + bz.w / 2 > R.l && cy - bz.h / 2 < R.b && cy + bz.h / 2 > R.t) side = 'below';
    }
    st.npc = { api, anchor, until: now() + (opts.ms || T.npcShowMs), obj: opts.obj || null, side };
    st.live = true;
    return true;
  }
  function endNpc(t) {
    const n = st.npc;
    if (!n) return;
    st.npc = null;
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
  }
  function hideSpeed() { if (st.speed) { st.speed.dismiss(); st.speed = null; } }
  function sirenSfx(g, sz) {
    const t = now();
    if (t - st.sirenAt < 1500) return;
    st.sirenAt = t;
    st.sirenSide = st.sirenSide === 'left' ? 'right' : 'left';
    if (st.siren) st.siren.dismiss();
    st.siren = Comic.sfx({ text: CHASE.siren, color: 'siren', from: st.sirenSide, x: sz.W < 600 ? sz.W * 0.5 : sz.W * (st.sirenSide === 'left' ? 0.3 : 0.7), y: sz.H * 0.64, scale: sz.W < 600 ? 0.55 : 1, rotate: st.sirenSide === 'left' ? -6 : 6 });
    const s = st.siren;
    setTimeout(() => { s.dismiss(); if (st.siren === s) st.siren = null; }, 2200);
  }
  function edgeSay(g, stars, t) {
    const sz = size();
    const text = deal('c:edge' + stars, CHASE.edge[clamp(stars, 1, 5)]);
    const api = Comic.bubble({ edge: st.sirenSide, text, y: sz.H * (sz.W < 600 ? 0.44 : 0.34), maxWidth: sz.W < 600 ? 205 : 240, duration: 0 });
    st.npc = { api, anchor: null, until: t + T.edgeShowMs };
    st.live = true;
    st.nextEdge = t + T.tauntMs;
  }

  // police.js setStars -> here. Returns nothing; the plain star notice is replaced
  // by the burst + caption whenever this module exists.
  function onStars(prev, stars, reason) {
    const g = game();
    if (!g || g.gameState !== 'playing' || !g.camera) return;
    const t = now();
    const sz = size();
    if (stars > prev) {
      const big = sz.W >= 600;
      const bw = big ? 230 : 170;
      const cy = sz.H * (big ? 0.24 : 0.3);
      if (st.burst) st.burst.setStars(stars);
      else st.burst = Comic.wanted({ stars, x: sz.W / 2, y: cy, size: bw });
      if (st.burstCap) st.burstCap.dismiss();
      st.burstCap = reason ? Comic.caption(reason, { kind: 'paper', x: sz.W / 2, y: cy + bw * 0.43 + 22, tilt: 1, silent: true }) : null;
      if (st.burstCap) st.burstCap.el.classList.add('comic-centred');
      st.burstUntil = t + 3300;
      st.burstRect = { l: sz.W / 2 - bw * 0.55, r: sz.W / 2 + bw * 0.55, t: cy - bw * 0.43, b: cy + bw * 0.43 + 46 };
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
      else if (slotFree(t) && !onboarding(g)) { st.pendingEdge = null; edgeSay(g, Math.max(stars, 1), t); }
    }
    if (stars >= 2 && !st.pendingEdge) {
      if (t >= st.nextEdge && slotFree(t) && !onboarding(g)) edgeSay(g, stars, t);
      else if (t >= st.nextCrowd && npcOk(g, t)) {
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
    if (st.npc) { st.npc.api.dismiss(); st.npc = null; }
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
    if (st.house) {
      if (t >= st.house.until) endHouse(); else pinHouse(g, sz);
    }
    const n = st.npc;
    if (n) {
      if (t >= n.until) endNpc(t);
      else if (n.anchor) {
        const v = n.anchor(_a);
        const pr = v && n.obj && treeVisible(n.obj) ? project(g, v.x, v.y, v.z, sz) : null;
        if (!pr || pr.behind) endNpc(t);
        else n.api.updatePosition(pr.x, pr.y, { width: sz.W, height: sz.H, side: n.side });
      }
    }
    if (t - st.lastProbe >= T.probeMs) { st.lastProbe = t; probe(g, t); chaseTick(g, t); }
  }

  S.Callouts = {
    version: 1, T, LINES: { HOUSE, BANNER, NPC, CHASE },
    banner, placeSlot, dropBanner, houseReaction, onOffence, onMissedThrow, onStars, onEncounter, timesUp,
    bandOf, teardown,
    // QA: what is on screen right now
    state: () => ({ npc: !!st.npc, house: !!st.house, burst: !!st.burst, speed: !!st.speed, reds: st.reds.length }),
    gates: () => { const g = game(), t = now(); return { npc: !!st.npc, house: houseActive(t), bannerLeft: Math.round(st.bannerUntil - t), sinceNpcEnd: Math.round(t - st.lastNpcEnd), onboarding: onboarding(g), paused: !!(police() && police().isPaused()), ok: npcOk(g, t) }; }
  };

  // Fonts download on first use: start them now so the first callout is not drawn in the fallback face.
  Comic.preload();
  requestAnimationFrame(frame);
})();
