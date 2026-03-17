/**
 * service-worker.js
 * =================
 * Caches app shell for offline use.
 * Network-first for data; cache-first for assets.
 */

const CACHE_NAME = 'family-tree-v1';

// Files to cache on install
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/config.js',
  '/js/sheets.js',
  '/js/tree.js',
  '/js/interactions.js',
  '/js/search.js',
  '/js/admin.js',
  '/js/app.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Mulish:wght@300;400;500;600&display=swap',
];

// ── Install: cache shell ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first with cache fallback ──────────────────────────────
self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin API calls
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Cache a copy
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
