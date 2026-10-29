(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    CONFIG, Career, vehicleSpec, vehicleList, isTwoWheeler, sound, QualityManager, UI
  } = S;

  Object.assign(S.ShiplypEngine.prototype, {
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
    },


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
    },

    // FPS counter is off by default; Settings > Display & Sound turns it on (B142).

    _fpsCounterOn() {
      try { return localStorage.getItem('shiplyp_showFps') === '1'; } catch (e) { return false; }
    },


    _applyFpsCounter() {
      const pill = document.getElementById('hud-fps-pill');
      if (pill) pill.hidden = !this._fpsCounterOn();
    },



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
    },

    // Delivery payout: order reward plus time bonus, scaled by difficulty,
    // streak and the vehicle's pay multiplier (bigger vehicles take bigger orders).

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
            this._track('unlock', { kind: 'vehicle', id: vehId, price: meta.price });
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
    },

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
      const adsOn = !(typeof ShiplypAds !== 'undefined' && ShiplypAds && ShiplypAds.isEnabled && !ShiplypAds.isEnabled());
      if (!adsOn) modal.querySelector('#shift-double-btn')?.remove();
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
    },

    // The popup stack sits 88px down, centred. On narrow screens the top-right
    // telemetry box (speed / gear / distance, plus the STREAK pill when a
    // streak is live) reaches past that, so the banner covered it. Call after
    // appending a banner: if the stack's real box intersects the telemetry
    // box, drop the stack just below it. Its height changes (streak pill), and
    // on wide layouts it sits at the bottom of the screen, so measure every time.

    _placeScorePopups() {
      if (S.Callouts) return S.Callouts.placeSlot(); // comic banners: same zero-overlap rule, measured on their own slot
      const c = this.scorePopupContainer;
      if (!c) return;
      c.style.top = '';
      const tel = document.querySelector('.telemetry-digits-box');
      if (!tel || !tel.offsetParent) return;
      const t = tel.getBoundingClientRect();
      const r = c.getBoundingClientRect();
      const hits = r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top;
      if (!hits) return;
      const parentTop = (c.offsetParent || document.body).getBoundingClientRect().top;
      c.style.top = Math.round(t.bottom - parentTop + 8) + 'px';
    },


    showScoreBanner(title, sub) {
      if (S.Callouts) { // comic banner in the same top-right slot; plain toggles (sub-less) get the small cyan one
        S.Callouts.banner({ title, sub, kind: sub ? 'yellow' : 'cyan', burst: sub ? '\u2605' : '!', duration: sub ? 2600 : 1800 });
        return;
      }
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
    },


    updateHUDStats() {
      const countEl = document.getElementById('delivery-count');
      const totalTargets = this.world?.deliveryTargets?.length || 12;
      if (countEl) countEl.textContent = `${this.deliveriesMade} / ${totalTargets}`;

      const earnEl = document.getElementById('hud-earnings');
      if (earnEl) earnEl.textContent = Career ? Career.wallet() : this.earnings; // spendable wallet, same pot the police and fines use

      const streakEl = document.getElementById('hud-streak-pill');
      if (streakEl) streakEl.textContent = `${this.streakCount}x STREAK`;
    },


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
    },


    updateWantedHUD() {
      const box = document.getElementById('wanted-meter');
      if (!box) return;
      box.classList.toggle('wanted-active', this.wantedLevel > 0);
      const stars = box.querySelectorAll('.wanted-star');
      stars.forEach((s, i) => s.classList.toggle('lit', i < this.wantedLevel));
    },

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

    showScorePopup(amount, text) {
      const sub = (amount !== 0) ? (amount > 0 ? `+₹${amount}` : `-₹${Math.abs(amount)}`) : '';
      this.showScoreBanner(text, sub);
    },


    addNotification(message, type = 'neutral', duration = 4000) {
      const stack = document.getElementById('notification-stack');
      if (!stack) return;

      // One notification at a time: a new one replaces whatever is showing.
      stack.querySelectorAll('.notification-item').forEach((n) => n.remove());

      const item = document.createElement('div');
      item.className = `notification-item ${type}`;
      item.innerHTML = message;
      item.style.opacity = '0';

      stack.appendChild(item);

      // Trigger animation
      requestAnimationFrame(() => {
        item.style.opacity = '1';
      });

      if (S.Callouts && S.Callouts.placeNote) S.Callouts.placeNote(); // keep it off the rider, the road ahead and the map

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => {
          if (!item.isConnected) return; // already replaced
          item.classList.add('removing');
          setTimeout(() => item.remove(), 250);
        }, duration);
      }
    },


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
    },


    _dismissOnboardingHint() {
      const existing = document.getElementById('onboarding-hint');
      if (!existing) return;
      existing.classList.remove('visible');
      setTimeout(() => existing.remove(), 350);
    },


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
    },


    toggleMute() {
      const isMuted = sound.toggleMute();
      this.updateAudioHUDButtons();
      this.showScorePopup(0, (isMuted ? 'AUDIO MUTED' : 'AUDIO ON') + (document.body.classList.contains('touch-controls-active') ? '' : ' [M]'));
    },


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
    },

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
    },

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
    },


    _announceAutoAssist(on, onText, offText) {
      this.updateAutoAssistHUD();
      if (navigator.vibrate) navigator.vibrate(on ? [30, 40, 30] : 35);
      sound.playTone(on ? 880 : 440, 'sine', 0.1);
      this.showScorePopup(0, on ? onText : offText);
    },

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
    },


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
    },


    toggleWeather() {
      this.selectedWeather = (this.selectedWeather === 'blizzard') ? 'clear' : 'blizzard';
      this.weather = this.selectedWeather;
      this.initWeatherSystem();
      this.updateClimateHUD();
      if (this.activeDockPanel === 'style') this.renderDockPanelContent('style');
      this._refreshMobileToolsDrawer();
      this.showScorePopup(0, this.selectedWeather === 'blizzard' ? `${UI.icon('cloud')} BLIZZARD` : `${UI.icon('sun')} CLEAR SKIES`);
      sound.playTone(600, 'sine', 0.08);
    },

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
    },


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
    },


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
    },


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
    },


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
    },


    hideReturnToRoadBanner() {
      const b = document.getElementById('return-road-banner');
      if (b) b.remove();
    },


    resetInactivity() {
      this.inactivityTimer = 0;
      this.hudOverlay.classList.remove('hud-hidden');
      this.dockEl.classList.remove('dock-hidden');
    },


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
    },


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
        const goal = Career.dailyGoal();
        const savedNote = (daily && daily.event === 'saved') ? ' &bull; your grace day kept the streak alive' : '';
        const dailyLine = (daily && daily.bonus > 0)
          ? `<div class="career-daily-row">${UI.icon('flame', 13)} Day ${daily.streak} check-in &bull; +₹${daily.bonus} paid into your account${savedNote}</div>`
          : '';
        const goalLine = `<div class="career-daily-row">${UI.icon('check', 13)} Today's goal: ${goal.paid ? 'done, +₹' + goal.bonus + ' paid' : goal.done + '/' + goal.target + ' drops for +₹' + goal.bonus}</div>`;

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
            ${goalLine}
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
      if (typeof ShiplypAds !== 'undefined' && ShiplypAds && ShiplypAds.isEnabled && !ShiplypAds.isEnabled()) document.getElementById('btn-hub-sponsor')?.remove();
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
    },


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
    },


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
                ${this.quality ? `
                <div class="settings-row">
                  <span class="settings-label">Graphics quality</span>
                  <div class="settings-control">
                    <button type="button" class="slider-val" id="set-quality" style="cursor:pointer;min-width:56px;min-height:32px">${this.quality.label()}</button>
                  </div>
                </div>
                ` : ''}
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
      // WI-14: cycles Auto -> Medium -> High.
      const qualityBtn = document.getElementById('set-quality');
      if (qualityBtn && this.quality) {
        qualityBtn.onclick = () => {
          const order = QualityManager.CHOICES;
          this.quality.setChoice(order[(order.indexOf(this.quality.choice) + 1) % order.length]);
          qualityBtn.textContent = this.quality.label();
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
    },

    // First-person gets a much closer near-clip than every other view: any
    // cabin geometry in front of the driver's eye (dash, steering wheel)
    // sits well inside the default 0.5 used by the other camera modes and
    // would get clipped. The one camera is shared by every view, so this is
    // also called with false wherever the game stops driving (the hub),
    // or the closer plane would leak into views that don't need it. Only
    // touches the camera when the state actually changes.
  });
})();
