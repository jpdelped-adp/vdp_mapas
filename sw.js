// VDP Maps — Service Worker v5
// HTML: network-first (siempre actualizado cuando hay internet)
// Assets JS/CSS/iconos: cache-first (rápido, cambian poco)
// Tiles mapa: network-first + se guardan para offline

const CACHE = 'vdp-maps-v5';

const STATIC_ASSETS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Montserrat:wght@400;600&display=swap',
  './manifest_cerrillos.json',
  './manifest_st.json',
  './icon-cer-192.png',
  './icon-cer-512.png',
  './icon-st-192.png',
  './icon-st-512.png',
];

// ── Instalación ───────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(STATIC_ASSETS.map(url =>
        c.add(url).catch(() => {})
      ))
    ).then(() => self.skipWaiting())
  );
});

// ── Activación: borra cachés viejos ───────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Tiles de mapa: network-first, guarda para offline
  const isTile = url.includes('arcgis.com') || url.includes('arcgisonline') ||
                 url.includes('esri.com') || url.includes('/tile/');
  if (isTile) {
    e.respondWith(
      fetch(e.request.clone())
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Archivos HTML: network-first → si no hay internet usa caché
  if (url.endsWith('.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request)
          .then(cached => cached || new Response('Sin conexión — abre la app cuando tengas señal.', {status: 503}))
        )
    );
    return;
  }

  // Todo lo demás (JS, CSS, iconos, manifests): cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok && e.request.method === 'GET')
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
    })
  );
});
