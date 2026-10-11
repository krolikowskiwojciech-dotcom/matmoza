// Ekrany Matmozy: wybór dziecka, lista zestawów, zestaw z blokami, ćwiczenie, ustawienia.
// Adresy: #/ (start), #/z/<id> (zestaw), #/ustawienia.

import { h, okno, odm, ik, koza, kolor } from './dom.js';
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
const ZNAKI = ['+', '×', '½', '÷', '−', '='];
const znakZestawu = (z, i) => z.ikona || ZNAKI[i % ZNAKI.length];
const kolorZestawu = (z, i) => (z.kolor ? 'kolor-' + z.kolor : kolor(i));
const babel = (znak, klasa = 'kp-emoji') => h('span', { class: klasa + ' znak-mat serif', 'aria-hidden': 'true' }, znak);

function naglowek() {
  const p = profilInfo();
  return h('header', { class: 'naglowek' },
    h('a', { class: 'avatar serif', href: '#/ustawienia', 'aria-label': 'Ustawienia' }, p.znak),
    h('div', { class: 'naglowek-txt' }, h('b', {}, p.imie), h('small', { class: 'maly' }, `klasa ${p.klasa}`)),
    h('a', { class: 'ikona-btn', href: '#/ustawienia', 'aria-label': 'Ustawienia' }, ik('zebatka')));
}

// ---------- start: kto ćwiczy? ----------
function ekranWyboru() {
  app.replaceChildren(
    h('main', { class: 'ekran profile-wybor' },
      h('div', { class: 'logo serif' }, 'Mat', h('em', {}, 'moza')),
      koza('czesc', 'koza-powitanie'),
      h('h1', { class: 'serif' }, 'Kto dziś ', h('em', {}, 'liczy'), '?'),
      h('div', { class: 'profile-siatka' }, indeks.profile.map((p, i) => h('button', {
        class: `profil-kafel ${kolor(i + 1)}`, type: 'button',
        onclick: () => { S.ustawProfil(p.id); graj('klik'); location.hash = '#/'; render(); },
      }, babel(p.znak, 'profil-avatar'), h('b', {}, p.imie), h('small', {}, `klasa ${p.klasa}`))))));
}

// ---------- lista zestawów ----------
function ekranListy() {
  const p = profilInfo();
  const moje = indeks.zestawy.filter((z) => z.dla.includes(p.id));
  const prawdziwe = moje.filter((z) => !z.przyklad), przyklady = moje.filter((z) => z.przyklad);
  const karta = (z, i) => {
    const { ostatnia, ile } = S.wynikiZestawu(p.id, z.id);
    const dni = z.termin ? dniDo(z.termin) : null;
    return h('a', { class: `karta-pakietu ${kolorZestawu(z, i)}`, href: '#/z/' + encodeURIComponent(z.id) },
      h('div', { class: 'kp-gora' }, babel(znakZestawu(z, i)),
        h('div', { class: 'kp-txt' },
          z.termin && dni >= 0 ? h('span', { class: 'termin' + (dni <= 1 ? ' pilne' : '') },
            dni === 0 ? 'kartkówka dziś!' : dni === 1 ? 'kartkówka jutro' : `kartkówka ${dataPL(z.termin)}`) : null,
          h('div', { class: 'kp-tytul serif' }, z.tytul))),
      z.opis ? h('p', { class: 'kp-opis' }, z.opis) : null,
      h('div', { class: 'kp-dol' },
        h('small', {}, `${z.bloki} ${odm(z.bloki, 'blok', 'bloki', 'bloków')} · ok. ${z.zadan} ${odm(z.zadan, 'zadanie', 'zadania', 'zadań')}`),
        ostatnia ? h('span', { class: 'poz-status zna' }, `ostatnio ${ostatnia.dobrze}/${ostatnia.ile}` + (ile > 1 ? ` · ${ile}×` : '')) : null));
  };
  app.replaceChildren(
    h('main', { class: 'ekran' },
      naglowek(),
      h('div', { class: 'tytul-wiersz' },
        h('h1', { class: 'tytul serif' }, 'Co dziś ', h('em', {}, 'liczymy'), '?'),
        koza('czesc', 'koza-glowna')),
      prawdziwe.length ? null : h('p', { class: 'podtytul' }, 'Tata jeszcze nie wrzucił zadań z podręcznika. Na rozgrzewkę jest przykład.'),
      prawdziwe.length ? h('div', { class: 'sekcja' }, 'Przed kartkówką') : null,
      h('div', { class: 'lista-pakietow' }, prawdziwe.map(karta)),
      przyklady.length ? [h('div', { class: 'sekcja' }, 'Na rozgrzewkę'),
        h('div', { class: 'lista-pakietow' }, przyklady.map((z, i) => karta(z, i + prawdziwe.length)))] : null));
}

// ---------- zestaw ----------
async function ekranZestawu(id) {
  const z = await wczytajZestaw(id);
  const p = profilInfo();
  const nr = Math.max(0, indeks.zestawy.filter((x) => x.dla.includes(p.id)).sort((a, b) => !!a.przyklad - !!b.przyklad).findIndex((x) => x.id === z.id));
  const { ostatnia, ile } = S.wynikiZestawu(p.id, z.id);
  const graj1 = (bloki, extra = {}) => startGry(z, bloki, extra);
  const dni = z.termin ? dniDo(z.termin) : null;
  const zadan = z.bloki.reduce((n, b) => n + (b.ile || b.zadania?.length || 0), 0);
  app.replaceChildren(
    h('main', { class: 'ekran' },
      h('section', { class: `naglowek-dzialu ${kolorZestawu(z, nr)}` },
        h('a', { class: 'wstecz', href: '#/', 'aria-label': 'Wróć' }, ik('wstecz')),
        babel(znakZestawu(z, nr), 'kp-emoji nagl-znak'),
        h('span', { class: 'kat-etykieta' }, z.przyklad ? 'Przykład' : z.termin && dni >= 0 ? (dni === 0 ? 'Kartkówka dziś' : dni === 1 ? 'Kartkówka jutro' : `Kartkówka ${dataPL(z.termin)}`) : 'Zestaw'),
        h('h1', { class: 'serif' }, z.tytul),
        z.opis ? h('p', {}, z.opis) : null,
        h('div', { class: 'np-staty' },
          h('span', {}, h('b', {}, z.bloki.length), ' ', odm(z.bloki.length, 'blok', 'bloki', 'bloków')),
          h('span', {}, h('b', {}, zadan), ' ', odm(zadan, 'zadanie', 'zadania', 'zadań')),
          ostatnia ? h('span', {}, 'ostatnio ', h('b', {}, `${ostatnia.dobrze}/${ostatnia.ile}`)) : null,
          ile > 1 ? h('span', {}, h('b', {}, ile), ' prób') : null)),
      h('button', { class: 'cta', type: 'button', onclick: () => graj1(z.bloki) },
        h('span', { class: 'cta-txt' }, h('b', {}, 'Zaczynam cały zestaw'), h('small', {}, 'blok po bloku, z wyjaśnieniami')),
        h('span', { class: 'cta-strzalka' }, ik('dalej'))),
      h('div', { class: 'sekcja' }, 'Bloki — możesz przećwiczyć jeden'),
      h('ul', { class: 'lista-pozycji' }, z.bloki.map((b, i) => {
        const n = b.ile || b.zadania?.length;
        return h('li', { class: 'pozycja klik', onclick: () => graj1([b], { tylkoBlok: b.id }) },
          h('span', { class: `blok-nr serif ${kolor(i)}` }, i + 1),
          h('span', { class: 'poz-txt' }, h('b', {}, b.tytul), h('small', { class: 'maly' }, `${n} ${odm(n, 'zadanie', 'zadania', 'zadań')}`)),
          h('span', { class: 'poz-status' }, 'ćwicz'));
      }))));
}

function startGry(zestaw, bloki, extra = {}) {
  biezacaGra?.zakoncz();
  const p = profilInfo();
  const pole = h('div');
  app.replaceChildren(pole);
  biezacaGra = uruchom(pole, {
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
  const pole = h('input', { class: 'pole', type: 'password', placeholder: t ? '•••••••• (zapisany)' : 'github_pat_…', autocomplete: 'off' });
  const stan = h('p', { class: 'maly', role: 'status' });
  app.replaceChildren(
    h('main', { class: 'ekran' },
      h('div', { class: 'profil-gora' },
        h('a', { class: 'ikona-btn', href: '#/', 'aria-label': 'Wróć' }, ik('wstecz')),
        h('span', { class: 'profil-duzy-avatar serif' }, p.znak),
        h('h1', { class: 'serif' }, p.imie)),
      h('section', { class: 'ust' },
        h('div', { class: 'sekcja' }, 'Ten telefon'),
        h('div', { class: 'wiersz' }, h('span', {}, `Ćwiczy: ${p.imie}, klasa ${p.klasa}`),
          h('button', { class: 'chip', type: 'button', onclick: () => { S.ustawProfil(null); location.hash = '#/'; render(); } }, 'Zmień')),
        h('div', { class: 'wiersz' }, h('span', {}, 'Dźwięki'),
          h('button', { class: 'chip' + (S.dzwiek() ? ' akt' : ''), type: 'button', 'aria-pressed': String(S.dzwiek()), onclick: () => { S.ustawDzwiek(!S.dzwiek()); graj('dobrze'); render(); } },
            S.dzwiek() ? 'włączone' : 'wyłączone'))),
      h('section', { class: 'ust' },
        h('div', { class: 'sekcja' }, 'Wyniki u taty'),
        h('p', { class: 'maly' }, 'Każdy wynik zapisuje się w prywatnym repozytorium rodziny. Wystarczy raz wkleić token GitHub na tym telefonie.'),
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
            if (await okno({ tytul: 'Wyłączyć synchronizację?', tresc: 'Wyniki zostaną na telefonie, ale przestaną trafiać do taty.', przyciski: [{ tekst: 'Zostaw', wartosc: false }, { tekst: 'Wyłącz', wartosc: true, klasa: 'czerwony' }] })) { S.ustawToken(null); render(); }
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
    app.replaceChildren(h('main', { class: 'ekran' }, h('h1', { class: 'serif' }, 'Ups'), h('p', {}, e.message), h('a', { class: 'btn', href: '#/' }, 'Na start')));
  }
}

window.addEventListener('hashchange', render);
render().then(synchro);

if ('serviceWorker' in navigator && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
