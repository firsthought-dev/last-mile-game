(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    CONFIG, sound, VisualStyleManager, UI
  } = S;

  Object.assign(S.ShiplypEngine.prototype, {
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
    },


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
    },


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
    },


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
    },



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
    },


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
    },


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
    },

    // ── Vehicle canvas illustration helper ────────────────────────────────

    applyWindowGlow(tod) {
      if (!this.world || !this.world.windowMaterials) return;
      const intensity = (tod.night || tod.id === 'dusk') ? 0.85 : (tod.id === 'dawn' ? 0.15 : 0.0);
      for (const mat of this.world.windowMaterials) {
        mat.emissiveIntensity = intensity;
      }
    },


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
    },


    cycleTimeOfDay() {
      const keys = ['dawn', 'day', 'dusk', 'night'];
      const curIdx = keys.indexOf(this.selectedTimeOfDay || 'day');
      const nextKey = keys[(curIdx + 1) % keys.length];
      this.setTimeOfDay(nextKey);
    },

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
    },

  });
})();
