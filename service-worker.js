const CACHE = 'shajarah-v4';
const SHELL = [
  './', './index.html', './manifest.json',
  './css/style.css',
  './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install',  e => { e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(f => c.add(f))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method!=='GET') return;
  if (e.request.url.includes('script.google.com') || e.request.url.includes('googleapis.com')) return;
  e.respondWith(
    fetch(e.request).then(r => { if(r&&r.status===200){const cl=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cl));} return r; })
    .catch(() => caches.match(e.request).then(c => c || (e.request.headers.get('accept')?.includes('text/html') ? caches.match('./index.html') : undefined)))
  );
});
