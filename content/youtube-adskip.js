// ShieldBlock — YouTube Ad Skipper
// Auto-clicks skip buttons and closes overlay ads on YouTube.

(function () {
  'use strict';

  chrome.storage.local.get('settings', ({ settings }) => {
    if (!settings) return;
    if (!settings.enabled) return;
    if (!settings.categories || !settings.categories.ads) return;
    if (settings.whitelist && settings.whitelist.includes(location.hostname)) return;

    init();
  });

  // ─── Skip Button Selectors ────────────────────────────────────────────────

  const SKIP_SELECTORS = [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-container button',
    'button.ytp-ad-skip-button-modern',
    '.videoAdUiSkipContainer button',
    '[class*="skip-button"]',
  ];

  const OVERLAY_CLOSE_SELECTORS = [
    '.ytp-ad-overlay-close-button',
    '.ytp-ad-overlay-slot .ytp-ad-overlay-close',
  ];

  // ─── Core Logic ───────────────────────────────────────────────────────────

  function trySkip() {
    // 1. Click skip button if visible
    for (const sel of SKIP_SELECTORS) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
        btn.click();
        return;
      }
    }

    // 2. Close overlay ads
    for (const sel of OVERLAY_CLOSE_SELECTORS) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
        btn.click();
        return;
      }
    }

    // 3. If an ad is playing and can't be skipped yet, mute it and fast-forward
    const player = document.querySelector('.html5-main-video');
    if (player && isAdPlaying()) {
      player.muted = true;
      if (player.duration && isFinite(player.duration)) {
        player.currentTime = player.duration;
      }
    }
  }

  function isAdPlaying() {
    return !!(
      document.querySelector('.ad-showing') ||
      document.querySelector('.ytp-ad-player-overlay') ||
      document.querySelector('[class*="ad-interrupting"]')
    );
  }

  // ─── Observer ─────────────────────────────────────────────────────────────

  function init() {
    // Run immediately in case ad is already showing
    trySkip();

    // Watch for DOM changes (skip button injected dynamically)
    const observer = new MutationObserver(() => {
      if (isAdPlaying()) trySkip();
    });

    const attach = () => {
      const target = document.getElementById('movie_player') || document.body;
      if (target) {
        observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attach);
    } else {
      attach();
    }

    // YouTube is a SPA — re-run on navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(trySkip, 1000);
      }
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

})();
