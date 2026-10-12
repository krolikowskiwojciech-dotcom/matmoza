#!/bin/bash
# Dźwięk z Epidemic Sound → audio/<nazwa>.mp3: przycięta cisza z obu stron (próg −50 dB), mono 44,1 kHz,
# krótkie wyciszenie na końcu, szczyt wyrównany do −1 dB (głośność ustawia js/dzwieki.js), MP3 128 kb/s.
# Użycie: narzedzia/dzwiek.sh "<plik źródłowy>" <nazwa> [maks. długość w s] [wyciszenie końca w s]
# (dla dzwonków z długim pogłosem: np. 1.8 0.7 — zostaje fraza, ogon łagodnie gaśnie)
set -euo pipefail
ZR="$1"; NAZWA="$2"; MAKS="${3:-}"; WYC="${4:-}"
CEL="$(cd "$(dirname "$0")/.." && pwd)/audio/$NAZWA.mp3"
TMP="$(mktemp -t dzwiek).wav"; trap 'rm -f "$TMP"' EXIT
CISZA="silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.005"
ffmpeg -hide_banner -loglevel error -y -i "$ZR" -af "aformat=channel_layouts=mono,$CISZA,areverse,$CISZA,areverse${MAKS:+,atrim=0:$MAKS}" -ar 44100 "$TMP"
DL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP")
FADE=$(awk -v d="$DL" -v w="$WYC" 'BEGIN { f = w ? w : d * 0.2; if (w) { printf "%.3f:d=%.3f", d - f, f; exit } if (f > 0.15) f = 0.15; if (f < 0.01) f = 0.01; printf "%.3f:d=%.3f", d - f, f }')
SZCZYT=$(ffmpeg -hide_banner -i "$TMP" -af volumedetect -f null - 2>&1 | grep -o "max_volume: [-0-9.]*" | awk '{print $2}')
ffmpeg -hide_banner -loglevel error -y -i "$TMP" -af "afade=t=out:st=$FADE,volume=$(awk -v s="$SZCZYT" 'BEGIN{print -1-s}')dB" -c:a libmp3lame -b:a 128k "$CEL"
printf '%s: %.2f s (szczyt był %s dB)\n' "$NAZWA" "$DL" "$SZCZYT"
