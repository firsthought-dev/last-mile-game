(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};

  // ---------------------------------------------------------------------------
  // COMIC CALLOUT KIT  (window.Shiplyp.Comic)
  //
  // Draws the comic-style callouts: HUD banners, speech/shout bubbles (pinned to
  // a point or to a screen edge), caption boxes, bursts, the WANTED burst,
  // sound-effect lettering, speed lines and emoji reaction bursts. Every one is
  // a live overlay: the game keeps running underneath it.
  //
  // Scope rules:
  //   - Callouts only. The 3D world is never restyled. Everything here is DOM +
  //     inline SVG on top of the game; nothing is drawn into the 3D scene and no
  //     post-processing pass is involved.
  //   - Kit only: this file creates and animates pieces on a container it is
  //     handed. It never reads game state, never pauses the game and never
  //     listens to game events. The game hooks call these functions.
  //   - Styling lives in style.css under `.comic-*`; the colour tokens
  //     (--comic-ink, --comic-paper, plate offsets, font stacks) are defined there.
  //
  // Every piece is aria-hidden; its text goes to one polite live region instead
  // (announce) so screen readers hear each line once.
  // ---------------------------------------------------------------------------

  const SVGNS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  let uid = 0; // unique ids for SVG patterns and per-instance seeds

  // ---- tiny helpers ---------------------------------------------------------
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function sv(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const cssLen = (v) => (typeof v === 'number' ? v + 'px' : String(v));
  const f1 = (n) => (Math.round(n * 10) / 10).toString();

  // Seeded PRNG (mulberry32). One seed always gives the same jagged outline, so a
  // given line looks the same every time, while different lines differ a little.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedOf(v) {
    if (typeof v === 'number' && isFinite(v)) return (v >>> 0) || 1;
    const s = String(v == null ? '' : v);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) || 1;
  }

  // ---- accessibility prefs --------------------------------------------------
  // Same two sources the police module uses: the OS "reduce motion" media query,
  // and the in-game "Reduce flashing" switch (localStorage key below, which
  // defaults to the media query when it was never set).
  //   calm          -> no plate jitter, no flash frame, shorter transitions
  //   reduceMotion  -> additionally no sliding / scaling: pieces only fade
  function prefs() {
    let motion = false;
    let flash = null;
    try { motion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* no matchMedia */ }
    try { const v = localStorage.getItem('shiplyp_reduce_flashing'); if (v != null) flash = v === '1'; } catch (e) { /* storage blocked */ }
    if (flash == null) flash = motion;
    return { reduceMotion: motion, reduceFlashing: flash, calm: motion || flash };
  }

  // ---- live region (screen readers) ------------------------------------------
  let live = null;
  let livePending = [];
  let liveTimer = 0;
  function announce(text) {
    if (!text) return;
    livePending.push(String(text));
    if (liveTimer) return;
    // Clear, then set on a later tick: a region whose text did not change is not
    // re-read, and two callouts in one frame should be read as one message.
    liveTimer = setTimeout(() => {
      liveTimer = 0;
      if (!live || !live.isConnected) {
        live = el('div', 'comic-live');
        live.setAttribute('aria-live', 'polite');
        live.setAttribute('role', 'status');
        live.setAttribute('aria-atomic', 'true');
        document.body.appendChild(live);
      }
      live.textContent = livePending.join('. ');
      livePending = [];
    }, 30);
  }

  // ---- layer, mounting, retiring ---------------------------------------------
  // Default home for pieces: one absolute layer over the game. Pass `container`
  // to any piece to mount it elsewhere (the review page does; so will the HUD).
  function layer() {
    let l = document.getElementById('comic-layer');
    if (l) return l;
    l = el('div', 'comic-layer');
    l.id = 'comic-layer';
    (document.getElementById('game-app') || document.body).appendChild(l);
    return l;
  }
  // Top-right slot under the CAM/DAY chips, where the approved baseline puts the banner.
  function bannerSlot() {
    const l = layer();
    let s = l.querySelector('.comic-banner-slot');
    if (!s) { s = el('div', 'comic-banner-slot'); l.appendChild(s); }
    return s;
  }
  function decorate(root, o) {
    const p = prefs();
    root.classList.add('comic-piece');
    if (p.calm) root.classList.add('comic-calm');
    if (p.reduceMotion) root.classList.add('comic-still');
    root.setAttribute('aria-hidden', 'true');
    if (o && o.delay) root.style.setProperty('--d', o.delay + 'ms');
    return p;
  }
  function mount(root, container) { (container || layer()).appendChild(root); return root; }
  function placeBox(root, x, y) {
    if (x != null) root.style.left = cssLen(x);
    if (y != null) root.style.top = cssLen(y);
  }
  // Animate out, then remove. Idempotent.
  function retire(root, ms) {
    if (!root || root.classList.contains('comic-out')) return;
    const calm = root.classList.contains('comic-calm');
    root.classList.add('comic-out');
    setTimeout(() => { if (root.parentNode) root.parentNode.removeChild(root); }, calm ? 90 : (ms || 220));
  }
  function clear(container) {
    const c = container || document.getElementById('comic-layer');
    if (!c) return;
    c.querySelectorAll('.comic-piece').forEach((n) => { if (n.parentNode) n.parentNode.removeChild(n); });
  }

  // ---- shape generators (SVG) -------------------------------------------------
  // Jagged ring: alternating outer/inner radii, each nudged by the seeded rng.
  function jaggedPoints(cx, cy, rx, ry, spikes, inner, jitter, rand, rot) {
    const pts = [];
    const n = spikes * 2;
    const step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const a = (rot || 0) + i * step + (rand() - 0.5) * step * 0.35;
      const k = (i % 2 ? inner : 1) * (1 + (rand() - 0.5) * 2 * jitter);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }
  // Slightly wobbly ellipse as a smooth closed Catmull-Rom -> Bezier path.
  function blobPoints(cx, cy, rx, ry, wobble, rand) {
    const n = 18;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + (rand() - 0.5) * 2 * wobble;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }
  const pf = (p) => f1(p[0]) + ' ' + f1(p[1]);
  function polyPath(pts) { return 'M' + pts.map(pf).join('L') + 'Z'; }
  function smoothPath(pts) {
    const n = pts.length;
    let d = 'M' + pf(pts[0]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + pf(c1) + ' ' + pf(c2) + ' ' + pf(p2);
    }
    return d + 'Z';
  }

  // Burst graphic: shadow, outer jagged star, optional inner star with a halftone
  // overlay. Used by burst(), the banner's end star and emojiBurst().
  // Draws into a box of w x h (px) with a 6 px bleed for the outline and shadow.
  function burstSvg(o, rand) {
    const w = o.w, h = o.h, pad = 8;
    const svg = sv('svg', {
      class: 'comic-burst-art', viewBox: `${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`,
      width: w + pad * 2, height: h + pad * 2, 'aria-hidden': 'true'
    });
    svg.style.left = -pad + 'px';
    svg.style.top = -pad + 'px';
    const cx = w / 2, cy = h / 2;
    const outer = jaggedPoints(cx, cy, w / 2 * 0.97, h / 2 * 0.97, o.spikes, o.inner, o.jitter, rand, o.rot);
    const strokeW = o.stroke || 5;
    const g1 = sv('g', { transform: 'translate(5 6)', fill: 'var(--comic-ink)', stroke: 'var(--comic-ink)', 'stroke-width': strokeW, 'stroke-linejoin': 'miter' }, svg);
    sv('path', { d: polyPath(outer) }, g1);
    sv('path', { d: polyPath(outer), fill: o.fill, stroke: 'var(--comic-ink)', 'stroke-width': strokeW, 'stroke-linejoin': 'miter', 'stroke-miterlimit': 5 }, svg);
    if (o.dotsOuter) {
      const id = 'comic-ht-' + (++uid);
      const pat = sv('pattern', { id, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(18)' }, sv('defs', null, svg));
      sv('circle', { cx: 3.5, cy: 3.5, r: 1.7, fill: o.dotsOuter }, pat);
      sv('path', { d: polyPath(outer), fill: `url(#${id})` }, svg);
    }
    if (o.fill2) {
      const inn = jaggedPoints(cx, cy, w / 2 * 0.74, h / 2 * 0.74, Math.max(7, o.spikes - 2), o.inner + 0.05, o.jitter, rand, (o.rot || 0) + 0.18);
      sv('path', { d: polyPath(inn), fill: o.fill2, stroke: 'var(--comic-ink)', 'stroke-width': Math.max(3, strokeW - 1.5), 'stroke-linejoin': 'miter', 'stroke-miterlimit': 5 }, svg);
      if (o.dots !== false) {
        const id = 'comic-ht-' + (++uid);
        const defs = sv('defs', null, svg);
        const pat = sv('pattern', { id, width: o.dotStep || 7, height: o.dotStep || 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(18)' }, defs);
        sv('circle', { cx: (o.dotStep || 7) / 2, cy: (o.dotStep || 7) / 2, r: (o.dotStep || 7) * 0.24, fill: o.dotColor || 'rgba(110,0,30,.38)' }, pat);
        sv('path', { d: polyPath(inn), fill: `url(#${id})` }, svg);
      }
    }
    return svg;
  }

  // ---- plate lettering -----------------------------------------------------
  // The text lives in the element AND in data-text: CSS draws two offset copies
  // (cyan and red plates) behind the ink-stroked text from ::before/::after.
  function plateText(cls, text) {
    const t = el('span', 'comic-plate ' + (cls || ''), text);
    t.setAttribute('data-text', text);
    return t;
  }

  // ===========================================================================
  // BANNER: slanted yellow banner, offset-plate lettering, fading Ben-Day dots,
  // a star burst on the left end. Game keeps running; it auto-dismisses.
  //   banner({ title, sub?, kind?: 'yellow'|'green'|'orange'|'red'|'cyan',
  //            burst?: '★' | '3x' | ..., duration?: ms (0 = stay), key?, max?,
  //            container?, delay?, silent? })
  // `key`: a new banner with the same key replaces the older one. `max`: how many
  // may be visible in the container (older ones leave first). Default container is
  // the top-right slot under the CAM/DAY chips.
  // ===========================================================================
  function banner(opts) {
    const o = Object.assign({ kind: 'yellow', burst: '★', duration: 2600, max: 2, key: null }, opts);
    const host = o.container || bannerSlot();
    const shown = Array.from(host.children).filter((c) => c.classList.contains('comic-banner') && !c.classList.contains('comic-out'));
    shown.filter((c) => o.key && c.dataset.comicKey === o.key).forEach((c) => retire(c, 120));
    const keep = shown.filter((c) => !(o.key && c.dataset.comicKey === o.key));
    while (keep.length >= o.max) retire(keep.shift(), 120);

    const rand = rng(seedOf(o.title + '|' + (++uid)));
    const root = el('div', 'comic-banner comic-banner--' + o.kind);
    if (o.key) root.dataset.comicKey = o.key;
    decorate(root, o);

    const star = el('div', 'comic-banner-star');
    star.appendChild(burstSvg({ w: 84, h: 84, spikes: 8, inner: 0.52, jitter: 0.08, fill: 'var(--comic-burst-red)', fill2: null, dotsOuter: 'rgba(255,255,255,.42)', stroke: 4.5 }, rand));
    const glyph = el('span', 'comic-banner-glyph' + (String(o.burst).length > 2 ? ' comic-banner-glyph--long' : ''), o.burst);
    star.appendChild(glyph);

    const body = el('div', 'comic-banner-body');
    body.appendChild(plateText('comic-banner-title', String(o.title)));
    if (o.sub) body.appendChild(el('span', 'comic-banner-sub', String(o.sub)));
    root.append(star, body);
    mount(root, host);

    if (!o.silent) announce(o.title + (o.sub ? ' ' + o.sub : ''));
    let timer = 0;
    const api = {
      el: root,
      dismiss() { clearTimeout(timer); retire(root, 260); },
      get done() { return !root.isConnected; }
    };
    if (o.duration > 0) timer = setTimeout(api.dismiss, o.duration);
    return api;
  }

  // ===========================================================================
  // CAPTION: the yellow "MEANWHILE..." box.
  //   caption(text, { x?, y?, kind?: 'yellow'|'paper', tilt?: deg, container?, delay? })
  // x/y place the top-left corner (px number or any CSS length). Without them the
  // caption is a plain block in the container.
  // ===========================================================================
  function caption(text, opts) {
    const o = Object.assign({ kind: 'yellow', tilt: -1 }, opts);
    const root = el('div', 'comic-caption comic-caption--' + o.kind);
    root.style.setProperty('--tilt', o.tilt + 'deg');
    root.appendChild(el('span', 'comic-caption-text', String(text)));
    decorate(root, o);
    if (o.x != null || o.y != null) { root.classList.add('comic-abs'); placeBox(root, o.x, o.y); }
    mount(root, o.container);
    if (!o.silent) announce(text);
    return { el: root, dismiss() { retire(root); } };
  }

  // ===========================================================================
  // BURST: jagged star with big lettering ("THWAK!"). Two layers (outer yellow,
  // inner red with a halftone), text on the offset red/cyan plates.
  //   burst({ text, colors?: [outer, inner], size?: px, rotate?: deg, seed?,
  //           x?, y? (CENTRE), container?, delay? })
  // ===========================================================================
  function burst(opts) {
    const o = Object.assign({ colors: ['var(--comic-yellow)', 'var(--comic-burst-red)'], size: 240, rotate: -7 }, opts);
    const rand = rng(o.seed != null ? seedOf(o.seed) : seedOf(o.text + '|' + (++uid)));
    const w = o.size, h = Math.round(o.size * 0.82);
    const root = el('div', 'comic-burst');
    root.style.width = w + 'px';
    root.style.height = h + 'px';
    root.style.setProperty('--rot', o.rotate + 'deg');
    decorate(root, o);
    const inner = el('div', 'comic-burst-inner');
    inner.appendChild(burstSvg({ w, h, spikes: 15, inner: 0.66, jitter: 0.12, fill: o.colors[0], fill2: o.colors[1], stroke: Math.max(4, Math.round(w / 38)) }, rand));
    const len = Math.max(1, String(o.text).length);
    const fs = Math.min(w * 0.3, w * 1.3 / len);
    const txt = plateText('comic-plate--live comic-burst-text', String(o.text));
    txt.style.fontSize = Math.round(fs) + 'px';
    txt.style.setProperty('--comic-stroke', Math.max(4, Math.round(fs / 9)) + 'px');
    inner.appendChild(txt);
    root.appendChild(inner);
    if (o.x != null || o.y != null) { root.classList.add('comic-abs', 'comic-centred'); placeBox(root, o.x, o.y); }
    mount(root, o.container);
    return { el: root, dismiss() { retire(root); } };
  }

  // ===========================================================================
  // SFX: sound-effect lettering ("TWEEEET!", "WEE-OO WEE-OO!").
  //   sfx({ text, rotate?: deg, scale?: n,
  //         color?: 'paper'|'cyan'|'yellow'|'pink'|'red'|'siren',
  //         from?: 'left'|'right',      slide in from that screen edge
  //         x?, y? (CENTRE), container?, delay? })
  // `siren`: the words alternate red and blue and the whole line sways side to
  // side (a sweep, not a colour flash, so it is safe under "reduce flashing").
  // ===========================================================================
  function sfx(opts) {
    const o = Object.assign({ rotate: -8, scale: 1, color: 'paper', from: null }, opts);
    const root = el('div', 'comic-sfx comic-sfx--' + o.color + (o.from ? ' comic-sfx--from-' + o.from : ''));
    root.style.setProperty('--rot', o.rotate + 'deg');
    root.style.setProperty('--sc', String(o.scale));
    decorate(root, o);
    const inner = el('div', 'comic-sfx-inner');
    if (o.color === 'siren') {
      String(o.text).split(/\s+/).forEach((word, i) => {
        inner.appendChild(plateText('comic-plate--live comic-sfx-text comic-sfx-word--' + (i % 2 ? 'blue' : 'red'), word));
      });
    } else {
      inner.appendChild(plateText('comic-plate--live comic-sfx-text', String(o.text)));
    }
    root.appendChild(inner);
    if (o.x != null || o.y != null) { root.classList.add('comic-abs', 'comic-centred'); placeBox(root, o.x, o.y); }
    mount(root, o.container);
    return { el: root, dismiss() { retire(root); } };
  }

  // ===========================================================================
  // WANTED: the red/yellow star burst that tells the player how hot the chase is.
  // Escalates in place: more stars, hotter colours, a pulse on every new star.
  //   const w = wanted({ stars: 3, max?: 5, size?: px, rotate?: deg,
  //                      x?, y? (CENTRE), container?, delay?, silent? })
  //   w.setStars(n)    raise or lower the level (n of `max` stars lit)
  //   w.dismiss()
  // ===========================================================================
  const WANTED_TONES = [
    ['var(--comic-yellow)', 'var(--comic-orange)'],
    ['var(--comic-yellow)', 'var(--comic-orange)'],
    ['var(--comic-yellow)', 'var(--comic-orange)'],
    ['var(--comic-orange)', 'var(--comic-burst-red)'],
    ['var(--comic-burst-red)', '#8c1026'],
    ['#ff2e63', '#2a0a14']
  ];
  const STAR_POINTS = (function () {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.6 : 10.8;
      pts.push(f1(Math.cos(a) * r) + ',' + f1(Math.sin(a) * r));
    }
    return pts.join(' ');
  })();
  function starSvg() {
    const svg = sv('svg', { class: 'comic-star', viewBox: '-13 -13 26 26', 'aria-hidden': 'true' });
    sv('polygon', { points: STAR_POINTS }, svg);
    return svg;
  }
  function wanted(opts) {
    const o = Object.assign({ stars: 3, max: 5, size: 230, rotate: -6 }, opts);
    const rand = rng(seedOf('wanted|' + (++uid)));
    const w = o.size, h = Math.round(o.size * 0.86);
    const root = el('div', 'comic-wanted');
    root.style.width = w + 'px';
    root.style.height = h + 'px';
    root.style.setProperty('--rot', o.rotate + 'deg');
    decorate(root, o);
    const inner = el('div', 'comic-wanted-inner');
    inner.appendChild(burstSvg({ w, h, spikes: 14, inner: 0.7, jitter: 0.09, fill: 'var(--w-outer)', fill2: 'var(--w-inner)', stroke: Math.max(4, Math.round(w / 40)) }, rand));
    const word = plateText('comic-plate--live comic-wanted-word', 'WANTED');
    const fs = Math.round(w * 0.19);
    word.style.fontSize = fs + 'px';
    word.style.setProperty('--comic-stroke', Math.max(4, Math.round(fs / 8)) + 'px');
    const row = el('div', 'comic-wanted-stars');
    row.style.setProperty('--sz', Math.round(w * 0.15) + 'px');
    const slots = [];
    for (let i = 0; i < o.max; i++) { const st = starSvg(); slots.push(st); row.appendChild(st); }
    inner.append(word, row);
    root.appendChild(inner);
    if (o.x != null || o.y != null) { root.classList.add('comic-abs', 'comic-centred'); placeBox(root, o.x, o.y); }
    mount(root, o.container);

    let level = 0;
    function setStars(n, quiet) {
      n = clamp(Math.round(n), 0, o.max);
      const tone = WANTED_TONES[Math.min(n, WANTED_TONES.length - 1)];
      root.style.setProperty('--w-outer', tone[0]);
      root.style.setProperty('--w-inner', tone[1]);
      slots.forEach((st, i) => {
        const lit = i < n;
        st.classList.toggle('is-lit', lit);
        st.classList.remove('is-new');
        if (lit && i >= level && !quiet) { void st.getBoundingClientRect(); st.classList.add('is-new'); }
      });
      if (n > level && !quiet) { root.classList.remove('comic-pulse'); void root.offsetWidth; root.classList.add('comic-pulse'); }
      if (n !== level && !o.silent) announce('Wanted level ' + n + ' of ' + o.max);
      level = n;
      api.stars = n;
    }
    const api = { el: root, stars: 0, setStars, dismiss() { retire(root); } };
    setStars(o.stars, true);
    return api;
  }

  // ===========================================================================
  // SPEED LINES: tapered white (and a few ink) wedges radiating from a focus
  // point. SVG, scales with its container.
  //   speedLines(container, { cx?: 0-1, cy?: 0-1, count?, inner?: 0-1, seed?,
  //                           alpha?: 0-1, width?, height?, delay? })
  // `width`/`height` are the design size of the viewBox (defaults to the container).
  // ===========================================================================
  function speedLines(container, opts) {
    const o = Object.assign({ cx: 0.5, cy: 0.55, count: 64, inner: 0.3, seed: 7, alpha: 1 }, opts);
    const host = container || layer();
    const w = o.width || host.clientWidth || 1000;
    const h = o.height || host.clientHeight || 600;
    const rand = rng(seedOf(o.seed));
    const svg = sv('svg', { class: 'comic-speed comic-piece', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    decorate(svg, o);
    const cx = w * o.cx, cy = h * o.cy;
    const R = Math.hypot(w, h);
    const rMin = Math.min(w, h) * o.inner;
    for (let i = 0; i < o.count; i++) {
      const a = (i / o.count) * Math.PI * 2 + (rand() - 0.5) * 0.05;
      const da = 0.004 + rand() * 0.016;
      const r1 = rMin * (0.8 + rand() * 0.6);
      const p = [
        [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1],
        [cx + Math.cos(a - da) * R, cy + Math.sin(a - da) * R],
        [cx + Math.cos(a + da) * R, cy + Math.sin(a + da) * R]
      ];
      // every 4th wedge is ink, so the lines still read over a pale sky
      sv('path', { d: polyPath(p), fill: i % 4 === 3 ? 'rgba(13,11,20,' + f1(0.38 * o.alpha) + ')' : 'rgba(255,255,255,' + f1(0.62 * o.alpha) + ')' }, svg);
    }
    host.appendChild(svg);
    return { el: svg, dismiss() { retire(svg); } };
  }

  // ===========================================================================
  // BUBBLE: round speech bubble or jagged shout bubble with a tail.
  //   bubble({ text, kind?: 'speech'|'shout', size?: 'sm'|'md'|'lg', maxWidth?,
  //            x?, y?, side?, margin?, container?, delay?, duration?, silent? })
  // (x, y) = the point the tail should reach (the speaker's head / the house door),
  // in container pixels. The body sits above it (flips below if there is no room
  // above) and is clamped inside the container; when the anchor is off screen the
  // body hugs the edge and a short tail points toward it.
  //
  // EDGE BUBBLE (the unseen cop): add `edge: 'left'|'right'` (shout look by default).
  // The bubble is pinned to that screen edge, slides in from it, and its tail is a
  // megaphone cone pointing off screen. `y` is its height on screen (px).
  //
  //   b.updatePosition(x, y, { width?, height?, margin?, side? })   pinned: call every frame
  //   b.updateEdge(y, { width?, height?, margin? })                 edge bubble: move up/down
  //   b.placeAt(cx, cy, tipX, tipY)   explicit: body centre + where the tail points
  //   b.setText(t)  b.show()  b.hide()  b.dismiss()  b.destroy()
  //   b.offscreen -> true while the anchor is outside the container
  // ===========================================================================
  function bubble(opts) {
    const edge = opts && (opts.edge === 'left' || opts.edge === 'right') ? opts.edge : null;
    const o = Object.assign({ kind: edge ? 'shout' : 'speech', size: edge ? 'lg' : 'md', margin: 10, side: 'above', tailLen: 26 }, opts);
    const kind = o.kind === 'shout' ? 'shout' : 'speech';
    const seed = o.seed != null ? seedOf(o.seed) : seedOf(String(o.text) + '|' + (++uid));
    const host = o.container || layer();

    const root = el('div', 'comic-bubble comic-bubble--' + kind + ' comic-bubble--' + o.size + (edge ? ' comic-bubble--edge comic-bubble--edge-' + edge : ''));
    decorate(root, o);
    if (o.maxWidth) root.style.setProperty('--cb-max', cssLen(o.maxWidth));
    const pop = el('div', 'comic-bubble-pop');
    const box = el('div', 'comic-bubble-box');
    const art = sv('svg', { class: 'comic-bubble-art', width: 1, height: 1, 'aria-hidden': 'true' }); // 1 px, not 0: a zero-size svg is not rendered at all
    const textEl = el('div', 'comic-bubble-text', String(o.text));
    box.append(art, textEl);
    pop.appendChild(box);
    root.appendChild(pop);

    // three stacked copies of the same shapes: hard shadow, ink outline, paper fill
    const groups = ['shadow', 'outline', 'fill'].map((k) => {
      const g = sv('g', null, art);
      if (k === 'shadow') g.setAttribute('transform', 'translate(4 5)');
      if (k !== 'fill') {
        g.setAttribute('fill', 'var(--comic-ink)');
        g.setAttribute('stroke', 'var(--comic-ink)');
        g.setAttribute('stroke-width', kind === 'shout' ? 8 : 7);
        g.setAttribute('stroke-linejoin', kind === 'shout' ? 'miter' : 'round');
        g.setAttribute('stroke-miterlimit', 5);
      } else {
        g.setAttribute('fill', 'var(--cb-fill, var(--comic-paper))');
      }
      return { bodyP: sv('path', null, g), tailP: sv('path', null, g) };
    });

    let rx = 60, ry = 30;      // body radii (px), set by build()
    let bw = 120, bh = 60;     // body size incl. outline, used for clamping
    let cx = 0, cy = 0;        // current body centre
    let lastTipKey = '';
    // per-bubble zig-zag amounts for the shout tail, from the same seed
    const tr = rng(seed ^ 0x51ed270b);
    const tailJit = [tr(), tr(), tr(), tr()].map((v) => 0.25 + v * 0.5);

    // Distance from the body centre to the ellipse edge in direction `a` (radians).
    function edgeR(a) {
      const c = Math.cos(a), s = Math.sin(a);
      return (rx * ry) / Math.sqrt((ry * c) * (ry * c) + (rx * s) * (rx * s));
    }
    function build() {
      const tw = textEl.offsetWidth || Math.max(60, String(o.text).length * 9);
      const th = textEl.offsetHeight || 36;
      rx = (tw / 2) * 1.2 + 8;
      ry = (th / 2) * 1.42 + 11;
      const rand = rng(seed);
      let d;
      if (kind === 'shout') {
        const spikes = clamp(Math.round((rx + ry) / 8.5), 12, 26);
        const pts = jaggedPoints(0, 0, rx * 1.05, ry * 1.1, spikes, 0.8, 0.07, rand, 0);
        d = polyPath(pts);
        bw = rx * 2.1 + 12; bh = ry * 2.2 + 12;
      } else {
        d = smoothPath(blobPoints(0, 0, rx, ry, 0.025, rand));
        bw = rx * 2 + 12; bh = ry * 2 + 12;
      }
      groups.forEach((g) => g.bodyP.setAttribute('d', d));
      lastTipKey = '';
    }

    // Tail from the body toward (tx, ty), both relative to the body centre.
    function setTail(tx, ty, limited) {
      const a = Math.atan2(ty, tx);
      const e = edgeR(a) * (kind === 'shout' ? 1.06 : 1);  // where the tail leaves the body
      // The tip reaches the target (never a stub shorter than 12 px, never longer
      // than 120 px); an off-screen target gets a short stub pointing its way.
      const dist = edge ? e + o.tailLen + 14 : limited ? e + 24 : clamp(Math.hypot(tx, ty), e + 22, e + 120);
      const key = f1(a * 20) + '|' + f1(dist);
      if (key === lastTipKey) return;
      lastTipKey = key;
      const dir = [Math.cos(a), Math.sin(a)];
      const perp = [-dir[1], dir[0]];
      const half = Math.min(15, Math.min(rx, ry) * 0.5);
      const beta = half / Math.max(e, 1);
      const base = (s) => {
        const ang = a + s * beta;
        const r = edgeR(ang) * 0.93;
        return [Math.cos(ang) * r, Math.sin(ang) * r];
      };
      const b1 = base(-1), b2 = base(1);
      const tip = [dir[0] * dist, dir[1] * dist];
      const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const off = (p, k) => [p[0] + perp[0] * k, p[1] + perp[1] * k];
      let d;
      if (edge) {
        // megaphone: a straight cone, wide at the bubble and narrow at the mouthpiece,
        // capped with a small flared rim. It always points sideways, off screen.
        const p0 = dir.map((v) => v * e * 0.86);
        const half0 = Math.min(24, ry * 0.7), half1 = 8, capHalf = 15;
        const at = (along, side) => [p0[0] + dir[0] * along + perp[0] * side, p0[1] + dir[1] * along + perp[1] * side];
        const len = dist - e * 0.86;
        d = polyPath([at(0, -half0), at(len - 10, -half1), at(len - 10, -capHalf), at(len + 2, -capHalf), at(len + 2, capHalf), at(len - 10, capHalf), at(len - 10, half1), at(0, half0)]);
      } else if (kind === 'shout') {
        // lightning-style tail: each side zig-zags once
        const j = tailJit;
        const zig = clamp((dist - e) / 48, 0.35, 1);       // short tails zig-zag less
        const l1 = off(lerp(b1, tip, 0.42), 10 * zig * (j[0] + 0.3));
        const l2 = off(lerp(b1, tip, 0.76), -9 * zig * (j[1] + 0.2));
        const r2 = off(lerp(b2, tip, 0.72), 9 * zig * (j[2] + 0.2));
        const r1 = off(lerp(b2, tip, 0.4), -10 * zig * (j[3] + 0.3));
        d = polyPath([b1, l1, l2, tip, r2, r1, b2]);
      } else {
        const bend = clamp((dist - e) * 0.22, 3, 12);
        const c1 = off(lerp(b1, tip, 0.55), bend);
        const c2 = off(lerp(tip, b2, 0.45), bend);
        d = 'M' + pf(b1) + 'Q' + pf(c1) + ' ' + pf(tip) + 'Q' + pf(c2) + ' ' + pf(b2) + 'Z';
      }
      groups.forEach((g) => g.tailP.setAttribute('d', d));
      // the pop-in grows from the tail tip, like the line is "spoken" from there
      pop.style.setProperty('--tx', f1(tip[0]) + 'px');
      pop.style.setProperty('--ty', f1(tip[1]) + 'px');
    }

    function setBodyAt(x, y) {
      cx = Math.round(x); cy = Math.round(y);
      root.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
    }

    let replay = null;         // re-runs the last placement after a re-measure
    const api = {
      el: root,
      kind,
      offscreen: false,
      // explicit placement: body centre + the point the tail should reach
      placeAt(bx, by, tipX, tipY, limited) {
        replay = () => api.placeAt(bx, by, tipX, tipY, limited);
        setBodyAt(bx, by);
        setTail(tipX - cx, tipY - cy, !!limited);
      },
      updatePosition(ax, ay, u) {
        replay = () => api.updatePosition(ax, ay, u);
        u = u || {};
        const W = u.width || host.clientWidth || window.innerWidth;
        const H = u.height || host.clientHeight || window.innerHeight;
        const m = u.margin != null ? u.margin : o.margin;
        let side = u.side || o.side;
        const gap = o.tailLen;
        let by = side === 'below' ? ay + gap + bh / 2 : ay - gap - bh / 2;
        if (side === 'above' && by - bh / 2 < m && ay + gap + bh + m < H) by = ay + gap + bh / 2; // no room above: flip
        const fit = (v, size, max) => {
          const lo = m + size / 2, hi = max - m - size / 2;
          return lo > hi ? max / 2 : clamp(v, lo, hi);
        };
        const bx = fit(ax, bw, W);
        by = fit(by, bh, H);
        const inside = ax >= 0 && ax <= W && ay >= 0 && ay <= H;
        api.offscreen = !inside;
        setBodyAt(bx, by);
        setTail(ax - cx, ay - cy, !inside);
      },
      updateEdge(ey, u) {
        replay = () => api.updateEdge(ey, u);
        u = u || {};
        const W = u.width || host.clientWidth || window.innerWidth;
        const H = u.height || host.clientHeight || window.innerHeight;
        const m = u.margin != null ? u.margin : o.margin;
        // the megaphone's rim ends 2 px from the screen edge; the body sits that far in
        const reach = edgeR(0) * (kind === 'shout' ? 1.06 : 1) + o.tailLen + 14 + 4;
        const bx = edge === 'left' ? reach : W - reach;
        const lo = m + bh / 2, hi = H - m - bh / 2;
        const by = lo > hi ? H / 2 : clamp(ey, lo, hi);
        api.offscreen = true;                               // its speaker is always off screen
        setBodyAt(bx, by);
        setTail(edge === 'left' ? -1 : 1, 0, true);
      },
      setText(t) {
        textEl.textContent = String(t);
        build();
        if (replay) replay();
        if (!o.silent) announce(t);
      },
      size() { return { w: bw, h: bh }; },
      show() { root.classList.remove('comic-hidden'); },
      hide() { root.classList.add('comic-hidden'); },
      dismiss() { clearTimeout(timer); retire(root, 200); },
      destroy() { clearTimeout(timer); if (root.parentNode) root.parentNode.removeChild(root); }
    };
    let timer = 0;

    mount(root, host);   // must be in the DOM before build() can measure the text
    build();
    if (edge) api.updateEdge(o.y != null ? o.y : (host.clientHeight || window.innerHeight) * 0.4);
    else if (o.x != null && o.y != null) api.updatePosition(o.x, o.y);
    else setTail(0, ry + o.tailLen + 20, false);
    // Measuring starts the webfont download. If the font was not loaded yet, the
    // shape was sized on the fallback face: measure again once it has arrived.
    if (document.fonts && document.fonts.status === 'loading') {
      document.fonts.ready.then(() => { if (root.isConnected) { build(); if (replay) replay(); } });
    }
    if (!o.silent) announce(o.text);
    if (o.duration > 0) timer = setTimeout(api.dismiss, o.duration);
    return api;
  }

  // ===========================================================================
  // EMOJI BURST: the phone's own emoji framed in a small comic burst, popping
  // out of the house, with optional floating extras (hearts, steam, sweat).
  //   emojiBurst({ face, item?, extras?: ['💕',...], mood?: 'green'|'photo'|'yellow'|'red'|'missed',
  //                colors?, size?, x?, y? (CENTRE), label?, duration?, container?, delay? })
  //   -> { el, updatePosition(x, y), dismiss() }
  // `label` is the text read by screen readers (the emoji themselves are hidden).
  // ===========================================================================
  const EMOJI_MOODS = {
    green: ['var(--comic-yellow)', 'var(--comic-green)'],
    photo: ['var(--comic-yellow)', 'var(--comic-orange)'],
    yellow: ['var(--comic-paper)', 'var(--comic-yellow)'],
    red: ['var(--comic-orange)', 'var(--comic-burst-red)'],
    missed: ['var(--comic-cyan)', '#4b57a8']
  };
  function emojiBurst(opts) {
    const o = Object.assign({ mood: 'green', size: 96, extras: [] }, opts);
    const colors = o.colors || EMOJI_MOODS[o.mood] || EMOJI_MOODS.green;
    const rand = rng(seedOf(String(o.face) + '|' + (++uid)));
    const size = o.size;
    const root = el('div', 'comic-emoji');
    root.style.width = size + 'px';
    root.style.height = size + 'px';
    decorate(root, o);
    const pop = el('div', 'comic-emoji-pop');
    const bob = el('div', 'comic-emoji-bob');
    bob.appendChild(burstSvg({ w: size, h: size, spikes: 11, inner: 0.7, jitter: 0.1, fill: colors[0], fill2: colors[1], stroke: 4, dotStep: 6 }, rand));
    const face = el('span', 'comic-emoji-face', o.face);
    face.style.fontSize = Math.round(size * 0.5) + 'px';
    bob.appendChild(face);
    if (o.item) {
      const it = el('span', 'comic-emoji-item', o.item);
      it.style.fontSize = Math.round(size * 0.26) + 'px';
      bob.appendChild(it);
    }
    pop.appendChild(bob);
    root.appendChild(pop);
    // floating extras: each drifts up and sideways on its own seeded path
    (o.extras || []).forEach((ch, i) => {
      const x = el('span', 'comic-emoji-extra', ch);
      x.style.fontSize = Math.round(size * 0.24 + rand() * size * 0.08) + 'px';
      x.style.left = Math.round(size * (0.12 + rand() * 0.7)) + 'px';
      x.style.top = Math.round(size * (0.0 + rand() * 0.25)) + 'px';
      x.style.setProperty('--dx', Math.round((rand() - 0.5) * size * 0.5) + 'px');
      x.style.setProperty('--ed', (260 + i * 170 + Math.round(rand() * 90)) + 'ms');
      root.appendChild(x);
    });
    root.classList.add('comic-abs', 'comic-centred');
    mount(root, o.container);
    const api = {
      el: root,
      updatePosition(x, y, u) {
        u = u || {};
        const host = o.container || layer();
        const W = u.width || host.clientWidth || window.innerWidth;
        const H = u.height || host.clientHeight || window.innerHeight;
        const m = (u.margin != null ? u.margin : 8) + size / 2;
        root.style.left = '0px';
        root.style.top = '0px';
        root.style.transform = 'translate3d(' + Math.round(clamp(x, m, W - m)) + 'px,' + Math.round(clamp(y, m, H - m)) + 'px,0)';
      },
      dismiss() { clearTimeout(timer); retire(root, 220); }
    };
    let timer = 0;
    if (o.x != null && o.y != null) api.updatePosition(o.x, o.y);
    if (o.label) announce(o.label);
    if (o.duration > 0) timer = setTimeout(api.dismiss, o.duration);
    return api;
  }

  // Webfonts download on first use. Call this once at start-up (cheap, returns a
  // Promise) so the first callout is not measured and drawn in the fallback face.
  function preload() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('400 40px Bangers', '+\u20B9A!'),
      document.fonts.load('700 16px "Comic Neue"', 'Aa')
    ]).catch(() => {});
  }

  S.Comic = {
    version: 1,
    prefs, announce, layer, bannerSlot, clear, preload,
    banner, caption, burst, wanted, sfx, speedLines, bubble, emojiBurst
  };
})();
