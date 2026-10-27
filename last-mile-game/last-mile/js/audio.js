(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const { isPedalVehicle, hornStyle } = S;

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.masterFilter = null;
      // One mute flag for all game audio (SFX, engine, wind). The radio was
      // removed entirely (B112), so there is nothing else to mute.
      this.sfxMuted = false;
      try { this.sfxMuted = localStorage.getItem('shiplyp_sfx_muted') === '1'; } catch (e) { /* storage blocked: start unmuted */ }
      // Whenever gameState isn't 'playing' (menu, dispatch hub, restart),
      // all audio is fully suspended regardless of the mute flag.
      // Initialized to TRUE so nothing plays until the player starts driving.
      this.suspended = true;
      // Clear preferences left behind by the removed radio.
      try {
        ['shiplyp_radio_muted', 'shiplyp_radio_channel', 'shiplyp_radio_pref']
          .forEach(k => localStorage.removeItem(k));
      } catch (e) {}

      const init = () => {
        this.ensure();
      };
      window.addEventListener('click', init, { once: true });
      window.addEventListener('keydown', init, { once: true });
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
      if (this.ctx && this.ctx.state === 'suspended' && !this._silenced) this.ctx.resume();
      return this.ctx;
    }

    get muted() { return this.sfxMuted; }

    // Hard silence for ads and hidden tabs. Separate from the player's own mute
    // setting (sfxMuted), so ending an ad never un-mutes a muted player.
    mute() {
      this._silenced = true;
      try { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); } catch (e) {}
    }

    unmute() {
      this._silenced = false;
      try { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) {}
    }

    toggleMute() {
      this.sfxMuted = !this.sfxMuted;
      try { localStorage.setItem('shiplyp_sfx_muted', this.sfxMuted ? '1' : '0'); } catch (e) {}
      return this.sfxMuted;
    }

    // Fully suspends all audio regardless of the mute flag — called whenever
    // the player isn't actively in a driving run (menu, dispatch hub,
    // restart) so nothing plays behind a menu screen.
    suspendForMenu() {
      this.suspended = true;
    }

    resumeForGameplay() {
      this.suspended = false;
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


    playCombo() {
      if (this.suspended || this.sfxMuted) return;
      this.playTone(659, 'sine', 0.1, 0.20);
      setTimeout(() => this.playTone(880, 'sine', 0.12, 0.20), 80);
      setTimeout(() => this.playTone(1174, 'sine', 0.2, 0.20), 160);
    }

    playDeliverySuccess() {
      if (this.suspended || this.sfxMuted) return;
      this.playTone(523, 'sine', 0.12, 0.22);
      setTimeout(() => this.playTone(659, 'sine', 0.12, 0.22), 90);
      setTimeout(() => this.playTone(784, 'sine', 0.15, 0.25), 180);
      setTimeout(() => this.playTone(1046, 'sine', 0.25, 0.28), 270);
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

    playBarrierScrape() {
      if (this.suspended || this.sfxMuted || !this.ctx) return;
      const now = this.ctx.currentTime;
      if (this._lastScrapeTime && now - this._lastScrapeTime < 0.25) return;
      this._lastScrapeTime = now;
      this.playTone(180, 'triangle', 0.12, 0.18);
      setTimeout(() => this.playTone(120, 'sine', 0.15, 0.15), 40);
    }

    playHorn(vehicleType = 'musclecoupe') {
      if (this.suspended || this.sfxMuted) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      if (this._lastHornTime && now - this._lastHornTime < 0.28) return;
      this._lastHornTime = now;

      const style = hornStyle(vehicleType);
      if (style === 'bell') {
        // Bicycle Bell: classic high-pitch twin-chime "ting-ting"
        const ringBell = (t, freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.35, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          osc.connect(gain);
          gain.connect(this.masterFilter || ctx.destination);
          osc.start(t);
          osc.stop(t + 0.2);
        };
        ringBell(now, 1760);        // A6
        ringBell(now + 0.08, 2093);  // C7
        ringBell(now + 0.18, 1760);  // A6
      } else if (style === 'beep') {
        // Small-engine horn (motorbike / three-wheeler): short, bright two-tone "beep-beep".
        const beep = (t) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(620, t);
          osc.frequency.setValueAtTime(740, t + 0.05);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          osc.connect(gain);
          gain.connect(this.masterFilter || ctx.destination);
          osc.start(t);
          osc.stop(t + 0.13);
        };
        beep(now);
        beep(now + 0.17);
      } else {
        // Automotive Dual-Tone Electric Horn: 392Hz (G4) + 494Hz (B4)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(392, now);
        osc2.frequency.setValueAtTime(494, now);
        gain.gain.setValueAtTime(0.26, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterFilter || ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.35);
        osc2.stop(now + 0.35);
      }
    }

    // Procedural Driving Ambience (Engine load pitch & wind noise filter)
    _initAmbience() {
      if (this._ambienceInitialized || !this.ctx) return;
      this._ambienceInitialized = true;
      const ctx = this.ctx;

      try {
        // 1. Warm Engine Hum (dual harmonic oscillators + lowpass filter)
        this.engineGain = ctx.createGain();
        this.engineGain.gain.setValueAtTime(0, ctx.currentTime);
        this.engineFilter = ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(260, ctx.currentTime);

        this.engineOsc1 = ctx.createOscillator();
        this.engineOsc1.type = 'triangle';
        this.engineOsc1.frequency.setValueAtTime(55, ctx.currentTime);

        this.engineOsc2 = ctx.createOscillator();
        this.engineOsc2.type = 'sine';
        this.engineOsc2.frequency.setValueAtTime(110, ctx.currentTime);

        this.engineOsc1.connect(this.engineFilter);
        this.engineOsc2.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.masterFilter || ctx.destination);

        this.engineOsc1.start();
        this.engineOsc2.start();

        // 2. Continuous Wind Noise (pink noise buffer with velocity bandpass)
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          output[i] = (b0 + b1 + b2 + white * 0.05) * 0.09;
        }
        this.windNoise = ctx.createBufferSource();
        this.windNoise.buffer = noiseBuffer;
        this.windNoise.loop = true;

        this.windFilter = ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.setValueAtTime(400, ctx.currentTime);
        this.windFilter.Q.setValueAtTime(0.8, ctx.currentTime);

        this.windGain = ctx.createGain();
        this.windGain.gain.setValueAtTime(0, ctx.currentTime);

        this.windNoise.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.masterFilter || ctx.destination);
        this.windNoise.start();
      } catch (err) {
        console.warn('Ambience audio initialization deferred:', err);
      }
    }

    updateDrivingAmbience(speed, maxSpeed, accelRatio, vehicleType) {
      if (this.suspended || this.sfxMuted || !this.ctx) {
        if (this.engineGain && this.ctx) this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
        if (this.windGain && this.ctx) this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);
        return;
      }
      this._initAmbience();
      const now = this.ctx.currentTime;
      const speedRatio = Math.min(1.0, Math.abs(speed || 0) / (maxSpeed || 40));
      const isPedal = isPedalVehicle(vehicleType);

      // Engine hum — silent for pedal vehicles
      if (!isPedal) {
        const gearCycle = (speedRatio * 3.6) % 1.0;
        const rpmFreq = 46 + gearCycle * 52 + speedRatio * 38;
        if (this.engineOsc1) this.engineOsc1.frequency.setTargetAtTime(rpmFreq, now, 0.06);
        if (this.engineOsc2) this.engineOsc2.frequency.setTargetAtTime(rpmFreq * 1.5, now, 0.06);
        const targetEngineVol = 0.02 + (Math.abs(accelRatio || 0) > 0.5 ? 0.035 : 0.008) + speedRatio * 0.035;
        if (this.engineGain) this.engineGain.gain.setTargetAtTime(targetEngineVol, now, 0.08);
      } else {
        if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, now, 0.1);
      }

      // Wind noise volume and aerodynamic cutoff scaling
      const windVol = Math.pow(speedRatio, 1.8) * 0.07;
      const windCutoff = 320 + speedRatio * 1150;
      if (this.windGain) this.windGain.gain.setTargetAtTime(windVol, now, 0.1);
      if (this.windFilter) this.windFilter.frequency.setTargetAtTime(windCutoff, now, 0.1);
    }
  }

  const sound = new SoundEngine();

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
  window.sound = sound;

  S.SoundEngine = SoundEngine;
  S.sound = sound;
})();
