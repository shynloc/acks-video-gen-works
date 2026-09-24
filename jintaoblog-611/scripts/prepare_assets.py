"""Derived assets for the blog-611 video (textures, photo prints, the "average face").

- board.png / paper.png: tileable textures matching the Scrapboard theme tokens
  (--bg-board #d6cbbd with fractal noise at 0.15, --bg-paper #f9f6f0 at 0.05).
- stamp.png: ink mask so rubber stamps print unevenly.
- shot-0N.jpg: the article's nine homepage screenshots, resized for the photo prints.
- average.jpg: the pixel mean of the nine homepages, used when the narration says
  AI can only output "the average".
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "source"
GEN = ROOT / "src" / "assets" / "gen"
rng = np.random.default_rng(611)


def fractal(size: int, base: int, octaves: int, persistence=0.55) -> np.ndarray:
    """Tileable value noise (sum of octaves), normalised to zero mean / unit std."""
    out = np.zeros((size, size))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        cells = base * 2**o
        grid = rng.standard_normal((cells, cells))
        grid = np.tile(grid, (3, 3))  # wrap so the bicubic resize tiles seamlessly
        img = Image.fromarray(grid.astype(np.float32), mode="F").resize((size * 3, size * 3), Image.Resampling.BICUBIC)
        layer = np.asarray(img)[size : 2 * size, size : 2 * size]
        out += amp * layer
        total += amp
        amp *= persistence
    out /= total
    return (out - out.mean()) / (out.std() + 1e-9)


def texture(color: str, grain: float, cloud: float, specks=0.0, size=512) -> Image.Image:
    """Fine grain (like feTurbulence at baseFrequency ~0.9) over a faint large-scale drift."""
    rgb = np.array([int(color[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)
    field = grain * fractal(size, 160, 2, persistence=0.7) + cloud * fractal(size, 4, 3)
    shade = 1 + field
    img = rgb[None, None, :] * shade[:, :, None]
    if specks:
        mask = rng.random((size, size)) < specks
        dark = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        img *= 1 - 0.35 * (np.asarray(dark) / 255.0)[:, :, None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def stamp_mask(size=512) -> Image.Image:
    field = fractal(size, 24, 3)
    alpha = np.clip(1.25 - 0.55 * np.maximum(field, 0) ** 1.4, 0, 1)
    holes = rng.random((size, size)) < 0.012
    alpha[holes] *= 0.2
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)))
    return Image.fromarray(np.dstack([np.full((size, size, 3), 255, np.uint8), alpha]), mode="RGBA")


def main() -> None:
    GEN.mkdir(parents=True, exist_ok=True)
    texture("#d6cbbd", 0.045, 0.02, specks=0.006).save(GEN / "board.png", optimize=True)
    texture("#f9f6f0", 0.012, 0.004).save(GEN / "paper.png", optimize=True)
    stamp_mask().save(GEN / "stamp.png", optimize=True)

    tops = []
    for i in range(1, 10):
        img = Image.open(SRC / f"shot-0{i}.jpg").convert("RGB")
        width = 1100
        height = round(img.height * width / img.width)
        img = img.resize((width, height), Image.Resampling.LANCZOS)
        img.save(GEN / f"shot-0{i}.jpg", quality=92)
        top = img.crop((0, 0, width, round(width / 1.77))).resize((708, 400), Image.Resampling.LANCZOS)
        tops.append(np.asarray(top, dtype=np.float64))
        print(f"shot-0{i}.jpg {img.size}")

    average = np.mean(tops, axis=0)
    Image.fromarray(average.astype(np.uint8)).save(GEN / "average.jpg", quality=92)
    print("average.jpg", average.shape[1::-1])


if __name__ == "__main__":
    main()
