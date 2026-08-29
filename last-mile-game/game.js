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
        const cabMat = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, flatShading: true }); // white cab/door
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, flatShading: true }); // teal-green cargo body
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
  // 0b. LOCALIZED PLAYER CAR: SWIFT/NEXON-STYLE SPORTS HATCH (CC0, Kenney Car Kit)
  // Replaces the old stacked-boxes hatchback with an actual sculpted car mesh,
  // recolored to the same fiery-red/gloss-black livery so the branding holds.
  // --------------------------------------------------------------------------
  const SwiftCarAsset = {
    template: null,
    loading: false,
    pendingControllers: [],
    load() {
      if (this.template || this.loading || typeof THREE.GLTFLoader === 'undefined') return;
      this.loading = true;
      new THREE.GLTFLoader().load('assets/models/sedan-sports.glb', (gltf) => {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd90429, flatShading: true }); // Fiery Red
        const trimMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a }); // Gloss black spoiler/trim
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1e293b }); // Diamond-cut alloy
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          if (child.name === 'body') child.material = bodyMat;
          else if (child.name === 'spoiler') child.material = trimMat;
          else if (child.name.startsWith('wheel')) child.material = wheelMat;
        });
        this.template = gltf.scene;
        // Rebuild any player vehicle that was already stuck on the boxy fallback
        this.pendingControllers.forEach((vc) => vc.buildModel());
        this.pendingControllers.length = 0;
      }, undefined, (err) => {
        console.warn('SwiftCarAsset: failed to load sedan-sports.glb, falling back to procedural model', err);
      });
    },
    clone() {
      return this.template ? this.template.clone(true) : null;
    }
  };
  SwiftCarAsset.load();

  // --------------------------------------------------------------------------
  // 0c. LOCALIZED PLAYER TRUCK: TATA ACE "CHHOTA HATHI" MINI PICKUP (CC0, Kenney Car Kit)
  // Replaces the old boxy cab+bed stack with a sculpted open-bed pickup mesh,
  // recolored to the same Indian Cargo Green livery.
  // --------------------------------------------------------------------------
  const ChotaHathiAsset = {
    template: null,
    loading: false,
    pendingControllers: [],
    load() {
      if (this.template || this.loading || typeof THREE.GLTFLoader === 'undefined') return;
      this.loading = true;
      new THREE.GLTFLoader().load('assets/models/truck.glb', (gltf) => {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x059669, flatShading: true }); // Indian Cargo Green
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          if (child.name === 'body') child.material = bodyMat;
          else if (child.name.startsWith('wheel')) child.material = wheelMat;
        });
        this.template = gltf.scene;
        this.pendingControllers.forEach((vc) => vc.buildModel());
        this.pendingControllers.length = 0;
      }, undefined, (err) => {
        console.warn('ChotaHathiAsset: failed to load truck.glb, falling back to procedural model', err);
      });
    },
    clone() {
      return this.template ? this.template.clone(true) : null;
    }
  };
  ChotaHathiAsset.load();

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
  // 3. SOUND SYNTHESIZER & MULTI-CHANNEL RADIO (Hindi / English / Mix)
  // --------------------------------------------------------------------------

  // Note-to-Frequency helper for polyphonic synthesizer scores
  const NOTE_SEMITONES = { c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5, 'f#': 6, gb: 6, g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11 };
  function noteToFreq(noteStr) {
    if (!noteStr) return 440;
    const m = noteStr.trim().toLowerCase().match(/^([a-g][#b]?)([0-9])$/);
    if (!m) return 440;
    const semitone = NOTE_SEMITONES[m[1]] ?? 0;
    const octave = parseInt(m[2], 10);
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ── Playlist database:
  // - Hindi: Purely authentic MP3 tracks streaming from truckplaylist.com CDN (no synth).
  // - English: Soothing polyphonic arrangements of legendary road-trip hits played via mellow Rhodes/lofi synthesis.
  const RADIO_PLAYLISTS = {
    hindi: [
      // ── Hindi 90s Highway Classics (49 Real MP3 Tracks) ──
      { title: "Dil Ne Yeh Kaha Hain Dil Se", artist: "Udit Narayan (Dhadkan)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ff097069568.58544488.mp3" },
      { title: "Mujhse Mohabbat Ka", artist: "Kumar Sanu & Alka Yagnik", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ffb3da74333.19775211.mp3" },
      { title: "Kyon Ki Itna Pyar", artist: "Udit Narayan", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ffc0e3bbfd6.98289794.mp3" },
      { title: "Tumse Milne Ko Dil", artist: "Alka Yagnik & Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ffc6db9a737.50163040.mp3" },
      { title: "Jeeta Tha Jiske Liye", artist: "Kumar Sanu & Alka Yagnik", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ffcb3d57294.79925154.mp3" },
      { title: "Tum Dil Ki Dhadkan Mein", artist: "Abhijeet & Alka Yagnik", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ffd4132d929.77448836.mp3" },
      { title: "Agar Tum Na Hote", artist: "R.D. Burman", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ffd8ed8b019.32999548.mp3" },
      { title: "Tumse Milne Ki Tamanna Hai", artist: "S.P. Balasubramaniam", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ffdd61ef2c8.22241527.mp3" },
      { title: "Tere Naam", artist: "Udit Narayan", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ffe3f78a480.65866672.mp3" },
      { title: "Mere Rang Mein Rangne Wali", artist: "S.P. Balasubrahmanyam", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ffeaae2e9a6.57430078.mp3" },
      { title: "Aaye Ho Meri Zindagi Mein", artist: "Udit Narayan", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a7ffce78ac142.67941754.mp3" },
      { title: "Kehna Hi Kya", artist: "KS Chitra (Bombay)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a800c8a6286b2.57114505.mp3" },
      { title: "Do Dil Mil Rahe Hai", artist: "Kumar Sanu (Pardes)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a800d83bd5421.02473824.mp3" },
      { title: "Ishq Bina Ishq Bina", artist: "Kavita Krishnamurthy (Taal)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a800db74d1030.74275897.mp3" },
      { title: "Ek Sanam Chahiye Aashiqui Ke Liye", artist: "Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a800de59efed6.63979837.mp3" },
      { title: "Teri Umeed Tera Intezar", artist: "Kumar Sanu (Deewana)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a800e8e8ef4b4.29261544.mp3" },
      { title: "Yeh Dil Deewana", artist: "Sonu Nigam (Pardes)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a800ebd533b09.94127012.mp3" },
      { title: "Jo Bhi Kasmein", artist: "Alka Yagnik & Udit (Raaz)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a800efe5bd5a2.33668743.mp3" },
      { title: "Pardesi Pardesi", artist: "Udit Narayan & Alka Yagnik", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a800f6342cb21.48143101.mp3" },
      { title: "Tum To Thehre Pardesi", artist: "Altaf Raja (Highway Classic)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a8010245994b9.23145761.mp3" },
      { title: "Tumse Milna", artist: "Udit Narayan & Alka Yagnik", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a80106e7e38e2.92732922.mp3" },
      { title: "Jaane Kyon Log Pyar", artist: "Udit Narayan & Alka Yagnik", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a80109d970479.41448487.mp3" },
      { title: "Oodhni", artist: "Udit Narayan & Alka Yagnik", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a8010db7e7e47.85862263.mp3" },
      { title: "Jhanjharia", artist: "Abhijeet Bhattacharya", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a8011079565f7.04442597.mp3" },
      { title: "Chand Se Parda", artist: "Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a80115a0fcba2.05328552.mp3" },
      { title: "Meri Mehbooba", artist: "Kumar Sanu & Alka Yagnik", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a8011c06961e1.75783480.mp3" },
      { title: "Tere Dar Par Sanam", artist: "Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a8011f7aea2d8.41865380.mp3" },
      { title: "Nahin Yeh Ho Nahin Sakta", artist: "Kumar Sanu & Sadhana Sargam", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a801238cb90c3.67609094.mp3" },
      { title: "Barsaat Ke Mausam Mein", artist: "Kumar Sanu (Naajayaz)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a80126e6822e6.26394093.mp3" },
      { title: "Aye Mere Humsafar", artist: "Alka Yagnik & Udit Narayan", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a8013a9b8b290.24804986.mp3" },
      { title: "Ae Kash Ke Hum", artist: "Kumar Sanu (Kabhi Haan Kabhi Naa)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a8013d8c5c5d0.70297864.mp3" },
      { title: "Tu Hi Re", artist: "Hariharan & Kavita K (Bombay)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a80142213e965.53608046.mp3" },
      { title: "Dil Ke Badle Sanam", artist: "Udit Narayan & Alka Yagnik", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a80147d0253e8.52542358.mp3" },
      { title: "Sochenge Tumhe Pyar", artist: "Kumar Sanu (Deewana)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a8014b076f9f2.46008491.mp3" },
      { title: "Aksar Is Duniya Mein", artist: "Alka Yagnik (Dhadkan)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a8014ef1173d5.53100631.mp3" },
      { title: "Kitaben Bahut Si", artist: "Asha Bhosle & Vinod Rathod", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a801573da6357.19964470.mp3" },
      { title: "Raah Mein Unse Mulaqat", artist: "Kumar Sanu & Alka Yagnik", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803ad6d910f9.28244193.mp3" },
      { title: "Kitna Haseen Chehra", artist: "Kumar Sanu (Dilwale)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803c0be30ac4.66182873.mp3" },
      { title: "Pehli Pehli Baar Mohabbat Ki Hai", artist: "Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803c6bd90d33.43762303.mp3" },
      { title: "Ye Aaina Jo Tumhen", artist: "Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803cad0048f1.39334256.mp3" },
      { title: "Tumhein Apna Banane Ki", artist: "Kumar Sanu (Sadak)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803cd16869b5.40047956.mp3" },
      { title: "Too Cheez Badi Hain Mast", artist: "Kumar Sanu & Kavita K (Mohra)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803d87457702.02725399.mp3" },
      { title: "Oh Mere Dil Ke Chain", artist: "Abhijeet", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803d965a5646.17723448.mp3" },
      { title: "Mera Dil Bhi Kitna Pagal Hai", artist: "Kumar Sanu & Alka (Saajan)", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803e0654d485.12616218.mp3" },
      { title: "Tumhein Dekhen Meri Aankhen", artist: "Alka Yagnik & Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803e3ff22f65.39915562.mp3" },
      { title: "Mera Chand Mujhe Aaya Hai Nazar", artist: "Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803e83edb239.43074334.mp3" },
      { title: "Shikwa Nahin Kisi Se", artist: "Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803ea3f3faf3.13207435.mp3" },
      { title: "Shaam Bhi Khoob Hai", artist: "Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803ebdc1e398.57981345.mp3" },
      { title: "Hum Teri Mohabbat Mein", artist: "Kumar Sanu", era: "90s", language: "hindi", url: "https://truckplaylist.com/uploads/f_6a803edcaa0378.24037957.mp3" }
    ],
    english: [
      // ── Soothing Polyphonic Road Trip Hits (Warm Rhodes / Chill Acoustic Synth) ──
      {
        title: "Hotel California",
        artist: "Eagles (Lofi Acoustic Chill)",
        era: "90s",
        language: "english",
        isSynth: true,
        bpm: 78,
        patterns: [
          { bass: "B2", chord: ["D4", "F#4", "B4"], melody: ["F#5", "D5", "B4", "F#4"] },
          { bass: "F#2", chord: ["C#4", "E4", "A#4"], melody: ["C#5", "A#4", "F#4", "C#4"] },
          { bass: "A2", chord: ["C#4", "E4", "A4"], melody: ["E5", "C#5", "A4", "E4"] },
          { bass: "E2", chord: ["B3", "E4", "G#4"], melody: ["B4", "G#4", "E4", "B3"] },
          { bass: "G2", chord: ["B3", "D4", "G4"], melody: ["D5", "B4", "G4", "D4"] },
          { bass: "D3", chord: ["A3", "D4", "F#4"], melody: ["A4", "F#4", "D4", "A3"] },
          { bass: "E2", chord: ["G3", "B3", "E4"], melody: ["B4", "G4", "E4", "B3"] },
          { bass: "F#2", chord: ["A#3", "C#4", "F#4"], melody: ["C#5", "A#4", "F#4", "A#3"] }
        ]
      },
      {
        title: "Clocks",
        artist: "Coldplay (Warm Rhodes)",
        era: "2000s",
        language: "english",
        isSynth: true,
        bpm: 96,
        patterns: [
          { bass: "Eb3", chord: ["G4", "Bb4"], melody: ["Eb5", "Bb4", "G4", "Eb5", "Bb4", "G4"] },
          { bass: "Bb2", chord: ["F4", "Db5"], melody: ["Db5", "Bb4", "F4", "Db5", "Bb4", "F4"] },
          { bass: "F2", chord: ["C4", "Ab4"], melody: ["C5", "Ab4", "F4", "C5", "Ab4", "F4"] },
          { bass: "F2", chord: ["C4", "Ab4"], melody: ["C5", "Ab4", "F4", "C5", "Ab4", "F4"] }
        ]
      },
      {
        title: "Careless Whisper",
        artist: "George Michael (Smooth Mellow)",
        era: "90s",
        language: "english",
        isSynth: true,
        bpm: 76,
        patterns: [
          { bass: "D3", chord: ["F4", "A4"], melody: ["D5", "A4", "F4", "D4", "F4", "A4", "D5"] },
          { bass: "G2", chord: ["Bb3", "D4"], melody: ["Bb4", "G4", "D4", "Bb3", "D4", "G4", "Bb4"] },
          { bass: "Bb2", chord: ["D4", "F4"], melody: ["F5", "D5", "Bb4", "F4", "Bb4", "D5", "F5"] },
          { bass: "A2", chord: ["C4", "E4"], melody: ["E5", "C5", "A4", "E4", "A4", "C5", "E5"] }
        ]
      },
      {
        title: "Boulevard of Broken Dreams",
        artist: "Green Day (Ambient Drive)",
        era: "2000s",
        language: "english",
        isSynth: true,
        bpm: 82,
        patterns: [
          { bass: "E2", chord: ["G3", "B3", "E4"], melody: ["E4", "G4", "B4", "E5"] },
          { bass: "G2", chord: ["B3", "D4", "G4"], melody: ["D4", "G4", "B4", "D5"] },
          { bass: "D3", chord: ["A3", "D4", "F#4"], melody: ["A3", "D4", "F#4", "A4"] },
          { bass: "A2", chord: ["C#4", "E4", "A4"], melody: ["E4", "A4", "C#5", "E5"] }
        ]
      },
      {
        title: "Counting Stars",
        artist: "OneRepublic (Chill Synth)",
        era: "2010s",
        language: "english",
        isSynth: true,
        bpm: 90,
        patterns: [
          { bass: "A2", chord: ["C4", "E4", "A4"], melody: ["A4", "C5", "E5", "C5"] },
          { bass: "C3", chord: ["E4", "G4", "C5"], melody: ["G4", "C5", "E5", "C5"] },
          { bass: "G2", chord: ["B3", "D4", "G4"], melody: ["D4", "G4", "B4", "G4"] },
          { bass: "F2", chord: ["A3", "C4", "F4"], melody: ["C4", "F4", "A4", "F4"] }
        ]
      },
      {
        title: "Take On Me",
        artist: "A-ha (Lofi Piano Version)",
        era: "90s",
        language: "english",
        isSynth: true,
        bpm: 84,
        patterns: [
          { bass: "B2", chord: ["D4", "F#4", "B4"], melody: ["F#4", "F#4", "D4", "B3", "B3", "E4", "E4", "E4", "G#4", "G#4", "A4", "B4"] },
          { bass: "E2", chord: ["G#3", "B3", "E4"], melody: ["A4", "A4", "A4", "E4", "D4", "F#4", "F#4", "F#4", "E4", "E4", "F#4", "E4"] },
          { bass: "A2", chord: ["C#4", "E4", "A4"], melody: ["F#4", "F#4", "D4", "B3", "B3", "E4", "E4", "E4", "G#4", "G#4", "A4", "B4"] },
          { bass: "D3", chord: ["F#3", "A3", "D4"], melody: ["A4", "A4", "A4", "E4", "D4", "F#4", "F#4", "F#4", "E4", "E4", "F#4", "E4"] }
        ]
      },
      {
        // Rounds out the 2000s slot (previously Clocks + Boulevard of
        // Broken Dreams only) for a more even 90s/2000s/2010s spread.
        title: "Chasing Cars",
        artist: "Snow Patrol (Warm Rhodes)",
        era: "2000s",
        language: "english",
        isSynth: true,
        bpm: 104,
        patterns: [
          { bass: "A2", chord: ["C4", "E4"], melody: ["E5", "C5", "A4", "E4"] },
          { bass: "E2", chord: ["G#3", "B3"], melody: ["B4", "G#4", "E4", "B3"] },
          { bass: "F#2", chord: ["A3", "C#4"], melody: ["C#5", "A4", "F#4", "C#4"] },
          { bass: "D3", chord: ["F#3", "A3"], melody: ["A4", "F#4", "D4", "A3"] }
        ]
      },
      {
        // Rounds out the 2010s slot (previously Counting Stars only).
        title: "Riptide",
        artist: "Vance Joy (Lofi Ukulele Chill)",
        era: "2010s",
        language: "english",
        isSynth: true,
        bpm: 100,
        patterns: [
          { bass: "A2", chord: ["C4", "E4", "A4"], melody: ["C5", "E5", "A4", "E4"] },
          { bass: "F2", chord: ["A3", "C4", "F4"], melody: ["A4", "C5", "F4", "C4"] },
          { bass: "C3", chord: ["E4", "G4", "C5"], melody: ["E5", "G4", "C4", "G4"] },
          { bass: "G2", chord: ["B3", "D4", "G4"], melody: ["B4", "D5", "G4", "D4"] }
        ]
      }
    ]
  };

  // Channel display names
  const CHANNEL_NAMES = { hindi: 'DHABA FM', english: 'HIGHWAY FM', mix: 'ALL FM' };
  const CHANNEL_ORDER = ['hindi', 'english', 'mix'];

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.masterFilter = null;
      // Radio (the Hindi/English playlist, via audioEl or the synth radio
      // interval) and SFX (in-game event tones — potholes, e-challans,
      // delivery chimes) used to share one `muted` flag with no way to
      // silence one without the other. Split so each is independently
      // mutable, and persisted the same way the channel preference already
      // is so a mute choice survives a reload.
      this.radioMuted = localStorage.getItem('shiplyp_radio_muted') === '1';
      this.sfxMuted = localStorage.getItem('shiplyp_sfx_muted') === '1';
      // `muted` kept as a read-only OR of both, for any external code that
      // still reads it (display strings etc.) — never write to it directly.
      // Whenever gameState isn't 'playing' (menu, dispatch hub, restart),
      // ALL audio — radio and SFX alike — is fully suspended regardless of
      // the two mute flags above, not just paused-but-still-schedulable.
      // Initialized to TRUE so all audio is completely suspended until the
      // player actually starts driving.
      this.suspended = true;
      this.radioPlaying = false;
      this.currentTrackIndex = 0;

      // Synth player state
      this.synthRadioTimer = null;
      this.synthLoopCount = 0;
      this.currentPatternIndex = 0;
      this.currentNoteIndex = 0;

      // Restore saved channel preference or default to hindi
      this.radioChannel = localStorage.getItem('shiplyp_radio_channel') || 'hindi';
      if (!CHANNEL_ORDER.includes(this.radioChannel)) this.radioChannel = 'hindi';
      this._rebuildActivePlaylist();

      // HTML5 Audio Streamer for real MP3s
      this.audioEl = new Audio();
      this.audioEl.preload = 'auto';
      this.audioEl.volume = 0.70;
      this.audioEl.muted = this.radioMuted;

      // Radio only auto-resumes if the player has explicitly turned it on before
      this.userWantsRadio = localStorage.getItem('shiplyp_radio_pref') === 'on';

      this.audioEl.addEventListener('ended', () => {
        const trk = this.activePlaylist[this.currentTrackIndex];
        if (!trk || trk.isSynth) return;
        const title = this.nextTrack();
        const el = document.getElementById('radio-track-title');
        if (el) el.textContent = title;
      });

      this.audioEl.addEventListener('error', (e) => {
        const trk = this.activePlaylist[this.currentTrackIndex];
        // CRITICAL FIX: Only auto-skip if the current track is ACTUALLY an external MP3 stream
        // (do not skip when audioEl is paused or empty due to switching to a synth track)
        if (this.radioPlaying && trk && trk.url && this.audioEl.src && this.audioEl.src.startsWith('http')) {
          console.warn('Radio stream error for track:', trk.title, 'skipping to next...');
          const nextTitle = this.nextTrack();
          const el = document.getElementById('radio-track-title');
          if (el) el.textContent = nextTitle;
        }
      });

      const init = () => {
        this.ensure();
      };
      window.addEventListener('click', init, { once: true });
      window.addEventListener('keydown', init, { once: true });
    }

    // Backward-compat getter — all external code that reads realTracks keeps working
    get realTracks() { return this.activePlaylist; }

    // Build the active playlist from the current channel
    _rebuildActivePlaylist() {
      if (this.radioChannel === 'mix') {
        this.activePlaylist = [...RADIO_PLAYLISTS.hindi, ...RADIO_PLAYLISTS.english];
      } else {
        this.activePlaylist = [...(RADIO_PLAYLISTS[this.radioChannel] || RADIO_PLAYLISTS.hindi)];
      }
      if (this.currentTrackIndex >= this.activePlaylist.length) {
        this.currentTrackIndex = 0;
      }
    }

    // Dawn/dusk lean warm & nostalgic (90s), midday is upbeat cruising
    // (2000s), night leans modern/atmospheric (2010s) — matches each era's
    // acoustic texture to the mood of that time-of-day. Read from the game
    // instance rather than tracked locally since SoundEngine is a
    // standalone singleton constructed before `window.game` exists.
    _eraForCurrentTOD() {
      const tod = window.game && window.game.selectedTimeOfDay;
      if (tod === 'dawn' || tod === 'dusk') return '90s';
      if (tod === 'night') return '2010s';
      return '2000s'; // day, or unknown/not-yet-set
    }

    // Bias the CURRENT selection toward a track matching the current
    // time-of-day's era, without narrowing what prevTrack/nextTrack can
    // reach afterward — the player can still freely browse the whole
    // channel manually, this only picks where playback starts/resumes.
    _biasTrackIndexToEra() {
      if (!this.activePlaylist.length) return;
      const era = this._eraForCurrentTOD();
      const matchIdx = this.activePlaylist.findIndex(t => t.era === era);
      if (matchIdx !== -1) this.currentTrackIndex = matchIdx;
    }

    _formatTrackTitle(trk) {
      if (!trk) return 'Radio';
      return `${trk.title} — ${trk.artist} (${trk.era})`;
    }

    getChannelDisplayName() {
      return CHANNEL_NAMES[this.radioChannel] || 'DHABA FM';
    }

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          this.ctx = new AC();
          // Master warm lowpass filter to ensure all synth sounds are soft, rounded, and non-fatiguing
          this.masterFilter = this.ctx.createBiquadFilter();
          this.masterFilter.type = 'lowpass';
          this.masterFilter.frequency.setValueAtTime(1050, this.ctx.currentTime);
          this.masterFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);
          this.masterFilter.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    get muted() { return this.radioMuted && this.sfxMuted; }

    toggleRadioMute() {
      this.radioMuted = !this.radioMuted;
      localStorage.setItem('shiplyp_radio_muted', this.radioMuted ? '1' : '0');
      if (this.audioEl) this.audioEl.muted = this.radioMuted;
      if (this.radioPlaying && !this.suspended) {
        if (this.radioMuted) {
          this.stopSynthRadio();
          if (this.audioEl) this.audioEl.pause();
        } else {
          this._playCurrentTrack();
        }
      }
      return this.radioMuted;
    }

    toggleSfxMute() {
      this.sfxMuted = !this.sfxMuted;
      localStorage.setItem('shiplyp_sfx_muted', this.sfxMuted ? '1' : '0');
      return this.sfxMuted;
    }

    // Kept for any leftover call site — now toggles both together, matching
    // the old single-mute behavior exactly (radioMuted and sfxMuted end up
    // equal, since both start from whatever `muted` was: true only when
    // both were already muted).
    toggleMute() {
      const goingMuted = !this.muted;
      this.radioMuted = goingMuted;
      this.sfxMuted = goingMuted;
      localStorage.setItem('shiplyp_radio_muted', goingMuted ? '1' : '0');
      localStorage.setItem('shiplyp_sfx_muted', goingMuted ? '1' : '0');
      if (this.audioEl) this.audioEl.muted = goingMuted;
      if (this.radioPlaying && !this.suspended) {
        if (goingMuted) {
          this.stopSynthRadio();
          if (this.audioEl) this.audioEl.pause();
        } else {
          this._playCurrentTrack();
        }
      }
      return goingMuted;
    }

    // Fully suspends ALL audio (radio + SFX) regardless of the mute flags
    // above — called whenever the player isn't actively in a driving run
    // (menu, dispatch hub, restart) so nothing plays behind a menu screen.
    // Distinct from muting: muting is a per-channel user preference that
    // should survive a reload; suspension is a per-screen state that
    // shouldn't leak the mute flags (a muted-radio player who un-mutes
    // mid-menu shouldn't suddenly hear radio before they've started a run).
    suspendForMenu() {
      if (this.suspended) return;
      this.suspended = true;
      if (this.audioEl) this.audioEl.pause();
      if (this.synthRadioTimer) {
        clearInterval(this.synthRadioTimer);
        this.synthRadioTimer = null;
      }
    }

    resumeForGameplay() {
      this.suspended = false;
      if (this.radioPlaying && !this.radioMuted) {
        this._playCurrentTrack();
      }
    }

    // Soft, soothing Rhodes / Electric Piano chord and melody synthesizer note
    playSoothingNote(freq, duration = 0.45, volume = 0.14, isBass = false) {
      if (this.suspended || this.radioMuted || !freq || freq <= 0) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Soft envelope gain with gentle attack and warm decay
      const gain = ctx.createGain();
      const attackTime = isBass ? 0.045 : 0.028;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + attackTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.45), now + duration * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // Primary warm fundamental tone (sine)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      // Secondary tone for warm harmonic presence (sub-bass sine or gentle detuned triangle)
      const osc2 = ctx.createOscillator();
      osc2.type = isBass ? 'sine' : 'triangle';
      osc2.frequency.setValueAtTime(isBass ? freq * 0.5 : freq, now);
      if (!isBass) {
        osc2.detune.setValueAtTime(4.0, now);
      }

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterFilter || ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.05);
      osc2.stop(now + duration + 0.05);
    }

    // Gentle UI SFX (softened gains and rounded tones)
    playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.20) {
      if (this.suspended || this.sfxMuted) return;
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
      gain.connect(this.masterFilter || ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    playPothole() {
      if (this.suspended || this.sfxMuted) return;
      this.playTone(85, 'sine', 0.25, 0.35);
      setTimeout(() => this.playTone(55, 'sine', 0.2, 0.25), 40);
    }

    playCash() {
      if (this.suspended || this.sfxMuted) return;
      this.playTone(987, 'sine', 0.12, 0.22);
      setTimeout(() => this.playTone(1318, 'sine', 0.2, 0.18), 90);
    }

    playCombo() {
      if (this.suspended || this.sfxMuted) return;
      this.playTone(659, 'sine', 0.1, 0.20);
      setTimeout(() => this.playTone(880, 'sine', 0.12, 0.20), 80);
      setTimeout(() => this.playTone(1174, 'sine', 0.2, 0.20), 160);
    }

    playSpeedCam() {
      if (this.suspended || this.sfxMuted) return;
      this.playTone(1600, 'sine', 0.08, 0.30);
      setTimeout(() => this.playTone(450, 'sine', 0.25, 0.30), 80);
      setTimeout(() => this.playTone(350, 'sine', 0.35, 0.25), 280);
    }

    playCrash() {
      if (this.suspended || this.sfxMuted) return;
      this.playTone(110, 'sine', 0.35, 0.40);
      setTimeout(() => this.playTone(70, 'sine', 0.4, 0.35), 35);
      setTimeout(() => this.playTone(45, 'sine', 0.5, 0.30), 90);
    }

    playRepair() {
      if (this.suspended || this.sfxMuted) return;
      this.playTone(523, 'sine', 0.15, 0.20);
      setTimeout(() => this.playTone(659, 'sine', 0.15, 0.20), 100);
      setTimeout(() => this.playTone(784, 'sine', 0.2, 0.25), 200);
      setTimeout(() => this.playTone(1046, 'sine', 0.3, 0.25), 300);
    }

    // Soothing polyphonic English Synth Radio engine
    startSynthRadio(trackObj) {
      this.stopSynthRadio();
      const ctx = this.ensure();
      if (!this.radioPlaying || this.suspended || this.radioMuted) return;

      const track = trackObj || this.activePlaylist[this.currentTrackIndex];
      const scorePatterns = track?.patterns || RADIO_PLAYLISTS.english[0].patterns;
      const bpm = track?.bpm || 80;
      const stepInterval = Math.max(160, Math.round((60000 / bpm) / 2)); // 8th note interval in ms

      this.currentPatternIndex = 0;
      this.currentNoteIndex = 0;
      this.synthLoopCount = 0;

      const step = () => {
        if (!this.radioPlaying || this.suspended || this.radioMuted) return;

        const currentPat = scorePatterns[this.currentPatternIndex % scorePatterns.length];
        const melodyNotes = currentPat.melody || [];
        const chordNotes = currentPat.chord || [];
        const bassNote = currentPat.bass;

        // On pattern start: play bass & warm chord pad
        if (this.currentNoteIndex === 0) {
          if (bassNote) {
            this.playSoothingNote(noteToFreq(bassNote), Math.min(1.2, (stepInterval * 4) / 1000), 0.18, true);
          }
          chordNotes.forEach(chNote => {
            this.playSoothingNote(noteToFreq(chNote), Math.min(1.5, (stepInterval * 3.5) / 1000), 0.09, false);
          });
        }

        // Play melody note
        if (melodyNotes.length > 0) {
          const mNote = melodyNotes[this.currentNoteIndex % melodyNotes.length];
          this.playSoothingNote(noteToFreq(mNote), Math.min(0.8, (stepInterval * 1.6) / 1000), 0.13, false);
        }

        this.currentNoteIndex++;
        const patternLength = Math.max(4, melodyNotes.length);
        if (this.currentNoteIndex >= patternLength) {
          this.currentNoteIndex = 0;
          this.currentPatternIndex++;
          if (this.currentPatternIndex >= scorePatterns.length) {
            this.currentPatternIndex = 0;
            this.synthLoopCount++;
            // Auto advance track after 2 full relaxing cycles (~45-60s)
            if (this.synthLoopCount >= 2) {
              const nextTitle = this.nextTrack();
              const el = document.getElementById('radio-track-title');
              if (el) el.textContent = nextTitle;
            }
          }
        }
      };

      // Play immediate first note/chord right away
      step();
      this.synthRadioTimer = setInterval(step, stepInterval);
    }

    stopSynthRadio() {
      if (this.synthRadioTimer) {
        clearInterval(this.synthRadioTimer);
        this.synthRadioTimer = null;
      }
      this.synthLoopCount = 0;
      this.currentPatternIndex = 0;
      this.currentNoteIndex = 0;
    }

    _playCurrentTrack() {
      const trk = this.activePlaylist[this.currentTrackIndex];
      if (!trk) return '';

      if (trk.isSynth) {
        // Soothing synth track
        this.audioEl.pause();
        // Do NOT assign this.audioEl.src = '' because browsers fire an error event for empty src
        if (this.radioPlaying && !this.suspended && !this.radioMuted) {
          this.startSynthRadio(trk);
        } else {
          this.stopSynthRadio();
        }
      } else if (trk.url) {
        // Real MP3 track
        this.stopSynthRadio();
        if (this.audioEl.src !== trk.url) {
          this.audioEl.src = trk.url;
        }
        if (this.radioPlaying && !this.suspended && !this.radioMuted) {
          const playPromise = this.audioEl.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn('Audio play prevented or stream error:', err);
            });
          }
        } else {
          this.audioEl.pause();
        }
      }
      return this._formatTrackTitle(trk);
    }

    // Toggle radio on / off
    toggleRadio() {
      this.ensure();
      this.radioPlaying = !this.radioPlaying;
      this.userWantsRadio = this.radioPlaying;
      localStorage.setItem('shiplyp_radio_pref', this.radioPlaying ? 'on' : 'off');
      if (this.radioPlaying) {
        this._biasTrackIndexToEra();
        this._playCurrentTrack();
      } else {
        this.audioEl.pause();
        this.stopSynthRadio();
      }
      return this.radioPlaying;
    }

    nextTrack() {
      this.ensure();
      if (!this.activePlaylist.length) return '';
      this.currentTrackIndex = (this.currentTrackIndex + 1) % this.activePlaylist.length;
      return this._playCurrentTrack();
    }

    prevTrack() {
      this.ensure();
      if (!this.activePlaylist.length) return '';
      this.currentTrackIndex = (this.currentTrackIndex - 1 + this.activePlaylist.length) % this.activePlaylist.length;
      return this._playCurrentTrack();
    }

    switchChannel(channel) {
      if (!CHANNEL_ORDER.includes(channel)) channel = 'hindi';
      this.radioChannel = channel;
      localStorage.setItem('shiplyp_radio_channel', channel);
      this._rebuildActivePlaylist();
      this._biasTrackIndexToEra();
      return this._playCurrentTrack();
    }

    cycleChannel() {
      const idx = CHANNEL_ORDER.indexOf(this.radioChannel);
      const next = CHANNEL_ORDER[(idx + 1) % CHANNEL_ORDER.length];
      return this.switchChannel(next);
    }

    // Direct two-way toggle between the Hindi and English channels
    // specifically (skips 'mix', which stays reachable via cycleChannel/[L]
    // for anyone who wants the blended stream).
    toggleLanguage() {
      const next = this.radioChannel === 'hindi' ? 'english' : 'hindi';
      return this.switchChannel(next);
    }
  }

  const sound = new SoundEngine();
  window.sound = sound;
  window.RADIO_PLAYLISTS = RADIO_PLAYLISTS;
  window.noteToFreq = noteToFreq;

  // --------------------------------------------------------------------------
  // 4. CONFIG & MISSIONS
  // --------------------------------------------------------------------------
  const CONFIG = {
    ROAD_WIDTH: 7.4,
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
    ROAD_POINTS_COUNT: 500,
    POINT_SPACING: 45.0,
    TERRAIN_SIZE: 1600.0,
    TERRAIN_SEGMENTS: 100,
    FOLIAGE_COUNT: 600,

    // Tunnels: where raw hillside terrain towers far enough above the road
    // to loom over/through the camera (the recurring "terrain wall" bug —
    // see BUGFIX_LOG.md Pattern 1/3), bore a tunnel through it instead of
    // trying to out-clamp the noise. Turns an unfixable visual bug into an
    // intentional set piece rather than chasing a 4th root cause.
    TUNNEL_OVERHEAD_THRESHOLD: 16.0, // terrain must clear road by this much
    TUNNEL_MIN_RUN: 6,               // min contiguous samples (~ meters * segment spacing) to count as a zone
    TUNNEL_PAD: 3,                   // extra samples of portal buffer on each end
    TUNNEL_HALF_WIDTH: 6.0,          // semicircle radius, must exceed embankment slices it clamps
    TUNNEL_WALL_COLOR: 0x4a4038,
    TUNNEL_LIGHT_SPACING: 8,         // place a lamp every N longitudinal samples inside a zone

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
        // Fog color matched to the sky's HORIZON band, not its base —
        // distant terrain sits near the horizon in view, so fogging it
        // toward the base color left a visible mismatch band where terrain
        // faded into a different hue than the sky right behind it.
        // Density raised from a near-invisible 0.0017 to something that
        // actually dissolves distant geometry into atmosphere (slowroads.io
        // reference read as noticeably hazier at any real draw distance).
        fog: 0xf97316,
        fogDensity: 0.0055,
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
        fog: 0x38bdf8,
        fogDensity: 0.0048,
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
        fogDensity: 0.0058,
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
        fogDensity: 0.0065,
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
  // 4B. PROCEDURAL GROUND TEXTURES
  // No external texture files are bundled, so ground materials render as
  // flat vertex-color triangles — fine up close but reads as "vector art"
  // under the new PBR/bloom pipeline. These canvas-based tileable textures
  // give grass/asphalt/rock a repeating micro-detail speckle; they're
  // multiplied against the existing per-vertex terrain colors (map *
  // vertexColors) rather than replacing them, so seasonal palettes still work.
  const TextureFactory = {
    _cache: {},

    _canvas(size) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      return c;
    },

    grass(prng) {
      if (this._cache.grass) return this._cache.grass;
      const size = 256;
      const c = this._canvas(size);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      // Speckled blade/clump noise: light and dark flecks over neutral grey
      // (grey so it multiplies cleanly against any season's grass color).
      for (let i = 0; i < 5500; i++) {
        const x = prng.next() * size;
        const y = prng.next() * size;
        const shade = 0.72 + prng.next() * 0.5;
        const c8 = Math.floor(Math.min(255, 255 * shade));
        ctx.fillStyle = `rgba(${c8},${c8},${c8},0.5)`;
        const w = 0.6 + prng.next() * 1.6;
        const h = 2 + prng.next() * 5;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(prng.next() * Math.PI);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      this._cache.grass = tex;
      return tex;
    },

    asphalt(prng) {
      if (this._cache.asphalt) return this._cache.asphalt;
      const size = 256;
      const c = this._canvas(size);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#a8a8a8';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 9000; i++) {
        const x = prng.next() * size;
        const y = prng.next() * size;
        const shade = 0.55 + prng.next() * 0.7;
        const c8 = Math.floor(Math.min(255, 168 * shade));
        ctx.fillStyle = `rgba(${c8},${c8},${c8},0.6)`;
        const r = 0.5 + prng.next() * 1.3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      this._cache.asphalt = tex;
      return tex;
    },

    rock(prng) {
      if (this._cache.rock) return this._cache.rock;
      const size = 256;
      const c = this._canvas(size);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#bdbdbd';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 1400; i++) {
        const x = prng.next() * size;
        const y = prng.next() * size;
        const shade = 0.5 + prng.next() * 0.85;
        const c8 = Math.floor(Math.min(255, 189 * shade));
        ctx.fillStyle = `rgba(${c8},${c8},${c8},0.55)`;
        const w = 4 + prng.next() * 14;
        const h = 3 + prng.next() * 10;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(prng.next() * Math.PI);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      this._cache.rock = tex;
      return tex;
    }
  };

  // Setting `flatShading: false` on a material does nothing by itself if
  // the geometry has no smooth normal data to interpolate — and Three.js's
  // primitive polyhedra (DodecahedronGeometry etc.) are built non-indexed,
  // with each triangle's 3 vertices duplicated and given that triangle's
  // own flat face normal. There is nothing smooth stored on the geometry
  // for flatShading:false to blend between, so the material flag alone is
  // a no-op — confirmed directly: reading a rock's normal attribute showed
  // 9 consecutive vertices sharing one identical flat normal despite
  // flatShading already being off (see SLOWROADS_PARITY_LOG.md item 2's
  // correction). This welds coincident positions (the geometry stays
  // non-indexed — every duplicate vertex at a shared corner just gets
  // written the same averaged normal, which reads identically to a
  // properly indexed+smoothed mesh) and averages their face normals, the
  // same effect `BufferGeometryUtils.mergeVertices()` + computeVertexNormals
  // would give, without adding that as a new script dependency.
  function smoothFaceNormals(geometry, precision = 4) {
    geometry.computeVertexNormals(); // baseline: flat per-triangle normals
    const pos = geometry.attributes.position;
    const norm = geometry.attributes.normal;
    const groups = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(precision)},${pos.getY(i).toFixed(precision)},${pos.getZ(i).toFixed(precision)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    }
    const avg = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    for (const indices of groups.values()) {
      avg.set(0, 0, 0);
      for (const i of indices) avg.add(tmp.set(norm.getX(i), norm.getY(i), norm.getZ(i)));
      avg.normalize();
      for (const i of indices) norm.setXYZ(i, avg.x, avg.y, avg.z);
    }
    norm.needsUpdate = true;
    return geometry;
  }

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
      this.windowMaterials = [];
      this.trafficVehicles = [];
      this.deliveryTargets = [];
      this.potholes = [];
      this.crossers = [];
      // Thin roadside props (poles, lampposts) the camera can end up
      // staring straight through when the on-foot courier walks up close
      // to one — tracked separately from `obstacles` (which only stores a
      // position/radius, not the mesh) so the camera can fade them out.
      this.occluderMeshes = [];

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

    // Shared ground-height formula (road surface / shoulder / embankment
    // blend to raw hillside), used both for prop placement during world
    // gen (calcTerrainY closure below mirrors this) and for repositioning
    // dynamic actors like road crossers every frame. `pt` is the road
    // curve point this offset is measured from; `worldPos` is the actual
    // x/z being evaluated (pt + normal*latDist); `latDist` is the signed
    // lateral offset from the road centerline.
    groundHeightAt(pt, worldPos, latDist) {
      const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
      const SHOULDER_TRANSITION = 9.0;
      const EMBANKMENT_BLEND = 45.0;
      const absDist = Math.abs(latDist);
      if (absDist <= roadHalf) {
        return pt.y - 0.18;
      } else if (absDist <= SHOULDER_TRANSITION) {
        const t = (absDist - roadHalf) / (SHOULDER_TRANSITION - roadHalf);
        return pt.y - 0.18 - t * 0.32;
      } else if (absDist <= EMBANKMENT_BLEND) {
        const rawH = this.getRawTerrainHeight(worldPos.x, worldPos.z);
        const blendFactor = THREE.MathUtils.smoothstep(absDist, SHOULDER_TRANSITION, EMBANKMENT_BLEND);
        const shoulderDrop = pt.y - 0.5;
        return THREE.MathUtils.lerp(shoulderDrop, rawH, blendFactor);
      } else {
        return this.getRawTerrainHeight(worldPos.x, worldPos.z) - 0.3;
      }
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
      this.computeTunnelZones();

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
      // Sky color used to be Gouraud-interpolated per-VERTEX, baked onto a
      // coarse sphere — every ring boundary was a visible kink where the
      // interpolation slope changed (the vertical blend uses a non-linear
      // easing, pow(normY,0.75), that a polygonal mesh can only ever
      // approximate piecewise). Raising the ring count (24→64) reduced but
      // did not eliminate it for high-range gradients like Dawn's
      // purple→orange→yellow sweep — the banding is fundamentally a
      // property of vertex-based color interpolation, not something you
      // can subdivide your way out of for an arbitrarily wide color range.
      // Computing the exact same gradient per-PIXEL in a fragment shader
      // removes the mechanism entirely, at any geometry resolution — this
      // is the real fix, not a bigger version of the band-aid.
      const geom = new THREE.SphereGeometry(1100, 32, 24);

      const skyMat = new THREE.ShaderMaterial({
        uniforms: {
          topCol: { value: new THREE.Color(tod.skyTop) },
          horizCol: { value: new THREE.Color(tod.skyHorizon) },
          botCol: { value: new THREE.Color(tod.skyBottom) }
        },
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topCol;
          uniform vec3 horizCol;
          uniform vec3 botCol;
          varying vec3 vPos;
          void main() {
            float normY = vPos.y / 1100.0;
            vec3 col;
            if (normY > 0.0) {
              col = mix(horizCol, topCol, pow(normY, 0.75));
            } else {
              col = mix(horizCol, botCol, min(1.0, -normY * 1.5));
            }
            // Even an exactly-computed gradient still quantizes to 8 bits
            // per channel on write — a per-pixel hash dither breaks that
            // final quantization step into imperceptible grain instead of
            // visible bands (same technique as the post-process vignette).
            float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 128.0;
            gl_FragColor = vec4(col + dither, 1.0);
          }
        `,
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
      const tubularSegments = CONFIG.ROAD_MESH_SEGMENTS;
      const roadWidth = CONFIG.ROAD_WIDTH;
      const shoulderWidth = CONFIG.ROAD_SHOULDER_WIDTH;
      const geom = new THREE.BufferGeometry();

      const positions = [];
      const colors = [];
      const normals = [];
      const uvs = [];
      const indices = [];

      const points = this.curve.getSpacedPoints(tubularSegments);
      // Cached so VehicleController can compute banking from the EXACT
      // same points-array finite-difference this mesh uses, instead of
      // curve.getTangentAt() — a structurally different tangent estimate
      // (Catmull-Rom's own parametric derivative vs finite differences of
      // arc-length-spaced points) that silently diverges from what's
      // actually rendered, worst measured at a full clamp-width difference
      // (-0.14 vs the true -0.1137 rad) on a real curve. See
      // BUGFIX_LOG.md's vehicle-sinks-into-road entry (Pattern 2, 4th
      // occurrence).
      this.roadSpacedPoints = points;
      const tCfg = CONFIG.ROAD_TERRAINS[roadTerrainKey] || CONFIG.ROAD_TERRAINS.asphalt;
      const baseTarmac = new THREE.Color(tCfg.color);
      const vergeColor = new THREE.Color(tCfg.color).multiplyScalar(0.72);
      const whiteLine = new THREE.Color(0xf8fafc);

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

        for (let j = 0; j < offsets.length; j++) {
          const off = offsets[j];
          const isVerge = (j === 0 || j === 6);
          // The verge is offset along the UNBANKED normal, matching how the
          // terrain ribbon offsets its own slices. Using bankedNormal here
          // put the road's outer edge on a slightly different 3D line than
          // the terrain's matching slice on every banked curve, so the two
          // edges crossed each other instead of meeting.
          const p = pt.clone().addScaledVector(isVerge ? normal : bankedNormal, off);
          if (isVerge) {
            // The ribbon's outer verge used to sit at a fixed pt.y + 0.04,
            // while the terrain at that same lateral distance is a shoulder
            // slope ending ~0.28 lower — so the whole road floated ~0.32u
            // above the ground along its entire length, showing a continuous
            // dark sliver of exposed terrain down both shoulders. Take the
            // height from the shared ground function instead (never a second
            // copy of the formula — see BUGFIX_LOG.md Recurring Pattern 1),
            // plus a 2cm lift so the road slab wins the depth test rather
            // than sitting coplanar with the terrain and z-fighting into a
            // ragged sawtooth edge. Banking is deliberately not applied to
            // this Y: the terrain is unbanked, so the edge must meet it at
            // unbanked height.
            p.y = this.groundHeightAt(pt, p, off) + CONFIG.ROAD_VERGE_LIFT;
          } else {
            p.addScaledVector(bankedUp, 0.12);
          }
          positions.push(p.x, p.y, p.z);
          normals.push(bankedUp.x, bankedUp.y, bankedUp.z);
          uvs.push(off * 0.5, i * 0.3);

          // Assign sharp vertex colors for asphalt and highway paint
          if (j === 0 || j === 6) {
            colors.push(vergeColor.r, vergeColor.g, vergeColor.b);
          } else if (j === 1 || j === 5) {
            colors.push(whiteLine.r, whiteLine.g, whiteLine.b);
          } else if (j === 3) {
            // Was a bright yellow dashed center line — under strong
            // daylight + ACES tonemapping it crossed the bloom threshold
            // and blew out into large soft glowing blobs across the road
            // instead of reading as a crisp lane marking, defeating its
            // own purpose. Removed rather than just dimmed, per request.
            colors.push(baseTarmac.r, baseTarmac.g, baseTarmac.b);
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
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      const roadMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0.05,
        map: TextureFactory.asphalt(this.prng)
      });

      this.roadMesh = new THREE.Mesh(geom, roadMaterial);
      this.roadMesh.receiveShadow = true;
      return this.roadMesh;
    }

    // Scans the finished curve at the SAME sampling rate createTerrainMesh
    // uses (CONFIG.ROAD_MESH_SEGMENTS) for stretches where raw hillside
    // terrain clears the road by more than TUNNEL_OVERHEAD_THRESHOLD — the
    // condition that produces the "terrain wall" bug. Those stretches get a
    // tunnel bored through them instead: this.tunnelZones is consumed both
    // by createTunnelMeshes() (builds the bore) and createTerrainMesh()
    // (flattens the corridor so the hillside doesn't poke back through the
    // tube walls). Indices are into curve.getSpacedPoints(tubularSegments),
    // so they line up 1:1 with createTerrainMesh's own `i` loop variable.
    computeTunnelZones() {
      const tubularSegments = CONFIG.ROAD_MESH_SEGMENTS;
      const points = this.curve.getSpacedPoints(tubularSegments);
      const up = new THREE.Vector3(0, 1, 0);
      // Centerline-only overhead missed asymmetric hills — a hillside that
      // buries just one shoulder while the exact centerline stays clear
      // still loomed into frame the moment the car (or the chase camera,
      // which trails/swings independently) drifted toward that side. Probe
      // the vehicle's actual max lateral drift (±9m, see the fence lateral
      // clamp) as well as dead center and take the worst of the three —
      // matches what a hillside would actually do to the driveable corridor
      // and the camera riding inside it, not just the rail down the middle.
      const LATERAL_PROBES = [-9, 0, 9];
      const overhead = points.map((pt, i) => {
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(tubularSegments, i + 1)];
        const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
        let worst = -Infinity;
        for (const lat of LATERAL_PROBES) {
          const wp = pt.clone().addScaledVector(normal, lat);
          const h = this.getRawTerrainHeight(wp.x, wp.z) - pt.y;
          if (h > worst) worst = h;
        }
        return worst;
      });

      const zones = [];
      let runStart = -1;
      for (let i = 0; i <= tubularSegments; i++) {
        const over = overhead[i] > CONFIG.TUNNEL_OVERHEAD_THRESHOLD;
        if (over && runStart === -1) {
          runStart = i;
        } else if (!over && runStart !== -1) {
          if (i - runStart >= CONFIG.TUNNEL_MIN_RUN) zones.push({ start: runStart, end: i - 1 });
          runStart = -1;
        }
      }
      if (runStart !== -1 && tubularSegments - runStart >= CONFIG.TUNNEL_MIN_RUN) {
        zones.push({ start: runStart, end: tubularSegments });
      }

      // Pad each zone with a portal buffer, then merge any that now overlap
      // so two nearby hills don't produce two tunnels with a sliver of open
      // road wedged between their portals.
      const pad = CONFIG.TUNNEL_PAD;
      const padded = zones.map(z => ({
        start: Math.max(0, z.start - pad),
        end: Math.min(tubularSegments, z.end + pad)
      }));
      const merged = [];
      for (const z of padded) {
        const prev = merged[merged.length - 1];
        if (prev && z.start <= prev.end) prev.end = Math.max(prev.end, z.end);
        else merged.push({ ...z });
      }

      this.tunnelZones = merged;
      this.tunnelPoints = points; // cached — same array createTunnelMeshes/createTerrainMesh index into
    }

    // Is longitudinal sample index `i` inside a tunnel zone (optionally
    // padded further, e.g. so the terrain carve fades out past the portal)?
    isInTunnelZone(i, extraPad = 0) {
      if (!this.tunnelZones) return false;
      return this.tunnelZones.some(z => i >= z.start - extraPad && i <= z.end + extraPad);
    }

    createTerrainMesh(season) {
      // Must match createRoadMesh's segment count exactly — see
      // CONFIG.ROAD_MESH_SEGMENTS. At 800 vs the road's 1200 the two
      // ribbons sampled the curve at different positions, so they only
      // lined up where samples coincided and tore apart in between.
      const tubularSegments = CONFIG.ROAD_MESH_SEGMENTS;
      const roadHalf = CONFIG.ROAD_WIDTH * 0.52; // ~3.85m
      // Lateral distance of the road ribbon's outer edge. The terrain needs
      // a vertex row at exactly this distance so the road edge lands on a
      // real terrain vertex rather than somewhere across a wide triangle.
      const vergeLat = CONFIG.ROAD_WIDTH * 0.5 + CONFIG.ROAD_SHOULDER_WIDTH;
      // Embankment zone (9m out to EMBANKMENT_BLEND=45m in groundHeightAt)
      // used to have only two slices out there — 20 and 40 — a 20m gap the
      // mesh bridges with a straight line. This terrain isn't just gentle
      // noise: groundHeightAt/createTerrainMesh both give raw hillside
      // height its own "cliff" color band once it exceeds 22 units, i.e.
      // the game already expects genuinely steep faces out here, and a
      // handful of sparse slices can never approximate a cliff with a
      // straight line no matter how they're spaced. Densified to roughly
      // every 3-4m, which is what actually closes the gap — props and the
      // on-foot walker are placed via groundHeightAt() (the true nonlinear
      // surface), so the rendered mesh has to track it this closely or
      // they float/sink relative to what's on screen. Verified by
      // raycasting the rendered mesh (see dev-checks.js
      // embankment-mesh-matches-formula): worst gap dropped from 4.27u
      // (2 slices out here) to <0.1u at this density.
      const lateralSlices = [
        -45.0, -41.0, -37.0, -33.0, -29.0, -25.0, -21.0, -17.0, -13.0, -9.0,
        -vergeLat, -roadHalf, roadHalf, vergeLat,
        9.0, 13.0, 17.0, 21.0, 25.0, 29.0, 33.0, 37.0, 41.0, 45.0
      ];
      const sliceCount = lateralSlices.length;

      const positions = [];
      const colors = [];
      const normals = [];
      const uvs = [];
      const indices = [];

      const grassCol = new THREE.Color(season.grassColor);
      const grassLight = new THREE.Color(season.grassLight);
      const cliffCol = new THREE.Color(season.cliffColor);

      const points = this.tunnelPoints || this.curve.getSpacedPoints(tubularSegments);

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
            // No ceiling here — the shoulder zone above already guarantees
            // clearance right at the road edge, and hillside terrain 10-40m
            // out is legitimately much taller than the road (that's what a
            // hillside is). Clamping this to "road height + 0.2" used to
            // flatten the ribbon near the road while the world floor plane
            // (unclamped past 45m) shot up to true height right past the
            // seam — a hard cliff appearing to erupt beside/over the road.
            finalY = THREE.MathUtils.lerp(shoulderDrop, rawH, blendFactor);

            if (rawH > 22.0) {
              colors.push(cliffCol.r, cliffCol.g, cliffCol.b);
            } else {
              const nVal = 0.85 + this.simplex.noise2D(worldPos.x * 0.04, worldPos.z * 0.04) * 0.25;
              colors.push(grassCol.r * nVal, grassCol.g * nVal, grassCol.b * nVal);
            }
          }

          positions.push(worldPos.x, finalY, worldPos.z);
          normals.push(0, 1, 0);
          uvs.push(worldPos.x * 0.15, worldPos.z * 0.15);

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
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      const terrainMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.95,
        metalness: 0.0,
        map: TextureFactory.grass(this.prng)
      });

      this.terrainMesh = new THREE.Mesh(geom, terrainMat);
      this.terrainMesh.receiveShadow = true;
      return this.terrainMesh;
    }

    // Builds a tunnel bore (arched cross-section extruded along the curve)
    // for every zone computeTunnelZones() found, plus a lamp every few
    // samples so the inside isn't pitch black. Returns a Group (possibly
    // empty — most seeds have zero tall-hill zones) to add/remove from the
    // scene alongside the road/terrain meshes.
    createTunnelMeshes() {
      const group = new THREE.Group();
      group.name = 'tunnels';
      this.tunnelGroup = group;
      if (!this.tunnelZones || !this.tunnelZones.length) return group;

      const points = this.tunnelPoints;
      const halfWidth = CONFIG.TUNNEL_HALF_WIDTH;
      const wallHeight = 4.0;
      const archRadius = halfWidth + 1.0;
      const archSegs = 10;

      // Cross-section as a list of {lat, h} offsets from the road surface,
      // left wall base -> left wall top -> arch -> right wall top -> right
      // wall base. Order matters: it becomes the j index used below.
      const section = [];
      section.push({ lat: -halfWidth, h: 0 });
      section.push({ lat: -halfWidth, h: wallHeight });
      for (let s = 0; s <= archSegs; s++) {
        const theta = Math.PI - (Math.PI * s / archSegs); // PI (left) -> 0 (right)
        section.push({ lat: Math.cos(theta) * archRadius, h: wallHeight + Math.sin(theta) * archRadius });
      }
      section.push({ lat: halfWidth, h: wallHeight });
      section.push({ lat: halfWidth, h: 0 });
      const sliceCount = section.length;

      const wallMat = new THREE.MeshStandardMaterial({
        color: CONFIG.TUNNEL_WALL_COLOR,
        roughness: 0.9,
        metalness: 0.05,
        side: THREE.DoubleSide
      });

      for (const zone of this.tunnelZones) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        const rowIndices = [];

        for (let i = zone.start; i <= zone.end; i++) {
          const pt = points[i];
          const prev = points[Math.max(zone.start, i - 1)];
          const next = points[Math.min(zone.end, i + 1)];
          const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
          const up = new THREE.Vector3(0, 1, 0);
          const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

          const rowStart = positions.length / 3;
          rowIndices.push(rowStart);

          for (const { lat, h } of section) {
            const worldPos = pt.clone().addScaledVector(normal, lat);
            worldPos.y = pt.y - 0.18 + h;
            positions.push(worldPos.x, worldPos.y, worldPos.z);
            // Inward-facing normal: from the cross-section edge back toward
            // the tunnel's own centerline/axis at this height.
            const nrm = new THREE.Vector3(-normal.x, 0, -normal.z).normalize().lerp(new THREE.Vector3(0, -1, 0), h / (wallHeight + archRadius));
            normals.push(nrm.x, nrm.y, nrm.z);
            uvs.push((i - zone.start) * 0.3, (lat + halfWidth) * 0.1);
          }

          if (i > zone.start) {
            const prevRow = rowIndices[rowIndices.length - 2];
            for (let j = 0; j < sliceCount - 1; j++) {
              const a = prevRow + j, b = prevRow + j + 1, c = rowStart + j, d = rowStart + j + 1;
              // Wound so the visible (front) face points inward, toward the tube's own axis.
              indices.push(a, c, b);
              indices.push(b, c, d);
            }
          }
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.setIndex(indices);

        const mesh = new THREE.Mesh(geom, wallMat);
        mesh.receiveShadow = true;
        group.add(mesh);

        // Ceiling-mounted fixtures every few samples, centered on the arch
        // apex — a distinct fixture from the outdoor roadside streetlamps
        // (which are boom-armed poles planted beside the shoulder; these
        // are flush-mounted overhead, the way an actual bored tunnel is
        // lit). A visible housing + lens, not just a bare point light, so
        // it reads as a fixture even with the light off in the distance.
        const fixtureGeom = new THREE.BoxGeometry(0.5, 0.22, 2.4);
        const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5, metalness: 0.6 });
        const lensGeom = new THREE.BoxGeometry(0.36, 0.06, 2.0);
        const lensMat = new THREE.MeshStandardMaterial({ color: 0xfff2d9, emissive: 0xfff2d9, emissiveIntensity: 1.6, roughness: 0.3 });

        const apexHeight = wallHeight + archRadius;
        const lampSpacing = CONFIG.TUNNEL_LIGHT_SPACING;
        for (let i = zone.start; i <= zone.end; i += lampSpacing) {
          const pt = points[i];
          const prev = points[Math.max(zone.start, i - 1)];
          const next = points[Math.min(zone.end, i + 1)];
          const tangent = new THREE.Vector3().subVectors(next, prev).normalize();

          const fixturePos = pt.clone();
          fixturePos.y = pt.y - 0.18 + apexHeight - 0.14; // recessed slightly into the ceiling, not floating below it

          const fixture = new THREE.Group();
          const housing = new THREE.Mesh(fixtureGeom, fixtureMat);
          const lens = new THREE.Mesh(lensGeom, lensMat);
          lens.position.y = -0.09;
          fixture.add(housing, lens);
          fixture.position.copy(fixturePos);
          fixture.lookAt(fixturePos.clone().add(tangent));
          group.add(fixture);

          const lamp = new THREE.PointLight(0xfff2d9, 5.5, 15.0, 2.0);
          lamp.position.set(fixturePos.x, fixturePos.y - 0.3, fixturePos.z);
          group.add(lamp);
        }
      }

      this.tunnelGroup = group;
      return group;
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

      // REVERTED: this was briefly raised to 700 segments (~9m cells) to
      // shrink a formula-vs-floor-mesh accuracy gap for distant background
      // buildings. That reasoning only weighed ONE-TIME WORLD-BUILD cost
      // (which did improve, thanks to the spatial-hash search below) and
      // completely missed the real cost: this mesh is STATIC but still
      // renders every single frame, and at 700 segments it was 647,522
      // triangles — 89% of the entire scene's per-frame triangle budget —
      // which measurably dropped real gameplay FPS from ~59.5 to ~42.6.
      // Solving a placement-ACCURACY problem by brute-forcing RENDER
      // density was the wrong lever: the floor is mostly invisible
      // backdrop (hidden under the ribbon for 0-45m, and visual smoothness
      // of distant terrain doesn't need per-formula precision). Back to
      // 400 — the residual accuracy gap this was chasing is handled where
      // it actually matters: buildings already have a 60-unit foundation
      // slab (B21) that absorbs it, and the specific rock-floating bug
      // reported alongside this FPS regression turned out to be an
      // unrelated fixed-offset-vs-random-rotation bug in rock placement
      // itself (see the boulder/rock spawn code), not a floor-resolution
      // problem at all. If distant-prop floating is ever reported again
      // for something WITHOUT its own foundation/offset fix, address that
      // prop's own placement, not this mesh's global render resolution.
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
      // the sample spacing).
      //
      // This used to be its own separate 260-point getSpacedPoints() call
      // — coarse enough (~19m between samples on a multi-km winding route)
      // that a floor vertex's TRUE nearest distance to the road could read
      // as significantly farther via straight-line distance to the nearest
      // of only 260 discrete points, wrongly classifying vertices near the
      // ribbon-coverage boundary as "past the ribbon" when they weren't —
      // measured a real 27-32u floating gap at exactly that boundary.
      // Reuses world.roadSpacedPoints (CONFIG.ROAD_MESH_SEGMENTS = 1200
      // points, cached by createRoadMesh, which always runs first in
      // buildWorldAndScene) instead: same dense sampling the ribbon and
      // road mesh themselves are built from, not a fourth independent
      // approximation of "how far is this point from the road."
      const roadSamples = this.roadSpacedPoints || this.curve.getSpacedPoints(CONFIG.ROAD_MESH_SEGMENTS);

      const roadHalf = CONFIG.ROAD_WIDTH * 0.52;
      // createTerrainMesh (the close-up "ribbon" that actually renders the
      // ground right around the road) draws real terrain out to exactly
      // ±40m (its own lateralSlices array caps there). This floor plane
      // used to separately replicate the ribbon's embankment-blend formula
      // out to a nominal 45m using its OWN coarser road sampling (260
      // points here vs the ribbon's exact per-point `pt`) — two
      // independent formulas computing "the same" height were never
      // guaranteed to agree, and after removing their shared clamp (see
      // the commit that fixed buildings/props sinking into hillsides) the
      // small disagreement became large enough that this floor could
      // render ABOVE the ribbon+road, burying the road and vehicle under
      // floor terrain that was only ever meant to be hidden underneath it.
      // Simplest fix that can't diverge again: stay hidden everywhere the
      // ribbon actually draws, and only surface true terrain height past
      // that, where the ribbon has nothing to conflict with. Must equal
      // groundHeightAt's own EMBANKMENT_BLEND (45), not an independent
      // guess — that's the actual distance the ribbon (and every prop
      // placed via groundHeightAt) stops blending and starts reading raw
      // terrain directly. This was 40 and caused a real ~27u cliff for
      // anything sitting in the 40-45m gap; see the fix note below.
      const RIBBON_COVERAGE = 45.0;

      // Spatial hash over roadSamples so each floor vertex only checks
      // nearby cells instead of all 1200 points — switching roadSamples
      // from 260 to 1200 points above (needed for correctness: see the
      // comment on roadSamples) made the brute-force O(vertices x samples)
      // search ~4.6x slower (measured: +540ms/+63% on world build). Cell
      // size covers RIBBON_COVERAGE with one ring of neighbor cells so the
      // true nearest sample is never missed near the boundary that matters.
      const GRID_CELL = 50.0;
      const grid = new Map();
      const cellKey = (cx, cz) => cx + ',' + cz;
      for (let s = 0; s < roadSamples.length; s++) {
        const cx = Math.floor(roadSamples[s].x / GRID_CELL);
        const cz = Math.floor(roadSamples[s].z / GRID_CELL);
        const key = cellKey(cx, cz);
        let bucket = grid.get(key);
        if (!bucket) { bucket = []; grid.set(key, bucket); }
        bucket.push(s);
      }

      const pos = geom.attributes.position;
      const colors = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const rawH = this.getRawTerrainHeight(x, z);

        let nearestDistSq = Infinity;
        let nearestRoadY = Infinity;
        const vcx = Math.floor(x / GRID_CELL);
        const vcz = Math.floor(z / GRID_CELL);
        // Ring size 1 covers a 150x150 area around the vertex (3x3 cells of
        // 50), comfortably beyond RIBBON_COVERAGE(45) in every direction —
        // the true nearest sample within 45m can never fall outside it.
        for (let dcx = -1; dcx <= 1; dcx++) {
          for (let dcz = -1; dcz <= 1; dcz++) {
            const bucket = grid.get(cellKey(vcx + dcx, vcz + dcz));
            if (!bucket) continue;
            for (let bi = 0; bi < bucket.length; bi++) {
              const s = bucket[bi];
              const dx = x - roadSamples[s].x;
              const dz = z - roadSamples[s].z;
              const dSq = dx * dx + dz * dz;
              if (dSq < nearestDistSq) {
                nearestDistSq = dSq;
                nearestRoadY = roadSamples[s].y;
              }
            }
          }
        }
        // Fallback for the rare vertex with no road sample within the 3x3
        // neighborhood (far off in the world-floor margin, well past where
        // RIBBON_COVERAGE or the blend even matters) — brute force once,
        // correctness over speed for what's already an edge case.
        if (nearestDistSq === Infinity) {
          for (let s = 0; s < roadSamples.length; s++) {
            const dx = x - roadSamples[s].x;
            const dz = z - roadSamples[s].z;
            const dSq = dx * dx + dz * dz;
            if (dSq < nearestDistSq) {
              nearestDistSq = dSq;
              nearestRoadY = roadSamples[s].y;
            }
          }
        }


        const naturalY = rawH - 0.3;
        let finalY = naturalY;
        const dist = Math.sqrt(nearestDistSq);
        // BUGFIX (two rounds — read both, the first round was insufficient
        // on its own): this originally switched hard at dist<=40 between
        // "buried 25 under the road" and "true raw height," while the
        // ribbon/prop formula both actually cover out to 45
        // (EMBANKMENT_BLEND) — a mismatched boundary, not just a missing
        // blend, worth ~27-32u of real measured floating.
        //
        // Round 1 just moved the switch to the correct boundary (45). That
        // was NOT enough: floor mesh vertices are only ~15m apart (see
        // `segments` above), so ANY hard switch — even at the geometrically
        // correct distance — still compresses a 25+ unit jump into whatever
        // single quad happens to straddle it, and that quad interpolates
        // linearly between "deeply buried" and "true height" across its
        // ~15m width. Any building sitting on that one transitional quad
        // reads a wrong, blended-neither height — measured up to 38u still,
        // now at exactly the (correct) boundary instead of the old wrong
        // one. A hard switch cannot ever be made safe this way; the
        // transition itself has to be smooth AND has to finish (reach true
        // naturalY) at or before dist=45, since groundHeightAt — what every
        // prop placed out here actually uses — is unblended and constant
        // past that point (verified continuous 35->60m: 2.43, 4.55, 5.90,
        // 7.23, 8.23, 8.48, 8.25, 7.17, 6.30). Blending PAST 45 (an earlier,
        // reverted attempt) would leave the floor still ramping up while
        // props already sit at full natural height — the same bug in the
        // opposite direction.
        //
        // Fix: smoothstep from fully-buried at BLEND_START (25 — well
        // inside where the ribbon has real, visible geometry, so nothing is
        // ever placed relying on the floor there) up to fully-natural
        // exactly AT RIBBON_COVERAGE(45). By the boundary the floor has
        // already caught up to the same continuous value props use, so
        // there is nothing left to jump.
        //
        // BLEND_START is 40, not some wider margin — dev-checks.js's
        // `floor-hidden-under-ribbon` guards a real, separate invariant:
        // the floor must stay well below actual road level (>10u under)
        // everywhere within 40m, or it can visually poke through the
        // ribbon/road itself regardless of whether any prop relies on it.
        // A wider blend window (25->45, tried first) broke that guard —
        // this narrower 40->45 band is the widest that respects it.
        const BLEND_START = 40.0;
        if (dist <= BLEND_START) {
          finalY = nearestRoadY - 25.0;
        } else if (dist < RIBBON_COVERAGE) {
          const blendT = THREE.MathUtils.smoothstep(dist, BLEND_START, RIBBON_COVERAGE);
          finalY = THREE.MathUtils.lerp(nearestRoadY - 25.0, naturalY, blendT);
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

      // Own clone of the shared grass texture so this mesh's repeat count
      // (driven by its own, much larger, world-space size) doesn't fight
      // with the terrain ribbon's repeat setting on the cached original.
      const floorGrassTex = TextureFactory.grass(this.prng).clone();
      floorGrassTex.needsUpdate = true;
      floorGrassTex.repeat.set(size * 0.15, size * 0.15);

      const floorMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.95,
        metalness: 0.0,
        map: floorGrassTex
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
      this.crossers = [];

      const diffCfg = CONFIG.DIFFICULTY_TIERS[difficulty] || CONFIG.DIFFICULTY_TIERS.medium;

      // Reusable Low-Poly Foliage & Prop Geometries
      const trunkGeom = new THREE.CylinderGeometry(0.25, 0.45, 2.8, 6);
      const pineLeavesGeom = new THREE.ConeGeometry(2.4, 5.0, 10);
      // detail 1 (not 0): flat-normal duplicate vertices only welding to a
      // SHARED smooth normal (via smoothFaceNormals below) isn't enough on
      // its own either — at detail 0 a dodecahedron's 12 faces are each so
      // large that even perfect normal averaging only shows a gradient
      // right at the face edges, reading as "still basically flat" in the
      // middle of every face. Detail 1 subdivides each face so there's
      // enough vertex density for the averaged gradient to actually be
      // visible across the surface, not just at seams.
      const decLeavesGeom = smoothFaceNormals(new THREE.DodecahedronGeometry(2.4, 1));
      const bushGeom = new THREE.DodecahedronGeometry(1.2, 0);
      const rockGeom = smoothFaceNormals(new THREE.DodecahedronGeometry(1.6, 1));
      const poleGeom = new THREE.CylinderGeometry(0.1, 0.12, 6.5, 6);
      const crossbarGeom = new THREE.BoxGeometry(1.8, 0.12, 0.12);

      // Trunks/rocks are organic shapes — flat shading on round primitives
      // reads as faceted "gem" geometry (see SLOWROADS_PARITY_LOG.md item 2)
      // where smooth shading reads as an actual rounded surface at the same
      // triangle count. Man-made props (poles, buildings, vehicles below)
      // keep flatShading — that's a deliberate low-poly look, not the bug.
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a6065, roughness: 0.8, map: TextureFactory.rock(this.prng) });
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4e52, flatShading: true, roughness: 0.6, metalness: 0.3 });

      const potholeGeom = new THREE.CircleGeometry(1.3, 12);
      potholeGeom.rotateX(-Math.PI / 2);
      const potholeMat = new THREE.MeshBasicMaterial({ color: 0x0a0c10 });

      const rumbleGeom = new THREE.BoxGeometry(CONFIG.ROAD_WIDTH * 0.82, 0.08, 0.45);
      const rumbleMat = new THREE.MeshLambertMaterial({ color: 0xfca311 });

      // Low-poly pedestrian/animal road-crosser builder — same flat-shaded
      // block-figure style as the porch resident so crossers read as part
      // of the world rather than a mismatched asset dropped in.
      const CROSSER_PALETTE = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0xec4899];
      const buildCrosserMesh = (kind) => {
        const group = new THREE.Group();
        if (kind === 'pedestrian') {
          const skinMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
          const shirtMat = new THREE.MeshLambertMaterial({ color: CROSSER_PALETTE[Math.floor(this.prng.range(0, CROSSER_PALETTE.length))] });
          const legMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
          const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, 0.22), shirtMat);
          torso.position.y = 0.95;
          const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), skinMat);
          head.position.y = 1.42;
          const legL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.16), legMat);
          legL.position.set(-0.1, 0.32, 0);
          const legR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.16), legMat);
          legR.position.set(0.1, 0.32, 0);
          group.add(torso, head, legL, legR);
          group.userData.legs = [legL, legR];
          group.userData.hitRadius = 1.1;
          group.userData.walkSpeed = this.prng.range(1.0, 1.8);
        } else {
          // Dog / cat — same low quadruped rig, cat sized down.
          const isCat = kind === 'cat';
          const furMat = new THREE.MeshLambertMaterial({ color: isCat ? 0x374151 : CROSSER_PALETTE[Math.floor(this.prng.range(0, CROSSER_PALETTE.length))] });
          // Dogs were reading as barely-visible specks next to the
          // pedestrian rig (whose torso alone is 0.62 tall) — scaled up to
          // an actual stray-dog size instead of a toy-sized silhouette.
          const scale = isCat ? 0.62 : 1.7;
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.7 * scale, 0.3 * scale, 0.32 * scale), furMat);
          body.position.y = 0.32 * scale;
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.24 * scale, 0.22 * scale, 0.24 * scale), furMat);
          head.position.set(0.42 * scale, 0.38 * scale, 0);
          const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32 * scale, 0.08 * scale, 0.08 * scale), furMat);
          tail.position.set(-0.42 * scale, 0.42 * scale, 0);
          tail.rotateZ(0.6);
          const legGeom = new THREE.BoxGeometry(0.09 * scale, 0.26 * scale, 0.09 * scale);
          const legs = [];
          [[-0.24, -0.1], [-0.24, 0.1], [0.24, -0.1], [0.24, 0.1]].forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(legGeom, furMat);
            leg.position.set(lx * scale, 0.14 * scale, lz * scale);
            group.add(leg);
            legs.push(leg);
          });
          group.add(body, head, tail);
          group.userData.legs = legs;
          group.userData.hitRadius = isCat ? 0.65 : 1.1;
          group.userData.walkSpeed = this.prng.range(1.6, 2.6);
        }
        return group;
      };

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
      // getSpacedPoints divides the curve into equal-arc-length segments,
      // so this spacing is exact (not an approximation) — used to size
      // fence segments so they tile edge-to-edge without gaps.
      const avgSegStep = this.curve.getLength() / sampledPoints.length;
      // Each fence segment is a single rigid flat plank, leveled only at
      // its center point — it doesn't bend to follow the road. At
      // FENCE_STEP=4 a segment spans ~25m, long enough to visibly chord
      // straight across curves (crossing diagonally over sharp bends) and
      // to drift off the true ground height on slopes (floating at one
      // end, buried at the other). FENCE_STEP=1 keeps each plank to a
      // single sample step (~avgSegStep, matching the road/terrain mesh's
      // own resolution) so it hugs the curve and terrain closely.
      const FENCE_STEP = 1; // sampled-point indices between fence segments

      // Skyscrapers are offset from a single road point (pt) along that
      // point's normal — safe on a straight stretch, but on a winding
      // mountain road the curve can loop back and pass much closer to
      // that same world-space offset elsewhere (hairpins, switchbacks).
      // A "safe" 34-78m offset measured from one point can land the
      // building right on top of a different stretch of road. Check
      // against the whole sampled curve (strided for speed — this runs
      // per-candidate during world gen) before committing to a spot.
      // Points along every tunnel zone (in world space, generous margin
      // past the bore's own half-width) — trees/rocks/buildings placed
      // inside a tunnel's footprint would clip straight through its walls
      // or root out of the flattened portal ground, so they're excluded
      // the same way regular road clearance is.
      const tunnelExclusionPoints = [];
      if (this.tunnelZones && this.tunnelZones.length && this.tunnelPoints) {
        for (const zone of this.tunnelZones) {
          for (let i = zone.start; i <= zone.end; i += 2) tunnelExclusionPoints.push(this.tunnelPoints[i]);
        }
      }
      const tunnelClearance = CONFIG.TUNNEL_HALF_WIDTH + 10.0;
      const tunnelClearanceSq = tunnelClearance * tunnelClearance;

      const clearsRoad = (pos, minClearance) => {
        const minClearanceSq = minClearance * minClearance;
        for (let s = 0; s < sampledPoints.length; s += 3) {
          const dx = pos.x - sampledPoints[s].x;
          const dz = pos.z - sampledPoints[s].z;
          if (dx * dx + dz * dz < minClearanceSq) return false;
        }
        for (const tp of tunnelExclusionPoints) {
          const dx = pos.x - tp.x;
          const dz = pos.z - tp.z;
          if (dx * dx + dz * dz < tunnelClearanceSq) return false;
        }
        return true;
      };

      // Trees are built during the main loop below but not added to the
      // scene immediately — see the deferred-resolution pass after the
      // loop for why (buildings placed later in the same iteration would
      // otherwise be invisible to the overlap check).
      const pendingTrees = [];
      // Same deferral, same reason, for fences — the house-checkpoint gap
      // below only opens a gap near delivery houses, but fences also
      // clipped through bus shelters/chai tapris/kirana stores/skyscrapers
      // (registered as 'building' obstacles at various points later in
      // the same iteration, or in different iterations entirely). Resolve
      // against the FULL obstacle list once everything is placed instead.
      const pendingFences = [];

      for (let i = 2; i < sampledPoints.length - 2; i++) {
        const pt = sampledPoints[i];
        const u = i / sampledPoints.length;
        const tangent = new THREE.Vector3().subVectors(sampledPoints[i + 1], sampledPoints[i - 1]).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        // Terrain height for prop placement. This was a hand-written copy of
        // the embankment formula that happened to match groundHeightAt
        // branch-for-branch — precisely the duplication that BUGFIX_LOG.md
        // calls the project's single most-repeated bug (Recurring Pattern 1:
        // copies drift apart the moment one side is tuned). Delegated to the
        // one shared function so props derive their height from the same
        // surface the terrain mesh and road verge use, by construction.
        const calcTerrainY = (pos, latDist) => this.groundHeightAt(pt, pos, latDist);

        // Inside a tunnel bore's footprint, skip roadside foliage/rock
        // placement entirely — clearsRoad() above already keeps the bigger
        // building-class props out, but trees are placed directly off
        // `pt`/`normal` without going through it, and would otherwise root
        // right through the tunnel's own walls.
        const inTunnel = tunnelExclusionPoints.length > 0 && tunnelExclusionPoints.some(tp => {
          const dx = pt.x - tp.x, dz = pt.z - tp.z;
          return dx * dx + dz * dz < tunnelClearanceSq;
        });

        // 1. Potholes & Rumble Strips on Road
        if (i % 26 === 0) {
          const potOffset = (this.prng.next() - 0.5) * (CONFIG.ROAD_WIDTH * 0.62);
          const potPos = pt.clone().addScaledVector(normal, potOffset);
          potPos.y += 0.17;
          // Every pothole used to share one fixed-size geometry — visually
          // identical and identical -14% damage regardless of how big the
          // hole actually looked. Scaling the shared unit geometry per
          // instance (cheap — no new geometry allocation) gives real size
          // variety, and both the hit radius and damage now scale with it
          // so a small crack barely matters while a real crater hurts.
          const potSize = this.prng.range(0.55, 2.0);
          const potMesh = new THREE.Mesh(potholeGeom, potholeMat);
          potMesh.position.copy(potPos);
          potMesh.scale.set(potSize, potSize, 1);
          this.foliageGroup.add(potMesh);
          this.potholes.push({ pos: potPos, radius: 1.6 * potSize, hitRecently: false, sizeFactor: potSize });
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

        // 1b. Pedestrians and stray dogs/cats crossing the road. Spawned
        // as a start/end pair straddling the road on this point's normal
        // so updateCrossers can walk them straight across; sparsity (the
        // prng roll) keeps crossings occasional rather than a wall of NPCs.
        // Skipped inside a tunnel bore entirely — no road-crossing NPCs,
        // no shoulder walkers, no guardrails in there (see below); a bored
        // tunnel is a straight, empty, lit corridor, not a village stretch.
        if (i % 33 === 0 && this.prng.next() > 0.45 && !inTunnel) {
          const kindRoll = this.prng.next();
          const kind = kindRoll < 0.55 ? 'pedestrian' : (kindRoll < 0.8 ? 'dog' : 'cat');
          const crossHalf = CONFIG.ROAD_WIDTH * 0.62 + 3.0;
          const side = this.prng.next() > 0.5 ? 1 : -1;
          const latStart = side * crossHalf;
          const latEnd = -side * crossHalf;
          const startPos = pt.clone().addScaledVector(normal, latStart);
          const endPos = pt.clone().addScaledVector(normal, latEnd);
          startPos.y = this.groundHeightAt(pt, startPos, latStart) + 0.15;
          endPos.y = this.groundHeightAt(pt, endPos, latEnd) + 0.15;

          const mesh = buildCrosserMesh(kind);
          const initialProgress = this.prng.next() * 0.3; // stagger so they don't all step off in lockstep
          const initialLat = THREE.MathUtils.lerp(latStart, latEnd, initialProgress);
          mesh.position.x = THREE.MathUtils.lerp(startPos.x, endPos.x, initialProgress);
          mesh.position.z = THREE.MathUtils.lerp(startPos.z, endPos.z, initialProgress);
          mesh.position.y = this.groundHeightAt(pt, mesh.position, initialLat) + 0.15;
          mesh.lookAt(endPos.x, mesh.position.y, endPos.z);
          this.foliageGroup.add(mesh);

          this.crossers.push({
            mesh,
            kind,
            start: startPos,
            end: endPos,
            // Fixed reference point + normal so updateCrossers can recompute
            // ground height at the crosser's *current* lateral position each
            // frame (via groundHeightAt) instead of linearly interpolating
            // between the start/end heights — a straight Y lerp cut through
            // the actual road surface mid-crossing wherever the road profile
            // between those two points isn't flat (banked/curved sections),
            // which is why crossers were sinking through the road.
            pt: pt.clone(),
            normal: normal.clone(),
            latStart,
            latEnd,
            progress: initialProgress,
            speed: mesh.userData.walkSpeed,
            hitRadius: mesh.userData.hitRadius,
            struck: false,
            legPhase: this.prng.next() * Math.PI * 2
          });
        }

        // Shoulder pedestrians who patrol UP AND DOWN the roadside instead
        // of crossing — reuses the exact same updateCrossers loop (it only
        // ever lerps mesh position between `start`/`end` and ping-pongs at
        // either end), just with both endpoints offset along the road
        // TANGENT at a fixed lateral distance instead of straddling the
        // road on the NORMAL. latStart === latEnd here on purpose: no
        // lateral movement, they stay on the shoulder the whole patrol.
        if (i % 47 === 0 && this.prng.next() > 0.5 && !inTunnel) {
          const walkSide = this.prng.next() > 0.5 ? 1 : -1;
          const walkLat = walkSide * (CONFIG.ROAD_WIDTH * 0.5 + 3.5 + this.prng.range(0, 3.0));
          const walkRange = this.prng.range(12.0, 24.0);

          const walkMesh = buildCrosserMesh('pedestrian');
          const startPos = pt.clone().addScaledVector(tangent, -walkRange).addScaledVector(normal, walkLat);
          const endPos = pt.clone().addScaledVector(tangent, walkRange).addScaledVector(normal, walkLat);
          startPos.y = this.groundHeightAt(pt, startPos, walkLat) + 0.15;
          endPos.y = this.groundHeightAt(pt, endPos, walkLat) + 0.15;

          const initialProgress = this.prng.next();
          walkMesh.position.lerpVectors(startPos, endPos, initialProgress);
          walkMesh.position.y = this.groundHeightAt(pt, walkMesh.position, walkLat) + 0.15;
          walkMesh.lookAt(endPos.x, walkMesh.position.y, endPos.z);
          this.foliageGroup.add(walkMesh);

          this.crossers.push({
            mesh: walkMesh,
            kind: 'pedestrian',
            start: startPos,
            end: endPos,
            pt: pt.clone(),
            normal: normal.clone(),
            latStart: walkLat,
            latEnd: walkLat,
            progress: initialProgress,
            speed: walkMesh.userData.walkSpeed * 0.75, // ambling shoulder pace, slower than a road-crossing dash
            hitRadius: walkMesh.userData.hitRadius,
            struck: false,
            legPhase: this.prng.next() * Math.PI * 2
          });
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
          // Per-instance material clone (not the shared `poleMat`) so the
          // camera occlusion fade can dim this one pole without dimming
          // every utility pole in the world at once.
          const poleInstMat = poleMat.clone();
          const pole = new THREE.Mesh(poleGeom, poleInstMat);
          pole.position.copy(polePos);
          pole.position.y += 3.2;

          const crossbar = new THREE.Mesh(crossbarGeom, poleInstMat);
          crossbar.position.set(0, 2.6, 0);
          pole.add(crossbar);
          this.foliageGroup.add(pole);
          this.obstacles.push({ pos: polePos.clone(), radius: 0.9, type: 'pole' });
          this.occluderMeshes.push(pole);
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
        if (i % 45 === 0 && i > 20) {
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
            new THREE.MeshStandardMaterial({ color: 0x1e3a5f, flatShading: true })
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
          garageGroup.lookAt(pt.x, bayPos.y, pt.z); // flatten: see BUGFIX_LOG.md lookAt-tilt pattern
          this.foliageGroup.add(garageGroup);

          this.repairBays.push({
            pos: bayPos.clone(),
            radius: 7.5,
            visitedRecently: false
          });
        }

        // 6. Dense Multi-Tiered Pine & Broadleaf Forests, Rocks, Fences & Lanterns (Left and Right)
        [-1, 1].forEach(side => {
          // Trees previously spawned unconditionally on every point/side —
          // a 100% spawn rate that buried the urban props (shops, houses,
          // skyscrapers) under a wall of forest, wrong for what's supposed
          // to read as an Indian city. Gate to ~45% so greenery still lines
          // the road without drowning out the buildings.
          const spawnTree = this.prng.next() > 0.55 && !inTunnel;

          // Minimum offset kept clear of the vehicle's own max lateral
          // drift (±9m from centerline, see lateralOffset clamp in
          // VehicleController) plus the tree canopy's ~2.4m radius —
          // otherwise trees spawn directly inside the player's drivable
          // area and the car ends up driving through them.
          const nearDist = CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(8.0, 18.0);
          const nearPos = pt.clone().addScaledVector(normal, side * nearDist);
          nearPos.y = calcTerrainY(nearPos, side * nearDist);

          if (spawnTree) {
          // Winter forces evergreen-only canopy — broadleaf trees would be
          // bare in winter, and we don't model leafless geometry, so we
          // simply keep the forest all-pine rather than showing full green
          // canopies that would look wrong for the season.
          const isPine = season.id === 'winter' ? true : (this.prng.next() > 0.35);
          const leafColHex = season.treeLeaves[Math.floor(this.prng.range(0, season.treeLeaves.length))];
          const leavesMat = new THREE.MeshStandardMaterial({ color: leafColHex });

          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(trunkGeom, trunkMat);
          trunk.position.y = 1.4;
          tree.add(trunk);

          if (isPine) {
            // Multi-Tiered Forest Pine Tree (3 stacked conical crowns)
            const tierMat1 = new THREE.MeshStandardMaterial({ color: leafColHex });
            const tierMat2 = new THREE.MeshStandardMaterial({ color: new THREE.Color(leafColHex).multiplyScalar(0.9) });
            const tierMat3 = new THREE.MeshStandardMaterial({ color: new THREE.Color(leafColHex).multiplyScalar(0.8) });

            const crown1 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 10), tierMat1);
            crown1.position.y = 2.4;
            const crown2 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.9, 10), tierMat2);
            crown2.position.y = 3.6;
            const crown3 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 10), tierMat3);
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
          // Deferred, not added directly: buildings (cabins in particular)
          // are placed later in this same loop iteration, so a tree built
          // and registered immediately here has no way to know about a
          // cabin that hasn't spawned yet — the two would silently overlap
          // (reported directly: a tree canopy clipping straight through a
          // delivery cabin's roof). Queue it and resolve overlaps in one
          // pass after every prop for the whole route has been placed.
          pendingTrees.push({ tree, pos: nearPos.clone(), radius: 1.3 * scale });
          } // end spawnTree

          // Background-fill trees: the near-road pass above only plants out
          // to ~22m (nearDist tops out at roadHalf+18), while skyscrapers
          // start no closer than 34m (bldgDist below) and only spawn on
          // ~1-in-7 sampled points at ~85% odds — leaving a consistently
          // bare 22-34m band, and further bare gaps between buildings
          // beyond that, on every route. That's what read as "sparse near
          // buildings/hills" — the background had nothing placed in it at
          // all, not just fewer props. Fills the 24-90m band (covering the
          // gap and scattering among/behind the buildings) at a modest,
          // gated density so it reads as populated hillside without
          // meaningfully changing prop-count-driven cost: 1-in-4 sampled
          // points per side, ~55% spawn odds — roughly a third of the
          // near-road tree density. Uses the same pendingTrees overlap
          // resolution as every other tree, so these never overlap
          // buildings/rocks/houses placed in the same pass.
          if (i % 4 === 0 && this.prng.next() > 0.45 && !inTunnel) {
            const bgDist = side * this.prng.range(24.0, 90.0);
            const bgPos = pt.clone().addScaledVector(normal, bgDist);
            bgPos.y = calcTerrainY(bgPos, bgDist);

            const bgIsPine = season.id === 'winter' ? true : (this.prng.next() > 0.35);
            const bgLeafHex = season.treeLeaves[Math.floor(this.prng.range(0, season.treeLeaves.length))];
            const bgLeavesMat = new THREE.MeshStandardMaterial({ color: bgLeafHex });
            const bgScale = this.prng.range(0.8, 1.5); // background trees can run larger — read fine from a distance, and vary the treeline silhouette
            const bgTree = new THREE.Group();
            const bgTrunk = new THREE.Mesh(trunkGeom, trunkMat);
            bgTrunk.position.y = 1.4;
            bgTree.add(bgTrunk);
            if (bgIsPine) {
              const bgTier1 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.4, 10), bgLeavesMat);
              bgTier1.position.y = 3.6;
              const bgTier2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.8, 10), bgLeavesMat);
              bgTier2.position.y = 5.6;
              const bgTier3 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2, 10), bgLeavesMat);
              bgTier3.position.y = 7.2;
              bgTree.add(bgTier1, bgTier2, bgTier3);
            } else {
              // Reuses the shared, already-smoothed decLeavesGeom instead of
              // allocating a fresh un-smoothed DodecahedronGeometry(2.4, 0)
              // per background tree — was silently bypassing the flat-
              // shading fix above for every one of these.
              const bgCanopy = new THREE.Mesh(decLeavesGeom, bgLeavesMat);
              bgCanopy.position.y = 4.6;
              bgTree.add(bgCanopy);
            }
            bgTree.scale.setScalar(bgScale);
            bgTree.position.copy(bgPos);
            pendingTrees.push({ tree: bgTree, pos: bgPos.clone(), radius: 1.3 * bgScale });
          }

          // City Skyline: procedural skyscrapers set well back beyond the
          // treeline so they read as a backdrop rather than roadside clutter.
          // Spaced out per side so towers don't visually collide with each
          // other at close draw distance.
          if (i % 7 === (side > 0 ? 0 : 3) && this.prng.next() > 0.15) {
            const bldgDist = side * this.prng.range(34.0, 78.0);
            const bldgPos = pt.clone().addScaledVector(normal, bldgDist);

            const width = this.prng.range(7.0, 13.0);
            const depth = this.prng.range(7.0, 13.0);

            // Skip this spawn if the curve loops back near this world-space
            // spot elsewhere (see clearsRoad above) — better to drop an
            // occasional skyscraper than plant one in the roadway.
            const footprintRadius = Math.max(width, depth) * 0.5;
            if (!clearsRoad(bldgPos, CONFIG.ROAD_WIDTH * 0.6 + footprintRadius + 4.0)) return;

            bldgPos.y = calcTerrainY(bldgPos, bldgDist);

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
              // Window glow only reads as lit windows once ambient light is
              // low enough to need it (dusk/night) — left on at a fixed
              // 0.85 intensity through daylight hours, every building in
              // the skyline blows out under bloom since a near-white
              // emissive surface always exceeds the bloom luminance
              // threshold regardless of how bright the sun already is.
              // Start dark; Game.applyWindowGlow (tied to time-of-day,
              // same as vehicle headlights) sets the real intensity.
              let mat;
              if (isGlass) {
                // Shiny reflective glass curtain-wall look: high shininess/
                // specular highlight, slight transparency, cool blue tint.
                mat = new THREE.MeshStandardMaterial({
                  color,
                  flatShading: true,
                  emissiveMap: tex,
                  emissive: 0xffffff,
                  emissiveIntensity: 0.0,
                  roughness: 0.15,
                  metalness: 0.6,
                  transparent: true,
                  opacity: 0.92
                });
              } else {
                mat = new THREE.MeshStandardMaterial({
                  color,
                  flatShading: true,
                  emissiveMap: tex,
                  emissive: 0xffffff,
                  emissiveIntensity: 0.0
                });
              }
              this.windowMaterials.push(mat);
              return mat;
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
            const capMat = new THREE.MeshStandardMaterial({ color: 0x6b7480, flatShading: true });
            const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 0.9, depth * 0.7), capMat);
            cap.position.y = height + 0.45;
            bldgGroup.add(cap);

            // Rooftop water tank (common Indian skyline silhouette), antenna, or bare.
            // Low-rise buildings get a water tank far more often — it's the
            // defining rooftop silhouette of Indian residential/shop blocks.
            const roofProp = this.prng.next();
            const tankThreshold = isLowRise ? 0.3 : 0.66;
            if (roofProp > tankThreshold) {
              const tankMat = new THREE.MeshStandardMaterial({ color: 0x3f6b8a, flatShading: true });
              const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 8), tankMat);
              tank.position.set(width * 0.25, height + 1.7, depth * 0.2);
              bldgGroup.add(tank);
            } else if (roofProp > 0.33) {
              const antennaMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, flatShading: true });
              const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6.0, 6), antennaMat);
              antenna.position.set(0, height + 3.4, 0);
              bldgGroup.add(antenna);
            }

            // Foundation slab: buildings sit at a single anchor point on
            // sloped hillside terrain, but the box geometry has a flat
            // bottom — on a slope that either buries the downhill corner
            // or leaves a visible gap under the uphill corner. A tall
            // foundation extending well underground fills that gap from
            // any slope angle without needing to sample the terrain footprint.
            const foundationMat = new THREE.MeshStandardMaterial({ color: 0x5f5348, flatShading: true });
            const foundation = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 60.0, depth * 0.96), foundationMat);
            foundation.position.y = -30.0;
            bldgGroup.add(foundation);

            bldgGroup.position.copy(bldgPos);
            bldgGroup.rotation.y = this.prng.range(-0.06, 0.06);
            this.foliageGroup.add(bldgGroup);

            // Register so later shops/trees (which do check this.obstacles)
            // don't get placed clipping into the skyscraper's footprint —
            // skyscrapers previously weren't registered at all.
            this.obstacles.push({ pos: bldgPos.clone(), radius: footprintRadius + 1.5, type: 'building' });

            // Registering only protects obstacles placed AFTER this point —
            // it does nothing for rocks/trees already placed at an EARLIER
            // sampled point that this skyscraper's own footprint (up to
            // ~10+ units) can still reach backward into, since bldgDist
            // ranges widely (34-78) and isn't tied to the same index a
            // nearby rock used. This is the delivery-house prune pattern
            // (see the `if (i % 24 === 0)` house block) applied to
            // skyscrapers too — measured via dev-checks.js
            // `rocks-clear-of-houses`: every city with a skyscraper
            // (`type==='building'`) failed this the same way, since only
            // delivery houses (also `type==='building'`, radius 3.5) were
            // ever pruned against, never the larger skyscraper footprints.
            const SKYSCRAPER_CLEARANCE = 2.0;
            const overlappingNearSkyscraper = this.obstacles.filter(o =>
              o !== this.obstacles[this.obstacles.length - 1] &&
              (o.type === 'rock' || o.type === 'tree') &&
              o.pos.distanceTo(bldgPos) < (o.radius + footprintRadius + 1.5 + SKYSCRAPER_CLEARANCE)
            );
            overlappingNearSkyscraper.forEach(o => { if (o.mesh) this.foliageGroup.remove(o.mesh); });
            if (overlappingNearSkyscraper.length) {
              this.obstacles = this.obstacles.filter(o => !overlappingNearSkyscraper.includes(o));
            }
          }

          // Roadside Split-Rail Wooden Fences — continuous guardrail along
          // both shoulders, broken only right where a delivery house sits
          // so the gap itself reads as "turn in here" (houses always spawn
          // at i % 24 === 0, alternating sides via i % 48 — see the cabin
          // block below).
          if (i % FENCE_STEP === 0 && !inTunnel) {
            const nearestHouseCheckpoint = Math.round(i / 24) * 24;
            const houseCheckpointSide = (nearestHouseCheckpoint % 48 === 0) ? 1 : -1;
            const distToHouse = Math.abs(i - nearestHouseCheckpoint) * avgSegStep;
            const FENCE_GAP_RADIUS = 18.0; // meters either side of a house's checkpoint
            const blockedByHouse = (side === houseCheckpointSide) && (distToHouse < FENCE_GAP_RADIUS);

            if (!blockedByHouse) {
              // createRoadMesh's paved shoulder verge extends to
              // ROAD_WIDTH*0.5 + 1.8 (its own shoulderWidth). This used to
              // sit at +1.4 — INSIDE that paved verge — so the fence's
              // height came from the terrain ribbon's shoulder formula
              // while the ground directly under it was actually a
              // different mesh (the road's own verge geometry, with its
              // own banking/offset math) that formula was never computing
              // for. The two didn't reliably agree, reading as posts
              // sinking into the pavement. Placed clear past the verge
              // edge instead, plus a small explicit lift, so the fence
              // only ever needs to agree with the terrain it's actually
              // planted in.
              const fenceDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 2.2);
              const fencePos = pt.clone().addScaledVector(normal, fenceDist);
              fencePos.y = calcTerrainY(fencePos, fenceDist) + 0.05;

              const railLen = FENCE_STEP * avgSegStep + 0.6; // slight overlap so segments tile without gaps
              const fenceGroup = new THREE.Group();
              const fPostMat = new THREE.MeshLambertMaterial({ color: 0x54361e });
              const fRailMat = new THREE.MeshLambertMaterial({ color: 0x6e472a });

              // 2 vertical posts
              [-railLen / 2, railLen / 2].forEach(px => {
                const fPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), fPostMat);
                fPost.position.set(px, 0.6, 0);
                fenceGroup.add(fPost);
              });
              // 2 horizontal split rails
              [0.45, 0.85].forEach(ry => {
                const fRail = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.08, 0.08), fRailMat);
                fRail.position.set(0, ry, 0);
                fenceGroup.add(fRail);
              });

              fenceGroup.position.copy(fencePos);
              // The rail spans the group's local X axis. lookAt(pos+tangent)
              // points local -Z at the tangent, which — by how Object3D's
              // lookAt derives its axes — puts local X along the road
              // NORMAL instead, sending the rail straight across the road.
              // Targeting along the normal instead puts local X along the
              // tangent, running the rail alongside the road as intended.
              fenceGroup.lookAt(fencePos.clone().add(normal));
              fenceGroup.userData.isFence = true;
              fenceGroup.userData.railLen = railLen;
              pendingFences.push({ fenceGroup, pos: fencePos.clone(), radius: railLen / 2 });
            }
          }

          // Indian Highway Milestone Markers (National Highway Standard: Yellow Dome + White Base)
          if (i % 32 === 0 && side === 1 && !inTunnel) {
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
            stoneGroup.lookAt(pt.x, stonePos.y, pt.z); // flatten: see BUGFIX_LOG.md lookAt-tilt pattern
            this.foliageGroup.add(stoneGroup);
          }

          // Modular Curved Highway Streetlamps (with amber night glow) —
          // skipped inside a tunnel bore, which supplies its own sodium
          // lamps and would otherwise have this poking through its wall.
          if (i % 28 === 0 && side === -1 && !inTunnel) {
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
            // Same lookAt-tilt bug as the delivery cabin (see BUGFIX_LOG.md
            // Recurring pattern list): lampPos and pt differ in Y on sloped
            // terrain, so an un-flattened lookAt() pitches/rolls the whole
            // lamp+boom+lantern assembly instead of only yawing it toward
            // the road. Flatten to the lamp's own height first.
            lampGroup.lookAt(pt.x, lampPos.y, pt.z);
            this.foliageGroup.add(lampGroup);
            this.obstacles.push({ pos: lampPos.clone(), radius: 0.8, type: 'pole' });
            this.occluderMeshes.push(lampGroup);
          }

          // Roadside Bus Shelter & Waiting Passengers
          if (i % 72 === 0 && side === 1) {
            const shelterDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 4.2);
            const shelterPos = pt.clone().addScaledVector(normal, shelterDist);

            // Skip if overlapping another obstacle or if too close to any road section (hairpins)
            if (!clearsRoad(shelterPos, CONFIG.ROAD_WIDTH * 0.5 + 3.0)) return;
            if (this.obstacles.some(o => o.pos.distanceTo(shelterPos) < (o.radius + 2.8))) return;

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
            shelterGroup.lookAt(pt.x, shelterPos.y, pt.z); // flatten: see BUGFIX_LOG.md lookAt-tilt pattern
            this.foliageGroup.add(shelterGroup);
            this.obstacles.push({ pos: shelterPos.clone(), radius: 2.8, type: 'building' });
          }

          // Roadside Dhaba / Chai Tapri with Customers drinking tea
          if (i % 34 === 0 && side === -1) {
            const tapriDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 4.6);
            const tapriPos = pt.clone().addScaledVector(normal, tapriDist);

            if (!clearsRoad(tapriPos, CONFIG.ROAD_WIDTH * 0.5 + 2.8)) return;
            if (this.obstacles.some(o => o.pos.distanceTo(tapriPos) < (o.radius + 2.6))) return;

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
            tapriGroup.lookAt(pt.x, tapriPos.y, pt.z); // flatten: see BUGFIX_LOG.md lookAt-tilt pattern
            this.foliageGroup.add(tapriGroup);
            this.obstacles.push({ pos: tapriPos.clone(), radius: 2.6, type: 'building' });
          }

          // Roadside Kirana General Store (shutter, signboard, crates)
          if (i % 38 === 0 && side === 1) {
            const kiranaDist = side * (CONFIG.ROAD_WIDTH * 0.5 + 4.8);
            const kiranaPos = pt.clone().addScaledVector(normal, kiranaDist);

            if (!clearsRoad(kiranaPos, CONFIG.ROAD_WIDTH * 0.5 + 2.6)) return;
            if (this.obstacles.some(o => o.pos.distanceTo(kiranaPos) < (o.radius + 2.4))) return;

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
            kiranaGroup.lookAt(pt.x, kiranaPos.y, pt.z); // flatten: see BUGFIX_LOG.md lookAt-tilt pattern
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

            if (!clearsRoad(monPos, CONFIG.ROAD_WIDTH * 0.5 + 4.5)) return;
            if (this.obstacles.some(o => o.pos.distanceTo(monPos) < (o.radius + 4.0))) return;

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
            monGroup.lookAt(pt.x, monPos.y, pt.z); // flatten: see BUGFIX_LOG.md lookAt-tilt pattern
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

          // Boulders & Rocks. Runs on every point (unlike most props, which
          // are gated to specific i%N checkpoints). We also check distance
          // against all delivery house checkpoints so rocks never spawn
          // anywhere near a house footprint or driveway.
          if (this.prng.next() > 0.65 && !inTunnel) {
            const nearestHouseCheckpoint = Math.round(i / 24) * 24;
            const distToHouse = Math.abs(i - nearestHouseCheckpoint) * avgSegStep;
            const ROCK_HOUSE_GAP = 14.0; // meters — house obstacle radius (3.5) plus porch & driveway clearance
            const nearHouseZone = distToHouse < ROCK_HOUSE_GAP;

            const rockDist = side * (CONFIG.ROAD_WIDTH * 0.5 + this.prng.range(2.0, 24.0));
            const rockPos = pt.clone().addScaledVector(normal, rockDist);
            const overlapsExisting = this.obstacles.some(o => o.pos.distanceTo(rockPos) < (o.radius + 1.6));

            if (!nearHouseZone && !overlapsExisting) {
              const groundY = calcTerrainY(rockPos, rockDist);
              const rock = new THREE.Mesh(rockGeom, rockMat);
              const rotX = this.prng.next() * 3, rotY = this.prng.next() * 3;
              rock.rotation.set(rotX, rotY, 0);
              // The rock geometry (DodecahedronGeometry) is a 12-sided
              // polyhedron, not a sphere — its true distance from center to
              // lowest point varies with rotation (anywhere from the
              // face-center inradius to the vertex circumradius, ~1.27 to
              // ~2.24 for radius 1.6). Randomly rotating every rock while
              // using one FIXED "+0.8" offset assumed a single, specific
              // orientation, so most rotations put the actual bottom
              // surface well above or below where +0.8 assumed it was —
              // visibly floating (or buried) rocks with no per-instance
              // pattern, matching the reported screenshots exactly.
              // Compute the true lowest point directly from the shared
              // geometry's 20 vertices (cheap — no extra Mesh/Box3 object
              // per rock, which would add up over ~450 rocks) rotated by
              // this instance's actual rotation, and offset by exactly
              // that so the rock always sits flush regardless of orientation.
              const rotMat = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotX, rotY, 0));
              const posAttr = rockGeom.attributes.position;
              let minY = Infinity;
              const v = new THREE.Vector3();
              for (let vi = 0; vi < posAttr.count; vi++) {
                v.set(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi)).applyMatrix4(rotMat);
                if (v.y < minY) minY = v.y;
              }
              rockPos.y = groundY - minY;
              rock.position.copy(rockPos);
              rock.userData.isRock = true;
              this.foliageGroup.add(rock);
              this.obstacles.push({ pos: rockPos.clone(), radius: 1.6, type: 'rock', mesh: rock });
            }
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

          // Prune any existing obstacles (e.g. rocks/trees spawned earlier in loop) that overlap the house footprint,
          // removing their actual 3D meshes from foliageGroup as well so no stray visual clutter remains.
          const HOUSE_CLEARANCE = 5.5;
          const overlappingObstacles = this.obstacles.filter(o => o.pos.distanceTo(housePos) < (o.radius + HOUSE_CLEARANCE));
          overlappingObstacles.forEach(o => {
            if (o.mesh) this.foliageGroup.remove(o.mesh);
          });
          this.obstacles = this.obstacles.filter(o => o.pos.distanceTo(housePos) >= (o.radius + HOUSE_CLEARANCE));

          // Dirt driveway strip connecting the road shoulder to the house —
          // previously houses just sat stranded off the road with nothing
          // linking them to it, which is part of why they read as floating/
          // dropped-in-place. A short straight ribbon along the same normal
          // used to offset the house (so it's guaranteed to end exactly at
          // the porch) sampled at several points so it follows the terrain
          // instead of being one rigid flat plank (see the fence-chording
          // bug fixed earlier for why that matters).
          {
            const driveWidth = 2.4;
            const startT = houseSide * (CONFIG.ROAD_WIDTH * 0.5 - 0.3); // slight overlap into the shoulder for a seamless join
            const segments = Math.max(3, Math.round(Math.abs(houseDist - startT) / 3.0));
            const driveDirt = new THREE.Color(0x9c7b52);
            const driveDirtLight = new THREE.Color(0xb2916a);
            const positions = [];
            const colors = [];
            const indices = [];
            for (let s = 0; s <= segments; s++) {
              const t = THREE.MathUtils.lerp(startT, houseDist, s / segments);
              const centerPos = pt.clone().addScaledVector(normal, t);
              centerPos.y = calcTerrainY(centerPos, t) + 0.06;
              const left = centerPos.clone().addScaledVector(tangent, -driveWidth / 2);
              const right = centerPos.clone().addScaledVector(tangent, driveWidth / 2);
              positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
              const c = driveDirt.clone().lerp(driveDirtLight, this.prng.next());
              colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
            }
            for (let s = 0; s < segments; s++) {
              const a = s * 2, b = a + 1, c = a + 2, d = a + 3;
              indices.push(a, b, c, b, d, c);
            }
            const driveGeom = new THREE.BufferGeometry();
            driveGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            driveGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            driveGeom.setIndex(indices);
            driveGeom.computeVertexNormals();
            const driveMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide });
            const driveMesh = new THREE.Mesh(driveGeom, driveMat);
            driveMesh.receiveShadow = true;
            driveMesh.userData.isDriveway = true;
            driveMesh.userData.housePos = housePos.clone();
            this.foliageGroup.add(driveMesh);
          }

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
          // lookAt() rotates on X/Z too whenever the target's Y differs from
          // housePos's Y (always true on sloped hillside terrain), tilting
          // the whole cabin's roof/walls off-vertical. Flatten the look
          // target to the cabin's own height so only yaw (facing the road)
          // is applied.
          cabinGroup.lookAt(pt.x, housePos.y, pt.z);
          cabinGroup.updateMatrixWorld(true);

          // Hit detection targets the porch ring's actual world position,
          // not the house pivot — the ring is offset from housePos and the
          // offset direction changes with each house's lookAt() rotation.
          const ringWorldPos = new THREE.Vector3();
          ring.getWorldPosition(ringWorldPos);

          this.foliageGroup.add(cabinGroup);
          this.deliveryTargets.push({
            order: order,
            pos: ringWorldPos,
            ring: ring,
            delivered: false,
            splineU: u,
            tossRadius: diffCfg.tossRadius
          });
        }
      }

      // Resolve tree/building overlaps now that every building (garages,
      // stalls, cabins, monuments, skyline) has been placed and registered
      // in this.obstacles — a tree queued anywhere in the loop above can
      // now see buildings regardless of which ran first for a given index.
      pendingTrees.forEach(({ tree, pos, radius }) => {
        const overlapsBuilding = this.obstacles.some(o =>
          o.type === 'building' && o.pos.distanceTo(pos) < (o.radius + radius + 1.0)
        );
        if (overlapsBuilding) return;
        // Same hairpin/switchback risk as skyscrapers, just at a shorter
        // offset — the curve can loop back near a tree's local placement.
        if (!clearsRoad(pos, CONFIG.ROAD_WIDTH * 0.55 + radius)) return;
        this.foliageGroup.add(tree);
        this.obstacles.push({ pos, radius, type: 'tree' });
      });

      // Resolve fence overlaps against the now-complete obstacle list
      // (buildings/shops/skyscrapers/rocks/trees). The house-checkpoint
      // gap above already opens a wide, intentional gap right at delivery
      // houses — this pass is a tight clearance check against everything
      // else, so fences stop clipping through bus shelters, chai tapris,
      // kirana stores, skyscrapers, and rocks without diluting the "gap
      // means delivery house" visual cue with gaps at every other prop.
      // Final rock/tree-vs-building overlap sweep. The per-placement-site
      // pruning above (skyscraper block, delivery-house block) only
      // removes obstacles placed BEFORE that building in loop order — a
      // rock and building can still both spawn on the same iteration's
      // OTHER `side` (side=-1 runs to completion, including its own
      // rocks, before side=1 even starts, so a side=1 skyscraper's prune
      // pass can miss a side=-1 rock at the same i if the specific
      // ordering/margin doesn't line up) or via some other ordering this
      // session didn't fully trace. Rather than keep chasing the exact
      // sequencing, sweep once, unconditionally, after every prop for the
      // whole route has been placed — this is correct regardless of
      // placement order, at the cost of one O(rocks x buildings) pass
      // (a few hundred x a few hundred, trivial at world-gen time).
      {
        const buildings = this.obstacles.filter(o => o.type === 'building');
        const stillOverlapping = this.obstacles.filter(o =>
          (o.type === 'rock' || o.type === 'tree') &&
          buildings.some(b => o.pos.distanceTo(b.pos) < (o.radius + b.radius))
        );
        stillOverlapping.forEach(o => { if (o.mesh) this.foliageGroup.remove(o.mesh); });
        if (stillOverlapping.length) {
          this.obstacles = this.obstacles.filter(o => !stillOverlapping.includes(o));
        }
      }

      pendingFences.forEach(({ fenceGroup, pos, radius }) => {
        const overlaps = this.obstacles.some(o => o.pos.distanceTo(pos) < (o.radius + radius));
        if (overlaps) return;
        this.foliageGroup.add(fenceGroup);
      });

      // Add Real-Time Road Traffic (Rickshaws, BEST Buses, Mini-Trucks, Kaali-Peeli Cabs)
      let trafficSpawnIndex = 0;
      for (let i = 8; i < sampledPoints.length - 8; i += 30) {
        const trafficGroup = new THREE.Group();
        const isBus = (i % 60 === 0);
        const isTruck = !isBus && (i % 90 === 0);

        if (isBus) {
          // BEST Red Double-Decker / Single Bus
          const busGeom = new THREE.BoxGeometry(2.4, 2.6, 6.5);
          const busMat = new THREE.MeshStandardMaterial({ color: 0xd90429, flatShading: true });
          const bus = new THREE.Mesh(busGeom, busMat);
          bus.position.y = 1.4;
          trafficGroup.add(bus);
        } else if (isTruck && IndianTruckAsset.template) {
          // Tata Ace-style Mini-Truck (teal-green/white livery)
          trafficGroup.add(IndianTruckAsset.clone());
        } else {
          // Bajaj Auto Rickshaw (Yellow & Green)
          const autoGeom = new THREE.BoxGeometry(1.4, 1.3, 2.4);
          const autoMat = new THREE.MeshStandardMaterial({ color: 0xfca311, flatShading: true });
          const autoBody = new THREE.Mesh(autoGeom, autoMat);
          autoBody.position.y = 0.8;
          trafficGroup.add(autoBody);
        }

        const u = i / sampledPoints.length;
        // Was `i % 2` — but i starts at 8 and steps by 30 (both even), so
        // i%2 was 0 on every single iteration; every "alternating" lane
        // assignment was actually always the same lane. Alternates on an
        // independent counter instead, which actually increments by 1
        // each spawn regardless of i's step size.
        const laneOffset = (trafficSpawnIndex % 2 === 0 ? 1.8 : -1.8);
        trafficSpawnIndex++;
        // Both lanes previously only ever incremented splineU forward —
        // laneOffset put them visually on either side of the centerline,
        // but every vehicle traveled the same direction along the route
        // regardless of lane, so there was never any oncoming traffic.
        // The opposite lane now travels splineU backward instead.
        const direction = laneOffset > 0 ? 1 : -1;
        this.trafficVehicles.push({
          mesh: trafficGroup,
          splineU: u,
          speed: 12.0 + (i % 5) * 2.0,
          laneOffset: laneOffset,
          direction: direction
        });

        this.foliageGroup.add(trafficGroup);
      }

      scene.add(this.foliageGroup);
    }

    updateTraffic(dt) {
      if (!this.curve) return;
      const totalLen = this.curve.getLength();

      this.trafficVehicles.forEach(tv => {
        const dir = tv.direction || 1;
        tv.splineU += (dir * tv.speed * dt) / totalLen;
        if (tv.splineU >= 0.98) tv.splineU = 0.02;
        if (tv.splineU <= 0.02) tv.splineU = 0.98;

        const pt = this.curve.getPointAt(tv.splineU);
        const tangent = this.curve.getTangentAt(tv.splineU).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const pos = pt.clone().addScaledVector(normal, tv.laneOffset);
        pos.y = this.groundHeightAt(pt, pos, tv.laneOffset) + 0.15;
        tv.mesh.position.copy(pos);
        const fwdHeading = tangent.clone().multiplyScalar(dir);
        tv.mesh.lookAt(pos.clone().add(fwdHeading));
      });
    }

    // How far off the road centerline the vehicle may legally drift at
    // this point on the route, on the given side (+1/-1, matching the
    // same normal-direction convention `side` uses during fence
    // placement in createFoliageAndProps). Mirrors that exact placement
    // logic — same i%24/i%48 house-checkpoint math, same FENCE_GAP_RADIUS
    // — so the clamp only opens where a fence gap actually was left open,
    // and stays tight to the fence line everywhere else. The fences exist
    // specifically to mark "you can't get through here except at a
    // delivery house," so the vehicle needs to actually be stopped by
    // them, not just visually pass through.
    getLateralClamp(splineProgress, side) {
      const TOTAL_POINTS = 800; // matches createFoliageAndProps' getSpacedPoints(800)
      const i = Math.round(splineProgress * TOTAL_POINTS);
      const avgSegStep = this.curve.getLength() / TOTAL_POINTS;
      const nearestHouseCheckpoint = Math.round(i / 24) * 24;
      const houseCheckpointSide = (nearestHouseCheckpoint % 48 === 0) ? 1 : -1;
      const distToHouse = Math.abs(i - nearestHouseCheckpoint) * avgSegStep;
      const FENCE_GAP_RADIUS = 18.0;
      const hasGap = (side === houseCheckpointSide) && (distToHouse < FENCE_GAP_RADIUS);
      if (hasGap) return 9.0; // full shoulder range through the open gate to the house
      const FENCE_LATERAL_DIST = CONFIG.ROAD_WIDTH * 0.5 + 2.2; // matches the fence's own placement distance
      return FENCE_LATERAL_DIST - 0.4; // small margin so the car stops short of the posts, not visually inside them
    }

    updateCrossers(dt) {
      for (let i = this.crossers.length - 1; i >= 0; i--) {
        const c = this.crossers[i];
        if (c.struck) continue; // frozen at impact position until cleanup below

        c.progress += (c.speed * dt) / c.start.distanceTo(c.end);
        if (c.progress >= 1.0) {
          // Reached the far side — walk back the other way so the same
          // crosser keeps patrolling instead of despawning mid-street.
          c.progress = 0;
          const tmp = c.start;
          c.start = c.end;
          c.end = tmp;
          const tmpLat = c.latStart;
          c.latStart = c.latEnd;
          c.latEnd = tmpLat;
          c.mesh.lookAt(c.end);
        }

        // X/Z still lerp in a straight line (fine — that's genuinely
        // straight in world space), but Y is recomputed from the current
        // lateral offset via the shared ground formula rather than lerped
        // between the two endpoint heights, which cut through the road
        // surface whenever the true profile between them isn't flat.
        const curLat = THREE.MathUtils.lerp(c.latStart, c.latEnd, c.progress);
        c.mesh.position.x = THREE.MathUtils.lerp(c.start.x, c.end.x, c.progress);
        c.mesh.position.z = THREE.MathUtils.lerp(c.start.z, c.end.z, c.progress);
        c.mesh.position.y = this.groundHeightAt(c.pt, c.mesh.position, curLat) + 0.15;
        c.legPhase += dt * 9.0;
        const swing = Math.sin(c.legPhase) * 0.35;
        if (c.mesh.userData.legs) {
          c.mesh.userData.legs.forEach((leg, idx) => {
            leg.rotation.x = (idx % 2 === 0 ? swing : -swing);
          });
        }
      }
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
      this.steerAngle = 0; // now purely cosmetic (wheel turn + body roll), not orientation
      // Free position + heading movement (replaces the old rail model of
      // splineProgress-drives-position + lateralOffset-drives-sideways-
      // drift). `heading` is the car's true world-space yaw — the vehicle
      // can now actually turn, reverse, and maneuver off the road, not
      // just drift sideways within a lane band. splineProgress is kept,
      // but is now a DERIVED value (nearest point on the road curve to the
      // car's actual free position, refreshed each frame by projectToRoad)
      // rather than the thing driving position — every external system
      // that reads it (camera, GPS, autopilot, fence clamp, off-road-lost
      // detection) still gets a meaningful road-relative value.
      this.heading = 0;
      this.lateralOffset = 0; // still maintained (derived) for banking/ground-height/fence-clamp math
      this.lateralVelocity = 0; // unused by movement now; kept only so any external reset code touching it doesn't throw
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

      if (this.vehicleType === 'swift' && SwiftCarAsset.template) {
        // ====================================================================
        // 1. MARUTI SUZUKI SWIFT / TATA NEXON SPORTS HATCHBACK (sculpted mesh)
        // ====================================================================
        const carModel = SwiftCarAsset.clone();
        this.mesh.add(carModel);
        carModel.traverse((child) => {
          if (child.isMesh && child.name && child.name.startsWith('wheel')) {
            this.wheels.push(child);
          }
        });

        // Signature accent details carried over from the original design
        const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xef233c });
        const trimMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
        const headGeom = new THREE.BoxGeometry(0.4, 0.1, 0.06);
        const tailGeom = new THREE.BoxGeometry(0.4, 0.12, 0.06);
        const mirrorGeom = new THREE.BoxGeometry(0.18, 0.1, 0.12);

        [[-0.42, 0.5, 1.3], [0.42, 0.5, 1.3]].forEach((p) => {
          const h = new THREE.Mesh(headGeom, headMat);
          h.position.set(...p);
          this.mesh.add(h);
        });
        [[-0.45, 0.58, -1.3], [0.45, 0.58, -1.3]].forEach((p) => {
          const t = new THREE.Mesh(tailGeom, tailMat);
          t.position.set(...p);
          this.mesh.add(t);
        });
        [[-0.72, 0.7, 0.35], [0.72, 0.7, 0.35]].forEach((p) => {
          const m = new THREE.Mesh(mirrorGeom, trimMat);
          m.position.set(...p);
          this.mesh.add(m);
        });

      } else if (this.vehicleType === 'swift') {
        // ====================================================================
        // 1. MARUTI SUZUKI SWIFT / TATA NEXON SPORTS HATCHBACK (procedural fallback,
        // used only until SwiftCarAsset finishes loading, then auto-rebuilt)
        // ====================================================================
        if (SwiftCarAsset.pendingControllers.indexOf(this) === -1) {
          SwiftCarAsset.pendingControllers.push(this);
        }
        // Sporty Dual-Tone Red Body with Floating Black Roof & Honeycomb Grille
        const bodyGeom = new THREE.BoxGeometry(1.85, 0.62, 3.8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd90429, flatShading: true }); // Fiery Red
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 0.58;
        body.castShadow = true;

        // Aerodynamic Hood Slope
        const hoodGeom = new THREE.BoxGeometry(1.75, 0.3, 1.1);
        const hood = new THREE.Mesh(hoodGeom, bodyMat);
        hood.position.set(0, 0.72, 1.15);

        // Floating Gloss-Black Glass Cabin
        const cabinGeom = new THREE.BoxGeometry(1.55, 0.58, 2.0);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111827, flatShading: true });
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

      } else if (this.vehicleType === 'chotahathi' && ChotaHathiAsset.template) {
        // ====================================================================
        // 2. TATA ACE "CHHOTA HATHI" MINI TRUCK (sculpted open-bed pickup mesh)
        // ====================================================================
        const truckModel = ChotaHathiAsset.clone();
        this.mesh.add(truckModel);
        truckModel.traverse((child) => {
          if (child.isMesh && child.name && child.name.startsWith('wheel')) {
            this.wheels.push(child);
          }
        });

        // Front Windshield
        const glassGeom = new THREE.BoxGeometry(1.4, 0.5, 0.06);
        const glassMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        const windshield = new THREE.Mesh(glassGeom, glassMat);
        windshield.position.set(0, 1.05, 1.3);
        this.mesh.add(windshield);

        // Heavy-duty Black Front Bumper & Dual Headlights
        // (offset clear of the mesh's front bbox face at z=1.475 to avoid z-fighting/burial)
        const bumperGeom = new THREE.BoxGeometry(1.55, 0.24, 0.16);
        const bumperMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
        const bumper = new THREE.Mesh(bumperGeom, bumperMat);
        bumper.position.set(0, 0.35, 1.55);
        this.mesh.add(bumper);

        const headGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12);
        headGeom.rotateX(Math.PI / 2);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
        [[-0.5, 0.55, 1.55], [0.5, 0.55, 1.55]].forEach((p) => {
          const h = new THREE.Mesh(headGeom, headMat);
          h.position.set(...p);
          this.mesh.add(h);
        });

        // Stacked Courier Cargo Sacks & Crates in the open bed
        const crate1Geom = new THREE.BoxGeometry(1.15, 0.4, 0.75);
        const crate1Mat = new THREE.MeshLambertMaterial({ color: 0xd4a373 }); // Wooden box
        const crate1 = new THREE.Mesh(crate1Geom, crate1Mat);
        crate1.position.set(0, 0.85, -0.55);
        this.mesh.add(crate1);

        const crate2Geom = new THREE.BoxGeometry(0.9, 0.32, 0.6);
        const crate2Mat = new THREE.MeshLambertMaterial({ color: 0xff9f1c }); // Saffron box
        const crate2 = new THREE.Mesh(crate2Geom, crate2Mat);
        crate2.position.set(0, 1.15, -0.55);
        this.mesh.add(crate2);

        // Rear "HORN OK PLEASE" Painted Bumper Board
        // (offset clear of the mesh's rear bbox face at z=-1.475 to avoid z-fighting/burial)
        const flapGeom = new THREE.BoxGeometry(1.5, 0.2, 0.06);
        const flapMat = new THREE.MeshLambertMaterial({ color: 0xfca311 });
        const flap = new THREE.Mesh(flapGeom, flapMat);
        flap.position.set(0, 0.3, -1.55);
        this.mesh.add(flap);

        // Dual Circular Red Taillights
        const tailGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12);
        tailGeom.rotateX(Math.PI / 2);
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xef233c });
        [[-0.55, 0.5, -1.55], [0.55, 0.5, -1.55]].forEach((p) => {
          const t = new THREE.Mesh(tailGeom, tailMat);
          t.position.set(...p);
          this.mesh.add(t);
        });

      } else if (this.vehicleType === 'chotahathi') {
        // ====================================================================
        // 2. TATA ACE "CHHOTA HATHI" MINI TRUCK (procedural fallback, used only
        // until ChotaHathiAsset finishes loading, then auto-rebuilt)
        // ====================================================================
        if (ChotaHathiAsset.pendingControllers.indexOf(this) === -1) {
          ChotaHathiAsset.pendingControllers.push(this);
        }
        // Front White/Yellow Driver Cabin
        const cabGeom = new THREE.BoxGeometry(1.65, 1.25, 1.2);
        const cabMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, flatShading: true });
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
        const bedMat = new THREE.MeshStandardMaterial({ color: 0x059669, flatShading: true }); // Indian Cargo Green
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
        // (offset clear of the bed's rear face at z=-1.85 to avoid z-fighting)
        const flapGeom = new THREE.BoxGeometry(1.68, 0.22, 0.06);
        const flapMat = new THREE.MeshLambertMaterial({ color: 0xfca311 });
        const flap = new THREE.Mesh(flapGeom, flapMat);
        flap.position.set(0, 0.35, -1.91);

        // Dual Circular Red Taillights
        const tailGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12);
        tailGeom.rotateX(Math.PI / 2);
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xef233c });
        const leftTail = new THREE.Mesh(tailGeom, tailMat);
        leftTail.position.set(-0.6, 0.58, -1.93);
        const rightTail = new THREE.Mesh(tailGeom, tailMat);
        rightTail.position.set(0.6, 0.58, -1.93);

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
        const apronMat = new THREE.MeshStandardMaterial({ color: 0x10b981, flatShading: true }); // Neon Mint Electric
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
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, flatShading: true });
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

    // Finds the nearest point on the road curve to `pos`, seeded from the
    // last known splineProgress so this is a cheap local search (a window
    // around where the car already was) rather than a full scan every
    // frame — except when the car has moved far off-route (parked off-
    // road, or just spawned), where it widens to a full scan so it can
    // never get stuck locked onto a wrong, distant segment. This is what
    // lets every road-relative system (ground height/banking via
    // World.groundHeightAt, the fence lateral clamp, GPS nearest-target
    // math) keep working correctly now that position is free instead of
    // driven directly by splineProgress.
    projectToRoad(pos, curve, seedU) {
      const totalLen = curve.getLength();
      const search = (uMin, uMax, steps) => {
        let bestU = seedU, bestDistSq = Infinity;
        for (let k = 0; k <= steps; k++) {
          const u = THREE.MathUtils.clamp(uMin + (uMax - uMin) * (k / steps), 0, 1);
          const d = pos.distanceToSquared(curve.getPointAt(u));
          if (d < bestDistSq) { bestDistSq = d; bestU = u; }
        }
        return { bestU, bestDistSq };
      };

      // Local window first: ±40m of road length around the last position.
      const windowU = Math.min(0.06, 40 / totalLen);
      let { bestU, bestDistSq } = search(seedU - windowU, seedU + windowU, 24);

      // If nothing in the local window is remotely close (car drove far
      // off-road, or this is the very first frame), fall back to a full
      // coarse scan of the whole route.
      if (Math.sqrt(bestDistSq) > 55) {
        ({ bestU, bestDistSq } = search(0, 1, 200));
      }

      // The coarse 24-step scan only resolves u to ~1/12th of an 80m
      // window (~3m of road length per step). Ground height is sampled
      // straight off pt.y at whatever u this function returns, and pt.y
      // changes with u on any graded slope — so without refinement, the
      // car's height snaps between coarse samples as it moves rather than
      // varying continuously, which reads as visible up-down bouncing even
      // on a perfectly smooth road surface. Narrow in on the true nearest
      // point with a few rounds of shrinking local search around bestU.
      let refineWindow = (windowU * 2) / 24;
      for (let pass = 0; pass < 4; pass++) {
        ({ bestU, bestDistSq } = search(bestU - refineWindow, bestU + refineWindow, 10));
        refineWindow *= 0.3;
      }

      const u = bestU;
      const pt = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      const latDist = pos.clone().sub(pt).dot(normal);
      return { u, pt, tangent, normal, latDist, distFromRoad: Math.sqrt(bestDistSq) };
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
        // Curve-adaptive pure pursuit autopilot: look ahead by a dynamic distance
        // scaled with forward speed (~12m at low speed, ~35m at top speed), avoiding
        // jumping across hairpin loops. We also slow down on tight curves to prevent
        // understeering or spinning into the guardrails.
        const curveLength = world.curve.getLength() || 5000;
        const lookaheadMeters = THREE.MathUtils.clamp(10.0 + this.speed * 0.7, 8.0, 36.0);
        const lookaheadU = THREE.MathUtils.clamp(this.splineProgress + (lookaheadMeters / curveLength), 0, 0.999);
        const lookaheadPt = world.curve.getPointAt(lookaheadU);
        const toTarget = lookaheadPt.clone().sub(this.mesh.position);
        toTarget.y = 0;

        let turnDeflection = 0;
        if (toTarget.lengthSq() > 0.01) {
          const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
          let headingDiff = desiredHeading - this.heading;
          headingDiff = Math.atan2(Math.sin(headingDiff), Math.cos(headingDiff)); // wrap to [-pi, pi]
          turnDeflection = Math.abs(headingDiff);

          // Speed-scaled turn rate: allow sharper turn rate at moderate/low speed, stable at high speed
          const autopilotTurnRate = 2.4 * climateGrip;
          const turnStep = THREE.MathUtils.clamp(headingDiff, -autopilotTurnRate * dt, autopilotTurnRate * dt);
          this.heading += turnStep;

          // Steer angle follows commanded turning rate for realistic wheel angle & dynamics
          const targetSteerAngle = THREE.MathUtils.clamp(headingDiff * 0.8, -0.42, 0.42);
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteerAngle, 0.22);
        } else {
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, 0, 0.16);
        }

        // Curve-adaptive speed limit: slow down automatically when entering sharp turns
        const cornerSpeedFactor = THREE.MathUtils.clamp(1.0 - (turnDeflection / Math.PI) * 1.5, 0.35, 1.0);
        const autoTargetSpeed = effectiveMaxSpeed * 0.72 * cornerSpeedFactor;

        if (this.speed < autoTargetSpeed) {
          this.speed += this.accel * dt;
        } else if (this.speed > autoTargetSpeed + 1.0) {
          this.speed -= this.brake * dt * 0.7;
        }
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

        // 2. FREE STEERING — turns the car's actual heading, not a lateral
        // lane-offset. Turn rate scales with speed (can't spin in place at
        // a dead stop, but still gets enough at a crawl for tight parking
        // maneuvers) and flips direction in reverse, matching how a real
        // car's steering behaves backing up.
        const baseTurnRate = 1.55; // rad/s at full effect
        const turnRateLimit = baseTurnRate * (isDrifting ? 1.4 : 1.0) * climateGrip;
        const speedScale = THREE.MathUtils.clamp(Math.abs(this.speed) / 6.0, 0.22, 1.0);
        const reverseFlip = this.speed < -0.05 ? -1 : 1;
        const turnRate = turnRateLimit * speedScale * reverseFlip;

        const steerResponse = isDrifting ? 0.24 : 0.18;
        const steerLimit = (isDrifting ? 0.65 : 0.42) * climateGrip;
        if (keys.left || keys.a) {
          this.heading += turnRate * dt;
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, steerLimit, steerResponse);
        } else if (keys.right || keys.d) {
          this.heading -= turnRate * dt;
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, -steerLimit, steerResponse);
        } else {
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, 0, 0.14);
        }
      }

      // 3. Move freely along the car's own heading (position + orientation
      // are now true, independent state — not derived from a spline
      // parameter — so the car can actually turn, reverse, and maneuver
      // off the road instead of only drifting sideways within a lane).
      const moveDist = this.speed * dt;
      this.distanceTraveled += Math.abs(moveDist) * 0.001;
      const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      const proposedPos = this.mesh.position.clone().addScaledVector(forward, moveDist);

      // Everything below (ground height, banking, the fence lateral clamp)
      // is inherently road-relative, so project the free position onto the
      // nearest point on the road curve — same technique the on-foot
      // walker's height uses, reusing World.groundHeightAt rather than a
      // second hand-rolled formula (see BUGFIX_LOG.md Recurring Pattern 1).
      const proj = this.projectToRoad(proposedPos, world.curve, this.splineProgress);
      this.splineProgress = proj.u;

      // Fences are a real physical barrier now that movement is free, not
      // just a soft cap on an accumulating offset — clip the proposed
      // position back to the clamp boundary along the road normal instead
      // of just preventing the offset from growing.
      //
      // Bug fixed here: clamping used to snap straight to
      // `proj.pt + normal*clampDist`, discarding the FORWARD (along-road)
      // component of the move entirely. If the car's heading pointed
      // mostly sideways into the fence (e.g. autopilot correcting hard, or
      // just cornering tight against the shoulder), every frame reset to
      // nearly the same clamped spot with ~0 net forward progress despite
      // nonzero speed — the car froze dead in place, permanently pinned,
      // heading and speed never recovering since projectToRoad's nearest-
      // point search was seeded from that same frozen position each frame
      // (a stable feedback loop, not just a slow crawl). Verified this
      // exact freeze happening under sustained autopilot steering.
      // Fix: decompose the proposed move into along-road (tangent) and
      // lateral (normal) components relative to the nearest point, and
      // only clamp the lateral one — the car now slides along the fence
      // like a real wall instead of stopping dead against it.
      const side = proj.latDist >= 0 ? 1 : -1;
      const clampDist = world.getLateralClamp ? world.getLateralClamp(proj.u, side) : 9.0;
      let vehiclePos = proposedPos;
      let latDist = proj.latDist;
      if (Math.abs(latDist) > clampDist) {
        const toProposed = proposedPos.clone().sub(proj.pt);
        const fwdComponent = toProposed.dot(proj.tangent);
        latDist = clampDist * side;
        vehiclePos = proj.pt.clone().addScaledVector(proj.tangent, fwdComponent).addScaledVector(proj.normal, latDist);
        // Re-project after clamping so pt/tangent/normal reflect the
        // actual (clamped) resting position, not the pre-clamp attempt.
        const reproj = this.projectToRoad(vehiclePos, world.curve, proj.u);
        Object.assign(proj, reproj);
        this.splineProgress = proj.u;
      }
      this.lateralOffset = latDist; // kept for the stuck-detection check in Game.animate() and any other reader

      const tangent = proj.tangent;
      const roadRight = proj.normal;

      // Follow the actual carved road/shoulder surface, not the spline
      // centerline height — lateralOffset can reach ±9m (the shoulder
      // boundary), and the terrain there sits lower than the road center
      // (see createTerrainMesh's roadHalf/shoulder formula). Using
      // currentPos.y unconditionally let the car clip into or float above
      // the ground the moment it drifted off-center.
      const groundY = world.groundHeightAt(proj.pt, vehiclePos, latDist);

      // createRoadMesh banks the road surface on curves (tilts it up to
      // ±0.14rad), but this only ever used the flat, unbanked centerline
      // height above — fine dead-center, but at any real lateral offset on
      // a sharp bend the true (banked) surface can be well over a meter
      // higher or lower than that, reading as the car sinking into or
      // floating above the road on turns.
      //
      // This used to replicate the banking calc via curve.getTangentAt(),
      // which LOOKS like the same idea as createRoadMesh's per-vertex
      // curvature but is a structurally different tangent estimate — the
      // curve's own parametric derivative vs. finite differences between
      // points on the actual rendered points array. They silently diverge:
      // measured a full clamp-width gap (-0.14 vs the mesh's true -0.1137
      // rad) on an ordinary curve, big enough by itself to sink the car
      // visibly at any real lateral offset. Compute banking from the exact
      // same array createRoadMesh built (world.roadSpacedPoints, cached
      // there) at the matching row index instead — same construction, not
      // just the same formula (see BUGFIX_LOG.md Pattern 1/B17: calling an
      // equivalent formula is not sufficient, the inputs must match too).
      const bankPts = world.roadSpacedPoints;
      let bankingAngle = 0, bankTangent = tangent;
      if (bankPts && bankPts.length > 2) {
        const segs = bankPts.length - 1;
        // Interpolate between the two bracketing rows instead of rounding
        // to the nearest one — on sharp curves (e.g. Kolkata) a single
        // ~4m-wide row (1/1200 of the road) is coarse enough that a whole
        // extra quantization step of banking angle showed up as ~0.35u of
        // residual sink, the same stair-step class of error the
        // projectToRoad refinement fixed earlier in this file.
        const rawIdx = THREE.MathUtils.clamp(proj.u * segs, 1, segs - 2);
        const i0 = Math.floor(rawIdx), i1 = Math.min(i0 + 1, segs - 2);
        const frac = rawIdx - i0;
        const bankingAt = (i) => {
          const tan = new THREE.Vector3().subVectors(bankPts[i + 1], bankPts[i - 1]).normalize();
          const nextTang = new THREE.Vector3().subVectors(bankPts[i + 2], bankPts[i]).normalize();
          const curvatureY = (nextTang.x - tan.x) * 10.0;
          return { angle: THREE.MathUtils.clamp(curvatureY * 0.25, -0.14, 0.14), tan };
        };
        const b0 = bankingAt(i0), b1 = bankingAt(i1);
        bankingAngle = THREE.MathUtils.lerp(b0.angle, b1.angle, frac);
        bankTangent = b0.tan.clone().lerp(b1.tan, frac).normalize();
      }
      const binormal = new THREE.Vector3().crossVectors(roadRight, bankTangent).normalize();
      // roadRight (createRoadMesh's "normal") is always horizontal by
      // construction, so only binormal's tilt contributes vertically here.
      const bankedYOffset = latDist * binormal.y * Math.sin(bankingAngle);

      vehiclePos.y = groundY + bankedYOffset + 0.25;

      // Surface elevation bump on gravel / mud
      if (roadTerrainKey === 'gravel' || roadTerrainKey === 'mud') {
        const bump = Math.sin(Date.now() * 0.035 * (this.speed / 10)) * 0.04;
        vehiclePos.y += bump;
      }

      this.mesh.position.copy(vehiclePos);

      // 4. Chassis orientation now comes directly from `heading` (the
      // car's own true state) instead of being derived from the road
      // tangent via lookAt — this is precisely what lets it point anywhere,
      // not just along the curve.
      this.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);

      // Dynamic Chassis Pitch (dive on braking, squat on acceleration)
      const accelRatio = (this.speed - (this.lastSpeed || this.speed)) / Math.max(0.01, dt);
      this.lastSpeed = this.speed;
      const targetPitch = THREE.MathUtils.clamp(-accelRatio * 0.004, -0.06, 0.06);
      this.mesh.rotateX(targetPitch);

      // Dynamic Chassis Roll (centrifugal roll against turn + bank) — now
      // purely cosmetic since steerAngle no longer drives orientation.
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

              // Two-wheelers have no suspension/cage to absorb a pothole at
              // speed — a fast hit throws the rider off outright instead of
              // just chipping health like a car's shock absorbers would.
              // Bigger holes are more dangerous both ways: they knock a
              // two-wheeler off at a lower speed, and they chip more
              // health off a car. sizeFactor spans ~0.55-2.0.
              const sizeFactor = p.sizeFactor || 1.0;
              const isTwoWheeler = this.vehicleType === 'scooter' || this.vehicleType === 'cycle';
              const baseSpillThreshold = this.vehicleType === 'scooter' ? 14.0 : 10.0; // m/s
              const spillSpeedThreshold = baseSpillThreshold / Math.max(0.6, sizeFactor);
              const isSpill = isTwoWheeler && Math.abs(this.speed) > spillSpeedThreshold;
              const damage = Math.round(14 * sizeFactor);

              if (isSpill) {
                this.health = 0;
                this.speed = 0;
                if (window.game) window.game.crashReason = `${this.vehicleType === 'scooter' ? 'SCOOTER' : 'BICYCLE'} SPILL: Thrown off at speed hitting a pothole`;
              } else {
                this.health = Math.max(0, this.health - damage);
              }
              sound.playPothole();

              const app = document.getElementById('game-app');
              if (app) {
                app.classList.add('screen-shake');
                setTimeout(() => app.classList.remove('screen-shake'), 350);
              }
              if (window.game) {
                window.game.spawnPotholeSplash(carPos, Math.round(16 * sizeFactor));
                window.game.addNotification(
                  isSpill ? '💥 THROWN OFF! Pothole ended your run' : `⚠️ POTHOLE HIT! Health -${damage}%`,
                  isSpill ? 'danger' : 'warning',
                  3500
                );
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

    resetToSpline(curve, startU = 0.008, preserveSpeed = false) {
      const prevSpeed = this.speed;
      this.splineProgress = (startU !== undefined && startU !== null) ? startU : 0.008;
      this.lateralOffset = 0;
      this.lateralVelocity = 0;
      const pt = curve.getPointAt(this.splineProgress);
      const tangent = curve.getTangentAt(this.splineProgress).normalize();
      this.mesh.position.copy(pt);
      // Matches the on-road branch of the ground-following formula in
      // update() (pt.y - 0.18 + 0.25) — using the old flat +0.25 here made
      // the car visibly pop up 0.18m on every crash/checkpoint reset.
      this.mesh.position.y += 0.07;
      // Orientation now comes from `heading` (see update()'s free-movement
      // rewrite), not mesh.lookAt — set it to match the tangent so a reset
      // still faces down the road.
      this.heading = Math.atan2(tangent.x, tangent.z);
      this.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
      this.speed = preserveSpeed ? prevSpeed : 0;
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
      this.heading = Math.atan2(tangent.x, tangent.z);
      this.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
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
  // 6B. RAIN — a bounded particle volume that rides with the camera
  // --------------------------------------------------------------------------
  // Modeled on slowroads.io's snow system (see SLOWROADS_PARITY_LOG.md
  // section 1.4, derived from a live capture + confirming no snowflake
  // texture asset exists there — it's plain geometry, not a sprite sheet):
  // a 3D volume of particles centered on the camera, evenly distributed
  // through depth, each respawning at the top when it falls out the
  // bottom (or drifts out of the box) rather than a 2D screen-space
  // overlay. Slowroads has no rain to copy directly (confirmed: Overcast
  // + any non-winter season produces zero precipitation there) — this is
  // a new system using the same *technique*, tuned per the user's ask:
  // faster fall speed and higher density than snow, and streak-shaped
  // rather than round (a streak needs real velocity to read as rain
  // instead of snow — that's the actual visual difference between the
  // two, not just speed).
  //
  // Real 3D thin boxes via InstancedMesh (not THREE.Points) so each
  // streak reads as an actual line from any camera angle without a
  // custom shader — Points sprites are screen-facing quads and would
  // need GPU-side stretching along velocity to look like rain at all.
  class RainSystem {
    constructor(scene) {
      this.scene = scene;
      this.count = 700; // denser than a typical snow system, per the user's explicit ask
      this.fallSpeed = 26.0; // m/s — real rain terminal velocity range; snow in the reference capture read as ~1-2 m/s equivalent, this is deliberately far faster, not just "a little"
      this.streakLength = 0.55;
      this.boxHalfWidth = 22.0; // lateral spread around the vehicle
      this.boxHeight = 18.0;
      this.boxDepth = 46.0; // along the direction of travel — wider than lateral since the car moves fast enough to outrun a narrow box
      this.driftX = -1.4; // slight sideways drift, like wind-blown rain, not a perfectly vertical curtain

      const geom = new THREE.BoxGeometry(0.018, this.streakLength, 0.018);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xcfd8e3,
        transparent: true,
        opacity: 0.4,
        depthWrite: false
      });
      this.mesh = new THREE.InstancedMesh(geom, mat, this.count);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.frustumCulled = false;
      this.mesh.visible = false;

      this.positions = new Float32Array(this.count * 3);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < this.count; i++) {
        this.positions[i * 3] = (Math.random() - 0.5) * 2 * this.boxHalfWidth;
        this.positions[i * 3 + 1] = Math.random() * this.boxHeight;
        this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.boxDepth;
        dummy.position.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
      }
      scene.add(this.mesh);
    }

    setActive(active) {
      this.mesh.visible = !!active;
    }

    // `center` is the point the volume rides around (the vehicle position)
    // — local-space particle coordinates stay in [-half, +half] ranges and
    // get re-based onto `center` every frame, so the volume always reads
    // as "raining around the car" rather than a fixed world-space patch
    // the car drives in and out of.
    update(dt, center) {
      if (!this.mesh.visible) return;
      const dummy = new THREE.Object3D();
      const fall = this.fallSpeed * dt;
      const drift = this.driftX * dt;
      for (let i = 0; i < this.count; i++) {
        let y = this.positions[i * 3 + 1] - fall;
        let x = this.positions[i * 3] + drift;
        if (y < 0) {
          y = this.boxHeight;
          x = (Math.random() - 0.5) * 2 * this.boxHalfWidth;
          this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.boxDepth;
        }
        if (x < -this.boxHalfWidth) x = this.boxHalfWidth;
        if (x > this.boxHalfWidth) x = -this.boxHalfWidth;
        this.positions[i * 3] = x;
        this.positions[i * 3 + 1] = y;

        dummy.position.set(
          center.x + x,
          center.y + y,
          center.z + this.positions[i * 3 + 2]
        );
        // Streaks tilt slightly with the drift instead of staying perfectly
        // vertical — a static vertical rod reads as a picket fence, not rain.
        dummy.rotation.z = -this.driftX * 0.06;
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
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
      this.weather = 'clear'; // 'clear', 'rain' — see SLOWROADS_PARITY_LOG.md item 4
      this.selectedSeed = '5927cd04';
      this.selectedVehicle = 'swift';
      this.selectedDifficulty = 'medium';
      this.activeDockPanel = null;
      this.activeCameraMode = 'chase';

      this.earnings = 280;
      this.deliveriesMade = 0;
      this.missedCount = 0;
      this.streakCount = 1;
      this.activeOrderIndex = 0;
      this.orderTimer = 36.0;
      this.maxOrderTimer = 36.0;
      this.deliveryHistory = [];
      this.isStatusPanelOpen = false;

      this.resumeCount = 0;
      this.maxResumes = 3;
      this.savedProgressCheckpoint = null;
      this.isStuckModalOpen = false;
      this.stuckTimer = 0;

      // Wanted meter: builds up from hitting pedestrians/animals, decays
      // when clean. Hitting max sends the player to jail instead of an
      // instant fail on the first hit — see checkCrosserCollisions.
      this.wantedLevel = 0;
      this.maxWantedLevel = 3;
      this.wantedDecayTimer = 0;
      this.isJailed = false;

      // Get-out-and-walk delivery (car/truck only — two-wheelers always
      // toss from the saddle, see toggleOnFoot). WALK_TIME_BONUS
      // compensates for the extra time walking costs vs. a drive-by toss;
      // granted once per order (walkBonusOrderIndex) so re-toggling E
      // can't be farmed for free time.
      this.onFoot = false;
      this.walkerMesh = null;
      this.walkerParkedVehiclePos = null;
      this.walkBonusOrderIndex = -1;
      this.WALK_TIME_BONUS = 22.0;

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
        try {
          this.renderer = new THREE.WebGLRenderer({ antialias: false, failIfMajorPerformanceCaveat: false });
        } catch (e2) {
          console.warn('Standard WebGL initialization failed, using headless fallback renderer:', e2);
          const c = document.createElement('canvas');
          this.renderer = {
            domElement: c,
            setSize: () => {},
            setPixelRatio: () => {},
            render: () => {},
            shadowMap: {},
            setClearColor: () => {},
            dispose: () => {}
          };
        }
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

      // Cheap procedural sky/ground gradient env map: gives PBR materials
      // (MeshStandardMaterial) a plausible ambient reflection/fill instead
      // of the flat, direction-less look they get with no envMap at all.
      try {
        this.envMap = this.createEnvironmentMap();
        if (this.envMap) this.scene.environment = this.envMap;
      } catch (e) {
        console.warn('Environment map generation failed (headless mode):', e);
      }

      try {
        this.initPostProcessing();
      } catch (e) {
        console.warn('Post-processing initialization failed (headless mode):', e);
      }

      this.rain = new RainSystem(this.scene);
    }

    // A tiny gradient "sky" scene captured with PMREM equirect rendering.
    // Not a real HDRI, but enough of a lit backdrop that MeshStandardMaterial
    // surfaces pick up soft directional-looking ambient instead of shading
    // as if lit from nowhere.
    createEnvironmentMap() {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      pmrem.compileEquirectangularShader();

      const skyScene = new THREE.Scene();
      const skyGeo = new THREE.SphereGeometry(50, 16, 16);
      const skyCanvas = document.createElement('canvas');
      skyCanvas.width = 2;
      skyCanvas.height = 256;
      const ctx = skyCanvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.0, '#bfe3ff');
      grad.addColorStop(0.45, '#e8f4ff');
      grad.addColorStop(0.55, '#cbd8c2');
      grad.addColorStop(1.0, '#5c6650');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 2, 256);
      const skyTex = new THREE.CanvasTexture(skyCanvas);
      skyTex.mapping = THREE.EquirectangularReflectionMapping;
      const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
      skyScene.add(new THREE.Mesh(skyGeo, skyMat));

      const rt = pmrem.fromScene(skyScene, 0.04);
      pmrem.dispose();
      return rt.texture;
    }

    initPostProcessing() {
      this.composer = new THREE.EffectComposer(this.renderer);
      this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));

      const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
      const pixelRatio = this.renderer.getPixelRatio();

      // threshold 0.94 (was 0.86): under strong daylight, ordinary bright
      // albedo — white walls, saturated vehicle paint, light props — was
      // already crossing a 0.86 luminance threshold post-ACES-tonemap and
      // blowing out into full-screen bloom halos, not just true light
      // sources (headlights, glowing windows). Raising it keeps bloom for
      // actual emissive/specular highlights without flaring flat-lit color.
      this.bloomPass = new THREE.UnrealBloomPass(size, 0.4, 0.4, 0.94);
      this.composer.addPass(this.bloomPass);

      const VignetteShader = {
        uniforms: { tDiffuse: { value: null }, offset: { value: 1.15 }, darkness: { value: 1.1 } },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float offset;
          uniform float darkness;
          varying vec2 vUv;
          void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - 0.5) * vec2(offset);
            // Deliberately NOT aspect-corrected: making this a true
            // physical circle (scaling uv.x by the real aspect ratio) was
            // tried and reverted — on an ultra-wide window the circle has
            // to anchor to the shorter height dimension, so the left/right
            // thirds of the screen fall way outside it and get hit with
            // much heavier darkening than before. That's more "correct"
            // geometrically but reads as a much worse, more aggressive
            // vignette on wide viewports than the original uncorrected
            // version, which nobody had actually complained about.
            float vig = 1.0 - dot(uv, uv);
            texel.rgb *= clamp(pow(vig, darkness), 0.0, 1.0) * 0.35 + 0.65;
            // The vignette factor above varies smoothly across the screen,
            // but the composer's render target only has 8 bits per channel
            // — on a flat, pale sky color that smooth multiply collapses
            // into visible stepped rings ("layers") once quantized. This is
            // a math/precision artifact, not a driver quirk, so it
            // reproduces identically on every device. A tiny per-pixel
            // hash-noise dither breaks the steps up into imperceptible
            // grain instead of visible contour bands — the standard fix
            // for gradient banding.
            float dither = (fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 128.0;
            texel.rgb += dither;
            gl_FragColor = texel;
          }
        `
      };
      this.vignettePass = new THREE.ShaderPass(VignetteShader);
      this.composer.addPass(this.vignettePass);

      // The composer's render targets don't carry the renderer's built-in
      // MSAA (that only smooths the final canvas blit, which post-processing
      // bypasses), so without this pass every edge in the scene reads as
      // grainy/aliased once bloom sharpens the contrast — FXAA restores the
      // smoothing that antialias:true on the renderer used to provide.
      this.fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
      this.fxaaPass.material.uniforms['resolution'].value.set(1 / (size.x * pixelRatio), 1 / (size.y * pixelRatio));
      this.fxaaPass.renderToScreen = true;
      this.composer.addPass(this.fxaaPass);
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
        if (this.world.tunnelGroup) this.scene.remove(this.world.tunnelGroup);
      }

      this.world = new ProceduralWorld(this.selectedSeed, this.selectedSeason, this.selectedCity);
      this.scene.add(this.world.createSkyDome(season, this.selectedTimeOfDay));
      this.scene.add(this.world.createRoadMesh(this.selectedRoadTerrain));
      this.scene.add(this.world.createWorldFloor(season));
      this.scene.add(this.world.createTerrainMesh(season));
      this.scene.add(this.world.createTunnelMeshes());
      this.world.createFoliageAndProps(this.scene, season, this.selectedDifficulty);

      if (!this.vehicle) {
        this.vehicle = new VehicleController(this.scene, this.selectedVehicle);
      } else {
        this.vehicle.setVehicleType(this.selectedVehicle);
      }
      this.vehicle.resetToSpline(this.world.curve, 0.008);
      this.vehicle.setHeadlightsActive(tod.night || tod.id === 'dusk');
      this.applyWindowGlow(tod);

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

    toggleStatusPanel() {
      this.isStatusPanelOpen = !this.isStatusPanelOpen;
      const panel = document.getElementById('delivery-status-panel');
      if (!panel) return;
      panel.classList.toggle('open', this.isStatusPanelOpen);
      if (this.isStatusPanelOpen) this.renderStatusPanel();
    }

    refreshStatusPanel() {
      if (this.isStatusPanelOpen) this.renderStatusPanel();
    }

    renderStatusPanel() {
      const panel = document.getElementById('delivery-status-panel');
      if (!panel) return;

      const cityOrders = CONFIG.ORDERS_BY_CITY[this.selectedCity] || CONFIG.ORDERS_BY_CITY.mumbai;
      const current = cityOrders[this.activeOrderIndex % cityOrders.length];
      const upcoming = [1, 2, 3].map(off => cityOrders[(this.activeOrderIndex + off) % cityOrders.length]);

      const delivered = this.deliveryHistory.filter(h => h.status === 'delivered').length;
      const missed = this.deliveryHistory.filter(h => h.status === 'missed').length;

      const historyRows = this.deliveryHistory.length
        ? this.deliveryHistory.slice(0, 25).map(h => `
            <div class="status-history-row ${h.status}">
              <span class="status-history-icon">${h.status === 'delivered' ? '✅' : '❌'}</span>
              <span class="status-history-name">${h.name}</span>
              <span class="status-history-amount ${h.status}">${h.amount >= 0 ? '+' : ''}₹${h.amount}</span>
            </div>`).join('')
        : `<div class="status-history-empty">No deliveries yet — get rolling!</div>`;

      panel.innerHTML = `
        <div class="status-panel-header">
          <span class="status-panel-title">DELIVERY STATUS</span>
          <button id="btn-status-close" class="status-panel-close" title="Close [V]">✕</button>
        </div>

        <div class="status-panel-section">
          <div class="status-section-tag">CURRENT DISPATCH</div>
          <div class="status-current-card">
            <span class="status-current-name">${current ? current.name : '—'}</span>
            <span class="status-current-cargo">${current ? current.cargo : ''}</span>
          </div>
        </div>

        <div class="status-panel-section">
          <div class="status-section-tag">UPCOMING</div>
          <div class="status-upcoming-list">
            ${upcoming.map((o, i) => `
              <div class="status-upcoming-row">
                <span class="status-upcoming-idx">#${i + 2}</span>
                <span class="status-upcoming-name">${o ? o.name : '—'}</span>
                <span class="status-upcoming-reward">₹${o ? o.reward : 0}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="status-panel-section status-panel-totals">
          <div class="status-total-pill delivered"><span>${delivered}</span> DELIVERED</div>
          <div class="status-total-pill missed"><span>${missed}</span> MISSED</div>
          <div class="status-total-pill earnings"><span>₹${this.earnings}</span> EARNED</div>
        </div>

        <div class="status-panel-section status-panel-history">
          <div class="status-section-tag">HISTORY</div>
          <div class="status-history-list">${historyRows}</div>
        </div>
      `;

      document.getElementById('btn-status-close')?.addEventListener('click', () => this.toggleStatusPanel());
    }

    updateOrderTimer(dt) {
      if (this.gameState !== 'playing') return;

      this.orderTimer -= dt;
      const clockEl = document.getElementById('order-timer-clock');
      const barEl = document.getElementById('order-timer-bar');

      if (this.orderTimer <= 0) {
        // Order Timed Out (Late Delivery Penalty)
        const cityOrdersForMiss = CONFIG.ORDERS_BY_CITY[this.selectedCity] || CONFIG.ORDERS_BY_CITY.mumbai;
        const missedOrder = cityOrdersForMiss[this.activeOrderIndex % cityOrdersForMiss.length];

        this.orderTimer = this.maxOrderTimer;
        this.streakCount = 1;
        this.earnings = Math.max(0, this.earnings - 25);
        this.missedCount = (this.missedCount || 0) + 1;
        sound.playTone(220, 'sawtooth', 0.3, 0.35);

        this.showScoreBanner(`⚠️ TIME EXPIRED! (LATE)`, `Penalty -₹25 • Customer Rating 1★`);
        this.addNotification('❌ DELIVERY MISSED! Time expired (-₹25)', 'danger', 3500);

        this.deliveryHistory.unshift({
          name: missedOrder?.name || 'Delivery',
          status: 'missed',
          amount: -25,
          orderIndex: this.activeOrderIndex
        });

        // Retire this order's house so it stops being a candidate for the
        // "nearest undelivered target" search (used by both the HUD arrow
        // and the actual cargo-toss hit test). Left unmarked, a missed
        // house stays live forever — on a winding/looping road it can end
        // up geometrically closer than the player's real current target,
        // silently stealing every toss aimed at the house they're actually
        // standing next to.
        const missedTarget = this.world?.deliveryTargets?.[this.activeOrderIndex];
        if (missedTarget) {
          missedTarget.delivered = true;
          if (missedTarget.ring) missedTarget.ring.material.color.setHex(0x64748b);
        }

        this.activeOrderIndex++;
        this.updateActiveOrderCard();
        this.updateHUDStats();
        this.refreshStatusPanel();
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
        if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
        if (this.bloomPass) this.bloomPass.setSize(window.innerWidth, window.innerHeight);
        if (this.fxaaPass) {
          const pr = this.renderer.getPixelRatio();
          this.fxaaPass.material.uniforms['resolution'].value.set(1 / (window.innerWidth * pr), 1 / (window.innerHeight * pr));
        }
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
        if (k === 'm') this.toggleRadioMute();
        if (k === 'n') this.toggleSfxMute();
        if (k === 'l') this.cycleRadioChannel();
        if (k === 'v') this.toggleStatusPanel();
        if (k === 'e') this.toggleOnFoot();
        if (k === 'p') this.toggleWeather();
        if (k === 'h' || k === '?') this.openSettingsModal('controls');
        if (k === 'escape') this.openSettingsModal('gameplay');
        if (k === ' ' && this.gameState === 'playing') {
          if (this.onFoot) this.tryWalkDelivery();
          else this.tossParcel3D();
        }
        if ((k === 'enter' || k === ' ') && this.gameState === 'menu') this.startDrive();
      });

      window.addEventListener('keyup', e => onKey(e, false));
      window.addEventListener('mousemove', () => this.resetInactivity());
      window.addEventListener('mousedown', e => {
        this.resetInactivity();
        if (this.gameState === 'playing' && e.target.tagName === 'CANVAS') {
          if (this.onFoot) this.tryWalkDelivery();
          else this.tossParcel3D();
        }
      });

      this.initTouchControls();
    }

    // On-screen steer/throttle/action buttons for touch devices — the game
    // had keyboard-only input, making it unplayable on phones/tablets.
    // Every button just flips the exact same this.keys.* flags the
    // keyboard handlers use (or fires the same toss/walk-delivery call
    // SPACE does), so steering, acceleration and delivery logic stay
    // single-sourced; touch is purely a second way to set those flags, not
    // a parallel control path.
    applyTouchControlVisibility() {
      const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      document.body.classList.toggle('touch-controls-active', isTouch);
    }

    initTouchControls() {
      this.applyTouchControlVisibility();
      // A Bluetooth mouse/keyboard can be paired with a touch tablet mid-
      // session (or vice versa on a convertible laptop) — re-check instead
      // of only detecting once at load.
      window.matchMedia('(pointer: coarse)').addEventListener?.('change', () => this.applyTouchControlVisibility());

      const bindHoldButton = (id, onDown, onUp) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const start = e => {
          e.preventDefault();
          this.resetInactivity();
          btn.classList.add('touch-pressed');
          onDown();
        };
        const end = e => {
          if (e) e.preventDefault();
          btn.classList.remove('touch-pressed');
          if (onUp) onUp();
        };
        btn.addEventListener('pointerdown', start);
        btn.addEventListener('pointerup', end);
        btn.addEventListener('pointercancel', end);
        btn.addEventListener('pointerleave', end);
      };

      bindHoldButton('touch-steer-left', () => { this.keys.left = this.keys.a = true; }, () => { this.keys.left = this.keys.a = false; });
      bindHoldButton('touch-steer-right', () => { this.keys.right = this.keys.d = true; }, () => { this.keys.right = this.keys.d = false; });
      bindHoldButton('touch-pedal-gas', () => { this.keys.up = this.keys.w = true; }, () => { this.keys.up = this.keys.w = false; });
      bindHoldButton('touch-pedal-brake', () => { this.keys.down = this.keys.s = true; }, () => { this.keys.down = this.keys.s = false; });

      // Discrete tap, not a held flag — mirrors the SPACE keydown handler
      // (fires once on press, not continuously while held).
      bindHoldButton('touch-action-btn', () => {
        if (this.gameState === 'menu') { this.startDrive(); return; }
        if (this.gameState !== 'playing') return;
        if (this.onFoot) this.tryWalkDelivery();
        else this.tossParcel3D();
      });
    }

    // Low-poly courier avatar for on-foot delivery, matching the crosser
    // pedestrian rig's style (World.buildCrosserMesh) so it reads as part
    // of the same world rather than a mismatched import.
    createWalkerMesh() {
      const group = new THREE.Group();
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
      const uniformMat = new THREE.MeshLambertMaterial({ color: 0xff2d4e });
      const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.64, 0.26), uniformMat);
      torso.position.y = 0.98;
      const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), skinMat);
      head.position.y = 1.48;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.64, 0.17), pantsMat);
      legL.position.set(-0.11, 0.33, 0);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.64, 0.17), pantsMat);
      legR.position.set(0.11, 0.33, 0);
      group.add(torso, head, legL, legR);
      group.userData.legs = [legL, legR];
      group.userData.legPhase = 0;
      return group;
    }

    // Toggle between driving and walking a car/truck delivery up to the
    // door. Two-wheelers never get out — per the queued design decision,
    // they always toss from the saddle (aimed-throw risk mechanic covers
    // them instead; that's a separate follow-up feature).
    toggleOnFoot() {
      if (!this.vehicle || !this.world || this.gameState !== 'playing') return;
      const isCarOrTruck = this.selectedVehicle === 'swift' || this.selectedVehicle === 'chotahathi';
      if (!isCarOrTruck) {
        this.addNotification('🛵 Two-wheelers stay mounted — toss from the saddle instead', 'neutral', 2500);
        return;
      }

      if (this.onFoot) {
        // Return to vehicle — warp back rather than requiring the player
        // to walk all the way back, which wouldn't add anything fun, just
        // travel time.
        this.onFoot = false;
        if (this.walkerMesh) {
          this.scene.remove(this.walkerMesh);
          this.walkerMesh = null;
        }
        if (this.walkerParkedVehiclePos) {
          this.vehicle.mesh.position.copy(this.walkerParkedVehiclePos);
        }
        this.vehicle.speed = 0;
        this.addNotification('🚗 BACK IN VEHICLE', 'neutral', 2000);
        return;
      }

      if (Math.abs(this.vehicle.speed) > 1.5) {
        this.addNotification('⚠️ STOP THE VEHICLE FIRST', 'warning', 2200);
        return;
      }

      this.onFoot = true;
      this.walkerParkedVehiclePos = this.vehicle.mesh.position.clone();
      this.walkerMesh = this.createWalkerMesh();
      this.walkerMesh.quaternion.copy(this.vehicle.mesh.quaternion);

      // Spawning the walker mesh at the car's own origin planted its feet
      // at car-body height (the walker's local origin is ground-level, the
      // car's is roughly seat height), so the torso/head clipped straight
      // through the roof. Step out to the driver's side instead, like
      // exiting through the door, and snap to actual ground height the
      // same way updateWalking() does every frame.
      const doorSide = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.vehicle.mesh.quaternion);
      const exitPos = this.vehicle.mesh.position.clone().addScaledVector(doorSide, 1.7);
      if (this.world && this.world.curve) {
        const u = THREE.MathUtils.clamp(this.vehicle.splineProgress, 0, 1);
        const pt = this.world.curve.getPointAt(u);
        const tangent = this.world.curve.getTangentAt(u).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
        const latDist = exitPos.clone().sub(pt).dot(normal);
        exitPos.y = this.world.groundHeightAt(pt, exitPos, latDist) + 0.05;
      }
      this.walkerMesh.position.copy(exitPos);
      this.scene.add(this.walkerMesh);

      // One-time timer bonus per order — walking to the door and back
      // costs real time a drive-by toss doesn't, so the clock needs to
      // absorb that instead of just punishing the choice to walk.
      if (this.walkBonusOrderIndex !== this.activeOrderIndex) {
        this.walkBonusOrderIndex = this.activeOrderIndex;
        this.orderTimer += this.WALK_TIME_BONUS;
        this.maxOrderTimer += this.WALK_TIME_BONUS;
        this.addNotification(`🚶 ON FOOT — +${this.WALK_TIME_BONUS}s DELIVERY WINDOW`, 'success', 3000);
      } else {
        this.addNotification('🚶 ON FOOT', 'neutral', 1800);
      }
    }

    updateWalking(dt) {
      if (!this.walkerMesh || !this.world || !this.world.curve) return;

      const turnSpeed = 2.6;
      if (this.keys.a || this.keys.left) this.walkerMesh.rotation.y += turnSpeed * dt;
      if (this.keys.d || this.keys.right) this.walkerMesh.rotation.y -= turnSpeed * dt;

      let moveDir = 0;
      if (this.keys.w || this.keys.up) moveDir = 1;
      else if (this.keys.s || this.keys.down) moveDir = -0.6;

      const walkSpeed = 4.5;
      if (moveDir !== 0) {
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.walkerMesh.quaternion);
        const newPos = this.walkerMesh.position.clone().addScaledVector(forward, moveDir * walkSpeed * dt);

        // Ground height via the shared formula (BUGFIX_LOG.md Recurring
        // Pattern 1) — never hand-roll a new height approximation here.
        // The walker stays close to where the vehicle parked, so the
        // vehicle's own splineProgress is a good-enough nearest-point
        // reference without re-searching the whole curve every frame.
        const u = THREE.MathUtils.clamp(this.vehicle.splineProgress, 0, 1);
        const pt = this.world.curve.getPointAt(u);
        const tangent = this.world.curve.getTangentAt(u).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
        const latDist = newPos.clone().sub(pt).dot(normal);
        newPos.y = this.world.groundHeightAt(pt, newPos, latDist) + 0.05;

        this.walkerMesh.position.copy(newPos);

        const legs = this.walkerMesh.userData.legs;
        this.walkerMesh.userData.legPhase += dt * 10.0;
        const swing = Math.sin(this.walkerMesh.userData.legPhase) * 0.4;
        legs[0].rotation.x = swing;
        legs[1].rotation.x = -swing;
      }
    }

    // On-foot equivalent of tossParcel3D's hit-test: walking within the
    // difficulty's tossRadius of the current target's porch ring completes
    // the delivery directly (SPACE), instead of needing a physics toss.
    tryWalkDelivery() {
      if (!this.onFoot || !this.walkerMesh || !this.world) return;
      let nearestTarget = null;
      let minD = 40.0;
      this.world.deliveryTargets.forEach(t => {
        if (t.delivered) return;
        const d = this.walkerMesh.position.distanceTo(t.pos);
        if (d < minD) { minD = d; nearestTarget = t; }
      });
      if (!nearestTarget) return;
      const hitRadius = nearestTarget.tossRadius || 5.0;
      if (minD < hitRadius) {
        this.fulfillDelivery(nearestTarget);
      } else {
        this.addNotification(`🚶 Get closer to the door to deliver (${Math.round(minD)}m away)`, 'warning', 2000);
      }
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
        const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.8, flatShading: true });
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

    // Shared reward/notification/history logic for completing a delivery,
    // whichever way it happened (tossed parcel landing in range, or
    // walking a car/truck delivery up to the door on foot). Factored out
    // so both paths can't silently drift apart (see BUGFIX_LOG.md
    // Recurring Pattern 1 — duplicated logic that diverges over time).
    fulfillDelivery(target) {
      target.delivered = true;
      target.ring.material.color.setHex(0xff9f1c);

      this.deliveriesMade++;
      this.streakCount++;

      const diffCfg = CONFIG.DIFFICULTY_TIERS[this.selectedDifficulty];
      const timeBonus = Math.max(0, Math.round(this.orderTimer * 1.8));
      const earnedBonus = Math.round((target.order.reward + timeBonus) * diffCfg.payoutMult * (1 + this.streakCount * 0.2));
      this.earnings += earnedBonus;

      this.orderTimer = this.maxOrderTimer; // Reset clock for next order

      sound.playCombo();
      const bonusMsg = (this.orderTimer > this.maxOrderTimer * 0.5 ? `⚡ EXPRESS SPEED BONUS!` : `🎯 ON-TIME BULLSEYE!`);
      this.spawnConfetti(target.pos, 36);
      this.showScoreBanner(`${bonusMsg} +₹${earnedBonus}`, `🔥 ${this.streakCount}x STREAK • +${timeBonus} TIME BONUS`);
      this.addNotification(`✅ DELIVERY #${this.deliveriesMade} COMPLETE! +₹${earnedBonus} (${this.streakCount}x streak)`, 'success', 4000);

      this.deliveryHistory.unshift({
        name: target.order?.name || 'Delivery',
        status: 'delivered',
        amount: earnedBonus,
        orderIndex: this.activeOrderIndex
      });

      this.activeOrderIndex++;
      this.updateActiveOrderCard();
      this.updateHUDStats();
      this.refreshStatusPanel();
    }

    spawnParcelTrail(pos) {
      if (!this.scene) return;
      const geom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const colors = [0xffd166, 0x06d6a0, 0x118ab2, 0xff9f1c, 0xffffff];
      const mat = new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)] });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25));
      this.scene.add(mesh);
      this.particles.push({
        mesh: mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.5),
        rotVel: new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3),
        life: 0.45,
        maxLife: 0.45
      });
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

        // Aerodynamic trailing particle ribbon
        if (Math.random() > 0.35) {
          this.spawnParcelTrail(p.pos);
        }

        // Hit Detection with Porch Ring
        if (p.nearestTarget && !p.nearestTarget.delivered) {
          const d = p.pos.distanceTo(p.nearestTarget.pos);
          const hitRadius = p.nearestTarget.tossRadius || 5.0;

          if (d < hitRadius) {
            this.fulfillDelivery(p.nearestTarget);
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

    updateWantedHUD() {
      const box = document.getElementById('wanted-meter');
      if (!box) return;
      box.classList.toggle('wanted-active', this.wantedLevel > 0);
      const stars = box.querySelectorAll('.wanted-star');
      stars.forEach((s, i) => s.classList.toggle('lit', i < this.wantedLevel));
    }

    // Checks the player's vehicle against every road crosser (pedestrian/
    // dog/cat) each frame. A hit removes that crosser, bumps the wanted
    // meter instead of an instant fail, and decays back down when clean —
    // so a couple of unlucky hits doesn't end the run outright, but a
    // reckless streak eventually lands you in jail.
    checkCrosserCollisions() {
      if (!this.vehicle || !this.world || !this.world.crossers || this.isJailed) return;
      const carPos = this.vehicle.mesh.position;

      for (let i = this.world.crossers.length - 1; i >= 0; i--) {
        const c = this.world.crossers[i];
        if (c.struck) continue;
        const d = carPos.distanceTo(c.mesh.position);
        if (d < (c.hitRadius + 1.0) && Math.abs(this.vehicle.speed) > 1.5) {
          c.struck = true;
          this.world.foliageGroup.remove(c.mesh);
          this.world.crossers.splice(i, 1);

          this.wantedLevel = Math.min(this.maxWantedLevel, this.wantedLevel + 1);
          this.wantedDecayTimer = 0;
          this.updateWantedHUD();

          const box = document.getElementById('wanted-meter');
          if (box) {
            box.classList.remove('wanted-pulse');
            void box.offsetWidth;
            box.classList.add('wanted-pulse');
          }

          const label = c.kind === 'pedestrian' ? 'PEDESTRIAN' : (c.kind === 'dog' ? 'DOG' : 'CAT');
          this.addNotification(`🚨 HIT A ${label}! Wanted level ${this.wantedLevel}/${this.maxWantedLevel}`, 'danger', 3000);
          sound.playCrash();

          if (this.wantedLevel >= this.maxWantedLevel) {
            this.triggerJail();
          }
          break; // one hit per frame is plenty
        }
      }

      // Clean-driving decay: wanted level drops one star after a stretch
      // of no new hits, so a single early mistake doesn't dog the whole run.
      if (this.wantedLevel > 0) {
        this.wantedDecayTimer += 1 / 60;
        if (this.wantedDecayTimer > 12.0) {
          this.wantedLevel = Math.max(0, this.wantedLevel - 1);
          this.wantedDecayTimer = 0;
          this.updateWantedHUD();
        }
      }
    }

    triggerJail() {
      if (this.isJailed) return;
      this.isJailed = true;
      this.gameState = 'jailed';
      sound.playCrash();
      sound.suspendForMenu();

      const fine = 120;
      this.earnings = Math.max(0, this.earnings - fine);
      this.updateHUDStats();

      this.modalContainer.innerHTML = `
        <div class="modal-backdrop">
          <div class="recovery-card">
            <div class="recovery-badge failed">🚔 ARRESTED</div>
            <h2 class="recovery-title">TOO MANY HIT-AND-RUNS</h2>
            <p class="recovery-desc">
              Traffic police pulled you over after repeated collisions with pedestrians and animals.
              <br><br>
              <strong>Fine Paid:</strong> -₹${fine}
            </p>
            <button id="btn-jail-release" class="btn-resume-drive">
              <span>⚡ PAY FINE & RESUME DISPATCH</span>
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-jail-release')?.addEventListener('click', () => {
        this.isJailed = false;
        this.wantedLevel = 0;
        this.wantedDecayTimer = 0;
        this.updateWantedHUD();
        this.modalContainer.innerHTML = '';
        this.gameState = 'playing';
        if (this.vehicle) this.vehicle.speed = 0;
        sound.resumeForGameplay();
      });
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

      // Multi-Channel Radio Controls
      const radioCard = document.getElementById('cassette-radio-card');
      const radioTitleEl = document.getElementById('radio-track-title');
      const btnPlay = document.getElementById('btn-radio-play');
      const btnNext = document.getElementById('btn-radio-next');
      const btnPrev = document.getElementById('btn-radio-prev');
      const btnChannel = document.getElementById('btn-radio-channel');

      // Set initial channel display from saved preference
      if (btnChannel) btnChannel.textContent = sound.getChannelDisplayName();

      const svgPlay = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      const svgPause = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

      if (btnPlay) {
        btnPlay.onclick = () => {
          sound.ensure();
          const isPlaying = sound.toggleRadio();
          btnPlay.textContent = isPlaying ? 'PAUSE' : 'PLAY';
          const trk = sound.realTracks[sound.currentTrackIndex];
          if (trk && radioTitleEl) radioTitleEl.textContent = sound._formatTrackTitle(trk);
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
          if (radioTitleEl) radioTitleEl.textContent = title;
          if (radioCard) radioCard.classList.add('playing');
          if (btnPlay) btnPlay.textContent = 'PAUSE';
        };
      }

      if (btnPrev) {
        btnPrev.onclick = () => {
          sound.ensure();
          const title = sound.prevTrack();
          if (radioTitleEl) radioTitleEl.textContent = title;
          if (radioCard) radioCard.classList.add('playing');
          if (btnPlay) btnPlay.textContent = 'PAUSE';
        };
      }

      // Channel toggle button click
      if (btnChannel) {
        btnChannel.onclick = () => this.cycleRadioChannel();
      }
      const btnLang = document.getElementById('btn-radio-lang');
      if (btnLang) {
        btnLang.onclick = () => this.toggleRadioLanguage();
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
      document.getElementById('btn-hud-radio-mute')?.addEventListener('click', () => this.toggleRadioMute());
      document.getElementById('btn-hud-sfx-mute')?.addEventListener('click', () => this.toggleSfxMute());
      document.getElementById('btn-hud-status')?.addEventListener('click', () => this.toggleStatusPanel());
      document.getElementById('btn-dock-status')?.addEventListener('click', () => this.toggleStatusPanel());
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

    toggleRadioMute() {
      const isMuted = sound.toggleRadioMute();
      this.updateAudioHUDButtons();
      this.showScorePopup(0, isMuted ? 'RADIO MUTED [M]' : 'RADIO ON [M]');
    }

    toggleSfxMute() {
      const isMuted = sound.toggleSfxMute();
      this.updateAudioHUDButtons();
      this.showScorePopup(0, isMuted ? 'SFX MUTED [N]' : 'SFX ON [N]');
    }

    updateAudioHUDButtons() {
      const radioHudBtn = document.getElementById('btn-hud-radio-mute');
      const sfxHudBtn = document.getElementById('btn-hud-sfx-mute');
      const hudBtn = document.getElementById('btn-hud-sound');
      const dockBtn = document.getElementById('btn-dock-sound');
      const hubBtn = document.getElementById('btn-hub-mute');

      if (radioHudBtn) {
        radioHudBtn.classList.toggle('muted', sound.radioMuted);
        radioHudBtn.textContent = sound.radioMuted ? 'RADIO OFF' : 'RADIO';
      }
      if (sfxHudBtn) {
        sfxHudBtn.classList.toggle('muted', sound.sfxMuted);
        sfxHudBtn.textContent = sound.sfxMuted ? 'SFX OFF' : 'SFX';
      }
      if (hudBtn) hudBtn.textContent = (sound.radioMuted && sound.sfxMuted) ? 'UNMUTE' : 'MUTE';
      if (dockBtn) dockBtn.textContent = (sound.radioMuted && sound.sfxMuted) ? 'UNMUTE' : 'AUDIO';
      if (hubBtn) hubBtn.innerHTML = `<span>${(sound.radioMuted && sound.sfxMuted) ? 'UNMUTE [M]' : 'MUTE [M]'}</span>`;
    }

    toggleMute() {
      const isMuted = sound.toggleMute();
      this.updateAudioHUDButtons();
      this.showScorePopup(0, isMuted ? 'AUDIO MUTED' : 'SOUND UNMUTED');
    }

    cycleRadioChannel() {
      sound.ensure();
      const title = sound.cycleChannel();
      const btnChannel = document.getElementById('btn-radio-channel');
      const radioTitleEl = document.getElementById('radio-track-title');
      const radioCard = document.getElementById('cassette-radio-card');
      if (btnChannel) {
        btnChannel.textContent = sound.getChannelDisplayName();
        btnChannel.classList.remove('channel-flash');
        void btnChannel.offsetWidth; // force reflow for re-triggering animation
        btnChannel.classList.add('channel-flash');
      }
      if (radioTitleEl) radioTitleEl.textContent = title;
      if (radioCard && sound.radioPlaying) radioCard.classList.add('playing');
      this.showScorePopup(0, `RADIO: ${sound.getChannelDisplayName()}`);
    }

    // Direct Hindi/English switch (skips 'mix' — cycleRadioChannel/[L]
    // still reaches it for anyone who wants the blended stream).
    toggleRadioLanguage() {
      sound.ensure();
      const title = sound.toggleLanguage();
      const btnChannel = document.getElementById('btn-radio-channel');
      const radioTitleEl = document.getElementById('radio-track-title');
      const radioCard = document.getElementById('cassette-radio-card');
      if (btnChannel) {
        btnChannel.textContent = sound.getChannelDisplayName();
        btnChannel.classList.remove('channel-flash');
        void btnChannel.offsetWidth;
        btnChannel.classList.add('channel-flash');
      }
      if (radioTitleEl) radioTitleEl.textContent = title;
      if (radioCard && sound.radioPlaying) radioCard.classList.add('playing');
      this.showScorePopup(0, `RADIO: ${sound.getChannelDisplayName()}`);
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
      // Belt-and-suspenders on top of the per-frame decay in update():
      // toggling autodrive off and back on within the same frame/second
      // (decay hasn't caught up yet) could still hand manual steering a
      // stale lateralVelocity the instant control returns — zero it here
      // so there's no timing window at all, not just a fast one.
      if (!this.vehicle.isAutodrive) this.vehicle.lateralVelocity = 0;
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
      // Camera set audited against slowroads.io's own 5 modes (Chase, Far
      // Chase, First-Person, Bonnet, Bumper — see SLOWROADS_PARITY_LOG.md
      // section 1.2b): Shiplyp had chase/hood/sky, missing a pulled-back
      // chase variant and any true in-cabin view, and "hood" was actually
      // sitting at bumper height, mislabeled. Renamed to match what it
      // actually is rather than adding a redundant near-duplicate "bonnet".
      const modes = ['chase', 'far-chase', 'first-person', 'hood', 'sky'];
      const curIdx = modes.indexOf(this.activeCameraMode || 'chase');
      this.activeCameraMode = modes[(curIdx + 1) % modes.length];
      const names = {
        chase: 'ELEVATED CHASE CAM',
        'far-chase': 'FAR CHASE CAM',
        'first-person': 'FIRST-PERSON CAM',
        hood: 'BUMPER CAM',
        sky: 'HIGH PANORAMIC CAM'
      };
      this.showScorePopup(0, `📹 ${names[this.activeCameraMode]}`);
      sound.playTone(800, 'sine', 0.08);
    }

    toggleWeather() {
      this.weather = this.weather === 'rain' ? 'clear' : 'rain';
      if (this.rain) this.rain.setActive(this.weather === 'rain');
      this.showScorePopup(0, this.weather === 'rain' ? '🌧️ RAIN' : '☀️ CLEAR SKIES');
      sound.playTone(600, 'sine', 0.08);
    }

    applyWindowGlow(tod) {
      if (!this.world || !this.world.windowMaterials) return;
      const intensity = (tod.night || tod.id === 'dusk') ? 0.85 : (tod.id === 'dawn' ? 0.15 : 0.0);
      for (const mat of this.world.windowMaterials) {
        mat.emissiveIntensity = intensity;
      }
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
      this.applyWindowGlow(tod);

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
      sound.suspendForMenu();

      if (this.resumeCount >= this.maxResumes) {
        // Shift Failed - 3 Resumes Exhausted! Restore baseline checkpoint saved before resume #1
        const restoredEarnings = this.savedProgressCheckpoint ? this.savedProgressCheckpoint.earnings : this.earnings;
        const restoredDeliveries = this.savedProgressCheckpoint ? this.savedProgressCheckpoint.deliveriesMade : this.deliveriesMade;

        if (this.savedProgressCheckpoint) {
          this.earnings = this.savedProgressCheckpoint.earnings;
          this.deliveriesMade = this.savedProgressCheckpoint.deliveriesMade;
          this.streakCount = this.savedProgressCheckpoint.streakCount;
          this.activeOrderIndex = this.savedProgressCheckpoint.activeOrderIndex;
          // Restore which houses were actually delivered at checkpoint time
          // too — activeOrderIndex alone isn't enough, since delivered
          // flags on deliveryTargets are never unset elsewhere. Without
          // this, houses resolved after the checkpoint stayed permanently
          // marked delivered even though activeOrderIndex rewound past
          // them, leaving the HUD's order card pointed at a dead slot.
          const snapshot = this.savedProgressCheckpoint.deliveredSnapshot;
          if (snapshot && this.world?.deliveryTargets) {
            this.world.deliveryTargets.forEach((t, idx) => {
              if (idx < snapshot.length) t.delivered = snapshot[idx];
            });
          }
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
          activeOrderIndex: this.activeOrderIndex,
          // deliveryTargets[].delivered is permanent (never unset elsewhere),
          // so restoring activeOrderIndex alone left already-resolved houses
          // stuck marked delivered after a rollback — the HUD's order card
          // (keyed off activeOrderIndex) would show a name/cargo for a slot
          // whose actual house was no longer a live target.
          deliveredSnapshot: this.world?.deliveryTargets?.map(t => t.delivered) || []
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
      sound.resumeForGameplay();
      sound.playRepair();
      this.showScorePopup(0, `🛟 RESUME #${this.resumeCount}/3 USED! Vehicle Serviced`);
    }

    returnToRoad() {
      // Free instant snap back — no resume count penalty, no health cost
      if (!this.vehicle || !this.world) return;
      this.stuckTimer = 0;
      this.isStuckModalOpen = false;
      this.lostFromRoad = false;
      this.modalContainer.innerHTML = '';
      this.hideReturnToRoadBanner();
      this.vehicle.snapToNearestRoadPoint(this.world.curve);
      sound.resumeForGameplay();
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
      sound.resumeForGameplay();
      this.modalContainer.innerHTML = '';
      this.hudOverlay.style.display = 'block';
      this.dockEl.style.display = 'flex';
      this.isStuckModalOpen = false;
      this.stuckTimer = 0;
      this.wantedLevel = 0;
      this.wantedDecayTimer = 0;
      this.isJailed = false;
      this.updateWantedHUD();

      if (this.savedProgressCheckpoint === null) {
        this.savedProgressCheckpoint = {
          earnings: this.earnings,
          deliveriesMade: this.deliveriesMade,
          streakCount: this.streakCount,
          activeOrderIndex: this.activeOrderIndex,
          deliveredSnapshot: this.world?.deliveryTargets?.map(t => t.delivered) || []
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
      this.updateAudioHUDButtons();

      // Resume radio on the player's saved channel only if they previously opted in
      if (!sound.radioPlaying && !sound.radioMuted && sound.userWantsRadio) {
        sound.toggleRadio();
        const btnPlay = document.getElementById('btn-radio-play');
        const radioCard = document.getElementById('cassette-radio-card');
        const radioTitleEl = document.getElementById('radio-track-title');
        const btnChannel = document.getElementById('btn-radio-channel');
        if (btnPlay) btnPlay.textContent = 'PAUSE';
        if (radioCard) radioCard.classList.add('playing');
        if (btnChannel) btnChannel.textContent = sound.getChannelDisplayName();
        const trk = sound.realTracks[sound.currentTrackIndex];
        if (trk && radioTitleEl) radioTitleEl.textContent = sound._formatTrackTitle(trk);
      }
    }

    renderDispatchHub() {
      this.gameState = 'menu';
      sound.suspendForMenu();
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
                <div class="settings-section-title"><span>🚗 DRIVING & MOVEMENT</span></div>
                <div class="settings-row"><span class="settings-label">Accelerate / Walk Forward</span><span class="slider-val">W / ↑</span></div>
                <div class="settings-row"><span class="settings-label">Brake / Reverse / Walk Back</span><span class="slider-val">S / ↓</span></div>
                <div class="settings-row"><span class="settings-label">Steer / Turn Left & Right</span><span class="slider-val">A / D or ← / →</span></div>

                <div class="settings-section-title" style="margin-top: 14px;"><span>📦 PARCEL ACTIONS & COURIER MODE</span></div>
                <div class="settings-row"><span class="settings-label">Toss 3D Parcel (Vehicle)</span><span class="slider-val">[SPACE] or Click</span></div>
                <div class="settings-row"><span class="settings-label">Doorstep Delivery (On Foot)</span><span class="slider-val">[SPACE] or Click</span></div>
                <div class="settings-row"><span class="settings-label">Hop Out / Enter Vehicle</span><span class="slider-val">[E]</span></div>

                <div class="settings-section-title" style="margin-top: 14px;"><span>🛠️ ASSISTS, CAMERA & ENVIRONMENT</span></div>
                <div class="settings-row"><span class="settings-label">AI Autopilot Cruise</span><span class="slider-val">[F]</span></div>
                <div class="settings-row"><span class="settings-label">Return to Road (Recenter)</span><span class="slider-val">[R]</span></div>
                <div class="settings-row"><span class="settings-label">Cycle Camera View</span><span class="slider-val">[C]</span></div>
                <div class="settings-row"><span class="settings-label">Cycle Time of Day</span><span class="slider-val">[T]</span></div>
                <div class="settings-row"><span class="settings-label">Toggle Rain</span><span class="slider-val">[P]</span></div>
                <div class="settings-row"><span class="settings-label">Delivery Status Manifest</span><span class="slider-val">[V]</span></div>

                <div class="settings-section-title" style="margin-top: 14px;"><span>📻 DHABA FM & AUDIO CONTROLS</span></div>
                <div class="settings-row"><span class="settings-label">Cycle Radio Stations</span><span class="slider-val">[L]</span></div>
                <div class="settings-row"><span class="settings-label">Mute / Unmute Radio</span><span class="slider-val">[M]</span></div>
                <div class="settings-row"><span class="settings-label">Mute / Unmute SFX & Engine</span><span class="slider-val">[N]</span></div>
                <div class="settings-row"><span class="settings-label">Controls & Settings Menu</span><span class="slider-val">[H] or [ESC]</span></div>
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

    // Fades out thin roadside props (poles, lampposts) when they sit
    // directly between the on-foot follow camera and the courier — a pole
    // right next to a house the camera lingers close to otherwise reads as
    // clipping straight through the character. Raycasts camera->subject,
    // fades anything hit down to translucent, and restores anything no
    // longer hit back to opaque.
    updateOccluderFade(dt, subjectPos) {
      if (!this.world || !this.world.occluderMeshes || !this.world.occluderMeshes.length) return;
      if (!this._occluderRaycaster) this._occluderRaycaster = new THREE.Raycaster();
      if (!this._fadedOccluders) this._fadedOccluders = new Set();

      const camPos = this.camera.position;
      const toSubject = subjectPos.clone().sub(camPos);
      const dist = toSubject.length();
      if (dist < 0.01) return;
      toSubject.normalize();

      this._occluderRaycaster.set(camPos, toSubject);
      this._occluderRaycaster.far = dist - 0.3; // stop short of the subject itself
      this._occluderRaycaster.near = 0.1;

      const hits = this._occluderRaycaster.intersectObjects(this.world.occluderMeshes, true);
      const hitRoots = new Set();
      hits.forEach(h => {
        let o = h.object;
        while (o.parent && !this.world.occluderMeshes.includes(o)) o = o.parent;
        hitRoots.add(o);
      });

      const FADE_TARGET = 0.18;
      const fadeLerp = Math.min(1.0, 1.0 - Math.exp(-10.0 * dt));

      hitRoots.forEach(root => {
        this._fadedOccluders.add(root);
        root.traverse(n => {
          if (n.isMesh && n.material) {
            n.material.transparent = true;
            n.material.opacity = THREE.MathUtils.lerp(n.material.opacity ?? 1, FADE_TARGET, fadeLerp);
          }
        });
      });

      // Restore anything that was faded last frame but isn't hit anymore.
      this._fadedOccluders.forEach(root => {
        if (hitRoots.has(root)) return;
        let done = true;
        root.traverse(n => {
          if (n.isMesh && n.material) {
            n.material.opacity = THREE.MathUtils.lerp(n.material.opacity ?? 1, 1.0, fadeLerp);
            if (n.material.opacity < 0.98) done = false;
            else { n.material.opacity = 1.0; n.material.transparent = false; }
          }
        });
        if (done) this._fadedOccluders.delete(root);
      });
    }

    updateCamera(dt) {
      if (this.onFoot && this.walkerMesh) {
        // Simple third-person follow cam for the on-foot courier — reuses
        // the same spring-lerp feel as the chase cam, just closer/lower
        // since the subject is a person, not a vehicle.
        const walkerPos = this.walkerMesh.position;
        const walkerForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.walkerMesh.quaternion).normalize();
        const targetCamPos = walkerPos.clone()
          .addScaledVector(walkerForward, -3.4)
          .add(new THREE.Vector3(0, 1.9, 0));
        const posLerp = Math.min(1.0, 1.0 - Math.exp(-16.0 * dt));
        this.camera.position.lerp(targetCamPos, posLerp);
        const lookTarget = walkerPos.clone().add(new THREE.Vector3(0, 1.1, 0));
        this.camera.lookAt(lookTarget);
        this.updateOccluderFade(dt, lookTarget);
        return;
      }

      if (!this.vehicle || !this.vehicle.mesh) return;

      // First-Person mode showed a solid pink fill along the frame edge —
      // the eye position sits inside the car's own solid body geometry
      // (there's no modeled cabin cavity to place a camera inside), so the
      // near side of the frustum renders the inside of that mesh. Pushing
      // the eye position further out risks re-clipping on bumps/roll at
      // some point in the frame even if a static test spot looks clear —
      // the standard fix most driving games use instead: hide the car's
      // own mesh while in first-person, the same way you don't render your
      // own head in a real cockpit view.
      this.vehicle.mesh.visible = this.activeCameraMode !== 'first-person';

      const carPos = this.vehicle.mesh.position;
      const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicle.mesh.quaternion).normalize();

      if (!this.camLookTarget) {
        this.camLookTarget = carPos.clone().addScaledVector(carForward, 18.0);
      }

      if (this.activeCameraMode === 'hood') {
        // Bumper Cam - rigidly bolted at bumper height (see toggleCameraMode
        // comment — this was labeled "hood" but sits at bumper height)
        const hoodPos = carPos.clone().addScaledVector(carForward, 1.35).add(new THREE.Vector3(0, 0.82, 0));
        this.camera.position.copy(hoodPos);
        const lookTarget = hoodPos.clone().addScaledVector(carForward, 35.0);
        this.camera.lookAt(lookTarget);
      } else if (this.activeCameraMode === 'first-person') {
        // True in-cabin view — driver eye height, seated near the
        // windshield rather than out on the bumper. Rigidly bolted (no
        // lerp/spring), same as bumper cam: a cockpit view that lags the
        // car's own motion reads as broken, not cinematic.
        const eyePos = carPos.clone().addScaledVector(carForward, 0.15).add(new THREE.Vector3(0, 1.15, 0));
        this.camera.position.copy(eyePos);
        const lookTarget = eyePos.clone().addScaledVector(carForward, 35.0);
        this.camera.lookAt(lookTarget);
      } else if (this.activeCameraMode === 'far-chase') {
        // Same glued-chase behavior as the default chase cam below, just
        // pulled back and raised further for a wider, more cinematic frame
        // — slowroads' "Far Chase" relative to its "Chase".
        const targetCamPos = carPos.clone()
          .addScaledVector(carForward, -11.5)
          .add(new THREE.Vector3(0, 4.4, 0));
        const posLerp = Math.min(1.0, 1.0 - Math.exp(-16.0 * dt));
        this.camera.position.lerp(targetCamPos, posLerp);

        const minY = carPos.y + 2.6;
        const maxY = carPos.y + 6.5;
        this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y, minY, maxY);

        const rawLookTarget = carPos.clone()
          .addScaledVector(carForward, 20.0)
          .add(new THREE.Vector3(0, 0.8, 0));
        const lookLerp = Math.min(1.0, 1.0 - Math.exp(-22.0 * dt));
        this.camLookTarget.lerp(rawLookTarget, lookLerp);
        this.camera.lookAt(this.camLookTarget);
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
      // terrain underneath, so on a steep embankment the camera's (x,z)
      // could in principle end up inside solid ground.
      //
      // This used to clamp against getRawTerrainHeight — the raw,
      // un-carved noise terrain — which is wrong: the road is explicitly
      // carved BELOW raw terrain on hills (see createTerrainMesh's
      // embankment cut), so on any hill this clamp yanked the camera up
      // to the height of the surrounding hillside instead of the actual
      // road, producing a sudden top-down-looking view for no visible
      // reason. The car's own position is already the correct, carved
      // road height at this exact point — use that instead. (The chase
      // branch above already clamps to carPos.y+[1.6,4.2]; this is only a
      // backstop for the sky/drone mode, which has no such clamp.)
      if (this.activeCameraMode !== 'hood' && this.activeCameraMode !== 'first-person') {
        const minClearance = carPos.y + 1.0;
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
        // "AHEAD" was hardcoded regardless of actual position — once a
        // house has been driven past (still undelivered while its timer
        // runs out), it's the nearest target again geometrically, but it's
        // behind the car, not ahead of it. Same forward vector already
        // computed above, just previously unused for this.
        const aheadText = carForward.dot(toTarget) > 0 ? 'AHEAD' : 'BEHIND';

        if (wpTargetEl) wpTargetEl.textContent = nextTarget.order.name;
        if (wpDistEl) wpDistEl.textContent = `${distMeters}m ${aheadText} [${sideText}]`;
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
        if (this.onFoot) {
          this.updateWalking(dt);
        } else {
          this.vehicle.update(dt, this.keys, this.world, this.selectedSeason, this.selectedRoadTerrain);
        }
        this.world.updateTraffic(dt);
        this.world.updateCrossers(dt);
        this.checkCrosserCollisions();
        if (this.rain && this.vehicle && this.vehicle.mesh) this.rain.update(dt, this.vehicle.mesh.position);
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

        // Infinite Highway District Transition (Option B)
        // When vehicle reaches the end of the scenic 5km route corridor (u >= 0.96),
        // smoothly transition to the next highway district with fresh orders and bonus cash!
        if (!this.onFoot && this.vehicle.splineProgress >= 0.96 && !this.districtTransitioning) {
          this.districtTransitioning = true;
          this.currentDistrict = (this.currentDistrict || 1) + 1;
          const bonus = 150;
          this.earnings += bonus;
          sound.playRepair();
          this.addNotification(`🏙️ ENTERED DISTRICT ${this.currentDistrict}! Highway Bonus +₹${bonus}`, 'success', 4000);
          this.showScorePopup(bonus, `DISTRICT ${this.currentDistrict} REACHED!`);

          // Smoothly reset vehicle to route start preserving speed & momentum
          this.vehicle.resetToSpline(this.world.curve, 0.008, true);

          // Reset order targets for continuous delivery gameplay
          if (this.world.deliveryTargets) {
            this.world.deliveryTargets.forEach(t => {
              t.delivered = false;
              t.missed = false;
              if (t.mesh) t.mesh.visible = true;
            });
            this.activeOrderIndex = 0;
            this.updateActiveOrderCard();
          }

          setTimeout(() => { this.districtTransitioning = false; }, 3500);
        }

        // Automatic Breakdown & Stuck Recovery Detection — skipped while on
        // foot: the vehicle is deliberately parked and stationary, so the
        // same conditions that mean "stuck" while driving are just normal
        // here.
        if (this.onFoot) {
          this.stuckTimer = 0;
        } else if (this.vehicle.health <= 0) {
          this.showStuckRecoveryModal(this.crashReason || 'VEHICLE BREAKDOWN: Suspension & Engine Failure');
          this.crashReason = null;
        } else if ((this.keys.w || this.keys.up || this.keys.s || this.keys.down) && Math.abs(this.vehicle.speed) < 0.45 && Math.abs(this.vehicle.lateralOffset) > (CONFIG.ROAD_WIDTH * 0.45)) {
          this.stuckTimer += dt;
          if (this.stuckTimer > 2.4) {
            this.showStuckRecoveryModal('VEHICLE IMMOBILIZED: Roadside Boundary');
          }
        } else {
          this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2.0);
        }

        // Off-Road Lost Detection — show Return to Road banner (skipped on
        // foot for the same reason as above)
        if (!this.onFoot && this.world && this.world.curve && this.vehicle) {
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

      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
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
