// ShieldBlock — Cosmetic Filter
// Injects CSS to hide ad containers that slip through network blocking.
// Runs at document_start, uses MutationObserver for dynamic content.

(function () {
  'use strict';

  // Read settings from storage before doing anything
  chrome.storage.local.get('settings', ({ settings }) => {
    if (!settings) return;
    if (!settings.enabled) return;
    if (!settings.categories || !settings.categories.ads) return;

    injectStyles();
    startObserver();
  });

  // ─── CSS Selectors ─────────────────────────────────────────────────────────

  const AD_SELECTORS = [
    // Google / programmatic ads
    '.adsbygoogle',
    'ins.adsbygoogle',
    '[data-ad-slot]',
    '[data-ad-unit]',
    '[data-ad-client]',
    '[id^="div-gpt-ad"]',
    '[id^="google_ads_iframe"]',
    '[id^="google_ads_frame"]',
    '[class*="googletag"]',
    '[id*="googletag"]',
    '[data-google-query-id]',

    // Generic ad classes/IDs
    '.ad',
    '.ads',
    '.ad-banner',
    '.ad-container',
    '.ad-wrapper',
    '.ad-slot',
    '.ad-unit',
    '.ad-placement',
    '.ad-block',
    '.ad-area',
    '.ad-section',
    '.ad-box',
    '.ad-frame',
    '.ad-strip',
    '.ad-label',
    '.advertisement',
    '.advertisements',
    '.advert',
    '.advertise',
    '.advertorial',
    '.banner-ad',
    '.banner_ad',
    '.display-ad',
    '.display_ad',
    '.sidebar-ad',
    '.sidebar_ad',
    '.top-ad',
    '.bottom-ad',
    '.header-ad',
    '.footer-ad',
    '#ad',
    '#ads',
    '#ad-wrapper',
    '#ad-container',
    '#ad-banner',
    '#ad-slot',
    '#banner_ad',
    '#advertisement',
    '#advertisements',

    // Attribute pattern matches (costly but necessary)
    '[class*="-ad-"]',
    '[class*="_ad_"]',
    '[id*="-ad-"]',
    '[id*="_ad_"]',
    '[class*="Ads"]',
    '[class*="AdUnit"]',
    '[class*="AdSlot"]',
    '[class*="AdBanner"]',

    // Sponsored / affiliate
    '.sponsored',
    '.sponsored-content',
    '.sponsored-post',
    '.sponsored-article',
    '.promoted',
    '.promoted-content',
    '.promotion',
    '.native-ad',
    '.native-ads',
    '[data-sponsored]',
    '[data-native-ad]',

    // Specific ad networks
    '[class*="outbrain"]',
    '[id*="outbrain"]',
    '.OUTBRAIN',
    '[class*="taboola"]',
    '[id*="taboola"]',
    '[class*="criteo"]',
    '[id*="criteo"]',
    '[class*="adnxs"]',
    '[id*="adnxs"]',
    '[class*="rubiconproject"]',
    '[id*="rubiconproject"]',
    '[class*="pubmatic"]',
    '[id*="pubmatic"]',
    '[class*="openx"]',
    '[id*="openx"]',
    '[class*="adform"]',
    '[id*="adform"]',
    '[class*="amazon-adsystem"]',
    '[src*="amazon-adsystem"]',
    '[class*="mgid"]',
    '[id*="mgid"]',
    '[class*="smartadserver"]',
    '[class*="adroll"]',
    '[class*="teads"]',

    // Video pre-roll (YouTube)
    '.ytp-ad-module',
    '.ytp-ad-overlay-container',
    '.ytp-ad-overlay-slot',
    '.ytp-ad-text-overlay',
    '.ytp-ad-skip-button-container',
    '.ytp-ad-player-overlay',
    '.ad-showing .ytp-chrome-top',
    '.ad-showing .ytp-progress-bar-container',
    '#player-ads',
    '#masthead-ad',

    // Sticky/floating ad containers
    '.sticky-ad',
    '.sticky_ad',
    '.floating-ad',
    '.floating_ad',
    '.fixed-ad',
    '#sticky-ad',
    '#floating-ad',

    // Popup ad containers (not browser popups)
    '.popup-ad',
    '.popup_ad',
    '#popup-ad',
    '.ad-popup',
    '.interstitial-ad',
    '#interstitial-ad',

    // Social proof / tracking widgets acting as ads
    '[src*="googlesyndication.com"]',
    '[src*="doubleclick.net"]',
    'iframe[src*="ads."]',
    'iframe[id*="google_ads"]',
  ];

  const CSS_RULES = AD_SELECTORS.map(sel => `${sel}{display:none!important;visibility:hidden!important;pointer-events:none!important;}`).join('');

  function injectStyles() {
    const style = document.createElement('style');
    style.id = '__shieldblock_cosmetic__';
    style.textContent = CSS_RULES;
    // Prepend to head if available, otherwise to documentElement
    const target = document.head || document.documentElement;
    target.prepend(style);
  }

  // ─── MutationObserver ──────────────────────────────────────────────────────

  let rafPending = false;
  const pendingNodes = new Set();

  function checkNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    // Check the node itself
    if (matchesAdSelector(node)) {
      hideElement(node);
    }
    // Check children efficiently using querySelectorAll on the subtree root
    if (node.querySelectorAll) {
      const adEls = node.querySelectorAll(AD_SELECTORS.join(','));
      adEls.forEach(hideElement);
    }
  }

  function matchesAdSelector(el) {
    if (!el.matches) return false;
    try { return el.matches(AD_SELECTORS.join(',')); } catch { return false; }
  }

  function hideElement(el) {
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
  }

  function flushPending() {
    rafPending = false;
    pendingNodes.forEach(checkNode);
    pendingNodes.clear();
  }

  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          pendingNodes.add(node);
        }
      }
      if (!rafPending && pendingNodes.size > 0) {
        rafPending = true;
        requestAnimationFrame(flushPending);
      }
    });

    const target = document.documentElement || document.body;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    } else {
      // If document isn't ready yet, wait for DOM
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.documentElement, { childList: true, subtree: true });
      });
    }
  }

})();
