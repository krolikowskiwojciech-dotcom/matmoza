// Dźwięki z Epidemic Sound (wybrane przez Wojtka, obrobione narzedzia/dzwiek.sh). Brak pliku albo blokada odtwarzania nie psuje gry.
import { dzwiek } from './store.js';

const PLIKI = {
  klik: 'audio/klik.mp3', // klawisze cyfr i okienka
  cofnij: 'audio/cofnij.mp3', // ⌫
  przycisk: 'audio/przycisk.mp3', // Zaczynam, Dalej
  dobrze: 'audio/dobrze.mp3',
  seria5: 'audio/seria5.mp3', // co 5. dobra z rzędu
  seria10: 'audio/seria10.mp3', // co 10. dobra z rzędu
  zle: 'audio/zle.mp3',
  blok: 'audio/blok.mp3', // wejście w nowy blok
  koniecBloku: 'audio/koniec-bloku.mp3',
  zwyciestwo: 'audio/zwyciestwo.mp3', // koniec zestawu z kompletem gwiazdek
  koniec: 'audio/koniec.mp3', // koniec zestawu
  start: 'audio/start.mp3', // start całego zestawu
  wyslij: 'audio/wyslij.mp3',
};
const cache = {};
const niedostepne = new Set();

export function graj(nazwa) {
  if (!dzwiek() || niedostepne.has(nazwa)) return;
  try {
    const a = cache[nazwa] || (cache[nazwa] = new Audio(PLIKI[nazwa]));
    a.currentTime = 0;
    // wszystkie pliki mają szczyt −1 dB, więc głośność ustawiamy tutaj: interfejs cicho, zła odpowiedź łagodniej niż dobra
    a.volume = ['klik', 'cofnij', 'przycisk'].includes(nazwa) ? 0.4 : nazwa === 'zle' ? 0.55 : nazwa === 'blok' ? 0.5 : 0.8;
    a.play().catch(() => {});
    a.onerror = () => niedostepne.add(nazwa);
  } catch { niedostepne.add(nazwa); }
}
