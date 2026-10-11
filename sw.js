// Offline: pliki aplikacji i zestawy najpierw z sieci (nowe zadania od razu), bez sieci z pamięci podręcznej.
const CACHE = 'matmoza-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/app.js', 'js/dom.js', 'js/gra.js', 'js/generatory.js',
  'js/liczby.js', 'js/wyrazenie.js', 'js/sprawdz.js', 'js/store.js', 'js/dzwieki.js', 'zestawy/indeks.json', 'ikony/ikona.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.github.com') return;
  if (url.origin !== location.origin) {
    // czcionki Google: raz pobrane zostają w pamięci
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }))));
    }
    return;
  }
  e.respondWith(fetch(req.url, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const kopia = res.clone(); caches.open(CACHE).then((c) => c.put(req, kopia)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
