# -*- coding: utf-8 -*-
"""用 Python 标准库生成应用图标(纯 PNG,无需第三方依赖)。
生成一个主题蓝底 + 白色 3x3 网格的图标,暗示"课程表"。
"""
import struct
import zlib
import os


def chunk(typ, data):
    c = struct.pack('>I', len(data)) + typ + data
    c += struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    return c


def make_icon(size, bg, fg):
    margin = int(size * 0.18)
    gap = max(2, int(size * 0.07))
    step = (size - 2 * margin + gap) / 3.0
    cell = step - gap
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r, g, b, a = bg
            px = x - margin
            py = y - margin
            if px >= 0 and py >= 0:
                ix = int(px / step)
                iy = int(py / step)
                if ix < 3 and iy < 3:
                    ox = px - ix * step
                    oy = py - iy * step
                    if ox < cell and oy < cell:
                        r, g, b, a = fg
            row += bytes((r, g, b, a))
        rows.append(bytes(row))

    raw = b''.join(b'\x00' + row for row in rows)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(raw))
           + chunk(b'IEND', b''))
    return png


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(here, '..', 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    bg = (242, 134, 149, 255)  # #f28695
    fg = (255, 255, 255, 255)

    targets = [
        ('icon-192.png', 192),
        ('icon-512.png', 512),
        ('apple-touch-icon.png', 180),
    ]
    for name, size in targets:
        path = os.path.join(icons_dir, name)
        with open(path, 'wb') as f:
            f.write(make_icon(size, bg, fg))
        print('generated', path)


if __name__ == '__main__':
    main()
