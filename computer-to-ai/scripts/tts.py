"""Narration for the “开关的觉醒” video: Kokoro-82M-v1.1-zh (Apache-2.0), CPU.

Each narration line in content.json is synthesised on its own (cached by text,
voice and speed), trimmed of silence and laid out with fixed pauses. The line
timings drive the whole picture timeline:

    .cache/narration.wav   48 kHz mono narration
    timeline.json          scenes → lines → subtitle chunks, in seconds
    output/*.srt           subtitles

    ~/.venvs/tts/bin/python scripts/tts.py --voice zf_001 --speed 1.25
"""

import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "tts"
SR_TTS = 24_000
SR_OUT = 48_000
REPO = "hexgrad/Kokoro-82M-v1.1-zh"

LEAD_IN = 0.55  # visuals settle before the first line of a scene
GAP_COMMA = 0.22  # after a line ending in ， or ：
GAP_STOP = 0.36  # after a line ending in 。？！
SCENE_TAIL = 0.55  # after the last line of a scene
SUB_MAX = 17  # subtitle chunk length (display units)


def display_len(text: str) -> float:
    """Chinese characters count 1, Latin words ~2 (they read faster than they look)."""
    cjk = len(re.findall(r"[㐀-鿿＀-￯　-〿]", text))
    latin = re.sub(r"[㐀-鿿＀-￯　-〿]", " ", text)
    return cjk + sum(0.45 * len(w) for w in re.findall(r"[A-Za-z0-9.+#]+", latin))


def split_subtitles(line: str) -> list[str]:
    """Split a narration line into short subtitle chunks at natural pauses.

    A "|" in the line forces a break there; it is neither spoken nor shown.
    """
    parts = re.findall(r"[^，。：；？！、,|]+[，。：；？！、,|]?", line)
    chunks: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if chunks and display_len(chunks[-1]) + display_len(part) <= SUB_MAX and not re.search(
            r"[。？！：；|]$", chunks[-1]
        ):
            chunks[-1] += part
        else:
            chunks.append(part)
    # Hard-wrap anything still too long at a word boundary.
    out: list[str] = []
    for chunk in chunks:
        while display_len(chunk) > SUB_MAX + 5:
            cut = len(chunk) // 2
            while cut < len(chunk) and re.match(r"[A-Za-z0-9]", chunk[cut]):
                cut += 1
            out.append(chunk[:cut])
            chunk = chunk[cut:]
        out.append(chunk)
    return out


def clean_for_subtitle(chunk: str) -> str:
    # Trailing commas, full stops and break marks are dropped on screen; question marks stay.
    return re.sub(r"[，。：；、,|]$", "", chunk).strip()


def trim_silence(wav: np.ndarray, threshold=0.012, pad=0.04) -> np.ndarray:
    level = np.abs(wav)
    idx = np.nonzero(level > threshold)[0]
    if len(idx) == 0:
        return wav
    start = max(0, idx[0] - int(pad * SR_TTS))
    end = min(len(wav), idx[-1] + int(pad * 1.6 * SR_TTS))
    out = wav[start:end].copy()
    fade = int(0.012 * SR_TTS)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out


class Voice:
    def __init__(self, voice: str, speed: float):
        from kokoro import KModel, KPipeline

        self.voice, self.speed = voice, speed
        model = KModel(repo_id=REPO).eval()
        english = KPipeline(lang_code="a", repo_id=REPO, model=False)
        self.pipeline = KPipeline(
            lang_code="z",
            repo_id=REPO,
            model=model,
            en_callable=lambda text: next(english(text)).phonemes,
        )

    def __call__(self, text: str) -> np.ndarray:
        chunks = [np.asarray(r.audio, dtype=np.float32) for r in self.pipeline(text, voice=self.voice, speed=self.speed)]
        return np.concatenate(chunks)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="zf_001")
    ap.add_argument("--speed", type=float, default=1.25)
    ap.add_argument("--only", help="comma-separated scene ids (for auditioning)")
    args = ap.parse_args()

    content = json.loads((ROOT / "content.json").read_text(encoding="utf-8"))
    subs = content["tts"]["substitutions"]
    scenes = content["scenes"]
    if args.only:
        keep = set(args.only.split(","))
        scenes = [s for s in scenes if s["id"] in keep]

    CACHE.mkdir(parents=True, exist_ok=True)
    engine = None
    t = 0.0
    pieces: list[tuple[float, np.ndarray]] = []
    timeline = {"voice": args.voice, "speed": args.speed, "scenes": []}

    for scene in scenes:
        entry = {"id": scene["id"], "chapter": scene["chapter"], "start": round(t, 3), "lines": []}
        t += LEAD_IN
        for i, marked in enumerate(scene["lines"]):
            line = marked.replace("|", "")
            spoken = line
            for src, dst in subs.items():
                spoken = spoken.replace(src, dst)
            key = hashlib.sha1(f"{REPO}|{args.voice}|{args.speed}|{spoken}".encode()).hexdigest()[:16]
            path = CACHE / f"{scene['id']}-{i}-{key}.wav"
            if not path.exists():
                if engine is None:
                    engine = Voice(args.voice, args.speed)
                sf.write(path, trim_silence(engine(spoken)), SR_TTS)
            # Always use the (16-bit) cached copy, so a fresh synthesis and a
            # cached rebuild give bit-identical narration.
            wav, _ = sf.read(path, dtype="float32")
            duration = len(wav) / SR_TTS
            pieces.append((t, wav))

            chunks = split_subtitles(marked)
            weights = np.array([max(1.0, display_len(c)) for c in chunks])
            bounds = np.concatenate([[0], np.cumsum(weights) / weights.sum()]) * duration
            entry["lines"].append(
                {
                    "text": line,
                    "start": round(t, 3),
                    "end": round(t + duration, 3),
                    "subs": [
                        {"text": clean_for_subtitle(c), "start": round(t + a, 3), "end": round(t + b, 3)}
                        for c, a, b in zip(chunks, bounds[:-1], bounds[1:])
                    ],
                }
            )
            t += duration
            last = i == len(scene["lines"]) - 1
            t += SCENE_TAIL if last else (GAP_STOP if re.search(r"[。？！]$", line) else GAP_COMMA)
        t += scene.get("hold", 0.0)
        entry["end"] = round(t, 3)
        timeline["scenes"].append(entry)

    timeline["duration"] = round(t + 0.2, 3)
    total = int(timeline["duration"] * SR_TTS)
    mix = np.zeros(total, dtype=np.float32)
    for start, wav in pieces:
        i = int(round(start * SR_TTS))
        mix[i : i + len(wav)] += wav[: total - i]
    mix = resample_poly(mix, SR_OUT, SR_TTS).astype(np.float32)
    peak = np.max(np.abs(mix)) + 1e-9
    mix *= 0.9 / peak
    out = ROOT / ".cache" / "narration.wav"
    sf.write(out, mix, SR_OUT)

    (ROOT / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    write_srt(timeline)
    spoken_chars = sum(len(re.sub(r"\s", "", l["text"])) for s in timeline["scenes"] for l in s["lines"])
    speech = sum(l["end"] - l["start"] for s in timeline["scenes"] for l in s["lines"])
    print(f"duration {timeline['duration']:.1f} s · speech {speech:.1f} s · {spoken_chars / speech:.2f} chars/s")


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(timeline):
    rows = [s for scene in timeline["scenes"] for line in scene["lines"] for s in line["subs"]]
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    text = "\n".join(f"{k}\n{srt_time(r['start'])} --> {srt_time(r['end'])}\n{r['text']}\n" for k, r in enumerate(rows, 1))
    (out / "switch-awakening.srt").write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
