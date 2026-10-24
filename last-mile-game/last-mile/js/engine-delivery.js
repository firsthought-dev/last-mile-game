(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    CONFIG, Career, vehicleSpec, sound, UI
  } = S;

  Object.assign(S.ShiplypEngine.prototype, {
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
    },


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
    },

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
    },


    _renderSpareParcels() {
      const el = document.getElementById('delivery-spares');
      if (!el) return;
      const n = this.spareParcels ?? CONFIG.SPARE_PARCELS;
      el.innerHTML = `${UI.icon('package', 11)}<span>${n}</span>`;
      el.classList.toggle('spares-low', n <= 1);
    },


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
    },


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
      // Daily goal (B146): a quiet progress note per drop, and one celebration when it pays.
      if (careerResult && careerResult.dailyGoal) {
        const goal = careerResult.dailyGoal;
        if (goal.justCompleted) {
          this.addNotification(`${UI.icon('check')} DAILY GOAL DONE — +₹${goal.bonus}`, 'success', 5000);
        } else if (goal.done < goal.target) {
          this.addNotification(`${UI.icon('check')} Daily goal ${goal.done}/${goal.target}`, 'info', 2500);
        }
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
          if (Career && Career.noteFirstDelivery) Career.noteFirstDelivery(ms);
        }
      }

      // Shift Milestone: trigger shift celebration modal every 5 drops
      if (this.deliveriesMade > 0 && this.deliveriesMade % 5 === 0) {
        setTimeout(() => this.showShiftSummary(), 1400);
      }
    },


    _deliveryPayout(reward, timeBonus, diffMult, streak, missed, noAssist) {
      const vehMult = vehicleSpec(this.selectedVehicle).payoutMult;
      return Math.round((reward + timeBonus) * diffMult * (1 + streak * 0.2) * vehMult * (missed ? 0.5 : 1) * (noAssist ? 1 + CONFIG.NO_ASSIST_BONUS : 1));
    },

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
    },

    // ── Unlock confirmation sheet ─────────────────────────────────────────

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
    },


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
    },


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
    },

  });
})();
