// Player Controller: Dynamic Vehicle Physics & On-Foot Walk/Deliver System
import { CONFIG } from './config.js';
import { sound } from './audio.js';

export class Player {
  constructor(x = 600, y = 1050, vehicleType = 'cycle', upgrades = {}) {
    this.x = x;
    this.y = y;
    this.primaryVehicleType = vehicleType;
    this.currentMode = 'riding'; // 'riding' or 'walking'
    this.vehicleType = vehicleType;
    this.upgrades = upgrades;
    
    // Parked Vehicle Position when Dismounted
    this.parkedVehicle = null;

    this.angle = 0;
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;

    this.initStats();

    // Inventory & Health
    this.cargoCapacity = this.baseCapacity + (upgrades.basket || 0) * 15;
    this.cargoCount = this.cargoCapacity;
    this.damage = 0;
    this.balanceTilt = 0;
    this.walkStepPhase = 0;
    this.footstepTimer = 0;
    
    // Visual FX & Water Splashes
    this.skidMarks = [];
    this.waterRipples = [];
    this.shakeTimer = 0;
    this.isBraking = false;
    this.headlightRange = 140 + (upgrades.headlight || 0) * 70;
  }

  initStats() {
    if (this.currentMode === 'walking') {
      const fConfig = CONFIG.VEHICLES.FOOT;
      this.maxSpeed = fConfig.maxSpeed;
      this.accel = fConfig.accel;
      this.friction = fConfig.friction;
      this.turnSpeed = fConfig.turnSpeed;
      this.suspension = 1.0;
    } else {
      const vConfig = CONFIG.VEHICLES[this.vehicleType.toUpperCase()] || CONFIG.VEHICLES.CYCLE;
      this.name = vConfig.name;
      this.maxSpeed = vConfig.maxSpeed;
      this.accel = vConfig.accel;
      this.friction = vConfig.friction;
      this.turnSpeed = vConfig.turnSpeed;
      this.baseCapacity = vConfig.capacity;
      this.suspension = vConfig.suspension + (this.upgrades.tires || 0) * 0.35;
    }
  }

  toggleDismount() {
    if (this.currentMode === 'riding') {
      // Dismount vehicle and place it on kickstand
      this.parkedVehicle = {
        x: this.x,
        y: this.y,
        angle: this.angle,
        type: this.vehicleType
      };
      this.currentMode = 'walking';
      this.initStats();
      this.speed = 0;
      sound.playDismount();
      return 'dismounted';
    } else if (this.currentMode === 'walking' && this.parkedVehicle) {
      // Check if player is near parked vehicle
      const dist = Math.hypot(this.x - this.parkedVehicle.x, this.y - this.parkedVehicle.y);
      if (dist < 60) {
        this.x = this.parkedVehicle.x;
        this.y = this.parkedVehicle.y;
        this.angle = this.parkedVehicle.angle;
        this.parkedVehicle = null;
        this.currentMode = 'riding';
        this.initStats();
        this.speed = 0;
        sound.playDismount();
        return 'mounted';
      }
    }
    return false;
  }

  update(keys, dt = 1 / 60, isInFloodWater = false, isWetRoad = false) {
    // 1. Steering & Rotation
    let turning = 0;
    if (keys.left || keys.a) turning -= 1;
    if (keys.right || keys.d) turning += 1;

    if (this.currentMode === 'walking') {
      // Walking turns instantly toward movement direction
      if (turning !== 0) {
        this.angle += turning * this.turnSpeed;
      }
    } else {
      if (Math.abs(this.speed) > 0.2) {
        const directionModifier = this.speed >= 0 ? 1 : -1;
        this.angle += turning * this.turnSpeed * directionModifier;
        this.balanceTilt += turning * (this.speed / this.maxSpeed) * 1.8;
      }
    }
    this.balanceTilt *= 0.92;

    // 2. Acceleration & Friction
    this.isBraking = false;
    let effectiveMaxSpeed = this.maxSpeed;

    // Flood water drag unless equipped with Gumboots or in scooter
    if (isInFloodWater) {
      const hasBoots = (this.upgrades.gumboots || 0) > 0;
      if (this.currentMode === 'walking' && !hasBoots) {
        effectiveMaxSpeed *= 0.65;
      } else if (this.currentMode === 'riding' && this.vehicleType === 'cycle') {
        effectiveMaxSpeed *= 0.75;
      }
    }

    if (keys.up || keys.w) {
      this.speed += this.accel;
      if (this.speed > effectiveMaxSpeed) this.speed = effectiveMaxSpeed;
      this.walkStepPhase += 0.25;
      
      // Footstep sound & water ripples
      if (this.currentMode === 'walking') {
        this.footstepTimer += dt;
        if (this.footstepTimer > 0.32) {
          this.footstepTimer = 0;
          sound.playFootstep(isInFloodWater);
          if (isInFloodWater) {
            this.waterRipples.push({ x: this.x, y: this.y, radius: 4, alpha: 0.8 });
          }
        }
      }
    } else if (keys.down || keys.s) {
      if (this.speed > 0.4) {
        this.speed -= this.accel * 1.8;
        this.isBraking = true;
      } else {
        this.speed -= this.accel * 0.5;
        if (this.speed < -effectiveMaxSpeed * 0.45) this.speed = -effectiveMaxSpeed * 0.45;
      }
    } else {
      this.speed *= isWetRoad ? (this.friction * 0.99) : this.friction;
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }

    // 3. Position Updates
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;

    this.x += this.vx;
    this.y += this.vy;

    this.x = Math.max(30, Math.min(CONFIG.WORLD_WIDTH - 30, this.x));
    this.y = Math.max(30, Math.min(CONFIG.WORLD_HEIGHT - 30, this.y));

    // 4. Skid marks & Water Ripples
    if (this.currentMode === 'riding' && ((this.isBraking && this.speed > 2.5) || (Math.abs(turning) > 0 && this.speed > 3.8))) {
      if (Math.random() < 0.35) {
        this.skidMarks.push({ x: this.x, y: this.y, angle: this.angle, life: 1.0 });
      }
    }

    // Update Water Ripples
    for (let i = this.waterRipples.length - 1; i >= 0; i--) {
      const wr = this.waterRipples[i];
      wr.radius += 0.8;
      wr.alpha -= 0.025;
      if (wr.alpha <= 0) this.waterRipples.splice(i, 1);
    }

    // Fade skid marks
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      this.skidMarks[i].life -= 0.005;
      if (this.skidMarks[i].life <= 0) this.skidMarks.splice(i, 1);
    }

    if (this.shakeTimer > 0) this.shakeTimer -= dt;
  }

  hitPothole() {
    sound.playPothole();
    this.speed *= 0.35;
    this.damage += Math.max(2, 10 - (this.upgrades.tires || 0) * 4);
    this.shakeTimer = 0.35;
    this.angle += (Math.random() - 0.5) * 0.4;
  }

  hitSpeedBreaker() {
    sound.playPothole();
    if (this.speed > 2.8) {
      this.speed *= 0.6;
      this.shakeTimer = 0.25;
      this.damage += 3;
    }
  }

  ringBell() {
    if (this.currentMode === 'walking') {
      sound.playBell(); // Shout / alert whistle
    } else if (this.vehicleType === 'scooter') {
      sound.playHorn();
    } else {
      sound.playBell();
    }
  }

  render(ctx) {
    // 1. Draw Skid Marks
    this.skidMarks.forEach(sm => {
      ctx.save();
      ctx.translate(sm.x, sm.y);
      ctx.rotate(sm.angle);
      ctx.fillStyle = `rgba(20, 20, 20, ${sm.life * 0.4})`;
      ctx.fillRect(-12, -4, 24, 8);
      ctx.restore();
    });

    // 2. Draw Flood Water Ripples
    this.waterRipples.forEach(wr => {
      ctx.strokeStyle = `rgba(255, 255, 255, ${wr.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(wr.x, wr.y, wr.radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 3. Draw Parked Vehicle (if currently on foot)
    if (this.parkedVehicle) {
      const pv = this.parkedVehicle;
      ctx.save();
      ctx.translate(pv.x, pv.y);
      ctx.rotate(pv.angle);

      // Kickstand & Bike frame
      ctx.strokeStyle = '#212529';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(16, 0);
      ctx.stroke();

      // Handlebars
      ctx.strokeStyle = '#ced4da';
      ctx.beginPath();
      ctx.moveTo(12, -10);
      ctx.lineTo(12, 10);
      ctx.stroke();

      // Front basket
      ctx.fillStyle = '#bc6c25';
      ctx.fillRect(16, -6, 10, 12);

      // Overhead prompt
      ctx.restore();
      ctx.save();
      ctx.translate(pv.x, pv.y - 24);
      ctx.fillStyle = '#2ec4b6';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚲 [E] MOUNT VEHICLE', 0, 0);
      ctx.restore();
    }

    // 4. Draw Player (Riding or Walking)
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.currentMode === 'walking') {
      // --- ON-FOOT WALKING SPRITE ---
      const legOffset = Math.sin(this.walkStepPhase) * 6;
      
      // Feet & Boots
      ctx.fillStyle = (this.upgrades.gumboots || 0) > 0 ? '#ffb703' : '#111111';
      ctx.fillRect(-4 + legOffset, -6, 8, 4);
      ctx.fillRect(-4 - legOffset, 2, 8, 4);

      // Shoulders & Shirt
      ctx.fillStyle = '#e76f51';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head & Cap
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(2, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Delivery Bag on shoulder
      ctx.fillStyle = '#2a9d8f';
      ctx.fillRect(-6, -7, 8, 14);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(-6, -7, 8, 14);
    } else if (this.vehicleType === 'cycle' || this.vehicleType === 'ecycle') {
      // --- BICYCLE RIDER ---
      ctx.strokeStyle = this.vehicleType === 'ecycle' ? '#00b4d8' : '#212529';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();

      ctx.strokeStyle = '#adb5bd';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(12, -10); ctx.lineTo(12, 10); ctx.stroke();

      ctx.fillStyle = '#111';
      ctx.fillRect(-18, -3, 6, 6);
      ctx.fillRect(14, -3, 6, 6);

      ctx.fillStyle = '#e76f51';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(3, 0, 5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#bc6c25';
      ctx.fillRect(16, -6, 10, 12);

      if (this.cargoCount > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(17, -4, 8, 8);
      }
    } else if (this.vehicleType === 'scooter') {
      // --- BAJAJ SCOOTER ---
      ctx.fillStyle = '#0077b6';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#03045e';
      ctx.fillRect(14, -7, 10, 14);

      ctx.strokeStyle = '#ced4da';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(12, -12); ctx.lineTo(12, 12); ctx.stroke();

      ctx.fillStyle = '#ffb703';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ff9f1c';
      ctx.fillRect(-22, -9, 14, 18);
    }

    // Headlight Fog Beam
    if (this.currentMode === 'riding') {
      ctx.fillStyle = 'rgba(255, 243, 176, 0.35)';
      ctx.beginPath();
      ctx.moveTo(18, -3);
      ctx.lineTo(18 + this.headlightRange, -45);
      ctx.lineTo(18 + this.headlightRange, 45);
      ctx.lineTo(18, 3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
