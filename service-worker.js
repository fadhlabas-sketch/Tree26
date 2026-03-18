/**
 * service-worker.js
 * =================
 * الاستراتيجية:
 *  - ملفات التطبيق (HTML/CSS/JS): كاش دائم → يعمل بدون إنترنت
 *  - بيانات الشجرة: الشبكة أولاً → إذا انقطع الإنترنت يُعاد من الكاش
 */

const CACHE_NAME = 'shajarah-v3';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/sheets.js',
  './js/tree.js',
  './js/interactions.js',
  './js/search.js',
  './js/admin.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── التثبيت: تخزين ملفات التطبيق ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(SHELL_FILES.map(f => cache.add(f)))
    )
  );
  self.skipWaiting();
});

// ── التفعيل: حذف الكاشات القديمة ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── الطلبات ───────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Google APIs: لا نتدخل — نتركها للمتصفح مباشرة
  if (url.includes('script.google.com') || url.includes('googleapis.com')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // نجح الطلب → احفظ نسخة في الكاش وأعد النتيجة
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        // فشل الاتصال → أعد من الكاش
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          // إذا كان طلب صفحة HTML → أعد الصفحة الرئيسية
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        })
      )
  );
});
