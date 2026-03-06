// ─── Brummies Rock Radio – Service Worker ────────────────────────────────────
// v3 – Compatibility fixes:
//   • AbortSignal.timeout() replaced with manual AbortController (works on all
//     browsers incl. older iOS Safari and Android Chrome < 103)
//   • Stricter stream-bypass regex (avoids mis-caching audio chunks)
//   • Cache-first for static assets with stale-while-revalidate
//   • Network-first for API with offline fallback
//   • Push notifications ready
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'brummies-radio-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './images/icon-192.png',
  './images/icon-512.png'
];

// ── Helper: fetch with manual timeout ────────────────────────────────────────
// Replaces AbortSignal.timeout() which requires Chrome 103+/Safari 16+
function fetchWithTimeout(request, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { signal: ctrl.signal })
    .then(resp => { clearTimeout(timer); return resp; })
    .catch(err  => { clearTimeout(timer); throw err;  });
}

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => { console.log('[SW] Deleted old cache:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Audio streams – always network, never cache.
  //    Matches common stream hostnames, audio file extensions,
  //    and typical Icecast/Shoutcast ports so range-requests work natively.
  const isAudioStream =
    /stream|icecast|shoutcast|listen|radio/i.test(url.hostname) ||
    /\.(mp3|m3u8?|pls|aac|ogg|opus)(\?|$)/i.test(url.pathname) ||
    url.port === '8000' || url.port === '8080';

  if (isAudioStream) {
    // Do NOT call event.respondWith – let the browser handle it natively
    // so ICY metadata headers and range requests work correctly.
    return;
  }

  // 2. Radio Browser API + Translation API – network first, 10 s timeout, cache fallback
  if (url.hostname.includes('radio-browser.info') ||
      url.hostname.includes('mymemory.translated.net')) {
    event.respondWith(
      fetchWithTimeout(req, 10000)
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return resp;
        })
        .catch(() =>
          caches.match(req).then(cached => {
            if (cached) {
              console.log('[SW] API offline – cached response used');
              return cached;
            }
            return new Response(JSON.stringify({ error: 'Network unavailable' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          })
        )
    );
    return;
  }

  // 3. Static assets – cache first, stale-while-revalidate in background
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cached => {
        // Always try to revalidate in background
        const networkFetch = fetchWithTimeout(req, 8000)
          .then(resp => {
            if (resp && resp.ok) {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then(c => c.put(req, clone));
            }
            return resp;
          })
          .catch(() => null);

        // Serve cache immediately; fall back to network if not cached
        return cached || networkFetch;
      })
    );
  }
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(Promise.resolve().then(() => {
      console.log('[SW] Background Sync executed');
    }));
  }
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Brummies Rock Radio', {
      body:      data.body || 'Neue Benachrichtigung',
      icon:      './images/icon-192.png',
      badge:     './images/icon-192.png',
      tag:       'brummies-notification',
      renotify:  true
    })
  );
});

// ── Notification Click: focus existing window or open new one ─────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});
