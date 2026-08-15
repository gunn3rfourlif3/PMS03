#!/usr/bin/env bash
# Assemble the Locare marketing video from the clips recorded by record.mjs.
#
#   bash scripts/video/assemble.sh
#
# Produces, in docs/video/out/:
#   locare-120s.mp4                 full tour, all three apps, 16:9
#   locare-90s.mp4                  sales cut, 16:9
#   locare-45s.mp4                  hero cut, 16:9
#   locare-tenant-30s.mp4           tenant app, 16:9  (+ -vertical, 9:16)
#   locare-landlord-30s.mp4         landlord app, 16:9  (+ -vertical, 9:16)
#   locare-15s.mp4                  social cut (+ -square 1:1, -vertical 9:16)
#
# Narration: run scripts/video/tts.mjs first and each beat lasts exactly as long
# as its line. Without it, the durations in the cut lists are used instead.
#
# Captions are burned in — platform auto-captions mis-hear "Locare" every time,
# and most feed viewing is muted, so the text has to be part of the picture.
#
# Requires ffmpeg. Optional: put a licensed instrumental at docs/video/music.mp3
# and it will be laid underneath at -18dB.
set -euo pipefail

RAW="docs/video/raw"
# Each run gets its own dated folder. Overwriting one directory in place made it
# impossible to tell a fresh cut from the previous one — same filenames, and
# Explorer doesn't always refresh its timestamps. Override with VIDEO_OUT.
OUT="${VIDEO_OUT:-docs/video/out/$(date +%Y-%m-%d_%H%M)}"
MUSIC="docs/video/music.mp3"
# Arial Bold is the font of a memo, not of a product. Segoe UI Semibold is on
# every Windows box and reads far more like software; Inter/Helvetica are used if
# they happen to be installed. Override with VIDEO_FONT if you license something.
pick_font() {
  local candidates=(
    "C:/Windows/Fonts/seguisb.ttf"
    "C:/Windows/Fonts/segoeuib.ttf"
    "C:/Windows/Fonts/Inter-SemiBold.ttf"
    "C:/Windows/Fonts/arialbd.ttf"
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
  )
  local c unix
  for c in "${candidates[@]}"; do
    unix=$(echo "$c" | sed -E 's|^([A-Za-z]):|/\l\1|')   # C:/x -> /c/x for Git Bash
    if [ -f "$c" ] || [ -f "$unix" ]; then
      # ffmpeg needs the drive colon escaped inside a filter string.
      echo "$c" | sed 's|^\([A-Za-z]\):|\1\\\\:|'
      return 0
    fi
  done
  echo "C\\\\:/Windows/Fonts/arialbd.ttf"
}
FONT="${VIDEO_FONT:-$(pick_font)}"

# Brand accent for the caption band's marker rule.
ACCENT="${VIDEO_ACCENT:-0x2D6A8F}"

# Crossfade between beats. 0.25s is deliberately short — long enough to stop the
# cut feeling like a slideshow, short enough that nobody consciously notices it.
TRANS="${VIDEO_TRANS:-0.25}"

# blackdetect finds where the page stops being uniformly WHITE, but a half-painted
# page (header drawn, content still loading) is no longer uniform while still
# looking blank. This extra settle is added to every in-point so the first frame
# shown is a finished screen.
SETTLE="${VIDEO_SETTLE:-1.0}"

# Voiceover. When docs/video/vo/<beat>.wav exists it OVERRIDES the duration in the
# cut list: the beat runs as long as its narration plus VO_PAD. Picture and voice
# then cannot drift, and retiming means rewriting a sentence.
VO_DIR="${VIDEO_VO_DIR:-docs/video/vo}"
VO_PAD="${VIDEO_VO_PAD:-0.7}"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found — install it first"; exit 1; }
[ -d "$RAW" ] || { echo "no clips in $RAW — run: node scripts/video/record.mjs"; exit 1; }

mkdir -p "$OUT" "$RAW/norm"
echo "$OUT" > docs/video/.last-out
echo "output: $OUT"

# ── 1. Normalise every clip to 1920x1080 / 30fps / same codec ───────────────
# Playwright's webm files vary in frame rate; concat demuxer needs them uniform.
# Mobile clips are letterboxed onto the 16:9 canvas rather than stretched.
#
# Recording starts the instant the browser context opens, so every clip begins
# with a second or two of blank page while the app loads. Trimming happens at
# the CUT stage (section 3) where each cut picks its own in-point and length —
# the same footage plays longer in the 90s cut than the 15s one.
echo "normalising clips…"
for f in "$RAW"/*.webm; do
  base=$(basename "$f" .webm)
  w=$(ffprobe -v error -select_streams v -show_entries stream=width -of csv=p=0 "$f" || echo 1920)
  h=$(ffprobe -v error -select_streams v -show_entries stream=height -of csv=p=0 "$f" || echo 1080)

  if [ "$h" -gt "$w" ]; then
    # Portrait (a phone) on the 16:9 canvas. A blurred copy of the same footage
    # behind it was tried and abandoned: the phone had nothing to sit against and
    # all but disappeared. Flat ink gives the screen a hard edge, which is the
    # whole job of the background here.
    ffmpeg -y -loglevel error -i "$f" \
      -vf "scale=-2:1080,pad=1920:1080:(ow-iw)/2:0:color=0x15161b,fps=30,format=yuv420p" \
      -an -c:v libx264 -preset veryfast -crf 20 "$RAW/norm/$base.mp4"

    # Also keep a native 1080x1920 copy for the vertical app cuts.
    mkdir -p "$RAW/vert"
    ffmpeg -y -loglevel error -i "$f" \
      -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p" \
      -an -c:v libx264 -preset veryfast -crf 20 "$RAW/vert/$base.mp4"
  else
    ffmpeg -y -loglevel error -i "$f" \
      -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x15161b,fps=30,format=yuv420p" \
      -an -c:v libx264 -preset veryfast -crf 20 "$RAW/norm/$base.mp4"
  fi
done

# ── 2. Caption + app label burn-in ──────────────────────────────────────────
# Two overlays per clip:
#   · a lower-third caption saying what's happening
#   · a persistent top-left chip naming WHICH APP is on screen
# The chip matters because the video cross-cuts between three products; without
# it a viewer can't tell the agency back-office from the landlord app, and the
# "everyone gets their own app" claim reads as one product with three screens.
# Locare ink, used for the caption band and the letterbox.
INK="0x0F1115"

# Tracking is much of what separates a title card from a caption, and drawtext
# has no letter-spacing, so space the characters by hand.
track() { echo "$1" | sed -e 's/./& /g' -e 's/ *$//'; }

caption() {
  local in="$1" out="$2" text="$3" app="$4"
  local esc=${text//\'/\\\'}
  esc=${esc//:/\\:}

  # A translucent scrim was tried first and looked like a smudge: this product's
  # UI is light, so a dark gradient over it reads as a shadow, not as design, and
  # white text on the resulting pale grey barely holds. An opaque band is a
  # deliberate object instead of a wash — and because the picture is scaled to sit
  # above it rather than being covered, nothing in the app is hidden. That matters
  # on the phone beats, where the bottom of the frame is the tab bar.
  local BAND=132
  local VH=$((1080 - BAND))
  local layers="scale=1920:${VH}:force_original_aspect_ratio=decrease,\
pad=1920:${VH}:(ow-iw)/2:(oh-ih)/2:color=${INK},pad=1920:1080:0:0:color=${INK},\
drawbox=x=0:y=${VH}:w=1920:h=2:color=white@0.10:t=fill,\
drawbox=x=96:y=${VH}:w=64:h=2:color=${ACCENT}:t=fill"

  if [ -n "$text" ]; then
    # Left-aligned, optically centred in the band. Centred captions wander as the
    # line length changes; a fixed left margin gives the sequence a spine.
    layers="${layers},drawtext=fontfile='${FONT}':text='${esc}':fontcolor=white:fontsize=44:\
x=96:y=${VH}+(${BAND}-text_h)/2-2"
  fi
  if [ -n "$app" ]; then
    local lbl; lbl=$(track "$app")
    layers="${layers},drawtext=fontfile='${FONT}':text='${lbl}':fontcolor=white@0.45:fontsize=20:\
x=1920-text_w-96:y=${VH}+(${BAND}-text_h)/2"
  fi

  ffmpeg -y -loglevel error -i "$in" -vf "$layers" \
    -c:v libx264 -preset veryfast -crf 20 -an "$out"
}

vo_count=$(ls "$VO_DIR"/*.wav 2>/dev/null | wc -l | tr -d ' ')
if [ "$vo_count" -gt 0 ]; then
  echo "narration: $vo_count lines in $VO_DIR"
else
  echo
  echo "  ── NO VOICEOVER ──────────────────────────────────────────────"
  echo "  $VO_DIR is empty, so these cuts will have no voice track."
  if [ ! -f "$MUSIC" ]; then
    echo "  There is no $MUSIC either — the output will be SILENT."
  fi
  echo "  To add narration:  \$env:ELEVENLABS_API_KEY=\"...\""
  echo "                     node scripts/video/tts.mjs"
  echo "  ──────────────────────────────────────────────────────────────"
  echo
fi

echo "burning captions…"
declare -A CAPS=(
  ["01-dashboard"]="One place for the whole portfolio"
  ["02-rent-run"]="Invoices raise themselves"
  ["03-payments-unpaid"]="Tenants send proof. It lands in one queue"
  ["04-tenant-phone"]="Your tenant pays from their phone"
  ["05-reconcile"]="One click. It reconciles itself"
  ["06-owner-statement"]="Owner statements build themselves"
  ["07-reports"]="Every cent accounted for"
  ["08-landlord-home"]="The whole portfolio, on the move"
  ["09-landlord-statements"]="Applications, approved on the move"
  ["10-tenant-maintenance"]="Maintenance, logged from the couch"
  ["11-tenant-messages"]="One thread. No more lost WhatsApps"
  ["12-landlord-tickets"]="Work orders, assigned and tracked"
  ["13-listings"]="Your own branded rentals site"
  ["14-applications"]="Applications arrive as a pipeline"
  ["15-documents"]="Leases signed and stored, not chased"
  ["16-tenant-pay"]="Rent due, paid in two taps"
  ["17-tenant-lease"]="Their lease, always to hand"
  ["18-landlord-messages"]="Every conversation, in one inbox"
  ["00-intro"]=""
  ["99-outro"]=""
)

# Which app each beat is filmed in. Keep in step with `app:` in beats.config.mjs.
declare -A APPOF=(
  ["01-dashboard"]="BACK-OFFICE"
  ["02-rent-run"]="BACK-OFFICE"
  ["03-payments-unpaid"]="BACK-OFFICE"
  ["04-tenant-phone"]="TENANT APP"
  ["05-reconcile"]="BACK-OFFICE"
  ["06-owner-statement"]="BACK-OFFICE"
  ["07-reports"]="BACK-OFFICE"
  ["08-landlord-home"]="LANDLORD APP"
  ["09-landlord-statements"]="LANDLORD APP"
  ["10-tenant-maintenance"]="TENANT APP"
  ["11-tenant-messages"]="TENANT APP"
  ["12-landlord-tickets"]="LANDLORD APP"
  ["13-listings"]="BACK-OFFICE"
  ["14-applications"]="BACK-OFFICE"
  ["15-documents"]="BACK-OFFICE"
  ["16-tenant-pay"]="TENANT APP"
  ["17-tenant-lease"]="TENANT APP"
  ["18-landlord-messages"]="LANDLORD APP"
  ["00-intro"]=""
  ["99-outro"]=""
)

mkdir -p "$RAW/cap"
for f in "$RAW"/norm/*.mp4; do
  base=$(basename "$f" .mp4)
  caption "$f" "$RAW/cap/$base.mp4" "${CAPS[$base]:-}" "${APPOF[$base]:-}"
done

# Vertical copies get their own burn-in: the same text at 1080x1920 needs a
# smaller size and a caption sitting higher, clear of platform UI.
caption_vert() {
  local in="$1" out="$2" text="$3" app="$4"
  local esc=${text//\'/\\\'}
  esc=${esc//:/\\:}

  # Taller band: 9:16 captions need two lines more often, and the extra room
  # keeps the text clear of platform chrome along the bottom of the screen.
  local BAND=210
  local VH=$((1920 - BAND))
  local layers="scale=1080:${VH}:force_original_aspect_ratio=decrease,\
pad=1080:${VH}:(ow-iw)/2:(oh-ih)/2:color=${INK},pad=1080:1920:0:0:color=${INK},\
drawbox=x=0:y=${VH}:w=1080:h=2:color=white@0.10:t=fill,\
drawbox=x=64:y=${VH}:w=56:h=2:color=${ACCENT}:t=fill"

  if [ -n "$app" ]; then
    local lbl; lbl=$(track "$app")
    layers="${layers},drawtext=fontfile='${FONT}':text='${lbl}':fontcolor=white@0.45:fontsize=20:\
x=64:y=${VH}+34"
  fi
  if [ -n "$text" ]; then
    layers="${layers},drawtext=fontfile='${FONT}':text='${esc}':fontcolor=white:fontsize=42:\
line_spacing=10:x=64:y=${VH}+80"
  fi

  ffmpeg -y -loglevel error -i "$in" -vf "$layers" \
    -c:v libx264 -preset veryfast -crf 20 -an "$out"
}

if [ -d "$RAW/vert" ]; then
  mkdir -p "$RAW/vert-cap"
  for f in "$RAW"/vert/*.mp4; do
    base=$(basename "$f" .mp4)
    caption_vert "$f" "$RAW/vert-cap/$base.mp4" "${CAPS[$base]:-}" "${APPOF[$base]:-}"
  done
fi

# ── 3. Build each cut ───────────────────────────────────────────────────────
# Recording starts the moment the browser context opens, so every clip begins
# with a blank white page while the app loads — anywhere from 1s to 20s. Rather
# than hand-tuning in-points that change with every run, find the blank lead-in
# automatically: invert the picture (blank white -> black) and let blackdetect
# report where it ends.
lead_in() {
  local f="$1" raw="" val=""
  # Every stage is guarded: with `set -euo pipefail`, a grep that matches nothing
  # returns 1 and would abort the whole build. A detector must never do that —
  # worst case it reports 0 and we lose a trim, which is recoverable.
  raw=$(ffmpeg -hide_banner -i "$f" -vf "negate,blackdetect=d=0.4:pix_th=0.10" \
        -an -f null - 2>&1 || true)
  val=$(printf '%s' "$raw" \
        | grep -o 'black_start:[0-9.]*[[:space:]]*black_end:[0-9.]*' 2>/dev/null \
        | awk -F'[:[:space:]]+' 'NR>0 && $2+0 < 0.5 { print $4+0; exit }' || true)
  [ -n "$val" ] || val=0
  printf '%s' "$val"
}

# Each cut lists "id:offset:duration". `offset` is measured from the moment real
# content appears, NOT from the start of the file — the blank lead-in is found
# and skipped for you. Duration sets the pace: the same footage runs longer in
# the sales cut than the social one.
build() {
  local name="$1"; shift
  local SRCDIR="${BUILD_SRC:-$RAW/cap}"
  local list="$RAW/.list-$name.txt"
  local seg="$RAW/seg-$name"
  rm -rf "$seg"; mkdir -p "$seg"
  : > "$list"

  local i=0 clock=0 prevdur=0
  local starts=() vos=()
  for spec in "$@"; do
    local id="${spec%%:*}"; local rest="${spec#*:}"
    local ss="${rest%%:*}"; local dur="${rest##*:}"
    local src="$SRCDIR/$id.mp4"
    [ -f "$src" ] || { echo "    (skipping missing $id)"; continue; }

    # Narration sets the pace when it exists: the beat lasts exactly as long as
    # its line, plus a breath. The number in the cut list is the fallback.
    local vo="$VO_DIR/$id.wav" vlen=0
    if [ -f "$vo" ]; then
      vlen=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$vo" || echo 0)
      [ -n "$vlen" ] || vlen=0
      dur=$(awk -v v="$vlen" -v p="$VO_PAD" 'BEGIN{print v+p}')
    fi

    # Offset is relative to first real content. Detect on the PRE-caption copy:
    # the caption's dark plate breaks the "uniformly white = blank" test, and the
    # two files share identical timing.
    local lead; lead=$(lead_in "$RAW/norm/$id.mp4")
    ss=$(awk -v l="$lead" -v o="$ss" -v st="$SETTLE" 'BEGIN{print l+o+st}')

    # Clamp the in-point: if a clip came out shorter than expected, seeking past
    # its end silently produces an empty segment and the beat vanishes.
    local len; len=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src" || true)
    [ -n "$len" ] || len=0
    local max; max=$(awk -v l="$len" -v d="$dur" 'BEGIN{v=l-d; print (v>0)?v:0}')
    ss=$(awk -v s="$ss" -v m="$max" 'BEGIN{print (s>m)?m:s}')

    printf "    %-22s lead-in %5.1fs  in %5.1fs  for %ss\n" "$id" "$lead" "$ss" "$dur"
    i=$((i+1))
    local out="$seg/$(printf '%02d' $i)-$id.mp4"
    ffmpeg -y -loglevel error -i "$src" -ss "$ss" -t "$dur" \
      -c:v libx264 -preset veryfast -crf 20 -an "$out"
    echo "file '$(cd "$seg" && pwd)/$(basename "$out")'" >> "$list"

    # Use the segment's REAL length, not the requested one, to place narration.
    # ffmpeg rounds -t to a frame boundary, and a clip shorter than the request
    # simply ends early. Either way the written segment differs from $dur by a
    # few hundredths, and using $dur made that error accumulate down the
    # timeline — which is why the voice drifted out of sync towards the end.
    local realdur; realdur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out" || echo "$dur")
    [ -n "$realdur" ] || realdur="$dur"

    # Timeline position of this segment once earlier crossfades are accounted for.
    if [ "$i" -eq 1 ]; then clock=0; else
      clock=$(awk -v c="$clock" -v d="$prevdur" -v t="$TRANS" 'BEGIN{print c+d-t}')
    fi
    starts+=("$clock"); vos+=("$vo"); prevdur="$realdur"
  done

  # Crossfade the segments together. xfade takes two inputs at a time, so the
  # chain is built pairwise and each transition's offset is (elapsed - TRANS),
  # where elapsed already accounts for every earlier overlap. Total runtime ends
  # up sum(durations) - (n-1) * TRANS, which is why the cut lists are written a
  # few seconds long.
  local n; n=$(wc -l < "$list")
  if [ "$n" -le 1 ] || [ "${TRANS%.*}" = "0" ] && [ "$TRANS" = "0" ]; then
    ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" -c copy "$OUT/$name-silent.mp4"
  else
    local args=() filter="" prev="0:v" elapsed=0 k=0
    while IFS= read -r line; do
      local f="${line#file \'}"; f="${f%\'}"
      args+=(-i "$f")
      local d; d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" || echo 0)
      if [ "$k" -eq 0 ]; then
        elapsed="$d"
      else
        local off; off=$(awk -v e="$elapsed" -v t="$TRANS" 'BEGIN{v=e-t; print (v>0)?v:0}')
        filter="${filter}[${prev}][${k}:v]xfade=transition=fade:duration=${TRANS}:offset=${off}[v${k}];"
        prev="v${k}"
        elapsed=$(awk -v e="$elapsed" -v d="$d" -v t="$TRANS" 'BEGIN{print e+d-t}')
      fi
      k=$((k+1))
    done < "$list"
    filter="${filter%;}"
    ffmpeg -y -loglevel error "${args[@]}" -filter_complex "$filter" -map "[${prev}]" \
      -c:v libx264 -preset veryfast -crf 20 -an "$OUT/$name-silent.mp4"
  fi

  # ── audio: narration first, music underneath ──────────────────────────────
  # Each line is delayed to its segment's start on the timeline, then everything
  # is mixed. Music sits at -18dB under narration, -12dB when there is none.
  local voargs=() vofilter="" vocount=0
  for k in "${!vos[@]}"; do
    local f="${vos[$k]}"
    [ -f "$f" ] || continue
    local ms; ms=$(awk -v s="${starts[$k]}" 'BEGIN{printf "%d", s*1000}')
    voargs+=(-i "$f")
    vofilter="${vofilter}[$((vocount)):a]adelay=${ms}|${ms},volume=1.0[n${vocount}];"
    vocount=$((vocount+1))
  done

  local total; total=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$name-silent.mp4" || true)
  [ -n "$total" ] || total=0
  local fade; fade=$(awk -v t="$total" 'BEGIN{v=t-2; print (v>0)?v:0}')

  if [ "$vocount" -gt 0 ]; then
    local mixin=""; for ((k=0;k<vocount;k++)); do mixin="${mixin}[n${k}]"; done
    if [ -f "$MUSIC" ]; then
      ffmpeg -y -loglevel error "${voargs[@]}" -stream_loop -1 -i "$MUSIC" -i "$OUT/$name-silent.mp4" \
        -filter_complex "${vofilter}${mixin}amix=inputs=${vocount}:normalize=0[vo];\
[${vocount}:a]volume=-18dB,atrim=0:${total},afade=t=out:st=${fade}:d=2[bed];\
[vo][bed]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]" \
        -map "$((vocount+1)):v" -map "[a]" -t "$total" \
        -c:v copy -c:a aac -b:a 192k "$OUT/$name.mp4"
    else
      ffmpeg -y -loglevel error "${voargs[@]}" -i "$OUT/$name-silent.mp4" \
        -filter_complex "${vofilter}${mixin}amix=inputs=${vocount}:normalize=0,alimiter=limit=0.95[a]" \
        -map "${vocount}:v" -map "[a]" -t "$total" \
        -c:v copy -c:a aac -b:a 192k "$OUT/$name.mp4"
    fi
    rm -f "$OUT/$name-silent.mp4"
  elif [ -f "$MUSIC" ]; then
    ffmpeg -y -loglevel error -i "$OUT/$name-silent.mp4" -stream_loop -1 -i "$MUSIC" \
      -filter_complex "[1:a]volume=-12dB,atrim=0:${total},afade=t=out:st=${fade}:d=2[a]" \
      -map 0:v -map "[a]" -t "$total" -c:v copy -c:a aac -b:a 160k "$OUT/$name.mp4"
    rm -f "$OUT/$name-silent.mp4"
  else
    mv "$OUT/$name-silent.mp4" "$OUT/$name.mp4"
  fi

  printf "  → %-22s %5.1fs\n" "$name.mp4" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$name.mp4")"
}

echo "building cuts…"

# 120s full tour — every module, all three apps. For the website, a sales page,
# or a walkthrough you send after a demo. Deliberately cross-cuts between the
# back-office and the phones so it never feels like a menu tour of one screen.
build "locare-120s" \
  00-intro:0:4 \
  01-dashboard:0.3:7        13-listings:0.3:7         14-applications:0.3:7 \
  15-documents:0.3:7        02-rent-run:0.3:7         03-payments-unpaid:0.3:7 \
  04-tenant-phone:0.5:7     05-reconcile:2:11          11-tenant-messages:0.5:7 \
  10-tenant-maintenance:0.5:7  12-landlord-tickets:0.5:7  08-landlord-home:0.5:7 \
  09-landlord-statements:0.5:7  06-owner-statement:0.3:7  07-reports:0.4:12 \
  99-outro:0:4

# 90s sales cut — room to breathe; the viewer already asked for a demo.
# Order tells the story across all three apps: agency works in the back-office,
# tenant pays on their phone, owner sees the result on theirs.
build "locare-90s" \
  00-intro:0:3            01-dashboard:0.3:5        02-rent-run:0.3:5 \
  03-payments-unpaid:0.3:5  04-tenant-phone:0.5:5   05-reconcile:2:8 \
  06-owner-statement:0.3:5  08-landlord-home:0.5:5  09-landlord-statements:0.5:5 \
  07-reports:0.4:8          99-outro:0:4

# 45s hero cut — the shape of the story, no detours.
# Hero cut — one screen from each app, so the "three audiences" claim is visible.
build "locare-45s" \
  00-intro:0:3  01-dashboard:0.3:4  02-rent-run:0.3:4  04-tenant-phone:0.5:4 \
  05-reconcile:2:7  08-landlord-home:0.5:4  07-reports:0.4:7  99-outro:0:4

# 30s tenant-app cut — for onboarding an agency's tenants, app-store copy, or
# answering "what do my tenants actually get?". Follows one tenant's month:
# rent due, pay it, log a fault, chase it, check the lease.
build "locare-tenant-30s" \
  00-intro:0:3          04-tenant-phone:0.5:5   16-tenant-pay:0.5:6 \
  10-tenant-maintenance:0.5:5  11-tenant-messages:0.5:5  17-tenant-lease:0.5:5 \
  99-outro:0:3

# 30s landlord-app cut — the agency owner away from their desk: portfolio at a
# glance, approve an application, check work orders, answer a tenant.
build "locare-landlord-30s" \
  00-intro:0:3            08-landlord-home:0.5:7  09-landlord-statements:0.5:6 \
  12-landlord-tickets:0.5:6  18-landlord-messages:0.5:6 \
  99-outro:0:3

# Vertical 1080x1920 versions of the two app cuts. Built from the native portrait
# copies rather than cropping the letterboxed frame, so the phone fills the screen
# at full resolution. No intro/outro cards — those are 16:9 only, and build()
# simply skips any segment it can't find.
if [ -d "$RAW/vert-cap" ]; then
  BUILD_SRC="$RAW/vert-cap" build "locare-tenant-30s-vertical" \
    04-tenant-phone:0.5:5   16-tenant-pay:0.5:6      10-tenant-maintenance:0.5:5 \
    11-tenant-messages:0.5:5  17-tenant-lease:0.5:5

  BUILD_SRC="$RAW/vert-cap" build "locare-landlord-30s-vertical" \
    08-landlord-home:0.5:7  09-landlord-statements:0.5:6 \
    12-landlord-tickets:0.5:6  18-landlord-messages:0.5:6
fi

# 15s social cut — one idea, no dwelling. This is the one you publish.
# Social cut — tenant pays, it reconciles, owner sees it. Three apps in 15s.
build "locare-15s" \
  04-tenant-phone:0.5:3  05-reconcile:2.5:5  08-landlord-home:0.5:3  99-outro:0:3

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
