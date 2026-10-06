"""Generate the Body Bastion app icons (PNG, no external libraries). Run: python static/icons/make_icons.py"""
import math
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))


def png(path, w, h, pixels):
    raw = b"".join(b"\x00" + bytes(pixels[y * w * 4:(y + 1) * w * 4]) for y in range(h))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(chunk(b"IEND", b""))


def inside_shield(x, y):
    if y < 0.18 or y > 0.86:
        return False
    if y < 0.58:
        return abs(x - 0.5) < 0.30
    k = (y - 0.58) / 0.28
    return abs(x - 0.5) < 0.30 * math.sqrt(max(0.0, 1 - k * k))


def gut(x, y):
    cx, cy = 0.5, 0.47
    dx, dy = x - cx, y - cy
    r = math.hypot(dx, dy)
    a = math.atan2(dy, dx)
    spiral = (a + math.pi) / (2 * math.pi)
    for turn in range(3):
        target = 0.05 + (spiral + turn) * 0.065
        if abs(r - target) < 0.022 and r < 0.21:
            return True
    return False


def sample(x, y, maskable):
    pad = 0.0 if maskable else 0.06
    rad = 0.0 if maskable else 0.2
    if not maskable:
        qx = min(max(x, pad + rad), 1 - pad - rad)
        qy = min(max(y, pad + rad), 1 - pad - rad)
        if math.hypot(x - qx, y - qy) > rad or x < pad or y < pad or x > 1 - pad or y > 1 - pad:
            return (0, 0, 0, 0)
    t = y
    bg = (int(194 + (233 - 194) * t), int(24 + (87 - 24) * t), int(91 + (122 - 91) * t), 255)
    s = 0.84 if maskable else 1.0
    sx = 0.5 + (x - 0.5) / s
    sy = 0.5 + (y - 0.5) / s
    if inside_shield(sx, sy):
        if gut(sx, sy):
            return (233, 87, 122, 255)
        return (255, 247, 242, 255)
    return bg


def render(size, maskable=False, ss=3):
    px = []
    for j in range(size):
        for i in range(size):
            acc = [0, 0, 0, 0]
            for a in range(ss):
                for b in range(ss):
                    c = sample((i + (a + 0.5) / ss) / size, (j + (b + 0.5) / ss) / size, maskable)
                    for k in range(4):
                        acc[k] += c[k]
            n = ss * ss
            px.extend(v // n for v in acc)
    return px


if __name__ == "__main__":
    for size, name, mask in ((192, "icon-192.png", False), (512, "icon-512.png", False), (512, "icon-maskable-512.png", True)):
        png(os.path.join(HERE, name), size, size, render(size, mask, 2 if size > 256 else 3))
        print("wrote", name)
