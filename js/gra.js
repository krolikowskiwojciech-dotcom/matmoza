// Przebieg zestawu: bloki ćwiczeń jeden po drugim, zła odpowiedź zatrzymuje grę i uczy,
// błędne zadanie wraca w tym samym bloku, na końcu podsumowanie i „Wyślij wynik”.

import { h, mat, okno, odm } from './dom.js';
import { nastepneZadanie, los, JAK } from './generatory.js';
import { ocen, normuj } from './sprawdz.js';
import { graj } from './dzwieki.js';

const BLOKADA_MS = 1200; // po błędzie przyciski chwilę śpią, żeby rozpędzony palec nie przeskoczył wyjaśnienia

// zadania jednego bloku na rundę: stałe z zestawu (potasowane) i/lub z generatora, bez powtórek
export function zadaniaBloku(blok) {
  const stale = los.tasuj(blok.zadania || []).map(normuj);
  const ile = blok.ile || stale.length || 10;
  const out = stale.slice(0, ile);
  if (blok.generator) {
    const uzyte = new Set(out.map((z) => z.klucz));
    while (out.length < ile) {
      const z = nastepneZadanie(blok.generator, uzyte);
      if (!z) break;
      out.push(normuj(z));
    }
  }
  return out;
}

const tekstZadania = (z, cz) => [z.q, cz.e, cz.d && cz.d.replace(/ = □ r\. □$/, '')].filter(Boolean).join(' ');
const poprawnie = (cz) => {
  if (cz.kind === 'reszta') { const [a, r] = cz.a.split(' r '); return cz.d.replace('□', a).replace('□', r); }
  if (cz.kind === 'wybor' && cz.d?.includes('□')) return cz.d.replace('□', cz.a);
  if (cz.d?.includes('□')) return cz.d.replace('□', cz.a);
  return cz.a;
};
const gwiazdki = (dobrze, ile) => (ile === 0 || dobrze === 0 ? 0 : dobrze === ile ? 3 : dobrze / ile >= 0.8 ? 2 : 1);
const pokazGwiazdki = (n) => h('span', { class: 'gwiazdki', 'aria-label': `${n} z 3 gwiazdek` }, [1, 2, 3].map((i) => h('span', { class: i <= n ? 'on' : '' }, '★')));

/**
 * uruchom(kontener, { zestaw, bloki, profil, zadania?, naKoniec(proba), wyjdz() })
 * bloki — lista bloków do przejścia; zadania — gotowe zadania (powtórka pomyłek) { idBloku: [zadania] }
 */
export function uruchom(el, opcje) {
  const { zestaw, profil } = opcje;
  const start = Date.now();
  const bloki = opcje.bloki.map((b) => ({
    blok: b,
    kolejka: (opcje.zadania?.[b.id] || zadaniaBloku(b)).map((z) => ({ z, powtorka: false })),
    wyniki: [], // { dobrze, tekst, a, odp } — tylko pierwsze podejście do każdej części
  })).filter((b) => b.kolejka.length);

  let nrBloku = 0, poz = 0, czesc = 0, seria = 0, zablokowane = false, pola = [], aktywne = 0, timer = null;
  let klawisze = null;

  const B = () => bloki[nrBloku];
  const pozycja = () => B().kolejka[poz];
  const czescTeraz = () => pozycja().z.czesci[czesc];
  const wszystkich = () => bloki.reduce((n, b) => n + b.kolejka.filter((x) => !x.powtorka).reduce((m, x) => m + x.z.czesci.length, 0), 0);
  const zrobionych = () => bloki.reduce((n, b) => n + b.wyniki.length, 0);

  function ustawKlawisze(f) {
    if (klawisze) document.removeEventListener('keydown', klawisze);
    klawisze = f && ((e) => { if (!document.querySelector('.okno-tlo')) f(e); });
    if (klawisze) document.addEventListener('keydown', klawisze);
  }
  const sprzataj = () => { clearTimeout(timer); ustawKlawisze(null); };

  async function przerwij() {
    const w = await okno({ tytul: 'Przerwać ćwiczenie?', tresc: 'Wynik zapisze się jako przerwany. Możesz go i tak wysłać.',
      przyciski: [{ tekst: 'Ćwiczę dalej', wartosc: false }, { tekst: 'Przerwij', wartosc: true, klasa: 'zly' }] });
    if (w) podsumowanie(true);
  }

  // ---------- wstęp do bloku ----------
  function wstepBloku() {
    sprzataj();
    const b = B().blok;
    const jak = b.jak || JAK[b.generator?.typ];
    el.replaceChildren(
      h('div', { class: 'gra-gora' },
        h('button', { class: 'btn maly jasny', type: 'button', onclick: przerwij }, '✕ Przerwij'),
        h('span', { class: 'gra-licznik' }, `Blok ${nrBloku + 1} z ${bloki.length}`)),
      h('section', { class: 'karta wstep kolor-' + (nrBloku % 5) },
        h('p', { class: 'nadtytul' }, `Blok ${nrBloku + 1} · ${B().kolejka.length} ${odm(B().kolejka.length, 'zadanie', 'zadania', 'zadań')}`),
        h('h1', {}, b.tytul),
        b.polecenie ? h('p', { class: 'polecenie' }, b.polecenie) : null,
        jak ? h('div', { class: 'jak' },
          h('h2', {}, 'Jak to zrobić?'),
          jak.intro ? h('p', {}, mat(jak.intro)) : null,
          (jak.zasady || []).map(([t, opis]) => h('p', { class: 'zasada' }, h('b', {}, t), ' ', mat(opis))),
          jak.przyklad ? h('div', { class: 'przyklad' }, jak.przyklad.map((l) => h('div', {}, mat(l)))) : null) : null,
        h('button', { class: 'btn glowny duzy', type: 'button', id: 'start-bloku', onclick: () => pokazZadanie() }, 'Zaczynam →')));
    ustawKlawisze((e) => { if (e.key === 'Enter') { e.preventDefault(); pokazZadanie(); } });
    el.querySelector('#start-bloku').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // ---------- zadanie ----------
  function nowePola(cz) {
    pola = cz.kind === 'reszta' ? ['', ''] : cz.kind === 'ulamek' ? ['', '', ''] : [''];
    aktywne = cz.kind === 'ulamek' ? 1 : 0;
  }

  function okienkoDla(cz) {
    return (nr) => {
      if (cz.kind === 'ulamek') {
        return h('span', { class: 'wpis-ulamek' },
          h('button', { class: 'pole cale', type: 'button', 'data-i': 0, 'aria-label': 'całości' }),
          h('span', { class: 'ul' }, h('button', { class: 'pole', type: 'button', 'data-i': 1, 'aria-label': 'licznik' }),
            h('button', { class: 'pole', type: 'button', 'data-i': 2, 'aria-label': 'mianownik' })));
      }
      if (cz.kind === 'wybor') return h('span', { class: 'pole wybor-pole' });
      return h('button', { class: 'pole', type: 'button', 'data-i': nr, 'aria-label': cz.kind === 'reszta' ? (nr ? 'reszta' : 'wynik') : 'odpowiedź' });
    };
  }

  function odswiezPola() {
    el.querySelectorAll('.pole[data-i]').forEach((p) => {
      const i = Number(p.dataset.i);
      p.textContent = pola[i] || '';
      p.classList.toggle('aktywne', i === aktywne && !zablokowane);
      p.classList.toggle('puste', !pola[i]);
    });
  }

  function pokazZadanie() {
    sprzataj();
    zablokowane = false;
    const { z } = pozycja();
    const cz = czescTeraz();
    nowePola(cz);
    const b = B().blok;
    const ile = B().kolejka.length;
    const dzialanie = cz.d
      ? h('div', { class: 'dzialanie' + (cz.d.length > 24 ? ' bardzo-dlugie' : cz.d.length > 12 ? ' dlugie' : '') }, mat(cz.d, okienkoDla(cz)))
      : h('div', { class: 'dzialanie samo' }, cz.kind === 'wybor' ? null : mat('□', okienkoDla(cz)), cz.jednostka ? h('span', { class: 'jednostka' }, cz.jednostka) : null);
    const klaw = cz.kind === 'wybor'
      ? h('div', { class: 'wybory' }, cz.choices.map((c) => h('button', { class: 'btn wybor', type: 'button', onclick: () => sprawdz(c) }, c)))
      : klawiatura(cz, b);
    el.replaceChildren(
      h('div', { class: 'gra-gora' },
        h('button', { class: 'btn maly jasny', type: 'button', onclick: przerwij }, '✕ Przerwij'),
        h('span', { class: 'gra-licznik' }, `${Math.min(poz + 1, ile)} / ${ile}${pozycja().powtorka ? ' · powtórka' : ''}`)),
      h('div', { class: 'pasek' }, bloki.map((bb, i) => h('span', { class: 'pasek-blok' },
        h('span', { style: `width:${i < nrBloku ? 100 : i > nrBloku ? 0 : Math.round((poz / ile) * 100)}%` })))),
      h('section', { class: 'karta zadanie kolor-' + (nrBloku % 5) },
        h('p', { class: 'nadtytul' }, b.tytul),
        z.q ? h('p', { class: 'tresc' }, mat(z.q)) : (b.polecenie ? h('p', { class: 'polecenie' }, b.polecenie) : null),
        z.czesci.length > 1 ? h('p', { class: 'czesc-nr' }, `${String.fromCharCode(97 + czesc)}) `, cz.e ? mat(cz.e) : null) : cz.e ? h('p', { class: 'etykieta' }, mat(cz.e)) : null,
        dzialanie,
        h('p', { class: 'info', 'aria-live': 'polite' })),
      h('div', { class: 'dol' }, klaw));
    el.querySelectorAll('.pole[data-i]').forEach((p) => p.addEventListener('click', () => { aktywne = Number(p.dataset.i); graj('klik'); odswiezPola(); }));
    odswiezPola();
    ustawKlawisze((e) => klawiszFizyczny(e, cz));
    window.scrollTo(0, 0);
  }

  function klawiatura(cz, blok) {
    const k = (etyk, akcja, klasa = '', aria) => h('button', { class: 'klawisz ' + klasa, type: 'button', 'aria-label': aria || etyk, onclick: akcja }, etyk);
    const cyfry = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => k(String(n), () => wpisz(String(n))));
    const wiele = cz.kind !== 'liczba';
    const lewy = wiele ? k('→', () => dalej(), 'szary', 'następne okienko') : k(',', () => wpisz(','), 'szary', 'przecinek');
    const minus = blok.ujemne ? k('−', () => wpisz('−'), 'szary', 'minus') : null;
    return h('div', { class: 'klawiatura-wrap' },
      h('div', { class: 'klawiatura' + (minus ? ' z-minusem' : '') }, cyfry, lewy, k('0', () => wpisz('0')), k('⌫', () => kasuj(), 'szary', 'kasuj'), minus),
      h('button', { class: 'btn glowny duzy sprawdz', type: 'button', onclick: () => sprawdz() }, 'Sprawdź'));
  }

  function wpisz(znak) {
    if (zablokowane) return;
    const v = pola[aktywne];
    if (znak === ',' && (v.includes(',') || !v)) return;
    if (znak === '−' && v) return;
    if (v.replace(/\D/g, '').length >= 9) return;
    pola[aktywne] = v + znak;
    const info = el.querySelector('.info.podpowiedz');
    if (info) { info.textContent = ''; info.className = 'info'; }
    graj('klik');
    odswiezPola();
  }
  function kasuj() {
    if (zablokowane) return;
    if (!pola[aktywne] && czescTeraz().kind === 'ulamek' && aktywne === 2) aktywne = 1;
    pola[aktywne] = pola[aktywne].slice(0, -1);
    graj('cofnij');
    odswiezPola();
  }
  function dalej() {
    if (zablokowane) return;
    const kind = czescTeraz().kind;
    aktywne = kind === 'ulamek' ? { 1: 2, 2: 0, 0: 1 }[aktywne] : (aktywne + 1) % pola.length;
    graj('klik');
    odswiezPola();
  }

  function klawiszFizyczny(e, cz) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (zablokowane) return;
    if (cz.kind === 'wybor') {
      const i = { '<': 0, '=': 1, '>': 2 }[e.key];
      if (i != null && cz.choices[i]) sprawdz(cz.choices[i]);
      const n = Number(e.key);
      if (n >= 1 && n <= cz.choices.length) sprawdz(cz.choices[n - 1]);
      return;
    }
    if (/^\d$/.test(e.key)) wpisz(e.key);
    else if ((e.key === ',' || e.key === '.') && cz.kind === 'liczba') wpisz(',');
    else if (e.key === '-' && B().blok.ujemne) wpisz('−');
    else if (e.key === 'Backspace') kasuj();
    else if (e.key === 'Tab' || e.key === '/' || e.key === 'ArrowRight' || e.key === ' ') { if (cz.kind !== 'liczba') { e.preventDefault(); dalej(); } }
    else if (e.key === 'Enter') { e.preventDefault(); sprawdz(); }
  }

  function odpowiedzDziecka(cz) {
    if (cz.kind === 'reszta') return pola.slice();
    if (cz.kind === 'ulamek') {
      const [c, l, m] = pola;
      if (!l && !m) return c;
      return (c ? c + ' ' : '') + l + '/' + m;
    }
    return pola[0];
  }
  const pokazOdp = (cz, odp) => (Array.isArray(odp) ? `${odp[0]} r. ${odp[1]}` : String(odp));

  function sprawdz(wybor) {
    if (zablokowane) return;
    const cz = czescTeraz();
    const info = el.querySelector('.info');
    let odp;
    if (cz.kind === 'wybor') odp = wybor;
    else {
      odp = odpowiedzDziecka(cz);
      const brak = cz.kind === 'reszta' ? pola.some((p) => !p) : cz.kind === 'ulamek' ? (!pola[1] !== !pola[2]) || (!pola[0] && !pola[1]) : !pola[0];
      if (brak) {
        info.textContent = cz.kind === 'reszta' ? 'Wpisz wynik i resztę.' : cz.kind === 'ulamek' ? 'Uzupełnij licznik i mianownik.' : 'Najpierw wpisz odpowiedź.';
        info.className = 'info podpowiedz';
        return;
      }
    }
    zablokowane = true;
    const { ok, uwaga } = ocen(cz, odp);
    const poz0 = pozycja();
    if (!poz0.powtorka) B().wyniki.push({ dobrze: ok, tekst: tekstZadania(poz0.z, cz), a: pokazOdp(cz, cz.kind === 'reszta' ? cz.a.split(' r ') : cz.a), pelne: poprawnie(cz), odp: pokazOdp(cz, odp) });
    odswiezPola();
    if (ok) dobrze(cz, odp); else zle(cz, odp, uwaga);
  }

  function dobrze(cz, odp) {
    seria++;
    graj(seria % 10 === 0 ? 'piec' : seria % 5 === 0 ? 'trzy' : 'dobrze');
    el.querySelector('.zadanie').classList.add('ok');
    if (cz.kind === 'wybor') el.querySelectorAll('.wybor').forEach((b) => { if (b.textContent === odp) b.classList.add('ok'); });
    const info = el.querySelector('.info');
    info.className = 'info ok';
    info.textContent = los.wybierz(['Dobrze!', 'Super!', 'Brawo!', 'Tak jest!', 'Świetnie!']) + (seria >= 3 ? ` · seria ${seria}` : '');
    timer = setTimeout(nastepne, 750);
  }

  function zle(cz, odp, uwaga) {
    seria = 0;
    graj('zle');
    const { z } = pozycja();
    // zadanie wraca w tym bloku za 2–4 pozycje (albo na końcu)
    const kolejka = B().kolejka;
    const gdzie = Math.min(kolejka.length, poz + 1 + los.int(2, 4));
    kolejka.splice(gdzie, 0, { z, powtorka: true });

    const karta = el.querySelector('.zadanie');
    karta.classList.add('zle');
    if (cz.kind === 'wybor') el.querySelectorAll('.wybor').forEach((b) => { if (b.textContent === odp) b.classList.add('zle'); });
    const dalejBtn = h('button', { class: 'btn glowny duzy', type: 'button', disabled: true, onclick: () => { if (!zablokowaneDalej) nastepne(); } }, 'Przeczytaj…');
    let zablokowaneDalej = true;
    const przerwijBtn = h('button', { class: 'btn jasny', type: 'button', disabled: true, onclick: przerwij }, 'Przerwij');
    el.querySelector('.info').replaceChildren();
    el.querySelector('.dol').replaceChildren(
      h('section', { class: 'poprawka' },
        h('p', { class: 'twoja' }, 'Twoja odpowiedź: ', h('s', {}, mat(pokazOdp(cz, odp)))),
        uwaga ? h('p', { class: 'uwaga' }, uwaga) : null,
        h('div', { class: 'ramka-poprawna' },
          h('p', { class: 'nadtytul' }, 'Poprawna odpowiedź'),
          h('div', { class: 'rownanie' }, mat(poprawnie(cz)))),
        h('h3', {}, 'Jak to policzyć'),
        h('ol', { class: 'kroki' }, (cz.exp || []).map((l) => h('li', {}, mat(l)))),
        h('p', { class: 'wraca' }, 'To zadanie wróci jeszcze raz w tym bloku.'),
        h('div', { class: 'przyciski' }, przerwijBtn, dalejBtn)));
    karta.scrollIntoView({ block: 'start', behavior: 'smooth' });
    timer = setTimeout(() => {
      zablokowaneDalej = false;
      dalejBtn.disabled = false; przerwijBtn.disabled = false;
      dalejBtn.textContent = 'Następne →';
      dalejBtn.focus({ preventScroll: true });
      ustawKlawisze((e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); nastepne(); } });
    }, BLOKADA_MS);
    ustawKlawisze(null);
  }

  function nastepne() {
    sprzataj();
    if (czesc + 1 < pozycja().z.czesci.length) { czesc++; return pokazZadanie(); }
    czesc = 0;
    poz++;
    if (poz < B().kolejka.length) return pokazZadanie();
    koniecBloku();
  }

  // ---------- koniec bloku ----------
  function koniecBloku() {
    sprzataj();
    const w = B().wyniki, dob = w.filter((x) => x.dobrze).length;
    const ostatni = nrBloku + 1 >= bloki.length;
    if (ostatni) return podsumowanie(false);
    const g = gwiazdki(dob, w.length);
    graj(g === 3 ? 'trzy' : 'dobrze');
    const dalejF = () => { nrBloku++; poz = 0; czesc = 0; wstepBloku(); };
    el.replaceChildren(
      h('section', { class: 'karta koniec-bloku' },
        h('img', { class: 'maskotka', src: g === 3 ? 'obrazy/koza-brawo.png' : 'obrazy/koza-ok.png', alt: '', onerror: (e) => e.target.remove() }),
        h('p', { class: 'nadtytul' }, `Blok ${nrBloku + 1} z ${bloki.length} gotowy`),
        h('h1', {}, B().blok.tytul),
        pokazGwiazdki(g),
        h('p', { class: 'wynik-duzy' }, `${dob} / ${w.length}`),
        h('p', { class: 'muted' }, 'dobrze za pierwszym razem'),
        h('button', { class: 'btn glowny duzy', type: 'button', id: 'dalej', onclick: dalejF }, `Blok ${nrBloku + 2}: ${bloki[nrBloku + 1].blok.tytul} →`)));
    ustawKlawisze((e) => { if (e.key === 'Enter') { e.preventDefault(); dalejF(); } });
    el.querySelector('#dalej').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // ---------- podsumowanie ----------
  function podsumowanie(przerwane) {
    sprzataj();
    const ile = przerwane ? zrobionych() : wszystkich();
    const wszystkie = bloki.flatMap((b) => b.wyniki);
    const dob = wszystkie.filter((x) => x.dobrze).length;
    const proba = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      zestaw: zestaw.id, tytul: zestaw.tytul + (opcje.tylkoBlok ? ` — ${bloki[0].blok.tytul}` : ''), d: start, czas: Math.round((Date.now() - start) / 1000),
      ile: wszystkie.length, dobrze: dob, przerwane: przerwane || undefined,
      tylkoBlok: opcje.tylkoBlok || undefined, powtorka: opcje.powtorka || undefined,
      bloki: bloki.filter((b) => b.wyniki.length).map((b) => ({ id: b.blok.id, tytul: b.blok.tytul, ile: b.wyniki.length, dobrze: b.wyniki.filter((x) => x.dobrze).length })),
      bledy: wszystkie.filter((x) => !x.dobrze).map(({ tekst, a, pelne, odp }) => ({ d: tekst, a, pelne, odp })),
    };
    if (proba.ile) opcje.naKoniec(proba);
    const g = gwiazdki(dob, proba.ile);
    if (!przerwane && g === 3) graj('piec');
    const minuty = Math.max(1, Math.round(proba.czas / 60));
    const tekstSMS = tekstWyniku(proba, profil, minuty);
    const status = h('p', { class: 'status', role: 'status' });
    const bledneKlucze = new Set(wszystkie.filter((x) => !x.dobrze).map((x) => x.tekst));
    const doPowtorki = {};
    for (const b of bloki) {
      const zadania = b.kolejka.filter((x) => !x.powtorka && x.z.czesci.some((cz) => bledneKlucze.has(tekstZadania(x.z, cz)))).map((x) => x.z);
      if (zadania.length) doPowtorki[b.blok.id] = zadania;
    }
    el.replaceChildren(
      h('section', { class: 'karta podsumowanie' },
        h('img', { class: 'maskotka', src: g === 3 ? 'obrazy/koza-brawo.png' : 'obrazy/koza-ok.png', alt: '', onerror: (e) => e.target.remove() }),
        h('p', { class: 'nadtytul' }, przerwane ? 'Przerwane' : 'Zestaw ukończony!'),
        h('h1', {}, zestaw.tytul),
        pokazGwiazdki(g),
        h('p', { class: 'wynik-duzy' }, `${dob} / ${proba.ile}`),
        h('p', { class: 'muted' }, `dobrze za pierwszym razem · ${minuty} min${przerwane ? ` · zrobione ${proba.ile} z ${wszystkich()}` : ''}`),
        h('button', { class: 'btn wyslij duzy', type: 'button', onclick: (e) => wyslij(tekstSMS, e.currentTarget, status) }, 'Wyślij wynik'),
        status,
        h('div', { class: 'tabela-blokow' }, proba.bloki.map((b) => h('div', { class: 'wiersz' },
          h('span', {}, b.tytul), pokazGwiazdki(gwiazdki(b.dobrze, b.ile)), h('b', {}, `${b.dobrze}/${b.ile}`)))),
        proba.bledy.length
          ? h('div', { class: 'do-powtorki' }, h('h2', {}, 'Do powtórki'),
            proba.bledy.map((x) => h('div', { class: 'blad' }, h('div', {}, mat(x.d)),
              h('div', { class: 'blad-odp' }, 'było: ', h('s', {}, mat(x.odp)), ' · dobrze: ', h('b', {}, mat(x.pelne || x.a))))))
          : h('p', { class: 'bez-bledow' }, 'Bez błędów — tak trzymaj!'),
        h('div', { class: 'przyciski kolumna' },
          Object.keys(doPowtorki).length ? h('button', { class: 'btn glowny', type: 'button', onclick: () => opcje.powtorz(doPowtorki) }, 'Powtórz pomyłki') : null,
          h('button', { class: 'btn', type: 'button', onclick: () => opcje.jeszczeRaz() }, 'Jeszcze raz (nowe przykłady)'),
          h('button', { class: 'btn jasny', type: 'button', onclick: () => opcje.wyjdz() }, 'Wróć do zestawów'))));
    window.scrollTo(0, 0);
  }

  wstepBloku();
  return { zakoncz: sprzataj };
}

export function tekstWyniku(p, profilInfo, minuty) {
  const procent = p.ile ? Math.round((p.dobrze / p.ile) * 100) : 0;
  const linie = [
    `Matmoza · ${profilInfo?.imie || ''}`,
    `${p.tytul}${p.przerwane ? ' (przerwane)' : ''}${p.powtorka ? ' (powtórka pomyłek)' : ''}`,
    `Dobrze za pierwszym razem: ${p.dobrze} z ${p.ile} (${procent}%) · błędów: ${p.ile - p.dobrze}`,
    ...p.bloki.map((b) => `• ${b.tytul}: ${b.dobrze}/${b.ile}`),
    p.bledy.length ? 'Do powtórki: ' + p.bledy.slice(0, 8).map((x) => `${x.d.replace(/□/g, '?')} (było ${x.odp}, dobrze ${x.a})`).join('; ') : 'Bez błędów!',
    `Czas: ${minuty} min`,
  ];
  return linie.join('\n');
}

// systemowe okienko udostępniania (SMS, Mail, WhatsApp…); bez niego schowek, a na końcu pole do skopiowania
async function wyslij(tekst, btn, status) {
  btn.disabled = true;
  status.replaceChildren();
  try {
    if (navigator.share) {
      try { await navigator.share({ title: 'Matmoza — wynik', text: tekst }); status.textContent = 'Wysłane? Super!'; return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(tekst); status.textContent = 'Skopiowano — wklej w wiadomości do taty.'; return; } catch { /* dalej */ }
    }
    const pole = h('textarea', { class: 'kopiuj', readonly: true }, tekst);
    status.replaceChildren('Zaznacz i skopiuj:', pole);
    pole.select();
  } finally { btn.disabled = false; }
}
