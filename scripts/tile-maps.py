"""
Slice the Wardog map renders into a tile pyramid for the app's map panel.

    python scripts/tile-maps.py "E:/Downloads/Wardog Maps" ../wardogs-maps

Every <name>_map.png in the source folder becomes <out>/<name>/<z>/<x>/<y>.webp,
256 px tiles in the usual XYZ layout (y counted from the top). Zoom 0 is the
whole map in one tile; each level doubles. Images are capped at MAX_PX on the
longest side before slicing: the 32k renders are 0.5 m/px, which is far more
than a mortar needs, and halving them keeps each map to about 60 MB.

Coordinates are not baked in here: the app knows each map's extent in game
units (see src/lib/maps.ts) and maps them onto the pyramid itself.
"""
import os
import sys
import time
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None

TILE = 256
MAX_PX = 16384
QUALITY = 75


def tile_one(src: Path, out: Path) -> None:
    name = src.stem.removesuffix('_map')
    t0 = time.time()
    im = Image.open(src)
    im.load()
    w, h = im.size
    if w != h or w & (w - 1):
        raise SystemExit(f'{src.name}: expected a square power-of-two image, got {w}x{h}')
    if w > MAX_PX:
        im = im.reduce(w // MAX_PX)
    im = im.convert('RGB')
    size = im.size[0]
    max_zoom = size.bit_length() - 1 - (TILE.bit_length() - 1)
    print(f'{name}: {w}px -> {size}px, zoom 0..{max_zoom} ({round(time.time() - t0)}s to decode)')

    count = 0
    level = im
    for z in range(max_zoom, -1, -1):
        n = 2 ** z
        for x in range(n):
            d = out / name / str(z) / str(x)
            d.mkdir(parents=True, exist_ok=True)
            for y in range(n):
                box = (x * TILE, y * TILE, (x + 1) * TILE, (y + 1) * TILE)
                level.crop(box).save(d / f'{y}.webp', quality=QUALITY, method=4)
                count += 1
        if z:
            level = level.reduce(2)
        print(f'  zoom {z}: {n * n} tiles')
    total = sum(f.stat().st_size for f in (out / name).rglob('*.webp'))
    print(f'{name}: {count} tiles, {total / 1e6:.0f} MB, {round(time.time() - t0)}s')


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    srcs = sorted(src_dir.glob('*_map.png'))
    if not srcs:
        raise SystemExit(f'no *_map.png in {src_dir}')
    out_dir.mkdir(parents=True, exist_ok=True)
    for src in srcs:
        tile_one(src, out_dir)


if __name__ == '__main__':
    main()
