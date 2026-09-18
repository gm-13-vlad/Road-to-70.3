// Bump on release so clients discard the previous cache.
const CACHE = 'road-to-70-3-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/bluetooth.js',
  './js/antplus.js',
  './js/routes.js',
  './js/workouts.js',
  './js/workoutview.js',
  './js/simulation.js',
  './js/terrain.js',
  './js/world.js',
  './js/dashboard.js',
  './js/recorder.js',
  './js/profiles.js',
  './js/utils.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // individual failures must not abort the install
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve cached copies immediately so the app opens without a network, and
// refresh them in the background so the next launch has any new version.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
