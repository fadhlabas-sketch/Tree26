/**
 * service-worker.js
 * =================
 * إصلاح مشكلة 404 على GitHub Pages:
 * - استخدام مسارات نسبية (relative) بدلاً من المطلقة
 * - التخزين المؤقت الصحيح لجميع الملفات
 */

const CACHE_NAME = 'shajarah-v2';

// الملفات المطلوبة للعمل بدون إنترنت
const SHELL_FILES = [
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

// ── التثبيت: تخزين الملفات في الكاش ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // نستخدم addAll مع معالجة الأخطاء — إذا فشل ملف واحد لا يوقف الباقي
        return Promise.allSettled(
          SHELL_FILES.map(f => cache.add(f).catch(e => console.warn('Cache miss:', f, e)))
        );
      })
  );
  self.skipWaiting();
});

// ── التفعيل: حذف الكاشات القديمة ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── الطلبات: الشبكة أولاً ثم الكاش ──────────────────────────────────────
self.addEventListener('fetch', event => {
  // تجاهل طلبات غير GET
  if (event.request.method !== 'GET') return;

  // تجاهل طلبات Google APIs (لا نكاشها)
  const url = event.request.url;
  if (url.includes('script.google.com')) return;
  if (url.includes('googleapis.com')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // إذا نجح الطلب، احفظ نسخة في الكاش
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => {
        // عند انقطاع الإنترنت، استخدم الكاش
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // إذا كان طلب صفحة HTML، أعد الصفحة الرئيسية
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
