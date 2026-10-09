// ══════════════════════════════════════════════════════════════════════════════
// MODE MANAGER  — Single source of truth for which skin is active.
// Replaces all ad-hoc hidden/classList manipulations with a clean API.
// Usage:  ModeManager.switchTo('list')   ModeManager.current()
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Escapes HTML special characters to prevent XSS attacks when interpolating
 * untrusted data (e.g. from APIs) into the DOM via innerHTML.
 */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

const ModeManager = (() => {
  'use strict';

  // Map logical mode name → skin element ID
  const SKIN_IDS = {
    welcome: 'skin-welcome',
    list:    'skin-list',
    globe:   'skin-globe',
    retro:   'skin-retro',
    dj:      'skin-dj',
  };

  let _current  = 'welcome';   // welcome is active on load
  const _hooks  = {};           // { modeName: { mount, unmount } }

  function _activate(name) {
    document.querySelectorAll('.skin').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(SKIN_IDS[name]);
    if (el) el.classList.add('active');
    // FAB is always visible, but the Home button inside it is hidden on the welcome screen
    const fab = document.getElementById('fabGroup');
    if (fab) fab.style.display = '';
    const homeBtn = document.getElementById('globalHomeBtn');
    if (homeBtn) {
      homeBtn.style.display = (name === 'welcome') ? 'none' : '';
    }
    _current = name;
  }

  return {
    /** Switch to a named mode. Calls unmount on previous, mount on next. */
    async switchTo(name, ...args) {
      if (name === _current) return;
      if (_hooks[_current]?.unmount) {
        try { await _hooks[_current].unmount(); } catch(e) { console.warn('unmount error', e); }
      }
      _activate(name);
      if (_hooks[name]?.mount) {
        try { await _hooks[name].mount(...args); } catch(e) { console.warn('mount error', e); }
      }
      // Update body class for any skin-specific CSS
      document.body.className = document.body.className
        .replace(/\bskin-\S+/g, '').trim();
      document.body.classList.add(`skin-${name}`);
      // Re-init Lucide icons for newly visible skin content
      if (window.lucide) { try { lucide.createIcons(); } catch(e) {} }
      console.log(`[ModeManager] → ${name}`);
    },

    /** Register mount/unmount lifecycle hooks for a mode. */
    register(name, { mount, unmount } = {}) {
      _hooks[name] = { mount, unmount };
    },

    /** Returns the name of the currently active mode. */
    current() { return _current; },

    /** True if the given mode is currently active. */
    is(name) { return _current === name; },

    /** Expose skin IDs for debugging. */
    SKIN_IDS,
  };
})();

// ── Bootstrap on DOMContentLoaded ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 1. Activate welcome skin
  document.getElementById('skin-welcome')?.classList.add('active');

  // 2. Hide global Home button on welcome
  const _homeBtn = document.getElementById('globalHomeBtn');
  if (_homeBtn) _homeBtn.style.display = 'none';

  // 3. Lucide icons after skin is visible
  if (window.lucide) { try { lucide.createIcons(); } catch(e) {} }

  // 4. Welcome button handlers — registered HERE so they always run after all
  //    IIFEs have completed and the skin is active in the DOM.
  function _goTo(mode) {
    const wm = document.getElementById('welcomeModel');
    if (wm) {
      // Quick nod: down → up → switch (250ms total)
      wm.setAttribute('camera-orbit', '0deg 98deg auto');       // nod down immediately
      setTimeout(() => wm.setAttribute('camera-orbit', '0deg 62deg auto'),  120);  // nod up
      setTimeout(() => { wm.setAttribute('camera-orbit', '0deg 75deg auto'); ModeManager.switchTo(mode); }, 250);
    } else {
      ModeManager.switchTo(mode);
    }
  }
  const _btns = {
    welcomeBtnList:  'list',
    welcomeBtnGlobe: 'globe',
    welcomeBtnRetro: 'retro',
    welcomeBtnDJ:    'dj',
  };
  Object.entries(_btns).forEach(([id, mode]) => {
    document.getElementById(id)?.addEventListener('click', () => _goTo(mode));
  });

  // 5. Mouse tracking for welcome 3D head — registered after skin is active
  const _wm = document.getElementById('welcomeModel');
  if (_wm) {
    document.addEventListener('mousemove', (e) => {
      if (!ModeManager.is('welcome')) return;
      const x = (e.clientX / window.innerWidth)  * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      _wm.setAttribute('camera-orbit', `${-(x * 30)}deg ${75 - (y * 20)}deg auto`);
    });
    document.addEventListener('touchmove', (e) => {
      if (!ModeManager.is('welcome') || e.touches.length !== 1) return;
      const x = (e.touches[0].clientX / window.innerWidth)  * 2 - 1;
      const y = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
      _wm.setAttribute('camera-orbit', `${-(x * 30)}deg ${75 - (y * 20)}deg auto`);
    }, { passive: true });
  }

  // 6. FAB: initWelcomeScreen IIFE registers the handler — nothing to do here.
  //    (DOMContentLoaded handler removed to avoid double-toggle)

  // Re-register Globe/Retro/DJ skins here (DOMContentLoaded context is reliable)
  ModeManager.register('globe', {
    async mount() {
      // Initialize globe canvas first, then enter fullscreen state
      if (window._showGlobe) await window._showGlobe();
      // enterGlobeFullscreen sets globeIsFullscreen=true, syncs genre/NP, resizes
      if (window._enterGlobeFullscreen) window._enterGlobeFullscreen();
    },
    unmount() {
      if (window._exitGlobeFullscreen) window._exitGlobeFullscreen();
      if (window._globeHide)           window._globeHide();
    }
  });

  ModeManager.register('retro', {
    mount() {
      const btn = document.getElementById('retroExpandBtn');
      if (btn) btn.click();
    },
    unmount() { if (window._exitRetro) window._exitRetro(); }
  });

  ModeManager.register('dj', {
    mount()   { if (window._enterDJ) window._enterDJ(); },
    unmount() { if (window._exitDJ)  window._exitDJ();  }
  });

  // ── Search: call the global function (it's not inside an IIFE wrapper) ────
  setTimeout(() => {
    if (typeof window.searchShoutcastStations === 'function') {
      window.searchShoutcastStations();
    }
  }, 800);

  // Also wire the search button explicitly
  document.getElementById('searchBtn')?.addEventListener('click', () => {
    if (typeof window.searchShoutcastStations === 'function') {
      window.searchShoutcastStations();
    }
  });

  // ── Station row clicks: delegated, uses global selectStation ─────────────
  document.getElementById('stationsList')?.addEventListener('click', (e) => {
    const row = e.target.closest('.station');
    if (!row) return;
    const sel = window.selectStation;
    if (!sel) return;
    const rows = Array.from(document.querySelectorAll('#stationsList .station'));
    const idx  = rows.indexOf(row);
    // Get displayed stations via the IIFE's renderStations closure variable
    // (access via the exposed global function which has closure access)
    if (idx >= 0 && typeof window.displayedStations !== 'undefined') {
      sel(window.displayedStations[idx], idx);
    } else if (idx >= 0) {
      // Fallback: call window._selectStation if available
      if (window._selectStation) window._selectStation(idx);
    }
  }, true);

  // ── DJ logo → welcome ─────────────────────────────────────────────────────
  document.querySelector('.dj-logo-float')?.addEventListener('click', () => {
    ModeManager.switchTo('welcome');
  });

  // ── DJ central HTTPS toggle (affects main filter + both decks) ────────────
  const _djHttpsCenter = document.getElementById('djHttpsCenter');
  if (_djHttpsCenter) {
    _djHttpsCenter.addEventListener('change', () => {
      const checked = _djHttpsCenter.checked;
      const main = document.getElementById('httpsOnlyToggle');
      if (main) { main.checked = checked; main.dispatchEvent(new Event('change')); }
      // Sync per-deck toggles
      ['djHttpsA','djHttpsB'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
      });
      if (window._triggerSearch) window._triggerSearch();
    });
  }

  // ── Welcome head: squish / nod on overlay click ───────────────────────────
  const _wmo = document.getElementById('welcomeModelOverlay');
  const _wmEl = document.getElementById('welcomeModel');
  let _tc = 0, _tt = null, _px = 0, _py = 0, _pulling = false;
  if (_wmo && _wmEl) {
    const _applyTransform = (dx, dy) => {
      const dist = Math.sqrt(dx*dx+dy*dy);
      const clamp = Math.min(dist, 90) / (dist||1);
      const stretch = 1 + (dist/90) * 0.12;
      const squishY = 1 - (dist/90) * 0.08;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      _wmEl.style.transform = `rotate(${angle}deg) scale(${stretch},${squishY}) rotate(${-angle}deg) translate(${dx*clamp}px,${dy*clamp}px)`;
    };
    const _triggerAnim = () => {
      if (!ModeManager.is('welcome')) return;
      _wmEl.classList.remove('squish','wiggle'); void _wmEl.offsetWidth;
      if (++_tc >= 3) { _tc = 0; _wmEl.classList.add('wiggle'); }
      else { if (_tt) clearTimeout(_tt); _tt = setTimeout(() => _tc=0, 600); _wmEl.classList.add('squish'); }
      _wmEl.addEventListener('animationend', () => _wmEl.classList.remove('squish','wiggle'), { once: true });
    };
    _wmo.addEventListener('pointerdown', (e) => {
      if (!ModeManager.is('welcome')) return;
      _pulling = true; _px = e.clientX; _py = e.clientY; _wmo.classList.add('pulling');
    });
    document.addEventListener('pointermove', (e) => {
      if (!_pulling) return;
      _applyTransform(e.clientX - _px, e.clientY - _py);
    });
    document.addEventListener('pointerup', (e) => {
      if (!_pulling) return;
      const dist = Math.sqrt((e.clientX-_px)**2 + (e.clientY-_py)**2);
      _pulling = false; _wmo.classList.remove('pulling');
      _wmEl.classList.add('snapping'); _wmEl.style.transform = '';
      if (dist > 12) {
        try {
          const ac = new (window.AudioContext||window.webkitAudioContext)();
          const o = ac.createOscillator(), g = ac.createGain();
          o.type='sine'; o.frequency.setValueAtTime(420,ac.currentTime);
          o.frequency.exponentialRampToValueAtTime(80,ac.currentTime+0.35);
          g.gain.setValueAtTime(0.28,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.45);
          o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+0.45);
          setTimeout(()=>ac.close(),600);
        } catch(e){}
      }
      _wmEl.addEventListener('transitionend', () => _wmEl.classList.remove('snapping'), { once: true });
      if (dist < 15) _triggerAnim();
    });
  }

  // 7. Settings / Tools panel open-close
  const _settingsPanel  = document.getElementById('settingsPanel');
  const _toolsPanel     = document.getElementById('toolsPanel');
  const _overlay        = document.getElementById('settingsOverlay');
  function _openPanel(panel) {
    if (!panel || !_overlay) return;
    panel.classList.add('open');
    _overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function _closePanel(panel) {
    if (!panel || !_overlay) return;
    panel.classList.remove('open');
    _overlay.classList.remove('show');
    document.body.style.overflow = '';
  }
  document.getElementById('settingsBtn')?.addEventListener('click', () => _openPanel(_settingsPanel));
  document.getElementById('closeSettings')?.addEventListener('click', () => _closePanel(_settingsPanel));
  document.getElementById('toolsBtn')?.addEventListener('click', () => _openPanel(_toolsPanel));
  document.getElementById('closeTools')?.addEventListener('click', () => _closePanel(_toolsPanel));
  _overlay?.addEventListener('click', () => { _closePanel(_settingsPanel); _closePanel(_toolsPanel); });

  // 8. Home button → welcome (definitive handler)
  document.getElementById('globalHomeBtn')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    ModeManager.switchTo('welcome');
  });

  // 6. Header/logo clicks → welcome
  const _logoIds = ['headerLogo'];
  _logoIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.cursor = 'pointer'; el.addEventListener('click', () => ModeManager.switchTo('welcome')); }
  });
  const _retroLogo = document.querySelector('.retro-logo-icon');
  if (_retroLogo) { _retroLogo.style.cursor = 'pointer'; _retroLogo.addEventListener('click', () => ModeManager.switchTo('welcome')); }
  const _gfsBrandImg = document.querySelector('#gfsBrand img');
  if (_gfsBrandImg) { _gfsBrandImg.style.cursor = 'pointer'; _gfsBrandImg.addEventListener('click', () => ModeManager.switchTo('welcome')); }
});

    // --- GLOBALE VARIABLEN ---
    const allStations = [];
    let sortedStations = [];   // sorted/filtered view of allStations (never mutates allStations)
    let displayedStations = [];
    // Cached theme colors – updated in applyTheme/applyCustomTheme so the
    // 60 fps draw() loop never touches getComputedStyle.
    let cachedBgColor     = '';
    let cachedAccentColor = '';

    // ── Recording state ───────────────────────────────────────────────────────
    let mediaRecDest      = null;  // MediaStreamDestination (created in initAudioContext)
    let mediaRecorder     = null;  // active MediaRecorder instance
    let recChunks         = [];    // accumulated Blob chunks for current recording
    let recMode           = 'manual'; // 'manual' | 'autosplit'
    let recStartTime      = null;  // Date.now() when current session started
    let recTimerInterval  = null;  // interval for the clock display
    let recTitleAtStart   = '';    // metadata at the start of the current session
    let recPendingSplit   = false; // true when autosplit triggered a stop-and-restart
    let favorites = JSON.parse(localStorage.getItem("brummiesFavorites") || "[]");
    let favoriteStationsData = JSON.parse(localStorage.getItem("brummiesFavoritesData") || "{}");
    let historyData = JSON.parse(localStorage.getItem("brummiesHistory") || "[]");
    let listeningStats = JSON.parse(localStorage.getItem("brummiesListeningStats") || "{}");
    let currentStation = null;
    let currentStationIndex = -1;
    let currentSort = ["distance"];
    function getStationLimit() {
      return parseInt(localStorage.getItem('brummiesStationLimit') || '300');
    }
    let displayLimit = getStationLimit();
    let showOnlyFavorites = false;
    let userLocation = null;
    let manualLocation = null;
    let shuffleTimer = null;
    let shuffleActive = false;
    let sleepTimer = null;
    let sleepActive = false;
    let historyView = "stations";
    let currentSessionStart = null;
    let audioContext = null;
    let analyser = null;
    let source = null;
    let filters = [];
    let visualizerActive = false;
    let metadataTimer = null;
    let currentMetadata = "";
    
    // --- DATENVERBRAUCH ---
    let dataUsage = JSON.parse(localStorage.getItem("brummiesDataUsage") || "[]");
    let currentSessionData = 0;
    let dataTrackingInterval = null;
    let currentDataPeriod = "1h";
    
    const countryCoords = {
      "DE": { lat: 51.1657, lon: 10.4515, name: "Deutschland" },
      "AT": { lat: 47.5162, lon: 14.5501, name: "Österreich" },
      "CH": { lat: 46.8182, lon: 8.2275, name: "Schweiz" },
      "FR": { lat: 46.2276, lon: 2.2137, name: "Frankreich" },
      "UK": { lat: 55.3781, lon: -3.4360, name: "UK" },
      "US": { lat: 37.0902, lon: -95.7129, name: "USA" }
    };
    
    const subgenreMap = {
      "rock":       ["classic rock", "hard rock", "soft rock", "alternative", "indie", "progressive", "punk"],
      "metal":      ["heavy metal", "death metal", "black metal", "thrash metal", "metalcore", "power metal", "doom metal"],
      "pop":        ["pop rock", "synth pop", "indie pop", "electropop", "dance pop", "k-pop", "r&b"],
      "classic":    ["classical", "baroque", "romantic", "opera", "chamber", "symphony", "choral"],
      "electronic": ["techno", "house", "trance", "drum and bass", "ambient", "dubstep", "electro"],
      "jazz":       ["smooth jazz", "bebop", "swing", "fusion", "free jazz", "blues", "soul"]
    };
    // Maximum number of sub-genre slots (fixed across all band-button genres)
    const MAX_SUB_BTNS = Math.max(...Object.values(subgenreMap).map(a => a.length));
    
    const eqPresets = {
      flat: [0, 0, 0, 0, 0],
      rock: [4, 2, -1, 2, 4],
      metal: [6, 3, -2, 3, 6],
      bass: [8, 4, 0, -2, -2]
    };
    
    // EQ Preset Buttons – immer aktiv, auch vor AudioContext-Init
    document.addEventListener("DOMContentLoaded", () => {
      document.querySelectorAll("#eqPresets button").forEach(btn => {
        btn.addEventListener("click", () => {
          const preset = btn.dataset.preset;
          const values = eqPresets[preset];
          if (!values) return;
          values.forEach((value, index) => {
            const slider = document.querySelector(`#eq input[data-index="${index}"]`);
            if (slider) slider.value = value;
            if (filters[index]) filters[index].gain.value = value;
            const valueDisplay = document.querySelector(`.eq-value[data-index="${index}"]`);
            if (valueDisplay) valueDisplay.textContent = `${value > 0 ? '+' : ''}${value} dB`;
          });
          localStorage.setItem('brummiesEqValues', JSON.stringify(values));
        });
      });

      // Restore saved EQ values
      const savedEq = JSON.parse(localStorage.getItem('brummiesEqValues') || 'null');
      if (savedEq) {
        savedEq.forEach((val, idx) => {
          const slider = document.querySelector(`#eq input[data-index="${idx}"]`);
          const display = document.querySelector(`.eq-value[data-index="${idx}"]`);
          if (slider) slider.value = val;
          if (display) display.textContent = `${val > 0 ? '+' : ''}${val} dB`;
        });
      }
    });
    
    // --- INTERNATIONALIZATION ---
    let currentLang = localStorage.getItem('brummiesLanguage') || null; // null = auto-detect
    
    // --- AUTO-TRANSLATION ENGINE (MyMemory API - Free, no key needed) ---
    // All UI strings defined once in German (source language)
    // Everything else is translated automatically via API
    
    const sourceTexts = {
      // Headers
      'h2-search': 'Radiosender',
      'h2-nowplaying': 'Now Playing',
      'h2-history': 'Verlauf & Statistik',
      'h2-shuffle': 'Auto-Shuffle',
      'h2-sleep': 'Sleep Timer',
      'h2-equalizer': 'Equalizer & Visualizer',
      'h2-settings': 'Einstellungen',
      
      // Labels
      'label-search': 'Sendersuche',
      'label-genre': 'Hauptgenre',
      'label-subgenre': 'Untergenre',
      'label-country': 'Land',
      'label-location': 'Standort',
      'label-volume': 'Lautstärke',
      'label-shuffle-interval': 'Intervall (Minuten)',
      'label-shuffle-gap': 'Pause zwischen Sendern (Sekunden)',
      'label-sleep-minutes': 'Minuten',
      'label-sleep-time': 'Uhrzeit',
      'sleep-mode-minutes': '⏱️ Minuten',
      'sleep-mode-clock': '🕐 Uhrzeit',
      
      // Buttons
      'btn-search': '🔍 Suchen',
      'btn-favorites': '⭐ Favoriten',
      'btn-all': 'Alle anzeigen',
      'btn-reset': '↺ Reset',
      'btn-prev': '⏮ Zurück',
      'btn-next': '⏭ Weiter',
      'btn-play': '▶ Play',
      'btn-pause': '⏸ Pause',
      'btn-copy': '📋 Info kopieren',
      'btn-copied': '✅ Kopiert!',
      'btn-shuffle-start': '🔀 Shuffle starten',
      'btn-shuffle-stop': '⏹ Shuffle stoppen',
      'btn-sleep-start': '⏰ Timer starten',
      'btn-sleep-stop': '⏹ Timer stoppen',
      'btn-load-more': '+20',
      'btn-clear-history': '🗑️ Verlauf löschen',
      'btn-clear-stats': '🗑️ Statistik löschen',
      'btn-install': '📲 App installieren',
      'btn-donate': '☕ Buy me a Coffee',
      'btn-close': '✕',
      
      // Select options
      'opt-all-genres': 'Alle Genres',
      'opt-all-countries': 'Alle Länder',
      'opt-auto': 'Automatisch',
      'opt-none': 'Keine',
      'opt-all': 'Alle',
      
      // Sort buttons (tooltips/aria-labels would use these)
      'sort-favorites': 'Favoriten',
      'sort-distance': 'Distanz',
      'sort-listeners': 'Hörer',
      'sort-bitrate': 'Bitrate',
      'sort-name': 'Name',
      
      // Status & Messages
      'sort-label': 'Sortierung:',
      'loading': 'Klicke "Suchen" um zu starten...',
      'shuffle-active': '✅ Shuffle aktiv',
      'sleep-active': 'Sleep Timer aktiv',
      'sleep-ends-at': 'Endet um',
      'no-gps': 'Keine GPS-Daten',
      'search-placeholder': "z.B. 'Rock', 'Metal'...",
      'waiting-metadata': 'Warte auf Stream-Metadaten...',
      'buffering': '🔄 Buffering...',
      'reconnecting': '🔄 Neuverbindung',
      'no-connection': '📡 Keine Verbindung',
      'stream-error': '❌ Stream-Fehler',
      'connection-error': 'Verbindungsfehler',
      'stations-found': 'Sender gefunden',
      'no-stations': 'Keine Sender gefunden. Versuche andere Filter.',
      'current-session': 'Aktuelle Session',
      
      // History & Stats
      'history-tab-stations': 'Sender',
      'history-tab-sessions': 'Sitzungen',
      'no-history': 'Kein Verlauf vorhanden',
      'no-stats': 'Keine Statistik vorhanden',
      'total-time': 'Gesamt',
      'sessions': 'Sitzungen',
      
      // EQ Presets
      'preset-flat': 'Flat',
      'preset-rock': 'Rock',
      'preset-metal': 'Metal',
      'preset-bass': 'Bass',
      
      // Settings sections
      'settings-language': 'Sprache / Language',
      'settings-theme': 'Theme',
      'settings-data': 'Datenverbrauch',
      'settings-support': 'Unterstützung',
      'settings-about': 'Über diese App',
      
      // Settings texts
      'language-select': 'Sprache wählen / Select language:',
      'language-info': 'Die Sprache wird automatisch erkannt basierend auf deinem Browser.',
      'theme-info': 'Wähle ein Theme das zu deinem Musikgeschmack passt.',
      'data-total': 'Gesamt',
      'data-average': 'Durchschnitt/Tag',
      'data-reset': '🗑️ Daten zurücksetzen',
      'data-reset-confirm': 'Datenverbrauch-Historie wirklich löschen?',
      'support-text': 'Diese App ist kostenlos und Open Source. Wenn sie dir gefällt, freue ich mich über eine kleine Unterstützung!',
      'donate-info': 'Donations helfen bei der Weiterentwicklung und dem Hosting.',
      'about-text': 'Eine Web-App zum Streamen von Radio-Sendern weltweit.',
      'about-source': 'Datenquelle: Radio Browser API',
      'about-features': '30,000+ Sender · Kostenlos · Keine Werbung',
      
      // Sync (new)
      'sync-title': '☁️ Cloud Sync',
      'sync-info': 'Synchronisiere deine Favoriten und deinen Verlauf über GitHub.',
      'sync-connect': '🔗 Mit GitHub verbinden',
      'sync-disconnect': '🔓 Trennen',
      'sync-status-connected': 'Verbunden als',
      'sync-status-disconnected': 'Nicht verbunden',
      'sync-last-sync': 'Letzte Sync:',
      'sync-now': '🔄 Jetzt synchronisieren',
      'sync-paste-token': '📋 Token einfügen',
      'sync-token-pasted': '✅ Eingefügt!',
      'sync-success': '✅ Erfolgreich synchronisiert!',
      'sync-error': '❌ Sync-Fehler',
    };
    
    // Translation cache: { 'de|en': { 'Suchen': 'Search', ... } }
    const translationCache = JSON.parse(localStorage.getItem('brummiesTranslations') || '{}');
    
    // MyMemory API - Free, 1000 requests/day, no key needed
    async function translateText(text, targetLang) {
      if (targetLang === 'de') return text; // Source is German
      
      const cacheKey = `de|${targetLang}`;
      if (!translationCache[cacheKey]) translationCache[cacheKey] = {};
      if (translationCache[cacheKey][text]) return translationCache[cacheKey][text];
      
      try {
        // Strip emoji for translation, re-add after
        const emojiMatch = text.match(/^([^\w\s]+\s?)/);
        const emoji = emojiMatch ? emojiMatch[1] : '';
        const cleanText = emoji ? text.slice(emoji.length) : text;
        
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=de|${targetLang}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.responseStatus === 200) {
          const translated = emoji + data.responseData.translatedText;
          translationCache[cacheKey][text] = translated;
          // Save cache to localStorage
          localStorage.setItem('brummiesTranslations', JSON.stringify(translationCache));
          return translated;
        }
      } catch (err) {
        console.warn('Translation failed for:', text, err);
      }
      return text; // Fallback to original
    }
    
    // Translate all UI texts at once (batch to save API calls)
    async function applyTranslations(targetLang) {
      if (targetLang === 'de') {
        // Restore German (source)
        applyTextToUI(sourceTexts);
        return;
      }
      
      const statusEl = document.getElementById('lang-translation-status');
      if (statusEl) statusEl.textContent = '⏳ Übersetze...';
      
      // Check cache first
      const cacheKey = `de|${targetLang}`;
      const cached = translationCache[cacheKey] || {};
      const textsToTranslate = Object.entries(sourceTexts).filter(([k, v]) => !cached[v]);
      
      // Translate missing texts
      if (textsToTranslate.length > 0) {
        await Promise.allSettled(
          textsToTranslate.map(async ([key, text]) => {
            const translated = await translateText(text, targetLang);
            cached[text] = translated;
          })
        );
        translationCache[cacheKey] = cached;
        localStorage.setItem('brummiesTranslations', JSON.stringify(translationCache));
      }
      
      // Build translated map
      const translated = {};
      Object.entries(sourceTexts).forEach(([key, text]) => {
        translated[key] = cached[text] || text;
      });
      
      applyTextToUI(translated);
      if (statusEl) statusEl.textContent = '✅';
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
    }
    
    // Helper to set header/option text while preserving Lucide icons
    function updateHeaderWithIcon(h, newText) {
      const icon = h.querySelector('svg.lucide, i[data-lucide]');
      h.innerHTML = '';
      if (icon) {
        h.appendChild(icon);
        h.appendChild(document.createTextNode(' ' + newText));
      } else {
        h.textContent = newText;
      }
    }

    // Apply translated texts to DOM
    function applyTextToUI(texts) {
      // ========== HEADERS ==========
      document.querySelectorAll('h2, h3').forEach(h => {
        const t = h.textContent.trim();
        
        // H2 Headers
        if (t.includes('Sendersuche') || t.includes('Station') || t.includes('Search') || t.includes('Recherche')) {
          updateHeaderWithIcon(h, texts['h2-search']);
        } else if (t.includes('Now Playing')) {
          updateHeaderWithIcon(h, texts['h2-nowplaying']);
        } else if (t.includes('Verlauf') || t.includes('History') || t.includes('Statistik') || t.includes('Statistics')) {
          updateHeaderWithIcon(h, texts['h2-history']);
        } else if (t.includes('Shuffle')) {
          updateHeaderWithIcon(h, texts['h2-shuffle']);
        } else if (t.includes('Sleep') || t.includes('Timer')) {
          updateHeaderWithIcon(h, texts['h2-sleep']);
        } else if (t.includes('EQUALIZER') || t.includes('VISUALIZER') || t.includes('Equalizer')) {
          updateHeaderWithIcon(h, texts['h2-equalizer']);
        } else if (t.includes('Einstellungen') || t.includes('Settings')) {
          updateHeaderWithIcon(h, texts['h2-settings']);
        }
        
        // H3 Settings Headers
        else if (t.includes('Sprache') || t.includes('Language')) {
          updateHeaderWithIcon(h, texts['settings-language']);
        } else if (t.includes('Theme')) {
          updateHeaderWithIcon(h, texts['settings-theme']);
        } else if (t.includes('Cloud Sync')) {
          updateHeaderWithIcon(h, 'Cloud Sync');
        } else if (t.includes('Datenverbrauch') || t.includes('Data')) {
          updateHeaderWithIcon(h, texts['settings-data']);
        } else if (t.includes('Unterstützung') || t.includes('Support')) {
          updateHeaderWithIcon(h, texts['settings-support']);
        } else if (t.includes('Über') || t.includes('About')) {
          updateHeaderWithIcon(h, texts['settings-about']);
        }
      });
      
      // ========== LABELS ==========
      document.querySelectorAll('label').forEach(label => {
        const t = label.textContent.trim();
        if (t.includes('Sendersuche') || t.includes('Station')) {
          label.textContent = texts['label-search'];
        } else if (t.includes('Hauptgenre') || t.includes('Main Genre') || t.includes('Genre principal')) {
          label.textContent = texts['label-genre'];
        } else if (t.includes('Untergenre') || t.includes('Subgenre')) {
          label.textContent = texts['label-subgenre'];
        } else if (t.includes('Land') || t.includes('Country') || t.includes('Pays') || t.includes('País')) {
          label.textContent = texts['label-country'];
        } else if (t.includes('Standort') || t.includes('Location') || t.includes('Emplacement')) {
          label.textContent = texts['label-location'];
        } else if (t.includes('Lautstärke') || t.includes('Volume')) {
          label.textContent = texts['label-volume'];
        } else if (t.includes('Intervall') || t.includes('Interval')) {
          label.textContent = texts['label-shuffle-interval'];
        } else if (t.includes('Pause zwischen') || t.includes('Gap')) {
          label.textContent = texts['label-shuffle-gap'];
        } else if (t.includes('Minuten') && !label.textContent.includes('Intervall')) {
          label.textContent = texts['label-sleep-minutes'];
        } else if (t.includes('Uhrzeit') || t.includes('Time')) {
          label.textContent = texts['label-sleep-time'];
        }
      });
      
      // ========== BUTTONS ==========
      const searchBtn = document.getElementById('searchBtn');
      if (searchBtn) searchBtn.textContent = texts['btn-search'];
      
      const showFavBtn = document.getElementById('showFavoritesBtn');
      if (showFavBtn) {
        const isFavMode = showFavBtn.dataset.favmode === 'true';
        showFavBtn.textContent = isFavMode ? texts['btn-all'] : texts['btn-favorites'];
      }
      
      const resetBtn = document.getElementById('resetFilters');
      if (resetBtn) resetBtn.textContent = texts['btn-reset'];
      
      const prevBtn = document.getElementById('prevBtn');
      if (prevBtn && !prevBtn.disabled) prevBtn.textContent = texts['btn-prev'];
      
      const nextBtn = document.getElementById('nextBtn');
      if (nextBtn && !nextBtn.disabled) nextBtn.textContent = texts['btn-next'];
      
      const playBtn = document.getElementById('playBtn');
      if (playBtn) {
        // Icon-only button – no text translation needed
        setIcon(playBtn, coverEl.classList.contains('playing') ? 'pause' : 'play');
      }
      
      // search button is icon-only, no translation needed
      
      const shuffleToggle = document.getElementById('shuffleToggle');
      if (shuffleToggle) {
        setIcon(shuffleToggle, shuffleActive ? 'square' : 'play');
      }
      
      const sleepToggle = document.getElementById('sleepToggle');
      if (sleepToggle) {
        setIcon(sleepToggle, sleepActive ? 'square' : 'play');
      }
      
      // Sleep mode toggle buttons
      const sleepModeButtons = document.querySelectorAll('.sleep-mode-btn');
      sleepModeButtons.forEach(btn => {
        if (btn.dataset.mode === 'minutes') {
          btn.textContent = texts['sleep-mode-minutes'];
        } else if (btn.dataset.mode === 'clock') {
          btn.textContent = texts['sleep-mode-clock'];
        }
      });
      
      const loadMoreBtn = document.getElementById('loadMoreBtn');
      if (loadMoreBtn) loadMoreBtn.textContent = texts['btn-load-more'];
      
      const installBtn = document.getElementById('installBtn');
      if (installBtn) installBtn.textContent = texts['btn-install'];
      
      const donateBtn = document.getElementById('donateBtn');
      if (donateBtn) {
        const donateText = currentLang === 'de' ? 'Support auf Ko-Fi' : 'Support on Ko-Fi';
        donateBtn.innerHTML = `<img src="https://storage.ko-fi.com/cdn/cup-border.png" alt="Ko-Fi" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;">${donateText}`;
      }

      const supportTitle = document.getElementById('lang-support-title');
      if (supportTitle) {
        updateHeaderWithIcon(supportTitle, texts['settings-support']);
      }
      const supportDesc = document.getElementById('lang-support-desc');
      if (supportDesc) {
        supportDesc.textContent = texts['support-text'];
      }
      
      // GitHub Sync buttons
      // EQ Presets
      document.querySelectorAll('.preset-btn, #eqPresets button').forEach(btn => {
        const preset = btn.dataset.preset;
        if (preset === 'flat') btn.textContent = texts['preset-flat'];
        else if (preset === 'rock') btn.textContent = texts['preset-rock'];
        else if (preset === 'metal') btn.textContent = texts['preset-metal'];
        else if (preset === 'bass') btn.textContent = texts['preset-bass'];
      });
      
      // ========== PLACEHOLDERS ==========
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.placeholder = texts['search-placeholder'];
      
      const githubToken = document.getElementById('githubToken');
      if (githubToken) {
        githubToken.placeholder = currentLang === 'de' ? 
          'GitHub Personal Access Token' : 
          'GitHub Personal Access Token';
      }
      
      // ========== SELECT OPTIONS ==========
      const genreSelect = document.getElementById('genreSelect');
      if (genreSelect && genreSelect.options[0]) {
        genreSelect.options[0].textContent = texts['opt-all-genres'];
      }
      
      const cpEl = document.getElementById('countryPlaceholder');
      if (cpEl && texts['opt-all-countries']) cpEl.textContent = texts['opt-all-countries'];
      
      const locationMode = document.getElementById('locationMode');
      if (locationMode) {
        if (locationMode.options[0]) locationMode.options[0].textContent = texts['opt-auto'];
        const noneOpt = Array.from(locationMode.options).find(o => o.value === 'none');
        if (noneOpt) noneOpt.textContent = texts['opt-none'];
      }
      
      const subgenreSelect = document.getElementById('subgenreSelect');
      if (subgenreSelect && subgenreSelect.options[0]) {
        subgenreSelect.options[0].textContent = texts['opt-all'];
      }
      
      // ========== STATUS & MESSAGES ==========
      const sortLabel = document.querySelector('.sort-controls small');
      if (sortLabel) sortLabel.textContent = texts['sort-label'];
      
      const loadingDivs = document.querySelectorAll('.loading');
      loadingDivs.forEach(div => {
        if (!div.style.display || div.style.display !== 'none') {
          div.textContent = texts['loading'];
        }
      });
      
      const shuffleStatus = document.getElementById('shuffleStatus');
      if (shuffleStatus && shuffleActive) {
        shuffleStatus.textContent = texts['shuffle-active'];
      }
      
      const sleepStatus = document.getElementById('sleepStatus');
      if (sleepStatus && sleepActive) {
        const match = sleepStatus.textContent.match(/\d{2}:\d{2}/);
        if (match) {
          sleepStatus.textContent = `${texts['sleep-active']} - ${texts['sleep-ends-at']} ${match[0]}`;
        } else {
          sleepStatus.textContent = texts['sleep-active'];
        }
      }
      
      const stationCount = document.getElementById('stationCount');
      if (stationCount && stationCount.textContent) {
        const count = stationCount.textContent.match(/\d+/);
        if (count) {
          stationCount.textContent = `${count[0]} ${texts['stations-found']}`;
        }
      }
      
      // ========== SETTINGS PANEL ==========
      const langSelectLabel = document.getElementById('lang-select-language');
      if (langSelectLabel) langSelectLabel.textContent = texts['language-select'];
      
      const langInfo = document.getElementById('lang-language-info');
      if (langInfo) langInfo.textContent = texts['language-info'];
      
      const themeInfo = document.getElementById('lang-theme-info');
      if (themeInfo) themeInfo.textContent = texts['theme-info'];
      
      // Data usage
      document.querySelectorAll('.data-usage-label').forEach(label => {
        if (label.textContent.includes('Session') || label.textContent.includes('Aktuelle')) {
          label.textContent = texts['current-session'];
        } else if (label.textContent.includes('Gesamt') || label.textContent.includes('Total')) {
          label.textContent = texts['data-total'];
        } else if (label.textContent.includes('Durchschnitt') || label.textContent.includes('Average')) {
          label.textContent = texts['data-average'];
        }
      });
      
      // Support/About sections
      const supportTexts = document.querySelectorAll('p small');
      supportTexts.forEach(p => {
        const t = p.textContent;
        if (t.includes('kostenlos') || t.includes('Open Source') || t.includes('free')) {
          p.textContent = texts['support-text'];
        } else if (t.includes('Donations') || t.includes('Entwicklung')) {
          p.textContent = texts['donate-info'];
        } else if (t.includes('Radio-Sendern') || t.includes('streaming radio')) {
          p.textContent = texts['about-text'];
        } else if (t.includes('Radio Browser')) {
          p.textContent = texts['about-source'];
        } else if (t.includes('30,000') || t.includes('Stations')) {
          p.textContent = texts['about-features'];
        } else if (t.includes('Favoriten') && t.includes('GitHub') || t.includes('Synchronisiert')) {
          p.textContent = currentLang === 'de' ?
            'Synchronisiert deine Favoriten und deinen Verlauf sicher über GitHub Gists.' :
            'Synchronizes your favorites and history securely via GitHub Gists.';
        }
      });
      
      // GitHub Sync status texts
      const syncStatusText = document.getElementById('syncStatusText');
      if (syncStatusText && syncConfig.token) {
        if (syncStatusText.textContent.includes('Verbunden') || syncStatusText.textContent.includes('Connected')) {
          syncStatusText.textContent = texts['sync-status-connected'];
        }
      } else if (syncStatusText) {
        syncStatusText.textContent = texts['sync-status-disconnected'];
      }
      
      // Language select
      const langSelect = document.getElementById('languageSelect');
      if (langSelect) langSelect.value = currentLang;
    }
    
    // Translation helper - now uses sourceTexts (German = source)
    function t(key) {
      return sourceTexts[key] || key;
    }
    
    // Auto-detect language based on location
    function detectLanguage() {
      // Check if user already set a language manually
      const savedLang = localStorage.getItem('brummiesLanguage');
      if (savedLang) {
        currentLang = savedLang;
        return currentLang;
      }
      
      // Auto-detect based on location mode (country selection)
      const mode = locationMode ? locationMode.value : null;
      const dachCountries = ['DE', 'AT', 'CH'];
      
      if (mode && mode !== 'auto' && mode !== 'none') {
        // Manual location selected → use country code
        currentLang = dachCountries.includes(mode) ? 'de' : 'en';
      } else {
        // Auto or no location → use browser language
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        currentLang = browserLang.startsWith('de') ? 'de' : 'en';
      }
      
      console.log('Auto-detected language:', currentLang, 'based on location:', mode);
      return currentLang;
    }
    
    // Update UI with current language
    function updateLanguageUI() {
      document.documentElement.lang = currentLang;
      
      // Update language select
      const langSelect = document.getElementById('languageSelect');
      if (langSelect) {
        langSelect.value = currentLang;
      }
      
      // updateLanguageUI is called for German only - other languages use applyTranslations API
      if (currentLang === 'de') {
        applyTextToUI(sourceTexts);
        return;
      }
      
      // Update ALL UI text elements based on current language
      
      // Headers (h2)
      const headers = document.querySelectorAll('h2');
      headers.forEach(h2 => {
        const text = h2.textContent.trim();
        if (text.includes('Sendersuche') || text.includes('Search') || text.includes('Station')) {
          updateHeaderWithIcon(h2, currentLang === 'de' ? 'Sendersuche' : 'Station Search');
        } else if (text.includes('Now Playing')) {
          updateHeaderWithIcon(h2, 'Now Playing');
        } else if (text.includes('Verlauf') || text.includes('History')) {
          updateHeaderWithIcon(h2, currentLang === 'de' ? 'Verlauf & Statistik' : 'History & Statistics');
        } else if (text.includes('Shuffle')) {
          updateHeaderWithIcon(h2, 'Auto-Shuffle');
        } else if (text.includes('Sleep') || text.includes('Timer')) {
          updateHeaderWithIcon(h2, 'Sleep Timer');
        } else if (text.includes('Equalizer') || text.includes('EQUALIZER')) {
          updateHeaderWithIcon(h2, 'Equalizer & Visualizer');
        }
      });
      
      // Search input
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.placeholder = currentLang === 'de' ? "z.B. 'Rock', 'Metal'..." : "e.g. 'Rock', 'Metal'...";
      }
      
      // Labels
      document.querySelectorAll('label').forEach(label => {
        const text = label.textContent.trim();
        if (text === 'Sendersuche' || text === 'Station Search') {
          label.textContent = currentLang === 'de' ? 'Sendersuche' : 'Station Search';
        } else if (text === 'Hauptgenre' || text === 'Main Genre') {
          label.textContent = currentLang === 'de' ? 'Hauptgenre' : 'Main Genre';
        } else if (text === 'Untergenre' || text === 'Subgenre') {
          label.textContent = currentLang === 'de' ? 'Untergenre' : 'Subgenre';
        } else if (text === 'Land' || text === 'Country') {
          label.textContent = currentLang === 'de' ? 'Land' : 'Country';
        } else if (text === 'Standort' || text === 'Location') {
          label.textContent = currentLang === 'de' ? 'Standort' : 'Location';
        } else if (text === 'Lautstärke' || text === 'Volume') {
          label.textContent = currentLang === 'de' ? 'Lautstärke' : 'Volume';
        }
      });
      
      // Buttons
      const searchBtn = document.getElementById('searchBtn');
      if (searchBtn) searchBtn.textContent = currentLang === 'de' ? '🔍 Suchen' : '🔍 Search';
      
      const showFavoritesBtn = document.getElementById('showFavoritesBtn');
      if (showFavoritesBtn) {
        const isFavoritesMode = showFavoritesBtn.textContent.includes('Alle') || showFavoritesBtn.textContent.includes('Show all');
        showFavoritesBtn.textContent = isFavoritesMode ?
          (currentLang === 'de' ? 'Alle anzeigen' : 'Show all') :
          (currentLang === 'de' ? '⭐ Favoriten' : '⭐ Favorites');
      }
      
      const resetFilters = document.getElementById('resetFilters');
      if (resetFilters) resetFilters.textContent = '↺ Reset';
      
      const playBtn = document.getElementById('playBtn');
      // Icon-only – managed by setIcon(), no translation needed
      
      const prevBtn = document.getElementById('prevBtn');
      if (prevBtn) prevBtn.textContent = currentLang === 'de' ? '⏮ Zurück' : '⏮ Previous';
      
      const nextBtn = document.getElementById('nextBtn');
      if (nextBtn) nextBtn.textContent = currentLang === 'de' ? '⏭ Weiter' : '⏭ Next';
      
      // search button is icon-only, no translation needed
      
      // Select options
      const genreSelect = document.getElementById('genreSelect');
      if (genreSelect) {
        const selectedValue = genreSelect.value;
        genreSelect.innerHTML = currentLang === 'de' ?
          `<option value="">Alle Genres</option>
           <option value="rock">Rock</option>
           <option value="metal">Metal</option>
           <option value="pop">Pop</option>
           <option value="classic">Classic</option>
           <option value="electronic">Electronic</option>
           <option value="jazz">Jazz</option>` :
          `<option value="">All Genres</option>
           <option value="rock">Rock</option>
           <option value="metal">Metal</option>
           <option value="pop">Pop</option>
           <option value="classic">Classic</option>
           <option value="electronic">Electronic</option>
           <option value="jazz">Jazz</option>`;
        genreSelect.value = selectedValue;
      }
      
      const subgenreSelect = document.getElementById('subgenreSelect');
      if (subgenreSelect && subgenreSelect.options.length === 1) {
        subgenreSelect.options[0].textContent = currentLang === 'de' ? 'Alle' : 'All';
      }
      
      const countryFilter = document.getElementById('countryFilter');
      const cpEl2 = document.getElementById('countryPlaceholder');
      if (cpEl2) cpEl2.textContent = currentLang === 'de' ? 'Alle Länder' : 'All Countries';
      
      const locationMode = document.getElementById('locationMode');
      if (locationMode) {
        const selectedValue = locationMode.value;
        if (currentLang === 'de') {
          locationMode.options[0].textContent = 'Automatisch';
          locationMode.options[7].textContent = 'Keine';
        } else {
          locationMode.options[0].textContent = 'Automatic';
          locationMode.options[7].textContent = 'None';
        }
        locationMode.value = selectedValue;
      }
      
      // Sort controls label
      const sortLabel = document.querySelector('.sort-controls small');
      if (sortLabel) {
        sortLabel.textContent = currentLang === 'de' ? 'Sortierung:' : 'Sort by:';
      }
      
      // Station count
      const stationCount = document.getElementById('stationCount');
      if (stationCount && stationCount.textContent) {
        const match = stationCount.textContent.match(/(\d+)/);
        if (match) {
          const count = match[1];
          stationCount.textContent = currentLang === 'de' ? 
            `${count} Sender` : 
            `${count} stations`;
        }
      }
      
      // Load more button
      const loadMoreBtn = document.getElementById('loadMoreBtn');
      if (loadMoreBtn) {
        loadMoreBtn.textContent = '+20';
      }
      
      // Loading message
      const loadingDiv = document.querySelector('.loading');
      if (loadingDiv && !loadingDiv.style.display) {
        loadingDiv.textContent = currentLang === 'de' ?
          'Klicke "Suchen" um zu starten...' :
          'Click "Search" to start...';
      }
      
      // Shuffle section
      const shuffleToggle = document.getElementById('shuffleToggle');
      if (shuffleToggle) {
        setIcon(shuffleToggle, shuffleActive ? 'square' : 'play');
      }
      
      const shuffleStatus = document.getElementById('shuffleStatus');
      if (shuffleStatus && shuffleStatus.textContent) {
        if (shuffleStatus.textContent.includes('aktiv') || shuffleStatus.textContent.includes('active')) {
          shuffleStatus.textContent = currentLang === 'de' ? '✅ Shuffle aktiv' : '✅ Shuffle active';
        }
      }
      
      // Sleep Timer section
      const sleepToggle = document.getElementById('sleepToggle');
      if (sleepToggle) {
        setIcon(sleepToggle, sleepActive ? 'square' : 'play');
      }
      
      const sleepStatus = document.getElementById('sleepStatus');
      if (sleepStatus && sleepStatus.textContent) {
        if (sleepStatus.textContent.includes('aktiv') || sleepStatus.textContent.includes('active')) {
          // Keep the dynamic content but translate the "active" part
          const match = sleepStatus.textContent.match(/(.+)(aktiv|active)/);
          if (match) {
            sleepStatus.textContent = match[1] + (currentLang === 'de' ? 'aktiv' : 'active');
          }
        }
      }
      
      // Equalizer presets
      document.querySelectorAll('.preset-btn').forEach(btn => {
        const text = btn.textContent.trim().toLowerCase();
        if (text === 'flat') btn.textContent = 'Flat';
        else if (text === 'rock') btn.textContent = 'Rock';
        else if (text === 'metal') btn.textContent = 'Metal';
        else if (text === 'bass') btn.textContent = 'Bass';
      });
      
      // Settings Panel
      const langSettingsLanguage = document.getElementById('lang-settings-language');
      const langSelectLanguage = document.getElementById('lang-select-language');
      const langLanguageInfo = document.getElementById('lang-language-info');
      const langThemeInfo = document.getElementById('lang-theme-info');
      const langStationLimitTitle = document.getElementById('lang-station-limit-title');
      const langStationLimitDesc = document.getElementById('lang-station-limit-desc');
      
      if (langSettingsLanguage) {
        updateHeaderWithIcon(langSettingsLanguage, currentLang === 'de' ? 'Sprache / Language' : 'Language / Sprache');
      }
      if (langSelectLanguage) langSelectLanguage.textContent = 'Sprache wählen / Select language:';
      if (langStationLimitTitle) {
        langStationLimitTitle.textContent = currentLang === 'de' ? 'Max. angezeigte Sender' : 'Max displayed stations';
      }
      if (langStationLimitDesc) {
        langStationLimitDesc.textContent = currentLang === 'de' ?
          'Begrenzt die Anzahl der geladenen Sender im DJ-Pult und in den Listen.' :
          'Limits the number of loaded stations in the DJ Booth and lists.';
      }
      
      if (langLanguageInfo) {
        langLanguageInfo.textContent = currentLang === 'de' ?
          'Die Sprache wird automatisch erkannt basierend auf deinem Browser.' :
          'Language is automatically detected based on your browser.';
      }
      
      if (langThemeInfo) {
        langThemeInfo.textContent = currentLang === 'de' ?
          'Wähle ein Theme das zu deinem Musikgeschmack passt.' :
          'Choose a theme that matches your musical taste.';
      }

      // Standalone support block
      const supportTitle = document.getElementById('lang-support-title');
      if (supportTitle) {
        updateHeaderWithIcon(supportTitle, currentLang === 'de' ? 'Unterstützung' : 'Support');
      }
      const supportDesc = document.getElementById('lang-support-desc');
      if (supportDesc) {
        supportDesc.textContent = currentLang === 'de' ?
          'Diese App ist kostenlos und Open Source. Wenn sie dir gefällt, freue ich mich über eine kleine Unterstützung!' :
          'This app is free and open source. If you like it, I would appreciate a little support!';
      }
      const donateBtn = document.getElementById('donateBtn');
      if (donateBtn) {
        const donateText = currentLang === 'de' ? 'Support auf Ko-Fi' : 'Support on Ko-Fi';
        donateBtn.innerHTML = `<img src="https://storage.ko-fi.com/cdn/cup-border.png" alt="Ko-Fi" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;">${donateText}`;
      }
      
      console.log('Complete UI translated to:', currentLang);
    }

    // --- DOM ELEMENTE ---
    const stationsListEl = document.getElementById("stationsList");
    const audioEl = document.getElementById("radioAudio");
    const coverEl = document.getElementById("cover");
    const stationNameEl = document.getElementById("stationName");
    const stationInfoEl = document.getElementById("stationInfo");
    const playBtn = document.getElementById("playBtn");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const volumeRange = document.getElementById("volumeRange");
    const volumeValue = document.getElementById("volumeValue");
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchInput");
    const resetFiltersBtn = document.getElementById("resetFilters");
    const showFavoritesBtn = document.getElementById("showFavoritesBtn");
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    const stationCountEl = document.getElementById("stationCount");
    const historyEl = document.getElementById("history");
    const listeningStatsEl = document.getElementById("listeningStats");
    const genreSelect = document.getElementById("genreSelect");
    const subgenreSelect = document.getElementById("subgenreSelect");
    // ── Country multi-select state ────────────────────────────────────────────
    let selectedCountries = new Set();

    const countryFilterWrapper = document.getElementById('countryFilterWrapper');
    const countrySelectedEl    = document.getElementById('countrySelected');
    const countryPlaceholder   = document.getElementById('countryPlaceholder');
    const countryDropdown      = document.getElementById('countryDropdown');
    const countrySearchEl      = document.getElementById('countrySearch');
    const countryListEl        = document.getElementById('countryList');

    // Legacy alias so old code that checks countryFilter still compiles
    // (we replace all .value usages below, but the variable is reassigned)
    const countryFilter = { get value() { return selectedCountries.size === 1 ? [...selectedCountries][0] : ''; } };

    function renderCountryTags() {
      // Remove old tags (keep placeholder span)
      countrySelectedEl.querySelectorAll('.country-tag').forEach(t => t.remove());
      if (selectedCountries.size === 0) {
        countryPlaceholder.style.display = '';
      } else {
        countryPlaceholder.style.display = 'none';
        selectedCountries.forEach(c => {
          const tag = document.createElement('span');
          tag.className = 'country-tag';
          tag.textContent = c;
          const rm = document.createElement('button');
          rm.className = 'country-tag-remove';
          rm.innerHTML = '×';
          rm.title = 'Entfernen';
          rm.addEventListener('click', e => {
            e.stopPropagation();
            selectedCountries.delete(c);
            renderCountryTags();
            syncCountryCheckboxes();
            syncQuickButtons();
            sortAndRenderStations();
          });
          tag.appendChild(rm);
          countrySelectedEl.appendChild(tag);
        });
      }
    }

    function syncCountryCheckboxes() {
      countryListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = selectedCountries.has(cb.value);
      });
    }

    function syncQuickButtons() {
      // Map display label → actual country name stored in data
      document.querySelectorAll('.country-quickrow button').forEach(btn => {
        btn.classList.toggle('active', selectedCountries.has(btn.dataset.country));
      });
    }

    function toggleCountry(name) {
      if (selectedCountries.has(name)) selectedCountries.delete(name);
      else selectedCountries.add(name);
      renderCountryTags();
      syncCountryCheckboxes();
      syncQuickButtons();
      sortAndRenderStations();
    }

    function getSelectedCountries() { return [...selectedCountries]; }

    function setSelectedCountries(arr) {
      selectedCountries = new Set(arr || []);
      renderCountryTags();
      syncCountryCheckboxes();
      syncQuickButtons();
    }

    // Open / close dropdown
    countrySelectedEl.addEventListener('click', () => {
      const isOpen = !countryDropdown.hidden;
      countryDropdown.hidden = isOpen;
      countryFilterWrapper.classList.toggle('open', !isOpen);
      if (!isOpen) { countrySearchEl.value = ''; filterCountryList(''); countrySearchEl.focus(); }
    });

    document.addEventListener('click', e => {
      if (!countryFilterWrapper.contains(e.target)) {
        countryDropdown.hidden = true;
        countryFilterWrapper.classList.remove('open');
      }
    });

    // Quick-select buttons
    document.querySelectorAll('.country-quickrow button').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        toggleCountry(btn.dataset.country);
      });
    });

    // Search filter inside dropdown
    countrySearchEl.addEventListener('input', () => filterCountryList(countrySearchEl.value));

    function filterCountryList(query) {
      const q = query.toLowerCase();
      countryListEl.querySelectorAll('label').forEach(label => {
        label.style.display = label.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }
    const locationMode = document.getElementById("locationMode");
    const locationStatus = document.getElementById("locationStatus");
    const shuffleToggle = document.getElementById("shuffleToggle");
    const shuffleStatusEl = document.getElementById("shuffleStatus");
    const sleepToggle = document.getElementById("sleepToggle");
    const sleepStatusEl = document.getElementById("sleepStatus");
    const nowPlayingTextEl = document.getElementById("nowPlayingText");
    const copyNowPlayingBtn = document.getElementById("searchNowPlayingBtn");

    // ── setIcon helper: sets a lucide icon on a button without text ──────────
    function setIcon(btn, iconName) {
      btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
    }

    // --- MOBILE STREAMING OPTIMIZATIONS ---
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 3;
    let reconnectTimeout = null;
    let wakeLock = null;
    let isBuffering = false;
    let heartbeatInterval = null;
    let lastPlaybackTime = 0;

    // --- DEAD STATION TRACKING ---
    // Stations that have failed to play this session.
    // Used by skipToNextWorking() to avoid retrying broken streams.
    const deadStations = new Set();
    let playStartTimeout = null;        // detects "stream never starts"
    let autoSkipDead = (localStorage.getItem('brummies_autoSkipDead') !== '0');  // default ON

    function clearPlayStartTimeout() {
      if (playStartTimeout) { clearTimeout(playStartTimeout); playStartTimeout = null; }
    }

    function markStationDeadAndSkip(reason) {
      if (!currentStation) return;
      console.warn(`[Dead Station] ${currentStation.name}: ${reason}`);
      deadStations.add(currentStation.id);
      if (autoSkipDead) {
        skipToNextWorking();
      } else {
        stationInfoEl.textContent = '❌ Sender nicht erreichbar';
      }
    }

    function skipToNextWorking() {
      if (!displayedStations || displayedStations.length === 0) {
        stationInfoEl.textContent = '❌ Keine Sender verfügbar';
        return;
      }
      const startIdx = (currentStationIndex >= 0 ? currentStationIndex + 1 : 0);
      // Try up to one full pass through the list
      for (let i = 0; i < displayedStations.length; i++) {
        const idx = (startIdx + i) % displayedStations.length;
        const candidate = displayedStations[idx];
        if (!candidate || !candidate.streamUrl) continue;
        if (deadStations.has(candidate.id)) continue;
        if (currentStation && candidate.id === currentStation.id) continue;
        console.log('[Auto-skip] Trying next working station:', candidate.name);
        stationInfoEl.textContent = `⏭ Wechsle zu: ${candidate.name}`;
        selectStation(candidate, idx);
        // Drive the tuner knob visually if tuner view is active
        if (window._tunerGoTo) window._tunerGoTo(idx);
        return;
      }
      // Nothing left
      stationInfoEl.textContent = '❌ Keine erreichbaren Sender mehr';
      console.warn('[Auto-skip] All stations exhausted');
    }

    // Expose so settings UI can toggle
    window._setAutoSkipDead = (enabled) => {
      autoSkipDead = !!enabled;
      localStorage.setItem('brummies_autoSkipDead', enabled ? '1' : '0');
    };
    window._getAutoSkipDead = () => autoSkipDead;

    // --- SUBGENRE UPDATE ---
    genreSelect.addEventListener("change", () => {
      const genre = genreSelect.value;
      subgenreSelect.innerHTML = '<option value="">Alle</option>';
      
      if (genre && subgenreMap[genre]) {
        subgenreMap[genre].forEach(sub => {
          const option = document.createElement("option");
          option.value = sub;
          option.textContent = sub.charAt(0).toUpperCase() + sub.slice(1);
          subgenreSelect.appendChild(option);
        });
      }
      
      // Automatisch suchen wenn bereits Sender geladen
      if (allStations.length > 0) {
        searchShoutcastStations();
      }
    });

    // --- LOCATION HANDLING ---
    locationMode.addEventListener("change", () => {
      const mode = locationMode.value;
      
      if (mode === "auto") {
        getUserLocation();
      } else if (mode === "none") {
        userLocation = null;
        manualLocation = null;
        locationStatus.textContent = "🚫";
        if (allStations.length > 0) {
          calculateAllDistances();
          sortAndRenderStations();
        }
      } else {
        const coords = countryCoords[mode];
        if (coords) {
          manualLocation = { lat: coords.lat, lon: coords.lon, country: mode };
          userLocation = manualLocation;
          locationStatus.textContent = `📍 ${coords.name}`;
          if (allStations.length > 0) {
            calculateAllDistances();
            sortAndRenderStations();
          }
        }
      }
    });

    function getUserLocation() {
      if (navigator.geolocation) {
        locationStatus.textContent = "🔄";
        navigator.geolocation.getCurrentPosition(
          (position) => {
            userLocation = {
              lat: position.coords.latitude,
              lon: position.coords.longitude
            };
            manualLocation = null;
            locationStatus.textContent = "✓ GPS";
            console.log("GPS:", userLocation);
            if (allStations.length > 0) {
              calculateAllDistances();
              sortAndRenderStations();
            }
          },
          (error) => {
            console.log("GPS Fehler:", error);
            locationMode.value = "DE";
            const coords = countryCoords["DE"];
            manualLocation = { lat: coords.lat, lon: coords.lon };
            userLocation = manualLocation;
            locationStatus.textContent = "📍 DE";
            if (allStations.length > 0) {
              calculateAllDistances();
              sortAndRenderStations();
            }
          }
        );
      } else {
        locationMode.value = "DE";
        const coords = countryCoords["DE"];
        manualLocation = { lat: coords.lat, lon: coords.lon };
        userLocation = manualLocation;
        locationStatus.textContent = "📍 DE";
      }
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    function calculateAllDistances() {
      if (!userLocation) {
        allStations.forEach(st => st.distance = null);
        return;
      }
      
      allStations.forEach(st => {
        if (st.latitude && st.longitude) {
          st.distance = calculateDistance(
            userLocation.lat, 
            userLocation.lon, 
            st.latitude, 
            st.longitude
          );
        } else {
          st.distance = null;
        }
      });
    }

    // --- RADIO BROWSER API ---
    async function searchShoutcastStations() {
      const genre = genreSelect.value;
      const subgenre = subgenreSelect.value;
      const search = searchInput.value.trim();
      
      stationsListEl.innerHTML = '<div class="loading">🔍 Suche Sender...</div>';
      
      try {
        let url = "https://de1.api.radio-browser.info/json/stations/search?";
        const params = [];
        
        // Hauptgenre ODER Untergenre (Untergenre hat Vorrang)
        if (subgenre) {
          params.push(`tag=${encodeURIComponent(subgenre)}`);
        } else if (genre) {
          params.push(`tag=${encodeURIComponent(genre)}`);
        }
        
        // Zusätzlicher Name-Filter wenn eingegeben
        if (search) {
          params.push(`name=${encodeURIComponent(search)}`);
        }
        
        params.push("limit=1000");
        params.push("order=votes");
        params.push("reverse=true");
        params.push("hidebroken=true");
        params.push("codec=MP3");
        
        url += params.join("&");
        
        console.log("Search URL:", url);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("API Fehler");
        
        const data = await response.json();
        
        allStations.length = 0;
        const countries = new Set();
        // Reset dead-stations cache on each new search — old "dead" entries
        // may have come back online or aren't in the new result set anyway.
        deadStations.clear();

        data.forEach(station => {
          const url = station.url_resolved || station.url || '';

          // Skip playlist files – they cannot be played directly as <audio src>.
          // (.pls / .m3u / .m3u8 / .asx need parsing, ~70% of these never resolve well.)
          if (/\.(pls|m3u8?|asx|xspf)(\?|$)/i.test(url)) return;

          // Skip stations with no usable URL or whose last health check failed
          if (!url) return;
          if (station.lastcheckok !== undefined && station.lastcheckok === 0) return;

          const st = {
            id: station.stationuuid,
            name: station.name,
            streamUrl: url,
            genre: station.tags ? station.tags.split(',')[0].trim() : 'unknown',
            country: station.country || 'Unknown',
            bitrate: station.bitrate || 0,
            votes: station.votes || 0,
            listeners: station.clickcount || 0,
            logoText: station.name.substring(0, 2).toUpperCase(),
            favicon: station.favicon || null,
            latitude: parseFloat(station.geo_lat) || null,
            longitude: parseFloat(station.geo_long) || null,
            distance: null
          };

          if (st.country) countries.add(st.country);
          allStations.push(st);
        });
        
        calculateAllDistances();
        
        updateCountryFilter(Array.from(countries).sort());
        displayLimit = getStationLimit();
        sortAndRenderStations();
        
      } catch (error) {
        console.error("Fehler:", error);
        stationsListEl.innerHTML = '<div class="loading">❌ Fehler</div>';
      }
    }

    function updateCountryFilter(countries) {
      countryListEl.innerHTML = '';
      countries.forEach(country => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = country;
        cb.checked = selectedCountries.has(country);
        cb.addEventListener('change', () => {
          if (cb.checked) selectedCountries.add(country);
          else selectedCountries.delete(country);
          renderCountryTags();
          syncQuickButtons();
          sortAndRenderStations();
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(country));
        countryListEl.appendChild(label);
      });
    }

    // --- SORTIERUNG ---
    document.querySelectorAll(".sort-controls button").forEach(btn => {
      btn.addEventListener("click", () => {
        const sort = btn.dataset.sort;
        
        if (sort === "favorites") {
          if (currentSort.includes("favorites")) {
            currentSort = currentSort.filter(s => s !== "favorites");
            btn.classList.remove("active");
          } else {
            currentSort = ["favorites", ...currentSort.filter(s => s !== "favorites")];
            btn.classList.add("active");
          }
        } else {
          document.querySelectorAll(".sort-controls button").forEach(b => {
            if (b.dataset.sort !== "favorites") b.classList.remove("active");
          });
          btn.classList.add("active");
          currentSort = currentSort.includes("favorites") ? ["favorites", sort] : [sort];
        }
        
        sortAndRenderStations();
      });
    });

    function sortAndRenderStations() {
      let list = allStations.slice();
      
      if (selectedCountries.size > 0) {
        list = list.filter(s => selectedCountries.has(s.country));
      }
      
      list.sort((a, b) => {
        for (const sortType of currentSort) {
          let result = 0;
          
          switch(sortType) {
            case "favorites":
              const aFav = favorites.includes(a.id) ? 1 : 0;
              const bFav = favorites.includes(b.id) ? 1 : 0;
              result = bFav - aFav;
              break;
            case "distance":
              if (a.distance === null && b.distance === null) {
                result = 0;
              } else if (a.distance === null) {
                result = 1;
              } else if (b.distance === null) {
                result = -1;
              } else {
                result = a.distance - b.distance;
              }
              break;
            case "votes":
              result = b.votes - a.votes;
              break;
            case "bitrate":
              result = b.bitrate - a.bitrate;
              break;
            case "name":
              result = a.name.localeCompare(b.name);
              break;
          }
          
          if (result !== 0) return result;
        }
        return 0;
      });
      
      sortedStations = list;
      renderStations();
    }

    const httpsOnlyToggle = document.getElementById('httpsOnlyToggle');
    httpsOnlyToggle.addEventListener('change', renderStations);

    function renderStations() {
      stationsListEl.innerHTML = "";

      let sourceStations;

      if (showOnlyFavorites) {
        // Favoriten-Modus: direkt aus gespeicherten Stationsdaten, alle anderen Filter ignoriert
        sourceStations = Object.values(favoriteStationsData);
        if (sourceStations.length === 0) {
          stationsListEl.innerHTML = '<div class="loading">⭐ Noch keine Favoriten gespeichert.</div>';
          stationCountEl.textContent = "0 Sender";
          loadMoreBtn.style.display = "none";
          return;
        }
      } else {
        const httpsOnly = httpsOnlyToggle.checked;
        sourceStations = httpsOnly
          ? sortedStations.filter(s => s.streamUrl && s.streamUrl.startsWith('https://'))
          : sortedStations;
        if (sourceStations.length === 0) {
          stationsListEl.innerHTML = `<div class="loading">${httpsOnly ? '🔒 Keine HTTPS-Sender gefunden – Filter deaktivieren?' : 'Keine Sender gefunden'}</div>`;
          stationCountEl.textContent = "0 Sender";
          return;
        }
      }

      displayedStations = sourceStations.slice(0, displayLimit);
      stationCountEl.textContent = `${displayedStations.length} von ${sourceStations.length}${showOnlyFavorites ? ' ⭐' : (httpsOnlyToggle.checked ? ' 🔒' : '')}`;
      
      displayedStations.forEach((st, index) => {
        const row = document.createElement("div");
        row.className = "station";
        if (currentStation && currentStation.id === st.id) row.classList.add("active");
        if (favorites.includes(st.id)) row.classList.add("favorite");
        row.addEventListener("click", () => selectStation(st, index));

        const logo = document.createElement("div");
        logo.className = "station-logo";
        if (st.favicon) {
          logo.innerHTML = `<img src="${escapeHtml(st.favicon)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'" alt=""/>`;
        } else {
          logo.textContent = st.logoText;
        }

        const main = document.createElement("div");
        main.className = "station-main";
        const name = document.createElement("div");
        name.className = "station-name";
        name.textContent = st.name;
        name.setAttribute('data-fullname', st.name); // For tooltip
        
        const meta = document.createElement("div");
        meta.className = "station-meta";
        let metaText = `${st.genre} · ${st.country}`;
        if (st.bitrate) metaText += ` · ${st.bitrate}kbps`;
        if (st.votes) metaText += ` · 👥${st.votes}`;
        if (st.distance !== null) {
          metaText += `\n📍 ${Math.round(st.distance)}km entfernt`;
        } else if (userLocation) {
          metaText += `\n📍 Keine GPS-Daten`;
        }
        meta.textContent = metaText;

        main.appendChild(name);
        main.appendChild(meta);

        const fav = document.createElement("div");
        fav.className = "station-fav " + (favorites.includes(st.id) ? "" : "inactive");
        fav.textContent = "★";
        fav.addEventListener("click", (ev) => {
          ev.stopPropagation();
          toggleFavorite(st.id);
        });

        row.appendChild(logo);
        row.appendChild(main);
        row.appendChild(fav);
        stationsListEl.appendChild(row);
      });
      
      loadMoreBtn.style.display = displayedStations.length < sourceStations.length ? "block" : "none";
      if (window._tunerRefresh) window._tunerRefresh();
      if (window._globeRefresh) window._globeRefresh();
    }

    function toggleFavorite(id) {
      if (favorites.includes(id)) {
        favorites = favorites.filter(f => f !== id);
        delete favoriteStationsData[id];
      } else {
        favorites.push(id);
        const st = allStations.find(s => s.id === id)
                || displayedStations.find(s => s.id === id);
        if (st) favoriteStationsData[id] = st;
      }
      localStorage.setItem("brummiesFavorites", JSON.stringify(favorites));
      localStorage.setItem("brummiesFavoritesData", JSON.stringify(favoriteStationsData));
      renderStations();
      if (window._updateNpFavBtns)   window._updateNpFavBtns();
      if (window._globePopupRefresh) window._globePopupRefresh();
      if (window._djUpdateFavorites) window._djUpdateFavorites();
    }

    window._toggleFavorite = toggleFavorite;
    window._isFavorite = (id) => favorites.includes(id);

    // --- METADATA FETCHING ---
function startMetadataPolling() {
  stopMetadataPolling();
  if (!currentStation) return;

  fetchStreamMetadata();
  metadataTimer = setInterval(fetchStreamMetadata, 15000);
}

    function stopMetadataPolling() {
      if (metadataTimer) {
        clearInterval(metadataTimer);
        metadataTimer = null;
      }
    }

    // ── Real Now-Playing fetcher ───────────────────────────────────────────────
    async function fetchStreamMetadataForStation(station, onUpdate) {
      if (!station) return;
      const streamUrl = station.streamUrl;
      let base, mountPath;
      try {
        const u = new URL(streamUrl);
        base = `${u.protocol}//${u.host}`;
        mountPath = u.pathname;
      } catch { return; }

      const endpoints = [
        { url: `${base}/status-json.xsl`, parse: (t) => parseIcecastJson(t, mountPath) },
        { url: `${base}/stats?json=1`,    parse: parseShoutcastJson },
        { url: `${base}/7.html`,          parse: parseShoutcast7 },
        { url: `${base}/status.xsl`,      parse: parseIcecastXml },
        { url: `${base}/currentsong`,     parse: (t) => t.trim() || null },
        { url: `${base}/nowplaying`,      parse: (t) => t.trim() || null },
        { url: `${base}/now-playing.json`,parse: parseGenericJson },
        { url: `${base}/np.json`,         parse: parseGenericJson },
      ];

      for (const ep of endpoints) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 4000);
          const res = await fetch(ep.url, { mode: 'cors', cache: 'no-store', signal: ctrl.signal });
          clearTimeout(timer);
          if (!res.ok) continue;
          const text = await res.text();
          const title = ep.parse(text);
          if (title && title.length > 1 && !title.toLowerCase().includes('unknown')) {
            onUpdate(title);
            return;
          }
        } catch { /* try next */ }
      }
      onUpdate(`${station.name} – Live`);
    }
    window._fetchMetadataForStation = fetchStreamMetadataForStation;

    async function fetchStreamMetadata() {
      if (!currentStation || audioEl.paused) return;
      const stationAtStart = currentStation;
      await fetchStreamMetadataForStation(currentStation, (title) => {
        if (currentStation === stationAtStart) {
          updateNowPlayingText(title);
        }
      });
    }

    // ── Parsers for different server formats ───────────────────────────────────

    function parseIcecastJson(text, mountPath) {
      try {
        const j = JSON.parse(text);
        const src = j?.icestats?.source;
        const sources = Array.isArray(src) ? src : (src ? [src] : []);

        // First pass: try to find a source whose listenurl matches our mount path
        if (mountPath && mountPath !== '/') {
          const mount = mountPath.toLowerCase();
          for (const s of sources) {
            const listenurl = (s?.listenurl || '').toLowerCase();
            const serverName = (s?.['server_name'] || s?.server_name || '').toLowerCase();
            // Match if the listenurl ends with our mount path
            if (listenurl.endsWith(mount) || listenurl.includes(mount)) {
              const t = s?.title || s?.['stream-title'] || s?.artist;
              if (t) return t;
            }
          }
        }

        // Fallback: only use first source if there's exactly one (no ambiguity)
        if (sources.length === 1) {
          const t = sources[0]?.title || sources[0]?.['stream-title'] || sources[0]?.artist;
          if (t) return t;
        }
      } catch {}
      return null;
    }

    function parseShoutcastJson(text) {
      try {
        const j = JSON.parse(text);
        return j?.songtitle || j?.song || j?.currentSong || j?.title || null;
      } catch {}
      return null;
    }

    function parseShoutcast7(text) {
      // Format: "HTTP/1.0 200 OK\n...\n<html><body>200,listeners,max,br,SONGTITLE,genre,url</body></html>"
      try {
        const m = text.match(/<body>([\s\S]*?)<\/body>/i);
        if (!m) return null;
        const parts = m[1].trim().split(',');
        // Field 4 (index 4) is the song title
        if (parts.length >= 5 && parts[4]?.trim()) return parts[4].trim();
      } catch {}
      return null;
    }

    function parseIcecastXml(text) {
      try {
        const m = text.match(/<title>(.*?)<\/title>/i);
        return m?.[1]?.trim() || null;
      } catch {}
      return null;
    }

    function parseGenericJson(text) {
      try {
        const j = JSON.parse(text);
        return j?.title || j?.song || j?.track || j?.now_playing?.song?.title
          || j?.current_track?.title || j?.live?.is_live ? null : (j?.song?.title || null);
      } catch {}
      return null;
    }

    function updateNowPlayingText(text) {
      if (text && text !== currentMetadata) {
        const oldMetadata = currentMetadata;
        currentMetadata = text;
        // Notify recording module of track change (for auto-split mode)
        if (window._recOnTrackChange) window._recOnTrackChange(oldMetadata);
        nowPlayingTextEl.textContent = text;
        if (window._retroSyncNP) window._retroSyncNP(text);
        copyNowPlayingBtn.disabled = false;
        
        // Animation neu starten
        nowPlayingTextEl.style.animation = 'none';
        setTimeout(() => {
          nowPlayingTextEl.style.animation = '';
        }, 10);
        
        // Media Session aktualisieren mit neuem Song
        updateMediaSession();
        // Vollbild-NP live aktualisieren
        if (window._globeFullscreenNPUpdate) window._globeFullscreenNPUpdate();
      }
    }

    copyNowPlayingBtn.addEventListener("click", () => {
      if (currentMetadata) {
        const query = encodeURIComponent(currentMetadata);
        window.open(`https://www.google.com/search?q=${query}`, '_blank');
      }
    });

    // --- DATENVERBRAUCH TRACKING ---
    function startDataTracking() {
      if (dataTrackingInterval) return;
      
      // Track alle 10 Sekunden
      dataTrackingInterval = setInterval(() => {
        if (!audioEl.paused && currentStation) {
          // Schätzung: Bitrate * 10 Sekunden
          const bitrate = currentStation.bitrate || 128; // kbps
          const bytesPerSecond = (bitrate * 1000) / 8; // Bytes pro Sekunde
          const dataUsed = (bytesPerSecond * 10) / (1024 * 1024); // MB für 10 Sekunden
          
          currentSessionData += dataUsed;
          
          // Speichere in History
          const entry = {
            timestamp: Date.now(),
            data: dataUsed,
            station: currentStation.name,
            bitrate: bitrate
          };
          
          dataUsage.push(entry);
          localStorage.setItem("brummiesDataUsage", JSON.stringify(dataUsage));
          
          updateDataUsageDisplay();
        }
      }, 10000); // Alle 10 Sekunden
    }
    
    function stopDataTracking() {
      if (dataTrackingInterval) {
        clearInterval(dataTrackingInterval);
        dataTrackingInterval = null;
      }
    }
    
    function calculateDataUsage(period) {
      const now = Date.now();
      let cutoffTime;
      
      switch(period) {
        case "1h":
          cutoffTime = now - (60 * 60 * 1000); // 1 Stunde
          break;
        case "24h":
          cutoffTime = now - (24 * 60 * 60 * 1000); // 24 Stunden
          break;
        case "week":
          cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7 Tage
          break;
        case "month":
          cutoffTime = now - (30 * 24 * 60 * 60 * 1000); // 30 Tage
          break;
        default:
          cutoffTime = now - (60 * 60 * 1000);
      }
      
      const periodData = dataUsage.filter(entry => entry.timestamp >= cutoffTime);
      const total = periodData.reduce((sum, entry) => sum + entry.data, 0);
      
      return {
        total: total,
        count: periodData.length,
        entries: periodData
      };
    }
    
    function formatDataSize(mb) {
      if (mb >= 1000) {
        return (mb / 1000).toFixed(2) + " GB";
      }
      return mb.toFixed(2) + " MB";
    }
    
    function updateDataUsageDisplay() {
      // Aktuelle Session anzeigen
      document.getElementById("currentDataUsage").textContent = formatDataSize(currentSessionData);
      
      // Hochrechnungen basierend auf aktueller Bitrate oder Durchschnitt der Session
      let mbPerHour = 0;
      
      if (currentStation && currentStation.bitrate > 0) {
        // Exakte Berechnung: bitrate (kbps) → Bytes/s → MB/h
        const bytesPerSec = (currentStation.bitrate * 1000) / 8;
        mbPerHour = (bytesPerSec / (1024 * 1024)) * 3600;
      } else if (currentSessionData > 0 && currentSessionStart) {
        // Ableitung aus aktueller Session
        const sessionHours = (Date.now() - currentSessionStart) / 3600000;
        if (sessionHours > 0) mbPerHour = currentSessionData / sessionHours;
      } else if (dataUsage.length > 0) {
        // Durchschnitt aus historischen Daten (letzte Stunde)
        const cutoff = Date.now() - 3600000;
        const recent = dataUsage.filter(e => e.timestamp >= cutoff);
        if (recent.length > 0) {
          const totalMb = recent.reduce((s, e) => s + e.data, 0);
          const durHours = (Date.now() - recent[0].timestamp) / 3600000 || 1;
          mbPerHour = totalMb / durHours;
        }
      }
      
      const projEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val > 0 ? formatDataSize(val) : '—';
      };
      
      projEl('proj1h',    mbPerHour);
      projEl('projDay',   mbPerHour * 24);
      projEl('projWeek',  mbPerHour * 24 * 7);
      projEl('projMonth', mbPerHour * 24 * 30);
    }
    
    function resetDataUsage() {
      if (confirm("Datenverbrauch-Historie wirklich löschen?")) {
        dataUsage = [];
        currentSessionData = 0;
        localStorage.setItem("brummiesDataUsage", JSON.stringify(dataUsage));
        updateDataUsageDisplay();
      }
    }
    
    // Reset Data (handled inside clearAllHistoryStats above)

    // --- LISTENING STATS ---
    function startListeningSession(station) {
      currentSessionStart = Date.now();
      
      if (!listeningStats[station.id]) {
        listeningStats[station.id] = {
          name: station.name,
          genre: station.genre,
          country: station.country,
          totalTime: 0,
          sessions: 0
        };
      }
    }

    function endListeningSession() {
      if (!currentStation || !currentSessionStart) return;
      
      const duration = Math.floor((Date.now() - currentSessionStart) / 1000);
      
      if (listeningStats[currentStation.id]) {
        listeningStats[currentStation.id].totalTime += duration;
        listeningStats[currentStation.id].sessions += 1;
      }
      
      localStorage.setItem("brummiesListeningStats", JSON.stringify(listeningStats));
      currentSessionStart = null;
    }

    function formatDuration(seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    }

    function renderListeningStats() {
      listeningStatsEl.innerHTML = "";
      
      const statsArray = Object.entries(listeningStats)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.totalTime - a.totalTime);
      
      if (statsArray.length === 0) {
        listeningStatsEl.innerHTML = '<small>Noch keine Daten</small>';
        return;
      }
      
      statsArray.forEach(stat => {
        const div = document.createElement("div");
        const fullText = `${stat.name} · ${formatDuration(stat.totalTime)} · ${stat.sessions}x`;
        div.textContent = fullText;
        div.setAttribute('data-fulltext', fullText); // For tooltip
        div.addEventListener("click", async () => {
          let station = allStations.find(s => s.id === stat.id);
          
          if (!station) {
            // Sender nicht in Liste - von API laden
            station = await fetchStationByUUID(stat.id, stat.name);
          }
          
          if (station) {
            const index = allStations.findIndex(s => s.id === stat.id);
            selectStation(station, index >= 0 ? index : 0);
          }
        });
        listeningStatsEl.appendChild(div);
      });
    }

    // --- WEB AUDIO EQ & VISUALIZER ---
    // ── CARPLAY / EXTERNAL AUDIO DETECTION ────────────────────────────────────
    // UA-sniffing for CarPlay is unreliable since iOS 14+.
    // We use multiple signals and treat the result conservatively.

    // Signal 1: UA string (works on older iOS / some head units)
    const isCarPlayUA = /CarPlay/i.test(navigator.userAgent);

    // Signal 2: Screen size heuristic for CarPlay displays (800×480 or 1024×600)
    const isCarPlayScreen = (
      (window.screen.width === 800 && window.screen.height === 480) ||
      (window.screen.width === 1024 && window.screen.height === 600) ||
      (window.screen.width === 480 && window.screen.height === 800)
    );

    // Signal 3: Connected Bluetooth / wireless audio output device
    let isBluetoothAudio = false;
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        isBluetoothAudio = outputs.some(d =>
          /bluetooth|airpods|wireless|carplay|car/i.test(d.label)
        );
        console.log('BT audio detected:', isBluetoothAudio, outputs.map(d=>d.label));
      }).catch(() => {});
    }

    // Signal 4: Audio route change (works in standalone PWA on iOS)
    let isCarPlay = isCarPlayUA || isCarPlayScreen;

    // Listen for audio output changes (e.g., user plugs in CarPlay)
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        const prevBT = isBluetoothAudio;
        isBluetoothAudio = outputs.some(d => /bluetooth|airpods|wireless|carplay|car/i.test(d.label));
        isCarPlay = isCarPlayUA || isCarPlayScreen || outputs.some(d => /carplay/i.test(d.label));
        if (prevBT !== isBluetoothAudio) {
          console.log('Audio device changed – BT:', isBluetoothAudio, 'CarPlay:', isCarPlay);
        }
      });
    }

    const isExternalAudio = () => isCarPlay || isBluetoothAudio;

    if (isCarPlay) {
      console.log('CarPlay detected – AudioContext disabled');
      const eqSec = document.getElementById('eq');
      if (eqSec) eqSec.style.display = 'none';
    }

    // ── iOS BACKGROUND AUDIO ───────────────────────────────────────────────────
    // On iOS, an active AudioContext can interfere with background playback.
    // When the page is hidden (screen locked / app switched), we suspend the
    // AudioContext but keep the HTML audio element playing. When the page
    // becomes visible again we resume the context without reloading the stream.

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page going to background
        if (audioContext && audioContext.state === 'running' && isIOS) {
          // Suspend AudioContext – releases iOS audio session lock so audio
          // continues in background without the web audio graph interfering
          audioContext.suspend().then(() => {
            console.log('AudioContext suspended for iOS background');
          }).catch(() => {});
        }
      } else {
        // Page coming to foreground
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            console.log('AudioContext resumed');
            if (!visualizerActive && analyser) startVisualizer();
          }).catch(() => {});
        }
        // If stream dropped while hidden, reconnect
        if (currentStation && audioEl.paused && coverEl.classList.contains('playing')) {
          console.log('Stream paused while hidden – resuming');
          audioEl.play().catch(() => attemptReconnect());
        }
        if (currentStation && !audioEl.paused) requestWakeLock();
        if (currentStation) updateMediaSession();
      }
    });
    
    // ── CORS PROBE ─────────────────────────────────────────────────────────────
    // Tests whether a stream URL sends CORS headers before we attach the
    // AudioContext (which requires crossorigin="anonymous" on the audio element).
    // Returns true if CORS is available, false otherwise.
    async function probeStreamCORS(url) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const resp = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          signal: ctrl.signal,
          headers: { Range: 'bytes=0-0' } // Minimal request – just headers
        });
        clearTimeout(timer);
        return resp.ok || resp.status === 206;
      } catch {
        return false;
      }
    }

    // ── AUDIO CONTEXT / EQ / VISUALIZER ────────────────────────────────────────
    // We only attach the Web Audio graph when the stream is CORS-capable.
    // Without CORS the audio element plays normally without EQ/visualizer.
    let audioContextReady = false;

    function initAudioContext() {
      if (audioContextReady) return;
      if (isExternalAudio()) {
        console.log('External audio – skipping AudioContext');
        return;
      }

      try {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'playback',
            sampleRate: 44100
          });
        }

        if (!source) {
          source  = audioContext.createMediaElementSource(audioEl);
        }
        if (!analyser) {
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          window._analyser = analyser;   // expose for retro visualizer
        }

        const eqFrequencies = [80, 400, 1000, 3500, 10000];
        filters = eqFrequencies.map(freq => {
          const f = audioContext.createBiquadFilter();
          f.type = 'peaking';
          f.frequency.value = freq;
          f.Q.value = 1;
          f.gain.value = 0;
          return f;
        });

        source.connect(filters[0]);
        for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
        filters[filters.length - 1].connect(analyser);
        analyser.connect(audioContext.destination);

        // Recording tap – parallel to speakers, receives EQ-processed audio
        mediaRecDest = audioContext.createMediaStreamDestination();
        analyser.connect(mediaRecDest);

        // Wire EQ sliders
        document.querySelectorAll('#eq input[type=range]').forEach(slider => {
          slider.addEventListener('input', () => {
            const idx = Number(slider.dataset.index);
            const val = Number(slider.value);
            if (filters[idx]) filters[idx].gain.value = val;
            const disp = document.querySelector(`.eq-value[data-index="${idx}"]`);
            if (disp) disp.textContent = `${val > 0 ? '+' : ''}${val} dB`;
            const allVals = Array.from(document.querySelectorAll('#eq input[type=range]')).map(s => Number(s.value));
            localStorage.setItem('brummiesEqValues', JSON.stringify(allVals));
          });
        });

        audioContextReady = true;
        if (!visualizerActive) startVisualizer();
        if (window._recUpdateAvailability) window._recUpdateAvailability();
        console.log('AudioContext ready');
      } catch (err) {
        console.error('AudioContext init failed:', err);
      }
    }

    // Called from selectStation after playback has already started.
    // Probes CORS in the background and upgrades to Web Audio (EQ/Visualizer)
    // if the stream supports it. Does NOT block or replace the initial play().
    async function setupAudioForStation(station) {
      const url = station.streamUrl;

      // If AudioContext already running, just resume it
      if (audioContextReady) {
        if (audioContext.state === 'suspended') await audioContext.resume();
        return;
      }

      // iOS / CarPlay: skip CORS probe, play bare
      if (isExternalAudio()) return;

      // Probe CORS support for this stream (runs in background, does not block play)
      const corsOK = await probeStreamCORS(url);

      // Guard: station may have changed while the probe was running
      if (currentStation !== station) return;

      if (corsOK) {
        // Wait until audio is actually delivering frames before reloading src with
        // crossOrigin. Reloading src earlier aborts the pending play() promise,
        // which triggers markStationDeadAndSkip unnecessarily.
        // If already playing, resolve immediately to avoid unnecessary delay
        if (!audioEl.paused) {
          // Audio is already playing, proceed immediately
        } else {
          // Wait for playback to start or error
          await new Promise(resolve => {
              if (!audioEl.paused) { resolve(); return; }
            audioEl.addEventListener('playing', resolve, { once: true });
            audioEl.addEventListener('error',   resolve, { once: true });
            setTimeout(resolve, 5000);
          });
        }
        if (currentStation !== station) return;
        if (audioEl.paused) return; // stream failed or user already paused

        initAudioContext();
      } else {
        // No CORS – stream is already playing without Web Audio graph
        console.log('Stream has no CORS – EQ/Visualizer disabled for this station');
        showEQWarning(true);
      }
    }

    function showEQWarning(show) {
      let warn = document.getElementById('eqCORSWarning');
      if (!warn) {
        warn = document.createElement('div');
        warn.id = 'eqCORSWarning';
        warn.style.cssText = 'font-size:11px;color:var(--color-text-muted);text-align:center;padding:6px;margin-top:4px;';
        warn.textContent = '⚠️ Dieser Stream unterstützt kein EQ/Visualizer (kein CORS)';
        document.getElementById('eqContainer').appendChild(warn);
      }
      warn.style.display = show ? 'block' : 'none';
    }

    function startVisualizer() {
      const canvas = document.getElementById("visualizer");
      if (!canvas || !analyser) return;
      if (visualizerActive) return;
      
      // Ensure canvas is visible and has dimensions
      const w = canvas.getBoundingClientRect().width || canvas.parentElement?.getBoundingClientRect().width || 400;
      canvas.width  = Math.round(w);
      canvas.height = parseInt(canvas.style.height) || 120;
      
      visualizerActive = true;
      const ctx = canvas.getContext("2d");
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      function draw() {
        if (!visualizerActive) return;
        requestAnimationFrame(draw);
        
        analyser.getByteFrequencyData(dataArray);
        
        // Use pre-cached theme colors (updated by applyTheme / applyCustomTheme)
        const bgColor    = cachedBgColor    || '#0b0b0f';
        const accentColor = cachedAccentColor || '#e8402a';
        
        // Clear canvas – transparent when video is running, solid otherwise
        const bgVid = vidEls && vidEls[activeVid];
        if (bgVid && !bgVid.paused) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.fillStyle = bgColor || "#0b0b0f";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * Math.min(canvas.height, 120);
          
          // Create gradient based on theme accent color
          // Parse accent color (hex to RGB)
          let accentRGB = { r: 239, g: 68, b: 68 }; // Default red
          if (accentColor.startsWith('#')) {
            const hex = accentColor.slice(1);
            accentRGB = {
              r: parseInt(hex.slice(0, 2), 16),
              g: parseInt(hex.slice(2, 4), 16),
              b: parseInt(hex.slice(4, 6), 16)
            };
          }
          
          // Vary intensity based on frequency
          const intensity = barHeight / canvas.height;
          const r = Math.floor(accentRGB.r * intensity + 100);
          const g = Math.floor(accentRGB.g * intensity + 50);
          const b = Math.floor(accentRGB.b * intensity + 50);
          
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          
          x += barWidth + 1;
        }
      }
      
      draw();
      console.log("Visualizer started with theme colors");
    }

    // Resize canvas wenn Fenster sich ändert
    window.addEventListener("resize", () => {
      const canvas = document.getElementById("visualizer");
      if (canvas && visualizerActive) {
        const w = canvas.getBoundingClientRect().width || 400;
        canvas.width = Math.round(w);
        canvas.height = 120;
      }
    });

    // --- PLAYER CONTROLS ---
    if (volumeRange) {
      volumeRange.addEventListener("input", () => {
        const vol = Number(volumeRange.value) / 100;
        audioEl.volume = vol;
        volumeValue.textContent = volumeRange.value + "%";
      });
    }

    // ── Stream detach/attach helpers ─────────────────────────────────────────
    // Live HTTP streams have stale buffers after pause — on mobile, calling
    // play() on a paused stream often fails silently. Releasing src on pause
    // (a) terminates the HTTP connection (saves cellular data) and
    // (b) forces a fresh connection on resume so play actually starts.
    let streamDetached = false;
    function releaseStream() {
      try {
        streamDetached = true;
        audioEl.pause();
        audioEl.removeAttribute('src');
        audioEl.load();           // releases the underlying HTTP socket
      } catch (e) {
        console.warn('releaseStream:', e);
      }
    }
    function attachStream() {
      if (!currentStation) return false;
      streamDetached = false;
      audioEl.src = currentStation.streamUrl;
      try { audioEl.load(); } catch (e) {}
      return true;
    }
    // Expose so other modules (rec, mediaSession) can check
    window._isStreamDetached = () => streamDetached;

    playBtn.addEventListener("click", () => {
      if (!currentStation) return;

      if (audioEl.paused) {
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            if (audioContextReady && !visualizerActive) startVisualizer();
          });
        } else if (audioContextReady && !visualizerActive) {
          startVisualizer();
        }

        // Re-attach the stream if it was released on the previous pause.
        // This is the key fix for "play does not work after pause" on mobile.
        if (!audioEl.src || streamDetached) {
          attachStream();
        }

        audioEl.play()
          .then(() => {
            setIcon(playBtn, "pause");
            if (window.lucide) lucide.createIcons();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
          })
          .catch(err => {
            console.error("Play error:", err);
            // Mobile recovery: re-attach once and retry
            if (!streamDetached) {
              attachStream();
              audioEl.play().catch(err2 => {
                console.error("Play retry failed:", err2);
                stationInfoEl.textContent = "❌ Fehler";
                if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
              });
            } else {
              stationInfoEl.textContent = "❌ Fehler";
              if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
            }
          });
      } else {
        // Detach src to release HTTP connection (saves data on mobile)
        releaseStream();
        setIcon(playBtn, "play");
        if (window.lucide) lucide.createIcons();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      }
    });

    prevBtn.addEventListener("click", () => {
      try {
        if (!displayedStations || displayedStations.length === 0) {
          console.warn('No stations available');
          return;
        }
        if (currentStationIndex > 0) {
          const prevStation = displayedStations[currentStationIndex - 1];
          if (prevStation) {
            selectStation(prevStation, currentStationIndex - 1);
          }
        }
      } catch (err) {
        console.error('prevBtn error:', err);
      }
    });

    nextBtn.addEventListener("click", () => {
      try {
        if (!displayedStations || displayedStations.length === 0) {
          console.warn('No stations available');
          return;
        }
        if (currentStationIndex < displayedStations.length - 1) {
          const nextStation = displayedStations[currentStationIndex + 1];
          if (nextStation) {
            selectStation(nextStation, currentStationIndex + 1);
          }
        }
      } catch (err) {
        console.error('nextBtn error:', err);
      }
    });

    // --- SHUFFLE (Button statt Checkbox) ---
    shuffleToggle.addEventListener("click", () => {
      if (shuffleActive) {
        shuffleActive = false;
        clearTimeout(shuffleTimer);
        setIcon(shuffleToggle, 'play');
        shuffleToggle.title = 'Shuffle starten';
        shuffleToggle.classList.remove("active");
        shuffleStatusEl.classList.remove("active");
      } else {
        shuffleActive = true;
        setIcon(shuffleToggle, 'square');
        shuffleToggle.title = 'Shuffle stoppen';
        shuffleToggle.classList.add("active");
        scheduleShuffle();
      }
    });

    function scheduleShuffle() {
      clearTimeout(shuffleTimer);
      if (!shuffleActive) return;

      const fixed = Number(document.getElementById("shuffleFixed").value);
      const from = Number(document.getElementById("shuffleFrom").value);
      const to = Number(document.getElementById("shuffleTo").value);

      let minutes = fixed > 0 ? fixed : Math.floor(Math.random() * (to - from + 1)) + from;
      
      shuffleStatusEl.textContent = `🔀 Nächster Shuffle in ${minutes} Min`;
      shuffleStatusEl.classList.add("active");
      
      shuffleTimer = setTimeout(() => {
        doShuffle();
        scheduleShuffle();
      }, minutes * 60 * 1000);
    }

    function doShuffle() {
      const top20 = displayedStations.slice(0, 20);
      if (top20.length < 1) return;
      
      let candidates = top20.filter(s => (!currentStation || s.id !== currentStation.id));
      if (!candidates.length) candidates = top20;
      
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      const index = displayedStations.findIndex(s => s.id === next.id);
      selectStation(next, index, true);
    }

    // --- SLEEP TIMER (Button + Radio) ---
    // Sleep Mode Toggle Buttons
    document.querySelectorAll('.sleep-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active from all buttons
        document.querySelectorAll('.sleep-mode-btn').forEach(b => b.classList.remove('active'));
        
        // Add active to clicked button
        e.target.classList.add('active');
        
        const mode = e.target.dataset.mode;
        
        if (mode === 'minutes') {
          document.getElementById('sleepMinutesLabel').style.display = 'block';
          document.getElementById('sleepMinutes').style.display = 'block';
          document.getElementById('sleepClockLabel').style.display = 'none';
          document.getElementById('sleepClock').style.display = 'none';
        } else {
          document.getElementById('sleepMinutesLabel').style.display = 'none';
          document.getElementById('sleepMinutes').style.display = 'none';
          document.getElementById('sleepClockLabel').style.display = 'block';
          document.getElementById('sleepClock').style.display = 'block';
        }
      });
    });

    sleepToggle.addEventListener("click", () => {
      if (sleepActive) {
        sleepActive = false;
        clearTimeout(sleepTimer);
        setIcon(sleepToggle, 'play');
        sleepToggle.title = 'Timer starten';
        sleepToggle.classList.remove("active");
        sleepStatusEl.classList.remove("active");
      } else {
        sleepActive = true;
        setIcon(sleepToggle, 'square');
        sleepToggle.title = 'Timer stoppen';
        sleepToggle.classList.add("active");
        
        const mode = document.querySelector('.sleep-mode-btn.active').dataset.mode;
        
        if (mode === "minutes") {
          const minutes = Number(document.getElementById("sleepMinutes").value);
          sleepTimer = setTimeout(() => {
            audioEl.pause();
            setIcon(playBtn, 'play');
            coverEl.classList.remove("playing");
            sleepActive = false;
            setIcon(sleepToggle, 'play');
            sleepToggle.title = 'Timer starten';
            sleepToggle.classList.remove("active");
            sleepStatusEl.classList.remove("active");
            alert("⏰ Sleep Timer abgelaufen");
          }, minutes * 60 * 1000);
          sleepStatusEl.textContent = `⏰ Stoppt in ${minutes} Min`;
          sleepStatusEl.classList.add("active");
        } else {
          const clock = document.getElementById("sleepClock").value;
          const [hours, mins] = clock.split(':').map(Number);
          const target = new Date();
          target.setHours(hours, mins, 0, 0);
          if (target < new Date()) target.setDate(target.getDate() + 1);
          
          sleepTimer = setTimeout(() => {
            audioEl.pause();
            setIcon(playBtn, 'play');
            coverEl.classList.remove("playing");
            sleepActive = false;
            setIcon(sleepToggle, 'play');
            sleepToggle.title = 'Timer starten';
            sleepToggle.classList.remove("active");
            sleepStatusEl.classList.remove("active");
            alert("⏰ Sleep Timer abgelaufen");
          }, target - new Date());
          sleepStatusEl.textContent = `⏰ Stoppt um ${clock}`;
          sleepStatusEl.classList.add("active");
        }
      }
    });

    // --- HISTORY TABS ---
    document.querySelectorAll(".history-controls button[data-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".history-controls button[data-view]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        historyView = btn.dataset.view;
        
        document.getElementById("historyContainer").style.display = historyView === "stations" ? "block" : "none";
        document.getElementById("statsContainer").style.display  = historyView === "stats"    ? "block" : "none";
        document.getElementById("dataContainer").style.display   = historyView === "data"     ? "block" : "none";
        
        if (historyView === "stats") renderListeningStats();
        if (historyView === "stations") renderHistory();
        if (historyView === "data") updateDataUsageDisplay();
      });
    });

    document.getElementById("clearAllHistoryStats").addEventListener("click", () => {
      if (historyView === "data") {
        if (confirm("Datenverbrauch zurücksetzen?")) {
          dataUsage = [];
          currentSessionData = 0;
          localStorage.setItem("brummiesDataUsage", JSON.stringify(dataUsage));
          updateDataUsageDisplay();
        }
      } else {
        if (confirm("Verlauf & Statistik zurücksetzen?")) {
          historyData = [];
          listeningStats = {};
          localStorage.setItem("brummiesHistory", JSON.stringify(historyData));
          localStorage.setItem("brummiesListeningStats", JSON.stringify(listeningStats));
          renderHistory();
          renderListeningStats();
        }
      }
    });

    function addHistoryEntry(action, station) {
      const entry = {
        timestamp: new Date().toISOString(),
        action,
        station: { id: station.id, name: station.name }
      };
      
      historyData.unshift(entry);
      if (historyData.length > 100) historyData = historyData.slice(0, 100);
      
      localStorage.setItem("brummiesHistory", JSON.stringify(historyData));
      
      if (historyView !== "stats") renderHistory();
    }

    // --- EINZELNEN SENDER LADEN ---
    async function fetchStationByUUID(stationId, stationName) {
      try {
        const url = `https://de1.api.radio-browser.info/json/stations/byuuid/${stationId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error("Station nicht gefunden");
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          const st = data[0];
          
          // Convert to internal format
          const station = {
            id: st.stationuuid,
            name: st.name,
            streamUrl: st.url_resolved || st.url,
            genre: st.tags ? st.tags.split(',')[0].trim() : 'unknown',
            country: st.country || 'Unknown',
            bitrate: st.bitrate || 0,
            votes: st.votes || 0,
            listeners: st.clickcount || 0,
            logoText: st.name.substring(0, 2).toUpperCase(),
            favicon: st.favicon || null,
            latitude: parseFloat(st.geo_lat) || null,
            longitude: parseFloat(st.geo_long) || null,
            distance: null
          };
          
          // Calculate distance if we have location
          if (userLocation && station.latitude && station.longitude) {
            station.distance = calculateDistance(
              userLocation.lat, 
              userLocation.lon, 
              station.latitude, 
              station.longitude
            );
          }
          
          return station;
        } else {
          throw new Error("Station nicht gefunden");
        }
      } catch (error) {
        console.error("Error fetching station:", error);
        alert(`Sender "${stationName}" konnte nicht geladen werden.`);
        return null;
      }
    }

    // --- VERLAUF RENDERN ---
    function renderHistory() {
      historyEl.innerHTML = "";
      
      if (historyData.length === 0) {
        historyEl.innerHTML = '<small>Noch keine Einträge</small>';
        return;
      }
      
      historyData.forEach(entry => {
        const div = document.createElement("div");
        const time = new Date(entry.timestamp).toLocaleTimeString("de-DE");
        const fullText = `${time} – ${entry.action}: ${entry.station.name}`;
        
        div.textContent = fullText;
        div.setAttribute('data-fulltext', fullText); // For tooltip
        div.addEventListener("click", async () => {
          let station = allStations.find(s => s.id === entry.station.id);
          
          if (!station) {
            // Sender nicht in Liste - von API laden
            station = await fetchStationByUUID(entry.station.id, entry.station.name);
          }
          
          if (station) {
            const index = allStations.findIndex(s => s.id === entry.station.id);
            selectStation(station, index >= 0 ? index : 0);
          }
        });
        
        historyEl.appendChild(div);
      });
    }

    // --- SENDER WÄHLEN ---
    function selectStation(station, index, fromShuffle = false) {
  try {
    // Validate inputs
    if (!station) {
      console.error('selectStation: station is null or undefined');
      return;
    }
    
    if (!station.streamUrl) {
      console.error('selectStation: station has no streamUrl', station);
      stationInfoEl.textContent = "❌ Kein Stream verfügbar";
      return;
    }
    
    if (index === undefined || index === null || index < 0) {
      console.warn('selectStation: invalid index', index);
      index = 0;
    }
    
    console.log('Selecting station:', station.name, 'at index:', index);
    
  endListeningSession();
  stopMetadataPolling();
  clearPlayStartTimeout();        // cancel watchdog from previous station
  if (window._recStopOnStationChange) window._recStopOnStationChange();

  currentStation = station;
  currentStationIndex = index;
  if (window._updateNpFavBtns) window._updateNpFavBtns();
  currentMetadata = '';
  reconnectAttempts = 0;
  streamDetached = false;          // station change is an intentional re-attach

  stationNameEl.textContent = station.name;
  stationNameEl.setAttribute('data-fullname', station.name);
  stationInfoEl.textContent = fromShuffle ? '🔀 Shuffle...' : `${station.genre} · ${station.country} · ${station.bitrate}kbps`;
  nowPlayingTextEl.textContent = 'Warte auf Stream-Metadaten...';
  copyNowPlayingBtn.disabled = true;

  prevBtn.disabled = index <= 0;
  nextBtn.disabled = index >= displayedStations.length - 1;

  coverEl.style.backgroundImage = '';
  coverEl.style.background = 'radial-gradient(circle at 30% 20%, #f97316, #111827 60%)';
  if (station.favicon) {
    coverEl.style.backgroundImage = `url(${station.favicon})`;
    coverEl.style.backgroundSize = 'contain';
    coverEl.style.backgroundPosition = 'center';
    coverEl.style.backgroundRepeat = 'no-repeat';
  }

  // Hide any previous EQ warning
  showEQWarning(false);

  // Update recording availability (CORS status not yet known → will also be
  // called again inside initAudioContext once the probe completes)
  if (window._recUpdateAvailability) window._recUpdateAvailability();

  // Start playing immediately – must happen synchronously within the user gesture
  // so browsers don't block autoplay. The CORS probe runs in the background and
  // upgrades the AudioContext/EQ afterwards without blocking playback.
      audioEl.pause();               // laufende Play-Promise abbrechen
      audioEl.removeAttribute("src"); // alten Stream komplett lösen
      audioEl.removeAttribute("crossOrigin");
      audioEl.load();                 // AbortError des alten Streams auslösen & abwarten
      audioEl.crossOrigin = 'anonymous';
  audioEl.src = station.streamUrl;

  audioEl.play().then(() => {
    setIcon(playBtn, "pause");
    if (window.lucide) lucide.createIcons();
    playBtn.disabled = false;
    coverEl.classList.add('playing');

    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';

    startListeningSession(station);
    startMetadataPolling();
    startDataTracking();

    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    if (audioContextReady && !visualizerActive) startVisualizer();

    updateMediaSession();
    if (window._retroStationChanged) window._retroStationChanged();

    clearPlayStartTimeout();
    playStartTimeout = setTimeout(() => {
      if (audioEl.readyState < 3 || audioEl.currentTime === 0) {
        markStationDeadAndSkip('play-start timeout (10s, no audio data)');
      }
    }, 10000);
  }).catch(err => {
    // AbortError means the src was reloaded – not a real stream failure. Ignore it.
    if (err && err.name === 'AbortError') return;
    
    // CORS fallback: try without crossOrigin for streams that don't support it
    console.log('CORS play failed, retrying without crossOrigin:', err && err.message);
    audioEl.removeAttribute('crossOrigin');
    audioEl.src = station.streamUrl;
    
    audioEl.play().then(() => {
      setIcon(playBtn, "pause");
      if (window.lucide) lucide.createIcons();
      playBtn.disabled = false;
      coverEl.classList.add('playing');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      startListeningSession(station);
      startMetadataPolling();
      startDataTracking();
      if (audioContext && audioContext.state === 'suspended') audioContext.resume();
      updateMediaSession();
      if (window._retroStationChanged) window._retroStationChanged();
      clearPlayStartTimeout();
      playStartTimeout = setTimeout(() => {
        if (audioEl.readyState < 3 || audioEl.currentTime === 0) {
          markStationDeadAndSkip('play-start timeout (10s, no audio data)');
        }
      }, 10000);
      // Show EQ warning since this stream has no CORS
      showEQWarning(true);
    }).catch(err2 => {
      if (err2 && err2.name === 'AbortError') return;
      console.error('Stream error:', err2);
      coverEl.classList.remove('playing');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      markStationDeadAndSkip('play() promise rejected: ' + (err2 && err2.message));
    });
  });

  // CORS probe in background: upgrades to AudioContext/EQ if the stream allows it
  setupAudioForStation(station);
      
      addHistoryEntry(fromShuffle ? "🔀 Shuffle zu" : "🎵 Wechsel zu", station);
      renderStations();
    
  } catch (err) {
    console.error('selectStation: Critical error:', err);
    stationInfoEl.textContent = "❌ Fehler";
    if (coverEl) coverEl.classList.remove("playing");
    if (playBtn) {
      setIcon(playBtn, "play");
      playBtn.disabled = false;
    }
  }
}

    // --- MEDIA SESSION API (Lock Screen / Notification Controls) ---
    function updateMediaSession() {
      if ('mediaSession' in navigator && currentStation) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentStation.name,
          artist: currentMetadata || `${currentStation.genre} Radio`,
          album: `${currentStation.country} · ${currentStation.bitrate}kbps`,
          artwork: currentStation.favicon ? [
            { src: currentStation.favicon, sizes: '96x96', type: 'image/png' },
            { src: currentStation.favicon, sizes: '128x128', type: 'image/png' },
            { src: currentStation.favicon, sizes: '192x192', type: 'image/png' },
            { src: currentStation.favicon, sizes: '256x256', type: 'image/png' }
          ] : [
            { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: './icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        });

        // Action Handlers für Lock Screen
        // iOS-compatible Media Session handlers
        navigator.mediaSession.setActionHandler('play', () => {
          try {
            if (!audioEl) return;

            if (!audioEl.paused) {
              console.log('Media Session play: Already playing');
              return;
            }

            // Re-attach stream if released on pause
            if ((!audioEl.src || streamDetached) && currentStation) {
              attachStream();
            }
            if (!audioEl.src) {
              console.warn('Media Session play: No audio source');
              return;
            }

            // iOS requires immediate state update
            navigator.mediaSession.playbackState = 'playing';

            // Start playback
            const playPromise = audioEl.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('Media Session play: Success');
                  if (playBtn) setIcon(playBtn, "pause");
                })
                .catch(err => {
                  console.error('Media Session play failed:', err);
                  navigator.mediaSession.playbackState = 'paused';
                  if (playBtn) setIcon(playBtn, "play");
                });
            }
          } catch (err) {
            console.error('Media Session play handler error:', err);
            navigator.mediaSession.playbackState = 'paused';
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          try {
            if (!audioEl) return;

            if (audioEl.paused) {
              console.log('Media Session pause: Already paused');
              return;
            }

            // iOS requires immediate state update
            navigator.mediaSession.playbackState = 'paused';

            // Release stream connection (saves data, ensures clean resume on mobile)
            releaseStream();
            if (playBtn) setIcon(playBtn, "play");
            console.log('Media Session pause: Success');
          } catch (err) {
            console.error('Media Session pause handler error:', err);
          }
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
          try {
            // iOS: Minimal validation, fast execution
            if (!displayedStations || displayedStations.length === 0) {
              console.warn('Media Session: No stations');
              return;
            }
            
            if (currentStationIndex === undefined || currentStationIndex <= 0) {
              console.warn('Media Session: At first station');
              return;
            }
            
            const prevIndex = currentStationIndex - 1;
            const prevStation = displayedStations[prevIndex];
            
            if (!prevStation || !prevStation.streamUrl) {
              console.warn('Media Session: Invalid previous station');
              return;
            }
            
            // iOS: Execute immediately, don't wait
            console.log('Media Session: Previous ->', prevStation.name);
            selectStation(prevStation, prevIndex);
          } catch (err) {
            console.error('Media Session previoustrack error:', err);
          }
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          try {
            // iOS: Minimal validation, fast execution
            if (!displayedStations || displayedStations.length === 0) {
              console.warn('Media Session: No stations');
              return;
            }
            
            if (currentStationIndex === undefined || currentStationIndex >= displayedStations.length - 1) {
              console.warn('Media Session: At last station');
              return;
            }
            
            const nextIndex = currentStationIndex + 1;
            const nextStation = displayedStations[nextIndex];
            
            if (!nextStation || !nextStation.streamUrl) {
              console.warn('Media Session: Invalid next station');
              return;
            }
            
            // iOS: Execute immediately, don't wait
            console.log('Media Session: Next ->', nextStation.name);
            selectStation(nextStation, nextIndex);
          } catch (err) {
            console.error('Media Session nexttrack error:', err);
          }
        });

        // Seek nicht unterstützt (Radio ist live)
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        
        console.log('Media Session updated:', currentStation.name);
      }
    }

    // --- AUDIO EVENTS ---
    audioEl.addEventListener("play", () => {
      setIcon(playBtn, "pause");
      if (currentStation && !currentSessionStart) {
        startListeningSession(currentStation);
      }
      startDataTracking(); // Start data tracking
    });

    audioEl.addEventListener("pause", () => {
      setIcon(playBtn, "play");
      endListeningSession();
      stopMetadataPolling();
      stopDataTracking(); // Stop data tracking
      clearPlayStartTimeout();   // user paused → don't trigger auto-skip

      // iOS: Sync Media Session state
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    });

    audioEl.addEventListener("playing", () => {
      // Stream is actually delivering audio frames → cancel dead-stream watchdog
      clearPlayStartTimeout();

      if (currentStation) {
        stationInfoEl.textContent = `🎶 ${currentStation.genre} · ${currentStation.bitrate}kbps`;
      }

      // iOS: Sync Media Session state
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    });

    audioEl.addEventListener("error", () => {
      // Ignore errors caused by an intentional stream release
      if (streamDetached) return;

      stationInfoEl.textContent = "❌ Stream-Fehler";
      setIcon(playBtn, "play");
      coverEl.classList.remove("playing");
      endListeningSession();
      stopMetadataPolling();
      stopDataTracking(); // Stop data tracking
      nowPlayingTextEl.textContent = "Verbindungsfehler";

      // iOS: Sync Media Session state
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }

      // Attempt reconnect for mobile
      attemptReconnect();
    });

    // --- MOBILE STREAMING OPTIMIZATIONS ---
    
    // Buffer Events - zeigt Buffering an
    audioEl.addEventListener("waiting", () => {
      isBuffering = true;
      stationInfoEl.textContent = "🔄 Buffering...";
      console.log("Audio buffering...");
    });
    
    audioEl.addEventListener("canplay", () => {
      isBuffering = false;
      reconnectAttempts = 0; // Reset auf erfolgreichen Buffer
      if (currentStation) {
        stationInfoEl.textContent = `🎶 ${currentStation.genre} · ${currentStation.bitrate}kbps`;
      }
      console.log("Audio can play");
    });
    
    // Stalling Detection - kritisch für Mobile
    audioEl.addEventListener("stalled", () => {
      console.log("Audio stalled");
      if (streamDetached) return;
      // External audio (CarPlay/Bluetooth): 'stalled' fires during normal session transitions.
      // Do NOT reconnect - this causes rhythmic interruptions.
      if (!isExternalAudio()) {
        attemptReconnect();
      }
    });
    
    audioEl.addEventListener("suspend", () => {
      console.log("Audio suspended (normal for streaming)");
    });
    
    // Progress Event für Buffer-Monitoring
    audioEl.addEventListener("progress", () => {
      if (audioEl.buffered.length > 0) {
        const bufferedEnd = audioEl.buffered.end(audioEl.buffered.length - 1);
        const currentTime = audioEl.currentTime;
        const bufferedAhead = bufferedEnd - currentTime;
        
        // Log nur bei wenig Buffer (< 5 Sekunden)
        if (bufferedAhead < 5) {
          console.log(`Buffer: ${bufferedAhead.toFixed(1)}s ahead`);
        }
      }
    });
    
    // Reconnect Logic
    function attemptReconnect() {
      if (streamDetached) return;       // user paused intentionally
      if (!currentStation || reconnectAttempts >= maxReconnectAttempts) {
        if (reconnectAttempts >= maxReconnectAttempts) {
          console.log("Max reconnect attempts reached");
          // Stream is dead → mark and either skip or stop
          markStationDeadAndSkip('reconnect exhausted (' + maxReconnectAttempts + ' tries)');
        }
        return;
      }
      
      reconnectAttempts++;
      console.log(`Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
      
      stationInfoEl.textContent = `🔄 Neuverbindung (${reconnectAttempts}/${maxReconnectAttempts})...`;
      
      // Clear existing timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 4000);
      
      reconnectTimeout = setTimeout(() => {
        if (currentStation) {
          console.log("Attempting to reconnect stream...");
          const wasPlaying = !audioEl.paused;
          
          audioEl.src = currentStation.streamUrl;
          
          if (wasPlaying) {
            audioEl.play().catch(err => {
              console.error("Reconnect play failed:", err);
              stationInfoEl.textContent = "❌ Wiedergabe fehlgeschlagen";
            });
          }
        }
      }, delay);
    }
    
    // Wake Lock API - verhindert Sleep auf Mobile
    async function requestWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Wake Lock activated');
          
          wakeLock.addEventListener('release', () => {
            console.log('Wake Lock released');
          });
        } catch (err) {
          console.log('Wake Lock failed:', err);
        }
      }
    }
    
    function releaseWakeLock() {
      if (wakeLock) {
        wakeLock.release().then(() => {
          wakeLock = null;
        });
      }
    }
    
    // Heartbeat Monitor - prüft ob Stream noch läuft
    function startStreamHeartbeat() {
      stopStreamHeartbeat();
      
      // Bluetooth+CarPlay: Ultra-conservative to avoid rhythmic interruptions
      // CarPlay alone: 15s, Bluetooth: 10s, Both: 20s, Normal: 5s
      const interval = (isCarPlay && isBluetoothAudio) ? 20000 : 
                       isCarPlay ? 15000 : 
                       isBluetoothAudio ? 10000 : 5000;
      let stalledCount = 0;
      
      heartbeatInterval = setInterval(() => {
        if (!currentStation || audioEl.paused) return;
        
        const currentTime = audioEl.currentTime;
        
        // Check ob Playback fortschreitet
        if (currentTime === lastPlaybackTime && !isBuffering) {
          stalledCount++;
          console.warn(`Stream stalled for ${stalledCount * (interval/1000)}s`);
          
          // External audio: Nur nach vielen Stalls reconnecten (vermeidet false positives)
          // CarPlay+Bluetooth: 5 checks (100s), CarPlay: 3 checks (45s), Bluetooth: 2 checks (20s), Normal: 1 check
          const stallThreshold = (isCarPlay && isBluetoothAudio) ? 5 : 
                                 isCarPlay ? 3 : 
                                 isBluetoothAudio ? 2 : 1;
          
          if (stalledCount >= stallThreshold && !audioEl.paused && audioEl.readyState < 3) {
            console.log('Stream definitely stalled - attempting reconnect');
            stalledCount = 0;
            attemptReconnect();
          }
        } else {
          stalledCount = 0; // Reset bei normalem Fortschritt
        }
        
        lastPlaybackTime = currentTime;
        
        // Buffer Health (skip für external audio - kann false positives geben)
        if (!isExternalAudio() && audioEl.buffered.length > 0) {
          const bufferedEnd = audioEl.buffered.end(audioEl.buffered.length - 1);
          const bufferedAhead = bufferedEnd - currentTime;
          if (bufferedAhead < 2) {
            console.warn(`Low buffer: ${bufferedAhead.toFixed(1)}s`);
          }
        }
      }, interval);
      
      console.log('Stream heartbeat monitor started');
    }
    
    function stopStreamHeartbeat() {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        console.log('Stream heartbeat monitor stopped');
      }
    }
    
    // Aktiviere Wake Lock beim Abspielen
    audioEl.addEventListener("playing", () => {
      if (currentStation) {
        stationInfoEl.textContent = `🎶 ${currentStation.genre} · ${currentStation.bitrate}kbps`;
      }
      requestWakeLock();
      startStreamHeartbeat(); // Monitor stream health
    });
    
    // Release Wake Lock bei Pause
    audioEl.addEventListener("pause", () => {
      releaseWakeLock();
      stopStreamHeartbeat(); // Stop monitoring
    });
    
    // Visibility Change - behält Streaming bei Tab-Wechsel
    // Page Lifecycle API - für Mobile Browser
    // Freeze: Browser friert Page ein (z.B. bei Tab-Wechsel auf Mobile)
    document.addEventListener('freeze', () => {
      console.log('Page frozen - persisting state');
      // Audio soll weiterlaufen trotz Freeze
      if (currentStation && !audioEl.paused) {
        console.log('Maintaining audio during freeze');
      }
    }, { capture: true });
    
    // Resume: Page wird wieder aktiv
    document.addEventListener('resume', () => {
      console.log('Page resumed - restoring state');
      
      // AudioContext reaktivieren
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Stream prüfen
      if (currentStation && audioEl.paused) {
        console.log('Attempting to resume stream after freeze');
        audioEl.play().catch(err => {
          console.error('Resume after freeze failed:', err);
          attemptReconnect();
        });
      }
      
      // Wake Lock neu anfordern
      if (currentStation && !audioEl.paused) {
        requestWakeLock();
      }
    }, { capture: true });
    
    // Online/Offline Detection
    window.addEventListener('online', () => {
      console.log('Network online');
      if (currentStation && audioEl.paused && coverEl.classList.contains("playing")) {
        console.log('Attempting to resume after reconnect');
        attemptReconnect();
      }
    });
    
    window.addEventListener('offline', () => {
      console.log('Network offline');
      stationInfoEl.textContent = "📡 Keine Verbindung";
    });

    // --- EVENT LISTENERS ---
    // Expose global references so DOMContentLoaded handlers can reach IIFE state
    window._triggerSearch  = searchShoutcastStations;
    window._selectStation  = (idx) => {
      if (displayedStations[idx]) selectStation(displayedStations[idx], idx);
    };
    // Expose displayedStations (let-scoped, not on window by default)
    // selectStation is already a global function declaration — no need to expose
    try {
      Object.defineProperty(window, 'displayedStations', { get: () => displayedStations, configurable: true });
    } catch(e) { /* already defined */ }

    searchBtn.addEventListener("click", searchShoutcastStations);

    searchInput.addEventListener("input", () => {
      const text = searchInput.value;
      // Sync sibling inputs without re-triggering this handler
      if (window._setRetroSearch) window._setRetroSearch(text, true);
      if (window._setGlobeSearch) window._setGlobeSearch(text, true);
      clearTimeout(searchInput._debounce);
      searchInput._debounce = setTimeout(() => {
        if (allStations.length > 0 || text.length > 2) searchShoutcastStations();
      }, 500);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); searchShoutcastStations(); }
    });

    subgenreSelect.addEventListener("change", () => {
      if (allStations.length > 0) {
        searchShoutcastStations();
      }
    });

    // countryFilter change is now handled inline per checkbox/tag (no separate listener needed)

    showFavoritesBtn.addEventListener("click", () => {
      showOnlyFavorites = !showOnlyFavorites;
      
      if (showOnlyFavorites) {
        showFavoritesBtn.classList.add("active");
        showFavoritesBtn.textContent = "⭐ Alle zeigen";
      } else {
        showFavoritesBtn.classList.remove("active");
        showFavoritesBtn.textContent = "⭐ Favoriten";
      }
      
      // Wenn noch keine Sender geladen, erst suchen
      if (allStations.length === 0) {
        searchShoutcastStations();
      } else {
        sortAndRenderStations();
      }
    });

    resetFiltersBtn.addEventListener("click", () => {
      genreSelect.value = "rock";
      subgenreSelect.value = "";
      searchInput.value = "";
      setSelectedCountries([]);
      showOnlyFavorites = false;
      showFavoritesBtn.classList.remove("active");
      showFavoritesBtn.textContent = "⭐ Favoriten";
      searchShoutcastStations();
    });

    loadMoreBtn.addEventListener("click", () => {
      displayLimit += 20;
      renderStations();
      // Pre-fetch next batch silently in the background
      prefetchMoreStations();
    });

    // ── BACKGROUND STATION PRE-FETCHER ────────────────────────────────────────
    // Strategy: The Radio Browser API returns up to 1000 results per call.
    // We already have those in allStations. When the user scrolls near the end
    // of the displayed list, we silently fetch the *next* page (offset-based)
    // during browser idle time so it's ready instantly when needed.
    // Uses requestIdleCallback so it never blocks the main thread.

    let bgFetchOffset = 1000;      // Start after what we already have
    let bgFetchInProgress = false;
    let bgFetchExhausted = false;
    const BG_FETCH_BATCH = 500;    // Fetch 500 at a time in background
    const BG_PREFETCH_THRESHOLD = 40; // Trigger when user has seen ≥40 stations

    function prefetchMoreStations() {
      // Don't pre-fetch if: already running, exhausted, or no search context
      if (bgFetchInProgress || bgFetchExhausted) return;
      // Only pre-fetch when user has consumed a meaningful portion
      if (displayLimit < BG_PREFETCH_THRESHOLD) return;

      const schedule = window.requestIdleCallback || (cb => setTimeout(cb, 200));
      schedule(() => _doBackgroundFetch(), { timeout: 3000 });
    }

    async function _doBackgroundFetch() {
      if (bgFetchInProgress || bgFetchExhausted) return;
      bgFetchInProgress = true;

      try {
        const genre    = genreSelect.value;
        const subgenre = subgenreSelect.value;
        const search   = searchInput.value.trim();

        let url = 'https://de1.api.radio-browser.info/json/stations/search?';
        const params = [];
        if (subgenre)  params.push(`tag=${encodeURIComponent(subgenre)}`);
        else if (genre) params.push(`tag=${encodeURIComponent(genre)}`);
        if (search)    params.push(`name=${encodeURIComponent(search)}`);
        params.push(`limit=${BG_FETCH_BATCH}`);
        params.push(`offset=${bgFetchOffset}`);
        params.push('order=votes');
        params.push('reverse=true');
        params.push('hidebroken=true');
        params.push('codec=MP3');
        url += params.join('&');

        console.log(`[BG] Pre-fetching stations offset=${bgFetchOffset}…`);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('BG fetch failed');

        const data = await resp.json();
        if (!data.length) {
          bgFetchExhausted = true;
          console.log('[BG] No more stations available');
          return;
        }

        const existingIds = new Set(allStations.map(s => s.id));
        let added = 0;
        data.forEach(station => {
          const id = station.stationuuid;
          if (existingIds.has(id)) return;

          const url = station.url_resolved || station.url || '';
          // Filter playlist files + last-check-failed stations
          if (!url) return;
          if (/\.(pls|m3u8?|asx|xspf)(\?|$)/i.test(url)) return;
          if (station.lastcheckok !== undefined && station.lastcheckok === 0) return;

          allStations.push({
            id,
            name:       station.name,
            streamUrl:  url,
            genre:      station.tags ? station.tags.split(',')[0].trim() : 'unknown',
            country:    station.country || 'Unknown',
            bitrate:    station.bitrate || 0,
            votes:      station.votes || 0,
            listeners:  station.clickcount || 0,
            logoText:   station.name.substring(0, 2).toUpperCase(),
            favicon:    station.favicon || null,
            latitude:   parseFloat(station.geo_lat)  || null,
            longitude:  parseFloat(station.geo_long) || null,
            distance:   null
          });
          added++;
        });

        bgFetchOffset += BG_FETCH_BATCH;
        console.log(`[BG] Added ${added} stations → total ${allStations.length}`);

        // Recalculate distances for new stations only (cheap – no re-render)
        if (added > 0) calculateAllDistances();

        // If still near the end after adding, schedule another fetch
        if (displayLimit >= allStations.length - 60) {
          prefetchMoreStations();
        }
      } catch (err) {
        console.warn('[BG] Pre-fetch error:', err);
      } finally {
        bgFetchInProgress = false;
      }
    }

    // Reset bg-fetch state when user performs a new search
    const _origSearch = searchShoutcastStations;
    searchShoutcastStations = async function(...args) {
      bgFetchOffset    = 1000;
      bgFetchInProgress = false;
      bgFetchExhausted  = false;
      return _origSearch.apply(this, args);
    };

    // --- PWA ---
    let deferredPrompt;
    const installBtn = document.getElementById('installBtn');
    const pwaStatus = document.getElementById('pwaStatus');

    function initPWA() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
          .then(reg => {
            pwaStatus.textContent = '✓ PWA';
            // Force update check on every load
            reg.update().catch(() => {});
          })
          .catch(() => pwaStatus.textContent = '');
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = 'block';
      });

      installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          installBtn.style.display = 'none';
          pwaStatus.textContent = '✓ Installiert';
        }
        deferredPrompt = null;
      });

      if (window.matchMedia('(display-mode: standalone)').matches) {
        pwaStatus.textContent = '✓ Standalone';
        installBtn.style.display = 'none';
      }
    }

    // --- INIT ---
    audioEl.volume = 0.7;
    getUserLocation();
    renderHistory();
    updateDataUsageDisplay(); // Init data usage display
    
    // Trigger Subgenre-Füllung
    genreSelect.dispatchEvent(new Event('change'));
    
    window.addEventListener('load', () => {
      initPWA();
      setTimeout(searchShoutcastStations, 500);
    });

    window.addEventListener('beforeunload', () => {
      endListeningSession();
      stopDataTracking();
    });

    // --- SETTINGS PANEL ---
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const closeSettings = document.getElementById('closeSettings');
    const donateBtn = document.getElementById('donateBtn');
    const themeOptions = document.querySelectorAll('.theme-option');
    const languageSelect = document.getElementById('languageSelect');

    // Open Settings
    function openSettings() {
      // Close legal overlay if open
      const legalOverlay = document.getElementById('legalOverlay');
      if (legalOverlay && !legalOverlay.hidden) legalOverlay.hidden = true;
      
      settingsPanel.classList.add('open');
      settingsOverlay.classList.add('show');
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    // Close Settings
    function closeSettingsPanel() {
      settingsPanel.classList.remove('open');
      settingsOverlay.classList.remove('show');
      document.body.style.overflow = ''; // Restore scroll
    }

    settingsBtn.addEventListener('click', openSettings);
    closeSettings.addEventListener('click', closeSettingsPanel);
    settingsOverlay.addEventListener('click', () => {
      closeSettingsPanel();
      closeToolsPanel();
    });

    // ── Collapsible settings sections toggle (Accordion mode) ─────────────────
    document.querySelectorAll('.settings-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.settings-section');
        const isOpen = section.classList.contains('open');

        // Close all sections in settingsPanel
        document.querySelectorAll('#settingsPanel .settings-section').forEach(s => {
          s.classList.remove('open');
        });

        // Toggle open this section if it was closed
        if (!isOpen) {
          section.classList.add('open');
        }
      });
    });

    // ── Tools Panel (Sleep / Shuffle / Data) ──────────────────────────────────
    const toolsBtn   = document.getElementById('toolsBtn');
    const toolsPanel = document.getElementById('toolsPanel');
    const closeTools = document.getElementById('closeTools');

    function openToolsPanel() {
      if (settingsPanel.classList.contains('open')) closeSettingsPanel();
      if (toolsPanel) toolsPanel.classList.add('open');
      settingsOverlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    }

    function closeToolsPanel() {
      if (toolsPanel) toolsPanel.classList.remove('open');
      settingsOverlay.classList.remove('show');
      document.body.style.overflow = '';
    }

    if (toolsBtn) toolsBtn.addEventListener('click', openToolsPanel);
    if (closeTools) closeTools.addEventListener('click', closeToolsPanel);

    // Auto-skip dead-stations toggle
    const autoSkipToggle = document.getElementById('autoSkipDeadToggle');
    if (autoSkipToggle) {
      autoSkipToggle.checked = window._getAutoSkipDead ? window._getAutoSkipDead() : true;
      autoSkipToggle.addEventListener('change', () => {
        if (window._setAutoSkipDead) window._setAutoSkipDead(autoSkipToggle.checked);
      });
    }

    // Station limit select setting
    const stationLimitSelect = document.getElementById('stationLimitSelect');
    if (stationLimitSelect) {
      stationLimitSelect.value = localStorage.getItem('brummiesStationLimit') || '300';
      stationLimitSelect.addEventListener('change', () => {
        localStorage.setItem('brummiesStationLimit', stationLimitSelect.value);
        displayLimit = getStationLimit();
        sortAndRenderStations();
        if (window._djSyncStations) window._djSyncStations();
      });
    }

    // Close on ESC key
    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    (function initKeyboardShortcuts() {
      // Toast helper
      const kbToast = document.getElementById('kbToast');
      let kbToastTimer = null;
      function showToast(msg) {
        if (!kbToast) return;
        kbToast.textContent = msg;
        kbToast.classList.add('show');
        clearTimeout(kbToastTimer);
        kbToastTimer = setTimeout(() => kbToast.classList.remove('show'), 1600);
      }

      // Mute state tracker (separate from volume slider)
      let mutedVol = null; // volume before muting

      document.addEventListener('keydown', (e) => {
        // Always: Escape closes settings
        if (e.key === 'Escape') {
          if (settingsPanel.classList.contains('open')) closeSettingsPanel();
          return;
        }

        // Ignore shortcuts when user is typing in an input / textarea / select
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        // Also ignore when a modifier key is held (browser shortcuts, etc.)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        switch (e.key) {
          // ── Play / Pause ───────────────────────────────────────────────────
          case ' ':
          case 'k':
            e.preventDefault();
            if (!currentStation) return;
            if (audioEl.paused) {
              playBtn.click();
              showToast('▶ Play');
            } else {
              playBtn.click();
              showToast('⏸ Pause');
            }
            break;

          // ── Previous / Next station ────────────────────────────────────────
          case 'ArrowLeft':
            e.preventDefault();
            if (!prevBtn.disabled) { prevBtn.click(); showToast('⏮ Vorheriger Sender'); }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (!nextBtn.disabled) { nextBtn.click(); showToast('⏭ Nächster Sender'); }
            break;

          // ── Volume up / down ───────────────────────────────────────────────
          case 'ArrowUp': {
            e.preventDefault();
            if (!volumeRange) return;
            const newVol = Math.min(100, Number(volumeRange.value) + 5);
            volumeRange.value = newVol;
            volumeRange.dispatchEvent(new Event('input'));
            showToast(`🔊 ${newVol} %`);
            break;
          }
          case 'ArrowDown': {
            e.preventDefault();
            if (!volumeRange) return;
            const newVol = Math.max(0, Number(volumeRange.value) - 5);
            volumeRange.value = newVol;
            volumeRange.dispatchEvent(new Event('input'));
            showToast(`🔉 ${newVol} %`);
            break;
          }

          // ── Mute / Unmute ──────────────────────────────────────────────────
          case 'm':
          case 'M':
            if (!volumeRange) return;
            if (mutedVol === null) {
              // Mute: remember current volume, set to 0
              mutedVol = Number(volumeRange.value);
              volumeRange.value = 0;
              volumeRange.dispatchEvent(new Event('input'));
              showToast('🔇 Stummgeschaltet');
            } else {
              // Unmute: restore
              volumeRange.value = mutedVol;
              volumeRange.dispatchEvent(new Event('input'));
              showToast(`🔊 ${mutedVol} %`);
              mutedVol = null;
            }
            break;

          // ── Favourite toggle ───────────────────────────────────────────────
          case 'f':
          case 'F':
            if (!currentStation) return;
            toggleFavorite(currentStation.id);
            showToast(favorites.includes(currentStation.id) ? '⭐ Favorit hinzugefügt' : '☆ Favorit entfernt');
            break;
        }
      });
    })();

    // ── Tuner / Dial View ─────────────────────────────────────────────────────
    (function initTunerView() {
      const tunerViewEl    = document.getElementById('tunerView');
      const stationsListEl2 = document.getElementById('stationsList');
      const loadMoreBtn2   = document.getElementById('loadMoreBtn');
      const viewListBtn    = document.getElementById('viewListBtn');
      const viewTunerBtn   = document.getElementById('viewTunerBtn');
      const tunerTicksEl   = document.getElementById('tunerTicks');
      const tunerNameEl    = document.getElementById('tunerStationName');
      const tunerMetaEl    = document.getElementById('tunerStationMeta');
      const tunerModeEl    = document.getElementById('tunerScaleMode');
      const tunerKnobEl    = document.getElementById('tunerKnob');

      if (!tunerViewEl || !tunerKnobEl) return;

      const TICK_W         = 72;   // px per tick
      const DEG_PER_TICK   = 18;   // knob degrees per station step
      const PX_PER_STATION = 30;   // horizontal pixels to drag per station step
      let tunerActive      = false;
      let tunerIndex       = 0;
      let knobDeg          = 0;    // visual rotation of knob
      let isDragging       = false;
      let dragStartX       = 0;
      let dragStartIdx     = 0;    // station index at drag start
      let dragStartDeg     = 0;

      // ── Scale label per sort mode ───────────────────────────────────────────
      const SCALE_LABELS = {
        distance: 'Entfernung',
        votes:    'Zuhörer',
        bitrate:  'Bitrate',
        name:     'Alphabetisch',
        favorites:'Favoriten',
      };

      function tickLabel(st) {
        const sort = currentSort.find(s => s !== 'favorites') || currentSort[0] || 'name';
        switch (sort) {
          case 'distance': return st.distance != null ? Math.round(st.distance) + ' km' : '—';
          case 'votes':    return st.votes > 999 ? (st.votes / 1000).toFixed(1) + 'k' : String(st.votes);
          case 'bitrate':  return st.bitrate ? st.bitrate + 'k' : '?';
          default:         return st.name.charAt(0).toUpperCase();
        }
      }

      // ── Build / refresh scale ───────────────────────────────────────────────
      function buildScale() {
        tunerTicksEl.innerHTML = '';
        const stations = displayedStations;
        if (!stations.length) return;

        const sort = currentSort.find(s => s !== 'favorites') || currentSort[0] || 'name';
        if (tunerModeEl) tunerModeEl.textContent = SCALE_LABELS[sort] || '';

        stations.forEach((st, i) => {
          const tick = document.createElement('div');
          const dist = Math.abs(i - tunerIndex);
          tick.className = 'tuner-tick' + (i === tunerIndex ? ' active' : dist === 1 ? ' near' : '');

          const mark  = document.createElement('div');
          mark.className = 'tuner-tick-mark';

          const label = document.createElement('div');
          label.className = 'tuner-tick-label';
          label.textContent = tickLabel(st);

          tick.appendChild(mark);
          tick.appendChild(label);
          tick.addEventListener('click', () => commitStation(i));
          tunerTicksEl.appendChild(tick);
        });

        positionScale(false);
        updateDisplay();
      }

      function positionScale(animate) {
        if (!animate) tunerTicksEl.style.transition = 'none';
        const wrapW  = tunerTicksEl.parentElement.offsetWidth;
        const offset = Math.round(wrapW / 2 - tunerIndex * TICK_W - TICK_W / 2);
        tunerTicksEl.style.transform = `translateX(${offset}px)`;
        if (!animate) {
          // Force reflow then re-enable transition
          void tunerTicksEl.offsetWidth;
          tunerTicksEl.style.transition = '';
        }

        tunerTicksEl.querySelectorAll('.tuner-tick').forEach((t, i) => {
          const dist = Math.abs(i - tunerIndex);
          t.className = 'tuner-tick' + (i === tunerIndex ? ' active' : dist === 1 ? ' near' : '');
        });
      }

      function updateDisplay() {
        const st = displayedStations[tunerIndex];
        if (!st) { tunerNameEl.textContent = '— Sender wählen —'; tunerMetaEl.textContent = ''; return; }
        tunerNameEl.textContent = st.name;
        tunerMetaEl.textContent = [st.genre, st.country, st.bitrate ? st.bitrate + ' kbps' : ''].filter(Boolean).join(' · ');
      }

      // ── Noise burst ─────────────────────────────────────────────────────────
      function playNoise() {
        if (!audioContext) return;
        try {
          const sr   = audioContext.sampleRate;
          const dur  = 0.18;
          const buf  = audioContext.createBuffer(1, sr * dur, sr);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.25;

          const src = audioContext.createBufferSource();
          src.buffer = buf;

          const bpf = audioContext.createBiquadFilter();
          bpf.type = 'bandpass';
          bpf.frequency.value = 2200;
          bpf.Q.value = 0.6;

          const env = audioContext.createGain();
          const t0  = audioContext.currentTime;
          env.gain.setValueAtTime(0, t0);
          env.gain.linearRampToValueAtTime(0.45, t0 + 0.04);
          env.gain.linearRampToValueAtTime(0, t0 + dur);

          src.connect(bpf);
          bpf.connect(env);
          env.connect(audioContext.destination);
          src.start();
        } catch (_) {}
      }

      // ── Navigate to index (preview while dragging) ──────────────────────────
      let noiseDebounce = null;
      function previewStation(idx) {
        const stations = displayedStations;
        if (!stations.length) return;
        idx = Math.max(0, Math.min(stations.length - 1, idx));
        if (idx === tunerIndex) return;
        tunerIndex = idx;
        positionScale(true);
        updateDisplay();
        clearTimeout(noiseDebounce);
        noiseDebounce = setTimeout(playNoise, 30);
      }

      // ── Commit: actually play station ───────────────────────────────────────
      function commitStation(idx) {
        const stations = displayedStations;
        if (!stations.length) return;
        idx = Math.max(0, Math.min(stations.length - 1, idx));
        tunerIndex = idx;
        knobDeg    = idx * DEG_PER_TICK;
        tunerKnobEl.style.transform = `rotate(${knobDeg}deg)`;
        positionScale(true);
        updateDisplay();
        const st = stations[idx];
        if (st) selectStation(st, idx);
      }

      // ── Knob drag (angular – incremental accumulation, no 180° wrap jump) ────
      let dragLastAngle  = 0;   // angle at the PREVIOUS frame
      let dragTotalDelta = 0;   // accumulated rotation since dragStart

      function pointerAngle(e) {
        const rect = tunerKnobEl.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  + rect.height / 2;
        const p    = e.touches ? e.touches[0] : e;
        return Math.atan2(p.clientY - cy, p.clientX - cx) * (180 / Math.PI);
      }

      function dragStart(e) {
        isDragging      = true;
        dragLastAngle   = pointerAngle(e);
        dragTotalDelta  = 0;
        dragStartDeg    = knobDeg;
        dragStartIdx    = tunerIndex;
        e.preventDefault();
      }

      function dragMove(e) {
        if (!isDragging) return;
        const angle = pointerAngle(e);
        // Frame-to-frame increment – small, so [-180,+180] normalisation is safe
        let inc = angle - dragLastAngle;
        if (inc >  180) inc -= 360;   // crossed ±180° boundary clockwise
        if (inc < -180) inc += 360;   // crossed ±180° boundary counter-clockwise
        dragLastAngle   = angle;
        dragTotalDelta += inc;

        knobDeg = dragStartDeg + dragTotalDelta;
        tunerKnobEl.style.transform = `rotate(${knobDeg}deg)`;
        const steps  = dragTotalDelta / DEG_PER_TICK;
        const newIdx = Math.max(0, Math.min(
          displayedStations.length - 1,
          Math.round(dragStartIdx + steps)
        ));
        previewStation(newIdx);
        e.preventDefault();
      }

      function dragEnd() {
        if (!isDragging) return;
        isDragging = false;
        commitStation(tunerIndex);
      }

      tunerKnobEl.addEventListener('mousedown',  dragStart);
      document.addEventListener('mousemove',     dragMove);
      document.addEventListener('mouseup',       dragEnd);
      tunerKnobEl.addEventListener('touchstart', dragStart, { passive: false });
      document.addEventListener('touchmove',     dragMove,  { passive: false });
      document.addEventListener('touchend',      dragEnd);

      // Expose so auto-skip can drive the knob + scale visually
      window._tunerGoTo = function(idx) {
        if (!tunerActive) return;
        idx = Math.max(0, Math.min(displayedStations.length - 1, idx));
        tunerIndex = idx;
        knobDeg    = idx * DEG_PER_TICK;
        tunerKnobEl.style.transform = `rotate(${knobDeg}deg)`;
        positionScale(true);
        updateDisplay();
      };

      // ── View toggle ──────────────────────────────────────────────────────────
      function showTuner() {
        tunerActive = true;
        if (window._globeHide) window._globeHide();
        tunerViewEl.hidden    = false;
        stationsListEl2.style.display = 'none';
        if (loadMoreBtn2) loadMoreBtn2.style.display = 'none';
        buildScale();
        if (window.lucide) lucide.createIcons();
      }

      function showList() {
        tunerActive = false;
        if (window._globeHide) window._globeHide();
        tunerViewEl.hidden    = true;
        stationsListEl2.style.display = '';
        if (loadMoreBtn2) loadMoreBtn2.style.display = '';
        if (window.lucide) lucide.createIcons();
      }

      window._showList  = showList;
      window._showTuner = showTuner;

      // Rebuild when station list changes
      window._tunerRefresh = function() {
        tunerIndex = Math.min(tunerIndex, Math.max(0, displayedStations.length - 1));
        if (tunerActive) buildScale();
        if (retroActive) { buildRetroScale(); syncRetroDisplay(); }
      };

      // ══════════════════════════════════════════════════════════════════════
      // RETRO RADIO FULLSCREEN
      // ══════════════════════════════════════════════════════════════════════
      const retroRadioEl      = document.getElementById('retroRadio');
      const retroExpandBtn    = document.getElementById('retroExpandBtn');
      const retroExitBtn      = document.getElementById('retroExitBtn');
      const retroTicksEl      = document.getElementById('retroTicks');
      const retroTrackEl      = document.getElementById('retroTrack');
      const retroNameEl       = document.getElementById('retroStationName');
      const retroMetaEl       = document.getElementById('retroStationMeta');
      const retroNowPlayEl    = document.getElementById('retroNowPlaying');
      const retroTuneKnobEl   = document.getElementById('retroTuneKnob');
      const retroVolKnobEl    = document.getElementById('retroVolKnob');
      const retroPlayBtn      = document.getElementById('retroPlayBtn');
      const retroPrevBtn      = document.getElementById('retroPrevBtn');
      const retroNextBtn      = document.getElementById('retroNextBtn');
      const retroHttpsBtn     = document.getElementById('retroHttpsBtn');
      const retroHttpsStateEl = document.getElementById('retroHttpsState');
      const retroStationIconEl= document.getElementById('retroStationIcon');
      const retroSubBandsEl   = document.getElementById('retroSubBands');
      const retroVisCvs       = document.getElementById('retroVisualizer');
      const retroEqBtnsEl     = document.getElementById('retroEqBtns');
      const retroSearchInput  = document.getElementById('retroSearchInput');
      const bandBtns          = document.querySelectorAll('.band-btn');

      if (!retroRadioEl) return; // safety

      let retroActive    = false;
      let retroKnobDeg   = 0;
      let retroVolDeg    = 0;
      let retroVisRAF    = null;
      let retroSearchText = '';

      function getRetroStations() {
        if (!retroSearchText) return displayedStations;
        const q = retroSearchText.toLowerCase();
        return displayedStations.filter(s =>
          s.name.toLowerCase().includes(q) ||
          (s.genre || '').toLowerCase().includes(q) ||
          (s.country || '').toLowerCase().includes(q)
        );
      }

      // ── Retro scale (mirrors main scale but in retroTicks) ────────────────
      function buildRetroScale() {
        retroTicksEl.innerHTML = '';
        const stations = getRetroStations();
        if (!stations.length) {
          if (retroSearchText) {
            const msg = document.createElement('div');
            msg.style.cssText = 'padding:8px 16px;color:var(--color-text-muted);font-size:12px;';
            msg.textContent = 'Keine Treffer';
            retroTicksEl.appendChild(msg);
          }
          return;
        }
        const retroActiveIdx = stations.indexOf(displayedStations[tunerIndex]);
        stations.forEach((st, i) => {
          const tick = document.createElement('div');
          const dist = Math.abs(i - retroActiveIdx);
          tick.className = 'tuner-tick' + (i === retroActiveIdx ? ' active' : dist === 1 ? ' near' : '');
          const mark  = document.createElement('div');
          mark.className = 'tuner-tick-mark';
          const label = document.createElement('div');
          label.className = 'tuner-tick-label';
          label.textContent = tickLabel(st);
          tick.appendChild(mark); tick.appendChild(label);
          tick.addEventListener('click', () => {
            const realIdx = displayedStations.indexOf(st);
            commitStation(realIdx >= 0 ? realIdx : 0);
          });
          retroTicksEl.appendChild(tick);
        });
        positionRetroScale(false);
      }

      function positionRetroScale(animate) {
        if (!animate) retroTicksEl.style.transition = 'none';
        const wrapW  = retroTrackEl.offsetWidth;
        const offset = Math.round(wrapW / 2 - tunerIndex * TICK_W - TICK_W / 2);
        retroTicksEl.style.transform = `translateX(${offset}px)`;
        if (!animate) { void retroTicksEl.offsetWidth; retroTicksEl.style.transition = ''; }
        retroTicksEl.querySelectorAll('.tuner-tick').forEach((t, i) => {
          const dist = Math.abs(i - tunerIndex);
          t.className = 'tuner-tick' + (i === tunerIndex ? ' active' : dist === 1 ? ' near' : '');
        });
      }

      // Keep retro scale in sync whenever main scale moves
      const _origPositionScale = positionScale;
      // Monkey-patch positionScale so retro follows automatically
      const _patchedPositionScale = function(animate) {
        _origPositionScale(animate);
        if (retroActive) positionRetroScale(animate);
      };
      // Swap reference
      window._retroSyncScale = () => { if (retroActive) positionRetroScale(true); };

      // ── Display sync ──────────────────────────────────────────────────────
      function syncRetroDisplay() {
        const st = displayedStations[tunerIndex];
        retroNameEl.textContent   = st ? st.name : '— Sender wählen —';
        retroMetaEl.textContent   = st ? [st.genre, st.country, st.bitrate ? st.bitrate + ' kbps' : ''].filter(Boolean).join(' · ') : '';
        retroKnobDeg = tunerIndex * DEG_PER_TICK;
        retroTuneKnobEl.style.transform = `rotate(${retroKnobDeg}deg)`;
        // Station icon
        if (retroStationIconEl) {
          const favicon = st && st.favicon ? st.favicon : '';
          retroStationIconEl.src = favicon;
          retroStationIconEl.style.display = favicon ? 'block' : 'none';
        }
      }

      // Sync Now-Playing metadata into retro display
      window._retroSyncNP = function(text) {
        if (retroNowPlayEl) retroNowPlayEl.textContent = text || '—';
      };

      // ── Tuning knob in retro panel ────────────────────────────────────────
      let retroDragging     = false;
      let retroDragLastAng  = 0;
      let retroDragTotalDlt = 0;
      let retroDragStartDeg = 0;
      let retroDragStartIdx = 0;

      function retroPointerAngle(e) {
        const rect = retroTuneKnobEl.getBoundingClientRect();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;
        const p  = e.touches ? e.touches[0] : e;
        return Math.atan2(p.clientY - cy, p.clientX - cx) * 180 / Math.PI;
      }
      function retroDragStart(e) {
        retroDragging      = true;
        retroDragLastAng   = retroPointerAngle(e);
        retroDragTotalDlt  = 0;
        retroDragStartDeg  = retroKnobDeg;
        retroDragStartIdx  = tunerIndex;
        e.preventDefault();
      }
      function retroDragMove(e) {
        if (!retroDragging) return;
        const ang = retroPointerAngle(e);
        let inc = ang - retroDragLastAng;
        if (inc >  180) inc -= 360;
        if (inc < -180) inc += 360;
        retroDragLastAng   = ang;
        retroDragTotalDlt += inc;
        retroKnobDeg = retroDragStartDeg + retroDragTotalDlt;
        retroTuneKnobEl.style.transform = `rotate(${retroKnobDeg}deg)`;
        // Also rotate main knob
        knobDeg = retroKnobDeg;
        tunerKnobEl.style.transform = `rotate(${knobDeg}deg)`;
        const steps  = retroDragTotalDlt / DEG_PER_TICK;
        const newIdx = Math.max(0, Math.min(displayedStations.length - 1, Math.round(retroDragStartIdx + steps)));
        previewStation(newIdx);
        positionRetroScale(true);
        e.preventDefault();
      }
      function retroDragEnd() {
        if (!retroDragging) return;
        retroDragging = false;
        commitStation(tunerIndex);
        syncRetroDisplay();
      }
      retroTuneKnobEl.addEventListener('mousedown',  retroDragStart);
      document.addEventListener('mousemove',  (e) => { if (retroDragging) retroDragMove(e); });
      document.addEventListener('mouseup',    ()  => { if (retroDragging) retroDragEnd();   });
      retroTuneKnobEl.addEventListener('touchstart', retroDragStart, { passive: false });
      document.addEventListener('touchmove',  (e) => { if (retroDragging) retroDragMove(e); }, { passive: false });
      document.addEventListener('touchend',   ()  => { if (retroDragging) retroDragEnd();   });

      // ── Volume knob ───────────────────────────────────────────────────────
      let volDragging    = false;
      let volDragLastAng = 0;
      let volDragTotal   = 0;
      let volDragStartDeg= 0;
      const VOL_RANGE    = 270; // degrees for 0..100%

      function volPointerAngle(e) {
        const rect = retroVolKnobEl.getBoundingClientRect();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;
        const p  = e.touches ? e.touches[0] : e;
        return Math.atan2(p.clientY - cy, p.clientX - cx) * 180 / Math.PI;
      }
      function setVolFromDeg(deg) {
        // Clamp to -135..+135
        const clamped = Math.max(-135, Math.min(135, deg));
        retroVolDeg = clamped;
        retroVolKnobEl.style.transform = `rotate(${clamped}deg)`;
        const vol = (clamped + 135) / VOL_RANGE;
        const audioEl2 = document.getElementById('radioAudio');
        if (audioEl2) audioEl2.volume = Math.round(vol * 100) / 100;
      }
      function volDragStart(e) {
        volDragging     = true;
        volDragLastAng  = volPointerAngle(e);
        volDragTotal    = 0;
        volDragStartDeg = retroVolDeg;
        e.preventDefault();
      }
      function volDragMove(e) {
        if (!volDragging) return;
        const ang = volPointerAngle(e);
        let inc = ang - volDragLastAng;
        if (inc >  180) inc -= 360;
        if (inc < -180) inc += 360;
        volDragLastAng  = ang;
        volDragTotal   += inc;
        setVolFromDeg(volDragStartDeg + volDragTotal);
        e.preventDefault();
      }
      function volDragEnd() { volDragging = false; }
      retroVolKnobEl.addEventListener('mousedown',  volDragStart);
      document.addEventListener('mousemove',  (e) => { if (volDragging) volDragMove(e); });
      document.addEventListener('mouseup',    ()  => { if (volDragging) volDragEnd();   });
      retroVolKnobEl.addEventListener('touchstart', volDragStart, { passive: false });
      document.addEventListener('touchmove',  (e) => { if (volDragging) volDragMove(e); }, { passive: false });
      document.addEventListener('touchend',   ()  => { if (volDragging) volDragEnd();   });

      // ── Retro Visualizer – oscilloscope waveform ─────────────────────────
      function startRetroVis() {
        if (retroVisRAF) return;
        const cvs = retroVisCvs;
        const ctx = cvs.getContext('2d');
        const W   = cvs.width;
        const H   = cvs.height;
        const mid = H / 2;

        function draw() {
          if (!retroActive) { retroVisRAF = null; return; }
          retroVisRAF = requestAnimationFrame(draw);

          // Phosphor trail effect: semi-transparent clear
          ctx.fillStyle = 'rgba(5, 8, 0, 0.55)';
          ctx.fillRect(0, 0, W, H);

          ctx.lineWidth   = 1.8;
          ctx.shadowBlur  = 5;
          ctx.shadowColor = 'rgba(255,160,30,0.5)';

          if (window._analyser) {
            // ── Real audio: triggered oscilloscope ───────────────────────
            const bufLen = window._analyser.fftSize;
            const buf    = new Uint8Array(bufLen);
            window._analyser.getByteTimeDomainData(buf);

            // Find first rising zero-crossing for stable trigger
            let trig = 0;
            for (let i = 1; i < bufLen - W; i++) {
              if (buf[i - 1] < 128 && buf[i] >= 128) { trig = i; break; }
            }

            ctx.strokeStyle = 'rgba(255,170,40,0.92)';
            ctx.beginPath();
            const step = (bufLen - trig) / W;
            for (let x = 0; x < W; x++) {
              const idx = Math.floor(trig + x * step);
              const y   = ((buf[idx] / 255) * H);
              x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();

          } else {
            // ── Idle: smooth animated sine wave ──────────────────────────
            const t = Date.now() / 700;
            ctx.strokeStyle = 'rgba(255,155,30,0.45)';
            ctx.beginPath();
            for (let x = 0; x < W; x++) {
              const y = mid
                + Math.sin(x * 0.055 + t)          * (H * 0.28)
                + Math.sin(x * 0.021 + t * 0.6)    * (H * 0.10);
              x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
        draw();
      }
      function stopRetroVis() {
        cancelAnimationFrame(retroVisRAF);
        retroVisRAF = null;
        if (retroVisCvs) {
          const ctx = retroVisCvs.getContext('2d');
          ctx.fillStyle = '#050800';
          ctx.fillRect(0, 0, retroVisCvs.width, retroVisCvs.height);
        }
      }

      // ── HTTPS toggle pushbutton ───────────────────────────────────────────
      function syncRetroHttpsBtn() {
        const isOn = document.getElementById('httpsOnlyToggle').checked;
        if (retroHttpsBtn) {
          retroHttpsBtn.classList.toggle('on', isOn);
          if (retroHttpsStateEl) retroHttpsStateEl.textContent = isOn ? 'ON' : 'OFF';
        }
      }
      if (retroHttpsBtn) {
        retroHttpsBtn.addEventListener('click', () => {
          const main = document.getElementById('httpsOnlyToggle');
          main.checked = !main.checked;
          main.dispatchEvent(new Event('change'));
          syncRetroHttpsBtn();
        });
      }

      // ── Retro EQ preset buttons ───────────────────────────────────────────
      if (retroEqBtnsEl) {
        retroEqBtnsEl.querySelectorAll('.retro-eq-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            // Delegate to main EQ preset button
            const mainBtn = document.querySelector(`#eqPresets [data-preset="${btn.dataset.preset}"]`);
            if (mainBtn) mainBtn.click();
            // Visual feedback
            retroEqBtnsEl.querySelectorAll('.retro-eq-btn')
              .forEach(b => b.classList.toggle('active', b === btn));
          });
        });
      }

      // ── Sub-genre band buttons (fixed MAX_SUB_BTNS slots) ────────────────
      function buildSubBands() {
        if (!retroSubBandsEl) return;
        const src = document.getElementById('subgenreSelect');
        const currentSub = src ? src.value : '';
        retroSubBandsEl.innerHTML = '';
        const opts = src ? Array.from(src.options).filter(o => o.value !== '') : [];
        for (let i = 0; i < MAX_SUB_BTNS; i++) {
          const btn = document.createElement('button');
          const opt = opts[i];
          if (opt) {
            btn.className = 'sub-band-btn' + (opt.value === currentSub ? ' active' : '');
            btn.textContent = opt.text.length > 9 ? opt.text.slice(0, 8) + '…' : opt.text;
            btn.dataset.sub = opt.value;
            btn.addEventListener('click', () => {
              const mainSub = document.getElementById('subgenreSelect');
              mainSub.value = opt.value;
              mainSub.dispatchEvent(new Event('change'));
              document.getElementById('searchBtn').click();
              retroSubBandsEl.querySelectorAll('.sub-band-btn')
                .forEach(b => b.classList.toggle('active', b === btn));
            });
          } else {
            // Empty placeholder — occupies space but is not interactive
            btn.className = 'sub-band-btn empty';
            btn.disabled = true;
            btn.setAttribute('aria-hidden', 'true');
            btn.textContent = '';
          }
          retroSubBandsEl.appendChild(btn);
        }
      }

      // ── Genre filter (band buttons only, no selects) ──────────────────────
      function syncRetroGenreOptions() {
        const src = document.getElementById('genreSelect');
        if (!src) return;
        bandBtns.forEach(b => b.classList.toggle('active', b.dataset.genre === src.value));
        // Rebuild sub-bands based on new genre
        requestAnimationFrame(() => {
          buildSubBands();
        });
      }

      // Band preset buttons
      bandBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const genre = btn.dataset.genre;
          const main = document.getElementById('genreSelect');
          main.value = genre;
          main.dispatchEvent(new Event('change'));
          document.getElementById('searchBtn').click();
          bandBtns.forEach(b => b.classList.toggle('active', b === btn));
          // Rebuild sub-bands after genre change (after search updates options)
          setTimeout(buildSubBands, 400);
        });
      });

      // ── Transport buttons ─────────────────────────────────────────────────
      const retroRecBtn = document.getElementById('retroRecBtn');

      retroPlayBtn.addEventListener('click', () => {
        document.getElementById('playBtn').click();
        setTimeout(syncRetroPlayIcon, 80);
      });
      // ── Animated prev/next for retro ─────────────────────────────────────
      function retroGoTo(direction) {
        const newIdx = Math.max(0, Math.min(displayedStations.length - 1, tunerIndex + direction));
        if (newIdx === tunerIndex) return;

        // Animate knob spin
        const targetDeg = retroKnobDeg + direction * DEG_PER_TICK;
        const frames = 8;
        let f = 0;
        const step = () => {
          f++;
          const t = f / frames;
          const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease in-out
          retroTuneKnobEl.style.transform = `rotate(${retroKnobDeg + (targetDeg - retroKnobDeg) * ease}deg)`;
          if (f < frames) requestAnimationFrame(step);
          else {
            tunerIndex   = newIdx;
            retroKnobDeg = targetDeg;
            syncRetroDisplay();
            positionRetroScale(true);
            if (displayedStations[newIdx]) selectStation(displayedStations[newIdx], newIdx);
          }
        };
        requestAnimationFrame(step);
      }

      retroPrevBtn.addEventListener('click', () => retroGoTo(-1));
      retroNextBtn.addEventListener('click', () => retroGoTo(+1));
      if (retroRecBtn) {
        retroRecBtn.addEventListener('click', () => {
          const mainRecBtn = document.getElementById('recBtn');
          if (mainRecBtn) mainRecBtn.click();
          // Sync recording state after a tick
          setTimeout(syncRetroRecIcon, 120);
        });
      }

      function syncRetroRecIcon() {
        if (!retroRecBtn) return;
        const mainRecBtn = document.getElementById('recBtn');
        const isRec = mainRecBtn && mainRecBtn.classList.contains('recording');
        retroRecBtn.classList.toggle('recording', isRec);
        if (window.lucide) lucide.createIcons({ nodes: [retroRecBtn] });
      }

      function syncRetroPlayIcon() {
        const audioEl2 = document.getElementById('radioAudio');
        const isPlaying = audioEl2 && !audioEl2.paused;
        if (window.lucide && retroPlayBtn) {
          retroPlayBtn.innerHTML = `<i data-lucide="${isPlaying ? 'pause' : 'play'}"></i>`;
          lucide.createIcons({ nodes: [retroPlayBtn] });
        }
      }
      // Keep play icon in sync via audio events
      document.getElementById('radioAudio').addEventListener('play',  syncRetroPlayIcon);
      document.getElementById('radioAudio').addEventListener('pause', syncRetroPlayIcon);

      // ── Enter / Exit ──────────────────────────────────────────────────────
      function enterRetro() {
        retroActive = true;
        retroRadioEl.hidden = false;
        document.body.style.overflow = 'hidden';
        syncRetroGenreOptions();
        buildSubBands();
        syncRetroHttpsBtn();
        // Init volume knob to current volume
        const audioEl2 = document.getElementById('radioAudio');
        if (audioEl2) {
          const vol = audioEl2.volume ?? 0.7;
          retroVolDeg = vol * VOL_RANGE - 135;
          retroVolKnobEl.style.transform = `rotate(${retroVolDeg}deg)`;
        }
        buildRetroScale();
        // Set tunerIndex to currently playing station so retro shows it
        if (typeof currentStation !== 'undefined' && currentStation) {
          const idx = displayedStations.findIndex(s => s && s.id === currentStation.id);
          if (idx >= 0) {
            tunerIndex   = idx;
            retroKnobDeg = idx * DEG_PER_TICK;
            retroTuneKnobEl.style.transform = `rotate(${retroKnobDeg}deg)`;
          }
        }
        syncRetroDisplay();
        syncRetroPlayIcon();
        startRetroVis();
        if (window.lucide) lucide.createIcons({ nodes: [retroRadioEl] });
        document.addEventListener('keydown', onRetroEsc);
      }

      function exitRetro() {
        retroActive = false;
        retroRadioEl.hidden = true;
        document.body.style.overflow = '';
        stopRetroVis();
        document.removeEventListener('keydown', onRetroEsc);
      }

      function onRetroEsc(e) { if (e.key === 'Escape') exitRetro(); }

      retroExpandBtn.addEventListener('click', () => {
        enterRetro();
        document.body.classList.add('retro-active');
      });

      // Setter called by list/globe to sync without re-triggering API
      window._setRetroSearch = function(text, skipRebuild) {
        if (retroSearchText === text) return;
        retroSearchText = text;
        if (retroSearchInput && retroSearchInput.value !== text) retroSearchInput.value = text;
        if (!skipRebuild) buildRetroScale();
      };

      if (retroSearchInput) {
        retroSearchInput.addEventListener('input', () => {
          const text = retroSearchInput.value;
          retroSearchText = text;
          buildRetroScale();
          // Sync list input + globe
          const si = document.getElementById('searchInput');
          if (si && si.value !== text) si.value = text;
          if (window._setGlobeSearch) window._setGlobeSearch(text, true);
          // Debounce API search
          clearTimeout(window._sharedSearchDebounce);
          window._sharedSearchDebounce = setTimeout(() => {
            if (window._triggerSearch && (allStations.length > 0 || text.length > 2)) {
              window._triggerSearch();
            }
          }, 600);
        });
        retroSearchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && window._triggerSearch) window._triggerSearch();
        });
        // Clear search when retro closes
        const _origExitRetro = exitRetro;
        exitRetro = function() {
          _origExitRetro();
          retroSearchText = '';
          retroSearchInput.value = '';
        };
      }

      window._exitRetro = function() {
        exitRetro();
        document.body.classList.remove('retro-active');
        // Note: do NOT call ModeManager.switchTo here — this runs inside unmount already
      };

      // Sync retro display whenever station changes
      window._retroStationChanged = function() {
        if (!retroActive) return;
        syncRetroDisplay();
        syncRetroPlayIcon();
        positionRetroScale(true);
      };
    })();

    // ── Globe View ────────────────────────────────────────────────────────────
    (function initGlobeView() {
      const globeViewEl    = document.getElementById('globeView');
      const globeContainer = document.getElementById('globeContainer');
      const globeNoData    = document.getElementById('globeNoData');
      const stationsList3  = document.getElementById('stationsList');
      const loadMoreBtn3   = document.getElementById('loadMoreBtn');

      if (!globeViewEl) return;

      let globe           = null;
      let globeReady      = false;
      let currentAlt      = 2.2;

      const GLOBE_MIN_ALT = 0.5;    // max zoom-in  (country level – not too close)
      const GLOBE_MAX_ALT = 3.0;    // max zoom-out (full globe + margin)
      let popupCluster    = null;

      // ── Grid-based clustering ─────────────────────────────────────────────
      function gridSize(alt) {
        if (alt > 2.8) return 18;
        if (alt > 1.8) return 9;
        if (alt > 1.0) return 4;
        if (alt > 0.5) return 1.8;
        return 0.6;
      }

      function cluster(stations, gSize) {
        const grid = {};
        stations.forEach(st => {
          const key = `${Math.floor(st.latitude / gSize)}_${Math.floor(st.longitude / gSize)}`;
          if (!grid[key]) grid[key] = [];
          grid[key].push(st);
        });
        return Object.values(grid).map(arr => {
          const byVotes = [...arr].sort((a, b) => (b.votes || 0) - (a.votes || 0));
          return {
            stations: byVotes,
            lat: arr.reduce((s, x) => s + x.latitude,  0) / arr.length,
            lng: arr.reduce((s, x) => s + x.longitude, 0) / arr.length,
            count: arr.length,
            top: byVotes[0],
          };
        });
      }

      // ── Stations with valid coords ────────────────────────────────────────
      function geoStations() {
        return allStations.filter(s =>
          s.latitude  != null && isFinite(s.latitude)  && s.latitude  !== 0 &&
          s.longitude != null && isFinite(s.longitude) && s.longitude !== 0
        );
      }

      // ── Update globe markers ──────────────────────────────────────────────
      let globeSearchText = '';

      function refreshMarkers() {
        if (!globe) return;
        let stations = geoStations();
        if (allStations.length === 0) {
          globeNoData.textContent = 'Bitte zuerst Suche starten.';
          globeNoData.hidden = false;
          globe.pointsData([]);
          return;
        }
        // Apply text filter
        if (globeSearchText) {
          const q = globeSearchText.toLowerCase();
          stations = stations.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.genre || '').toLowerCase().includes(q) ||
            (s.country || '').toLowerCase().includes(q)
          );
        }
        if (stations.length === 0) {
          globeNoData.textContent = globeSearchText
            ? `Kein Treffer für „${globeSearchText}"`
            : 'Keine Sender mit Positionsdaten gefunden.';
          globeNoData.hidden = false;
          globe.pointsData([]);
          return;
        }
        globeNoData.hidden = true;

        const clusters   = cluster(stations, gridSize(currentAlt));
        const accent     = getComputedStyle(document.documentElement)
                             .getPropertyValue('--color-accent').trim() || cachedAccentColor || '#e8402a';
        const clusterCol = getComputedStyle(document.documentElement)
                             .getPropertyValue('--color-accent-hover').trim() || '#f97316';

        globe
          .pointsData(clusters)
          // Larger clusters: smaller radius (was up to 4.5 → now 3.2) to reduce overlap
          .pointRadius(d => d.count > 1 ? Math.min(1.2 + Math.log2(d.count) * 0.55, 3.2) : 1.0)
          // Larger clusters sit higher so they don't occlude small ones
          .pointAltitude(d => d.count > 1 ? Math.min(0.01 + Math.log2(d.count) * 0.006, 0.06) : 0.005)
          .pointColor(d => d.count > 1 ? clusterCol : accent);
      }

      // ── Popup ─────────────────────────────────────────────────────────────
      function renderPopup() {
        const d       = popupCluster;
        if (!d) return;
        const popup   = document.getElementById('globePopup');
        const titleEl = document.getElementById('globePopupTitle');
        const listEl  = document.getElementById('globePopupList');
        titleEl.textContent = d.count === 1
          ? d.top.name
          : `${d.count} Sender in diesem Gebiet`;
        listEl.innerHTML = '';

        // Sort: favourites first (by votes), then rest (by votes)
        const sorted = [...d.stations].sort((a, b) => {
          const aF = favorites.includes(a.id) ? 0 : 1;
          const bF = favorites.includes(b.id) ? 0 : 1;
          if (aF !== bF) return aF - bF;
          return (b.votes || 0) - (a.votes || 0);
        });

        sorted.slice(0, 12).forEach(st => {
          const row = document.createElement('div');
          row.className = 'globe-popup-item';

          const votes = st.votes > 999 ? (st.votes / 1000).toFixed(1) + 'k' : (st.votes || 0);
          const isFav = favorites.includes(st.id);

          row.innerHTML = `
            <div class="gpi-body">
              <span class="gpi-name">${escapeHtml(st.name)}</span>
              <span class="gpi-meta">${[escapeHtml(st.country), st.bitrate ? st.bitrate + ' kbps' : '', votes + ' ▲'].filter(Boolean).join(' · ')}</span>
            </div>
            <button class="gpi-fav${isFav ? ' is-fav' : ''}" title="${isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">
              <i data-lucide="star"></i>
            </button>`;

          // Select station on row click (but not on fav button)
          row.addEventListener('click', e => {
            if (e.target.closest('.gpi-fav')) return;
            const idx = displayedStations.findIndex(s => s.id === st.id);
            selectStation(st, idx >= 0 ? idx : 0);
          });

          // Favourite toggle
          const favBtn = row.querySelector('.gpi-fav');
          favBtn.addEventListener('click', e => {
            e.stopPropagation();
            toggleFavorite(st.id);
            renderPopup(); // re-render with updated sort
          });

          listEl.appendChild(row);
        });

        if (window.lucide) lucide.createIcons({ nodes: [listEl] });
        popup.hidden = false;
      }

      function showPopup(d) {
        popupCluster = d;
        renderPopup();
      }

      // Re-render open popup when favourites change (called from toggleFavorite via window hook)
      window._globePopupRefresh = renderPopup;

      // ── Load globe.gl from CDN ────────────────────────────────────────────
      function loadScript(src) {
        return new Promise((res, rej) => {
          if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
          const s = Object.assign(document.createElement('script'), { src });
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }

      async function initGlobe() {
        if (globeReady) { refreshMarkers(); return; }
        try {
          await loadScript('https://cdn.jsdelivr.net/npm/globe.gl@2/dist/globe.gl.min.js');
        } catch {
          globeContainer.innerHTML = '<div style="color:var(--color-text-muted);padding:20px;text-align:center">❌ Globus konnte nicht geladen werden (Internetverbindung prüfen)</div>';
          return;
        }

        const accent = cachedAccentColor || '#e8402a';
        // Use offsetWidth for both axes – aspect-ratio:1/1 guarantees square layout
        const initSz = globeContainer.offsetWidth || 380;

        globe = Globe()(globeContainer)
          .width(initSz)
          .height(initSz)
          .backgroundColor('rgba(0,0,0,0)')
          .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
          .atmosphereColor(accent)
          .atmosphereAltitude(0.18)
          .pointLat(d => d.lat)
          .pointLng(d => d.lng)
          .pointAltitude(0.01)
          .pointsMerge(false)
          .onPointClick(showPopup)
          .onZoom(({ altitude }) => {
            // Clamp pinch/scroll zoom within sensible limits
            const clamped = Math.min(GLOBE_MAX_ALT, Math.max(GLOBE_MIN_ALT, altitude));
            if (Math.abs(clamped - altitude) > 0.001) {
              const pov = globe.pointOfView();
              globe.pointOfView({ ...pov, altitude: clamped });
            }
            currentAlt = clamped;
            refreshMarkers();
          });

        globeReady = true;
        refreshMarkers();

        // Hook so applyTheme / applyCustomTheme can push new accent colour live
        window._globeThemeUpdate = function() {
          if (!globe) return;
          const accent = cachedAccentColor || '#e8402a';
          globe.atmosphereColor(accent);
          refreshMarkers();   // re-applies pointColor with new accent
        };

        // Start centered on Europe/DACH
        const start = userLocation
          ? { lat: userLocation.lat, lng: userLocation.lon, altitude: currentAlt }
          : { lat: 48, lng: 12, altitude: currentAlt };
        globe.pointOfView(start);
      }

      // ── Controls ──────────────────────────────────────────────────────────
      document.getElementById('globeLocBtn').addEventListener('click', () => {
        if (!globe) return;
        if (userLocation) {
          globe.pointOfView({ lat: userLocation.lat, lng: userLocation.lon, altitude: 1.2 }, 800);
        }
        // else: button is disabled via CSS opacity – handled in _globeShow
      });

      document.getElementById('globeZoomInBtn').addEventListener('click', () => {
        if (!globe) return;
        const pov = globe.pointOfView();
        const alt = Math.max(GLOBE_MIN_ALT, pov.altitude * 0.55);
        globe.pointOfView({ ...pov, altitude: alt }, 400);
        currentAlt = alt;
        refreshMarkers();
      });

      document.getElementById('globeZoomOutBtn').addEventListener('click', () => {
        if (!globe) return;
        const pov = globe.pointOfView();
        const alt = Math.min(GLOBE_MAX_ALT, pov.altitude / 0.55);
        globe.pointOfView({ ...pov, altitude: alt }, 400);
        currentAlt = alt;
        refreshMarkers();
      });

      document.getElementById('globeFitBtn').addEventListener('click', () => {
        if (!globe) return;
        currentAlt = 2.2;
        globe.pointOfView({ lat: 20, lng: 10, altitude: 2.2 }, 900);
        refreshMarkers();
      });

      document.getElementById('globePopupClose').addEventListener('click', () => {
        document.getElementById('globePopup').hidden = true;
      });

      // ── Globe style panel (brightness + texture presets) ─────────────────
      const globeBrightnessBtn    = document.getElementById('globeBrightnessBtn');
      const globeBrightnessPanel  = document.getElementById('globeBrightnessPanel');
      const globeBrightnessSlider = document.getElementById('globeBrightnessSlider');

      const GLOBE_TEXTURES = {
        night:  'https://unpkg.com/three-globe/example/img/earth-night.jpg',
        day:    'https://unpkg.com/three-globe/example/img/earth-day.jpg',
        marble: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
        topo:   'https://unpkg.com/three-globe/example/img/earth-topology.png',
      };
      let currentTexture = 'night';
      // Night is dark; day/marble/topo look better at full brightness by default
      const TEXTURE_DEFAULT_BRIGHTNESS = { night: 100, day: 100, marble: 100, topo: 110 };

      function applyGlobeBrightness(val) {
        globeContainer.style.filter = `brightness(${val}%)`;
      }

      // Preset buttons
      globeBrightnessPanel.querySelectorAll('.gbp-preset').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const tex = btn.dataset.texture;
          if (!globe) return;
          currentTexture = tex;
          globe.globeImageUrl(GLOBE_TEXTURES[tex]);
          // Set brightness default for the chosen texture
          const def = TEXTURE_DEFAULT_BRIGHTNESS[tex] ?? 100;
          globeBrightnessSlider.value = def;
          applyGlobeBrightness(def);
          // Update active state
          globeBrightnessPanel.querySelectorAll('.gbp-preset')
            .forEach(b => b.classList.toggle('active', b === btn));
        });
      });

      globeBrightnessSlider.addEventListener('input', () => {
        applyGlobeBrightness(Number(globeBrightnessSlider.value));
      });

      // Toggle panel open/close
      globeBrightnessBtn.addEventListener('click', e => {
        e.stopPropagation();
        const opening = !globeBrightnessPanel.classList.contains('open');
        globeBrightnessPanel.classList.toggle('open', opening);
        globeBrightnessBtn.classList.toggle('active', opening);
        if (opening && window.lucide) lucide.createIcons({ nodes: [globeBrightnessPanel] });
      });

      // Close panel when clicking anywhere else in the globe
      globeViewEl.addEventListener('click', e => {
        if (globeBrightnessPanel.classList.contains('open') &&
            !globeBrightnessPanel.contains(e.target) &&
            e.target !== globeBrightnessBtn) {
          globeBrightnessPanel.classList.remove('open');
          globeBrightnessBtn.classList.remove('active');
        }
      });

      // ── Fullscreen ────────────────────────────────────────────────────────
      let globeIsFullscreen = false;
      const gfsNP          = document.getElementById('gfsNP');
      const gfsFiltersEl   = document.getElementById('gfsFilters');
      const gfsBrandEl     = document.getElementById('gfsBrand');
      const gfsPlayBtn     = document.getElementById('gfsPlayBtn');
      const gfsRecBtn      = document.getElementById('gfsRecBtn');
      const gfsLogoEl      = document.getElementById('gfsLogo');
      const gfsStationName = document.getElementById('gfsStationName');
      const gfsTitleText   = document.getElementById('gfsTitleText');
      const gfsGenre       = document.getElementById('gfsGenre');
      const gfsSubgenre    = document.getElementById('gfsSubgenre');
      const gfsHttps       = document.getElementById('gfsHttps');
      const gfsSearchInput = document.getElementById('gfsSearch');
      const globeExpandBtn = document.getElementById('globeExpandBtn');

      // ── Draggable panels ──────────────────────────────────────────────────
      function makeDraggable(el) {
        let startX, startY, origLeft, origTop;

        function getParentRect() {
          return el.parentElement.getBoundingClientRect();
        }

        function pointerDown(e) {
          // Ignore clicks on buttons/selects/inputs inside the panel
          if (e.target !== el && (
            e.target.closest('button, select, input, label')
          )) return;

          e.preventDefault();
          const touch = e.touches ? e.touches[0] : e;
          startX = touch.clientX;
          startY = touch.clientY;

          // Convert right-anchored position to left-anchored so we can
          // freely move the element during drag
          const rect = el.getBoundingClientRect();
          const pr   = getParentRect();
          origLeft = rect.left - pr.left;
          origTop  = rect.top  - pr.top;
          el.style.left  = origLeft + 'px';
          el.style.right = 'auto';
          el.style.top   = origTop  + 'px';

          el.classList.add('is-dragging');
          document.addEventListener('mousemove', pointerMove);
          document.addEventListener('mouseup',   pointerUp);
          document.addEventListener('touchmove', pointerMove, { passive: false });
          document.addEventListener('touchend',  pointerUp);
        }

        function pointerMove(e) {
          e.preventDefault();
          const touch = e.touches ? e.touches[0] : e;
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;

          const pr = getParentRect();
          const elW = el.offsetWidth;
          const elH = el.offsetHeight;

          let newLeft = origLeft + dx;
          let newTop  = origTop  + dy;

          // Constrain inside parent
          newLeft = Math.max(0, Math.min(pr.width  - elW, newLeft));
          newTop  = Math.max(0, Math.min(pr.height - elH, newTop));

          el.style.left = newLeft + 'px';
          el.style.top  = newTop  + 'px';
        }

        function pointerUp() {
          el.classList.remove('is-dragging');
          document.removeEventListener('mousemove', pointerMove);
          document.removeEventListener('mouseup',   pointerUp);
          document.removeEventListener('touchmove', pointerMove);
          document.removeEventListener('touchend',  pointerUp);
        }

        el.addEventListener('mousedown',  pointerDown);
        el.addEventListener('touchstart', pointerDown, { passive: false });
      }

      makeDraggable(gfsNP);
      makeDraggable(gfsFiltersEl);

      function syncGfsGenreOptions() {
        const src = document.getElementById('genreSelect');
        gfsGenre.innerHTML = src.innerHTML;
        gfsGenre.value = src.value;
      }
      function syncGfsSubgenreOptions() {
        const src = document.getElementById('subgenreSelect');
        gfsSubgenre.innerHTML = src.innerHTML;
        gfsSubgenre.value = src.value;
      }
      function syncGfsNP() {
        if (!globeIsFullscreen) return;
        // Station name (line 1)
        gfsStationName.textContent = currentStation ? currentStation.name : '— kein Sender —';
        // Track title (line 2) – strip station name prefix if stream echoes it
        const npText = document.getElementById('nowPlayingText');
        let titleText = npText ? npText.textContent : '—';
        if (currentStation && currentStation.name && titleText.startsWith(currentStation.name)) {
          titleText = titleText.slice(currentStation.name.length)
            .replace(/^\s*[-–—]\s*/, '').trim() || '—';
        }
        gfsTitleText.textContent = titleText;

        // Fließtext: activate marquee when text overflows
        requestAnimationFrame(() => {
          [gfsStationName, gfsTitleText].forEach(el => {
            if (!el) return;
            el.classList.remove('scrolling');
            el.style.removeProperty('--marquee-dist');
            if (el.scrollWidth > el.clientWidth) {
              const dist = el.scrollWidth - el.clientWidth;
              el.style.setProperty('--marquee-dist', `-${dist}px`);
              el.classList.add('scrolling');
            }
          });
        });

        // Station logo
        if (currentStation && currentStation.favicon) {
          gfsLogoEl.src = currentStation.favicon;
          gfsLogoEl.hidden = false;
          gfsLogoEl.onerror = () => { gfsLogoEl.hidden = true; };
        } else {
          gfsLogoEl.hidden = true;
        }
        // Play/pause icon – use audioEl which is in scope
        gfsPlayBtn.innerHTML = audioEl.paused
          ? '<i data-lucide="play"></i>'
          : '<i data-lucide="pause"></i>';
        if (window.lucide) lucide.createIcons({ nodes: [gfsPlayBtn] });
      }
      window._globeFullscreenNPUpdate  = syncGfsNP;
      window._enterGlobeFullscreen      = enterGlobeFullscreen;
      window._exitGlobeFullscreen       = exitGlobeFullscreen;

      function resizeGlobe() {
        if (!globe) return;
        requestAnimationFrame(() => {
          const w = globeContainer.offsetWidth;
          const h = globeContainer.offsetHeight || w;
          globe.width(w).height(h);
        });
      }

      function enterGlobeFullscreen() {
        globeIsFullscreen = true;
        globeViewEl.classList.add('fs');
        gfsNP.hidden        = false;
        gfsFiltersEl.hidden = false;
        gfsBrandEl.hidden   = false;
        syncGfsGenreOptions();
        syncGfsSubgenreOptions();
        gfsHttps.checked = document.getElementById('httpsOnlyToggle').checked;
        syncGfsNP();
        resizeGlobe();
        // Change expand icon to shrink
        globeExpandBtn.innerHTML = '<i data-lucide="shrink"></i>';
        globeExpandBtn.title = 'Vollbild beenden';
        globeExpandBtn.classList.add('fs-active');
        if (window.lucide) lucide.createIcons({ nodes: [globeExpandBtn] });
        // ESC to exit
        document.addEventListener('keydown', onFsEsc);
      }

      function exitGlobeFullscreen() {
        globeIsFullscreen = false;
        globeViewEl.classList.remove('fs');
        gfsNP.hidden        = true;
        gfsFiltersEl.hidden = true;
        gfsBrandEl.hidden   = true;
        // Reset any dragged positions so panels start fresh next time
        ['left','top','right'].forEach(p => {
          gfsNP.style[p]        = '';
          gfsFiltersEl.style[p] = '';
        });
        resizeGlobe();
        globeExpandBtn.innerHTML = '<i data-lucide="expand"></i>';
        globeExpandBtn.title = 'Vollbild';
        globeExpandBtn.classList.remove('fs-active');
        if (window.lucide) lucide.createIcons({ nodes: [globeExpandBtn] });
        document.removeEventListener('keydown', onFsEsc);
      }

      function onFsEsc(e) { if (e.key === 'Escape') exitGlobeFullscreen(); }

      globeExpandBtn.addEventListener('click', () => {
        if (globeIsFullscreen) {
          exitGlobeFullscreen();
          globeViewEl.hidden = true;
          if (stationsList3) stationsList3.style.display = '';
          if (loadMoreBtn3)  loadMoreBtn3.style.display  = '';
          const ws = document.getElementById('welcomeScreen');
          if (ws) ws.classList.remove('hidden');
        } else {
          enterGlobeFullscreen();
        }
      });

      // Proxy play/pause in fullscreen
      gfsPlayBtn.addEventListener('click', () => {
        document.getElementById('playBtn').click();
        setTimeout(syncGfsNP, 80);
      });

      // Proxy record button — delegates to main recBtn, mirrors its state
      function syncGfsRecBtn() {
        if (!gfsRecBtn) return;
        const mainRec = document.getElementById('recBtn');
        if (!mainRec) return;
        gfsRecBtn.disabled = mainRec.disabled;
        const isRecording = mainRec.classList.contains('recording');
        gfsRecBtn.classList.toggle('recording', isRecording);
      }
      if (gfsRecBtn) {
        gfsRecBtn.addEventListener('click', () => {
          document.getElementById('recBtn')?.click();
          setTimeout(syncGfsRecBtn, 80);
        });
      }
      // Expose so _recUpdateAvailability can push updates
      window._syncGfsRecBtn = syncGfsRecBtn;

      // Fullscreen filters → update main + re-search
      gfsGenre.addEventListener('change', () => {
        const main = document.getElementById('genreSelect');
        main.value = gfsGenre.value;
        main.dispatchEvent(new Event('change'));
        document.getElementById('searchBtn').click();
        requestAnimationFrame(syncGfsSubgenreOptions);
      });
      gfsSubgenre.addEventListener('change', () => {
        const main = document.getElementById('subgenreSelect');
        main.value = gfsSubgenre.value;
        main.dispatchEvent(new Event('change'));
        document.getElementById('searchBtn').click();
      });
      gfsHttps.addEventListener('change', () => {
        const cb = document.getElementById('httpsOnlyToggle');
        cb.checked = gfsHttps.checked;
        cb.dispatchEvent(new Event('change'));
      });
      // Setter called by list/retro to sync without re-triggering API
      window._setGlobeSearch = function(text, skipRefresh) {
        if (globeSearchText === text) return;
        globeSearchText = text;
        if (gfsSearchInput && gfsSearchInput.value !== text) gfsSearchInput.value = text;
        if (!skipRefresh) refreshMarkers();
      };

      if (gfsSearchInput) {
        gfsSearchInput.addEventListener('input', () => {
          const text = gfsSearchInput.value;
          globeSearchText = text;
          refreshMarkers();
          // Sync list input + retro
          const si = document.getElementById('searchInput');
          if (si && si.value !== text) si.value = text;
          if (window._setRetroSearch) window._setRetroSearch(text, true);
          // Debounce API search
          clearTimeout(window._sharedSearchDebounce);
          window._sharedSearchDebounce = setTimeout(() => {
            if (window._triggerSearch && (allStations.length > 0 || text.length > 2)) {
              window._triggerSearch();
            }
          }, 600);
        });
        gfsSearchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && window._triggerSearch) window._triggerSearch();
        });
      }

      // ── View toggle ───────────────────────────────────────────────────────
      async function showGlobe() {
        stationsList3.style.display  = 'none';
        if (loadMoreBtn3) loadMoreBtn3.style.display = 'none';
        const tunerView = document.getElementById('tunerView');
        if (tunerView) tunerView.hidden = true;
        globeViewEl.hidden = false;
        document.getElementById('globeLocBtn').style.opacity     = userLocation ? '1' : '0.35';
        document.getElementById('globeLocBtn').style.pointerEvents = userLocation ? '' : 'none';
        if (window.lucide) lucide.createIcons({ nodes: [globeViewEl] });
        await initGlobe();
      }

      window._globeHide = function() {
        if (globeIsFullscreen) exitGlobeFullscreen();
        globeViewEl.hidden = true;
        document.getElementById('globePopup').hidden = true;
      };

      window._globeRefresh = function() {
        if (!globeViewEl.hidden) refreshMarkers();
      };

      window._showGlobe = showGlobe;
    })();

    // ── Recording module ──────────────────────────────────────────────────────
    (function initRecording() {
      const recBtn              = document.getElementById('recBtn');
      const recAutoSplit        = document.getElementById('recAutoSplit');
      const recTimerEl          = document.getElementById('recTimer');
      const recNoteEl           = document.getElementById('recNote');
      const recSection          = document.getElementById('recSection');
      // Settings-panel elements for folder picker
      const recFolderRow        = document.getElementById('recFolderRow');
      const recFolderName       = document.getElementById('recFolderName');
      const recChangeFolderBtn  = document.getElementById('recChangeFolderBtn');
      const recFolderUnsupported = document.getElementById('recFolderUnsupported');

      if (!recBtn) return;

      // ── File System Access API ────────────────────────────────────────────────
      const fsDirPickerSupported = ('showDirectoryPicker' in window);
      let dirHandle = null;   // FileSystemDirectoryHandle, null = use downloads

      if (fsDirPickerSupported) {
        if (recFolderRow)         recFolderRow.style.display        = 'block';
        if (recFolderUnsupported) recFolderUnsupported.style.display = 'none';
      } else {
        if (recFolderRow)         recFolderRow.style.display        = 'none';
        if (recFolderUnsupported) recFolderUnsupported.style.display = 'block';
      }

      async function pickFolder() {
        try {
          dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
          if (recFolderName) recFolderName.textContent = '📁 ' + dirHandle.name;
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('[REC] pickFolder:', e);
        }
      }

      if (recChangeFolderBtn) {
        recChangeFolderBtn.addEventListener('click', pickFolder);
      }

      // ── Preferred MIME type (browser-compatible) ────────────────────────────
      function getBestMime() {
        const candidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus',
          ''
        ];
        return candidates.find(t => !t || MediaRecorder.isTypeSupported(t)) || '';
      }

      // ── File extension from MIME ─────────────────────────────────────────────
      function extFor(mime) {
        if (mime.includes('ogg'))  return 'ogg';
        if (mime.includes('mp4'))  return 'm4a';
        return 'webm';
      }

      // ── Safe filename ────────────────────────────────────────────────────────
      function safeFilename(raw, fallback) {
        const cleaned = (raw || fallback || 'aufnahme')
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
          .trim()
          .slice(0, 80);
        return cleaned || 'aufnahme';
      }

      // ── Timer display ────────────────────────────────────────────────────────
      function startRecTimer() {
        recStartTime = Date.now();
        if (recTimerEl) recTimerEl.textContent = '0:00';
        recTimerInterval = setInterval(() => {
          const s = Math.floor((Date.now() - recStartTime) / 1000);
          const m = Math.floor(s / 60);
          if (recTimerEl) recTimerEl.textContent = `${m}:${String(s % 60).padStart(2, '0')}`;
        }, 500);
      }

      function stopRecTimer() {
        clearInterval(recTimerInterval);
        recTimerInterval = null;
        if (recTimerEl) recTimerEl.textContent = '';
      }

      // ── Save helper ───────────────────────────────────────────────────────────
      async function downloadChunks(chunks, title, mime) {
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: mime || chunks[0].type });
        const ext  = extFor(blob.type);
        const name = safeFilename(title, currentStation?.name) + '.' + ext;

        // Try File System Access API first (saves to chosen folder)
        if (dirHandle) {
          try {
            const fileHandle = await dirHandle.getFileHandle(name, { create: true });
            const writable   = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            showToast(`💾 ${name}`);
            return;
          } catch (e) {
            console.warn('[REC] Could not write to folder, falling back to download:', e);
            // Permission may have expired – reset handle so user knows
            dirHandle = null;
            if (recFolderName) recFolderName.textContent = '';
          }
        }

        // Fallback: classic <a> download
        const url = URL.createObjectURL(blob);
        const a   = Object.assign(document.createElement('a'), { href: url, download: name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
        showToast(`💾 ${name}`);
      }

      // ── Start a fresh MediaRecorder session ──────────────────────────────────
      function startSession() {
        if (!mediaRecDest) {
          recNoteEl.textContent = '⚠️ Aufnahme benötigt einen CORS-fähigen Sender';
          return false;
        }
        const mime = getBestMime();
        recChunks = [];
        recTitleAtStart = currentMetadata;
        try {
          mediaRecorder = new MediaRecorder(
            mediaRecDest.stream,
            mime ? { mimeType: mime } : {}
          );
        } catch (err) {
          recNoteEl.textContent = '⚠️ MediaRecorder nicht unterstützt';
          console.error('[REC]', err);
          return false;
        }

        mediaRecorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) recChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          // Save what we have (async – fire and forget, order preserved per session)
          const chunksToSave = recChunks.slice();
          const titleToSave  = recTitleAtStart;
          recChunks = [];
          downloadChunks(chunksToSave, titleToSave, mime).catch(console.error);

          // Auto-split: immediately restart for the new track
          if (recPendingSplit) {
            recPendingSplit  = false;
            recTitleAtStart  = currentMetadata;
            mediaRecorder.start(1000);
            startRecTimer();
          }
        };

        mediaRecorder.start(1000); // collect in 1-second chunks
        startRecTimer();
        recNoteEl.textContent = '';
        return true;
      }

      // ── Stop and download current session ────────────────────────────────────
      function stopSession() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          recPendingSplit = false;
          mediaRecorder.stop();
        }
        stopRecTimer();
        recBtn.classList.remove('recording');
      }

      // ── Called by updateNowPlayingText when title changes ────────────────────
      window._recOnTrackChange = function(oldTitle) {
        if (recMode !== 'autosplit') return;
        if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
        // Mark as split so onstop restarts
        recPendingSplit = true;
        recTitleAtStart = oldTitle;   // save current title before it changes
        mediaRecorder.stop();
        stopRecTimer();
        // onstop will restart and call startRecTimer again
      };

      // ── Button click ─────────────────────────────────────────────────────────
      recBtn.addEventListener('click', async () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          stopSession();
        } else {
          // On first click with FS API available: ask for folder if not yet chosen
          if (fsDirPickerSupported && !dirHandle) {
            await pickFolder();
            // pickFolder resolves even if cancelled – we still start recording
          }
          if (startSession()) {
            recBtn.classList.add('recording');
          }
        }
      });

      // ── Mode checkbox ────────────────────────────────────────────────────────
      if (recAutoSplit) {
        recAutoSplit.addEventListener('change', () => {
          recMode = recAutoSplit.checked ? 'autosplit' : 'manual';
        });
      }

      // ── Enable / disable button based on player state ─────────────────────────
      // Called from selectStation and stopStation
      window._recUpdateAvailability = function() {
        const hasStation = !!currentStation;
        const hasCors    = !!mediaRecDest;
        if (recSection) recSection.style.display = hasStation ? 'block' : 'none';
        if (recBtn) recBtn.disabled = !hasStation || !hasCors;
        if (recNoteEl) {
          if (hasStation && !hasCors) {
            recNoteEl.textContent = '⚠️ Dieser Sender unterstützt keine Aufnahme (kein CORS)';
          } else {
            recNoteEl.textContent = '';
          }
        }
        if (window._syncGfsRecBtn) window._syncGfsRecBtn();
      };

      // ── Stop recording on station change ─────────────────────────────────────
      window._recStopOnStationChange = function() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          stopSession();
        }
      };
    })();

    // Theme Switching (prepared for future)
    // Theme Switching
    function updateThemeCursor() {
      const style  = getComputedStyle(document.documentElement);
      const fill   = style.getPropertyValue('--color-bg-primary').trim();
      const stroke = style.getPropertyValue('--color-accent').trim();
      if (!fill || !stroke) return;

      function makeURI(svgBody, w, h) {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${svgBody}</svg>`;
        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
      }

      const arrowBody = `<path d='M3 2L3 17L7 13L10 20L12 19L9 12L14 12Z' fill='${fill}' stroke='${stroke}' stroke-width='1.5' stroke-linejoin='round'/>`;
      const arrowURI  = makeURI(arrowBody, 20, 24);

      let tag = document.getElementById('themeCursorStyle');
      if (!tag) { tag = document.createElement('style'); tag.id = 'themeCursorStyle'; document.head.appendChild(tag); }
      tag.textContent = `html { cursor: ${arrowURI} 3 2, auto; }`;
    }

    function refreshThemeCache() {
      requestAnimationFrame(() => {
        const s = getComputedStyle(document.documentElement);
        cachedBgColor     = s.getPropertyValue('--color-bg-primary').trim();
        cachedAccentColor = s.getPropertyValue('--color-accent').trim();
        updateThemeCursor();
        // Propagate new accent to the live globe instance (atmosphere + point colours)
        if (window._globeThemeUpdate) window._globeThemeUpdate();
      });
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('brummiesTheme', theme);
      refreshThemeCache();
    }

    // ====== CUSTOM THEME CREATOR ======
    const customFields = [
      { varName: '--color-bg-primary',   colorId: 'cp-bg-primary',   textId: 'ct-bg-primary',   prevId: 'prev-bg-primary'   },
      { varName: '--color-bg-secondary', colorId: 'cp-bg-secondary', textId: 'ct-bg-secondary', prevId: 'prev-bg-secondary' },
      { varName: '--color-accent',       colorId: 'cp-accent',       textId: 'ct-accent',       prevId: 'prev-accent'       },
      { varName: '--color-bg-tertiary',  colorId: 'cp-bg-tertiary',  textId: 'ct-bg-tertiary',  prevId: 'prev-bg-tertiary'  },
      { varName: '--color-text-primary', colorId: 'cp-text',         textId: 'ct-text',         prevId: 'prev-text'         },
      { varName: '--color-bg-input',     colorId: 'cp-bg-input',     textId: 'ct-bg-input',     prevId: null                },
    ];

    function updateCustomPreview() {
      customFields.forEach(f => {
        const val = document.getElementById(f.colorId).value;
        if (f.prevId) document.getElementById(f.prevId).style.background = val;
      });
    }

    function applyCustomTheme(save = true) {
      // Derived vars calculated automatically
      const accent   = document.getElementById('cp-accent').value;
      const bgPrim   = document.getElementById('cp-bg-primary').value;
      const bgSec    = document.getElementById('cp-bg-secondary').value;
      const bgTert   = document.getElementById('cp-bg-tertiary').value;
      const text     = document.getElementById('cp-text').value;
      const bgInput  = document.getElementById('cp-bg-input').value;

      // Build darker hover variant of accent (15% darker)
      function darken(hex, pct) {
        let r = parseInt(hex.slice(1,3),16);
        let g = parseInt(hex.slice(3,5),16);
        let b = parseInt(hex.slice(5,7),16);
        r = Math.max(0, Math.floor(r * (1 - pct)));
        g = Math.max(0, Math.floor(g * (1 - pct)));
        b = Math.max(0, Math.floor(b * (1 - pct)));
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
      }

      function hexToRgbStr(hex) {
        let h = hex.replace('#', '');
        if (h.length === 3) {
          h = h.split('').map(c => c + c).join('');
        }
        let r = parseInt(h.slice(0, 2), 16) || 0;
        let g = parseInt(h.slice(2, 4), 16) || 0;
        let b = parseInt(h.slice(4, 6), 16) || 0;
        return `${r}, ${g}, ${b}`;
      }

      const root = document.documentElement;
      root.setAttribute('data-theme', 'custom');
      root.style.setProperty('--color-bg-primary',    bgPrim);
      root.style.setProperty('--color-bg-secondary',  bgSec);
      root.style.setProperty('--color-bg-tertiary',   bgTert);
      root.style.setProperty('--color-bg-input',      bgInput);
      root.style.setProperty('--color-accent',        accent);
      root.style.setProperty('--color-accent-rgb',    hexToRgbStr(accent));
      root.style.setProperty('--color-accent-hover',  darken(accent, 0.15));
      root.style.setProperty('--color-text-primary',  text);
      root.style.setProperty('--color-text-secondary',text);
      root.style.setProperty('--color-text-muted',    darken(text, 0.35));
      root.style.setProperty('--color-border',        bgTert);
      root.style.setProperty('--color-gradient-start',bgSec);
      root.style.setProperty('--color-gradient-end',  bgSec);

      if (save) {
        localStorage.setItem('brummiesTheme', 'custom');
        const customData = { bgPrim, bgSec, bgTert, bgInput, accent, text };
        localStorage.setItem('brummiesCustomTheme', JSON.stringify(customData));
        console.log('Custom theme saved');
      }

      // Mark custom option active
      document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
      document.getElementById('customThemeToggle').classList.add('active');

      refreshThemeCache();
    }

    function loadCustomThemeValues() {
      const saved = JSON.parse(localStorage.getItem('brummiesCustomTheme') || 'null');
      if (!saved) return;
      const map = {
        bgPrim:  ['cp-bg-primary',   'ct-bg-primary'],
        bgSec:   ['cp-bg-secondary', 'ct-bg-secondary'],
        accent:  ['cp-accent',       'ct-accent'],
        bgTert:  ['cp-bg-tertiary',  'ct-bg-tertiary'],
        text:    ['cp-text',         'ct-text'],
        bgInput: ['cp-bg-input',     'ct-bg-input'],
      };
      Object.entries(map).forEach(([key, [cpId, ctId]]) => {
        if (!saved[key]) return;
        document.getElementById(cpId).value = saved[key];
        document.getElementById(ctId).value = saved[key].toUpperCase();
      });
      updateCustomPreview();
    }

    // Wire up color pickers ↔ hex text fields
    customFields.forEach(f => {
      const cp = document.getElementById(f.colorId);
      const ct = document.getElementById(f.textId);

      cp.addEventListener('input', () => {
        ct.value = cp.value.toUpperCase();
        updateCustomPreview();
      });

      ct.addEventListener('input', () => {
        const val = ct.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
          cp.value = val;
          updateCustomPreview();
        }
      });
    });

    document.getElementById('customThemeToggle').addEventListener('click', () => {
      const creator = document.getElementById('customThemeCreator');
      const isOpen = creator.classList.toggle('open');
      document.getElementById('customThemeToggle').classList.toggle('active', isOpen);
      if (isOpen) { loadCustomThemeValues(); updateCustomPreview(); }
    });

    document.getElementById('applyCustomTheme').addEventListener('click', () => {
      applyCustomTheme(true);
    });

    document.getElementById('resetCustomTheme').addEventListener('click', () => {
      // Reset pickers to brummie defaults
      const defaults = { bgPrim:'#0b0b0f', bgSec:'#111827', bgTert:'#1f2937', bgInput:'#020617', accent:'#ef4444', text:'#f5f5f5' };
      const map = {
        bgPrim:  ['cp-bg-primary',   'ct-bg-primary'],
        bgSec:   ['cp-bg-secondary', 'ct-bg-secondary'],
        accent:  ['cp-accent',       'ct-accent'],
        bgTert:  ['cp-bg-tertiary',  'ct-bg-tertiary'],
        text:    ['cp-text',         'ct-text'],
        bgInput: ['cp-bg-input',     'ct-bg-input'],
      };
      Object.entries(map).forEach(([key, [cpId, ctId]]) => {
        document.getElementById(cpId).value = defaults[key];
        document.getElementById(ctId).value = defaults[key].toUpperCase();
      });
      updateCustomPreview();
    });
    // ====== END CUSTOM THEME CREATOR ======
    
    themeOptions.forEach(option => {
      option.addEventListener('click', () => {
        themeOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        const theme = option.dataset.theme;
        // Remove inline custom vars when switching to a preset
        document.documentElement.removeAttribute('style');
        document.getElementById('customThemeToggle').classList.remove('active');
        document.getElementById('customThemeCreator').classList.remove('open');
        applyTheme(theme);
      });
    });

    // Language Selection with simplified auto-detection
    languageSelect.addEventListener('change', (e) => {
      const lang = e.target.value;
      currentLang = lang;
      localStorage.setItem('brummiesLanguage', lang);
      console.log('Language manually changed to:', lang);
      
      // Apply auto-translations via MyMemory API
      applyTranslations(lang);
    });

    // Load saved preferences
    const savedTheme = localStorage.getItem('brummiesTheme') || 'brummie';
    if (savedTheme === 'custom') {
      loadCustomThemeValues();
      applyCustomTheme(false);
      document.getElementById('customThemeToggle').classList.add('active');
    } else {
      applyTheme(savedTheme);
    }
    
    themeOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.theme === savedTheme);
    });
    
    // Auto-detect language from browser
    const savedLang = localStorage.getItem('brummiesLanguage');
    if (savedLang) {
      currentLang = savedLang;
    } else {
      // Map browser language to supported language
      const browserLang = (navigator.language || 'en').toLowerCase();
      if (browserLang.startsWith('de')) currentLang = 'de';
      else if (browserLang.startsWith('fr')) currentLang = 'fr';
      else if (browserLang.startsWith('es')) currentLang = 'es';
      else if (browserLang.startsWith('it')) currentLang = 'it';
      else currentLang = 'en';
      console.log('Auto-detected language:', currentLang, '(from browser:', navigator.language, ')');
    }
    
    // Set language select to current language
    if (languageSelect) {
      languageSelect.value = currentLang;
    }
    
    // Apply translations on load
    applyTranslations(currentLang);

    // ==================== BG VIDEO ====================
    const bgClips   = [
      { src: 'videos/part1.mp4', startTime: 1 },
      { src: 'videos/part2.mp4', startTime: 0 }
    ];
    const vidEls    = [
      document.getElementById('bgVideo1'),
      document.getElementById('bgVideo2')
    ];
    let clipInVid   = [0, 1]; // which bgClips index is loaded in each element
    let activeVid   = 0;

    function loadClipInto(vidIdx, clipIdx) {
      const vid  = vidEls[vidIdx];
      const clip = bgClips[clipIdx];
      vid.src    = clip.src;
      vid.load();
      if (clip.startTime > 0) {
        vid.addEventListener('loadedmetadata', function onMeta() {
          vid.currentTime = clip.startTime;
          vid.removeEventListener('loadedmetadata', onMeta);
        });
      }
      clipInVid[vidIdx] = clipIdx;
    }

    function onVidEnded(i) {
      if (i !== activeVid) return;
      const next        = 1 - i;
      const nextNextIdx = (clipInVid[next] + 1) % bgClips.length;
      vidEls[next].play().catch(() => {});
      vidEls[next].classList.add('visible');
      vidEls[i].classList.remove('visible');
      activeVid = next;
      // Reload the hidden element once the CSS opacity transition finishes,
      // so the swap happens off-screen without any visible interruption.
      vidEls[i].addEventListener('transitionend', function handler() {
        vidEls[i].removeEventListener('transitionend', handler);
        loadClipInto(i, nextNextIdx);
      }, { once: true });
    }

    vidEls[0].addEventListener('ended', () => onVidEnded(0));
    vidEls[1].addEventListener('ended', () => onVidEnded(1));

    // Preload both clips on startup
    loadClipInto(0, 0);
    loadClipInto(1, 1);

    function startBgVideo() {
      if (!videoEnabled) return;
      vidEls[activeVid].play().catch(() => {});
      vidEls[activeVid].classList.add('visible');
    }

    function stopBgVideo() {
      vidEls.forEach(v => { v.pause(); v.classList.remove('visible'); });
    }

    audioEl.addEventListener('play',  startBgVideo);
    audioEl.addEventListener('pause', stopBgVideo);
    audioEl.addEventListener('ended', stopBgVideo);

    // ==================== HISTORY TOGGLE & VIDEO TOGGLE ====================
    const historyToggleBtn   = document.getElementById('historyToggleBtn');
    const videoToggleBtn     = document.getElementById('videoToggleBtn');
    const historyCollapsible = document.getElementById('historyCollapsible');
    const vizCanvas          = document.getElementById('visualizer');
    let   historyCollapsed   = false;
    let   videoEnabled       = true;

    function setVizHeight(px) {
      vizCanvas.style.height = px + 'px';
      setTimeout(() => { vizCanvas.height = px; }, 460);
    }

    historyToggleBtn.addEventListener('click', () => {
      historyCollapsed = !historyCollapsed;
      historyCollapsible.classList.toggle('collapsed', historyCollapsed);
      historyToggleBtn.innerHTML = historyCollapsed
        ? '<i data-lucide="chevron-up"></i>'
        : '<i data-lucide="chevron-down"></i>';
      lucide.createIcons({ nodes: [historyToggleBtn] });
      setVizHeight(historyCollapsed ? 420 : 120);
    });

    videoToggleBtn.addEventListener('click', () => {
      videoEnabled = !videoEnabled;
      videoToggleBtn.innerHTML = videoEnabled
        ? '<i data-lucide="video"></i>'
        : '<i data-lucide="video-off"></i>';
      lucide.createIcons({ nodes: [videoToggleBtn] });
      if (videoEnabled && !audioEl.paused) {
        startBgVideo();
      } else {
        stopBgVideo();
      }
    });

    // ==================== CONFIG EXPORT / IMPORT ====================

    function getEqValues() {
      return Array.from(document.querySelectorAll('#eq input[type=range]'))
        .map(s => Number(s.value));
    }

    function applyEqValues(values) {
      if (!Array.isArray(values)) return;
      values.forEach((val, idx) => {
        const slider = document.querySelector(`#eq input[data-index="${idx}"]`);
        const display = document.querySelector(`.eq-value[data-index="${idx}"]`);
        if (slider) slider.value = val;
        if (display) display.textContent = `${val > 0 ? '+' : ''}${val} dB`;
        if (filters[idx]) filters[idx].gain.value = val;
      });
    }

    function exportConfig() {
      const config = {
        version: 1,
        exportedAt: new Date().toISOString(),
        favorites: JSON.parse(localStorage.getItem('brummiesFavorites') || '[]'),
        favoritesData: JSON.parse(localStorage.getItem('brummiesFavoritesData') || '{}'),
        theme: localStorage.getItem('brummiesTheme') || 'brummie',
        customTheme: JSON.parse(localStorage.getItem('brummiesCustomTheme') || 'null'),
        eqValues: JSON.parse(localStorage.getItem('brummiesEqValues') || 'null') || getEqValues(),
        language: localStorage.getItem('brummiesLanguage'),
        history: JSON.parse(localStorage.getItem('brummiesHistory') || '[]'),
        listeningStats: JSON.parse(localStorage.getItem('brummiesListeningStats') || '{}'),
        countryFilter: getSelectedCountries()
      };
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brummies-config-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    function importConfig(file) {
      const statusEl = document.getElementById('configImportStatus');
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target.result);
          if (!config.version) throw new Error('Ungültige Konfigurationsdatei');

          if (Array.isArray(config.favorites)) {
            favorites = config.favorites;
            localStorage.setItem('brummiesFavorites', JSON.stringify(favorites));
          }
          if (config.favoritesData && typeof config.favoritesData === 'object') {
            favoriteStationsData = config.favoritesData;
            localStorage.setItem('brummiesFavoritesData', JSON.stringify(favoriteStationsData));
          }
          if (config.theme) {
            localStorage.setItem('brummiesTheme', config.theme);
            applyTheme(config.theme);
          }
          if (config.customTheme) {
            localStorage.setItem('brummiesCustomTheme', JSON.stringify(config.customTheme));
          }
          if (Array.isArray(config.eqValues)) {
            localStorage.setItem('brummiesEqValues', JSON.stringify(config.eqValues));
            applyEqValues(config.eqValues);
          }
          if (config.language !== undefined) {
            localStorage.setItem('brummiesLanguage', config.language);
          }
          if (Array.isArray(config.history)) {
            historyData = config.history;
            localStorage.setItem('brummiesHistory', JSON.stringify(historyData));
          }
          if (config.listeningStats && typeof config.listeningStats === 'object') {
            listeningStats = config.listeningStats;
            localStorage.setItem('brummiesListeningStats', JSON.stringify(listeningStats));
          }
          if (Array.isArray(config.countryFilter)) {
            setSelectedCountries(config.countryFilter);
          }

          // Fehlende Stationsdaten per API nachladen
          const missingIds = favorites.filter(id => !favoriteStationsData[id]);
          if (missingIds.length > 0) {
            statusEl.textContent = '⏳ Lade Senderdaten...';
            Promise.all(missingIds.map(id =>
              fetch(`https://de1.api.radio-browser.info/json/stations/byuuid/${id}`)
                .then(r => r.json()).then(d => d[0] || null).catch(() => null)
            )).then(results => {
              results.forEach(s => {
                if (!s) return;
                favoriteStationsData[s.stationuuid] = {
                  id: s.stationuuid, name: s.name,
                  streamUrl: s.url_resolved || s.url,
                  genre: s.tags ? s.tags.split(',')[0].trim() : 'unknown',
                  country: s.country || 'Unknown',
                  bitrate: s.bitrate || 0, votes: s.votes || 0,
                  logoText: s.name.substring(0, 2).toUpperCase(),
                  favicon: s.favicon || null,
                  latitude: parseFloat(s.geo_lat) || null,
                  longitude: parseFloat(s.geo_long) || null,
                  distance: null
                };
              });
              localStorage.setItem('brummiesFavoritesData', JSON.stringify(favoriteStationsData));
              renderStations();
              statusEl.textContent = `✅ ${favorites.length} Favorit(en) geladen!`;
              statusEl.style.color = '#27ae60';
              setTimeout(() => { statusEl.textContent = ''; }, 4000);
            });
            return; // Status wird async gesetzt
          }

          renderStations();
          statusEl.textContent = '✅ Einstellungen geladen!';
          statusEl.style.color = '#27ae60';
          setTimeout(() => { statusEl.textContent = ''; }, 4000);
        } catch (err) {
          statusEl.textContent = '❌ Fehler: ' + err.message;
          statusEl.style.color = '#ef4444';
        }
      };
      reader.readAsText(file);
    }

    document.getElementById('configExportBtn').addEventListener('click', exportConfig);

    document.getElementById('configImportBtn').addEventListener('click', () => {
      document.getElementById('configFileInput').click();
    });

    document.getElementById('configFileInput').addEventListener('change', (e) => {
      if (e.target.files[0]) importConfig(e.target.files[0]);
      e.target.value = '';
    });

    // ==================== END CONFIG EXPORT / IMPORT ====================

    // ==================== WHAT'S NEW ====================
    const CURRENT_VERSION = '1.5.0';
    const seenVersion = localStorage.getItem('brummiesSeenVersion');
    if (seenVersion !== CURRENT_VERSION) {
      const overlay = document.getElementById('whatsNewOverlay');
      overlay.classList.add('show');
      lucide.createIcons();
      document.getElementById('whatsNewCloseBtn').addEventListener('click', () => {
        overlay.classList.remove('show');
        localStorage.setItem('brummiesSeenVersion', CURRENT_VERSION);
      });
    }
    // ==================== END WHAT'S NEW ====================

    // ==================== PWA UPDATE CHECK ====================
    if ('serviceWorker' in navigator) {
      const updateBanner     = document.getElementById('updateBanner');
      const updateReloadBtn  = document.getElementById('updateReloadBtn');
      const checkUpdateBtn   = document.getElementById('checkUpdateBtn');
      const checkUpdateStatus = document.getElementById('checkUpdateStatus');

      function showUpdateBanner() {
        updateBanner.classList.add('show');
      }

      // Reload only when an update was actually found (not on first SW install)
      let updateReady = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updateReady) window.location.reload();
      });

      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        // Already a waiting SW when page opened (downloaded in background)
        if (reg.waiting) showUpdateBanner();
        reg.addEventListener('updatefound', () => {
          reg.installing.addEventListener('statechange', function () {
            if (this.state === 'installed' && navigator.serviceWorker.controller) {
              updateReady = true;
              showUpdateBanner();
            }
          });
        });
      });

      updateReloadBtn.addEventListener('click', () => {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          else window.location.reload();
        });
      });

      checkUpdateBtn.addEventListener('click', async () => {
        checkUpdateBtn.disabled = true;
        setIcon(checkUpdateBtn, 'loader');
        checkUpdateStatus.textContent = '';
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting) {
              showUpdateBanner();
              checkUpdateStatus.textContent = '✅ Update gefunden!';
            } else {
              checkUpdateStatus.textContent = '✅ App ist aktuell.';
            }
          } else {
            checkUpdateStatus.textContent = '⚠️ Kein Service Worker aktiv.';
          }
        } catch {
          checkUpdateStatus.textContent = '❌ Offline – kein Update möglich.';
        }
        setIcon(checkUpdateBtn, 'refresh-cw');
        checkUpdateBtn.disabled = false;
      });
    }
    // ==================== END PWA UPDATE CHECK ====================

    // Ko-Fi link button – no JS handler needed, href handles navigation

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
      console.log('✓ Lucide icons initialized');
    }

// ========== INTERACTIVE TIMER JAVASCRIPT ==========

// Shuffle Timer Configuration
let shuffleState = {
  minutes: 0,
  active: false,
  interval: null,
  nextShuffleTime: null
};

// Sleep Timer Configuration
let sleepState = {
  mode: 'countdown', // 'countdown' or 'endtime'
  minutes: 0,
  endHour: 0,
  active: false,
  interval: null
};

// Initialize Shuffle Timer
function initShuffleTimer() {
  const handle = document.getElementById('shuffleHandle');
  const svg = handle ? handle.closest('svg') : null;
  const arc = document.getElementById('shuffleArc');
  const valueText = document.getElementById('shuffleValue');
  const ticksGroup = document.getElementById('shuffleTicks');
  const toggleBtn = document.getElementById('shuffleToggle');
  const statusDiv = document.getElementById('shuffleStatus');
  
  if (!handle || !svg) return;

  // ── 270° arc geometry ──────────────────────────────────────────────────────
  // Arc runs clockwise from atan2 angle 135° (lower-left, 0 min)
  //   through -90° (top, 30 min) to 45° (lower-right, 60 min).
  // Total arc: 270°. Dead zone (gap): 90° at bottom centre.
  // center SVG: (100, 100), radius: 80

  const R = 80;
  const CX = 100, CY = 100;
  const START_DEG = 135;  // atan2° at 0 min

  function minutesToAtanDeg(minutes) {
    // Each minute = 270/60 = 4.5° clockwise from start
    let deg = START_DEG + (minutes / 60) * 270;
    if (deg > 180) deg -= 360;   // normalise to -180..180
    return deg;
  }

  function atanDegToXY(deg) {
    const rad = deg * Math.PI / 180;
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  }

  // Draw tick marks
  for (let i = 0; i <= 60; i += 5) {
    const deg = minutesToAtanDeg(i);
    const rad = deg * Math.PI / 180;
    const isMajor = i % 15 === 0;
    const r1 = isMajor ? 65 : 68;
    const r2 = isMajor ? 75 : 72;
    const x1 = CX + r1 * Math.cos(rad);
    const y1 = CY + r1 * Math.sin(rad);
    const x2 = CX + r2 * Math.cos(rad);
    const y2 = CY + r2 * Math.sin(rad);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', 'var(--color-text-muted)');
    line.setAttribute('stroke-width', isMajor ? '2.5' : '1.5');
    line.setAttribute('opacity', '0.6');
    line.setAttribute('stroke-linecap', 'round');
    ticksGroup.appendChild(line);

    // Labels at 0, 15, 30, 45, 60
    if (i % 15 === 0) {
      const lr = 58;
      const tx = CX + lr * Math.cos(rad);
      const ty = CY + lr * Math.sin(rad);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', tx); txt.setAttribute('y', ty + 4);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-size', '9');
      txt.setAttribute('fill', 'var(--color-text-muted)');
      txt.textContent = i;
      ticksGroup.appendChild(txt);
    }
  }

  // Drag state
  let dragging = false;
  let dragCenterX = 0, dragCenterY = 0;

  function updateShuffleTimer(minutes) {
    shuffleState.minutes = Math.max(0, Math.min(60, minutes));
    valueText.textContent = shuffleState.minutes;

    // Handle position
    const p = atanDegToXY(minutesToAtanDeg(shuffleState.minutes));
    handle.setAttribute('cx', p.x);
    handle.setAttribute('cy', p.y);

    // Active arc path
    if (shuffleState.minutes === 0) {
      arc.setAttribute('d', '');
      return;
    }
    const startPt = atanDegToXY(START_DEG);  // fixed 0-min point
    const endPt   = p;
    const clockwiseDeg = (minutesToAtanDeg(shuffleState.minutes) - START_DEG + 360) % 360;
    const largeArc = clockwiseDeg > 180 ? 1 : 0;
    arc.setAttribute('d',
      `M ${startPt.x.toFixed(2)},${startPt.y.toFixed(2)} A ${R},${R} 0 ${largeArc},1 ${endPt.x.toFixed(2)},${endPt.y.toFixed(2)}`
    );
  }

  function computeCenter() {
    const rect = svg.getBoundingClientRect();
    // Center (100,100) in viewBox 200×185
    dragCenterX = rect.left + rect.width  * (CX / 200);
    dragCenterY = rect.top  + rect.height * (CY / 185);
  }

  function handleDrag(e) {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    const dx = clientX - dragCenterX;
    const dy = clientY - dragCenterY;

    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

    // How far clockwise from start (135°)?
    const clockwiseDeg = (angleDeg - START_DEG + 360) % 360;

    // Dead zone: > 270° means the gap at the bottom
    if (clockwiseDeg > 270) return;

    const minutes = Math.round((clockwiseDeg / 270) * 60);
    updateShuffleTimer(minutes);
  }

  function startDrag(e) {
    dragging = true;
    computeCenter();
    e.preventDefault();
  }

  handle.addEventListener('mousedown', startDrag);
  handle.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('touchmove', handleDrag, { passive: false });
  document.addEventListener('mouseup',  () => { dragging = false; });
  document.addEventListener('touchend', () => { dragging = false; });

  updateShuffleTimer(0);
  
  // Toggle button
  toggleBtn.addEventListener('click', () => {
    if (shuffleState.active) {
      stopShuffle();
    } else {
      startShuffle();
    }
  });
  
  function startShuffle() {
    if (shuffleState.minutes === 0) {
      alert('Bitte wähle eine Zeit!');
      return;
    }
    
    shuffleState.active = true;
    shuffleState.nextShuffleTime = Date.now() + shuffleState.minutes * 60 * 1000;
    
    toggleBtn.innerHTML = '<i data-lucide="pause"></i> Stop';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    shuffleState.interval = setInterval(updateShuffleDisplay, 1000);
    updateShuffleDisplay();
  }
  
  function stopShuffle() {
    shuffleState.active = false;
    if (shuffleState.interval) {
      clearInterval(shuffleState.interval);
      shuffleState.interval = null;
    }
    
    toggleBtn.innerHTML = '<i data-lucide="play"></i> Start';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    statusDiv.textContent = '';
  }
  
  function updateShuffleDisplay() {
    if (!shuffleState.active) return;
    
    const remaining = shuffleState.nextShuffleTime - Date.now();
    
    if (remaining <= 0) {
      // Trigger shuffle
      const nextBtn = document.getElementById('nextBtn');
      if (nextBtn) nextBtn.click();
      
      // Reset timer
      shuffleState.nextShuffleTime = Date.now() + shuffleState.minutes * 60 * 1000;
    }
    
    const seconds = Math.ceil(remaining / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    statusDiv.textContent = `Nächster Shuffle in ${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Initialize
  updateShuffleTimer(0);
}

// Initialize Sleep Timer
function initSleepTimer() {
  const countdownDiv = document.getElementById('sleepCountdown');
  const endtimeDiv = document.getElementById('sleepEndtime');
  const modeButtons = document.querySelectorAll('.sleep-mode-btn');
  const toggleBtn = document.getElementById('sleepToggle');
  const statusDiv = document.getElementById('sleepStatus');
  
  // Mode switching
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      sleepState.mode = mode;
      
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      countdownDiv.style.display = mode === 'countdown' ? 'block' : 'none';
      endtimeDiv.style.display = mode === 'endtime' ? 'block' : 'none';
    });
  });
  
  // Initialize Countdown Timer
  initSleepCountdown();
  
  // Initialize End Time Clock
  initSleepClock();
  
  // Toggle button
  toggleBtn.addEventListener('click', () => {
    if (sleepState.active) {
      stopSleepTimer();
    } else {
      startSleepTimer();
    }
  });
  
  function startSleepTimer() {
    if (sleepState.mode === 'countdown' && sleepState.minutes === 0) {
      alert('Bitte wähle eine Zeit!');
      return;
    }
    
    sleepState.active = true;
    toggleBtn.innerHTML = '<i data-lucide="pause"></i> Stop';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    if (sleepState.mode === 'countdown') {
      sleepState.endTime = Date.now() + sleepState.minutes * 60 * 1000;
    } else {
      // Calculate end time from hour
      const now = new Date();
      const target = new Date();
      target.setHours(sleepState.endHour, 0, 0, 0);
      
      // If target is in the past, add a day
      if (target < now) {
        target.setDate(target.getDate() + 1);
      }
      
      sleepState.endTime = target.getTime();
    }
    
    sleepState.interval = setInterval(updateSleepDisplay, 1000);
    updateSleepDisplay();
  }
  
  function stopSleepTimer() {
    sleepState.active = false;
    if (sleepState.interval) {
      clearInterval(sleepState.interval);
      sleepState.interval = null;
    }
    
    toggleBtn.innerHTML = '<i data-lucide="play"></i> Start';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    statusDiv.textContent = '';
  }
  
  function updateSleepDisplay() {
    if (!sleepState.active) return;
    
    const remaining = sleepState.endTime - Date.now();
    
    if (remaining <= 0) {
      // Stop playback
      const playBtn = document.getElementById('playBtn');
      if (playBtn && coverEl.classList.contains('playing')) {
        playBtn.click();
      }
      
      stopSleepTimer();
      alert('Sleep Timer abgelaufen - Player gestoppt');
      return;
    }
    
    const seconds = Math.ceil(remaining / 1000);
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      statusDiv.textContent = `Stoppt in ${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      statusDiv.textContent = `Stoppt in ${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }
}

function initSleepCountdown() {
  const svg = document.querySelector('#sleepCountdown .circular-timer');
  const handle = document.getElementById('sleepHandle');
  const arc = document.getElementById('sleepArc');
  const valueText = document.getElementById('sleepValue');
  const ticksGroup = document.getElementById('sleepTicks');
  
  if (!handle || !svg) return;

  const R = 80;
  const CX = 100, CY = 100;
  const START_DEG = 135;

  function minutesToAtanDeg(minutes) {
    let deg = START_DEG + (minutes / 60) * 270;
    if (deg > 180) deg -= 360;
    return deg;
  }
  function atanDegToXY(deg) {
    const rad = deg * Math.PI / 180;
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  }

  // Draw tick marks and labels
  for (let i = 0; i <= 60; i += 5) {
    const deg = minutesToAtanDeg(i);
    const rad = deg * Math.PI / 180;
    const isMajor = i % 15 === 0;
    const r1 = isMajor ? 65 : 68;
    const r2 = isMajor ? 75 : 72;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', CX + r1 * Math.cos(rad)); line.setAttribute('y1', CY + r1 * Math.sin(rad));
    line.setAttribute('x2', CX + r2 * Math.cos(rad)); line.setAttribute('y2', CY + r2 * Math.sin(rad));
    line.setAttribute('stroke', 'var(--color-text-muted)');
    line.setAttribute('stroke-width', isMajor ? '2.5' : '1.5');
    line.setAttribute('opacity', '0.6');
    line.setAttribute('stroke-linecap', 'round');
    ticksGroup.appendChild(line);

    if (i % 15 === 0) {
      const lr = 58;
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', CX + lr * Math.cos(rad));
      txt.setAttribute('y', CY + lr * Math.sin(rad) + 4);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-size', '9');
      txt.setAttribute('fill', 'var(--color-text-muted)');
      txt.textContent = i;
      ticksGroup.appendChild(txt);
    }
  }

  let dragging = false;
  let dragCenterX = 0, dragCenterY = 0;

  function updateSleepCountdown(minutes) {
    sleepState.minutes = Math.max(0, Math.min(60, minutes));
    valueText.textContent = sleepState.minutes;

    const p = atanDegToXY(minutesToAtanDeg(sleepState.minutes));
    handle.setAttribute('cx', p.x);
    handle.setAttribute('cy', p.y);

    if (sleepState.minutes === 0) { arc.setAttribute('d', ''); return; }
    const startPt = atanDegToXY(START_DEG);
    const clockwiseDeg = (minutesToAtanDeg(sleepState.minutes) - START_DEG + 360) % 360;
    const largeArc = clockwiseDeg > 180 ? 1 : 0;
    arc.setAttribute('d',
      `M ${startPt.x.toFixed(2)},${startPt.y.toFixed(2)} A ${R},${R} 0 ${largeArc},1 ${p.x.toFixed(2)},${p.y.toFixed(2)}`
    );
  }

  function computeCenter() {
    const rect = svg.getBoundingClientRect();
    dragCenterX = rect.left + rect.width  * (CX / 200);
    dragCenterY = rect.top  + rect.height * (CY / 185);
  }

  function handleDrag(e) {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragCenterX;
    const dy = clientY - dragCenterY;
    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    const clockwiseDeg = (angleDeg - START_DEG + 360) % 360;
    if (clockwiseDeg > 270) return;
    updateSleepCountdown(Math.round((clockwiseDeg / 270) * 60));
  }

  function startDrag(e) { dragging = true; computeCenter(); e.preventDefault(); }

  handle.addEventListener('mousedown', startDrag);
  handle.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('touchmove', handleDrag, { passive: false });
  document.addEventListener('mouseup',  () => { dragging = false; });
  document.addEventListener('touchend', () => { dragging = false; });

  updateSleepCountdown(0);
}

function initSleepClock() {
  const svg = document.querySelector('#sleepEndtime .circular-clock');
  const hourHand = document.getElementById('hourHand');
  const timeDisplay = document.getElementById('endTimeDisplay');
  const markersGroup = document.getElementById('hourMarkers');
  
  if (!hourHand || !svg) return;
  
  // Draw hour markers with 30-min increments
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * 360 - 90;
    const rad = angle * Math.PI / 180;
    
    if (i % 2 === 0) {
      const hour = i / 2;
      const x = 100 + 70 * Math.cos(rad);
      const y = 100 + 70 * Math.sin(rad);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y + 5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', hour % 3 === 0 ? '12' : '10');
      text.setAttribute('fill', 'var(--color-text-secondary)');
      text.setAttribute('font-weight', hour % 6 === 0 ? 'bold' : 'normal');
      text.textContent = hour;
      markersGroup.appendChild(text);
    } else {
      const x = 100 + 75 * Math.cos(rad);
      const y = 100 + 75 * Math.sin(rad);
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', 2);
      circle.setAttribute('fill', 'var(--color-text-muted)');
      circle.setAttribute('opacity', 0.5);
      markersGroup.appendChild(circle);
    }
  }
  
  // Drag functionality
  let dragging = false;
  
  function updateClock(halfHour) {
    const hour = Math.floor(halfHour / 2);
    const minute = (halfHour % 2) * 30;
    
    sleepState.endHour = hour;
    sleepState.endMinute = minute;
    
    const angle = (halfHour / 48) * 360 - 90;
    const rad = angle * Math.PI / 180;
    const x = 100 + 50 * Math.cos(rad);
    const y = 100 + 50 * Math.sin(rad);
    
    hourHand.setAttribute('x2', x);
    hourHand.setAttribute('y2', y);
    
    timeDisplay.textContent = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  
  function handleDrag(e) {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    // Convert screen pixel → SVG coordinate space (clock center = 100,100)
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());

    let angle = Math.atan2(svgPt.y - 100, svgPt.x - 100) * 180 / Math.PI;
    angle = (angle + 90 + 360) % 360;

    const halfHour = Math.round((angle / 360) * 48) % 48;
    updateClock(halfHour);
  }

  svg.addEventListener('mousedown', (e) => { dragging = true; handleDrag(e); });
  svg.addEventListener('touchstart', (e) => { dragging = true; e.preventDefault(); handleDrag(e); }, { passive: false });

  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('touchmove', handleDrag, { passive: false });

  document.addEventListener('mouseup', () => { dragging = false; });
  document.addEventListener('touchend', () => { dragging = false; });
  
  // Initialize to current time with 30-min steps
  const now = new Date();
  const halfHour = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
  updateClock(halfHour);
}

// Initialize timers when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      initShuffleTimer();
      initSleepTimer();
    }, 500);
  });
} else {
  setTimeout(() => {
    initShuffleTimer();
    initSleepTimer();
  }, 500);
}

// ========== END INTERACTIVE TIMER JAVASCRIPT ==========

// ── HEADER SCROLL BEHAVIOUR ──────────────────────────────────────────────────
(function() {
  const header = document.getElementById('mainHeader');
  if (!header) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        header.classList.toggle('scrolled', window.scrollY > 40);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

// ── NP Favourite Button ───────────────────────────────────────────────────────
(function initNpFavBtn() {
  const npFavBtn  = document.getElementById('npFavBtn');
  const gfsFavBtn = document.getElementById('gfsFavBtn');
  const npBlock   = document.getElementById('nowPlayingBlock');
  const gfsNPEl   = document.getElementById('gfsNP');

  function updateNpFavBtns() {
    const isFav = !!(currentStation && favorites.includes(currentStation.id));
    [npFavBtn, gfsFavBtn].forEach(btn => {
      if (!btn) return;
      btn.classList.toggle('is-fav', isFav);
      btn.disabled = !currentStation;
      btn.title = isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen';
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
    });
  }
  window._updateNpFavBtns = updateNpFavBtns;

  function doFavToggle(btn) {
    if (!currentStation) return;
    toggleFavorite(currentStation.id);
    // Pop animation
    if (btn) {
      btn.classList.remove('fav-pop');
      requestAnimationFrame(() => {
        btn.classList.add('fav-pop');
        btn.addEventListener('animationend', () => btn.classList.remove('fav-pop'), { once: true });
      });
    }
  }

  if (npFavBtn)  npFavBtn.addEventListener('click',  () => doFavToggle(npFavBtn));
  if (gfsFavBtn) gfsFavBtn.addEventListener('click', () => doFavToggle(gfsFavBtn));

  // Double-tap for touch – independent last-tap per container
  function addDoubleTap(el, btn) {
    if (!el) return;
    let lastTap = 0;
    el.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - lastTap < 320) {
        e.preventDefault();
        doFavToggle(btn);
      }
      lastTap = now;
    }, { passive: false });
  }
  addDoubleTap(npBlock,  npFavBtn);
  addDoubleTap(gfsNPEl,  gfsFavBtn);
})();

// ── Legal Info Modal ──────────────────────────────────────────────────────────
(function initLegalModal() {
  const legalBtn         = document.getElementById('legalBtn');
  const legalOverlay     = document.getElementById('legalOverlay');
  const legalCloseBtn    = document.getElementById('legalCloseBtn');
  const legalCloseBtnFtr = document.getElementById('legalCloseBtnFooter');
  if (!legalBtn || !legalOverlay) return;

  function openLegal()  { 
    // Close settings panel if open
    const settingsPanel = document.getElementById('settingsPanel');
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsPanel && settingsPanel.classList.contains('open')) {
      settingsPanel.classList.remove('open');
      if (settingsOverlay) settingsOverlay.classList.remove('show');
    }
    
    legalOverlay.hidden = false; 
  }
  function closeLegal() { legalOverlay.hidden = true;  }

  legalBtn.addEventListener('click', openLegal);
  legalCloseBtn.addEventListener('click', closeLegal);
  legalCloseBtnFtr.addEventListener('click', closeLegal);
  // Click backdrop to close
  legalOverlay.addEventListener('click', e => { if (e.target === legalOverlay) closeLegal(); });
  // ESC to close
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !legalOverlay.hidden) closeLegal(); });

  if (window.lucide) lucide.createIcons({ nodes: [legalOverlay] });
})();

// --- Welcome Screen Logic ---
(function initWelcomeScreen() {
  const welcomeScreen = document.getElementById('welcomeScreen');
  const welcomeModel = document.getElementById('welcomeModel');
  const btnList = document.getElementById('welcomeBtnList');
  const btnGlobe = document.getElementById('welcomeBtnGlobe');
  const btnRetro = document.getElementById('welcomeBtnRetro');
  const globalHomeBtn = document.getElementById('globalHomeBtn');

  if (!welcomeScreen) return;

  // Lucide icons are created in DOMContentLoaded (after skin is visible).
  // No early init needed here.

  let isNodding = false;

  // ── Head tracking (mouse + touch → rotation) ────────────────────────────
  function trackPointer(clientX, clientY) {
    if (!ModeManager.is('welcome') || isNodding || isPulling) return;
    const x = (clientX / window.innerWidth)  * 2 - 1;
    const y = (clientY / window.innerHeight) * 2 - 1;
    welcomeModel.setAttribute('camera-orbit',
      `${-(x * 30)}deg ${75 - (y * 20)}deg auto`);
  }

  // ── Boing sound via Web Audio ────────────────────────────────────────────
  function playBoing() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      // Pitch envelope: high → low (spring snap)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.35);
      // Second harmonic for richness
      const osc2  = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(840, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.3);
      gain2.gain.setValueAtTime(0.12, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc2.connect(gain2); gain2.connect(ctx.destination); osc2.start(); osc2.stop(ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.45);
      setTimeout(() => ctx.close(), 600);
    } catch (e) { /* AudioContext not available */ }
  }

  // ── Pull / snap-back mechanic ────────────────────────────────────────────
  let isPulling   = false;
  let pullStartX  = 0, pullStartY = 0;
  let pullOffsetX = 0, pullOffsetY = 0;
  const MAX_PULL  = 90; // px cap

  function applyPullTransform(dx, dy) {
    // Clamp and add subtle stretch in pull direction
    const dist   = Math.sqrt(dx * dx + dy * dy);
    const clamp  = Math.min(dist, MAX_PULL) / (dist || 1);
    const tx = dx * clamp;
    const ty = dy * clamp;
    // Stretch perpendicular to pull direction
    const stretch = 1 + (dist / MAX_PULL) * 0.12;
    const squishY = 1 - (dist / MAX_PULL) * 0.08;
    const angle   = Math.atan2(dy, dx) * 180 / Math.PI;
    welcomeModel.style.transform =
      `rotate(${angle}deg) scale(${stretch}, ${squishY}) rotate(${-angle}deg) translate(${tx}px, ${ty}px)`;
  }

  // Pull mechanic uses the overlay div (welcomeModel has pointer-events:none)
  const welcomeOverlay = document.getElementById('welcomeModelOverlay');

  function onPullStart(clientX, clientY) {
    isPulling  = true;
    pullStartX = clientX;
    pullStartY = clientY;
    welcomeModel?.classList.remove('snapping', 'squish', 'wiggle');
    welcomeOverlay?.classList.add('pulling');
  }

  function onPullMove(clientX, clientY) {
    if (!isPulling) return;
    pullOffsetX = clientX - pullStartX;
    pullOffsetY = clientY - pullStartY;
    applyPullTransform(pullOffsetX, pullOffsetY);
  }

  function onPullEnd() {
    if (!isPulling) return;
    isPulling = false;
    const dist = Math.sqrt(pullOffsetX ** 2 + pullOffsetY ** 2);
    welcomeOverlay?.classList.remove('pulling');
    if (welcomeModel) {
      welcomeModel.classList.add('snapping');
      welcomeModel.style.transform = '';
      if (dist > 12) playBoing();
      welcomeModel.addEventListener('transitionend', () => {
        welcomeModel.classList.remove('snapping');
      }, { once: true });
    }
    pullOffsetX = pullOffsetY = 0;
  }

  // ── Tap / click → squish ─────────────────────────────────────────────────
  let tapCount = 0, tapTimer = null;
  function triggerHeadAnim() {
    if (isPulling || !welcomeModel) return;
    welcomeModel.classList.remove('squish', 'wiggle');
    void welcomeModel.offsetWidth;
    if (++tapCount >= 3) { tapCount = 0; welcomeModel.classList.add('wiggle'); }
    else {
      if (tapTimer) clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapCount = 0; }, 600);
      welcomeModel.classList.add('squish');
    }
    welcomeModel.addEventListener('animationend', () => {
      welcomeModel.classList.remove('squish', 'wiggle');
    }, { once: true });
  }

  // Events on the OVERLAY (not model-viewer, which has pointer-events:none)
  if (welcomeOverlay) {
    // Mouse
    document.addEventListener('mousemove', (e) => {
      if (isPulling) onPullMove(e.clientX, e.clientY);
      else trackPointer(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', onPullEnd);
    welcomeOverlay.addEventListener('mousedown', (e) => {
      onPullStart(e.clientX, e.clientY);
    });

    // Touch
    welcomeOverlay.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      onPullStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      if (isPulling) onPullMove(e.touches[0].clientX, e.touches[0].clientY);
      else trackPointer(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      const dist = Math.sqrt(pullOffsetX ** 2 + pullOffsetY ** 2);
      onPullEnd();
      if (dist < 15) triggerHeadAnim();
    });

    // Click on overlay → squish
    welcomeOverlay.addEventListener('click', (e) => {
      const dist = Math.sqrt(pullOffsetX ** 2 + pullOffsetY ** 2);
      if (dist < 15) triggerHeadAnim();
    });
  }

  // ── Nod animation then switch mode ──────────────────────────────────────
  function hideWelcome(targetMode) {
    const mode = targetMode || 'list';
    if (welcomeModel) {
      isNodding = true;
      welcomeModel.setAttribute('camera-orbit', `0deg 95deg auto`);
      setTimeout(() => {
        welcomeModel.setAttribute('camera-orbit', `0deg 60deg auto`);
        setTimeout(() => {
          welcomeModel.setAttribute('camera-orbit', `0deg 75deg auto`);
          setTimeout(() => {
            isNodding = false;
            ModeManager.switchTo(mode);
          }, 200);
        }, 200);
      }, 200);
    } else {
      ModeManager.switchTo(mode);
    }
  }

  // (duplicate click handlers removed, using the primary DOMContentLoaded ones)

  if (globalHomeBtn) {
    globalHomeBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      ModeManager.switchTo('welcome');
    });
  }

  // ── FAB group toggle ─────────────────────────────────────────────────────
  const fabGroup  = document.getElementById('fabGroup');
  const fabToggle = document.getElementById('fabToggle');
  if (fabGroup && fabToggle) {
    fabToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      fabGroup.classList.toggle('open');
    });
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (fabGroup && !fabGroup.contains(e.target)) {
        fabGroup.classList.remove('open');
      }
    });
    // Close after any action button is clicked
    fabGroup.querySelectorAll('.fab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setTimeout(() => fabGroup.classList.remove('open'), 150);
      });
    });
    // Init Lucide for the new toggle button
    if (window.lucide) lucide.createIcons({ nodes: [fabToggle] });
  }

  // ── Logo-Click → Welcome in all three modes ──────────────────────────────
  function goToWelcome() {
    const globalHomeBtn = document.getElementById('globalHomeBtn');
    if (globalHomeBtn) globalHomeBtn.click();
  }

  // List header logo
  const headerLogo = document.getElementById('headerLogo');
  if (headerLogo) {
    headerLogo.style.cursor = 'pointer';
    headerLogo.addEventListener('click', goToWelcome);
  }

  // Retro cabinet logo (inside retro-brand-plate)
  const retroLogo = document.querySelector('.retro-logo-icon');
  if (retroLogo) {
    retroLogo.style.cursor = 'pointer';
    retroLogo.addEventListener('click', goToWelcome);
  }

  // Globe fullscreen brand logo
  const gfsBrandImg = document.querySelector('#gfsBrand img');
  if (gfsBrandImg) {
    gfsBrandImg.style.cursor = 'pointer';
    gfsBrandImg.addEventListener('click', goToWelcome);
  }

})();

// ── Register all skin lifecycle hooks with ModeManager ─────────────────────
(function registerSkins() {

  // Welcome — nothing to mount/unmount beyond what ModeManager does
  ModeManager.register('welcome', {});

  // List — show/hide tuner mini-view, restore stationsList
  ModeManager.register('list', {
    mount() {
      if (window._showList) window._showList();
    },
    unmount() {
      // nothing — list state persists
    }
  });

  // Globe — initialize + enter fullscreen via existing _showGlobe
  ModeManager.register('globe', {
    async mount() {
      const gv     = document.getElementById('globeView');
      const gfsNP  = document.getElementById('gfsNP');
      const gfsBrd = document.getElementById('gfsBrand');
      const gfsFlt = document.getElementById('gfsFilters');

      // Apply .fs FIRST so all CSS rules activate immediately
      if (gv) gv.classList.add('fs');
      if (gfsNP)  gfsNP.hidden  = false;
      if (gfsBrd) gfsBrd.hidden = false;
      if (gfsFlt) gfsFlt.hidden = false;

      // Initialize globe canvas (may be async — CSS already correct)
      if (window._showGlobe) await window._showGlobe();

      if (window._globeFullscreenNPUpdate) window._globeFullscreenNPUpdate();
    },
    unmount() {
      const gv     = document.getElementById('globeView');
      const gfsNP  = document.getElementById('gfsNP');
      const gfsBrd = document.getElementById('gfsBrand');
      const gfsFlt = document.getElementById('gfsFilters');
      if (gv) gv.classList.remove('fs');
      if (window._globeHide) window._globeHide();
      if (gfsNP)  gfsNP.hidden  = true;
      if (gfsBrd) gfsBrd.hidden = true;
      if (gfsFlt) gfsFlt.hidden = true;
    }
  });

  // Retro — enterRetro / exitRetro (existing functions)
  ModeManager.register('retro', {
    mount() {
      // retroExpandBtn click triggers enterRetro() which starts RAF/visualizer
      const btn = document.getElementById('retroExpandBtn');
      if (btn) btn.click();
    },
    unmount() {
      if (window._exitRetro) window._exitRetro();
    }
  });

  // DJ — enterDJ / exitDJ (existing functions)
  ModeManager.register('dj', {
    mount() {
      if (window._enterDJ) window._enterDJ();
    },
    unmount() {
      if (window._exitDJ) window._exitDJ();
    }
  });

  // ── Welcome buttons → mode switch (added here to guarantee execution) ──────
  // initWelcomeScreen adds identical listeners but from a closure that may
  // not execute correctly in all environments. These run last and are definitive.
  function doHideWelcome(targetMode) {
    const wm = document.getElementById('welcomeModel');
    if (wm) {
      wm.setAttribute('camera-orbit', '0deg 95deg auto');
      setTimeout(() => {
        wm.setAttribute('camera-orbit', '0deg 60deg auto');
        setTimeout(() => {
          wm.setAttribute('camera-orbit', '0deg 75deg auto');
          setTimeout(() => ModeManager.switchTo(targetMode), 200);
        }, 200);
      }, 200);
    } else {
      ModeManager.switchTo(targetMode);
    }
  }
  // (duplicate click handlers removed, using the primary DOMContentLoaded ones)

  // ── Logo / icon clicks → always return to welcome ────────────────────────
  // Logo clicks (retro cabinet, globe brand, header logo) → welcome
  ['retro-logo-icon', 'gfsBrand'].forEach(cls => {
    const img = cls.includes('#')
      ? document.querySelector(`#${cls} img`)
      : document.querySelector(`.${cls}`);
    if (img) { img.style.cursor = 'pointer'; img.addEventListener('click', () => ModeManager.switchTo('welcome')); }
  });
  const gfsBrandImg = document.querySelector('#gfsBrand img');
  if (gfsBrandImg) { gfsBrandImg.style.cursor = 'pointer'; gfsBrandImg.addEventListener('click', () => ModeManager.switchTo('welcome')); }
  const retroLogo = document.querySelector('.retro-logo-icon');
  if (retroLogo) { retroLogo.style.cursor = 'pointer'; retroLogo.addEventListener('click', () => ModeManager.switchTo('welcome')); }
  const headerLogo = document.getElementById('headerLogo');
  if (headerLogo) { headerLogo.style.cursor = 'pointer'; headerLogo.addEventListener('click', () => ModeManager.switchTo('welcome')); }

})();

// ══════════════════════════════════════════════════════════════════════════════
// DJ BOOTH — Redesigned with CSS vinyl + station lists
// ══════════════════════════════════════════════════════════════════════════════
(function initDJMode() {
  'use strict';

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const djMixer       = document.getElementById('djMixer');
  const welcomeScreen = document.getElementById('welcomeScreen');
  if (!djMixer) return;

  // Header logo
  const djLogoIcon    = djMixer.querySelector('.dj-header-logo');

  // Deck A
  const djVinylA      = document.getElementById('djVinylA');
  const djFaviconA    = document.getElementById('djFaviconA');
  const djLabelTextA  = document.getElementById('djLabelTextA');
  const djNameA       = document.getElementById('djNameA');
  const djTrackA      = document.getElementById('djTrackA');
  const djBpmA        = document.getElementById('djBpmA');
  const djGenreA      = document.getElementById('djGenreA');
  const djSubgenreA   = document.getElementById('djSubgenreA');
  const djSearchA     = document.getElementById('djSearchA');
  const djHttpsA      = document.getElementById('djHttpsA');
  const djSortA       = document.getElementById('djSortA');
  const djTempoValA   = document.getElementById('djTempoValA');
  const djStationListA = document.getElementById('djStationListA');
  const djEqHiA       = document.getElementById('djEqHiA');
  const djEqMidA      = document.getElementById('djEqMidA');
  const djEqLoA       = document.getElementById('djEqLoA');
  const djFilterBtnA  = document.getElementById('djFilterBtnA');
  const djCueA        = document.getElementById('djCueA');
  const djFavFilterA  = document.getElementById('djFavFilterA');

  // Deck B
  const djVinylB      = document.getElementById('djVinylB');
  const djFaviconB    = document.getElementById('djFaviconB');
  const djLabelTextB  = document.getElementById('djLabelTextB');
  const djNameB       = document.getElementById('djNameB');
  const djTrackB      = document.getElementById('djTrackB');
  const djBpmB        = document.getElementById('djBpmB');
  const djGenreB      = document.getElementById('djGenreB');
  const djSubgenreB   = document.getElementById('djSubgenreB');
  const djSearchB     = document.getElementById('djSearchB');
  const djHttpsB      = document.getElementById('djHttpsB');
  const djSortB       = document.getElementById('djSortB');
  const djTempoValB   = document.getElementById('djTempoValB');
  const djStationListB = document.getElementById('djStationListB');
  const djEqHiB       = document.getElementById('djEqHiB');
  const djEqMidB      = document.getElementById('djEqMidB');
  const djEqLoB       = document.getElementById('djEqLoB');
  const djFilterBtnB  = document.getElementById('djFilterBtnB');
  const djCueB        = document.getElementById('djCueB');
  const djFavFilterB  = document.getElementById('djFavFilterB');

  // Mixer center
  const djGainACtrl   = document.getElementById('djGainA');
  const djGainBCtrl   = document.getElementById('djGainB');
  const djCrossfader  = document.getElementById('djCrossfader');
  const djPlayA       = document.getElementById('djPlayA');
  const djPlayB       = document.getElementById('djPlayB');
  const djTempoA      = document.getElementById('djTempoA');
  const djTempoB      = document.getElementById('djTempoB');

  // Footer
  const djFooterA     = document.getElementById('djFooterA');
  const djFooterB     = document.getElementById('djFooterB');

  // ── Audio Context ─────────────────────────────────────────────────────────
  const hasWebAudio = !!(window.AudioContext || window.webkitAudioContext);
  let ctx = null;

  // ── Audio elements (separate from main player) ────────────────────────────
  const audioA = document.getElementById('radioAudio');
  audioA.crossOrigin = 'anonymous';
  audioA.preload = 'none';
  const audioB = new Audio();
  audioB.crossOrigin = 'anonymous';
  audioB.preload = 'none';

  // ── Web Audio nodes ───────────────────────────────────────────────────────
  let gainNodeA = null, gainNodeB = null;
  let masterGain = null;
  let srcNodeA = null, srcNodeB = null;
  let eqFiltersA = [], eqFiltersB = [];
  let filterNodeA = null, filterNodeB = null;
  let bpmAnalyserA = null, bpmAnalyserB = null;
  let audioInitialized = false;

  // Filter states: 0=OFF, 1=LP, 2=HP
  let filterStateA = 0, filterStateB = 0;

  // ── Deck state ────────────────────────────────────────────────────────────
  let stationA = null, stationB = null;
  let djStations  = [];
  let djStationsA = [];
  let djStationsB = [];
  let djFavFilterActiveA = false;
  let djFavFilterActiveB = false;
  let djMetadataTimerA = null;
  let djMetadataTimerB = null;

  // BPM detection state
  let bpmDataA = { peaks: [], lastRMS: 0, avgRMS: 0 };
  let bpmDataB = { peaks: [], lastRMS: 0, avgRMS: 0 };
  let bpmTimerA = null, bpmTimerB = null;
  let displayedBpmA = '---', displayedBpmB = '---';

  // ── Init Web Audio (called on first play) ─────────────────────────────────
  function initWebAudio() {
    if (audioInitialized) return;
    if (!hasWebAudio) return;

    try {
      if (typeof audioContext !== 'undefined' && audioContext && audioContext.state !== 'closed') {
        ctx = audioContext;
      } else if (window.audioContext && window.audioContext.state !== 'closed') {
        ctx = window.audioContext;
      } else {
        ctx = new (window.AudioContext || window.webkitAudioContext)({
          latencyHint: 'interactive',
          sampleRate: 44100
        });
      }

      masterGain = ctx.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(ctx.destination);
      if (window._analyser) masterGain.connect(window._analyser);

      // Deck A chain: source → gainA → eqA → filterA → masterGain
      if (typeof source !== 'undefined' && source) {
        srcNodeA = source;
      } else {
        srcNodeA  = ctx.createMediaElementSource(audioA);
        if (typeof source !== 'undefined') {
          source = srcNodeA;
        }
        if (typeof audioContext !== 'undefined') {
          audioContext = ctx;
        }
      }
      gainNodeA = ctx.createGain();
      gainNodeA.gain.value = 1.0;
      eqFiltersA = buildEQChain(ctx);
      filterNodeA = createFilter(ctx, 'lowpass');
      
      // Prevent parallel connection issues by disconnecting first
      srcNodeA.disconnect();
      srcNodeA.connect(gainNodeA);
      gainNodeA.connect(eqFiltersA[0]);
      eqFiltersA[eqFiltersA.length - 1].connect(filterNodeA);
      filterNodeA.connect(masterGain);
      bpmAnalyserA = ctx.createAnalyser();
      bpmAnalyserA.fftSize = 256;
      gainNodeA.connect(bpmAnalyserA);

      // Deck B chain
      srcNodeB  = ctx.createMediaElementSource(audioB);
      gainNodeB = ctx.createGain();
      gainNodeB.gain.value = 0.0;
      eqFiltersB = buildEQChain(ctx);
      filterNodeB = createFilter(ctx, 'lowpass');
      srcNodeB.connect(gainNodeB);
      gainNodeB.connect(eqFiltersB[0]);
      eqFiltersB[eqFiltersB.length - 1].connect(filterNodeB);
      filterNodeB.connect(masterGain);
      bpmAnalyserB = ctx.createAnalyser();
      bpmAnalyserB.fftSize = 256;
      gainNodeB.connect(bpmAnalyserB);

      updateCrossfader();
      audioInitialized = true;
      console.log('[DJ] Web Audio initialized');
    } catch (err) {
      console.error('[DJ] Web Audio init failed:', err);
      showNoAudioWarning();
    }
  }

  function buildEQChain(audioCtx) {
    const freqs = [8000, 1000, 200];
    const filters = freqs.map(freq => {
      const f = audioCtx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = freq;
      f.Q.value = 1.4;
      f.gain.value = 0;
      return f;
    });
    for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
    return filters;
  }

  function createFilter(audioCtx, type) {
    const f = audioCtx.createBiquadFilter();
    f.type = type;
    f.frequency.value = 22000;
    f.Q.value = 2;
    return f;
  }

  function showNoAudioWarning() {
    const warn = document.createElement('div');
    warn.className = 'dj-no-audio-warn';
    warn.textContent = 'Web Audio API not available – EQ, BPM disabled.';
    warn.style.cssText = 'color:#fa4;font-size:10px;padding:4px 8px;border:1px solid #fa4;border-radius:3px;margin:4px 0;';
    djMixer.querySelector('.dj-mixer-center')?.prepend(warn);
  }

  // ── Crossfader (constant-power law) ──────────────────────────────────────
  function updateCrossfader() {
    if (!gainNodeA || !gainNodeB) return;
    const x = parseFloat(djCrossfader.value) / 100;
    const gainA = (parseFloat(djGainACtrl.value) / 100) * Math.cos(x * Math.PI / 2);
    const gainB = (parseFloat(djGainBCtrl.value) / 100) * Math.sin(x * Math.PI / 2);
    gainNodeA.gain.setTargetAtTime(gainA, ctx.currentTime, 0.02);
    gainNodeB.gain.setTargetAtTime(gainB, ctx.currentTime, 0.02);
  }

  djCrossfader.addEventListener('input', updateCrossfader);
  djGainACtrl.addEventListener('input', updateCrossfader);
  djGainBCtrl.addEventListener('input', updateCrossfader);

  // ── EQ Sliders ────────────────────────────────────────────────────────────
  function wireEQ(slider, filters, index) {
    slider.addEventListener('input', () => {
      if (filters[index] && ctx) {
        filters[index].gain.setTargetAtTime(parseFloat(slider.value), ctx.currentTime, 0.05);
      }
    });
  }

  function wireAllEQ() {
    if (!audioInitialized) return;
    wireEQ(djEqHiA,  eqFiltersA, 0);
    wireEQ(djEqMidA, eqFiltersA, 1);
    wireEQ(djEqLoA,  eqFiltersA, 2);
    wireEQ(djEqHiB,  eqFiltersB, 0);
    wireEQ(djEqMidB, eqFiltersB, 1);
    wireEQ(djEqLoB,  eqFiltersB, 2);
  }

  // ── Filter Button (LP/HP cycle) ───────────────────────────────────────────
  const FILTER_LABELS  = ['LP/HP', '▼ LP', '▲ HP'];
  const FILTER_CLASSES = ['', 'lp', 'hp'];

  function cycleFilter(state, filterNode, btn) {
    const nextState = (state + 1) % 3;
    btn.textContent = FILTER_LABELS[nextState];
    btn.classList.remove('lp', 'hp');
    if (FILTER_CLASSES[nextState]) btn.classList.add(FILTER_CLASSES[nextState]);

    if (!filterNode || !ctx) return nextState;
    const now = ctx.currentTime;
    if (nextState === 0) {
      filterNode.type = 'lowpass';
      filterNode.frequency.cancelScheduledValues(now);
      filterNode.frequency.setValueAtTime(22000, now);
    } else if (nextState === 1) {
      filterNode.type = 'lowpass';
      filterNode.frequency.cancelScheduledValues(now);
      filterNode.frequency.setValueAtTime(8000, now);
      filterNode.frequency.linearRampToValueAtTime(400, now + 0.5);
    } else {
      filterNode.type = 'highpass';
      filterNode.frequency.cancelScheduledValues(now);
      filterNode.frequency.setValueAtTime(400, now);
      filterNode.frequency.linearRampToValueAtTime(4000, now + 0.5);
    }
    return nextState;
  }

  djFilterBtnA.addEventListener('click', () => {
    if (!audioInitialized) { initWebAudio(); wireAllEQ(); }
    filterStateA = cycleFilter(filterStateA, filterNodeA, djFilterBtnA);
  });
  djFilterBtnB.addEventListener('click', () => {
    if (!audioInitialized) { initWebAudio(); wireAllEQ(); }
    filterStateB = cycleFilter(filterStateB, filterNodeB, djFilterBtnB);
  });

  // ── Update vinyl label (favicon + fallback text) ──────────────────────────
  function updateVinylLabel(deck, station) {
    const faviconEl   = deck === 'A' ? djFaviconA   : djFaviconB;
    const labelTextEl = deck === 'A' ? djLabelTextA : djLabelTextB;

    if (!faviconEl || !labelTextEl) return;

    if (station && station.favicon) {
      faviconEl.src = station.favicon;
      faviconEl.alt = station.name || '';
      faviconEl.onload  = () => {
        faviconEl.classList.add('loaded');
        labelTextEl.style.display = 'none';
      };
      faviconEl.onerror = () => {
        faviconEl.classList.remove('loaded');
        labelTextEl.style.display = '';
        labelTextEl.textContent = (station.name || deck).slice(0, 2).toUpperCase();
      };
    } else {
      faviconEl.classList.remove('loaded');
      faviconEl.src = '';
      labelTextEl.style.display = '';
      labelTextEl.textContent = station
        ? (station.name || deck).slice(0, 2).toUpperCase()
        : deck;
    }
  }

  // ── CSS spinning ──────────────────────────────────────────────────────────
  function setSpinning(deck, spinning) {
    const vinylEl = deck === 'A' ? djVinylA : djVinylB;
    if (!vinylEl) return;
    if (spinning) {
      vinylEl.classList.add('spinning');
    } else {
      vinylEl.classList.remove('spinning');
    }
  }

  // ── Station list rendering ────────────────────────────────────────────────
  function renderStationList(listEl, stations, deck) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const activeStation = deck === 'A' ? stationA : stationB;
    stations.forEach(st => {
      const row = document.createElement('div');
      row.className = 'dj-station-row' + (activeStation && activeStation.id === st.id ? ' active' : '');

      // Mini vinyl disc with favicon
      const disc = document.createElement('div');
      disc.className = 'dj-station-row-disc';
      if (st.favicon) {
        const img = document.createElement('img');
        img.src = st.favicon;
        img.alt = '';
        img.onerror = () => { img.remove(); disc.appendChild(ph); };
        disc.appendChild(img);
      } else {
        const ph = document.createElement('span');
        ph.className = 'dj-station-row-disc-placeholder';
        ph.textContent = (st.name || '?').slice(0,2).toUpperCase();
        disc.appendChild(ph);
      }

      const name = document.createElement('span');
      name.className = 'dj-station-row-name';
      name.textContent = st.name;

      const meta = document.createElement('span');
      meta.className = 'dj-station-row-meta';
      meta.textContent = st.bitrate ? st.bitrate + 'k' : '';

      // Favorite button
      const isFav = window._isFavorite ? window._isFavorite(st.id) : false;
      const favBtn = document.createElement('button');
      favBtn.className = 'dj-station-row-fav' + (isFav ? ' active' : '');
      favBtn.innerHTML = `<i data-lucide="star" style="width:12px;height:12px;${isFav ? 'fill:currentColor;' : ''}"></i>`;
      favBtn.title = isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen';
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window._toggleFavorite) window._toggleFavorite(st.id);
      });

      row.appendChild(disc);
      row.appendChild(name);
      row.appendChild(meta);
      row.appendChild(favBtn);
      row.addEventListener('click', () => loadDeck(deck, st));
      listEl.appendChild(row);
      if (window.lucide) lucide.createIcons({ nodes: [favBtn] });
    });
  }

  // ── DJ Deck Metadata Polling ──────────────────────────────────────────────
  function startDJMetadata(deck) {
    const audio = deck === 'A' ? audioA : audioB;
    const station = deck === 'A' ? stationA : stationB;
    const trackEl = deck === 'A' ? djTrackA : djTrackB;

    if (!audio || audio.paused || !station || !trackEl) return;

    // Clear any existing polling for this deck
    stopDJMetadata(deck);

    // Initial fetch
    fetchDJMetadata(deck);

    // Set interval
    const timer = setInterval(() => {
      fetchDJMetadata(deck);
    }, 15000);

    if (deck === 'A') djMetadataTimerA = timer;
    else              djMetadataTimerB = timer;
  }

  function stopDJMetadata(deck) {
    const timer = deck === 'A' ? djMetadataTimerA : djMetadataTimerB;
    if (timer) {
      clearInterval(timer);
      if (deck === 'A') djMetadataTimerA = null;
      else              djMetadataTimerB = null;
    }
  }

  function fetchDJMetadata(deck) {
    const station = deck === 'A' ? stationA : stationB;
    const trackEl = deck === 'A' ? djTrackA : djTrackB;
    const audio = deck === 'A' ? audioA : audioB;

    if (!station || !trackEl || !audio || audio.paused) return;

    const stationAtStart = station;
    if (window._fetchMetadataForStation) {
      window._fetchMetadataForStation(station, (title) => {
        const currentStationOnDeck = deck === 'A' ? stationA : stationB;
        const currentAudio = deck === 'A' ? audioA : audioB;
        if (currentStationOnDeck === stationAtStart && currentAudio && !currentAudio.paused) {
          trackEl.textContent = title;
        }
      });
    }
  }

  // ── Load Station on a Deck ────────────────────────────────────────────────
  function loadDeck(deck, station) {
    const audio    = deck === 'A' ? audioA : audioB;
    const playBtn  = deck === 'A' ? djPlayA : djPlayB;
    const wasPlaying = !audio.paused;

    audio.pause();
    stopDJMetadata(deck);

    // Stop spinning while loading
    setSpinning(deck, false);
    if (playBtn) {
      playBtn.classList.remove('dj-playing');
      playBtn.innerHTML = deck === 'A' ? '&#9654; A' : '&#9654; B';
    }

    audio.src = station.streamUrl;

    if (deck === 'A') {
      stationA = station;
      if (djNameA)   djNameA.textContent  = station.name;
      if (djTrackA)  djTrackA.textContent = station.genre ? `${station.genre} · ${station.country}` : '—';
      if (djFooterA) djFooterA.textContent = station.name;
      if (djBpmA)    djBpmA.textContent   = '--- BPM';
      displayedBpmA = '---';
      bpmDataA = { peaks: [], lastRMS: 0, avgRMS: 0 };
      document.getElementById('djDeckA')?.classList.add('active-deck');

      // Update global main player station variables!
      currentStation = station;
      const idx = (typeof displayedStations !== 'undefined') ? displayedStations.findIndex(s => s && s.id === station.id) : -1;
      currentStationIndex = idx >= 0 ? idx : -1;

      // Update main player background UI elements
      if (stationNameEl) {
        stationNameEl.textContent = station.name;
        stationNameEl.setAttribute('data-fullname', station.name);
      }
      if (stationInfoEl) {
        stationInfoEl.textContent = station.genre ? `${station.genre} · ${station.country} · ${station.bitrate}kbps` : '—';
      }
      if (coverEl) {
        coverEl.style.backgroundImage = station.favicon ? `url(${station.favicon})` : '';
        if (station.favicon) {
          coverEl.style.backgroundSize = 'contain';
          coverEl.style.backgroundPosition = 'center';
          coverEl.style.backgroundRepeat = 'no-repeat';
        } else {
          coverEl.style.background = 'radial-gradient(circle at 30% 20%, #f97316, #111827 60%)';
        }
      }
      // Trigger retro UI update
      if (window._retroStationChanged) window._retroStationChanged();
    } else {
      stationB = station;
      if (djNameB)   djNameB.textContent  = station.name;
      if (djTrackB)  djTrackB.textContent = station.genre ? `${station.genre} · ${station.country}` : '—';
      if (djFooterB) djFooterB.textContent = station.name;
      if (djBpmB)    djBpmB.textContent   = '--- BPM';
      displayedBpmB = '---';
      bpmDataB = { peaks: [], lastRMS: 0, avgRMS: 0 };
      document.getElementById('djDeckB')?.classList.add('active-deck');
    }

    // Update vinyl label
    updateVinylLabel(deck, station);

    // Re-render list to update active row highlight
    const listEl = deck === 'A' ? djStationListA : djStationListB;
    const sts    = deck === 'A' ? djStationsA    : djStationsB;
    renderStationList(listEl, sts, deck);

    // Auto-resume if was playing
    if (wasPlaying) {
      audio.play().then(() => {
        setSpinning(deck, true);
        if (playBtn) {
          playBtn.classList.add('dj-playing');
          playBtn.innerHTML = deck === 'A' ? '&#9646;&#9646; A' : '&#9646;&#9646; B';
        }
        startBpmDetection(deck);
        startDJMetadata(deck);
      }).catch(err => console.warn('[DJ] Play after load failed:', err));
    }
  }

  // ── Play / Pause Decks ────────────────────────────────────────────────────
  function toggleDeck(deck) {
    if (!audioInitialized) { initWebAudio(); wireAllEQ(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();

    const audio   = deck === 'A' ? audioA   : audioB;
    const playBtn = deck === 'A' ? djPlayA  : djPlayB;
    const station = deck === 'A' ? stationA : stationB;

    if (!station) return;

    if (audio.paused) {
      if (!audio.src || audio.src === window.location.href) audio.src = station.streamUrl;
      audio.play().then(() => {
        setSpinning(deck, true);
        playBtn.classList.add('dj-playing');
        playBtn.innerHTML = deck === 'A' ? '&#9646;&#9646; A' : '&#9646;&#9646; B';
        startBpmDetection(deck);
        startDJMetadata(deck);
        // Sync mirror play button
        const mirrorId = deck === 'A' ? 'djPlayAm' : 'djPlayBm';
        const mirror = document.getElementById(mirrorId);
        if (mirror) { mirror.classList.add('dj-playing'); mirror.innerHTML = playBtn.innerHTML; }
      }).catch(err => console.warn('[DJ] Play failed:', err));
    } else {
      audio.pause();
      setSpinning(deck, false);
      playBtn.classList.remove('dj-playing');
      playBtn.innerHTML = deck === 'A' ? '&#9654; A' : '&#9654; B';
      stopBpmDetection(deck);
      stopDJMetadata(deck);
      const mirrorId = deck === 'A' ? 'djPlayAm' : 'djPlayBm';
      const mirror = document.getElementById(mirrorId);
      if (mirror) { mirror.classList.remove('dj-playing'); mirror.innerHTML = playBtn.innerHTML; }
    }
  }

  djPlayA.addEventListener('click', () => toggleDeck('A'));
  djPlayB.addEventListener('click', () => toggleDeck('B'));

  // ── CUE Button ────────────────────────────────────────────────────────────
  function doCue(deck) {
    const btn   = deck === 'A' ? djCueA   : djCueB;
    const audio = deck === 'A' ? audioA   : audioB;
    const gain  = deck === 'A' ? gainNodeA : gainNodeB;

    btn.classList.add('active');
    if (!audio.paused && gain && ctx) {
      const orig = gain.gain.value;
      gain.gain.setTargetAtTime(Math.min(orig * 1.5, 1.5), ctx.currentTime, 0.01);
      setTimeout(() => {
        gain.gain.setTargetAtTime(orig, ctx.currentTime, 0.05);
        btn.classList.remove('active');
      }, 2000);
    } else {
      setTimeout(() => btn.classList.remove('active'), 300);
    }
  }

  djCueA.addEventListener('click', () => doCue('A'));
  djCueB.addEventListener('click', () => doCue('B'));

  // ── BPM Detection ─────────────────────────────────────────────────────────
  function startBpmDetection(deck) {
    if (!audioInitialized) return;
    const analyser = deck === 'A' ? bpmAnalyserA : bpmAnalyserB;
    if (!analyser) return;

    stopBpmDetection(deck); // clear any existing
    const data = deck === 'A' ? bpmDataA : bpmDataB;
    const bufLen = analyser.fftSize;
    const timeDomain = new Float32Array(bufLen);

    const intervalId = setInterval(() => {
      analyser.getFloatTimeDomainData(timeDomain);
      let rms = 0;
      for (let i = 0; i < bufLen; i++) rms += timeDomain[i] * timeDomain[i];
      rms = Math.sqrt(rms / bufLen);
      data.avgRMS = data.avgRMS * 0.95 + rms * 0.05;
      const threshold = data.avgRMS * 1.3;
      if (rms > threshold && rms > 0.01) {
        const now = performance.now();
        if (!data.peaks.length || now - data.peaks[data.peaks.length - 1] > 200) {
          data.peaks.push(now);
          if (data.peaks.length > 16) data.peaks.shift();
        }
      }
    }, 100);

    const displayId = setInterval(() => {
      const bpmVal = computeBPM(deck === 'A' ? bpmDataA : bpmDataB);
      if (deck === 'A') {
        displayedBpmA = bpmVal;
        if (djBpmA) djBpmA.textContent = bpmVal === '---' ? '--- BPM' : `${bpmVal} BPM`;
      } else {
        displayedBpmB = bpmVal;
        if (djBpmB) djBpmB.textContent = bpmVal === '---' ? '--- BPM' : `${bpmVal} BPM`;
      }
    }, 2000);

    if (deck === 'A') bpmTimerA = { intervalId, displayId };
    else              bpmTimerB = { intervalId, displayId };
  }

  function stopBpmDetection(deck) {
    const timer = deck === 'A' ? bpmTimerA : bpmTimerB;
    if (!timer) return;
    clearInterval(timer.intervalId);
    clearInterval(timer.displayId);
    if (deck === 'A') bpmTimerA = null;
    else              bpmTimerB = null;
  }

  function computeBPM(data) {
    if (data.peaks.length < 4) return '---';
    const intervals = [];
    for (let i = 1; i < data.peaks.length; i++) intervals.push(data.peaks[i] - data.peaks[i - 1]);
    const sorted = [...intervals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianInterval = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
    if (medianInterval <= 0) return '---';
    const bpm = Math.round(60000 / medianInterval);
    if (bpm < 60 || bpm > 200) return '---';
    return String(bpm);
  }

  // ── Per-deck filtering ────────────────────────────────────────────────────
  let djHttpsGlobal = true;

  function getStationLimit() {
    return parseInt(localStorage.getItem('brummiesStationLimit') || '300');
  }

  window._djSyncStations = syncStations;

  function getDeckSort(deck) {
    const container = deck === 'A' ? djSortA : djSortB;
    if (!container) return 'votes';
    const activeBtn = container.querySelector('.dj-sort-btn.active');
    return activeBtn ? activeBtn.dataset.sort : 'votes';
  }

  function sortStations(stations, sortType) {
    return stations.sort((a, b) => {
      switch (sortType) {
        case 'distance':
          if (a.distance === null || a.distance === undefined) return 1;
          if (b.distance === null || b.distance === undefined) return -1;
          return a.distance - b.distance;
        case 'bitrate':
          return (b.bitrate || 0) - (a.bitrate || 0);
        case 'votes':
        default:
          return (b.votes || 0) - (a.votes || 0);
      }
    });
  }

  function filterDeckStations(genreEl, searchEl, subgenreEl, httpsEl, deck) {
    const src = (typeof allStations !== 'undefined' && allStations.length) ? allStations : [];
    const genre  = genreEl?.value  || '';
    const subgenre = subgenreEl?.value || '';
    const search = (searchEl?.value || '').toLowerCase().trim();
    const https  = httpsEl?.checked || djHttpsGlobal;
    const favActive = deck === 'A' ? djFavFilterActiveA : djFavFilterActiveB;
    let filtered = src.filter(st => {
      if (favActive) {
        const isFav = window._isFavorite ? window._isFavorite(st.id) : false;
        if (!isFav) return false;
      }
      if (genre === 'favorites') {
        const isFav = window._isFavorite ? window._isFavorite(st.id) : false;
        if (!isFav) return false;
      } else if (genre && !((st.genre || '') + (st.tags || '')).toLowerCase().includes(genre.toLowerCase())) {
        return false;
      }
      if (subgenre && !((st.genre || '') + (st.tags || '')).toLowerCase().includes(subgenre.toLowerCase())) return false;
      if (search && !st.name.toLowerCase().includes(search)) return false;
      if (https  && !st.streamUrl?.startsWith('https')) return false;
      return true;
    });

    const sortType = getDeckSort(deck);
    filtered = sortStations(filtered, sortType);

    const limit = getStationLimit();
    return filtered.slice(0, limit);
  }

  function syncStations() {
    const src = (typeof displayedStations !== 'undefined' && displayedStations.length)
      ? displayedStations
      : (typeof allStations !== 'undefined' ? allStations : []);
    
    // Sort general DJ stations by votes by default
    const limit = getStationLimit();
    djStations = sortStations([...src], 'votes').slice(0, limit);

    djStationsA = filterDeckStations(djGenreA, djSearchA, djSubgenreA, djHttpsA, 'A');
    djStationsB = filterDeckStations(djGenreB, djSearchB, djSubgenreB, djHttpsB, 'B');
    if (!djStationsA.length && !djFavFilterActiveA && djGenreA?.value !== 'favorites') djStationsA = djStations;
    if (!djStationsB.length && !djFavFilterActiveB && djGenreB?.value !== 'favorites') djStationsB = djStations;
    renderStationList(djStationListA, djStationsA, 'A');
    renderStationList(djStationListB, djStationsB, 'B');
  }

  // ── Subgenre population ───────────────────────────────────────────────────
  const subgenreMapDJ = {
    rock:       ['classic rock','hard rock','soft rock','alternative','indie','progressive','punk'],
    metal:      ['heavy metal','death metal','black metal','thrash metal','metalcore','power metal'],
    pop:        ['pop rock','synth pop','indie pop','electropop','dance pop'],
    classic:    ['classical','baroque','romantic','opera','symphony'],
    electronic: ['techno','house','trance','drum and bass','ambient','dubstep'],
    jazz:       ['smooth jazz','bebop','swing','fusion','blues','soul'],
  };
  function populateSubgenre(genre, subgenreEl) {
    if (!subgenreEl) return;
    const opts = subgenreMapDJ[genre] || [];
    subgenreEl.innerHTML = '<option value="">Alle</option>';
    opts.forEach(s => {
      const o = document.createElement('option');
      o.value = o.textContent = s;
      subgenreEl.appendChild(o);
    });
  }

  // ── Per-deck filter wiring ────────────────────────────────────────────────
  function makeDeckFilter(deck, genreEl, searchEl, subgenreEl, httpsEl) {
    const refilter = () => {
      if (deck === 'A') {
        djStationsA = filterDeckStations(genreEl, searchEl, subgenreEl, httpsEl, 'A');
        if (!djStationsA.length && !djFavFilterActiveA && genreEl?.value !== 'favorites') djStationsA = djStations;
        renderStationList(djStationListA, djStationsA, 'A');
      } else {
        djStationsB = filterDeckStations(genreEl, searchEl, subgenreEl, httpsEl, 'B');
        if (!djStationsB.length && !djFavFilterActiveB && genreEl?.value !== 'favorites') djStationsB = djStations;
        renderStationList(djStationListB, djStationsB, 'B');
      }
    };
    if (genreEl) genreEl.addEventListener('change', () => {
      populateSubgenre(genreEl.value, subgenreEl);
      refilter();
    });
    if (subgenreEl) subgenreEl.addEventListener('change', refilter);
    if (searchEl) {
      searchEl.addEventListener('input', refilter);
      searchEl.addEventListener('keydown', e => { if (e.key === 'Enter') refilter(); });
    }
    if (httpsEl) httpsEl.addEventListener('change', refilter);
  }
  makeDeckFilter('A', djGenreA, djSearchA, djSubgenreA, djHttpsA);
  makeDeckFilter('B', djGenreB, djSearchB, djSubgenreB, djHttpsB);

  // ── Quick favorites filter wiring ─────────────────────────────────────────
  function wireFavFilterBtn(btn, deck) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const active = deck === 'A' ? !djFavFilterActiveA : !djFavFilterActiveB;
      if (deck === 'A') {
        djFavFilterActiveA = active;
      } else {
        djFavFilterActiveB = active;
      }
      btn.classList.toggle('active', active);

      if (deck === 'A') {
        djStationsA = filterDeckStations(djGenreA, djSearchA, djSubgenreA, djHttpsA, 'A');
        if (!djStationsA.length && !djFavFilterActiveA && djGenreA?.value !== 'favorites') djStationsA = djStations;
        renderStationList(djStationListA, djStationsA, 'A');
      } else {
        djStationsB = filterDeckStations(djGenreB, djSearchB, djSubgenreB, djHttpsB, 'B');
        if (!djStationsB.length && !djFavFilterActiveB && djGenreB?.value !== 'favorites') djStationsB = djStations;
        renderStationList(djStationListB, djStationsB, 'B');
      }
    });
  }
  wireFavFilterBtn(djFavFilterA, 'A');
  wireFavFilterBtn(djFavFilterB, 'B');

  // ── Sort buttons ──────────────────────────────────────────────────────────
  function wireSortBtns(container, deck) {
    if (!container) return;
    container.querySelectorAll('.dj-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.dj-sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (deck === 'A') {
          djStationsA = filterDeckStations(djGenreA, djSearchA, djSubgenreA, djHttpsA, 'A');
          renderStationList(djStationListA, djStationsA, 'A');
        } else {
          djStationsB = filterDeckStations(djGenreB, djSearchB, djSubgenreB, djHttpsB, 'B');
          renderStationList(djStationListB, djStationsB, 'B');
        }
      });
    });
  }
  wireSortBtns(djSortA, 'A');
  wireSortBtns(djSortB, 'B');

  // ── Tempo value display ───────────────────────────────────────────────────
  if (djTempoA && djTempoValA) {
    djTempoA.addEventListener('input', () => {
      const v = parseFloat(djTempoA.value);
      djTempoValA.textContent = `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
    });
  }
  if (djTempoB && djTempoValB) {
    djTempoB.addEventListener('input', () => {
      const v = parseFloat(djTempoB.value);
      djTempoValB.textContent = `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
    });
  }

  // ── EQ value display ─────────────────────────────────────────────────────
  [djEqHiA, djEqMidA, djEqLoA, djEqHiB, djEqMidB, djEqLoB].forEach(slider => {
    if (!slider) return;
    const valEl = slider.parentElement?.querySelector('.dj-eq-val');
    slider.addEventListener('input', () => {
      if (valEl) valEl.textContent = slider.value > 0 ? `+${slider.value}` : slider.value;
    });
  });

  // ── Central HTTPS toggle ─────────────────────────────────────────────────
  const djHttpsToggle = document.getElementById('djHttpsCenter');
  if (djHttpsToggle) {
    djHttpsToggle.addEventListener('change', () => {
      djHttpsGlobal = djHttpsToggle.checked;
      if (djHttpsA) djHttpsA.checked = djHttpsGlobal;
      if (djHttpsB) djHttpsB.checked = djHttpsGlobal;
      syncStations();
    });
  }

  // ── DJ Visualizer (center canvas, RAF-driven) ─────────────────────────────
  const djVisCvs = document.getElementById('djVisualizer');
  let visRafId = null;

  function drawDJVisualizer() {
    if (!djVisCvs) return;

    const isAPlaying = audioA && !audioA.paused;
    const isBPlaying = audioB && !audioB.paused;

    let analyserNode = null;
    if (isAPlaying && isBPlaying) {
      const crossValue = parseFloat(document.getElementById('djCrossfader')?.value || '50');
      analyserNode = (crossValue > 50) ? bpmAnalyserB : bpmAnalyserA;
    } else if (isBPlaying) {
      analyserNode = bpmAnalyserB;
    } else if (isAPlaying) {
      analyserNode = bpmAnalyserA;
    } else {
      analyserNode = null;
    }

    const w = djVisCvs.width  || 120;
    const h = djVisCvs.height || 80;
    const vc = djVisCvs.getContext('2d');

    const rootStyle = getComputedStyle(document.documentElement);
    const colorAccent = rootStyle.getPropertyValue('--color-accent').trim() || '#bd00ff';
    const colorAccentRgb = rootStyle.getPropertyValue('--color-accent-rgb').trim() || '189, 0, 255';

    if (!analyserNode) {
      vc.fillStyle = '#020203';
      vc.fillRect(0, 0, w, h);
      
      // Draw grid
      vc.strokeStyle = `rgba(${colorAccentRgb}, 0.04)`;
      vc.lineWidth = 1;
      for (let y = 10; y < h; y += 15) {
        vc.beginPath();
        vc.moveTo(0, y);
        vc.lineTo(w, y);
        vc.stroke();
      }
      for (let x = 10; x < w; x += 25) {
        vc.beginPath();
        vc.moveTo(x, 0);
        vc.lineTo(x, h);
        vc.stroke();
      }

      // Pulsing standby center line
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
      vc.strokeStyle = `rgba(${colorAccentRgb}, ${0.1 + pulse * 0.15})`;
      vc.lineWidth = 2;
      vc.beginPath();
      vc.moveTo(0, h / 2);
      vc.lineTo(w, h / 2);
      vc.stroke();

      visRafId = requestAnimationFrame(drawDJVisualizer);
      return;
    }

    const buf = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(buf);
    
    // Sleek trail effect background
    vc.fillStyle = 'rgba(2, 2, 3, 0.18)';
    vc.fillRect(0, 0, w, h);

    // Draw faint cyber grid
    vc.strokeStyle = `rgba(${colorAccentRgb}, 0.03)`;
    vc.lineWidth = 1;
    for (let y = 10; y < h; y += 15) {
      vc.beginPath();
      vc.moveTo(0, y);
      vc.lineTo(w, y);
      vc.stroke();
    }
    for (let x = 10; x < w; x += 25) {
      vc.beginPath();
      vc.moveTo(x, 0);
      vc.lineTo(x, h);
      vc.stroke();
    }

    // Dynamic horizontal gradient blending Cyan (Deck A) -> Purple/Theme (Center) -> Magenta (Deck B)
    const grad = vc.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#00f3ff');
    grad.addColorStop(0.5, colorAccent);
    grad.addColorStop(1, '#ff007f');

    const barCount = 40;
    const barW = Math.max(2, (w / barCount) * 0.7);
    const gap = (w / barCount) * 0.3;
    const step = Math.floor(buf.length * 0.65 / barCount) || 1;

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += buf[i * step + j] || 0;
      }
      const val = sum / step / 255;
      const maxBarH = h * 0.42;
      const bh = val * maxBarH;
      const x = i * (barW + gap) + gap / 2;
      const cy = h / 2;

      const ratio = i / barCount;
      let shadowColor = colorAccent;
      if (ratio < 0.35) {
        shadowColor = '#00f3ff';
      } else if (ratio > 0.65) {
        shadowColor = '#ff007f';
      }

      vc.fillStyle = grad;
      vc.shadowBlur = 6;
      vc.shadowColor = shadowColor;

      if (bh > 1) {
        vc.beginPath();
        const barY = cy - bh;
        const barHeight = bh * 2;
        if (vc.roundRect) {
          vc.roundRect(x, barY, barW, barHeight, 2);
        } else {
          vc.rect(x, barY, barW, barHeight);
        }
        vc.fill();
      } else {
        vc.beginPath();
        vc.fillStyle = `rgba(${colorAccentRgb}, 0.4)`;
        vc.shadowBlur = 0;
        vc.arc(x + barW / 2, cy, 1, 0, Math.PI * 2);
        vc.fill();
      }
    }
    
    // Reset shadow blur for future rendering operations
    vc.shadowBlur = 0;
    visRafId = requestAnimationFrame(drawDJVisualizer);
  }

  // ── Entry / Exit ──────────────────────────────────────────────────────────
  function enterDJ() {
    const wasPlaying = audioA && !audioA.paused;

    djMixer.hidden = false;
    document.body.classList.add('dj-active');
    syncStations();

    // Load currently playing station to Deck A if not loaded or if it changed
    if (typeof currentStation !== 'undefined' && currentStation) {
      if (!stationA || stationA.id !== currentStation.id) {
        stationA = currentStation;
        if (djNameA)  djNameA.textContent  = currentStation.name;
        if (djTrackA) djTrackA.textContent = currentStation.genre
          ? `${currentStation.genre} · ${currentStation.country}` : '—';
        if (djFooterA) djFooterA.textContent = currentStation.name;
        document.getElementById('djDeckA')?.classList.add('active-deck');
        updateVinylLabel('A', currentStation);
      }
    }

    if (wasPlaying && stationA) {
      setSpinning('A', true);
      if (djPlayA) {
        djPlayA.classList.add('dj-playing');
        djPlayA.innerHTML = '&#9646;&#9646; A';
      }
      const djPlayAm = document.getElementById('djPlayAm');
      if (djPlayAm) {
        djPlayAm.classList.add('dj-playing');
        djPlayAm.innerHTML = '&#9646;&#9646; A';
      }
      startBpmDetection('A');
      startDJMetadata('A');

      // Ensure web audio is initialized and routed
      if (!audioInitialized) { initWebAudio(); wireAllEQ(); }
      if (ctx && ctx.state === 'suspended') ctx.resume();

      // Route source node to Deck A Web Audio chain
      if (typeof source !== 'undefined' && source) {
        source.disconnect();
        source.connect(gainNodeA);
      }
    } else {
      setSpinning('A', false);
      if (djPlayA) {
        djPlayA.classList.remove('dj-playing');
        djPlayA.innerHTML = '&#9654; A';
      }
      const djPlayAm = document.getElementById('djPlayAm');
      if (djPlayAm) {
        djPlayAm.classList.remove('dj-playing');
        djPlayAm.innerHTML = '&#9654; A';
      }
      stopBpmDetection('A');
      stopDJMetadata('A');
    }

    // If no stations yet, trigger API fetch
    if (!djStations.length) {
      const searchBtn = document.getElementById('searchBtn');
      if (searchBtn) {
        searchBtn.click();
        setTimeout(syncStations, 2000);
      }
    }

    // Size visualizer canvas and start loop
    if (djVisCvs) {
      djVisCvs.width  = djVisCvs.offsetWidth  || 120;
      djVisCvs.height = djVisCvs.offsetHeight || 80;
    }
    if (!visRafId) drawDJVisualizer();

    // Wire mixer-center mirror play buttons (each enterDJ call, guard duplicates)
    const djPlayAm = document.getElementById('djPlayAm');
    const djPlayBm = document.getElementById('djPlayBm');
    if (djPlayAm && !djPlayAm._djWired) {
      djPlayAm.addEventListener('click', () => toggleDeck('A'));
      djPlayAm._djWired = true;
    }
    if (djPlayBm && !djPlayBm._djWired) {
      djPlayBm.addEventListener('click', () => toggleDeck('B'));
      djPlayBm._djWired = true;
    }

    // Sync subgenre options from main app
    const mainSubgenre = document.getElementById('subgenreSelect');
    [djSubgenreA, djSubgenreB].forEach(sel => {
      if (!sel || !mainSubgenre) return;
      const current = sel.value;
      sel.innerHTML = mainSubgenre.innerHTML;
      sel.value = current;
    });

    if (window.lucide) lucide.createIcons({ nodes: [djMixer] });
  }

  function exitDJ() {
    djMixer.hidden = true;
    document.body.classList.remove('dj-active');

    const isAPlaying = audioA && !audioA.paused;
    const isBPlaying = audioB && !audioB.paused;

    // Stop secondary deck
    audioB.pause();

    setSpinning('A', false);
    setSpinning('B', false);
    stopBpmDetection('A');
    stopBpmDetection('B');
    stopDJMetadata('A');
    stopDJMetadata('B');
    if (visRafId) { cancelAnimationFrame(visRafId); visRafId = null; }
    if (djPlayA) { djPlayA.classList.remove('dj-playing'); djPlayA.innerHTML = '&#9654; A'; }
    if (djPlayB) { djPlayB.classList.remove('dj-playing'); djPlayB.innerHTML = '&#9654; B'; }

    // Route source back to main EQ / filters
    if (typeof source !== 'undefined' && source) {
      source.disconnect();
      if (typeof filters !== 'undefined' && filters && filters[0]) {
        source.connect(filters[0]);
      } else if (typeof analyser !== 'undefined' && analyser) {
        source.connect(analyser);
      } else if (typeof audioContext !== 'undefined' && audioContext) {
        source.connect(audioContext.destination);
      }
    }

    if (isBPlaying && !isAPlaying) {
      // Secondary deck was playing, transfer to main player
      if (stationB) {
        if (typeof selectStation === 'function') {
          selectStation(stationB, -1);
        }
      }
    } else if (isAPlaying) {
      // Primary deck (main player) was playing, keep it playing and sync UI!
      if (stationA) {
        currentStation = stationA;
        const idx = (typeof displayedStations !== 'undefined') ? displayedStations.findIndex(s => s && s.id === stationA.id) : -1;
        currentStationIndex = idx >= 0 ? idx : -1;
        
        if (stationNameEl) {
          stationNameEl.textContent = stationA.name;
          stationNameEl.setAttribute('data-fullname', stationA.name);
        }
        if (stationInfoEl) {
          stationInfoEl.textContent = stationA.genre ? `${stationA.genre} · ${stationA.country} · ${stationA.bitrate}kbps` : '—';
        }
        if (coverEl) {
          coverEl.style.backgroundImage = stationA.favicon ? `url(${stationA.favicon})` : '';
          if (stationA.favicon) {
            coverEl.style.backgroundSize = 'contain';
            coverEl.style.backgroundPosition = 'center';
            coverEl.style.backgroundRepeat = 'no-repeat';
          } else {
            coverEl.style.background = 'radial-gradient(circle at 30% 20%, #f97316, #111827 60%)';
          }
          coverEl.classList.add('playing');
        }
        if (playBtn) {
          setIcon(playBtn, "pause");
          playBtn.disabled = false;
        }
        if (window._retroStationChanged) window._retroStationChanged();
      }
    }

    if (welcomeScreen) welcomeScreen.classList.remove('hidden');
  }

  window._enterDJ = enterDJ;
  window._exitDJ  = exitDJ;
  window._djUpdateFavorites = function() {
    if (typeof djStationListA !== 'undefined' && djStationListA) {
      djStationsA = filterDeckStations(djGenreA, djSearchA, djSubgenreA, djHttpsA, 'A');
      if (!djStationsA.length && !djFavFilterActiveA && djGenreA?.value !== 'favorites') djStationsA = djStations;
      renderStationList(djStationListA, djStationsA, 'A');
    }
    if (typeof djStationListB !== 'undefined' && djStationListB) {
      djStationsB = filterDeckStations(djGenreB, djSearchB, djSubgenreB, djHttpsB, 'B');
      if (!djStationsB.length && !djFavFilterActiveB && djGenreB?.value !== 'favorites') djStationsB = djStations;
      renderStationList(djStationListB, djStationsB, 'B');
    }
  };

  // ── Header logo → welcome (via ModeManager) ───────────────────────────────
  if (djLogoIcon) {
    djLogoIcon.addEventListener('click', () => ModeManager.switchTo('welcome'));
  }

  console.log('[DJ] DJ Booth initialized (CSS vinyl)');
})();

