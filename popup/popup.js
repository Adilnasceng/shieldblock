// ShieldBlock — Popup Script

(async () => {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────

  let settings = null;
  let currentDomain = null;
  let currentTabId = null;

  // ─── DOM Refs ─────────────────────────────────────────────────────────────

  const $body = document.body;
  const $btnGlobal = document.getElementById('btn-global-toggle');
  const $statusLabel = document.getElementById('status-label');
  const $siteDomain = document.getElementById('site-domain');
  const $btnSite = document.getElementById('btn-site-toggle');
  const $siteToggleLabel = document.getElementById('site-toggle-label');
  const $btnTheme = document.getElementById('btn-theme');
  const $btnSettings = document.getElementById('btn-settings');
  const $btnOpenSettings = document.getElementById('btn-open-settings');
  const $iconMoon = document.getElementById('icon-moon');
  const $iconSun = document.getElementById('icon-sun');

  const $catAds = document.getElementById('cat-ads-cb');
  const $catTrackers = document.getElementById('cat-trackers-cb');
  const $catCookies = document.getElementById('cat-cookies-cb');
  const $catAntiblock = document.getElementById('cat-antiblock-cb');

  const $statAdsSession = document.getElementById('stat-ads-session');
  const $statAdsTot = document.getElementById('stat-ads-total');
  const $statTrackSession = document.getElementById('stat-trackers-session');
  const $statTrackTot = document.getElementById('stat-trackers-total');
  const $statCookieSession = document.getElementById('stat-cookies-session');
  const $statCookieTot = document.getElementById('stat-cookies-total');

  // ─── Load ─────────────────────────────────────────────────────────────────

  async function load() {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentTabId = tab.id;
      try {
        currentDomain = new URL(tab.url).hostname;
      } catch {
        currentDomain = null;
      }
    }

    // Get settings from service worker
    const settingsResp = await sendMessage({ type: 'GET_SETTINGS' });
    settings = settingsResp.settings;

    // Get stats — pass currentTabId so service worker can look up session Map
    const statsResp = await sendMessage({ type: 'GET_STATS', tabId: currentTabId });

    renderAll(settings, statsResp);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  function renderAll(s, statsResp) {
    // i18n — must run first so dynamic text below can override where needed
    applyI18n(s.language || 'en');

    // Theme
    applyTheme(s.darkMode);

    // Global toggle
    const t = TRANSLATIONS[s.language || 'en'] || TRANSLATIONS.en;
    $btnGlobal.setAttribute('aria-checked', String(s.enabled));
    $statusLabel.textContent = s.enabled ? t.protectionActive : t.protectionPaused;
    $body.classList.toggle('disabled', !s.enabled);

    // Site
    if (currentDomain) {
      $siteDomain.textContent = currentDomain;
      const whitelisted = s.whitelist.includes(currentDomain);
      $siteToggleLabel.textContent = whitelisted ? t.resumeHere : t.pauseHere;
      $btnSite.classList.toggle('whitelisted', whitelisted);
    } else {
      $siteDomain.textContent = 'N/A';
      $btnSite.disabled = true;
    }

    // Category checkboxes
    $catAds.checked = s.categories.ads;
    $catTrackers.checked = s.categories.trackers;
    $catCookies.checked = s.categories.cookieBanners;
    $catAntiblock.checked = s.categories.antiAdblock;

    // Stats
    const globalStats = statsResp.global || {};
    const session = statsResp.session || { adsBlocked: 0, trackersBlocked: 0, cookieBannersRemoved: 0 };

    setStatValue($statAdsSession, session.adsBlocked || 0);
    setStatValue($statAdsTot, globalStats.adsBlockedTotal || 0);
    setStatValue($statTrackSession, session.trackersBlocked || 0);
    setStatValue($statTrackTot, globalStats.trackersBlockedTotal || 0);
    setStatValue($statCookieSession, session.cookieBannersRemoved || 0);
    setStatValue($statCookieTot, globalStats.cookieBannersTotal || 0);
  }

  function setStatValue(el, value) {
    const formatted = formatNumber(value);
    if (el.textContent !== formatted) {
      el.textContent = formatted;
      el.classList.remove('bump');
      void el.offsetWidth; // reflow to restart animation
      el.classList.add('bump');
    }
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function applyTheme(dark) {
    $body.classList.toggle('dark', dark);
    $body.classList.toggle('light', !dark);
    $iconMoon.style.display = dark ? 'block' : 'none';
    $iconSun.style.display = dark ? 'none' : 'block';
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function sendMessage(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) resolve({});
        else resolve(resp || {});
      });
    });
  }

  async function saveSettings() {
    await sendMessage({ type: 'SET_SETTINGS', settings });
  }

  // ─── Event Handlers ───────────────────────────────────────────────────────

  // Global toggle
  $btnGlobal.addEventListener('click', async () => {
    settings.enabled = !settings.enabled;
    const t = TRANSLATIONS[settings.language || 'en'] || TRANSLATIONS.en;
    $btnGlobal.setAttribute('aria-checked', String(settings.enabled));
    $statusLabel.textContent = settings.enabled ? t.protectionActive : t.protectionPaused;
    $body.classList.toggle('disabled', !settings.enabled);
    await saveSettings();
  });

  // Site whitelist toggle
  $btnSite.addEventListener('click', async () => {
    if (!currentDomain) return;
    const resp = await sendMessage({ type: 'TOGGLE_WHITELIST', domain: currentDomain });
    const whitelisted = resp.whitelisted;
    const t = TRANSLATIONS[settings.language || 'en'] || TRANSLATIONS.en;
    if (whitelisted) {
      if (!settings.whitelist.includes(currentDomain)) settings.whitelist.push(currentDomain);
    } else {
      settings.whitelist = settings.whitelist.filter(d => d !== currentDomain);
    }
    $siteToggleLabel.textContent = whitelisted ? t.resumeHere : t.pauseHere;
    $btnSite.classList.toggle('whitelisted', whitelisted);
  });

  // Theme toggle
  $btnTheme.addEventListener('click', async () => {
    settings.darkMode = !settings.darkMode;
    applyTheme(settings.darkMode);
    await saveSettings();
  });

  // Settings page
  $btnSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());
  $btnOpenSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Category toggles
  async function onCategoryChange() {
    settings.categories.ads = $catAds.checked;
    settings.categories.trackers = $catTrackers.checked;
    settings.categories.miners = $catTrackers.checked; // miners follow trackers toggle
    settings.categories.cookieBanners = $catCookies.checked;
    settings.categories.antiAdblock = $catAntiblock.checked;
    await saveSettings();
  }

  $catAds.addEventListener('change', onCategoryChange);
  $catTrackers.addEventListener('change', onCategoryChange);
  $catCookies.addEventListener('change', onCategoryChange);
  $catAntiblock.addEventListener('change', onCategoryChange);

  // ─── Init ─────────────────────────────────────────────────────────────────

  await load();

})();
