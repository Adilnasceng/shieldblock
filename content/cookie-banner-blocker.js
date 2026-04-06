// ShieldBlock — Cookie Banner Blocker
// Detects and removes cookie consent popups using 3-layer strategy:
//   1. Known framework selectors
//   2. Heuristic z-index/position/keyword scan
//   3. MutationObserver for dynamically injected banners

(function () {
  'use strict';

  chrome.storage.local.get('settings', ({ settings }) => {
    if (!settings) return;
    if (!settings.enabled) return;
    if (!settings.categories || !settings.categories.cookieBanners) return;
    if (settings.whitelist && settings.whitelist.includes(location.hostname)) return;

    // Start detection after a brief moment to let the page render
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startDetection);
    } else {
      startDetection();
    }
  });

  // ─── Known Framework Selectors ──────────────────────────────────────────────

  const KNOWN_SELECTORS = [
    // Cookiebot
    '#Cookiebot', '#CybotCookiebotDialog', '#CybotCookiebotDialogBody',
    '[data-cookiebanner]', '.CookieConsent',

    // OneTrust
    '#onetrust-banner-sdk', '#onetrust-consent-sdk', '#onetrust-pc-sdk',
    '.onetrust-pc-dark-filter', '#onetrust-policy', '.optanon-alert-box-wrapper',
    '#optanon', '.optanon-popup-overlay',

    // TrustArc
    '#truste-consent-track', '#truste-consent-content', '.truste_overlay',
    '#truste-show-consent', '.trustarc-banner-container',

    // Quantcast (CMP)
    '#qcCmpUi', '.qc-cmp2-container', '#qc-cmp2-ui', '#cmpwrapper', '#cmpbox',

    // Didomi
    '#didomi-popup', '#didomi-notice', '.didomi-popup-container',
    '.didomi-consent-popup-preferences', '#didomi-host',

    // Axeptio
    '#axeptio_overlay', '#axeptio_main_button', '.axeptio_widget',

    // CookieYes / GDPR Cookie Consent (WordPress)
    '.cookie-law-info-bar', '#cookie-law-info-bar', '#cookie-notice',
    '.cookie-notice-container', '#cn-notice-text', '#cn-accept-cookie',

    // Osano
    '.osano-cm-window', '.osano-cm-dialog', '.osano-cm-widget',

    // Civic Cookie Control
    '#ccc', '#ccc-overlay', '#ccc-icon',

    // Usercentrics
    '#usercentrics-root', 'uc-cmp-dialog',

    // Piwik PRO
    '#ppms_cm_consent_popup_overlay', '.ppms_cm_popup_overlay',

    // Borlabs Cookie (WordPress)
    '#BorlabsCookieBox', '.borlabs-cookie',

    // cookie-consent.js (Insites)
    '.cc-window', '.cc-banner', '.cc-float', '.cc-overlay', '.cc-popup',
    '#cookieconsent', '.cookieconsent', '[aria-label="cookieconsent"]',

    // Generic GDPR/Cookie
    '#gdpr-consent-tool-wrapper', '#gdpr-banner', '#gdpr-popup',
    '#cookie-consent', '.cookie-consent', '#cookie-banner', '.cookie-banner',
    '#cookie-overlay', '.cookie-overlay',
    '[id*="cookie-consent"]', '[class*="cookie-consent"]',
    '[id*="cookie-banner"]', '[class*="cookie-banner"]',
    '[id*="gdpr-banner"]', '[class*="gdpr-banner"]',
    '[id*="cookie-notice"]', '[class*="cookie-notice"]',
    '[id*="consent-banner"]', '[class*="consent-banner"]',
    '[id*="cookiebar"]', '[class*="cookiebar"]',
    '[id*="CookieConsent"]', '[class*="CookieConsent"]',

    // Klaro
    '.klaro', '#klaro', '.cookie-modal',

    // Complianz
    '.cc-revoke', '#cmplz-cookiebanner', '.cmplz-cookiebanner',

    // iubenda
    '#iubenda-cs-banner', '.iubenda-cs-container',

    // Termly
    '#termly-code-snippet-support', '[data-tid="banner-content"]',

    // CookieFirst
    '.cookiefirst-root',

    // Silktide
    '#silktide-consent', '#silktide-consent-bar',

    // SourcePoint
    '#sp-cc', '.message-component', '[id^="sp_message_container"]',
  ];

  // Reject / decline button text patterns (EN + TR)
  const REJECT_PATTERNS = [
    /^reject\s*all$/i, /^decline\s*all$/i, /^decline$/i,
    /^only\s*necessary$/i, /^necessary\s*only$/i,
    /^essential\s*only$/i, /^only\s*essential$/i,
    /^refuse\s*all$/i, /^refuse$/i,
    /^do\s*not\s*accept$/i, /^no,\s*thanks$/i, /^no\s*thanks$/i,
    /^manage\s*preferences$/i,
    // Turkish
    /^reddet$/i, /^tümünü\s*reddet$/i, /^hepsini\s*reddet$/i,
    /^sadece\s*gerekli$/i, /^yalnızca\s*gerekli$/i,
    /^kabul\s*etme$/i, /^hayır$/i, /^vazgeç$/i,
    /^zorunlu\s*çerezler$/i, /^gerekli\s*çerezler$/i,
  ];

  // ─── Removal Logic ──────────────────────────────────────────────────────────

  const removed = new WeakSet();

  function tryClickRejectButton(banner) {
    if (!banner) return;
    const buttons = banner.querySelectorAll('button, a[role="button"], [type="button"], input[type="button"], input[type="submit"]');
    for (const btn of buttons) {
      const text = (btn.innerText || btn.value || btn.textContent || '').trim();
      if (REJECT_PATTERNS.some(p => p.test(text))) {
        try { btn.click(); } catch {}
        return true;
      }
    }
    return false;
  }

  function removeBanner(el) {
    if (!el || removed.has(el)) return;
    removed.add(el);

    // Try clicking reject first
    tryClickRejectButton(el);

    // Remove after short delay (let reject click take effect)
    setTimeout(() => {
      try { el.remove(); } catch {}
      fixBodyScroll();
      chrome.runtime.sendMessage({ type: 'COOKIE_BANNER_REMOVED' }).catch(() => {});
    }, 300);
  }

  function fixBodyScroll() {
    ['overflow', 'overflow-y', 'overflow-x', 'position'].forEach(prop => {
      try { document.documentElement.style.removeProperty(prop); } catch {}
      try { document.body.style.removeProperty(prop); } catch {}
    });
    // Specifically remove overflow:hidden
    if (document.documentElement.style.overflow === 'hidden') {
      document.documentElement.style.overflow = '';
    }
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = '';
    }
  }

  // ─── Layer 1: Known selectors ───────────────────────────────────────────────

  function scanKnownSelectors() {
    for (const selector of KNOWN_SELECTORS) {
      try {
        const els = document.querySelectorAll(selector);
        els.forEach(removeBanner);
      } catch {}
    }
  }

  // ─── Layer 2: Heuristic scan ────────────────────────────────────────────────

  const HEURISTIC_KEYWORDS = [
    'cookie', 'çerez', 'consent', 'kabul', 'gdpr', 'privacy',
    'tracking', 'accept', 'agree', 'permission', 'opt-in',
  ];

  function isLikelyCookieBanner(el) {
    const style = window.getComputedStyle(el);
    const position = style.position;
    const zIndex = parseInt(style.zIndex, 10);

    if (position !== 'fixed' && position !== 'sticky' && position !== 'absolute') return false;
    if (isNaN(zIndex) || zIndex < 1000) return false;

    const text = (el.innerText || el.textContent || '').toLowerCase();
    return HEURISTIC_KEYWORDS.some(kw => text.includes(kw));
  }

  function heuristicScan() {
    const candidates = document.querySelectorAll('div, section, aside, nav, header, footer, aside');
    for (const el of candidates) {
      if (removed.has(el)) continue;
      if (isLikelyCookieBanner(el)) {
        removeBanner(el);
      }
    }
  }

  // ─── Layer 3: MutationObserver ──────────────────────────────────────────────

  function checkAddedNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // Check against known selectors
    for (const selector of KNOWN_SELECTORS) {
      try {
        if (node.matches && node.matches(selector)) { removeBanner(node); return; }
        const inner = node.querySelectorAll && node.querySelectorAll(selector);
        if (inner && inner.length) { inner.forEach(removeBanner); }
      } catch {}
    }

    // Heuristic check on the node itself
    if (isLikelyCookieBanner(node)) {
      removeBanner(node);
    }
  }

  // ─── Main ───────────────────────────────────────────────────────────────────

  function startDetection() {
    // Immediate scan
    scanKnownSelectors();

    // Heuristic scan with delays to catch lazy-loaded banners
    const delays = [500, 1000, 2000, 3500, 5000];
    delays.forEach(ms => setTimeout(() => {
      scanKnownSelectors();
      heuristicScan();
    }, ms));

    // MutationObserver for dynamic injection
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          checkAddedNode(node);
        }
      }
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  }

})();
