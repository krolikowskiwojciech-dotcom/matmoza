// Generatory zadań. Każdy zwraca zadanie w jednym formacie:
//   { q?: polecenie/treść, d?: działanie z okienkiem □, a: odpowiedź, kind, choices?, postac?, exp: [kroki], w?: ukryte wyrażenie }
// kind: 'liczba' | 'ulamek' | 'reszta' | 'wybor'. Wyjaśnienia piszemy tak, żeby każde „=” było prawdą:
// etykieta kończy się dwukropkiem bez spacji przed nim („Policz bez zer: 72 · 3 = 216”), dzielenie ma spacje („18 : 6”).
// Narzędzie `node narzedzia/matmoza.mjs sprawdz` sprawdza to niezależną wyrocznią.

import { Q, q, zapisz, nwd, nww, odmiana, okresowy, cyfraPoPrzecinku } from './liczby.js';
import { krokPoKroku, lagodne, wartosc } from './wyrazenie.js';

// ---------- losowanie ----------
export const los = {
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  wybierz: (arr) => arr[Math.floor(Math.random() * arr.length)],
  tasuj(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },
};

const Z = (x) => zapisz(x);
const zera = (n) => { let z = 0; while (n !== 0 && n % 10 === 0) { n /= 10; z++; } return z; };

// specyfikacja zmiennej w szablonie:
//   [min, max]                         liczba całkowita
//   { lista: [...] }                   jedna z listy (liczby albo teksty „3/4”, „2,5”)
//   { od, do, miejsca }                liczba dziesiętna z dokładnie tyloma miejscami po przecinku
//   { cyfry: [min, max], zera: [a, b] } np. 72 i 3 zera → 72 000
//   "= b · c"                          wyliczona z wcześniejszych zmiennych
function losujZmienna(spec, wart) {
  if (Array.isArray(spec)) return new Q(los.int(spec[0], spec[1]));
  if (typeof spec === 'string') {
    const wyr = spec.replace(/^=\s*/, '').replace(/\b([a-z])\b/g, (_, n) => wart[n]._t ?? Z(wart[n]));
    return wartosc(wyr);
  }
  if (spec.lista) { const t = String(los.wybierz(spec.lista)); const v = q(t); v._t = t.replace('.', ','); return v; }
  if (spec.ulamek) {
    // { ulamek: { mianowniki: [...], calosci: [0, 2] } } → „3/4” albo „2 1/3” (zapis zostaje jak w podręczniku)
    const u = spec.ulamek;
    const m = los.wybierz(u.mianowniki || [2, 3, 4, 5, 6, 8]);
    const l = los.int(1, m - 1);
    if (nwd(l, m) !== 1) return losujZmienna(spec, wart);
    const c = los.int(...(u.calosci || [0, 0]));
    const v = new Q(c * m + l, m);
    v._t = c ? `${c} ${l}/${m}` : `${l}/${m}`;
    return v;
  }
  if (spec.cyfry) return new Q(los.int(spec.cyfry[0], spec.cyfry[1]) * 10 ** los.int(spec.zera[0], spec.zera[1]));
  if (spec.miejsca != null) {
    const skala = 10 ** spec.miejsca;
    for (let i = 0; i < 50; i++) {
      const n = los.int(Math.round(spec.od * skala), Math.round(spec.do * skala));
      if (spec.miejsca === 0 || n % 10 !== 0) return new Q(n, skala);
    }
  }
  throw new Error('Nieznana zmienna: ' + JSON.stringify(spec));
}

function wypelnij(szablon, wart) {
  return szablon.replace(/\{([a-z])\}/g, (_, n) => {
    if (!(n in wart)) throw new Error(`Brak zmiennej {${n}} w szablonie „${szablon}”`);
    return wart[n]._t ?? Z(wart[n]);
  });
}

// ---------- wyjaśnienia pojedynczych działań ----------
const KOLEJNOSC_TRIKOW = [1, 10, 2, 5, 9, 4, 8, 3, 6, 7];
function trikMnozenia(x, y) {
  const b = KOLEJNOSC_TRIKOW.find((t) => t === x || t === y) ?? y;
  const a = b === y ? x : y;
  switch (b) {
    case 1: return [`Razy 1 to to samo: ${a} · 1 = ${a}`];
    case 10: return [`Razy 10 to dopisane zero: ${a} · 10 = ${a * 10}`];
    case 2: return [`Razy 2 to podwojenie: ${a} + ${a} = ${a * 2}`];
    case 5: return [`Razy 5 to połowa z razy 10: ${a} · 10 = ${a * 10}`, `${a * 10} : 2 = ${a * 5}`];
    case 9: return [`Razy 9 to razy 10 minus raz: ${a} · 10 = ${a * 10}`, `${a * 10} − ${a} = ${a * 9}`];
    case 4: return [`Razy 4 to podwój dwa razy: ${a} → ${a * 2} → ${a * 4}`];
    case 8: return [`Razy 8 to podwój trzy razy: ${a} → ${a * 2} → ${a * 4} → ${a * 8}`];
    case 3: return [`Razy 3 to podwój i dodaj raz: ${a} · 2 = ${a * 2}`, `${a * 2} + ${a} = ${a * 3}`];
    case 6: return [`Razy 6 to razy 3, a potem podwój: ${a} · 3 = ${a * 3}`, `${a * 3} · 2 = ${a * 6}`];
    case 7: return [`Razy 7 to razy 5 plus razy 2: ${a} · 5 = ${a * 5}`, `${a} · 2 = ${a * 2}`, `${a * 5} + ${a * 2} = ${a * 7}`];
  }
  return [];
}

function wyjasnijCalkowite(o, a, b) {
  const W = (x) => Z(new Q(x));
  if (o === '+' || o === '−') {
    const wynik = o === '+' ? a + b : a - b;
    if (a < 1000 && b >= 10 && b < 1000 && b % 10 !== 0) {
      const T = b - (b % 10), J = b % 10;
      const pos = o === '+' ? a + T : a - T;
      return [`Rozbij ${W(b)} na ${W(T)} i ${J}: ${W(a)} ${o} ${W(b)} = ${W(a)} ${o} ${W(T)} ${o} ${J}`,
        `${W(a)} ${o} ${W(T)} = ${W(pos)}`, `${W(pos)} ${o} ${J} = ${W(wynik)}`];
    }
    return o === '+'
      ? [`${W(a)} + ${W(b)} = ${W(wynik)}`, `Sprawdzenie: ${W(wynik)} − ${W(b)} = ${W(a)}`]
      : [`${W(a)} − ${W(b)} = ${W(wynik)}`, `Sprawdzenie: ${W(wynik)} + ${W(b)} = ${W(a)}`];
  }
  if (o === '·') {
    const za = zera(a), zb = zera(b);
    if (za + zb > 0) {
      const a0 = a / 10 ** za, b0 = b / 10 ** zb;
      return [`Policz bez zer: ${W(a0)} · ${W(b0)} = ${W(a0 * b0)}`,
        `Dopisz ${za + zb} ${odmiana(za + zb, 'zero', 'zera', 'zer')}: ${W(a)} · ${W(b)} = ${W(a * b)}`];
    }
    if (a <= 10 && b <= 10) return trikMnozenia(a, b);
    // sprytnie: czynnik blisko pełnej dziesiątki (19, 21, 99…), razy 15 albo razy 25
    if (a >= 11 && b >= 11 && a < 1000 && b < 1000) {
      const [x, y] = [a, b].sort((p1, p2) => Math.abs(p1 - Math.round(p1 / 10) * 10) - Math.abs(p2 - Math.round(p2 / 10) * 10) || p1 - p2);
      const R = Math.round(x / 10) * 10, r = x - R;
      if (Math.abs(r) === 1) {
        const o = r > 0 ? '+' : '−';
        return [`Rozbij ${W(x)} na ${W(R)} ${o} 1: ${W(y)} · ${W(x)} = ${W(y)} · ${W(R)} ${o} ${W(y)}`, `${W(y)} · ${W(R)} = ${W(y * R)}`, `${W(y * R)} ${o} ${W(y)} = ${W(a * b)}`];
      }
      const z = [a, b].find((t) => t === 15 || t === 25);
      if (z) {
        const inny = z === a ? b : a;
        if (z === 15) return [`Razy 15 to razy 10 plus razy 5: ${W(inny)} · 15 = ${W(inny)} · 10 + ${W(inny)} · 5`, `${W(inny)} · 10 = ${W(inny * 10)}`, `${W(inny)} · 5 = ${W(inny * 5)}`, `${W(inny * 10)} + ${W(inny * 5)} = ${W(a * b)}`];
        if (inny % 4 === 0) return [`Razy 25 to razy 100 i podzielić przez 4: ${W(inny)} · 25 = ${W(inny)} · 100 : 4`, `${W(inny * 100)} : 4 = ${W(a * b)}`];
      }
      const [d, m] = a >= b ? [a, b] : [b, a];
      const T = m - (m % 10), J = m % 10;
      if (J && T) return [`Rozbij ${W(m)} na ${W(T)} i ${J}: ${W(d)} · ${W(m)} = ${W(d)} · ${W(T)} + ${W(d)} · ${J}`, `${W(d)} · ${W(T)} = ${W(d * T)}`, `${W(d)} · ${J} = ${W(d * J)}`, `${W(d * T)} + ${W(d * J)} = ${W(a * b)}`];
    }
    const [d, m] = a >= b ? [a, b] : [b, a];
    if (m < 10 && d < 1000 && d % 10 !== 0 && d > 10) {
      const T = d - (d % 10), J = d % 10;
      return [`Rozbij ${W(d)} na ${W(T)} i ${J}: ${W(d)} · ${m} = ${W(T)} · ${m} + ${J} · ${m}`,
        `${W(T)} · ${m} = ${W(T * m)}`, `${J} · ${m} = ${J * m}`, `${W(T * m)} + ${J * m} = ${W(d * m)}`];
    }
    return [`${W(a)} · ${W(b)} = ${W(a * b)}`];
  }
  if (o === ':') {
    const out = [];
    const k = Math.min(zera(a), zera(b));
    if (k > 0) {
      out.push(`Skreśl tyle samo zer w obu liczbach: ${W(a)} : ${W(b)} = ${W(a / 10 ** k)} : ${W(b / 10 ** k)}`);
      a /= 10 ** k; b /= 10 ** k;
    }
    const wynik = a / b;
    const za = zera(a);
    if (za > 0 && b % 10 !== 0 && (a / 10 ** za) % b === 0 && a / 10 ** za >= b) {
      const a0 = a / 10 ** za;
      out.push(`Policz bez zer: ${W(a0)} : ${W(b)} = ${W(a0 / b)}`,
        `Dopisz ${za} ${odmiana(za, 'zero', 'zera', 'zer')}: ${W(a)} : ${W(b)} = ${W(wynik)}`);
    } else if (a >= 10 * b && a < 10000) {
      const x = Math.floor(a / (10 * b)) * 10 * b, y = a - x;
      if (y > 0 && y % b === 0) {
        out.push(`Rozbij ${W(a)} na ${W(x)} i ${W(y)}: ${W(a)} : ${b} = ${W(x)} : ${b} + ${W(y)} : ${b}`,
          `${W(x)} : ${b} = ${W(x / b)}`, `${W(y)} : ${b} = ${W(y / b)}`, `${W(x / b)} + ${W(y / b)} = ${W(wynik)}`);
      } else out.push(`${W(a)} : ${W(b)} = ${W(wynik)}`);
    } else if (a <= 100 && b <= 10 && wynik <= 10) {
      out.push(`Szukasz liczby, która razy ${b} daje ${a}: ${b} · ${wynik} = ${a}`);
    } else out.push(`${W(a)} : ${W(b)} = ${W(wynik)}`);
    out.push(`Sprawdzenie: ${W(wynik)} · ${W(b)} = ${W(a)}`);
    return out;
  }
  if (o === '^') {
    const czynniki = Array(b).fill(W(a)).join(' · ');
    return [`Potęga to mnożenie tej samej liczby: ${W(a)}^${b} = ${czynniki}`, `${czynniki} = ${W(a ** b)}`];
  }
  return [];
}

function wyjasnijDziesietne(o, A, B) {
  const wynik = { '+': () => A.dodaj(B), '−': () => A.odejmij(B), '·': () => A.razy(B), ':': () => A.przez(B) }[o]();
  const mA = A.miejsca, mB = B.miejsca;
  const potega10 = (x) => x.calkowita && /^10+$/.test(String(x.l));
  if ((o === '·' || o === ':') && potega10(B)) {
    const n = String(B.l).length - 1;
    return [`${o === '·' ? 'Razy' : 'Przez'} ${Z(B)} → przesuń przecinek o ${n} ${odmiana(n, 'miejsce', 'miejsca', 'miejsc')} w ${o === '·' ? 'prawo' : 'lewo'}${o === ':' ? ' (brakujące miejsca uzupełnij zerami)' : ''}: ${Z(A)} ${o} ${Z(B)} = ${Z(wynik)}`];
  }
  if (o === '+' || o === '−') {
    const m = Math.max(mA, mB);
    const wyr = (x) => zapisz(x, 'dziesietny').replace(/^(\d+)$/, '$1,0').replace(/,(\d+)$/, (_, u) => ',' + u.padEnd(m, '0'));
    return [`Zapisz pod sobą, przecinek pod przecinkiem: ${wyr(A)} ${o} ${wyr(B)} = ${Z(wynik)}`,
      o === '+' ? `Sprawdzenie: ${Z(wynik)} − ${Z(B)} = ${Z(A)}` : `Sprawdzenie: ${Z(wynik)} + ${Z(B)} = ${Z(A)}`];
  }
  if (o === '·') {
    const a0 = A.razy(10 ** mA), b0 = B.razy(10 ** mB), m = mA + mB;
    const surowy = a0.razy(b0);
    const lines = [`Pomnóż bez przecinków: ${Z(a0)} · ${Z(b0)} = ${Z(surowy)}`];
    if (m > 0) {
      const zPrzecinkiem = (() => { const s = String(surowy.l).padStart(m + 1, '0'); return s.slice(0, -m) + ',' + s.slice(-m); })();
      lines.push(`Po przecinku ${m > 1 && m < 5 ? 'są' : 'jest'} razem ${m} ${odmiana(m, 'cyfra', 'cyfry', 'cyfr')}, więc oddziel je w wyniku: ${zPrzecinkiem}`);
      if (zPrzecinkiem !== Z(wynik)) lines.push(`Zera na końcu po przecinku można skreślić: ${zPrzecinkiem} = ${Z(wynik)}`);
    }
    return lines;
  }
  if (o === ':') {
    const lines = [];
    if (mB > 0) {
      const s = 10 ** mB;
      lines.push(`Przesuń przecinek w obu liczbach o ${mB} ${odmiana(mB, 'miejsce', 'miejsca', 'miejsc')} w prawo: ${Z(A)} : ${Z(B)} = ${Z(A.razy(s))} : ${Z(B.razy(s))}`);
      A = A.razy(s); B = B.razy(s);
    }
    lines.push(`${Z(A)} : ${Z(B)} = ${Z(wynik)}`, `Sprawdzenie: ${Z(wynik)} · ${Z(B)} = ${Z(A)}`);
    return lines;
  }
  return [];
}

// wyjaśnienie całego wyrażenia: dla jednego działania sposób liczenia, dla kilku — kolejność krok po kroku
export function wyjasnij(wyr, styl = 'auto') {
  const r = krokPoKroku(wyr, styl);
  if (r.kroki.length === 1 && r.kroki[0].czastki.length === 1) {
    const m = wyr.match(/^(.+?) ([+−·:]) (.+)$/) || wyr.match(/^(.+?)(\^)(\d+)$/);
    if (m && m[2] === '^') {
      const A = q(m[1].replace(/^\((.*)\)$/, '$1')), n = Number(m[3]);
      const t = m[1];
      if (n === 0) return [`Każda liczba różna od zera do potęgi 0 daje 1: ${wyr} = 1`];
      if (n === 1) return [`Potęga o wykładniku 1 to ta sama liczba: ${wyr} = ${t.replace(/^\((.*)\)$/, '$1')}`];
      const czynniki = Array(n).fill(t.replace(/^\((.*)\)$/, '$1')).join(' · ');
      const out = [`Potęga to mnożenie tej samej liczby ${n} razy: ${wyr} = ${czynniki}`];
      if (A.miejsca !== null && !A.calkowita && n === 2) out.push(...wyjasnijDziesietne('·', A, A));
      else out.push(`${czynniki} = ${zapisz(r.wynik, styl === 'auto' ? 'auto' : styl)}`);
      return out;
    }
    if (m) {
      const A = q(m[1]), B = q(m[3]);
      if (A && B) {
        if (A.calkowita && B.calkowita && r.wynik.calkowita && styl === 'auto') return wyjasnijCalkowite(m[2], A.l, B.l);
        if (styl === 'auto' && !/\//.test(wyr) && A.miejsca !== null && B.miejsca !== null && r.wynik.miejsca !== null && m[2] !== '^') return wyjasnijDziesietne(m[2], A, B);
      }
    }
    return [r.lancuch];
  }
  const out = ['Kolejność: nawiasy, potęgi, mnożenie i dzielenie, a na końcu dodawanie i odejmowanie (od lewej).'];
  for (const k of r.kroki) out.push(`${k.opis}: ${k.czastki.join(', ')}`);
  out.push(`Całość: ${r.lancuch}`);
  return out;
}

// ---------- ułamki zwykłe ----------
const U = (l, m) => `${l}/${m}`;
function mieszana(x, styl = 'mieszany') { return zapisz(x, styl); }
function naNiewlasciwy(tekst) {
  const m = String(tekst).match(/^(\d+) (\d+)\/(\d+)$/);
  return m ? { c: +m[1], l: +m[1] * +m[3] + +m[2], m: +m[3] } : null;
}

function losujUlamek(p) {
  const mian = los.wybierz(p.mianowniki || [2, 3, 4, 5, 6, 8, 10, 12]);
  const l = los.int(1, mian - 1);
  if (nwd(l, mian) !== 1 && !p.skracalne) return null;
  const c = p.mieszane ? los.int(0, p.mieszane) : 0;
  return { t: c ? `${c} ${l}/${mian}` : U(l, mian), v: new Q(c * mian + l, mian), c, l, m: mian };
}

function zadanieUlamki(p) {
  const o = los.wybierz(p.dzialania || ['+']);
  const A = losujUlamek(p), B = losujUlamek(p);
  if (!A || !B) return null;
  if (p.wspolnyMianownik && A.m !== B.m) return null;
  let wynik;
  try { wynik = { '+': () => A.v.dodaj(B.v), '−': () => A.v.odejmij(B.v), '·': () => A.v.razy(B.v), ':': () => A.v.przez(B.v) }[o](); } catch { return null; }
  if (wynik.ujemna || wynik.l === 0) return null;
  // poziom podręcznika: wspólny mianownik i mianownik wyniku nie za duże (liczby „ładnie się skracają”)
  if ((o === '+' || o === '−') && nww(A.m, B.m) > (p.maxWspolny || 1000)) return null;
  if (wynik.m > (p.maxMianownikWyniku || 1000)) return null;
  const d = `${A.t} ${o} ${B.t} = □`;
  const exp = [];
  let a = A, b = B;
  for (const x of [A, B]) if (x.c) exp.push(`Zamień liczbę mieszaną na ułamek: ${x.t} = ${U(x.l + x.c * x.m, x.m)}`);
  const al = A.c * A.m + A.l, bl = B.c * B.m + B.l;
  if (o === '+' || o === '−') {
    if (A.m === B.m) {
      const l = o === '+' ? al + bl : al - bl;
      exp.push(`Mianowniki są równe, więc ${o === '+' ? 'dodaj' : 'odejmij'} liczniki: ${U(al, A.m)} ${o} ${U(bl, B.m)} = ${U(l, A.m)}`);
      dokoncz(exp, l, A.m);
    } else {
      const wsp = nww(A.m, B.m);
      const la = al * (wsp / A.m), lb = bl * (wsp / B.m);
      exp.push(`Wspólny mianownik to ${wsp}.`);
      if (wsp !== A.m) exp.push(`Rozszerz pierwszy ułamek: ${U(al, A.m)} = ${U(la, wsp)}`);
      if (wsp !== B.m) exp.push(`Rozszerz drugi ułamek: ${U(bl, B.m)} = ${U(lb, wsp)}`);
      const l = o === '+' ? la + lb : la - lb;
      exp.push(`${U(la, wsp)} ${o} ${U(lb, wsp)} = ${U(l, wsp)}`);
      dokoncz(exp, l, wsp);
    }
  } else if (o === '·') {
    exp.push(`Licznik razy licznik, mianownik razy mianownik: ${U(al, A.m)} · ${U(bl, B.m)} = ${U(al * bl, A.m * B.m)}`);
    dokoncz(exp, al * bl, A.m * B.m);
  } else {
    exp.push(`Dzielenie to mnożenie przez odwrotność drugiego ułamka: ${U(al, A.m)} : ${U(bl, B.m)} = ${U(al, A.m)} · ${U(B.m, bl)}`);
    exp.push(`${U(al, A.m)} · ${U(B.m, bl)} = ${U(al * B.m, A.m * bl)}`);
    dokoncz(exp, al * B.m, A.m * bl);
  }
  return { d, a: mieszana(wynik), kind: 'ulamek', postac: 'najprostsza', exp };
}

function dokoncz(exp, l, m) {
  const g = nwd(l, m);
  if (g === m) { exp.push(`Licznik dzieli się przez mianownik, więc to liczba całkowita: ${U(l, m)} = ${l / m}`); return; }
  if (g > 1) { exp.push(`Skróć przez ${g}: ${U(l, m)} = ${U(l / g, m / g)}`); l /= g; m /= g; }
  if (l > m) exp.push(`Wyłącz całości: ${U(l, m)} = ${Math.floor(l / m)} ${l % m}/${m}`);
}

// ---------- rejestr generatorów ----------
export const GENERATORY = {
  // dowolne działanie z szablonu: { szablony: ["{a} · {b}"], zmienne: {...}, max?, min?, dowolneWyniki?: true, styl? }
  wyrazenie(p) {
    const szablon = los.wybierz(p.szablony || [p.szablon]);
    const wart = {};
    for (const [n, spec] of Object.entries(p.zmienne || {})) wart[n] = losujZmienna(spec, wart);
    const wyr = wypelnij(szablon, wart);
    let wynik;
    try { wynik = wartosc(wyr); } catch { return null; }
    if (p.ulamki) {
      // wynik i kroki jako ułamki zwykłe / liczby mieszane; wszystko po drodze nieujemne, mianowniki rozsądne
      let r;
      try { r = krokPoKroku(wyr, 'mieszany'); } catch { return null; }
      if (r.wartosci.some((v) => v.ujemna || v.m > (p.maxMianownik || 60))) return null;
      if (p.max != null && wynik.porownaj(p.max) > 0) return null;
      if (wynik.l === 0 && !p.zero) return null;
      return { d: wyr + ' = □', a: zapisz(wynik, 'mieszany'), kind: wynik.calkowita ? 'liczba' : 'ulamek', postac: 'najprostsza', exp: wyjasnij(wyr, 'mieszany') };
    }
    if (!p.dowolneWyniki && !lagodne(wyr) && !p.dziesietne) return null;
    if (p.dziesietne && (wynik.ujemna || wynik.miejsca === null || wynik.miejsca > (p.maxMiejsc ?? 4))) return null;
    if (p.max != null && wynik.porownaj(p.max) > 0) return null;
    if (p.min != null && wynik.porownaj(p.min) < 0) return null;
    let exp = wyjasnij(wyr);
    if (/\//.test(wyr) && wynik.miejsca !== null) {
      // działania mieszane: najpierw ułamki zwykłe → dziesiętne (te o skończonym rozwinięciu), potem rachunek
      const zamiany = [];
      const dz = wyr.replace(/(\d+ )?\d+\/\d+/g, (t) => { const v = q(t); if (v.miejsca === null) return t; const z = zapisz(v, 'dziesietny'); zamiany.push(`Zamień na ułamek dziesiętny: ${t} = ${z}`); return z; });
      if (zamiany.length && !/\//.test(dz)) exp = [...zamiany, ...wyjasnij(dz)];
    }
    return { d: wyr + ' = □', a: Z(wynik), kind: 'liczba', exp };
  },

  // rozkład na czynniki pierwsze: { pierwsze: [2,3,5,7,11], ile: [3,6], min, max } → „600 = □”
  czynniki(p) {
    const pula = p.pierwsze || [2, 3, 5, 7, 11, 13];
    const ile = los.int(...(p.ile || [3, 6]));
    const f = Array.from({ length: ile }, () => los.wybierz(pula)).sort((a, b) => a - b);
    const N = f.reduce((a, b) => a * b, 1);
    if (N < (p.min || 30) || N > (p.max || 3000)) return null;
    const W = (x) => Z(new Q(x));
    const exp = ['Dziel przez najmniejsze liczby pierwsze, dopóki nie zostanie 1:'];
    let r = N;
    for (const x of f) { exp.push(`${W(r)} : ${x} = ${W(r / x)}`); r /= x; }
    exp.push(`${W(N)} = ${f.join(' · ')}`);
    return { d: `${W(N)} = □`, a: f.join(' · '), kind: 'czynniki', exp };
  },

  // NWD albo NWW dwóch liczb: { co: ['nwd','nww'], pierwsze, wspolnych: [1,3], wlasnych: [1,2], max }
  nwdnww(p) {
    const co = los.wybierz([].concat(p.co || ['nwd', 'nww']));
    const pula = p.pierwsze || [2, 3, 5, 7];
    const wsp = Array.from({ length: los.int(...(p.wspolnych || [1, 3])) }, () => los.wybierz(pula));
    const fa = [...wsp, ...Array.from({ length: los.int(...(p.wlasnych || [1, 2])) }, () => los.wybierz(pula))].sort((x, y) => x - y);
    const fb = [...wsp, ...Array.from({ length: los.int(...(p.wlasnych || [1, 2])) }, () => los.wybierz(pula))].sort((x, y) => x - y);
    const a = fa.reduce((x, y) => x * y, 1), b = fb.reduce((x, y) => x * y, 1);
    if (a === b || a > (p.max || 400) || b > (p.max || 400)) return null;
    const g = nwd(a, b), l = (a / g) * b;
    if (co === 'nww' && l > (p.maxNww || 2000)) return null;
    // wspólne czynniki liczone z krotnością
    const reszta = [...fb];
    const wspolne = [];
    for (const x of fa) { const i = reszta.indexOf(x); if (i >= 0) { wspolne.push(x); reszta.splice(i, 1); } }
    const W = (x) => Z(new Q(x));
    const exp = [`Rozłóż obie liczby: ${W(a)} = ${fa.join(' · ')}`, `${W(b)} = ${fb.join(' · ')}`];
    if (co === 'nwd') {
      exp.push(wspolne.length ? `NWD to iloczyn wspólnych czynników: ${wspolne.join(' · ')}${wspolne.length > 1 ? ' = ' + W(g) : ''}` : 'Nie ma wspólnych czynników, więc NWD = 1.');
    } else {
      exp.push(`NWW: do rozkładu liczby ${W(a)} dopisz czynniki liczby ${W(b)}, których brakuje (${reszta.length ? reszta.join(', ') : 'żadnych'}).`);
      exp.push(`${[...fa, ...reszta].join(' · ')} = ${W(l)}`);
    }
    return { d: `${co.toUpperCase()}(${W(a)}, ${W(b)}) = □`, a: W(co === 'nwd' ? g : l), kind: 'liczba', exp };
  },

  // odwrotność: { mianowniki, calosci: [0,3], calkowite?: true } → „2 3/4 · □ = 1”
  odwrotnosc(p) {
    const W = (x) => Z(new Q(x));
    if (p.calkowite && los.int(0, 3) === 0) {
      const n = los.int(2, 12);
      return { d: `${n} · □ = 1`, a: `1/${n}`, kind: 'ulamek', exp: [`Liczba całkowita to ułamek o mianowniku 1: ${n} = ${n}/1`, `Odwróć licznik z mianownikiem: 1/${n}`, `Sprawdzenie: ${n} · 1/${n} = 1`] };
    }
    const m = los.wybierz(p.mianowniki || [2, 3, 4, 5, 7, 8, 9, 12]);
    const l = los.int(1, m - 1);
    if (nwd(l, m) !== 1) return null;
    const c = los.int(...(p.calosci || [0, 3]));
    const L = c * m + l;
    const t = c ? `${c} ${l}/${m}` : `${l}/${m}`;
    const exp = [];
    if (c) exp.push(`Zamień na ułamek niewłaściwy: ${t} = ${L}/${m}`);
    exp.push(`Odwróć licznik z mianownikiem: ${L}/${m} → ${m}/${L}`, `Sprawdzenie: ${L}/${m} · ${m}/${L} = 1`);
    return { d: `${t} · □ = 1`, a: `${m}/${L}`, kind: 'ulamek', exp };
  },

  // zamiana ułamków: { kierunek: 'naZwykly' | 'naDziesietny' | 'naOkresowy' }
  zamiana2(p) {
    const k = los.wybierz([].concat(p.kierunek || ['naZwykly', 'naDziesietny']));
    if (k === 'naZwykly') {
      const miejsca = los.int(1, p.maxMiejsc || 3);
      const sk = 10 ** miejsca;
      const n = los.int(1, sk * (p.calosci ? 3 : 1) - 1);
      if (n % 10 === 0) return null;
      const v = new Q(n, sk);
      if (v.m === sk && miejsca === 1 && los.int(0, 1)) return null;
      if (miejsca > 1 && v.m === sk) return null; // ma się dać skrócić, jak w podręczniku (0,06 = 3/50)
      const t = zapisz(v, 'dziesietny');
      const c = Math.floor(n / sk), r = n % sk;
      const g = nwd(r, sk);
      const exp = [`Po przecinku ${miejsca === 1 ? 'jest' : miejsca < 5 ? 'są' : 'jest'} ${miejsca} ${odmiana(miejsca, 'cyfra', 'cyfry', 'cyfr')}, więc mianownik to ${sk}: ${t} = ${c ? c + ' ' : ''}${r}/${sk}`];
      if (g > 1) exp.push(`Skróć przez ${g}: ${r}/${sk} = ${r / g}/${sk / g}`);
      return { d: `${t} = □`, a: zapisz(v, 'mieszany'), kind: 'ulamek', postac: 'najprostsza', exp };
    }
    if (k === 'naDziesietny') {
      const m = los.wybierz(p.mianowniki || [2, 4, 5, 8, 20, 25, 40, 50, 125, 250]);
      const l = los.int(1, m - 1);
      if (nwd(l, m) !== 1) return null;
      const v = new Q(l, m);
      const docel = 10 ** v.miejsca;
      return { d: `${l}/${m} = □`, a: zapisz(v, 'dziesietny'), kind: 'liczba',
        exp: [`Rozszerz do mianownika ${docel}: ${l}/${m} = ${l * (docel / m)}/${docel}`, `${l * (docel / m)}/${docel} = ${zapisz(v, 'dziesietny')}`] };
    }
    const m = los.wybierz(p.mianowniki || [3, 6, 9, 11, 12, 15, 18, 30]);
    const l = los.int(1, (p.calosci ? 3 : 1) * m - 1);
    if (nwd(l, m) !== 1) return null;
    const v = new Q(l, m);
    if (v.miejsca !== null || okresowy(l, m).length > 8) return null;
    const o = okresowy(l, m);
    return { d: `${l}/${m} = □`, a: o, kind: 'liczba', okres: true,
      exp: [`Podziel licznik przez mianownik: ${l} : ${m} = ${o.replace(/\((\d+)\)/, (_, x) => x + x + x)}…`, `Powtarza się ${o.match(/\((\d+)\)/)[1]}, więc zapisz okres w nawiasie: ${l}/${m} = ${o}`] };
  },

  // n-ta cyfra po przecinku liczby okresowej: { n: [8, 20] }
  cyfra(p) {
    const calosc = los.int(0, 9);
    const nieokres = los.int(0, 1) ? String(los.int(0, 9)) + (los.int(0, 1) ? String(los.int(0, 9)) : '') : '';
    const dl = los.int(1, 3);
    const okr = Array.from({ length: dl }, () => los.int(0, 9)).join('');
    if (new Set(okr).size === 1 && dl > 1) return null;
    if (okr === '0' || okr === '9') return null;
    const t = `${calosc},${nieokres}(${okr})`;
    const n = los.int(...(p.n || [8, 20]));
    const v = q(t);
    const c = cyfraPoPrzecinku(v.l, v.m, n);
    const poz = n - nieokres.length;
    const exp = [];
    if (nieokres.length) exp.push(`Przed okresem ${nieokres.length === 1 ? 'jest 1 cyfra' : `są ${nieokres.length} cyfry`} (${nieokres}), a potem powtarza się ${okr}.`);
    else exp.push(`Zaraz po przecinku powtarza się okres ${okr}.`);
    if (poz > 0) {
      const w = ((poz - 1) % dl) + 1;
      exp.push(`W okresie ${dl === 1 ? 'jest 1 cyfra' : `są ${dl} cyfry`}. Miejsce ${poz} w okresie to ${w}. cyfra okresu (reszta z dzielenia ${poz} przez ${dl} to ${poz % dl}).`);
    }
    exp.push(`Na ${n}. miejscu po przecinku stoi ${c}.`);
    return { q: `Jaka cyfra stoi na ${n}. miejscu po przecinku w liczbie ${t}?`, a: String(c), kind: 'liczba', oblicz: { cyfra: [t, n] }, exp };
  },

  // czy rozwinięcie dziesiętne jest skończone: { mianowniki }
  skonczone(p) {
    const cel = los.int(0, 1); // pół na pół: skończone / nieskończone
    const m = los.wybierz(cel ? [8, 16, 20, 25, 40, 50, 125, 48, 150] : [6, 7, 12, 15, 21, 24, 30, 35, 48, 150]);
    const l = los.int(1, m - 1);
    const g = nwd(l, m);
    const mm = m / g;
    let x = mm; const f = [];
    for (let d = 2; x > 1; d++) while (x % d === 0) { f.push(d); x /= d; }
    const sk = f.every((d) => d === 2 || d === 5);
    if (sk !== !!cel) return null;
    const exp = [];
    if (g > 1) exp.push(`Najpierw skróć: ${l}/${m} = ${l / g}/${mm}`);
    exp.push(mm === 1 ? 'To liczba całkowita.' : `Rozłóż mianownik: ${mm} = ${f.join(' · ')}`,
      sk ? 'W mianowniku są tylko dwójki i piątki, więc rozwinięcie jest skończone.' : 'W mianowniku jest liczba pierwsza inna niż 2 i 5, więc rozwinięcie jest nieskończone (okresowe).');
    return { q: `Jakie rozwinięcie dziesiętne ma ułamek ${l}/${m}?`, a: sk ? 'skończone' : 'nieskończone', kind: 'wybor', choices: ['skończone', 'nieskończone'], oblicz: { skonczone: [l, m] }, exp };
  },

  // porównanie ułamka zwykłego z dziesiętnym (także okresowym): „2/9 □ 0,22”
  porownajUlamek(p) {
    const m = los.wybierz(p.mianowniki || [3, 4, 6, 7, 8, 9, 11, 12, 15]);
    const l = los.int(1, (p.calosci ? 3 : 1) * m - 1);
    if (nwd(l, m) !== 1) return null;
    const v = new Q(l, m);
    const miejsca = los.int(1, 3);
    const sk = 10 ** miejsca;
    const blisko = Math.round((l / m) * sk) + los.int(-1, 1);
    if (blisko <= 0) return null;
    const d = new Q(blisko, sk);
    const td = zapisz(d, 'dziesietny');
    const tu = `${l}/${m}`;
    const znak = { '-1': '<', 0: '=', 1: '>' }[v.porownaj(d)];
    const roz = zapisz(v, v.miejsca === null ? 'okresowy' : 'dziesietny');
    return { d: `${tu} □ ${td}`, a: znak, kind: 'wybor', choices: ['<', '=', '>'],
      exp: [`Zamień ułamek zwykły na dziesiętny: ${tu} = ${roz}`, `Porównuj cyfra po cyfrze: ${roz} ${znak} ${td}`] };
  },

  // dzielenie z resztą: { dzielna: [min,max], dzielnik: [min,max], zReszta?: true }
  reszta(p) {
    const b = p.dzielniki ? los.wybierz(p.dzielniki) : los.int(...(p.dzielnik || [2, 9]));
    const a = los.int(...(p.dzielna || [10, 99]));
    const iloraz = Math.floor(a / b), r = a % b;
    if (p.zReszta !== false && r === 0) return null;
    if (iloraz === 0) return null;
    const W = (x) => Z(new Q(x));
    return {
      d: `${W(a)} : ${b} = □ r. □`, a: `${W(iloraz)} r ${r}`, kind: 'reszta',
      exp: [`Ile razy ${b} mieści się w ${W(a)}? ${W(iloraz)} ${odmiana(iloraz, 'raz', 'razy', 'razy')}: ${W(iloraz)} · ${b} = ${W(iloraz * b)}`,
        `Następna jest już za duża: ${W(iloraz + 1)} · ${b} = ${W((iloraz + 1) * b)}`,
        `Reszta to różnica: ${W(a)} − ${W(iloraz * b)} = ${r}`,
        `Reszta (${r}) musi być mniejsza od dzielnika (${b}).`,
        `Sprawdzenie: ${W(iloraz)} · ${b} + ${r} = ${W(a)}`],
    };
  },

  // brakująca liczba w działaniu: { dzialania: ['+','−','·',':'], a: [min,max], b: [min,max] }
  okienko(p) {
    const o = los.wybierz(p.dzialania || ['+', '−', '·', ':']);
    let a = los.int(...(p.a || [2, 50])), b = los.int(...(p.b || [2, 50]));
    if (o === ':') { a = a * b; }
    if (o === '−' && b > a) [a, b] = [b, a];
    const c = { '+': a + b, '−': a - b, '·': a * b, ':': a / b }[o];
    const W = (x) => Z(new Q(x));
    const gdzie = los.int(0, 1);
    const szukana = gdzie ? b : a;
    const d = gdzie ? `${W(a)} ${o} □ = ${W(c)}` : `□ ${o} ${W(b)} = ${W(c)}`;
    const jak = {
      '+': [`Brakuje składnika, więc od sumy odejmij znany składnik: ${W(c)} − ${W(gdzie ? a : b)} = ${W(szukana)}`],
      '−': gdzie ? [`Brakuje odjemnika: od odjemnej odejmij różnicę: ${W(a)} − ${W(c)} = ${W(b)}`]
        : [`Brakuje odjemnej: do różnicy dodaj odjemnik: ${W(c)} + ${W(b)} = ${W(a)}`],
      '·': [`Brakuje czynnika, więc iloczyn podziel przez znany czynnik: ${W(c)} : ${W(gdzie ? a : b)} = ${W(szukana)}`],
      ':': gdzie ? [`Brakuje dzielnika: dzielną podziel przez iloraz: ${W(a)} : ${W(c)} = ${W(b)}`]
        : [`Brakuje dzielnej: iloraz pomnóż przez dzielnik: ${W(c)} · ${W(b)} = ${W(a)}`],
    }[o];
    return { d, a: W(szukana), kind: 'liczba', exp: [...jak, `Sprawdzenie: ${W(a)} ${o} ${W(b)} = ${W(c)}`] };
  },

  // porównywanie dwóch wyrażeń: { lewa: {wyrazenie…}, prawa: {wyrazenie…} } — szablony jak w „wyrazenie”
  porownaj(p) {
    const L = GENERATORY.wyrazenie({ ...p.lewa, dowolneWyniki: true }), P = GENERATORY.wyrazenie({ ...p.prawa, dowolneWyniki: true });
    if (!L || !P) return null;
    const lw = L.d.replace(' = □', ''), pw = P.d.replace(' = □', '');
    const vl = wartosc(lw), vp = wartosc(pw);
    const znak = { '-1': '<', 0: '=', 1: '>' }[vl.porownaj(vp)];
    const ll = krokPoKroku(lw).lancuch, pl = krokPoKroku(pw).lancuch;
    return {
      d: `${lw} □ ${pw}`, a: znak, kind: 'wybor', choices: ['<', '=', '>'],
      exp: [`Lewa strona: ${ll}`, `Prawa strona: ${pl}`, `Porównaj wyniki: ${Z(vl)} ${znak} ${Z(vp)}`],
    };
  },

  // ułamki zwykłe: { dzialania: ['+','−','·',':'], mianowniki: [...], mieszane?: maks. całości, wspolnyMianownik?: true }
  ulamki: (p) => zadanieUlamki(p),

  // skracanie: { mianowniki: [...], razy: [2..9] } → „12/18 = □”
  skracanie(p) {
    const m = los.wybierz(p.mianowniki || [3, 4, 5, 6, 7, 8, 9, 10]);
    const l = los.int(1, m - 1);
    if (nwd(l, m) !== 1) return null;
    const k = los.int(...(p.razy || [2, 9]));
    return {
      d: `${U(l * k, m * k)} = □`, a: U(l, m), kind: 'ulamek', postac: 'najprostsza',
      exp: [`Szukasz największej liczby, przez którą dzielą się licznik i mianownik. Tutaj to ${k}.`,
        `${l * k} : ${k} = ${l}`, `${m * k} : ${k} = ${m}`, `${U(l * k, m * k)} = ${U(l, m)}`],
    };
  },

  // zamiana: { kierunek: 'naMieszana' | 'naNiewlasciwy', mianowniki, calosci: [min,max] }
  zamiana(p) {
    const m = los.wybierz(p.mianowniki || [2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const l = los.int(1, m - 1);
    if (nwd(l, m) !== 1) return null;
    const c = los.int(...(p.calosci || [1, 9]));
    const L = c * m + l;
    if (los.wybierz([].concat(p.kierunek || 'naMieszana')) === 'naMieszana') {
      return {
        d: `${U(L, m)} = □`, a: `${c} ${l}/${m}`, kind: 'ulamek', postac: 'najprostsza',
        exp: [`Ile razy ${m} mieści się w ${L}? ${c} razy: ${c} · ${m} = ${c * m}`, `Zostaje: ${L} − ${c * m} = ${l}`,
          `${U(L, m)} = ${c} ${l}/${m}`],
      };
    }
    return {
      d: `${c} ${l}/${m} = □`, a: U(L, m), kind: 'ulamek', postac: 'niewlasciwy',
      exp: [`Całości razy mianownik plus licznik: ${c} · ${m} + ${l} = ${L}`, `Mianownik zostaje: ${c} ${l}/${m} = ${U(L, m)}`],
    };
  },

  // o ile więcej / ile razy więcej: { rodzaj: 'oIle' | 'ileRazy', a: [min,max], b: [min,max] }
  porownanieRoznicowe(p) {
    const rodzaj = los.wybierz([].concat(p.rodzaj || ['oIle', 'ileRazy']));
    const W = (x) => Z(new Q(x));
    if (rodzaj === 'oIle') {
      const b = los.int(...(p.b || [10, 90])), r = los.int(...(p.a || [5, 90]));
      const a = b + r;
      const wiecej = los.int(0, 1);
      return {
        q: wiecej ? `O ile ${W(a)} jest większe od ${W(b)}?` : `O ile ${W(b)} jest mniejsze od ${W(a)}?`,
        a: W(r), kind: 'liczba', w: `${W(a)} − ${W(b)}`,
        exp: [`„O ile” to różnica, więc odejmujesz: ${W(a)} − ${W(b)} = ${W(r)}`, `Sprawdzenie: ${W(b)} + ${W(r)} = ${W(a)}`],
      };
    }
    const b = los.int(...(p.b || [2, 9])), k = los.int(...(p.a || [2, 9]));
    const a = b * k;
    const wiecej = los.int(0, 1);
    return {
      q: wiecej ? `Ile razy ${W(a)} jest większe od ${W(b)}?` : `Ile razy ${W(b)} jest mniejsze od ${W(a)}?`,
      a: W(k), kind: 'liczba', w: `${W(a)} : ${W(b)}`,
      exp: [`„Ile razy” to iloraz, więc dzielisz: ${W(a)} : ${W(b)} = ${W(k)}`, `Sprawdzenie: ${W(b)} · ${W(k)} = ${W(a)}`],
    };
  },
};

// domyślne krótkie „Jak to zrobić?” dla typów (zestaw może podać własne pole „jak”)
export const JAK = {
  reszta: { intro: 'Dzielenie z resztą: sprawdzasz, ile razy dzielnik mieści się w liczbie, a to, co zostaje, to reszta.',
    zasady: [['Reszta jest zawsze mniejsza od dzielnika', 'Jeśli wyszła większa albo równa, dzielnik mieści się jeszcze raz.'],
      ['Sprawdzenie', 'iloraz · dzielnik + reszta = dzielna']] },
  ulamki: { intro: 'Dodawanie i odejmowanie: najpierw wspólny mianownik. Mnożenie: licznik razy licznik, mianownik razy mianownik. Dzielenie: mnożysz przez odwrotność.',
    zasady: [['Wynik w najprostszej postaci', 'Skróć ułamek i wyłącz całości, np. 14/8 = 7/4 = 1 3/4.']] },
  skracanie: { intro: 'Skracanie to dzielenie licznika i mianownika przez tę samą liczbę. Wartość ułamka się nie zmienia.' },
  zamiana: { intro: 'Ułamek niewłaściwy ma licznik większy od mianownika. Całości wyłączasz, dzieląc licznik przez mianownik.' },
  okienko: { intro: 'Okienko to brakująca liczba. Ustal, czym jest (składnikiem, odjemną, czynnikiem, dzielną…) i użyj działania odwrotnego.' },
  porownaj: { intro: 'Policz obie strony osobno, a potem wybierz znak: < (mniejsze), > (większe) albo =.' },
  porownanieRoznicowe: { intro: '„O ile więcej / mniej” → odejmujesz. „Ile razy więcej / mniej” → dzielisz.' },
};

// jedno nowe zadanie bloku, którego jeszcze nie było w tej rundzie
export function nastepneZadanie(gen, uzyte = new Set()) {
  const f = GENERATORY[gen.typ];
  if (!f) throw new Error('Nieznany generator: ' + gen.typ);
  for (let i = 0; i < 400; i++) {
    const z = f(gen);
    if (!z) continue;
    const klucz = (z.q || '') + '|' + (z.d || '');
    if (uzyte.has(klucz)) continue;
    uzyte.add(klucz);
    return { ...z, klucz };
  }
  return null;
}
