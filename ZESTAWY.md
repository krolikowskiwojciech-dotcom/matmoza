# Format zestawu (`zestawy/<id>.json`)

```json
{
  "id": "2026-10-13-julek-ulamki",          // = nazwa pliku; nie zmieniaj po publikacji (od niego zależą wyniki)
  "dla": ["julek"],                          // julek | aniela
  "tytul": "Ułamki zwykłe — kartkówka",
  "opis": "Dodawanie, odejmowanie i skracanie ułamków.",
  "termin": "2026-10-14",                    // dzień kartkówki (opcjonalnie) — karta pokaże „kartkówka jutro”
  "dodano": "2026-10-11",
  "ikona": "½",                              // znak w bąblu karty: + − × ÷ ½ % = … (opcjonalnie)
  "kolor": "lila",                           // lila | mietowy | zolty | brzoskwinia | niebieski | rozowy (opcjonalnie)
  "ocena": true,                             // sprawdzian: na końcu przybliżona ocena szkolna (też w SMS-ie)
  "sprawdzian": true,                        // bez „Jak to zrobić?” przed blokami (wyjaśnienie po błędzie zostaje)
  "bloki": [ { … }, { … } ]                  // jeden typ zadań = jeden blok
}
```

## Blok

```json
{
  "id": "dodawanie",                         // unikalne w zestawie
  "tytul": "Dodawanie ułamków",
  "polecenie": "Oblicz. Wynik skróć i wyłącz całości.",
  "ile": 6,                                  // ile zadań w rundzie
  "generator": { "typ": "ulamki", … },       // ALBO / I "zadania": [ … ] (stałe zadania mają pierwszeństwo)
  "jak": { "intro": "…", "zasady": [["Tytuł", "opis"]], "przyklad": ["3/4 + 1/4 = 1"] },  // „Jak to zrobić?” przed blokiem
  "ujemne": false,                           // true → klawisz „−” na klawiaturze
  "okres": false                             // true → klawisze „(” „)” do ułamków okresowych 0,(3)
}
```

## Zapis matematyki w tekstach

Działania: `+ − · :` (ze spacjami), potęga `5^2`, ułamek `3/4`, liczba mieszana `2 3/4`, okienko `□`,
przecinek dziesiętny `2,45`, duże liczby z twardą spacją `1 440 000` (U+00A0; generatory robią to same).
W wyjaśnieniach etykieta kończy się dwukropkiem bez spacji przed nim: `Policz bez zer: 72 · 3 = 216` — wtedy wyrocznia
sprawdzi równanie. Każde `=`, `<`, `>` między samymi liczbami musi być prawdą.

## Stałe zadanie

```json
{ "d": "3/4 + 1/8 = □", "a": "7/8", "kind": "ulamek", "postac": "najprostsza", "exp": ["Wspólny mianownik to 8.", "3/4 = 6/8", "6/8 + 1/8 = 7/8"] }
```

Zadanie z treścią w kilku częściach (każda część osobno oceniana):

```json
{ "q": "Ola ma 50 zł. Kupiła 3 zeszyty po 4 zł…",
  "czesci": [ { "e": "Ile zapłaciła za zeszyty? (zł)", "a": "12", "kind": "liczba", "w": "3 · 4", "exp": ["3 · 4 = 12"] } ] }
```

- `kind`: `liczba` (całkowite, dziesiętne i okresowe `0,58(3)`), `czynniki` (`"a": "2 · 2 · 3 · 5"`, kolejność dowolna, klawisz „·”), `ulamek` (okienka: całości, licznik, mianownik), `reszta` (`"a": "17 r 3"`,
  `"d": "88 : 5 = □ r. □"`), `wybor` (`"choices": ["<", "=", ">"]` albo `["Prawda", "Fałsz"]`).
- `postac` (ułamki): `najprostsza` (skrócony, całości wyłączone), `niewlasciwy` (np. 17/5), brak = dowolny równy zapis.
- `w`: ukryte wyrażenie dające odpowiedź — dla zadań bez `□` w `d` (także ABCD z liczbą, np. `"a": "6 zł"`, `"w": "3,6 : 3 · 5"`).
  Bez niego wyrocznia zgłosi „bez wyroczni” — wtedy sprawdź zadanie ręcznie.
- `exp`: kroki „jak to policzyć” pokazywane po błędzie (obowiązkowe).

## Generatory (`js/generatory.js`)

| typ | parametry | przykład |
|---|---|---|
| `wyrazenie` | `szablony: ["{a} · {b}"]`, `zmienne` (niżej), `max`, `min`, `dziesietne: true` + `maxMiejsc`, `dowolneWyniki` | `720 · 30 = □`, `(12 − 2) · 3 = □` |
| `reszta` | `dzielna: [min,max]`, `dzielnik: [min,max]`, `zReszta` (domyślnie true) | `88 : 5 = □ r. □` |
| `okienko` | `dzialania: ["+","−","·",":"]`, `a`, `b` | `35 · □ = 1680` |
| `porownaj` | `lewa`, `prawa` (jak `wyrazenie`) | `2,45 · 4 □ 7,3 + 2,5` |
| `ulamki` | `dzialania`, `mianowniki`, `mieszane` (maks. całości), `wspolnyMianownik`, `skracalne`, `maxWspolny`, `maxMianownikWyniku` | `2 3/4 − 1 1/6 = □` |
| `skracanie` | `mianowniki`, `razy: [2,9]` | `12/18 = □` |
| `zamiana` | `kierunek: "naMieszana" \| "naNiewlasciwy"`, `mianowniki`, `calosci` | `17/5 = □` |
| `czynniki` | `pierwsze`, `ile: [3,6]`, `min`, `max` | `600 = □` → 2 · 2 · 2 · 3 · 5 · 5 |
| `nwdnww` | `co: ["nwd","nww"]`, `pierwsze`, `wspolnych`, `wlasnych`, `max`, `maxNww` | `NWD(84, 126) = □` |
| `odwrotnosc` | `mianowniki`, `calosci`, `calkowite` | `2 3/4 · □ = 1` |
| `zamiana2` | `kierunek: naZwykly \| naDziesietny \| naOkresowy` (lista), `calosci`, `maxMiejsc` | `0,06 = □`, `7/250 = □`, `7/12 = □` → 0,58(3) |
| `cyfra` | `n: [8, 25]` | „Jaka cyfra stoi na 10. miejscu po przecinku w 6,(12)?” |
| `skonczone` | — | „Jakie rozwinięcie ma 7/16?” skończone / nieskończone |
| `porownajUlamek` | `mianowniki`, `calosci` | `2/9 □ 0,22` |
| `porownanieRoznicowe` | `rodzaj: "oIle" \| "ileRazy"`, `a`, `b` | „O ile 56 jest większe od 18?” |

Zmienne w `wyrazenie`: `[min, max]` (całkowita), `{ "lista": [...] }`, `{ "od": 0.1, "do": 9.9, "miejsca": 1 }` (dziesiętna),
`{ "cyfry": [2, 9], "zera": [1, 3] }` (np. 72 000), `"= a · b"` (wyliczona z wcześniejszych — tak robi się dzielenie bez reszty),
`{ "ulamek": { "mianowniki": [2,4,5,8], "calosci": [0,3] } }` (ułamek zwykły / liczba mieszana).
`wyrazenie` z `"ulamki": true` liczy na ułamkach zwykłych (wynik jako ułamek nieskracalny, `maxMianownik`),
z `"dziesietne": true` i ułamkami zwykłymi w szablonie — działania mieszane z wynikiem dziesiętnym.
Domyślnie `wyrazenie` przyjmuje tylko przykłady, w których każdy wynik pośredni jest całkowity i nieujemny.
