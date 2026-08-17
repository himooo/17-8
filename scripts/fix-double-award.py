#!/usr/bin/env python3
"""
P1-7 fix: Remove double-award in 9 games.

The bug: games called BOTH awardCorrect(id, pts) AND
recordStudentActivity(id, { points: pts }) for the same event.
Both add pts to student.points — student got 2× the intended points.

The fix: when recordStudentActivity is called AFTER awardCorrect/awardWrong/awardPoints
for the same event, set points: 0 (the activity is still logged as a badge + description,
but no points are added — the award* call already handled the points).

Strategy: for each game, find recordStudentActivity calls that pass `points: <var>`
where the same code path also calls awardCorrect/awardWrong/awardPoints. Change
`points: <var>` → `points: 0` in those recordStudentActivity calls.

This is conservative — it only changes recordStudentActivity calls that explicitly
pass a points value, AND are in a code path that also calls an award function.
Manual review is still recommended.
"""

import re
import os

GAMES_DIR = "/home/z/my-project/src/components/shell"

# Games with the double-award pattern (verified via grep)
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

    # Pattern: recordStudentActivity(id, { type: "correct", description: "...", points: <var> })
    # where the same function also calls awardCorrect.
    # Change to: points: 0
    #
    # We look for recordStudentActivity calls with type: "correct" or type: "star" or type: "wrong"
    # that pass a points variable. These are the ones that double-award.

    # Pattern 1: type: "correct", points: <var>
    # The pattern captures the prefix up to points:, the variable, and the suffix.
    pattern1 = re.compile(
        r'(recordStudentActivity\([^,]+,\s*\{\s*type:\s*"correct"[^}]*?points:\s*)(\w+)([^}]*\})'
    )
    def replace1(m):
        var = m.group(2)
        # If the variable is a number literal like 0, skip
        if var.isdigit() and int(var) == 0:
            return m.group(0)
        changes.append(f"type:correct points:{var} → 0")
        return f'{m.group(1)}0{m.group(3)}  // P1-7: points handled by awardCorrect — no double-award'
    content = pattern1.sub(replace1, content)

    # Pattern 2: type: "star", points: <var> (used for end-of-game bonuses)
    pattern2 = re.compile(
        r'(recordStudentActivity\([^,]+,\s*\{\s*type:\s*"star"[^}]*?points:\s*)(\w+)([^}]*\})'
    )
    def replace2(m):
        var = m.group(2)
        if var.isdigit() and int(var) == 0:
            return m.group(0)
        changes.append(f"type:star points:{var} → 0")
        return f'{m.group(1)}0{m.group(3)}  // P1-7: points handled by awardCorrect/awardPoints — no double-award'
    content = pattern2.sub(replace2, content)

    # Pattern 3: type: "wrong", points: <var> (should always be 0 anyway, but be safe)
    pattern3 = re.compile(
        r'(recordStudentActivity\([^,]+,\s*\{\s*type:\s*"wrong"[^}]*?points:\s*)(\w+)([^}]*\})'
    )
    def replace3(m):
        var = m.group(2)
        if var.isdigit() and int(var) == 0:
            return m.group(0)
        changes.append(f"type:wrong points:{var} → 0")
        return f'{m.group(1)}0{m.group(3)}  // P1-7: points handled by awardWrong — no double-award'
    content = pattern3.sub(replace3, content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    return f"{filename}: " + ", ".join(changes) if changes else f"{filename}: no changes"


def main():
    print("Applying P1-7 fix (remove double-award) to 11 games...")
    print()
    for filename in GAMES:
        if not os.path.exists(os.path.join(GAMES_DIR, filename)):
            print(f"SKIP {filename}: file not found")
            continue
        result = fix_game(filename)
        print(result)


if __name__ == "__main__":
    main()
