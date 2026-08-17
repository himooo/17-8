#!/usr/bin/env python3
"""
P0-5 fix: Replace currentQ.correctAnswer with currentQ.correctIdx in
DuelQuizGame, QuestionChallengeGame, GroupBattleGame.

QuickFireGame was already fixed manually.

For each game:
  1. Replace `currentQ.options.indexOf(String(currentQ.correctAnswer))` → `currentQ.correctIdx`
  2. Replace `String(currentQ.correctAnswer) === opt` → `i === currentQ.correctIdx` (in render)
  3. Replace `String(idx) === String(currentQ.correctAnswer)` → `idx === currentQ.correctIdx`
  4. Change state type from LessonQuestion[] to GameQuestion[]
  5. Add GameQuestion to imports, remove LessonQuestion import if unused
"""

import re
import os

GAMES_DIR = "/home/z/my-project/src/components/shell"

GAMES = [
    "DuelQuizGame.tsx",
    "QuestionChallengeGame.tsx",
    "GroupBattleGame.tsx",
]


def fix_game(filename: str) -> str:
    path = os.path.join(GAMES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    changes = []

    # 1. Fix the answer() function's isCorrect check
    # Pattern: const isCorrect = currentQ.options ? idx === currentQ.options.indexOf(String(currentQ.correctAnswer)) : String(idx) === String(currentQ.correctAnswer);
    old_pattern1 = re.compile(
        r'const isCorrect = currentQ\.options\s*\?\s*\w+ === currentQ\.options\.indexOf\(String\(currentQ\.correctAnswer\)\)\s*:\s*String\(\w+\) === String\(currentQ\.correctAnswer\);'
    )
    new1 = "const isCorrect = idx === currentQ.correctIdx;  // P0-5 fix: GameQuestion has correctIdx, not correctAnswer"
    if old_pattern1.search(content):
        content = old_pattern1.sub(new1, content)
        changes.append("answer() isCorrect fixed")
    else:
        # Try variant with answerIdx
        old_pattern1b = re.compile(
            r'const isCorrect = currentQ\.options\s*\?\s*answerIdx === currentQ\.options\.indexOf\(String\(currentQ\.correctAnswer\)\)\s*:\s*String\(answerIdx\) === String\(currentQ\.correctAnswer\);'
        )
        new1b = "const isCorrect = answerIdx === currentQ.correctIdx;  // P0-5 fix: GameQuestion has correctIdx, not correctAnswer"
        if old_pattern1b.search(content):
            content = old_pattern1b.sub(new1b, content)
            changes.append("answer() isCorrect fixed (answerIdx variant)")

    # 2. Fix the render-time isCorrect check (highlight correct option)
    # Pattern: const isCorrect = showReveal && String(currentQ.correctAnswer) === opt;
    # Pattern: const isCorrect = phase === "reveal" && String(currentQ.correctAnswer) === opt;
    old_pattern2 = re.compile(
        r'const isCorrect = (\w+) && String\(currentQ\.correctAnswer\) === opt;'
    )
    def replace_render(m):
        cond = m.group(1)
        # We need to know the index variable — usually `i` from .map((opt, i) =>
        return f"const isCorrect = {cond} && i === currentQ.correctIdx;  // P0-5 fix"
    if old_pattern2.search(content):
        content = old_pattern2.sub(replace_render, content)
        changes.append("render isCorrect fixed")

    # 3. Fix display of correct answer text (if any) — change currentQ.correctAnswer to currentQ.options[currentQ.correctIdx]
    # Pattern: {currentQ.correctAnswer}
    old_pattern3 = re.compile(r'\{currentQ\.correctAnswer\}')
    if old_pattern3.search(content):
        content = old_pattern3.sub("{currentQ.options[currentQ.correctIdx]}", content)
        changes.append("correctAnswer display fixed")

    # 4. Change state type from LessonQuestion[] to GameQuestion[]
    old_state = 'useState<LessonQuestion[]>([])'
    new_state = 'useState<GameQuestion[]>([])  // P0-5 fix: GameQuestion has correctIdx'
    if old_state in content:
        content = content.replace(old_state, new_state)
        changes.append("state type fixed")

    # 5. Add GameQuestion import
    if "type GameQuestion" not in content and "GameQuestion" in content:
        # Add to existing useGameStudentPicker import
        old_import_pattern = re.compile(
            r'(import\s+\{[^}]*useGameStudentPicker[^}]*\}\s*from\s*"@/lib/useGameStudentPicker";)'
        )
        m = old_import_pattern.search(content)
        if m:
            old_import = m.group(1)
            if "type GameQuestion" not in old_import:
                # Add type GameQuestion
                new_import = old_import.replace(
                    "useGameStudentPicker",
                    "useGameStudentPicker, type GameQuestion"
                )
                content = content.replace(old_import, new_import)
                changes.append("GameQuestion import added")

    # 6. Remove unused LessonQuestion import
    if "LessonQuestion" not in content.replace("import type { LessonQuestion }", ""):
        # If LessonQuestion is only in the import line, remove it
        old_lesson_import = 'import type { LessonQuestion } from "@/lib/slide-schema";\n'
        if old_lesson_import in content:
            content = content.replace(old_lesson_import, "")
            changes.append("unused LessonQuestion import removed")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    return f"{filename}: " + ", ".join(changes) if changes else f"{filename}: no changes needed"


def main():
    print("Applying P0-5 fix (correctAnswer → correctIdx) to 3 games...")
    print()
    for filename in GAMES:
        result = fix_game(filename)
        print(result)


if __name__ == "__main__":
    main()
