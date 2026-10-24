(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};

  function boot() {
    try {
      if (typeof THREE === 'undefined') {
        const app = document.getElementById('game-app');
        if (app && !document.getElementById('engine-loading-toast')) {
          const loadingToast = document.createElement('div');
          loadingToast.id = 'engine-loading-toast';
          loadingToast.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; background: #11141c; padding: 32px 48px; border-radius: 16px; text-align: center; font-family: var(--font-display, "Russo One", sans-serif); border: 3px solid #000; box-shadow: 6px 6px 0px #000; z-index: 999999;';
          loadingToast.innerHTML = '<h2 style="font-size: 1.3rem; margin: 0 0 8px 0; color: #ffe600; font-family: var(--font-display, \'Russo One\', sans-serif); letter-spacing: 2px; text-shadow: 2px 2px 0px #000;">SHIPLYP // DISPATCH</h2><p style="margin: 0; color: rgba(255,255,255,0.8); font-size: 0.85rem; font-family: var(--font-telemetry, \'Chakra Petch\', monospace); letter-spacing: 1px; text-transform: uppercase;">INITIALIZING 3D HIGHWAY ENVIRONMENT...</p>';
          app.appendChild(loadingToast);
        }
        setTimeout(boot, 300);
        return;
      }
      const existingToast = document.getElementById('engine-loading-toast');
      if (existingToast) existingToast.remove();

      window.game = new (S.ShiplypEngine || ShiplypEngine)();
    } catch (err) {
      console.error('Shiplyp Engine Init Error:', err);
      const app = document.getElementById('game-app') || document.body;
      const errCard = document.createElement('div');
      errCard.style.cssText = 'position: absolute; top: 24px; left: 24px; right: 24px; background: rgba(239, 35, 60, 0.96); color: #fff; padding: 22px 28px; border-radius: 16px; font-family: monospace; font-size: 14px; z-index: 9999999; box-shadow: 0 20px 50px rgba(0,0,0,0.8);';
      errCard.innerHTML = `<h3 style="margin: 0 0 10px 0;">Shiplyp Engine Initialization Error</h3><p style="margin: 0 0 8px 0;"><strong>Error:</strong> ${err.message}</p><pre style="white-space: pre-wrap; font-size: 12px; opacity: 0.85; margin: 0;">${err.stack}</pre>`;
      app.appendChild(errCard);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
