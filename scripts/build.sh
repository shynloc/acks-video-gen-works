#!/usr/bin/env bash
# Full build: derived assets → sound cues → soundtrack → 1350 frames → MP4s + cover.
#
#   bash scripts/build.sh            (or: npm run build)
#
# Outputs (output/):
#   ACKS-promo-45s-9x16.mp4          H.264 + AAC, soundtrack normalised to -14 LUFS / -1.5 dBTP
#   ACKS-promo-45s-9x16-silent.mp4   same picture, no audio (for platform music)
#   ACKS-promo-cover.png             cover frame (opening headline)
set -euo pipefail
cd "$(dirname "$0")/.."

FFMPEG="$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')"
COVER_FRAME=96 # t = 3.2 s: full opening headline

python3 scripts/prepare_assets.py
node scripts/render.mjs --cues
python3 scripts/music.py
node scripts/render.mjs "$@"

mkdir -p output .cache

# Two-pass EBU R128 loudness normalisation (linear gain, no pumping).
python3 - "$FFMPEG" <<'EOF'
import json, re, subprocess, sys
ffmpeg = sys.argv[1]
target = "I=-14:TP=-1.5:LRA=11"
probe = subprocess.run(
    [ffmpeg, "-hide_banner", "-nostats", "-i", ".cache/music.wav",
     "-af", f"loudnorm={target}:print_format=json", "-f", "null", "-"],
    capture_output=True, text=True, check=True,
).stderr
m = json.loads(re.search(r"\{[^{}]*\}", probe[probe.rfind("[Parsed_loudnorm"):], re.S).group(0))
second = (f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:"
          f"offset={m['target_offset']}:linear=true")
subprocess.run(
    [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", ".cache/music.wav",
     "-af", second, "-ar", "48000", "-c:a", "pcm_s24le", ".cache/music-norm.wav"],
    check=True,
)
print(f"soundtrack: {m['input_i']} LUFS -> -14 LUFS")
EOF

VIDEO_OPTS=(
  -c:v libx264 -preset slow -crf 17 -tune film
  -profile:v high -level:v 4.2 -pix_fmt yuv420p
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv
  -movflags +faststart
)

"$FFMPEG" -y -hide_banner -loglevel error -framerate 30 -i frames/%05d.png -i .cache/music-norm.wav \
  -map 0:v -map 1:a "${VIDEO_OPTS[@]}" -c:a aac -b:a 192k -ar 48000 -shortest \
  -metadata title="ACKS 爱驰科驶 · 驾驭 AI，让技术服务真实工作" \
  output/ACKS-promo-45s-9x16.mp4

"$FFMPEG" -y -hide_banner -loglevel error -framerate 30 -i frames/%05d.png \
  "${VIDEO_OPTS[@]}" -an \
  -metadata title="ACKS 爱驰科驶 · 驾驭 AI，让技术服务真实工作（无声版）" \
  output/ACKS-promo-45s-9x16-silent.mp4

python3 -c "from PIL import Image; Image.open('frames/$(printf '%05d' "$COVER_FRAME").png').convert('RGB').save('output/ACKS-promo-cover.png', optimize=True)"

ls -lh output/*.mp4 output/*.png
