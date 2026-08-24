// E-Commerce Courier OTP Verification Mechanic
import { CONFIG } from '../config.js';
import { sound } from '../audio.js';

export class OTPManager {
  constructor() {
    this.activeSession = null;
  }

  startOTPVerification(house, onComplete) {
    // Generate 4-digit OTP code
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    this.activeSession = {
      house: house,
      code: otpCode,
      enteredCode: '',
      timer: 8.0,
      completed: false,
      onComplete: onComplete
    };
  }

  enterDigit(digit) {
    if (!this.activeSession || this.activeSession.completed) return;
    if (this.activeSession.enteredCode.length < 4) {
      this.activeSession.enteredCode += digit.toString();
      sound.playBell();

      if (this.activeSession.enteredCode.length === 4) {
        this.verifyOTP();
      }
    }
  }

  clearDigit() {
    if (!this.activeSession || this.activeSession.completed) return;
    this.activeSession.enteredCode = '';
  }

  verifyOTP() {
    if (!this.activeSession || this.activeSession.completed) return;
    const session = this.activeSession;
    session.completed = true;

    if (session.enteredCode === session.code) {
      sound.playThud(true);
      session.house.deliveryState = 'delivered';
      if (session.onComplete) {
        session.onComplete(session.house, true, 50);
      }
    } else {
      sound.playPothole();
      session.house.deliveryState = 'missed';
      if (session.onComplete) {
        session.onComplete(session.house, false, 0);
      }
    }

    setTimeout(() => {
      this.activeSession = null;
    }, 1200);
  }

  update(dt = 1 / 60) {
    if (!this.activeSession || this.activeSession.completed) return;
    this.activeSession.timer -= dt;
    if (this.activeSession.timer <= 0) {
      this.verifyOTP();
    }
  }

  render(ctx) {
    if (!this.activeSession) return;
    const session = this.activeSession;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 30, 0.92)';
    ctx.fillRect(CONFIG.CANVAS_WIDTH / 2 - 160, 160, 320, 280);
    ctx.strokeStyle = '#2ec4b6';
    ctx.lineWidth = 2;
    ctx.strokeRect(CONFIG.CANVAS_WIDTH / 2 - 160, 160, 320, 280);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📦 SHIPLYP OTP CONFIRMATION`, CONFIG.CANVAS_WIDTH / 2, 195);

    ctx.fillStyle = '#ffd166';
    ctx.font = '13px Outfit, sans-serif';
    ctx.fillText(`Customer: ${session.house.name}`, CONFIG.CANVAS_WIDTH / 2, 220);

    // Customer SMS OTP Bubble
    ctx.fillStyle = '#1b263b';
    ctx.fillRect(CONFIG.CANVAS_WIDTH / 2 - 110, 235, 220, 42);
    ctx.strokeStyle = '#fca311';
    ctx.strokeRect(CONFIG.CANVAS_WIDTH / 2 - 110, 235, 220, 42);

    ctx.fillStyle = '#fca311';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Customer SMS Code:', CONFIG.CANVAS_WIDTH / 2, 250);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(session.code, CONFIG.CANVAS_WIDTH / 2, 270);

    // Input Display
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(CONFIG.CANVAS_WIDTH / 2 - 90, 290, 180, 36);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(CONFIG.CANVAS_WIDTH / 2 - 90, 290, 180, 36);

    ctx.fillStyle = '#2ec4b6';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(session.enteredCode.padEnd(4, '_').split('').join(' '), CONFIG.CANVAS_WIDTH / 2, 316);

    ctx.fillStyle = '#adb5bd';
    ctx.font = '11px sans-serif';
    ctx.fillText('Press number keys 0-9 on keyboard or tap keypad', CONFIG.CANVAS_WIDTH / 2, 355);

    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`Time Remaining: ${session.timer.toFixed(1)}s`, CONFIG.CANVAS_WIDTH / 2, 385);

    ctx.restore();
  }
}
