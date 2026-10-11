// Drobne pomocniki DOM, zapis matematyki (ułamki piętrowe, potęgi, okienka) i własne okienka zamiast alert/confirm.

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

// własne okienko: okno({ tytul, tresc, przyciski: [{ tekst, wartosc, klasa }] }) → Promise<wartosc>
export function okno({ tytul, tresc, przyciski = [{ tekst: 'Jasne', wartosc: true, klasa: 'glowny' }] }) {
  return new Promise((ok) => {
    const zamknij = (w) => { tlo.remove(); document.removeEventListener('keydown', klaw); ok(w); };
    const klaw = (e) => { if (e.key === 'Escape') zamknij(null); };
    const tlo = h('div', { class: 'okno-tlo', onclick: (e) => { if (e.target === tlo) zamknij(null); } },
      h('div', { class: 'okno', role: 'dialog', 'aria-modal': 'true', 'aria-label': tytul },
        h('h2', {}, tytul),
        typeof tresc === 'string' ? h('p', {}, tresc) : tresc,
        h('div', { class: 'okno-przyciski' }, przyciski.map((p) => h('button', { class: 'btn ' + (p.klasa || ''), type: 'button', onclick: () => zamknij(p.wartosc) }, p.tekst)))));
    document.body.append(tlo);
    document.addEventListener('keydown', klaw);
    tlo.querySelector('.okno-przyciski button:last-child')?.focus();
  });
}

export const odm = (n, a, b, c) => {
  const j = n % 10, d = n % 100;
  return n === 1 ? a : j >= 2 && j <= 4 && (d < 12 || d > 14) ? b : c;
};
