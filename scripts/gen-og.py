#!/usr/bin/env python3
"""Builds public/og-image.png (1200x630, the link-preview card) and public/screenshot-wide.png
(the in-game screenshot shown in the install dialog) from real game screenshots.

Needs the dev server (npm run dev, default http://localhost:5173), Google Chrome and Pillow.
Run from the repo root:  python3 scripts/gen-og.py [level-number]   (default level 13)
It captures the title screen (for the logo) and one level (for the scene), then composes the card.
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageEnhance

URL = os.environ.get("URL", "http://localhost:5173/")
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
LEVEL = sys.argv[1] if len(sys.argv) > 1 else "13"
W, H = 1200, 630
BROWN, DARK = (0x6B, 0x44, 0x23), (0x2A, 0x1A, 0x10)


def shot(query, out):
    # Autoplay is allowed so the "press any key for sound" hint does not appear in the picture.
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         "--autoplay-policy=no-user-gesture-required", "--window-size=1300,800",
         "--virtual-time-budget=2000", f"--screenshot={out}", URL + query],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60,
    )
    # The 560x344 canvas is drawn at 2x (1120x688), centred in the window, inside a 14 px frame.
    return Image.open(out).convert("RGB").crop((90, 56, 90 + 1120, 56 + 688))


def main():
    with tempfile.TemporaryDirectory() as tmp:
        title = shot("", os.path.join(tmp, "title.png"))
        game = shot(f"?level={LEVEL}", os.path.join(tmp, "level.png"))

    game.save("public/screenshot-wide.png", optimize=True)  # 1120x688, used by site.webmanifest
    field = game.crop((0, 48, 1120, 688))  # play field without the HUD
    scale = max(W / 1120, H / 640)
    fw, fh = round(1120 * scale), round(640 * scale)
    left, top = (fw - W) // 2, (fh - H) // 2
    field = field.resize((fw, fh), Image.NEAREST).crop((left, top, left + W, top + H))
    field = ImageEnhance.Brightness(field).enhance(0.8)

    logo = title.crop((330, 22, 790, 156))  # "ROBO RUNNER" + "DIG * RUN * ESCAPE"
    logo = logo.resize((round(logo.width * 1.25), round(logo.height * 1.25)), Image.NEAREST)
    pad = 10
    banner = Image.new("RGB", (logo.width + 2 * pad + 12, logo.height + 2 * pad + 12), BROWN)
    banner.paste(Image.new("RGB", (logo.width + 2 * pad, logo.height + 2 * pad), DARK), (6, 6))
    banner.paste(logo, (6 + pad, 6 + pad))
    field.paste(banner, ((W - logo.width) // 2 - pad - 6, 40 - pad - 6))

    card = Image.new("RGB", (W, H), BROWN)
    card.paste(field.crop((8, 8, W - 8, H - 8)), (8, 8))
    card.save("public/og-image.png", optimize=True)
    for f in ["public/og-image.png", "public/screenshot-wide.png"]:
        print(f"{f}  {os.path.getsize(f)} bytes")


if __name__ == "__main__":
    main()
