// Przebieg zestawu: bloki ćwiczeń jeden po drugim, zła odpowiedź zatrzymuje grę i uczy,
// błędne zadanie wraca w tym samym bloku, na końcu podsumowanie i „Wyślij wynik”.
// Wygląd jak lekcja w Lingozie: pełny ekran w kolorze bloku, pasek postępu u góry, stopka z przyciskiem na dole.

import { h, mat, okno, odm, ik, koza, kolor } from './dom.js';
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
  if (cz.d?.includes('□')) return cz.d.replace('□', cz.a);
  return cz.a;
};
const gwiazdki = (dobrze, ile) => (ile === 0 || dobrze === 0 ? 0 : dobrze === ile ? 3 : dobrze / ile >= 0.8 ? 2 : 1);
const pokazGwiazdki = (n, klasa = '') => h('span', { class: 'gwiazdki ' + klasa, 'aria-label': `${n} z 3 gwiazdek` },
  [1, 2, 3].map((i) => h('span', { class: i <= n ? '' : 'gw-puste' }, '★')));
const POCHWALY = ['Dobrze!', 'Super!', 'Brawo!', 'Tak jest!', 'Świetnie!', 'Pięknie!'];

/**
 * uruchom(kontener, { zestaw, bloki, profil, zadania?, tylkoBlok?, powtorka?, naKoniec(proba), powtorz(), jeszczeRaz(), wyjdz() })
 * bloki — lista bloków do przejścia; zadania — gotowe zadania (powtórka pomyłek) { idBloku: [zadania] }
 */
export function uruchom(el, opcje) {
  const { zestaw, profil } = opcje;
  const start = Date.now();
  const bloki = opcje.bloki.map((b) => ({
    blok: b,
    nr: zestaw.bloki.indexOf(b),
    kolejka: (opcje.zadania?.[b.id] || zadaniaBloku(b)).map((z) => ({ z, powtorka: false })),
    wyniki: [], // { dobrze, tekst, a, pelne, odp } — tylko pierwsze podejście do każdej części
  })).filter((b) => b.kolejka.length);

  let nrBloku = 0, poz = 0, czesc = 0, seria = 0, zablokowane = false, pola = [], aktywne = 0, timer = null;
  let klawisze = null;
  document.body.classList.add('w-lekcji');

  const B = () => bloki[nrBloku];
  const pozycja = () => B().kolejka[poz];
  const czescTeraz = () => pozycja().z.czesci[czesc];
  const wszystkich = () => bloki.reduce((n, b) => n + b.kolejka.filter((x) => !x.powtorka).reduce((m, x) => m + x.z.czesci.length, 0), 0);
  const zrobionych = () => bloki.reduce((n, b) => n + b.wyniki.length, 0);
  const postep = () => {
    const razem = bloki.reduce((n, b) => n + b.kolejka.length, 0);
    const zrob = bloki.slice(0, nrBloku).reduce((n, b) => n + b.kolejka.length, 0) + poz;
    return Math.round((zrob / Math.max(1, razem)) * 100);
  };

  function ustawKlawisze(f) {
    if (klawisze) document.removeEventListener('keydown', klawisze);
    klawisze = f && ((e) => { if (!document.querySelector('.okno-tlo')) f(e); });
    if (klawisze) document.addEventListener('keydown', klawisze);
  }
  const sprzataj = () => { clearTimeout(timer); ustawKlawisze(null); };

  // wspólny szkielet ekranu lekcji
  function ekran({ tytul, tresc, stopka, klasaStopki = '', bezGory = false }) {
    el.className = `lekcja w-kolorze ${kolor(B()?.nr ?? 0)}`;
    el.replaceChildren(...[
      bezGory ? null : h('div', { class: 'lekcja-gora' },
        h('button', { class: 'zamknij', type: 'button', 'aria-label': 'Przerwij', onclick: przerwij }, ik('zamknij')),
        h('div', { class: 'postep' }, h('div', { class: 'postep-wew', style: `width:${postep()}%` })),
        h('span', { class: 'licznik' }, `${nrBloku + 1}/${bloki.length}`)),
      tytul ? h('div', { class: 'lekcja-tytul serif' }, tytul) : null,
      h('div', { class: 'cw-pole' }, tresc),
      stopka ? h('div', { class: 'stopka ' + klasaStopki }, stopka) : null].filter(Boolean));
    el.querySelector('.cw-pole').scrollTop = 0;
  }

  async function przerwij() {
    const w = await okno({ tytul: 'Przerwać ćwiczenie?', tresc: 'Wynik zapisze się jako przerwany. Możesz go i tak wysłać.',
      przyciski: [{ tekst: 'Ćwiczę dalej', wartosc: false, klasa: 'jasny' }, { tekst: 'Przerwij', wartosc: true, klasa: 'czerwony' }] });
    if (w) podsumowanie(true);
  }

  // ---------- wstęp do bloku ----------
  function wstepBloku() {
    sprzataj();
    const b = B().blok;
    const jak = b.jak || JAK[b.generator?.typ];
    const ile = B().kolejka.length;
    ekran({
      tresc: h('div', { class: 'gram-lekcja' },
        h('div', { class: 'kat-etykieta' }, `Blok ${nrBloku + 1} z ${bloki.length} · ${ile} ${odm(ile, 'zadanie', 'zadania', 'zadań')}`),
        h('h1', { class: 'wstep-tytul serif' }, b.tytul),
        b.polecenie ? h('p', { class: 'wstep-polecenie' }, b.polecenie) : null,
        jak ? h('div', { class: 'gram-krok' },
          h('div', { class: 'gram-klucz serif' }, 'Jak to zrobić?'),
          jak.intro ? h('p', { class: 'gram-tekst' }, mat(jak.intro)) : null,
          (jak.zasady || []).map(([t, opis]) => h('p', { class: 'gram-tekst' }, h('b', {}, t), ' — ', mat(opis))),
          jak.przyklad ? h('div', { class: 'gram-przyklad' }, h('div', { class: 'gp-znak serif' }, '='), h('div', { class: 'gp-linie' }, jak.przyklad.map((l) => h('div', {}, mat(l))))) : null) : null),
      stopka: h('button', { class: 'btn glowny szeroki', type: 'button', id: 'start-bloku', onclick: () => pokazZadanie() }, 'Zaczynam', ik('dalej')),
    });
    ustawKlawisze((e) => { if (e.key === 'Enter') { e.preventDefault(); pokazZadanie(); } });
    el.querySelector('#start-bloku').focus({ preventScroll: true });
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
          h('span', { class: 'ul wpis' }, h('button', { class: 'pole', type: 'button', 'data-i': 1, 'aria-label': 'licznik' }),
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
    const { z, powtorka } = pozycja();
    const cz = czescTeraz();
    nowePola(cz);
    const b = B().blok;
    const ile = B().kolejka.length;
    const dzialanie = cz.d
      ? h('div', { class: 'dzialanie' + (cz.d.length > 24 ? ' bardzo-dlugie' : cz.d.length > 12 ? ' dlugie' : '') }, mat(cz.d, okienkoDla(cz)))
      : cz.kind === 'wybor' ? null : h('div', { class: 'dzialanie samo' }, mat('□', okienkoDla(cz)), cz.jednostka ? h('span', { class: 'jednostka' }, cz.jednostka) : null);
    const stopka = cz.kind === 'wybor'
      ? h('div', { class: 'opcje' + (cz.choices.every((c) => c.length <= 2) ? ' znaki' : '') },
        cz.choices.map((c) => h('button', { class: 'opcja', type: 'button', onpointerdown: wcisnij, onclick: () => sprawdz(c) }, h('span', { class: 'opcja-txt' }, c))))
      : klawiatura(cz, b);
    ekran({
      tytul: b.tytul,
      tresc: [
        h('div', { class: 'cw-polecenie' }, powtorka ? 'Jeszcze raz to zadanie' : (b.polecenie || 'Oblicz.'), h('span', { class: 'cw-nr' }, `${Math.min(poz + 1, ile)} / ${ile}`)),
        h('section', { class: 'zadanie-karta' },
          z.q ? h('p', { class: 'tresc' }, mat(z.q)) : null,
          z.czesci.length > 1 ? h('p', { class: 'etykieta' }, h('b', {}, `${String.fromCharCode(97 + czesc)}) `), cz.e ? mat(cz.e) : null) : cz.e ? h('p', { class: 'etykieta' }, mat(cz.e)) : null,
          dzialanie,
          h('p', { class: 'info', 'aria-live': 'polite' })),
      ],
      stopka,
    });
    el.querySelectorAll('.pole[data-i]').forEach((p) => p.addEventListener('click', () => { aktywne = Number(p.dataset.i); graj('klik'); odswiezPola(); }));
    odswiezPola();
    ustawKlawisze((e) => klawiszFizyczny(e, cz));
  }

  // klawisz „wpada” od razu przy dotknięciu (iOS nie zawsze pokazuje :active), a puszcza po chwili
  const wcisnij = (e) => { const b = e.currentTarget; b.classList.add('wcisniety'); setTimeout(() => b.classList.remove('wcisniety'), 120); };
  function klawiatura(cz, blok) {
    // klawisz = kolorowy krążek z wypukłą białą cyfrą; data-k wybiera kolor krążka
    const k = (etyk, akcja, nazwa, aria) => h('button', { class: 'klawisz', 'data-k': nazwa, type: 'button', 'aria-label': aria || (typeof etyk === 'string' ? etyk : ''), onpointerdown: wcisnij, onclick: akcja },
      h('span', { class: 'krazek' }, etyk));
    const cyfry = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => k(String(n), () => wpisz(String(n)), String(n)));
    const lewy = cz.kind !== 'liczba' ? k(ik('dalej'), () => dalej(), 'dalej', 'następne okienko') : k(',', () => wpisz(','), 'przecinek', 'przecinek');
    const minus = blok.ujemne ? k('−', () => wpisz('−'), 'minus', 'minus') : null;
    return [
      h('div', { class: 'klawiatura' }, cyfry, lewy, k('0', () => wpisz('0'), '0'), k(ik('kasuj'), () => kasuj(), 'kasuj', 'kasuj'), minus),
      h('button', { class: 'btn sprawdz szeroki', type: 'button', onpointerdown: wcisnij, onclick: () => sprawdz() }, 'Sprawdź'),
    ];
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
    if (cz.kind === 'wybor') el.querySelectorAll('.opcja').forEach((b) => { if (b.textContent === odp) b.classList.add(ok ? 'ok' : 'zle'); });
    if (ok) dobrze(); else zle(cz, odp, uwaga);
  }

  function dobrze() {
    seria++;
    graj(seria % 10 === 0 ? 'piec' : seria % 5 === 0 ? 'trzy' : 'dobrze');
    el.querySelector('.zadanie-karta').classList.add('ok');
    const stopka = el.querySelector('.stopka');
    stopka.className = 'stopka ok';
    stopka.replaceChildren(h('div', { class: 'stopka-tytul' }, ik('ptaszek'), ' ', los.wybierz(POCHWALY),
      seria >= 3 ? h('span', { class: 'seria' }, `seria ${seria}`) : null));
    timer = setTimeout(nastepne, 800);
  }

  function zle(cz, odp, uwaga) {
    seria = 0;
    graj('zle');
    const { z } = pozycja();
    // zadanie wraca w tym bloku za 2–4 pozycje (albo na końcu)
    const kolejka = B().kolejka;
    kolejka.splice(Math.min(kolejka.length, poz + 1 + los.int(2, 4)), 0, { z, powtorka: true });

    const karta = el.querySelector('.zadanie-karta');
    karta.classList.add('zle');
    el.querySelector('.info').replaceChildren();
    const pole = el.querySelector('.cw-pole');
    pole.append(h('section', { class: 'poprawka' },
      h('p', { class: 'twoja' }, 'Twoja odpowiedź: ', h('s', {}, mat(pokazOdp(cz, odp)))),
      uwaga ? h('p', { class: 'uwaga' }, uwaga) : null,
      h('div', { class: 'ramka-poprawna' },
        h('div', { class: 'kat-etykieta' }, 'Poprawna odpowiedź'),
        h('div', { class: 'rownanie' }, mat(poprawnie(cz)))),
      h('div', { class: 'sekcja' }, 'Jak to policzyć'),
      h('ol', { class: 'kroki' }, (cz.exp || []).map((l) => h('li', {}, mat(l)))),
      h('p', { class: 'wraca' }, ik('powtorz'), ' To zadanie wróci jeszcze raz w tym bloku.')));
    let zablokowaneDalej = true;
    const dalejBtn = h('button', { class: 'btn czerwony', type: 'button', disabled: true, onclick: () => { if (!zablokowaneDalej) nastepne(); } }, 'Przeczytaj…');
    const przerwijBtn = h('button', { class: 'btn jasny', type: 'button', disabled: true, onclick: przerwij }, 'Przerwij');
    const stopka = el.querySelector('.stopka');
    stopka.className = 'stopka zle';
    stopka.replaceChildren(
      h('div', { class: 'stopka-info z-koza' }, koza('mysli', 'koza-stopka'),
        h('div', {}, h('div', { class: 'stopka-tytul' }, 'Prawie! Zobacz, jak to policzyć.'))),
      h('div', { class: 'przyciski' }, przerwijBtn, dalejBtn));
    requestAnimationFrame(() => pole.querySelector('.poprawka')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    timer = setTimeout(() => {
      zablokowaneDalej = false;
      dalejBtn.disabled = false; przerwijBtn.disabled = false;
      dalejBtn.replaceChildren('Dalej', ik('dalej'));
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
    if (nrBloku + 1 >= bloki.length) return podsumowanie(false);
    const g = gwiazdki(dob, w.length);
    graj(g === 3 ? 'trzy' : 'dobrze');
    const nast = bloki[nrBloku + 1].blok;
    const dalejF = () => { nrBloku++; poz = 0; czesc = 0; wstepBloku(); };
    ekran({
      tresc: h('div', { class: 'podsum' },
        koza(g === 3 ? 'brawo' : 'ok', 'koza-duza'),
        h('div', { class: 'kat-etykieta' }, `Blok ${nrBloku + 1} z ${bloki.length} gotowy`),
        h('h2', { class: 'serif' }, B().blok.tytul),
        pokazGwiazdki(g, 'duze'),
        h('div', { class: 'wynik-duzy serif' }, `${dob}/${w.length}`),
        h('p', { class: 'maly' }, 'dobrze za pierwszym razem')),
      stopka: h('button', { class: 'btn glowny szeroki', type: 'button', id: 'dalej', onclick: dalejF }, `Dalej: ${nast.tytul}`, ik('dalej')),
    });
    ustawKlawisze((e) => { if (e.key === 'Enter') { e.preventDefault(); dalejF(); } });
    el.querySelector('#dalej').focus({ preventScroll: true });
  }

  // ---------- podsumowanie ----------
  function podsumowanie(przerwane) {
    sprzataj();
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
    nrBloku = Math.min(nrBloku, bloki.length - 1);
    ekran({
      bezGory: true,
      tresc: h('div', { class: 'podsum' },
        koza(g === 3 ? 'brawo' : g ? 'ok' : 'mysli', 'koza-duza'),
        h('div', { class: 'kat-etykieta' }, przerwane ? 'Przerwane' : 'Zestaw ukończony'),
        h('h2', { class: 'serif' }, zestaw.tytul),
        pokazGwiazdki(g, 'duze'),
        h('div', { class: 'podsum-kafle' },
          h('div', { class: 'kafel mietowy' }, h('b', {}, `${dob}/${proba.ile}`), h('small', {}, 'dobrze za 1. razem')),
          h('div', { class: 'kafel rozowy' }, h('b', {}, proba.ile - dob), h('small', {}, odm(proba.ile - dob, 'błąd', 'błędy', 'błędów'))),
          h('div', { class: 'kafel zolty' }, h('b', {}, `${minuty}`), h('small', {}, 'min'))),
        przerwane ? h('p', { class: 'maly' }, `Zrobione ${proba.ile} z ${wszystkich()} zadań.`) : null,
        status,
        h('div', { class: 'sekcja' }, 'Bloki'),
        h('ul', { class: 'lista-pozycji' }, proba.bloki.map((b) => h('li', { class: 'pozycja' },
          h('span', { class: 'poz-txt' }, h('b', {}, b.tytul)), pokazGwiazdki(gwiazdki(b.dobrze, b.ile)),
          h('span', { class: 'poz-status ' + (b.dobrze === b.ile ? 'opan' : 'uczy') }, `${b.dobrze}/${b.ile}`)))),
        proba.bledy.length
          ? [h('div', { class: 'sekcja' }, 'Do powtórki'),
            h('ul', { class: 'lista-pozycji bledy' }, proba.bledy.map((x) => h('li', { class: 'pozycja' },
              h('span', { class: 'poz-txt' }, h('b', { class: 'mat' }, mat(x.d)),
                h('small', {}, 'było: ', h('s', {}, mat(x.odp)), ' · dobrze: ', h('span', { class: 'dobra' }, mat(x.pelne || x.a)))))))]
          : h('p', { class: 'bez-bledow' }, 'Bez błędów — tak trzymaj!'),
        h('div', { class: 'przyciski kolumna' },
          Object.keys(doPowtorki).length ? h('button', { class: 'btn glowny', type: 'button', onclick: () => opcje.powtorz(doPowtorki) }, ik('powtorz'), 'Powtórz pomyłki') : null,
          h('button', { class: 'btn jasny', type: 'button', onclick: () => opcje.jeszczeRaz() }, 'Jeszcze raz (nowe przykłady)'),
          h('button', { class: 'btn jasny', type: 'button', onclick: () => opcje.wyjdz() }, 'Wróć do zestawów'))),
      stopka: h('button', { class: 'btn zielony szeroki', type: 'button', onclick: (e) => wyslij(tekstSMS, e.currentTarget, status) }, ik('wyslij'), 'Wyślij wynik'),
    });
  }

  wstepBloku();
  return { zakoncz: () => { sprzataj(); document.body.classList.remove('w-lekcji'); } };
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
