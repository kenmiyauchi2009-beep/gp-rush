# アイコンを作る（python3 tools/make_icons.py）。Pillow が必要。
# 夕方の空・奥へ続く道・赤白の縁石・後ろから見たマシンを、大きく描いてから縮める。
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
S = 2048  # 大きく描いて縮める


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw():
    im = Image.new('RGB', (S, S))
    d = ImageDraw.Draw(im)
    hor = int(S * 0.46)
    # 空
    top, mid, low = (22, 30, 64), (214, 92, 70), (255, 196, 110)
    for y in range(hor):
        t = y / hor
        c = lerp(top, mid, t / 0.7) if t < 0.7 else lerp(mid, low, (t - 0.7) / 0.3)
        d.line([(0, y), (S, y)], fill=c)
    # 夕日
    d.ellipse([S * 0.36, hor - S * 0.2, S * 0.64, hor + S * 0.08], fill=(255, 226, 150))
    # 山
    pts = [(0, hor)]
    for i in range(0, 41):
        x = S * i / 40
        y = hor - S * (0.05 + 0.04 * ((i * 7) % 5) / 4 + 0.03 * (i % 3 == 0))
        pts.append((x, y))
    pts.append((S, hor))
    d.polygon(pts, fill=(58, 40, 70))
    # 地面
    d.rectangle([0, hor, S, S], fill=(40, 92, 48))
    # 道（台形）と縁石
    cx = S / 2
    def road_x(y, k):
        t = (y - hor) / (S - hor)
        return cx + k * (S * 0.02 + t * S * 0.62)
    n = 18
    for i in range(n):
        # 遠くほど細かい帯（遠近）
        t0 = (i / n) ** 2
        t1 = ((i + 1) / n) ** 2
        y0 = hor + (S - hor) * t0
        y1 = hor + (S - hor) * t1
        col = (232, 232, 232) if i % 2 else (214, 38, 43)
        for side in (-1, 1):
            d.polygon([(road_x(y0, side * 1.0), y0), (road_x(y0, side * 1.13), y0),
                       (road_x(y1, side * 1.13), y1), (road_x(y1, side * 1.0), y1)], fill=col)
        d.polygon([(road_x(y0, -1), y0), (road_x(y0, 1), y0), (road_x(y1, 1), y1), (road_x(y1, -1), y1)],
                  fill=(84, 88, 96) if i % 2 else (78, 82, 90))
    # 中央の白い線
    for i in range(0, n, 2):
        t0 = (i / n) ** 2
        t1 = ((i + 0.8) / n) ** 2
        y0 = hor + (S - hor) * t0
        y1 = hor + (S - hor) * t1
        d.polygon([(road_x(y0, -0.025), y0), (road_x(y0, 0.025), y0), (road_x(y1, 0.025), y1), (road_x(y1, -0.025), y1)],
                  fill=(240, 240, 240))
    # マシン（後ろから）
    W = S * 0.62
    x0 = cx - W / 2
    y0 = S * 0.6
    H = W * 0.52
    def R(a, b, c, e):
        return [x0 + W * a, y0 + H * b, x0 + W * c, y0 + H * e]
    d.ellipse([x0 - W * 0.02, y0 + H * 0.85, x0 + W * 1.02, y0 + H * 1.05], fill=(20, 40, 25))
    d.rounded_rectangle(R(0.03, 0.45, 0.23, 0.97), radius=int(W * 0.05), fill=(18, 18, 20))
    d.rounded_rectangle(R(0.77, 0.45, 0.97, 0.97), radius=int(W * 0.05), fill=(18, 18, 20))
    d.polygon([(x0 + W * 0.47, y0 + H * 0.22), (x0 + W * 0.53, y0 + H * 0.22), (x0 + W * 0.66, y0 + H * 0.82), (x0 + W * 0.34, y0 + H * 0.82)],
              fill=(211, 32, 43))
    d.polygon([(x0 + W * 0.1, y0 + H * 0.46), (x0 + W * 0.9, y0 + H * 0.46), (x0 + W * 0.73, y0 + H * 0.8), (x0 + W * 0.27, y0 + H * 0.8)],
              fill=(160, 22, 30))
    d.polygon([(x0 + W * 0.27, y0 + H * 0.8), (x0 + W * 0.73, y0 + H * 0.8), (x0 + W * 0.76, y0 + H * 0.95), (x0 + W * 0.24, y0 + H * 0.95)],
              fill=(16, 18, 21))
    d.rounded_rectangle(R(0.14, 0.04, 0.18, 0.46), radius=int(W * 0.01), fill=(120, 16, 22))
    d.rounded_rectangle(R(0.82, 0.04, 0.86, 0.46), radius=int(W * 0.01), fill=(120, 16, 22))
    d.rectangle(R(0.49, 0.18, 0.51, 0.6), fill=(20, 20, 24))
    d.rounded_rectangle(R(0.17, 0.07, 0.83, 0.17), radius=int(W * 0.015), fill=(244, 244, 244))
    d.rounded_rectangle(R(0.17, 0.17, 0.83, 0.22), radius=int(W * 0.01), fill=(170, 24, 32))
    d.ellipse(R(0.455, 0.25, 0.545, 0.36), fill=(255, 210, 63))
    d.rounded_rectangle(R(0.475, 0.63, 0.525, 0.68), radius=int(W * 0.008), fill=(255, 70, 70))
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    big = draw()
    for size in (180, 192, 512):
        big.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f'icon-{size}.png'), optimize=True)
    print('icons written to', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
