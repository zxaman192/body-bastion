"""Builds every Body Bastion icon from the logo artwork (android/assets-src/logo-source.jpg).

Usage: python tools/make_logo_assets.py [repo root] [launcher preview png]   (needs Pillow)
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "android", "assets-src", "logo-source.jpg")
NAVY = (2, 3, 34)

src = Image.open(SRC).convert("RGB")
W = src.size[0]
RADIUS = 238 / 1254  # corner radius of the artwork's rounded square, as a share of its width


def rounded(size):
    """The logo at `size` px with its white outer corners made transparent."""
    big = src.resize((size * 2, size * 2), Image.LANCZOS)
    mask = Image.new("L", big.size, 0)
    r = int(RADIUS * big.size[0])
    ImageDraw.Draw(mask).rounded_rectangle([1, 1, big.size[0] - 2, big.size[1] - 2], radius=r, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    out = big.convert("RGBA")
    out.putalpha(mask)
    return out.resize((size, size), Image.LANCZOS)


def on_canvas(size, scale, bg=None):
    """Logo scaled to `scale` of a square canvas (transparent or `bg`)."""
    canvas = Image.new("RGBA", (size, size), bg + (255,) if bg else (0, 0, 0, 0))
    inner = int(round(size * scale))
    logo = rounded(inner)
    off = (size - inner) // 2
    canvas.alpha_composite(logo, (off, off))
    return canvas


icons = os.path.join(ROOT, "static", "icons")
rounded(512).save(os.path.join(icons, "logo-512.png"), optimize=True)
rounded(256).save(os.path.join(icons, "logo-256.png"), optimize=True)
rounded(192).save(os.path.join(icons, "icon-192.png"), optimize=True)
rounded(512).save(os.path.join(icons, "icon-512.png"), optimize=True)
on_canvas(512, 0.86, NAVY).convert("RGB").save(os.path.join(icons, "icon-maskable-512.png"), optimize=True)
rounded(180).save(os.path.join(icons, "apple-touch-icon.png"), optimize=True)
rounded(48).save(os.path.join(icons, "favicon-48.png"), optimize=True)
rounded(32).save(os.path.join(icons, "favicon-32.png"), optimize=True)

res = os.path.join(ROOT, "android", "res")
for name, px in (("mdpi", 108), ("hdpi", 162), ("xhdpi", 216), ("xxhdpi", 324), ("xxxhdpi", 432)):
    d = os.path.join(res, f"drawable-{name}")
    os.makedirs(d, exist_ok=True)
    on_canvas(px, 74 / 108).save(os.path.join(d, "ic_launcher_logo.png"), optimize=True)
nod = os.path.join(res, "drawable-nodpi")
os.makedirs(nod, exist_ok=True)
rounded(480).save(os.path.join(nod, "splash_logo.png"), optimize=True)
rounded(512).save(os.path.join(icons, "logo-512.webp"), quality=86, method=6)
if len(sys.argv) < 3:
    print("done")
    sys.exit(0)

# previews of what launchers will show (circle and squircle masks), for checking only
prev = Image.new("RGBA", (432 * 3 + 40, 432), (240, 240, 240, 255))
fg = on_canvas(432, 74 / 108)
for i, shape in enumerate(("circle", "squircle", "square")):
    tile = Image.new("RGBA", (432, 432), NAVY + (255,))
    tile.alpha_composite(fg)
    vis = Image.new("L", (432, 432), 0)
    dr = ImageDraw.Draw(vis)
    a, b = 72, 360  # the 72dp visible region of a 108dp layer
    if shape == "circle":
        dr.ellipse([a, a, b, b], fill=255)
    elif shape == "squircle":
        dr.rounded_rectangle([a, a, b, b], radius=96, fill=255)
    else:
        dr.rounded_rectangle([a, a, b, b], radius=24, fill=255)
    tile.putalpha(vis)
    prev.alpha_composite(tile, (i * (432 + 20), 0))
prev.save(sys.argv[2])
print("done")
