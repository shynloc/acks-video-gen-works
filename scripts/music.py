"""Original soundtrack for the ACKS promo: 96 BPM, D major, exactly 45 s (18 bars).

Everything is synthesised here with numpy/scipy (additive pads, FM electric piano,
harmonic bass, synthesised drums, convolution reverb), so there is no third-party
music or sample licence to track.

The arrangement follows the scene plan in docs/storyboard.md. Sound effects are
placed from .cache/cues.json, which `node scripts/render.mjs --cues` exports from
the animation timeline, so picture and sound share one source of truth.

    python3 scripts/music.py        ->  .cache/music.wav (48 kHz, stereo, float32)
"""

import json
import sys
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
SR = 48_000
DURATION = 45.0
N = int(SR * DURATION)
BPM = 96
BEAT = 60 / BPM  # 0.625 s
BAR = 4 * BEAT  # 2.5 s
STEP = BEAT / 4  # 16th note
TAU = 2 * np.pi

rng = np.random.default_rng(20260924)


def midi(note: float) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def at(bar: int, step: float = 0.0) -> float:
    return bar * BAR + step * STEP


def seconds(n: float) -> np.ndarray:
    return np.arange(int(n * SR)) / SR


# ---------------------------------------------------------------- filters


def butter(x, kind, freq, order=2):
    sos = signal.butter(order, freq, btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def svf_sweep(x, f_start, f_end, q=0.9, mode="band"):
    """Chamberlin state-variable filter with a log-swept cutoff (for whooshes/risers)."""
    n = len(x)
    freqs = np.geomspace(f_start, f_end, n)
    coeff = 2 * np.sin(np.pi * np.minimum(freqs, SR / 6) / SR)
    damp = 1 / q
    low = band = 0.0
    out = np.empty(n)
    for i in range(n):
        f = coeff[i]
        high = x[i] - low - damp * band
        band += f * high
        low += f * band
        out[i] = band if mode == "band" else low
    return out


# ---------------------------------------------------------------- mixing


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, t0, mono, gain=1.0, pan=0.0):
        start = int(round(t0 * SR))
        mono = np.asarray(mono, dtype=np.float64)
        if start < 0:
            mono = mono[-start:]
            start = 0
        if start >= N or len(mono) == 0:
            return
        n = min(len(mono), N - start)
        angle = (pan + 1) * np.pi / 4
        self.x[start : start + n, 0] += mono[:n] * gain * np.cos(angle) * np.sqrt(2)
        self.x[start : start + n, 1] += mono[:n] * gain * np.sin(angle) * np.sqrt(2)


buses = {name: Bus() for name in ("pad", "keys", "bass", "drums", "sfx", "send")}
kick_times: list[float] = []


def send(t0, mono, gain, pan=0.0):
    buses["send"].add(t0, mono, gain, pan)


# ---------------------------------------------------------------- instruments


def pad_note(freq, dur, cutoff=1500.0, attack=0.55, release=1.1, detune=7.0):
    """Two detuned additive saws with a smooth two-pole-style roll-off."""
    t = seconds(dur + release)
    out = np.zeros_like(t)
    for cents in (-detune, detune):
        f = freq * 2 ** (cents / 1200)
        phase = rng.uniform(0, TAU)
        k = 1
        while k * f < 5200 and k <= 26:
            amp = (1 / k**1.15) / np.sqrt(1 + (k * f / cutoff) ** 4)
            out += amp * np.sin(TAU * k * f * t + phase * k)
            k += 1
    env = 1 - np.exp(-t / (attack / 3))
    env *= np.clip((dur + release - t) / release, 0, 1) ** 2
    return out * env * 0.32


def keys_note(freq, dur=1.2, vel=1.0, bright=1.0):
    """FM electric piano: 1:1 body plus a short 7:1 tine."""
    t = seconds(dur)
    index = bright * 2.0 * np.exp(-t / 0.09) + 0.25
    body = np.sin(TAU * freq * t + index * np.sin(TAU * freq * t))
    tine = 0.18 * np.sin(TAU * freq * 7.0 * t) * np.exp(-t / 0.018)
    decay = 0.32 + 0.35 * min(1.0, 330 / freq)
    env = (1 - np.exp(-t / 0.0015)) * np.exp(-t / decay)
    env *= np.clip((dur - t) / 0.05, 0, 1)
    return (body + tine) * env * vel


def bell(freq, dur=3.0, vel=1.0):
    t = seconds(dur)
    index = 2.4 * np.exp(-t / 0.6)
    y = np.sin(TAU * freq * t + index * np.sin(TAU * freq * 3.5 * t))
    env = (1 - np.exp(-t / 0.002)) * np.exp(-t / 1.1) * np.clip((dur - t) / 0.2, 0, 1)
    return y * env * vel


def bass_note(freq, dur, vel=1.0, drive=0.0):
    t = seconds(dur + 0.04)
    # Strong 2nd–4th harmonics keep the line audible on phone speakers.
    y = 0.8 * np.sin(TAU * freq * t) + 0.5 * np.sin(TAU * 2 * freq * t) + 0.26 * np.sin(TAU * 3 * freq * t)
    y += 0.12 * np.sin(TAU * 4 * freq * t)
    if drive:
        y = np.tanh(y * (1 + drive)) / np.tanh(1 + drive)
    env = (1 - np.exp(-t / 0.005)) * (0.72 + 0.28 * np.exp(-t / 0.22))
    env *= np.clip((dur + 0.04 - t) / 0.04, 0, 1)
    return y * env * vel


def kick(vel=1.0):
    t = seconds(0.5)
    freq = 47 + 110 * np.exp(-t / 0.03)
    body = np.sin(TAU * np.cumsum(freq) / SR) * np.exp(-t / 0.24)
    click = butter(rng.standard_normal(len(t)), "highpass", 1800) * np.exp(-t / 0.0018) * 0.35
    return (body + click) * vel


def clap(vel=1.0):
    t = seconds(0.4)
    noise = butter(rng.standard_normal(len(t)), "bandpass", [900, 4200])
    env = np.zeros_like(t)
    for offset in (0.0, 0.010, 0.021):
        env += (t >= offset) * np.exp(-np.clip(t - offset, 0, None) / 0.005)
    env += (t >= 0.03) * np.exp(-np.clip(t - 0.03, 0, None) / 0.11) * 0.7
    return noise * env * vel * 0.6


def snare(vel=1.0):
    t = seconds(0.3)
    tone = np.sin(TAU * 190 * t) * np.exp(-t / 0.05)
    noise = butter(rng.standard_normal(len(t)), "bandpass", [1200, 7000]) * np.exp(-t / 0.08)
    return (0.5 * tone + noise) * vel * 0.7


def hat(open_=False, vel=1.0):
    t = seconds(0.3 if open_ else 0.07)
    noise = butter(rng.standard_normal(len(t)), "highpass", 7200)
    return noise * np.exp(-t / (0.085 if open_ else 0.016)) * vel


def tom(vel=1.0, freq=110.0):
    t = seconds(0.45)
    f = freq * (0.72 + 0.28 * np.exp(-t / 0.06))
    return np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.2) * vel


# ---------------------------------------------------------------- sound design


def whoosh(dur, f_start=350.0, f_end=5000.0, vel=1.0):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    y = svf_sweep(x, f_start, f_end, q=1.4)
    shape = np.sin(np.linspace(0, np.pi, n)) ** 2
    peak = int(n * 0.72)
    shape[peak:] = np.linspace(shape[peak], 0, n - peak) ** 1.5
    return y * shape * vel * 0.5


def riser(dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    swell = (t / dur) ** 2.2
    noise = svf_sweep(rng.standard_normal(n), 300, 9000, q=1.1) * 0.5
    glide = np.sin(TAU * np.cumsum(midi(62) * 2 ** (t / dur)) / SR) * 0.25
    trem = 0.75 + 0.25 * np.sin(TAU * (4 + 12 * t / dur) * t)
    return (noise + glide * trem) * swell * vel


def impact(vel=1.0):
    t = seconds(2.0)
    boom = np.sin(TAU * np.cumsum(38 + 40 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.7)
    crash = butter(rng.standard_normal(len(t)), "lowpass", 5000) * np.exp(-t / 0.35) * 0.35
    return (boom + crash) * vel


def tick(vel=1.0, freq=3800.0):
    t = seconds(0.03)
    noise = butter(rng.standard_normal(len(t)), "bandpass", [freq * 0.7, freq * 1.3]) * np.exp(-t / 0.0022)
    knock = np.sin(TAU * 950 * t) * np.exp(-t / 0.006) * 0.4
    return (noise + knock) * vel


def blip(freq, vel=1.0, dur=0.35):
    t = seconds(dur)
    y = np.sin(TAU * freq * t) + 0.25 * np.sin(TAU * 2 * freq * t)
    return y * (1 - np.exp(-t / 0.002)) * np.exp(-t / 0.09) * vel


def glitch(dur, vel=1.0):
    out = np.zeros(int(dur * SR))
    for _ in range(14):
        start = int(rng.uniform(0, dur - 0.03) * SR)
        t = seconds(rng.uniform(0.008, 0.02))
        f = rng.uniform(700, 2600)
        burst = np.sign(np.sin(TAU * f * t)) * np.exp(-t / 0.01) * rng.uniform(0.4, 1.0)
        out[start : start + len(burst)] += burst[: len(out) - start]
    return butter(out, "lowpass", 6000) * vel


def reverse_swell(dur, vel=1.0):
    t = seconds(dur)
    tail = butter(rng.standard_normal(len(t)), "bandpass", [500, 8000]) * np.exp(-t / (dur / 3))
    return tail[::-1] * vel


# ---------------------------------------------------------------- arrangement

# One chord per bar (18 bars = 45 s).
CHORDS = ["D", "Bm", "G", "A", "D", "F#m", "G", "A", "Bm", "A", "Bm", "G", "A", "Bm", "G", "A", "D", "D"]
VOICING = {  # bass note, pad voicing (MIDI)
    "D": (38, [57, 61, 64, 66, 69]),  # Dmaj9
    "Bm": (35, [57, 61, 62, 66, 69]),  # Bm9
    "G": (31, [55, 59, 62, 66, 69]),  # Gmaj9
    "A": (33, [57, 61, 64, 67, 69]),  # A7
    "F#m": (30, [57, 61, 64, 66, 69]),  # F#m7
}
ARP = {
    "D": [74, 76, 78, 81, 85],
    "Bm": [71, 74, 76, 78, 81],
    "G": [71, 74, 78, 79, 81],
    "A": [73, 76, 79, 81, 83],
    "F#m": [73, 76, 78, 81, 85],
}
ARP_PATTERN = {
    "q": [(0, 0), (4, 2), (8, 1), (12, 3)],
    "8": [(s * 2, i) for s, i in enumerate([0, 2, 1, 3, 2, 4, 3, 1])],
    "16": [(s, i) for s, i in enumerate([0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 2, 1, 3, 2, 4])],
}

# Per-bar arrangement: pad level, pad cutoff, keys pattern, bass mode, drum mode.
SECTIONS = {
    0: (0.62, 1300, "q", None, None),
    1: (0.66, 1400, "q", None, None),
    2: (0.66, 1500, "8", "whole", "half"),
    3: (0.66, 1500, "8", "whole", "half"),
    4: (0.82, 1700, "8", "whole", "breathe"),
    5: (0.82, 1800, "8", "whole", "breathe"),
    6: (0.6, 1700, "16", "groove", "groove"),
    7: (0.6, 1700, "16", "groove", "groove"),
    8: (0.6, 1800, "16", "groove", "groove"),
    9: (0.62, 1900, "16", "groove", "build"),
    10: (0.55, 1100, "16", "drive", "four"),
    11: (0.55, 1100, "16", "drive", "four"),
    12: (0.55, 1200, "16", "drive", "four-fill"),
    13: (0.6, 1600, "8", "half", "light"),
    14: (0.6, 1600, "8", "half", "light"),
    15: (0.66, 1500, "q", "whole", None),
    16: (0.9, 1800, None, "whole", None),
    17: (0.0, 1800, None, None, None),
}


def play_kick(t, vel):
    buses["drums"].add(t, kick(vel), 0.95)
    kick_times.append(t)


def arrange():
    for bar, chord in enumerate(CHORDS):
        pad_level, cutoff, keys_mode, bass_mode, drum_mode = SECTIONS[bar]
        root, voicing = VOICING[chord]
        t0 = at(bar)

        if pad_level:
            length = BAR * (2 if bar == 16 else 1)
            for i, note in enumerate(voicing):
                y = pad_note(midi(note), length, cutoff=cutoff, release=2.2 if bar == 16 else 1.1)
                buses["pad"].add(t0, y, pad_level * 0.21, pan=-0.35 + 0.175 * i)
                send(t0, y, pad_level * 0.05)

        if keys_mode:
            dark = bar in (10, 11, 12)
            for step, index in ARP_PATTERN[keys_mode]:
                note = ARP[chord][index]
                accent = 1.0 if step % 4 == 0 else 0.72
                vel = accent * (0.55 if bar in (0, 1, 15) else 0.5)
                y = keys_note(midi(note), dur=0.5 if dark else 1.0, vel=vel, bright=0.6 if dark else 1.0)
                if dark:
                    y = butter(y, "lowpass", 2400)
                pan = -0.45 + 0.9 * (index / 4)
                buses["keys"].add(t0 + step * STEP, y, 0.4, pan)
                send(t0 + step * STEP, y, 0.1, pan)

        bass = midi(root)
        if bass_mode == "whole":
            buses["bass"].add(t0, bass_note(bass, BAR * (1.6 if bar == 16 else 0.98)), 0.5)
        elif bass_mode == "half":
            for step in (0, 8):
                buses["bass"].add(t0 + step * STEP, bass_note(bass, BEAT * 1.9), 0.5)
        elif bass_mode == "groove":
            for step, length, octave in ((0, 5, 1), (6, 2, 1), (8, 5, 1), (14, 2, 2)):
                buses["bass"].add(t0 + step * STEP, bass_note(bass * octave, STEP * length * 0.95), 0.5)
        elif bass_mode == "drive":
            for step in range(0, 16, 2):
                octave = 2 if step in (6, 14) else 1
                buses["bass"].add(t0 + step * STEP, bass_note(bass * octave, STEP * 1.7, drive=1.2), 0.46)

        if drum_mode == "half":
            for step in (0, 8):
                play_kick(t0 + step * STEP, 0.7)
            for step in range(2, 16, 4):
                buses["drums"].add(t0 + step * STEP, hat(vel=0.35), 0.4, pan=0.3)
        elif drum_mode == "breathe":
            play_kick(t0, 0.62)
            buses["drums"].add(t0 + 12 * STEP, hat(open_=True, vel=0.25), 0.35, pan=0.35)
        elif drum_mode in ("groove", "build", "light"):
            kicks = (0, 8) if drum_mode == "light" else (0, 7, 8)
            if drum_mode == "build":
                kicks = (0, 7)
            for step in kicks:
                play_kick(t0 + step * STEP, 0.9 if step % 8 == 0 else 0.6)
            claps = (4, 12) if drum_mode != "build" else (4,)
            for step in claps:
                y = clap()
                buses["drums"].add(t0 + step * STEP, y, 0.55)
                send(t0 + step * STEP, y, 0.25)
            hats = range(0, 16) if drum_mode == "groove" else range(0, 16, 2)
            for step in hats:
                if drum_mode == "build" and step >= 8:
                    break
                vel = 0.55 if step % 4 == 2 else 0.28
                buses["drums"].add(t0 + step * STEP, hat(vel=vel), 0.55, pan=0.28)
            if drum_mode == "build":
                for k, step in enumerate(range(8, 16)):
                    vel = 0.25 + 0.6 * (k / 7)
                    y = snare(vel)
                    buses["drums"].add(t0 + step * STEP, y, 0.55)
                    buses["drums"].add(t0 + step * STEP + STEP / 2, snare(vel * 0.7), 0.4)
                    send(t0 + step * STEP, y, 0.2)
        elif drum_mode in ("four", "four-fill"):
            for step in (0, 4, 8, 12):
                play_kick(t0 + step * STEP, 0.95)
            for step in (4, 12):
                y = clap(1.1)
                buses["drums"].add(t0 + step * STEP, y, 0.55)
                send(t0 + step * STEP, y, 0.25)
            for step in range(2, 16, 4):
                buses["drums"].add(t0 + step * STEP, hat(open_=True, vel=0.5), 0.42, pan=0.3)
            for step in range(0, 16, 4):
                buses["drums"].add(t0 + step * STEP, hat(vel=0.3), 0.42, pan=-0.25)
            if drum_mode == "four-fill":
                for k, step in enumerate((12, 13, 14, 15)):
                    buses["drums"].add(t0 + step * STEP, tom(0.5 + 0.1 * k, 150 - 18 * k), 0.5)

    # Build into the automotive switch, and a soft lift into the lockup.
    buses["sfx"].add(at(9, 6), riser(at(10) - at(9, 6)), 0.32)
    buses["sfx"].add(at(15, 4), riser(at(16) - at(15, 4), vel=0.6), 0.2)


def place_cues(cues):
    node_notes = [74, 76, 78, 81, 83, 86]
    step_notes = [74, 78, 81, 86]
    letter_notes = [81, 85, 86, 88]
    for cue in cues:
        t, kind = cue["t"], cue["kind"]
        dur = cue.get("dur", 0.5)
        index = cue.get("index", 0)
        sfx = buses["sfx"]
        if kind == "open":
            sfx.add(t, bell(midi(81), 3.0, 0.5), 0.45)
            send(t, bell(midi(81), 3.0, 0.5), 0.35)
            sfx.add(t, tom(0.8, 70), 0.55)
        elif kind == "swish":
            sfx.add(t, whoosh(dur, 6000, 700), 0.2, pan=0.2)
        elif kind == "type":
            count = int(dur * 30)
            for k in range(count):
                sfx.add(t + k / 30, tick(rng.uniform(0.55, 1.0), rng.uniform(3200, 4400)), 0.1, pan=-0.2)
        elif kind == "blip":
            sfx.add(t, blip(midi(88), 0.8), 0.14)
        elif kind == "whoosh":
            sfx.add(t, whoosh(dur + 0.1, 300, 5500), 0.3, pan=-0.1)
            send(t, whoosh(dur + 0.1, 300, 5500), 0.1)
        elif kind == "pop":
            y = keys_note(midi(74), 1.2, 0.9)
            sfx.add(t, y, 0.3)
            send(t, y, 0.25)
            sfx.add(t, tom(0.5, 140), 0.35)
        elif kind == "node":
            y = blip(midi(node_notes[index]), 0.9)
            pan = [-0.3, 0.3, 0.6, 0.3, -0.3, -0.6][index]
            sfx.add(t, y, 0.16, pan)
            send(t, y, 0.18, pan)
        elif kind == "draw":
            sfx.add(t, whoosh(dur, 1500, 3000, 0.5), 0.1)
        elif kind == "wipe":
            sfx.add(t, whoosh(dur + 0.08, 500, 7000), 0.28)
        elif kind == "letter":
            _, voicing = VOICING[CHORDS[int(t // BAR)]]
            for note in voicing[1:] + [letter_notes[index]]:
                y = keys_note(midi(note + 12), 1.4, 0.55)
                sfx.add(t, y, 0.13)
                send(t, y, 0.1)
            y = bell(midi(letter_notes[index]), 2.0, 0.6)
            sfx.add(t, y, 0.2)
            send(t, y, 0.18)
            sfx.add(t, tom(0.7, 95), 0.4)
        elif kind == "sweep":
            sfx.add(t, whoosh(dur, 500, 8000), 0.34, pan=0.0)
            hit = at(10)
            sfx.add(hit, impact(), 0.55)
            send(hit, impact(), 0.25)
        elif kind == "scramble":
            sfx.add(t, glitch(dur, 0.8), 0.07, pan=0.3)
        elif kind == "tick":
            sfx.add(t, tick(0.9, 2600), 0.14, pan=0.25)
        elif kind == "step":
            y = blip(midi(step_notes[index]), 0.9)
            sfx.add(t, y, 0.17)
            send(t, y, 0.2)
        elif kind == "logo":
            sfx.add(at(16) - 0.9, reverse_swell(0.9), 0.14)
            for note in (62, 69, 74, 78, 81):
                y = bell(midi(note), 4.0, 0.5)
                sfx.add(at(16), y, 0.14)
                send(at(16), y, 0.14)
            sfx.add(at(16), impact(0.6), 0.35)
            for k, note in enumerate((86, 90, 93)):
                y = bell(midi(note), 2.0, 0.35)
                sfx.add(40.5 + 0.16 * k, y, 0.08, pan=-0.3 + 0.3 * k)
                send(40.5 + 0.16 * k, y, 0.12)


# ---------------------------------------------------------------- master


def reverb(x):
    length = int(2.4 * SR)
    t = np.arange(length) / SR
    ir = rng.standard_normal((length, 2)) * np.exp(-t / 0.5)[:, None]
    ir = butter(ir, "lowpass", 5500)
    ir = np.vstack([np.zeros((int(0.02 * SR), 2)), ir])
    ir /= np.sqrt((ir**2).sum(axis=0))
    wet = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
    return butter(wet, "highpass", 180)


def sidechain(depth):
    env = np.zeros(N)
    t = np.arange(int(0.4 * SR)) / SR
    shape = (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.16)
    for k in kick_times:
        start = int(k * SR)
        n = min(len(shape), N - start)
        env[start : start + n] = np.maximum(env[start : start + n], shape[:n])
    return (1 - depth * env)[:, None]


def main():
    cues = json.loads((ROOT / ".cache" / "cues.json").read_text())
    arrange()
    place_cues(cues)

    pad = buses["pad"].x * sidechain(0.35)
    bass = butter(buses["bass"].x, "highpass", 32) * sidechain(0.5) * 0.7
    mix = pad + buses["keys"].x + bass + buses["drums"].x + buses["sfx"].x
    mix += reverb(buses["send"].x) * 0.42
    mix = butter(mix, "highpass", 28)
    # Gentle tilt for small speakers: trim the sub, lift presence.
    mix -= 0.2 * butter(mix, "lowpass", 90)
    mix += 0.3 * butter(mix, "highpass", 4500)

    if "--stems" in sys.argv:
        stems = ROOT / ".cache" / "stems"
        stems.mkdir(parents=True, exist_ok=True)
        scale = 0.89 / (np.max(np.abs(mix)) + 1e-9)
        parts = {"pad": pad, "keys": buses["keys"].x, "bass": bass, "drums": buses["drums"].x}
        parts |= {"sfx": buses["sfx"].x, "reverb": reverb(buses["send"].x) * 0.42}
        for name, part in parts.items():
            wavfile.write(stems / f"{name}.wav", SR, (part * scale).astype(np.float32))

    mix /= np.max(np.abs(mix)) + 1e-9
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    fade_in = np.clip(np.arange(N) / (0.004 * SR), 0, 1)
    fade_out = np.clip((44.9 - np.arange(N) / SR) / 1.2, 0, 1) ** 1.5
    mix *= (fade_in * fade_out)[:, None]
    mix *= 0.89 / (np.max(np.abs(mix)) + 1e-9)

    out = ROOT / ".cache" / "music.wav"
    wavfile.write(out, SR, mix.astype(np.float32))
    print(f"{out} · {len(mix) / SR:.2f} s")


if __name__ == "__main__":
    main()
