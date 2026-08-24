// Autonomous Indian Street Traffic AI System
import { CONFIG } from '../config.js';
import { sound } from '../audio.js';

export class TrafficVehicle {
  constructor(x, y, road, dir = 1, typeIndex = 0) {
    this.x = x;
    this.y = y;
    this.road = road;
    this.dir = dir; // 1 or -1 (movement along road)
    this.isHorizontal = road.w > road.h;
    
    const tConfig = CONFIG.TRAFFIC_TYPES[typeIndex % CONFIG.TRAFFIC_TYPES.length];
    this.type = tConfig.type;
    this.name = tConfig.name;
    this.w = tConfig.w;
    this.h = tConfig.h;
    this.baseSpeed = tConfig.speed * (0.85 + Math.random() * 0.3);
    this.currentSpeed = this.baseSpeed;
    this.color = tConfig.color;
    this.roofColor = tConfig.roof;
    this.hornRate = tConfig.hornRate;
    
    this.hornCooldown = Math.random() * 6.0;
    this.angle = this.isHorizontal ? (this.dir === 1 ? 0 : Math.PI) : (this.dir === 1 ? Math.PI / 2 : -Math.PI / 2);
    this.sway = Math.random() * Math.PI * 2;
    this.isBraking = false;
  }

  update(allVehicles, player, cows, obstacles, dt = 1 / 60) {
    this.sway += 0.08;
    this.hornCooldown -= dt;

    // 1. Raycast detection ahead
    const lookAheadDist = this.type === 'bus' ? 65 : 45;
    let shouldStop = false;

    const frontX = this.x + Math.cos(this.angle) * lookAheadDist;
    const frontY = this.y + Math.sin(this.angle) * lookAheadDist;

    // Check collision with Player
    if (player) {
      const distToPlayer = Math.hypot(player.x - frontX, player.y - frontY);
      if (distToPlayer < 35) {
        shouldStop = true;
        // Honk aggressively at player blocking road
        if (this.hornCooldown <= 0 && Math.random() < this.hornRate) {
          sound.playTrafficHorn(this.type === 'bus' ? 'bus' : 'auto');
          this.hornCooldown = 3.5;
        }
      }
    }

    // Check collision with other traffic vehicles ahead
    for (let v of allVehicles) {
      if (v === this) continue;
      const dist = Math.hypot(v.x - frontX, v.y - frontY);
      if (dist < (this.w + v.w) * 0.55) {
        shouldStop = true;
        break;
      }
    }

    // Check collision with Cows resting in street
    for (let c of cows) {
      const dist = Math.hypot(c.x - frontX, c.y - frontY);
      if (dist < 38) {
        shouldStop = true;
        if (this.hornCooldown <= 0) {
          sound.playTrafficHorn('auto');
          this.hornCooldown = 4.0;
        }
        break;
      }
    }

    // 2. Accelerate or Brake
    if (shouldStop) {
      this.currentSpeed = Math.max(0, this.currentSpeed - 0.25);
      this.isBraking = true;
    } else {
      this.currentSpeed = Math.min(this.baseSpeed, this.currentSpeed + 0.15);
      this.isBraking = false;
    }

    // 3. Move along road lane
    this.x += Math.cos(this.angle) * this.currentSpeed;
    this.y += Math.sin(this.angle) * this.currentSpeed;

    // 4. Wrap around world roads
    if (this.isHorizontal) {
      if (this.x > CONFIG.WORLD_WIDTH + 80) this.x = -80;
      if (this.x < -80) this.x = CONFIG.WORLD_WIDTH + 80;
    } else {
      if (this.y > CONFIG.WORLD_HEIGHT + 80) this.y = -80;
      if (this.y < -80) this.y = CONFIG.WORLD_HEIGHT + 80;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Vehicle Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(-this.w / 2 + 4, -this.h / 2 + 4, this.w, this.h);

    if (this.type === 'auto_rickshaw') {
      // Auto Rickshaw (Yellow & Green)
      ctx.fillStyle = this.color; // Yellow front
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w * 0.45, this.h);
      ctx.fillStyle = this.roofColor; // Green back/hood
      ctx.fillRect(-this.w / 2 + this.w * 0.4, -this.h / 2, this.w * 0.6, this.h);

      // Windshield & Auto Canvas Hood
      ctx.fillStyle = '#8ecae6';
      ctx.fillRect(this.w / 2 - 8, -this.h / 2 + 2, 4, this.h - 4);

      // Driver Silhouette
      ctx.fillStyle = '#6f4e37';
      ctx.beginPath();
      ctx.arc(this.w * 0.15, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'bus') {
      // Red BEST / DTC City Bus
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

      // White Roof strip
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-this.w / 2 + 4, -this.h / 2 + 3, this.w - 8, this.h - 6);

      // Route Destination Board (e.g. 332 ANDHERI)
      ctx.fillStyle = '#ffb703';
      ctx.fillRect(this.w / 2 - 8, -this.h / 2 + 2, 5, this.h - 4);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 5px sans-serif';
      ctx.fillText('BEST', this.w / 2 - 7, 2);

      // Windows
      ctx.fillStyle = '#457b9d';
      for (let wx = -this.w / 2 + 8; wx < this.w / 2 - 12; wx += 10) {
        ctx.fillRect(wx, -this.h / 2 + 1, 7, 3);
        ctx.fillRect(wx, this.h / 2 - 4, 7, 3);
      }
    } else if (this.type === 'thela') {
      // Wooden Handcart with vegetables (Tomatoes, Onions, Potatoes)
      ctx.fillStyle = '#8c5a3c';
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.strokeStyle = '#5a3d28';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);

      // Produce baskets
      ctx.fillStyle = '#e63946'; // Tomatoes
      ctx.beginPath(); ctx.arc(-6, -4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a9d8f'; // Green veggies
      ctx.beginPath(); ctx.arc(6, -4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4a261'; // Potatoes
      ctx.beginPath(); ctx.arc(0, 4, 4, 0, Math.PI * 2); ctx.fill();
    } else {
      // Standard Indian Car / Tata Ace
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.fillStyle = '#1d3557';
      ctx.fillRect(-this.w / 2 + 6, -this.h / 2 + 2, this.w - 12, this.h - 4);
      ctx.fillStyle = this.roofColor;
      ctx.fillRect(-this.w / 2 + 10, -this.h / 2 + 3, this.w - 20, this.h - 6);
    }

    // Brake lights
    if (this.isBraking) {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-this.w / 2 - 2, -this.h / 2 + 1, 3, 4);
      ctx.fillRect(-this.w / 2 - 2, this.h / 2 - 5, 3, 4);
    }

    // Headlights
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(this.w / 2 - 1, -this.h / 2 + 1, 2, 3);
    ctx.fillRect(this.w / 2 - 1, this.h / 2 - 4, 2, 3);

    ctx.restore();
  }
}
