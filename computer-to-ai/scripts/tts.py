"""Narration → timeline for “开关的觉醒”.

Synthesises every line of content.json with Kokoro-82M-v1.1-zh (Apache-2.0, CPU),
lays the lines out with fixed pauses, and writes the timeline the page runs on:

    .cache/narration.wav        48 kHz mono
    timeline.json               scenes → lines → subtitle chunks (seconds)
    output/switch-awakening.srt

    ~/.venvs/tts/bin/python scripts/tts.py --voice zm_010 --speed 1.1

Lines are cached by (model, voice, speed, spoken text), so editing one line only
re-synthesises that line. A "|" in a line forces a subtitle break; it is not spoken.
"""

import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

HERE = Path(__file__).resolve().parent.parent
CACHE = HERE / ".cache" / "tts"
MODEL = "hexgrad/Kokoro-82M-v1.1-zh"
RATE_TTS, RATE_OUT = 24_000, 48_000

PAUSE = {"lead": 0.55, "comma": 0.22, "stop": 0.36, "tail": 0.55}
SUB_LIMIT = 17  # subtitle chunk length in “display units”

CJK = r"[㐀-鿿＀-￯　-〿]"


def units(text: str) -> float:
    """Reading length: a Chinese character is 1, a Latin word ~0.45 per letter."""
    latin_words = re.findall(r"[A-Za-z0-9.+#]+", re.sub(CJK, " ", text))
    return len(re.findall(CJK, text)) + 0.45 * sum(len(w) for w in latin_words)


def chunk_subtitles(line: str) -> list[str]:
    """Split a line at punctuation into chunks that fit one subtitle strip."""
    pieces = [p.strip() for p in re.findall(r"[^，。：；？！、,|]+[，。：；？！、,|]?", line) if p.strip()]
    chunks: list[str] = []
    for piece in pieces:
        joinable = chunks and not re.search(r"[。？！：；|]$", chunks[-1])
        if joinable and units(chunks[-1]) + units(piece) <= SUB_LIMIT:
            chunks[-1] += piece
        else:
            chunks.append(piece)
    fitted: list[str] = []
    for chunk in chunks:
        while units(chunk) > SUB_LIMIT + 5:  # still too long: cut near the middle, not inside a word
            cut = len(chunk) // 2
            while cut < len(chunk) and re.match(r"[A-Za-z0-9]", chunk[cut]):
                cut += 1
            fitted.append(chunk[:cut])
            chunk = chunk[cut:]
        fitted.append(chunk)
    return fitted


def on_screen(chunk: str) -> str:
    return re.sub(r"[，。：；、,|]$", "", chunk).strip()


def trim(wav: np.ndarray, floor=0.012, pad=0.04) -> np.ndarray:
    loud = np.nonzero(np.abs(wav) > floor)[0]
    if not len(loud):
        return wav
    a = max(0, loud[0] - int(pad * RATE_TTS))
    b = min(len(wav), loud[-1] + int(pad * 1.6 * RATE_TTS))
    out = wav[a:b].copy()
    ramp = int(0.012 * RATE_TTS)
    out[:ramp] *= np.linspace(0, 1, ramp)
    out[-ramp:] *= np.linspace(1, 0, ramp)
    return out


def make_voice(voice: str, speed: float):
    from kokoro import KModel, KPipeline

    model = KModel(repo_id=MODEL).eval()
    english = KPipeline(lang_code="a", repo_id=MODEL, model=False)
    zh = KPipeline(lang_code="z", repo_id=MODEL, model=model, en_callable=lambda s: next(english(s)).phonemes)
    return lambda text: np.concatenate([np.asarray(r.audio, np.float32) for r in zh(text, voice=voice, speed=speed)])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="zm_010")
    ap.add_argument("--speed", type=float, default=1.1)
    args = ap.parse_args()

    content = json.loads((HERE / "content.json").read_text(encoding="utf-8"))
    say_as = content["tts"]["substitutions"]
    CACHE.mkdir(parents=True, exist_ok=True)

    speak = None
    clock = 0.0
    placed: list[tuple[float, np.ndarray]] = []
    timeline = {"voice": args.voice, "speed": args.speed, "scenes": []}

    for scene in content["scenes"]:
        out = {"id": scene["id"], "chapter": scene["chapter"], "start": round(clock, 3), "lines": []}
        clock += PAUSE["lead"]
        for i, marked in enumerate(scene["lines"]):
            text = marked.replace("|", "")
            spoken = text
            for written, said in say_as.items():
                spoken = spoken.replace(written, said)
            key = hashlib.sha1(f"{MODEL}|{args.voice}|{args.speed}|{spoken}".encode()).hexdigest()[:16]
            wav_path = CACHE / f"{scene['id']}-{i}-{key}.wav"
            if not wav_path.exists():
                speak = speak or make_voice(args.voice, args.speed)
                sf.write(wav_path, trim(speak(spoken)), RATE_TTS)
            wav, _ = sf.read(wav_path, dtype="float32")  # always the 16-bit cached copy
            length = len(wav) / RATE_TTS
            placed.append((clock, wav))

            chunks = chunk_subtitles(marked)
            weights = np.array([max(1.0, units(c)) for c in chunks])
            edges = np.concatenate([[0], np.cumsum(weights) / weights.sum()]) * length
            out["lines"].append(
                {
                    "text": text,
                    "start": round(clock, 3),
                    "end": round(clock + length, 3),
                    "subs": [
                        {"text": on_screen(c), "start": round(clock + a, 3), "end": round(clock + b, 3)}
                        for c, a, b in zip(chunks, edges[:-1], edges[1:])
                    ],
                }
            )
            clock += length
            if i == len(scene["lines"]) - 1:
                clock += PAUSE["tail"]
            else:
                clock += PAUSE["stop"] if re.search(r"[。？！]$", text) else PAUSE["comma"]
        clock += scene.get("hold", 0.0)
        out["end"] = round(clock, 3)
        timeline["scenes"].append(out)

    timeline["duration"] = round(clock + 0.2, 3)
    track = np.zeros(int(timeline["duration"] * RATE_TTS), np.float32)
    for at, wav in placed:
        i = int(round(at * RATE_TTS))
        track[i : i + len(wav)] += wav[: len(track) - i]
    track = resample_poly(track, RATE_OUT, RATE_TTS).astype(np.float32)
    track *= 0.9 / (np.abs(track).max() + 1e-9)
    sf.write(HERE / ".cache" / "narration.wav", track, RATE_OUT)

    (HERE / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    write_srt(timeline)
    speech = sum(l["end"] - l["start"] for s in timeline["scenes"] for l in s["lines"])
    print(f"duration {timeline['duration']:.1f} s · speech {speech:.1f} s")


def write_srt(timeline):
    def stamp(t):
        ms = int(round(t * 1000))
        return f"{ms // 3_600_000:02d}:{ms // 60_000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

    subs = [s for sc in timeline["scenes"] for l in sc["lines"] for s in l["subs"]]
    body = "\n".join(f"{n}\n{stamp(s['start'])} --> {stamp(s['end'])}\n{s['text']}\n" for n, s in enumerate(subs, 1))
    (HERE / "output").mkdir(exist_ok=True)
    (HERE / "output" / "switch-awakening.srt").write_text(body, encoding="utf-8")


if __name__ == "__main__":
    main()
