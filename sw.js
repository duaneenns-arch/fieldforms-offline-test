/* FieldForms service worker — Offline Level 2
   Caches the app shell so the app opens with no internet after one online visit. */
const CACHE = 'fieldforms-shell-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // never cache writes
  const url = new URL(req.url);

  // Never intercept Firebase / Google API traffic — let it hit the network (and fail offline,
  // which the app handles via its own IndexedDB queue).
  if (/(googleapis|gstatic|firebaseio|firebase|firestore)\./.test(url.hostname)) {
    return;                                         // default browser handling
  }

  // jsPDF and other CDN assets: cache-first so PDF generation works offline.
  if (url.hostname.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // App shell (same-origin): cache-first, fall back to network, then to cached index.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
