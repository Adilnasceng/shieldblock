// ShieldBlock — Settings Page Script

(async () => {
  'use strict';

  let settings = null;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function sendMessage(msg) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(msg, resp => {
        if (chrome.runtime.lastError) resolve({});
        else resolve(resp || {});
      });
    });
  }

  function getToggle(id) { return document.getElementById(id); }

  function setToggle(btn, checked) {
    btn.setAttribute('aria-checked', String(checked));
  }

  function getChecked(btn) {
    return btn.getAttribute('aria-checked') === 'true';
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.section;
      navLinks.forEach(l => l.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(`section-${target}`)?.classList.add('active');
    });
  });

  // ─── Load ─────────────────────────────────────────────────────────────────

  async function load() {
    const settingsResp = await sendMessage({ type: 'GET_SETTINGS' });
    settings = settingsResp.settings;

    const statsResp = await sendMessage({ type: 'GET_STATS' });
    renderAll(settings, statsResp.global || {});
  }

  function renderAll(s, stats) {
    // i18n — run first so all data-i18n elements are translated
    applyI18n(s.language || 'en');

    // Theme
    document.body.classList.toggle('dark', s.darkMode);
    document.body.classList.toggle('light', !s.darkMode);
    setToggle(getToggle('toggle-dark'), s.darkMode);

    // Language
    document.getElementById('select-language').value = s.language || 'en';

    // Categories
    setToggle(getToggle('toggle-ads'), s.categories.ads);
    setToggle(getToggle('toggle-trackers'), s.categories.trackers);
    setToggle(getToggle('toggle-miners'), s.categories.miners);
    setToggle(getToggle('toggle-cookies'), s.categories.cookieBanners);
    setToggle(getToggle('toggle-antiblock'), s.categories.antiAdblock);

    // Stats
    document.getElementById('gen-stat-ads').textContent = formatNum(stats.adsBlockedTotal || 0);
    document.getElementById('gen-stat-trackers').textContent = formatNum(stats.trackersBlockedTotal || 0);
    document.getElementById('gen-stat-cookies').textContent = formatNum(stats.cookieBannersTotal || 0);

    // Whitelist
    renderWhitelist(s.whitelist || []);

    // Custom rules
    renderCustomRules(s.customRules || []);
  }

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function saveSettings() {
    await sendMessage({ type: 'SET_SETTINGS', settings });
  }

  // ─── Toggle Handlers ──────────────────────────────────────────────────────

  function bindToggle(id, settingPath, onChange) {
    const btn = getToggle(id);
    btn.addEventListener('click', async () => {
      const newVal = !getChecked(btn);
      setToggle(btn, newVal);
      settingPath(newVal);
      if (onChange) onChange(newVal);
      await saveSettings();
    });
  }

  bindToggle('toggle-dark', v => {
    settings.darkMode = v;
    document.body.classList.toggle('dark', v);
    document.body.classList.toggle('light', !v);
  });

  bindToggle('toggle-ads', v => { settings.categories.ads = v; });
  bindToggle('toggle-trackers', v => { settings.categories.trackers = v; settings.categories.miners = v; });
  bindToggle('toggle-miners', v => { settings.categories.miners = v; });
  bindToggle('toggle-cookies', v => { settings.categories.cookieBanners = v; });
  bindToggle('toggle-antiblock', v => { settings.categories.antiAdblock = v; });

  document.getElementById('select-language').addEventListener('change', async (e) => {
    settings.language = e.target.value;
    applyI18n(settings.language);   // instant UI update
    await saveSettings();
  });

  // ─── Whitelist ────────────────────────────────────────────────────────────

  function renderWhitelist(list) {
    const ul = document.getElementById('whitelist-list');
    const empty = document.getElementById('whitelist-empty');
    ul.innerHTML = '';
    empty.style.display = list.length === 0 ? 'block' : 'none';

    list.forEach(domain => {
      const li = document.createElement('li');
      li.className = 'domain-item';
      li.innerHTML = `
        <span class="domain-name">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          ${escapeHtml(domain)}
        </span>
        <button class="btn-remove" data-domain="${escapeHtml(domain)}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>`;
      ul.appendChild(li);
    });

    ul.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const domain = btn.dataset.domain;
        settings.whitelist = settings.whitelist.filter(d => d !== domain);
        renderWhitelist(settings.whitelist);
        await saveSettings();
        // Also update dynamic rules via service worker
        await sendMessage({ type: 'SET_SETTINGS', settings });
      });
    });
  }

  document.getElementById('btn-add-whitelist').addEventListener('click', async () => {
    const input = document.getElementById('whitelist-input');
    let domain = input.value.trim().toLowerCase();
    // Strip protocol/path
    try { domain = new URL(domain.includes('://') ? domain : 'https://' + domain).hostname; } catch {}
    if (!domain || settings.whitelist.includes(domain)) return;
    settings.whitelist.push(domain);
    renderWhitelist(settings.whitelist);
    input.value = '';
    await saveSettings();
  });

  document.getElementById('whitelist-input').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') document.getElementById('btn-add-whitelist').click();
  });

  // ─── Custom Rules ─────────────────────────────────────────────────────────

  function renderCustomRules(rules) {
    const textarea = document.getElementById('custom-rules-input');
    textarea.value = rules.map(r => {
      const prefix = r.type === 'allow' ? '@@' : '';
      return prefix + r.pattern;
    }).join('\n');
  }

  function parseCustomRules(text) {
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('!'))
      .map(line => {
        if (line.startsWith('@@')) {
          return { type: 'allow', pattern: line.slice(2) };
        }
        return { type: 'block', pattern: line };
      });
  }

  document.getElementById('btn-save-rules').addEventListener('click', async () => {
    const text = document.getElementById('custom-rules-input').value;
    settings.customRules = parseCustomRules(text);
    await saveSettings();
    const t = TRANSLATIONS[settings.language || 'en'] || TRANSLATIONS.en;
    const status = document.getElementById('rules-save-status');
    status.textContent = t.saved;
    setTimeout(() => { status.textContent = ''; }, 2000);
  });

  // ─── Import / Export ──────────────────────────────────────────────────────

  document.getElementById('btn-export').addEventListener('click', async () => {
    const { stats } = await new Promise(r => chrome.storage.local.get(['settings', 'stats'], r));
    const exportData = { settings, stats, exportedAt: new Date().toISOString(), version: '1.0.0' };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shieldblock-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const fileInput = document.getElementById('import-file');
  const importBtn = document.getElementById('btn-import');
  let pendingImport = null;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    document.getElementById('import-filename').textContent = file.name;
    importBtn.disabled = false;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        pendingImport = JSON.parse(e.target.result);
        document.getElementById('import-status').textContent = '';
      } catch {
        document.getElementById('import-status').textContent = '✗ Invalid JSON file';
        document.getElementById('import-status').style.color = 'var(--danger)';
        importBtn.disabled = true;
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('import-file-label')?.addEventListener('click', () => fileInput.click());
  document.querySelector('.file-label').addEventListener('click', () => fileInput.click());

  importBtn.addEventListener('click', async () => {
    if (!pendingImport) return;
    try {
      const importedSettings = pendingImport.settings;
      if (!importedSettings || typeof importedSettings !== 'object') throw new Error('Invalid settings');
      // Merge with defaults to avoid missing keys
      settings = { ...getDefaultSettings(), ...importedSettings };
      await saveSettings();
      if (pendingImport.stats) {
        await new Promise(r => chrome.storage.local.set({ stats: pendingImport.stats }, r));
      }
      const statusEl = document.getElementById('import-status');
      statusEl.style.color = 'var(--success)';
      statusEl.textContent = '✓ Settings imported successfully';
      renderAll(settings, pendingImport.stats || {});
    } catch (e) {
      const statusEl = document.getElementById('import-status');
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = '✗ Import failed: ' + e.message;
    }
  });

  document.getElementById('btn-reset-all').addEventListener('click', async () => {
    const t = TRANSLATIONS[settings?.language || 'en'] || TRANSLATIONS.en;
    if (!confirm(t.confirmResetAll)) return;
    settings = getDefaultSettings();
    await sendMessage({ type: 'SET_SETTINGS', settings });
    await sendMessage({ type: 'RESET_STATS' });
    renderAll(settings, {});
  });

  document.getElementById('btn-reset-stats').addEventListener('click', async () => {
    const t = TRANSLATIONS[settings?.language || 'en'] || TRANSLATIONS.en;
    if (!confirm(t.confirmResetStats)) return;
    await sendMessage({ type: 'RESET_STATS' });
    document.getElementById('gen-stat-ads').textContent = '0';
    document.getElementById('gen-stat-trackers').textContent = '0';
    document.getElementById('gen-stat-cookies').textContent = '0';
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getDefaultSettings() {
    return {
      enabled: true,
      darkMode: true,
      language: 'en',
      categories: { ads: true, trackers: true, miners: true, cookieBanners: true, antiAdblock: true },
      whitelist: [],
      customRules: [],
    };
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  await load();

})();
