// Ocena odpowiedzi dziecka. Wspólne dla aplikacji i narzędzia (narzędzie sprawdza, czy podana odpowiedź przechodzi).

import { parsuj, postacNajprostsza, nwd } from './liczby.js';

const rowne = (x, y) => { const a = parsuj(x), b = parsuj(y); return !!a && !!b && a.rowne(b); };

// { ok: bool, uwaga?: tekst } — uwaga, gdy wartość jest dobra, ale zapis nie (np. nieskrócony ułamek)
export function ocen(cz, odp) {
  switch (cz.kind) {
    case 'wybor':
      return { ok: odp === cz.a };
    case 'reszta': {
      const [qa, ra] = cz.a.split(' r ');
      const [qo, ro] = Array.isArray(odp) ? odp : String(odp).split(' r ');
      return { ok: rowne(qa, qo) && rowne(ra, ro) };
    }
    case 'ulamek': {
      const v = parsuj(odp), dobra = parsuj(cz.a);
      if (!v || !v.rowne(dobra)) return { ok: false };
      if (cz.postac === 'najprostsza' && !postacNajprostsza(odp)) {
        return { ok: false, uwaga: dobra.calkowita ? 'Wartość dobra, ale to liczba całkowita — zapisz ją bez ułamka.' : 'Wartość dobra, ale wynik trzeba skrócić i wyłączyć całości.' };
      }
      if (cz.postac === 'niewlasciwy') {
        const m = String(odp).trim().match(/^(\d+)\/(\d+)$/);
        if (!m || nwd(+m[1], +m[2]) !== 1) return { ok: false, uwaga: 'Wartość dobra, ale zapisz ją jako nieskracalny ułamek niewłaściwy (bez całości).' };
      }
      return { ok: true };
    }
    default:
      return { ok: rowne(odp, cz.a) };
  }
}

// zadanie z zestawu albo generatora → jednolity kształt { q?, czesci: [...] }
export function normuj(z) {
  if (z.czesci) return z;
  const { q, klucz, ...cz } = z;
  return { q, klucz, czesci: [cz] };
}
