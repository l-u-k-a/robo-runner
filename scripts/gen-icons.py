#!/usr/bin/env python3
"""Generates the favicon set for Robo Runner from one 16x16 pixel-art robot head.

Writes into public/: favicon.svg, favicon.ico (16/32/48), apple-touch-icon.png (180),
icon-192.png, icon-512.png and icon-maskable-512.png (Android adaptive icon, art inside the safe zone). Needs Pillow. Run from the repo root:  python3 scripts/gen-icons.py
The colours are the hero palette from src/render/sprites.ts and the brown frame from index.html.
"""
from pathlib import Path

from PIL import Image

PALETTE = {
    ".": None,  # transparent (rounded corners)
    "R": "#6b4423",  # frame border
    "F": "#1a0f08",  # frame fill
    "K": "#0e1a2e",  # outline
    "B": "#5aa9ff",  # body
    "D": "#2f6cc0",  # dark
    "L": "#c4e4ff",  # light
    "E": "#2dfcff",  # eye
    "A": "#ffd23f",  # accent (antenna, mouth light)
}

GRID = [
    ".RRRRRRRRRRRRRR.",
    "RFFFFFFAAFFFFFFR",
    "RFFFFFFKKFFFFFFR",
    "RFFKKKKKKKKKKFFR",
    "RFKLLLLLLLLLLKFR",
    "RFKBBBBBBBBBBKFR",
    "RFKBKKKKKKKKBKFR",
    "RFKBKEEKKEEKBKFR",
    "RFKBKEEKKEEKBKFR",
    "RFKBKKKKKKKKBKFR",
    "RFKBBBBBBBBBBKFR",
    "RFKDDBAAAABDDKFR",
    "RFKDDDDDDDDDDKFR",
    "RFFKKKKKKKKKKFFR",
    "RFFFFFFFFFFFFFFR",
    ".RRRRRRRRRRRRRR.",
]
assert len(GRID) == 16 and all(len(r) == 16 for r in GRID), "grid must be 16x16"

OUT = Path("public")


def rgba(hex_or_none):
    if hex_or_none is None:
        return (0, 0, 0, 0)
    h = hex_or_none.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def base(opaque_corners=False):
    img = Image.new("RGBA", (16, 16))
    for y, row in enumerate(GRID):
        for x, ch in enumerate(row):
            if ch == "." and opaque_corners:
                ch = "F"
            img.putpixel((x, y), rgba(PALETTE[ch]))
    return img


def scaled(size, opaque_corners=False, pad_color=None):
    """Nearest-neighbour scale by the largest whole factor, centred (keeps pixels crisp)."""
    k = size // 16
    art = base(opaque_corners).resize((16 * k, 16 * k), Image.NEAREST)
    canvas = Image.new("RGBA", (size, size), rgba(pad_color) if pad_color else (0, 0, 0, 0))
    off = (size - 16 * k) // 2
    canvas.paste(art, (off, off), art)
    return canvas


def maskable(size=512):
    """Android crops adaptive icons to circles, squircles and so on; only the centre 80% is safe.
    Fill the whole square with the frame colour and keep the robot well inside that zone."""
    k = 20  # 16 * 20 = 320 px of art on 512: 62.5%, comfortably inside the 80% safe circle
    art = base(opaque_corners=True).resize((16 * k, 16 * k), Image.NEAREST)
    canvas = Image.new("RGBA", (size, size), rgba(PALETTE["F"]))
    off = (size - 16 * k) // 2
    canvas.paste(art, (off, off), art)
    return canvas.convert("RGB")


def svg():
    rects = []
    for y, row in enumerate(GRID):
        x = 0
        while x < 16:
            ch = row[x]
            run = 1
            while x + run < 16 and row[x + run] == ch:
                run += 1
            if PALETTE[ch]:
                rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="{PALETTE[ch]}"/>')
            x += run
    body = "".join(rects)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">'
        f"<title>Robo Runner</title>{body}</svg>\n"
    )


def main():
    OUT.mkdir(exist_ok=True)
    (OUT / "favicon.svg").write_text(svg())
    ico = scaled(48)
    ico.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    # iOS fills transparency with black and rounds corners itself: keep it fully opaque.
    scaled(180, opaque_corners=True, pad_color=PALETTE["F"]).convert("RGB").save(OUT / "apple-touch-icon.png")
    scaled(192).save(OUT / "icon-192.png")
    scaled(512).save(OUT / "icon-512.png")
    maskable().save(OUT / "icon-maskable-512.png")
    for f in ["favicon.svg", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]:
        print(f"{OUT / f}  {(OUT / f).stat().st_size} bytes")


if __name__ == "__main__":
    main()
