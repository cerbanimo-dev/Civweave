const CACHE = 'anarchadia-v0.3.9-host-cache-recovery';
const CORE = ["../../commonweave-merlin-chat.css","../../shared/commonweave-merlin-chat.js","../../assets/ai/merlin.png",
  './','./index.html','./commonweave-handoff-consumer.js','./commonweave-presence.js','./styles.css','./manifest.webmanifest',
  './src/app.js','./world-engine.js','./src/domain.js','./src/store.js','./src/ai.js','./src/export.js','./shared/commonweave-model-runtime.js',
  '../../logos/anarchadia.webp','../../logos/commonweave.webp','../../shared/image-hotspot-calibrator.js','../../ui-icons/back.svg','../../ui-icons/home.svg','../../ui-icons/map.svg','../../ui-icons/search.svg','../../ui-icons/inbox.svg','../../ui-icons/nexus.svg','../../ui-icons/directory.svg','../../ui-icons/settings.svg','./assets/icon-180.png','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-maskable-512.png',
  './assets/passport/anarchadia-passport-blank.webp',
  './docs/PROVISIONAL_CONSTITUTION.md',
  './assets/screens/home-landscape.webp',
  './assets/screens/home-portrait.webp',
  './assets/screens/proposal-landscape.webp',
  './assets/screens/proposal-portrait.webp',
  './assets/screens/bug-landscape.webp',
  './assets/screens/bug-portrait.webp',
  './assets/screens/hub-landscape.webp',
  './assets/screens/hub-portrait.webp',
  './assets/screens/federation-landscape.webp',
  './assets/screens/federation-portrait.webp',
  './assets/screens/rails-landscape.webp',
  './assets/screens/rails-portrait.webp',
  './assets/screens/forge-landscape.webp',
  './assets/screens/forge-portrait.webp',
  './assets/screens/ledger-landscape.webp',
  './assets/screens/ledger-portrait.webp',
  './assets/screens/observatory-landscape.webp',
  './assets/screens/observatory-portrait.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: 'reload' }).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
