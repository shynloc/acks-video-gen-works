"""Prepare derived image assets for the ACKS promo render.

- Upscales the two registered concept visuals (1915 x 821) with Lanczos and a
  light unsharp mask so the 1080 px square window stays crisp during the slow
  push-in. The originals in src/assets/source are never modified.
- Generates a tileable paper-grain texture, in the spirit of the fractal-noise
  overlay used on the live construction page.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "source"
GEN = ROOT / "src" / "assets" / "gen"

# The square window is 1080 px and zooms to ~1.1x, so render the 821 px tall
# originals at 1300 px tall (about 1.58x) to avoid browser upscaling.
TARGET_HEIGHT = 1300


def upscale(name: str) -> None:
    image = Image.open(SRC / f"{name}.webp").convert("RGB")
    width = round(image.width * TARGET_HEIGHT / image.height)
    image = image.resize((width, TARGET_HEIGHT), Image.Resampling.LANCZOS)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=2))
    image.save(GEN / f"{name}.jpg", quality=94, subsampling=0)
    print(f"{name}.jpg {image.size}")


def grain(size: int = 384, seed: int = 7) -> None:
    rng = np.random.default_rng(seed)
    noise = rng.normal(0.0, 1.0, (size, size))
    # Blend a little low-frequency structure in so it reads as paper, not TV static.
    coarse = rng.normal(0.0, 1.0, (size // 8, size // 8))
    coarse = np.array(
        Image.fromarray(((coarse - coarse.min()) / np.ptp(coarse) * 255).astype(np.uint8)).resize(
            (size, size), Image.Resampling.BICUBIC
        ),
        dtype=np.float64,
    )
    coarse = (coarse - coarse.mean()) / coarse.std()
    field = 0.82 * noise + 0.18 * coarse
    field = np.clip(128 + field * 34, 0, 255).astype(np.uint8)
    Image.fromarray(field, mode="L").save(GEN / "grain.png")
    print("grain.png", (size, size))


def main() -> None:
    GEN.mkdir(parents=True, exist_ok=True)
    upscale("ai-agent-studio")
    upscale("automotive-studio")
    grain()


if __name__ == "__main__":
    main()
