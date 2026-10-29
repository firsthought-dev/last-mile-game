(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};

  class RainSystem {
    constructor(scene) {
      this.scene = scene;
      this.count = 1200; // denser than snow — explicit spec
      this.fallSpeed = 9.0; // m/s — real rain terminal velocity range, noticeably faster than snow's ~2 m/s per spec ("will fall on the ground faster")
      this.bendFactor = 0.35; // horizontal drift rate as a fraction of vehicle speed — 0 at rest (perfectly vertical), increasing smoothly with speed
      this.boxHalfWidth = 22.0;
      this.boxHeight = 18.0;
      this.boxDepth = 46.0;

      const geom = new THREE.BufferGeometry();
      this.positions = new Float32Array(this.count * 3);
      for (let i = 0; i < this.count; i++) {
        this.positions[i * 3] = (Math.random() - 0.5) * 2 * this.boxHalfWidth;
        this.positions[i * 3 + 1] = Math.random() * this.boxHeight;
        this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.boxDepth;
      }
      geom.setAttribute('position', new THREE.BufferAttribute(this.positions.slice(), 3));

      const mat = new THREE.PointsMaterial({
        color: 0xd8e2ec,
        // 0.22 (matching a literal raindrop's real-world diameter) rendered
        // essentially invisible on screen at any normal camera distance —
        // confirmed directly: bumping to 2.0 live made drops suddenly
        // obvious, 0.6 was the smallest size that stayed clearly visible
        // without reading as a blurry blob. Visual size, not physical
        // accuracy, is what actually matters here.
        size: 0.6,
        map: this._makeSoftDotTexture(),
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        sizeAttenuation: true // near-camera particles read larger/blurrier, distant ones shrink to pinpricks — matches the reference's perspective-scaled look
      });
      this.points = new THREE.Points(geom, mat);
      this.points.frustumCulled = false;
      this.points.visible = false;
      scene.add(this.points);
    }

    // Soft, round, gaussian-blur-like falloff — no bundled image asset,
    // generated once at runtime the same way the reference appears to.
    _makeSoftDotTexture() {
      const size = 64;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(c);
    }


    // `center` is the point the volume rides around (the vehicle position)
    // — passed unconditionally every frame regardless of vehicle speed, so
    // the volume keeps falling/recentering even while idling, matching the
    // reference (tied to position, not speed). `forward`/`speed`: the
    // vehicle's current heading and speed, driving the backward bend —
    // at speed 0 the bend term is exactly 0 (perfectly vertical fall);
    // each particle accumulates horizontal drift only for as long as it's
    // actually been falling, which is what makes a constant-angle lean
    // happen naturally rather than needing to compute an angle directly —
    // exactly how it works physically.
    update(dt, center, forward, speed) {
      if (!this.points.visible) return;
      const fall = this.fallSpeed * dt;
      const bendX = -forward.x * speed * this.bendFactor * dt;
      const bendZ = -forward.z * speed * this.bendFactor * dt;
      for (let i = 0; i < this.count; i++) {
        let y = this.positions[i * 3 + 1] - fall;
        let x = this.positions[i * 3] + bendX;
        let z = this.positions[i * 3 + 2] + bendZ;
        if (y < 0) {
          y = this.boxHeight;
          x = (Math.random() - 0.5) * 2 * this.boxHalfWidth;
          z = (Math.random() - 0.5) * this.boxDepth;
        }
        // Keep the bend-accumulated drift bounded to the box, same wrap
        // used for the old fixed-drift version, so a long fast drive
        // doesn't walk particles arbitrarily far from the vehicle.
        if (x < -this.boxHalfWidth) x = this.boxHalfWidth;
        if (x > this.boxHalfWidth) x = -this.boxHalfWidth;
        if (z < -this.boxDepth / 2) z = this.boxDepth / 2;
        if (z > this.boxDepth / 2) z = -this.boxDepth / 2;
        this.positions[i * 3] = x;
        this.positions[i * 3 + 1] = y;
        this.positions[i * 3 + 2] = z;
      }
      const posAttr = this.points.geometry.getAttribute('position');
      for (let i = 0; i < this.count; i++) {
        posAttr.setXYZ(i,
          center.x + this.positions[i * 3],
          center.y + this.positions[i * 3 + 1],
          center.z + this.positions[i * 3 + 2]
        );
      }
      posAttr.needsUpdate = true;
    }
  }

  // --------------------------------------------------------------------------
  // 7a. VISUAL STYLE SYSTEM
  // --------------------------------------------------------------------------
  // Cinematic is the only look: bloom + FXAA + a colour grade over the film
  // pass. Crisp (sharp outlines, whose normal pre-pass re-rendered the whole
  // scene every frame) was removed, as Classic was before it (B116). The class
  // and its public names stay so the fog code keeps working and a second look
  // can come back later without new plumbing.

  class VisualStyleManager {
    static STYLES = ['cinematic'];
    static DEFAULT_STYLE = 'cinematic';
    // Absolute fog density override per style. Empty: Cinematic uses the live
    // time-of-day density (engine-env.js falls back to it for any missing key).
    static FOG_DENSITY = {};

    constructor(game) {
      this.game = game;
      this.currentStyle = null;
      this.selectedStyle = VisualStyleManager.DEFAULT_STYLE;

      // --- Color Grade Shader (Tier 5 — final polish pass) ---
      const ColorGradeShader = {
        uniforms: {
          tDiffuse: { value: null },
          contrast: { value: 1.0 },
          saturation: { value: 1.0 }
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float contrast;
          uniform float saturation;
          varying vec2 vUv;
          void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec3 col = (texel.rgb - 0.5) * contrast + 0.5;
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(lum), col, saturation);
            gl_FragColor = vec4(col, texel.a);
          }
        `
      };
      this.gradePass = new THREE.ShaderPass(ColorGradeShader);
      this.gradePass.enabled = false;
      this.gradePass.renderToScreen = false;

      // Append the grade pass after the base passes.
      // Order: RenderPass | bloomPass | filmPass | fxaaPass | gradePass
      game.composer.passes.push(this.gradePass);

      // Apply the style immediately — no transition ceremony. This also stores
      // it, which rewrites a saved Crisp (or the older Enhanced / Classic)
      // choice to Cinematic for players who had picked one of those.
      this.applyStyle(this.selectedStyle);
    }

    applyStyle(style) {
      if (!VisualStyleManager.STYLES.includes(style)) style = VisualStyleManager.DEFAULT_STYLE;
      if (style === this.currentStyle) return;
      this.currentStyle = style;
      this.selectedStyle = style;
      try { localStorage.setItem('shiplyp_visualStyle', style); } catch (e) { /* storage blocked: the style is not remembered */ }

      const { bloomPass, filmPass, fxaaPass } = this.game;

      // --- Bloom + FXAA + color grade ---
      bloomPass.enabled = true;
      fxaaPass.enabled = true;
      this.gradePass.enabled = true;
      bloomPass.strength = 0.25; bloomPass.radius = 0.35; bloomPass.threshold = 0.94;
      this.gradePass.uniforms['contrast'].value = 1.12;
      this.gradePass.uniforms['saturation'].value = 1.15;

      // --- Film shader uniforms ---
      const u = filmPass.uniforms || (filmPass.material && filmPass.material.uniforms);
      if (u) u.saturationMult.value = 0.82;

      // --- renderToScreen: must be true on the last enabled pass (the grade) ---
      bloomPass.renderToScreen      = false;
      filmPass.renderToScreen       = false;
      fxaaPass.renderToScreen       = false;
      this.gradePass.renderToScreen = true;
    }
  }

  // Quality tiers (WI-14). Two tiers, Medium and High, set the cost knobs:
  // shadows, the render-scale ceiling and the frame cap. The player's choice is
  // 'auto', 'medium' or 'high'; 'auto' starts from a device probe and can step
  // down once from High to Medium if the measured frame rate stays low.
  // Caps for systems that do not exist yet (AI traffic, pedestrians) are only
  // published here, for those systems to read.
  class QualityManager {
    static TIERS = {
      medium: {
        shadows: false,
        maxPixelRatio: 1.25,
        fpsCap: 30,
        aiCap: 12,              // AI traffic vehicles at once (js/traffic.js TARGET)
        pedestrianScale: 0.6,   // share of verge pedestrians kept at world build
      },
      high: {
        shadows: true,
        maxPixelRatio: 2,
        fpsCap: 0,              // 0 = display rate
        aiCap: 20,
        pedestrianScale: 1,
      },
    };
    static CHOICES = ['auto', 'medium', 'high'];
    static CHOICE_KEY = 'shiplyp_qualityTier';
    static AUTO_KEY = 'shiplyp_qualityAuto'; // remembers an auto step-down across launches

    constructor(game) {
      this.game = game;
      this.choice = QualityManager._read(QualityManager.CHOICE_KEY);
      if (!QualityManager.CHOICES.includes(this.choice)) this.choice = 'auto';
      this.probe = QualityManager.probeDevice(game.renderer);
      this._lowWindows = 0;
      this._autoSettled = false;
      this.tierName = null;
      this.apply(this.resolve());
    }

    static _read(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    static _write(key, value) {
      try {
        if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value);
      } catch (e) { /* storage blocked: the choice lasts for this session only */ }
    }

    // Cheap, synchronous guess from what the browser reports. Phones start on
    // Medium unless they report plenty of memory and cores and a GPU that is
    // not on the low list; desktops start on High.
    static probeDevice(renderer) {
      const nav = typeof navigator !== 'undefined' ? navigator : {};
      const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      const memory = nav.deviceMemory || 0;          // GB, Chrome only; 0 = unknown
      const cores = nav.hardwareConcurrency || 0;
      let gpu = '';
      try {
        const gl = renderer && renderer.getContext && renderer.getContext();
        const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
      } catch (e) { /* no renderer info: decide from the rest */ }
      const lowGpu = /swiftshader|llvmpipe|software|mali-[34]|mali-t|adreno \(tm\) [345]\d\d|powervr|sgx/i.test(gpu);
      const reasons = [];
      let tier = 'high';
      if (lowGpu) { tier = 'medium'; reasons.push('gpu'); }
      if (memory && memory <= 4) { tier = 'medium'; reasons.push('memory'); }
      if (coarse && !(memory >= 6 && cores >= 8 && !lowGpu)) { tier = 'medium'; reasons.push('phone'); }
      return { tier, coarse, memory, cores, gpu, reasons };
    }

    resolve() {
      if (this.choice !== 'auto') return this.choice;
      const remembered = QualityManager._read(QualityManager.AUTO_KEY);
      if (remembered === 'medium') return 'medium';
      return this.probe.tier;
    }

    get tier() { return QualityManager.TIERS[this.tierName]; }

    setChoice(choice) {
      if (!QualityManager.CHOICES.includes(choice)) choice = 'auto';
      this.choice = choice;
      QualityManager._write(QualityManager.CHOICE_KEY, choice);
      this._lowWindows = 0;
      this._autoSettled = false;
      this.apply(this.resolve());
    }

    apply(name) {
      const tier = QualityManager.TIERS[name] || QualityManager.TIERS.high;
      const changed = name !== this.tierName;
      const shadowsChanged = this.tierName == null || this.tier.shadows !== tier.shadows;
      this.tierName = name;
      const g = this.game;

      // Shadow maps are compiled into every lit material, so a live switch has
      // to recompile them once.
      if (g.renderer && g.renderer.shadowMap) {
        g.renderer.shadowMap.enabled = tier.shadows;
        if (g.sunLight) g.sunLight.castShadow = tier.shadows;
        if (shadowsChanged && g.scene) {
          g.scene.traverse(o => {
            if (!o.material) return;
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; });
          });
        }
      }

      // Narrow the adaptive render scale's ceiling; `_adaptRenderScale` still
      // moves within [1, cap] from the measured frame rate.
      if (g._prBaseCap == null) g._prBaseCap = g._prCap || 1;
      g._prCap = Math.max(1, Math.min(g._prBaseCap, tier.maxPixelRatio));
      if (g._pr > g._prCap && g.renderer) {
        g._pr = g._prCap;
        g.renderer.setPixelRatio(g._pr);
        if (g.composer && g.composer.setPixelRatio) g.composer.setPixelRatio(g._pr);
        if (g._handleResize) g._handleResize(true);
      }

      g.fpsCap = tier.fpsCap;
      if (g.traffic && g.traffic.opt) g.traffic.opt.TARGET = tier.aiCap; // a switch mid-drive: extra cars just stop respawning
      if (g.world) g.world._pedKeep = tier.pedestrianScale;
      if (changed) g._prSlow = g._prFast = 0;
    }

    // Called once per FPS window (~0.5 s) with the measured rate. In auto mode,
    // High steps down to Medium after ~10 s of play below 40 fps that the render
    // scale has already dropped as far as it can. Only once per launch, and
    // remembered, so a slow phone does not start on High every time.
    sampleFps(fps) {
      if (this.choice !== 'auto' || this._autoSettled || this.tierName !== 'high') return;
      const g = this.game;
      if (!g._worldBuilt || g.gameState !== 'playing' || g._adPaused || document.hidden) return;
      if (fps < 40 && g._pr <= 1) this._lowWindows++;
      else this._lowWindows = Math.max(0, this._lowWindows - 1);
      if (this._lowWindows >= 20) {
        this._autoSettled = true;
        QualityManager._write(QualityManager.AUTO_KEY, 'medium');
        this.apply('medium');
      }
    }

    label() {
      const name = this.tierName === 'medium' ? 'MEDIUM' : 'HIGH';
      return this.choice === 'auto' ? `AUTO (${name})` : name;
    }
  }

  // --------------------------------------------------------------------------
  // 7. MAIN SHIPLYP DISPATCH & MISSION ENGINE
  // --------------------------------------------------------------------------

  S.QualityManager = QualityManager;
  S.RainSystem = RainSystem;
  S.VisualStyleManager = VisualStyleManager;
})();
