#!/usr/bin/env python3
"""
generate-icons.py — Creates GRIND app icons (PNG) without external dependencies.
Run once: python3 generate-icons.py

Design: casino chip — outer gold ring, inner neon ring, 8 neon edge notches,
dark centre, neon asterisk arms, gold centre dot.
"""
import zlib, struct, math, os

BG   = (8,   6,   4)
GOLD = (201, 168, 76)
NEON = (200, 241, 53)
DARK = (16,  13,  9)


def blend(base, colour, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(base[i] * (1 - t) + colour[i] * t) for i in range(3))


def write_png(path, size, pixels):
    def u32(n): return struct.pack('>I', n)
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return u32(len(data)) + tag + data + u32(crc)

    raw = b''.join(
        b'\x00' + b''.join(bytes(pixels[y][x]) for x in range(size))
        for y in range(size)
    )
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    png  = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', ihdr)
    png += chunk(b'IDAT', zlib.compress(raw, 6))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print(f'  \u2713 {path}  ({len(png):,} bytes)')


def make_pixels(size):
    s   = size
    cx  = cy = s / 2
    px  = [[BG] * s for _ in range(s)]

    r_out   = s * 0.455   # outer ring radius
    r_in    = s * 0.375   # inner ring radius
    rw_out  = s * 0.018   # outer ring half-width
    rw_in   = s * 0.010   # inner ring half-width

    notch_r0 = r_out - s * 0.06
    notch_r1 = r_out + s * 0.06
    notch_hw = s * 0.026 / r_out   # half-angle (radians)

    arm_len = r_in * 0.58
    arm_w   = s * 0.019

    for y in range(s):
        for x in range(s):
            dx, dy = x - cx, y - cy
            dist   = math.hypot(dx, dy)
            angle  = math.atan2(dy, dx)

            # Outer gold ring
            d = abs(dist - r_out)
            if d < rw_out * 3:
                px[y][x] = blend(px[y][x], GOLD, max(0, 1 - d / (rw_out * 3)) * 0.95)

            # Inner neon ring
            d = abs(dist - r_in)
            if d < rw_in * 3:
                px[y][x] = blend(px[y][x], NEON, max(0, 1 - d / (rw_in * 3)) * 0.9)

            # 8 neon notch ticks
            for i in range(8):
                ta = i * math.pi / 4
                da = abs(((angle - ta + math.pi) % (2 * math.pi)) - math.pi)
                if da < notch_hw and notch_r0 < dist < notch_r1:
                    px[y][x] = blend(px[y][x], NEON, max(0, 1 - da / notch_hw) * 0.85)

            # Dark centre fill
            if dist < r_in - rw_in * 2:
                px[y][x] = DARK

            # Neon asterisk (4 × 2-ended arms)
            for i in range(4):
                aa  = i * math.pi / 4
                prj =  dx * math.cos(aa) + dy * math.sin(aa)
                prp = abs(-dx * math.sin(aa) + dy * math.cos(aa))
                if abs(prj) < arm_len and prp < arm_w:
                    px[y][x] = blend(px[y][x], NEON, max(0, 1 - prp / arm_w) * 0.8)

            # Gold centre dot
            if dist < s * 0.042:
                px[y][x] = blend(px[y][x], GOLD, max(0, 1 - dist / (s * 0.042)))

    return px


os.makedirs('icons', exist_ok=True)
print('Generating GRIND icons...')
for size in (192, 512):
    write_png(f'icons/icon-{size}.png', size, make_pixels(size))
print('Done.')
