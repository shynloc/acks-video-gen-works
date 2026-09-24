"""Soundtrack for the blog-611 explainer: a quiet lo-fi bed under the narration.

84 BPM in C major (Fmaj9 – Em7 – Dm9 – Cmaj9), arranged by chapter from
timeline.json, plus small foley from .cache/cues.json (rubber stamps, paper on
scene changes, terminal typing). Everything is synthesised here; no samples.

    python3 scripts/music.py
      .cache/music.wav   music + foley only (for the version without narration)
      .cache/mix.wav     narration + ducked music + foley
"""

import json
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
SR = 48_000
TAU = 2 * np.pi
BPM = 84
BEAT = 60 / BPM
BAR = 4 * BEAT
SWING = 0.58  # lo-fi 8th-note swing
rng = np.random.default_rng(611)

timeline = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))
DURATION = timeline["duration"]
N = int(DURATION * SR)


def midi(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def seconds(n):
    return np.arange(int(n * SR)) / SR


def butter(x, kind, freq, order=2):
    return signal.sosfilt(signal.butter(order, freq, btype=kind, fs=SR, output="sos"), x, axis=0)


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, t0, mono, gain=1.0, pan=0.0):
        start = int(round(t0 * SR))
        if start >= N or start < 0:
            return
        n = min(len(mono), N - start)
        a = (pan + 1) * np.pi / 4
        self.x[start : start + n, 0] += mono[:n] * gain * np.cos(a) * np.sqrt(2)
        self.x[start : start + n, 1] += mono[:n] * gain * np.sin(a) * np.sqrt(2)


keys, pad, bass, drums, foley, send = (Bus() for _ in range(6))


# ---------------------------------------------------------------- voices


def ep(freq, dur, vel=1.0):
    """Soft FM electric piano with a slow tremolo."""
    t = seconds(dur + 0.8)
    index = 1.2 * np.exp(-t / 0.25) + 0.15
    y = np.sin(TAU * freq * t + index * np.sin(TAU * freq * t))
    y *= 1 + 0.08 * np.sin(TAU * 4.2 * t)
    env = (1 - np.exp(-t / 0.004)) * np.exp(-t / 1.1)
    env *= np.clip((dur + 0.8 - t) / 0.8, 0, 1) ** 2
    return y * env * vel


def pad_note(freq, dur):
    t = seconds(dur + 1.5)
    y = np.zeros_like(t)
    for cents in (-6, 6):
        f = freq * 2 ** (cents / 1200)
        for k in range(1, 9):
            y += np.sin(TAU * k * f * t + rng.uniform(0, TAU)) / k**1.4 / np.sqrt(1 + (k * f / 900) ** 4)
    env = (1 - np.exp(-t / 0.5)) * np.clip((dur + 1.5 - t) / 1.5, 0, 1) ** 2
    return y * env * 0.25


def bass_note(freq, dur):
    t = seconds(dur + 0.05)
    y = 0.85 * np.sin(TAU * freq * t) + 0.45 * np.sin(TAU * 2 * freq * t) + 0.18 * np.sin(TAU * 3 * freq * t)
    env = (1 - np.exp(-t / 0.01)) * (0.7 + 0.3 * np.exp(-t / 0.3)) * np.clip((dur + 0.05 - t) / 0.05, 0, 1)
    return y * env


def kick(vel=1.0):
    t = seconds(0.45)
    f = 50 + 70 * np.exp(-t / 0.035)
    return np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.2) * vel


def rim(vel=1.0):
    t = seconds(0.25)
    noise = butter(rng.standard_normal(len(t)), "bandpass", [700, 3200]) * np.exp(-t / 0.045)
    tone = np.sin(TAU * 330 * t) * np.exp(-t / 0.03) * 0.5
    return butter((noise + tone) * vel, "lowpass", 5000)


def hat(vel=1.0):
    t = seconds(0.08)
    return butter(rng.standard_normal(len(t)), "bandpass", [6000, 11000]) * np.exp(-t / 0.018) * vel


# ---------------------------------------------------------------- foley


def stamp_thud():
    t = seconds(0.35)
    thud = np.sin(TAU * np.cumsum(95 * (0.6 + 0.4 * np.exp(-t / 0.02))) / SR) * np.exp(-t / 0.07)
    slap = butter(rng.standard_normal(len(t)), "bandpass", [400, 2500]) * np.exp(-t / 0.018) * 0.6
    return thud + slap


def paper(dur=0.45):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    parts = [butter(x, "bandpass", band) for band in ([700, 1600], [1400, 3200], [2600, 6000])]
    shape = np.linspace(0, 1, n)
    y = parts[0] * (1 - shape) + parts[1] * np.minimum(shape, 1 - shape) * 2 + parts[2] * shape
    return y * np.sin(np.linspace(0, np.pi, n)) ** 1.5


def key_click():
    t = seconds(0.03)
    return butter(rng.standard_normal(len(t)), "bandpass", [1800, 5500]) * np.exp(-t / 0.004)


def crackle():
    """Very quiet vinyl crackle and hiss (the scrapbook's paper texture, in sound)."""
    y = butter(rng.standard_normal(N), "lowpass", 5000) * 0.004
    clicks = np.zeros(N)
    idx = rng.integers(0, N, int(DURATION * 6))
    clicks[idx] = rng.uniform(-1, 1, len(idx)) * rng.uniform(0.02, 0.08, len(idx))
    return y + butter(clicks, "bandpass", [800, 6000])


# ---------------------------------------------------------------- arrangement

CHORDS = [  # bass, voicing
    (41, [57, 60, 64, 67]),  # Fmaj9
    (40, [55, 59, 62, 67]),  # Em7
    (38, [57, 60, 64, 65]),  # Dm9
    (36, [55, 59, 62, 64]),  # Cmaj9
]


def section_starts():
    starts = {}
    for scene in timeline["scenes"]:
        starts.setdefault(scene["chapter"], scene["start"])
    ids = {s["id"]: s["start"] for s in timeline["scenes"]}
    q = lambda t: np.ceil(t / BAR - 0.02) * BAR  # noqa: E731 — next bar line
    return {
        "drums_in": q(ids["slop"]),
        "full": q(starts["什么是设计系统"]),
        "systems": q(starts["9 个设计系统"]),
        "table": q(starts["九系统速览"]),
        "guide": q(starts["行动指南"]),
        "outro": q(starts["结语"]),
    }


def arrange():
    s = section_starts()
    bars = int(np.ceil(DURATION / BAR))
    last_bar = int((DURATION - 3.0) // BAR)
    for b in range(bars):
        t0 = b * BAR
        if t0 >= DURATION - 1.0:
            break
        root, voicing = CHORDS[b % 4]
        final = b == last_bar
        table = s["table"] <= t0 < s["guide"]
        outro = t0 >= s["outro"]

        # Pad: always, slightly louder in the reading pause (table).
        for note in voicing:
            pad.add(t0, pad_note(midi(note), BAR * (2.5 if final else 1.0)), 0.9 if table else 0.6)
        # Keys: chord on 1 and the "and" of 2, a small arpeggio on 3–4.
        vel = 0.9 if not outro else 0.7
        for note in voicing:
            keys.add(t0, ep(midi(note), BEAT * (4 if final else 1.4), 0.32 * vel), 1.0, pan=-0.15)
            if not final:
                keys.add(t0 + BEAT * (1 + SWING), ep(midi(note), BEAT * 0.9, 0.22 * vel), 1.0, pan=-0.15)
        if not final and t0 >= s["systems"] and not table:
            for k, step in enumerate((2.0, 2 + SWING, 3.0, 3 + SWING)):
                note = voicing[(k + b) % 4] + 12
                keys.add(t0 + step * BEAT, ep(midi(note), BEAT * 0.6, 0.12), 1.0, pan=0.35)
        send.add(t0, pad_note(midi(voicing[-1]), BAR), 0.15)

        drums_on = t0 >= s["drums_in"] and not table and not (outro and t0 >= s["outro"] + 2 * BAR) and not final
        if drums_on:
            light = t0 < s["full"]
            for step, v in ((0, 1.0), (1 + SWING, 0.55), (2.0, 0.8)):
                drums.add(t0 + step * BEAT, kick(v), 0.9)
            if not light:
                for beat in (1, 3):
                    drums.add(t0 + beat * BEAT, rim(0.8), 0.55, pan=0.1)
            for i in range(8):
                pos = i // 2 + (SWING if i % 2 else 0)
                drums.add(t0 + pos * BEAT, hat(0.5 if i % 2 else 0.8), 0.28 if light else 0.4, pan=0.3)

        if t0 >= s["drums_in"] and not final:
            bass.add(t0, bass_note(midi(root), BEAT * 1.8), 0.55)
            bass.add(t0 + BEAT * (2 + SWING), bass_note(midi(root + 7), BEAT * 1.2), 0.45)
        elif final:
            bass.add(t0, bass_note(midi(root), BAR * 1.2), 0.5)


def place_foley():
    cues = json.loads((ROOT / ".cache" / "cues.json").read_text())
    for cue in cues:
        if cue["kind"] == "stamp":
            foley.add(cue["t"] + 0.15, stamp_thud(), 0.5)
        elif cue["kind"] == "scene" and cue["t"] > 0.1:
            foley.add(cue["t"] + 0.05, paper(), 0.12, pan=rng.uniform(-0.3, 0.3))
        elif cue["kind"] == "type":
            for k in range(int(cue["dur"] * 17)):
                foley.add(cue["t"] + k / 17 + rng.uniform(0, 0.02), key_click(), 0.09 * rng.uniform(0.6, 1.0), pan=0.2)


# ---------------------------------------------------------------- mix


def reverb(x):
    length = int(1.8 * SR)
    t = np.arange(length) / SR
    ir = rng.standard_normal((length, 2)) * np.exp(-t / 0.4)[:, None]
    ir = butter(ir, "lowpass", 4500)
    ir /= np.sqrt((ir**2).sum(axis=0))
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], axis=1)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12)


def voice_envelope(voice):
    """Smoothed speech activity (0..1): fast attack, slow release."""
    hop = 480
    frames = voice[: len(voice) // hop * hop].reshape(-1, hop)
    level = np.sqrt((frames**2).mean(axis=1))
    active = (level > 0.02).astype(float)
    out = np.zeros_like(active)
    for i in range(1, len(active)):
        coef = 0.35 if active[i] > out[i - 1] else 0.035
        out[i] = out[i - 1] + coef * (active[i] - out[i - 1])
    env = np.repeat(out, hop)
    return np.pad(env, (0, max(0, N - len(env))))[:N]


def main():
    arrange()
    place_foley()
    music = keys.x + pad.x + butter(bass.x, "highpass", 35) + drums.x
    music = butter(music, "lowpass", 9000)  # lo-fi warmth
    music += reverb(send.x) * 0.5
    music[:, 0] += crackle()
    music[:, 1] += crackle()
    fade = np.clip((DURATION - 0.3 - np.arange(N) / SR) / 3.0, 0, 1) ** 1.5
    music *= fade[:, None]

    _, voice = wavfile.read(ROOT / ".cache" / "narration.wav")
    voice = voice / 32768.0 if voice.dtype.kind == "i" else voice.astype(np.float64)
    voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]

    # Bed about 19 dB under the voice, dipping 3.5 dB more while speaking.
    speech = voice_envelope(voice)
    target = rms_db(voice[speech > 0.5]) - 19
    music *= 10 ** ((target - rms_db(music)) / 20)
    fx = foley.x * 10 ** ((target + 4 - rms_db(foley.x[np.abs(foley.x).max(axis=1) > 1e-4])) / 20) if foley.x.any() else foley.x
    duck = 10 ** (-3.5 * speech / 20)
    mix = voice[:, None] * np.ones((1, 2)) + music * duck[:, None] + fx
    peak = np.abs(mix).max()
    mix *= 0.9 / peak
    wavfile.write(ROOT / ".cache" / "mix.wav", SR, mix.astype(np.float32))

    alone = music + fx
    alone *= 0.9 / np.abs(alone).max()
    wavfile.write(ROOT / ".cache" / "music.wav", SR, alone.astype(np.float32))
    voice_db = rms_db(voice[speech > 0.5])
    print(
        f"mix {DURATION:.1f} s · voice {voice_db:.1f} dBFS · music {rms_db(music * duck[:, None]):.1f} dBFS"
        f" · foley {rms_db(fx):.1f} dBFS · speaking {100 * (speech > 0.5).mean():.0f}% of the time"
    )


if __name__ == "__main__":
    main()
