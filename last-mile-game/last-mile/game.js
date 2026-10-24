// ============================================================================
// SHIPLYP: LAST MILE CHRONICLES — 3D INDIAN COURIER ACTION GAME ENGINE
// 100% Original IP | Sports/Indian Vehicles | Active Dispatch Missions |
// 3D Parabolic Parcel Toss | Real-Time Traffic AI | Combo Streaks & Tips
// ============================================================================

(function() {
  'use strict';
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    UI_ICON_PATHS, UI, PRNG, SimplexNoise, Career,
    CROSSING_AT_CLUSTER_CHANCE, CONFIG,
    vehicleSpec, vehicleList, isTwoWheeler, isPedalVehicle, hornStyle, sound,
    barrierPostStations, addChunkedInstances, LANE_PAINT, buildBarrierGeometries,
    makeVehicleAsset, ASSET_VERSION, MuscleCoupeAsset, DeliveryCycleAsset, MotorbikeAsset,
    RickshawAsset, ChaiTapriAsset, HousesAsset, RepairShopAsset, MotorGarageAsset,
    StreetFurnitureAsset, CourierAsset,
    RockGeometryFactory, TreeBillboardFactory, ClumpTreeFactory, ConiferFactory,
    RoadGrassFactory, GroundDetail, RealTextureFactory, RoadSpatialGrid,
    VehicleController,
    RainSystem, VisualStyleManager,
    ProceduralWorld,
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
    initVisibilityPause() {
      this._hiddenPaused = false;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.gameState !== 'playing' || this._hiddenPaused) return;
          this._hiddenPaused = true;
          sound.mute();
          if (typeof ShiplypAds !== 'undefined' && ShiplypAds) ShiplypAds.gameplayStop();
        } else if (this._hiddenPaused) {
          this._hiddenPaused = false;
          sound.unmute();
          this.clock.getDelta(); // drop the time spent hidden so the next frame does not jump
          if (this.gameState === 'playing' && typeof ShiplypAds !== 'undefined' && ShiplypAds) ShiplypAds.gameplayStart();
        }
      });
    }

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

    // FPS counter is off by default; Settings > Display & Sound turns it on (B142).
    _fpsCounterOn() {
      try { return localStorage.getItem('shiplyp_showFps') === '1'; } catch (e) { return false; }
    }

    _applyFpsCounter() {
      const pill = document.getElementById('hud-fps-pill');
      if (pill) pill.hidden = !this._fpsCounterOn();
    }


    initEvents() {
      const handleResize = (resolutionOnly) => {
        resolutionOnly = resolutionOnly === true;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.aspect = aspect;
        // Dynamic FOV for portrait phones: widen vertical FOV so the car and road remain spacious.
        // NOT on a resolution-only step (B171): resetting FOV there snapped the camera ~6 deg every time the adaptive
        // render scale changed, which looked like the view zooming in and out while riding.
        if (!resolutionOnly) {
          if (aspect < 1.0) {
            this.camera.fov = THREE.MathUtils.clamp(58 / aspect, 58, 75);
          } else {
            this.camera.fov = 58;
          }
        }
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
        if (this.bloomPass) this.bloomPass.setSize(window.innerWidth, window.innerHeight);
        if (this.fxaaPass) {
          const pr = this.renderer.getPixelRatio();
          this.fxaaPass.material.uniforms['resolution'].value.set(1 / (window.innerWidth * pr), 1 / (window.innerHeight * pr));
        }
        if (this.visualStyle) this.visualStyle.resize(window.innerWidth, window.innerHeight);
      };

      this._handleResize = handleResize;
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', () => setTimeout(handleResize, 150));
      handleResize();

      const onKey = (e, val) => {
        if (this.inputFrozen) return;
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
        const k = (e.key || '').toLowerCase();
        const code = e.code || '';
        if (k === 'f' || code === 'KeyF') this.toggleAutodrive();
        if (k === 'g' || code === 'KeyG') this.toggleCruise();
        if (k === 'r' || code === 'KeyR') this.returnToRoad();
        if (k === 'c' || code === 'KeyC') this.toggleCameraMode();
        if (k === 't' || code === 'KeyT') this.cycleTimeOfDay();
        if (k === 'm' || code === 'KeyM') this.toggleMute();
        if (k === 'h' || code === 'KeyH') {
          sound.playHorn(this.selectedVehicle);
          if (navigator.vibrate) navigator.vibrate(35);
        }
        if (k === '?' || k === 'o' || code === 'KeyO') this.openSettingsModal('controls');
        if (k === 'escape' || code === 'Escape') {
          if (this.modalContainer && this.modalContainer.querySelector('.settings-modal')) {
            this.modalContainer.innerHTML = '';
            if (this.gameState === 'menu') this.renderDispatchHub();
          } else {
            this.openSettingsModal('gameplay');
          }
        }
        if ((k === 'enter' || code === 'Enter') && this.gameState === 'menu') {
          document.getElementById('btn-start-dispatch')?.click();
        }
        if ((k === ' ' || code === 'Space') && this.gameState === 'playing' && !e.repeat) {
          this.tossParcel3D();
        }
      });

      window.addEventListener('keyup', e => onKey(e, false));
      window.addEventListener('mousemove', () => this.resetInactivity());
      window.addEventListener('mousedown', e => {
        this.resetInactivity();
        if (this.gameState === 'playing' && e.target && e.target.tagName === 'CANVAS') {
          this.tossParcel3D();
        }
      });

      // Game HUD buttons must never take keyboard focus on mouse click.
      document.querySelectorAll('#in-game-hud button, #slowroads-dock button').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
      });

      this.initTouchControls();
    }

    applyTouchControlVisibility() {
      const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      document.body.classList.toggle('touch-controls-active', isTouch);
    }

    initTouchControls() {
      this.applyTouchControlVisibility();
      window.matchMedia('(pointer: coarse)').addEventListener?.('change', () => this.applyTouchControlVisibility());

      const bindHoldButton = (id, onDown, onUp) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const start = e => {
          e.preventDefault();
          this.resetInactivity();
          btn.classList.add('touch-pressed');
          if (navigator.vibrate) navigator.vibrate(10);
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

      const bindTapButton = (id, onClick) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          this.resetInactivity();
          btn.classList.add('touch-pressed');
          if (navigator.vibrate) navigator.vibrate(15);
          onClick();
          setTimeout(() => btn.classList.remove('touch-pressed'), 120);
        });
      };

      // Steering & Pedals (button mode — used for cars; cycle uses drag zone)
      bindHoldButton('touch-steer-left', () => { this.keys.left = this.keys.a = true; }, () => { this.keys.left = this.keys.a = false; });
      bindHoldButton('touch-steer-right', () => { this.keys.right = this.keys.d = true; }, () => { this.keys.right = this.keys.d = false; });
      bindHoldButton('touch-pedal-gas', () => { this.keys.up = this.keys.w = true; }, () => { this.keys.up = this.keys.w = false; });
      bindHoldButton('touch-pedal-brake', () => { this.keys.down = this.keys.s = true; }, () => { this.keys.down = this.keys.s = false; });

      // Drag-to-steer zone (cycle-only): horizontal finger drag across the
      // left half of the screen controls analog steering intensity.
      const dragZone = document.getElementById('touch-drag-steer');
      const dragIndicator = dragZone?.querySelector('.drag-steer-indicator');
      if (dragZone) {
        const DRAG_SENSITIVITY = 120; // pixels for full-lock (±1.0)
        dragZone.addEventListener('pointerdown', (e) => {
          if (this._touchSteerActive) return;
          e.preventDefault();
          this.resetInactivity();
          dragZone.setPointerCapture(e.pointerId);
          this._touchSteerActive = true;
          this._touchSteerStartX = e.clientX;
          this._touchSteerPointerId = e.pointerId;
          this.keys.steerInput = 0;
          dragZone.classList.add('dragging');
          if (dragIndicator) {
            const rect = dragZone.getBoundingClientRect();
            dragIndicator.style.left = `${e.clientX - rect.left}px`;
            dragIndicator.style.top = `${e.clientY - rect.top}px`;
          }
          if (navigator.vibrate) navigator.vibrate(8);
        });
        dragZone.addEventListener('pointermove', (e) => {
          if (!this._touchSteerActive || e.pointerId !== this._touchSteerPointerId) return;
          e.preventDefault();
          const dx = e.clientX - this._touchSteerStartX;
          this.keys.steerInput = THREE.MathUtils.clamp(dx / DRAG_SENSITIVITY, -1, 1);
          if (dragIndicator) {
            const rect = dragZone.getBoundingClientRect();
            dragIndicator.style.left = `${e.clientX - rect.left}px`;
            dragIndicator.style.top = `${e.clientY - rect.top}px`;
          }
        });
        const endDrag = (e) => {
          if (!this._touchSteerActive || e.pointerId !== this._touchSteerPointerId) return;
          this._touchSteerActive = false;
          this._touchSteerPointerId = -1;
          this.keys.steerInput = 0;
          dragZone.classList.remove('dragging');
        };
        dragZone.addEventListener('pointerup', endDrag);
        dragZone.addEventListener('pointercancel', endDrag);
      }

      // Action & Utility buttons
      const toolsDrawer = document.getElementById('touch-tools-drawer');
      const toolsBtn = document.getElementById('touch-btn-tools');
      const closeTools = () => {
        if (toolsDrawer) toolsDrawer.style.display = 'none';
        if (toolsBtn) toolsBtn.setAttribute('aria-expanded', 'false');
      };
      const toggleTools = () => {
        if (!toolsDrawer) return;
        const isOpen = toolsDrawer.style.display === 'flex';
        toolsDrawer.style.display = isOpen ? 'none' : 'flex';
        if (toolsBtn) toolsBtn.setAttribute('aria-expanded', String(!isOpen));
      };

      bindTapButton('touch-btn-tools', toggleTools);
      bindTapButton('touch-tools-close', closeTools);

      bindTapButton('touch-btn-drop', () => {
        if (navigator.vibrate) navigator.vibrate([25, 40, 25]);
        this.tossParcel3D();
      });
      bindTapButton('touch-btn-horn', () => {
        closeTools();
        sound.playHorn(this.selectedVehicle);
        if (navigator.vibrate) navigator.vibrate(35);
      });
      bindTapButton('touch-btn-recenter', () => {
        closeTools();
        this.returnToRoad();
      });
      bindTapButton('touch-btn-cam', () => {
        closeTools();
        this.toggleCameraMode();
      });
      bindTapButton('touch-btn-tod', () => {
        this.cycleTimeOfDay();
        this._refreshMobileToolsDrawer();
      });
      bindTapButton('touch-btn-weather', () => {
        this.toggleWeather();
        this._refreshMobileToolsDrawer();
      });
      bindTapButton('touch-btn-vehicle', () => {
        // Cycle to the next unlocked vehicle. On mobile the dock's VEHICLE
        // panel is hidden, so this is the only in-drive way to switch.
        const order = vehicleList().map((v) => v.id);
        const unlocked = order.filter(id => !Career || Career.isUnlocked('vehicles', id));
        if (unlocked.length < 2) {
          this.addNotification('🔒 UNLOCK MORE VEHICLES IN THE HUB', 'warning', 2500);
          return;
        }
        const cur = this.selectedVehicle;
        const nextId = unlocked[(unlocked.indexOf(cur) + 1) % unlocked.length];
        this.selectedVehicle = nextId;
        if (Career && typeof Career.setSelectedVehicle === 'function') Career.setSelectedVehicle(nextId);
        this.vehicle.setVehicleType(nextId);
        this._refreshMobileToolsDrawer();
        sound.playTone(800, 'sine', 0.1);
        this.showScorePopup(0, `VEHICLE: ${vehicleSpec(nextId).name.toUpperCase()}`);
      });
      bindTapButton('touch-btn-autopilot', () => this.toggleAutodrive());
      bindTapButton('touch-btn-cruise', () => this.toggleCruise());

      // Close tools drawer on tap outside
      document.addEventListener('pointerdown', (e) => {
        if (!toolsDrawer || toolsDrawer.style.display !== 'flex') return;
        if (!toolsDrawer.contains(e.target) && !toolsBtn?.contains(e.target)) {
          closeTools();
        }
      });
    }

    // On-foot courier avatar. Uses the shared rigged CourierAsset (real
    // Walking/Running animation clips) so the player and crosser NPCs share one
    // consistent character; falls back to the procedural mesh below if the
    // asset hasn't loaded yet or failed to load.

    // High-quality stylized courier avatar for on-foot delivery, featuring
    // delivery uniform, cap, thermal backpack, sneakers, and articulated limbs.
    // Fallback used only if CourierAsset failed to load.

    // Toggle between driving and walking a car/truck delivery up to the
    // door. Two-wheelers never get out — per the queued design decision,
    // they always toss from the saddle (aimed-throw risk mechanic covers
    // them instead; that's a separate follow-up feature).
    // Crossfades the walker's rigged CourierAsset instance to the named clip.
    // No-op for the procedural fallback mesh (which has no .actions).

    // On-foot equivalent of tossParcel3D's hit-test: walking within the
    // difficulty's tossRadius of the current target's porch ring completes
    // the delivery directly (SPACE), instead of needing a physics toss.

    // Nearest undelivered drop the vehicle can actually reach with a toss: in
    // front (or just abeam) of it and within CONFIG.TOSS_RANGE metres on the
    // ground plane. Shared by the toss and the DROP prompt so the two agree.
    _findTossTarget(carPos, carForward) {
      if (!this.world) return null;
      let best = null;
      let minD = CONFIG.TOSS_RANGE;
      this.world.deliveryTargets.forEach(t => {
        if (t.delivered) return;
        const dx = t.pos.x - carPos.x, dz = t.pos.z - carPos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const ahead = dx * carForward.x + dz * carForward.z;
        if (ahead < -CONFIG.TOSS_BEHIND_SLACK) return; // already passed
        if (d < minD) { minD = d; best = t; }
      });
      return best;
    }

    tossParcel3D() {
      if (!this.vehicle || !this.world) return;
      const carPos = this.vehicle.mesh.position.clone();
      const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicle.mesh.quaternion).normalize();
      const carRight = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.vehicle.mesh.quaternion).normalize();

      // Only a drop still ahead and in toss range can be hit (B136): the
      // parcel used to home onto any undelivered target within 65 m, even one
      // already passed, so a throw into nowhere still delivered.
      const nearestTarget = this._findTossTarget(carPos, carForward);

      // Differentiated 3D Cargo Models based on active order
      const parcelGroup = new THREE.Group();
      const cityOrdersForCargo = CONFIG.ORDERS_BY_CITY[this.selectedCity] || CONFIG.ORDERS_BY_CITY.mumbai;
      const orderIdx = this.activeOrderIndex % cityOrdersForCargo.length;
      const cargoType = orderIdx % 4; // 0: Dabba, 1: Pizza Box, 2: Wooden Crate, 3: Express Parcel

      if (cargoType === 0) {
        // 1. Dabbawala Tiered Stainless Steel Tiffin
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

      if (nearestTarget) {
        const toTarget = nearestTarget.pos.clone().sub(parcelGroup.position);
        const distHoriz = Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z);
        const deltaY = nearestTarget.pos.y - parcelGroup.position.y;
        // Flight time scaled with horizontal distance: 0.45s at 8m, ~1.35s at 60m
        const flightTime = THREE.MathUtils.clamp(distHoriz / 24.0, 0.45, 1.35);
        const gravity = 18.0;
        const vx = toTarget.x / flightTime;
        const vz = toTarget.z / flightTime;
        const vy = (deltaY + 0.5 * gravity * flightTime * flightTime) / flightTime;

        this.parcels.push({
          mesh: parcelGroup,
          pos: parcelGroup.position.clone(),
          vel: new THREE.Vector3(vx, vy, vz),
          nearestTarget: nearestTarget,
          groundY: carPos.y,
          life: flightTime + 0.4
        });
      } else {
        // B140: nothing in reach, so this parcel is wasted.
        this._spendSpareParcel();
        const targetDir = carForward.clone().addScaledVector(carRight, (Math.random() > 0.5 ? 0.6 : -0.6)).normalize();
        this.parcels.push({
          mesh: parcelGroup,
          pos: parcelGroup.position.clone(),
          vel: targetDir.multiplyScalar(22.0).add(new THREE.Vector3(0, 7.0, 0)),
          nearestTarget: null,
          groundY: carPos.y,
          life: 1.5
        });
      }

      sound.playTone(440, 'triangle', 0.12, 0.3);
    }

    // Shared reward/notification/history logic for completing a delivery,
    // whichever way it happened (tossed parcel landing in range, or
    // walking a car/truck delivery up to the door on foot). Factored out
    // so both paths can't silently drift apart (see BUGFIX_LOG.md
    // Recurring Pattern 1 — duplicated logic that diverges over time).
    // ── Spare parcels (B140) ──────────────────────────────────────────────
    // A shift starts with CONFIG.SPARE_PARCELS spares. A throw with no drop
    // in reach wastes one; a wasted throw with none left ends the shift.
    _resetSpareParcels() {
      this.spareParcels = CONFIG.SPARE_PARCELS;
      this._renderSpareParcels();
    }

    _renderSpareParcels() {
      const el = document.getElementById('delivery-spares');
      if (!el) return;
      const n = this.spareParcels ?? CONFIG.SPARE_PARCELS;
      el.innerHTML = `${UI.icon('package', 11)}<span>${n}</span>`;
      el.classList.toggle('spares-low', n <= 1);
    }

    _spendSpareParcel() {
      if (this.spareParcels == null) this.spareParcels = CONFIG.SPARE_PARCELS;
      if (this.spareParcels <= 0) {
        this.addNotification(`${UI.icon('package')} OUT OF PARCELS — SHIFT OVER`, 'warning', 4000);
        setTimeout(() => this.showShiftSummary({ outOfParcels: true }), 900);
        return;
      }
      this.spareParcels--;
      this._renderSpareParcels();
      const left = this.spareParcels;
      this.addNotification(`${UI.icon('package')} MISSED THROW — ${left === 0 ? 'NO SPARE PARCELS LEFT. ONE MORE MISS ENDS THE SHIFT' : `${left} SPARE PARCEL${left === 1 ? '' : 'S'} LEFT`}`, 'warning', 3500);
    }

    fulfillDelivery(target) {
      target.delivered = true;
      target.ring.material.color.setHex(0xff9f1c);

      this.deliveriesMade++;
      // Clock ran out before the drop: missed delivery. Streak resets and the
      // payout is halved (money-only penalty; never touches the wallet).
      const missed = this.orderTimer <= 0;
      if (missed) this.streakCount = 0;
      this.streakCount++;

      // Capture the clock BEFORE it is reset for the next order. Both the
      // star rating and the "express speed" banner describe how much time
      // was left when the parcel landed, and reading them after the reset
      // below made every delivery look like a full-time-remaining one.
      const timeLeftRatio = this.maxOrderTimer > 0 ? (this.orderTimer / this.maxOrderTimer) : 0;

      const diffCfg = CONFIG.DIFFICULTY_TIERS[this.selectedDifficulty];
      const timeBonus = Math.max(0, Math.round(this.orderTimer * 1.8));
      // B141: no Auto Steer / Auto Drive at any point during this order.
      const noAssist = !this._assistUsedThisOrder;
      const earnedBonus = this._deliveryPayout(target.order.reward, timeBonus, diffCfg.payoutMult, this.streakCount, missed, noAssist);
      this.earnings += earnedBonus;

      // Bank it into the career wallet the instant it is earned, not at the
      // end of the shift: on Android the WebView process can be killed while
      // backgrounded, and a player who loses an hour of deliveries to that
      // does not come back. `this.earnings` remains the per-shift HUD counter.
      const stars = timeLeftRatio > 0.55 ? 3 : (timeLeftRatio > 0.25 ? 2 : 1);
      let careerResult = null;
      if (Career) {
        careerResult = Career.recordDelivery({
          orderId: target.order?.id,
          payout: earnedBonus,
          stars,
          streak: this.streakCount
        });
      }

      this.orderTimer = this.maxOrderTimer; // Reset clock for next order
      this._assistUsedThisOrder = !!(this.vehicle && (this.vehicle.isAutodrive || this.vehicle.isCruise));

      sound.playCombo();
      if (stars >= 3 && typeof ShiplypAds !== 'undefined' && ShiplypAds) {
        ShiplypAds.happyTime();
      }
      this.spawnConfetti(target.pos, 36);
      this._showDeliveryResult({ timeLeftRatio, earnedBonus, timeBonus, stars, streak: this.streakCount, orderId: target.order?.id, orderName: target.order?.name || 'Delivery', base: target.order?.reward || 0, diffMult: diffCfg.payoutMult, vehId: this.selectedVehicle, missed, noAssist });
      this.addNotification(`${UI.icon('check')} DELIVERY #${this.deliveriesMade} COMPLETE! +₹${earnedBonus} (${this.streakCount}x streak)`, 'success', 4000);

      // Rank-up is the only career event loud enough to interrupt a shift.
      // Everything else about the profile is read back at the hub.
      if (careerResult && careerResult.promoted) {
        sound.playRepair();
        this.addNotification(`${UI.icon('flame')} PROMOTED — ${careerResult.promoted.name.toUpperCase()}`, 'success', 6000);
      }

      this.deliveryHistory.unshift({
        name: target.order?.name || 'Delivery',
        status: 'delivered',
        amount: earnedBonus,
        orderIndex: this.activeOrderIndex
      });

      this.activeOrderIndex++;
      if (this.vehicle && this.vehicle.updateTrolleyParcels) {
        this.vehicle.updateTrolleyParcels(this.deliveriesMade);
      }
      this.updateActiveOrderCard();
      this.updateHUDStats();

      // First-run: clear onboarding after the first successful delivery.
      if (this._onboardingActive && this.deliveriesMade === 1) {
        this._onboardingActive = false;
        this._dismissOnboardingHint();
        if (this._firstOpenTime) {
          const ms = Date.now() - this._firstOpenTime;
          console.info('[Shiplyp] first_open_to_first_delivery_ms', ms);
        }
      }

      // Shift Milestone: trigger shift celebration modal every 5 drops
      if (this.deliveriesMade > 0 && this.deliveriesMade % 5 === 0) {
        setTimeout(() => this.showShiftSummary(), 1400);
      }
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

        // Landed: out of time, or fallen below the ground under the throw. The
        // floor is relative to the car's ground height, not absolute Y, so
        // parcels on terrain below sea level are not deleted on the first frame.
        if (p.life <= 0 || p.pos.y < (p.groundY ?? 0.2) - 0.5) {
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

    initWeatherSystem() {
      if (this.weatherMesh) {
        this.scene.remove(this.weatherMesh);
        if (this.weatherMesh.geometry) this.weatherMesh.geometry.dispose();
        if (this.weatherMesh.material) this.weatherMesh.material.dispose();
        this.weatherMesh = null;
      }

      const isSnow = (this.selectedSeason === 'winter' && this.selectedWeather !== 'clear') || (this.selectedWeather === 'blizzard');
      const isRain = (this.selectedWeather === 'rain');

      if (!isSnow && !isRain) return;

      const COUNT = isSnow ? 2000 : 1600;
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(COUNT * 3);
      const velocities = [];

      // Seed particles around car's current position so weather appears
      // immediately when toggled mid-drive, not only near world origin.
      const spawnCenter = (this.vehicle && this.vehicle.mesh)
        ? this.vehicle.mesh.position : new THREE.Vector3(0, 0, 0);

      for (let i = 0; i < COUNT; i++) {
        positions[i * 3 + 0] = spawnCenter.x + (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = spawnCenter.y + Math.random() * 26;
        positions[i * 3 + 2] = spawnCenter.z + (Math.random() - 0.5) * 60;

        velocities.push({
          x: (Math.random() - 0.5) * (isSnow ? 1.4 : 0.6),
          y: isSnow ? -(2.2 + Math.random() * 2.2) : -(16.0 + Math.random() * 8.0),
          z: (Math.random() - 0.5) * (isSnow ? 1.4 : 0.6),
          sway: Math.random() * Math.PI * 2
        });
      }

      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      // Snow: soft Gaussian disc sprite so near flakes are large blobs and
      // far ones shrink naturally (sizeAttenuation:true + world-unit size).
      // Rain: elongated streak sprite for falling-water look.
      let weatherMap = null;
      {
        const c = document.createElement('canvas');
        if (isSnow) {
          c.width = 64; c.height = 64;
          const ctx = c.getContext('2d');
          const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
          grad.addColorStop(0,   'rgba(255,255,255,1.0)');
          grad.addColorStop(0.35,'rgba(255,255,255,0.95)');
          grad.addColorStop(0.65,'rgba(255,255,255,0.4)');
          grad.addColorStop(1.0, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 64, 64);
        } else {
          c.width = 8; c.height = 32;
          const ctx = c.getContext('2d');
          const grad = ctx.createLinearGradient(0, 0, 0, 32);
          grad.addColorStop(0, 'rgba(180,210,255,0)');
          grad.addColorStop(0.25, 'rgba(200,225,255,0.9)');
          grad.addColorStop(0.75, 'rgba(220,235,255,0.7)');
          grad.addColorStop(1, 'rgba(180,210,255,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(4, 16, 1.5, 14, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        weatherMap = new THREE.CanvasTexture(c);
      }

      const mat = new THREE.PointsMaterial({
        color: isSnow ? 0xffffff : 0xd6eaff,
        size: isSnow ? 0.35 : 10.0,       // world units for snow → depth-varied blob sizes
        sizeAttenuation: true,             // both snow and rain scale with depth now
        map: weatherMap,
        alphaMap: weatherMap,
        alphaTest: 0.05,
        transparent: true,
        opacity: isSnow ? 0.92 : 0.72,
        depthWrite: false
      });

      this.weatherMesh = new THREE.Points(geom, mat);
      this.weatherMesh.frustumCulled = false;
      this.weatherVelocities = velocities;
      this.scene.add(this.weatherMesh);
    }

    updateWeatherSystem(dt) {
      if (!this.weatherMesh || !this.vehicle || !this.vehicle.mesh) return;

      // Hide weather particles when the car is inside a tunnel — the roof
      // occludes real precipitation but Three.js particles have no depth test
      // vs tunnel geometry, so they leak through the ceiling.
      const meshIdx = Math.round(this.vehicle.splineProgress * CONFIG.ROAD_MESH_SEGMENTS);
      const inTunnel = this.world && this.world.isInTunnelZone && this.world.isInTunnelZone(meshIdx, 2);
      this.weatherMesh.visible = !inTunnel;
      if (inTunnel) return;

      const carPos = this.vehicle.mesh.position;
      const positions = this.weatherMesh.geometry.attributes.position.array;
      const vels = this.weatherVelocities;
      const count = vels.length;

      const BOX_HALF = 30;
      const BOX_HEIGHT = 26;

      // Wind drift — snow only; rain falls straight down by design
      const isSnowNow = (this.selectedSeason === 'winter' && this.selectedWeather !== 'clear') || (this.selectedWeather === 'blizzard');
      if (!this._windPhase) this._windPhase = 0;
      if (isSnowNow) this._windPhase += dt * 0.12;
      const windX = isSnowNow ? (Math.cos(this._windPhase) * 1.2 + 0.6) : 0; // 0.6–1.8 m/s lateral bias
      const windZ = isSnowNow ? (Math.sin(this._windPhase * 0.7) * 0.5) : 0;

      for (let i = 0; i < count; i++) {
        vels[i].sway += dt * 2.0;
        const swayX = Math.sin(vels[i].sway) * 0.35;

        positions[i * 3 + 0] += (vels[i].x + swayX + windX) * dt;
        positions[i * 3 + 1] += vels[i].y * dt;
        positions[i * 3 + 2] += (vels[i].z + windZ) * dt;

        const dx = positions[i * 3 + 0] - carPos.x;
        const dy = positions[i * 3 + 1] - carPos.y;
        const dz = positions[i * 3 + 2] - carPos.z;

        if (dx < -BOX_HALF) positions[i * 3 + 0] += BOX_HALF * 2;
        else if (dx > BOX_HALF) positions[i * 3 + 0] -= BOX_HALF * 2;

        if (dz < -BOX_HALF) positions[i * 3 + 2] += BOX_HALF * 2;
        else if (dz > BOX_HALF) positions[i * 3 + 2] -= BOX_HALF * 2;

        if (dy < -1.5) {
          positions[i * 3 + 1] = carPos.y + BOX_HEIGHT - Math.random() * 3.0;
          positions[i * 3 + 0] = carPos.x + (Math.random() - 0.5) * (BOX_HALF * 2);
          positions[i * 3 + 2] = carPos.z + (Math.random() - 0.5) * (BOX_HALF * 2);
        } else if (dy > BOX_HEIGHT) {
          positions[i * 3 + 1] = carPos.y;
        }
      }

      this.weatherMesh.geometry.attributes.position.needsUpdate = true;
    }

    // ── Vehicle canvas illustration helper ────────────────────────────────
    _drawVehicleThumb(canvas, vehId) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const sx = W / 220, sy = H / 80;
      const x = v => v * sx, y = v => v * sy;
      const isLocked = canvas.closest && canvas.closest('.veh-locked');
      ctx.save();
      ctx.globalAlpha = isLocked ? 0.3 : 0.92;
      const lw = Math.max(1.2, 1.5 * Math.min(sx, sy));
      ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      if (vehId === 'cycle') {
        ctx.strokeStyle = '#00d4bf';
        const rwx=x(42),rwy=y(57),rwr=x(17),fwx=x(166),fwy=y(57),fwr=x(17);
        ctx.beginPath();ctx.arc(rwx,rwy,rwr,0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.arc(fwx,fwy,fwr,0,Math.PI*2);ctx.stroke();
        ctx.lineWidth=lw*0.35;ctx.globalAlpha=(isLocked?0.1:0.28);
        for(const[cx,cy]of[[42,57],[166,57]]){for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(x(cx),y(cy));ctx.lineTo(x(cx)+x(15)*Math.cos(a),y(cy)+x(15)*Math.sin(a));ctx.stroke();}}
        ctx.lineWidth=lw;ctx.globalAlpha=(isLocked?0.3:0.92);
        const bbx=x(104),bby=y(56),scx=x(78),scy=y(24),htx=x(152),hty=y(30);
        for(const[ax,ay,bx2,by2]of[[rwx,rwy,bbx,bby],[rwx,rwy,scx,scy],[bbx,bby,scx,scy],[scx,scy,htx,hty],[bbx,bby,htx,hty],[htx,hty,fwx,fwy]]){ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx2,by2);ctx.stroke();}
        ctx.beginPath();ctx.moveTo(htx,hty);ctx.lineTo(x(155),y(22));ctx.stroke();
        ctx.beginPath();ctx.moveTo(x(148),y(22));ctx.lineTo(x(162),y(22));ctx.stroke();
        ctx.beginPath();ctx.moveTo(x(68),y(22));ctx.lineTo(x(88),y(22));ctx.stroke();
        ctx.beginPath();ctx.moveTo(scx,scy);ctx.lineTo(x(22),y(36));ctx.stroke();
        ctx.beginPath();ctx.moveTo(rwx,rwy-rwr);ctx.lineTo(x(22),y(36));ctx.stroke();
        ctx.strokeRect(x(14),y(18),x(50),y(20));
        ctx.beginPath();ctx.moveTo(x(14),y(18)+y(20)*0.28);ctx.lineTo(x(14)+x(50),y(18)+y(20)*0.28);ctx.stroke();
        ctx.beginPath();ctx.arc(bbx,bby,x(4),0,Math.PI*2);ctx.stroke();
      } else if (vehId === 'motorbike') {
        ctx.strokeStyle = '#00d4bf';
        const rw=[46,58], fw=[166,58], r=x(17);
        for (const [cx, cy] of [rw, fw]) { ctx.beginPath(); ctx.arc(x(cx), y(cy), r, 0, Math.PI*2); ctx.stroke(); }
        const P = (pts) => { ctx.beginPath(); pts.forEach(([px,py],i) => i ? ctx.lineTo(x(px),y(py)) : ctx.moveTo(x(px),y(py))); ctx.stroke(); };
        P([[46,58],[92,50],[128,52],[146,24],[166,58]]);          // swingarm, engine, fork
        P([[70,30],[128,28],[140,20]]);                             // seat to tank to head
        P([[146,24],[150,14],[160,14]]);                            // bars
        ctx.strokeRect(x(22), y(10), x(38), y(18));                // delivery box
        ctx.beginPath(); ctx.arc(x(154), y(26), x(4), 0, Math.PI*2); ctx.stroke(); // headlight
      } else if (vehId === 'rickshaw') {
        ctx.strokeStyle = '#2f9bff';
        const fw=[168,60], rw1=[110,60], rr=x(15);
        for (const [cx, cy] of [fw, rw1, [128,60]]) { ctx.beginPath(); ctx.arc(x(cx), y(cy), rr, 0, Math.PI*2); ctx.stroke(); }
        ctx.strokeRect(x(40), y(34), x(70), y(22));                // cargo bed
        ctx.strokeRect(x(48), y(20), x(26), y(14));                // boxes
        ctx.beginPath(); ctx.moveTo(x(120),y(56)); ctx.lineTo(x(124),y(18)); ctx.lineTo(x(168),y(18)); ctx.lineTo(x(166),y(56)); ctx.stroke(); // cab + roof
      } else {
        // musclecoupe
        ctx.strokeStyle = '#ff9f1c';
        const rwy2=y(60),rwx2=x(44),rwr2=x(16),fwx2=x(168);
        ctx.beginPath();ctx.arc(rwx2,rwy2,rwr2,0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.arc(fwx2,rwy2,rwr2,0,Math.PI*2);ctx.stroke();
        ctx.lineWidth=lw*0.5;ctx.globalAlpha=(isLocked?0.1:0.45);
        for(const cx of[44,168]){ctx.beginPath();ctx.arc(x(cx),rwy2,x(6),0,Math.PI*2);ctx.stroke();}
        ctx.lineWidth=lw;ctx.globalAlpha=(isLocked?0.3:0.92);
        const body=[[18,60],[18,52],[26,48],[52,32],[70,22],[136,20],[158,28],[180,40],[202,44],[202,52],[184,60],[156,56],[130,60],[60,60],[36,56],[18,60]];
        ctx.beginPath();body.forEach(([px,py],i)=>{if(i===0)ctx.moveTo(x(px),y(py));else ctx.lineTo(x(px),y(py));});ctx.stroke();
        ctx.lineWidth=lw*0.7;ctx.globalAlpha=(isLocked?0.15:0.55);
        ctx.beginPath();ctx.moveTo(x(136),y(20));ctx.lineTo(x(158),y(28));ctx.stroke();
        ctx.beginPath();ctx.moveTo(x(70),y(22));ctx.lineTo(x(52),y(32));ctx.stroke();
      }
      ctx.restore();
    }

    // Delivery payout: order reward plus time bonus, scaled by difficulty,
    // streak and the vehicle's pay multiplier (bigger vehicles take bigger orders).
    _deliveryPayout(reward, timeBonus, diffMult, streak, missed, noAssist) {
      const vehMult = vehicleSpec(this.selectedVehicle).payoutMult;
      return Math.round((reward + timeBonus) * diffMult * (1 + streak * 0.2) * vehMult * (missed ? 0.5 : 1) * (noAssist ? 1 + CONFIG.NO_ASSIST_BONUS : 1));
    }

    // ── Post-delivery result banner with tachometer arcs ─────────────────
    _showDeliveryResult({ timeLeftRatio, earnedBonus, timeBonus, stars, streak, orderName, base, diffMult, vehId, missed, noAssist }) {
      if (!this.scorePopupContainer) return;
      const timeFill  = Math.max(0.04, Math.min(1, timeLeftRatio));
      const accFill   = stars === 3 ? 0.9 : (stars === 2 ? 0.65 : 0.3);
      const strFill   = Math.min(1, Math.max(0.04, (streak - 1) / 9));
      const timeColor = timeFill > 0.55 ? '#00d4bf' : (timeFill > 0.25 ? '#ff9f1c' : '#ff2d4e');
      const strColor  = streak >= 3 ? '#ff9f1c' : 'rgba(255,255,255,0.3)';
      const circ = Math.PI * 28;
      const arc = (fill, colour, label) => {
        const offset = circ * (1 - fill);
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:5px">
          <div style="position:relative;width:62px;height:36px;overflow:hidden">
            <svg width="62" height="36" viewBox="0 0 70 40">
              <path d="M7,36 A28,28 0 0,1 63,36" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="5" stroke-linecap="round"/>
              <path d="M7,36 A28,28 0 0,1 63,36" fill="none" stroke="${colour}" stroke-width="5" stroke-linecap="round"
                stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"/>
            </svg>
          </div>
          <span style="font-size:8px;letter-spacing:.12em;color:rgba(232,238,242,0.45);text-transform:uppercase">${label}</span>
        </div>`;
      };
      const label = missed ? `${UI.icon('clock')} MISSED • HALF PAY` : timeLeftRatio > 0.55 ? `${UI.icon('bolt')} EXPRESS SPEED` : (timeLeftRatio > 0.25 ? `${UI.icon('target')} ON-TIME` : `${UI.icon('clock')} LATE DROP`);
      const banner = document.createElement('div');
      banner.className = 'score-popup-banner score-popup-delivery';
      banner.innerHTML = `
        <div style="font-size:10px;letter-spacing:.16em;color:var(--comic-green,#22e565);font-family:var(--font-telemetry,'Chakra Petch',monospace);font-weight:800;text-transform:uppercase;margin-bottom:4px">${label}</div>
        <div style="font-size:24px;font-family:var(--font-telemetry,'Chakra Petch',monospace);font-weight:800;color:var(--comic-yellow,#ffe600);text-shadow:2px 2px 0px #000;margin-bottom:10px">+₹${earnedBonus.toLocaleString('en-IN')}</div>
        <div style="display:flex;gap:14px;margin-bottom:10px;justify-content:center">
          ${arc(timeFill, timeColor, 'Time')}
          ${arc(accFill, '#ffe600', 'Accuracy')}
          ${arc(strFill, strColor, `${streak}× Streak`)}
        </div>
        <div style="font-size:10px;font-family:var(--font-telemetry,'Chakra Petch',monospace);color:rgba(232,238,242,0.65);letter-spacing:.08em">₹${(base||0)} base • ×${(diffMult||1).toFixed(1)} diff • +${streak > 1 ? Math.round((streak-1)*20) : 0}% streak • ×${vehicleSpec(vehId).payoutMult} ${vehicleSpec(vehId).short.toUpperCase()}${missed ? ' • −50% missed' : ''}${noAssist ? ` • +${Math.round(CONFIG.NO_ASSIST_BONUS * 100)}% no assists` : ''}</div>
      `;
      this.scorePopupContainer.appendChild(banner);
      this._placeScorePopups();
      setTimeout(() => {
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-12px) scale(0.95)';
        banner.style.transition = 'all 0.3s ease';
        setTimeout(() => banner.remove(), 300);
      }, 3200);
    }

    // ── Unlock confirmation sheet ─────────────────────────────────────────
    _showUnlockSheet(vehId) {
      const spec = CONFIG.VEHICLES[vehId];
      if (!spec || !spec.price) return;
      const meta = {
        name: spec.name, price: spec.price, stat: `${spec.speedLabel} • ×${spec.payoutMult} pay per drop`,
        topSpeedKmh: Math.round(spec.maxSpeed * 3.6), accel: spec.accel, brake: spec.brake
      };
      const wallet = Career ? Career.wallet() : 0;
      const canAfford = wallet >= meta.price;
      const after = wallet - meta.price;

      const existing = document.getElementById('veh-unlock-sheet');
      if (existing) existing.remove();

      const sheet = document.createElement('div');
      sheet.id = 'veh-unlock-sheet';
      sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(7,9,15,0.7);backdrop-filter:blur(4px)';
      sheet.innerHTML = `
        <div style="width:100%;max-width:480px;background:#0e131d;border:3px solid #000;border-bottom:none;border-radius:18px 18px 0 0;padding:24px 24px 32px;box-shadow:0 -8px 0px #000">
          <div style="font-size:10px;letter-spacing:.18em;color:#ffe600;font-family:var(--font-telemetry,'Chakra Petch',monospace);font-weight:800;text-transform:uppercase;margin-bottom:14px">Unlock vehicle</div>
          <canvas id="unlock-sheet-hero" width="800" height="220" style="width:100%;height:110px;border-radius:8px;margin-bottom:16px;border:2px solid #000;display:block"></canvas>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
            <div>
              <div style="font-family:var(--font-display,'Russo One',sans-serif);font-size:22px;font-weight:900">${meta.name}</div>
              <div style="font-size:11px;color:rgba(232,238,242,0.65);margin-top:2px">${meta.stat}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;letter-spacing:1.5px;color:rgba(232,238,242,0.5);font-family:var(--font-telemetry,'Chakra Petch',monospace);font-weight:800">COST</div>
              <div style="font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:26px;font-weight:800;color:#ffe600;text-shadow:2px 2px 0px #000">₹${meta.price.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <div style="display:flex;border:2px solid #000;border-radius:10px;overflow:hidden;margin-bottom:14px;background:#151c2a">
            <div style="flex:1;padding:10px 12px;border-right:2px solid #000"><div style="font-size:9px;letter-spacing:.12em;color:rgba(232,238,242,0.5);font-family:var(--font-telemetry,'Chakra Petch',monospace);text-transform:uppercase">Top speed</div><div style="font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:15px;font-weight:800">${meta.topSpeedKmh} km/h</div></div>
            <div style="flex:1;padding:10px 12px;border-right:2px solid #000"><div style="font-size:9px;letter-spacing:.12em;color:rgba(232,238,242,0.5);font-family:var(--font-telemetry,'Chakra Petch',monospace);text-transform:uppercase">Pay</div><div style="font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:15px;font-weight:800">×${spec.payoutMult}</div></div>
            <div style="flex:1;padding:10px 12px"><div style="font-size:9px;letter-spacing:.12em;color:rgba(232,238,242,0.5);font-family:var(--font-telemetry,'Chakra Petch',monospace);text-transform:uppercase">Brake</div><div style="font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:15px;font-weight:800">${meta.brake} m/s²</div></div>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.06);border:1.5px solid #000;border-radius:8px;margin-bottom:16px;font-size:11px">
            <span style="color:rgba(232,238,242,0.6)">Account after unlock</span>
            <span style="color:${canAfford ? '#00f0ff' : '#ff006e'};font-weight:800;font-family:var(--font-telemetry,'Chakra Petch',monospace);font-variant-numeric:tabular-nums">${canAfford ? '₹' + after.toLocaleString('en-IN') : 'Insufficient funds'}</span>
          </div>
          <div style="display:flex;gap:10px">
            <button id="unlock-confirm-btn" style="flex:1;background:${canAfford ? '#ffe600' : 'rgba(255,255,255,0.08)'};color:${canAfford ? '#000000' : 'rgba(232,238,242,0.3)'};border:2.5px solid #000;border-radius:10px;padding:13px;font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:12px;font-weight:800;letter-spacing:.1em;box-shadow:3px 3px 0px #000;cursor:${canAfford ? 'pointer' : 'not-allowed'}">${canAfford ? 'CLAIM SHIFT' : `NEED ₹${(meta.price - wallet).toLocaleString('en-IN')} MORE`}</button>
            <button id="unlock-cancel-btn" style="flex:0 0 auto;background:rgba(255,255,255,0.08);border:2px solid #000;border-radius:10px;padding:13px 18px;color:rgba(232,238,242,0.8);font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:12px;font-weight:800;box-shadow:2px 2px 0px #000;cursor:pointer">BACK</button>
          </div>
        </div>
      `;
      document.body.appendChild(sheet);

      // Draw hero canvas
      const heroCanvas = document.getElementById('unlock-sheet-hero');
      if (heroCanvas) {
        const hctx = heroCanvas.getContext('2d');
        hctx.fillStyle = 'rgba(10,14,22,1)';
        hctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
        hctx.strokeStyle = 'rgba(255,230,0,0.08)';
        hctx.lineWidth = 1;
        for (let gx = 0; gx < heroCanvas.width; gx += 40) { hctx.beginPath(); hctx.moveTo(gx, 0); hctx.lineTo(gx, heroCanvas.height); hctx.stroke(); }
        for (let gy = 0; gy < heroCanvas.height; gy += 40) { hctx.beginPath(); hctx.moveTo(0, gy); hctx.lineTo(heroCanvas.width, gy); hctx.stroke(); }
        const grd = hctx.createRadialGradient(heroCanvas.width*0.5, heroCanvas.height*0.65, 8, heroCanvas.width*0.5, heroCanvas.height*0.65, heroCanvas.width*0.4);
        grd.addColorStop(0, 'rgba(255,230,0,0.15)'); grd.addColorStop(1, 'rgba(255,230,0,0)');
        hctx.fillStyle = grd; hctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
        this._drawVehicleThumb(heroCanvas, vehId);
      }

      sheet.querySelector('#unlock-cancel-btn').addEventListener('click', () => sheet.remove());
      sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
      if (canAfford) {
        sheet.querySelector('#unlock-confirm-btn').addEventListener('click', () => {
          if (!Career) return;
          const result = Career.purchase('vehicles', vehId, meta.price);
          if (result.ok) {
            sheet.remove();
            this.selectedVehicle = vehId;
            if (Career && typeof Career.setSelectedVehicle === 'function') {
              Career.setSelectedVehicle(vehId);
            }
            if (this.vehicle) this.vehicle.setVehicleType(vehId);
            sound.playTone(880, 'sine', 0.12);
            this.addNotification(`${UI.icon('check')} ${meta.name.toUpperCase()} UNLOCKED!`, 'success', 4000);
            this.renderDispatchHub(); // re-render hub to show owned state
          }
        });
      }
    }

    // ── Multi-Drop Shift Milestone Summary ────────────────────────────────
    showShiftSummary({ outOfParcels = false } = {}) {
      if (this._shiftSummaryActive) return;
      this._shiftSummaryActive = true;
      // B140: ran out of spare parcels. The streak is lost; money already
      // earned stays banked.
      if (outOfParcels) this.streakCount = 0;

      const wallet = Career ? Career.wallet() : this.earnings;
      const rank = Career ? Career.rank() : { name: 'Rookie Courier', progress: 0.5 };
      const shiftEarnings = this.earnings;

      if (Career) {
        Career.recordShift(shiftEarnings);
      }

      sound.playRepair();

      const existing = document.getElementById('shift-summary-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'shift-summary-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(7,9,15,0.85);backdrop-filter:blur(8px);padding:16px;';

      modal.innerHTML = `
        <div style="max-width:440px;width:100%;background:#0e131d;border:3px solid #000;border-radius:18px;padding:24px;box-shadow:6px 6px 0px #000;display:flex;flex-direction:column;text-align:center;">
          <div style="font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:11px;letter-spacing:.2em;color:var(--comic-cyan,#00f0ff);font-weight:800;text-transform:uppercase;margin-bottom:8px;">${outOfParcels ? 'OUT OF PARCELS' : '★ SHIFT COMPLETED ★'}</div>
          <div style="font-family:var(--font-display,'Russo One',sans-serif);font-size:28px;font-weight:900;color:#fff;text-shadow:3px 3px 0px #000;margin-bottom:4px;">${outOfParcels ? 'SHIFT OVER' : 'EXCELLENT WORK'}</div>
          <div style="font-size:12px;font-family:var(--font-primary,'Barlow',sans-serif);font-weight:600;color:rgba(232,238,242,0.65);margin-bottom:20px;">${outOfParcels ? 'Every spare parcel is gone. Your streak resets; the money you earned is safe.' : `${this.deliveriesMade} Deliveries Completed This Shift`}</div>

          <div style="background:rgba(255,255,255,0.05);border:2px solid #000;border-radius:12px;padding:16px;margin-bottom:18px;display:flex;justify-content:space-around;box-shadow:2px 2px 0px #000">
            <div>
              <div style="font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:9px;letter-spacing:1.2px;color:rgba(232,238,242,0.5);font-weight:800;text-transform:uppercase;">SHIFT EARNED</div>
              <div style="font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:24px;font-weight:800;color:#ffe600;text-shadow:2px 2px 0px #000;margin-top:2px;">+₹${shiftEarnings.toLocaleString('en-IN')}</div>
            </div>
            <div style="border-left:2px solid #000;padding-left:16px;">
              <div style="font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:9px;letter-spacing:1.2px;color:rgba(232,238,242,0.5);font-weight:800;text-transform:uppercase;">TOTAL BALANCE</div>
              <div id="shift-wallet-val" style="font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:24px;font-weight:800;color:var(--comic-green,#22e565);text-shadow:2px 2px 0px #000;margin-top:2px;">₹${wallet.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div style="margin-bottom:16px;text-align:left;">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;">
              <span style="font-family:var(--font-display,'Russo One',sans-serif);font-weight:800;color:#fff;">${rank.name}</span>
              <span style="font-family:var(--font-telemetry,'Chakra Petch',monospace);font-weight:800;color:var(--comic-cyan,#00f0ff);">${Math.round(rank.progress * 100)}%</span>
            </div>
            <div style="width:100%;height:6px;background:rgba(0,0,0,0.6);border:1.5px solid #000;border-radius:4px;overflow:hidden;">
              <div style="width:${Math.round(rank.progress * 100)}%;height:100%;background:linear-gradient(90deg, var(--comic-yellow), var(--comic-cyan));"></div>
            </div>
          </div>

          <button id="shift-double-btn" style="width:100%;margin-bottom:12px;background:linear-gradient(135deg, #00f0ff, #22e565);color:#000;border:2.5px solid #000;border-radius:10px;padding:12px;font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:12px;font-weight:900;letter-spacing:.08em;box-shadow:3px 3px 0px #000;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <span>📺</span> <span>WATCH AD FOR 2x PAYOUT (+₹${shiftEarnings.toLocaleString('en-IN')})</span>
          </button>

          <div style="display:flex;gap:10px;">
            <button id="shift-next-btn" style="flex:1.2;background:#ffe600;color:#000000;border:2.5px solid #000;border-radius:10px;padding:13px;font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:12px;font-weight:800;letter-spacing:.1em;box-shadow:3px 3px 0px #000;cursor:pointer;">${outOfParcels ? 'NEW SHIFT' : 'NEXT SHIFT'}</button>
            <button id="shift-hub-btn" style="flex:1;background:rgba(255,255,255,0.08);color:#fff;border:2px solid #000;border-radius:10px;padding:13px;font-family:var(--font-telemetry,'Chakra Petch',monospace);font-size:12px;font-weight:800;box-shadow:2px 2px 0px #000;cursor:pointer;">DISPATCH HUB</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      this._shiftDoubleClaimed = false;
      const doubleBtn = modal.querySelector('#shift-double-btn');
      doubleBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        if (this._shiftDoubleClaimed) return;
        if (typeof ShiplypAds !== 'undefined' && ShiplypAds) {
          ShiplypAds.showRewarded('shift_double', {
            onReward: () => {
              this._shiftDoubleClaimed = true;
              const bonus = shiftEarnings;
              if (Career) {
                Career.credit(bonus, 'rewarded_ad');
              }
              sound.playDeliverySuccess();
              doubleBtn.style.background = '#22e565';
              doubleBtn.innerHTML = `<span>✅</span> <span>2X BONUS CLAIMED (+₹${bonus.toLocaleString('en-IN')})</span>`;
              doubleBtn.disabled = true;
              doubleBtn.style.cursor = 'default';
              const walletValEl = modal.querySelector('#shift-wallet-val');
              if (walletValEl && Career) {
                walletValEl.textContent = `₹${Career.wallet().toLocaleString('en-IN')}`;
              }
              this.addNotification(`📺 2x SHIFT BONUS: +₹${bonus.toLocaleString('en-IN')} CREDITED!`, 'success', 4000);
            },
            onError: () => {
              this.addNotification('Sponsor message unavailable', 'info', 2000);
            }
          });
        }
      });

      modal.querySelector('#shift-next-btn')?.addEventListener('click', () => {
        modal.remove();
        this._shiftSummaryActive = false;
        this._resetSpareParcels();
        this.earnings = 0; // B143: a new shift counts from zero, so the 2x ad can't pay a shift twice
        if (typeof ShiplypAds !== 'undefined' && ShiplypAds) {
          ShiplypAds.showInterstitial('shift_next');
        }
        this.addNotification(`${UI.icon('bolt')} NEW SHIFT STARTED`, 'success', 3000);
      });

      modal.querySelector('#shift-hub-btn')?.addEventListener('click', () => {
        modal.remove();
        this._shiftSummaryActive = false;
        if (typeof ShiplypAds !== 'undefined' && ShiplypAds) {
          ShiplypAds.showInterstitial('shift_hub');
        }
        this.renderDispatchHub();
      });
    }

    // The popup stack sits 88px down, centred. On narrow screens the top-right
    // telemetry box (speed / gear / distance, plus the STREAK pill when a
    // streak is live) reaches past that, so the banner covered it. Call after
    // appending a banner: if the stack's real box intersects the telemetry
    // box, drop the stack just below it. Its height changes (streak pill), and
    // on wide layouts it sits at the bottom of the screen, so measure every time.
    _placeScorePopups() {
      const c = this.scorePopupContainer;
      if (!c) return;
      c.style.top = '';
      const tel = document.querySelector('.slowroads-telemetry-box');
      if (!tel || !tel.offsetParent) return;
      const t = tel.getBoundingClientRect();
      const r = c.getBoundingClientRect();
      const hits = r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top;
      if (!hits) return;
      const parentTop = (c.offsetParent || document.body).getBoundingClientRect().top;
      c.style.top = Math.round(t.bottom - parentTop + 8) + 'px';
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
      this._placeScorePopups();
      setTimeout(() => {
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-12px) scale(0.95)';
        banner.style.transition = 'all 0.3s ease';
        setTimeout(() => banner.remove(), 300);
      }, 2600);
    }

    updateHUDStats() {
      const countEl = document.getElementById('delivery-count');
      const totalTargets = this.world?.deliveryTargets?.length || 12;
      if (countEl) countEl.textContent = `${this.deliveriesMade} / ${totalTargets}`;

      const earnEl = document.getElementById('hud-earnings');
      if (earnEl) earnEl.textContent = Career ? Career.wallet() : this.earnings; // spendable wallet, same pot the police and fines use

      const streakEl = document.getElementById('hud-streak-pill');
      if (streakEl) streakEl.textContent = `${this.streakCount}x STREAK`;
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
        if (h <= 0) icon.innerHTML = UI.icon('wrench');
        else if (h < 40) icon.innerHTML = UI.icon('alertTriangle');
        else icon.innerHTML = UI.icon('wrench');
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
    // The WANTED-level / fine / jail escalation was entirely the courier-
    // game's police-pursuit framing (Master Prompt section 1: remove the
    // WANTED system). Pedestrians/animals are still part of the world as
    // scenery/traffic (Master Prompt section 1 keeps world population),
    // so a hit still registers as a real collision — it just no longer
    // escalates into a fine/arrest modal, which was delivery-specific.
    checkCrosserCollisions() {
      if (!this.vehicle || !this.world || !this.world.crossers) return;
      const v = this.vehicle;
      const carPos = v.mesh.position;
      if (Math.abs(v.speed) <= 1.5) return;

      // B144: contact is judged on the ground plane from real body sizes
      // (was a 3D sphere of hitRadius + 1 m, which reached onto the sidewalk
      // from a bike riding along the kerb).
      const handling = vehicleSpec(this.selectedVehicle).handling;
      const vehHalf = handling === 'car' ? 1.05 : (handling === 'threeWheeler' ? 0.8 : 0.45);
      // Someone on the sidewalk can only be hit by a vehicle whose body has
      // actually crossed the kerb (e.g. at a driveway gap).
      const kerbLat = (CONFIG.SIDEWALK && CONFIG.SIDEWALK.enabled) ? CONFIG.ROAD_WIDTH * 0.52 : Infinity;
      const onRoadOnly = Math.abs(v.lateralOffset || 0) + vehHalf < kerbLat;
      const grid = this.world.roadSpatialGrid;

      for (let i = this.world.crossers.length - 1; i >= 0; i--) {
        const c = this.world.crossers[i];
        if (c.struck) continue;
        const p = c.mesh.position;
        const d = Math.hypot(p.x - carPos.x, p.z - carPos.z);
        if (d >= Math.min(c.hitRadius, 0.6) + vehHalf) continue;
        if (onRoadOnly && grid) {
          const near = grid.getNearestRoadPoint(p.x, p.z, 12.0);
          if (near && near.dist > kerbLat) continue;
        }
        c.struck = true;
        if (c.kind === 'pedestrian') window.ShiplypPolice?.reportOffence('hitPedestrian');
        this.world.foliageGroup.remove(c.mesh);
        this.world.crossers.splice(i, 1);
        sound.playCrash();
        break; // one hit per frame is plenty
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

      document.getElementById('btn-hud-autodrive')?.addEventListener('click', () => this.toggleAutodrive());
      document.getElementById('btn-hud-cruise')?.addEventListener('click', () => this.toggleCruise());
      document.getElementById('btn-hud-reset')?.addEventListener('click', () => {
        this.returnToRoad();
      });
      document.getElementById('btn-hud-tod')?.addEventListener('click', () => this.cycleTimeOfDay());
      document.getElementById('btn-dock-tod')?.addEventListener('click', () => this.cycleTimeOfDay());
      document.getElementById('btn-hud-camera')?.addEventListener('click', () => this.toggleCameraMode());
      document.getElementById('btn-dock-camera')?.addEventListener('click', () => this.toggleCameraMode());
      document.getElementById('btn-hud-sound')?.addEventListener('click', () => this.toggleMute());
      document.getElementById('btn-dock-sound')?.addEventListener('click', () => this.toggleMute());
      document.getElementById('btn-hud-audio')?.addEventListener('click', () => this.toggleMute());
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
      item.innerHTML = message;
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

    _showOnboardingHint(step) {
      this._dismissOnboardingHint();
      const isTouch = document.body.classList.contains('touch-controls-active') || ('ontouchstart' in window);
      const dropKey = isTouch ? 'DROP' : 'SPACE';
      const dropAction = isTouch ? 'Tap' : 'Press';
      const el = document.createElement('div');
      el.id = 'onboarding-hint';
      el.className = 'onboarding-hint';
      if (step === 'drive') {
        el.innerHTML = `
          <span class="onboarding-hint-icon">&#9650;</span>
          <span class="onboarding-hint-text">Drive to the glowing ring</span>
          <span class="onboarding-hint-sub">${dropAction} <kbd>${dropKey}</kbd> to drop when you're close</span>
        `;
      } else if (step === 'toss') {
        el.innerHTML = `
          <span class="onboarding-hint-icon">&#9632;</span>
          <span class="onboarding-hint-text">You're close — ${dropAction.toLowerCase()} <kbd>${dropKey}</kbd> to drop!</span>
        `;
      }
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('visible'));
    }

    _dismissOnboardingHint() {
      const existing = document.getElementById('onboarding-hint');
      if (!existing) return;
      existing.classList.remove('visible');
      setTimeout(() => existing.remove(), 350);
    }

    updateAudioHUDButtons() {
      const muted = sound.muted;
      const audioHudBtn = document.getElementById('btn-hud-audio');
      const hudBtn = document.getElementById('btn-hud-sound');
      const dockBtn = document.getElementById('btn-dock-sound');
      const hubBtn = document.getElementById('btn-hub-mute');

      if (audioHudBtn) {
        audioHudBtn.classList.toggle('muted', muted);
        const audioLabel = document.getElementById('label-audio');
        const audioDot = document.getElementById('dot-audio');
        if (audioLabel) audioLabel.textContent = muted ? 'AUDIO: OFF' : 'AUDIO: ON';
        if (audioDot) audioDot.classList.toggle('dot-off', muted);
      }
      if (hudBtn) hudBtn.textContent = muted ? 'UNMUTE' : 'MUTE';
      if (dockBtn) dockBtn.textContent = muted ? 'UNMUTE' : 'AUDIO';
      if (hubBtn) hubBtn.innerHTML = `<span>${(muted ? 'UNMUTE' : 'MUTE') + (document.body.classList.contains('touch-controls-active') ? '' : ' [M]')}</span>`;
    }

    toggleMute() {
      const isMuted = sound.toggleMute();
      this.updateAudioHUDButtons();
      this.showScorePopup(0, (isMuted ? 'AUDIO MUTED' : 'AUDIO ON') + (document.body.classList.contains('touch-controls-active') ? '' : ' [M]'));
    }

    updateClimateHUD() {
      const isSnow = (this.selectedSeason === 'winter' && this.selectedWeather !== 'clear') || (this.selectedWeather === 'blizzard');
      const isRain = (this.selectedWeather === 'rain') || ((this.selectedSeason === 'autumn' || this.selectedSeason === 'summer') && this.selectedWeather !== 'clear');
      const isWind = (this.selectedSeason === 'winter' || this.selectedSeason === 'summer');

      const pill = document.getElementById('hud-climate-pill');
      const icon = document.getElementById('climate-icon');
      const text = document.getElementById('climate-status');

      if (pill && text) {
        if (isSnow) {
          pill.className = 'climate-pill wind';
          if (icon) icon.innerHTML = UI.icon('cloud');
          text.textContent = `BLIZZARD SNOW • SLIPPERY GRIP (${this.vehicle && isTwoWheeler(this.vehicle.vehicleType) ? '45%' : '60%'})`;
        } else if (isRain) {
          pill.className = 'climate-pill rain';
          if (icon) icon.innerHTML = UI.icon('cloudRain');
          text.textContent = `MONSOON RAIN • SLIPPERY GRIP (${this.vehicle && isTwoWheeler(this.vehicle.vehicleType) ? '48%' : '68%'})`;
        } else if (isWind) {
          pill.className = 'climate-pill wind';
          if (icon) icon.innerHTML = UI.icon('wind');
          text.textContent = 'GUSTY HEADWIND • DRAG +35%';
        } else {
          pill.className = 'climate-pill';
          if (icon) icon.innerHTML = UI.icon('sun');
          text.textContent = 'DRY HIGHWAY • OPTIMAL GRIP 100%';
        }
      }
    }

    // AUTO STEER (F): the original autopilot — steers along the road and
    // manages speed. Turning it on switches AUTO DRIVE off.
    toggleAutodrive() {
      const v = this.vehicle;
      v.isAutodrive = !v.isAutodrive;
      if (v.isAutodrive) v.isCruise = false;
      // Belt-and-suspenders on top of the per-frame decay in update():
      // toggling autodrive off and back on within the same frame/second
      // (decay hasn't caught up yet) could still hand manual steering a
      // stale lateralVelocity the instant control returns — zero it here
      // so there's no timing window at all, not just a fast one.
      if (!v.isAutodrive) v.lateralVelocity = 0;
      if (v.isAutodrive) this._assistUsedThisOrder = true;
      this._announceAutoAssist(v.isAutodrive, 'AUTO STEER ON', 'MANUAL STEERING');
    }

    // AUTO DRIVE (G): speed only — the player keeps steering. Turning it on
    // switches AUTO STEER off.
    toggleCruise() {
      const v = this.vehicle;
      v.isCruise = !v.isCruise;
      if (v.isCruise) {
        if (v.isAutodrive) v.lateralVelocity = 0;
        v.isAutodrive = false;
        this._assistUsedThisOrder = true;
      }
      this._announceAutoAssist(v.isCruise, 'AUTO DRIVE ON', 'MANUAL SPEED');
    }

    _announceAutoAssist(on, onText, offText) {
      this.updateAutoAssistHUD();
      if (navigator.vibrate) navigator.vibrate(on ? [30, 40, 30] : 35);
      sound.playTone(on ? 880 : 440, 'sine', 0.1);
      this.showScorePopup(0, on ? onText : offText);
    }

    // Sync every auto-assist control (desktop pills + touch buttons) with
    // the vehicle state. Also called from Vehicle.update when the brake
    // disengages an assist.
    updateAutoAssistHUD() {
      const v = this.vehicle;
      const set = (id, on, textId, label, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('autodrive-active', !!on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
        const t = textId && document.getElementById(textId);
        if (t) t.textContent = `${label} [${on ? 'ON' : key}]`;
      };
      set('btn-hud-autodrive', v?.isAutodrive, 'autodrive-text', 'AUTO STEER', 'F');
      set('btn-hud-cruise', v?.isCruise, 'cruise-text', 'AUTO DRIVE', 'G');
      set('touch-btn-autopilot', v?.isAutodrive);
      set('touch-btn-cruise', v?.isCruise);
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
      const shortNames = {
        chase: 'CHASE',
        'far-chase': 'FAR CHASE',
        'first-person': 'FPV',
        hood: 'BUMPER',
        sky: 'SKY'
      };
      const camLabel = document.getElementById('label-cam');
      if (camLabel) camLabel.textContent = `CAM: ${shortNames[this.activeCameraMode]}`;
      this.showScorePopup(0, `${UI.icon('camera')} ${names[this.activeCameraMode]}`);
      sound.playTone(800, 'sine', 0.08);
    }

    toggleWeather() {
      this.selectedWeather = (this.selectedWeather === 'blizzard') ? 'clear' : 'blizzard';
      this.weather = this.selectedWeather;
      this.initWeatherSystem();
      this.updateClimateHUD();
      if (this.activeDockPanel === 'style') this.renderDockPanelContent('style');
      this._refreshMobileToolsDrawer();
      this.showScorePopup(0, this.selectedWeather === 'blizzard' ? `${UI.icon('cloud')} BLIZZARD` : `${UI.icon('sun')} CLEAR SKIES`);
      sound.playTone(600, 'sine', 0.08);
    }

    // Keep the mobile Tools drawer labels/icons in sync with game state.
    // Called after any change that could shift Time / Weather / Vehicle.
    _refreshMobileToolsDrawer() {
      const todIcons = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' };
      const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
      setText('touch-btn-tod-icon', todIcons[this.selectedTimeOfDay] || '☀️');
      setText('touch-btn-tod-label', `TIME: ${(this.selectedTimeOfDay || 'day').toUpperCase()}`);
      const isBlizzard = this.selectedWeather === 'blizzard';
      setText('touch-btn-weather-icon', isBlizzard ? '❄️' : '☀️');
      setText('touch-btn-weather-label', `WEATHER: ${isBlizzard ? 'BLIZZARD' : 'CLEAR'}`);
      const vName = vehicleSpec(this.selectedVehicle).name.toUpperCase();
      setText('touch-btn-vehicle-label', `VEHICLE: ${vName}`);
    }

    applyWindowGlow(tod) {
      if (!this.world || !this.world.windowMaterials) return;
      const intensity = (tod.night || tod.id === 'dusk') ? 0.85 : (tod.id === 'dawn' ? 0.15 : 0.0);
      for (const mat of this.world.windowMaterials) {
        mat.emissiveIntensity = intensity;
      }
    }

    setTimeOfDay(todKey) {
      const targetMap = { dawn: 0.06, day: 0.32, dusk: 0.68, night: 0.88 };
      if (targetMap[todKey] !== undefined) {
        this.targetDayProgress = targetMap[todKey];
      }
      this.selectedTimeOfDay = todKey;
      const tod = CONFIG.TIME_OF_DAY[todKey] || CONFIG.TIME_OF_DAY.day;

      const hudTodLabel = document.getElementById('label-tod');
      const dockTod = document.getElementById('btn-dock-tod');
      if (hudTodLabel) hudTodLabel.textContent = (tod.id || todKey).toUpperCase();
      if (dockTod) dockTod.innerHTML = UI.icon(tod.icon, 18);
      this._refreshMobileToolsDrawer();

      this.showScorePopup(0, `${UI.icon(tod.icon, 16)} ${tod.name.toUpperCase()}`);
      sound.playTone(720, 'sine', 0.1);
    }

    cycleTimeOfDay() {
      const keys = ['dawn', 'day', 'dusk', 'night'];
      const curIdx = keys.indexOf(this.selectedTimeOfDay || 'day');
      const nextKey = keys[(curIdx + 1) % keys.length];
      this.setTimeOfDay(nextKey);
    }

    // Continuous, gradual diurnal day-night cycle with smooth color lerps across all 4 keyframes
    updateDayNightCycle(dt) {
      if (!this.scene || !this.world || !this.vehicle) return;

      // 1. Advance continuous day progression
      if (this.targetDayProgress !== null) {
        let diff = this.targetDayProgress - this.dayProgress;
        if (diff > 0.5) diff -= 1.0;
        else if (diff < -0.5) diff += 1.0;
        this.dayProgress = (this.dayProgress + diff * Math.min(1.0, dt * 3.5) + 1.0) % 1.0;
        if (Math.abs(diff) < 0.005) {
          this.dayProgress = this.targetDayProgress;
          this.targetDayProgress = null;
        }
      } else {
        // Natural gradual passage of time (1 full 24h diurnal cycle every 10 min)
        this.dayProgress = (this.dayProgress + dt * (1.0 / 600.0)) % 1.0;
      }

      // 2. Diurnal keyframes: Dawn (0.06), Day (0.32), Dusk (0.68), Night (0.88)
      const keyframes = [
        { t: 0.06, tod: CONFIG.TIME_OF_DAY.dawn, id: 'dawn' },
        { t: 0.32, tod: CONFIG.TIME_OF_DAY.day, id: 'day' },
        { t: 0.68, tod: CONFIG.TIME_OF_DAY.dusk, id: 'dusk' },
        { t: 0.88, tod: CONFIG.TIME_OF_DAY.night, id: 'night' }
      ];

      let k0 = keyframes[keyframes.length - 1];
      let k1 = keyframes[0];
      for (let i = 0; i < keyframes.length; i++) {
        const next = keyframes[(i + 1) % keyframes.length];
        const tA = keyframes[i].t;
        const tB = next.t;
        let inRange = false;
        if (tA < tB) inRange = (this.dayProgress >= tA && this.dayProgress < tB);
        else inRange = (this.dayProgress >= tA || this.dayProgress < tB);
        if (inRange) {
          k0 = keyframes[i];
          k1 = next;
          break;
        }
      }

      let span = (k1.t - k0.t + 1.0) % 1.0;
      if (span <= 0.0001) span = 1.0;
      let prog = (this.dayProgress - k0.t + 1.0) % 1.0;
      const frac = THREE.MathUtils.smoothstep(prog / span, 0, 1);

      const c0 = k0.tod;
      const c1 = k1.tod;

      const curTop = new THREE.Color(c0.skyTop).lerp(new THREE.Color(c1.skyTop), frac);
      const curHoriz = new THREE.Color(c0.skyHorizon).lerp(new THREE.Color(c1.skyHorizon), frac);
      const curBot = new THREE.Color(c0.skyBottom).lerp(new THREE.Color(c1.skyBottom), frac);
      const curFogCol = new THREE.Color(c0.fog).lerp(new THREE.Color(c1.fog), frac);
      const curFogDens = THREE.MathUtils.lerp(c0.fogDensity || 0.003, c1.fogDensity || 0.003, frac);

      const curSunCol = new THREE.Color(c0.sunColor).lerp(new THREE.Color(c1.sunColor), frac);
      const curSunInt = THREE.MathUtils.lerp(c0.sunIntensity, c1.sunIntensity, frac);
      const curSunPos = new THREE.Vector3(...c0.sunPos).lerp(new THREE.Vector3(...c1.sunPos), frac);

      const curAmbCol = new THREE.Color(c0.ambientColor).lerp(new THREE.Color(c1.ambientColor), frac);
      const curAmbInt = THREE.MathUtils.lerp(c0.ambientIntensity, c1.ambientIntensity, frac);

      const meshIdx = Math.round(this.vehicle.splineProgress * CONFIG.ROAD_MESH_SEGMENTS);
      const inTunnel = this.world.isInTunnelZone && this.world.isInTunnelZone(meshIdx, 2);

      // Sky Dome uniforms
      if (this.world.skyMesh && this.world.skyMesh.material && this.world.skyMesh.material.uniforms) {
        this.world.skyMesh.material.uniforms.topCol.value.copy(curTop);
        this.world.skyMesh.material.uniforms.horizCol.value.copy(curHoriz);
        this.world.skyMesh.material.uniforms.botCol.value.copy(curBot);
      }
      if (this.scene.background) this.scene.background.copy(curBot);

      // Fog
      if (this.scene.fog) {
        const style = this.visualStyle?.currentStyle;
        const styleFogBase = VisualStyleManager.FOG_DENSITY[style] ?? curFogDens;
        const targetFogDens = inTunnel ? 0.0003 : styleFogBase;
        const targetFogCol = inTunnel ? new THREE.Color(0x1a1512) : curFogCol;
        this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetFogDens, 0.08);
        this.scene.fog.color.lerp(targetFogCol, 0.08);
      }

      // Sun & Directional Light
      if (this.sunLight) {
        const targetSunInt = inTunnel ? (curSunInt * 0.15) : curSunInt;
        this.sunLight.color.copy(curSunCol);
        this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, targetSunInt, 0.08);
        this.sunOffset = curSunPos;
      }

      // Ambient Light
      if (this.ambientLight) {
        const targetAmbCol = inTunnel ? new THREE.Color(0xffd180) : curAmbCol;
        const targetAmbInt = inTunnel ? 0.62 : curAmbInt;
        this.ambientLight.color.lerp(targetAmbCol, 0.08);
        this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, targetAmbInt, 0.08);
      }

      // Auto-Headlights: ON in tunnels, dusk, and night; OFF in daylight & dawn
      const isNightOrDusk = (this.dayProgress >= 0.64 || this.dayProgress <= 0.08);
      const isDusk = (this.dayProgress >= 0.64 && this.dayProgress < 0.78);
      if (inTunnel) {
        this.vehicle.setHeadlightsActive(true, 3.6);
      } else if (isNightOrDusk) {
        this.vehicle.setHeadlightsActive(true, isDusk ? 2.0 : 3.2);
      } else {
        this.vehicle.setHeadlightsActive(false, 0.0);
      }

      // Window glow on architectural buildings
      const windowInt = (this.dayProgress >= 0.64 || this.dayProgress <= 0.08) ? 0.85 : 0.0;
      if (this.world.windowMaterials) {
        this.world.windowMaterials.forEach(m => {
          m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, windowInt, 0.05);
        });
      }

      // Update HUD preset label
      const dominant = (frac < 0.5) ? k0 : k1;
      if (this.selectedTimeOfDay !== dominant.id) {
        this.selectedTimeOfDay = dominant.id;
        const hudTodLabel = document.getElementById('label-tod');
        const dockTod = document.getElementById('btn-dock-tod');
        if (hudTodLabel) hudTodLabel.textContent = dominant.id.toUpperCase();
        if (dockTod) dockTod.innerHTML = UI.icon(dominant.tod.icon, 18);
      }
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
              <div class="recovery-badge failed">${UI.icon('alertTriangle')} DISPATCH SHIFT FAILED</div>
              <h2 class="recovery-title">ALL 3 RECOVERY RESUMES EXHAUSTED</h2>
              <div class="recovery-resumes-pill exhausted">
                <span>${UI.icon('x')} 0 / 3 RESUMES REMAINING</span>
              </div>
              <p class="recovery-desc">
                Your courier vehicle suffered total mechanical failure beyond towing limits.
                <br><br>
                <strong>Progress Saved Before 1st Resume Restored:</strong>
                <br>${UI.icon('package')} Earnings: ₹${restoredEarnings} • ${UI.icon('package')} Deliveries: ${restoredDeliveries}
              </p>
              <button id="btn-restart-shift" class="btn-resume-drive">
                <span>${UI.icon('refresh')} RESTART DISPATCH SHIFT (PROGRESS RESTORED)</span>
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
            <div class="recovery-badge">${UI.icon('alertTriangle')} ROADSIDE ASSISTANCE</div>
            <h2 class="recovery-title">${reason}</h2>
            <div class="recovery-resumes-pill">
              <span>${UI.icon('lifebuoy')} RESUMES: ${remaining} / ${this.maxResumes} REMAINING</span>
            </div>
            <p class="recovery-desc">
              Your courier vehicle is immobilized or took critical damage.
              Tow vehicle back to road centerline with roadside assistance.
              <br><br>
              <small style="color: #fca311;">${UI.icon('alertTriangle')} Note: You have ${remaining} resume${remaining === 1 ? '' : 's'} remaining. On 4th breakdown, shift fails and restores progress saved before resume #1.</small>
            </p>
            <button id="btn-resume-drive" class="btn-resume-drive">
              <span>${UI.icon('bolt')} RESUME DISPATCH (TOW RECOVERY) [R]</span>
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
      this.showScorePopup(0, `${UI.icon('lifebuoy')} RESUME #${this.resumeCount}/3 USED! Vehicle Serviced`);
    }

    returnToRoad() {
      // Free instant snap back — no resume count penalty, no health cost
      if (!this.vehicle || !this.world) return;
      this.stuckTimer = 0;
      this.offRoadTimer = 0;
      this.isStuckModalOpen = false;
      this.lostFromRoad = false;
      this.modalContainer.innerHTML = '';
      this.hideReturnToRoadBanner();
      this.vehicle.snapToNearestRoadPoint(this.world.curve);
      sound.resumeForGameplay();
      this.showScorePopup(0, `${UI.icon('map')} RETURNED TO ROAD — DRIVE SAFELY!`);
      sound.playRepair();
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
        'background: linear-gradient(135deg, #ff0055 0%, #e60000 100%)',
        'color: #fff',
        'padding: 14px 32px',
        'border-radius: 12px',
        'font-family: var(--font-display, "Russo One", sans-serif)',
        'font-size: 1.05rem',
        'font-weight: 900',
        'font-style: italic',
        'text-transform: uppercase',
        'letter-spacing: 0.05em',
        'text-align: center',
        'box-shadow: 4px 4px 0px #000',
        'z-index: 8888',
        'cursor: pointer',
        'border: 3px solid #000',
        'animation: rtrPulse 1.2s ease-in-out infinite alternate'
      ].join(';');
      banner.innerHTML = UI.icon('map') + '&nbsp; YOU ARE OFF-ROAD &nbsp;|&nbsp; Press <kbd style="background:rgba(255,255,255,0.22);padding:2px 8px;border-radius:6px;">R</kbd> or tap here to Return to Road';
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

      // First-run: teleport the vehicle close to the first target so the player
      // sees it immediately and can complete a delivery within ~30 seconds.
      if (this._onboardingActive && this.world?.deliveryTargets?.length && this.world.curve) {
        const target = this.world.deliveryTargets[0];
        const targetU = target.splineU;
        const totalL = this.world.curve.getLength();
        const approachU = Math.max(0, targetU - 18.0 / totalL);
        const pt = this.world.curve.getPointAt(approachU);
        const tang = this.world.curve.getTangentAt(approachU);
        this.vehicle.mesh.position.copy(pt).add(new THREE.Vector3(0, 0.39, 0));
        this.vehicle.velocityHeading = Math.atan2(tang.x, tang.z);
        this.vehicle.heading = this.vehicle.velocityHeading;
        this.vehicle.splineProgress = approachU;
        this.vehicle.speed = isPedalVehicle(this.vehicle.vehicleType) ? 11.11 : 8.0;
        this.updateGPSNavigation();
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

    reconcileSelectedVehicle() {
      const fallback = 'cycle';
      // A removed vehicle can still be "owned" in an old save; never select an ID the registry lacks.
      if (!CONFIG.VEHICLES[this.selectedVehicle]) this.selectedVehicle = fallback;
      if (typeof Career !== 'undefined' && Career && typeof Career.isUnlocked === 'function') {
        if (!Career.isUnlocked('vehicles', this.selectedVehicle)) {
          const validVeh = (typeof Career.selectedVehicle === 'function' ? Career.selectedVehicle() : null)
            || (typeof Career.defaultVehicle === 'function' ? Career.defaultVehicle() : null)
            || fallback;
          this.selectedVehicle = CONFIG.VEHICLES[validVeh] ? validVeh : fallback;
        }
        if (typeof Career.setSelectedVehicle === 'function') {
          Career.setSelectedVehicle(this.selectedVehicle);
        }
      } else {
        if (!CONFIG.VEHICLES[this.selectedVehicle]) {
          this.selectedVehicle = fallback;
        }
      }
      return this.selectedVehicle;
    }

    renderDispatchHub() {
      this.reconcileSelectedVehicle();
      // Coming back from a drive: close the shift out BEFORE gameState flips,
      // since that flag is the only signal that a shift was in progress. Only
      // the distance travelled since the shift began is banked — distanceTraveled
      // is cumulative across shifts on a surviving vehicle instance.
      if (Career && this.gameState === 'playing') {
        const traveled = this.vehicle ? this.vehicle.distanceTraveled : 0;
        Career.endShift({ distanceKm: Math.max(0, traveled - (this._distanceBanked || 0)) });
        this._distanceBanked = traveled;
      }

      this.gameState = 'menu';
      // updateCamera only runs while playing, so it can't undo a first-person
      // near-clip itself; the hub's orbit camera must not inherit it.
      this._setFirstPersonNearPlane(false);
      if (typeof ShiplypAds !== 'undefined' && ShiplypAds) {
        ShiplypAds.gameplayStop();
      }
      sound.suspendForMenu();
      this.hudOverlay.style.display = 'none';
      this.dockEl.style.display = 'none';
      if (this.dockPanelEl) this.dockPanelEl.style.display = 'none';

      // Master Prompt section 1: no region/difficulty/delivery selection —
      // pick a world (location) and road style, and a vehicle, then drive.
      // Section 2.1: vehicle roster cut to 2 (was 4) — chotahathi (cargo
      // mini-truck) and cycle (courier bike) were both framed entirely
      // around delivery capacity/speed tradeoffs that no longer apply.
      // Single world (Nilambari Corridor), per direct instruction: concentrate on one
      // map and keep expanding on it rather than spreading effort across
      // 5 shallow ones. No world picker in the menu at all now — there's
      // nothing to pick. selectedCity stays 'mumbai' (set in the
      // constructor) and CONFIG.CITIES still holds the other 4 entries
      // undisturbed, so a picker can come back later without rebuilding
      // this from scratch if a second world is ever actually built out.

      const vehList = vehicleList();

      const styleList = [
        { id: 'crisp',     name: 'Crisp',     stat: 'Sharp Outlines • Lighter',    gif: 'assets/style-previews/crisp.webp' },
        { id: 'cinematic', name: 'Cinematic', stat: 'Bloom + Grade • Heavier',     gif: 'assets/style-previews/cinematic.webp' },
      ];
      const currentStyle = this.visualStyle?.selectedStyle || VisualStyleManager.DEFAULT_STYLE;

      // Career strip: the only place a returning player sees that the last
      // session actually counted. Rendered from the persisted profile, never
      // from live engine state, so what it shows is exactly what was saved.
      let careerStrip = '';
      if (Career) {
        const rank = Career.rank();
        const stats = Career.career();
        const daily = this._dailyCheckIn;
        const pct = Math.round(rank.progress * 100);
        const nextLine = rank.next
          ? `₹${rank.toNext.toLocaleString('en-IN')} to ${rank.next.name}`
          : 'Top rank reached';
        const dailyLine = (daily && daily.bonus > 0)
          ? `<div class="career-daily-row">${UI.icon('flame', 13)} Day ${daily.streak} check-in &bull; +₹${daily.bonus} paid into your account</div>`
          : '';

        careerStrip = `
          <div class="hub-career-strip">
            <div class="career-top-row">
              <div class="career-identity">
                <span class="career-rank-name">${rank.name}</span>
                <span class="career-rank-next">${nextLine}</span>
              </div>
              <div class="career-bank">
                <span class="career-bank-label">ACCOUNT</span>
                <span class="career-bank-value">₹${Career.wallet().toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div class="career-rank-track"><div class="career-rank-fill" style="width: ${pct}%"></div></div>
            <div class="career-stats-row">
              <span><b>${stats.deliveries.toLocaleString('en-IN')}</b> ${stats.deliveries === 1 ? 'DROP' : 'DROPS'}</span>
              <span><b>${stats.distanceKm.toFixed(1)}</b> KM</span>
              <span><b>${stats.bestStreak}x</b> BEST STREAK</span>
              <span><b>${stats.shifts}</b> ${stats.shifts === 1 ? 'SHIFT' : 'SHIFTS'}</span>
            </div>
            ${dailyLine}
          </div>
        `;
      }

      const onboardingBanner = this._onboardingActive ? `
        <div class="hub-onboarding-banner">
          <span class="onboarding-banner-title">Welcome to Shiplyp</span>
          <span class="onboarding-banner-body">Your first delivery is waiting just down the road. Drive up to the glowing ring and ${document.body.classList.contains('touch-controls-active') ? 'tap DROP' : 'press SPACE'} to drop the parcel.</span>
        </div>
      ` : '';

      this.modalContainer.innerHTML = `
        <div class="modal-backdrop">
          <div class="shiplyp-hub-card">
            <div class="hub-brand-header">
              <h1 class="hub-brand-title">SHIP<span>LYP</span></h1>
            </div>
            <p class="hub-tagline">Endless Driving • India Roads</p>

            <div class="hub-col hub-col-left">
            ${onboardingBanner}
            ${careerStrip}
            </div>

            <div class="hub-col hub-col-right">
            <!-- 3. Select Vehicle -->
            <div class="hub-vehicle-selector">
              <span class="hub-section-label">SELECT VEHICLE</span>
              <div class="hub-vehicle-grid">
                ${vehList.map(v => {
                  const meta = v;
                  const unlocked = Career ? Career.isUnlocked('vehicles', v.id) : true;
                  const wallet = Career ? Career.wallet() : 0;
                  const canAfford = wallet >= (meta.price || 0);
                  const shortfall = (meta.price || 0) - wallet;
                  const ctaLabel = canAfford ? 'CLAIM SHIFT' : `NEED ₹${shortfall.toLocaleString('en-IN')} MORE`;
                  const isSelected = this.selectedVehicle === v.id;
                  return `
                    <button class="vehicle-card-btn ${isSelected ? 'active-veh' : ''} ${unlocked ? '' : 'veh-locked'}" data-veh="${v.id}" data-unlocked="${unlocked}">
                      <span class="vehicle-card-title">${v.name}</span>
                      <span class="vehicle-card-stat">${v.speedLabel} • ${v.payoutMult === 1 ? 'Base pay' : '×' + v.payoutMult + ' pay'}</span>
                      ${!unlocked ? `<span class="veh-lock-cost">₹${(meta.price||0).toLocaleString('en-IN')}</span><span class="veh-lock-cta">${ctaLabel}</span>` : ''}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 4. Select Visual Style -->
            <div class="hub-difficulty-selector">
              <span class="hub-section-label">SELECT VISUAL STYLE</span>
              <div class="hub-style-grid">
                ${styleList.map(s => `
                  <button class="style-card-btn ${currentStyle === s.id ? 'active-diff' : ''}" data-style="${s.id}">
                    <img class="style-card-preview" src="${s.gif}" alt="${s.name} style preview" loading="lazy">
                    <span class="style-card-title">${s.name.toUpperCase()}</span>
                    <span class="vehicle-card-stat">${s.stat}</span>
                  </button>
                `).join('')}
              </div>
            </div>
            </div>

            <button id="btn-start-dispatch" class="btn-launch-dispatch">
              <span>${this._onboardingActive ? 'FIRST DELIVERY' : 'DRIVE'}</span>
            </button>

            <div class="hub-footer-links">
              <button id="btn-hub-sponsor" class="hub-link-btn" style="color:var(--comic-green,#22e565);font-weight:800;"><span>📺 SPONSOR (+₹500)</span></button>
              <button id="btn-hub-mute" class="hub-link-btn"><span>${(sound.muted ? 'UNMUTE' : 'MUTE') + (document.body.classList.contains('touch-controls-active') ? '' : ' [M]')}</span></button>
              <button id="btn-hub-fleet" class="hub-link-btn">SETTINGS</button>
            </div>
          </div>
        </div>
      `;

      this.modalContainer.querySelectorAll('.vehicle-card-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const vehId = btn.dataset.veh;
          const unlocked = btn.dataset.unlocked === 'true';
          if (!unlocked) {
            this._showUnlockSheet(vehId);
            return;
          }
          this.selectedVehicle = vehId;
          if (Career && typeof Career.setSelectedVehicle === 'function') {
            Career.setSelectedVehicle(vehId);
          }
          this.modalContainer.querySelectorAll('.vehicle-card-btn').forEach(b => b.classList.remove('active-veh'));
          btn.classList.add('active-veh');
          if (this.vehicle) this.vehicle.setVehicleType(this.selectedVehicle);
          sound.playTone(750, 'sine', 0.08);
        });
      });

      this.modalContainer.querySelectorAll('[data-style]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.visualStyle?.applyStyle(btn.dataset.style);
          this.modalContainer.querySelectorAll('[data-style]').forEach(b => b.classList.remove('active-diff'));
          btn.classList.add('active-diff');
          sound.playTone(700, 'sine', 0.08);
        });
      });

      document.getElementById('btn-start-dispatch')?.addEventListener('click', (e) => {
        e.preventDefault();
        // Play-now already started the first boot; a second press (or a test
        // script's click) mid-boot must not build the world twice.
        if (this._booting) return;
        if (!this._worldBuilt) {
          // First launch: show the full-screen loader and build the world
          // in staged, yielded steps (see _bootWithLoader) before driving.
          this._worldBuilt = true;
          this._booting = true;
          const loaderEl = document.getElementById('game-loader');
          if (loaderEl) { loaderEl.style.display = 'flex'; loaderEl.style.opacity = '1'; }
          this._bootWithLoader();
        } else {
          this.buildWorldAndScene();
          this.startDrive();
        }
      });
      document.getElementById('btn-hub-sponsor')?.addEventListener('click', (e) => {
        e.preventDefault();
        const now = Date.now();
        if (this._sponsorAdCooldown && now < this._sponsorAdCooldown) {
          const waitSecs = Math.ceil((this._sponsorAdCooldown - now) / 1000);
          this.addNotification(`⏳ SPONSOR COOLDOWN: WAIT ${waitSecs}s`, 'info', 2000);
          return;
        }
        if (typeof ShiplypAds !== 'undefined' && ShiplypAds) {
          ShiplypAds.showRewarded('sponsor_cash', {
            onReward: () => {
              this._sponsorAdCooldown = Date.now() + 60000;
              if (Career) {
                Career.credit(500, 'sponsor_ad');
              }
              sound.playDeliverySuccess();
              this.addNotification('📺 +₹500 SPONSOR CASH CREDITED TO ACCOUNT!', 'success', 3500);
              this.renderDispatchHub();
            },
            onError: () => {
              this.addNotification('Sponsor ad unavailable, try again later', 'info', 2000);
            }
          });
        }
      });
      document.getElementById('btn-hub-mute')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleMute();
      });
      document.getElementById('btn-hub-fleet')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.openSettingsModal('gameplay');
      });
    }

    renderDockPanelContent(type) {
      const el = this.dockPanelEl;

      if (type === 'style') {
        el.innerHTML = `
          <div class="dock-panel-grid" style="display: flex; gap: 24px; justify-content: flex-start; align-items: flex-start;">
            <div class="dock-panel-col" style="flex: 2;">
              <span class="dock-panel-label" style="font-size: 0.68rem; letter-spacing: 1.5px; opacity: 0.8; margin-bottom: 8px; display: block;">TIME</span>
              <div class="dock-btn-row" style="display: flex; gap: 8px;">
                <button class="dock-sq-btn icon-only-btn ${this.selectedTimeOfDay === 'dawn' ? 'active-sq' : ''}" data-tod="dawn" title="Sunrise / Dawn">${UI.icon('sunrise', 18)}</button>
                <button class="dock-sq-btn icon-only-btn ${this.selectedTimeOfDay === 'day' ? 'active-sq' : ''}" data-tod="day" title="Midday / Sun">${UI.icon('sun', 18)}</button>
                <button class="dock-sq-btn icon-only-btn ${this.selectedTimeOfDay === 'dusk' ? 'active-sq' : ''}" data-tod="dusk" title="Sunset / Dusk">${UI.icon('sunset', 18)}</button>
                <button class="dock-sq-btn icon-only-btn ${this.selectedTimeOfDay === 'night' ? 'active-sq' : ''}" data-tod="night" title="Starry Night">${UI.icon('moon', 18)}</button>
              </div>
            </div>
            <div class="dock-panel-col" style="flex: 1;">
              <span class="dock-panel-label" style="font-size: 0.68rem; letter-spacing: 1.5px; opacity: 0.8; margin-bottom: 8px; display: block;">WEATHER</span>
              <div class="dock-btn-row" style="display: flex; gap: 8px;">
                <button class="dock-sq-btn icon-only-btn ${(!this.selectedWeather || this.selectedWeather === 'clear' || this.selectedWeather === 'rain') ? 'active-sq' : ''}" data-w="clear" title="Clear Sky">${UI.icon('sun', 18)}</button>
                <button class="dock-sq-btn icon-only-btn ${this.selectedWeather === 'blizzard' ? 'active-sq' : ''}" data-w="blizzard" title="Blizzard / Snow">${UI.icon('cloud', 18)}</button>
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
        el.querySelectorAll('[data-w]').forEach(b => {
          b.onclick = () => {
            this.selectedWeather = b.dataset.w;
            this.weather = this.selectedWeather;
            this.initWeatherSystem();
            this.updateClimateHUD();
            this.renderDockPanelContent('style');
            sound.playTone(680, 'sine', 0.1);
          };
        });
      } else if (type === 'vehicle') {
        const btns = vehicleList().map((v) => {
          const owned = Career ? Career.isUnlocked('vehicles', v.id) : true;
          const title = owned ? v.name : `Locked (₹${v.price.toLocaleString('en-IN')} in Career)`;
          return `<button class="dock-sq-btn ${this.selectedVehicle === v.id ? 'active-sq' : ''} ${owned ? '' : 'veh-dock-locked'}" data-v="${v.id}" title="${title}">${owned ? '' : '🔒 '}${v.short}</button>`;
        }).join('');
        el.innerHTML = `
          <div class="dock-panel-grid">
            <div class="dock-panel-col">
              <span class="dock-panel-label">VEHICLE</span>
              <div class="dock-btn-row">${btns}</div>
            </div>
          </div>
        `;
        el.querySelectorAll('[data-v]').forEach(b => {
          b.onclick = () => {
            const vehId = b.dataset.v;
            if (Career && !Career.isUnlocked('vehicles', vehId)) {
              sound.playTone(300, 'square', 0.1);
              this.addNotification('🔒 VEHICLE LOCKED — UNLOCK IN DISPATCH HUB', 'warning', 3000);
              return;
            }
            this.selectedVehicle = vehId;
            if (Career && typeof Career.setSelectedVehicle === 'function') {
              Career.setSelectedVehicle(vehId);
            }
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
              <button class="tab-link ${tab === 'gameplay' ? 'active-tab' : ''}" data-tab="gameplay">VEHICLE TUNING</button>
              <button class="tab-link ${tab === 'controls' ? 'active-tab' : ''}" data-tab="controls">CONTROLS</button>
              <button class="tab-link ${tab === 'profile' ? 'active-tab' : ''}" data-tab="profile">TRIP</button>
            </div>

            <div class="settings-body">
              ${tab === 'gameplay' && !this.vehicle ? `
                <div class="settings-section-title"><span>PERFORMANCE CALIBRATION</span></div>
                <div class="settings-row"><span class="settings-label">Start a drive to tune your vehicle.</span></div>
              ` : tab === 'gameplay' ? `
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
                ${document.body.classList.contains('touch-controls-active') ? `
                <div class="settings-section-title"><span>${UI.icon('car')} DRIVING</span></div>
                <div class="settings-row"><span class="settings-label">Accelerate</span><span class="slider-val">▲ button</span></div>
                <div class="settings-row"><span class="settings-label">Brake / Reverse</span><span class="slider-val">▼ button</span></div>
                <div class="settings-row"><span class="settings-label">Steer Left / Right</span><span class="slider-val">◀ ▶ buttons</span></div>

                <div class="settings-section-title" style="margin-top: 14px;"><span>${UI.icon('package')} DELIVERY</span></div>
                <div class="settings-row"><span class="settings-label">Express Drop (near the ring)</span><span class="slider-val">DROP</span></div>

                <div class="settings-section-title" style="margin-top: 14px;"><span>${UI.icon('wrench')} ASSISTS & TOOLS</span></div>
                <div class="settings-row"><span class="settings-label">Auto Steer (steers + speed)</span><span class="slider-val">A-STEER</span></div>
                <div class="settings-row"><span class="settings-label">Auto Drive (speed only, you steer)</span><span class="slider-val">A-DRIVE</span></div>
                <div class="settings-row"><span class="settings-label">Camera, Recenter, Horn, Time, Weather, Vehicle</span><span class="slider-val">TOOLS</span></div>
                <div class="settings-row"><span class="settings-label">Settle with the police (when wanted)</span><span class="slider-val">Tap the ★ meter</span></div>
                ` : `
                <div class="settings-section-title"><span>${UI.icon('car')} DRIVING</span></div>
                <div class="settings-row"><span class="settings-label">Accelerate</span><span class="slider-val">W / ↑</span></div>
                <div class="settings-row"><span class="settings-label">Brake / Reverse</span><span class="slider-val">S / ↓</span></div>
                <div class="settings-row"><span class="settings-label">Steer Left / Right</span><span class="slider-val">A / D or ← / →</span></div>
                <div class="settings-row"><span class="settings-label">Power-Slide Drift</span><span class="slider-val">[SPACE] (hold while steering)</span></div>

                <div class="settings-section-title" style="margin-top: 14px;"><span>${UI.icon('package')} DELIVERY</span></div>
                <div class="settings-row"><span class="settings-label">Express Drop (Drive-by Toss)</span><span class="slider-val">[SPACE] or Click</span></div>

                <div class="settings-section-title" style="margin-top: 14px;"><span>${UI.icon('wrench')} ASSISTS, CAMERA & ENVIRONMENT</span></div>
                <div class="settings-row"><span class="settings-label">Auto Steer (steers + speed)</span><span class="slider-val">[F]</span></div>
                <div class="settings-row"><span class="settings-label">Auto Drive (speed only, you steer)</span><span class="slider-val">[G]</span></div>
                <div class="settings-row"><span class="settings-label">Return to Road (Recenter)</span><span class="slider-val">[R]</span></div>
                <div class="settings-row"><span class="settings-label">Cycle Camera View</span><span class="slider-val">[C]</span></div>
                <div class="settings-row"><span class="settings-label">Cycle Time of Day</span><span class="slider-val">[T]</span></div>
                <div class="settings-row"><span class="settings-label">Horn / Bell</span><span class="slider-val">[H]</span></div>
                <div class="settings-row"><span class="settings-label">Settle with the police (when wanted)</span><span class="slider-val">[B] or click the ★ meter</span></div>

                <div class="settings-section-title" style="margin-top: 14px;"><span>AUDIO & MENU</span></div>
                <div class="settings-row"><span class="settings-label">Mute / Unmute Audio</span><span class="slider-val">[M]</span></div>
                <div class="settings-row"><span class="settings-label">Controls List</span><span class="slider-val">[O] or [?]</span></div>
                <div class="settings-row"><span class="settings-label">Settings Menu</span><span class="slider-val">[ESC]</span></div>
                `}
              ` : `
                <div class="settings-section-title"><span>TRIP SUMMARY</span></div>
                <div class="settings-row"><span class="settings-label">Distance Driven</span><span class="slider-val">${(this.vehicle ? this.vehicle.distanceTraveled : 0).toFixed(1)} KM</span></div>
              `}
              ${tab === 'gameplay' ? `
                <div class="settings-section-title" style="margin-top: 14px;"><span>DISPLAY &amp; SOUND</span></div>
                <div class="settings-row">
                  <span class="settings-label">Sound</span>
                  <div class="settings-control">
                    <button type="button" class="slider-val" id="set-sound" aria-pressed="${!sound.muted}" style="cursor:pointer;min-width:56px;min-height:32px">${sound.muted ? 'OFF' : 'ON'}</button>
                  </div>
                </div>
                <div class="settings-row">
                  <span class="settings-label">Show FPS counter</span>
                  <div class="settings-control">
                    <button type="button" class="slider-val" id="set-show-fps" aria-pressed="${this._fpsCounterOn()}" style="cursor:pointer;min-width:56px;min-height:32px">${this._fpsCounterOn() ? 'ON' : 'OFF'}</button>
                  </div>
                </div>
              ` : ''}
              ${tab === 'gameplay' && window.ShiplypPolice ? window.ShiplypPolice.settingsHTML() : ''}
              <p class="settings-legal">${document.getElementById('currency-disclaimer')?.textContent || ''}</p>
            </div>

            <div class="settings-footer">
              <span class="settings-version">SHIPLYP V1.0</span>
              <button id="btn-close-settings" class="btn-settings-close">CLOSE</button>
            </div>
          </div>
        </div>
      `;

      window.ShiplypPolice?.bindSettings(this.modalContainer);
      // B142: Audio and FPS moved off the play screen into Settings.
      const sndBtn = document.getElementById('set-sound');
      if (sndBtn) {
        sndBtn.onclick = () => {
          this.toggleMute();
          sndBtn.textContent = sound.muted ? 'OFF' : 'ON';
          sndBtn.setAttribute('aria-pressed', String(!sound.muted));
        };
      }
      const fpsBtn = document.getElementById('set-show-fps');
      if (fpsBtn) {
        fpsBtn.onclick = () => {
          const on = !this._fpsCounterOn();
          try { localStorage.setItem('shiplyp_showFps', on ? '1' : '0'); } catch (e) {}
          this._applyFpsCounter();
          fpsBtn.textContent = on ? 'ON' : 'OFF';
          fpsBtn.setAttribute('aria-pressed', String(on));
        };
      }
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

    // First-person gets a much closer near-clip than every other view: any
    // cabin geometry in front of the driver's eye (dash, steering wheel)
    // sits well inside the default 0.5 used by the other camera modes and
    // would get clipped. The one camera is shared by every view, so this is
    // also called with false wherever the game stops driving (the hub),
    // or the closer plane would leak into views that don't need it. Only
    // touches the camera when the state actually changes.
    _setFirstPersonNearPlane(on) {
      if (!this.camera || !!this._fpNearApplied === on) return;
      this.camera.near = on ? 0.1 : 0.5;
      this.camera.updateProjectionMatrix();
      this._fpNearApplied = on;
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
    _updateDeliveryHalo(target) {
      let h = this._halo;
      if (!h) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.38, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256);
        const rg = new THREE.RingGeometry(2.7, 3.4, 64); rg.rotateX(-Math.PI / 2);
        const pg = new THREE.PlaneGeometry(13, 13); pg.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x35e08a, transparent: true, opacity: 0.95, depthWrite: false, fog: false, side: THREE.DoubleSide });
        const glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), color: 0x35e08a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
        const group = new THREE.Group(), ring = new THREE.Mesh(rg, ringMat), glow = new THREE.Mesh(pg, glowMat); glow.position.y = 0.02; glow.renderOrder = 4; ring.renderOrder = 5;
        group.add(glow); group.add(ring); group.visible = false;
        h = this._halo = { group, ring, glow, ringMat, glowMat, phase: 0, last: performance.now(), target: null, nextBox: 0,
          cols: [new THREE.Color(0x35e08a), new THREE.Color(0xffb41f), new THREE.Color(0xff3a2e)], tmp: new THREE.Color(), box: new THREE.Box3() };
      }
      if (h.group.parent !== this.scene) this.scene.add(h.group);
      if (!target || target.delivered || !target.ring || !target.ring.parent || this.orderTimer == null || !this.maxOrderTimer) { h.group.visible = false; h.target = null; return; }
      const now = performance.now(), dt = Math.min(0.1, (now - h.last) / 1000); h.last = now;
      if (h.target !== target || now > h.nextBox) {              // house top: re-measured about once a second (the model loads a moment after the stand-in)
        const hg = target.ring.parent; hg.updateMatrixWorld(true); h.box.setFromObject(hg);
        const top = Number.isFinite(h.box.max.y) ? h.box.max.y : target.pos.y + 6; h.group.position.set(hg.position.x, top + 1.6, hg.position.z);
        h.target = target; h.nextBox = now + 1000;
      }
      h.group.visible = true;
      const f = THREE.MathUtils.clamp(this.orderTimer / this.maxOrderTimer, 0, 1), sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
      h.tmp.copy(h.cols[0]).lerp(h.cols[1], sm(0.55, 0.45, f)).lerp(h.cols[2], sm(0.25, 0.15, f));
      const u = 1 - f, I = 0.6 + 1.9 * Math.pow(u, 1.3), freq = 1.0 + 2.8 * Math.pow(u, 1.5);
      h.phase += freq * dt; const p = 0.5 + 0.5 * Math.sin(h.phase * Math.PI * 2);
      const x = this.dayProgress, dark = (x >= 0.72 || x <= 0.01) ? 1 : (x > 0.55 ? sm(0.55, 0.72, x) : (x < 0.12 ? 1 - sm(0.01, 0.11, x) : 0));   // dawn fade starts earlier: the sky is already pink by 0.05
      const dayK = 0.14 + 0.86 * dark;                             // daylight glow is only ~14% of the night glow
      h.ringMat.color.copy(h.tmp).multiplyScalar(0.82 + 0.3 * dark); h.ringMat.opacity = 0.82 + 0.13 * p;
      h.glowMat.color.copy(h.tmp); h.glowMat.opacity = Math.min(1, (0.24 + 0.26 * I) * (0.7 + 0.3 * p) * dayK);
      h.glow.scale.setScalar(1 + (0.05 * I * p + 0.15 * u) * (0.4 + 0.6 * dark)); h.ring.scale.setScalar(1 + 0.02 * p);
    }

    updateGPSNavigation() {
      if (!this.world || !this.vehicle) return;
      const playerPos = this.vehicle.mesh.position;
      const playerForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicle.mesh.quaternion).normalize();
      const carPos = playerPos;

      // Find next undelivered target
      let nextTarget = null;
      let minDistance = 999999;
      this.world.deliveryTargets.forEach(t => {
        if (!t.delivered) {
          const d = playerPos.distanceTo(t.pos);
          if (d < minDistance) {
            minDistance = d;
            nextTarget = t;
          }
        }
      });
      this._updateDeliveryHalo(nextTarget);

      // Update Waypoint HUD Arrow & Modern Delivery Mission Capsule
      const capsule = document.getElementById('delivery-mission-capsule');
      const promptEl = document.getElementById('drop-action-prompt');
      const tagTextEl = document.getElementById('delivery-tag-text');
      const payoutTextEl = document.getElementById('delivery-payout-text');
      const destNameEl = document.getElementById('delivery-dest-name');
      const distBadgeEl = document.getElementById('delivery-dist-badge');
      const cargoDescEl = document.getElementById('delivery-cargo-desc');
      const sideBadgeEl = document.getElementById('delivery-side-badge');

      const wpTargetEl = document.getElementById('waypoint-target-text');
      const wpDistEl = document.getElementById('waypoint-distance-text');
      const gpsDistEl = document.getElementById('gps-next-dist');

      if (nextTarget) {
        const toTarget = nextTarget.pos.clone().sub(playerPos);
        const playerRight = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.vehicle.mesh.quaternion);
        const sideDot = playerRight.dot(toTarget);
        const sideText = sideDot > 0 ? 'RIGHT' : 'LEFT';
        const distMeters = Math.round(minDistance);
        const isAhead = playerForward.dot(toTarget) > 0;
        const aheadText = isAhead ? 'AHEAD' : 'BEHIND';

        // Legacy hook targets
        if (wpTargetEl) wpTargetEl.textContent = nextTarget.order.name;
        if (wpDistEl) wpDistEl.textContent = `${distMeters}m ${aheadText} [${sideText}]`;
        if (gpsDistEl) gpsDistEl.textContent = `${distMeters}m`;

        // Modern Delivery Capsule update
        if (tagTextEl) tagTextEl.textContent = 'EXPRESS DROP';
        if (payoutTextEl) payoutTextEl.textContent = `+₹${nextTarget.order?.reward || 85}`;
        if (destNameEl) destNameEl.textContent = nextTarget.order?.name || 'Scenic Drop Point';
        if (cargoDescEl) cargoDescEl.textContent = nextTarget.order?.cargo || 'Express Package';
        if (distBadgeEl) {
          distBadgeEl.textContent = `${distMeters}m`;
          distBadgeEl.classList.toggle('dist-near', distMeters <= 65);
        }
        if (sideBadgeEl) sideBadgeEl.textContent = `${aheadText} [${sideText}]`;

        // Approach state within 75m
        const isNearDrop = !!this._findTossTarget(carPos, playerForward);
        const touchDropBtn = document.getElementById('touch-btn-drop');

        if (isNearDrop) {
          capsule?.classList.add('delivery-approaching');
          if (promptEl) {
            promptEl.style.display = 'flex';
            promptEl.innerHTML = `
              <div class="action-key-pill"><span class="key-cap">SPACE</span> EXPRESS DROP</div>
            `;
          }
          if (touchDropBtn) touchDropBtn.style.display = 'flex';
        } else {
          capsule?.classList.remove('delivery-approaching');
          if (promptEl) promptEl.style.display = 'none';
          if (touchDropBtn) touchDropBtn.style.display = 'none';
        }
      } else {
        const touchDropBtn = document.getElementById('touch-btn-drop');
        if (touchDropBtn) touchDropBtn.style.display = 'none';
        if (wpTargetEl) wpTargetEl.textContent = 'ALL ORDERS DELIVERED!';
        if (wpDistEl) wpDistEl.textContent = 'PROCEED TO DISPATCH HUB';
        if (gpsDistEl) gpsDistEl.textContent = '0m';

        if (tagTextEl) tagTextEl.textContent = 'ALL DELIVERED';
        if (payoutTextEl) payoutTextEl.textContent = '₹0';
        if (destNameEl) destNameEl.textContent = 'All Orders Completed!';
        if (cargoDescEl) cargoDescEl.textContent = 'Scenic Highway Free Cruise';
        if (distBadgeEl) {
          distBadgeEl.textContent = '--m';
          distBadgeEl.classList.remove('dist-near');
        }
        if (sideBadgeEl) sideBadgeEl.textContent = 'CLEAR';

        capsule?.classList.remove('delivery-approaching');
        if (promptEl) promptEl.style.display = 'none';
      }

      // Render 2D Slow Roads Curvature Radar
      const canvas = document.getElementById('gps-radar-canvas') || document.getElementById('gps-minimap-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Radar background concentric range rings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h - 24, 30, Math.PI, 0);
      ctx.arc(w / 2, h - 24, 60, Math.PI, 0);
      ctx.arc(w / 2, h - 24, 90, Math.PI, 0);
      ctx.stroke();

      // Motion-aligned coordinate basis (travel direction)
      const vh = this.vehicle.velocityHeading;
      const travelForward = new THREE.Vector3(Math.sin(vh), 0, Math.cos(vh));
      const travelRight = new THREE.Vector3(-Math.cos(vh), 0, Math.sin(vh));

      // Draw Spline Road Ahead on Radar
      if (this.world.curve) {
        const curU = this.vehicle.splineProgress;
        const totalLen = Math.max(100, this.world.curve.getLength());
        const pts = [];

        for (let i = -4; i <= 36; i++) {
          const sampleU = THREE.MathUtils.clamp(curU + (i * 6.0) / totalLen, 0, 1);
          const pt = this.world.curve.getPointAt(sampleU);
          const rel = pt.clone().sub(carPos);

          const latDist = rel.dot(travelRight);
          const fwdDist = rel.dot(travelForward);

          const mx = w / 2 + latDist * 0.95;
          const my = (h - 24) - fwdDist * 0.95;
          pts.push({ x: mx, y: my, fwdDist });
        }

        if (pts.length > 1) {
          // 1. Dark asphalt road underlay
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();

          // 2. Glowing Cyan / Sage Centerline with distance fade
          const grad = ctx.createLinearGradient(w / 2, h - 24, w / 2, 8);
          grad.addColorStop(0, '#38bdf8');
          grad.addColorStop(0.7, '#2dd4bf');
          grad.addColorStop(1, 'rgba(45, 212, 191, 0.1)');

          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.2;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Draw Active Delivery Waypoint on Radar
        if (nextTarget) {
          const relTarget = nextTarget.pos.clone().sub(carPos);
          const targetLat = relTarget.dot(travelRight);
          const targetFwd = relTarget.dot(travelForward);

          const targetMx = w / 2 + targetLat * 0.95;
          const targetMy = (h - 24) - targetFwd * 0.95;

          // Is the waypoint within radar display bounds?
          if (targetFwd >= -15 && targetFwd <= 125 && Math.abs(targetLat) <= 55) {
            ctx.save();
            // 1. Dashed connector from road center to drop point turnout
            if (pts.length > 0) {
              let closestPt = pts[0];
              let closestD = 99999;
              for (let i = 0; i < pts.length; i++) {
                const d = Math.hypot(pts[i].x - targetMx, pts[i].y - targetMy);
                if (d < closestD) {
                  closestD = d;
                  closestPt = pts[i];
                }
              }
              ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(closestPt.x, closestPt.y);
              ctx.lineTo(targetMx, targetMy);
              ctx.stroke();
              ctx.setLineDash([]);
            }

            // 2. Pulsing sonar ripple if close (<80m)
            if (minDistance < 80) {
              const pulsePhase = (performance.now() * 0.0025) % 1;
              const pulseR = 5 + pulsePhase * 14;
              const pulseAlpha = (1 - pulsePhase) * 0.75;
              ctx.strokeStyle = `rgba(245, 158, 11, ${pulseAlpha})`;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(targetMx, targetMy, pulseR, 0, Math.PI * 2);
              ctx.stroke();
            }

            // 3. Glowing Amber Diamond Waypoint
            ctx.fillStyle = '#f59e0b';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(targetMx, targetMy - 5.5);
            ctx.lineTo(targetMx + 5.5, targetMy);
            ctx.lineTo(targetMx, targetMy + 5.5);
            ctx.lineTo(targetMx - 5.5, targetMy);
            ctx.closePath();
            ctx.fill();

            // Inner white highlight dot
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(targetMx, targetMy, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (targetFwd > 125) {
            // Beyond forward radar view: draw edge beacon arrow at top of radar
            const clampedLat = THREE.MathUtils.clamp(targetLat * 0.5, -w / 2 + 16, w / 2 - 16);
            const edgeX = w / 2 + clampedLat;
            const edgeY = 12;

            ctx.save();
            ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(edgeX, edgeY - 4);
            ctx.lineTo(edgeX - 4, edgeY + 4);
            ctx.lineTo(edgeX + 4, edgeY + 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // Draw Player Car Chevron Marker at (w/2, h - 24)
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(w / 2, h - 31);
      ctx.lineTo(w / 2 - 4.5, h - 19);
      ctx.lineTo(w / 2, h - 22);
      ctx.lineTo(w / 2 + 4.5, h - 19);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
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

        // Switch onboarding hint from "drive" to "toss" when close to target
        if (this._onboardingActive && this.vehicle && this.world?.deliveryTargets?.length) {
          const firstTarget = this.world.deliveryTargets.find(t => !t.delivered);
          if (firstTarget) {
            const d = this.vehicle.mesh.position.distanceTo(firstTarget.pos);
            if (d < 22 && this._onboardingHintStep !== 'toss') {
              this._onboardingHintStep = 'toss';
              this._showOnboardingHint('toss');
            } else if (d >= 22 && this._onboardingHintStep !== 'drive') {
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
  }

  S.ShiplypEngine = ShiplypEngine;
  window.ShiplypEngine = ShiplypEngine;
})();
