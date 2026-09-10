"""Assemble the PNG frames captured by tools/record-demo.mjs into the README GIF.

Each captured frame is named f<index>_h<hold>.png, where <hold> is how many
base ticks that frame should stay on screen. Rather than duplicating frames
(which would bloat the file), the hold is applied as a per-frame GIF delay, so
a 16-second demo costs only ~26 distinct frames.

    python tools/build-demo-gif.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image

FRAMES_DIR = Path("docs/demo/frames")
OUT_PATH = Path("docs/demo/shieldai-demo.gif")
TARGET_WIDTH = 900  # GitHub renders README images at roughly 850px
TICK_MS = 125  # 8 fps base rate; plenty for UI motion
MAX_COLORS = 128  # the steel-blue theme is a narrow palette anyway

FRAME_RE = re.compile(r"^f(\d+)_h(\d+)\.png$")


def load_frames():
    frames = []
    manifest = json.loads((FRAMES_DIR / "manifest.json").read_text())
    for png in [FRAMES_DIR / name for name in manifest["frames"]]:
        match = FRAME_RE.match(png.name)
        if not match:
            continue
        frames.append((int(match.group(1)), int(match.group(2)), png))
    frames.sort()
    if not frames:
        raise SystemExit(f"no frames in {FRAMES_DIR} - run tools/record-demo.mjs first")
    return frames


def main() -> None:
    frames = load_frames()
    images, durations = [], []
    for _, hold, png in frames:
        img = Image.open(png).convert("RGB")
        height = round(img.height * TARGET_WIDTH / img.width)
        img = img.resize((TARGET_WIDTH, height), Image.LANCZOS)
        # A single adaptive palette shared by every frame keeps the GIF from
        # flickering between per-frame palettes.
        images.append(img)
        durations.append(hold * TICK_MS)

    palette_source = images[-1].quantize(colors=MAX_COLORS, method=Image.MEDIANCUT)
    quantized = [im.quantize(palette=palette_source, dither=Image.FLOYDSTEINBERG) for im in images]

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    quantized[0].save(
        OUT_PATH,
        save_all=True,
        append_images=quantized[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=1,
    )
    total_s = sum(durations) / 1000
    size_mb = OUT_PATH.stat().st_size / 1_048_576
    print(
        f"{OUT_PATH}: {len(quantized)} frames, {quantized[0].width}x{quantized[0].height}, "
        f"{total_s:.1f}s, {size_mb:.2f} MB"
    )


if __name__ == "__main__":
    main()
