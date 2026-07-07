// VedaVPN Service Worker — v2.0.0
const CACHE_NAME = 'vedavpn-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];
// Optional assets — silently skip if unavailable (e.g. logo not yet on server)
const OPTIONAL_ASSETS = [
  '/veda-logo.png',
];

// Install: pre-cache static assets (fail-safe)
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Required assets — must succeed
    await cache.addAll(STATIC_ASSETS);
    // Optional assets — try each individually, skip on error
    await Promise.allSettled(
      OPTIONAL_ASSETS.map(url =>
        fetch(url).then(r => { if(r.ok) cache.put(url, r); }).catch(() => {})
      )
    );
    await self.skipWaiting();
  })());
});

// Activate: clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for own assets, network-first for external
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Skip: Firebase, CountAPI, Gist, CDN fonts — always fetch fresh
  const skipHosts = [
    'firestore.googleapis.com',
    'firebase.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'gstatic.com',
    'googleapis.com',
    'countapi.mileshilliard.com',
    'gist.githubusercontent.com',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ];
  if (skipHosts.some(h => url.hostname.includes(h))) return;

  // Same-origin assets: cache-first with network fallback
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => caches.match('/index.html'));
      })
    );
  }
});
