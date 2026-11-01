// Ekrany aplikacji „Matematyka”: wybór dziecka (tylko github.io), lista zestawów, zestaw z blokami, ćwiczenie, ustawienia.
// Adresy: #/ (start), #/z/<id> (zestaw), #/ustawienia. Pod *.ogarnijmaterial.pl osobę ustala konto rodziny (konto.js).

import { h, okno, odm, ik, kolor, wroc, pasek } from './dom.js';
import { uruchom } from './gra.js';
import * as S from './store.js';
import { graj } from './dzwieki.js';
import { naOM, ustalOsobe, STRONA, KONTA, KOLOR_OSOBY } from './konto.js';

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
  // ogarnijmaterial.pl: „Przedmioty” w lewym górnym rogu, w prawym znaczek z inicjałem („Zmień osobę”)
  if (naOM) {
    return [
      pasek(wroc({ tekst: 'Przedmioty', href: STRONA }),
        h('a', { class: 'okragly', href: '#/ustawienia', 'aria-label': 'Ustawienia' }, ik('zebatka')),
        h('a', { class: `okragly inicjal serif ${KOLOR_OSOBY[p.id] || ''}`, href: KONTA, 'aria-label': 'Zmień osobę' }, p.znak)),
      h('div', { class: 'przedmiot-etykieta' }, `Matematyka · ${p.imie}, klasa ${p.klasa}`)];
  }
  return h('header', { class: 'naglowek' },
    h('a', { class: 'avatar serif', href: '#/ustawienia', 'aria-label': 'Ustawienia' }, p.znak),
    h('div', { class: 'naglowek-txt' }, h('b', {}, p.imie), h('small', { class: 'maly' }, `klasa ${p.klasa}`)),
    h('a', { class: 'ikona-btn', href: '#/ustawienia', 'aria-label': 'Ustawienia' }, ik('zebatka')));
}

// ---------- start: kto ćwiczy? ----------
function ekranWyboru() {
  app.replaceChildren(
    h('main', { class: 'ekran profile-wybor' },
      h('div', { class: 'logo serif' }, 'Matematyka'),
      h('h1', { class: 'serif' }, 'Kto dziś ', h('em', {}, 'liczy'), '?'),
      h('div', { class: 'profile-siatka' }, indeks.profile.map((p, i) => h('button', {
        class: `profil-kafel ${kolor(i + 1)}`, type: 'button',
        onclick: () => { S.ustawProfil(p.id); graj('klik'); location.hash = '#/'; render(); },
      }, babel(p.znak, 'profil-avatar'), h('b', {}, p.imie), h('small', {}, `klasa ${p.klasa}`))))));
}

// ---------- lista zestawów: dwie zakładki (Ćwiczenia / Sprawdzian) ----------
const NOWE_DNI = 10;
const grupaZestawu = (z) => z.tytul.split(' — ')[0];

function zakladki(akt, ileSpr) {
  const z = (id, tekst, href) => h('a', { class: 'zakladka' + (akt === id ? ' akt' : ''), href, 'aria-current': akt === id ? 'page' : null }, tekst);
  return h('nav', { class: 'zakladki', 'aria-label': 'Zakładki' },
    z('cwiczenia', 'Ćwiczenia', '#/'),
    z('sprawdzian', ['Sprawdzian', h('span', { class: 'zakl-licznik' }, ileSpr)], '#/sprawdzian'));
}

function statusZestawu(p, z) {
  const { ostatnia, ile } = S.wynikiZestawu(p.id, z.id);
  if (!ostatnia) return null;
  return h('span', { class: 'poz-status ' + (ostatnia.dobrze === ostatnia.ile ? 'opan' : 'zna') }, `${ostatnia.dobrze}/${ostatnia.ile}` + (ile > 1 ? ` · ${ile}×` : ''));
}

function ekranListy(kategoria = null) {
  const p = profilInfo();
  const wszystkie = indeks.zestawy.filter((z) => z.dla.includes(p.id));
  const sprawdziany = wszystkie.filter((z) => z.kategoria === 'sprawdzian');
  const cwiczenia = wszystkie.filter((z) => z.kategoria !== 'sprawdzian');
  const karta = (z, i, etykieta) => {
    const dni = z.termin ? dniDo(z.termin) : null;
    return h('a', { class: `karta-pakietu ${kolorZestawu(z, i)}`, href: '#/z/' + encodeURIComponent(z.id) },
      h('div', { class: 'kp-gora' }, babel(znakZestawu(z, i)),
        h('div', { class: 'kp-txt' },
          z.termin && dni >= 0 ? h('span', { class: 'termin' + (dni <= 1 ? ' pilne' : '') },
            dni === 0 ? 'kartkówka dziś!' : dni === 1 ? 'kartkówka jutro' : `kartkówka ${dataPL(z.termin)}`)
            : etykieta ? h('span', { class: 'termin' }, etykieta) : null,
          h('div', { class: 'kp-tytul serif' }, z.tytul))),
      z.opis ? h('p', { class: 'kp-opis' }, z.opis) : null,
      h('div', { class: 'kp-dol' },
        h('small', {}, `${z.bloki} ${odm(z.bloki, 'blok', 'bloki', 'bloków')} · ok. ${z.zadan} ${odm(z.zadan, 'zadanie', 'zadania', 'zadań')}`),
        statusZestawu(p, z)));
  };
  // spokojna lista: jeden wiersz na zestaw
  const wiersze = (lista) => h('ul', { class: 'lista-pozycji' }, lista.map((z, i) => h('li', {},
    h('a', { class: 'pozycja klik', href: '#/z/' + encodeURIComponent(z.id) },
      h('span', { class: `blok-nr serif ${kolorZestawu(z, i)}` }, znakZestawu(z, i)),
      h('span', { class: 'poz-txt' }, h('b', {}, z.tytul), h('small', { class: 'maly' }, `${z.zadan} ${odm(z.zadan, 'zadanie', 'zadania', 'zadań')}`)),
      statusZestawu(p, z)))));

  let tresc;
  if (kategoria === 'sprawdzian') {
    // warianty jednego sprawdzianu jako siatka numerów; grupy od najnowszej
    const grupy = new Map();
    for (const z of [...sprawdziany].sort((a, b) => (b.dodano || '').localeCompare(a.dodano || ''))) {
      const g = grupaZestawu(z);
      if (!grupy.has(g)) grupy.set(g, []);
      grupy.get(g).push(z);
    }
    tresc = sprawdziany.length ? [...grupy].map(([nazwa, lista]) => {
      const nastepny = lista.find((z) => !S.wynikiZestawu(p.id, z.id).ostatnia);
      const zrobione = lista.filter((z) => S.wynikiZestawu(p.id, z.id).ostatnia).length;
      return h('section', { class: 'grupa-spr' },
        h('div', { class: 'sekcja' }, nazwa, h('span', { class: 'sekcja-ile' }, `zrobione ${zrobione} z ${lista.length}`)),
        lista[0].opis ? h('p', { class: 'grupa-opis' }, lista[0].opis) : null,
        h('div', { class: 'siatka-wariantow' }, lista.map((z, i) => {
          const { ostatnia } = S.wynikiZestawu(p.id, z.id);
          const teraz = z === nastepny;
          return h('a', { class: 'wariant' + (ostatnia ? ' zrobiony' : '') + (teraz ? ' teraz' : ''), href: '#/z/' + encodeURIComponent(z.id), 'aria-label': z.tytul },
            h('span', { class: 'wariant-nr serif' }, znakZestawu(z, i)),
            h('small', {}, ostatnia ? `${ostatnia.dobrze}/${ostatnia.ile}` : teraz ? 'teraz' : '—'));
        })));
    }) : h('p', { class: 'podtytul' }, 'Nie ma jeszcze sprawdzianów.');
  } else {
    const prawdziwe = cwiczenia.filter((z) => !z.przyklad), przyklady = cwiczenia.filter((z) => z.przyklad);
    const kartkowki = prawdziwe.filter((z) => z.termin && dniDo(z.termin) >= 0);
    const nowe = prawdziwe.filter((z) => !kartkowki.includes(z) && z.dodano && -dniDo(z.dodano) <= NOWE_DNI)
      .sort((a, b) => b.dodano.localeCompare(a.dodano));
    const reszta = prawdziwe.filter((z) => !kartkowki.includes(z) && !nowe.includes(z));
    tresc = [
      prawdziwe.length ? null : h('p', { class: 'podtytul' }, 'Tata jeszcze nie wrzucił zadań z podręcznika. Na rozgrzewkę jest przykład.'),
      kartkowki.length ? [h('div', { class: 'sekcja' }, 'Przed kartkówką'), h('div', { class: 'lista-pakietow' }, kartkowki.map((z, i) => karta(z, i)))] : null,
      nowe.length ? [h('div', { class: 'sekcja' }, 'Nowe'), h('div', { class: 'lista-pakietow' }, nowe.map((z, i) => karta(z, i)))] : null,
      reszta.length ? [h('div', { class: 'sekcja' }, 'Działy z podręcznika'), wiersze(reszta)] : null,
      przyklady.length ? [h('div', { class: 'sekcja' }, 'Na rozgrzewkę'), wiersze(przyklady)] : null,
    ];
  }
  app.replaceChildren(
    h('main', { class: 'ekran' },
      naglowek(),
      h('h1', { class: 'tytul serif' }, 'Co dziś ', h('em', {}, 'liczymy'), '?'),
      sprawdziany.length ? zakladki(kategoria === 'sprawdzian' ? 'sprawdzian' : 'cwiczenia', sprawdziany.length) : null,
      tresc));
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
      pasek(wroc({ href: z.sprawdzian || z.kategoria === 'sprawdzian' ? '#/sprawdzian' : '#/' })),
      h('section', { class: `naglowek-dzialu ${kolorZestawu(z, nr)}` },
        babel(znakZestawu(z, nr), 'kp-emoji nagl-znak'),
        h('span', { class: 'kat-etykieta' }, z.przyklad ? 'Przykład' : z.termin && dni >= 0 ? (dni === 0 ? 'Kartkówka dziś' : dni === 1 ? 'Kartkówka jutro' : `Kartkówka ${dataPL(z.termin)}`) : z.sprawdzian ? 'Sprawdzian' : 'Zestaw'),
        h('h1', { class: 'serif' }, z.tytul),
        z.opis ? h('p', {}, z.opis) : null,
        h('div', { class: 'np-staty' },
          h('span', {}, h('b', {}, z.bloki.length), ' ', odm(z.bloki.length, 'blok', 'bloki', 'bloków')),
          h('span', {}, h('b', {}, zadan), ' ', odm(zadan, 'zadanie', 'zadania', 'zadań')),
          ostatnia ? h('span', {}, 'ostatnio ', h('b', {}, `${ostatnia.dobrze}/${ostatnia.ile}`)) : null,
          ile > 1 ? h('span', {}, h('b', {}, ile), ' prób') : null)),
      h('button', { class: 'cta', type: 'button', onclick: () => graj1(z.bloki) },
        h('span', { class: 'cta-txt' }, h('b', {}, z.sprawdzian ? 'Zaczynam sprawdzian' : 'Zaczynam cały zestaw'), h('small', {}, z.sprawdzian ? 'wynik na końcu, po wszystkich zadaniach' : 'blok po bloku, wynik na końcu')),
        h('span', { class: 'cta-strzalka' }, ik('dalej'))),
      // tylko cały zestaw — wynik raz, po wszystkich blokach; lista bloków jest tylko do podglądu
      h('div', { class: 'sekcja' }, 'Co jest w zestawie'),
      h('ul', { class: 'lista-pozycji' }, z.bloki.map((b, i) => {
        const n = b.ile || b.zadania?.length;
        return h('li', { class: 'pozycja' },
          h('span', { class: `blok-nr serif ${kolor(i)}` }, i + 1),
          h('span', { class: 'poz-txt' }, h('b', {}, b.tytul), h('small', { class: 'maly' }, `${n} ${odm(n, 'zadanie', 'zadania', 'zadań')}`)));
      }))));
}

function startGry(zestaw, bloki, extra = {}) {
  if (biezacyKlucz) { zapamietajMiejsce(); pominZapis = true; biezacyKlucz = null; }
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
      pasek(wroc({ href: '#/' })),
      h('div', { class: 'profil-gora' },
        h('span', { class: `profil-duzy-avatar serif ${naOM ? KOLOR_OSOBY[p.id] || '' : ''}` }, p.znak),
        h('h1', { class: 'serif' }, p.imie)),
      h('section', { class: 'ust' },
        h('div', { class: 'sekcja' }, 'Ten telefon'),
        h('div', { class: 'wiersz' }, h('span', {}, `Ćwiczy: ${p.imie}, klasa ${p.klasa}`),
          naOM ? h('a', { class: 'chip', href: KONTA }, 'Zmień osobę')
            : h('button', { class: 'chip', type: 'button', onclick: () => { S.ustawProfil(null); location.hash = '#/'; render(); } }, 'Zmień')),
        h('div', { class: 'wiersz' }, h('span', {}, 'Dźwięki'),
          h('button', { class: 'chip' + (S.dzwiek() ? ' akt' : ''), type: 'button', 'aria-pressed': String(S.dzwiek()), onclick: () => { S.ustawDzwiek(!S.dzwiek()); graj('dobrze'); render(); } },
            S.dzwiek() ? 'włączone' : 'wyłączone'))),
      naOM ? h('section', { class: 'ust' },
        h('div', { class: 'sekcja' }, 'Wyniki u taty'),
        h('p', { class: 'maly' }, 'Każdy wynik zapisuje się sam na koncie rodziny.'),
        h('div', { class: 'przyciski' }, h('button', { class: 'btn jasny', type: 'button', onclick: async () => {
          stan.textContent = 'Łączę…';
          try { await S.synchronizuj(p.id); stan.textContent = S.synchroWlaczona() ? 'Połączone. Wyniki są zapisane.' : 'Podgląd testowy — bez zapisu.'; } catch (e) { stan.textContent = e.message; }
        } }, 'Synchronizuj teraz')),
        stan) : h('section', { class: 'ust' },
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
  if (!p || !S.synchroWlaczona()) return;
  try { await S.synchronizuj(p); } catch (e) { console.warn('Synchronizacja:', e.message); }
}

let czekamNaKonto = false;
// Zapamiętane miejsce na każdym ekranie: po wyjściu z lekcji („Wróć”, koniec) lista wraca do tej samej karty,
// a nie na górę (Wojtek 2026-10-25 — zasada we wszystkich lekcjach). Zapis w chwili wyjścia z ekranu albo startu lekcji.
const miejsca = new Map();
let biezacyKlucz = null;
let pominZapis = false;
function zapamietajMiejsce() { if (biezacyKlucz) miejsca.set(biezacyKlucz, window.scrollY); }
function przywrocMiejsce() {
  biezacyKlucz = location.hash || '#/';
  const y = miejsca.get(biezacyKlucz) || 0;
  window.scrollTo(0, y);
  if (y) { setTimeout(() => window.scrollTo(0, y), 60); setTimeout(() => window.scrollTo(0, y), 300); }
}

async function render() {
  if (pominZapis) pominZapis = false; else zapamietajMiejsce();
  await renderEkran();
  if (!(location.hash || '').startsWith('#/gra')) przywrocMiejsce();
}

async function renderEkran() {
  try {
    if (!indeks) await wczytajIndeks();
    if (naOM && !profilInfo()) {
      // pod ogarnijmaterial.pl nigdy nie pokazujemy wyboru profilu — czekamy na /api/ja (albo przekierowanie)
      if (!czekamNaKonto) app.replaceChildren(h('p', { class: 'ladowanie' }, 'Wczytuję…'));
      return;
    }
    if (!profilInfo()) return ekranWyboru();
    const hash = location.hash || '#/';
    if (biezacaGra && !hash.startsWith('#/gra')) { biezacaGra.zakoncz(); biezacaGra = null; }
    const m = hash.match(/^#\/z\/(.+)$/);
    if (m) return await ekranZestawu(decodeURIComponent(m[1]));
    if (hash === '#/sprawdzian') return ekranListy('sprawdzian');
    if (hash === '#/ustawienia') return ekranUstawien();
    if (hash.startsWith('#/gra')) return;
    return ekranListy();
  } catch (e) {
    app.replaceChildren(h('main', { class: 'ekran' }, pasek(wroc(naOM ? { tekst: 'Przedmioty', href: STRONA } : { href: '#/' })), h('h1', { class: 'serif' }, 'Ups'), h('p', {}, e.message), h('a', { class: 'btn', href: '#/' }, 'Na start')));
  }
}

window.addEventListener('hashchange', render);

async function start() {
  if (!naOM) { await render(); return synchro(); }
  // konto rodziny: ostatnio potwierdzona osoba od razu, /api/ja sprawdza w tle (401 / dorosły → strona główna)
  const istnieje = (id) => !!indeks?.profile.some((p) => p.id === id);
  try { await wczytajIndeks(); } catch { return render(); } // bez listy zestawów: zwykły ekran błędu
  const { teraz, sprawdzenie } = ustalOsobe(istnieje, (id) => {
    if (biezacaGra) { biezacaGra.zakoncz(); biezacaGra = null; location.hash = '#/'; }
    S.ustawProfilKonta(id); render().then(synchro);
  });
  if (teraz) { S.ustawProfilKonta(teraz); await render(); sprawdzenie.then((id) => { if (id === teraz) synchro(); }).catch((e) => console.warn('Konto:', e.message)); return; }
  czekamNaKonto = true;
  app.replaceChildren(h('p', { class: 'ladowanie' }, 'Wczytuję…'));
  try { await sprawdzenie; } catch (e) {
    app.replaceChildren(h('main', { class: 'ekran' },
      pasek(wroc({ tekst: 'Przedmioty', href: STRONA })),
      h('h1', { class: 'serif' }, 'Brak połączenia'),
      h('p', {}, 'Nie udało się sprawdzić, kto jest zalogowany. Sprawdź internet i spróbuj jeszcze raz.'),
      h('button', { class: 'btn glowny', type: 'button', onclick: () => location.reload() }, 'Spróbuj ponownie')));
  }
}
start();

if ('serviceWorker' in navigator && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
