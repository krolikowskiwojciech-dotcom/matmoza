// Dźwięki (te same co w grach „Ucz się sprytniej”). Brak pliku albo blokada odtwarzania nie psuje gry.
import { dzwiek } from './store.js';

const PLIKI = {
  klik: 'audio/klik-klocek.mp3',
  cofnij: 'audio/klik-cofniecie.mp3',
  dobrze: 'audio/dobra-odpowiedz-podstawowa.mp3',
  trzy: 'audio/trzy-dobre-odpowiedzi.mp3',
  piec: 'audio/piec-dobrych-odpowiedzi.mp3',
  zle: 'audio/zla-odpowiedz.mp3',
};
const cache = {};
const niedostepne = new Set();

export function graj(nazwa) {
  if (!dzwiek() || niedostepne.has(nazwa)) return;
  try {
    const a = cache[nazwa] || (cache[nazwa] = new Audio(PLIKI[nazwa]));
    a.currentTime = 0;
    a.volume = nazwa === 'klik' || nazwa === 'cofnij' ? 0.35 : 0.8;
    a.play().catch(() => {});
    a.onerror = () => niedostepne.add(nazwa);
  } catch { niedostepne.add(nazwa); }
}
