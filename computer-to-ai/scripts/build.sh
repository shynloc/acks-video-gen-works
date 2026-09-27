#!/usr/bin/env bash
# Full build of “开关的觉醒”. Self-contained: run from anywhere, uses only this folder.
#
#   bash scripts/build.sh          reuse cached narration (.cache/narration.wav) if present
#   bash scripts/build.sh --tts    re-synthesise the narration first
#
# Needs: npm install (fonts, emoji, Playwright), pip install -r requirements.txt,
# and for narration a venv from requirements-tts.txt (TTS_PY, default ~/.venvs/tts).
#
# Writes output/:
#   switch-awakening-9x16.mp4          narration + music + subtitles, -14 LUFS
#   switch-awakening-9x16-novoice.mp4  music + subtitles only
#   switch-awakening.srt               subtitles
#   switch-awakening-cover.png         title card
set -euo pipefail
cd "$(dirname "$0")/.."

NAME=switch-awakening
TITLE="开关的觉醒 · 从图灵纸带到大模型"
FFMPEG="$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')"
TTS_PY="${TTS_PY:-$HOME/.venvs/tts/bin/python}"
FPS=30
CHUNK=1800 # frames rendered + encoded per round, so disk only ever holds one minute of PNGs

# 1. Narration → timeline.json, then checks and sound.
if [[ "${1:-}" == "--tts" || ! -f .cache/narration.wav ]]; then
  "$TTS_PY" scripts/tts.py --voice zm_010 --speed 1.1
fi
node scripts/check_subs.mjs
node scripts/render.mjs --cues
python3 scripts/music.py

# 2. Picture, one chunk at a time.
TOTAL=$(python3 -c "import json; print(round(json.load(open('timeline.json'))['duration'] * $FPS))")
X264=(-c:v libx264 -preset slow -crf 21 -tune film -profile:v high -level:v 4.2 -pix_fmt yuv420p
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv)
PARTS=.cache/parts
rm -rf "$PARTS" frames
mkdir -p "$PARTS"
for ((a = 0; a < TOTAL; a += CHUNK)); do
  b=$((a + CHUNK < TOTAL ? a + CHUNK : TOTAL))
  node scripts/render.mjs --from "$a" --to "$b"
  part=$(printf 'part-%05d.mp4' "$a")
  "$FFMPEG" -y -hide_banner -loglevel error -framerate $FPS -start_number "$a" -i frames/%05d.png \
    -frames:v $((b - a)) "${X264[@]}" -an "$PARTS/$part"
  echo "file '$part'" >> "$PARTS/list.txt"
  rm -rf frames
done

# 3. Loudness: two-pass EBU R128 to -14 LUFS / -1.5 dBTP (linear gain).
loudnorm() {
  python3 - "$FFMPEG" "$1" "$2" <<'PY'
import json, re, subprocess, sys
ffmpeg, src, dst = sys.argv[1:]
spec = "I=-14:TP=-1.5:LRA=11"
log = subprocess.run([ffmpeg, "-hide_banner", "-nostats", "-i", src, "-af", f"loudnorm={spec}:print_format=json", "-f", "null", "-"],
                     capture_output=True, text=True, check=True).stderr
m = json.loads(re.findall(r"\{[^{}]+\}", log)[-1])
af = (f"loudnorm={spec}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", src, "-af", af, "-ar", "48000", "-c:a", "pcm_s24le", dst], check=True)
print(f"{src}: {m['input_i']} → -14 LUFS")
PY
}
loudnorm .cache/mix.wav .cache/mix-14.wav
loudnorm .cache/music.wav .cache/music-14.wav

# 4. Mux. Audio is padded/trimmed to exactly the picture length (1600 samples a frame).
SAMPLES=$((TOTAL * 48000 / FPS))
mux() {
  "$FFMPEG" -y -hide_banner -loglevel error -f concat -i "$PARTS/list.txt" -i "$1" \
    -map 0:v -map 1:a -c:v copy -af "apad=whole_len=$SAMPLES,atrim=end_sample=$SAMPLES" \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -metadata title="$3" "$2"
}
mkdir -p output
mux .cache/mix-14.wav "output/$NAME-9x16.mp4" "$TITLE"
mux .cache/music-14.wav "output/$NAME-9x16-novoice.mp4" "$TITLE（无旁白版）"

# 5. Cover: the title card, just before 1936 takes over.
T=$(python3 -c "import json; s = next(s for s in json.load(open('timeline.json'))['scenes'] if s['id'] == 'cold'); print(round((s['end'] - 0.3) * $FPS) / $FPS)")
still=$(node scripts/render.mjs --stills "$T" | tail -n 1)
python3 -c 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], optimize=True)' "$still" "output/$NAME-cover.png"
ls -lh output/*.mp4 output/*.png output/*.srt
