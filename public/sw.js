/**
 * World of Warships Ship Information Platform (wows-info)
 * Service Worker: Offline Caching & Stale-While-Revalidate Engine
 */

const STATIC_CACHE = 'wows-info-static-v2';
const DATA_CACHE = 'wows-info-data-v2';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/currency/coal.svg',
  '/icons/currency/steel.svg',
  '/icons/currency/credits.svg',
  '/icons/currency/doubloons.svg',
  '/data/catalog.json',
  '/data/locales/en.json',
  '/data/armory_master.json',
];

// Install: Cache critical offline application shell and core datasets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets and core datasets...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
      })
  );
});

// Activate: Purge obsolete cache stores and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
            .map((key) => {
              console.log('[SW] Deleting obsolete cache:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Strategy dispatcher based on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests (e.g. POST /api/sync)
  if (request.method !== 'GET') {
    return;
  }

  // Bypass cache if no-store or cache-busting timestamp is explicitly requested
  if (request.cache === 'no-store' || url.searchParams.has('_t')) {
    event.respondWith(fetch(request));
    return;
  }

  // 1. Live API requests (/api/): Network-first with offline JSON fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            isOnline: false,
            message: 'Local Sync Daemon Offline (Offline PWA Mode Active)',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 2. Statistics manifest: network-first so a newly published generation
  // is visible immediately while the last manifest remains available offline.
  if (url.pathname === '/data/stats/manifest.json') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(DATA_CACHE).then((cache) => cache.put(request, networkResponse.clone()));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. Data artifacts (/data/): Stale-While-Revalidate
  // Serves instant cached copy, fetches fresh update in background
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);

        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((err) => {
            // Network failed - if we already had a cached response, that is fine
            if (!cachedResponse) {
              console.warn(`[SW] Network fetch failed for ${url.pathname} and not in cache:`, err);
            }
            return cachedResponse;
          });

        // Return cached response if available; otherwise wait for network
        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // 4. Navigation requests: Network-first falling back to cached SPA root
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // 5. Static assets (/assets/, /icons/, scripts, styles, fonts): Cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(STATIC_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });
        return response;
      });
    })
  );
});
