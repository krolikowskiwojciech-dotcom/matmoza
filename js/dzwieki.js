// Dźwięki z Epidemic Sound (wybrane przez Wojtka, przekonwertowane do m4a). Brak pliku albo blokada odtwarzania nie psuje gry.
import { dzwiek } from './store.js';

const PLIKI = {
  klik: 'audio/klik.m4a', // klawisze cyfr i okienka
  cofnij: 'audio/cofnij.m4a', // ⌫
  przycisk: 'audio/przycisk.m4a', // Zaczynam, Dalej
  dobrze: 'audio/dobrze.m4a',
  seria5: 'audio/seria5.m4a', // co 5. dobra z rzędu
  seria10: 'audio/seria10.m4a', // co 10. dobra z rzędu
  zle: 'audio/zle.m4a',
  blok: 'audio/blok.m4a', // wejście w nowy blok
  koniecBloku: 'audio/koniec-bloku.m4a',
  zwyciestwo: 'audio/zwyciestwo.m4a', // koniec zestawu z kompletem gwiazdek
  koniec: 'audio/koniec.m4a', // koniec zestawu
  start: 'audio/start.m4a', // start całego zestawu
  wyslij: 'audio/wyslij.m4a',
};
const cache = {};
const niedostepne = new Set();

export function graj(nazwa) {
  if (!dzwiek() || niedostepne.has(nazwa)) return;
  try {
    const a = cache[nazwa] || (cache[nazwa] = new Audio(PLIKI[nazwa]));
    a.currentTime = 0;
    a.volume = ['klik', 'cofnij', 'przycisk'].includes(nazwa) ? 0.45 : 0.8;
    a.play().catch(() => {});
    a.onerror = () => niedostepne.add(nazwa);
  } catch { niedostepne.add(nazwa); }
}
