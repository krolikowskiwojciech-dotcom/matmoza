# Matmoza — rodzinna aplikacja do ćwiczeń z matematyki (PWA)

Zawsze po polsku. Aplikacja webowa na iPhone'a (dodana do ekranu początkowego), siostra Lingozy.

- **Adres:** https://krolikowskiwojciech-dotcom.github.io/matmoza/ (GitHub Pages z gałęzi `main`, repo publiczne).
- **Wyniki:** prywatne repo `krolikowskiwojciech-dotcom/matmoza-dane`, plik `profile/<id>.json` = `{ id, proby: [...] }`.
  Telefon dziecka zapisuje tam każdą próbę (token GitHub wklejony raz w Ustawieniach). Odczyt: `node narzedzia/matmoza.mjs wyniki`.
- **Profile:** `julek` (Julek, klasa 6) i `aniela` (Aniela, klasa 4). Lista w `narzedzia/matmoza.mjs` (PROFILE) → `zestawy/indeks.json`.
- **Zasady gier** wzięte ze starej strony „Ucz się sprytniej” (iCloud: `Audio - do nauki /uczsiesprytniej/projekt/migracja/`):
  zła odpowiedź zatrzymuje grę, poprawna odpowiedź w ramce + kroki „jak to policzyć”, 1,2 s blokady przycisków,
  błędne zadanie wraca w tym samym bloku, bez powtórek w rundzie, każde „=” na ekranie jest prawdą,
  poziom jak na kartkówce (nie trudniej), treści własnymi słowami, własne okienka zamiast alert/confirm.
- **Koniec zestawu:** podsumowanie per blok i „Wyślij wynik” → systemowe okienko udostępniania (SMS, Mail…).

## Prośba „zrób im ćwiczenia z tego zdjęcia” (zdjęcie strony podręcznika / karty pracy)

1. `git pull`.
2. Rozpoznaj na zdjęciu **typy zadań** (np. dodawanie ułamków o różnych mianownikach, dzielenie z resztą, kolejność działań).
   Każdy typ = **osobny blok**. Ustal, dla kogo (Julek kl. 6 / Aniela kl. 4) i kiedy kartkówka (`termin`), jeśli Wojtek podał.
3. Utwórz `zestawy/<rrrr-mm-dd>-<kto>-<temat>.json` według `ZESTAWY.md`. Liczby i poziom **jak na zdjęciu** — nie trudniej.
   Do rachunków używaj generatorów (dużo różnych przykładów, bez powtórek), do zadań z treścią stałych `zadania` z polem `w`
   (ukryte wyrażenie dające odpowiedź, żeby wyrocznia mogła je sprawdzić). Nowy typ ćwiczenia = nowy generator w `js/generatory.js`.
   Zdjęcie strony nie trafia do repo (prawa autorskie wydawnictwa) — tylko opracowane zadania, własnymi słowami.
4. `node narzedzia/matmoza.mjs katalog` — **musi przejść bez błędów** (wyrocznia sprawdza każde zadanie i każde „=”
   w wyjaśnieniach, setki losowań na blok). Pozycje „bez wyroczni” przeczytaj ręcznie.
5. Obejrzyj zestaw lokalnie (podgląd: `python3 -m http.server 8742 --bind 127.0.0.1`, telefon 390 px).
6. Podbij `CACHE` w `sw.js` tylko przy zmianach kodu (nowy zestaw tego nie wymaga).
7. Commit + `git push` — Pages publikuje w 1–2 min. Powiedz Wojtkowi, jaki zestaw doszedł i ile ma bloków/zadań.

## Kod

- `index.html`, `styles.css` (zeszyt w kratkę, Bricolage Grotesque + Atkinson Hyperlegible), `sw.js` (offline).
- `js/app.js` (ekrany i adresy `#/…`), `js/gra.js` (przebieg zestawu, poprawka po błędzie, podsumowanie, udostępnianie),
  `js/generatory.js` (generatory i wyjaśnienia), `js/wyrazenie.js` (kolejność działań krok po kroku),
  `js/liczby.js` (ułamki dokładne, polski zapis liczb), `js/sprawdz.js` (ocena odpowiedzi), `js/store.js` (zapis + synchronizacja),
  `js/dzwieki.js` (dźwięki z „Ucz się sprytniej”), `obrazy/` (maskotka; brak pliku nie psuje ekranu).
- `narzedzia/matmoza.mjs` — wyrocznia NIEZALEŻNA od kodu aplikacji (własna arytmetyka na BigInt). Nie łącz jej z `js/`.
- Podgląd lokalny na 127.0.0.1 nie ma tokenu, więc nie zapisuje wyników do prawdziwych danych. Nie testuj z tokenem.
- Po każdej zmianie kodu podbij `CACHE` w `sw.js`, potem commit + push.
