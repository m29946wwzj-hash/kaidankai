#!/usr/bin/env python3
"""Рисует иконки для установки игры на домашний экран.
Запуск: python3 tools/make-icons.py   (из папки kaidan/)"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

BG = (10, 10, 13)
LIT = (201, 162, 39)
DIM = (60, 50, 22)
FLAME = (226, 190, 90)


def icon(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    c = size / 2

    # сто гнёзд по кругу: часть горит, часть погасла
    r = size * 0.40
    dot = max(1.0, size * 0.011)
    for i in range(100):
        a = 2 * math.pi * i / 100 - math.pi / 2
        x, y = c + r * math.cos(a), c + r * math.sin(a)
        lit = i % 7 not in (0, 3, 6)
        col = LIT if lit else DIM
        d.ellipse([x - dot, y - dot, x + dot, y + dot], fill=col)

    # пламя в середине
    w = size * 0.115
    h = size * 0.30
    d.ellipse([c - w, c - h * 0.75, c + w, c + h * 0.75], fill=FLAME)
    d.polygon([(c, c - h), (c + w * 0.85, c), (c - w * 0.85, c)], fill=FLAME)

    # фитиль
    d.rectangle([c - size * 0.012, c + h * 0.55, c + size * 0.012, c + h * 0.95], fill=DIM)

    return img


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "icons"
    out.mkdir(exist_ok=True)
    for s in (192, 512):
        icon(s).save(out / f"icon-{s}.png")
        print("написала", out / f"icon-{s}.png")


if __name__ == "__main__":
    main()
