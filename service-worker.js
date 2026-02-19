const CACHE_NAME = 'brummies-radio-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Old cache deleted:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch - Optimiert für Mobile
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Radio-Streams: Immer Network (können nicht gecacht werden)
  if (url.hostname.includes('stream') || 
      url.pathname.includes('.mp3') ||
      url.pathname.includes('.m3u') ||
      url.pathname.includes('.pls')) {
    event.respondWith(
      fetch(event.request, {
        // Optimierungen für Streaming
        mode: 'cors',
        credentials: 'omit'
      }).catch(() => {
        // Fallback bei Netzwerkfehler
        return new Response('Stream unavailable', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
    );
    return;
  }
  
  // Radio Browser API: Network First mit Cache Fallback
  if (url.hostname.includes('radio-browser.info')) {
    event.respondWith(
      fetch(event.request, {
        // Timeout für schnellere Fehler-Erkennung
        signal: AbortSignal.timeout(10000) // 10s timeout
      })
      .then(response => {
        // Cache erfolgreiche API-Responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback auf gecachte API-Response
        return caches.match(event.request).then(cached => {
          if (cached) {
            console.log('Using cached API response');
            return cached;
          }
          return new Response('{"error": "Network unavailable"}', {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        });
      })
    );
    return;
  }
  
  // Statische Ressourcen: Cache First
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Aus Cache, update im Hintergrund
          fetch(event.request).then(networkResponse => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {
            // Ignore network errors for background updates
          });
          
          return response;
        }
        
        // Nicht im Cache, hole vom Netzwerk
        return fetch(event.request).then(networkResponse => {
          // Cache erfolgreiche Responses
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
  );
});

// Background Sync für Favoriten/Verlauf (optional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Hier könnte man Favoriten/Verlauf mit Server synchronisieren
  console.log('Background Sync executed');
}

async function startMetadataPolling(station) {
  stopMetadataPolling(); // Alten Timer löschen
  
  const poll = async () => {
    try {
      // Radio-Browser API bietet Infos zum Sender (inkl. Homepage/Click-Count)
      // Für echte "Now Playing" Daten braucht man oft einen Proxy oder die API des Senders
      const response = await fetch(`https://de1.api.radio-browser.info/json/stations/byuuid/${station.id}`);
      const data = await response.json();
      
      // Falls der Sender den Titel in der API hinterlegt:
      if (data[0] && data[0].lastchangetime) {
         // Hier müsste die Logik rein, die den Titel extrahiert
         // Da die Radio-Browser API oft nur statische Infos hat, 
         // ist ein Fallback auf den Sendernamen sinnvoll:
         updateNowPlayingText(`🎵 ${station.name} - Live Stream`);
      }
    } catch (e) {
      console.error("Metadaten-Fehler", e);
    }
  };

  poll();
  metadataTimer = setInterval(poll, 30000); // Alle 30 Sek. prüfen
}

// Push Notifications (vorbereitet für Zukunft)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Brummies Rock Radio';
  const options = {
    body: data.body || 'New notification',
    icon: './icon-192.png',
    badge: './icon-192.png'
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
