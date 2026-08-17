#!/usr/bin/env python3
"""
P1-7 fix v2: Remove double-award in games.

Simpler approach: find any recordStudentActivity call that passes `points: <var>`
where <var> is NOT 0, and change it to `points: 0`.
This is safe because:
- recordStudentActivity's purpose is to LOG the activity (badge + description).
- Points should always be awarded via awardCorrect/awardWrong/awardPoints.
- The only legitimate use of points: N in recordStudentActivity is when
  there's NO corresponding award* call (e.g. MysteryBox prizes, but those
  also call awardCorrect — so still double-award).

Conservative: only changes points: <nonzero-variable> → points: 0.
"""

import re
import os

GAMES_DIR = "/home/z/my-project/src/components/shell"

GAMES = [
    "MathChallengeGame.tsx",
    "QuickFireGame.tsx",
    "QuizShowGame.tsx",
    "QuestionChallengeGame.tsx",
    "SimonSaysGame.tsx",
    "MemoryGame.tsx",
    "SpinBottleGame.tsx",
    "MysteryBoxGame.tsx",
    "GiftRainGame.tsx",
    "HotPotatoGame.tsx",
    "GroupBattleGame.tsx",
]


def fix_game(filename: str) -> str:
    path = os.path.join(GAMES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    changes = []

    # Find all `points: <var>` inside recordStudentActivity calls.
    # Pattern: recordStudentActivity(..., { ..., points: <var>, ... })
    # We match the entire recordStudentActivity call, then within it replace
    # points: <nonzero-var> with points: 0.

    # Match recordStudentActivity( ... ) — non-greedy, single call
    # We look for `points: ` followed by a variable name (not 0)
    pattern = re.compile(
        r'(recordStudentActivity\([^;]*?points:\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*[,})])',
        re.DOTALL
    )

    def replace(m):
        var = m.group(2)
        # Skip if it's the literal 0
        if var == "0":
            return m.group(0)
        changes.append(f"points:{var} → 0")
        return f'{m.group(1)}0  // P1-7: points handled by award* call — no double-award{m.group(3)}'

    new_content = pattern.sub(replace, content)

    if new_content != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return f"{filename}: " + ", ".join(changes)
    return f"{filename}: no changes"


def main():
    print("Applying P1-7 fix v2 (remove double-award) to 11 games...")
    print()
    for filename in GAMES:
        if not os.path.exists(os.path.join(GAMES_DIR, filename)):
            print(f"SKIP {filename}: file not found")
            continue
        result = fix_game(filename)
        print(result)


if __name__ == "__main__":
    main()
