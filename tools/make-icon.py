# -*- coding: utf-8 -*-
"""把任意图片裁剪成正方形并生成 App 图标(192/512/180)"""
import sys
import os
from PIL import Image


def make_icons(src):
    img = Image.open(src).convert('RGB')
    w, h = img.size
    print('原图尺寸:', w, 'x', h)
    # 中心裁剪成正方形
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    # 输出到 icons 目录
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, '..', 'icons')
    os.makedirs(out_dir, exist_ok=True)
    for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
        out = img.resize((size, size), Image.LANCZOS)
        path = os.path.join(out_dir, name)
        out.save(path, 'PNG')
        print('生成', path)


if __name__ == '__main__':
    make_icons(sys.argv[1])
