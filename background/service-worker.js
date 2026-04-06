// ShieldBlock Service Worker — Manifest V3

const RULESET_IDS = { ads: 'ads', trackers: 'trackers', miners: 'miners' };
const WHITELIST_RULE_BASE_ID = 9000;
const CUSTOM_RULE_BASE_ID = 8000;

const DEFAULT_SETTINGS = {
  enabled: true,
  darkMode: true,
  language: 'en',
  categories: { ads: true, trackers: true, miners: true, cookieBanners: true, antiAdblock: true },
  whitelist: [],
  customRules: [],
};

const DEFAULT_STATS = {
  adsBlockedTotal: 0,
  trackersBlockedTotal: 0,
  cookieBannersTotal: 0,
};

const EMPTY_SESSION = () => ({ adsBlocked: 0, trackersBlocked: 0, cookieBannersRemoved: 0 });

// ─── Session Stats (chrome.storage.session — survives SW restarts) ────────────
// Keys: `s_<tabId>` → { adsBlocked, trackersBlocked, cookieBannersRemoved }

async function getTabSession(tabId) {
  try {
    const r = await chrome.storage.session.get(`s_${tabId}`);
    return r[`s_${tabId}`] || EMPTY_SESSION();
  } catch {
    return EMPTY_SESSION();
  }
}

async function setTabSession(tabId, data) {
  try {
    await chrome.storage.session.set({ [`s_${tabId}`]: data });
  } catch {}
}

async function initTabSession(tabId) {
  await setTabSession(tabId, EMPTY_SESSION());
}

async function removeTabSession(tabId) {
  try {
    await chrome.storage.session.remove(`s_${tabId}`);
  } catch {}
}

// ─── Initialization ───────────────────────────────────────────────────────────

async function initialize() {
  const { settings, stats } = await chrome.storage.local.get(['settings', 'stats']);
  if (!settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  if (!stats)    await chrome.storage.local.set({ stats: DEFAULT_STATS });

  const s = settings || DEFAULT_SETTINGS;
  await syncRulesets(s);
  await syncDynamicRules(s);
  await updateBadgeForCurrentTab();
}

// ─── Ruleset Management ───────────────────────────────────────────────────────

async function syncRulesets(settings) {
  if (!settings.enabled) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ['ads', 'trackers', 'miners'],
    });
    return;
  }

  const enable = [], disable = [];
  const cats = settings.categories;

  cats.ads     ? enable.push('ads')     : disable.push('ads');
  cats.trackers ? enable.push('trackers') : disable.push('trackers');
  cats.miners  ? enable.push('miners')  : disable.push('miners');

  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enable,
      disableRulesetIds: disable,
    });
  } catch (e) {
    console.warn('[ShieldBlock] updateEnabledRulesets error:', e);
  }
}

// ─── Dynamic Rules (whitelist + custom) ──────────────────────────────────────

async function syncDynamicRules(settings) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  const addRules = [];

  settings.whitelist.forEach((domain, i) => {
    addRules.push({
      id: WHITELIST_RULE_BASE_ID + i,
      priority: 2,
      action: { type: 'allow' },
      condition: {
        initiatorDomains: [domain],
        resourceTypes: ['main_frame','sub_frame','script','image','xmlhttprequest',
                        'media','ping','other','websocket','font','stylesheet'],
      },
    });
  });

  settings.customRules.forEach((rule, i) => {
    if (rule.pattern?.trim()) {
      addRules.push({
        id: CUSTOM_RULE_BASE_ID + i,
        priority: rule.type === 'allow' ? 3 : 1,
        action: { type: rule.type === 'allow' ? 'allow' : 'block' },
        condition: {
          urlFilter: rule.pattern.trim(),
          resourceTypes: ['main_frame','sub_frame','script','image','xmlhttprequest',
                          'media','ping','other','websocket','font','stylesheet'],
        },
      });
    }
  });

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });
}

// ─── Badge ────────────────────────────────────────────────────────────────────

async function updateBadgeForTab(tabId) {
  const { settings } = await chrome.storage.local.get('settings');
  const s = settings || DEFAULT_SETTINGS;

  if (!s.enabled) {
    await chrome.action.setBadgeText({ text: '—', tabId });
    await chrome.action.setBadgeBackgroundColor({ color: '#6B7280', tabId });
    return;
  }

  const domain = await getTabDomain(tabId);
  if (domain && s.whitelist.includes(domain)) {
    await chrome.action.setBadgeText({ text: '✓', tabId });
    await chrome.action.setBadgeBackgroundColor({ color: '#F59E0B', tabId });
    return;
  }

  const session = await getTabSession(tabId);
  const total = session.adsBlocked + session.trackersBlocked + session.cookieBannersRemoved;
  const text = total > 999 ? '999+' : total > 0 ? String(total) : '';

  await chrome.action.setBadgeText({ text, tabId });
  await chrome.action.setBadgeBackgroundColor({ color: '#2563EB', tabId });
}

async function updateBadgeForCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await updateBadgeForTab(tab.id);
  } catch {}
}

async function getTabDomain(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url ? new URL(tab.url).hostname : null;
  } catch {
    return null;
  }
}

// ─── Global Stat Helper ───────────────────────────────────────────────────────

async function incrementGlobalStat(key, amount = 1) {
  const { stats } = await chrome.storage.local.get('stats');
  const s = stats || { ...DEFAULT_STATS };
  s[key] = (s[key] || 0) + amount;
  await chrome.storage.local.set({ stats: s });
}

// ─── declarativeNetRequest feedback ──────────────────────────────────────────

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    const tabId = info.request.tabId;
    if (tabId < 0) return;

    const session = await getTabSession(tabId);
    const ruleId = info.rule.ruleId;

    if (ruleId >= 1 && ruleId <= 110) {
      session.adsBlocked++;
      await incrementGlobalStat('adsBlockedTotal');
    } else if (ruleId >= 1001 && ruleId <= 1080) {
      session.trackersBlocked++;
      await incrementGlobalStat('trackersBlockedTotal');
    } else if (ruleId >= 2001 && ruleId <= 2030) {
      session.adsBlocked++;
      await incrementGlobalStat('adsBlockedTotal');
    } else if (ruleId >= CUSTOM_RULE_BASE_ID && ruleId < WHITELIST_RULE_BASE_ID) {
      session.adsBlocked++;
      await incrementGlobalStat('adsBlockedTotal');
    }

    await setTabSession(tabId, session);
    await updateBadgeForTab(tabId);
  });
}

// ─── Tab Lifecycle ────────────────────────────────────────────────────────────

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  await initTabSession(details.tabId);
  await updateBadgeForTab(details.tabId);
});

chrome.tabs.onActivated.addListener(async (info) => {
  await updateBadgeForTab(info.tabId);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabSession(tabId);
});

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const tabId = sender.tab?.id;

    switch (msg.type) {

      case 'COOKIE_BANNER_REMOVED': {
        if (tabId != null) {
          const session = await getTabSession(tabId);
          session.cookieBannersRemoved++;
          await setTabSession(tabId, session);
          await incrementGlobalStat('cookieBannersTotal');
          await updateBadgeForTab(tabId);
        }
        sendResponse({ ok: true });
        break;
      }

      case 'ANTI_ADBLOCK_REMOVED': {
        if (tabId != null) {
          const session = await getTabSession(tabId);
          session.adsBlocked++;
          await setTabSession(tabId, session);
          await updateBadgeForTab(tabId);
        }
        sendResponse({ ok: true });
        break;
      }

      case 'GET_STATS': {
        const { stats } = await chrome.storage.local.get('stats');
        const resolvedTabId = msg.tabId ?? tabId;
        const session = resolvedTabId != null
          ? await getTabSession(resolvedTabId)
          : EMPTY_SESSION();
        sendResponse({ global: stats || DEFAULT_STATS, session });
        break;
      }

      case 'GET_SETTINGS': {
        const { settings } = await chrome.storage.local.get('settings');
        sendResponse({ settings: settings || DEFAULT_SETTINGS });
        break;
      }

      case 'SET_SETTINGS': {
        const newSettings = msg.settings;
        await chrome.storage.local.set({ settings: newSettings });
        await syncRulesets(newSettings);
        await syncDynamicRules(newSettings);
        await updateBadgeForCurrentTab();
        sendResponse({ ok: true });
        break;
      }

      case 'TOGGLE_WHITELIST': {
        const { settings } = await chrome.storage.local.get('settings');
        const s = settings || { ...DEFAULT_SETTINGS };
        const domain = msg.domain;
        const idx = s.whitelist.indexOf(domain);
        if (idx === -1) s.whitelist.push(domain);
        else s.whitelist.splice(idx, 1);
        await chrome.storage.local.set({ settings: s });
        await syncDynamicRules(s);
        await updateBadgeForCurrentTab();
        sendResponse({ whitelisted: s.whitelist.includes(domain) });
        break;
      }

      case 'RESET_STATS': {
        await chrome.storage.local.set({ stats: { ...DEFAULT_STATS } });
        await chrome.storage.session.clear();
        await updateBadgeForCurrentTab();
        sendResponse({ ok: true });
        break;
      }

      case 'GET_SESSION_STATS': {
        const resolvedTabId = msg.tabId ?? tabId;
        const session = resolvedTabId != null
          ? await getTabSession(resolvedTabId)
          : EMPTY_SESSION();
        sendResponse({ session });
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true;
});

// ─── Install / Startup ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  await initialize();
  if (details.reason === 'install') {
    console.log('[ShieldBlock] Installed successfully.');
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await initialize();
});

initialize().catch(console.error);
