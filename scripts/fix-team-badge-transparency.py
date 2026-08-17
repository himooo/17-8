from collections import deque
from pathlib import Path
from PIL import Image

path = Path(__file__).resolve().parents[1] / 'public/gifts/team-badge.png'
image = Image.open(path).convert('RGBA')
w, h = image.size
pixels = image.load()

def is_background(r, g, b, a):
    if a == 0:
        return True
    spread = max(r, g, b) - min(r, g, b)
    return spread < 24 and min(r, g, b) >= 185

seen = bytearray(w * h)
queue = deque()
for x in range(w):
    queue.append((x, 0)); queue.append((x, h - 1))
for y in range(h):
    queue.append((0, y)); queue.append((w - 1, y))
while queue:
    x, y = queue.popleft()
    idx = y * w + x
    if seen[idx]:
        continue
    seen[idx] = 1
    r, g, b, a = pixels[x, y]
    if not is_background(r, g, b, a):
        continue
    pixels[x, y] = (r, g, b, 0)
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
            queue.append((nx, ny))

image.save(path, 'PNG', optimize=True)
print(path, image.mode, image.getchannel('A').getextrema())
