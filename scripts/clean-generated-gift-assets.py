from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
files = [
    'rocket-star.png', 'rainbow-medal.png', 'magic-book.png', 'math-trophy.png',
    'super-pencil.png', 'idea-lamp.png', 'comet-sticker.png', 'golden-crown.png',
    'confetti-box.png', 'planet-puzzle.png', 'heart-encouragement.png',
]
for name in files:
    path = root / 'public/gifts' / name
    with Image.open(path).convert('RGBA') as image:
        pixels = []
        for r, g, b, a in image.getdata():
            magenta = a > 0 and r > 150 and b > 125 and g < 115
            green_background = a > 0 and g > 115 and g > r * 1.28 and g > b * 1.18
            if magenta or green_background:
                pixels.append((r, g, b, 0))
            else:
                pixels.append((r, g, b, a))
        image.putdata(pixels)
        tmp = path.with_suffix('.clean.png')
        image.save(tmp, 'PNG', optimize=True)
    tmp.replace(path)

clean = root / 'public/gifts/team-badge-clean.png'
if clean.exists():
    clean.replace(root / 'public/gifts/team-badge.png')

for path in (root / 'public/gifts').glob('*_original.png'):
    path.unlink()
reference = root / 'public/gifts/_v13_reference.png'
if reference.exists():
    reference.unlink()
