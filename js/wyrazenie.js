// Wyrażenia z działaniami: rozbiór tekstu („3 + 4 · (12 − 2)”), wartość i liczenie krok po kroku
// w szkolnej kolejności: nawiasy → potęgi → mnożenie i dzielenie → dodawanie i odejmowanie, od lewej.
// Każdy krok to całe wyrażenie z jednym poziomem działań policzonym, więc każde „=” jest prawdziwe.

import { Q, parsuj, zapisz, SPACJA } from './liczby.js';

const POZIOM = { '+': 1, '−': 1, '·': 2, ':': 2, '^': 3 };
const NAZWA = { 1: 'dodawanie i odejmowanie', 2: 'mnożenie i dzielenie', 3: 'potęgi' };

function tokeny(tekst) {
  const s = String(tekst).replace(/[×x*]/g, '·').replace(/-/g, '−').replace(/²/g, '^2').replace(/³/g, '^3');
  const out = [];
  const re = new RegExp(`\\s*(\\d+ \\d+\\/\\d+|\\d+\\/\\d+|\\d{1,3}(?:${SPACJA}\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?|[+−·:()^])`, 'y');
  let i = 0;
  while (i < s.length) {
    if (!s.slice(i).trim()) break;
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) throw new Error(`Nie rozumiem wyrażenia „${tekst}” (pozycja ${i})`);
    out.push(m[1]);
    i = re.lastIndex;
  }
  return out;
}

export function rozbierz(tekst) {
  const t = tokeny(tekst);
  let p = 0;
  const nast = () => t[p];
  function czynnik() {
    const tok = t[p++];
    let w;
    if (tok === '(') {
      w = suma();
      if (t[p++] !== ')') throw new Error('Brak nawiasu zamykającego w: ' + tekst);
      w = { ...w, nawias: true };
    } else {
      const v = parsuj(tok);
      if (!v) throw new Error(`Nieznany element „${tok}” w: ${tekst}`);
      w = { t: 'n', v, z: tok };
    }
    while (nast() === '^') {
      p++;
      const wyk = Number(t[p++]);
      if (!Number.isInteger(wyk)) throw new Error('Zły wykładnik w: ' + tekst);
      w = { t: 'op', o: '^', a: w, b: { t: 'n', v: new Q(wyk), z: String(wyk) } };
    }
    return w;
  }
  function iloczyn() {
    let w = czynnik();
    while (nast() === '·' || nast() === ':') { const o = t[p++]; w = { t: 'op', o, a: w, b: czynnik() }; }
    return w;
  }
  function suma() {
    let w = iloczyn();
    while (nast() === '+' || nast() === '−') { const o = t[p++]; w = { t: 'op', o, a: w, b: iloczyn() }; }
    return w;
  }
  const w = suma();
  if (p !== t.length) throw new Error('Nadmiarowe znaki w: ' + tekst);
  return w;
}

function licz(o, a, b) {
  switch (o) {
    case '+': return a.dodaj(b);
    case '−': return a.odejmij(b);
    case '·': return a.razy(b);
    case ':': return a.przez(b);
    case '^': return a.potega(b.wartosc);
  }
  throw new Error('Nieznane działanie ' + o);
}

export function wartosc(w) {
  if (typeof w === 'string') w = rozbierz(w);
  return w.t === 'n' ? w.v : licz(w.o, wartosc(w.a), wartosc(w.b));
}

export function pisz(w, styl = 'auto') {
  if (w.t === 'n') return w.z ?? zapisz(w.v, styl);
  let s;
  if (w.o === '^') {
    const podst = w.a.t === 'op' && !w.a.nawias ? '(' + pisz(w.a, styl) + ')' : pisz(w.a, styl);
    s = podst + '^' + pisz(w.b, styl);
  } else s = pisz(w.a, styl) + ' ' + w.o + ' ' + pisz(w.b, styl);
  return w.nawias ? '(' + s + ')' : s;
}

// działania gotowe do policzenia (oba składniki są już liczbami) z głębokością nawiasów
function gotowe(w, gl = 0, out = []) {
  if (w.t !== 'op') return out;
  const g = gl + (w.nawias ? 1 : 0);
  if (w.a.t === 'n' && w.b.t === 'n') out.push({ w, g, poz: POZIOM[w.o] });
  else { gotowe(w.a, g, out); gotowe(w.b, g, out); }
  return out;
}

// jeden krok: liczy wszystkie gotowe działania z najwyższej klasy (najgłębszy nawias, potem najwyższy poziom)
function krok(w, styl) {
  const g = gotowe(w);
  const maxG = Math.max(...g.map((x) => x.g));
  const wNawiasie = g.filter((x) => x.g === maxG);
  const maxP = Math.max(...wNawiasie.map((x) => x.poz));
  const wybrane = new Set(wNawiasie.filter((x) => x.poz === maxP).map((x) => x.w));
  const czastki = [];
  const zamien = (n) => {
    if (n.t !== 'op') return n;
    if (wybrane.has(n)) {
      const v = licz(n.o, n.a.v, n.b.v);
      const wyn = { t: 'n', v, z: zapisz(v, styl) };
      czastki.push(pisz({ ...n, nawias: false }, styl) + ' = ' + wyn.z);
      return wyn;
    }
    return { ...n, a: zamien(n.a), b: zamien(n.b) };
  };
  const nowe = zamien(w);
  return { nowe, czastki, nawias: maxG > 0, poziom: maxP };
}

// { wynik: Q, kroki: [{opis, czastki}], lancuch: 'a = b = c', wartosci: [Q…] (wyniki pośrednie) }
export function krokPoKroku(tekst, styl = 'auto') {
  let w = typeof tekst === 'string' ? rozbierz(tekst) : tekst;
  const lancuch = [pisz(w, styl)];
  const kroki = [];
  const wartosci = [];
  while (w.t !== 'n') {
    const k = krok(w, styl);
    const opis = k.nawias ? 'Najpierw nawias' : kroki.length ? 'Potem ' + NAZWA[k.poziom] : 'Najpierw ' + NAZWA[k.poziom];
    kroki.push({ opis, czastki: k.czastki });
    w = k.nowe;
    lancuch.push(pisz(w, styl));
    zbierz(k.nowe, wartosci);
  }
  return { wynik: w.v, kroki, lancuch: lancuch.join(' = '), wartosci };
}

function zbierz(w, out) {
  if (w.t === 'n') out.push(w.v);
  else { zbierz(w.a, out); zbierz(w.b, out); }
}

// czy wszystkie wyniki pośrednie są całkowite i nieujemne (poziom klasy 4–6)
export function lagodne(tekst) {
  try {
    const { wartosci } = krokPoKroku(tekst);
    return wartosci.every((v) => v.calkowita && !v.ujemna);
  } catch { return false; }
}
