// ============================================================================
// SHIPLYP: LAST MILE CHRONICLES — 3D INDIAN COURIER ACTION GAME ENGINE
// 100% Original IP | Sports/Indian Vehicles | Active Dispatch Missions |
// 3D Parabolic Parcel Toss | Real-Time Traffic AI | Combo Streaks & Tips
// ============================================================================

(function() {
  'use strict';

  // --------------------------------------------------------------------------
  // 0. LOCALIZED TRAFFIC ASSET: TATA ACE-STYLE MINI-TRUCK (CC0, Kenney Car Kit)
  // Recolored from stock to a teal-green/white Indian goods-carrier livery so
  // it reads distinctly from the yellow auto-rickshaws and red BEST buses.
  // --------------------------------------------------------------------------
  const IndianTruckAsset = {
    template: null,
    loading: false,
    load() {
      if (this.template || this.loading || typeof THREE.GLTFLoader === 'undefined') return;
      this.loading = true;
      new THREE.GLTFLoader().load('assets/models/delivery.glb', (gltf) => {
        const cabMat = new THREE.MeshPhongMaterial({ color: 0xf1f1f1, flatShading: true }); // white cab/door
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x2a9d8f, flatShading: true }); // teal-green cargo body
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          if (child.name === 'body') child.material = bodyMat;
          else if (child.name === 'door') child.material = cabMat;
          else if (child.name.startsWith('wheel')) child.material = wheelMat;
        });
        this.template = gltf.scene;
      }, undefined, (err) => {
        console.warn('IndianTruckAsset: failed to load delivery.glb, falling back to procedural traffic', err);
      });
    },
    clone() {
      return this.template ? this.template.clone(true) : null;
    }
  };
  IndianTruckAsset.load();

  // --------------------------------------------------------------------------
  // 1. DETERMINISTIC PRNG
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
  // 3. SOUND SYNTHESIZER & 90s BOLLYWOOD DHABA CASSETTE RADIO
  // --------------------------------------------------------------------------
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.radioPlaying = false;
      this.currentTrackIndex = 0;

      // Real 90s Desi Highway MP3 Playlist (Sourced from truckplaylist.com)
      this.realTracks = [
        {
          title: "Dil Ne Yeh Kaha Hain Dil Se",
          artist: "Udit Narayan (Dhadkan)",
          url: "https://truckplaylist.com/uploads/f_6a7ff097069568.58544488.mp3"
        },
        {
          title: "Tum To Thehre Pardesi",
          artist: "Altaf Raja (Highway Classic)",
          url: "https://truckplaylist.com/uploads/f_6a8010245994b9.23145761.mp3"
        },
        {
          title: "Pardesi Pardesi Jana Nahi",
          artist: "Udit Narayan & Alka Yagnik",
          url: "https://truckplaylist.com/uploads/f_6a800f6342cb21.48143101.mp3"
        },
        {
          title: "Too Cheez Badi Hain Mast",
          artist: "Kumar Sanu & Kavita K (Mohra)",
          url: "https://truckplaylist.com/uploads/f_6a803d87457702.02725399.mp3"
        },
        {
          title: "Jo Bhi Kasmein Khai Thi",
          artist: "Alka Yagnik & Udit (Raaz)",
          url: "https://truckplaylist.com/uploads/f_6a800efe5bd5a2.33668743.mp3"
        },
        {
          title: "Yeh Dil Deewana",
          artist: "Sonu Nigam (Pardes)",
          url: "https://truckplaylist.com/uploads/f_6a800ebd533b09.94127012.mp3"
        },
        {
          title: "Mera Dil Bhi Kitna Pagal Hai",
          artist: "Kumar Sanu & Alka (Saajan)",
          url: "https://truckplaylist.com/uploads/f_6a803e0654d485.12616218.mp3"
        },
        {
          title: "Tumse Milne Ki Tamanna Hai",
          artist: "S.P. Balasubrahmanyam",
          url: "https://truckplaylist.com/uploads/f_6a7ffdd61ef2c8.22241527.mp3"
        },
        {
          title: "Jeeta Tha Jiske Liye",
          artist: "Kumar Sanu & Alka (Dilwale)",
          url: "https://truckplaylist.com/uploads/f_6a7ffcb3d57294.79925154.mp3"
        },
        {
          title: "Barsaat Ke Mausam Mein",
          artist: "Kumar Sanu (Naajayaz)",
          url: "https://truckplaylist.com/uploads/f_6a80126e6822e6.26394093.mp3"
        }
      ];

      // HTML5 Audio Streamer (No crossOrigin restriction for CDN/hosted streaming)
      this.audioEl = new Audio();
      this.audioEl.preload = 'auto';
      this.audioEl.volume = 0.70;
      this.synthRadioTimer = null;
      // Radio only auto-resumes if the player has explicitly turned it on before
      this.userWantsRadio = localStorage.getItem('shiplyp_radio_pref') === 'on';

      this.audioEl.addEventListener('ended', () => {
        const title = this.nextTrack();
        const el = document.getElementById('radio-track-title');
        if (el) el.textContent = title;
      });

      this.audioEl.addEventListener('error', () => {
        if (this.radioPlaying) {
          this.startSynthRadio();
        }
      });

      const init = () => {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) this.ctx = new AC();
        }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      };
      window.addEventListener('click', init, { once: true });
      window.addEventListener('keydown', init, { once: true });
    }

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.audioEl) this.audioEl.muted = this.muted;
      return this.muted;
    }

    playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.25) {
      if (this.muted) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    playPothole() {
      if (this.muted) return;
      this.playTone(85, 'sawtooth', 0.25, 0.45);
      setTimeout(() => this.playTone(55, 'sine', 0.2, 0.35), 40);
    }

    playCash() {
      this.playTone(987, 'sine', 0.12, 0.3);
      setTimeout(() => this.playTone(1318, 'sine', 0.2, 0.25), 90);
    }

    playCombo() {
      this.playTone(659, 'sine', 0.1, 0.3);
      setTimeout(() => this.playTone(880, 'sine', 0.12, 0.3), 80);
      setTimeout(() => this.playTone(1174, 'sine', 0.2, 0.3), 160);
    }

    playSpeedCam() {
      if (this.muted) return;
      this.playTone(1800, 'sine', 0.08, 0.4);
      setTimeout(() => this.playTone(450, 'sawtooth', 0.25, 0.4), 80);
      setTimeout(() => this.playTone(350, 'sawtooth', 0.35, 0.35), 280);
    }

    playCrash() {
      if (this.muted) return;
      this.playTone(120, 'sawtooth', 0.35, 0.5);
      setTimeout(() => this.playTone(75, 'sawtooth', 0.4, 0.45), 35);
      setTimeout(() => this.playTone(45, 'sine', 0.5, 0.4), 90);
    }

    playRepair() {
      if (this.muted) return;
      this.playTone(523, 'sine', 0.15, 0.25);
      setTimeout(() => this.playTone(659, 'sine', 0.15, 0.25), 100);
      setTimeout(() => this.playTone(784, 'sine', 0.2, 0.3), 200);
      setTimeout(() => this.playTone(1046, 'sine', 0.3, 0.35), 300);
    }

    startSynthRadio() {
      if (this.synthRadioTimer) return;
      const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
      let step = 0;
      this.synthRadioTimer = setInterval(() => {
        if (!this.radioPlaying || this.muted) return;
        const melody = [0, 2, 4, 7, 5, 4, 2, 0, 4, 7, 9, 7, 5, 4, 2, 0];
        const note = notes[melody[step % melody.length] % notes.length];
        this.playTone(note, 'triangle', 0.22, 0.18);
        if (step % 2 === 0) this.playTone(note / 2, 'sine', 0.35, 0.22);
        step++;
      }, 260);
    }

    stopSynthRadio() {
      if (this.synthRadioTimer) {
        clearInterval(this.synthRadioTimer);
        this.synthRadioTimer = null;
      }
    }

    // Real MP3 90s Bollywood Radio Streamer
    toggleRadio() {
      this.ensure();
      this.radioPlaying = !this.radioPlaying;
      this.userWantsRadio = this.radioPlaying;
      localStorage.setItem('shiplyp_radio_pref', this.radioPlaying ? 'on' : 'off');
      if (this.radioPlaying) {
        const trk = this.realTracks[this.currentTrackIndex];
        this.audioEl.src = trk.url;
        const playPromise = this.audioEl.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.warn("Audio autoplay blocked or stream offline, starting synth:", e);
            this.startSynthRadio();
          });
        }
      } else {
        this.audioEl.pause();
        this.stopSynthRadio();
      }
      return this.radioPlaying;
    }

    nextTrack() {
      this.ensure();
      this.stopSynthRadio();
      this.currentTrackIndex = (this.currentTrackIndex + 1) % this.realTracks.length;
      const trk = this.realTracks[this.currentTrackIndex];
      this.audioEl.src = trk.url;
      if (this.radioPlaying) {
        const p = this.audioEl.play();
        if (p !== undefined) p.catch(() => this.startSynthRadio());
      }
      return `${trk.title} (${trk.artist})`;
    }

    prevTrack() {
      this.ensure();
      this.stopSynthRadio();
      this.currentTrackIndex = (this.currentTrackIndex - 1 + this.realTracks.length) % this.realTracks.length;
      const trk = this.realTracks[this.currentTrackIndex];
      this.audioEl.src = trk.url;
      if (this.radioPlaying) {
        const p = this.audioEl.play();
        if (p !== undefined) p.catch(() => this.startSynthRadio());
      }
      return `${trk.title} (${trk.artist})`;
    }
  }

  const sound = new SoundEngine();

  // --------------------------------------------------------------------------
  // 4. CONFIG & MISSIONS
  // --------------------------------------------------------------------------
  const CONFIG = {
    ROAD_WIDTH: 7.4,
    ROAD_POINTS_COUNT: 500,
    POINT_SPACING: 45.0,
    TERRAIN_SIZE: 1600.0,
    TERRAIN_SEGMENTS: 100,
    FOLIAGE_COUNT: 600,

    SEASONS: {
      autumn: {
        id: 'autumn',
        name: 'Dusk Heather & Moorland',
        skyTop: 0x312e81,
        skyBottom: 0xfde047,
        fog: 0xfbd38d,
        fogDensity: 0.0016,
        grassColor: 0x78350f,
        grassLight: 0xb45309,
        cliffColor: 0x451a03,
        // Kept visually distinct from grassColor/grassLight/cliffColor above —
        // the old palette shared 0xb45309 with grassLight, which let dense
        // clusters of trees blend into the hillside into one flat mass.
        treeLeaves: [0xdc2626, 0xea580c, 0xeab308, 0x991b1b]
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
        grassColor: 0x15803d,
        grassLight: 0x22c55e,
        cliffColor: 0x3f3f46,
        // Mostly fresh green with one soft cherry-blossom pink accent for
        // seasonal character — no longer a scattershot of unrelated hues.
        treeLeaves: [0x22c55e, 0x16a34a, 0x4ade80, 0xf9a8d4]
      },
      summer: {
        id: 'summer',
        name: 'Coastal Golden Haze',
        skyTop: 0x1e40af,
        skyBottom: 0xfef08a,
        fog: 0xfde047,
        fogDensity: 0.0014,
        grassColor: 0x65a30d,
        grassLight: 0x84cc16,
        cliffColor: 0x78350f,
        // Deep lush summer greens — no orange/brown outliers pulling the
        // canopy toward autumn colors.
        treeLeaves: [0x166534, 0x15803d, 0x22c55e, 0x14532d]
      },
      winter: {
        id: 'winter',
        name: 'Northern Frost & Evergreen',
        skyTop: 0x1e3a8a,
        skyBottom: 0xbfdbfe,
        fog: 0xdbeafe,
        fogDensity: 0.0016,
        grassColor: 0xe2e8f0,
        grassLight: 0xf8fafc,
        cliffColor: 0x1e293b,
        treeLeaves: [0x14532d, 0x166534, 0x15803d, 0x0f766e]
      }
    },

    ROAD_TERRAINS: {
      asphalt: { id: 'asphalt', name: 'Asphalt Expressway', icon: '🛣️', color: 0x1e2229, gripMult: 1.0, desc: 'Smooth highway tarmac' },
      gravel: { id: 'gravel', name: 'Mountain Ghats Gravel', icon: '🪨', color: 0x5a483a, gripMult: 0.75, desc: 'Rocky shale & mountain rumble' },
      mud: { id: 'mud', name: 'Monsoon Mud & Slush', icon: '🌧️', color: 0x3d291b, gripMult: 0.52, desc: 'Slippery drift clay track' },
      sand: { id: 'sand', name: 'Coastal Dune Sand', icon: '🏖️', color: 0xb88e58, gripMult: 0.65, desc: 'Soft golden sand verge' }
    },

    TIME_OF_DAY: {
      dawn: {
        id: 'dawn',
        name: 'Dawn Golden Hour',
        icon: '🌅',
        skyTop: 0x4338ca,
        skyHorizon: 0xf97316,
        skyBottom: 0xfde047,
        fog: 0xfde047,
        fogDensity: 0.0017,
        sunColor: 0xffedd5,
        sunIntensity: 1.15,
        sunPos: [220, 90, -120],
        ambientColor: 0xfb923c,
        ambientIntensity: 0.45,
        night: false
      },
      day: {
        id: 'day',
        name: 'Midday Daylight',
        icon: '☀️',
        skyTop: 0x0284c7,
        skyHorizon: 0x38bdf8,
        skyBottom: 0xbae6fd,
        fog: 0xbae6fd,
        fogDensity: 0.0015,
        sunColor: 0xfffdf5,
        sunIntensity: 1.25,
        sunPos: [120, 260, 100],
        ambientColor: 0xffffff,
        ambientIntensity: 0.55,
        night: false
      },
      dusk: {
        id: 'dusk',
        name: 'Twilight Dusk',
        icon: '🌇',
        skyTop: 0x1e1b4b,
        skyHorizon: 0x7c3aed,
        skyBottom: 0xf43f5e,
        fog: 0x7c3aed,
        fogDensity: 0.0018,
        sunColor: 0xf97316,
        sunIntensity: 1.05,
        sunPos: [-220, 75, -140],
        ambientColor: 0xa855f7,
        ambientIntensity: 0.42,
        night: false
      },
      night: {
        id: 'night',
        name: 'Midnight Starlight',
        icon: '🌙',
        skyTop: 0x020617,
        skyHorizon: 0x0f172a,
        skyBottom: 0x1e293b,
        fog: 0x0f172a,
        fogDensity: 0.0022,
        sunColor: 0x93c5fd,
        sunIntensity: 0.45,
        sunPos: [-60, 190, -100],
        ambientColor: 0x1e293b,
        ambientIntensity: 0.35,
        night: true
      }
    },

    CITIES: {
      mumbai: { id: 'mumbai', name: 'Mumbai', tagline: 'Marine Drive & Coastal Flyovers', season: 'autumn' },
      delhi: { id: 'delhi', name: 'New Delhi', tagline: 'Ring Road & Heritage Havelis', season: 'winter' },
      kolkata: { id: 'kolkata', name: 'Kolkata', tagline: 'Historic Boulevards & Ghats', season: 'summer' },
      pune: { id: 'pune', name: 'Pune', tagline: 'Deccan Peths & Wada Alleys', season: 'spring' },
      bangalore: { id: 'bangalore', name: 'Bengaluru', tagline: 'Gulmohar Avenues & Tech Corridors', season: 'spring' }
    },

    VEHICLES: {
      swift: { id: 'swift', name: 'Raftaar GT Hatch', maxSpeed: 44.0, accel: 18.0, drag: 0.80, brake: 30.0 },
      chotahathi: { id: 'chotahathi', name: 'Gaja 500 Mini Truck', maxSpeed: 30.0, accel: 12.0, drag: 0.85, brake: 26.0 },
      scooter: { id: 'scooter', name: 'Vayu Volt Scooter', maxSpeed: 34.0, accel: 16.0, drag: 0.90, brake: 24.0 },
      cycle: { id: 'cycle', name: 'Pawan Pedaler Bike', maxSpeed: 22.0, accel: 10.0, drag: 0.95, brake: 20.0 }
    },

    DIFFICULTY_TIERS: {
      easy: { id: 'easy', name: 'Relaxed Shift', timeLimit: 55.0, minHouseDist: 4.5, maxHouseDist: 7.0, tossRadius: 7.5, payoutMult: 1.0 },
      medium: { id: 'medium', name: 'City Standard', timeLimit: 36.0, minHouseDist: 7.0, maxHouseDist: 14.0, tossRadius: 5.2, payoutMult: 1.5 },
      hard: { id: 'hard', name: 'Rush Hour Express', timeLimit: 22.0, minHouseDist: 10.0, maxHouseDist: 25.0, tossRadius: 3.6, payoutMult: 2.5 }
    },

    ORDERS_BY_CITY: {
      mumbai: [
        { id: 101, name: 'Deshmukh Chawl (Doorstep 3A)', cargo: '2x Hot Dabbawala Lunch & Buttermilk', reward: 65 },
        { id: 102, name: 'Bandra Seaside Bungalow', cargo: 'Irani Chai, Maska Bun & Pastries', reward: 85 },
        { id: 103, name: 'Nariman Point Tech Towers', cargo: 'Urgent Legal Dispatch & Hard Disk', reward: 110 },
        { id: 104, name: 'Kulkarni Wada (Behind Banyan Tree)', cargo: 'Festival Sweets & Kaju Katli Gift', reward: 75 },
        { id: 105, name: 'Worli Sea Face Residency', cargo: 'Vada Pav & Cutting Chai Combo', reward: 60 },
        { id: 106, name: 'Dadar Market Chawl', cargo: 'Traditional Thali & Modak Box', reward: 95 },
        { id: 107, name: 'Powai Hilltop Villa', cargo: 'Dual Laptop Charger & Espresso', reward: 120 },
        { id: 108, name: 'Matunga Hidden Courtyard', cargo: 'Fresh Morning A2 Milk Bottles', reward: 55 }
      ],
      delhi: [
        { id: 201, name: 'Chandni Chowk Haveli', cargo: 'Hot Parathas & Lassi Kulhad', reward: 65 },
        { id: 202, name: 'Hauz Khas Village Flat', cargo: 'Butter Chicken & Naan Tiffin', reward: 85 },
        { id: 203, name: 'Connaught Place Tech Towers', cargo: 'Urgent Legal Dispatch & Hard Disk', reward: 110 },
        { id: 204, name: 'Civil Lines Heritage Kothi', cargo: 'Morning Gazette & Artisanal Tea', reward: 75 },
        { id: 205, name: 'Karol Bagh Market Kothi', cargo: 'Festival Sweets & Kaju Katli Gift', reward: 60 },
        { id: 206, name: 'Lodhi Colony Residency', cargo: 'Chole Bhature & Sweet Lassi', reward: 95 },
        { id: 207, name: 'Vasant Vihar Hilltop Villa', cargo: 'Dual Laptop Charger & Espresso', reward: 120 },
        { id: 208, name: 'Nizamuddin Hidden Courtyard', cargo: 'Fresh Morning A2 Milk Bottles', reward: 55 }
      ],
      kolkata: [
        { id: 301, name: 'College Street Bonedi Bari', cargo: '2x Hot Kathi Rolls & Buttermilk', reward: 65 },
        { id: 302, name: 'Howrah Riverfront Residency', cargo: 'Traditional Biryani & Rasgullas', reward: 95 },
        { id: 303, name: 'Park Street Tech Towers', cargo: 'Urgent Legal Dispatch & Hard Disk', reward: 110 },
        { id: 304, name: 'Shobhabazar Rajbari Courtyard', cargo: 'Festival Sweets & Sandesh Gift', reward: 75 },
        { id: 305, name: 'Ballygunge Heritage Kothi', cargo: 'Morning Gazette & Darjeeling Tea', reward: 60 },
        { id: 306, name: 'Salt Lake Sector Flat', cargo: 'Fish Curry & Steamed Rice Tiffin', reward: 85 },
        { id: 307, name: 'Alipore Hilltop Villa', cargo: 'Dual Laptop Charger & Espresso', reward: 120 },
        { id: 308, name: 'Kumartuli Hidden Courtyard', cargo: 'Fresh Morning A2 Milk Bottles', reward: 55 }
      ],
      pune: [
        { id: 401, name: 'Sadashiv Peth Wada', cargo: '2x Hot Misal Pav & Buttermilk', reward: 65 },
        { id: 402, name: 'Koregaon Park Bungalow', cargo: 'Irani Chai, Maska Bun & Pastries', reward: 85 },
        { id: 403, name: 'Hinjewadi Tech Towers', cargo: 'Urgent Legal Dispatch & Hard Disk', reward: 110 },
        { id: 404, name: 'Kulkarni Wada (Behind Banyan Tree)', cargo: 'Festival Sweets & Kaju Katli Gift', reward: 75 },
        { id: 405, name: 'Deccan Gymkhana Kothi', cargo: 'Morning Gazette & Artisanal Tea', reward: 60 },
        { id: 406, name: 'Shaniwar Peth Residency', cargo: 'Puran Poli & Sol Kadhi Tiffin', reward: 95 },
        { id: 407, name: 'Baner Hilltop Villa', cargo: 'Dual Laptop Charger & Espresso', reward: 120 },
        { id: 408, name: 'Sadashiv Peth Hidden Courtyard', cargo: 'Fresh Morning A2 Milk Bottles', reward: 55 }
      ],
      bangalore: [
        { id: 501, name: 'Malleswaram Doorstep', cargo: '2x Hot Masala Dosa & Buttermilk', reward: 65 },
        { id: 502, name: 'Indiranagar Bungalow', cargo: 'Filter Kaapi & Bun Maska', reward: 85 },
        { id: 503, name: 'Whitefield Tech Towers', cargo: 'Urgent Legal Dispatch & Hard Disk', reward: 110 },
        { id: 504, name: 'Basavanagudi Wada Courtyard', cargo: 'Festival Sweets & Mysore Pak Gift', reward: 75 },
        { id: 505, name: 'Jayanagar Heritage Kothi', cargo: 'Morning Gazette & Artisanal Tea', reward: 60 },
        { id: 506, name: 'HSR Layout Residency', cargo: 'Bisi Bele Bath & Rasam Tiffin', reward: 95 },
        { id: 507, name: 'Koramangala Hilltop Villa', cargo: 'Dual Laptop Charger & Espresso', reward: 120 },
        { id: 508, name: 'Basavanagudi Hidden Courtyard', cargo: 'Fresh Morning A2 Milk Bottles', reward: 55 }
      ]
    }
  };

  // --------------------------------------------------------------------------
  // 5. SLOW ROADS PROCEDURAL TERRAIN & DUAL-GRID ARCHITECTURE
  // --------------------------------------------------------------------------
  class ProceduralWorld {
    constructor(seed = '5927cd04', seasonKey = 'autumn', cityKey = 'mumbai') {
      this.seed = seed;
      this.seasonKey = seasonKey;
      this.cityKey = cityKey;
      this.prng = new PRNG(seed);
      this.simplex = new SimplexNoise(this.prng);
      this.splineNodes = [];
      this.curve = null;
      this.roadMesh = null;
      this.terrainMesh = null;
      this.skyMesh = null;
      this.foliageGroup = new THREE.Group();
      this.trafficVehicles = [];
      this.deliveryTargets = [];
      this.potholes = [];

      this.generateSpline();
    }

    // 1. FBM (Fractal Brownian Motion) + Domain Warping Terrain Evaluator
    getRawTerrainHeight(x, z) {
      // Domain Warping
      const warpX = this.simplex.noise2D(x * 0.0015, z * 0.0015) * 45.0;
      const warpZ = this.simplex.noise2D(z * 0.0015, x * 0.0015) * 45.0;
      const wx = x + warpX;
      const wz = z + warpZ;

      // 4-Octave FBM (Fractal Brownian Motion)
      let h = 0;
      h += this.simplex.noise2D(wx * 0.002, wz * 0.002) * 38.0;
      h += this.simplex.noise2D(wx * 0.006, wz * 0.006) * 16.0;
      h += this.simplex.noise2D(wx * 0.018, wz * 0.018) * 5.5;
      h += this.simplex.noise2D(wx * 0.045, wz * 0.045) * 1.5;
      return h;
    }

    generateSpline() {
      this.splineNodes = [];
      const nodeCount = CONFIG.ROAD_POINTS_COUNT; // 500 nodes
      const stepDist = 10.0; // Anslo 10m Incremental Step Scout

      let curX = 0;
      let curZ = 0;
      let curAngle = 0;
      let curY = this.getRawTerrainHeight(0, 0) + 0.8;

      const angleHistory = [];
      const repulsors = [];

      // City tuning parameters for regional topography
      let windingWeight = 0.55;
      let maxGrade = 0.08; // 8% maximum highway slope

      if (this.cityKey === 'pune') {
        windingWeight = 0.85; // High winding ghats & wadas
        maxGrade = 0.12;
      } else if (this.cityKey === 'mumbai') {
        windingWeight = 0.60;
        maxGrade = 0.07;
      } else if (this.cityKey === 'delhi') {
        windingWeight = 0.35;
        maxGrade = 0.05;
      } else if (this.cityKey === 'kolkata') {
        windingWeight = 0.48;
        maxGrade = 0.06;
      } else { // bangalore
        windingWeight = 0.65;
        maxGrade = 0.09;
      }

      const candidateDeltas = [-0.30, -0.15, 0.0, 0.15, 0.30]; // Smooth sweeping curves (±17°, ±8.5°, 0°)

      for (let i = 0; i < nodeCount; i++) {
        this.splineNodes.push(new THREE.Vector3(curX, curY, curZ));
        angleHistory.push(curAngle);
        if (i % 8 === 0) {
          repulsors.push(new THREE.Vector2(curX, curZ));
        }

        // Long-term macro corridor bias (drifting gently forward while weaving)
        const macroNoise = this.simplex.noise2D(curX * 0.0006, curZ * 0.0006) * 1.8;
        const targetBias = macroNoise * windingWeight;

        let bestAngle = curAngle;
        let bestScore = Infinity;
        let bestCandidateY = curY;

        for (let k = 0; k < candidateDeltas.length; k++) {
          const delta = candidateDeltas[k];
          const candAngle = curAngle + delta;

          // 1. Tiered Angular Checks (Prevents hairpin self-intersections)
          let angleViolated = false;
          // Short window (50m = 5 steps): <= 90 deg (1.57 rad)
          if (angleHistory.length >= 5) {
            const sumTurn5 = Math.abs(candAngle - angleHistory[angleHistory.length - 5]);
            if (sumTurn5 > 1.57) angleViolated = true;
          }
          // Medium window (150m = 15 steps): <= 160 deg (2.79 rad)
          if (angleHistory.length >= 15) {
            const sumTurn15 = Math.abs(candAngle - angleHistory[angleHistory.length - 15]);
            if (sumTurn15 > 2.79) angleViolated = true;
          }
          // Long window (300m = 30 steps): <= 200 deg (3.49 rad)
          if (angleHistory.length >= 30) {
            const sumTurn30 = Math.abs(candAngle - angleHistory[angleHistory.length - 30]);
            if (sumTurn30 > 3.49) angleViolated = true;
          }

          if (angleViolated) continue;

          // Candidate position
          const candX = curX + Math.sin(candAngle) * stepDist;
          const candZ = curZ + Math.cos(candAngle) * stepDist;

          // 2. Sample Terrain Elevation & Longitudinal Slope Grade
          const rawTerrainY = this.getRawTerrainHeight(candX, candZ);
          // Target elevation stays near ground contour, smoothed
          let candY = THREE.MathUtils.lerp(curY, rawTerrainY + 0.6, 0.25);
          const slopeGrade = Math.abs(candY - curY) / stepDist;

          // 3. Repulsor Distance Force (Anti-looping)
          let repulsorForce = 0;
          for (let r = 0; r < repulsors.length; r++) {
            const d = repulsors[r].distanceTo(new THREE.Vector2(candX, candZ));
            if (d < 50.0) {
              repulsorForce += (50.0 - d) * 3.0;
            }
          }

          // 4. Multi-Factor Cost Function Scoring
          const angleCost = Math.abs(candAngle - curAngle - targetBias * 0.2);
          const slopeCost = Math.max(0, slopeGrade - maxGrade) * 35.0 + slopeGrade * 5.0;
          const score = slopeCost * 1.5 + angleCost * 2.0 + repulsorForce;

          if (score < bestScore) {
            bestScore = score;
            bestAngle = candAngle;
            bestCandidateY = candY;
          }
        }

        curAngle = THREE.MathUtils.lerp(curAngle, bestAngle, 0.45);
        // Clamp slope grade to maximum allowed
        const yDelta = Math.max(-maxGrade * stepDist, Math.min(maxGrade * stepDist, bestCandidateY - curY));
        curY += yDelta;
        curX += Math.sin(curAngle) * stepDist;
        curZ += Math.cos(curAngle) * stepDist;
      }

      this.curve = new THREE.CatmullRomCurve3(this.splineNodes, false, 'centripetal');

      // Bounding box of the actual road extent — the spline is a random
      // walk and does not stay centered near the origin, so anything that
      // needs to blanket the whole world (e.g. the background floor) must
      // size and center itself off this, not off a fixed assumption.
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const n of this.splineNodes) {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.z < minZ) minZ = n.z;
        if (n.z > maxZ) maxZ = n.z;
      }
      this.worldBounds = { minX, maxX, minZ, maxZ };
    }

    createSkyDome(season, todKey = 'day') {
      const tod = CONFIG.TIME_OF_DAY[todKey] || CONFIG.TIME_OF_DAY.day;
      const geom = new THREE.SphereGeometry(1100, 32, 24);

      // Vertex-colored atmospheric gradient from zenith to nadir
      const topCol = new THREE.Color(tod.skyTop);
      const horizCol = new THREE.Color(tod.skyHorizon);
      const botCol = new THREE.Color(tod.skyBottom);

      const pos = geom.attributes.position;
      const colors = [];
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const normY = y / 1100; // -1 to +1
        const vertexCol = new THREE.Color();
        if (normY > 0) {
          vertexCol.lerpColors(horizCol, topCol, Math.pow(normY, 0.75));
        } else {
          vertexCol.lerpColors(horizCol, botCol, Math.min(1.0, -normY * 1.5));
        }
        colors.push(vertexCol.r, vertexCol.g, vertexCol.b);
      }
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const skyMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        depthWrite: false
      });

      this.skyMesh = new THREE.Mesh(geom, skyMat);

      // Add Twinkling Stars for Night & Dusk
      const starGeom = new THREE.BufferGeometry();
      const starPos = [];
      for (let s = 0; s < 600; s++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * (Math.PI / 2.3); // Upper dome only
        const r = 1040;
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);
        starPos.push(x, y, z);
      }
      starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2.8,
        transparent: true,
        opacity: (tod.night ? 0.95 : (tod.id === 'dusk' ? 0.45 : 0.0))
      });
      this.starMesh = new THREE.Points(starGeom, starMat);
      this.skyMesh.add(this.starMesh);

      // Add Fluffy Low-Poly 3D Cumulus Clouds
      this.createClouds(todKey);

      return this.skyMesh;
    }

    createClouds(todKey = 'day') {
      if (this.cloudGroup) {
        this.skyMesh.remove(this.cloudGroup);
      }
      this.cloudGroup = new THREE.Group();
      this.clouds = [];
      const tod = CONFIG.TIME_OF_DAY[todKey] || CONFIG.TIME_OF_DAY.day;

      let cloudColor = 0xffffff;
      let cloudOpacity = 0.95;
      if (tod.night) {
        cloudColor = 0xaab8dc;
        cloudOpacity = 0.6;
      } else if (tod.id === 'dusk') {
        cloudColor = 0xffcba3;
        cloudOpacity = 0.92;
      } else if (tod.id === 'dawn') {
        cloudColor = 0xfff3b0;
        cloudOpacity = 0.92;
      }

      const cloudMat = new THREE.MeshBasicMaterial({
        color: cloudColor,
        transparent: true,
        opacity: cloudOpacity
      });

      // Spawn 16 fluffy low-poly cumulus clouds drifting across the sky dome
      for (let c = 0; c < 16; c++) {
        const cloud = new THREE.Group();
        const puffCount = 4 + Math.floor(this.prng.next() * 3);
        for (let p = 0; p < puffCount; p++) {
          const radius = this.prng.range(14.0, 26.0);
          const puffGeom = new THREE.DodecahedronGeometry(radius, 1);
          const puff = new THREE.Mesh(puffGeom, cloudMat);
          puff.position.set(
            (p - puffCount / 2) * 18.0 + this.prng.range(-6, 6),
            this.prng.range(-4, 6),
            this.prng.range(-8, 8)
          );
          puff.scale.set(1.0, 0.65, 0.85);
          cloud.add(puff);
        }

        const angle = this.prng.range(0, Math.PI * 2);
        const dist = this.prng.range(220, 680);
        const altitude = this.prng.range(110, 240);

        cloud.position.set(
          Math.sin(angle) * dist,
          altitude,
          Math.cos(angle) * dist
        );
        cloud.userData = {
          speedX: this.prng.range(1.5, 4.0),
          speedZ: this.prng.range(0.8, 2.5),
          bounds: 800
        };

        this.clouds.push(cloud);
        this.cloudGroup.add(cloud);
      }

      this.skyMesh.add(this.cloudGroup);
      return this.cloudGroup;
    }

    updateClouds(dt) {
      if (!this.clouds) return;
      this.clouds.forEach(cl => {
        cl.position.x += cl.userData.speedX * dt;
        cl.position.z += cl.userData.speedZ * dt;
        if (cl.position.x > cl.userData.bounds) cl.position.x = -cl.userData.bounds;
        if (cl.position.z > cl.userData.bounds) cl.position.z = -cl.userData.bounds;
      });
    }

    createRoadMesh(roadTerrainKey = 'asphalt') {
      const tubularSegments = 1200;
      const roadWidth = CONFIG.ROAD_WIDTH;
      const shoulderWidth = 1.8;
      const geom = new THREE.BufferGeometry();

      const positions = [];
      const colors = [];
      const normals = [];
      const indices = [];

      const points = this.curve.getSpacedPoints(tubularSegments);
      const tCfg = CONFIG.ROAD_TERRAINS[roadTerrainKey] || CONFIG.ROAD_TERRAINS.asphalt;
      const baseTarmac = new THREE.Color(tCfg.color);
      const vergeColor = new THREE.Color(tCfg.color).multiplyScalar(0.72);
      const whiteLine = new THREE.Color(0xf8fafc);
      const yellowLine = new THREE.Color(0xfacc15);

      // 7-Point Cross-Section with Painted Road Stripes
      const offsets = [
        -roadWidth * 0.5 - shoulderWidth, // 0: Left Verge Outer
        -roadWidth * 0.5,                  // 1: Left Solid Edge Stripe
        -roadWidth * 0.46,                 // 2: Left Lane Tarmac
        0.0,                               // 3: Center Yellow Divider
        roadWidth * 0.46,                  // 4: Right Lane Tarmac
        roadWidth * 0.5,                   // 5: Right Solid Edge Stripe
        roadWidth * 0.5 + shoulderWidth    // 6: Right Verge Outer
      ];

      for (let i = 0; i <= tubularSegments; i++) {
        const pt = points[i];

        let tangent;
        if (i === 0) {
          tangent = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
        } else if (i === tubularSegments) {
          tangent = new THREE.Vector3().subVectors(points[tubularSegments], points[tubularSegments - 1]).normalize();
        } else {
          tangent = new THREE.Vector3().subVectors(points[i + 1], points[i - 1]).normalize();
        }

        const worldUp = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
        const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

        // Dynamic Curvature Banking Angle
        let curvatureY = 0;
        if (i < tubularSegments - 1) {
          const nextTang = new THREE.Vector3().subVectors(points[i + 2], points[i]).normalize();
          curvatureY = (nextTang.x - tangent.x) * 10.0;
        }

        const bankingAngle = THREE.MathUtils.clamp(curvatureY * 0.25, -0.14, 0.14);
        const bankedNormal = normal.clone().multiplyScalar(Math.cos(bankingAngle)).addScaledVector(binormal, Math.sin(bankingAngle)).normalize();
        const bankedUp = binormal.clone().multiplyScalar(Math.cos(bankingAngle)).addScaledVector(normal, -Math.sin(bankingAngle)).normalize();

        const isDashedGap = (i % 8 >= 4); // Dashed center lane pattern

        for (let j = 0; j < offsets.length; j++) {
          const off = offsets[j];
          const isVerge = (j === 0 || j === 6);
          const p = pt.clone().addScaledVector(bankedNormal, off);
          p.addScaledVector(bankedUp, isVerge ? 0.04 : 0.12);
          positions.push(p.x, p.y, p.z);
          normals.push(bankedUp.x, bankedUp.y, bankedUp.z);

          // Assign sharp vertex colors for asphalt and highway paint
          if (j === 0 || j === 6) {
            colors.push(vergeColor.r, vergeColor.g, vergeColor.b);
          } else if (j === 1 || j === 5) {
            colors.push(whiteLine.r, whiteLine.g, whiteLine.b);
          } else if (j === 3) {
            if (isDashedGap) {
              colors.push(baseTarmac.r, baseTarmac.g, baseTarmac.b);
            } else {
              colors.push(yellowLine.r, yellowLine.g, yellowLine.b);
            }
          } else {
            colors.push(baseTarmac.r, baseTarmac.g, baseTarmac.b);
          }
        }

        if (i < tubularSegments) {
          const row1 = i * 7;
          const row2 = (i + 1) * 7;
          for (let j = 0; j < 6; j++) {
            indices.push(row1 + j, row1 + j + 1, row2 + j);
            indices.push(row1 + j + 1, row2 + j + 1, row2 + j);
          }
        }
      }

      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      const roadMaterial = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide
      });

      this.roadMesh = new THREE.Mesh(geom, roadMaterial);
      this.roadMesh.receiveShadow = true;
      return this.roadMesh;
    }

    createTerrainMesh(season) {
      const tubularSegments = 800;
      const roadHalf = CONFIG.ROAD_WIDTH * 0.52; // ~4.16m
      const lateralSlices = [
        -40.0, -20.0, -9.0, -roadHalf,
         roadHalf, 9.0, 20.0, 40.0
      ];
      const sliceCount = lateralSlices.length;

      const positions = [];
      const colors = [];
      const normals = [];
      const indices = [];

      const grassCol = new THREE.Color(season.grassColor);
      const grassLight = new THREE.Color(season.grassLight);
      const cliffCol = new THREE.Color(season.cliffColor);

      const points = this.curve.getSpacedPoints(tubularSegments);

      for (let i = 0; i <= tubularSegments; i++) {
        const pt = points[i];

        let tangent;
        if (i === 0) {
          tangent = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
        } else if (i === tubularSegments) {
          tangent = new THREE.Vector3().subVectors(points[tubularSegments], points[tubularSegments - 1]).normalize();
        } else {
          tangent = new THREE.Vector3().subVectors(points[i + 1], points[i - 1]).normalize();
        }

        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        for (let j = 0; j < sliceCount; j++) {
          const latDist = lateralSlices[j];
          const absDist = Math.abs(latDist);

          const worldPos = pt.clone().addScaledVector(normal, latDist);
          let finalY = pt.y;

          if (absDist <= roadHalf) {
            // 1. Under Asphalt: strictly 0.18m below road surface
            finalY = pt.y - 0.18;
            colors.push(grassLight.r, grassLight.g, grassLight.b);
          } else if (absDist <= 9.0) {
            // 2. Road Shoulder Verge: gentle downward slope from road edge
            const t = (absDist - roadHalf) / (9.0 - roadHalf);
            finalY = pt.y - 0.18 - t * 0.32;
            colors.push(grassLight.r * 0.95, grassLight.g * 0.95, grassLight.b * 0.95);
          } else {
            // 3. Embankment Carving: Smooth terrain transition from road edge to raw hills
            // Road is carved into terrain with embankments (cut/fill slopes)
            const rawH = this.getRawTerrainHeight(worldPos.x, worldPos.z);

            // Define embankment zones (in meters from road center)
            const SHOULDER_TRANSITION = 9.0;  // End of shoulder
            const EMBANKMENT_BLEND = 45.0;    // Fully back to raw terrain

            // Smoothly blend from road shoulder to raw terrain height
            // This creates a natural slope down from the road edge to surrounding landscape
            const blendFactor = THREE.MathUtils.smoothstep(absDist, SHOULDER_TRANSITION, EMBANKMENT_BLEND);

            // Embankment starts at road-level minus a shoulder drop, blends to raw terrain
            const shoulderDrop = pt.y - 0.5;  // 50cm down from road surface
            const embankmentHeight = THREE.MathUtils.lerp(shoulderDrop, rawH, blendFactor);

            // Clamp to ensure road is never buried; terrain can rise up to road level
            finalY = Math.min(pt.y + 0.2, embankmentHeight);

            if (rawH > 22.0) {
              colors.push(cliffCol.r, cliffCol.g, cliffCol.b);
            } else {
              const nVal = 0.85 + this.simplex.noise2D(worldPos.x * 0.04, worldPos.z * 0.04) * 0.25;
              colors.push(grassCol.r * nVal, grassCol.g * nVal, grassCol.b * nVal);
            }
          }

          positions.push(worldPos.x, finalY, worldPos.z);
          normals.push(0, 1, 0);

          if (i < tubularSegments && j < sliceCount - 1) {
            const row1 = i * sliceCount + j;
            const row2 = (i + 1) * sliceCount + j;
            indices.push(row1, row1 + 1, row2);
            indices.push(row1 + 1, row2 + 1, row2);
          }
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      const terrainMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide
      });

      this.terrainMesh = new THREE.Mesh(geom, terrainMat);
      this.terrainMesh.receiveShadow = true;
      return this.terrainMesh;
    }

    // The road-hugging terrain ribbon above only extends ±40m from the
    // road centerline. Since the spline winds and loops back on itself
    // over its ~5km length, distant loops of road would otherwise render
    // as disconnected islands floating over open sky. This large, coarse
    // background plane fills that void with continuous ground so every
    // visible part of the world sits on land.
    createWorldFloor(season) {
      // Size and center the floor off the road spline's actual bounding
      // box (it's a random walk, not centered near the origin) with a
      // generous margin, instead of assuming a fixed origin-centered size —
      // otherwise large stretches of road fall outside the floor entirely.
      const b = this.worldBounds;
      const margin = 500.0;
      const spanX = (b.maxX - b.minX) + margin * 2;
      const spanZ = (b.maxZ - b.minZ) + margin * 2;
      const size = Math.max(spanX, spanZ, CONFIG.TERRAIN_SIZE);
      const centerX = (b.minX + b.maxX) / 2;
      const centerZ = (b.minZ + b.maxZ) / 2;

      // Keep grid cells small enough (~15m) to track the terrain noise
      // closely — too coarse and the floor's interpolated surface diverges
      // from the ribbon terrain's fine sampling, opening visible gaps.
      const segments = Math.min(400, Math.ceil(size / 15));

      const geom = new THREE.PlaneGeometry(size, size, segments, segments);
      geom.rotateX(-Math.PI / 2);
      geom.translate(centerX, 0, centerZ);

      const grassCol = new THREE.Color(season.grassColor);
      const grassLight = new THREE.Color(season.grassLight);
      const cliffCol = new THREE.Color(season.cliffColor);

      // Dense sample of the road curve, used to keep the floor from
      // burying the road on hills. Two earlier versions of this code
      // approximated a "clamp toward road height" with their own simplified
      // formula that only roughly agreed with the ribbon's actual
      // embankment math — close but not equal, leaving real multi-meter
      // gaps at the seam (measured directly: up to 18m even after tightening
      // the sample spacing). Sampling from curve.getSpacedPoints (the same
      // 800-point sampling createTerrainMesh itself uses) and reusing its
      // exact formula below removes the approximation entirely.
      const roadSamples = this.curve.getSpacedPoints(260);

      const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
      const SHOULDER_TRANSITION = 9.0;
      const EMBANKMENT_BLEND = 45.0;

      const pos = geom.attributes.position;
      const colors = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const rawH = this.getRawTerrainHeight(x, z);

        let nearestDistSq = Infinity;
        let nearestRoadY = Infinity;
        for (let s = 0; s < roadSamples.length; s++) {
          const dx = x - roadSamples[s].x;
          const dz = z - roadSamples[s].z;
          const dSq = dx * dx + dz * dz;
          if (dSq < nearestDistSq) {
            nearestDistSq = dSq;
            nearestRoadY = roadSamples[s].y;
          }
        }

        const naturalY = rawH - 0.3;
        let finalY = naturalY;
        const dist = Math.sqrt(nearestDistSq);
        if (dist <= EMBANKMENT_BLEND) {
          if (dist <= SHOULDER_TRANSITION) {
            // Always hidden under the ribbon here — just keep it far
            // enough below that the camera can never clip through it.
            finalY = nearestRoadY - 25.0;
          } else {
            // Exact replica of createTerrainMesh's embankment formula
            // (same shoulderDrop/lerp/clamp), using the nearest sampled
            // curve point in place of that formula's own `pt`. At
            // dist === EMBANKMENT_BLEND this reduces to exactly naturalY
            // (blendFactor=1 → embankmentHeight=rawH → ribbonY≈rawH),
            // matching the >45m branch by construction — continuous at
            // the seam, not just approximately close.
            const blendFactor = THREE.MathUtils.smoothstep(dist, SHOULDER_TRANSITION, EMBANKMENT_BLEND);
            const shoulderDrop = nearestRoadY - 0.5;
            const embankmentHeight = THREE.MathUtils.lerp(shoulderDrop, rawH, blendFactor);
            const ribbonY = Math.min(nearestRoadY + 0.2, embankmentHeight);
            finalY = ribbonY - 0.3;
          }
        }
        pos.setY(i, finalY);

        if (rawH > 22.0) {
          colors.push(cliffCol.r, cliffCol.g, cliffCol.b);
        } else {
          const mixT = (this.simplex.noise2D(x * 0.008, z * 0.008) + 1) / 2;
          const c = grassCol.clone().lerp(grassLight, mixT * 0.5);
          colors.push(c.r, c.g, c.b);
        }
      }
      geom.computeVertexNormals();
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const floorMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide
      });

      this.floorMesh = new THREE.Mesh(geom, floorMat);
      this.floorMesh.receiveShadow = true;
      return this.floorMesh;
    }

    createFoliageAndProps(scene, season, difficulty = 'medium') {
      this.foliageGroup.clear();
      this.deliveryTargets = [];
      this.trafficVehicles = [];
      this.potholes = [];
      this.speedCameras = [];
      this.repairBays = [];
      this.obstacles = [];

      const diffCfg = CONFIG.DIFFICULTY_TIERS[difficulty] || CONFIG.DIFFICULTY_TIERS.medium;

      // Reusable Low-Poly Foliage & Prop Geometries
      const trunkGeom = new THREE.CylinderGeometry(0.25, 0.45, 2.8, 6);
      const pineLeavesGeom = new THREE.ConeGeometry(2.4, 5.0, 6);
      const decLeavesGeom = new THREE.DodecahedronGeometry(2.4, 0);
      const bushGeom = new THREE.DodecahedronGeometry(1.2, 0);
      const rockGeom = new THREE.DodecahedronGeometry(1.6, 0);
      const poleGeom = new THREE.CylinderGeometry(0.1, 0.12, 6.5, 6);
      const crossbarGeom = new THREE.BoxGeometry(1.8, 0.12, 0.12);

      const trunkMat = new THREE.MeshPhongMaterial({ color: 0x3d2b1f, flatShading: true });
      const rockMat = new THREE.MeshPhongMaterial({ color: 0x5a6065, flatShading: true });
      const poleMat = new THREE.MeshPhongMaterial({ color: 0x4a4e52, flatShading: true });

      const potholeGeom = new THREE.CircleGeometry(1.3, 12);
      potholeGeom.rotateX(-Math.PI / 2);
      const potholeMat = new THREE.MeshBasicMaterial({ color: 0x0a0c10 });

      const rumbleGeom = new THREE.BoxGeometry(CONFIG.ROAD_WIDTH * 0.82, 0.08, 0.45);
      const rumbleMat = new THREE.MeshLambertMaterial({ color: 0xfca311 });

      // Skyscraper window-grid texture, generated once on a canvas and
      // reused (tinted per-building via material color) across every tower
      // so the city skyline doesn't need per-building unique geometry.
      const skyscraperWindowTex = (() => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 32, 64);
        const cols = 4, rows = 10;
        const cw = 32 / cols, rh = 64 / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (this.prng.next() > 0.4) {
              ctx.fillStyle = this.prng.next() > 0.15 ? '#ffe08a' : '#9fd0ff';
              ctx.fillRect(c * cw + 1, r * rh + 1, cw - 2, rh - 2);
            }
          }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      })();
      // Single fixed glass tint for every skyscraper — previously a random
      // pick from a 6-color palette, which occasionally read as an odd
      // stray-colored blob poking through the treeline at a distance.
      const SKYSCRAPER_GLASS_COLOR = 0x9fc4d8;
      // Low/mid-rise shophouse & apartment colors, tightened to a small,
      // cohesive sandstone/cream set (was 7 widely varied vivid hues —
      // same "random blob through the trees" problem as the skyscrapers).
      const LOWRISE_PALETTE = [0xd9c9a8, 0xe8b04b, 0xc9a876];

      const sampledPoints = this.curve.getSpacedPoints(800);

      for (let i = 2; i < sampledPoints.length - 2; i++) {
        const pt = sampledPoints[i];
        const u = i / sampledPoints.length;
        const tangent = new THREE.Vector3().subVectors(sampledPoints[i + 1], sampledPoints[i - 1]).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        // Terrain height calculator — mirrors createTerrainMesh's embankment
        // carving formula exactly so props sit flush with the ground instead
        // of floating above or sinking below it.
        const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
        const SHOULDER_TRANSITION = 9.0;
        const EMBANKMENT_BLEND = 45.0;
        const calcTerrainY = (pos, latDist) => {
          const absDist = Math.abs(latDist);
          if (absDist <= roadHalf) {
            return pt.y - 0.18;
          } else if (absDist <= SHOULDER_TRANSITION) {
            const t = (absDist - roadHalf) / (SHOULDER_TRANSITION - roadHalf);
            return pt.y - 0.18 - t * 0.32;
          } else {
            const rawH = this.getRawTerrainHeight(pos.x, pos.z);
            const blendFactor = THREE.MathUtils.smoothstep(absDist, SHOULDER_TRANSITION, EMBANKMENT_BLEND);
            const shoulderDrop = pt.y - 0.5;
            const embankmentHeight = THREE.MathUtils.lerp(shoulderDrop, rawH, blendFactor);
            return Math.min(pt.y + 0.2, embankmentHeight);
          }
        };

        // 1. Potholes & Rumble Strips on Road
        if (i % 26 === 0) {
          const potOffset = (this.prng.next() - 0.5) * (CONFIG.ROAD_WIDTH * 0.62);
          const potPos = pt.clone().addScaledVector(normal, potOffset);
          potPos.y += 0.17;
          const potMesh = new THREE.Mesh(potholeGeom, potholeMat);
          potMesh.position.copy(potPos);
          this.foliageGroup.add(potMesh);
          this.potholes.push({ pos: potPos, radius: 1.6, hitRecently: false });
        }

        if (i % 65 === 0) {
          const rumblePos = pt.clone();
          rumblePos.y += 0.17;
          const rumbleMesh = new THREE.Mesh(rumbleGeom, rumbleMat);
          rumbleMesh.position.copy(rumblePos);
          rumbleMesh.lookAt(rumblePos.clone().add(normal));
          this.foliageGroup.add(rumbleMesh);
          this.potholes.push({ pos: rumblePos, radius: 2.2, isRumble: true, hitRecently: false });
        }

        // 2. Roadside Chevron Turn Warning Signs (Yellow/Black <<< >>> on metal poles)
        if (i % 14 === 0 && i < sampledPoints.length - 4) {
          const nextTang = new THREE.Vector3().subVectors(sampledPoints[i + 3], sampledPoints[i - 1]).normalize();
          const turnCurvature = tangent.x * nextTang.z - tangent.z * nextTang.x;

          if (Math.abs(turnCurvature) > 0.015) {
            const outerSide = turnCurvature > 0 ? 1 : -1;
            const signDist = outerSide * (CONFIG.ROAD_WIDTH * 0.5 + 1.8);
            const signPos = pt.clone().addScaledVector(normal, signDist);
            signPos.y = calcTerrainY(signPos, signDist);

            const signGroup = new THREE.Group();
            // Metal post
            const postGeom = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6);
            const postMat = new THREE.MeshLambertMaterial({ color: 0x8a929a });
            const post = new THREE.Mesh(postGeom, postMat);
            post.position.y = 0.9;
            signGroup.add(post);

            // Yellow/Black Chevron Box
            const boardGeom = new THREE.BoxGeometry(1.2, 0.9, 0.08);
            const boardMat = new THREE.MeshLambertMaterial({ color: 0xfca311 });
            const board = new THREE.Mesh(boardGeom, boardMat);
            board.position.y = 1.6;

            // Black inner chevron symbol
            const chevGeom = new THREE.BoxGeometry(0.8, 0.6, 0.1);
            const chevMat = new THREE.MeshBasicMaterial({ color: 0x111318 });
            const chev = new THREE.Mesh(chevGeom, chevMat);
            chev.position.set(0, 1.6, 0.01);

            signGroup.add(board);
            signGroup.add(chev);
            signGroup.position.copy(signPos);
            signGroup.lookAt(pt.clone().addScaledVector(tangent, -6.0));
            this.foliageGroup.add(signGroup);
            this.obstacles.push({ pos: signPos.clone(), radius: 0.9, type: 'sign' });
          }
        }

        // 3. Roadside Electric Utility Poles
        if (i % 24 === 0) {
          const latDist = CONFIG.ROAD_WIDTH * 0.5 + 2.2;
          const polePos = pt.clone().addScaledVector(normal, latDist);
          polePos.y = calcTerrainY(polePos, latDist);
          const pole = new THREE.Mesh(poleGeom, poleMat);
          pole.position.copy(polePos);
          pole.position.y += 3.2;

          const crossbar = new THREE.Mesh(crossbarGeom, poleMat);
          crossbar.position.set(0, 2.6, 0);
          pole.add(crossbar);
          this.foliageGroup.add(pole);
          this.obstacles.push({ pos: polePos.clone(), radius: 0.9, type: 'pole' });
        }

        // 4. Overhead Traffic Police Speed Radar Gantries
        if (i % 52 === 0 && i > 15) {
          const gantryGroup = new THREE.Group();
          const gantryHeight = 5.2;
          const gantrySpan = CONFIG.ROAD_WIDTH + 2.8;

          // Side pillars
          [-gantrySpan / 2, gantrySpan / 2].forEach(xOff => {
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, gantryHeight, 8), poleMat);
            pillar.position.set(xOff, gantryHeight / 2, 0);
            gantryGroup.add(pillar);
          });

          // Overhead Crossbeam
          const beam = new THREE.Mesh(new THREE.BoxGeometry(gantrySpan, 0.35, 0.35), poleMat);
          beam.position.set(0, gantryHeight - 0.2, 0);
          gantryGroup.add(beam);

          // Speed Limit 75 Sign Board
          const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
          signBoard.position.set(0, gantryHeight + 0.5, 0);
          const innerRing = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
          innerRing.rotateX(Math.PI / 2);
          innerRing.position.set(0, gantryHeight + 0.5, 0.02);
          gantryGroup.add(signBoard);
          gantryGroup.add(innerRing);

          // Camera Lens Units with Strobes
          [-1.4, 1.4].forEach(cx => {
            const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.5), new THREE.MeshLambertMaterial({ color: 0x111827 }));
            camBox.position.set(cx, gantryHeight - 0.45, 0.2);
            const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8), new THREE.MeshBasicMaterial({ color: 0x00f5d4 }));
            lens.rotateX(Math.PI / 2);
            lens.position.set(cx, gantryHeight - 0.45, 0.48);
            gantryGroup.add(camBox);
            gantryGroup.add(lens);
          });

          gantryGroup.position.copy(pt);
          gantryGroup.lookAt(pt.clone().add(tangent));
          this.foliageGroup.add(gantryGroup);

          this.speedCameras.push({
            pos: pt.clone(),
            speedLimit: 20.8, // 75 km/h in m/s
            speedLimitKmh: 75,
            triggeredRecently: false
          });

          this.obstacles.push({ pos: pt.clone().addScaledVector(normal, -gantrySpan / 2), radius: 0.8, type: 'gantry' });
          this.obstacles.push({ pos: pt.clone().addScaledVector(normal, gantrySpan / 2), radius: 0.8, type: 'gantry' });
        }

        // 5. Roadside Garage & Pitstop Repair Bay
        if (i % 75 === 0 && i > 20) {
          const baySide = 1;
          const bayDist = CONFIG.ROAD_WIDTH * 0.5 + 4.8;
          const bayPos = pt.clone().addScaledVector(normal, baySide * bayDist);
          bayPos.y = calcTerrainY(bayPos, baySide * bayDist);

          const garageGroup = new THREE.Group();
          // Garage Shed
          const shedGeom = new THREE.BoxGeometry(5.5, 3.5, 4.8);
          const shedMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
          const shed = new THREE.Mesh(shedGeom, shedMat);
          shed.position.set(0, 1.75, 0);
          garageGroup.add(shed);

          // Sloped 4-sided roof, matching the bus-shelter/tapri roof style
          // used elsewhere so it doesn't read as a bare box.
          const shedRoof = new THREE.Mesh(
            new THREE.ConeGeometry(4.3, 1.4, 4),
            new THREE.MeshLambertMaterial({ color: 0x1e3a5f, flatShading: true })
          );
          shedRoof.position.set(0, 3.5 + 0.7, 0);
          shedRoof.rotateY(Math.PI / 4);
          garageGroup.add(shedRoof);

          // Garage door and window on the road-facing wall (+Z, matching
          // the lookAt(pt) convention used for this group below).
          const shedDoor = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 2.3, 0.1),
            new THREE.MeshLambertMaterial({ color: 0x0f172a })
          );
          shedDoor.position.set(-1.3, 1.15, 2.41);
          garageGroup.add(shedDoor);

          const shedWindow = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 1.0, 0.08),
            new THREE.MeshBasicMaterial({ color: 0xbae6fd })
          );
          shedWindow.position.set(1.3, 2.1, 2.41);
          garageGroup.add(shedWindow);

          // Glowing Green Repair Pad on Ground
          const padGeom = new THREE.RingGeometry(1.6, 3.8, 16);
          padGeom.rotateX(-Math.PI / 2);
          const padMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
          const pad = new THREE.Mesh(padGeom, padMat);
          pad.position.set(0, 0.08, 0);
          garageGroup.add(pad);

          garageGroup.position.copy(bayPos);
          garageGroup.lookAt(pt);
          this.foliageGroup.add(garageGroup);

          this.repairBays.push({
            pos: bayPos.clone(),
            radius: 7.5,
            visitedRecently: false
          });
        }

        // 6. Dense Multi-Tiered Pine & Broadleaf Forests, Rocks, Fences & Lanterns (Left and Right)
        [-1, 1].forEach(side => {
          // Minimum offset kept clear of the vehicle's own max lateral
          // drift (±9m from centerline, see lateralOffset clamp in
          // VehicleController) plus the tree canopy's ~2.4m radius —
          // otherwise trees spawn directly inside the player's drivable
          // area and the car ends up driving through them.
          const nearDist = CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(8.0, 18.0);
          const nearPos = pt.clone().addScaledVector(normal, side * nearDist);
          nearPos.y = calcTerrainY(nearPos, side * nearDist);

          // Winter forces evergreen-only canopy — broadleaf trees would be
          // bare in winter, and we don't model leafless geometry, so we
          // simply keep the forest all-pine rather than showing full green
          // canopies that would look wrong for the season.
          const isPine = season.id === 'winter' ? true : (this.prng.next() > 0.35);
          const leafColHex = season.treeLeaves[Math.floor(this.prng.range(0, season.treeLeaves.length))];
          const leavesMat = new THREE.MeshPhongMaterial({ color: leafColHex, flatShading: true });

          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(trunkGeom, trunkMat);
          trunk.position.y = 1.4;
          tree.add(trunk);

          if (isPine) {
            // Multi-Tiered Forest Pine Tree (3 stacked conical crowns)
            const tierMat1 = new THREE.MeshPhongMaterial({ color: leafColHex, flatShading: true });
            const tierMat2 = new THREE.MeshPhongMaterial({ color: new THREE.Color(leafColHex).multiplyScalar(0.9), flatShading: true });
            const tierMat3 = new THREE.MeshPhongMaterial({ color: new THREE.Color(leafColHex).multiplyScalar(0.8), flatShading: true });

            const crown1 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 7), tierMat1);
            crown1.position.y = 2.4;
            const crown2 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.9, 7), tierMat2);
            crown2.position.y = 3.6;
            const crown3 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 7), tierMat3);
            crown3.position.y = 4.7;

            tree.add(crown1);
            tree.add(crown2);
            tree.add(crown3);
          } else {
            const leaves = new THREE.Mesh(decLeavesGeom, leavesMat);
            leaves.position.y = 3.4;
            tree.add(leaves);
          }

          const scale = this.prng.range(0.9, 1.7);
          tree.scale.set(scale, scale, scale);
          tree.position.copy(nearPos);
          this.foliageGroup.add(tree);
          this.obstacles.push({ pos: nearPos.clone(), radius: 1.3 * scale, type: 'tree' });

          // City Skyline: procedural skyscrapers set well back beyond the
          // treeline so they read as a backdrop rather than roadside clutter.
          // Spaced out per side so towers don't visually collide with each
          // other at close draw distance.
          if (i % 11 === (side > 0 ? 0 : 5) && this.prng.next() > 0.25) {
            const bldgDist = side * this.prng.range(34.0, 78.0);
            const bldgPos = pt.clone().addScaledVector(normal, bldgDist);
            bldgPos.y = calcTerrainY(bldgPos, bldgDist);

            const width = this.prng.range(7.0, 13.0);
            const depth = this.prng.range(7.0, 13.0);

            // Real Indian streetscapes are mostly low/mid-rise shophouses
            // and apartment blocks with the occasional tower punching up —
            // not a uniform wall of skyscrapers. Weight the roll heavily
            // toward short buildings so towers read as landmarks.
            const heightRoll = this.prng.next();
            let height, isGlass;
            if (heightRoll < 0.55) {
              height = this.prng.range(8.0, 20.0);
              isGlass = false;
            } else if (heightRoll < 0.85) {
              height = this.prng.range(20.0, 40.0);
              isGlass = this.prng.next() > 0.5;
            } else {
              height = this.prng.range(40.0, 90.0);
              isGlass = true;
            }
            const isLowRise = height < 20.0;

            // Skyscrapers all share one fixed glass tint (shiny/reflective
            // via the material below); low-rise buildings still draw from
            // a small cohesive palette for street-level variety.
            const bodyColor = isGlass ? SKYSCRAPER_GLASS_COLOR : LOWRISE_PALETTE[Math.floor(this.prng.range(0, LOWRISE_PALETTE.length))];
            const accentColor = isGlass ? SKYSCRAPER_GLASS_COLOR : LOWRISE_PALETTE[Math.floor(this.prng.range(0, LOWRISE_PALETTE.length))];

            const bldgGroup = new THREE.Group();

            const makeFacadeMat = (w, h, color) => {
              // Windows use an emissiveMap rather than a color map so they
              // glow at a constant brightness independent of scene lighting —
              // otherwise the tower reads as a flat dark silhouette at night
              // since ambient/directional light is too dim to reveal a map.
              const tex = skyscraperWindowTex.clone();
              tex.repeat.set(Math.max(1, Math.round(w / 3.2)), Math.max(1, Math.round(h / 4.0)));
              tex.needsUpdate = true;
              if (isGlass) {
                // Shiny reflective glass curtain-wall look: high shininess/
                // specular highlight, slight transparency, cool blue tint.
                return new THREE.MeshPhongMaterial({
                  color,
                  flatShading: true,
                  emissiveMap: tex,
                  emissive: 0xffffff,
                  emissiveIntensity: 0.85,
                  specular: 0xffffff,
                  shininess: 160,
                  transparent: true,
                  opacity: 0.92
                });
              }
              return new THREE.MeshPhongMaterial({
                color,
                flatShading: true,
                emissiveMap: tex,
                emissive: 0xffffff,
                emissiveIntensity: 0.85
              });
            };

            // Four massing archetypes so the skyline doesn't read as one
            // repeated box at different sizes — stepped-tier and podium
            // towers are common in dense Indian commercial districts.
            const archetype = isLowRise ? 0 : Math.floor(this.prng.range(0, 4));

            if (archetype === 0) {
              // Plain slab tower
              const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), makeFacadeMat(width, height, bodyColor));
              body.position.y = height / 2;
              bldgGroup.add(body);
            } else if (archetype === 1) {
              // Stepped-tier tower: wide base, narrower upper block set back
              const baseH = height * 0.55;
              const topH = height - baseH;
              const base = new THREE.Mesh(new THREE.BoxGeometry(width, baseH, depth), makeFacadeMat(width, baseH, bodyColor));
              base.position.y = baseH / 2;
              bldgGroup.add(base);
              const top = new THREE.Mesh(new THREE.BoxGeometry(width * 0.62, topH, depth * 0.62), makeFacadeMat(width * 0.62, topH, accentColor));
              top.position.y = baseH + topH / 2;
              bldgGroup.add(top);
            } else if (archetype === 2) {
              // Podium + tower: squat wide podium floors, slender tower rising off it
              const podiumH = Math.min(10.0, height * 0.18);
              const towerH = height - podiumH;
              const podium = new THREE.Mesh(new THREE.BoxGeometry(width * 1.35, podiumH, depth * 1.35), makeFacadeMat(width * 1.35, podiumH, accentColor));
              podium.position.y = podiumH / 2;
              bldgGroup.add(podium);
              const tower = new THREE.Mesh(new THREE.BoxGeometry(width * 0.68, towerH, depth * 0.68), makeFacadeMat(width * 0.68, towerH, bodyColor));
              tower.position.y = podiumH + towerH / 2;
              bldgGroup.add(tower);
            } else {
              // Twin-block tower: two slim offset blocks of differing height
              const hA = height;
              const hB = height * this.prng.range(0.55, 0.8);
              const blockA = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, hA, depth), makeFacadeMat(width * 0.55, hA, bodyColor));
              blockA.position.set(-width * 0.24, hA / 2, 0);
              bldgGroup.add(blockA);
              const blockB = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, hB, depth * 0.9), makeFacadeMat(width * 0.55, hB, accentColor));
              blockB.position.set(width * 0.28, hB / 2, -depth * 0.05);
              bldgGroup.add(blockB);
            }

            // Parapet / rooftop cap
            const capMat = new THREE.MeshPhongMaterial({ color: 0x6b7480, flatShading: true });
            const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 0.9, depth * 0.7), capMat);
            cap.position.y = height + 0.45;
            bldgGroup.add(cap);

            // Rooftop water tank (common Indian skyline silhouette), antenna, or bare.
            // Low-rise buildings get a water tank far more often — it's the
            // defining rooftop silhouette of Indian residential/shop blocks.
            const roofProp = this.prng.next();
            const tankThreshold = isLowRise ? 0.3 : 0.66;
            if (roofProp > tankThreshold) {
              const tankMat = new THREE.MeshPhongMaterial({ color: 0x3f6b8a, flatShading: true });
              const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 8), tankMat);
              tank.position.set(width * 0.25, height + 1.7, depth * 0.2);
              bldgGroup.add(tank);
            } else if (roofProp > 0.33) {
              const antennaMat = new THREE.MeshPhongMaterial({ color: 0x2a2e33, flatShading: true });
              const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6.0, 6), antennaMat);
              antenna.position.set(0, height + 3.4, 0);
              bldgGroup.add(antenna);
            }

            bldgGroup.position.copy(bldgPos);
            bldgGroup.rotation.y = this.prng.range(-0.06, 0.06);
            this.foliageGroup.add(bldgGroup);
          }

          // Roadside Split-Rail Wooden Fences (every 18-20 nodes along road bends)
          if (i % 18 === 0 && this.prng.next() > 0.4) {
            const fenceDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 1.4);
            const fencePos = pt.clone().addScaledVector(normal, fenceDist);
            fencePos.y = calcTerrainY(fencePos, fenceDist);

            const fenceGroup = new THREE.Group();
            const fPostMat = new THREE.MeshLambertMaterial({ color: 0x54361e });
            const fRailMat = new THREE.MeshLambertMaterial({ color: 0x6e472a });

            // 2 vertical posts
            [-1.4, 1.4].forEach(px => {
              const fPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), fPostMat);
              fPost.position.set(px, 0.6, 0);
              fenceGroup.add(fPost);
            });
            // 2 horizontal split rails
            [0.45, 0.85].forEach(ry => {
              const fRail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.08), fRailMat);
              fRail.position.set(0, ry, 0);
              fenceGroup.add(fRail);
            });

            fenceGroup.position.copy(fencePos);
            fenceGroup.lookAt(fencePos.clone().add(tangent));
            this.foliageGroup.add(fenceGroup);
          }

          // Indian Highway Milestone Markers (National Highway Standard: Yellow Dome + White Base)
          if (i % 32 === 0 && side === 1) {
            const stoneDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 1.6);
            const stonePos = pt.clone().addScaledVector(normal, stoneDist);
            stonePos.y = calcTerrainY(stonePos, stoneDist);

            const stoneGroup = new THREE.Group();
            // White stone base pillar
            const baseStone = new THREE.Mesh(
              new THREE.CylinderGeometry(0.32, 0.35, 0.8, 12),
              new THREE.MeshLambertMaterial({ color: 0xf8fafc })
            );
            baseStone.position.y = 0.4;
            stoneGroup.add(baseStone);

            // National Highway Bright Yellow Dome Top
            const yellowTop = new THREE.Mesh(
              new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
              new THREE.MeshLambertMaterial({ color: 0xfacc15 })
            );
            yellowTop.position.y = 0.8;
            stoneGroup.add(yellowTop);

            // Black Highway Code Band
            const band = new THREE.Mesh(
              new THREE.CylinderGeometry(0.325, 0.325, 0.12, 12),
              new THREE.MeshBasicMaterial({ color: 0x0f172a })
            );
            band.position.set(0, 0.55, 0);
            stoneGroup.add(band);

            stoneGroup.position.copy(stonePos);
            stoneGroup.lookAt(pt);
            this.foliageGroup.add(stoneGroup);
          }

          // Modular Curved Highway Streetlamps (with amber night glow)
          if (i % 28 === 0 && side === -1) {
            const lampDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 1.8);
            const lampPos = pt.clone().addScaledVector(normal, lampDist);
            lampPos.y = calcTerrainY(lampPos, lampDist);

            const lampGroup = new THREE.Group();
            const poleMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 5.5, 6), poleMat);
            post.position.y = 2.75;
            lampGroup.add(post);

            // Curved horizontal boom reaching over the road, drooping
            // slightly toward the tip (real lamp booms aren't dead flat —
            // a perfectly perpendicular bar crossing a perfectly vertical
            // pole reads as a plain crucifix silhouette at a distance,
            // which is exactly what this looked like before). Built along
            // local +Z to match lookAt()'s actual behavior on this group
            // (empirically verified: after lampGroup.lookAt(pt), local +Z
            // — not -Z — ends up pointing at pt).
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.8), poleMat);
            arm.position.set(0, 5.4, 0.7);
            arm.rotateX(-0.22);
            lampGroup.add(arm);

            // Lantern head: hangs distinctly below the arm's tip (breaks
            // the straight cross-bar line) and is sized to actually read
            // as a lamp shape, not a sliver. A saturated amber — not the
            // pale yellow used before, which blended into autumn/summer
            // foliage colors and made the whole fixture disappear into
            // the tree canopy behind it.
            const lanternHousing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.62), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
            lanternHousing.position.set(0, 5.05, 1.55);
            const lightLens = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.5), new THREE.MeshBasicMaterial({ color: 0xffb703 }));
            lightLens.position.set(0, 4.92, 1.55);
            lampGroup.add(lanternHousing);
            lampGroup.add(lightLens);

            lampGroup.position.copy(lampPos);
            lampGroup.lookAt(pt);
            this.foliageGroup.add(lampGroup);
            this.obstacles.push({ pos: lampPos.clone(), radius: 0.8, type: 'pole' });
          }

          // Roadside Bus Shelter & Waiting Passengers
          if (i % 72 === 0 && side === 1) {
            const shelterDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 3.8);
            const shelterPos = pt.clone().addScaledVector(normal, shelterDist);
            shelterPos.y = calcTerrainY(shelterPos, shelterDist);

            const shelterGroup = new THREE.Group();
            // Shelter Roof Canopy
            const roofMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
            const sRoof = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.14, 2.4), roofMat);
            sRoof.position.set(0, 2.6, 0);
            shelterGroup.add(sRoof);

            // Rear Glass / Steel Screen
            const screenMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });
            const sScreen = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.4, 0.08), screenMat);
            sScreen.position.set(0, 1.2, -1.1);
            shelterGroup.add(sScreen);

            // Wooden Bench
            const bench = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 0.6), new THREE.MeshLambertMaterial({ color: 0x78350f }));
            bench.position.set(0, 0.35, -0.6);
            shelterGroup.add(bench);

            // Waiting Passenger Figure (Low-Poly Human)
            const humanGroup = new THREE.Group();
            const skinMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
            const clothMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
            const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });

            // Torso
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.65, 0.28), clothMat);
            torso.position.set(0, 0.95, 0);
            humanGroup.add(torso);
            // Head
            const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), skinMat);
            head.position.set(0, 1.45, 0);
            humanGroup.add(head);
            // Legs
            [-0.12, 0.12].forEach(lx => {
              const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), pantsMat);
              leg.position.set(lx, 0.35, 0.15);
              humanGroup.add(leg);
            });
            humanGroup.position.set(0.6, 0, -0.6);
            shelterGroup.add(humanGroup);

            shelterGroup.position.copy(shelterPos);
            shelterGroup.lookAt(pt);
            this.foliageGroup.add(shelterGroup);
            this.obstacles.push({ pos: shelterPos.clone(), radius: 2.8, type: 'building' });
          }

          // Roadside Dhaba / Chai Tapri with Customers drinking tea
          if (i % 56 === 0 && side === -1) {
            const tapriDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 4.2);
            const tapriPos = pt.clone().addScaledVector(normal, tapriDist);
            tapriPos.y = calcTerrainY(tapriPos, tapriDist);

            const tapriGroup = new THREE.Group();
            // Bamboo Awning Roof
            const tRoof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 3.2), new THREE.MeshLambertMaterial({ color: 0xb45309 }));
            tRoof.position.set(0, 2.5, 0);
            tRoof.rotateX(0.08);
            tapriGroup.add(tRoof);

            // Chai Stall Counter
            const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 1.2), new THREE.MeshLambertMaterial({ color: 0x451a03 }));
            counter.position.set(0, 0.5, 0.4);
            tapriGroup.add(counter);

            // Brass Chai Samovar / Kettle on counter
            const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.45, 8), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
            kettle.position.set(-0.9, 1.2, 0.4);
            tapriGroup.add(kettle);

            // Standing Chai Customer (Low-Poly Figure)
            const patron = new THREE.Group();
            const pSkin = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
            const pShirt = new THREE.MeshLambertMaterial({ color: 0x10b981 });
            const pTorso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.28), pShirt);
            pTorso.position.set(0, 1.1, 0);
            const pHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), pSkin);
            pHead.position.set(0, 1.62, 0);
            // Kulhad cup in hand
            const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 6), new THREE.MeshLambertMaterial({ color: 0xc2410c }));
            cup.position.set(0.28, 1.15, 0.22);
            patron.add(pTorso);
            patron.add(pHead);
            patron.add(cup);
            patron.position.set(0.7, 0, 1.4);
            tapriGroup.add(patron);

            tapriGroup.position.copy(tapriPos);
            tapriGroup.lookAt(pt);
            this.foliageGroup.add(tapriGroup);
            this.obstacles.push({ pos: tapriPos.clone(), radius: 2.6, type: 'building' });
          }

          // Roadside Kirana General Store (shutter, signboard, crates)
          if (i % 62 === 0 && side === 1) {
            const kiranaDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 4.4);
            const kiranaPos = pt.clone().addScaledVector(normal, kiranaDist);
            kiranaPos.y = calcTerrainY(kiranaPos, kiranaDist);

            const kiranaGroup = new THREE.Group();

            // Shop body
            const shopMat = new THREE.MeshLambertMaterial({ color: 0x0e7490 });
            const shopBody = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.6, 3.0), shopMat);
            shopBody.position.set(0, 1.3, 0);
            kiranaGroup.add(shopBody);

            // Roller shutter (front face)
            const shutterMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
            const shutter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 0.08), shutterMat);
            shutter.position.set(0, 0.95, 1.52);
            kiranaGroup.add(shutter);
            // Shutter slat lines (thin ridges for a corrugated look)
            const slatMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
            for (let s = 0; s < 6; s++) {
              const slat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.02), slatMat);
              slat.position.set(0, 0.25 + s * 0.28, 1.57);
              kiranaGroup.add(slat);
            }

            // Bright signboard above shutter
            const signMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
            const sign = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.6, 0.12), signMat);
            sign.position.set(0, 2.5, 1.5);
            kiranaGroup.add(sign);

            // Forward-sloping awning over the shutter
            const kAwningMat = new THREE.MeshLambertMaterial({ color: 0xc2410c });
            const kAwning = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 1.3), kAwningMat);
            kAwning.position.set(0, 2.15, 2.2);
            kAwning.rotateX(-0.22);
            kiranaGroup.add(kAwning);

            // Crates of goods stacked outside
            const crateMat = new THREE.MeshLambertMaterial({ color: 0x92400e });
            [[-1.5, 0.25, 2.1], [-1.5, 0.72, 2.1], [1.6, 0.25, 1.9]].forEach(([cx, cy, cz]) => {
              const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), crateMat);
              crate.position.set(cx, cy, cz);
              kiranaGroup.add(crate);
            });

            kiranaGroup.position.copy(kiranaPos);
            kiranaGroup.lookAt(pt);
            this.foliageGroup.add(kiranaGroup);
            this.obstacles.push({ pos: kiranaPos.clone(), radius: 2.4, type: 'building' });
          }

          // City-specific landmark monument — rare (a couple per route),
          // one distinct silhouette per city, hand-built in this game's
          // own low-poly style rather than an imported asset (checked a
          // Unity Asset Store monument pack for this — paid, FBX/Unity
          // format, no fit for a single-file browser Three.js project).
          if (i % 400 === 0 && i > 50 && side === 1) {
            const monDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 9.0);
            const monPos = pt.clone().addScaledVector(normal, monDist);
            monPos.y = calcTerrainY(monPos, monDist);

            const monGroup = new THREE.Group();

            if (this.cityKey === 'mumbai') {
              // Gateway of India — basalt-yellow triumphal archway with
              // domed corner turrets, built as a gate frame (pillars +
              // lintel) so the arch opening reads without needing CSG.
              const stoneMat = new THREE.MeshLambertMaterial({ color: 0xd4b483 });
              [-2.6, 2.6].forEach(px => {
                const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.5, 1.4), stoneMat);
                pillar.position.set(px, 3.75, 0);
                monGroup.add(pillar);
                const turretDome = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 8), stoneMat);
                turretDome.position.set(px, 8.3, 0);
                monGroup.add(turretDome);
              });
              const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.6, 1.4), stoneMat);
              lintel.position.set(0, 7.3, 0);
              monGroup.add(lintel);
              const centerDome = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 10), stoneMat);
              centerDome.position.set(0, 9.2, 0);
              monGroup.add(centerDome);
            } else if (this.cityKey === 'delhi') {
              // India Gate — sandstone triumphal arch with an eternal-flame
              // accent at the base.
              const sandMat = new THREE.MeshLambertMaterial({ color: 0xc2703d });
              [-2.4, 2.4].forEach(px => {
                const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8.0, 1.6), sandMat);
                pillar.position.set(px, 4.0, 0);
                monGroup.add(pillar);
              });
              const arch = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.8, 1.6), sandMat);
              arch.position.set(0, 7.9, 0);
              monGroup.add(arch);
              const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
              flame.position.set(0, 0.6, 1.2);
              monGroup.add(flame);
            } else if (this.cityKey === 'kolkata') {
              // Victoria Memorial — white marble dome on a colonnaded base.
              const marbleMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
              const base = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.2, 5.5), marbleMat);
              base.position.set(0, 1.6, 0);
              monGroup.add(base);
              const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), marbleMat);
              dome.position.set(0, 3.2, 0);
              monGroup.add(dome);
              const finial = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.0, 6), marbleMat);
              finial.position.set(0, 5.9, 0);
              monGroup.add(finial);
            } else if (this.cityKey === 'pune') {
              // Shaniwar Wada — fortress gate: dark teak door studded with
              // brass bosses, set in a stone wall.
              const wallMat = new THREE.MeshLambertMaterial({ color: 0x57534e });
              const wall = new THREE.Mesh(new THREE.BoxGeometry(7.5, 6.0, 1.6), wallMat);
              wall.position.set(0, 3.0, 0);
              monGroup.add(wall);
              const doorMat = new THREE.MeshLambertMaterial({ color: 0x422006 });
              const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.6, 0.3), doorMat);
              door.position.set(0, 2.3, 0.95);
              monGroup.add(door);
              const bossMat = new THREE.MeshLambertMaterial({ color: 0xca8a04 });
              for (let bx = -1; bx <= 1; bx++) {
                for (let by = 0; by < 4; by++) {
                  const boss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), bossMat);
                  boss.position.set(bx * 1.1, 0.8 + by * 1.1, 1.12);
                  monGroup.add(boss);
                }
              }
            } else {
              // Bengaluru (and default) — Vidhana Soudha: granite-pink
              // pillared facade under a white central dome.
              const graniteMat = new THREE.MeshLambertMaterial({ color: 0xd6a8a8 });
              const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.0, 4.5), graniteMat);
              base.position.set(0, 1.5, 0);
              monGroup.add(base);
              for (let cx = -2.8; cx <= 2.8; cx += 1.4) {
                const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.0, 8), new THREE.MeshLambertMaterial({ color: 0xf1e4e4 }));
                col.position.set(cx, 1.5, 2.35);
                monGroup.add(col);
              }
              const domeMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
              const dome = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
              dome.position.set(0, 3.0, 0);
              monGroup.add(dome);
            }

            monGroup.position.copy(monPos);
            monGroup.lookAt(pt);
            this.foliageGroup.add(monGroup);
            this.obstacles.push({ pos: monPos.clone(), radius: 4.0, type: 'building' });
          }

          // Firewood Log Stacks along forest verges
          if (i % 38 === 0 && this.prng.next() > 0.5) {
            const logDist = side * (CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(2.6, 4.5));
            const logPos = pt.clone().addScaledVector(normal, logDist);
            logPos.y = calcTerrainY(logPos, logDist);

            const logGroup = new THREE.Group();
            const logMat = new THREE.MeshLambertMaterial({ color: 0x7c4f28 });
            // Stack of 6 cylindrical timber logs
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3 - r; c++) {
                const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 6), logMat);
                log.rotateZ(Math.PI / 2);
                log.position.set(0, 0.15 + r * 0.22, (c - (2 - r) / 2) * 0.28);
                logGroup.add(log);
              }
            }
            logGroup.position.copy(logPos);
            logGroup.lookAt(logPos.clone().add(tangent));
            this.foliageGroup.add(logGroup);
          }

          // Boulders & Rocks
          if (this.prng.next() > 0.65) {
            const rockDist = side * (CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(2.0, 24.0));
            const rockPos = pt.clone().addScaledVector(normal, rockDist);
            rockPos.y = calcTerrainY(rockPos, rockDist) + 0.8;
            const rock = new THREE.Mesh(rockGeom, rockMat);
            rock.position.copy(rockPos);
            rock.rotation.set(this.prng.next() * 3, this.prng.next() * 3, 0);
            this.foliageGroup.add(rock);
            this.obstacles.push({ pos: rockPos.clone(), radius: 1.6, type: 'rock' });
          }
        });

        // 7. 3D Procedural Forest Cabins & Mountain Cottages (Delivery Drop Points)
        if (i % 24 === 0) {
          const cityOrders = CONFIG.ORDERS_BY_CITY[this.cityKey] || CONFIG.ORDERS_BY_CITY.mumbai;
          const orderIdx = Math.floor(i / 24) % cityOrders.length;
          const order = cityOrders[orderIdx];
          const houseSide = (i % 48 === 0 ? 1 : -1);
          
          const houseDist = houseSide * (CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(diffCfg.minHouseDist, diffCfg.maxHouseDist));
          const housePos = pt.clone().addScaledVector(normal, houseDist);
          housePos.y = calcTerrainY(housePos, houseDist);

          const cabinGroup = new THREE.Group();

          // A. Stone Foundation Base
          const stoneBaseMat = new THREE.MeshLambertMaterial({ color: 0x484e56 });
          const stoneBase = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.5, 5.8), stoneBaseMat);
          stoneBase.position.y = 0.25;
          cabinGroup.add(stoneBase);

          // B. Main Timber Log Cabin Body
          const timberMat = new THREE.MeshLambertMaterial({ color: 0x4a2e1b });
          const cabinBody = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.4, 5.4), timberMat);
          cabinBody.position.y = 2.1;
          cabinBody.castShadow = true;
          cabinGroup.add(cabinBody);

          // C. Overhanging Pitched Gabled Roof (Dark Pine Shingles)
          const roofMat = new THREE.MeshLambertMaterial({ color: 0x28170d });
          const roofGeom = new THREE.ConeGeometry(4.8, 2.2, 4);
          roofGeom.rotateY(Math.PI / 4);
          const roof = new THREE.Mesh(roofGeom, roofMat);
          roof.position.y = 4.4;
          roof.scale.set(1.0, 1.0, 0.9);
          roof.castShadow = true;
          cabinGroup.add(roof);

          // D. Front Veranda / Porch Deck with Timber Posts
          const porchDeckMat = new THREE.MeshLambertMaterial({ color: 0x633e24 });
          const porchDeck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 2.2), porchDeckMat);
          porchDeck.position.set(0, 0.35, 3.2);
          cabinGroup.add(porchDeck);

          // Porch Roof Awning
          const awningMat = new THREE.MeshLambertMaterial({ color: 0x28170d });
          const awning = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 2.4), awningMat);
          awning.position.set(0, 2.8, 3.2);
          awning.rotateX(0.12);
          cabinGroup.add(awning);

          // Porch Support Pillars
          const pillarMat = new THREE.MeshLambertMaterial({ color: 0x3d2616 });
          [-1.9, 1.9].forEach(px => {
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.5, 6), pillarMat);
            pillar.position.set(px, 1.5, 4.1);
            cabinGroup.add(pillar);
          });

          // E. Waving Porch Resident Figure (Low-Poly Character)
          const resident = new THREE.Group();
          const rSkin = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
          const rKurta = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
          const rTorso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.65, 0.25), rKurta);
          rTorso.position.set(0, 0.75, 0);
          const rHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), rSkin);
          rHead.position.set(0, 1.25, 0);
          // Raised Waving Arm
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), rKurta);
          arm.position.set(0.3, 1.1, 0);
          arm.rotateZ(-0.45);
          resident.add(rTorso);
          resident.add(rHead);
          resident.add(arm);
          resident.position.set(-1.2, 0.35, 3.2);
          cabinGroup.add(resident);

          // F. Stone Fireplace Chimney on Side
          const chimneyMat = new THREE.MeshLambertMaterial({ color: 0x525860 });
          const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.8, 0.9), chimneyMat);
          chimney.position.set(-2.8, 2.6, -0.6);
          const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 1.1), new THREE.MeshLambertMaterial({ color: 0x1f2328 }));
          chimneyCap.position.set(-2.8, 5.0, -0.6);
          cabinGroup.add(chimney);
          cabinGroup.add(chimneyCap);

          // G. Illuminated Warm Windows & Front Oak Door
          const doorMat = new THREE.MeshLambertMaterial({ color: 0x331c0e });
          const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.08), doorMat);
          door.position.set(0, 1.3, 2.72);
          cabinGroup.add(door);

          const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
          [-1.5, 1.5].forEach(wx => {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.08), windowMat);
            win.position.set(wx, 2.1, 2.72);
            cabinGroup.add(win);
          });

          // H. Warm Hanging Porch Lantern & Delivery Drop Zone
          const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.24), new THREE.MeshBasicMaterial({ color: 0xffb703 }));
          lantern.position.set(1.4, 2.4, 3.8);
          cabinGroup.add(lantern);

          // Glowing Delivery Ring on Porch Landing
          const ringGeom = new THREE.RingGeometry(1.5, 2.1, 16);
          ringGeom.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0x2ec4b6, side: THREE.DoubleSide });
          const ring = new THREE.Mesh(ringGeom, ringMat);
          ring.position.set(0, 0.48, 3.2);
          cabinGroup.add(ring);

          this.obstacles.push({ pos: housePos.clone(), radius: 3.5, type: 'building' });
          cabinGroup.position.copy(housePos);
          cabinGroup.lookAt(pt);

          this.foliageGroup.add(cabinGroup);
          this.deliveryTargets.push({
            order: order,
            pos: housePos,
            ring: ring,
            delivered: false,
            splineU: u,
            tossRadius: diffCfg.tossRadius
          });
        }
      }

      // Add Real-Time Road Traffic (Rickshaws, BEST Buses, Mini-Trucks, Kaali-Peeli Cabs)
      for (let i = 8; i < sampledPoints.length - 8; i += 30) {
        const trafficGroup = new THREE.Group();
        const isBus = (i % 60 === 0);
        const isTruck = !isBus && (i % 90 === 0);

        if (isBus) {
          // BEST Red Double-Decker / Single Bus
          const busGeom = new THREE.BoxGeometry(2.4, 2.6, 6.5);
          const busMat = new THREE.MeshPhongMaterial({ color: 0xd90429, flatShading: true });
          const bus = new THREE.Mesh(busGeom, busMat);
          bus.position.y = 1.4;
          trafficGroup.add(bus);
        } else if (isTruck && IndianTruckAsset.template) {
          // Tata Ace-style Mini-Truck (teal-green/white livery)
          trafficGroup.add(IndianTruckAsset.clone());
        } else {
          // Bajaj Auto Rickshaw (Yellow & Green)
          const autoGeom = new THREE.BoxGeometry(1.4, 1.3, 2.4);
          const autoMat = new THREE.MeshPhongMaterial({ color: 0xfca311, flatShading: true });
          const autoBody = new THREE.Mesh(autoGeom, autoMat);
          autoBody.position.y = 0.8;
          trafficGroup.add(autoBody);
        }

        const u = i / sampledPoints.length;
        const laneOffset = (i % 2 === 0 ? 1.8 : -1.8);
        this.trafficVehicles.push({
          mesh: trafficGroup,
          splineU: u,
          speed: 12.0 + (i % 5) * 2.0,
          laneOffset: laneOffset
        });

        this.foliageGroup.add(trafficGroup);
      }

      scene.add(this.foliageGroup);
    }

    updateTraffic(dt) {
      if (!this.curve) return;
      const totalLen = this.curve.getLength();

      this.trafficVehicles.forEach(tv => {
        tv.splineU += (tv.speed * dt) / totalLen;
        if (tv.splineU >= 0.98) tv.splineU = 0.01;

        const pt = this.curve.getPointAt(tv.splineU);
        const tangent = this.curve.getTangentAt(tv.splineU).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const pos = pt.clone().addScaledVector(normal, tv.laneOffset);
        tv.mesh.position.copy(pos);
        tv.mesh.lookAt(pos.clone().add(tangent));
      });
    }
  }

  // --------------------------------------------------------------------------
  // 6. ENHANCED INDIAN SPORTS/DELIVERY VEHICLES
  // --------------------------------------------------------------------------
  class VehicleController {
    constructor(scene, vehicleType = 'car') {
      this.scene = scene;
      this.vehicleType = vehicleType;
      this.mesh = new THREE.Group();
      this.wheels = [];

      this.speed = 0;
      this.steerAngle = 0;
      this.lateralOffset = 0; // Lateral position across road lanes (-6m to +6m)
      this.lateralVelocity = 0;
      this.grip = 1.0;
      this.health = 100; // Vehicle condition (100% down to 0%)
      this.distanceTraveled = 0;
      this.isAutodrive = false; // Default: 100% MANUAL DRIVING
      this.splineProgress = 0.008;

      this.applyVehicleConfig();
      this.buildModel();
    }

    applyVehicleConfig() {
      const cfg = CONFIG.VEHICLES[this.vehicleType] || CONFIG.VEHICLES.car;
      this.maxSpeed = cfg.maxSpeed;
      this.accel = cfg.accel;
      this.drag = cfg.drag;
      this.brake = cfg.brake;
    }

    setVehicleType(type) {
      if (CONFIG.VEHICLES[type]) {
        this.vehicleType = type;
        this.applyVehicleConfig();
        this.buildModel();
      }
    }

    getCamOffsets() {
      // Pulled back + raised (slowroads-style) so roadside props recede instead of
      // smearing past the periphery, which destroyed the sense of forward motion.
      if (this.vehicleType === 'chotahathi') {
        return { dist: -12.5, height: 6.2, lookAhead: 15.0, lookHeight: 1.0 };
      } else if (this.vehicleType === 'scooter') {
        return { dist: -10.5, height: 5.0, lookAhead: 12.5, lookHeight: 0.85 };
      } else if (this.vehicleType === 'cycle') {
        return { dist: -10.0, height: 4.8, lookAhead: 12.5, lookHeight: 0.85 };
      } else {
        return { dist: -11.5, height: 5.4, lookAhead: 13.0, lookHeight: 0.9 };
      }
    }

    buildModel() {
      this.mesh.clear();
      this.wheels = [];

      if (this.vehicleType === 'swift') {
        // ====================================================================
        // 1. MARUTI SUZUKI SWIFT / TATA NEXON SPORTS HATCHBACK
        // ====================================================================
        // Sporty Dual-Tone Red Body with Floating Black Roof & Honeycomb Grille
        const bodyGeom = new THREE.BoxGeometry(1.85, 0.62, 3.8);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xd90429, flatShading: true }); // Fiery Red
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 0.58;
        body.castShadow = true;

        // Aerodynamic Hood Slope
        const hoodGeom = new THREE.BoxGeometry(1.75, 0.3, 1.1);
        const hood = new THREE.Mesh(hoodGeom, bodyMat);
        hood.position.set(0, 0.72, 1.15);

        // Floating Gloss-Black Glass Cabin
        const cabinGeom = new THREE.BoxGeometry(1.55, 0.58, 2.0);
        const cabinMat = new THREE.MeshPhongMaterial({ color: 0x111827, flatShading: true });
        const cabin = new THREE.Mesh(cabinGeom, cabinMat);
        cabin.position.set(0, 1.12, -0.25);
        cabin.castShadow = true;

        // Gloss Black Roof Panel
        const roofGeom = new THREE.BoxGeometry(1.58, 0.06, 2.05);
        const roofMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.set(0, 1.43, -0.25);

        // Rear Roof Spoiler
        const spoilerGeom = new THREE.BoxGeometry(1.6, 0.06, 0.35);
        const spoiler = new THREE.Mesh(spoilerGeom, roofMat);
        spoiler.position.set(0, 1.45, -1.35);

        // Front Honeycomb Grille & Chrome Badge
        const grilleGeom = new THREE.BoxGeometry(1.1, 0.24, 0.1);
        const grilleMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const grille = new THREE.Mesh(grilleGeom, grilleMat);
        grille.position.set(0, 0.5, 1.91);

        // Projector LED Headlights (+Z front)
        const headGeom = new THREE.BoxGeometry(0.48, 0.12, 0.1);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const leftHead = new THREE.Mesh(headGeom, headMat);
        leftHead.position.set(-0.56, 0.65, 1.91);
        const rightHead = new THREE.Mesh(headGeom, headMat);
        rightHead.position.set(0.56, 0.65, 1.91);

        // LED Wrap-Around Taillights (-Z rear)
        const tailGeom = new THREE.BoxGeometry(0.48, 0.14, 0.1);
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xef233c });
        const leftTail = new THREE.Mesh(tailGeom, tailMat);
        leftTail.position.set(-0.58, 0.72, -1.91);
        const rightTail = new THREE.Mesh(tailGeom, tailMat);
        rightTail.position.set(0.58, 0.72, -1.91);

        // Dual Wing Mirrors
        const mirrorGeom = new THREE.BoxGeometry(0.24, 0.12, 0.14);
        const leftMirror = new THREE.Mesh(mirrorGeom, roofMat);
        leftMirror.position.set(-0.95, 1.05, 0.65);
        const rightMirror = new THREE.Mesh(mirrorGeom, roofMat);
        rightMirror.position.set(0.95, 1.05, 0.65);

        this.mesh.add(body);
        this.mesh.add(hood);
        this.mesh.add(cabin);
        this.mesh.add(roof);
        this.mesh.add(spoiler);
        this.mesh.add(grille);
        this.mesh.add(leftHead);
        this.mesh.add(rightHead);
        this.mesh.add(leftTail);
        this.mesh.add(rightTail);
        this.mesh.add(leftMirror);
        this.mesh.add(rightMirror);

        // 4 Sports Diamond-Cut Alloy Wheels
        const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 16);
        wheelGeom.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

        [[-0.88, 0.35, 1.15], [0.88, 0.35, 1.15], [-0.88, 0.35, -1.15], [0.88, 0.35, -1.15]].forEach(p => {
          const w = new THREE.Mesh(wheelGeom, wheelMat);
          w.position.set(...p);
          this.mesh.add(w);
          this.wheels.push(w);
        });

      } else if (this.vehicleType === 'chotahathi') {
        // ====================================================================
        // 2. TATA ACE "CHHOTA HATHI" MINI TRUCK (DELIVERY EDITION)
        // ====================================================================
        // Front White/Yellow Driver Cabin
        const cabGeom = new THREE.BoxGeometry(1.65, 1.25, 1.2);
        const cabMat = new THREE.MeshPhongMaterial({ color: 0xf8f9fa, flatShading: true });
        const cab = new THREE.Mesh(cabGeom, cabMat);
        cab.position.set(0, 0.95, 0.85);
        cab.castShadow = true;

        // Front Windshield
        const glassGeom = new THREE.BoxGeometry(1.5, 0.55, 0.08);
        const glassMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        const windshield = new THREE.Mesh(glassGeom, glassMat);
        windshield.position.set(0, 1.2, 1.46);

        // Heavy-duty Black Front Bumper & Dual Headlights
        const bumperGeom = new THREE.BoxGeometry(1.7, 0.28, 0.2);
        const bumperMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
        const bumper = new THREE.Mesh(bumperGeom, bumperMat);
        bumper.position.set(0, 0.4, 1.46);

        const headGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12);
        headGeom.rotateX(Math.PI / 2);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
        const leftHead = new THREE.Mesh(headGeom, headMat);
        leftHead.position.set(-0.55, 0.72, 1.46);
        const rightHead = new THREE.Mesh(headGeom, headMat);
        rightHead.position.set(0.55, 0.72, 1.46);

        // Open Turquoise/Green Cargo Dala Bed
        const bedGeom = new THREE.BoxGeometry(1.72, 0.65, 2.2);
        const bedMat = new THREE.MeshPhongMaterial({ color: 0x059669, flatShading: true }); // Indian Cargo Green
        const bed = new THREE.Mesh(bedGeom, bedMat);
        bed.position.set(0, 0.65, -0.75);
        bed.castShadow = true;

        // Stacked Courier Cargo Sacks & Crates in the open bed
        const crate1Geom = new THREE.BoxGeometry(1.3, 0.45, 0.9);
        const crate1Mat = new THREE.MeshLambertMaterial({ color: 0xd4a373 }); // Wooden box
        const crate1 = new THREE.Mesh(crate1Geom, crate1Mat);
        crate1.position.set(0, 1.15, -0.75);

        const crate2Geom = new THREE.BoxGeometry(1.0, 0.35, 0.7);
        const crate2Mat = new THREE.MeshLambertMaterial({ color: 0xff9f1c }); // Saffron box
        const crate2 = new THREE.Mesh(crate2Geom, crate2Mat);
        crate2.position.set(0, 1.5, -0.75);

        // Rear "HORN OK PLEASE" Painted Bumper Board
        const flapGeom = new THREE.BoxGeometry(1.68, 0.22, 0.06);
        const flapMat = new THREE.MeshLambertMaterial({ color: 0xfca311 });
        const flap = new THREE.Mesh(flapGeom, flapMat);
        flap.position.set(0, 0.35, -1.86);

        // Dual Circular Red Taillights
        const tailGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12);
        tailGeom.rotateX(Math.PI / 2);
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xef233c });
        const leftTail = new THREE.Mesh(tailGeom, tailMat);
        leftTail.position.set(-0.6, 0.58, -1.86);
        const rightTail = new THREE.Mesh(tailGeom, tailMat);
        rightTail.position.set(0.6, 0.58, -1.86);

        this.mesh.add(cab);
        this.mesh.add(windshield);
        this.mesh.add(bumper);
        this.mesh.add(leftHead);
        this.mesh.add(rightHead);
        this.mesh.add(bed);
        this.mesh.add(crate1);
        this.mesh.add(crate2);
        this.mesh.add(flap);
        this.mesh.add(leftTail);
        this.mesh.add(rightTail);

        const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
        wheelGeom.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });

        [[-0.8, 0.35, 0.85], [0.8, 0.35, 0.85], [-0.8, 0.35, -0.85], [0.8, 0.35, -0.85]].forEach(p => {
          const w = new THREE.Mesh(wheelGeom, wheelMat);
          w.position.set(...p);
          this.mesh.add(w);
          this.wheels.push(w);
        });

      } else if (this.vehicleType === 'scooter') {
        // ====================================================================
        // 3. VAYU VOLT SPORTS SCOOTER (Electric Courier Scooter)
        // ====================================================================
        const apronMat = new THREE.MeshPhongMaterial({ color: 0x10b981, flatShading: true }); // Neon Mint Electric
        const apronGeom = new THREE.BoxGeometry(0.52, 0.85, 0.42);
        const apron = new THREE.Mesh(apronGeom, apronMat);
        apron.position.set(0, 0.78, 0.42);

        const led = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        led.position.set(0, 1.05, 0.64);

        const barGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.82, 8);
        barGeom.rotateZ(Math.PI / 2);
        const barMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
        const bar = new THREE.Mesh(barGeom, barMat);
        bar.position.set(0, 1.32, 0.42);

        const floorGeom = new THREE.BoxGeometry(0.5, 0.12, 0.85);
        const floor = new THREE.Mesh(floorGeom, apronMat);
        floor.position.set(0, 0.32, 0.0);

        const seatGeom = new THREE.BoxGeometry(0.48, 0.38, 0.95);
        const seatMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        const seat = new THREE.Mesh(seatGeom, seatMat);
        seat.position.set(0, 0.65, -0.55);

        // Rear Thermal Courier Delivery Backpack
        const bagGeom = new THREE.BoxGeometry(0.58, 0.65, 0.58);
        const bagMat = new THREE.MeshLambertMaterial({ color: 0xff9f1c });
        const bag = new THREE.Mesh(bagGeom, bagMat);
        bag.position.set(0, 1.15, -0.68);

        // Tail Light
        const tailGeom = new THREE.BoxGeometry(0.24, 0.08, 0.06);
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xef233c });
        const tail = new THREE.Mesh(tailGeom, tailMat);
        tail.position.set(0, 0.65, -1.05);

        this.mesh.add(apron);
        this.mesh.add(led);
        this.mesh.add(bar);
        this.mesh.add(floor);
        this.mesh.add(seat);
        this.mesh.add(bag);
        this.mesh.add(tail);

        const wheelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.14, 14);
        wheelGeom.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        [[0, 0.3, 0.78], [0, 0.3, -0.85]].forEach(p => {
          const w = new THREE.Mesh(wheelGeom, wheelMat);
          w.position.set(...p);
          this.mesh.add(w);
          this.wheels.push(w);
        });

      } else {
        // ====================================================================
        // 4. PAWAN PEDALER BICYCLE (Eco Zen Delivery MTB)
        // ====================================================================
        const frameMat = new THREE.MeshPhongMaterial({ color: 0x0284c7, flatShading: true });
        const tubeGeom = new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8);

        const topTube = new THREE.Mesh(tubeGeom, frameMat);
        topTube.rotation.z = Math.PI / 2;
        topTube.position.set(0, 0.88, 0.0);

        const downTube = new THREE.Mesh(tubeGeom, frameMat);
        downTube.rotation.x = 0.55;
        downTube.position.set(0, 0.62, 0.3);

        const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), frameMat);
        seatPost.position.set(0, 0.78, -0.4);

        const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.32), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
        saddle.position.set(0, 1.15, -0.4);

        const fork = new THREE.Mesh(tubeGeom, frameMat);
        fork.rotation.x = -0.35;
        fork.position.set(0, 0.62, 0.78);

        const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.78, 8), new THREE.MeshLambertMaterial({ color: 0x334155 }));
        handlebar.rotation.z = Math.PI / 2;
        handlebar.position.set(0, 1.15, 0.68);

        const rackGeom = new THREE.BoxGeometry(0.38, 0.06, 0.52);
        const rackMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
        const rack = new THREE.Mesh(rackGeom, rackMat);
        rack.position.set(0, 0.88, -0.75);

        const parcelGeom = new THREE.BoxGeometry(0.34, 0.28, 0.4);
        const parcelMat = new THREE.MeshLambertMaterial({ color: 0xff9f1c });
        const parcel = new THREE.Mesh(parcelGeom, parcelMat);
        parcel.position.set(0, 1.05, -0.75);

        this.mesh.add(topTube);
        this.mesh.add(downTube);
        this.mesh.add(seatPost);
        this.mesh.add(saddle);
        this.mesh.add(fork);
        this.mesh.add(handlebar);
        this.mesh.add(rack);
        this.mesh.add(parcel);

        const wheelGeom = new THREE.CylinderGeometry(0.44, 0.44, 0.06, 16);
        wheelGeom.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        [[0, 0.44, 0.78], [0, 0.44, -0.82]].forEach(p => {
          const w = new THREE.Mesh(wheelGeom, wheelMat);
          w.position.set(...p);
          this.mesh.add(w);
          this.wheels.push(w);
        });
      }

      // Forward Projector Headlights
      const headL = new THREE.SpotLight(0xfff3d6, 3.2, 50, Math.PI / 5.5, 0.4, 1.0);
      headL.position.set(-0.55, 0.55, 1.0);
      headL.target.position.set(-0.55, -0.2, 22);
      this.mesh.add(headL);
      this.mesh.add(headL.target);

      const headR = new THREE.SpotLight(0xfff3d6, 3.2, 50, Math.PI / 5.5, 0.4, 1.0);
      headR.position.set(0.55, 0.55, 1.0);
      headR.target.position.set(0.55, -0.2, 22);
      this.mesh.add(headR);
      this.mesh.add(headR.target);

      this.headlights = [headL, headR];
      this.scene.add(this.mesh);
    }

    update(dt, keys, world, seasonKey = 'autumn', roadTerrainKey = 'asphalt') {
      const isRain = (seasonKey === 'autumn' || seasonKey === 'summer');
      const isWind = (seasonKey === 'winter' || seasonKey === 'summer');

      // Surface Terrain Grip Modifiers
      let terrainGrip = 1.0;
      if (roadTerrainKey === 'gravel') terrainGrip = 0.75;
      else if (roadTerrainKey === 'mud') terrainGrip = 0.52;
      else if (roadTerrainKey === 'sand') terrainGrip = 0.65;

      let climateGrip = terrainGrip;
      if (isRain) {
        if (this.vehicleType === 'cycle' || this.vehicleType === 'scooter') climateGrip *= 0.48;
        else climateGrip *= 0.68;
      }

      const windDrag = isWind ? (this.vehicleType === 'cycle' ? 2.8 : 1.4) : 0.0;

      // Health degradation penalty on top speed & engine performance
      const healthFactor = (this.health >= 50) ? 1.0 : Math.max(0.25, 0.4 + 0.6 * (this.health / 50));
      const effectiveMaxSpeed = (this.health <= 0) ? 0.0 : Math.max(8.0, (this.maxSpeed - windDrag * 3.5) * healthFactor);

      // 1. Throttle / Acceleration & EV One-Pedal Regen Braking
      const isDrifting = !!keys.space;
      const driftGripMult = isDrifting ? 0.40 : 1.0; // 60% friction reduction during power-slide drift

      if (this.isAutodrive) {
        // PID Autodrive targeting lookahead distance
        if (this.speed < effectiveMaxSpeed * 0.72) {
          this.speed += this.accel * dt;
        }
        this.lateralOffset = THREE.MathUtils.lerp(this.lateralOffset, 0, 0.06);
        this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, 0, 0.16);
      } else {
        if (this.health <= 0) {
          // Engine breakdown stall
          this.speed *= Math.exp(-2.5 * dt);
          if (Math.abs(this.speed) < 0.1) this.speed = 0;
        } else if (keys.up || keys.w) {
          // UP / W: ACCELERATE FORWARD
          if (this.speed < 0) {
            // Releasing reverse and braking to forward
            this.speed += this.brake * dt * 2.0;
            if (this.speed > 0) this.speed = 0;
          } else {
            // Softened from -1.4: the old curve hit ~157 km/h in ~2s from standstill,
            // far too fast for the chase cam to read as forward motion.
            this.speed += (effectiveMaxSpeed - this.speed) * (1 - Math.exp(-0.42 * dt));
          }
        } else if (keys.down || keys.s) {
          // DOWN / S: BRAKE WHEN MOVING FORWARD, REVERSE WHEN STOPPED
          if (this.speed > 0.4) {
            this.speed -= this.brake * dt * climateGrip * 1.8;
            if (this.speed < 0) this.speed = 0;
          } else {
            // Reverse speed up to -4.0 m/s (~14 km/h)
            const reverseMax = -4.0;
            this.speed += (reverseMax - this.speed) * (1 - Math.exp(-1.0 * dt));
          }
        } else {
          // Natural coasting / drag
          this.speed *= Math.exp(-this.drag * 0.85 * dt);
          if (Math.abs(this.speed) < 0.08) this.speed = 0;
        }

        // 2. MANUAL STEERING & LANE DYNAMICS (Natural Left / Right)
        const steerResponse = isDrifting ? 0.24 : 0.18;
        const steerLimit = (isDrifting ? 0.65 : 0.42) * climateGrip;
        const latSpeedFactor = isDrifting ? 13.5 : 8.5;
        const speedScale = Math.min(1.0, Math.abs(this.speed) / (this.maxSpeed * 0.3) + 0.2);

        if (keys.left || keys.a) {
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, steerLimit, steerResponse);
          this.lateralVelocity = THREE.MathUtils.lerp(this.lateralVelocity, -latSpeedFactor * speedScale, 0.18);
        } else if (keys.right || keys.d) {
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, -steerLimit, steerResponse);
          this.lateralVelocity = THREE.MathUtils.lerp(this.lateralVelocity, latSpeedFactor * speedScale, 0.18);
        } else {
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, 0, 0.14);
          this.lateralVelocity = THREE.MathUtils.lerp(this.lateralVelocity, 0, 0.14);
        }

        // Update player's lateral road lane offset
        this.lateralOffset += this.lateralVelocity * dt * driftGripMult;
        this.lateralOffset = Math.max(-9.0, Math.min(9.0, this.lateralOffset));
      }

      // 3. Longitudinal Progress along Spline
      const moveDist = this.speed * dt;
      this.distanceTraveled += Math.abs(moveDist) * 0.001;

      const totalLen = world.curve.getLength();
      this.splineProgress += (moveDist / totalLen);
      if (this.splineProgress >= 0.98) this.splineProgress = 0.005;
      if (this.splineProgress < 0) this.splineProgress = 0.005;

      const currentPos = world.curve.getPointAt(this.splineProgress);
      const tangent = world.curve.getTangentAt(this.splineProgress).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      // Road right vector (points towards right shoulder)
      // Right = Forward x Up in Three.js right-handed coords. The old .negate()
      // made this point LEFT, so A/D and every lateral offset were mirrored.
      const roadRight = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Apply lateral displacement across road width
      const vehiclePos = currentPos.clone().addScaledVector(roadRight, this.lateralOffset);

      // Follow the actual carved road/shoulder surface, not the spline
      // centerline height — lateralOffset can reach ±9m (the shoulder
      // boundary), and the terrain there sits lower than the road center
      // (see createTerrainMesh's roadHalf/shoulder formula). Using
      // currentPos.y unconditionally let the car clip into or float above
      // the ground the moment it drifted off-center.
      const roadHalfW = CONFIG.ROAD_WIDTH * 0.52;
      const absLat = Math.abs(this.lateralOffset);
      let groundY;
      if (absLat <= roadHalfW) {
        groundY = currentPos.y - 0.18;
      } else {
        const t = (absLat - roadHalfW) / (9.0 - roadHalfW);
        groundY = currentPos.y - 0.18 - t * 0.32;
      }
      vehiclePos.y = groundY + 0.25;

      // Surface elevation bump on gravel / mud
      if (roadTerrainKey === 'gravel' || roadTerrainKey === 'mud') {
        const bump = Math.sin(Date.now() * 0.035 * (this.speed / 10)) * 0.04;
        vehiclePos.y += bump;
      }

      this.mesh.position.copy(vehiclePos);

      // 4. Chassis Orientation & Steering (Headlights facing down the road +tangent)
      const lookTarget = vehiclePos.clone().add(tangent);
      this.mesh.lookAt(lookTarget);

      // Hard safety ceiling — this mesh's quaternion is read directly by
      // the camera as its forward direction every frame, so any unbounded
      // steerAngle (from any current or future code path) would swing the
      // camera to point at the ground at a steep angle instead of just
      // producing a bigger visual wobble.
      this.steerAngle = THREE.MathUtils.clamp(this.steerAngle, -1.2, 1.2);

      if (Math.abs(this.steerAngle) > 0.001) {
        // +Y rotation swings +Z toward +X (the model's left), so a positive
        // steerAngle (from A / left) must yaw positively to visually turn left.
        this.mesh.rotateY(this.steerAngle);
      }

      // Dynamic Chassis Pitch (dive on braking, squat on acceleration)
      const accelRatio = (this.speed - (this.lastSpeed || this.speed)) / Math.max(0.01, dt);
      this.lastSpeed = this.speed;
      const targetPitch = THREE.MathUtils.clamp(-accelRatio * 0.004, -0.06, 0.06);
      this.mesh.rotateX(targetPitch);

      // Dynamic Chassis Roll (centrifugal roll against turn + bank)
      const turnRoll = -this.steerAngle * (this.speed / this.maxSpeed) * 0.35;
      this.mesh.rotateZ(turnRoll);

      this.wheels.forEach(w => w.rotateX((this.speed * dt) / 0.38));

      const carPos = this.mesh.position;

      // 4. Pothole Collision & Health Degradation
      if (world.potholes) {
        world.potholes.forEach(p => {
          const d = carPos.distanceTo(p.pos);
          if (d < p.radius) {
            if (!p.hitRecently) {
              p.hitRecently = true;
              this.speed *= 0.65;
              // Clamped: hitting several potholes in quick succession (easy
              // at high speed) used to stack this kick unbounded, since
              // normal steering only lerps toward a ±0.42 limit but this
              // was a raw += with no ceiling. steerAngle feeds directly
              // into the chassis's visual yaw (mesh.rotateY) every frame,
              // and the camera reads its forward direction straight off
              // that mesh — so an unclamped steerAngle could swing the
              // camera to point at near-ground terrain at a steep angle,
              // reading as a giant close-up terrain fill with the car
              // rendering as a flattened silhouette.
              this.steerAngle = THREE.MathUtils.clamp(this.steerAngle + (Math.random() - 0.5) * 0.45, -0.9, 0.9);
              this.health = Math.max(0, this.health - 14); // Pothole damage
              sound.playPothole();

              const app = document.getElementById('game-app');
              if (app) {
                app.classList.add('screen-shake');
                setTimeout(() => app.classList.remove('screen-shake'), 350);
              }
              if (window.game) {
                window.game.spawnPotholeSplash(carPos, 16);
                window.game.addNotification('⚠️ POTHOLE HIT! Health -14%', 'warning', 3500);
                window.game.updateHUDStats();
              }
              setTimeout(() => { p.hitRecently = false; }, 1500);
            }
          }
        });
      }

      // 5. Overhead Speed Camera Detection & E-Challans
      if (world.speedCameras) {
        world.speedCameras.forEach(cam => {
          const d = carPos.distanceTo(cam.pos);
          if (d < 5.2 && !cam.triggeredRecently) {
            if (this.speed > cam.speedLimit) {
              cam.triggeredRecently = true;
              sound.playSpeedCam();

              // Screen camera photo flash
              const flash = document.getElementById('speed-cam-flash');
              if (flash) {
                flash.classList.remove('flash-active');
                void flash.offsetWidth;
                flash.classList.add('flash-active');
              }

              // Deduct fine
              if (window.game) {
                window.game.earnings = Math.max(0, window.game.earnings - 150);
                window.game.updateHUDStats();
                const overKmh = Math.round(this.speed * 3.6);
                window.game.addNotification(`🚨 E-CHALLAN! Overspeeding ${overKmh} km/h (-₹150)`, 'danger', 4000);
              }

              setTimeout(() => { cam.triggeredRecently = false; }, 4000);
            }
          }
        });
      }

      // 6. Roadside Garage Pitstop Repair Bay
      if (world.repairBays) {
        world.repairBays.forEach(bay => {
          const d = carPos.distanceTo(bay.pos);
          if (d < bay.radius && !bay.visitedRecently) {
            if (this.health < 100) {
              bay.visitedRecently = true;
              this.health = 100;
              sound.playRepair();
              if (window.game) {
                window.game.addNotification(`🔧 FULL SERVICE COMPLETED! Health 100%`, 'success', 3500);
              }
              setTimeout(() => { bay.visitedRecently = false; }, 5000);
            }
          }
        });
      }

      // 7. Environment collision disabled — collisions now restricted to potholes/debris only
      // Tree, rock, pole, and building collisions removed per design.
    }

    resetToSpline(curve) {
      this.lateralOffset = 0;
      this.lateralVelocity = 0;
      const pt = curve.getPointAt(this.splineProgress);
      const tangent = curve.getTangentAt(this.splineProgress).normalize();
      this.mesh.position.copy(pt);
      // Matches the on-road branch of the ground-following formula in
      // update() (pt.y - 0.18 + 0.25) — using the old flat +0.25 here made
      // the car visibly pop up 0.18m on every crash/checkpoint reset.
      this.mesh.position.y += 0.07;
      this.mesh.lookAt(pt.clone().add(tangent));
      this.speed = 0;
      this.steerAngle = 0;
      this.health = Math.max(75, this.health);
    }

    snapToNearestRoadPoint(curve) {
      // Scan 120 samples across the full spline, find the closest point to current pos
      const SCAN = 120;
      let bestU = this.splineProgress;
      let bestDist = Infinity;
      const pos = this.mesh.position;
      for (let k = 0; k <= SCAN; k++) {
        const u = k / SCAN;
        const candidate = curve.getPointAt(u);
        const d = pos.distanceToSquared(candidate);
        if (d < bestDist) { bestDist = d; bestU = u; }
      }
      this.splineProgress = bestU;
      this.lateralOffset = 0;
      this.lateralVelocity = 0;
      const pt = curve.getPointAt(bestU);
      const tangent = curve.getTangentAt(bestU).normalize();
      this.mesh.position.copy(pt);
      // See resetToSpline — matches the on-road ground-following formula.
      this.mesh.position.y += 0.07;
      this.mesh.lookAt(pt.clone().add(tangent));
      this.speed = 0;
      this.steerAngle = 0;
    }

    setHeadlightsActive(active) {
      if (this.headlights) {
        this.headlights.forEach(h => {
          h.visible = !!active;
          h.intensity = active ? 3.6 : 0.0;
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 7. MAIN SHIPLYP DISPATCH & MISSION ENGINE
  // --------------------------------------------------------------------------
  class ShiplypEngine {
    constructor() {
      this.container = document.getElementById('webgl-container');
      this.modalContainer = document.getElementById('modal-container');
      this.hudOverlay = document.getElementById('in-game-hud');
      this.dockEl = document.getElementById('slowroads-dock');
      this.dockPanelEl = document.getElementById('dock-panel');
      this.scorePopupContainer = document.getElementById('score-popup-container');

      this.gameState = 'menu';
      this.selectedCity = 'mumbai';
      this.selectedSeason = 'autumn';
      this.selectedTimeOfDay = 'day'; // 'dawn', 'day', 'dusk', 'night'
      this.selectedRoadTerrain = 'asphalt'; // 'asphalt', 'gravel', 'mud', 'sand'
      this.selectedSeed = '5927cd04';
      this.selectedVehicle = 'swift';
      this.selectedDifficulty = 'medium';
      this.activeDockPanel = null;
      this.activeCameraMode = 'chase';

      this.earnings = 280;
      this.deliveriesMade = 0;
      this.streakCount = 1;
      this.activeOrderIndex = 0;
      this.orderTimer = 36.0;
      this.maxOrderTimer = 36.0;

      this.resumeCount = 0;
      this.maxResumes = 3;
      this.savedProgressCheckpoint = null;
      this.isStuckModalOpen = false;
      this.stuckTimer = 0;

      this.parcels = []; // 3D In-flight projectiles
      this.particles = []; // 3D Procedural Particle FX System

      this.keys = { up: false, down: false, left: false, right: false, w: false, s: false, a: false, d: false, space: false };
      this.inactivityTimer = 0;

      this.initThree();
      this.buildWorldAndScene();
      this.initEvents();
      this.initHUD();

      // Launch with Landing Page / Dispatch Hub on initial load
      this.renderDispatchHub();

      this.clock = new THREE.Clock();
      requestAnimationFrame(this.animate.bind(this));
    }

    initThree() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 1400);

      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
      } catch (e) {
        console.warn('High-performance WebGL initialization failed, falling back to standard WebGL:', e);
        this.renderer = new THREE.WebGLRenderer({ antialias: false, failIfMajorPerformanceCaveat: false });
      }
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);

      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
      this.scene.add(this.ambientLight);

      this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.35);
      this.scene.add(this.hemiLight);

      this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
      this.sunLight.position.set(150, 250, 100);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 2048;
      this.sunLight.shadow.mapSize.height = 2048;
      this.scene.add(this.sunLight);
    }

    buildWorldAndScene() {
      const season = CONFIG.SEASONS[this.selectedSeason];
      const tod = CONFIG.TIME_OF_DAY[this.selectedTimeOfDay] || CONFIG.TIME_OF_DAY.day;

      this.scene.background = new THREE.Color(tod.skyBottom);
      this.scene.fog = new THREE.FogExp2(tod.fog, tod.fogDensity);

      if (this.ambientLight) {
        this.ambientLight.color.setHex(tod.ambientColor);
        this.ambientLight.intensity = tod.ambientIntensity;
      }
      if (this.sunLight) {
        this.sunLight.color.setHex(tod.sunColor);
        this.sunLight.intensity = tod.sunIntensity;
        this.sunLight.position.set(...tod.sunPos);
      }

      if (this.world) {
        if (this.world.skyMesh) this.scene.remove(this.world.skyMesh);
        if (this.world.roadMesh) this.scene.remove(this.world.roadMesh);
        if (this.world.terrainMesh) this.scene.remove(this.world.terrainMesh);
        if (this.world.floorMesh) this.scene.remove(this.world.floorMesh);
        if (this.world.foliageGroup) this.scene.remove(this.world.foliageGroup);
      }

      this.world = new ProceduralWorld(this.selectedSeed, this.selectedSeason, this.selectedCity);
      this.scene.add(this.world.createSkyDome(season, this.selectedTimeOfDay));
      this.scene.add(this.world.createRoadMesh(this.selectedRoadTerrain));
      this.scene.add(this.world.createWorldFloor(season));
      this.scene.add(this.world.createTerrainMesh(season));
      this.world.createFoliageAndProps(this.scene, season, this.selectedDifficulty);

      if (!this.vehicle) {
        this.vehicle = new VehicleController(this.scene, this.selectedVehicle);
      } else {
        this.vehicle.setVehicleType(this.selectedVehicle);
      }
      this.vehicle.resetToSpline(this.world.curve);
      this.vehicle.setHeadlightsActive(tod.night || tod.id === 'dusk');

      const diffCfg = CONFIG.DIFFICULTY_TIERS[this.selectedDifficulty];
      this.maxOrderTimer = diffCfg.timeLimit;
      this.orderTimer = this.maxOrderTimer;
      this.updateActiveOrderCard();
    }

    updateActiveOrderCard() {
      const cityOrders = CONFIG.ORDERS_BY_CITY[this.selectedCity] || CONFIG.ORDERS_BY_CITY.mumbai;
      const order = cityOrders[this.activeOrderIndex % cityOrders.length];
      const diffCfg = CONFIG.DIFFICULTY_TIERS[this.selectedDifficulty];

      const idEl = document.getElementById('order-id-label');
      if (idEl) idEl.textContent = `ORDER #${order.id} • EXPRESS`;

      const diffPill = document.getElementById('order-difficulty-pill');
      if (diffPill) {
        diffPill.className = `difficulty-pill ${this.selectedDifficulty}`;
        diffPill.textContent = diffCfg.name.toUpperCase();
      }

      const targetEl = document.getElementById('order-target-name');
      if (targetEl) targetEl.textContent = order.name;

      const cargoEl = document.getElementById('order-cargo-desc');
      if (cargoEl) cargoEl.textContent = order.cargo;
    }

    updateOrderTimer(dt) {
      if (this.gameState !== 'playing') return;

      this.orderTimer -= dt;
      const clockEl = document.getElementById('order-timer-clock');
      const barEl = document.getElementById('order-timer-bar');

      if (this.orderTimer <= 0) {
        // Order Timed Out (Late Delivery Penalty)
        this.orderTimer = this.maxOrderTimer;
        this.streakCount = 1;
        this.earnings = Math.max(0, this.earnings - 25);
        sound.playTone(220, 'sawtooth', 0.3, 0.35);

        this.showScoreBanner(`⚠️ TIME EXPIRED! (LATE)`, `Penalty -₹25 • Customer Rating 1★`);
        this.addNotification('❌ DELIVERY MISSED! Time expired (-₹25)', 'danger', 3500);

        this.activeOrderIndex++;
        this.updateActiveOrderCard();
        this.updateHUDStats();
      } else {
        const mins = Math.floor(this.orderTimer / 60);
        const secs = Math.floor(this.orderTimer % 60);
        const ms = Math.floor((this.orderTimer % 1) * 10);
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;

        if (clockEl) {
          clockEl.textContent = timeStr;
          if (this.orderTimer <= 6.0) {
            clockEl.classList.add('urgent');
            if (Math.floor(this.orderTimer * 4) % 4 === 0) sound.playTone(880, 'sine', 0.04, 0.15);
          } else {
            clockEl.classList.remove('urgent');
          }
        }

        if (barEl) {
          const pct = Math.max(0, Math.min(100, (this.orderTimer / this.maxOrderTimer) * 100));
          barEl.style.width = `${pct}%`;
          if (this.orderTimer <= 6.0) barEl.classList.add('urgent');
          else barEl.classList.remove('urgent');
        }
      }
    }

    initEvents() {
      window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      });

      const onKey = (e, val) => {
        this.resetInactivity();
        const k = (e.key || '').toLowerCase();
        const code = e.code || '';
        if (k === 'arrowup' || k === 'w' || code === 'KeyW' || code === 'ArrowUp') this.keys.up = this.keys.w = val;
        if (k === 'arrowdown' || k === 's' || code === 'KeyS' || code === 'ArrowDown') this.keys.down = this.keys.s = val;
        if (k === 'arrowleft' || k === 'a' || code === 'KeyA' || code === 'ArrowLeft') this.keys.left = this.keys.a = val;
        if (k === 'arrowright' || k === 'd' || code === 'KeyD' || code === 'ArrowRight') this.keys.right = this.keys.d = val;
        if (k === ' ' || code === 'Space') this.keys.space = val;
      };

      window.addEventListener('keydown', e => {
        onKey(e, true);
        const k = e.key.toLowerCase();
        if (k === 'f') this.toggleAutodrive();
        if (k === 'r') this.returnToRoad();
        if (k === 'c') this.toggleCameraMode();
        if (k === 't') this.cycleTimeOfDay();
        if (k === 'm') this.toggleMute();
        if (k === 'escape') this.openSettingsModal('gameplay');
        if (k === ' ' && this.gameState === 'playing') this.tossParcel3D();
        if ((k === 'enter' || k === ' ') && this.gameState === 'menu') this.startDrive();
      });

      window.addEventListener('keyup', e => onKey(e, false));
      window.addEventListener('mousemove', () => this.resetInactivity());
      window.addEventListener('mousedown', e => {
        this.resetInactivity();
        if (this.gameState === 'playing' && e.target.tagName === 'CANVAS') {
          this.tossParcel3D();
        }
      });
    }

    tossParcel3D() {
      if (!this.vehicle || !this.world) return;
      const carPos = this.vehicle.mesh.position.clone();
      const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicle.mesh.quaternion).normalize();
      const carRight = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.vehicle.mesh.quaternion).normalize();

      // Find nearest delivery target
      let nearestTarget = null;
      let minD = 40.0;
      this.world.deliveryTargets.forEach(t => {
        const d = carPos.distanceTo(t.pos);
        if (d < minD && !t.delivered) {
          minD = d;
          nearestTarget = t;
        }
      });

      // Differentiated 3D Cargo Models based on active order
      const parcelGroup = new THREE.Group();
      const cityOrdersForCargo = CONFIG.ORDERS_BY_CITY[this.selectedCity] || CONFIG.ORDERS_BY_CITY.mumbai;
      const orderIdx = this.activeOrderIndex % cityOrdersForCargo.length;
      const cargoType = orderIdx % 4; // 0: Dabba, 1: Pizza Box, 2: Wooden Crate, 3: Express Parcel

      if (cargoType === 0) {
        // 1. Mumbai Dabbawala Tiered Stainless Steel Tiffin
        const steelMat = new THREE.MeshPhongMaterial({ color: 0xe2e8f0, specular: 0xffffff, shininess: 80, flatShading: true });
        const brassMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
        // 3 stacked tiffin tins
        for (let t = 0; t < 3; t++) {
          const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 12), steelMat);
          tin.position.y = 0.08 + t * 0.15;
          parcelGroup.add(tin);
        }
        // Locking Brass Clamp & Top Handle
        const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.5), brassMat);
        clamp.position.y = 0.26;
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI), brassMat);
        handle.position.y = 0.52;
        parcelGroup.add(clamp);
        parcelGroup.add(handle);
      } else if (cargoType === 1) {
        // 2. Hot Pizza & Bakery Delivery Box (Flat square carton with red ribbon)
        const boxMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.65), boxMat);
        box.position.y = 0.07;
        const label = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.15, 0.38), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        label.position.set(0, 0.08, 0);
        parcelGroup.add(box);
        parcelGroup.add(label);
      } else if (cargoType === 2) {
        // 3. Rustic Wooden Farmstead Harvest Crate
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
        const produceMat = new THREE.MeshLambertMaterial({ color: 0x16a34a });
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.45), woodMat);
        crate.position.y = 0.18;
        const produce = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.38), produceMat);
        produce.position.set(0, 0.30, 0);
        parcelGroup.add(crate);
        parcelGroup.add(produce);
      } else {
        // 4. Sealed Corrugated Express Mail Parcel
        const cardMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
        const tapeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
        const parcel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.5), cardMat);
        parcel.position.y = 0.21;
        const tape = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.52), tapeMat);
        tape.position.y = 0.21;
        parcelGroup.add(parcel);
        parcelGroup.add(tape);
      }

      parcelGroup.position.copy(carPos).add(new THREE.Vector3(0, 1.2, 0));
      this.scene.add(parcelGroup);

      const targetDir = nearestTarget ? nearestTarget.pos.clone().sub(carPos).normalize() : carForward.clone().addScaledVector(carRight, (Math.random() > 0.5 ? 0.6 : -0.6)).normalize();

      this.parcels.push({
        mesh: parcelGroup,
        pos: parcelGroup.position.clone(),
        vel: targetDir.multiplyScalar(24.0).add(new THREE.Vector3(0, 8.0, 0)),
        nearestTarget: nearestTarget,
        life: 1.5
      });

      sound.playTone(440, 'triangle', 0.12, 0.3);
    }

    updateParcels(dt) {
      for (let i = this.parcels.length - 1; i >= 0; i--) {
        const p = this.parcels[i];
        p.vel.y -= 18.0 * dt; // Gravity
        p.pos.addScaledVector(p.vel, dt);
        p.mesh.position.copy(p.pos);
        p.mesh.rotation.x += 4.0 * dt;
        p.mesh.rotation.y += 3.0 * dt;
        p.life -= dt;

        // Hit Detection with Porch Ring
        if (p.nearestTarget && !p.nearestTarget.delivered) {
          const d = p.pos.distanceTo(p.nearestTarget.pos);
          const hitRadius = p.nearestTarget.tossRadius || 5.0;

          if (d < hitRadius) {
            p.nearestTarget.delivered = true;
            p.nearestTarget.ring.material.color.setHex(0xff9f1c);

            this.deliveriesMade++;
            this.streakCount++;

            const diffCfg = CONFIG.DIFFICULTY_TIERS[this.selectedDifficulty];
            const timeBonus = Math.max(0, Math.round(this.orderTimer * 1.8));
            const earnedBonus = Math.round((p.nearestTarget.order.reward + timeBonus) * diffCfg.payoutMult * (1 + this.streakCount * 0.2));
            this.earnings += earnedBonus;

            this.orderTimer = this.maxOrderTimer; // Reset clock for next order

            sound.playCombo();
            const bonusMsg = (this.orderTimer > this.maxOrderTimer * 0.5 ? `⚡ EXPRESS SPEED BONUS!` : `🎯 ON-TIME BULLSEYE!`);
            this.spawnConfetti(p.nearestTarget.pos, 36);
            this.showScoreBanner(`${bonusMsg} +₹${earnedBonus}`, `🔥 ${this.streakCount}x STREAK • +${timeBonus} TIME BONUS`);
            this.addNotification(`✅ DELIVERY #${this.deliveriesMade} COMPLETE! +₹${earnedBonus} (${this.streakCount}x streak)`, 'success', 4000);

            this.activeOrderIndex++;
            this.updateActiveOrderCard();
            this.updateHUDStats();

            this.scene.remove(p.mesh);
            this.parcels.splice(i, 1);
            continue;
          }
        }

        if (p.life <= 0 || p.pos.y < 0.2) {
          this.scene.remove(p.mesh);
          this.parcels.splice(i, 1);
        }
      }
    }

    spawnConfetti(centerPos, count = 30) {
      if (!this.scene) return;
      const palette = [0xf97316, 0x00f5d4, 0xffb703, 0xf43f5e, 0xffffff, 0x7c3aed];
      const geom = new THREE.BoxGeometry(0.18, 0.18, 0.18);
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: palette[i % palette.length] });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(centerPos).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.5, (Math.random() - 0.5) * 1.5));
        this.scene.add(mesh);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = 4.0 + Math.random() * 8.0;
        this.particles.push({
          mesh: mesh,
          vel: new THREE.Vector3(Math.cos(angle) * speed, 7.0 + Math.random() * 9.0, Math.sin(angle) * speed),
          rotVel: new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5),
          life: 1.8 + Math.random() * 0.8,
          maxLife: 2.5,
          gravity: 12.0
        });
      }
    }

    spawnDust(pos, count = 3) {
      if (!this.scene || this.particles.length > 80) return;
      const geom = new THREE.SphereGeometry(0.14, 5, 5);
      const mat = new THREE.MeshBasicMaterial({ color: 0xd4a373, transparent: true, opacity: 0.6 });
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(geom, mat.clone());
        mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.1, (Math.random() - 0.5) * 0.8));
        this.scene.add(mesh);
        this.particles.push({
          mesh: mesh,
          vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5),
          rotVel: new THREE.Vector3(0, 0, 0),
          life: 0.6 + Math.random() * 0.4,
          maxLife: 1.0,
          gravity: 0.5,
          isDust: true
        });
      }
    }

    spawnPotholeSplash(pos, count = 14) {
      if (!this.scene) return;
      const geom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: (Math.random() > 0.5 ? 0x2b1e16 : 0x1a1a1a) });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.2, (Math.random() - 0.5) * 1.2));
        this.scene.add(mesh);
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.0 + Math.random() * 5.0;
        this.particles.push({
          mesh: mesh,
          vel: new THREE.Vector3(Math.cos(angle) * speed, 4.0 + Math.random() * 6.0, Math.sin(angle) * speed),
          rotVel: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
          life: 0.8 + Math.random() * 0.4,
          maxLife: 1.2,
          gravity: 16.0
        });
      }
    }

    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.vel.y -= pt.gravity * dt;
        pt.mesh.position.addScaledVector(pt.vel, dt);
        pt.mesh.rotation.x += pt.rotVel.x * dt;
        pt.mesh.rotation.y += pt.rotVel.y * dt;
        pt.mesh.rotation.z += pt.rotVel.z * dt;
        pt.life -= dt;

        if (pt.isDust && pt.mesh.material) {
          const ratio = Math.max(0, pt.life / pt.maxLife);
          pt.mesh.material.opacity = ratio * 0.6;
          pt.mesh.scale.setScalar(1.0 + (1.0 - ratio) * 1.8);
        }

        if (pt.life <= 0 || pt.mesh.position.y < -1) {
          this.scene.remove(pt.mesh);
          if (pt.mesh.geometry) pt.mesh.geometry.dispose();
          if (pt.mesh.material) pt.mesh.material.dispose();
          this.particles.splice(i, 1);
        }
      }
    }

    showScoreBanner(title, sub) {
      if (!this.scorePopupContainer) return;
      const banner = document.createElement('div');
      banner.className = 'score-popup-banner';
      banner.innerHTML = `
        <span class="popup-title">${title}</span>
        <span class="popup-sub">${sub}</span>
      `;
      this.scorePopupContainer.appendChild(banner);
      setTimeout(() => banner.remove(), 2000);
    }

    updateHUDStats() {
      const countEl = document.getElementById('delivery-count');
      if (countEl) countEl.textContent = `${this.deliveriesMade} / 12`;

      const earnEl = document.getElementById('hud-earnings');
      if (earnEl) earnEl.textContent = this.earnings;

      const streakEl = document.getElementById('hud-streak-pill');
      if (streakEl) streakEl.innerHTML = `<span>🔥 ${this.streakCount}x STREAK</span>`;
    }

    updateHealthHUD() {
      if (!this.vehicle) return;
      const fill = document.getElementById('hud-health-fill');
      const text = document.getElementById('hud-health-text');
      const icon = document.getElementById('health-icon');

      const h = Math.max(0, Math.min(100, Math.round(this.vehicle.health)));
      if (fill) {
        fill.style.width = `${h}%`;
        fill.classList.remove('warning', 'critical');
        if (h < 30) {
          fill.classList.add('critical');
        } else if (h < 60) {
          fill.classList.add('warning');
        }
      }
      if (text) {
        text.textContent = `${h}%`;
      }
      if (icon) {
        if (h <= 0) icon.textContent = '🛠️';
        else if (h < 40) icon.textContent = '⚠️';
        else icon.textContent = '🔧';
      }
    }

    initHUD() {
      // Cinematic Intro Screen Dismiss Handler
      const introScreen = document.getElementById('intro-screen');
      const btnIntroStart = document.getElementById('btn-intro-start');
      const dismissIntro = () => {
        if (introScreen && !introScreen.classList.contains('dismissed')) {
          introScreen.classList.add('dismissed');
          sound.ensure();
          this.renderDispatchHub();
        }
      };

      if (btnIntroStart) btnIntroStart.addEventListener('click', dismissIntro);
      if (introScreen) {
        introScreen.addEventListener('click', (e) => {
          if (e.target !== btnIntroStart && !btnIntroStart?.contains(e.target)) dismissIntro();
        });
      }
      window.addEventListener('keydown', (e) => {
        if (introScreen && !introScreen.classList.contains('dismissed')) {
          dismissIntro();
        }
      }, { once: true });

      // 90s Bollywood Cassette Player Controls
      const radioCard = document.getElementById('cassette-radio-card');
      const radioTitleEl = document.getElementById('radio-track-title');
      const btnPlay = document.getElementById('btn-radio-play');
      const btnNext = document.getElementById('btn-radio-next');
      const btnPrev = document.getElementById('btn-radio-prev');

      const svgPlay = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      const svgPause = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

      if (btnPlay) {
        btnPlay.onclick = () => {
          sound.ensure();
          const isPlaying = sound.toggleRadio();
          btnPlay.textContent = isPlaying ? 'PAUSE' : 'PLAY';
          const trk = sound.realTracks[sound.currentTrackIndex];
          if (radioTitleEl) radioTitleEl.textContent = `${trk.title} - Dhaba FM`;
          if (radioCard) {
            if (isPlaying) radioCard.classList.add('playing');
            else radioCard.classList.remove('playing');
          }
        };
      }

      if (btnNext) {
        btnNext.onclick = () => {
          sound.ensure();
          const title = sound.nextTrack();
          if (radioTitleEl) radioTitleEl.textContent = `${title} - Dhaba FM`;
          if (radioCard) radioCard.classList.add('playing');
          if (btnPlay) btnPlay.textContent = 'PAUSE';
        };
      }

      if (btnPrev) {
        btnPrev.onclick = () => {
          sound.ensure();
          const title = sound.prevTrack();
          if (radioTitleEl) radioTitleEl.textContent = `${title} - Dhaba FM`;
          if (radioCard) radioCard.classList.add('playing');
          if (btnPlay) btnPlay.textContent = 'PAUSE';
        };
      }

      document.getElementById('btn-hud-autodrive')?.addEventListener('click', () => this.toggleAutodrive());
      document.getElementById('btn-hud-reset')?.addEventListener('click', () => {
        this.returnToRoad();
      });
      document.getElementById('btn-hud-tod')?.addEventListener('click', () => this.cycleTimeOfDay());
      document.getElementById('btn-dock-tod')?.addEventListener('click', () => this.cycleTimeOfDay());
      document.getElementById('btn-hud-camera')?.addEventListener('click', () => this.toggleCameraMode());
      document.getElementById('btn-dock-camera')?.addEventListener('click', () => this.toggleCameraMode());
      document.getElementById('btn-hud-sound')?.addEventListener('click', () => this.toggleMute());
      document.getElementById('btn-dock-sound')?.addEventListener('click', () => this.toggleMute());
      document.getElementById('btn-dock-settings')?.addEventListener('click', () => this.openSettingsModal('gameplay'));
      document.getElementById('btn-dock-home')?.addEventListener('click', () => this.renderDispatchHub());

      const dockTabBtns = document.querySelectorAll('.dock-tab-btn');
      dockTabBtns.forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          this.resetInactivity();
          const panel = btn.dataset.panel;

          if (this.activeDockPanel === panel) {
            this.activeDockPanel = null;
            this.dockPanelEl.style.display = 'none';
            dockTabBtns.forEach(b => b.classList.remove('active-dock-tab'));
          } else {
            this.activeDockPanel = panel;
            dockTabBtns.forEach(b => b.classList.remove('active-dock-tab'));
            btn.classList.add('active-dock-tab');
            this.dockPanelEl.style.display = 'block';
            this.renderDockPanelContent(panel);
          }
        });
      });
    }

    showScorePopup(amount, text) {
      const sub = (amount !== 0) ? (amount > 0 ? `+₹${amount}` : `-₹${Math.abs(amount)}`) : '';
      this.showScoreBanner(text, sub);
    }

    addNotification(message, type = 'neutral', duration = 4000) {
      const stack = document.getElementById('notification-stack');
      if (!stack) return;

      const item = document.createElement('div');
      item.className = `notification-item ${type}`;
      item.textContent = message;
      item.style.opacity = '0';

      stack.appendChild(item);

      // Trigger animation
      requestAnimationFrame(() => {
        item.style.opacity = '1';
      });

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => {
          item.classList.add('removing');
          setTimeout(() => item.remove(), 250);
        }, duration);
      }
    }

    toggleMute() {
      const isMuted = sound.toggleMute();
      const hudBtn = document.getElementById('btn-hud-sound');
      const dockBtn = document.getElementById('btn-dock-sound');
      const hubBtn = document.getElementById('btn-hub-mute');
      if (hudBtn) hudBtn.textContent = isMuted ? 'UNMUTE' : 'MUTE';
      if (dockBtn) dockBtn.textContent = isMuted ? 'UNMUTE' : 'AUDIO';
      if (hubBtn) hubBtn.innerHTML = `<span>${isMuted ? 'UNMUTE [M]' : 'MUTE [M]'}</span>`;
      this.showScorePopup(0, isMuted ? 'AUDIO MUTED' : 'SOUND UNMUTED');
    }

    updateClimateHUD() {
      const isRain = (this.selectedSeason === 'autumn' || this.selectedSeason === 'summer');
      const isWind = (this.selectedSeason === 'winter' || this.selectedSeason === 'summer');

      const pill = document.getElementById('hud-climate-pill');
      const icon = document.getElementById('climate-icon');
      const text = document.getElementById('climate-status');

      if (pill && text) {
        if (isRain) {
          pill.className = 'climate-pill rain';
          if (icon) icon.textContent = '🌧️';
          text.textContent = `MONSOON RAIN • SLIPPERY GRIP (${this.vehicle.vehicleType === 'cycle' ? '48%' : '68%'})`;
        } else if (isWind) {
          pill.className = 'climate-pill wind';
          if (icon) icon.textContent = '💨';
          text.textContent = 'GUSTY HEADWIND • DRAG +35%';
        } else {
          pill.className = 'climate-pill';
          if (icon) icon.textContent = '☀️';
          text.textContent = 'DRY HIGHWAY • OPTIMAL GRIP 100%';
        }
      }
    }

    toggleAutodrive() {
      this.vehicle.isAutodrive = !this.vehicle.isAutodrive;
      const pill = document.getElementById('btn-hud-autodrive');
      const text = document.getElementById('autodrive-text');
      if (pill && text) {
        if (this.vehicle.isAutodrive) {
          pill.classList.add('autodrive-active');
          text.textContent = 'AUTOPILOT [ON]';
        } else {
          pill.classList.remove('autodrive-active');
          text.textContent = 'AUTOPILOT [F]';
        }
      }
    }

    toggleCameraMode() {
      const modes = ['chase', 'hood', 'sky'];
      const curIdx = modes.indexOf(this.activeCameraMode || 'chase');
      this.activeCameraMode = modes[(curIdx + 1) % modes.length];
      const names = { chase: 'ELEVATED CHASE CAM', hood: 'HOOD BUMPER CAM', sky: 'HIGH PANORAMIC CAM' };
      this.showScorePopup(0, `📹 ${names[this.activeCameraMode]}`);
      sound.playTone(800, 'sine', 0.08);
    }

    setTimeOfDay(todKey) {
      this.selectedTimeOfDay = todKey;
      const tod = CONFIG.TIME_OF_DAY[todKey] || CONFIG.TIME_OF_DAY.day;

      if (this.ambientLight) {
        this.ambientLight.color.setHex(tod.ambientColor);
        this.ambientLight.intensity = tod.ambientIntensity;
      }
      if (this.sunLight) {
        this.sunLight.color.setHex(tod.sunColor);
        this.sunLight.intensity = tod.sunIntensity;
        this.sunLight.position.set(...tod.sunPos);
      }
      if (this.scene) {
        this.scene.background = new THREE.Color(tod.skyBottom);
        if (this.scene.fog) {
          this.scene.fog.color.setHex(tod.fog);
          this.scene.fog.density = tod.fogDensity;
        }
      }

      if (this.world && this.world.skyMesh) {
        this.scene.remove(this.world.skyMesh);
        const newSky = this.world.createSkyDome(CONFIG.SEASONS[this.selectedSeason], todKey);
        this.scene.add(newSky);
        if (this.camera) newSky.position.copy(this.camera.position);
      }

      if (this.vehicle) {
        this.vehicle.setHeadlightsActive(tod.night || tod.id === 'dusk');
      }

      const hudTod = document.getElementById('btn-hud-tod');
      const dockTod = document.getElementById('btn-dock-tod');
      if (hudTod) hudTod.textContent = tod.icon;
      if (dockTod) dockTod.textContent = tod.icon;

      this.showScorePopup(0, `${tod.icon} ${tod.name.toUpperCase()}`);
    }

    cycleTimeOfDay() {
      const keys = Object.keys(CONFIG.TIME_OF_DAY);
      const curIdx = keys.indexOf(this.selectedTimeOfDay || 'day');
      const nextKey = keys[(curIdx + 1) % keys.length];
      this.setTimeOfDay(nextKey);
      sound.playTone(720, 'sine', 0.1);
    }

    showStuckRecoveryModal(reason = 'Vehicle Immobilized') {
      if (this.isStuckModalOpen || this.gameState !== 'playing') return;
      this.isStuckModalOpen = true;

      if (this.resumeCount >= this.maxResumes) {
        // Shift Failed - 3 Resumes Exhausted! Restore baseline checkpoint saved before resume #1
        const restoredEarnings = this.savedProgressCheckpoint ? this.savedProgressCheckpoint.earnings : this.earnings;
        const restoredDeliveries = this.savedProgressCheckpoint ? this.savedProgressCheckpoint.deliveriesMade : this.deliveriesMade;

        if (this.savedProgressCheckpoint) {
          this.earnings = this.savedProgressCheckpoint.earnings;
          this.deliveriesMade = this.savedProgressCheckpoint.deliveriesMade;
          this.streakCount = this.savedProgressCheckpoint.streakCount;
          this.activeOrderIndex = this.savedProgressCheckpoint.activeOrderIndex;
          this.updateHUDStats();
          this.updateActiveOrderCard();
        }

        this.modalContainer.innerHTML = `
          <div class="modal-backdrop">
            <div class="recovery-card">
              <div class="recovery-badge failed">🚨 DISPATCH SHIFT FAILED</div>
              <h2 class="recovery-title">ALL 3 RECOVERY RESUMES EXHAUSTED</h2>
              <div class="recovery-resumes-pill exhausted">
                <span>❌ 0 / 3 RESUMES REMAINING</span>
              </div>
              <p class="recovery-desc">
                Your courier vehicle suffered total mechanical failure beyond towing limits.
                <br><br>
                <strong>Progress Saved Before 1st Resume Restored:</strong>
                <br>💰 Earnings: ₹${restoredEarnings} • 📦 Deliveries: ${restoredDeliveries}
              </p>
              <button id="btn-restart-shift" class="btn-resume-drive">
                <span>🔄 RESTART DISPATCH SHIFT (PROGRESS RESTORED)</span>
              </button>
            </div>
          </div>
        `;

        document.getElementById('btn-restart-shift')?.addEventListener('click', () => {
          this.resumeCount = 0;
          this.isStuckModalOpen = false;
          this.stuckTimer = 0;
          this.modalContainer.innerHTML = '';
          this.buildWorldAndScene();
          this.startDrive();
        });
        sound.playCrash();
        return;
      }

      // Snapshot progress right before the 1st resume
      if (this.resumeCount === 0 || !this.savedProgressCheckpoint) {
        this.savedProgressCheckpoint = {
          earnings: this.earnings,
          deliveriesMade: this.deliveriesMade,
          streakCount: this.streakCount,
          activeOrderIndex: this.activeOrderIndex
        };
      }

      const remaining = this.maxResumes - this.resumeCount;

      this.modalContainer.innerHTML = `
        <div class="modal-backdrop">
          <div class="recovery-card">
            <div class="recovery-badge">⚠️ ROADSIDE ASSISTANCE</div>
            <h2 class="recovery-title">${reason}</h2>
            <div class="recovery-resumes-pill">
              <span>🛟 RESUMES: ${remaining} / ${this.maxResumes} REMAINING</span>
            </div>
            <p class="recovery-desc">
              Your courier vehicle is immobilized or took critical damage.
              Tow vehicle back to road centerline with roadside assistance.
              <br><br>
              <small style="color: #fca311;">⚠️ Note: You have ${remaining} resume${remaining === 1 ? '' : 's'} remaining. On 4th breakdown, shift fails and restores progress saved before resume #1.</small>
            </p>
            <button id="btn-resume-drive" class="btn-resume-drive">
              <span>⚡ RESUME DISPATCH (TOW RECOVERY) [R]</span>
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-resume-drive')?.addEventListener('click', () => {
        this.executeResumeRecovery();
      });

      sound.playPothole();
    }

    executeResumeRecovery() {
      if (this.resumeCount >= this.maxResumes) {
        this.showStuckRecoveryModal('Max 3 Resumes Exceeded!');
        return;
      }
      this.resumeCount++;
      this.isStuckModalOpen = false;
      this.stuckTimer = 0;
      this.modalContainer.innerHTML = '';

      if (this.vehicle && this.world) {
        this.vehicle.health = 75;
        this.vehicle.snapToNearestRoadPoint(this.world.curve);
      }

      this.updateHUDStats();
      this.updateHealthHUD();
      sound.playRepair();
      this.showScorePopup(0, `🛟 RESUME #${this.resumeCount}/3 USED! Vehicle Serviced`);
    }

    returnToRoad() {
      // Free instant snap back — no resume count penalty, no health cost
      if (!this.vehicle || !this.world) return;
      this.stuckTimer = 0;
      this.isStuckModalOpen = false;
      this.lostFromRoad = false;
      this.hideReturnToRoadBanner();
      this.vehicle.snapToNearestRoadPoint(this.world.curve);
      this.showScorePopup(0, '🗺️ RETURNED TO ROAD — DRIVE SAFELY!');
      sound.playRepair && sound.playRepair();
    }

    showReturnToRoadBanner() {
      if (document.getElementById('return-road-banner')) return;
      const banner = document.createElement('div');
      banner.id = 'return-road-banner';
      banner.style.cssText = [
        'position: absolute',
        'bottom: 120px',
        'left: 50%',
        'transform: translateX(-50%)',
        'background: linear-gradient(135deg, rgba(255,60,0,0.96) 0%, rgba(200,10,10,0.96) 100%)',
        'color: #fff',
        'padding: 14px 32px',
        'border-radius: 50px',
        'font-family: Outfit, sans-serif',
        'font-size: 1.1rem',
        'font-weight: 700',
        'letter-spacing: 0.04em',
        'text-align: center',
        'box-shadow: 0 8px 40px rgba(255,60,0,0.55), 0 2px 0 rgba(255,255,255,0.1) inset',
        'z-index: 8888',
        'cursor: pointer',
        'border: 2px solid rgba(255,200,120,0.45)',
        'animation: rtrPulse 1.2s ease-in-out infinite alternate'
      ].join(';');
      banner.innerHTML = '🗺️&nbsp; YOU ARE OFF-ROAD &nbsp;|&nbsp; Press <kbd style="background:rgba(255,255,255,0.22);padding:2px 8px;border-radius:6px;">R</kbd> or tap here to Return to Road';
      banner.onclick = () => this.returnToRoad();

      // Inject animation keyframe once
      if (!document.getElementById('rtr-style')) {
        const style = document.createElement('style');
        style.id = 'rtr-style';
        style.textContent = '@keyframes rtrPulse{from{box-shadow:0 8px 40px rgba(255,60,0,0.55),0 2px 0 rgba(255,255,255,0.1) inset}to{box-shadow:0 8px 60px rgba(255,120,0,0.85),0 2px 0 rgba(255,255,255,0.1) inset}}';
        document.head.appendChild(style);
      }

      const app = document.getElementById('game-app');
      if (app) app.appendChild(banner);
    }

    hideReturnToRoadBanner() {
      const b = document.getElementById('return-road-banner');
      if (b) b.remove();
    }

    resetInactivity() {
      this.inactivityTimer = 0;
      this.hudOverlay.classList.remove('hud-hidden');
      this.dockEl.classList.remove('dock-hidden');
    }

    startDrive() {
      this.gameState = 'playing';
      this.modalContainer.innerHTML = '';
      this.hudOverlay.style.display = 'block';
      this.dockEl.style.display = 'flex';
      this.isStuckModalOpen = false;
      this.stuckTimer = 0;

      if (this.savedProgressCheckpoint === null) {
        this.savedProgressCheckpoint = {
          earnings: this.earnings,
          deliveriesMade: this.deliveriesMade,
          streakCount: this.streakCount,
          activeOrderIndex: this.activeOrderIndex
        };
      }

      this.resetInactivity();
      this.updateHUDStats();
      if (this.vehicle) {
        const carPos = this.vehicle.mesh.position;
        const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicle.mesh.quaternion).normalize();
        this.camera.position.copy(carPos.clone().addScaledVector(carForward, -6.8).add(new THREE.Vector3(0, 3.0, 0)));
        this.camLookTarget = carPos.clone().addScaledVector(carForward, 28.0).add(new THREE.Vector3(0, 0.8, 0));
        this.camera.lookAt(this.camLookTarget);
      }
      sound.ensure();
      sound.playTone(523, 'sine', 0.2);

      // Resume 90s Dhaba FM Cassette Radio only if the player previously opted in
      if (!sound.radioPlaying && !sound.muted && sound.userWantsRadio) {
        sound.toggleRadio();
        const btnPlay = document.getElementById('btn-radio-play');
        const radioCard = document.getElementById('cassette-radio-card');
        const radioTitleEl = document.getElementById('radio-track-title');
        if (btnPlay) btnPlay.textContent = 'PAUSE';
        if (radioCard) radioCard.classList.add('playing');
        const trk = sound.realTracks[sound.currentTrackIndex];
        if (radioTitleEl) radioTitleEl.textContent = `${trk.title} - Dhaba FM`;
      }
    }

    renderDispatchHub() {
      this.gameState = 'menu';
      this.hudOverlay.style.display = 'none';
      this.dockEl.style.display = 'none';
      if (this.dockPanelEl) this.dockPanelEl.style.display = 'none';

      const cityList = [
        { id: 'mumbai', name: 'Mumbai' },
        { id: 'delhi', name: 'Delhi' },
        { id: 'kolkata', name: 'Kolkata' },
        { id: 'pune', name: 'Pune' },
        { id: 'bangalore', name: 'Bengaluru' }
      ];

      const vehList = [
        { id: 'swift', name: 'Raftaar GT Hatch', stat: '160 km/h • Sports EV' },
        { id: 'chotahathi', name: 'Gaja 500 Mini-Truck', stat: '110 km/h • Cargo Deck' },
        { id: 'scooter', name: 'Vayu Volt Scooter', stat: '120 km/h • Thermal Backpack' },
        { id: 'cycle', name: 'Pawan Pedaler Bike', stat: '80 km/h • Carrier Rack' }
      ];

      const diffList = [
        { id: 'easy', name: 'Relaxed Shift', stat: '55s • Roadside Curbs' },
        { id: 'medium', name: 'City Standard', stat: '36s • Winding Hills • 1.5x' },
        { id: 'hard', name: 'Rush Hour Pro', stat: '22s • Hidden Havelis • 2.5x' }
      ];

      this.modalContainer.innerHTML = `
        <div class="modal-backdrop">
          <div class="shiplyp-hub-card">
            <div class="hub-brand-header">
              <h1 class="hub-brand-title">SHIP<span>LYP</span></h1>
            </div>
            <p class="hub-tagline">Last Mile Courier • India Dispatch OS</p>

            <!-- 1. Select Region -->
            <div class="hub-city-selector">
              <span class="hub-section-label">SELECT DISPATCH REGION</span>
              <div class="hub-city-pills">
                ${cityList.map(c => `
                  <button class="city-pill-btn ${this.selectedCity === c.id ? 'active-city' : ''}" data-city="${c.id}">
                    <span class="city-pill-name">${c.name.toUpperCase()}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 2. Select Difficulty Tier -->
            <div class="hub-difficulty-selector">
              <span class="hub-section-label">SELECT DELIVERY DIFFICULTY & TIMERS</span>
              <div class="hub-difficulty-grid">
                ${diffList.map(d => `
                  <button class="diff-card-btn ${d.id} ${this.selectedDifficulty === d.id ? `active-diff ${d.id}` : ''}" data-diff="${d.id}">
                    <span class="diff-card-title">${d.name.toUpperCase()}</span>
                    <span class="diff-card-stat">${d.stat}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 3. Select Courier Vehicle -->
            <div class="hub-vehicle-selector">
              <span class="hub-section-label">SELECT COURIER FLEET VEHICLE</span>
              <div class="hub-vehicle-grid">
                ${vehList.map(v => `
                  <button class="vehicle-card-btn ${this.selectedVehicle === v.id ? 'active-veh' : ''}" data-veh="${v.id}">
                    <span class="vehicle-card-title">${v.name}</span>
                    <span class="vehicle-card-stat">${v.stat}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <button id="btn-start-dispatch" class="btn-launch-dispatch">
              <span>START COURIER DISPATCH</span>
            </button>

            <div class="hub-footer-links">
              <button id="btn-hub-mute" class="hub-link-btn"><span>${sound.muted ? 'UNMUTE [M]' : 'MUTE [M]'}</span></button>
              <button id="btn-hub-fleet" class="hub-link-btn">FLEET TUNING</button>
              <button id="btn-hub-log" class="hub-link-btn">COURIER LOG</button>
            </div>
          </div>
        </div>
      `;

      this.modalContainer.querySelectorAll('.city-pill-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectedCity = btn.dataset.city;
          this.selectedSeason = CONFIG.CITIES[this.selectedCity].season;
          this.modalContainer.querySelectorAll('.city-pill-btn').forEach(b => b.classList.remove('active-city'));
          btn.classList.add('active-city');
          sound.playTone(600, 'sine', 0.08);
        });
      });

      this.modalContainer.querySelectorAll('.diff-card-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectedDifficulty = btn.dataset.diff;
          this.modalContainer.querySelectorAll('.diff-card-btn').forEach(b => {
            b.classList.remove('active-diff');
          });
          btn.classList.add('active-diff');
          sound.playTone(700, 'sine', 0.08);
        });
      });

      this.modalContainer.querySelectorAll('.vehicle-card-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectedVehicle = btn.dataset.veh;
          this.modalContainer.querySelectorAll('.vehicle-card-btn').forEach(b => b.classList.remove('active-veh'));
          btn.classList.add('active-veh');
          if (this.vehicle) this.vehicle.setVehicleType(this.selectedVehicle);
          sound.playTone(750, 'sine', 0.08);
        });
      });

      document.getElementById('btn-start-dispatch')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.buildWorldAndScene();
        this.startDrive();
      });
      document.getElementById('btn-hub-mute')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleMute();
      });
      document.getElementById('btn-hub-fleet')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.openSettingsModal('gameplay');
      });
      document.getElementById('btn-hub-log')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.openSettingsModal('profile');
      });
    }

    renderDockPanelContent(type) {
      const el = this.dockPanelEl;

      if (type === 'world') {
        const cityKeys = Object.keys(CONFIG.CITIES);
        el.innerHTML = `
          <div class="dock-panel-grid">
            <div class="dock-panel-col">
              <span class="dock-panel-label">CITY ROUTE</span>
              <div class="dock-stepper-box">
                <button id="dp-c-prev" class="stepper-arrow">&lt;</button>
                <span class="dock-stepper-val">${CONFIG.CITIES[this.selectedCity].name.toUpperCase()}</span>
                <button id="dp-c-next" class="stepper-arrow">&gt;</button>
              </div>
            </div>
            <div class="dock-panel-col">
              <span class="dock-panel-label">ROAD SURFACE</span>
              <div class="dock-btn-row">
                <button class="dock-sq-btn ${this.selectedRoadTerrain === 'asphalt' ? 'active-sq' : ''}" data-rt="asphalt">ASPHALT</button>
                <button class="dock-sq-btn ${this.selectedRoadTerrain === 'gravel' ? 'active-sq' : ''}" data-rt="gravel">GRAVEL</button>
                <button class="dock-sq-btn ${this.selectedRoadTerrain === 'mud' ? 'active-sq' : ''}" data-rt="mud">MUD</button>
                <button class="dock-sq-btn ${this.selectedRoadTerrain === 'sand' ? 'active-sq' : ''}" data-rt="sand">SAND</button>
              </div>
            </div>
            <div class="dock-panel-col">
              <span class="dock-panel-label">ROUTE SEED</span>
              <div class="dock-stepper-box">
                <span class="dock-stepper-val" style="font-family: monospace;">${this.selectedSeed}</span>
                <button id="dp-s-rand" class="stepper-arrow">RANDOM</button>
              </div>
            </div>
            <button id="dp-gen-btn" class="btn-generate-dock">APPLY & REGEN</button>
          </div>
        `;
        document.getElementById('dp-c-prev').onclick = () => {
          let idx = (cityKeys.indexOf(this.selectedCity) - 1 + cityKeys.length) % cityKeys.length;
          this.selectedCity = cityKeys[idx];
          this.selectedSeason = CONFIG.CITIES[this.selectedCity].season;
          this.renderDockPanelContent('world');
        };
        document.getElementById('dp-c-next').onclick = () => {
          let idx = (cityKeys.indexOf(this.selectedCity) + 1) % cityKeys.length;
          this.selectedCity = cityKeys[idx];
          this.selectedSeason = CONFIG.CITIES[this.selectedCity].season;
          this.renderDockPanelContent('world');
        };
        el.querySelectorAll('[data-rt]').forEach(b => {
          b.onclick = () => {
            this.selectedRoadTerrain = b.dataset.rt;
            this.buildWorldAndScene();
            this.renderDockPanelContent('world');
            sound.playTone(650, 'sine', 0.1);
          };
        });
        document.getElementById('dp-s-rand').onclick = () => {
          this.selectedSeed = Math.random().toString(36).substring(2, 10);
          this.renderDockPanelContent('world');
        };
        document.getElementById('dp-gen-btn').onclick = () => {
          this.buildWorldAndScene();
          this.dockPanelEl.style.display = 'none';
          this.activeDockPanel = null;
          document.querySelectorAll('.dock-tab-btn').forEach(b => b.classList.remove('active-dock-tab'));
          sound.playTone(600, 'sine', 0.15);
        };
      } else if (type === 'style') {
        el.innerHTML = `
          <div class="dock-panel-grid">
            <div class="dock-panel-col">
              <span class="dock-panel-label">TIME OF DAY [T]</span>
              <div class="dock-btn-row">
                <button class="dock-sq-btn ${this.selectedTimeOfDay === 'dawn' ? 'active-sq' : ''}" data-tod="dawn">DAWN</button>
                <button class="dock-sq-btn ${this.selectedTimeOfDay === 'day' ? 'active-sq' : ''}" data-tod="day">DAY</button>
                <button class="dock-sq-btn ${this.selectedTimeOfDay === 'dusk' ? 'active-sq' : ''}" data-tod="dusk">DUSK</button>
                <button class="dock-sq-btn ${this.selectedTimeOfDay === 'night' ? 'active-sq' : ''}" data-tod="night">NIGHT</button>
              </div>
            </div>
            <div class="dock-panel-col">
              <span class="dock-panel-label">SEASON & BIOME</span>
              <div class="dock-btn-row">
                <button class="dock-sq-btn ${this.selectedSeason === 'spring' ? 'active-sq' : ''}" data-s="spring">SPRING</button>
                <button class="dock-sq-btn ${this.selectedSeason === 'summer' ? 'active-sq' : ''}" data-s="summer">SUMMER</button>
                <button class="dock-sq-btn ${this.selectedSeason === 'autumn' ? 'active-sq' : ''}" data-s="autumn">AUTUMN</button>
                <button class="dock-sq-btn ${this.selectedSeason === 'winter' ? 'active-sq' : ''}" data-s="winter">WINTER</button>
              </div>
            </div>
          </div>
        `;
        el.querySelectorAll('[data-tod]').forEach(b => {
          b.onclick = () => {
            this.setTimeOfDay(b.dataset.tod);
            this.renderDockPanelContent('style');
            sound.playTone(720, 'sine', 0.1);
          };
        });
        el.querySelectorAll('[data-s]').forEach(b => {
          b.onclick = () => {
            this.selectedSeason = b.dataset.s;
            this.buildWorldAndScene();
            this.renderDockPanelContent('style');
            sound.playTone(700, 'sine', 0.1);
          };
        });
      } else if (type === 'vehicle') {
        el.innerHTML = `
          <div class="dock-panel-grid">
            <div class="dock-panel-col">
              <span class="dock-panel-label">COURIER FLEET</span>
              <div class="dock-btn-row">
                <button class="dock-sq-btn ${this.selectedVehicle === 'swift' ? 'active-sq' : ''}" data-v="swift">HATCH</button>
                <button class="dock-sq-btn ${this.selectedVehicle === 'chotahathi' ? 'active-sq' : ''}" data-v="chotahathi">TRUCK</button>
                <button class="dock-sq-btn ${this.selectedVehicle === 'scooter' ? 'active-sq' : ''}" data-v="scooter">SCOOTER</button>
                <button class="dock-sq-btn ${this.selectedVehicle === 'cycle' ? 'active-sq' : ''}" data-v="cycle">BIKE</button>
              </div>
            </div>
          </div>
        `;
        el.querySelectorAll('[data-v]').forEach(b => {
          b.onclick = () => {
            this.selectedVehicle = b.dataset.v;
            this.vehicle.setVehicleType(this.selectedVehicle);
            this.renderDockPanelContent('vehicle');
            sound.playTone(800, 'sine', 0.1);
          };
        });
      }
    }

    openSettingsModal(tab = 'gameplay') {
      this.modalContainer.innerHTML = `
        <div class="modal-backdrop">
          <div class="settings-modal">
            <div class="settings-header-tabs">
              <button class="tab-link ${tab === 'home' ? 'active-tab' : ''}" data-tab="home">HUB</button>
              <button class="tab-link ${tab === 'gameplay' ? 'active-tab' : ''}" data-tab="gameplay">• FLEET TUNING •</button>
              <button class="tab-link ${tab === 'controls' ? 'active-tab' : ''}" data-tab="controls">CONTROLS</button>
              <button class="tab-link ${tab === 'profile' ? 'active-tab' : ''}" data-tab="profile">EARNINGS</button>
            </div>

            <div class="settings-body">
              ${tab === 'gameplay' ? `
                <div class="settings-section-title"><span>PERFORMANCE CALIBRATION</span></div>
                <div class="settings-row">
                  <span class="settings-label">Max Speed (m/s)</span>
                  <div class="settings-control">
                    <input type="range" class="settings-slider" id="set-speed" min="15" max="55" step="1" value="${this.vehicle.maxSpeed}">
                    <span class="slider-val" id="val-speed">${this.vehicle.maxSpeed.toFixed(0)}</span>
                  </div>
                </div>
                <div class="settings-row">
                  <span class="settings-label">Acceleration</span>
                  <div class="settings-control">
                    <input type="range" class="settings-slider" id="set-accel" min="5" max="30" step="1" value="${this.vehicle.accel}">
                    <span class="slider-val" id="val-accel">${this.vehicle.accel.toFixed(0)}</span>
                  </div>
                </div>
                <div class="settings-row">
                  <span class="settings-label">One-Pedal Regen Drag</span>
                  <div class="settings-control">
                    <input type="range" class="settings-slider" id="set-drag" min="0.3" max="1.5" step="0.05" value="${this.vehicle.drag}">
                    <span class="slider-val" id="val-drag">${this.vehicle.drag.toFixed(2)}</span>
                  </div>
                </div>
              ` : tab === 'controls' ? `
                <div class="settings-section-title"><span>COURIER CONTROLS</span></div>
                <div class="settings-row"><span class="settings-label">Drive / Regen Brake</span><span class="slider-val">W / S or Up / Down</span></div>
                <div class="settings-row"><span class="settings-label">Steer</span><span class="slider-val">A / D or Left / Right</span></div>
                <div class="settings-row"><span class="settings-label">3D Parcel Toss / Drop</span><span class="slider-val">[SPACE] or Click</span></div>
                <div class="settings-row"><span class="settings-label">Autopilot Navigation</span><span class="slider-val">[F]</span></div>
                <div class="settings-row"><span class="settings-label">Vehicle Recovery</span><span class="slider-val">[R]</span></div>
                <div class="settings-row"><span class="settings-label">Toggle Camera View</span><span class="slider-val">[C]</span></div>
              ` : `
                <div class="settings-section-title"><span>SHIPLYP COURIER SUMMARY</span></div>
                <div class="settings-row"><span class="settings-label">Total Delivery Earnings</span><span class="slider-val" style="color: #2ec4b6; font-weight: 700;">₹ ${this.earnings}</span></div>
                <div class="settings-row"><span class="settings-label">Delivered Porches</span><span class="slider-val">${this.deliveriesMade}</span></div>
                <div class="settings-row"><span class="settings-label">Distance Driven</span><span class="slider-val">${this.vehicle.distanceTraveled.toFixed(1)} KM</span></div>
              `}
            </div>

            <div class="settings-footer">
              <span style="font-size: 0.75rem; color: #6c757d; font-family: monospace;">SHIPLYP LAST MILE CHRONICLES V1.0</span>
              <button id="btn-close-settings" class="btn-settings-close">CLOSE</button>
            </div>
          </div>
        </div>
      `;

      this.modalContainer.querySelectorAll('.tab-link').forEach(btn => {
        btn.onclick = () => {
          if (btn.dataset.tab === 'home') {
            this.modalContainer.innerHTML = '';
            this.renderDispatchHub();
          } else {
            this.openSettingsModal(btn.dataset.tab);
          }
        };
      });

      const spdEl = document.getElementById('set-speed');
      if (spdEl) {
        spdEl.oninput = () => {
          this.vehicle.maxSpeed = parseFloat(spdEl.value);
          document.getElementById('val-speed').textContent = spdEl.value;
        };
      }
      const accEl = document.getElementById('set-accel');
      if (accEl) {
        accEl.oninput = () => {
          this.vehicle.accel = parseFloat(accEl.value);
          document.getElementById('val-accel').textContent = accEl.value;
        };
      }
      const dragEl = document.getElementById('set-drag');
      if (dragEl) {
        dragEl.oninput = () => {
          this.vehicle.drag = parseFloat(dragEl.value);
          document.getElementById('val-drag').textContent = dragEl.value;
        };
      }

      document.getElementById('btn-close-settings').onclick = () => {
        this.modalContainer.innerHTML = '';
        // This modal is reused both for the pre-drive dispatch hub's
        // "Fleet Tuning" link and the in-drive dock's settings icon. In
        // the hub case, opening it replaced the hub's own HTML in the
        // same container — closing with just an innerHTML clear left an
        // empty overlay over the un-started scene (no vehicle/HUD, since
        // buildWorldAndScene()/startDrive() were never called). Restore
        // the hub explicitly when we haven't started a drive yet.
        if (this.gameState === 'menu') {
          this.renderDispatchHub();
        }
      };
    }

    updateCamera(dt) {
      if (!this.vehicle || !this.vehicle.mesh) return;

      const carPos = this.vehicle.mesh.position;
      const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicle.mesh.quaternion).normalize();

      if (!this.camLookTarget) {
        this.camLookTarget = carPos.clone().addScaledVector(carForward, 18.0);
      }

      if (this.activeCameraMode === 'hood') {
        // Hood Bumper Cam - rigidly bolted to vehicle hood
        const hoodPos = carPos.clone().addScaledVector(carForward, 1.35).add(new THREE.Vector3(0, 0.82, 0));
        this.camera.position.copy(hoodPos);
        const lookTarget = hoodPos.clone().addScaledVector(carForward, 35.0);
        this.camera.lookAt(lookTarget);
      } else if (this.activeCameraMode === 'sky') {
        // Drone Cam
        const skyPos = carPos.clone().addScaledVector(carForward, -9.5).add(new THREE.Vector3(0, 7.5, 0));
        this.camera.position.lerp(skyPos, Math.min(1.0, 1.0 - Math.exp(-14.0 * dt)));
        const rawLookTarget = carPos.clone().addScaledVector(carForward, 18.0).add(new THREE.Vector3(0, 0.5, 0));
        this.camLookTarget.lerp(rawLookTarget, Math.min(1.0, 1.0 - Math.exp(-18.0 * dt)));
        this.camera.lookAt(this.camLookTarget);
      } else {
        // Slow Roads Glued Chase Cam
        // 6.8m behind car, 2.7m above car (tight, cinematic, dynamic)
        const targetCamPos = carPos.clone()
          .addScaledVector(carForward, -6.8)
          .add(new THREE.Vector3(0, 2.7, 0));

        // High responsiveness spring-lerp (keeps camera tightly bound to vehicle at any speed)
        const posLerp = Math.min(1.0, 1.0 - Math.exp(-16.0 * dt));
        this.camera.position.lerp(targetCamPos, posLerp);

        // Ground clearance check relative strictly to roadbed (never launch into the sky)
        const minY = carPos.y + 1.6;
        const maxY = carPos.y + 4.2;
        this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y, minY, maxY);

        // Look-ahead target down the road centerline
        const rawLookTarget = carPos.clone()
          .addScaledVector(carForward, 18.0)
          .add(new THREE.Vector3(0, 0.8, 0));
        const lookLerp = Math.min(1.0, 1.0 - Math.exp(-22.0 * dt));
        this.camLookTarget.lerp(rawLookTarget, lookLerp);
        this.camera.lookAt(this.camLookTarget);

        // Dynamic Speed FOV
        const speedRatio = Math.min(1.0, Math.abs(this.vehicle.speed) / (this.vehicle.maxSpeed || 40));
        const targetFOV = 60 + speedRatio * 8.0;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.1);
        this.camera.updateProjectionMatrix();
      }

      // Ground-clip safety: the chase/sky cameras are positioned purely
      // relative to the car (offset + lerp), with no awareness of the
      // terrain underneath. On a hill or embankment the camera's own (x,z)
      // can end up inside solid ground — the double-sided terrain material
      // then renders its interior faces all around the view, which reads
      // as the car being "buried" even though the car itself is fine.
      // Clamp against raw terrain height (always >= the actual carved
      // road/embankment surface) as a cheap conservative floor.
      if (this.world && this.world.getRawTerrainHeight && this.activeCameraMode !== 'hood') {
        const camGroundY = this.world.getRawTerrainHeight(this.camera.position.x, this.camera.position.z);
        const minClearance = camGroundY + 1.4;
        if (this.camera.position.y < minClearance) {
          this.camera.position.y = minClearance;
        }
      }

      // Center Atmospheric Sky Dome on Camera
      if (this.world && this.world.skyMesh) {
        this.world.skyMesh.position.copy(this.camera.position);
      }
    }

    updateGPSNavigation() {
      if (!this.world || !this.vehicle) return;
      const carPos = this.vehicle.mesh.position;
      const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicle.mesh.quaternion).normalize();

      // Find next undelivered target
      let nextTarget = null;
      let minDistance = 999999;
      this.world.deliveryTargets.forEach(t => {
        if (!t.delivered) {
          const d = carPos.distanceTo(t.pos);
          if (d < minDistance) {
            minDistance = d;
            nextTarget = t;
          }
        }
      });

      // Update Waypoint HUD Arrow
      const wpTargetEl = document.getElementById('waypoint-target-text');
      const wpDistEl = document.getElementById('waypoint-distance-text');
      const gpsDistEl = document.getElementById('gps-next-dist');

      if (nextTarget) {
        const toTarget = nextTarget.pos.clone().sub(carPos);
        const sideDot = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.vehicle.mesh.quaternion).dot(toTarget);
        const sideText = sideDot > 0 ? 'RIGHT' : 'LEFT';
        const distMeters = Math.round(minDistance);

        if (wpTargetEl) wpTargetEl.textContent = nextTarget.order.name;
        if (wpDistEl) wpDistEl.textContent = `${distMeters}m AHEAD [${sideText}]`;
        if (gpsDistEl) gpsDistEl.textContent = `${distMeters}m`;
      } else {
        if (wpTargetEl) wpTargetEl.textContent = 'ALL ORDERS DELIVERED!';
        if (wpDistEl) wpDistEl.textContent = 'PROCEED TO DISPATCH HUB';
        if (gpsDistEl) gpsDistEl.textContent = '0m';
      }

      // Render 2D GPS Minimap Radar
      const canvas = document.getElementById('gps-radar-canvas') || document.getElementById('gps-minimap-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Radar background compass grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 28, 0, Math.PI * 2);
      ctx.arc(w / 2, h / 2, 54, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.moveTo(w / 2, 6); ctx.lineTo(w / 2, h - 6);
      ctx.moveTo(6, h / 2); ctx.lineTo(w - 6, h / 2);
      ctx.stroke();

      const carRight = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.vehicle.mesh.quaternion).normalize();

      // Draw Spline Road Ahead on Radar
      if (this.world.curve) {
        ctx.strokeStyle = '#2b3d4f';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        const curU = this.vehicle.splineProgress;
        for (let i = -10; i <= 40; i++) {
          const sampleU = (curU + i * 0.0025 + 1.0) % 1.0;
          const pt = this.world.curve.getPointAt(sampleU);
          const rel = pt.clone().sub(carPos);

          const latDist = rel.dot(carRight);
          const fwdDist = rel.dot(carForward);

          const mx = w / 2 + latDist * 0.85;
          const my = h / 2 - fwdDist * 0.85;

          if (i === -10) ctx.moveTo(mx, my);
          else ctx.lineTo(mx, my);
        }
        ctx.stroke();

        // Inner road surface stripe
        ctx.strokeStyle = '#00d4bf';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw Traffic Dots on Minimap
      this.world.trafficVehicles.forEach(tv => {
        const rel = tv.mesh.position.clone().sub(carPos);
        const latDist = rel.dot(carRight);
        const fwdDist = rel.dot(carForward);

        const mx = w / 2 + latDist * 0.85;
        const my = h / 2 - fwdDist * 0.85;

        if (mx >= 6 && mx <= w - 6 && my >= 6 && my <= h - 6) {
          ctx.fillStyle = '#ff9f1c';
          ctx.beginPath();
          ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw Next Delivery Target Pin on Minimap
      if (nextTarget) {
        const rel = nextTarget.pos.clone().sub(carPos);
        const latDist = rel.dot(carRight);
        const fwdDist = rel.dot(carForward);

        const mx = Math.max(10, Math.min(w - 10, w / 2 + latDist * 0.85));
        const my = Math.max(10, Math.min(h - 10, h / 2 - fwdDist * 0.85));

        ctx.fillStyle = '#2ec4b6';
        ctx.shadowColor = '#2ec4b6';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(mx, my, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw Player Car Marker (Center Glowing Triangle pointing Up)
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00d4bf';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2 - 7);
      ctx.lineTo(w / 2 - 4.5, h / 2 + 5);
      ctx.lineTo(w / 2 + 4.5, h / 2 + 5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    animate() {
      const dt = Math.min(this.clock.getDelta(), 0.1);

      if (this.gameState === 'playing') {
        this.vehicle.update(dt, this.keys, this.world, this.selectedSeason, this.selectedRoadTerrain);
        this.world.updateTraffic(dt);
        if (this.world.updateClouds) this.world.updateClouds(dt);
        this.updateParcels(dt);
        this.updateParticles(dt);

        // Drift & Braking Particle FX
        if (this.vehicle && this.vehicle.mesh && Math.abs(this.vehicle.speed) > 4.0) {
          if (this.keys.s || this.keys.down || Math.abs(this.vehicle.driftAngle || 0) > 0.12) {
            this.spawnDust(this.vehicle.mesh.position, 1);
          }
        }
        this.updateOrderTimer(dt);
        this.updateCamera(dt);
        this.updateGPSNavigation();
        this.updateClimateHUD();
        this.updateHealthHUD();

        // Automatic Breakdown & Stuck Recovery Detection
        if (this.vehicle.health <= 0) {
          this.showStuckRecoveryModal('VEHICLE BREAKDOWN: Suspension & Engine Failure');
        } else if ((this.keys.w || this.keys.up || this.keys.s || this.keys.down) && Math.abs(this.vehicle.speed) < 0.45 && Math.abs(this.vehicle.lateralOffset) > (CONFIG.ROAD_WIDTH * 0.45)) {
          this.stuckTimer += dt;
          if (this.stuckTimer > 2.4) {
            this.showStuckRecoveryModal('VEHICLE IMMOBILIZED: Roadside Boundary');
          }
        } else {
          this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2.0);
        }

        // Off-Road Lost Detection — show Return to Road banner
        if (this.world && this.world.curve && this.vehicle) {
          const vp = this.vehicle.mesh.position;
          const nearU = this.vehicle.splineProgress;
          const nearPt = this.world.curve.getPointAt(Math.max(0, Math.min(1, nearU)));
          const distFromRoad = vp.distanceTo(nearPt);
          if (distFromRoad > 22) {
            if (!this.lostFromRoad) {
              this.lostFromRoad = true;
              this.showReturnToRoadBanner();
            }
          } else {
            if (this.lostFromRoad) {
              this.lostFromRoad = false;
              this.hideReturnToRoadBanner();
            }
          }
        }

        const speedKmh = Math.round(Math.abs(this.vehicle.speed) * 3.6);
        const speedEl = document.getElementById('telemetry-speed');
        if (speedEl) speedEl.textContent = String(speedKmh).padStart(2, '0');

        const arcFill = document.getElementById('speed-arc-fill');
        if (arcFill) {
          const maxSpeed = 120;
          const pct = Math.min(1, Math.max(0, speedKmh / maxSpeed));
          // Forza radial dial sweep from 260 to 65
          arcFill.style.strokeDashoffset = (260 - 195 * pct).toFixed(1);
          if (speedKmh > 75) {
            arcFill.style.stroke = '#ffb833';
            arcFill.style.filter = 'drop-shadow(0 0 8px rgba(255, 184, 51, 0.9))';
          } else {
            arcFill.style.stroke = '#00d4bf';
            arcFill.style.filter = 'drop-shadow(0 0 6px rgba(0, 212, 191, 0.8))';
          }
        }

        const distEl = document.getElementById('telemetry-distance');
        if (distEl) distEl.textContent = `${this.vehicle.distanceTraveled.toFixed(1)} KM`;
      } else {
        const t = Date.now() * 0.0003;
        this.camera.position.set(Math.sin(t) * 14, 6, Math.cos(t) * 14);
        this.camera.lookAt(0, 2, 0);
      }

      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this.animate.bind(this));
    }
  }

  function boot() {
    try {
      if (typeof THREE === 'undefined') {
        const app = document.getElementById('game-app');
        if (app && !document.getElementById('engine-loading-toast')) {
          const loadingToast = document.createElement('div');
          loadingToast.id = 'engine-loading-toast';
          loadingToast.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; background: rgba(10, 14, 20, 0.92); padding: 32px 48px; border-radius: 20px; text-align: center; font-family: Outfit, sans-serif; border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 20px 60px rgba(0,0,0,0.8); z-index: 999999;';
          loadingToast.innerHTML = '<h2 style="font-size: 1.2rem; margin: 0 0 8px 0; color: #00d4bf; font-family: monospace; letter-spacing: 2px;">SHIPLYP // ENGINE</h2><p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 0.82rem; font-family: monospace; letter-spacing: 1px;">INITIALIZING 3D HIGHWAY ENVIRONMENT...</p>';
          app.appendChild(loadingToast);
        }
        setTimeout(boot, 300);
        return;
      }
      const existingToast = document.getElementById('engine-loading-toast');
      if (existingToast) existingToast.remove();

      window.game = new ShiplypEngine();
    } catch (err) {
      console.error('Shiplyp Engine Init Error:', err);
      const app = document.getElementById('game-app') || document.body;
      const errCard = document.createElement('div');
      errCard.style.cssText = 'position: absolute; top: 24px; left: 24px; right: 24px; background: rgba(239, 35, 60, 0.96); color: #fff; padding: 22px 28px; border-radius: 16px; font-family: monospace; font-size: 14px; z-index: 9999999; box-shadow: 0 20px 50px rgba(0,0,0,0.8);';
      errCard.innerHTML = `<h3 style="margin: 0 0 10px 0;">🚨 Shiplyp Engine Initialization Error</h3><p style="margin: 0 0 8px 0;"><strong>Error:</strong> ${err.message}</p><pre style="white-space: pre-wrap; font-size: 12px; opacity: 0.85; margin: 0;">${err.stack}</pre>`;
      app.appendChild(errCard);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
