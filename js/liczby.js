// Liczby dokładne (ułamki l/m) i polski zapis: przecinek dziesiętny, spacje w dużych liczbach,
// ułamki zwykłe „3/4” i liczby mieszane „1 3/4”. Bez DOM — z tego samego pliku korzysta narzędzie.

export const SPACJA = ' '; // odstęp w dużych liczbach: 1 440 000
export const MINUS = '−';

export function nwd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export const nww = (a, b) => (a / nwd(a, b)) * b;

export class Q {
  constructor(l, m = 1) {
    if (!Number.isInteger(l) || !Number.isInteger(m) || m === 0) throw new Error(`Zła liczba ${l}/${m}`);
    if (m < 0) { l = -l; m = -m; }
    const g = nwd(l, m) || 1;
    this.l = l / g; this.m = m / g;
    if (!Number.isSafeInteger(this.l) || !Number.isSafeInteger(this.m)) throw new Error('Za duża liczba');
  }
  dodaj(o) { o = q(o); return new Q(this.l * o.m + o.l * this.m, this.m * o.m); }
  odejmij(o) { o = q(o); return new Q(this.l * o.m - o.l * this.m, this.m * o.m); }
  razy(o) { o = q(o); return new Q(this.l * o.l, this.m * o.m); }
  przez(o) { o = q(o); if (o.l === 0) throw new Error('Dzielenie przez zero'); return new Q(this.l * o.m, this.m * o.l); }
  potega(n) { let w = new Q(1); for (let i = 0; i < n; i++) w = w.razy(this); return w; }
  porownaj(o) { o = q(o); return Math.sign(this.l * o.m - o.l * this.m); }
  rowne(o) { o = q(o); return this.l === o.l && this.m === o.m; }
  get calkowita() { return this.m === 1; }
  get wartosc() { return this.l / this.m; }
  get ujemna() { return this.l < 0; }
  // ile miejsc po przecinku ma zapis dziesiętny (null, gdy ułamek nie ma skończonego rozwinięcia)
  get miejsca() {
    let m = this.m, d2 = 0, d5 = 0;
    while (m % 2 === 0) { m /= 2; d2++; }
    while (m % 5 === 0) { m /= 5; d5++; }
    return m === 1 ? Math.max(d2, d5) : null;
  }
}

export const q = (x) => (x instanceof Q ? x : typeof x === 'number' ? zLiczby(x) : parsuj(x));

// 0.1 + 0.2 nie istnieje: liczbę zamieniamy przez jej zapis tekstowy
function zLiczby(x) {
  if (Number.isInteger(x)) return new Q(x);
  const s = String(x);
  if (/e/i.test(s)) throw new Error('Liczba w zapisie wykładniczym: ' + s);
  const [c, u] = s.replace('-', '').split('.');
  const w = new Q(Number(c + u), 10 ** u.length);
  return x < 0 ? new Q(-w.l, w.m) : w;
}

const normuj = (s) => String(s).trim().replace(/[−–]/g, '-').replace(/\s+/g, ' ');

// „12”, „-3,25”, „1 440 000”, „3/4”, „1 3/4”, „-2 1/2” → Q; inny tekst → null
export function parsuj(s) {
  s = normuj(s);
  if (!s) return null;
  let m = s.match(/^(-?)(?:(\d+) )?(\d+)\/(\d+)$/);
  if (m) {
    const [, zn, c, l, mian] = m;
    if (Number(mian) === 0) return null;
    let w = new Q(Number(l), Number(mian));
    if (c) w = w.dodaj(new Q(Number(c)));
    return zn ? new Q(-w.l, w.m) : w;
  }
  s = s.replace(/ (?=\d{3}(\D|$))/g, '');
  // ułamek okresowy: 0,(3), 0,58(3), 2,(015)
  m = s.match(/^(-?)(\d+)[,.](\d*)\((\d+)\)$/);
  if (m) {
    const [, zn, c, nie, okr] = m;
    const skala = 10 ** nie.length;
    const w = new Q(Number(c + nie), skala).dodaj(new Q(Number(okr), skala * (10 ** okr.length - 1)));
    return zn ? new Q(-w.l, w.m) : w;
  }
  m = s.match(/^(-?)(\d+)(?:[,.](\d+))?$/);
  if (!m) return null;
  const [, zn, c, u = ''] = m;
  const w = new Q(Number(c + u), 10 ** u.length);
  return zn ? new Q(-w.l, w.m) : w;
}

const grupuj = (cyfry) => (cyfry.length > 4 ? cyfry.replace(/\B(?=(\d{3})+$)/g, SPACJA) : cyfry);

// zapis liczby: całkowita → „1 440 000”, skończony dziesiętny → „3,25”, reszta → ułamek
// styl: 'auto' | 'dziesietny' | 'ulamek' (niewłaściwy 7/4) | 'mieszany' (1 3/4)
export function zapisz(x, styl = 'auto') {
  x = q(x);
  const zn = x.ujemna ? MINUS : '';
  const l = Math.abs(x.l), m = x.m;
  if (m === 1) return zn + grupuj(String(l));
  const miejsca = x.miejsca;
  if (styl === 'dziesietny' || (styl === 'auto' && miejsca !== null)) {
    if (miejsca === null) throw new Error('Ten ułamek nie ma skończonego zapisu dziesiętnego');
    const skala = 10 ** miejsca;
    const cyfry = String((l * skala) / m).padStart(miejsca + 1, '0');
    return zn + grupuj(cyfry.slice(0, -miejsca)) + ',' + cyfry.slice(-miejsca);
  }
  if (styl === 'okresowy' || (styl === 'auto-okres' && miejsca === null)) return zn + okresowy(l, m);
  if (styl === 'mieszany' && l > m) {
    const c = Math.floor(l / m), r = l % m;
    return zn + c + ' ' + r + '/' + m;
  }
  return zn + l + '/' + m;
}

// rozwinięcie dziesiętne dzieleniem pisemnym: 14/24 → „0,58(3)”, 3/16 → „0,1875”
export function okresowy(l, m) {
  const c = Math.floor(l / m);
  let r = l % m;
  if (!r) return String(c);
  const cyfry = [];
  const gdzie = new Map();
  while (r && !gdzie.has(r)) {
    gdzie.set(r, cyfry.length);
    r *= 10;
    cyfry.push(Math.floor(r / m));
    r %= m;
  }
  if (!r) return `${c},${cyfry.join('')}`;
  const i = gdzie.get(r);
  return `${c},${cyfry.slice(0, i).join('')}(${cyfry.slice(i).join('')})`;
}

// n-ta cyfra po przecinku rozwinięcia dziesiętnego ułamka l/m
export function cyfraPoPrzecinku(l, m, n) {
  let r = l % m;
  let d = 0;
  for (let i = 0; i < n; i++) { r *= 10; d = Math.floor(r / m); r %= m; }
  return d;
}

// czy ułamek jest zapisany w najprostszej postaci (nieskracalny, całości wyłączone)
export function postacNajprostsza(tekst) {
  const s = normuj(tekst).replace(/^-/, '');
  const m = s.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
  if (!m) return parsuj(s) !== null && !s.includes('/');
  const l = Number(m[2]), mian = Number(m[3]);
  return l > 0 && l < mian && nwd(l, mian) === 1;
}

// odmiana rzeczownika po liczbie: odmiana(5, 'jabłko', 'jabłka', 'jabłek')
export function odmiana(n, jeden, dwaCztery, piecIWiecej) {
  n = Math.abs(n);
  if (!Number.isInteger(n)) return dwaCztery;
  if (n === 1) return jeden;
  const j = n % 10, d = n % 100;
  return j >= 2 && j <= 4 && (d < 12 || d > 14) ? dwaCztery : piecIWiecej;
}
