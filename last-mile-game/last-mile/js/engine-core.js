(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    CONFIG, Career, isTwoWheeler, isPedalVehicle, sound, MuscleCoupeAsset, HousesAsset, CrowdAsset,
    VehicleController, RainSystem, VisualStyleManager, ProceduralWorld, UI
  } = S;

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
      this.dayProgress = 0.30; // Continuous day-night cycle progression [0.0, 1.0)
      this.targetDayProgress = null; // Target for smooth animated transitions
      this.selectedWeather = 'clear';
      this.weather = 'clear'; // 'clear', 'blizzard', 'rain' — see SLOWROADS_PARITY_LOG.md item 4
      this.selectedSeed = '5927cd04';
      this.selectedVehicle = (typeof Career !== 'undefined' && Career && typeof Career.selectedVehicle === 'function')
        ? Career.selectedVehicle()
        : 'cycle';
      this.selectedDifficulty = 'medium';
      this.activeDockPanel = null;
      this.activeCameraMode = 'chase';

      // B143: per-shift earnings start at zero (was a leftover ₹280 that the
      // shift summary reported, and its 2x ad paid out, as if earned).
      this.earnings = 0;
      this.deliveriesMade = 0;
      this.missedCount = 0;
      this.streakCount = 1;
      this.activeOrderIndex = 0;
      this.orderTimer = 36.0;
      this.maxOrderTimer = 36.0;
      this.deliveryHistory = [];

      this.resumeCount = 0;
      this.maxResumes = 3;
      this.savedProgressCheckpoint = null;
      this.isStuckModalOpen = false;
      this.stuckTimer = 0;
      this.lostFromRoad = false;
      this.offRoadTimer = 0;

      // Wanted meter: builds up from hitting pedestrians/animals, decays
      // when clean. Hitting max sends the player to jail instead of an
      // instant fail on the first hit — see checkCrosserCollisions.
      this.wantedLevel = 0;
      this.maxWantedLevel = 3;
      this.wantedDecayTimer = 0;
      this.isJailed = false;

      // Vestige of the removed get-out-and-walk delivery mode: the bonus
      // fields below are still read by the toss path.
      this.walkerParkedVehiclePos = null;
      this.walkBonusOrderIndex = -1;
      this.WALK_TIME_BONUS = 22.0;

      this.parcels = []; // 3D In-flight projectiles
      this.particles = []; // 3D Procedural Particle FX System

      this.keys = { up: false, down: false, left: false, right: false, w: false, s: false, a: false, d: false, space: false, steerInput: 0 };
      this._touchSteerActive = false;
      this._touchSteerStartX = 0;
      this._touchSteerPointerId = -1;
      this.inactivityTimer = 0;
      this.inputFrozen = false;
      this._adPaused = false;
      this._shiftDoubleClaimed = false;
      this._sponsorAdCooldown = 0;

      if (typeof ShiplypAds !== 'undefined' && ShiplypAds) {
        ShiplypAds.init(
          { debug: false },
          {
            onPauseGame: () => { this._adPaused = true; },
            onResumeGame: () => { this._adPaused = false; },
            onMuteAudio: () => { sound.mute(); },
            onResumeAudio: () => { sound.unmute(); }
          }
        );
      }

      this.initThree();
      this.initEvents();
      this.initVisibilityPause();
      this.initHUD();
      this.clock = new THREE.Clock();
      this._worldBuilt = false;

      // Landing screen first: pick road style / vehicle / visual style,
      // then DRIVE triggers the loader + world build (see renderDispatchHub).
      // The full-screen loader overlay is only needed once that starts.
      const loaderEl = document.getElementById('game-loader');
      if (loaderEl) loaderEl.style.display = 'none';

      // Daily check-in runs once per session, before the hub is rendered so
      // the strip below already reflects today's streak and bonus. It is
      // idempotent within a calendar day — reopening the hub does not pay twice.
      this._dailyCheckIn = Career ? Career.checkIn() : null;

      // First-run onboarding: active when the player has zero career deliveries.
      // Cleared permanently after their first successful drop.
      const careerStats = Career ? Career.career() : null;
      this._onboardingActive = careerStats ? (careerStats.deliveries === 0 && careerStats.shifts === 0) : false;
      this._firstOpenTime = this._onboardingActive ? Date.now() : null;
      this._track('app_open', {
        platform: window.ShiplypNativeTelemetry ? 'android' : 'web',
        returning: !!(careerStats && (careerStats.deliveries > 0 || careerStats.shifts > 0)),
        streak: this._dailyCheckIn ? this._dailyCheckIn.streak : 0,
        build: String(window.__BUILD || '')
      });

      this.renderDispatchHub();

      // Play-now: first-time players (and ?play=1 links from portals) go straight
      // to driving; ?play=0 keeps the hub (test scripts). Pressing the hub's own
      // DRIVE button keeps the loader, world build and drive start in one code path.
      const playParam = (window.location.search.match(/[?&]play=([01])\b/) || [])[1];
      if (playParam === '1' || (this._onboardingActive && playParam !== '0')) {
        document.getElementById('btn-start-dispatch')?.click();
      }
    }

    // Portals expect the game to stop and go quiet when the tab is hidden.
    // Browsers already throttle rAF in hidden tabs; this also silences audio and
    // tells the portal SDK that gameplay stopped. _hiddenPaused freezes the frame
    // so nothing moves if the page is hidden in a way that keeps rAF running.

    async _bootWithLoader() {
      const setProgress = (pct, label) => {
        const fill   = document.getElementById('loader-bar-fill');
        const pctEl  = document.getElementById('loader-pct');
        const status = document.getElementById('loader-status');
        const track  = document.getElementById('loader-bar-track');
        if (fill)   fill.style.width = pct + '%';
        if (pctEl)  pctEl.textContent = Math.round(pct) + '%';
        if (status && label) status.textContent = label;
        if (track)  track.setAttribute('aria-valuenow', Math.round(pct));
      };
      const frame = () => new Promise(r => requestAnimationFrame(r));

      setProgress(5, 'Initializing 3D engine...');
      await frame();

      // --- Stage 1: Scene lighting & fog (mirrors buildWorldAndScene preamble) ---
      const season         = CONFIG.SEASONS[this.selectedSeason];
      const tod            = CONFIG.TIME_OF_DAY[this.selectedTimeOfDay] || CONFIG.TIME_OF_DAY.day;
      const skyBottomHex   = tod.skyBottom;
      const fogHex         = tod.fog;
      const fogDensityVal  = tod.fogDensity;

      this.scene.background = new THREE.Color(skyBottomHex);
      this.scene.fog = new THREE.FogExp2(fogHex, fogDensityVal);
      if (this.ambientLight) { this.ambientLight.color.setHex(tod.ambientColor); this.ambientLight.intensity = tod.ambientIntensity; }
      if (this.sunLight) {
        this.sunLight.color.setHex(tod.sunColor);
        this.sunLight.intensity = tod.sunIntensity;
        this.sunOffset = new THREE.Vector3(...tod.sunPos);
        this.sunLight.position.copy(this.sunOffset);
      }

      setProgress(20, 'Synthesizing Western Ghats highway spline...');
      await frame();

      // --- Stage 2: World object + sky dome + road ---
      this.world = new ProceduralWorld(this.selectedSeed, this.selectedSeason, this.selectedCity);
      this.world._game = this;
      this.scene.add(this.world.createSkyDome(season, this.selectedTimeOfDay));
      this.scene.add(this.world.createRoadMesh());
      if (this._sidewalks) this.scene.remove(this._sidewalks);
      this._sidewalks = this.world.buildSidewalkRange(0, 1);
      this.scene.add(this._sidewalks);
      this.scene.add(this.world.createLaneMarkingMeshes());

      setProgress(45, 'Sculpting mountain valley terrain & road verges...');
      await frame();

      // --- Stage 3: Terrain, tunnels, arches ---
      this.scene.add(this.world.createWorldFloor(season));
      this.scene.add(this.world.createTerrainMesh(season));
      this.scene.add(this.world.createTunnelMeshes());
      this.world.createMountainArches(this.scene, season);

      setProgress(65, 'Placing hillside cantilever villas & turnout plinths...');
      await frame();

      // --- Stage 4: Foliage, props, villas, rocks (heaviest stage) ---
      // Wait for the house models (up to 8 s; a failed or slow load falls back to the old
      // swap-in-later path). Play-now builds the world at once, before houses.glb arrives,
      // and the late swap moved every drop point after the flowers had been laid round the
      // old ones (WI-03).
      const waits = [HousesAsset && HousesAsset.ready, CrowdAsset && CrowdAsset.ready].filter(Boolean);
      if (waits.length) await Promise.race([Promise.all(waits), new Promise((res) => setTimeout(res, 8000))]);

      // First-run: force easy so the first house spawns close and the timer is generous.
      if (this._onboardingActive) this.selectedDifficulty = 'easy';
      this.world.createFoliageAndProps(this.scene, season, this.selectedDifficulty);
      // Built AFTER the props so they can see the buildings, tea stalls and garages (B164).
      if (this._roadsideGrass) this.scene.remove(this._roadsideGrass);
      this._roadsideGrass = this.world.buildRoadsideGrass(0, 1);
      this.scene.add(this._roadsideGrass);
      if (this._groundCover) this.scene.remove(this._groundCover);
      this._groundCover = this.world.buildGroundCover(0, 1, season);
      this.scene.add(this._groundCover);
      if (this._houseFlowers) this.scene.remove(this._houseFlowers);
      this._houseFlowers = this.world.buildHouseFlowers(0, 1);
      this.scene.add(this._houseFlowers);

      // WI-05 (in progress, opt-in): the zone road network with a debug overlay, ?net=1 only.
      if (S.RoadNetwork && /[?&]net=1\b/.test(window.location.search)) {
        this.roadNet = new S.RoadNetwork(this.world).build();
        this.scene.add(this.roadNet.debugGroup());
      }

      setProgress(82, 'Seeding subtropical forests & Sahyadri rockfaces...');
      await frame();

      // --- Stage 5: Vehicle, weather, order card ---
      this.reconcileSelectedVehicle();
      if (!this.vehicle) {
        this.vehicle = new VehicleController(this.scene, this.selectedVehicle);
      } else {
        this.vehicle.setVehicleType(this.selectedVehicle);
      }
      this.vehicle.resetToSpline(this.world.curve, 0.008);
      this.vehicle.setHeadlightsActive(tod.night || tod.id === 'dusk');
      this.applyWindowGlow(tod);
      this.initWeatherSystem();
      const diffCfg = CONFIG.DIFFICULTY_TIERS[this.selectedDifficulty];
      this.maxOrderTimer = diffCfg.timeLimit;
      this.orderTimer = this.maxOrderTimer;
      this.updateActiveOrderCard();

      setProgress(92, 'Compiling PBR shaders & contact shadow maps...');
      await frame();

      // --- Stage 6: WebGL shader pre-compilation & warmup ---
      // Runs renderer.compile() and 3 composer passes while the loader is still
      // opaque, so first-frame shader-compilation stutter is invisible to the player.
      if (this.renderer && this.scene && this.camera) {
        try { this.renderer.compile(this.scene, this.camera); } catch (_) {}
      }
      if (this.composer) {
        await frame(); try { this.composer.render(); } catch (_) {}
        await frame(); try { this.composer.render(); } catch (_) {}
        await frame(); try { this.composer.render(); } catch (_) {}
      }

      setProgress(100, 'Grand Corridor ready. Safe driving!');
      await frame();

      // --- Cinematic fade-out ---
      const loaderEl = document.getElementById('game-loader');
      if (loaderEl) {
        loaderEl.style.pointerEvents = 'none'; // unblock game immediately
        loaderEl.style.opacity = '0';
        setTimeout(() => { loaderEl.style.display = 'none'; }, 700);
      }

      this.startDrive();
      this._booting = false;
      requestAnimationFrame(this.animate.bind(this));
    }


    initThree() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 850);

      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false });
      } catch (e) {
        console.warn('High-performance WebGL initialization failed, falling back to standard WebGL:', e);
        try {
          this.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false });
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
      // Render scale. Phones report device pixel ratios of 2.6-3.5, which at the old
      // cap of 2 meant ~4x the pixels of a 1x render for a look that is soft by design.
      // Start touch devices at 1.5 and let `_adaptRenderScale` move within [1, cap]
      // from the measured frame rate (B147).
      this._prCap = Math.min(window.devicePixelRatio || 1, 2);
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) this._prCap = Math.min(this._prCap, 1.5);
      this._pr = this._prCap;
      this._prSlow = 0; this._prFast = 0; this._prLastRaiseAt = -1e9; this._prLastDropAt = -1e9;
      this.renderer.setPixelRatio(this._pr);
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;

      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);

      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
      this.scene.add(this.ambientLight);

      // Warm soft-white sky / warm neutral ground instead of the previous
      // cool white/slate pairing — this hemisphere light is the scene's
      // main omnidirectional fill, so its tone sets the "soft warm
      // ambient, not directional" feel independent of time-of-day.
      this.hemiLight = new THREE.HemisphereLight(0xfff3e0, 0x8a7a63, 0.22);
      this.scene.add(this.hemiLight);

      this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
      this.sunLight.position.set(150, 250, 100);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 1024;
      this.sunLight.shadow.mapSize.height = 1024;
      // Directional-light shadow cameras never auto-fit the scene — this
      // was left at Three's default orthographic frustum (-5..5 on each
      // axis, i.e. a 10x10 unit box) fixed at world origin, since neither
      // the frustum size nor the light's target was ever set. The result:
      // the car only ever cast a visible ground shadow within ~5 units of
      // the route's spawn point — everywhere else (which is most of a
      // multi-km drive) it rendered with NO contact shadow at all, which
      // reads as the car floating/pasted onto the scene rather than
      // sitting on the road. Widened the frustum to comfortably cover the
      // car and its immediate surroundings, and target/position now
      // recenter on the vehicle every frame (see updateCamera) so the
      // shadow always renders near wherever the car actually is, not just
      // near the spawn point.
      // Tightened from +-30 to +-16 — halving the frustum width roughly
      // quadruples texel density (2048 texels now cover 32 units instead
      // of 60), which is what was actually producing the jagged, blocky
      // shadow edge reported directly ("shadow is very shitty") — the car
      // is only ~4.5m long, so a 32-unit-wide frustum still comfortably
      // covers it plus fence/prop shadows immediately around it without
      // spreading the same 2048x2048 texels over 3.5x more area than
      // needed.
      this.sunLight.shadow.camera.left = -16;
      this.sunLight.shadow.camera.right = 16;
      this.sunLight.shadow.camera.top = 16;
      this.sunLight.shadow.camera.bottom = -16;
      this.sunLight.shadow.camera.near = 1;
      this.sunLight.shadow.camera.far = 500;
      // A flat depth bias (-0.0015) fights acne and peter-panning against
      // each other on a banked/sloped surface — too little and the sloped
      // road self-shadows into moire noise, too much and the shadow
      // visibly detaches from its caster. `normalBias` offsets along the
      // surface normal instead of view depth, which is the standard fix
      // for exactly this (slanted receiver geometry) and doesn't need a
      // large depth bias to compensate. `radius` softens the hard/aliased
      // edge PCFSoftShadowMap still shows at radius 1 (its default).
      this.sunLight.shadow.bias = -0.0002;
      this.sunLight.shadow.normalBias = 0.04;
      this.sunLight.shadow.radius = 3;
      this.sunLight.target = new THREE.Object3D();
      this.scene.add(this.sunLight.target);
      // Fixed offset from whatever the light is currently tracking —
      // preserves the original (150, 250, 100) sun angle/direction, just
      // recentered on the vehicle each frame instead of pinned to origin.
      this.sunOffset = new THREE.Vector3(150, 250, 100);
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

      // Unified Film Post Pass: combines Color Grade (soothing lavender-grey shadow lift,
      // -18% saturation, warm highlight push) + Vignette darkening + 8-bit hash dither
      // into a single fragment shader, saving 1 full-screen ping-pong render pass per frame.
      const FilmPostShader = {
        uniforms: {
          tDiffuse: { value: null },
          saturationMult: { value: 0.82 },  // -18% saturation
          shadowLiftAmount: { value: 0.12 },
          shadowFloor: { value: new THREE.Color(0x2c2836) }, // cool lavender-grey
          warmHighlight: { value: 0.045 },                   // ~+8 deg warm hue push
          offset: { value: 1.15 },
          darkness: { value: 1.1 }
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float saturationMult;
          uniform float shadowLiftAmount;
          uniform vec3 shadowFloor;
          uniform float warmHighlight;
          uniform float offset;
          uniform float darkness;
          varying vec2 vUv;
          void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec3 color = texel.rgb;
            float luma = dot(color, vec3(0.299, 0.587, 0.114));

            // 1. Color Grade: Lift shadows toward shadowFloor
            float shadowMask = 1.0 - smoothstep(0.0, 0.4, luma);
            color = mix(color, max(color, shadowFloor), shadowMask * shadowLiftAmount);

            // Reduce saturation by blending toward the pixel's own luma
            color = mix(vec3(luma), color, saturationMult);

            // Warm push in highlights only
            float highlightMask = smoothstep(0.45, 1.0, luma);
            color.r += highlightMask * warmHighlight;
            color.b -= highlightMask * warmHighlight * 0.7;

            // 2. Vignette (Deliberately uncorrected for aspect ratio per Slow Roads design)
            vec2 uv = (vUv - 0.5) * vec2(offset);
            float vig = 1.0 - dot(uv, uv);
            color *= clamp(pow(vig, darkness), 0.0, 1.0) * 0.35 + 0.65;

            // 3. Hash dither to break up 8-bit banding
            float dither = (fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 128.0;
            color += dither;

            gl_FragColor = vec4(color, texel.a);
          }
        `
      };
      this.filmPass = new THREE.ShaderPass(FilmPostShader);
      this.composer.addPass(this.filmPass);

      // The composer's render targets don't carry the renderer's built-in
      // MSAA (that only smooths the final canvas blit, which post-processing
      // bypasses), so without this pass every edge in the scene reads as
      // grainy/aliased once bloom sharpens the contrast — FXAA restores the
      // smoothing that antialias:true on the renderer used to provide.
      this.fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
      this.fxaaPass.material.uniforms['resolution'].value.set(1 / (size.x * pixelRatio), 1 / (size.y * pixelRatio));
      this.fxaaPass.renderToScreen = true;
      this.composer.addPass(this.fxaaPass);

      // Visual style — initialises after all base passes are in place
      this.visualStyle = new VisualStyleManager(this);
    }


    buildWorldAndScene() {
      const season = CONFIG.SEASONS[this.selectedSeason];
      const tod = CONFIG.TIME_OF_DAY[this.selectedTimeOfDay] || CONFIG.TIME_OF_DAY.day;
      // Sky/fog color comes from the time-of-day preset.
      const skyBottomHex = tod.skyBottom;
      const fogHex = tod.fog;
      const fogDensityVal = tod.fogDensity;

      this.scene.background = new THREE.Color(skyBottomHex);
      this.scene.fog = new THREE.FogExp2(fogHex, fogDensityVal);

      if (this.ambientLight) {
        this.ambientLight.color.setHex(tod.ambientColor);
        this.ambientLight.intensity = tod.ambientIntensity;
      }
      if (this.sunLight) {
        this.sunLight.color.setHex(tod.sunColor);
        this.sunLight.intensity = tod.sunIntensity;
        // Direction only — actual position is recentered on the vehicle
        // every frame (see updateCamera) so the shadow-camera frustum
        // stays near the car instead of pinned at world origin.
        this.sunOffset = new THREE.Vector3(...tod.sunPos);
        this.sunLight.position.copy(this.sunOffset);
      }

      if (this.world) {
        if (this.world.skyMesh) this.scene.remove(this.world.skyMesh);
        if (this.world.roadMesh) this.scene.remove(this.world.roadMesh);
        if (this.world.terrainMesh) this.scene.remove(this.world.terrainMesh);
        if (this.world.floorMesh) this.scene.remove(this.world.floorMesh);
        if (this.world.foliageGroup) this.scene.remove(this.world.foliageGroup);
        if (this.world.tunnelGroup) this.scene.remove(this.world.tunnelGroup);
        if (this.world.laneMarkingsGroup) this.scene.remove(this.world.laneMarkingsGroup);
        if (this.world.archGroup) this.scene.remove(this.world.archGroup);
      }

      this.world = new ProceduralWorld(this.selectedSeed, this.selectedSeason, this.selectedCity);
      this.world._game = this; // back-reference for distance culling in updateCrossers
      this.scene.add(this.world.createSkyDome(season, this.selectedTimeOfDay));
      this.scene.add(this.world.createRoadMesh());
      if (this._sidewalks) this.scene.remove(this._sidewalks);
      this._sidewalks = this.world.buildSidewalkRange(0, 1);
      this.scene.add(this._sidewalks);
      this.scene.add(this.world.createLaneMarkingMeshes());
      this.scene.add(this.world.createWorldFloor(season));
      this.scene.add(this.world.createTerrainMesh(season));
      this.scene.add(this.world.createTunnelMeshes());
      this.world.createMountainArches(this.scene, season);
      if (this._onboardingActive) this.selectedDifficulty = 'easy';
      this.world.createFoliageAndProps(this.scene, season, this.selectedDifficulty);
      // Built AFTER the props so they can see the buildings, tea stalls and garages (B164).
      if (this._roadsideGrass) this.scene.remove(this._roadsideGrass);
      this._roadsideGrass = this.world.buildRoadsideGrass(0, 1);
      this.scene.add(this._roadsideGrass);
      if (this._groundCover) this.scene.remove(this._groundCover);
      this._groundCover = this.world.buildGroundCover(0, 1, season);
      this.scene.add(this._groundCover);
      if (this._houseFlowers) this.scene.remove(this._houseFlowers);
      this._houseFlowers = this.world.buildHouseFlowers(0, 1);
      this.scene.add(this._houseFlowers);

      this.reconcileSelectedVehicle();
      if (!this.vehicle) {
        this.vehicle = new VehicleController(this.scene, this.selectedVehicle);
      } else {
        this.vehicle.setVehicleType(this.selectedVehicle);
      }
      this.vehicle.resetToSpline(this.world.curve, 0.008);
      this.vehicle.setHeadlightsActive(tod.night || tod.id === 'dusk');
      this.applyWindowGlow(tod);
      this.initWeatherSystem();

      const diffCfg = CONFIG.DIFFICULTY_TIERS[this.selectedDifficulty];
      this.maxOrderTimer = diffCfg.timeLimit;
      this.orderTimer = this.maxOrderTimer;
      this.updateActiveOrderCard();
    }


    // First-run helper (WI-18). Starts the player ONBOARD_APPROACH_M before the first drop,
    // at a walking-pace speed, so there is time to see the ring and read the hint. Also used
    // to put them back if they drive past the house, so the first delivery cannot be lost.
    _placeForFirstOrder() {
      const target = this.world.deliveryTargets[0];
      const totalL = this.world.curve.getLength();
      const approachU = Math.max(0, target.splineU - CONFIG.ONBOARD.APPROACH_M / totalL);
      const pt = this.world.curve.getPointAt(approachU);
      const tang = this.world.curve.getTangentAt(approachU);
      this.vehicle.mesh.position.copy(pt).add(new THREE.Vector3(0, 0.39, 0));
      this.vehicle.velocityHeading = Math.atan2(tang.x, tang.z);
      this.vehicle.heading = this.vehicle.velocityHeading;
      this.vehicle.splineProgress = approachU;
      this.vehicle.lateralOffset = 0;
      this.vehicle.speed = CONFIG.ONBOARD.START_SPEED;
      this.updateGPSNavigation();
    }

    // Telemetry never gets to break the game: no module, no backend, or a throwing one is all fine.
    _track(name, params) {
      try { if (window.ShiplypTelemetry) window.ShiplypTelemetry.track(name, params); } catch (e) { /* ignore */ }
    }

    startDrive() {
      this.gameState = 'playing';
      if (typeof ShiplypAds !== 'undefined' && ShiplypAds) {
        ShiplypAds.gameplayStart();
      }
      this.reconcileSelectedVehicle();
      if (this.vehicle && this.vehicle.vehicleType !== this.selectedVehicle) {
        this.vehicle.setVehicleType(this.selectedVehicle);
      }
      // Career bookkeeping for the shift that is about to start. The distance
      // marker is what makes banking idempotent: VehicleController.distanceTraveled
      // is cumulative on a vehicle instance that outlives a single shift, so
      // only the delta since this point may be added to the career total.
      if (Career) Career.beginShift();
      this._track('shift_start', {
        shift_no: Career ? Career.career().shifts : 0,
        vehicle: this.selectedVehicle, city: this.selectedCity, difficulty: this.selectedDifficulty
      });
      this._distanceBanked = this.vehicle ? this.vehicle.distanceTraveled : 0;
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
      window.ShiplypPolice?.reset();
      this._resetSpareParcels();
      this._applyFpsCounter();
      this._assistUsedThisOrder = !!(this.vehicle && (this.vehicle.isAutodrive || this.vehicle.isCruise));
      const gearEl = document.getElementById('telemetry-gear');
      if (gearEl) gearEl.textContent = isPedalVehicle(this.selectedVehicle) ? 'PEDAL' : 'DRIVE';

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

      // First-run: put the vehicle on the approach to the first target so the
      // player sees the ring at once and can complete a delivery within ~30 seconds.
      if (this._onboardingActive && this.world?.deliveryTargets?.length && this.world.curve) {
        this._placeForFirstOrder();
        this._showOnboardingHint('drive');
      }

      if (this.vehicle) {
        const carPos = this.vehicle.mesh.position;
        const vh = this.vehicle.velocityHeading;
        const carForward = new THREE.Vector3(Math.sin(vh), 0, Math.cos(vh));
        this.camera.position.copy(carPos.clone().addScaledVector(carForward, -7.8).add(new THREE.Vector3(0, 2.6, 0)));
        this.camLookTarget = carPos.clone().addScaledVector(carForward, 20.0).add(new THREE.Vector3(0, 0.85, 0));
        this.camera.lookAt(this.camLookTarget);
      }
      this.updateAudioHUDButtons();
    }


    animate() {
      // requestAnimationFrame is self-chaining (the call at the bottom of
      // this method schedules the next frame) — a single uncaught exception
      // anywhere in the frame body (world streaming, physics, HUD updates)
      // stops that chain forever, silently freezing the whole game with no
      // visible error. Wrapping the frame body and rescheduling in `finally`
      // means one bad frame gets logged and skipped instead of killing the
      // game outright.
      try {
        this._animateFrame();
      } catch (err) {
        console.error('animate() frame threw — skipping this frame:', err);
      } finally {
        requestAnimationFrame(this.animate.bind(this));
      }
    }

    // Adaptive render scale (B147). Called once per ~0.5 s FPS window.
    // Steps down fast (3 slow windows), steps up slowly (10 good windows) and
    // never back above a level that just caused a drop, so it cannot oscillate.

    _adaptRenderScale(fps) {
      if (!this._worldBuilt || this._adPaused || document.hidden) { this._prSlow = this._prFast = 0; return; }
      const now = performance.now();
      if (fps < 45) { this._prSlow++; this._prFast = 0; }
      else if (fps >= 57) { this._prFast++; this._prSlow = 0; }
      else { this._prSlow = 0; this._prFast = 0; }

      let next = this._pr;
      if (this._prSlow >= 3 && this._pr > 1) {
        next = Math.max(1, this._pr - 0.25);
        // A drop soon after a raise means the raised level is too expensive here.
        if (now - this._prLastRaiseAt < 15000) this._prCap = Math.min(this._prCap, next);
        this._prLastDropAt = now;
      } else if (this._prFast >= 10 && this._pr < this._prCap) {
        next = Math.min(this._prCap, this._pr + 0.25);
        this._prLastRaiseAt = now;
      }
      if (next === this._pr) return;
      this._prSlow = this._prFast = 0;
      this._pr = next;
      this.renderer.setPixelRatio(next);
      if (this.composer && this.composer.setPixelRatio) this.composer.setPixelRatio(next);
      if (this._handleResize) this._handleResize(true);
    }


    _animateFrame() {
      const dt = Math.min(this.clock.getDelta(), 0.1);

      // Live FPS readout for the top-right status pill — smoothed over a
      // rolling ~0.5s window (raw per-frame dt is too jittery to read).
      this._fpsAccumTime = (this._fpsAccumTime || 0) + dt;
      this._fpsAccumFrames = (this._fpsAccumFrames || 0) + 1;
      if (this._fpsAccumTime >= 0.5) {
        const fps = Math.round(this._fpsAccumFrames / this._fpsAccumTime);
        const fpsEl = document.getElementById('hud-fps-value');
        if (fpsEl) fpsEl.textContent = String(fps);
        this._adaptRenderScale(fps);
        if (this.gameState === 'playing' && !this._hiddenPaused && !this._adPaused && window.ShiplypTelemetry) {
          window.ShiplypTelemetry.fpsSample(fps, { pixel_ratio: this._pr, style: this.visualStyle && this.visualStyle.currentStyle, vehicle: this.selectedVehicle });
        }
        this._fpsAccumTime = 0;
        this._fpsAccumFrames = 0;
      }

      if (this._adPaused || this._hiddenPaused || window.ShiplypPolice?.isPaused()) {
        if (this.composer) {
          this.visualStyle?.preRender();
          this.composer.render();
        } else {
          this.renderer.render(this.scene, this.camera);
        }
        return;
      }

      if (this.gameState === 'playing') {
        {
          // Fixed-step substepping: heavier post-processing (bloom/FXAA at
          // tier 5-6) can drag render FPS down enough that a single dt=0.1s
          // physics step overshoots steering/suspension integration and
          // reads as stutter. Running the vehicle at a steady ~30Hz internal
          // rate regardless of render framerate keeps driving feel smooth
          // even when the frame is expensive.
          const lastSpeed = this.vehicle.speed;
          const maxSubDt = 1 / 30;
          let remaining = dt;
          let substeps = 0;
          while (remaining > 0.0001 && substeps < 6) {
            const stepDt = Math.min(remaining, maxSubDt);
            this.vehicle.update(stepDt, this.keys, this.world, this.selectedSeason);
            remaining -= stepDt;
            substeps++;
          }
          sound.updateDrivingAmbience(this.vehicle.speed, this.vehicle.maxSpeed, (this.vehicle.speed - lastSpeed) / Math.max(0.01, dt), this.vehicle.vehicleType);
        }

        // Infinite Forward Highway Chunk Streaming (Slow Roads Parity)
        if (this.world && this.world.updateStreaming && this.vehicle && this.vehicle.mesh) {
          this.world.updateStreaming(this.vehicle.mesh.position, this.scene, CONFIG.SEASONS[this.selectedSeason], this.selectedDifficulty, this.vehicle);
        }

        this.world.updateTraffic(dt);
        this.world.updateCrossers(dt);
        this.world.updatePatrons(dt, this.vehicle.mesh.position);
        this.world.updateTrafficSignals(dt);
        if (this.vehicle && this.vehicle.mesh && this.world.updateFoliageVisibility) {
          this.world.updateFoliageVisibility(this.vehicle.mesh.position);
        }
        this.checkCrosserCollisions();
        // Order clock counts down (floors at 0; a late drop just earns no time bonus).
        this.orderTimer = Math.max(0, (this.orderTimer || 0) - dt);
        window.ShiplypPolice?.update(this, dt); // police.js: offences, wanted stars, encounters, clock tick
        if (this.rain && this.vehicle && this.vehicle.mesh) {
          const rainForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicle.mesh.quaternion);
          this.rain.update(dt, this.vehicle.mesh.position, rainForward, this.vehicle.speed);
        }
        this.updateParcels(dt);
        this.updateParticles(dt);

        // Drift & Braking Particle FX
        if (this.vehicle && this.vehicle.mesh && Math.abs(this.vehicle.speed) > 4.0) {
          if (this.keys.s || this.keys.down || Math.abs(this.vehicle.driftAngle || 0) > 0.12) {
            this.spawnDust(this.vehicle.mesh.position, 1);
          }
        }
        this.updateCamera(dt);
        this.updateGPSNavigation();
        this.updateClimateHUD();
        this.updateHealthHUD();

        // First delivery assist (WI-18), first-time players only: ease off near the first
        // house so the drop window is seconds long, not a blink, and if they still drive
        // past it, put them back on the approach. Switch the hint from "drive" to "toss"
        // as soon as a drop would land.
        if (this._onboardingActive && this.vehicle && this.world?.deliveryTargets?.length) {
          const firstTarget = this.world.deliveryTargets.find(t => !t.delivered);
          if (firstTarget) {
            const vp = this.vehicle.mesh.position;
            const d = vp.distanceTo(firstTarget.pos);
            const vh = this.vehicle.velocityHeading;
            const ahead = (firstTarget.pos.x - vp.x) * Math.sin(vh) + (firstTarget.pos.z - vp.z) * Math.cos(vh);
            if (firstTarget === this.world.deliveryTargets[0]) {
              if (d < CONFIG.ONBOARD.SLOW_ZONE_M && ahead > 0 && this.vehicle.speed > CONFIG.ONBOARD.SLOW_SPEED) {
                this.vehicle.speed = Math.max(CONFIG.ONBOARD.SLOW_SPEED, this.vehicle.speed - 10 * dt);
              } else if (ahead < -CONFIG.ONBOARD.PASSED_M) {
                this._placeForFirstOrder();
                this.addNotification(`${UI.icon('target')} Passed it. Back on the approach: drop at the ring`, 'info', 3500);
              }
            }
            const tossAt = CONFIG.TOSS_RANGE - 5;
            if (d < tossAt && ahead > -CONFIG.TOSS_BEHIND_SLACK && this._onboardingHintStep !== 'toss') {
              this._onboardingHintStep = 'toss';
              this._showOnboardingHint('toss');
            } else if ((d >= tossAt || ahead <= -CONFIG.TOSS_BEHIND_SLACK) && this._onboardingHintStep !== 'drive') {
              this._onboardingHintStep = 'drive';
              this._showOnboardingHint('drive');
            }
          }
        }

        // Continuous Diurnal Cycle, Atmosphere, Auto-Headlights & Lighting
        this.updateDayNightCycle(dt);

        // Dynamic Weather Particle System (Snowfall Blizzard & Rain)
        this.updateWeatherSystem(dt);


        // Infinite Highway District Milestones (Seamless progression every 4 km)
        const nextDistrictThreshold = (this.currentDistrict || 1) * 4.0;
        if (this.vehicle.distanceTraveled >= nextDistrictThreshold && !this.districtTransitioning) {
          this.districtTransitioning = true;
          this.currentDistrict = (this.currentDistrict || 1) + 1;
          const biomes = CONFIG.DISTRICT_BIOMES || [];
          const biome = biomes[(this.currentDistrict - 1) % biomes.length];
          const distName = biome ? biome.name : 'Cloudspire Ridge';
          const distTagline = biome ? biome.tagline : '';
          const bonus = 150;
          this.earnings += bonus;
          if (Career) Career.credit(bonus, 'district');
          sound.playRepair();
          const distIcon = UI.icon('building');
          const distLabel = 'DISTRICT';
          const taglineSnippet = distTagline ? ` — ${distTagline}` : '';
          this.addNotification(`${distIcon} ENTERED ${distLabel} ${this.currentDistrict}: ${distName}!${taglineSnippet} • Highway Bonus +₹${bonus}`, 'success', 5500);
          this.showScorePopup(bonus, `${distLabel} ${this.currentDistrict}: ${distName.toUpperCase()}`);

          // Time of day advances continuously and gradually without jarring snaps at district milestones
          setTimeout(() => { this.districtTransitioning = false; }, 5000);
        }

        // Automatic Breakdown & Stuck Recovery Detection — skipped while on
        // foot: the vehicle is deliberately parked and stationary, so the
        // same conditions that mean "stuck" while driving are just normal
        // here.
        if (this.vehicle.health <= 0) {
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
        if (this.world && this.world.curve && this.vehicle) {
          const latDist = Math.abs(this.vehicle.lateralOffset || 0);
          const vp = this.vehicle.mesh.position;
          const nearU = this.vehicle.splineProgress;
          const nearPt = this.world.curve.getPointAt(Math.max(0, Math.min(1, nearU)));
          const distFromRoad = vp.distanceTo(nearPt);

          // Debounce off-road status: require genuine sustained lateral displacement > 22m
          // (or Euclidean > 26m with lateral > 16m) sustained for > 0.6 seconds
          const isFarOffRoad = (latDist > 22.0) || (distFromRoad > 26.0 && latDist > 16.0);
          if (isFarOffRoad) {
            this.offRoadTimer = (this.offRoadTimer || 0) + dt;
            if (this.offRoadTimer > 0.6) {
              if (!this.lostFromRoad) {
                this.lostFromRoad = true;
                this.showReturnToRoadBanner();
              }
            }
          } else {
            this.offRoadTimer = Math.max(0, (this.offRoadTimer || 0) - dt * 2.5);
            if (this.lostFromRoad && this.offRoadTimer <= 0.05) {
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

        const gearEl = document.getElementById('telemetry-gear');
        if (gearEl) {
          if (isPedalVehicle(this.selectedVehicle)) {
            gearEl.textContent = speedKmh > 2 ? 'PEDAL' : 'CRUISE';
          } else {
            gearEl.textContent = this.vehicle.speed < -0.1 ? 'REVERSE' : (speedKmh < 0.5 ? 'PARK' : 'DRIVE');
          }
        }
      } else {
        const t = Date.now() * 0.0003;
        this.camera.position.set(Math.sin(t) * 14, 6, Math.cos(t) * 14);
        this.camera.lookAt(0, 2, 0);
      }

      if (this.composer) {
        this.visualStyle?.preRender();
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    }

    updateCamera(dt) {

      if (!this.vehicle || !this.vehicle.mesh) return;

      // Recenter the sun + its shadow-camera frustum on the vehicle every
      // frame — see the setup comment in initThree for why this matters
      // (without it the car only casts a shadow within ~5 units of the
      // route's spawn point). Direction is preserved (sunOffset is a
      // fixed vector from the current time-of-day config); only the
      // recentering point moves.
      if (this.sunLight && this.sunOffset) {
        const vp = this.vehicle.mesh.position;
        this.sunLight.position.set(vp.x + this.sunOffset.x, vp.y + this.sunOffset.y, vp.z + this.sunOffset.z);
        this.sunLight.target.position.copy(vp);
        this.sunLight.target.updateMatrixWorld();
      }

      const isMuscleCoupe = this.vehicle && this.vehicle.vehicleType === 'musclecoupe' && MuscleCoupeAsset.template;
      // In first-person cockpit mode for Muscle Coupe: keep car mesh visible so player sees interior dashboard & steering wheel!
      this.vehicle.mesh.visible = (this.activeCameraMode !== 'first-person') || !!isMuscleCoupe;

      const carPos = this.vehicle.mesh.position;
      const bodyForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicle.mesh.quaternion).normalize();
      const vh = this.vehicle.velocityHeading;
      const carForward = new THREE.Vector3(Math.sin(vh), 0, Math.cos(vh));

      if (!this.camLookTarget) {
        this.camLookTarget = carPos.clone().addScaledVector(carForward, 18.0);
      }

      this._setFirstPersonNearPlane(this.activeCameraMode === 'first-person');

      if (this.activeCameraMode === 'hood') {
        // Bumper Cam - rigidly bolted at forward bumper height
        const hoodPos = carPos.clone().addScaledVector(bodyForward, 1.35).add(new THREE.Vector3(0, 0.65, 0));
        this.camera.position.copy(hoodPos);
        const lookTarget = hoodPos.clone().addScaledVector(bodyForward, 35.0);
        this.camera.lookAt(lookTarget);
        this.camera.fov = 68;
        this.camera.updateProjectionMatrix();
      } else if (this.activeCameraMode === 'first-person') {
        const bodyRight = new THREE.Vector3(-bodyForward.z, 0, bodyForward.x).normalize();
        if (isMuscleCoupe) {
          // Slow Roads Authentic Cockpit View: driver seated behind steering wheel looking over hood
          const driverEyePos = carPos.clone()
            .addScaledVector(bodyForward, -0.15)
            .addScaledVector(bodyRight, -0.32)
            .add(new THREE.Vector3(0, 0.96, 0));
          this.camera.position.copy(driverEyePos);
          const lookTarget = driverEyePos.clone().addScaledVector(bodyForward, 35.0).add(new THREE.Vector3(0, -0.05, 0));
          this.camera.lookAt(lookTarget);
          this.camera.fov = 74;
        } else {
          // Standard in-cabin / windshield view for procedural shells
          const eyePos = carPos.clone().addScaledVector(bodyForward, 0.12).add(new THREE.Vector3(0, 1.05, 0));
          this.camera.position.copy(eyePos);
          const lookTarget = eyePos.clone().addScaledVector(bodyForward, 35.0);
          this.camera.lookAt(lookTarget);
          this.camera.fov = 70;
        }
        this.camera.updateProjectionMatrix();
      } else if (this.activeCameraMode === 'far-chase') {
        // Far Chase Cam: balanced wide framing
        const targetCamPos = carPos.clone()
          .addScaledVector(carForward, -12.0)
          .add(new THREE.Vector3(0, 4.0, 0));
        const posLerp = Math.min(1.0, 1.0 - Math.exp(-14.0 * dt));
        this.camera.position.lerp(targetCamPos, posLerp);

        const minY = carPos.y + 2.0;
        const maxY = carPos.y + 6.2;
        this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y, minY, maxY);

        const rawLookTarget = carPos.clone()
          .addScaledVector(carForward, 26.0)
          .add(new THREE.Vector3(0, 0.9, 0));
        const lookLerp = Math.min(1.0, 1.0 - Math.exp(-20.0 * dt));
        this.camLookTarget.lerp(rawLookTarget, lookLerp);
        this.camera.lookAt(this.camLookTarget);

        const speedRatio = Math.min(1.0, Math.abs(this.vehicle.speed) / (this.vehicle.maxSpeed || 40));
        const targetFOV = 66.0 + speedRatio * 8.0;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.1);
        this.camera.updateProjectionMatrix();
      } else if (this.activeCameraMode === 'sky') {
        // Panoramic High Follow Drone Cam
        const skyPos = carPos.clone().addScaledVector(carForward, -14.0).add(new THREE.Vector3(0, 10.5, 0));
        this.camera.position.lerp(skyPos, Math.min(1.0, 1.0 - Math.exp(-12.0 * dt)));
        const rawLookTarget = carPos.clone().addScaledVector(carForward, 24.0).add(new THREE.Vector3(0, 0.5, 0));
        this.camLookTarget.lerp(rawLookTarget, Math.min(1.0, 1.0 - Math.exp(-16.0 * dt)));
        this.camera.lookAt(this.camLookTarget);
      } else {
        // Slow Roads Default Chase Cam — intimate framing (~7.8m back for cars, ~5.6m back for cycle)
        const isCycle = !!(this.vehicle && isTwoWheeler(this.vehicle.vehicleType));
        const camDist = isCycle ? -5.6 : -7.8;
        const camHeight = isCycle ? 2.1 : 2.6;
        const targetCamPos = carPos.clone()
          .addScaledVector(carForward, camDist)
          .add(new THREE.Vector3(0, camHeight, 0));

        // High responsiveness spring-lerp tuned for vehicle scale
        const posLerpRate = isCycle ? 8.5 : 14.0;
        const posLerp = Math.min(1.0, 1.0 - Math.exp(-posLerpRate * dt));
        this.camera.position.lerp(targetCamPos, posLerp);

        // Ground clearance check relative strictly to roadbed
        const minY = carPos.y + (isCycle ? 1.1 : 1.4);
        const maxY = carPos.y + (isCycle ? 3.8 : 4.5);
        this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y, minY, maxY);

        // Look-ahead target down the road centerline / motion direction
        const lookAheadDist = isCycle ? 16.0 : 20.0;
        const lookHeight = isCycle ? 0.75 : 0.85;
        const rawLookTarget = carPos.clone()
          .addScaledVector(carForward, lookAheadDist)
          .add(new THREE.Vector3(0, lookHeight, 0));
        const lookLerpRate = isCycle ? 11.0 : 20.0;
        const lookLerp = Math.min(1.0, 1.0 - Math.exp(-lookLerpRate * dt));
        this.camLookTarget.lerp(rawLookTarget, lookLerp);
        this.camera.lookAt(this.camLookTarget);

        // Dynamic Speed FOV
        const maxVSpd = this.vehicle.maxSpeed || (isCycle ? 10.56 : 40);
        const speedRatio = Math.min(1.0, Math.abs(this.vehicle.speed) / maxVSpd);
        const baseFOV = isCycle ? 62.0 : 64.0;
        const rangeFOV = isCycle ? 6.0 : 8.0;
        const targetFOV = baseFOV + speedRatio * rangeFOV;
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
        let camMinY = minClearance;
        if (this.world && this.world.curve && this.vehicle && this.vehicle.projectToRoad) {
          const camProj = this.vehicle.projectToRoad(this.camera.position, this.world.curve, this.vehicle.splineProgress);
          const camGroundY = this.world.groundHeightAt(camProj.pt, this.camera.position, camProj.latDist);
          camMinY = Math.max(minClearance, camGroundY + 0.9);
        }
        if (this.camera.position.y < camMinY) {
          this.camera.position.y = camMinY;
        }
      }

      // Center Atmospheric Sky Dome on Camera
      if (this.world && this.world.skyMesh) {
        this.world.skyMesh.position.copy(this.camera.position);
      }
    }

    // B191: delivery halo. A flat teal-to-amber-to-red ring floats just above the roof of the ACTIVE delivery house (the nearest
    // undelivered target, the one the GPS arrow follows), with a soft additive glow ring. Colour is three stages by the fraction
    // of the delivery timer left (green > 50%, amber 20-50%, red < 20%, short cross-fades); glow strength and pulse rate rise as
    // time runs out. The glow is held low in daylight (it washed out against the bright sky) and opens up at dusk and night.

    _setFirstPersonNearPlane(on) {
      if (!this.camera || !!this._fpNearApplied === on) return;
      this.camera.near = on ? 0.1 : 0.5;
      this.camera.updateProjectionMatrix();
      this._fpNearApplied = on;
    }

  }

  S.ShiplypEngine = ShiplypEngine;
  window.ShiplypEngine = ShiplypEngine;
})();
