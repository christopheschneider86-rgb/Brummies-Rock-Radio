    // --- GLOBALE VARIABLEN ---
    const allStations = [];
    let sortedStations = [];   // sorted/filtered view of allStations (never mutates allStations)
    let displayedStations = [];
    // Cached theme colors – updated in applyTheme/applyCustomTheme so the
    // 60 fps draw() loop never touches getComputedStyle.
    let cachedBgColor     = '';
    let cachedAccentColor = '';
    let favorites = JSON.parse(localStorage.getItem("brummiesFavorites") || "[]");
    let favoriteStationsData = JSON.parse(localStorage.getItem("brummiesFavoritesData") || "{}");
    let historyData = JSON.parse(localStorage.getItem("brummiesHistory") || "[]");
    let listeningStats = JSON.parse(localStorage.getItem("brummiesListeningStats") || "{}");
    let currentStation = null;
    let currentStationIndex = -1;
    let currentSort = ["distance"];
    let displayLimit = 20;
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
      "rock": ["classic rock", "hard rock", "soft rock", "alternative", "indie", "progressive", "punk"],
      "metal": ["heavy metal", "death metal", "black metal", "thrash metal", "metalcore", "power metal"],
      "pop": ["pop rock", "synth pop", "indie pop", "electropop", "dance pop"],
      "classic": ["classical", "baroque", "romantic", "opera"],
      "jazz": ["smooth jazz", "bebop", "swing", "fusion", "free jazz"]
    };
    
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
      'h2-nowplaying': '▶ Now Playing',
      'h2-history': 'Verlauf & Statistik',
      'h2-shuffle': 'Auto-Shuffle',
      'h2-sleep': 'Sleep Timer',
      'h2-equalizer': '🎚️ EQUALIZER & VISUALIZER',
      'h2-settings': '⚙️ Einstellungen',
      
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
      'settings-data': '📊 Datenverbrauch',
      'settings-support': '❤️ Unterstützung ❤️',
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
    
    // Apply translated texts to DOM
    function applyTextToUI(texts) {
      // ========== HEADERS ==========
      document.querySelectorAll('h2, h3').forEach(h => {
        const t = h.textContent.trim();
        
        // H2 Headers
        if (t.includes('Sendersuche') || t.includes('Station') || t.includes('Search') || t.includes('Recherche')) {
          h.textContent = texts['h2-search'];
        } else if (t.includes('Now Playing')) {
          h.textContent = texts['h2-nowplaying'];
        } else if (t.includes('Verlauf') || t.includes('History') || t.includes('Statistik') || t.includes('Statistics')) {
          h.textContent = texts['h2-history'];
        } else if (t.includes('Shuffle')) {
          h.textContent = texts['h2-shuffle'];
        } else if (t.includes('Sleep') || t.includes('Timer')) {
          h.textContent = texts['h2-sleep'];
        } else if (t.includes('EQUALIZER') || t.includes('VISUALIZER')) {
          h.textContent = texts['h2-equalizer'];
        } else if (t.includes('Einstellungen') || t.includes('Settings')) {
          h.textContent = texts['h2-settings'];
        }
        
        // H3 Settings Headers
        else if (t.includes('Sprache') || t.includes('Language')) {
          h.textContent = texts['settings-language'];
        } else if (t.includes('Theme')) {
          h.textContent = texts['settings-theme'];
        } else if (t.includes('Cloud Sync')) {
          h.textContent = '☁️ Cloud Sync';
        } else if (t.includes('Datenverbrauch') || t.includes('Data')) {
          h.textContent = texts['settings-data'];
        } else if (t.includes('Unterstützung') || t.includes('Support')) {
          h.textContent = texts['settings-support'];
        } else if (t.includes('Über') || t.includes('About')) {
          h.textContent = texts['settings-about'];
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
      if (donateBtn) donateBtn.textContent = texts['btn-donate'];
      
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
      
      const countryFilter = document.getElementById('countryFilter');
      if (countryFilter && countryFilter.options[0]) {
        countryFilter.options[0].textContent = texts['opt-all-countries'];
      }
      
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
        if (text === '🔍 Sendersuche' || text === '🔍 Station Search') {
          h2.textContent = currentLang === 'de' ? '🔍 Sendersuche' : '🔍 Station Search';
        } else if (text === '▶ Now Playing') {
          h2.textContent = '▶ Now Playing';
        } else if (text.includes('Verlauf') || text.includes('History')) {
          h2.textContent = currentLang === 'de' ? '📜 Verlauf & Statistik' : '📜 History & Statistics';
        } else if (text.includes('Shuffle')) {
          h2.textContent = '🔀 Auto-Shuffle';
        } else if (text.includes('Sleep') || text.includes('Timer')) {
          h2.textContent = '⏰ Sleep Timer';
        } else if (text.includes('Equalizer') || text.includes('EQUALIZER')) {
          h2.textContent = currentLang === 'de' ? '🎚️ EQUALIZER & VISUALIZER' : '🎚️ EQUALIZER & VISUALIZER';
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
           <option value="jazz">Jazz</option>` :
          `<option value="">All Genres</option>
           <option value="rock">Rock</option>
           <option value="metal">Metal</option>
           <option value="pop">Pop</option>
           <option value="classic">Classic</option>
           <option value="jazz">Jazz</option>`;
        genreSelect.value = selectedValue;
      }
      
      const subgenreSelect = document.getElementById('subgenreSelect');
      if (subgenreSelect && subgenreSelect.options.length === 1) {
        subgenreSelect.options[0].textContent = currentLang === 'de' ? 'Alle' : 'All';
      }
      
      const countryFilter = document.getElementById('countryFilter');
      if (countryFilter && countryFilter.options[0]) {
        countryFilter.options[0].textContent = currentLang === 'de' ? 'Alle Länder' : 'All Countries';
      }
      
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
      
      if (langSettingsLanguage) langSettingsLanguage.textContent = '🌍 Sprache / Language';
      if (langSelectLanguage) langSelectLanguage.textContent = 'Sprache wählen / Select language:';
      
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
    const countryFilter = document.getElementById("countryFilter");
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
        
        data.forEach(station => {
          const st = {
            id: station.stationuuid,
            name: station.name,
            streamUrl: station.url_resolved || station.url,
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
        displayLimit = 20;
        sortAndRenderStations();
        
      } catch (error) {
        console.error("Fehler:", error);
        stationsListEl.innerHTML = '<div class="loading">❌ Fehler</div>';
      }
    }

    function updateCountryFilter(countries) {
      const selected = countryFilter.value;
      countryFilter.innerHTML = '<option value="">Alle Länder</option>';
      
      countries.forEach(country => {
        const option = document.createElement("option");
        option.value = country;
        option.textContent = country;
        countryFilter.appendChild(option);
      });
      
      if (countries.includes(selected)) {
        countryFilter.value = selected;
      }
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
      
      const country = countryFilter.value;
      if (country) {
        list = list.filter(s => s.country === country);
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
          logo.innerHTML = `<img src="${st.favicon}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'" alt=""/>`;
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
    }

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
    async function fetchStreamMetadata() {
      if (!currentStation || audioEl.paused) return;

      // Snapshot which station we're fetching for — ignore result if station changed meanwhile
      const stationAtStart = currentStation;

      const streamUrl = currentStation.streamUrl;
      let base, mountPath;
      try {
        const u = new URL(streamUrl);
        base = `${u.protocol}//${u.host}`;
        mountPath = u.pathname; // e.g. "/rock" or "/stream/128"
      } catch { return; }

      // Ordered list of endpoints to try, most reliable first.
      // parseIcecastJson gets the mount path so it can match the right source.
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
            // Guard: only update if we're still on the same station
            if (currentStation === stationAtStart) {
              updateNowPlayingText(`${title}`);
            }
            return;
          }
        } catch { /* try next */ }
      }

      if (currentStation === stationAtStart) {
        updateNowPlayingText(`${currentStation.name} – Live`);
      }
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
        currentMetadata = text;
        nowPlayingTextEl.textContent = text;
        copyNowPlayingBtn.disabled = false;
        
        // Animation neu starten
        nowPlayingTextEl.style.animation = 'none';
        setTimeout(() => {
          nowPlayingTextEl.style.animation = '';
        }, 10);
        
        // Media Session aktualisieren mit neuem Song
        updateMediaSession();
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
      if (audioContext) return;
      if (isExternalAudio()) {
        console.log('External audio – skipping AudioContext');
        return;
      }

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
          latencyHint: 'playback',
          sampleRate: 44100
        });

        source  = audioContext.createMediaElementSource(audioEl);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

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
        console.log('AudioContext ready');
      } catch (err) {
        console.error('AudioContext init failed:', err);
      }
    }

    // Called from selectStation – probes CORS first, then decides whether
    // to enable the Web Audio graph for this stream.
    async function setupAudioForStation(station) {
      const url = station.streamUrl;

      // If AudioContext already running, just resume it
      if (audioContextReady) {
        if (audioContext.state === 'suspended') await audioContext.resume();
        return;
      }

      // iOS / CarPlay: skip CORS probe, play bare
      if (isExternalAudio()) return;

      // Probe CORS support for this stream
      const corsOK = await probeStreamCORS(url);
      if (corsOK) {
        // Enable CORS on the audio element so createMediaElementSource works
        audioEl.crossOrigin = 'anonymous';
        // Must reload src after setting crossOrigin
        audioEl.src = url;
        initAudioContext();
      } else {
        // No CORS – play without Web Audio graph
        audioEl.removeAttribute('crossOrigin');
        audioEl.src = url;
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
        
        audioEl.play()
          .then(() => {
            setIcon(playBtn, "pause");
            if (window.lucide) lucide.createIcons();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
          })
          .catch(err => {
            console.error("Play error:", err);
            stationInfoEl.textContent = "❌ Fehler";
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
          });
      } else {
        audioEl.pause();
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

  currentStation = station;
  currentStationIndex = index;
  currentMetadata = '';
  reconnectAttempts = 0;

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

  // Setup audio with CORS probe (sets audioEl.src internally)
  setupAudioForStation(station).then(() => {
    // If src was not set by setupAudioForStation (e.g. already CORS-ready),
    // ensure it points to the current station
    if (!audioEl.src || !audioEl.src.includes(station.streamUrl.split('?')[0])) {
      audioEl.src = station.streamUrl;
    }

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
    }).catch(err => {
      console.error('Stream error:', err);
      stationInfoEl.textContent = '❌ Fehler';
      coverEl.classList.remove('playing');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    });
  });
      
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
            // iOS: Check if audio element has a source and is ready
            if (!audioEl || !audioEl.src) {
              console.warn('Media Session play: No audio source');
              return;
            }
            
            if (!audioEl.paused) {
              console.log('Media Session play: Already playing');
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
            
            audioEl.pause();
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
      
      // iOS: Sync Media Session state
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    });

    audioEl.addEventListener("playing", () => {
      if (currentStation) {
        stationInfoEl.textContent = `🎶 ${currentStation.genre} · ${currentStation.bitrate}kbps`;
      }
      
      // iOS: Sync Media Session state
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    });

    audioEl.addEventListener("error", () => {
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
      if (!currentStation || reconnectAttempts >= maxReconnectAttempts) {
        if (reconnectAttempts >= maxReconnectAttempts) {
          stationInfoEl.textContent = "❌ Verbindung fehlgeschlagen";
          console.log("Max reconnect attempts reached");
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
    searchBtn.addEventListener("click", searchShoutcastStations);
    
    searchInput.addEventListener("input", () => {
      clearTimeout(searchInput.debounceTimer);
      searchInput.debounceTimer = setTimeout(() => {
        if (allStations.length > 0 || searchInput.value.length > 2) {
          searchShoutcastStations();
        }
      }, 500);
    });

    subgenreSelect.addEventListener("change", () => {
      if (allStations.length > 0) {
        searchShoutcastStations();
      }
    });

    countryFilter.addEventListener("change", sortAndRenderStations);

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
      countryFilter.value = "";
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
          allStations.push({
            id,
            name:       station.name,
            streamUrl:  station.url_resolved || station.url,
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
    settingsOverlay.addEventListener('click', closeSettingsPanel);

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && settingsPanel.classList.contains('open')) {
        closeSettingsPanel();
      }
    });

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

      const root = document.documentElement;
      root.setAttribute('data-theme', 'custom');
      root.style.setProperty('--color-bg-primary',    bgPrim);
      root.style.setProperty('--color-bg-secondary',  bgSec);
      root.style.setProperty('--color-bg-tertiary',   bgTert);
      root.style.setProperty('--color-bg-input',      bgInput);
      root.style.setProperty('--color-accent',        accent);
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
        listeningStats: JSON.parse(localStorage.getItem('brummiesListeningStats') || '{}')
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
    const CURRENT_VERSION = '1.2.5';
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

    // Donate Button
    donateBtn.addEventListener('click', () => {
      const donationUrl = 'https://www.paypal.com/paypalme/ZaboChris';
      
      const message = currentLang === 'de' ?
        'Vielen Dank für deine Unterstützung! 🙏\n\nMöchtest du zur Donation-Seite weitergeleitet werden?' :
        'Thank you for your support! 🙏\n\nWould you like to be redirected to the donation page?';
      
      if (confirm(message)) {
        window.open(donationUrl, '_blank');
      }
    });

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
  const svg = document.querySelector('.circular-timer');
  const handle = document.getElementById('shuffleHandle');
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

