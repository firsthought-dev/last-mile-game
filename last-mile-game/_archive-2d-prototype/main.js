// Main Game Engine: CHETNA-Road Environmental Pipeline & City Pack Integration
import { CONFIG } from './config.js';
import { sound } from './audio.js';
import { saveManager } from './storage.js';
import { GameMap } from './map.js';
import { Player } from './player.js';
import { StrayDog } from './entities/dog.js';
import { TrafficVehicle } from './entities/traffic.js';
import { TossManager } from './mechanics/toss.js';
import { MilkMechanics } from './mechanics/balance.js';
import { OTPManager } from './mechanics/otp.js';
import { ShopUI } from './ui/shop.js';

class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.modalContainer = document.getElementById('modal-container');

    this.gameState = 'menu';
    this.selectedCity = saveManager.state.selectedCity || 'mumbai';
    this.currentTrack = 'newspaper';
    this.dayTime = 0;
    this.timeRatio = 0;
    this.isMonsoon = false;
    this.lightningTimer = 0;

    // Keys & Input
    this.keys = { up: false, down: false, left: false, right: false, w: false, s: false, a: false, d: false, space: false };
    this.mouse = { x: 530, y: 340, worldX: 600, worldY: 1050, isDown: false };
    this.aimPower = 0.5;

    // Slow-Roads Smooth Dynamic Camera
    this.camera = { x: 0, y: 0, vx: 0, vy: 0 };

    // Systems
    this.map = new GameMap(this.selectedCity);
    this.player = null;
    this.dogs = [];
    this.trafficVehicles = [];
    this.tossManager = new TossManager();
    this.milkMechanics = new MilkMechanics();
    this.otpManager = new OTPManager();

    // Run Stats
    this.runStats = {
      deliveriesMade: 0,
      totalTargets: 14,
      perfectHits: 0,
      earnings: 0,
      spills: 0,
      dogChases: 0
    };

    this.rainDrops = [];
    for (let i = 0; i < 120; i++) {
      this.rainDrops.push({
        x: Math.random() * CONFIG.CANVAS_WIDTH,
        y: Math.random() * CONFIG.CANVAS_HEIGHT,
        speed: 15 + Math.random() * 10,
        length: 14 + Math.random() * 12
      });
    }

    this.initEvents();
    this.renderMenu();

    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') this.keys.up = this.keys.w = true;
      if (k === 'arrowdown' || k === 's') this.keys.down = this.keys.s = true;
      if (k === 'arrowleft' || k === 'a') this.keys.left = this.keys.a = true;
      if (k === 'arrowright' || k === 'd') this.keys.right = this.keys.d = true;
      
      if (k === 'e') {
        if (this.player && this.gameState === 'playing') {
          const res = this.player.toggleDismount();
          if (res === 'dismounted') {
            this.tossManager.addFloatingText(this.player.x, this.player.y, '🚶 ON FOOT (ENTER STAIRS & GULLEYS)', '#2ec4b6');
          } else if (res === 'mounted') {
            this.tossManager.addFloatingText(this.player.x, this.player.y, '🚴 MOUNTED VEHICLE', '#ffd166');
          }
        }
      }

      if (k === ' ' || e.code === 'Space') {
        this.keys.space = true;
        if (this.currentTrack === 'milk' && this.milkMechanics.activePouringSession) {
          this.milkMechanics.activePouringSession.isPouring = true;
        } else if (this.gameState === 'playing' && this.player) {
          this.tossNewspaper();
        }
      }
      if (k === 't') {
        this.throwDogTreat();
      }
      if (k === 'b' || k === 'h') {
        if (this.player) this.player.ringBell();
      }
      if (this.otpManager.activeSession && !isNaN(parseInt(k))) {
        this.otpManager.enterDigit(parseInt(k));
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') this.keys.up = this.keys.w = false;
      if (k === 'arrowdown' || k === 's') this.keys.down = this.keys.s = false;
      if (k === 'arrowleft' || k === 'a') this.keys.left = this.keys.a = false;
      if (k === 'arrowright' || k === 'd') this.keys.right = this.keys.d = false;
      if (k === ' ' || e.code === 'Space') {
        this.keys.space = false;
        if (this.currentTrack === 'milk' && this.milkMechanics.activePouringSession) {
          this.milkMechanics.activePouringSession.isPouring = false;
          this.milkMechanics.finishPouring();
        }
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      this.mouse.worldX = this.mouse.x + this.camera.x;
      this.mouse.worldY = this.mouse.y + this.camera.y;
    });

    this.canvas.addEventListener('mousedown', () => {
      this.mouse.isDown = true;
      if (this.gameState === 'playing' && this.player) {
        if (this.currentTrack === 'milk' && this.milkMechanics.activePouringSession) {
          this.milkMechanics.activePouringSession.isPouring = true;
        } else {
          this.tossNewspaper();
        }
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.mouse.isDown = false;
      if (this.currentTrack === 'milk' && this.milkMechanics.activePouringSession) {
        this.milkMechanics.activePouringSession.isPouring = false;
        this.milkMechanics.finishPouring();
      }
    });

    document.getElementById('btn-bell')?.addEventListener('click', () => {
      if (this.player) this.player.ringBell();
    });

    document.getElementById('btn-treat')?.addEventListener('click', () => {
      this.throwDogTreat();
    });

    document.getElementById('btn-toss')?.addEventListener('click', () => {
      this.tossNewspaper();
    });

    document.getElementById('btn-dismount')?.addEventListener('click', () => {
      if (this.player) this.player.toggleDismount();
    });

    document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      const btn = document.getElementById('btn-toggle-sound');
      if (btn) btn.textContent = isMuted ? '🔇' : '🔊';
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.renderMenu();
    });
  }

  tossNewspaper() {
    if (!this.player || this.gameState !== 'playing') return;

    if (this.currentTrack === 'milk') {
      const nearbyHouse = this.map.houses.find(h => {
        if (h.deliveryState !== 'pending') return false;
        return Math.hypot(this.player.x - h.porch.x, this.player.y - h.porch.y) < 70;
      });
      if (nearbyHouse && !this.milkMechanics.activePouringSession) {
        this.player.speed = 0;
        this.milkMechanics.startPouringMiniGame(nearbyHouse, (house, accuracy, earnings) => {
          this.runStats.deliveriesMade++;
          this.runStats.earnings += earnings;
          if (accuracy === 'perfect') this.runStats.perfectHits++;
        });
        return;
      }
    }

    if (this.currentTrack === 'ecommerce') {
      const nearbyHouse = this.map.houses.find(h => {
        if (h.deliveryState !== 'pending') return false;
        return Math.hypot(this.player.x - h.porch.x, this.player.y - h.porch.y) < 75;
      });
      if (nearbyHouse && !this.otpManager.activeSession) {
        this.player.speed = 0;
        this.otpManager.startOTPVerification(nearbyHouse, (house, success, earnings) => {
          if (success) {
            this.runStats.deliveriesMade++;
            this.runStats.earnings += earnings;
          }
        });
        return;
      }
    }

    this.tossManager.throwPaper(this.player, this.mouse.worldX, this.mouse.worldY, this.aimPower);
  }

  throwDogTreat() {
    if (!this.player) return;
    if (saveManager.useTreat()) {
      this.tossManager.throwTreat(this.player, this.player.x + Math.cos(this.player.angle) * 80, this.player.y + Math.sin(this.player.angle) * 80);
    } else {
      sound.playPothole();
      this.tossManager.addFloatingText(this.player.x, this.player.y, 'NO BISCUITS! (BUY IN GARAGE)', '#e63946');
    }
  }

  selectCity(cityId) {
    this.selectedCity = cityId;
    saveManager.state.selectedCity = cityId;
    saveManager.save();
    sound.playBell();
    this.renderMenu();
  }

  startTrack(trackId) {
    this.currentTrack = trackId;
    const trackConfig = CONFIG.TRACKS.find(t => t.id === trackId) || CONFIG.TRACKS[0];
    const cityConfig = CONFIG.CITIES[this.selectedCity] || CONFIG.CITIES.mumbai;

    // Environmental state from CHETNA pipeline
    this.isMonsoon = cityConfig.metrics.flood_susceptibility > 0.6 || cityConfig.envState === 'Monsoon congestion';

    this.map.generateMap(this.selectedCity);
    const s = saveManager.state;
    const vehicleType = trackId === 'ecommerce' ? 'scooter' : s.selectedVehicle;
    this.player = new Player(600, 1150, vehicleType, s.upgrades);

    // Spawn City Street Dogs
    this.dogs = [
      new StrayDog(850, 420, 'Tommy', 220),
      new StrayDog(1620, 1060, 'Kaalu', 240),
      new StrayDog(2350, 430, 'Sheru', 210),
      new StrayDog(1900, 1780, 'Buzo', 250),
      new StrayDog(2850, 800, 'Rocky', 180)
    ];

    // Spawn Scaled Traffic based on CHETNA Traffic Baseline
    this.trafficVehicles = [];
    const trafficMultiplier = cityConfig.metrics.traffic_baseline || 1.2;
    const totalHighwayCars = Math.round(9 * trafficMultiplier);
    const totalBazaarCars = Math.round(6 * trafficMultiplier);

    const hw = this.map.roads.find(r => r.type === 'highway');
    if (hw) {
      for (let i = 0; i < totalHighwayCars; i++) {
        const vx = (i * 320 + Math.random() * 80) % CONFIG.WORLD_WIDTH;
        const dir = i % 2 === 0 ? 1 : -1;
        const vy = hw.y + (dir === 1 ? 40 : 110);
        this.trafficVehicles.push(new TrafficVehicle(vx, vy, hw, dir, i));
      }
    }
    const bz = this.map.roads.find(r => r.type === 'bazaar');
    if (bz) {
      for (let i = 0; i < totalBazaarCars; i++) {
        const vx = (i * 400 + Math.random() * 100) % CONFIG.WORLD_WIDTH;
        const dir = i % 2 === 0 ? 1 : -1;
        const vy = bz.y + (dir === 1 ? 30 : 85);
        this.trafficVehicles.push(new TrafficVehicle(vx, vy, bz, dir, i + 2));
      }
    }

    this.runStats = {
      deliveriesMade: 0,
      totalTargets: trackConfig.targetsCount,
      perfectHits: 0,
      earnings: 0,
      spills: 0,
      dogChases: 0
    };

    this.dayTime = 0;
    this.timeLimit = trackConfig.timeLimit;
    this.gameState = 'playing';
    this.modalContainer.innerHTML = '';

    sound.playVictory();
  }

  renderMenu() {
    this.gameState = 'menu';
    const s = saveManager.state;
    const currentCity = CONFIG.CITIES[this.selectedCity] || CONFIG.CITIES.mumbai;

    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="menu-modal glass-card">
          <div class="game-logo">
            <h1>🚚 LAST MILE: SHIPLYP CHRONICLES</h1>
            <p class="tagline">Indian Last-Mile Delivery Simulator | CHETNA-Road Environmental Engine</p>
          </div>

          <div class="player-summary-bar">
            <div class="stat-pill">💰 ₹${s.money}</div>
            <div class="stat-pill">⭐ ${s.rating.toFixed(1)} Rating</div>
            <div class="stat-pill">👥 ${s.subscribers} Subscribers</div>
            <div class="stat-pill">🏙️ ${currentCity.name.split(' ')[0]}</div>
            <div class="stat-pill env-badge">🌤️ ${currentCity.envState}</div>
          </div>

          <!-- CITY SELECTOR CAROUSEL -->
          <div class="city-selector-section">
            <h3>SELECT INDIAN CITY (5 CITY PACKS)</h3>
            <div class="cities-grid">
              ${Object.values(CONFIG.CITIES).map(c => `
                <div class="city-card ${c.id === this.selectedCity ? 'active-city' : ''}" data-city="${c.id}">
                  <div class="city-icon">${c.icon}</div>
                  <div class="city-info">
                    <div class="city-title">${c.name}</div>
                    <div class="city-tagline">${c.tagline}</div>
                    <div class="city-env-tag">🌤️ ${c.envState}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- TRACK SELECTION -->
          <div class="tracks-list">
            <h3>SELECT DELIVERY TRACK IN ${currentCity.name.toUpperCase()}</h3>
            <div class="tracks-grid">
              ${CONFIG.TRACKS.map(t => {
                const isUnlocked = s.unlockedTracks.includes(t.id);
                return `
                  <div class="track-card ${isUnlocked ? '' : 'locked'}">
                    <div class="track-icon">${t.icon}</div>
                    <div class="track-info">
                      <h4>${t.title}</h4>
                      <p class="track-desc">${t.desc}</p>
                      <div class="track-meta">
                        <span>⏰ ${t.timeSlot}</span> • 
                        <span>🎯 ${t.targetsCount} Drops</span> • 
                        <span>💵 ₹${t.basePay}</span>
                      </div>
                    </div>
                    <button class="btn-track ${isUnlocked ? 'btn-primary' : 'btn-disabled'}" 
                            data-track="${t.id}" 
                            ${isUnlocked ? '' : 'disabled'}>
                      ${isUnlocked ? `START IN ${currentCity.name.split(' ')[0]} 🚴` : '🔒 LOCKED'}
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="menu-footer">
            <button id="btn-open-shop" class="btn-secondary">🛠️ GARAGE & UPGRADES</button>
            <button id="btn-attribution" class="btn-outline">📊 CHETNA DATA ENGINE</button>
            <button id="btn-how-to-play" class="btn-outline">📖 HOW TO PLAY</button>
          </div>
        </div>
      </div>
    `;

    this.modalContainer.querySelectorAll('.city-card').forEach(card => {
      card.onclick = () => this.selectCity(card.dataset.city);
    });

    this.modalContainer.querySelectorAll('.btn-track').forEach(btn => {
      btn.onclick = () => {
        sound.playBell();
        this.startTrack(btn.dataset.track);
      };
    });

    document.getElementById('btn-open-shop').onclick = () => {
      sound.playBell();
      this.openShop();
    };

    document.getElementById('btn-attribution').onclick = () => {
      this.showAttributionModal();
    };

    document.getElementById('btn-how-to-play').onclick = () => {
      this.showInstructions();
    };
  }

  showAttributionModal() {
    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="instructions-modal glass-card">
          <h2>📊 CHETNA-ROAD DATA-TO-GAME ENGINE</h2>
          <div class="instructions-content">
            <div class="guide-item">
              <strong>🔬 Scientific Reference Pipeline:</strong> CHETNA-Road 500m gridded road-emission dataset (CO₂, NOₓ, PM₂.₅) and OpenStreetMap road hierarchies calibrate the 5 cities' traffic density, atmospheric haze, and order demand.
            </div>
            <div class="guide-item">
              <strong>🌤️ Environmental Language:</strong> Raw pollutant levels are translated directly into gameplay states: <em>"Clear morning"</em>, <em>"Traffic haze"</em>, <em>"Monsoon congestion"</em>, <em>"Post-rain air"</em>, and <em>"Dusty afternoon"</em>.
            </div>
            <div class="guide-item">
              <strong>🏙️ 5 Unified City Packs:</strong> Delhi, Mumbai, Kolkata, Pune, and Bengaluru operate on one continuous environmental pipeline with distinct regional delivery rhythms.
            </div>
          </div>
          <button id="btn-back-menu" class="btn-primary">BACK TO MENU</button>
        </div>
      </div>
    `;
    document.getElementById('btn-back-menu').onclick = () => this.renderMenu();
  }

  showInstructions() {
    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="instructions-modal glass-card">
          <h2>📖 LAST MILE: INDIAN MEGA-CITY GUIDE</h2>
          <div class="instructions-content">
            <div class="guide-item">
              <strong>🏙️ Explore 5 Cities:</strong> Switch anytime between <em>Mumbai, New Delhi, Kolkata, Bengaluru, and Pune</em>, each with distinct road network archetypes and environmental haze!
            </div>
            <div class="guide-item">
              <strong>🚶 On-Foot Mode:</strong> Press [E] key anytime to DISMOUNT! Walk into narrow apartment stairs, tight corridors, and flooded doorsteps. Press [E] near your bike to remount.
            </div>
            <div class="guide-item">
              <strong>🚴 Vehicle Controls:</strong> [W/A/S/D] or [Arrow Keys] to steer, pedal and lane-split through traffic.
            </div>
            <div class="guide-item">
              <strong>🎯 Newspaper Toss:</strong> Aim with Mouse Crosshair and press [SPACE] or Left Click to toss onto porches.
            </div>
          </div>
          <button id="btn-back-menu" class="btn-primary">BACK TO MENU</button>
        </div>
      </div>
    `;
    document.getElementById('btn-back-menu').onclick = () => this.renderMenu();
  }

  openShop() {
    this.gameState = 'shop';
    const shop = new ShopUI(() => {
      this.renderMenu();
    });
    shop.render(this.modalContainer);
  }

  renderDailyReport() {
    this.gameState = 'daily_report';
    sound.playVictory();

    const trackConfig = CONFIG.TRACKS.find(t => t.id === this.currentTrack) || CONFIG.TRACKS[0];
    const basePay = trackConfig.basePay;
    const totalEarned = this.runStats.earnings + (this.runStats.deliveriesMade > 0 ? basePay : 0);

    const result = saveManager.completeRun(
      this.currentTrack,
      totalEarned,
      this.runStats.deliveriesMade,
      this.runStats.totalTargets,
      this.runStats.perfectHits,
      this.runStats.spills,
      this.runStats.dogChases
    );

    const currentCity = CONFIG.CITIES[this.selectedCity] || CONFIG.CITIES.mumbai;

    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="daily-report-modal glass-card">
          <h2>📊 ${currentCity.name.toUpperCase()} RUN REPORT - DAY ${result.day - 1}</h2>
          <div class="star-rating">
            ${'⭐'.repeat(Math.round(result.runRating))} <span class="rating-num">(${result.runRating.toFixed(1)} / 5.0)</span>
          </div>

          <div class="report-stats-grid">
            <div class="report-stat-item">
              <span class="label">Deliveries Completed:</span>
              <span class="val">${this.runStats.deliveriesMade} / ${this.runStats.totalTargets}</span>
            </div>
            <div class="report-stat-item">
              <span class="label">🎯 Perfect Bullseyes:</span>
              <span class="val">${this.runStats.perfectHits}</span>
            </div>
            <div class="report-stat-item">
              <span class="label">Total Subscribers:</span>
              <span class="val">${result.newSubscribers}</span>
            </div>
            <div class="report-stat-item">
              <span class="label">💰 Total Daily Earnings:</span>
              <span class="val highlight">₹${totalEarned}</span>
            </div>
          </div>

          <div class="dialogue-box">
            <div class="npc-avatar">👵</div>
            <div class="npc-text">
              <strong>${currentCity.subscriberNames[0] || 'Subscriber'}:</strong> "Kitni bheed thi raste pe, fir bhi delivery time pe aa gayi! Shabaash beta!"
            </div>
          </div>

          <div class="report-actions">
            <button id="btn-next-day" class="btn-primary">CONTINUE TO NEXT DAY ☀️</button>
            <button id="btn-report-shop" class="btn-secondary">VISIT GARAGE 🛠️</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-next-day').onclick = () => this.renderMenu();
    document.getElementById('btn-report-shop').onclick = () => this.openShop();
  }

  update(dt) {
    if (this.gameState !== 'playing') return;

    this.dayTime += dt;
    this.timeRatio = Math.min(1.0, this.dayTime / this.timeLimit);

    if (this.isMonsoon && Math.random() < 0.003) {
      sound.playThunder();
      this.lightningTimer = 0.15;
    }
    if (this.lightningTimer > 0) this.lightningTimer -= dt;

    if (this.dayTime >= this.timeLimit) {
      this.renderDailyReport();
      return;
    }

    let isInFlood = false;
    if (this.player) {
      isInFlood = this.map.floodZones.some(fz => 
        this.player.x >= fz.x && this.player.x <= fz.x + fz.w &&
        this.player.y >= fz.y && this.player.y <= fz.y + fz.h
      );

      this.player.update(this.keys, dt, isInFlood, this.isMonsoon);

      this.map.obstacles.forEach(obs => {
        if (obs.type === 'pothole') {
          if (Math.hypot(this.player.x - obs.x, this.player.y - obs.y) < obs.radius + 12) {
            this.player.hitPothole();
          }
        } else if (obs.type === 'speed_breaker') {
          if (this.player.x >= obs.x && this.player.x <= obs.x + obs.w &&
              this.player.y >= obs.y && this.player.y <= obs.y + obs.h) {
            this.player.hitSpeedBreaker();
          }
        }
      });

      const lookAheadFactor = this.player.speed * 18;
      const targetCamX = this.player.x + Math.cos(this.player.angle) * lookAheadFactor - CONFIG.CANVAS_WIDTH / 2;
      const targetCamY = this.player.y + Math.sin(this.player.angle) * lookAheadFactor - CONFIG.CANVAS_HEIGHT / 2;

      this.camera.x += (targetCamX - this.camera.x) * 0.08;
      this.camera.y += (targetCamY - this.camera.y) * 0.08;

      this.camera.x = Math.max(0, Math.min(CONFIG.WORLD_WIDTH - CONFIG.CANVAS_WIDTH, this.camera.x));
      this.camera.y = Math.max(0, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.CANVAS_HEIGHT, this.camera.y));

      this.mouse.worldX = this.mouse.x + this.camera.x;
      this.mouse.worldY = this.mouse.y + this.camera.y;
    }

    this.trafficVehicles.forEach(v => {
      v.update(this.trafficVehicles, this.player, this.map.cows, this.map.obstacles, dt);
    });

    this.dogs.forEach(dog => {
      dog.update(this.player, this.tossManager.treats, dt);
    });

    this.tossManager.update(this.map.houses, (house, isHit, isPerfect, earnings) => {
      if (isHit) {
        this.runStats.deliveriesMade++;
        this.runStats.earnings += earnings;
        if (isPerfect) this.runStats.perfectHits++;

        const allDelivered = this.map.houses.filter(h => h.deliveryState === 'pending').length === 0;
        if (allDelivered) {
          setTimeout(() => this.renderDailyReport(), 1500);
        }
      }
    }, dt);

    if (this.currentTrack === 'milk') {
      this.milkMechanics.updateBalance(this.player, dt);
      this.milkMechanics.updatePouring(dt);
    }

    if (this.currentTrack === 'ecommerce') {
      this.otpManager.update(dt);
    }
  }

  render() {
    this.ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    this.ctx.save();
    this.ctx.translate(-this.camera.x, -this.camera.y);

    this.map.render(this.ctx, this.camera, this.timeRatio, this.isMonsoon);

    this.trafficVehicles.forEach(v => v.render(this.ctx));
    this.tossManager.render(this.ctx);
    this.dogs.forEach(dog => dog.render(this.ctx));

    if (this.player) {
      this.player.render(this.ctx);
    }

    if (this.gameState === 'playing' && this.player) {
      this.renderAimCrosshair(this.ctx);
    }

    if (this.player) {
      this.map.renderLighting(this.ctx, this.timeRatio, this.player.x, this.player.y, this.player.headlightRange);
    }

    this.ctx.restore();

    if (this.lightningTimer > 0) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    }

    if (this.gameState === 'playing') {
      this.renderHUD(this.ctx);
      if (this.currentTrack === 'milk') {
        this.milkMechanics.renderHUD(this.ctx, 20, 570, this.player ? this.player.balanceTilt : 0);
      }
      if (this.currentTrack === 'ecommerce') {
        this.otpManager.render(this.ctx);
      }
    }

    if (this.isMonsoon) {
      this.renderRain(this.ctx);
    }
  }

  renderAimCrosshair(ctx) {
    const px = this.player.x;
    const py = this.player.y;
    const mx = this.mouse.worldX;
    const my = this.mouse.worldY;

    ctx.strokeStyle = 'rgba(255, 159, 28, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mx - 16, my); ctx.lineTo(mx + 16, my);
    ctx.moveTo(mx, my - 16); ctx.lineTo(mx, my + 16);
    ctx.stroke();
  }

  renderHUD(ctx) {
    const currentCity = CONFIG.CITIES[this.selectedCity] || CONFIG.CITIES.mumbai;

    ctx.fillStyle = 'rgba(13, 27, 42, 0.88)';
    ctx.fillRect(15, 15, 430, 75);
    ctx.strokeStyle = '#2ec4b6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(15, 15, 430, 75);

    const totalMinutes = Math.floor(this.timeRatio * 120);
    const hours = 4 + Math.floor(totalMinutes / 60);
    const mins = (totalMinutes % 60).toString().padStart(2, '0');

    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`⏰ ${hours}:${mins} AM`, 28, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.fillText(`🎯 ${this.runStats.deliveriesMade} / ${this.runStats.totalTargets}`, 145, 40);

    const modeText = this.player?.currentMode === 'walking' ? '🚶 ON FOOT [E]' : '🚴 RIDING [E]';
    ctx.fillStyle = this.player?.currentMode === 'walking' ? '#2ec4b6' : '#ffd166';
    ctx.fillText(modeText, 250, 40);

    // City & Atmospheric Condition
    ctx.fillStyle = '#fca311';
    ctx.fillText(`💰 ₹${this.runStats.earnings}`, 28, 68);
    ctx.fillStyle = '#ff9f1c';
    ctx.fillText(`📰 Cargo: ${this.player ? this.player.cargoCount : 0}`, 115, 68);
    ctx.fillStyle = '#2ec4b6';
    ctx.fillText(`🏙️ ${currentCity.name.split(' ')[0]}`, 210, 68);
    ctx.fillStyle = '#a8dadc';
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(`🌤️ ${currentCity.envState}`, 305, 68);

    // Mini-map
    const mmW = 160;
    const mmH = 115;
    const mmX = CONFIG.CANVAS_WIDTH - mmW - 20;
    const mmY = 20;

    ctx.fillStyle = 'rgba(10, 15, 25, 0.90)';
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeStyle = '#fca311';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mmX, mmY, mmW, mmH);

    const scaleX = mmW / CONFIG.WORLD_WIDTH;
    const scaleY = mmH / CONFIG.WORLD_HEIGHT;

    this.map.roads.forEach(r => {
      ctx.fillStyle = '#3a3d4d';
      ctx.fillRect(mmX + r.x * scaleX, mmY + r.y * scaleY, r.w * scaleX, r.h * scaleY);
    });

    this.map.gulleys.forEach(g => {
      ctx.fillStyle = '#5c5245';
      ctx.fillRect(mmX + g.x * scaleX, mmY + g.y * scaleY, Math.max(1, g.w * scaleX), Math.max(1, g.h * scaleY));
    });

    this.trafficVehicles.forEach(v => {
      ctx.fillStyle = '#e63946';
      ctx.fillRect(mmX + v.x * scaleX, mmY + v.y * scaleY, 2, 2);
    });

    this.map.houses.forEach(h => {
      ctx.fillStyle = h.deliveryState === 'delivered' ? '#2ec4b6' : '#ff9f1c';
      ctx.fillRect(mmX + h.x * scaleX, mmY + h.y * scaleY, h.w * scaleX, h.h * scaleY);
    });

    if (this.player) {
      ctx.fillStyle = '#00f5d4';
      ctx.beginPath();
      ctx.arc(mmX + this.player.x * scaleX, mmY + this.player.y * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderRain(ctx) {
    ctx.strokeStyle = 'rgba(174, 217, 244, 0.65)';
    ctx.lineWidth = 1.5;
    this.rainDrops.forEach(r => {
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - 3, r.y + r.length);
      ctx.stroke();

      r.y += r.speed;
      r.x -= 1.8;
      if (r.y > CONFIG.CANVAS_HEIGHT) {
        r.y = -10;
        r.x = Math.random() * CONFIG.CANVAS_WIDTH;
      }
    });
  }

  gameLoop(time) {
    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new GameEngine();
});
