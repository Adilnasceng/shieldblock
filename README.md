<div align="center">

<img src="assets/icons/icon128.svg" width="80" alt="ShieldBlock Logo">

# ShieldBlock

**Production-grade Chrome ad blocker — Manifest V3**

[![Manifest](https://img.shields.io/badge/Manifest-V3-2563EB?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)
[![Rules](https://img.shields.io/badge/Rules-220%2B-10B981?style=flat-square)](#filter-rules)
[![Chrome](https://img.shields.io/badge/Chrome-102%2B-F59E0B?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-10B981?style=flat-square)](#)
[![No CDN](https://img.shields.io/badge/Dependencies-None-6B7280?style=flat-square)](#architecture)

</div>

---

## Features

| Category | Details |
|---|---|
| **Ad Blocking** | 110+ network rules — display, video (YouTube/Twitch), native, popup ads |
| **Tracker Blocking** | 80+ rules — GA, GTM, Facebook Pixel, Hotjar, Mixpanel, Segment, Amplitude… |
| **Crypto Miner Blocking** | 30 rules — Coinhive, CryptoLoot, JSECoin and 27 more |
| **Cookie Banner Removal** | 50+ frameworks — OneTrust, Cookiebot, Didomi, TrustArc, Quantcast, Axeptio, Osano, Civic, Usercentrics, generic GDPR banners |
| **Anti-Adblock Bypass** | Bait element injection, `window` property spoofing, overlay wall removal |
| **Popup Blocking** | Blocks `window.open()` calls without a user gesture |
| **Notification Spam** | Auto-denies browser notification permission requests from ad scripts |
| **Cosmetic Filtering** | 80+ CSS selectors injected to hide ad containers (incl. YouTube pre-roll) |
| **Per-Site Whitelist** | Pause blocking on any domain with one click |
| **Custom Rules** | AdBlock-style syntax (`\|\|example.com^`) |
| **Dark / Light Mode** | Default dark, toggleable |
| **Turkish + English** | Full i18n — cookie banner detection works in both languages |

---

## Screenshots

### Before & After

<table>
  <tr>
    <th align="center">Before ShieldBlock</th>
    <th align="center">After ShieldBlock</th>
  </tr>
  <tr>
    <td align="center">
      <img src="assets/screenshots/before.png" alt="Before — page with ads" width="420">
      <br><sub>Ad-heavy page with banners, trackers, and cookie consent popup</sub>
    </td>
    <td align="center">
      <img src="assets/screenshots/after.png" alt="After — clean page" width="420">
      <br><sub>Same page — ads removed, cookie banner dismissed, trackers blocked</sub>
    </td>
  </tr>
</table>

### Extension UI

<table>
  <tr>
    <th align="center">Popup</th>
    <th align="center">Settings</th>
  </tr>
  <tr>
    <td align="center">
      <img src="assets/screenshots/popup.png" alt="Popup UI" width="280">
      <br><sub>Live stats, per-site toggle, category toggles</sub>
    </td>
    <td align="center">
      <img src="assets/screenshots/settings.png" alt="Settings page" width="420">
      <br><sub>Whitelist, custom rules, import/export</sub>
    </td>
  </tr>
</table>

> Place your screenshots in `assets/screenshots/` with the filenames above.

---

## Installation

### Step 1 — Load as unpacked extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `ad-blocker-extension/` folder
5. The ShieldBlock icon appears in your toolbar


---

## Project Structure

```
ad-blocker-extension/
├── manifest.json                   # MV3 manifest
├── background/
│   └── service-worker.js           # Stats, badge, dynamic rules, messaging
├── content/
│   ├── cosmetic-filter.js          # CSS injection + MutationObserver
│   ├── cookie-banner-blocker.js    # 3-layer cookie banner detection/removal
│   └── anti-adblock.js            # Bait element, property spoofing, overlay removal
├── popup/
│   ├── popup.html                  # Extension popup UI
│   ├── popup.css                   # Dark/light styles
│   └── popup.js                    # Popup logic
├── settings/
│   ├── settings.html               # Full settings page
│   ├── settings.css
│   └── settings.js
├── rules/
│   ├── ads.json                    # 110 ad domain rules (IDs 1–110)
│   ├── trackers.json               # 80 tracker rules (IDs 1001–1080)
│   └── miners.json                 # 30 miner rules (IDs 2001–2030)
├── assets/
│   ├── i18n.js                     # Shared EN/TR translation strings
│   ├── icons/
│   │   ├── icon.svg / icon16–128.svg
│   │   ├── icon16.png / icon32.png / icon48.png / icon128.png
│   └── screenshots/
│       ├── before.png              # Before ShieldBlock
│       ├── after.png               # After ShieldBlock
│       ├── popup.png               # Popup UI
│       └── settings.png            # Settings page
├── _locales/
│   ├── en/messages.json
│   └── tr/messages.json
└── README.md
```

---

## Filter Rules

Rules use Chrome's `declarativeNetRequest` API — the fastest, most efficient blocking method in MV3. All network blocking happens in the browser engine with **zero JavaScript overhead** at request time.

### ads.json (IDs 1–110)
Covers all major programmatic ad networks:
`doubleclick.net` · `googlesyndication.com` · `googleadservices.com` · `imasdk.googleapis.com` · `adnxs.com` · `appnexus.com` · `pubmatic.com` · `rubiconproject.com` · `openx.net` · `casalemedia.com` · `outbrain.com` · `taboola.com` · `criteo.com` · `amazon-adsystem.com` · `ads.yahoo.com` · `adform.net` · `doubleverify.com` · `moatads.com` · `sharethrough.com` · `triplelift.com` · `indexexchange.com` · `media.net` · `smartadserver.com` · `bidswitch.net` · `adroll.com` + 85 more

### trackers.json (IDs 1001–1080)
Covers analytics, pixels, heatmaps, DMPs:
`google-analytics.com` · `googletagmanager.com` · `connect.facebook.net` · `hotjar.com` · `mixpanel.com` · `segment.com` · `amplitude.com` · `fullstory.com` · `mouseflow.com` · `smartlook.com` · `crazyegg.com` · `quantserve.com` · `comscore.com` · `demdex.net` · `bluekai.com` · `lotame.com` · `liveramp.com` · `clarity.ms` · `bat.bing.com` + 61 more

### miners.json (IDs 2001–2030)
`coinhive.com` · `coin-hive.com` · `authedmine.com` · `cryptoloot.pro` · `jsecoin.com` · `webmine.cz` · `minr.pw` + 23 more (including pattern rules for `coinhive.min.js`, `cryptonight*miner*`)

---

## Custom Filter Rules

Go to **Settings → Custom Filter Rules** and add one rule per line using AdBlock syntax:

| Syntax | Effect |
|---|---|
| `\|\|example.com^` | Block all requests to example.com |
| `@@\|\|example.com^` | Allow (whitelist) example.com |
| `\|\|example.com/ads/` | Block a specific path |
| `/banner_ad/` | Block URLs containing "banner_ad" |
| `! comment` | Comment line — ignored |

---

## Architecture

### Why declarativeNetRequest?
Unlike content scripts that run JS on every request, `declarativeNetRequest` rules are evaluated natively by Chrome's network engine:
- **Zero** JS execution overhead per request
- Rules evaluated **before** the request is sent
- Works even when the service worker is inactive

### Content Script Strategy
Content scripts are used **only** for tasks that require DOM access:
- `cosmetic-filter.js` — injects CSS, watches for new ad elements via MutationObserver
- `cookie-banner-blocker.js` — detects/clicks/removes GDPR banners (3-layer: known selectors → heuristic z-index scan → MutationObserver)
- `anti-adblock.js` — injects bait element, spoofs globals, removes overlays

All run at `document_start` to act before ads render.

### Service Worker
Stateless between activations. Session stats are stored in `chrome.storage.session` — they persist across service worker restarts within the same browser session and are automatically cleared when the browser closes. Global all-time stats are written to `chrome.storage.local`.

### Dynamic Rules
- **Whitelist rules** use IDs 9000+ with `priority: 2` (`allow` action), overriding static block rules
- **Custom block rules** use IDs 8000+ with `priority: 1`

---

## Permissions Explained

| Permission | Why it's needed |
|---|---|
| `declarativeNetRequest` | Core ad/tracker blocking via rule engine |
| `declarativeNetRequestFeedback` | Track which rules fired for badge counts (dev mode) |
| `storage` | Persist settings and statistics locally |
| `tabs` | Read current tab URL for per-site whitelist toggle |
| `activeTab` | Access active tab info when popup opens |
| `scripting` | Inject content scripts on demand |
| `webNavigation` | Detect navigation events to reset session badge counts |
| `<all_urls>` | Apply blocking rules and content scripts on all HTTP/S pages |

---

## Development

No build step required. Edit files directly and reload the extension at `chrome://extensions`.

To inspect the service worker:
1. Go to `chrome://extensions`
2. Find ShieldBlock → click **"Service Worker"** link
3. DevTools opens with the SW context

---

<div align="center">

**MIT License © 2025 Adil NAS**

[![GitHub](https://img.shields.io/badge/GitHub-Adilnasceng-181717?style=flat-square&logo=github)](https://github.com/Adilnasceng)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-EC4899?style=flat-square)](https://github.com/sponsors/Adilnasceng)

</div>
