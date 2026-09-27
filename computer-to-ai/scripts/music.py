"""Soundtrack for “开关的觉醒”: one leitmotif, re-orchestrated for every era.

The same four-bar theme (A minor: Am – F – C – G, 96 BPM) is played by the
instruments of each scene's time — a music box on Turing's paper, a valve radio
for ENIAC, clean plucks on the blueprint, an analogue synth for Apollo, square
waves for the 8-bit desk, a General-MIDI-ish electric piano for the web,
marimba for the phone, pads for neural networks, a plucked zither for Go, and
piano + strings for the language-model era and the finale. Foley comes from
.cache/cues.json (written by the page). Everything is synthesised here.

    python3 computer-to-ai/scripts/music.py
      .cache/music.wav   music + foley only (version without narration)
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
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(1936)

timeline = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))
DURATION = timeline["duration"]
N = int(DURATION * SR)
SCENES = {s["id"]: s for s in timeline["scenes"]}

# Theme: (beat, midi, beats) over a 4-bar phrase.
THEME = [
    (0, 76, 1), (1, 81, 1), (2, 83, 0.5), (2.5, 84, 1.5),
    (4, 84, 1), (5, 83, 0.5), (5.5, 81, 0.5), (6, 77, 2),
    (8, 79, 1), (9, 84, 1), (10, 83, 1), (11, 79, 1),
    (12, 83, 1.5), (13.5, 81, 0.5), (14, 79, 2),
]
CHORDS = [(57, 60, 64), (53, 57, 60), (55, 60, 64), (55, 59, 62)]
ROOTS = [45, 41, 48, 43]


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def secs(d):
    return np.arange(max(1, int(d * SR))) / SR


def butter(x, kind, freq, order=2):
    return signal.sosfilt(signal.butter(order, freq, btype=kind, fs=SR, output="sos"), x, axis=0)


def env_adsr(t, dur, a=0.005, d=0.1, s=0.7, r=0.1):
    e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    return e * np.clip((dur + r - t) / r, 0, 1)


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, t0, mono, gain=1.0, pan=0.0):
        start = int(round(t0 * SR))
        if start >= N or start + len(mono) <= 0:
            return
        if start < 0:
            mono = mono[-start:]
            start = 0
        n = min(len(mono), N - start)
        a = (pan + 1) * np.pi / 4
        self.x[start : start + n, 0] += mono[:n] * gain * np.cos(a) * np.sqrt(2)
        self.x[start : start + n, 1] += mono[:n] * gain * np.sin(a) * np.sqrt(2)


music, send, foley = Bus(), Bus(), Bus()

# ---------------------------------------------------------------- instruments


def music_box(f, dur):
    t = secs(1.6)
    y = np.sin(TAU * f * t) + 0.35 * np.sin(TAU * 4.02 * f * t) * np.exp(-t / 0.15) + 0.2 * np.sin(TAU * 6.8 * f * t) * np.exp(-t / 0.08)
    return y * np.exp(-t / 0.55) * (1 - np.exp(-t / 0.002))


def organ(f, dur):
    t = secs(dur + 0.15)
    y = sum(np.sin(TAU * k * f * t) / k for k in (1, 2, 3, 4, 6))
    y *= 1 + 0.05 * np.sin(TAU * 5.5 * t)
    return y * env_adsr(t, dur, 0.02, 0.2, 0.8, 0.15) * 0.5


def pluck(f, dur, bright=3.0):
    t = secs(dur + 0.6)
    y = sum(np.sin(TAU * k * f * t) * np.exp(-t * k * bright) / k for k in range(1, 6))
    return y * np.exp(-t / 0.6) * (1 - np.exp(-t / 0.002))


def saw(f, t, detune=0.0):
    ph = (f * (1 + detune) * t) % 1.0
    return 2 * ph - 1


def analog(f, dur):
    t = secs(dur + 0.3)
    y = saw(f, t) + saw(f, t, 0.006)
    y = butter(y, "lowpass", min(6000, f * 5))
    return y * env_adsr(t, dur, 0.01, 0.3, 0.6, 0.3) * 0.35


def square(f, dur, duty=0.5, vol=1.0):
    t = secs(dur)
    y = np.where((f * t) % 1.0 < duty, 1.0, -1.0)
    return y * np.clip((dur - t) / 0.01, 0, 1) * vol * 0.3


def triangle(f, dur):
    t = secs(dur)
    y = 2 * np.abs(2 * ((f * t) % 1.0) - 1) - 1
    return y * np.clip((dur - t) / 0.01, 0, 1) * 0.5


def epiano(f, dur):
    t = secs(dur + 0.8)
    index = 1.4 * np.exp(-t / 0.3) + 0.2
    y = np.sin(TAU * f * t + index * np.sin(TAU * f * t))
    return y * (1 - np.exp(-t / 0.003)) * np.exp(-t / 1.0) * np.clip((dur + 0.8 - t) / 0.8, 0, 1) ** 2


def marimba(f, dur):
    t = secs(0.9)
    y = np.sin(TAU * f * t) + 0.3 * np.sin(TAU * 4 * f * t) * np.exp(-t / 0.04)
    return y * np.exp(-t / 0.25) * (1 - np.exp(-t / 0.001))


def pad_note(f, dur, bright=900):
    t = secs(dur + 1.5)
    y = np.zeros_like(t)
    for cents in (-7, 0, 7):
        ff = f * 2 ** (cents / 1200)
        for k in range(1, 9):
            y += np.sin(TAU * k * ff * t + rng.uniform(0, TAU)) / k**1.3 / np.sqrt(1 + (k * ff / bright) ** 4)
    return y * (1 - np.exp(-t / 0.6)) * np.clip((dur + 1.5 - t) / 1.5, 0, 1) ** 2 * 0.18


def zither(f, dur):
    # Karplus–Strong.
    n = int(SR / f)
    buf = rng.uniform(-1, 1, n)
    out = np.zeros(int(SR * 2.2))
    for i in range(len(out)):
        out[i] = buf[i % n]
        buf[i % n] = 0.5 * (buf[i % n] + buf[(i + 1) % n]) * 0.996
    t = np.arange(len(out)) / SR
    return out * np.exp(-t / 1.1)


def piano(f, dur):
    t = secs(dur + 1.4)
    y = sum(np.sin(TAU * k * f * t * (1 + 0.0004 * k * k)) * np.exp(-t * (0.6 + 0.9 * k)) / k**1.1 for k in range(1, 8))
    return y * (1 - np.exp(-t / 0.002)) * np.clip((dur + 1.4 - t) / 0.4, 0, 1)


def sub(f, dur):
    t = secs(dur)
    return np.sin(TAU * f * t) * env_adsr(t, dur, 0.02, 0.3, 0.8, 0.2)


def kick(v=1.0):
    t = secs(0.4)
    f = 48 + 90 * np.exp(-t / 0.03)
    return np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.18) * v


def noise_hit(dur, lo, hi, decay, v=1.0):
    t = secs(dur)
    return butter(rng.standard_normal(len(t)), "bandpass", [lo, hi]) * np.exp(-t / decay) * v


def hat(v=1.0):
    return noise_hit(0.06, 6000, 12000, 0.015, v)


def clap(v=1.0):
    return noise_hit(0.2, 900, 3000, 0.05, v)


# ---------------------------------------------------------------- arrangement


def phrase_times(scene, start_pad=0.1):
    """Bar grid for a scene: bars starting at scene start (+ pad) until its end."""
    t0 = scene["start"] + start_pad
    end = scene["end"] + 0.5
    bars = []
    k = 0
    while t0 + k * BAR < end:
        bars.append((t0 + k * BAR, k))
        k += 1
    return bars, end


def theme_notes(t0, k, transpose=0):
    """Theme notes falling in bar k (the phrase repeats every 4 bars)."""
    bar = k % 4
    for beat, note, beats in THEME:
        if bar * 4 <= beat < bar * 4 + 4:
            yield t0 + (beat - bar * 4) * BEAT, note + transpose, beats * BEAT


def arrange():
    for sid, scene in SCENES.items():
        bars, end = phrase_times(scene)
        for t0, k in bars:
            bar = k % 4
            chord = CHORDS[bar]
            root = ROOTS[bar]
            def clip(t):
                return t < end

            if sid == "cold":
                # A drone, and the theme's first notes as lone beeps near the title.
                if k == 0:
                    music.add(t0, pad_note(midi(45), scene["end"] - t0, 400), 0.9)
                continue

            if sid == "turing":
                for t, n, d in theme_notes(t0, k, 12):
                    if clip(t):
                        music.add(t, music_box(midi(n), d), 0.35, pan=0.2)
                        send.add(t, music_box(midi(n), d), 0.25)
                for i, n in enumerate(chord):
                    if clip(t0 + i * BEAT):
                        music.add(t0 + (i * 1.33) * BEAT, music_box(midi(n + 12), BEAT), 0.12, pan=-0.3)

            elif sid == "eniac":
                for t, n, d in theme_notes(t0, k, -12):
                    if clip(t):
                        music.add(t, organ(midi(n), d), 0.42)
                if clip(t0):
                    music.add(t0, sum(organ(midi(n - 12), BAR) for n in chord), 0.12)
                    music.add(t0, sub(midi(root - 12), BAR * 0.95), 0.3)

            elif sid == "chip":
                for i in range(8):
                    t = t0 + i * BEAT / 2
                    n = chord[i % 3] + (12 if i % 4 == 3 else 0)
                    if clip(t):
                        music.add(t, pluck(midi(n + 12), BEAT / 2), 0.14, pan=0.35 if i % 2 else -0.35)
                        send.add(t, pluck(midi(n + 12), BEAT / 2), 0.06)
                if k >= 2:
                    for t, n, d in theme_notes(t0, k):
                        if clip(t):
                            music.add(t, pluck(midi(n), d, 1.5), 0.22)
                if clip(t0):
                    music.add(t0, sub(midi(root), BAR * 0.9), 0.35)

            elif sid == "moon":
                if clip(t0):
                    music.add(t0, sum(analog(midi(n), BAR * 0.95) for n in chord), 0.22)
                    music.add(t0, analog(midi(root - 12), BAR * 0.9), 0.35)
                for t, n, d in theme_notes(t0, k):
                    if clip(t) and k % 2 == 1:
                        music.add(t, analog(midi(n), d), 0.25)
                        send.add(t, analog(midi(n), d), 0.12)
                for i in range(4):
                    t = t0 + (i + 0.5) * BEAT
                    if clip(t) and rng.random() < 0.6:
                        music.add(t, square(midi(96 + rng.integers(0, 12)), 0.05, vol=0.4), 0.2, pan=rng.uniform(-0.6, 0.6))

            elif sid == "pc":
                for t, n, d in theme_notes(t0, k):
                    if clip(t):
                        music.add(t, square(midi(n), d * 0.9, 0.25), 0.45)
                for i in range(16):
                    t = t0 + i * BEAT / 4
                    if clip(t):
                        music.add(t, square(midi(chord[i % 3] + 12), BEAT / 4 * 0.8, 0.125), 0.18)
                for i in range(8):
                    t = t0 + i * BEAT / 2
                    if clip(t):
                        music.add(t, triangle(midi(root - 12 + (12 if i % 2 else 0)), BEAT / 2 * 0.9), 0.5)
                for i in range(4):
                    t = t0 + i * BEAT
                    if clip(t):
                        music.add(t, noise_hit(0.08, 200, 3000, 0.03 if i % 2 == 0 else 0.06), 0.5 if i % 2 else 0.8)

            elif sid == "web":
                for t, n, d in theme_notes(t0, k):
                    if clip(t):
                        music.add(t, epiano(midi(n), d), 0.3)
                        send.add(t, epiano(midi(n), d), 0.1)
                if clip(t0):
                    for n in chord:
                        music.add(t0, epiano(midi(n), BAR * 0.9), 0.12)
                for i in range(8):
                    t = t0 + i * BEAT / 2
                    if not clip(t):
                        continue
                    if i in (0, 3, 4):
                        music.add(t, kick(0.8), 0.5)
                    if i in (2, 6):
                        music.add(t, clap(0.8), 0.35)
                    music.add(t, hat(0.6), 0.2, pan=0.3)
                    if i % 2 == 0:
                        music.add(t, bass_pick(midi(root - 12), BEAT / 2), 0.35)

            elif sid == "phone":
                for i in range(8):
                    t = t0 + i * BEAT / 2
                    if clip(t):
                        n = chord[(i * 2) % 3] + 12
                        music.add(t, marimba(midi(n), 0.3), 0.25, pan=-0.3 if i % 2 else 0.3)
                for t, n, d in theme_notes(t0, k):
                    if clip(t):
                        music.add(t, marimba(midi(n + 12), d), 0.3)
                        send.add(t, marimba(midi(n + 12), d), 0.1)
                for i in range(4):
                    t = t0 + i * BEAT
                    if clip(t):
                        music.add(t, kick(0.7) if i % 2 == 0 else clap(0.7), 0.4)
                if clip(t0):
                    music.add(t0, sub(midi(root - 12), BAR * 0.9), 0.3)

            elif sid == "neural":
                if clip(t0):
                    music.add(t0, sum(pad_note(midi(n), BAR, 1400) for n in chord), 0.7)
                    send.add(t0, sum(pad_note(midi(n + 12), BAR, 2000) for n in chord), 0.2)
                    music.add(t0, sub(midi(root - 12), BAR * 0.95), 0.35)
                for i in range(8):
                    t = t0 + i * BEAT / 2
                    if clip(t) and k >= 2:
                        music.add(t, pluck(midi(chord[i % 3] + 24), 0.2, 5), 0.07, pan=np.sin(i))
                        send.add(t, pluck(midi(chord[i % 3] + 24), 0.2, 5), 0.06)

            elif sid == "go":
                for t, n, d in theme_notes(t0, k, -12):
                    if clip(t):
                        # Fold onto the A-minor pentatonic (A C D E G).
                        m = n if (n % 12) in (9, 0, 2, 4, 7) else n - 1
                        z = zither(midi(m), d)
                        music.add(t, z, 0.35, pan=-0.1)
                        send.add(t, z, 0.25)
                if clip(t0):
                    music.add(t0, pad_note(midi(root), BAR, 500), 0.4)

            elif sid in ("llm", "finale"):
                last = sid == "finale" and t0 > SCENES["finale"]["lines"][-1]["start"] - 1
                for t, n, d in theme_notes(t0, k, -12):
                    if clip(t):
                        music.add(t, piano(midi(n), d), 0.3)
                        send.add(t, piano(midi(n), d), 0.15)
                if clip(t0):
                    for i, n in enumerate(chord):
                        music.add(t0 + i * BEAT * 0.5, piano(midi(n - 12), BAR - i * BEAT * 0.5), 0.1)
                    strings = sum(pad_note(midi(n), BAR, 1800 if sid == "finale" else 1100) for n in chord)
                    music.add(t0, strings, 0.5 if sid == "finale" else 0.3)
                    send.add(t0, strings, 0.2)
                    music.add(t0, sub(midi(root - 12), BAR * 0.95), 0.35)
                if sid == "llm" and k >= 1:
                    for i in range(8):
                        t = t0 + i * BEAT / 2
                        if clip(t):
                            music.add(t, hat(0.5), 0.12, pan=0.3)
                            if i in (0, 4):
                                music.add(t, kick(0.6), 0.3)
                if last:
                    break


def bass_pick(f, dur):
    t = secs(dur)
    y = np.sin(TAU * f * t) + 0.4 * np.sin(TAU * 2 * f * t) * np.exp(-t / 0.05)
    return y * np.exp(-t / 0.4) * np.clip((dur - t) / 0.02, 0, 1)


# ---------------------------------------------------------------- foley


def mixp(*parts):
    """Sum mono clips of different lengths."""
    out = np.zeros(max(len(p) for p in parts))
    for p in parts:
        out[: len(p)] += p
    return out


def click():
    t = secs(0.05)
    return noise_hit(0.05, 1500, 7000, 0.004, 1.0) + np.sin(TAU * 2200 * t) * np.exp(-t / 0.006) * 0.5


def thunk():
    t = secs(0.3)
    return np.sin(TAU * np.cumsum(90 * (0.6 + 0.4 * np.exp(-t / 0.02))) / SR) * np.exp(-t / 0.08) + noise_hit(0.3, 300, 1500, 0.02, 0.5)


def blip(f=1320, d=0.08, wave="sine"):
    t = secs(d)
    y = np.sin(TAU * f * t) if wave == "sine" else np.where((f * t) % 1 < 0.5, 1.0, -1.0) * 0.5
    return y * np.clip((d - t) / 0.01, 0, 1) * np.clip(t / 0.002, 0, 1)


def scratch(d):
    t = secs(d)
    mod = 0.5 + 0.5 * np.abs(np.sin(TAU * 3.5 * t + rng.uniform(0, 3)))
    return butter(rng.standard_normal(len(t)), "bandpass", [2500, 7000]) * mod * np.clip(t / 0.05, 0, 1) * np.clip((d - t) / 0.08, 0, 1)


def whoosh(d=0.6):
    t = secs(d)
    x = rng.standard_normal(len(t))
    y = np.zeros_like(x)
    # Sweep a bandpass upward in chunks.
    chunks = 12
    for i in range(chunks):
        a, b = i * len(t) // chunks, (i + 1) * len(t) // chunks
        f = 300 + 3000 * (i / chunks) ** 2
        y[a:b] = butter(x[a:b], "bandpass", [f, f * 2])
    return y * np.sin(np.pi * t / d) ** 2


def rise_tone(d):
    t = secs(d)
    f = 200 * 2 ** (3 * t / d)
    return np.sin(TAU * np.cumsum(f) / SR) * (t / d) ** 2 * np.clip((d - t) / 0.05, 0, 1) * 0.6


def dialup(d):
    t = secs(d)
    y = np.zeros_like(t)
    # Dial tones, handshake chirps, then a hiss of noise.
    seg = [0, 0.2, 0.45, 0.75, 1.0]
    for i in range(4):
        a, b = int(seg[i] * len(t)), int(seg[i + 1] * len(t))
        tt = t[a:b] - t[a]
        if i == 0:
            y[a:b] = 0.5 * (np.sin(TAU * 697 * tt) + np.sin(TAU * 1209 * tt)) * (np.floor(tt * 10) % 2)
        elif i == 1:
            y[a:b] = np.sin(TAU * (1800 + 600 * np.sin(TAU * 7 * tt)) * tt) * 0.8
        elif i == 2:
            y[a:b] = np.sin(TAU * 2100 * tt) * (np.floor(tt * 25) % 2) * 0.6 + butter(rng.standard_normal(b - a), "bandpass", [1000, 3500]) * 0.3
        else:
            y[a:b] = butter(rng.standard_normal(b - a), "bandpass", [600, 4000]) * 0.6
    return y


def crash_sfx():
    t = secs(0.7)
    return mixp(rng.standard_normal(len(t)) * np.exp(-t / 0.25) * 0.8, square(55, 0.7, vol=2.0)[: len(t)] * np.exp(-t / 0.3))


def bell(f, d=2.5):
    t = secs(d)
    y = sum(np.sin(TAU * f * r * t) * np.exp(-t / (d * w)) * a for r, w, a in ((1, 0.5, 1), (2.76, 0.2, 0.5), (5.4, 0.1, 0.3), (0.5, 0.6, 0.6)))
    return y * (1 - np.exp(-t / 0.003))


def stone():
    t = secs(0.12)
    return noise_hit(0.12, 2000, 6000, 0.008, 1.0) + np.sin(TAU * 1100 * t) * np.exp(-t / 0.015) * 0.6


def place_foley():
    cues = json.loads((ROOT / ".cache" / "cues.json").read_text())
    for c in cues:
        k, t, d = c["kind"], c["t"], c.get("dur", 0.5)
        pan = rng.uniform(-0.3, 0.3)
        if k == "click":
            foley.add(t, click(), 0.7, pan)
        elif k == "spin":
            for i in range(14):
                foley.add(t + i * 0.09, click(), 0.25 * (1 - i / 16), pan)
        elif k in ("pop", "bubble"):
            foley.add(t, blip(900 + rng.uniform(0, 500), 0.06), 0.35, pan)
        elif k == "title":
            foley.add(t, bell(midi(69), 3.5), 0.35)
            send.add(t, bell(midi(69), 3.5), 0.4)
            music.add(t, sum(pad_note(midi(n), 3.0, 1600) for n in (57, 64, 69, 72)), 0.8)
        elif k == "pencil":
            foley.add(t, scratch(d), 0.18, pan)
        elif k == "tick":
            foley.add(t, blip(1800, 0.03), 0.25, pan)
        elif k == "hum":
            tt = secs(0.8)
            foley.add(t, mixp(np.sin(TAU * 60 * tt) * np.exp(-tt / 0.4) * 0.5, noise_hit(0.8, 80, 400, 0.3, 0.3)), 0.15, pan)
        elif k == "projector":
            for i in range(int(2.2 * 24)):
                foley.add(t + i / 24, noise_hit(0.02, 800, 3000, 0.004), 0.12, 0.2)
        elif k in ("thunk", "stamp"):
            foley.add(t, thunk(), 0.6 if k == "stamp" else 0.45, pan)
        elif k == "relay":
            foley.add(t, mixp(click(), thunk() * 0.3), 0.6, pan)
        elif k == "plug":
            foley.add(t, mixp(noise_hit(0.08, 500, 2500, 0.015), click() * 0.5), 0.35, pan)
        elif k in ("typewriter", "typing"):
            rate = 11 if k == "typewriter" else 16
            for i in range(int(d * rate)):
                foley.add(t + i / rate + rng.uniform(0, 0.02), click() * (1.0 if k == "typewriter" else 0.5), 0.3, 0.2)
            if k == "typewriter":
                foley.add(t + d, bell(2600, 0.6), 0.08, 0.2)
        elif k in ("paper", "page"):
            foley.add(t, butter(rng.standard_normal(int(0.3 * SR)), "bandpass", [1500, 6000]) * np.sin(np.pi * secs(0.3) / 0.3), 0.25, pan)
        elif k == "draft":
            foley.add(t, scratch(d), 0.12, pan)
        elif k == "swarm":
            for i in range(28):
                foley.add(t + rng.uniform(0, d), blip(2000 + rng.uniform(0, 1500), 0.03), 0.1, rng.uniform(-0.8, 0.8))
        elif k == "rise":
            foley.add(t, rise_tone(d), 0.18)
        elif k == "counter":
            n = int(d * 18)
            for i in range(n):
                foley.add(t + i / 18, blip(1500 + 40 * i, 0.025), 0.15, pan)
        elif k == "beeps":
            for i in range(int(d * 6)):
                foley.add(t + i / 6, blip(rng.choice([880, 1320, 1760]), 0.06, "sq"), 0.12, rng.uniform(-0.5, 0.5))
        elif k == "key":
            foley.add(t, click(), 0.4, pan)
        elif k == "crash":
            foley.add(t, crash_sfx(), 0.5)
        elif k == "chip-down":
            for i in range(6):
                foley.add(t + i * d / 6, blip(midi(84 - i * 3), 0.1, "sq"), 0.18)
        elif k == "blip":
            foley.add(t, blip(rng.choice([660, 880, 990, 1320]), 0.07, "sq"), 0.18, pan)
        elif k == "win":
            foley.add(t, mixp(blip(1046, 0.08), np.pad(blip(1568, 0.14), (int(0.06 * SR), 0))), 0.2, pan)
        elif k == "dialup":
            foley.add(t, dialup(d), 0.22)
        elif k == "clack":
            foley.add(t, mixp(stone() * 0.8, thunk() * 0.3), 0.5, pan)
        elif k == "unlock":
            foley.add(t, mixp(click() * 0.6, np.pad(click(), (int(0.07 * SR), 0))), 0.4)
        elif k == "whoosh":
            foley.add(t, whoosh(0.7), 0.3, pan)
        elif k == "ping":
            foley.add(t, bell(midi(88), 1.2), 0.1, pan)
            send.add(t, bell(midi(88), 1.2), 0.1)
        elif k == "ding":
            foley.add(t, bell(midi(84), 1.5), 0.14, pan)
            send.add(t, bell(midi(84), 1.5), 0.12)
        elif k == "freeze":
            foley.add(t, sum(bell(midi(n), 3.0) for n in (96, 100, 103)) * 0.3, 0.2)
            send.add(t, sum(bell(midi(n), 3.0) for n in (96, 100, 103)) * 0.3, 0.3)
        elif k == "swell":
            y = sum(pad_note(midi(n), 2.0, 2500) for n in (57, 64, 69, 76))
            music.add(t, y, 0.6)
            send.add(t, y, 0.3)
        elif k == "stone":
            foley.add(t, stone(), 0.45, pan)
        elif k == "gong":
            foley.add(t, bell(midi(45), 4.0), 0.35)
            send.add(t, bell(midi(45), 4.0), 0.3)
        elif k == "brush":
            foley.add(t, butter(rng.standard_normal(int(d * SR)), "bandpass", [300, 2500]) * np.sin(np.pi * secs(d) / d), 0.12)
        elif k == "stream":
            foley.add(t, butter(rng.standard_normal(int(d * SR)), "bandpass", [400, 1800]) * np.sin(np.pi * secs(d) / d) ** 2, 0.12)
        elif k == "chord":
            y = sum(piano(midi(n), 3.0) for n in (57, 64, 69, 72, 76))
            music.add(t, y, 0.25)
            send.add(t, y, 0.2)
        elif k == "end":
            y = piano(midi(69), 3.0) + piano(midi(81), 3.0) * 0.5
            music.add(t, y, 0.35)
            send.add(t, y, 0.35)
        elif k == "scene" and t > 0.1:
            foley.add(t, whoosh(0.5), 0.22, pan)


# ---------------------------------------------------------------- mix


def era_colour(x):
    """Band-limit the ENIAC scene like a valve radio, and add crackle to it."""
    s = SCENES["eniac"]
    a, b = int(s["start"] * SR), int(min(N, (s["end"] + 0.6) * SR))
    seg = butter(x[a:b], "bandpass", [280, 3200])
    ramp = np.clip(np.minimum(np.arange(b - a), np.arange(b - a)[::-1]) / (0.3 * SR), 0, 1)[:, None]
    x[a:b] = x[a:b] * (1 - ramp) + seg * ramp
    n = b - a
    crackle = np.zeros(n)
    idx = rng.integers(0, n, int(n / SR * 30))
    crackle[idx] = rng.uniform(-1, 1, len(idx))
    crackle = butter(crackle, "highpass", 1500) * 0.4 + butter(rng.standard_normal(n), "lowpass", 3000) * 0.01
    x[a:b] += (crackle * ramp[:, 0])[:, None] * 0.25
    return x


def reverb(x, seconds=2.4):
    length = int(seconds * SR)
    t = np.arange(length) / SR
    ir = rng.standard_normal((length, 2)) * np.exp(-t / 0.55)[:, None]
    ir = butter(ir, "lowpass", 5000)
    ir /= np.sqrt((ir**2).sum(axis=0))
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], axis=1)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12)


def voice_envelope(voice):
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
    bed = butter(music.x, "highpass", 30) + reverb(send.x) * 0.6
    bed = era_colour(bed)
    fade = np.clip((DURATION - 0.2 - np.arange(N) / SR) / 2.5, 0, 1) ** 1.5
    bed *= fade[:, None]

    _, voice = wavfile.read(ROOT / ".cache" / "narration.wav")
    voice = voice / 32768.0 if voice.dtype.kind == "i" else voice.astype(np.float64)
    voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]

    speech = voice_envelope(voice)
    target = rms_db(voice[speech > 0.5]) - 15
    bed *= 10 ** ((target - rms_db(bed)) / 20)
    active = np.abs(foley.x).max(axis=1) > 1e-4
    fx = foley.x * 10 ** ((target + 3 - rms_db(foley.x[active])) / 20)
    duck = 10 ** (-4 * speech / 20)
    mix = voice[:, None] * np.ones((1, 2)) + bed * duck[:, None] + fx
    mix *= 0.9 / np.abs(mix).max()
    wavfile.write(ROOT / ".cache" / "mix.wav", SR, mix.astype(np.float32))

    alone = bed + fx
    alone *= 0.9 / np.abs(alone).max()
    wavfile.write(ROOT / ".cache" / "music.wav", SR, alone.astype(np.float32))
    print(f"mix {DURATION:.1f} s · voice {rms_db(voice[speech > 0.5]):.1f} dBFS · bed {rms_db(bed * duck[:, None]):.1f} dBFS · foley {rms_db(fx):.1f} dBFS")


if __name__ == "__main__":
    main()
