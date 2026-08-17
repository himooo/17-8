from pathlib import Path
from PIL import Image
import subprocess

root = Path(__file__).resolve().parents[1]
print('images')
for path in sorted((root / 'public/gifts').glob('*')):
    if path.name.startswith('_v13_') or path.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.webp'}:
        continue
    try:
        with Image.open(path) as image:
            alpha = image.getchannel('A') if 'A' in image.getbands() else None
            extrema = alpha.getextrema() if alpha else None
            magenta_pixels = 0
            visible_pixels = 0
            if alpha:
                rgba = image.convert('RGBA')
                for r, g, b, a in rgba.getdata():
                    if a > 8:
                        visible_pixels += 1
                        if r > 180 and b > 140 and g < 90:
                            magenta_pixels += 1
            ratio = (magenta_pixels / visible_pixels) if visible_pixels else 0
            print(f'{path.name}\\t{image.size}\\tmode={image.mode}\\talpha={extrema}\\tmagenta_visible_ratio={ratio:.5f}')
    except Exception as exc:
        print(f'ERROR {path.name}: {exc}')
print('sounds')
for path in sorted((root / 'public/sounds').glob('bisalasa-*.wav')):
    result = subprocess.run([
        'ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=codec_name,sample_rate,channels',
        '-of', 'default=noprint_wrappers=1', str(path)
    ], capture_output=True, text=True, check=False)
    print(path.name, result.stdout.strip().replace('\n', ' '))
