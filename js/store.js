// Stan w przeglądarce i synchronizacja prób z prywatnym repo matmoza-dane (jak w Lingozie: GitHub API + token).
// Pod *.ogarnijmaterial.pl zamiast tokenu: pośrednik https://ogarnijmaterial.pl/api/gh z ciasteczkiem sesji rodziny.
// Każde dziecko ma plik profile/<id>.json = { id, proby: [...], u }. Próby się tylko dopisują, więc scalanie
// dwóch kopii to suma bez powtórzeń (po id próby).

export const LS = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* tryb prywatny */ } },
};

import { naOM, trybTestowy, API_OM } from './konto.js';

export const REPO_DANYCH = 'krolikowskiwojciech-dotcom/matmoza-dane';
const API = 'https://api.github.com';
const BRAK_REPO = 'Token nie widzi repozytorium matmoza-dane. W ustawieniach tokenu na GitHubie: Repository access → Only select repositories → dodaj matmoza-dane.';
const BRAK_ZAPISU = 'Token widzi repozytorium, ale nie może w nim zapisywać. W ustawieniach tokenu: Permissions → Repositories → Contents → Read and write.';

// pod ogarnijmaterial.pl profil ustala konto rodziny (konto.js) — trzymany tylko w pamięci strony
let profilKonta = null;
export const ustawProfilKonta = (id) => { profilKonta = id; };
export const profil = () => (naOM ? profilKonta : LS.get('mz.profil'));
export const ustawProfil = (id) => (id ? LS.set('mz.profil', id) : LS.del('mz.profil'));
export const dzwiek = () => LS.get('mz.dzwiek', true);
export const ustawDzwiek = (v) => LS.set('mz.dzwiek', v);
export const token = () => LS.get('mz.token');
export const ustawToken = (t) => (t ? LS.set('mz.token', t) : LS.del('mz.token'));
// czy wyniki mogą iść do repo: na github.io z tokenem, pod ogarnijmaterial.pl zawsze (poza testem lokalnym)
export const synchroWlaczona = () => (naOM ? !trybTestowy : !!token());

export const proby = (id) => LS.get('mz.proby.' + id, []);
const zapiszProby = (id, lista) => LS.set('mz.proby.' + id, lista.slice(-500));

export function dodajProbe(id, proba) {
  zapiszProby(id, [...proby(id), proba]);
}

// najlepsza i ostatnia próba danego zestawu (całego, nie pojedynczego bloku)
export function wynikiZestawu(id, zestaw) {
  const lista = proby(id).filter((p) => p.zestaw === zestaw && !p.tylkoBlok);
  return { ostatnia: lista[lista.length - 1] || null, ile: lista.length };
}

function scal(a = [], b = []) {
  const m = new Map();
  for (const p of [...a, ...b]) m.set(p.id, p);
  return [...m.values()].sort((x, y) => x.d - y.d);
}

const enc = (str) => {
  const bytes = new TextEncoder().encode(str);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const dec = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

async function gh(path, opts = {}) {
  const naglowki = { Accept: 'application/vnd.github+json', ...(opts.headers || {}) };
  const r = naOM
    // pośrednik: ciasteczko sesji, bez nagłówka Authorization (token jest na serwerze)
    ? await fetch(API_OM + '/gh' + path, { cache: 'no-store', ...opts, credentials: 'include', headers: naglowki })
    : await fetch(API + path, { cache: 'no-store', ...opts, headers: { Authorization: `Bearer ${token()}`, ...naglowki } });
  if (r.status === 401) throw new Error(naOM ? 'Sesja wygasła. Zaloguj się ponownie na ogarnijmaterial.pl.' : 'Token jest nieprawidłowy albo wygasł.');
  return r;
}

// pobiera plik profilu, scala z lokalnymi próbami i odsyła, jeśli coś doszło
export async function synchronizuj(id) {
  if (!synchroWlaczona() || !id) return { stan: 'wylaczona' };
  const brakRepo = naOM ? 'Serwer nie widzi repozytorium wyników. Powiedz tacie.' : BRAK_REPO;
  const brakZapisu = naOM ? 'Serwer nie może zapisać wyników. Powiedz tacie.' : BRAK_ZAPISU;
  const plik = `/repos/${REPO_DANYCH}/contents/profile/${id}.json`;
  for (let proba = 0; proba < 3; proba++) {
    if (proba === 0) {
      const repo = await gh(`/repos/${REPO_DANYCH}`);
      if (repo.status === 404 || repo.status === 403) throw new Error(brakRepo);
    }
    const r = await gh(plik);
    if (!r.ok && r.status !== 404) throw new Error(r.status === 403 ? brakRepo : `GitHub: błąd ${r.status}`);
    const j = r.ok ? await r.json() : null;
    const zdalne = j ? JSON.parse(dec(j.content || '') || 'null') : null;
    const razem = scal(zdalne?.proby, proby(id));
    zapiszProby(id, razem);
    if (zdalne && zdalne.proby.length === razem.length) return { stan: 'ok' };
    const body = { message: `Matmoza: wyniki ${id}`, content: enc(JSON.stringify({ id, proby: razem, u: Date.now() }) + '\n') };
    if (j?.sha) body.sha = j.sha;
    const w = await gh(plik, { method: 'PUT', body: JSON.stringify(body) });
    if (w.status === 409 || w.status === 422) continue;
    if (!w.ok) throw new Error(w.status === 403 || w.status === 404 ? brakZapisu : `GitHub: błąd ${w.status} przy zapisie`);
    return { stan: 'ok' };
  }
  throw new Error('Nie udało się zapisać wyników (konflikt). Spróbuj za chwilę.');
}
