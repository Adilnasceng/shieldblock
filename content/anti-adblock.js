// ShieldBlock — Anti-Adblock Bypass
// Neutralizes scripts that detect ad blockers and show "please disable" messages.
// Techniques: bait element injection, window property spoofing, overlay removal.

(function () {
  'use strict';

  chrome.storage.local.get('settings', ({ settings }) => {
    if (!settings) return;
    if (!settings.enabled) return;
    if (!settings.categories || !settings.categories.antiAdblock) return;

    injectBaitElement();
    spoofAdGlobals();
    blockPopupsWithoutGesture();
    startOverlayRemover();
    suppressNotificationSpam();
  });

  // ─── 1. Bait Element ────────────────────────────────────────────────────────
  // Many anti-adblock scripts check for the presence and visibility of
  // elements with ad-related classes. We inject a visible bait element.

  function injectBaitElement() {
    const bait = document.createElement('div');
    bait.id = 'google_ads_frame_helper';
    bait.className = 'adsbygoogle adsbox pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links';
    bait.setAttribute('data-ad-client', 'ca-pub-test');
    // Visually invisible but not display:none — anti-adblock checks computedStyle
    Object.assign(bait.style, {
      position: 'absolute',
      top: '-9999px',
      left: '-9999px',
      width: '1px',
      height: '1px',
      opacity: '0.001',
      pointerEvents: 'none',
    });
    const target = document.head || document.documentElement;
    if (target) target.appendChild(bait);
  }

  // ─── 2. Spoof Ad-Detection Globals ─────────────────────────────────────────
  // Some scripts check window.adsbygoogle, window.canRunAds, etc.

  function spoofAdGlobals() {
    const spoofMap = {
      canRunAds: true,
      google_jobrunner: true,
      google_tag_data: { ents: [] },
      gaGlobal: { sid: Date.now() },
      googletag: {
        cmd: [],
        pubads: () => ({ addEventListener: () => {}, setTargeting: () => ({}) }),
        defineSlot: () => ({ addService: () => ({}) }),
        enableServices: () => {},
        display: () => {},
      },
      // Some scripts check if adsbygoogle is defined and not empty
      adsbygoogle: { loaded: true, push: () => {} },
    };

    for (const [key, value] of Object.entries(spoofMap)) {
      // Only set if not already set (don't break real ad scripts that loaded)
      if (window[key] === undefined) {
        try { Object.defineProperty(window, key, { value, writable: true, configurable: true }); } catch {}
      }
    }

    // Intercept console.log-based ad detection some scripts use
    const origError = console.error.bind(console);
    console.error = (...args) => {
      const msg = String(args[0] || '');
      if (msg.includes('adsbygoogle') || msg.includes('googletag')) return; // Suppress noisy ad errors
      origError(...args);
    };
  }

  // ─── 3. Block Popups Without User Gesture ──────────────────────────────────

  let lastUserGesture = 0;

  document.addEventListener('click', () => { lastUserGesture = Date.now(); }, true);
  document.addEventListener('keydown', () => { lastUserGesture = Date.now(); }, true);

  function blockPopupsWithoutGesture() {
    const origOpen = window.open;
    window.open = function (url, target, features) {
      if (Date.now() - lastUserGesture < 200) {
        return origOpen.call(window, url, target, features);
      }
      console.debug('[ShieldBlock] Blocked popup without gesture:', url);
      return null;
    };
  }

  // ─── 4. Anti-Adblock Overlay Removal ───────────────────────────────────────

  const ANTIBLOCK_SELECTORS = [
    '[class*="adblock"]', '[id*="adblock"]',
    '[class*="adblocker"]', '[id*="adblocker"]',
    '[class*="ad-block"]', '[id*="ad-block"]',
    '[class*="AdBlock"]', '[id*="AdBlock"]',
    '.ab-overlay', '#ab-overlay',
    '.ab-detected', '#ab-detected',
    '.ab-modal', '#ab-modal',
    '.adblock-wall', '#adblock-wall',
    '.adblock-notice', '#adblock-notice',
    '.adblock-overlay', '#adblock-overlay',
    '.adblock-modal', '#adblock-modal',
    '.noads', '#noads',
    '.blocked-by-adblocker',
    '[data-adblockkey]',
    // Messages that ask users to whitelist
    '.whitelist-notice',
    '.please-disable-adblock',
    '#please-disable-adblock',
    '.anti-adblock', '#anti-adblock',
    '.antiblock', '#antiblock',
  ];

  const ANTIBLOCK_TEXT_PATTERNS = [
    /please\s*(disable|turn\s*off)\s*your\s*ad\s*block/i,
    /ad\s*block(er)?\s*(detected|found|enabled)/i,
    /we\s*(detected|noticed|see)\s*(you\s*(have|are\s*using)|an)\s*ad\s*block/i,
    /whitelist\s*(our|this)\s*(site|website|domain)/i,
    /disable\s*ad\s*block(er)?/i,
    /reklam\s*engelleyici/i,   // Turkish: ad blocker
    /reklam\s*engelle/i,
  ];

  const removedOverlays = new WeakSet();

  function isAntiAdblockOverlay(el) {
    if (removedOverlays.has(el)) return false;
    const style = window.getComputedStyle(el);
    if (style.position !== 'fixed' && style.position !== 'absolute') return false;
    const zIndex = parseInt(style.zIndex, 10);
    if (isNaN(zIndex) || zIndex < 1000) return false;
    const text = (el.innerText || el.textContent || '').slice(0, 500);
    return ANTIBLOCK_TEXT_PATTERNS.some(p => p.test(text));
  }

  function removeOverlay(el) {
    if (removedOverlays.has(el)) return;
    removedOverlays.add(el);
    try { el.remove(); } catch {}
    // Restore scroll if overlay froze body
    if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
    if (document.documentElement.style.overflow === 'hidden') document.documentElement.style.overflow = '';
    chrome.runtime.sendMessage({ type: 'ANTI_ADBLOCK_REMOVED' }).catch(() => {});
  }

  function scanAntiblockSelectors() {
    for (const selector of ANTIBLOCK_SELECTORS) {
      try {
        document.querySelectorAll(selector).forEach(el => {
          const style = window.getComputedStyle(el);
          const zIndex = parseInt(style.zIndex, 10);
          if (!isNaN(zIndex) && zIndex > 100) removeOverlay(el);
        });
      } catch {}
    }
  }

  function scanHeuristicOverlays() {
    const candidates = document.querySelectorAll('div, section, aside');
    for (const el of candidates) {
      if (isAntiAdblockOverlay(el)) removeOverlay(el);
    }
  }

  function startOverlayRemover() {
    // Initial scans
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        scanAntiblockSelectors();
        scanHeuristicOverlays();
      });
    } else {
      scanAntiblockSelectors();
      scanHeuristicOverlays();
    }

    // Delayed scans for dynamically added overlays
    [500, 1500, 3000].forEach(ms => setTimeout(() => {
      scanAntiblockSelectors();
      scanHeuristicOverlays();
    }, ms));

    // MutationObserver
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          // Check selectors
          for (const sel of ANTIBLOCK_SELECTORS) {
            try {
              if (node.matches && node.matches(sel)) {
                const style = window.getComputedStyle(node);
                const zIndex = parseInt(style.zIndex, 10);
                if (!isNaN(zIndex) && zIndex > 100) removeOverlay(node);
              }
            } catch {}
          }
          // Heuristic check
          if (isAntiAdblockOverlay(node)) removeOverlay(node);
        }
      }
    });

    const root = document.documentElement || document.body;
    if (root) observer.observe(root, { childList: true, subtree: true });
  }

  // ─── 5. Suppress Notification Permission Spam ───────────────────────────────
  // Ad networks aggressively request notification permissions.
  // We override the Notification API to auto-deny from non-user-gesture contexts.

  function suppressNotificationSpam() {
    if (!('Notification' in window)) return;

    const origRequest = Notification.requestPermission.bind(Notification);
    Notification.requestPermission = function (callback) {
      if (Date.now() - lastUserGesture > 200) {
        // No recent user gesture — auto-deny silently
        const result = Promise.resolve('denied');
        if (typeof callback === 'function') callback('denied');
        return result;
      }
      return origRequest(callback);
    };
  }

})();
