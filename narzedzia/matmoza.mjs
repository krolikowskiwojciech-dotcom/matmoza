#!/usr/bin/env node
// Narzędzie Matmozy.
//   node narzedzia/matmoza.mjs sprawdz [id]   — wyrocznia: każde zadanie i każde „=” w wyjaśnieniach (blokuje publikację)
//   node narzedzia/matmoza.mjs katalog         — sprawdza wszystko i przebudowuje zestawy/indeks.json
//   node narzedzia/matmoza.mjs wyniki [profil] — ostatnie próby dzieci z prywatnego repo matmoza-dane (przez gh)
//
// Wyrocznia jest celowo NIEZALEŻNA od kodu aplikacji: ma własny rozbiór wyrażeń na BigInt i liczy
// z tego, co widzi dziecko (działanie z okienkiem po wstawieniu odpowiedzi), a nie z wnętrza generatora.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nastepneZadanie, GENERATORY } from '../js/generatory.js';
import { ocen, normuj } from '../js/sprawdz.js';

const KORZEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZESTAWY = path.join(KORZEN, 'zestawy');
const REPO_DANYCH = 'krolikowskiwojciech-dotcom/matmoza-dane';
const PROFILE = [
  { id: 'julek', imie: 'Julek', klasa: 6, znak: 'J' },
  { id: 'aniela', imie: 'Aniela', klasa: 4, znak: 'A' },
];
const LOSOWAN = 1500;

// ---------- niezależna arytmetyka (BigInt) ----------
const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
function F(l, m = 1n) {
  if (m === 0n) throw new Error('dzielenie przez zero');
  if (m < 0n) { l = -l; m = -m; }
  const g = bgcd(l, m) || 1n;
  return { l: l / g, m: m / g };
}
const op = {
  '+': (a, b) => F(a.l * b.m + b.l * a.m, a.m * b.m),
  '−': (a, b) => F(a.l * b.m - b.l * a.m, a.m * b.m),
  '·': (a, b) => F(a.l * b.l, a.m * b.m),
  ':': (a, b) => F(a.l * b.m, a.m * b.l),
};
const cmp = (a, b) => { const d = a.l * b.m - b.l * a.m; return d > 0n ? 1 : d < 0n ? -1 : 0; };

function liczba(tok) {
  // okresowy: 0,(3) = 0 + 3/9; 0,58(3) = 0,58 + 3/900
  let m = tok.replace(/\u00a0/g, '').match(/^(\d+),(\d*)\((\d+)\)$/);
  if (m) {
    const sk = 10n ** BigInt(m[2].length);
    const staly = F(BigInt(m[1] + m[2]), sk);
    return op['+'](staly, F(BigInt(m[3]), sk * (10n ** BigInt(m[3].length) - 1n)));
  }
  m = tok.match(/^(\d+) (\d+)\/(\d+)$/);
  if (m) return op['+'](F(BigInt(m[1])), F(BigInt(m[2]), BigInt(m[3])));
  m = tok.match(/^(\d+)\/(\d+)$/);
  if (m) return F(BigInt(m[1]), BigInt(m[2]));
  const s = tok.replace(/ /g, '');
  m = s.match(/^(\d+)(?:,(\d+))?$/);
  if (!m) throw new Error('nie liczba: ' + tok);
  return F(BigInt(m[1] + (m[2] || '')), 10n ** BigInt((m[2] || '').length));
}

function wylicz(tekst) {
  const t = [];
  const re = /\s*(\d+,\d*\(\d+\)|\d+ \d+\/\d+|\d+\/\d+|\d{1,3}(?: \d{3})+(?:,\d+)?|\d+(?:,\d+)?|[+−·:()^])/y;
  const s = tekst.replace(/-/g, '−');
  let i = 0;
  while (s.slice(i).trim()) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) throw new Error('wyrocznia nie rozumie: ' + tekst);
    t.push(m[1]); i = re.lastIndex;
  }
  let p = 0;
  const pierwiastek = () => {
    let w;
    const tok = t[p++];
    if (tok === '(') { w = suma(); if (t[p++] !== ')') throw new Error('nawias: ' + tekst); }
    else w = liczba(tok);
    while (t[p] === '^') { p++; const n = Number(t[p++]); let r = F(1n); for (let k = 0; k < n; k++) r = op['·'](r, w); w = r; }
    return w;
  };
  const iloczyn = () => { let w = pierwiastek(); while (t[p] === '·' || t[p] === ':') { const o = t[p++]; w = op[o](w, pierwiastek()); } return w; };
  const suma = () => { let w = iloczyn(); while (t[p] === '+' || t[p] === '−') { const o = t[p++]; w = op[o](w, iloczyn()); } return w; };
  const w = suma();
  if (p !== t.length) throw new Error('nadmiar: ' + tekst);
  return w;
}

const CZYSTA = /^[\d\s ,/+−·:()^]+$/;

// sprawdza jedną linię wyjaśnienia: zwraca [liczbaSprawdzonych, błędy[]]
function sprawdzLinie(linia) {
  const bledy = [];
  let ile = 0;
  const m = [...linia.matchAll(/\S: /g)].pop();
  let mat = m ? linia.slice(m.index + 3) : linia;
  mat = mat.replace(/[.!]$/, '');
  for (const kawalek of mat.split(/→|, (?=\d)/)) {
    // reszta: „A : B = Q r. R”
    const rr = kawalek.trim().match(/^(.+?) : (.+?) = (.+?) r\. (.+)$/);
    if (rr && [rr[1], rr[2], rr[3], rr[4]].every((x) => CZYSTA.test(x))) {
      const [A, B, Qv, R] = [rr[1], rr[2], rr[3], rr[4]].map(wylicz);
      ile++;
      if (cmp(op['+'](op['·'](Qv, B), R), A) !== 0 || cmp(R, B) >= 0) bledy.push('fałszywe dzielenie z resztą: ' + kawalek);
      continue;
    }
    const czesci = kawalek.split(/ ([=<>]) /);
    for (let k = 0; k + 2 < czesci.length; k += 2) {
      const L = czesci[k].trim(), znak = czesci[k + 1], P = czesci[k + 2].trim();
      if (!CZYSTA.test(L) || !CZYSTA.test(P) || !/\d/.test(L) || !/\d/.test(P)) continue;
      let c;
      try { c = cmp(wylicz(L), wylicz(P)); } catch (e) { bledy.push(`nie da się policzyć „${L} ${znak} ${P}”: ${e.message}`); continue; }
      ile++;
      const dobrze = znak === '=' ? c === 0 : znak === '<' ? c < 0 : c > 0;
      if (!dobrze) bledy.push(`FAŁSZ: ${L} ${znak} ${P}`);
    }
  }
  return [ile, bledy];
}

const bnwd = (a, b) => (b ? bnwd(b, a % b) : a);
const pierwsza = (n) => { if (n < 2n) return false; for (let d = 2n; d * d <= n; d++) if (n % d === 0n) return false; return true; };

// osobne wyrocznie dla zadań, których nie da się zapisać jednym wyrażeniem
function wyroczniaSpecjalna(cz) {
  const nw = cz.d?.match(/^(NWD|NWW)\((\d+), (\d+)\) = □$/);
  if (nw) {
    const a = BigInt(nw[2]), b = BigInt(nw[3]);
    const g = bnwd(a, b);
    const ok = nw[1] === 'NWD' ? g : (a / g) * b;
    return cmp(F(ok), liczba(cz.a)) === 0 ? null : `${nw[1]}(${a}, ${b}) = ${ok}, a odpowiedź ${cz.a}`;
  }
  if (cz.oblicz?.cyfra) {
    const [t, n] = cz.oblicz.cyfra;
    const v = liczba(t);
    let r = v.l % v.m, d = 0n;
    for (let i = 0; i < n; i++) { r *= 10n; d = r / v.m; r %= v.m; }
    return String(d) === cz.a ? null : `${n}. cyfra po przecinku ${t} to ${d}, a odpowiedź ${cz.a}`;
  }
  if (cz.oblicz?.skonczone) {
    const [l, m] = cz.oblicz.skonczone.map(BigInt);
    let mm = m / bnwd(l, m);
    while (mm % 2n === 0n) mm /= 2n;
    while (mm % 5n === 0n) mm /= 5n;
    const ok = mm === 1n ? 'skończone' : 'nieskończone';
    return ok === cz.a ? null : `${l}/${m} ma rozwinięcie ${ok}`;
  }
  if (cz.kind === 'czynniki') {
    const f = cz.a.split('·').map((x) => BigInt(x.trim()));
    if (!f.every(pierwsza)) return `nie wszystkie czynniki są pierwsze: ${cz.a}`;
    return undefined; // iloczyn sprawdzi zwykła wyrocznia (podstawienie w okienko)
  }
  if (cz.kind === 'wybor' && cz.w && /^\d/.test(cz.a)) {
    return cmp(wylicz(cz.w), liczba(cz.a.replace(/\s*(zł|m|kg|l|dag|g)$/, '').replace(/ /g, ''))) === 0 ? null : `odpowiedź ${cz.a} ≠ ${cz.w}`;
  }
  return undefined;
}

// wyrocznia odpowiedzi: wstawia odpowiedź w okienko i sprawdza prawdziwość
function wyroczniaOdpowiedzi(cz) {
  const sp = wyroczniaSpecjalna(cz);
  if (sp !== undefined) return sp;
  if (cz.w) {
    return cmp(wylicz(cz.w), wylicz(cz.a.replace('−', ''))) === 0 && !cz.a.startsWith('−') ? null : `odpowiedź ${cz.a} ≠ ${cz.w}`;
  }
  if (!cz.d || !cz.d.includes('□')) return 'BRAK WYROCZNI';
  if (cz.kind === 'reszta') {
    const m = cz.d.match(/^(.+) : (.+) = □ r\. □$/);
    const [Qt, Rt] = cz.a.split(' r ');
    const [A, B, Qv, R] = [m[1], m[2], Qt, Rt].map(wylicz);
    return cmp(op['+'](op['·'](Qv, B), R), A) === 0 && cmp(R, B) < 0 ? null : `zła reszta ${cz.a} dla ${cz.d}`;
  }
  if (cz.kind === 'wybor') {
    const [L, P] = cz.d.split(' □ ');
    if (!P) return 'BRAK WYROCZNI';
    const c = cmp(wylicz(L), wylicz(P));
    const znak = c < 0 ? '<' : c > 0 ? '>' : '=';
    return znak === cz.a ? null : `znak ${cz.a}, a powinien być ${znak} w ${cz.d}`;
  }
  const rownanie = cz.d.replace('□', cz.a);
  const strony = rownanie.split(' = ');
  if (strony.length !== 2) return 'BRAK WYROCZNI';
  return cmp(wylicz(strony[0]), wylicz(strony[1])) === 0 ? null : `nieprawda: ${rownanie}`;
}

const ZLE_SLOWA = /undefined|NaN|null|\[object|Infinity/;

function zlaOdpowiedz(cz) {
  if (cz.kind === 'wybor') return cz.choices.find((c) => c !== cz.a);
  if (cz.kind === 'reszta') { const [a, r] = cz.a.split(' r '); return [a, String(Number(r) + 1)]; }
  if (cz.kind === 'czynniki') return cz.a + ' · 2';
  return cz.a === '1' ? '2' : '1';
}

function sprawdzZadanie(z, gdzie, staty) {
  const bledy = [];
  const zad = normuj(z);
  const teksty = JSON.stringify(zad);
  if (ZLE_SLOWA.test(teksty)) bledy.push('podejrzany tekst (undefined/NaN…)');
  if (/\d\.\d/.test([zad.q || '', ...zad.czesci.map((c) => `${c.d || ''} ${c.a}`)].join(' '))) bledy.push('kropka zamiast przecinka w liczbie');
  for (const cz of zad.czesci) {
    if (!cz.a) { bledy.push('brak odpowiedzi'); continue; }
    if (!['liczba', 'ulamek', 'reszta', 'wybor', 'czynniki'].includes(cz.kind || 'liczba')) bledy.push('nieznany rodzaj odpowiedzi: ' + cz.kind);
    if (cz.kind === 'wybor' && !cz.choices?.includes(cz.a)) bledy.push('odpowiedzi nie ma wśród wyborów');
    if (!ocen(cz, cz.kind === 'reszta' ? cz.a.split(' r ') : cz.a).ok) bledy.push(`aplikacja NIE przyjmuje poprawnej odpowiedzi „${cz.a}”`);
    if (ocen(cz, zlaOdpowiedz(cz)).ok) bledy.push('aplikacja przyjmuje złą odpowiedź');
    try {
      const w = wyroczniaOdpowiedzi(cz);
      if (w === 'BRAK WYROCZNI') staty.bezWyroczni.add(gdzie + ': ' + (zad.q || cz.d || cz.e));
      else if (w) bledy.push(w);
    } catch (e) { bledy.push('wyrocznia: ' + e.message); }
    if (!cz.exp?.length) bledy.push('brak wyjaśnienia po błędzie');
    for (const linia of cz.exp || []) {
      const [ile, bl] = sprawdzLinie(linia);
      staty.rownan += ile;
      bledy.push(...bl);
    }
  }
  return bledy.map((b) => `${gdzie}: ${b}  [${zad.q || ''} ${zad.czesci.map((c) => c.d || c.e || '').join(' | ')}]`);
}

export function sprawdzZestaw(z) {
  const bledy = [];
  const staty = { zadan: 0, rownan: 0, bezWyroczni: new Set() };
  for (const pole of ['id', 'tytul', 'dla', 'bloki']) if (!z[pole]) bledy.push(`${z.id}: brak pola „${pole}”`);
  for (const p of [].concat(z.dla || [])) if (!PROFILE.some((x) => x.id === p)) bledy.push(`${z.id}: nieznany profil „${p}”`);
  const idBlokow = new Set();
  for (const b of z.bloki || []) {
    const gdzie = `${z.id}/${b.id}`;
    if (!b.id || idBlokow.has(b.id)) bledy.push(`${gdzie}: brak albo powtórzone id bloku`);
    idBlokow.add(b.id);
    if (!b.tytul) bledy.push(`${gdzie}: brak tytułu`);
    const stale = b.zadania || [];
    stale.forEach((zad, i) => { staty.zadan++; bledy.push(...sprawdzZadanie(zad, `${gdzie}#${i + 1}`, staty)); });
    if (b.generator) {
      if (!GENERATORY[b.generator.typ]) { bledy.push(`${gdzie}: nieznany generator ${b.generator.typ}`); continue; }
      const uzyte = new Set();
      let pusto = 0;
      for (let i = 0; i < LOSOWAN; i++) {
        const zad = nastepneZadanie(b.generator, uzyte);
        if (!zad) { pusto++; if (pusto > 3) break; continue; }
        staty.zadan++;
        bledy.push(...sprawdzZadanie(zad, `${gdzie}~${i + 1}`, staty));
        if (bledy.length > 40) break;
      }
      const ile = b.ile || 10;
      if (uzyte.size < ile * 3) bledy.push(`${gdzie}: generator daje tylko ${uzyte.size} różnych zadań — za mało na ${ile} w rundzie bez powtórek (minimum ${ile * 3})`);
      staty.pula = (staty.pula || 0) + uzyte.size;
    } else if (!stale.length) bledy.push(`${gdzie}: blok bez zadań i bez generatora`);
    else if ((b.ile || stale.length) > stale.length) bledy.push(`${gdzie}: ile=${b.ile}, a zadań jest ${stale.length}`);
  }
  return { bledy, staty };
}

function wczytajZestawy() {
  return fs.readdirSync(ZESTAWY).filter((f) => f.endsWith('.json') && f !== 'indeks.json').sort()
    .map((f) => {
      const z = JSON.parse(fs.readFileSync(path.join(ZESTAWY, f), 'utf8'));
      if (z.id + '.json' !== f) throw new Error(`${f}: id „${z.id}” musi być takie jak nazwa pliku`);
      return z;
    });
}

function sprawdzWszystko(tylko) {
  let wszystkieBledy = [];
  const zestawy = wczytajZestawy().filter((z) => !tylko || z.id === tylko);
  for (const z of zestawy) {
    const { bledy, staty } = sprawdzZestaw(z);
    const ok = bledy.length === 0;
    console.log(`${ok ? '✓' : '✗'} ${z.id}: ${staty.zadan} zadań, ${staty.rownan} równań w wyjaśnieniach sprawdzonych${staty.pula ? `, pula generatorów ${staty.pula}` : ''}`);
    for (const b of staty.bezWyroczni) console.log(`   ! bez wyroczni (przeczytaj ręcznie): ${b}`);
    for (const b of bledy.slice(0, 25)) console.log('   ✗ ' + b);
    wszystkieBledy = wszystkieBledy.concat(bledy);
  }
  return { zestawy, bledy: wszystkieBledy };
}

const [, , cmd = 'sprawdz', arg] = process.argv;
if (cmd === 'sprawdz' || cmd === 'katalog') {
  const { zestawy, bledy } = sprawdzWszystko(cmd === 'sprawdz' ? arg : null);
  if (bledy.length) { console.error(`\nBŁĘDY: ${bledy.length}. Nie publikuj, dopóki nie znikną.`); process.exit(1); }
  if (cmd === 'katalog') {
    const indeks = {
      profile: PROFILE,
      zestawy: zestawy.map((z) => ({
        id: z.id, tytul: z.tytul, opis: z.opis || '', dla: [].concat(z.dla), termin: z.termin || null, dodano: z.dodano || null,
        kategoria: z.kategoria || (z.sprawdzian ? 'sprawdzian' : null), przyklad: !!z.przyklad, ikona: z.ikona || null, kolor: z.kolor || null, bloki: z.bloki.length, zadan: z.bloki.reduce((n, b) => n + (b.ile || b.zadania?.length || 10), 0),
      })).sort((a, b) => String(b.dodano).localeCompare(String(a.dodano))),
    };
    fs.writeFileSync(path.join(ZESTAWY, 'indeks.json'), JSON.stringify(indeks, null, 2) + '\n');
    console.log(`\nindeks.json: ${indeks.zestawy.length} zestawów.`);
  } else console.log('\nWszystko się zgadza.');
} else if (cmd === 'wyniki') {
  for (const p of PROFILE.filter((x) => !arg || x.id === arg)) {
    let dane;
    try {
      const out = execFileSync('gh', ['api', `repos/${REPO_DANYCH}/contents/profile/${p.id}.json`, '--jq', '.content'], { encoding: 'utf8' });
      dane = JSON.parse(Buffer.from(out, 'base64').toString('utf8'));
    } catch { console.log(`${p.imie}: brak danych`); continue; }
    console.log(`\n${p.imie} (klasa ${p.klasa}) — prób: ${dane.proby.length}`);
    for (const pr of dane.proby.slice(-15)) {
      const data = new Date(pr.d).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
      console.log(`  ${data}  ${pr.tytul}${pr.przerwane ? ' (przerwane)' : ''}: ${pr.dobrze}/${pr.ile} za pierwszym razem, ${Math.round(pr.czas / 60)} min`);
      for (const b of pr.bloki) console.log(`     · ${b.tytul}: ${b.dobrze}/${b.ile}`);
      if (pr.bledy?.length) console.log(`     do powtórki: ${pr.bledy.map((x) => `${x.d} (wpisał(a) ${x.odp}, dobrze ${x.a})`).join('; ')}`);
    }
  }
} else {
  console.log('Użycie: node narzedzia/matmoza.mjs sprawdz [id] | katalog | wyniki [profil]');
  process.exit(1);
}
