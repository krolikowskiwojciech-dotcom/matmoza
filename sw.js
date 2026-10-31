// Offline i szybki start.
// Pliki aplikacji (HTML, CSS, JS, czcionki, ikony): od razu z pamięci, w tle odświeżane z sieci (stale-while-revalidate) —
// otwieranie nie czeka na sieć, poprawiony kod działa od następnego otwarcia (po podbiciu CACHE — od razu po instalacji).
// Zestawy i dźwięki jak dotąd: najpierw z sieci (nowe zadania od razu), bez sieci z pamięci; przy bardzo wolnej sieci
// po 3 s bierzemy kopię z pamięci, a odpowiedź z sieci i tak trafia do pamięci na następny raz.
const CACHE = 'matmoza-v18';
const SHELL = ['./', 'styles.css', 'manifest.webmanifest', 'js/app.js', 'js/dom.js', 'js/gra.js', 'js/generatory.js',
  'js/liczby.js', 'js/wyrazenie.js', 'js/sprawdz.js', 'js/store.js', 'js/konto.js', 'js/dzwieki.js', 'zestawy/indeks.json',
  'ikony/ikona-180.png', 'ikony/ikona-192.png', 'ikony/ikona-512.png', 'fonts/Jost.ttf', 'fonts/LibreBaskerville.ttf',
  'audio/klik.mp3', 'audio/cofnij.mp3', 'audio/przycisk.mp3', 'audio/dobrze.mp3', 'audio/zle.mp3'];
const CZEKAJ_NA_DANE_MS = 3000;
// strona startowa trzymana pod adresem zakresu ('./'), bo Cloudflare Pages przekierowuje /index.html → /
const START = new URL('./', self.registration.scope).href;

self.addEventListener('install', (e) => {
  // cache: 'reload' — świeże pliki prosto z serwera, nie z pamięci HTTP przeglądarki
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});

// do pamięci tylko poprawne odpowiedzi z własnego serwera; przekierowaną kopiujemy, bo Safari nie poda jej przy nawigacji
async function zapisz(klucz, res) {
  if (!res.ok || res.type !== 'basic') return res;
  const czysta = res.redirected ? new Response(await res.clone().blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res.clone();
  caches.open(CACHE).then((c) => c.put(klucz, czysta));
  return res;
}
const zSieci = (adres, klucz) => fetch(adres, { cache: 'no-cache' }).then((res) => zapisz(klucz, res));
const zPamieci = (klucz) => caches.match(klucz, { ignoreSearch: true });

// dane: sieć najpierw, bez sieci (albo po 3 s czekania) pamięć
function siecNajpierw(req) {
  const siec = zSieci(req.url, req);
  const zapas = new Promise((ok) => setTimeout(ok, CZEKAJ_NA_DANE_MS)).then(() => zPamieci(req)).then((r) => r || siec);
  return Promise.race([siec, zapas]).catch(() => zPamieci(req).then((r) => r || Response.error()));
}

// pliki aplikacji: pamięć najpierw, odświeżenie w tle
function pamiecNajpierw(e, adres, klucz) {
  const odswiez = zSieci(adres, klucz).catch(() => null);
  e.waitUntil(odswiez);
  return zPamieci(klucz).then((r) => r || odswiez.then((n) => n || zPamieci(START)).then((n) => n || Response.error()));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // API GitHuba, ogarnijmaterial.pl/api, Google Fonts — bez pośrednictwa
  const sciezka = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (sciezka.startsWith('zestawy/') || sciezka.startsWith('audio/')) return e.respondWith(siecNajpierw(req));
  if (req.mode === 'navigate') return e.respondWith(pamiecNajpierw(e, START, START));
  e.respondWith(pamiecNajpierw(e, req.url, req));
});
