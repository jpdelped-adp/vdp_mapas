// VDP Maps — Service Worker v3 (offline-first)
const CACHE = 'vdp-maps-v3';

// Recursos críticos que se pre-cachean al instalar la PWA
const PRECACHE = [
  './Mapa_Cerrillos_VDP_2026_movil.html',
  './Mapa_SantaTeresa_VDP_2026_movil.html',
  './manifest_cerrillos.json',
  './manifest_st.json',
  './icon-cer-192.png',
  './icon-cer-512.png',
  './icon-st-192.png',
  './icon-st-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Montserrat:wght@400;600&display=swap',
];

// ── Instalación: pre-cachear todo lo esencial ─────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(PRECACHE.map(url =>
        c.add(url).catch(err => console.warn('No se pudo cachear:', url, err))
      ))
    ).then(() => self.skipWaiting())
  );
});

// ── Activación: eliminar cachés viejos ────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia según tipo de recurso ───────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Tiles del mapa (ArcGIS/ESRI): network-first, guarda para uso offline
  const isTile = url.includes('arcgis.com') || url.includes('arcgisonline') ||
                 url.includes('esri.com') || url.includes('/tile/');
  if (isTile) {
    e.respondWith(
      fetch(e.request.clone())
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Todo lo demás (HTML, JS, CSS, iconos): cache-first → network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || new Response('Sin conexión', {status: 503}));
    })
  );
});
