// Milk Delivery Balance Physics & Doorstep Pour Measure Mini-Game
import { sound } from '../audio.js';

export class MilkMechanics {
  constructor() {
    this.totalMilkLitres = 40.0;
    this.spilledLitres = 0;
    this.spillWarning = false;
    this.activePouringSession = null;
  }

  updateBalance(player, dt = 1 / 60) {
    // Check if tilt angle exceeds safe threshold (+/- 38 degrees)
    const tilt = player.balanceTilt;
    if (Math.abs(tilt) > 38) {
      this.spillWarning = true;
      if (Math.random() < 0.08) {
        this.spillMilk(player, 0.4);
      }
    } else {
      this.spillWarning = false;
    }
  }

  spillMilk(player, amount = 0.5) {
    sound.playSpill();
    this.totalMilkLitres = Math.max(0, this.totalMilkLitres - amount);
    this.spilledLitres += amount;
    player.damage += 2;
  }

  startPouringMiniGame(house, onComplete) {
    // Orders: 500 mL (0.5L), 1000 mL (1.0L), or 1500 mL (1.5L)
    const orderAmounts = [0.5, 1.0, 1.5, 2.0];
    const targetAmount = orderAmounts[Math.floor(Math.random() * orderAmounts.length)];

    this.activePouringSession = {
      house: house,
      targetAmount: targetAmount,
      currentFill: 0.0,
      isPouring: false,
      timer: 7.0, // 7 seconds time window
      completed: false,
      onComplete: onComplete
    };
  }

  updatePouring(dt = 1 / 60) {
    if (!this.activePouringSession || this.activePouringSession.completed) return;
    const session = this.activePouringSession;

    session.timer -= dt;
    if (session.timer <= 0) {
      this.finishPouring();
      return;
    }

    if (session.isPouring) {
      session.currentFill += 0.45 * dt; // Pour rate
      sound.playPour();
    }
  }

  finishPouring() {
    if (!this.activePouringSession || this.activePouringSession.completed) return;
    const session = this.activePouringSession;
    session.completed = true;

    const diff = Math.abs(session.currentFill - session.targetAmount);
    let accuracy = 'good';
    let earnings = 25;

    if (diff <= 0.08) {
      accuracy = 'perfect';
      earnings = 45;
      sound.playThud(true);
    } else if (diff <= 0.20) {
      accuracy = 'good';
      earnings = 30;
      sound.playThud(false);
    } else {
      accuracy = 'poor';
      earnings = 10;
      sound.playSpill();
    }

    this.totalMilkLitres = Math.max(0, this.totalMilkLitres - session.currentFill);
    session.house.deliveryState = 'delivered';

    if (session.onComplete) {
      session.onComplete(session.house, accuracy, earnings, session.currentFill, session.targetAmount);
    }

    setTimeout(() => {
      this.activePouringSession = null;
    }, 1200);
  }

  renderHUD(ctx, x = 20, y = 520, tilt = 0) {
    // 1. Milk Balance Bar
    ctx.save();
    ctx.translate(x, y);

    // Background Panel
    ctx.fillStyle = 'rgba(20, 30, 45, 0.85)';
    ctx.fillRect(0, 0, 180, 50);
    ctx.strokeStyle = '#2ec4b6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, 180, 50);

    ctx.fillStyle = '#f8f9fa';
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.fillText(`🥛 MILK BALANCE: ${this.totalMilkLitres.toFixed(1)}L`, 10, 16);

    // Tilt Level Gauge
    ctx.fillStyle = '#333';
    ctx.fillRect(10, 24, 160, 14);

    // Safe zone center
    ctx.fillStyle = 'rgba(46, 196, 182, 0.4)';
    ctx.fillRect(60, 24, 60, 14);

    // Tilt indicator needle
    const needleX = 90 + Math.max(-75, Math.min(75, tilt * 1.8));
    ctx.fillStyle = Math.abs(tilt) > 35 ? '#e63946' : '#ffd166';
    ctx.fillRect(needleX - 3, 22, 6, 18);

    if (this.spillWarning) {
      ctx.fillStyle = '#e63946';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('⚠️ SPILL DANGER!', 85, 46);
    }

    ctx.restore();

    // 2. Active Pouring Modal if player is at customer door
    if (this.activePouringSession) {
      this.renderPouringModal(ctx);
    }
  }

  renderPouringModal(ctx) {
    const session = this.activePouringSession;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 30, 0.88)';
    ctx.fillRect(CONFIG.CANVAS_WIDTH / 2 - 170, 180, 340, 260);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.strokeRect(CONFIG.CANVAS_WIDTH / 2 - 170, 180, 340, 260);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🥛 MEASURE MILK FOR ${session.house.name}`, CONFIG.CANVAS_WIDTH / 2, 215);

    ctx.fillStyle = '#ffd166';
    ctx.font = '13px Outfit, sans-serif';
    ctx.fillText(`Customer Order: ${session.targetAmount.toFixed(1)} Litres`, CONFIG.CANVAS_WIDTH / 2, 240);

    // Vertical Jug Fill Bar
    const barX = CONFIG.CANVAS_WIDTH / 2 - 25;
    const barY = 260;
    const barW = 50;
    const barH = 110;

    ctx.fillStyle = '#1b263b';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(barX, barY, barW, barH);

    // Target Line
    const targetY = barY + barH - (session.targetAmount / 2.5) * barH;
    ctx.strokeStyle = '#2ec4b6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(barX - 8, targetY);
    ctx.lineTo(barX + barW + 8, targetY);
    ctx.stroke();

    // Milk Liquid Level
    const fillH = Math.min(barH, (session.currentFill / 2.5) * barH);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(barX + 2, barY + barH - fillH, barW - 4, fillH);

    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`Current: ${session.currentFill.toFixed(2)}L`, CONFIG.CANVAS_WIDTH / 2, 395);

    ctx.fillStyle = '#adb5bd';
    ctx.font = '11px sans-serif';
    ctx.fillText('Hold [SPACE] or Hold [POUR] Button | Release to Lock In', CONFIG.CANVAS_WIDTH / 2, 420);

    ctx.restore();
  }
}
