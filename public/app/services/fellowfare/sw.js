const CACHE = 'fellowfare-0.4.3-merlin';
const SHELL = ["../../commonweave-merlin-chat.css","../../shared/commonweave-merlin-chat.js","../../assets/ai/merlin.png",
  './',
  './index.html','./commonweave-handoff-consumer.js','./commonweave-presence.js',
  './styles.css',
  './app.js',
  './shared/commonweave-model-runtime.js',
  './ai.js',
  './ledger.js',
  './manifest.webmanifest',
  '../../logos/fellowfare-wordmark.png',
  '../../logos/fellowfare.png',
  '../../logos/commonweave.webp','../../shared/image-hotspot-calibrator.js','../../ui-icons/back.svg','../../ui-icons/home.svg','../../ui-icons/map.svg','../../ui-icons/search.svg','../../ui-icons/inbox.svg','../../ui-icons/nexus.svg','../../ui-icons/directory.svg','../../ui-icons/settings.svg',
  './assets/mall/main-atrium.webp',
  './assets/mall/exchange-galleria.webp',
  './assets/mall/mutual-aid-wing.webp',
  './assets/mall/makers-arcade.webp',
  './assets/mall/logistics-concourse.webp',
  './assets/mall/upper-gallery.webp',
  './assets/mall/rooftop-commons.webp',
  './assets/mall/marketplace.webp',
  './assets/mall/free-store.webp',
  './assets/mall/help-desk.webp',
  './assets/mall/repair-cafe.webp',
  './assets/mall/skill-shop.webp',
  './assets/mall/tool-rental.webp',
  './assets/mall/resource-center.webp',
  './assets/mall/volunteer-hub.webp',
  './assets/mall/pantry.webp',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => {
    const network = fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});
