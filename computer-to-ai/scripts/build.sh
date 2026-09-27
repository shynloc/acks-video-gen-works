#!/usr/bin/env bash
# Build “开关的觉醒” (computer history → AI, 9:16).
#
#   bash computer-to-ai/scripts/build.sh          reuse timeline.json + cached narration
#   bash computer-to-ai/scripts/build.sh --tts    re-synthesise the narration first
#
# Outputs (computer-to-ai/output/):
#   switch-awakening-9x16.mp4          narration + music, -14 LUFS
#   switch-awakening-9x16-novoice.mp4  subtitles + music only
#   switch-awakening.srt               subtitles
#   switch-awakening-cover.png         cover frame (title card)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
cd "$REPO"

FFMPEG="$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')"
TTS_PY="${TTS_PY:-$HOME/.venvs/tts/bin/python}"
NAME=switch-awakening
PROJECT=computer-to-ai

if [[ "${1:-}" == "--tts" || ! -f "$HERE/.cache/narration.wav" ]]; then
  "$TTS_PY" "$HERE/scripts/tts.py" --voice zm_010 --speed 1.1
fi
node "$HERE/scripts/check_subs.mjs"  # fails fast if a subtitle is wider than its strip
node scripts/render.mjs --project "$PROJECT" --cues
python3 "$HERE/scripts/music.py"

VIDEO=(
  -c:v libx264 -preset slow -crf 21 -tune film
  -profile:v high -level:v 4.2 -pix_fmt yuv420p
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv
)

# Frames are big PNGs (film grain, CRT scanlines): render and encode one minute
# at a time so only one chunk is ever on disk, then join without re-encoding.
TOTAL=$(python3 -c 'import json, sys; print(round(json.load(open(sys.argv[1]))["duration"] * 30))' "$HERE/timeline.json")
CHUNK=1800
SEGMENTS="$HERE/.cache/segments"
rm -rf "$SEGMENTS"
mkdir -p "$SEGMENTS"
for ((from = 0; from < TOTAL; from += CHUNK)); do
  to=$((from + CHUNK < TOTAL ? from + CHUNK : TOTAL))
  name=$(printf %05d "$from").mp4
  rm -rf "$HERE/frames"
  node scripts/render.mjs --project "$PROJECT" --workers 4 --from "$from" --to "$to"
  "$FFMPEG" -y -hide_banner -loglevel error -framerate 30 -start_number "$from" -i "$HERE/frames/%05d.png" \
    -frames:v "$((to - from))" "${VIDEO[@]}" -an "$SEGMENTS/$name"
  echo "file '$name'" >> "$SEGMENTS/list.txt"
done
rm -rf "$HERE/frames"

mkdir -p "$HERE/output"

# Two-pass EBU R128 normalisation to -14 LUFS / -1.5 dBTP.
normalise() {
  python3 - "$FFMPEG" "$1" "$2" <<'EOF'
import json, re, subprocess, sys
ffmpeg, src, dst = sys.argv[1:]
target = "I=-14:TP=-1.5:LRA=11"
log = subprocess.run([ffmpeg, "-hide_banner", "-nostats", "-i", src, "-af", f"loudnorm={target}:print_format=json", "-f", "null", "-"],
                     capture_output=True, text=True, check=True).stderr
m = json.loads(re.search(r"\{[^{}]*\}", log[log.rfind("[Parsed_loudnorm"):], re.S).group(0))
second = (f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", src, "-af", second, "-ar", "48000", "-c:a", "pcm_s24le", dst], check=True)
print(f"{src}: {m['input_i']} LUFS -> -14 LUFS")
EOF
}
normalise "$HERE/.cache/mix.wav" "$HERE/.cache/mix-norm.wav"
normalise "$HERE/.cache/music.wav" "$HERE/.cache/music-norm.wav"

# Both variants share the video stream; only the audio differs. The mix can end
# a few ms off the last frame: pad and trim it to exactly the video's length
# (1600 samples per frame at 48 kHz) instead of -shortest, which drops frames.
SAMPLES=$((TOTAL * 1600))
for variant in voice novoice; do
  audio="$HERE/.cache/mix-norm.wav"
  out="$HERE/output/$NAME-9x16.mp4"
  title="开关的觉醒 · 从图灵纸带到大模型"
  if [[ $variant == novoice ]]; then
    audio="$HERE/.cache/music-norm.wav"
    out="$HERE/output/$NAME-9x16-novoice.mp4"
    title="$title（无旁白版）"
  fi
  "$FFMPEG" -y -hide_banner -loglevel error -f concat -i "$SEGMENTS/list.txt" -i "$audio" \
    -map 0:v -map 1:a -c:v copy -af "apad=whole_len=$SAMPLES,atrim=end_sample=$SAMPLES" \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart \
    -metadata title="$title"  "$out"
done

# Cover: the title card, just before the opening scene hands over to 1936.
COVER_T=$(python3 - "$HERE/timeline.json" <<'EOF'
import json, sys
timeline = json.load(open(sys.argv[1], encoding="utf-8"))
cold = next(s for s in timeline["scenes"] if s["id"] == "cold")
print(round((cold["end"] - 0.3) * 30) / 30)
EOF
)
still=$(node scripts/render.mjs --project "$PROJECT" --stills "$COVER_T" | tail -n 1)
python3 -c 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], optimize=True)' \
  "$still" "$HERE/output/$NAME-cover.png"
ls -lh "$HERE/output"
