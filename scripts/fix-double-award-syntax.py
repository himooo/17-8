#!/usr/bin/env python3
"""
Fix the syntax errors introduced by fix-double-award-v2.py.

The v2 script inserted inline comments like:
  points: 0  // P1-7: points handled by award* call — no double-award });
which break the object literal because the `}` and `);` are commented out.

This script removes those inline comments and puts `});` on the same line.
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

    # Pattern: points: 0  // P1-7: ... });
    # → points: 0 });
    pattern = re.compile(
        r'points:\s*0\s*//\s*P1-7:[^\n]*?\}\);',
    )
    def replace(m):
        changes.append("fixed inline comment")
        return 'points: 0 });  // P1-7: no double-award'

    new_content = pattern.sub(replace, content)

    # Also fix: points: 0  // P1-7: ... });
    # (variant with different ending)
    pattern2 = re.compile(
        r'points:\s*0\s*//\s*P1-7:[^\n]*?\}\s*\);',
    )
    new_content = pattern2.sub(replace, new_content)

    # Also fix the ones that end with `}  // P1-7...);` (broken by v2 — the `}` is before the comment)
    pattern3 = re.compile(
        r'(\{\s*type:\s*"[^"]*"[^}]*?points:\s*0\s*)\}\s*//\s*P1-7:[^\n]*?\);',
        re.DOTALL,
    )
    def replace3(m):
        changes.append("fixed broken object literal")
        return m.group(1) + '});  // P1-7: no double-award'

    new_content = pattern3.sub(replace3, new_content)

    if new_content != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return f"{filename}: " + ", ".join(changes)
    return f"{filename}: no changes"


def main():
    print("Fixing syntax errors from fix-double-award-v2.py...")
    print()
    for filename in GAMES:
        if not os.path.exists(os.path.join(GAMES_DIR, filename)):
            print(f"SKIP {filename}: file not found")
            continue
        result = fix_game(filename)
        print(result)


if __name__ == "__main__":
    main()
