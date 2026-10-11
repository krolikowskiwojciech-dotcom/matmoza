// Generatory zadań. Każdy zwraca zadanie w jednym formacie:
//   { q?: polecenie/treść, d?: działanie z okienkiem □, a: odpowiedź, kind, choices?, postac?, exp: [kroki], w?: ukryte wyrażenie }
// kind: 'liczba' | 'ulamek' | 'reszta' | 'wybor'. Wyjaśnienia piszemy tak, żeby każde „=” było prawdą:
// etykieta kończy się dwukropkiem bez spacji przed nim („Policz bez zer: 72 · 3 = 216”), dzielenie ma spacje („18 : 6”).
// Narzędzie `node narzedzia/matmoza.mjs sprawdz` sprawdza to niezależną wyrocznią.

import { Q, q, zapisz, nwd, nww, odmiana } from './liczby.js';
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
    const wyr = spec.replace(/^=\s*/, '').replace(/\b([a-z])\b/g, (_, n) => Z(wart[n]));
    return wartosc(wyr);
  }
  if (spec.lista) return q(los.wybierz(spec.lista));
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
    return Z(wart[n]);
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
      lines.push(`Po przecinku jest razem ${m} ${odmiana(m, 'cyfra', 'cyfry', 'cyfr')}, więc oddziel je w wyniku: ${zPrzecinkiem}`);
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
export function wyjasnij(wyr) {
  const r = krokPoKroku(wyr);
  if (r.kroki.length === 1 && r.kroki[0].czastki.length === 1) {
    const m = wyr.match(/^(.+?) ([+−·:]) (.+)$/) || wyr.match(/^(.+?)(\^)(\d+)$/);
    if (m) {
      const A = q(m[1]), B = q(m[3]);
      if (A && B) {
        if (A.calkowita && B.calkowita) return wyjasnijCalkowite(m[2], A.l, B.l);
        if (A.miejsca !== null && B.miejsca !== null && r.wynik.miejsca !== null && m[2] !== '^') return wyjasnijDziesietne(m[2], A, B);
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
    if (!p.dowolneWyniki && !lagodne(wyr) && !p.dziesietne) return null;
    if (p.dziesietne && (wynik.ujemna || wynik.miejsca === null || wynik.miejsca > (p.maxMiejsc ?? 4))) return null;
    if (p.max != null && wynik.porownaj(p.max) > 0) return null;
    if (p.min != null && wynik.porownaj(p.min) < 0) return null;
    return { d: wyr + ' = □', a: Z(wynik), kind: 'liczba', exp: wyjasnij(wyr) };
  },

  // dzielenie z resztą: { dzielna: [min,max], dzielnik: [min,max], zReszta?: true }
  reszta(p) {
    const b = los.int(...(p.dzielnik || [2, 9]));
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
    if ((p.kierunek || 'naMieszana') === 'naMieszana') {
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
