// Konto rodziny na ogarnijmaterial.pl: pod adresem *.ogarnijmaterial.pl osobę wybiera strona główna (PIN, ciasteczko sesji
// na całą domenę), a ta aplikacja tylko pyta /api/ja, kto jest zalogowany. Wyniki idą przez pośrednika /api/gh
// (token GitHuba leży na serwerze). Na github.io wszystko działa po staremu (wybór profilu + token w Ustawieniach).

export const STRONA = 'https://ogarnijmaterial.pl/';
export const KONTA = 'https://ogarnijmaterial.pl/#konta';
export const API_OM = 'https://ogarnijmaterial.pl/api';

// id konta na stronie głównej → id profilu w tej aplikacji (zestawy/indeks.json); dorośli nie mają tu profilu
const MAPA = { julian: 'julek', aniela: 'aniela' };
// kolor znaczka z inicjałem — taki sam jak na stronie głównej
export const KOLOR_OSOBY = { julek: 'kolor-niebieski', aniela: 'kolor-krem' };

// mała pamięć telefonu (osobna od store.js, żeby moduły nie importowały się nawzajem)
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* tryb prywatny */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* tryb prywatny */ } },
};

const host = location.hostname;
const lokalnie = host === '127.0.0.1' || host === 'localhost';
// TYLKO DO TESTÓW na 127.0.0.1/localhost: ?om=julian | aniela | wojtek | 401 udaje odpowiedź /api/ja.
// Na prawdziwych hostach parametr jest ignorowany, więc nie da się nim obejść logowania.
const test = lokalnie ? new URLSearchParams(location.search).get('om') : null;

export const naOM = host === 'ogarnijmaterial.pl' || host.endsWith('.ogarnijmaterial.pl') || !!test;
export const trybTestowy = !!test;

function przekieruj(adres) {
  if (trybTestowy) {
    // w teście nie wychodzimy z podglądu — pokazujemy, dokąd poszłoby przekierowanie
    document.getElementById('app').replaceChildren(Object.assign(document.createElement('p'), { className: 'ladowanie', textContent: `[test] przekierowanie na ${adres}` }));
    return;
  }
  location.replace(adres);
}

async function zapytajJa() {
  if (trybTestowy) {
    await new Promise((r) => setTimeout(r, 150));
    return test === '401' ? { status: 401 } : { status: 200, ja: { id: test } };
  }
  const r = await fetch(API_OM + '/ja', { credentials: 'include', cache: 'no-store' });
  return { status: r.status, ja: r.ok ? await r.json() : null };
}

/**
 * Ustala profil zalogowanej osoby. Ostatnio potwierdzony profil (pamięć telefonu) pozwala pokazać ekran od razu,
 * a odpowiedź /api/ja sprawdza go w tle: 401 lub dorosły → strona główna, inna osoba → naZmiane(nowyId).
 * Zwraca id profilu do pokazania od razu albo null (wtedy trzeba poczekać na wynik `sprawdzenie`).
 */
export function ustalOsobe(profilIstnieje, naZmiane) {
  const zapamietany = trybTestowy ? null : LS.get('mz.om.profil');
  const sprawdzenie = zapytajJa().then(({ status, ja }) => {
    if (status === 401) { LS.del('mz.om.profil'); przekieruj(STRONA); return null; }
    if (status !== 200) throw new Error(`Serwer kont odpowiedział błędem ${status}.`);
    const id = MAPA[ja?.id];
    if (!id || !profilIstnieje(id)) { LS.del('mz.om.profil'); przekieruj(STRONA); return null; }
    if (!trybTestowy) LS.set('mz.om.profil', id);
    if (id !== zapamietany) naZmiane(id);
    return id;
  });
  return { teraz: zapamietany && profilIstnieje(zapamietany) ? zapamietany : null, sprawdzenie };
}
