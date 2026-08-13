#!/usr/bin/env bash
# Assemble the Locare marketing video from the clips recorded by record.mjs.
#
#   bash scripts/video/assemble.sh
#
# Produces, in docs/video/out/:
#   locare-90s.mp4        sales cut, 16:9
#   locare-45s.mp4        hero cut, 16:9
#   locare-15s.mp4        social cut, 16:9
#   locare-15s-square.mp4 social cut, 1:1
#   locare-15s-vertical.mp4  social cut, 9:16
#
# Captions are burned in — platform auto-captions mis-hear "Locare" every time,
# and most feed viewing is muted, so the text has to be part of the picture.
#
# Requires ffmpeg. Optional: put a licensed instrumental at docs/video/music.mp3
# and it will be laid underneath at -18dB.
set -euo pipefail

RAW="docs/video/raw"
OUT="docs/video/out"
MUSIC="docs/video/music.mp3"
FONT="${VIDEO_FONT:-C\\:/Windows/Fonts/arialbd.ttf}"   # bold; override on non-Windows

command -v ffmpeg >/dev/null || { echo "ffmpeg not found — install it first"; exit 1; }
[ -d "$RAW" ] || { echo "no clips in $RAW — run: node scripts/video/record.mjs"; exit 1; }

mkdir -p "$OUT" "$RAW/norm"

# ── 1. Normalise every clip to 1920x1080 / 30fps / same codec ───────────────
# Playwright's webm files vary in frame rate; concat demuxer needs them uniform.
# Mobile clips are letterboxed onto the 16:9 canvas rather than stretched.
echo "normalising clips…"
for f in "$RAW"/*.webm; do
  base=$(basename "$f" .webm)
  ffmpeg -y -loglevel error -i "$f" \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x15161b,fps=30,format=yuv420p" \
    -an -c:v libx264 -preset medium -crf 20 \
    "$RAW/norm/$base.mp4"
done

# ── 2. Caption burn-in ──────────────────────────────────────────────────────
# One caption per beat, lower third, dark plate behind for legibility on any
# background. Keep text short — it must be readable at phone size.
caption() {
  local in="$1" out="$2" text="$3"
  local esc=${text//\'/\\\\\'}
  esc=${esc//:/\\:}
  if [ -z "$text" ]; then cp "$in" "$out"; return; fi
  ffmpeg -y -loglevel error -i "$in" -vf \
    "drawtext=fontfile='${FONT}':text='${esc}':fontcolor=white:fontsize=46:\
box=1:boxcolor=0x15161b@0.86:boxborderw=26:x=(w-text_w)/2:y=h-190" \
    -c:v libx264 -preset medium -crf 20 -an "$out"
}

echo "burning captions…"
declare -A CAPS=(
  ["01-dashboard"]="One place for the whole portfolio"
  ["02-rent-run"]="Invoices raise themselves"
  ["03-payments-unpaid"]="Rent due, tracked to the cent"
  ["04-tenant-phone"]="Your tenant pays from their phone"
  ["05-reconcile"]="It reconciles itself"
  ["06-owner-statement"]="Owner statements build themselves"
  ["07-reports"]="Every cent accounted for"
  ["00-intro"]=""
  ["99-outro"]=""
)
mkdir -p "$RAW/cap"
for f in "$RAW"/norm/*.mp4; do
  base=$(basename "$f" .mp4)
  caption "$f" "$RAW/cap/$base.mp4" "${CAPS[$base]:-}"
done

# ── 3. Build each cut from an ordered list ──────────────────────────────────
build() {
  local name="$1"; shift
  local list="$RAW/.list-$name.txt"
  : > "$list"
  for id in "$@"; do
    [ -f "$RAW/cap/$id.mp4" ] && echo "file '$(cd "$RAW/cap" && pwd)/$id.mp4'" >> "$list"
  done
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" -c copy "$OUT/$name-silent.mp4"

  if [ -f "$MUSIC" ]; then
    ffmpeg -y -loglevel error -i "$OUT/$name-silent.mp4" -i "$MUSIC" \
      -filter_complex "[1:a]volume=-18dB,afade=t=out:st=0:d=2[a]" \
      -map 0:v -map "[a]" -shortest -c:v copy -c:a aac -b:a 160k "$OUT/$name.mp4"
    rm "$OUT/$name-silent.mp4"
  else
    mv "$OUT/$name-silent.mp4" "$OUT/$name.mp4"
  fi
  echo "  → $OUT/$name.mp4"
}

echo "building cuts…"
build "locare-90s" 00-intro 01-dashboard 02-rent-run 03-payments-unpaid 04-tenant-phone 05-reconcile 06-owner-statement 07-reports 99-outro
build "locare-45s" 00-intro 01-dashboard 02-rent-run 05-reconcile 06-owner-statement 99-outro
build "locare-15s" 02-rent-run 04-tenant-phone 05-reconcile 99-outro

# ── 4. Social crops from the 15s cut ────────────────────────────────────────
# Centre-crop rather than squash. Captions sit at y=h-190 on a 1080-high frame,
# so they survive a 1:1 crop; the 9:16 pad keeps them clear of platform UI.
echo "cropping social versions…"
ffmpeg -y -loglevel error -i "$OUT/locare-15s.mp4" \
  -vf "crop=1080:1080:(iw-1080)/2:0" -c:a copy "$OUT/locare-15s-square.mp4"
ffmpeg -y -loglevel error -i "$OUT/locare-15s.mp4" \
  -vf "scale=1080:-2,pad=1080:1920:0:(oh-ih)/2:color=0x15161b" -c:a copy "$OUT/locare-15s-vertical.mp4"

echo
echo "done — files in $OUT:"
ls -lh "$OUT" | tail -n +2 | awk '{print "   " $9 "  " $5}'
echo
echo "Watch locare-15s.mp4 first. If the pacing drags, adjust the wait values"
echo "in scripts/video/beats.config.mjs and re-run the recorder."
