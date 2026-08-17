from pathlib import Path
import re

ROOT = Path('/home/ubuntu/bisalasa-full-audit/src/components/shell')
files = sorted(list((ROOT / 'panels').glob('*.tsx')) + [ROOT / 'BottomControlBar.tsx', ROOT / 'FloatingSideRail.tsx', ROOT / 'SmartWhiteboard.tsx', ROOT / 'GameOverlay.tsx', ROOT / 'CelebrationsOverlay.tsx'])
patterns = {
    'buttons': r'<button|<Button',
    'clicks': r'onClick=',
    'disabled': r'disabled=',
    'confirm': r'requestConfirm|useExitConfirm|confirm',
    'async': r'async |await ',
    'db': r'apiCall|localDb|data-store|dbSync|save|delete|update',
    'effect': r'useEffect',
}
for path in files:
    text = path.read_text(encoding='utf-8')
    counts = {k: len(re.findall(v, text)) for k,v in patterns.items()}
    print(path.relative_to(ROOT), 'lines=',len(text.splitlines()), *[f'{k}={v}' for k,v in counts.items()])
print('TOTAL', len(files))
