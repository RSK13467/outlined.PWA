const CACHE_NAME = 'outline-converter-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './site.webmanifest',
  './assets/'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Fetch Event (Serves files from cache when offline)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
