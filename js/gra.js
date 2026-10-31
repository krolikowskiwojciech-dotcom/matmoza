// Przebieg zestawu: bloki ćwiczeń jeden po drugim, zła odpowiedź zatrzymuje grę i uczy,
// po błędzie dziecko przepisuje poprawną odpowiedź (dopiero wtedy „Dalej”),
// błędne zadanie wraca w tym samym bloku, na końcu podsumowanie i „Wyślij wynik”.
// Wygląd jak lekcja w Lingozie: pełny ekran w kolorze bloku, pasek postępu u góry, stopka z przyciskiem na dole.

import { h, mat, okno, odm, ik, kolor, wroc } from './dom.js';
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
// przybliżona skala szkolna (procent dobrych odpowiedzi → ocena); szkoły mają podobne, nie identyczne progi
const SKALA = [[95, 6, 'celujący'], [85, 5, 'bardzo dobry'], [70, 4, 'dobry'], [50, 3, 'dostateczny'], [30, 2, 'dopuszczający'], [0, 1, 'niedostateczny']];
export const ocenaSzkolna = (dob, ile) => { const pr = ile ? (dob / ile) * 100 : 0; const [, o, n] = SKALA.find(([prog]) => pr >= prog); return { o, n, pr: Math.round(pr) }; };
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
  let przep = null; // po błędzie: { cz, dalejBtn, gotowe, odblok } — przepisywanie poprawnej odpowiedzi
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

  // wspólny szkielet ekranu lekcji; „Wróć” zawsze w lewym górnym rogu (na podsumowaniu bez paska postępu)
  function ekran({ tytul, tresc, stopka, klasaStopki = '', bezGory = false }) {
    el.className = `lekcja w-kolorze ${kolor(B()?.nr ?? 0)}`;
    el.replaceChildren(...[
      h('div', { class: 'lekcja-gora' },
        bezGory ? wroc({ onclick: () => { graj('cofnij'); opcje.wyjdz(); } }) : wroc({ onclick: wyjdzZLekcji }),
        bezGory ? null : h('div', { class: 'postep' }, h('div', { class: 'postep-wew', style: `width:${postep()}%` })),
        bezGory ? null : h('span', { class: 'licznik' }, `${nrBloku + 1}/${bloki.length}`)),
      tytul ? h('div', { class: 'lekcja-tytul serif' }, tytul) : null,
      h('div', { class: 'cw-pole' }, tresc),
      stopka ? h('div', { class: 'stopka ' + klasaStopki }, stopka) : null].filter(Boolean));
    el.querySelector('.cw-pole').scrollTop = 0;
  }

  // „Wróć” w trakcie: bez odpowiedzi wychodzi od razu; gdy coś już zrobione — pyta (podejścia nie da się wznowić)
  async function wyjdzZLekcji() {
    if (document.querySelector('.okno-tlo')) return;
    if (!zrobionych()) { sprzataj(); graj('cofnij'); opcje.wyjdz(); return; }
    const w = await okno({ tytul: 'Wyjść z ćwiczenia?', tresc: 'Wynik zapisuje się dopiero po całym zestawie. Jeśli wyjdziesz teraz, to podejście się nie liczy i następnym razem zaczniesz od początku.',
      przyciski: [{ tekst: 'Ćwiczę dalej', wartosc: false, klasa: 'jasny' }, { tekst: 'Wyjdź', wartosc: true, klasa: 'czerwony' }] });
    if (!w) return;
    sprzataj();
    opcje.wyjdz();
  }

  // ---------- wstęp do bloku ----------
  function wstepBloku() {
    sprzataj();
    graj(nrBloku === 0 && bloki.length > 1 && !opcje.powtorka ? 'start' : 'blok');
    const b = B().blok;
    // na sprawdzianie próbnym bez podpowiedzi przed blokiem (wyjaśnienie po błędzie zostaje)
    const jak = zestaw.sprawdzian ? null : b.jak || JAK[b.generator?.typ];
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
      stopka: h('button', { class: 'btn glowny szeroki', type: 'button', id: 'start-bloku', onclick: () => { graj('przycisk'); pokazZadanie(); } }, 'Zaczynam', ik('dalej')),
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

  // okienka bez data-i (zamrożona błędna odpowiedź) nie dają się już wybrać
  const podepnijPola = (root) => root.querySelectorAll('.pole[data-i]').forEach((p) => p.addEventListener('click', () => {
    if (!p.hasAttribute('data-i') || zablokowane) return;
    aktywne = Number(p.dataset.i); graj('klik'); odswiezPola();
  }));

  function pokazZadanie() {
    sprzataj();
    zablokowane = false;
    przep = null;
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
    podepnijPola(el);
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
    const lewy = cz.kind === 'czynniki' ? k('·', () => wpisz('·'), 'przecinek', 'razy')
      : cz.kind !== 'liczba' ? k(ik('dalej'), () => dalej(), 'dalej', 'następne okienko') : k(',', () => wpisz(','), 'przecinek', 'przecinek');
    const minus = blok.ujemne ? k('−', () => wpisz('−'), 'minus', 'minus') : null;
    // ułamki okresowe: dodatkowe nawiasy do zapisu okresu, np. 0,(3)
    const nawiasy = cz.okres || blok.okres ? [k('(', () => wpisz('('), 'minus', 'nawias otwierający'), k(')', () => wpisz(')'), 'minus', 'nawias zamykający')] : null;
    return [
      h('div', { class: 'klawiatura' + (nawiasy ? ' piec-rzedow' : '') }, cyfry, lewy, k('0', () => wpisz('0'), '0'), k(ik('kasuj'), () => kasuj(), 'kasuj', 'kasuj'), minus, nawiasy),
      h('button', { class: 'btn sprawdz szeroki', type: 'button', onpointerdown: wcisnij, onclick: () => sprawdz() }, 'Sprawdź'),
    ];
  }

  function wpisz(znak) {
    if (zablokowane) return;
    const v = pola[aktywne];
    if (znak === ',' && (v.includes(',') || !v)) return;
    if (znak === '·' && (!v || v.endsWith('·'))) return;
    if (znak === '(' && (!v.includes(',') || v.includes('('))) return;
    if (znak === ')' && (!v.includes('(') || v.includes(')') || v.endsWith('('))) return;
    if (znak === '−' && v) return;
    if (v.replace(/\D/g, '').length >= 12) return;
    pola[aktywne] = v + znak;
    const info = el.querySelector('.info.podpowiedz');
    if (info) { info.textContent = ''; info.className = 'info'; }
    graj('klik');
    odswiezPola();
    sprawdzPrzepisanie();
  }
  function kasuj() {
    if (zablokowane) return;
    if (!pola[aktywne] && czescTeraz().kind === 'ulamek' && aktywne === 2) aktywne = 1;
    pola[aktywne] = pola[aktywne].slice(0, -1);
    graj('cofnij');
    odswiezPola();
    sprawdzPrzepisanie();
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
    if (przep && e.key === 'Enter') { e.preventDefault(); if (!e.repeat) idzDalej(); return; }
    if (przep && cz.kind === 'wybor') return; // przepisuje w zwykłym polu tekstowym
    if (cz.kind === 'wybor') {
      const i = { '<': 0, '=': 1, '>': 2 }[e.key];
      if (i != null && cz.choices[i]) sprawdz(cz.choices[i]);
      const n = Number(e.key);
      if (n >= 1 && n <= cz.choices.length) sprawdz(cz.choices[n - 1]);
      return;
    }
    if (/^\d$/.test(e.key)) wpisz(e.key);
    else if ((e.key === ',' || e.key === '.') && cz.kind === 'liczba') wpisz(',');
    else if ((e.key === '*' || e.key === 'x') && cz.kind === 'czynniki') wpisz('·');
    else if ((e.key === '(' || e.key === ')') && (cz.okres || B().blok.okres)) wpisz(e.key);
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
  const brakuje = (cz) => (cz.kind === 'reszta' ? pola.some((p) => !p) : cz.kind === 'ulamek' ? (!pola[1] !== !pola[2]) || (!pola[0] && !pola[1]) : !pola[0]);

  function sprawdz(wybor) {
    if (zablokowane || przep) return;
    const cz = czescTeraz();
    const info = el.querySelector('.info');
    let odp;
    if (cz.kind === 'wybor') odp = wybor;
    else {
      odp = odpowiedzDziecka(cz);
      if (brakuje(cz)) {
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
    graj(seria % 10 === 0 ? 'seria10' : seria % 5 === 0 ? 'seria5' : 'dobrze');
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

    // wersja C: odpowiedź w samej karcie zadania, na dole tylko klawiatura do przepisania i szeroki „Dalej”
    const karta = el.querySelector('.zadanie-karta');
    karta.classList.add('zle');
    karta.querySelector('.info')?.remove();
    karta.querySelectorAll('.pole[data-i]').forEach((p) => { p.removeAttribute('data-i'); p.classList.remove('aktywne'); });
    const wybor = cz.kind === 'wybor';
    const wpis = wybor
      ? h('input', { class: 'przepisz-tekst', type: 'text', id: 'przepisz', disabled: true, autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off',
        spellcheck: 'false', enterkeyhint: 'go', oninput: sprawdzPrzepisanie })
      : h('div', { class: 'przepisz-pola' }, mat(cz.kind === 'reszta' ? '□ r. □' : '□', okienkoDla(cz)), cz.jednostka ? h('span', { class: 'jednostka' }, cz.jednostka) : null);
    karta.append(
      h('div', { class: 'odp' },
        h('p', { class: 'twoja' }, 'Twoja odpowiedź: ', h('s', {}, mat(pokazOdp(cz, odp)))),
        h('div', { class: 'odp-poprawna', 'aria-label': 'Poprawna odpowiedź' }, ik('ptaszek'), h('span', { class: 'odp-rownanie' }, mat(poprawnie(cz)))),
        uwaga ? h('p', { class: 'uwaga' }, uwaga) : null),
      cz.exp?.length ? h('div', { class: 'wyjasnienie' },
        h('div', { class: 'wyj-tytul' }, 'Jak to policzyć'),
        h('ol', { class: 'kroki' }, cz.exp.map((l) => h('li', {}, mat(l))))) : null,
      h('div', { class: 'przepisz' }, h('label', { class: 'przepisz-etyk', for: wybor ? 'przepisz' : null }, 'Przepisz poprawnie:'), wpis),
      h('p', { class: 'wraca' }, ik('powtorz'), ' To zadanie wróci jeszcze raz w tym bloku.'));
    nowePola(cz);
    podepnijPola(karta);
    odswiezPola();

    const dalejBtn = h('button', { class: 'btn glowny szeroki dalej-przep', type: 'button', disabled: true, onclick: () => idzDalej() });
    przep = { cz, dalejBtn, gotowe: false, odblok: false };
    odswiezDalej();
    const stopka = el.querySelector('.stopka');
    stopka.className = 'stopka przepisywanie';
    if (wybor) stopka.replaceChildren(dalejBtn);
    else stopka.querySelector('.btn.sprawdz').replaceWith(dalejBtn);
    requestAnimationFrame(() => karta.querySelector('.przepisz')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    // przyciski i klawisze śpią BLOKADA_MS, żeby rozpędzony palec nie przeskoczył wyjaśnienia
    ustawKlawisze(null);
    timer = setTimeout(() => {
      zablokowane = false;
      przep.odblok = true;
      odswiezPola();
      odswiezDalej();
      if (wybor) { const t = el.querySelector('#przepisz'); t.disabled = false; t.focus({ preventScroll: true }); }
      ustawKlawisze((e) => klawiszFizyczny(e, cz));
    }, BLOKADA_MS);
  }

  // przepisanie musi dać poprawną odpowiedź; ocena pierwszego podejścia się nie zmienia
  // tekst z wyboru: bez wielkości liter, spacji i końcowej interpunkcji; kropka = przecinek w liczbach, * i × = ·
  const uprosc = (t) => String(t).toLowerCase().replace(/[−–]/g, '-').replace(/[*×⋅∙]/g, '·').trim().replace(/[.,;:!?…]+$/, '')
    .replace(/(\d)\.(?=\d)/g, '$1,').replace(/\s+/g, '');
  function sprawdzPrzepisanie() {
    if (!przep) return;
    const { cz } = przep;
    const ok = cz.kind === 'wybor'
      ? uprosc(el.querySelector('#przepisz').value) === uprosc(cz.a)
      : !brakuje(cz) && ocen(cz, odpowiedzDziecka(cz)).ok;
    if (ok === przep.gotowe) return;
    przep.gotowe = ok;
    el.querySelector('.przepisz').classList.toggle('gotowe', ok);
    if (ok) graj('przycisk');
    odswiezDalej();
  }
  function odswiezDalej() {
    const { dalejBtn, gotowe, odblok } = przep;
    const wolno = gotowe && odblok;
    if (dalejBtn.disabled === !wolno && dalejBtn.childNodes.length) return;
    dalejBtn.disabled = !wolno;
    dalejBtn.replaceChildren(...(wolno ? ['Dalej', ik('dalej')] : ['Przepisz, żeby przejść dalej']));
  }
  function idzDalej() {
    if (!przep?.gotowe || !przep.odblok) return;
    graj('przycisk');
    nastepne();
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
  // wynik tylko po całym zestawie (zasada Wojtka 2026-10-31): między blokami bez ekranu wyniku, od razu następny blok
  function koniecBloku() {
    sprzataj();
    if (nrBloku + 1 >= bloki.length) return podsumowanie(false);
    nrBloku++; poz = 0; czesc = 0;
    wstepBloku();
  }

  // ---------- podsumowanie ----------
  function zbudujProbe(przerwane) {
    const wszystkie = bloki.flatMap((b) => b.wyniki);
    const dob = wszystkie.filter((x) => x.dobrze).length;
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      zestaw: zestaw.id, tytul: zestaw.tytul + (opcje.tylkoBlok ? ` — ${bloki[0].blok.tytul}` : ''), d: start, czas: Math.round((Date.now() - start) / 1000),
      ile: wszystkie.length, dobrze: dob, przerwane: przerwane || undefined,
      tylkoBlok: opcje.tylkoBlok || undefined, powtorka: opcje.powtorka || undefined,
      bloki: bloki.filter((b) => b.wyniki.length).map((b) => ({ id: b.blok.id, tytul: b.blok.tytul, ile: b.wyniki.length, dobrze: b.wyniki.filter((x) => x.dobrze).length })),
      bledy: wszystkie.filter((x) => !x.dobrze).map(({ tekst, a, pelne, odp }) => ({ d: tekst, a, pelne, odp })),
    };
  }

  function podsumowanie(przerwane) {
    sprzataj();
    const wszystkie = bloki.flatMap((b) => b.wyniki);
    const dob = wszystkie.filter((x) => x.dobrze).length;
    const proba = zbudujProbe(przerwane);
    if (proba.ile) opcje.naKoniec(proba);
    const g = gwiazdki(dob, proba.ile);
    if (!przerwane) graj(g === 3 ? 'zwyciestwo' : 'koniec');
    const minuty = Math.max(1, Math.round(proba.czas / 60));
    const ocena = zestaw.ocena && proba.ile && !przerwane ? ocenaSzkolna(dob, proba.ile) : null;
    if (ocena) proba.ocena = ocena.o;
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
        h('div', { class: 'kat-etykieta' }, przerwane ? 'Przerwane' : 'Zestaw ukończony'),
        h('h2', { class: 'serif' }, zestaw.tytul),
        pokazGwiazdki(g, 'duze'),
        ocena ? h('div', { class: 'ocena-szkolna' }, h('span', { class: 'ocena-cyfra serif' }, ocena.o), h('span', { class: 'ocena-opis' }, h('b', {}, ocena.n), h('small', {}, `${ocena.pr}% dobrze · przybliżona skala szkolna`))) : null,
        h('div', { class: 'podsum-kafle' },
          h('div', { class: 'kafel bialy' }, h('b', {}, `${dob}/${proba.ile}`), h('small', {}, 'dobrze za 1. razem')),
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
    `Matematyka · ${profilInfo?.imie || ''}`,
    `${p.tytul}${p.przerwane ? ' (przerwane)' : ''}${p.powtorka ? ' (powtórka pomyłek)' : ''}`,
    `Dobrze za pierwszym razem: ${p.dobrze} z ${p.ile} (${procent}%) · błędów: ${p.ile - p.dobrze}`,
    ...(p.ocena ? [`Ocena (przybliżona skala szkolna): ${p.ocena}`] : []),
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
      try { await navigator.share({ title: 'Matematyka — wynik', text: tekst }); graj('wyslij'); status.textContent = 'Wysłane? Super!'; return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(tekst); graj('wyslij'); status.textContent = 'Skopiowano — wklej w wiadomości do taty.'; return; } catch { /* dalej */ }
    }
    const pole = h('textarea', { class: 'kopiuj', readonly: true }, tekst);
    status.replaceChildren('Zaznacz i skopiuj:', pole);
    pole.select();
  } finally { btn.disabled = false; }
}
