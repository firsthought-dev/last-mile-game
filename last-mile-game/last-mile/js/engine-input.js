(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    CONFIG, Career, vehicleSpec, vehicleList, sound, CourierAsset
  } = S;

  Object.assign(S.ShiplypEngine.prototype, {
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
    },


    applyTouchControlVisibility() {
      const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      document.body.classList.toggle('touch-controls-active', isTouch);
    },


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
    },

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
    },

  });
})();
