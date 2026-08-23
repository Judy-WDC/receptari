const CACHE_NAME = 'receptari-v3';

// Recursos a guardar en cache per funcionar offline
const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

// ── Llibreries de fora que l'app necessita per arrencar ──────────────
// L'index.html sol no serveix de res: sense aquestes, la pàgina es carrega
// però el codi es mor a la primera línia. Com que són adreces amb el número
// de versió a dins, no canvien mai, i per això les podem desar sense por.
// Les que NO hi són (Supabase, l'Apps Script) és a posta: són les dades,
// i les dades no s'han de servir mai d'una còpia vella.
const AMFITRIONS_DESATS = [
  'cdn.jsdelivr.net',        // supabase-js
  'cdnjs.cloudflare.com',    // xlsx, mammoth, pdf.js
  'fonts.googleapis.com',    // el full d'estils de les lletres
  'fonts.gstatic.com',       // els fitxers de lletra
];

function esDeFora(url) {
  return AMFITRIONS_DESATS.includes(url.hostname);
}

// Instal·lació: guardem els recursos bàsics
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activació: eliminem caches antics
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

// Fetch: primer intentem xarxa, si falla servim des de cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const propi = url.origin === self.location.origin;

  // De fora només ens ocupem de les llibreries de la llista: la resta
  // (Supabase, l'Apps Script, les fotos) passen de llarg i van sempre a la xarxa
  if (!propi && !esDeFora(url)) return;

  // Només ens ocupem de les lectures (GET): la resta passen de llarg
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardem còpia fresca a la cache, però només si la resposta és bona:
        // així no ens quedem amb un error o una pàgina a mitges desada per sempre.
        // Les llibreries de fora arriben "opaques" (no en podem llegir l'estat
        // perquè venen d'un altre domini); aquestes es desen igualment, que és
        // l'única manera de tenir-les quan no hi hagi connexió.
        const bona = response
          && ((response.status === 200 && (response.type === 'basic' || response.type === 'cors'))
              || (!propi && response.type === 'opaque'));
        if (bona) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
