from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
files = [
    'rocket-star.png', 'rainbow-medal.png', 'magic-book.png', 'math-trophy.png',
    'super-pencil.png', 'idea-lamp.png', 'comet-sticker.png', 'golden-crown.png',
    'team-badge.png', 'confetti-box.png', 'planet-puzzle.png', 'heart-encouragement.png',
]
for name in files:
    path = root / 'public/gifts' / name
    with Image.open(path).convert('RGBA') as image:
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        image.save(path, 'PNG', optimize=True)
        print(f'{name}: {image.size}')
