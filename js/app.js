// Ekrany Matmozy: wybór dziecka, lista zestawów, zestaw z blokami, ćwiczenie, ustawienia.
// Adresy: #/ (start), #/z/<id> (zestaw), #/ustawienia.

import { h, okno, odm } from './dom.js';
import { uruchom } from './gra.js';
import * as S from './store.js';
import { graj } from './dzwieki.js';

const app = document.getElementById('app');
let indeks = null;
const zestawyCache = {};
let biezacaGra = null;

async function wczytajIndeks() {
  const r = await fetch('zestawy/indeks.json', { cache: 'no-cache' });
  indeks = await r.json();
  return indeks;
}
async function wczytajZestaw(id) {
  if (!zestawyCache[id]) {
    const r = await fetch(`zestawy/${encodeURIComponent(id)}.json`, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Nie ma takiego zestawu.');
    zestawyCache[id] = await r.json();
  }
  return zestawyCache[id];
}

const profilInfo = (id = S.profil()) => indeks?.profile.find((p) => p.id === id);
const dataPL = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
const dniDo = (iso) => Math.round((new Date(iso + 'T12:00:00') - new Date(new Date().toDateString() + ' 12:00')) / 864e5);

function naglowek() {
  const p = profilInfo();
  return h('header', { class: 'naglowek' },
    h('a', { class: 'logo', href: '#/' }, h('span', { class: 'logo-znak', 'aria-hidden': 'true' }, '+'), 'Matmoza'),
    p ? h('a', { class: 'kto', href: '#/ustawienia', 'aria-label': 'Ustawienia' }, h('span', { class: 'kto-znak' }, p.znak), p.imie) : null);
}

// ---------- start: kto ćwiczy? ----------
function ekranWyboru() {
  app.replaceChildren(naglowek(),
    h('main', { class: 'tresc-strony' },
      h('img', { class: 'maskotka duza', src: 'obrazy/koza-czesc.png', alt: '', onerror: (e) => e.target.remove() }),
      h('h1', { class: 'tytul-strony' }, 'Kto dziś ćwiczy?'),
      h('div', { class: 'wybor-profilu' }, indeks.profile.map((p, i) => h('button', {
        class: 'karta profil kolor-' + (i + 1), type: 'button',
        onclick: () => { S.ustawProfil(p.id); graj('klik'); location.hash = '#/'; render(); },
      }, h('span', { class: 'profil-znak' }, p.znak), h('span', { class: 'profil-imie' }, p.imie), h('span', { class: 'profil-klasa' }, `klasa ${p.klasa}`))))));
}

// ---------- lista zestawów ----------
function ekranListy() {
  const p = profilInfo();
  const moje = indeks.zestawy.filter((z) => z.dla.includes(p.id));
  const prawdziwe = moje.filter((z) => !z.przyklad), przyklady = moje.filter((z) => z.przyklad);
  const karta = (z, i) => {
    const { ostatnia, ile } = S.wynikiZestawu(p.id, z.id);
    const dni = z.termin ? dniDo(z.termin) : null;
    return h('a', { class: 'karta zestaw kolor-' + (i % 5), href: '#/z/' + encodeURIComponent(z.id) },
      z.termin && dni >= 0 ? h('span', { class: 'termin' + (dni <= 1 ? ' pilne' : '') },
        dni === 0 ? 'kartkówka dziś!' : dni === 1 ? 'kartkówka jutro' : `kartkówka ${dataPL(z.termin)}`) : null,
      z.przyklad ? h('span', { class: 'termin cichy' }, 'przykład') : null,
      h('h2', {}, z.tytul),
      z.opis ? h('p', {}, z.opis) : null,
      h('p', { class: 'meta' }, `${z.bloki} ${odm(z.bloki, 'blok', 'bloki', 'bloków')} · ok. ${z.zadan} ${odm(z.zadan, 'zadanie', 'zadania', 'zadań')}`,
        ostatnia ? h('span', { class: 'ostatnio' }, ` · ostatnio ${ostatnia.dobrze}/${ostatnia.ile}` + (ile > 1 ? ` (prób: ${ile})` : '')) : null));
  };
  app.replaceChildren(naglowek(),
    h('main', { class: 'tresc-strony' },
      h('h1', { class: 'tytul-strony' }, `Cześć, ${p.imie}!`),
      prawdziwe.length ? h('p', { class: 'podtytul' }, 'Wybierz zestaw i przerabiaj blok po bloku.')
        : h('p', { class: 'podtytul' }, 'Tata jeszcze nie wrzucił zadań z podręcznika. Na rozgrzewkę jest przykład.'),
      h('div', { class: 'lista-zestawow' }, prawdziwe.map(karta)),
      przyklady.length ? h('div', { class: 'lista-zestawow przyklady' }, przyklady.map((z, i) => karta(z, i + prawdziwe.length))) : null));
}

// ---------- zestaw ----------
async function ekranZestawu(id) {
  const z = await wczytajZestaw(id);
  const p = profilInfo();
  const { ostatnia } = S.wynikiZestawu(p.id, z.id);
  const graj1 = (bloki, extra = {}) => startGry(z, bloki, extra);
  app.replaceChildren(naglowek(),
    h('main', { class: 'tresc-strony' },
      h('a', { class: 'wroc', href: '#/' }, '← Zestawy'),
      h('h1', { class: 'tytul-strony' }, z.tytul),
      z.opis ? h('p', { class: 'podtytul' }, z.opis) : null,
      ostatnia ? h('p', { class: 'ostatni-wynik' }, `Ostatnio: ${ostatnia.dobrze}/${ostatnia.ile} dobrze, ${new Date(ostatnia.d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}`) : null,
      h('button', { class: 'btn glowny duzy', type: 'button', onclick: () => graj1(z.bloki) }, 'Zaczynam cały zestaw →'),
      h('h2', { class: 'sekcja' }, 'Bloki'),
      h('ol', { class: 'lista-blokow' }, z.bloki.map((b, i) => h('li', { class: 'karta blok kolor-' + (i % 5) },
        h('span', { class: 'blok-nr' }, i + 1),
        h('span', { class: 'blok-opis' }, h('b', {}, b.tytul),
          h('span', {}, `${b.ile || b.zadania?.length} ${odm(b.ile || b.zadania?.length, 'zadanie', 'zadania', 'zadań')}`)),
        h('button', { class: 'btn maly', type: 'button', onclick: () => graj1([b], { tylkoBlok: b.id }) }, 'Tylko ten'))))));
}

function startGry(zestaw, bloki, extra = {}) {
  biezacaGra?.zakoncz();
  const p = profilInfo();
  app.replaceChildren(h('main', { class: 'gra' }));
  biezacaGra = uruchom(app.firstChild, {
    zestaw, bloki, profil: p, ...extra,
    naKoniec: (proba) => { S.dodajProbe(p.id, proba); synchro(); },
    jeszczeRaz: () => startGry(zestaw, bloki, { tylkoBlok: extra.tylkoBlok }),
    powtorz: (zadania) => startGry(zestaw, zestaw.bloki.filter((b) => zadania[b.id]), { zadania, powtorka: true }),
    wyjdz: () => { biezacaGra?.zakoncz(); biezacaGra = null; location.hash = '#/z/' + encodeURIComponent(zestaw.id); render(); },
  });
}

// ---------- ustawienia ----------
function ekranUstawien() {
  const p = profilInfo();
  const t = S.token();
  const pole = h('input', { class: 'pole-tekst', type: 'password', placeholder: t ? '•••••••• (zapisany)' : 'github_pat_…', autocomplete: 'off' });
  const stan = h('p', { class: 'muted', role: 'status' });
  app.replaceChildren(naglowek(),
    h('main', { class: 'tresc-strony' },
      h('a', { class: 'wroc', href: '#/' }, '← Zestawy'),
      h('h1', { class: 'tytul-strony' }, 'Ustawienia'),
      h('section', { class: 'karta ustawienia' },
        h('h2', {}, 'Kto ćwiczy na tym telefonie'),
        h('p', {}, `${p.imie}, klasa ${p.klasa}`),
        h('button', { class: 'btn', type: 'button', onclick: () => { S.ustawProfil(null); location.hash = '#/'; render(); } }, 'Zmień osobę')),
      h('section', { class: 'karta ustawienia' },
        h('h2', {}, 'Dźwięki'),
        h('button', { class: 'btn', type: 'button', 'aria-pressed': String(S.dzwiek()), onclick: () => { S.ustawDzwiek(!S.dzwiek()); graj('dobrze'); render(); } },
          S.dzwiek() ? 'Włączone — wyłącz' : 'Wyłączone — włącz')),
      h('section', { class: 'karta ustawienia' },
        h('h2', {}, 'Wyniki u taty (synchronizacja)'),
        h('p', { class: 'muted' }, 'Każdy wynik zapisuje się w prywatnym repozytorium rodziny. Wystarczy raz wkleić token GitHub na tym telefonie.'),
        pole,
        h('div', { class: 'przyciski' },
          h('button', { class: 'btn glowny', type: 'button', onclick: async () => {
            const nowy = pole.value.trim();
            if (nowy) S.ustawToken(nowy);
            if (!S.token()) { stan.textContent = 'Wklej token.'; return; }
            stan.textContent = 'Łączę…';
            try { await S.synchronizuj(p.id); stan.textContent = 'Połączone. Wyniki są zapisane.'; } catch (e) { stan.textContent = e.message; }
          } }, t ? 'Synchronizuj teraz' : 'Włącz'),
          t ? h('button', { class: 'btn jasny', type: 'button', onclick: async () => {
            if (await okno({ tytul: 'Wyłączyć synchronizację?', tresc: 'Wyniki zostaną na telefonie, ale przestaną trafiać do taty.', przyciski: [{ tekst: 'Zostaw', wartosc: false }, { tekst: 'Wyłącz', wartosc: true, klasa: 'zly' }] })) { S.ustawToken(null); render(); }
          } }, 'Wyłącz') : null),
        stan)));
}

async function synchro() {
  const p = S.profil();
  if (!p || !S.token()) return;
  try { await S.synchronizuj(p); } catch (e) { console.warn('Synchronizacja:', e.message); }
}

async function render() {
  try {
    if (!indeks) await wczytajIndeks();
    if (!profilInfo()) return ekranWyboru();
    const hash = location.hash || '#/';
    if (biezacaGra && !hash.startsWith('#/gra')) { biezacaGra.zakoncz(); biezacaGra = null; }
    const m = hash.match(/^#\/z\/(.+)$/);
    if (m) return await ekranZestawu(decodeURIComponent(m[1]));
    if (hash === '#/ustawienia') return ekranUstawien();
    if (hash.startsWith('#/gra')) return;
    return ekranListy();
  } catch (e) {
    app.replaceChildren(h('main', { class: 'tresc-strony' }, h('h1', {}, 'Ups'), h('p', {}, e.message), h('a', { class: 'btn', href: '#/' }, 'Na start')));
  }
}

window.addEventListener('hashchange', render);
render().then(synchro);

if ('serviceWorker' in navigator && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
