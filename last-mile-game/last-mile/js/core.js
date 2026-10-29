(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};

  const UI_ICON_PATHS = {
    sunrise: '<path d="M12 2v4M4.93 10.93l1.41 1.41M2 18h2M20 18h2M17.66 12.34l1.41-1.41M22 22H2M8 6l4-4 4 4M6 18a6 6 0 0 1 12 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    sunset: '<path d="M12 10V2M4.93 10.93l1.41 1.41M2 18h2M20 18h2M17.66 12.34l1.41-1.41M22 22H2M16 6l-4 4-4-4M6 18a6 6 0 0 1 12 0"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 9.5a4 4 0 0 1-1 7.9H7z"/>',
    cloudRain: '<path d="M7 15a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 6.5a4 4 0 0 1-1 7.9H7z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
    wind: '<path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12h14.5a2.5 2.5 0 1 1-2.5 2.5M3 16h8.5a2.5 2.5 0 1 1-2.5 2.5"/>',
    road: '<path d="M8 2 4 22M16 2l4 20M12 2v3M12 9.5v3M12 17v3"/>',
    mountain: '<path d="M3 20 9 8l4 6 2-3 6 9H3z"/>',
    waves: '<path d="M2 8q2.5-3 5 0t5 0 5 0 5 0M2 14q2.5-3 5 0t5 0 5 0 5 0M2 20q2.5-3 5 0t5 0 5 0 5 0"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-3-3z"/>',
    car: '<path d="M4 16V9.5L6 5h12l2 4.5V16"/><path d="M2 16h20v3H2z"/><circle cx="7" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
    x: '<path d="M5 5l14 14M19 5 5 19"/>',
    package: '<path d="M3 8l9-5 9 5-9 5-9-5zM3 8v9l9 5m0-14v14m9-14v9l-9 5"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    scooter: '<circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/><path d="M5.5 18.5H10l2-6h4M12.5 18.5h6l-1.5-5-3-1.5M8 6h3l1 3"/>',
    alertTriangle: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.1"/>',
    chevronLeft: '<path d="M14.5 4 7 12l7.5 8"/>',
    chevronRight: '<path d="M9.5 4 17 12l-7.5 8"/>',
    chevronUp: '<path d="M4 14.5 12 7l8 7.5"/>',
    chevronDown: '<path d="M4 9.5 12 17l8-7.5"/>',
    flame: '<path d="M12 22a6.5 6.5 0 0 0 6.5-6.5c0-3-2-4.5-3-6.5-.5 2-1.5 3-2.5 2 0-2.5-.5-4.5-3-7-1 2.5-3 4-3 7.5a4 4 0 0 0 1 2.5c-1.5 0-2.5-1-3-2.5-1.5 2-2 3.5-2 4C5.5 19.5 8 22 12 22z"/>',
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    check: '<path d="M4 12.5 9.5 18 20 6"/>',
    refresh: '<path d="M20 11A8 8 0 0 0 6 5.3L4 7M4 4v3h3M4 13a8 8 0 0 0 14 5.7l2-2.7M20 20v-3h-3"/>',
    lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l3.4 3.4M18.4 5.6l-3.4 3.4M5.6 18.4l3.4-3.4M18.4 18.4l-3.4-3.4"/>',
    building: '<path d="M4 21V4h10v17M18 21v-9h-4M8 8h2M8 12h2M8 16h2"/>',
    play: '<path d="M6 4l14 8-14 8V4z"/>',
    pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
    skipBack: '<path d="M6 5v14M18 6l-9 6 9 6V6z"/>',
    skipForward: '<path d="M18 5v14M6 6l9 6-9 6V6z"/>',
    volume: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
    aperture: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.5-4.2M12 12l-9 3M12 12l4.5 8"/>',
    gauge: '<circle cx="12" cy="13" r="8"/><path d="M12 13l3.5-4.5M8 13a4 4 0 0 1 4-4"/>'
  };
  const UI = {
    icon(name, size = 16) {
      const inner = UI_ICON_PATHS[name];
      if (!inner) return '';
      return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
    }
  };

  // --------------------------------------------------------------------------
  // 0. VEHICLE GLTF ASSET LOADER — shared factory for all three vehicle meshes
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // Roadside barrier piece shapes. Shared by the initial fence build and the
  // streaming path. Rails/courses are UNIT length along X (instances stretch
  // them per segment), posts are unit pieces placed at segment ends.
  // --------------------------------------------------------------------------

  class PRNG {
    constructor(seed = 12345678) {
      this.seed = typeof seed === 'string' ? this.hashString(seed) : seed;
    }
    hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
      }
      return hash >>> 0;
    }
    next() {
      let t = (this.seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(min, max) {
      return min + this.next() * (max - min);
    }
  }

  // --------------------------------------------------------------------------
  // 2. SIMPLEX NOISE
  // --------------------------------------------------------------------------
  class SimplexNoise {
    constructor(prng) {
      this.p = new Uint8Array(256);
      for (let i = 0; i < 256; i++) this.p[i] = i;
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(prng.next() * (i + 1));
        const t = this.p[i]; this.p[i] = this.p[j]; this.p[j] = t;
      }
      this.perm = new Uint8Array(512);
      this.permMod12 = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        this.perm[i] = this.p[i & 255];
        this.permMod12[i] = this.perm[i] % 12;
      }
      this.grad3 = [
        1,1,0, -1,1,0, 1,-1,0, -1,-1,0,
        1,0,1, -1,0,1, 1,0,-1, -1,0,-1,
        0,1,1,  0,-1,1, 0,1,-1,  0,-1,-1
      ];
    }
    noise2D(xin, yin) {
      const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
      const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
      let s = (xin + yin) * F2;
      let i = Math.floor(xin + s);
      let j = Math.floor(yin + s);
      let t = (i + j) * G2;
      let x0 = xin - (i - t);
      let y0 = yin - (j - t);

      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

      let x1 = x0 - i1 + G2;
      let y1 = y0 - j1 + G2;
      let x2 = x0 - 1.0 + 2.0 * G2;
      let y2 = y0 - 1.0 + 2.0 * G2;

      let ii = i & 255;
      let jj = j & 255;

      let gi0 = this.permMod12[ii + this.perm[jj]] * 3;
      let gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]] * 3;
      let gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]] * 3;

      let t0 = 0.5 - x0 * x0 - y0 * y0;
      let n0 = t0 < 0 ? 0.0 : (t0 *= t0, t0 * t0 * (this.grad3[gi0] * x0 + this.grad3[gi0 + 1] * y0));

      let t1 = 0.5 - x1 * x1 - y1 * y1;
      let n1 = t1 < 0 ? 0.0 : (t1 *= t1, t1 * t1 * (this.grad3[gi1] * x1 + this.grad3[gi1 + 1] * y1));

      let t2 = 0.5 - x2 * x2 - y2 * y2;
      let n2 = t2 < 0 ? 0.0 : (t2 *= t2, t2 * t2 * (this.grad3[gi2] * x2 + this.grad3[gi2 + 1] * y2));

      return 70.0 * (n0 + n1 + n2);
    }
  }

  // --------------------------------------------------------------------------
  // CAREER PROFILE (save.js)
  // Persistent wallet, lifetime stats, courier rank, daily streak and stars.
  // Held as a module-level singleton next to `sound` for the same reason: it
  // is one shared service, not per-engine state, and the engine can be torn
  // down and rebuilt without touching it.
  //
  // Deliberately tolerant of being absent. save.js is a separate file loaded
  // before this one; if it ever fails to load, every call site below is
  // guarded so the game still runs — it just stops remembering anything.
  // --------------------------------------------------------------------------
  const Career = (typeof window !== 'undefined' && window.ShiplypSave) ? window.ShiplypSave : null;
  if (!Career && typeof console !== 'undefined') {
    console.warn('[Shiplyp] save.js not loaded — career progress will not persist this session.');
  }
  // B132: chance a pedestrian cluster also gets a signalled crossing (tuned for ~+15%).
  const CROSSING_AT_CLUSTER_CHANCE = 0.85;

  // --------------------------------------------------------------------------
  // 4. CONFIG & MISSIONS
  // --------------------------------------------------------------------------
  const CONFIG = (typeof window !== 'undefined' ? (window.CONFIG = window.CONFIG || {}) : {});
  Object.assign(CONFIG, {
    ROAD_WIDTH: 7.4,
    // Parcel toss reach (B136): ground-plane metres, and how far past abeam a drop still counts.
    TOSS_RANGE: 35,
    TOSS_BEHIND_SLACK: 3,
    // Crashing into AI traffic (WI-08): the player keeps this share of speed, loses this much shift cash, and cannot be hit again by anyone for a moment.
    CRASH_SPEED_KEEP: 0.35, CRASH_CASH_PENALTY: 40, CRASH_COOLDOWN_MS: 1200,
    // First-time player guidance (WI-18): where the first drop starts, how fast, and the slow
    // zone round the first house that keeps the drop window seconds long.
    ONBOARD: { APPROACH_M: 45, START_SPEED: 6, SLOW_ZONE_M: 38, SLOW_SPEED: 4.5, PASSED_M: 8 },
    // Spare parcels per shift (B140): a throw that can't reach a drop uses
    // one; missing with none left ends the shift.
    SPARE_PARCELS: 3,
    // Barrier hits (B140): a fresh impact keeps this share of speed, and
    // scraping along the barrier drags off this share per second.
    BARRIER_HIT_SPEED_KEEP: 0.75,
    BARRIER_SCRAPE_DRAG: 0.35,
    // Deliveries made with no assist on at any point during the order (B141).
    NO_ASSIST_BONUS: 0.10,
    // Paved verge width either side of the painted road edge. The road
    // ribbon's outer edge therefore sits at ROAD_WIDTH*0.5 + this. The
    // terrain mesh MUST carry a lateral slice at exactly that distance
    // (see createTerrainMesh) or the two surfaces only touch at whatever
    // points they happen to share, and tear apart in between.
    ROAD_SHOULDER_WIDTH: 1.8,
    // Longitudinal sampling for BOTH the road ribbon and the terrain
    // ribbon. These must stay equal: same count => same getSpacedPoints()
    // positions => the two meshes are continuous by construction rather
    // than by two samplings happening to agree. (They were 1200 vs 800,
    // which is what tore the seam open between shared samples.)
    ROAD_MESH_SEGMENTS: 1200,
    // Tiny upward lift on the road ribbon's outer verge so the road slab
    // deterministically wins the depth test against the terrain it rests
    // on. Landing the verge exactly ON the terrain surface is coplanar,
    // and coplanar means z-fighting plus terrain triangles poking through
    // the road edge in a ragged sawtooth. 2cm reads as flush.
    ROAD_VERGE_LIFT: 0.02,
    // Bumped from 500 (=6km) to 700 (=8.4km) at user's request: the
    // stretch between km 6 and 7.7 is where the first STREAMING chunk
    // used to appear, and even after seam-snap, seam-normal-blend, road
    // clearance sweep and 4-style barrier rotation, that zone still
    // reads as visibly broken to the player. Rather than trying to make
    // the streaming path bit-identical to the initial build path,
    // extend the initial build so it covers the whole 0-8.4km region
    // itself (via createTerrainMesh / createRoadMesh / createFoliageAndProps,
    // which produce clean geometry). The first streaming chunk now
    // starts past 8.4km where the driver is less likely to notice the
    // transition. Trade-off: initial world-build is ~40% more nodes
    // (500 -> 700) so first-load takes a bit longer, but the visible
    // driving experience up to and past the previous seam is now
    // uniformly the correct initial-mesh geometry.
    ROAD_POINTS_COUNT: 700,
    POINT_SPACING: 45.0,
    TERRAIN_SIZE: 1600.0,
    TERRAIN_SEGMENTS: 100,
    FOLIAGE_COUNT: 600,

    // Tunnels: where raw hillside terrain towers far enough above the road
    // to loom over/through the camera (the recurring "terrain wall" bug —
    // see BUGFIX_LOG.md Pattern 1/3), bore a tunnel through it instead of
    // trying to out-clamp the noise. Turns an unfixable visual bug into an
    // intentional set piece rather than chasing a 4th root cause.
    TUNNEL_OVERHEAD_THRESHOLD: 22.0, // terrain clears road by 22.0m -> bores deep mountain tunnel only
    TUNNEL_MIN_RUN: 16,              // min contiguous samples for a zone (~24m)
    TUNNEL_PAD: 2,                   // portal buffer on each end
    TUNNEL_HALF_WIDTH: 6.2,          // wide 2-lane arched bore
    TUNNEL_WALL_COLOR: 0x334155,     // modern reinforced concrete
    TUNNEL_LIGHT_SPACING: 8,         // fixture spacing

    SEASONS: {
      autumn: {
        id: 'autumn',
        name: 'Soothing Golden Afternoon',
        // Soft warm-white-to-cerulean sky gradient, no saturated blue —
        // matches the "soft overcast golden hour" brief instead of the old
        // punchy indigo-to-yellow dusk gradient.
        skyTop: 0x7a94ab,
        skyHorizon: 0xe8d9bd,
        skyBottom: 0xf3e6cf,
        fog: 0xe3d3b8,
        fogDensity: 0.0022,
        // Warm desaturated greens per spec (#8B9E6A-#A8B87A range).
        // cliffColor deliberately kept as a muted earthy brown, NOT the
        // spec's sand tone (#C4A882) — that tan was tried first and it
        // reads as sand/dune, not bare hillside, and since steep terrain
        // (this color) covers a lot of ground next to the road it was
        // visually swamping the green grass, making the whole map read as
        // "no grass, just tan".
        // Rich lush natural hillside greens (prevents washout under bright daylight)
        grassColor: 0x276638,
        grassLight: 0x3a874d,
        cliffColor: 0x8a7458,
        // Muted sage/olive canopy with a warm-brown bark accent, no pure
        // black outlines anywhere in the set. Brighter than the target
        // on-screen hue on purpose: this tints a photo pine/broadleaf
        // texture via multiply, which only ever darkens the base photo —
        // a mid-tone tint here still lands dark and saturated-looking, so
        // the tint has to sit lighter than the desired result to land in
        // the muted-sage range once multiplied.
        treeLeaves: [0xb2c093, 0xc4d1a3, 0xa6b586, 0xc7ab84]
      },
      // Spring/Summer are green-first by design — foliage should read as
      // living trees rather than a rainbow. Autumn keeps its fire tones,
      // winter stays evergreen-only (see isPine forcing in the tree loop).
      spring: {
        id: 'spring',
        name: 'Alpine Meadow Mist',
        skyTop: 0x0369a1,
        skyBottom: 0xbae6fd,
        fog: 0xbae6fd,
        fogDensity: 0.0015,
        // Desaturated per Master Prompt section 3 — see autumn's comment
        // above for the rationale/method.
        grassColor: 0x2f6543,
        grassLight: 0x4a9c68,
        cliffColor: 0x404044,
        // Mostly fresh green with one soft cherry-blossom pink accent for
        // seasonal character — no longer a scattershot of unrelated hues.
        treeLeaves: [0x5baa78, 0x469062, 0x86bf9b, 0xecd3e0]
      },
      summer: {
        id: 'summer',
        name: 'Coastal Golden Haze',
        skyTop: 0x1e40af,
        skyBottom: 0xfef08a,
        fog: 0xfde047,
        fogDensity: 0.0014,
        // Desaturated per Master Prompt section 3 — see autumn's comment
        // for rationale/method.
        grassColor: 0x5e7d32,
        grassLight: 0x7a9e43,
        cliffColor: 0x5d3c29,
        // Deep lush summer greens — no orange/brown outliers pulling the
        // canopy toward autumn colors.
        treeLeaves: [0x366247, 0x3c7652, 0x5baa78, 0x30553f]
      },
      winter: {
        id: 'winter',
        name: 'Northern Frost & Evergreen',
        skyTop: 0x1e3a8a,
        skyBottom: 0xd4e8f8,
        fog: 0xe8f2fb,
        fogDensity: 0.0018,
        grassColor: 0xeef1f4,   // brighter near-white snow blanket
        grassLight: 0xfcfeff,   // almost pure white snow highlights
        cliffColor: 0x3a4048,   // slightly lighter cliff for snowy mountain feel
        snowRockColor: 0xbec4cc, // frost-dusted rock faces (used in winter scatter)
        treeLeaves: [0x4a6b58, 0x3d5e4a, 0x526a5c, 0x4a6660] // muted blue-green (frosted evergreen)
      },
      desert: {
        id: 'desert',
        name: 'Suryavann Red Sandstone & Dunes',
        skyTop: 0x1e3a8a,
        skyBottom: 0xfbbf24,
        fog: 0xf59e0b,
        fogDensity: 0.0016,
        grassColor: 0x9a3412, // terracotta red rock
        grassLight: 0xd97706, // golden desert sand
        cliffColor: 0x7c2d12,
        treeLeaves: [0x78716c, 0xa8a29e, 0x57534e, 0xb45309]
      },
    },

    // Single road surface. Selectable road types (dirt, gravel, mud, sand)
    // were removed together with the Off-World map (B117).
    ROAD_SURFACE: { id: 'asphalt', name: 'Asphalt Expressway', color: 0x1e2229, roughness: 0.82, metalness: 0.05, gripMult: 1.00 },

    TIME_OF_DAY: {
      dawn: {
        id: 'dawn',
        name: 'Dawn Golden Hour',
        icon: 'sunrise',
        skyTop: 0x7c5980,
        skyHorizon: 0xe0a0a0,
        skyBottom: 0xf8d7b0,
        fog: 0xe0a0a0,
        fogDensity: 0.0052,
        sunColor: 0xffeedd,
        sunIntensity: 1.15,
        sunPos: [220, 90, -120],
        ambientColor: 0xdfba89,
        ambientIntensity: 0.45,
        night: false
      },
      day: {
        id: 'day',
        // Warm golden-hour palette, but with real directional shading
        // contrast restored — the earlier "soft overcast" tuning (sun
        // 0.85 / ambient 0.72) pushed so much of the light into the flat
        // omnidirectional ambient term that terrain undulation stopped
        // reading as 3D at all ("terrain looks flat" — checked directly
        // against slowroads.io, whose dune terrain has clearly visible
        // light/shadow gradient across every slope). Sun back up, ambient
        // back down: same warm hue, but the directional light is doing
        // enough of the work again to reveal depth via shading.
        name: 'Warm Golden Hour',
        icon: 'sun',
        skyTop: 0x6f8aa3,
        skyHorizon: 0xe9dcc3,
        skyBottom: 0xf5ead4,
        fog: 0xe9dcc3,
        fogDensity: 0.0026,
        sunColor: 0xfff2df,
        sunIntensity: 1.3,
        sunPos: [120, 260, 100],
        ambientColor: 0xfaf1e0,
        ambientIntensity: 0.4,
        night: false
      },
      dusk: {
        id: 'dusk',
        name: 'Sunset Golden Hour',
        icon: 'sunset',
        skyTop: 0x383556,
        skyHorizon: 0xd96b43,
        skyBottom: 0xf7b267,
        fog: 0xd96b43,
        fogDensity: 0.0052,
        sunColor: 0xffedd5,
        sunIntensity: 1.10,
        sunPos: [-220, 75, -140],
        ambientColor: 0xfb923c,
        ambientIntensity: 0.48,
        night: false
      },
      night: {
        id: 'night',
        name: 'Midnight Starlight',
        icon: 'moon',
        skyTop: 0x010206,
        skyHorizon: 0x070e1c,
        skyBottom: 0x0a1424,
        fog: 0x070e1c,
        fogDensity: 0.0058,
        sunColor: 0x93c5fd,
        sunIntensity: 0.40,
        sunPos: [-60, 190, -100],
        ambientColor: 0x0a1424,
        ambientIntensity: 0.32,
        night: true
      }
    },

    CITIES: {
      mumbai: { id: 'mumbai', name: 'The Grand Nilambari Corridor', tagline: 'Continuous Scenic Highway Across Districts', season: 'autumn', openRoad: false },
      desert: { id: 'desert', name: 'Suryavann Open Desert', tagline: 'Endless Red Rock Canyons & Dunes', season: 'desert', openRoad: true },
      mountains: { id: 'mountains', name: 'Chandragiri Open Pass', tagline: 'Rolling Foothills & Natural Arches', season: 'spring', openRoad: true },
      highlands: { id: 'highlands', name: 'Highland Dusk Highway', tagline: 'Sweeping Heather & Rolling Horizon', season: 'autumn', openRoad: true }
    },

    DISTRICT_BIOMES: [
      {
        id: 'foothills',
        name: 'Neelgiri Foothills',
        tagline: 'Lush Mountain Pass & Cedar Forest',
        grassColor: 0x4a6a2c,
        grassLight: 0x7a9640,
        cliffColor: 0x5d3c29,
        shoulderSoil: 0x7a9640,
        treeLeaves: [0x366247, 0x3c7652, 0x5baa78, 0x30553f],
        rockColor: 0x6b5c48,
        treeDensity: 0.85
      },
      {
        id: 'ridge',
        name: 'Cloudspire Ridge',
        tagline: 'Misty Pine Bluffs & Cantilever Villas',
        grassColor: 0x225530,
        grassLight: 0x327544,
        cliffColor: 0x3e424b,
        shoulderSoil: 0x327544,
        treeLeaves: [0x2d4f3b, 0x345e45, 0x407052, 0x243e30],
        rockColor: 0x555861,
        treeDensity: 0.75
      },
      {
        id: 'valley',
        name: 'Sonaghati Valley Expressway',
        tagline: 'Golden Grasslands & Contemporary Estates',
        grassColor: 0x4a7332,
        grassLight: 0x669945,
        cliffColor: 0x694b2f,
        shoulderSoil: 0x669945,
        treeLeaves: [0x6b7032, 0x828a38, 0x94782b, 0x575e29],
        rockColor: 0x7a6952,
        treeDensity: 0.65
      },
      {
        id: 'coastal_canyon',
        name: 'Suryakoot Coastal Pass',
        tagline: 'Red Sandstone Canyons & Scenic Viewpoints',
        grassColor: 0x9c4e2b,
        grassLight: 0xc4733d,
        cliffColor: 0x7a301a,
        shoulderSoil: 0xb36336,
        treeLeaves: [0x78716c, 0xa8a29e, 0x57534e, 0xb45309],
        rockColor: 0x8a4528,
        treeDensity: 0.50
      },
      {
        id: 'deccan',
        name: 'Mayurakshi Plateau',
        tagline: 'Rolling Open Plateau & Rural Homesteader Groves',
        grassColor: 0x356338,
        grassLight: 0x4d874e,
        cliffColor: 0x4a4332,
        shoulderSoil: 0x4d874e,
        treeLeaves: [0x4d5930, 0x667540, 0x78874a, 0x3d4527],
        rockColor: 0x5c5443,
        treeDensity: 0.70
      }
    ],

    // One roadside barrier type for the whole route (continuous, no rotating
    // styles): 0 = galvanised W-beam guardrail, 1 = dry-stone wall,
    // 2 = wooden split-rail, 3 = concrete (Jersey) barrier.
    BARRIER_STYLE: 0,

    // Raised footpath on both sides between the road edge and the guardrail.
    // The kerb is also the vehicles' lateral limit (see getLateralClamp).
    SIDEWALK: { enabled: true, width: 1.7, kerb: 0.12 },

    // Single vehicle registry: physics, menus, pricing and payout all read
    // from here. `order` is the progression slot. `handling` picks shared
    // behaviour: 'pedal' (cycle only), 'twoWheeler' (lean, small-vehicle
    // camera), 'threeWheeler' / 'car' (four-wheel style body roll). Speeds m/s.
    VEHICLES: {
      // maxSpeed = end of the ride-time ramp (65 km/h); baseSpeed = start of it (40 km/h).
      cycle: { id: 'cycle', order: 1, name: 'Delivery Cycle', short: 'CYCLE', handling: 'pedal', speedLabel: '40–65 km/h',
        price: 0, payoutMult: 1.0, wheelRadius: 0.365,
        maxSpeed: 18.06, baseSpeed: 11.11, rampSeconds: 45, accel: 8.5, drag: 0.55, brake: 14.0 },
      motorbike: { id: 'motorbike', order: 2, name: 'Motorbike', short: 'BIKE', handling: 'twoWheeler', speedLabel: '90 km/h',
        price: 1500, payoutMult: 1.25, wheelRadius: 0.31,
        maxSpeed: 25.0, accel: 11.0, drag: 0.65, brake: 20.0 },
      // Cargo rickshaw (B172): top speed close to the motorbike, but a slow pick-up
      // (accel 6.0 vs the bike's 11.0) and heavier drag; wheelbase/track feed the
      // ground-contact probe instead of the coupe's.
      rickshaw: { id: 'rickshaw', order: 3, name: 'Cargo Rickshaw', short: 'RICKSHAW', handling: 'threeWheeler', speedLabel: '86 km/h',
        price: 3500, payoutMult: 1.6, wheelRadius: 0.28, bodyRoll: 0.19, halfWheelbase: 1.1, halfTrack: 0.64,
        maxSpeed: 24.0, accel: 6.0, drag: 0.85, brake: 14.0 },
      musclecoupe: { id: 'musclecoupe', order: 4, name: 'Muscle Coupe', short: 'COUPE', handling: 'car', speedLabel: '194 km/h',
        price: 6000, payoutMult: 2.0, wheelRadius: 0.315, bodyRoll: 0.12,
        maxSpeed: 54.0, accel: 19.0, drag: 0.82, brake: 30.0 }
    },

    DIFFICULTY_TIERS: {
      easy: { id: 'easy', name: 'Relaxed Shift', timeLimit: 55.0, minHouseDist: 5.2, maxHouseDist: 8.0, tossRadius: 7.5, payoutMult: 1.0 },
      medium: { id: 'medium', name: 'City Standard', timeLimit: 36.0, minHouseDist: 7.0, maxHouseDist: 14.0, tossRadius: 5.2, payoutMult: 1.5 },
      hard: { id: 'hard', name: 'Rush Hour Express', timeLimit: 22.0, minHouseDist: 10.0, maxHouseDist: 25.0, tossRadius: 3.6, payoutMult: 2.5 }
    },

    ORDERS_BY_CITY: {
      mumbai: [
        { id: 101, name: 'Neelgiri Foothill Bungalow', cargo: 'Fresh Irani Chai, Maska Bun & Pastries', reward: 75 },
        { id: 102, name: 'Cloudspire Valley Ridge Villa', cargo: 'Warm Vada Pav & Thermos Cutting Chai', reward: 85 },
        { id: 103, name: 'Chandragiri Peak Lookout Estate', cargo: 'Piping Hot Puran Poli & Sol Kadhi Tiffin', reward: 110 },
        { id: 104, name: 'Sonaghati Lakeside Villa', cargo: 'Dabbawala Multi-Tier Lunch & Buttermilk', reward: 90 },
        { id: 105, name: 'Nilambari Mist Hillside Bungalow', cargo: 'Artisanal Chikki Box & Espresso Beans', reward: 80 },
        { id: 106, name: 'Suryakoot Valley Pass Estate', cargo: 'Alphonso Mango Crate & Kokum Juice', reward: 105 },
        { id: 107, name: 'Mayurakshi Ridge Forest Retreat', cargo: 'Urgent Survey Electronics & Hard Disk', reward: 125 },
        { id: 108, name: 'Neelgiri Foothill Homestead', cargo: 'Fresh Morning Farm Milk & Forest Honey', reward: 70 },
        { id: 109, name: 'Sonaghati Riverfront Bungalow', cargo: 'Spicy Mountain Misal Pav & Pav', reward: 95 },
        { id: 110, name: 'Chandragiri Ghat Overlook Villa', cargo: 'Camera Telephoto Lens & Battery Pack', reward: 130 },
        { id: 111, name: 'Nilambari Sanctuary Outpost', cargo: 'Medical First-Aid Dispatch & Antivenom', reward: 140 },
        { id: 112, name: 'Cloudspire Summit Villa', cargo: 'Fresh Strawberry Crates & Clotted Cream', reward: 115 }
      ],
      delhi: [
        { id: 201, name: 'Amber Lane Haveli', cargo: 'Hot Parathas & Lassi Kulhad', reward: 65 },
        { id: 202, name: 'Jaspura Village Flat', cargo: 'Butter Chicken & Naan Tiffin', reward: 85 },
        { id: 203, name: 'Kiranpura Tech Towers', cargo: 'Urgent Legal Dispatch & Hard Disk', reward: 110 },
        { id: 204, name: 'Ashavani Heritage Kothi', cargo: 'Morning Gazette & Artisanal Tea', reward: 75 },
        { id: 205, name: 'Rangoli Market Kothi', cargo: 'Festival Sweets & Kaju Katli Gift', reward: 60 },
        { id: 206, name: 'Devkund Colony Residency', cargo: 'Chole Bhature & Sweet Lassi', reward: 95 },
        { id: 207, name: 'Vanavasi Hilltop Villa', cargo: 'Dual Laptop Charger & Espresso', reward: 120 },
        { id: 208, name: 'Saffronia Hidden Courtyard', cargo: 'Fresh Morning A2 Milk Bottles', reward: 55 }
      ],
      kolkata: [
        { id: 301, name: 'Vidyapuri Street Bonedi Bari', cargo: '2x Hot Kathi Rolls & Buttermilk', reward: 65 },
        { id: 302, name: 'Gangavati Riverfront Residency', cargo: 'Traditional Biryani & Rasgullas', reward: 95 },
        { id: 303, name: 'Udyanpura Tech Towers', cargo: 'Urgent Legal Dispatch & Hard Disk', reward: 110 },
        { id: 304, name: 'Shubhkund Rajbari Courtyard', cargo: 'Festival Sweets & Sandesh Gift', reward: 75 },
        { id: 305, name: 'Tarangpur Heritage Kothi', cargo: 'Morning Gazette & Highland Mountain Tea', reward: 60 },
        { id: 306, name: 'Lavanya Sector Flat', cargo: 'Fish Curry & Steamed Rice Tiffin', reward: 85 },
        { id: 307, name: 'Chandanpur Hilltop Villa', cargo: 'Dual Laptop Charger & Espresso', reward: 120 },
        { id: 308, name: 'Shilpanagar Hidden Courtyard', cargo: 'Fresh Morning A2 Milk Bottles', reward: 55 }
      ],
      pune: [
        { id: 401, name: 'Prashanti Peth Wada', cargo: '2x Hot Misal Pav & Buttermilk', reward: 65 },
        { id: 402, name: 'Ketakivana Park Bungalow', cargo: 'Irani Chai, Maska Bun & Pastries', reward: 85 },
        { id: 403, name: 'Vigyanpur Tech Towers', cargo: 'Urgent Legal Dispatch & Hard Disk', reward: 110 },
        { id: 404, name: 'Vrindavan Wada (Behind Banyan Tree)', cargo: 'Festival Sweets & Kaju Katli Gift', reward: 75 },
        { id: 405, name: 'Mayurakshi Gymkhana Kothi', cargo: 'Morning Gazette & Artisanal Tea', reward: 60 },
        { id: 406, name: 'Mangalpura Peth Residency', cargo: 'Puran Poli & Sol Kadhi Tiffin', reward: 95 },
        { id: 407, name: 'Girikund Hilltop Villa', cargo: 'Dual Laptop Charger & Espresso', reward: 120 },
        { id: 408, name: 'Prashanti Peth Hidden Courtyard', cargo: 'Fresh Morning A2 Milk Bottles', reward: 55 }
      ],
      bangalore: [
        { id: 501, name: 'Mallika Nagar Doorstep', cargo: '2x Hot Masala Dosa & Buttermilk', reward: 65 },
        { id: 502, name: 'Indravani Nagar Bungalow', cargo: 'Filter Kaapi & Bun Maska', reward: 85 },
        { id: 503, name: 'Shvetakund Tech Towers', cargo: 'Urgent Legal Dispatch & Hard Disk', reward: 110 },
        { id: 504, name: 'Vrushabhpur Wada Courtyard', cargo: 'Festival Sweets & Golden Sweet Pak Gift', reward: 75 },
        { id: 505, name: 'Jayvanti Heritage Kothi', cargo: 'Morning Gazette & Artisanal Tea', reward: 60 },
        { id: 506, name: 'Harsha Layout Residency', cargo: 'Bisi Bele Bath & Rasam Tiffin', reward: 95 },
        { id: 507, name: 'Kuruvana Hilltop Villa', cargo: 'Dual Laptop Charger & Espresso', reward: 120 },
        { id: 508, name: 'Vrushabhpur Hidden Courtyard', cargo: 'Fresh Morning A2 Milk Bottles', reward: 55 }
      ]
    }
  });

  // Vehicle registry helpers. Unknown IDs (e.g. a removed vehicle still named
  // in an old save) resolve to the cycle, never to undefined.
  function vehicleSpec(id) { return CONFIG.VEHICLES[id] || CONFIG.VEHICLES.cycle; }
  function vehicleList() { return Object.values(CONFIG.VEHICLES).sort((a, b) => a.order - b.order); }
  function isTwoWheeler(id) { const h = vehicleSpec(id).handling; return h === 'pedal' || h === 'twoWheeler'; }
  function isPedalVehicle(id) { return vehicleSpec(id).handling === 'pedal'; }
  function hornStyle(id) {
    const h = vehicleSpec(id).handling;
    return h === 'pedal' ? 'bell' : (h === 'car' ? 'horn' : 'beep');
  }

  S.UI_ICON_PATHS = UI_ICON_PATHS;
  S.UI = UI;
  S.PRNG = PRNG;
  S.SimplexNoise = SimplexNoise;
  S.Career = Career;
  S.CROSSING_AT_CLUSTER_CHANCE = CROSSING_AT_CLUSTER_CHANCE;
  S.CONFIG = CONFIG;
  S.vehicleSpec = vehicleSpec;
  S.vehicleList = vehicleList;
  S.isTwoWheeler = isTwoWheeler;
  S.isPedalVehicle = isPedalVehicle;
  S.hornStyle = hornStyle;
})();
