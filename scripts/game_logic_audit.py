from pathlib import Path
import re

ROOT = Path('/home/ubuntu/bisalasa-full-audit/src/components/shell')
FILES = [
    'HotPotatoGame.tsx', 'QuickFireGame.tsx', 'DiceRollGame.tsx',
    'MathChallengeGame.tsx', 'MemoryGame.tsx', 'MysteryBoxGame.tsx',
    'QuestionChallengeGame.tsx', 'QuizShowGame.tsx', 'ReactionTimeGame.tsx',
]
patterns = {
    'phase': r'phase',
    'questions': r'useGameQuestions|lessonQuestions|GameQuestion',
    'timeouts': r'setTimeout|setInterval|requestAnimationFrame',
    'cleanup': r'clearTimeout|clearInterval|cancelAnimationFrame|return \(\) =>',
    'rewards': r'awardPoints|awardCorrect|awardWrong|recordStudentActivity|addGroupPoints',
    'lock_refs': r'LockRef|lockRef|answeredRef|rollingRef|selectionLockRef|explodedRef|gameOverRef',
    'absent_filter': r'isAbsent|filterPresentStudents|classStudents',
    'exit': r'useExitConfirm|onClose|handleClose|requestConfirm',
}
for name in FILES:
    text = (ROOT / name).read_text(encoding='utf-8')
    counts = {k: len(re.findall(v, text)) for k, v in patterns.items()}
    lines = len(text.splitlines())
    print(name, 'lines=', lines, *[f'{k}={v}' for k,v in counts.items()])
    missing = [k for k,v in counts.items() if v == 0]
    if missing:
        print('  MISSING:', ','.join(missing))
print('TOTAL_FILES', len(FILES))
