// Stray Street Dog AI & Threat System
import { sound } from '../audio.js';

export class StrayDog {
  constructor(x, y, name = 'Tommy', territoryRadius = 240) {
    this.spawnX = x;
    this.spawnY = y;
    this.x = x;
    this.y = y;
    this.name = name;
    this.territoryRadius = territoryRadius;

    this.speed = 3.6;
    this.angle = Math.random() * Math.PI * 2;
    this.state = 'patrol'; // 'patrol', 'alert', 'chase', 'pacified'
    
    this.barkTimer = 0;
    this.patrolTimer = 2.0;
    this.pacifiedTimer = 0;
    this.treatTarget = null;
    this.tailAngle = 0;
  }

  update(player, activeTreats = [], dt = 1 / 60) {
    this.tailAngle += 0.3;

    // 1. Pacified State (Eating Parle-G Biscuit)
    if (this.state === 'pacified') {
      this.pacifiedTimer -= dt;
      if (this.pacifiedTimer <= 0) {
        this.state = 'patrol';
      }
      return;
    }

    // Check if there is an active treat thrown nearby
    for (let treat of activeTreats) {
      if (!treat.eaten) {
        const dx = treat.x - this.x;
        const dy = treat.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 180) {
          this.state = 'chasing_treat';
          this.angle = Math.atan2(dy, dx);
          this.x += Math.cos(this.angle) * (this.speed * 1.2);
          this.y += Math.sin(this.angle) * (this.speed * 1.2);

          if (dist < 18) {
            treat.eaten = true;
            this.state = 'pacified';
            this.pacifiedTimer = 8.0; // 8 seconds happy eating
            sound.playTreat();
          }
          return;
        }
      }
    }

    // Distance to Player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distToPlayer = Math.hypot(dx, dy);

    // Distance from Dog's home territory
    const distFromHome = Math.hypot(this.x - this.spawnX, this.y - this.spawnY);

    // State Machine
    if (this.state === 'patrol') {
      // Trigger Chase if player gets close and is speeding or within tight perimeter
      if (distToPlayer < this.territoryRadius && Math.abs(player.speed) > 1.2) {
        this.state = 'chase';
        sound.playDogBark();
        this.barkTimer = 0.8;
      } else {
        // Wandering around home base
        this.patrolTimer -= dt;
        if (this.patrolTimer <= 0) {
          this.patrolTimer = 1.5 + Math.random() * 2.5;
          this.angle = Math.random() * Math.PI * 2;
        }
        if (distFromHome > 80) {
          this.angle = Math.atan2(this.spawnY - this.y, this.spawnX - this.x);
        }
        this.x += Math.cos(this.angle) * 0.8;
        this.y += Math.sin(this.angle) * 0.8;
      }
    } else if (this.state === 'chase') {
      // Bark audio loop
      this.barkTimer -= dt;
      if (this.barkTimer <= 0) {
        sound.playDogBark();
        this.barkTimer = 1.4 + Math.random() * 0.6;
      }

      // If player stops moving for 3.5 seconds, dog calms down
      if (Math.abs(player.speed) < 0.2) {
        this.patrolTimer += dt;
        if (this.patrolTimer > 3.0) {
          this.state = 'patrol';
          return;
        }
      } else {
        this.patrolTimer = 0;
      }

      // Sprint towards player
      this.angle = Math.atan2(dy, dx);
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed;

      // Check Bite Collision with player
      if (distToPlayer < 24) {
        player.speed *= 0.6;
        player.damage += 5;
        sound.playPothole();
        // Dog recoils slightly
        this.x -= Math.cos(this.angle) * 15;
        this.y -= Math.sin(this.angle) * 15;
      }

      // Leash breaking: player escaped territory
      if (distFromHome > this.territoryRadius * 1.6 || distToPlayer > 360) {
        this.state = 'patrol';
      }
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Dog body shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Indian Stray Pariah Dog (Tan/Brown coat)
    ctx.fillStyle = '#b07d62';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head & Pointy Ears
    ctx.fillStyle = '#9c6644';
    ctx.beginPath();
    ctx.arc(10, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Pointy Ears
    ctx.fillStyle = '#7f4f24';
    ctx.beginPath();
    ctx.moveTo(8, -5);
    ctx.lineTo(13, -9);
    ctx.lineTo(11, -3);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8, 5);
    ctx.lineTo(13, 9);
    ctx.lineTo(11, 3);
    ctx.fill();

    // Tail Wag
    const tailSwing = Math.sin(this.tailAngle) * (this.state === 'pacified' ? 8 : 4);
    ctx.strokeStyle = '#9c6644';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(-20, tailSwing);
    ctx.stroke();

    // Status Overhead Icon
    ctx.restore();
    ctx.save();
    ctx.translate(this.x, this.y - 18);

    if (this.state === 'chase') {
      ctx.fillStyle = '#e63946';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐕 💢 BARK!', 0, 0);
    } else if (this.state === 'pacified') {
      ctx.fillStyle = '#2ec4b6';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('❤️ 🍖 YUM!', 0, 0);
    }
    ctx.restore();
  }
}
