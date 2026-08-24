// Newspaper Toss Trajectory & Precision Landing Mechanics
import { sound } from '../audio.js';

export class TossManager {
  constructor() {
    this.projectiles = [];
    this.floatingTexts = [];
    this.treats = [];
  }

  throwPaper(player, targetX, targetY, power = 1.0) {
    if (player.cargoCount <= 0) return false;
    player.cargoCount--;

    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const angle = Math.atan2(dy, dx);

    // Initial velocity includes vehicle momentum + toss impulse
    const tossSpeed = (5.5 + power * 6.5);
    const vx = Math.cos(angle) * tossSpeed + player.vx * 0.5;
    const vy = Math.sin(angle) * tossSpeed + player.vy * 0.5;

    this.projectiles.push({
      x: player.x,
      y: player.y,
      vx: vx,
      vy: vy,
      z: 10, // Height
      vz: 4.5 + power * 2.0,
      gravity: 0.35,
      rotation: 0,
      rotSpeed: 0.25,
      landed: false,
      type: 'newspaper'
    });

    sound.playToss();
    return true;
  }

  throwTreat(player, targetX, targetY) {
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const angle = Math.atan2(dy, dx);

    const vx = Math.cos(angle) * 7.0 + player.vx * 0.4;
    const vy = Math.sin(angle) * 7.0 + player.vy * 0.4;

    this.treats.push({
      x: player.x,
      y: player.y,
      vx: vx,
      vy: vy,
      z: 5,
      vz: 3.5,
      gravity: 0.35,
      eaten: false,
      life: 15.0
    });

    sound.playToss();
  }

  update(houses, onDeliveryResult, dt = 1 / 60) {
    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vz -= p.gravity;
      p.rotation += p.rotSpeed;

      // When projectile hits ground (z <= 0)
      if (p.z <= 0) {
        p.z = 0;
        this.checkLanding(p, houses, onDeliveryResult);
        this.projectiles.splice(i, 1);
      }
    }

    // 2. Update Treats
    for (let i = this.treats.length - 1; i >= 0; i--) {
      const t = this.treats[i];
      if (t.z > 0) {
        t.x += t.vx;
        t.y += t.vy;
        t.z += t.vz;
        t.vz -= t.gravity;
        if (t.z <= 0) {
          t.z = 0;
          t.vx = 0;
          t.vy = 0;
        }
      }
      t.life -= dt;
      if (t.life <= 0 || t.eaten) {
        this.treats.splice(i, 1);
      }
    }

    // 3. Update Floating Score Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 0.8;
      ft.alpha -= 0.02;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  checkLanding(p, houses, onDeliveryResult) {
    let hitHouse = null;
    let accuracy = 'miss';

    for (let house of houses) {
      if (house.deliveryState !== 'pending') continue;

      const target = house.porch;
      const dist = Math.hypot(p.x - target.x, p.y - target.y);

      if (dist <= target.radius) {
        hitHouse = house;
        if (dist <= target.radius * 0.45) {
          accuracy = 'perfect';
        } else {
          accuracy = 'good';
        }
        break;
      }
    }

    if (hitHouse) {
      hitHouse.deliveryState = 'delivered';
      if (accuracy === 'perfect') {
        sound.playThud(true);
        this.addFloatingText(p.x, p.y, '🎯 BULLSEYE! +₹35', '#2ec4b6');
        onDeliveryResult(hitHouse, true, true, 35);
      } else {
        sound.playThud(false);
        this.addFloatingText(p.x, p.y, '✓ DELIVERED +₹20', '#ffd166');
        onDeliveryResult(hitHouse, true, false, 20);
      }
    } else {
      sound.playThud(false);
      this.addFloatingText(p.x, p.y, '✗ MISSED TARGET', '#e63946');
      onDeliveryResult(null, false, false, 0);
    }
  }

  addFloatingText(x, y, text, color = '#ffffff') {
    this.floatingTexts.push({ x, y, text, color, alpha: 1.0 });
  }

  render(ctx) {
    // 1. Draw Projectiles in Flight
    this.projectiles.forEach(p => {
      // Ground Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Folded Newspaper in air (offset by height z)
      ctx.save();
      ctx.translate(p.x, p.y - p.z * 2.2);
      ctx.rotate(p.rotation);

      // White paper with printed lines
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(-8, -4, 16, 8);
      ctx.strokeStyle = '#212529';
      ctx.lineWidth = 1;
      ctx.strokeRect(-8, -4, 16, 8);

      // Rubber band around newspaper
      ctx.fillStyle = '#e63946';
      ctx.fillRect(-2, -4, 4, 8);
      ctx.restore();
    });

    // 2. Draw Treats on Ground
    this.treats.forEach(t => {
      ctx.save();
      ctx.translate(t.x, t.y - t.z * 1.5);
      // Biscuit shape (Parle-G biscuit)
      ctx.fillStyle = '#dda15e';
      ctx.fillRect(-6, -4, 12, 8);
      ctx.strokeStyle = '#bc6c25';
      ctx.lineWidth = 1;
      ctx.strokeRect(-6, -4, 12, 8);
      ctx.restore();
    });

    // 3. Draw Floating Texts
    this.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }
}
