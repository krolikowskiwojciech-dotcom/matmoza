// Drobne pomocniki DOM, zapis matematyki (ułamki piętrowe, potęgi, okienka), ikony i własne okienka zamiast alert/confirm.

export function h(tag, attrs = {}, ...dzieci) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const d of dzieci.flat(Infinity)) if (d != null && d !== false) el.append(d instanceof Node ? d : String(d));
  return el;
}

// kolory kart jak w Lingozie (pastelowe, z ciemniejszym „brzegiem” 3D)
export const KOLORY = ['kolor-lila', 'kolor-mietowy', 'kolor-zolty', 'kolor-brzoskwinia', 'kolor-niebieski', 'kolor-rozowy'];
export const kolor = (i) => KOLORY[((i % KOLORY.length) + KOLORY.length) % KOLORY.length];

// ikony interfejsu — ten sam rysunek co w Lingozie (jedna kreska, zaokrąglone końce)
const S = (w) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${w}</svg>`;
const IKONY = {
  wstecz: S('<path d="M15 5l-7 7 7 7"/>'),
  zamknij: S('<path d="M6 6l12 12M18 6 6 18"/>'),
  zebatka: S('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'),
  ptaszek: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  dalej: S('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  kasuj: S('<path d="M9 5h10a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H9l-6-7z"/><path d="M11.5 9.5l5 5M16.5 9.5l-5 5"/>'),
  wyslij: S('<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>'),
  powtorz: S('<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>'),
};
export const ik = (nazwa, klasa = '') => h('span', { class: `ik ik-${nazwa} ${klasa}`, html: IKONY[nazwa] || '' });

const ulamek = (l, m) => h('span', { class: 'ul' }, h('span', { class: 'ul-l' }, l), h('span', { class: 'ul-m' }, m));

// tekst z działaniem → węzły; □ zamienia funkcja okienko(nr) (albo zwykły kwadrat)
export function mat(tekst, okienko) {
  const wynik = [];
  let nr = 0;
  const kw = () => (okienko ? okienko(nr++) : h('span', { class: 'kwadrat' }));
  const re = /(\d+) (\d+|□)\/(\d+|□)|(\d+|□)\/(\d+|□)|\^(\d+)|□/g;
  let i = 0, m;
  const czesc = (x) => (x === '□' ? kw() : x);
  while ((m = re.exec(tekst))) {
    if (m.index > i) wynik.push(tekst.slice(i, m.index));
    if (m[1]) wynik.push(h('span', { class: 'mieszana' }, m[1], ulamek(czesc(m[2]), czesc(m[3]))));
    else if (m[4]) wynik.push(ulamek(czesc(m[4]), czesc(m[5])));
    else if (m[6]) wynik.push(h('sup', {}, m[6]));
    else wynik.push(kw());
    i = re.lastIndex;
  }
  if (i < tekst.length) wynik.push(tekst.slice(i));
  return wynik;
}

export const koza = (poza, klasa = '') => h('img', { class: 'koza ' + klasa, src: `obrazy/koza-${poza}.png`, alt: '', onerror: (e) => e.target.remove() });

// własne okienko (wysuwane od dołu, z kózką): okno({ tytul, tresc, przyciski: [{ tekst, wartosc, klasa }] }) → Promise<wartosc>
export function okno({ tytul, tresc, poza = 'mysli', przyciski = [{ tekst: 'Jasne', wartosc: true, klasa: 'glowny' }] }) {
  return new Promise((ok) => {
    const tlo = h('div', { class: 'okno-tlo', onclick: () => zamknij(null) });
    const pudlo = h('div', { class: 'okno', role: 'dialog', 'aria-modal': 'true', 'aria-label': tytul },
      koza(poza, 'okno-koza'),
      h('div', { class: 'okno-tytul serif' }, tytul),
      typeof tresc === 'string' ? h('p', { class: 'okno-tekst' }, tresc) : tresc,
      h('div', { class: 'okno-przyciski' }, przyciski.map((p) => h('button', { class: 'btn ' + (p.klasa || 'jasny'), type: 'button', onclick: () => zamknij(p.wartosc) }, p.tekst))));
    const klaw = (e) => { if (e.key === 'Escape') zamknij(null); };
    function zamknij(w) {
      tlo.classList.remove('wid'); pudlo.classList.remove('wid');
      document.removeEventListener('keydown', klaw);
      setTimeout(() => { tlo.remove(); pudlo.remove(); }, 250);
      ok(w);
    }
    document.body.append(tlo, pudlo);
    document.addEventListener('keydown', klaw);
    requestAnimationFrame(() => { tlo.classList.add('wid'); pudlo.classList.add('wid'); });
    pudlo.querySelector('.okno-przyciski button:last-child')?.focus({ preventScroll: true });
  });
}

export const odm = (n, a, b, c) => {
  const j = n % 10, d = n % 100;
  return n === 1 ? a : j >= 2 && j <= 4 && (d < 12 || d > 14) ? b : c;
};
