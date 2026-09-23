// ============================================================================
// SHIPLYP AD SDK & MONETIZATION ADAPTER (ads.js)
// Unified HTML5 Game Ad Adapter supporting:
// 1. GameDistribution (Azerion) - gdsdk
// 2. CrazyGames SDK (v2 / v3) - CrazyGames.SDK
// 3. Poki SDK (v2) - PokiSDK
// 4. Standalone / Offline / AdBlocker Mock Simulator
//
// Invariants:
// - Never throw or crash the game loop if an ad fails or is blocked.
// - Always pause game physics and mute audio during ad playback; guarantee
//   resumption on ad close, skip, error, or network timeout.
// - Enforce polite cadence limits on interstitials (minimum 90s between ads).
// ============================================================================

(function (global) {
  'use strict';

  const PROVIDER = {
    GAMEDISTRIBUTION: 'gamedistribution',
    CRAZYGAMES: 'crazygames',
    POKI: 'poki',
    MOCK: 'mock'
  };

  const DEFAULT_OPTIONS = {
    gameId: 'shiplyp-last-mile',
    minInterstitialIntervalMs: 90000, // 90s between automatic interstitials
    debug: false,
    mockDurationMs: 2200 // simulated ad preview duration in dev/offline mode
  };

  let config = Object.assign({}, DEFAULT_OPTIONS);
  let activeProvider = PROVIDER.MOCK;
  let lastInterstitialTime = 0;
  let isAdPlaying = false;
  let isAudioMutedByAd = false;
  let hooks = {
    onPauseGame: null,
    onResumeGame: null,
    onMuteAudio: null,
    onResumeAudio: null
  };

  // ── Provider Auto-Detection ───────────────────────────────────────────────
  function detectProvider() {
    if (typeof global.gdsdk !== 'undefined' || typeof global.GD_OPTIONS !== 'undefined') {
      return PROVIDER.GAMEDISTRIBUTION;
    }
    if (typeof global.CrazyGames !== 'undefined' && global.CrazyGames.SDK) {
      return PROVIDER.CRAZYGAMES;
    }
    if (typeof global.PokiSDK !== 'undefined') {
      return PROVIDER.POKI;
    }
    return PROVIDER.MOCK;
  }

  // ── Audio & Pause Coordination ────────────────────────────────────────────
  function notifyAdStart() {
    isAdPlaying = true;
    try {
      if (typeof hooks.onMuteAudio === 'function') {
        hooks.onMuteAudio();
        isAudioMutedByAd = true;
      }
      if (typeof hooks.onPauseGame === 'function') {
        hooks.onPauseGame();
      }
    } catch (e) {
      if (config.debug) console.warn('[ShiplypAds] notifyAdStart error:', e);
    }
  }

  function notifyAdEnd() {
    isAdPlaying = false;
    try {
      if (isAudioMutedByAd && typeof hooks.onResumeAudio === 'function') {
        hooks.onResumeAudio();
        isAudioMutedByAd = false;
      }
      if (typeof hooks.onResumeGame === 'function') {
        hooks.onResumeGame();
      }
    } catch (e) {
      if (config.debug) console.warn('[ShiplypAds] notifyAdEnd error:', e);
    }
  }

  // ── Mock Overlay Renderer ────────────────────────────────────────────────
  // Renders a sleek arcade mock ad banner when testing locally, offline, or
  // when adblockers prevent third-party SDK calls, ensuring players can test
  // and experience the full rewarded progression flow without deadlocks.
  function showMockAd(adTitle, isRewarded, onComplete, onError) {
    notifyAdStart();

    const existing = document.getElementById('shiplyp-mock-ad-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'shiplyp-mock-ad-modal';
    overlay.style.cssText = [
      'position: fixed',
      'inset: 0',
      'z-index: 1000000',
      'background: rgba(8, 12, 20, 0.94)',
      'backdrop-filter: blur(10px)',
      '-webkit-backdrop-filter: blur(10px)',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'padding: 20px',
      'font-family: "Chakra Petch", sans-serif',
      'color: #fff',
      'text-align: center'
    ].join(';');

    let secondsLeft = Math.ceil(config.mockDurationMs / 1000);

    overlay.innerHTML = `
      <div style="max-width: 420px; width: 100%; background: #121824; border: 3px solid #000; border-radius: 18px; padding: 24px; box-shadow: 6px 6px 0px #000; position: relative;">
        <div style="font-size: 11px; letter-spacing: 0.2em; color: #00f0ff; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">
          ${isRewarded ? '🎬 REWARDED SPONSOR MESSAGE' : '📺 SPONSOR BREAK'}
        </div>
        <div style="font-family: 'Russo One', sans-serif; font-size: 24px; color: #fff; text-shadow: 2px 2px 0px #000; margin-bottom: 8px;">
          ${adTitle || 'SPEEDPOST EXPRESS'}
        </div>
        <div style="font-size: 13px; font-family: 'Barlow', sans-serif; color: rgba(232,238,242,0.7); margin-bottom: 20px;">
          [Simulated Partner Ad • Web Portal Mode Active]
        </div>

        <div style="background: rgba(0,0,0,0.4); border: 2px solid #000; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #ffe600; font-weight: 700; margin-bottom: 8px;">
            ${isRewarded ? 'REWARD UNLOCKS IN' : 'RESUMES IN'}
          </div>
          <div id="mock-ad-countdown" style="font-size: 36px; font-weight: 900; color: #22e565; text-shadow: 2px 2px 0 #000;">
            ${secondsLeft}s
          </div>
        </div>

        <button id="mock-ad-skip-btn" style="background: #ffe600; color: #000; border: 2.5px solid #000; border-radius: 10px; padding: 12px 24px; font-family: 'Chakra Petch', monospace; font-size: 13px; font-weight: 900; letter-spacing: 0.08em; box-shadow: 3px 3px 0 #000; cursor: pointer; width: 100%;">
          ${isRewarded ? 'SKIP TO CLAIM REWARD ⏩' : 'CONTINUE TO GAME ⏩'}
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    const countEl = overlay.querySelector('#mock-ad-countdown');
    const skipBtn = overlay.querySelector('#mock-ad-skip-btn');

    let timer = setInterval(() => {
      secondsLeft -= 1;
      if (countEl) countEl.textContent = `${Math.max(0, secondsLeft)}s`;
      if (secondsLeft <= 0) {
        cleanup();
        if (typeof onComplete === 'function') onComplete();
      }
    }, 1000);

    function cleanup() {
      if (timer) { clearInterval(timer); timer = null; }
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      notifyAdEnd();
    }

    skipBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      cleanup();
      if (typeof onComplete === 'function') onComplete();
    });
  }

  // ── Public Ads Engine Object ──────────────────────────────────────────────
  const ShiplypAds = {
    PROVIDER,

    init(options, hooksConfig) {
      if (options) config = Object.assign(config, options);
      if (hooksConfig) {
        hooks.onPauseGame = hooksConfig.onPauseGame || null;
        hooks.onResumeGame = hooksConfig.onResumeGame || null;
        hooks.onMuteAudio = hooksConfig.onMuteAudio || null;
        hooks.onResumeAudio = hooksConfig.onResumeAudio || null;
      }

      activeProvider = detectProvider();
      if (config.debug) {
        console.log(`[ShiplypAds] Initialized with provider: ${activeProvider}`);
      }

      // If GameDistribution SDK options were configured, hook into GD callbacks
      if (activeProvider === PROVIDER.GAMEDISTRIBUTION && global.gdsdk) {
        try {
          if (typeof global.gdsdk.openConsole === 'function' && config.debug) {
            global.gdsdk.openConsole();
          }
        } catch (_) {}
      }

      return this;
    },

    getProvider() {
      return activeProvider;
    },

    isRewardedAvailable() {
      return true; // Supported across all providers via native SDK or mock fallback
    },

    // ── Interstitial (Mid-roll / Break) ────────────────────────────────────
    showInterstitial(placement, callbacks) {
      const now = Date.now();
      const cb = callbacks || {};

      // Enforce rate limiting so interstitials are never aggressive
      if (now - lastInterstitialTime < config.minInterstitialIntervalMs) {
        if (config.debug) console.log('[ShiplypAds] Interstitial throttled by cadence limit.');
        if (typeof cb.onSkipped === 'function') cb.onSkipped();
        return false;
      }
      lastInterstitialTime = now;

      notifyAdStart();

      const finishAd = () => {
        notifyAdEnd();
        if (typeof cb.onComplete === 'function') cb.onComplete();
      };

      const failAd = (err) => {
        notifyAdEnd();
        if (typeof cb.onError === 'function') cb.onError(err);
      };

      // 1. GameDistribution
      if (activeProvider === PROVIDER.GAMEDISTRIBUTION && global.gdsdk && typeof global.gdsdk.showAd === 'function') {
        try {
          global.gdsdk.showAd(global.gdsdk.AdType ? global.gdsdk.AdType.Interstitial : undefined)
            .then(finishAd)
            .catch(failAd);
          return true;
        } catch (e) {
          failAd(e);
          return false;
        }
      }

      // 2. CrazyGames
      if (activeProvider === PROVIDER.CRAZYGAMES && global.CrazyGames && global.CrazyGames.SDK && global.CrazyGames.SDK.ad) {
        try {
          global.CrazyGames.SDK.ad.requestAd('midgame', {
            adStarted: () => {},
            adFinished: finishAd,
            adError: failAd
          });
          return true;
        } catch (e) {
          failAd(e);
          return false;
        }
      }

      // 3. Poki
      if (activeProvider === PROVIDER.POKI && global.PokiSDK && typeof global.PokiSDK.commercialBreak === 'function') {
        try {
          global.PokiSDK.commercialBreak().then(finishAd).catch(failAd);
          return true;
        } catch (e) {
          failAd(e);
          return false;
        }
      }

      // 4. Mock / Offline Mode
      showMockAd('HIGHWAY SERVICE STATION', false, finishAd, failAd);
      return true;
    },

    // ── Rewarded Video Ad ──────────────────────────────────────────────────
    showRewarded(rewardType, callbacks) {
      const cb = callbacks || {};
      notifyAdStart();

      const grantReward = () => {
        notifyAdEnd();
        if (typeof cb.onReward === 'function') cb.onReward();
        if (typeof cb.onClose === 'function') cb.onClose();
      };

      const abortAd = (err) => {
        notifyAdEnd();
        if (typeof cb.onError === 'function') cb.onError(err);
        if (typeof cb.onClose === 'function') cb.onClose();
      };

      // 1. GameDistribution
      if (activeProvider === PROVIDER.GAMEDISTRIBUTION && global.gdsdk && typeof global.gdsdk.showAd === 'function') {
        try {
          const adType = (global.gdsdk.AdType && global.gdsdk.AdType.Rewarded) ? global.gdsdk.AdType.Rewarded : 'rewarded';
          global.gdsdk.showAd(adType)
            .then(grantReward)
            .catch(abortAd);
          return true;
        } catch (e) {
          abortAd(e);
          return false;
        }
      }

      // 2. CrazyGames
      if (activeProvider === PROVIDER.CRAZYGAMES && global.CrazyGames && global.CrazyGames.SDK && global.CrazyGames.SDK.ad) {
        try {
          global.CrazyGames.SDK.ad.requestAd('rewarded', {
            adStarted: () => {},
            adFinished: grantReward,
            adError: abortAd
          });
          return true;
        } catch (e) {
          abortAd(e);
          return false;
        }
      }

      // 3. Poki
      if (activeProvider === PROVIDER.POKI && global.PokiSDK && typeof global.PokiSDK.rewardedBreak === 'function') {
        try {
          global.PokiSDK.rewardedBreak().then(success => {
            if (success) grantReward();
            else abortAd(new Error('Rewarded ad uncompleted'));
          }).catch(abortAd);
          return true;
        } catch (e) {
          abortAd(e);
          return false;
        }
      }

      // 4. Mock / Dev / Offline Fallback
      const title = rewardType === 'shift_double'
        ? 'SPEEDPOST 2X SHIFT MULTIPLIER'
        : (rewardType === 'sponsor_cash' ? 'MAHARASHTRA PETROLEUM SPONSOR' : 'EXPRESS DELIVERY SPONSOR');

      showMockAd(title, true, grantReward, abortAd);
      return true;
    },

    // ── Platform Gameplay Lifecycle Hooks ─────────────────────────────────
    gameplayStart() {
      try {
        if (activeProvider === PROVIDER.CRAZYGAMES && global.CrazyGames?.SDK?.game?.gameplayStart) {
          global.CrazyGames.SDK.game.gameplayStart();
        } else if (activeProvider === PROVIDER.POKI && global.PokiSDK?.gameplayStart) {
          global.PokiSDK.gameplayStart();
        }
      } catch (_) {}
    },

    gameplayStop() {
      try {
        if (activeProvider === PROVIDER.CRAZYGAMES && global.CrazyGames?.SDK?.game?.gameplayStop) {
          global.CrazyGames.SDK.game.gameplayStop();
        } else if (activeProvider === PROVIDER.POKI && global.PokiSDK?.gameplayStop) {
          global.PokiSDK.gameplayStop();
        }
      } catch (_) {}
    },

    happyTime() {
      try {
        if (activeProvider === PROVIDER.CRAZYGAMES && global.CrazyGames?.SDK?.game?.happytime) {
          global.CrazyGames.SDK.game.happytime();
        } else if (activeProvider === PROVIDER.POKI && global.PokiSDK?.happyTime) {
          global.PokiSDK.happyTime();
        }
      } catch (_) {}
    }
  };

  global.ShiplypAds = ShiplypAds;

})(typeof window !== 'undefined' ? window : this);
