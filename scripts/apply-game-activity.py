#!/usr/bin/env python3
"""
Apply useGameActivity hook to all 16 games.
For each game, adds:
  1. Import: `import { useGameActivity } from "@/lib/game-activity-context";`
  2. Inside component body: `const setGameActive = useGameActivity();`
  3. useEffect that calls setGameActive(isActive) when active state changes.

Active state per game:
  LuckyWheelGame: spinning
  DiceRollGame: rolling
  ReactionTimeGame: phase === "waiting" || phase === "ready"
  TugOfWarGame: !editing && winner === null  (game in progress, no winner yet)
  QuizShowGame: phase === "question" || phase === "reveal"
  MathChallengeGame: phase === "playing"
  MemoryGame: phase === "showing" || phase === "input"
  SpinBottleGame: spinning
  HotPotatoGame: phase === "playing" || phase === "exploded"
  SimonSaysGame: phase === "showing" || phase === "input"
  QuestionChallengeGame: phase === "showing-question" || phase === "reveal"
  GroupBattleGame: phase === "playing"
  DuelQuizGame: phase === "playing"
  MysteryBoxGame: phase === "playing" || phase === "reveal"
  QuickFireGame: phase === "playing"
  GiftRainGame: phase === "raining" || phase === "reveal"
"""

import re
import os

GAMES_DIR = "/home/z/my-project/src/components/shell"

GAMES = [
    ("LuckyWheelGame.tsx", "spinning"),
    ("DiceRollGame.tsx", "rolling"),
    ("ReactionTimeGame.tsx", 'phase === "waiting" || phase === "ready"'),
    ("TugOfWarGame.tsx", "!editing && winner === null"),
    ("QuizShowGame.tsx", 'phase === "question" || phase === "reveal"'),
    ("MathChallengeGame.tsx", 'phase === "playing"'),
    ("MemoryGame.tsx", 'phase === "showing" || phase === "input"'),
    ("SpinBottleGame.tsx", "spinning"),
    ("HotPotatoGame.tsx", 'phase === "playing" || phase === "exploded"'),
    ("SimonSaysGame.tsx", 'phase === "showing" || phase === "input"'),
    ("QuestionChallengeGame.tsx", 'phase === "showing-question" || phase === "reveal"'),
    ("GroupBattleGame.tsx", 'phase === "playing"'),
    ("DuelQuizGame.tsx", 'phase === "playing"'),
    ("MysteryBoxGame.tsx", 'phase === "playing" || phase === "reveal"'),
    ("QuickFireGame.tsx", 'phase === "playing"'),
    ("GiftRainGame.tsx", 'phase === "raining" || phase === "reveal"'),
]

IMPORT_LINE = 'import { useGameActivity } from "@/lib/game-activity-context";'


def apply_to_game(filename: str, active_expr: str) -> str:
    path = os.path.join(GAMES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    changes = []

    # 1. Add import (after the last existing "@/..." import line in the import block)
    if IMPORT_LINE in content:
        changes.append(f"{filename}: import already present, skipping")
    else:
        # Find the last `import ... from "@/..."` line
        import_pattern = re.compile(r'^(import\s+.*?from\s+"@/[^"]+";)\s*$', re.MULTILINE)
        matches = list(import_pattern.finditer(content))
        if not matches:
            changes.append(f"{filename}: WARN no @/ imports found, skipping import")
        else:
            last = matches[-1]
            content = content[: last.end()] + "\n" + IMPORT_LINE + content[last.end():]
            changes.append(f"{filename}: added import")

    # 2. Add hook call: `const setGameActive = useGameActivity();`
    # Find the LAST `useShellStore` selector line (so we know we're inside the component)
    if "useGameActivity()" in content:
        changes.append(f"{filename}: hook call already present, skipping")
    else:
        # Find the LAST `const X = useShellStore((s) => s.X);` line in the imports/state section
        sel_pattern = re.compile(r'^(  const \w+ = useShellStore\(\([^)]+\) =>[^;]+;\))\s*$', re.MULTILINE)
        matches = list(sel_pattern.finditer(content))
        if not matches:
            # fallback: any const X = useShellStore line
            sel_pattern2 = re.compile(r'^(  const \w+ = useShellStore[^;]+;)\s*$', re.MULTILINE)
            matches = list(sel_pattern2.finditer(content))
        if not matches:
            changes.append(f"{filename}: WARN no useShellStore selector found, skipping hook call")
        else:
            last = matches[-1]
            insert_line = "\n  // Mark this game as active/inactive for mid-game exit confirmation.\n  const setGameActive = useGameActivity();"
            content = content[: last.end()] + insert_line + content[last.end():]
            changes.append(f"{filename}: added hook call")

    # 3. Add useEffect that calls setGameActive(isActive)
    if "setGameActive(isGameActive)" in content:
        changes.append(f"{filename}: effect already present, skipping")
    else:
        anchor = "  const setGameActive = useGameActivity();"
        if anchor in content:
            # Compute isActive as a const in render, then useEffect([isActive, setGameActive]).
            # This avoids stale-closure issues and re-runs only when isActive actually changes.
            effect_code = (

                "\n\n"
                "  // Mark the game as \"active\" while in mid-play so the wrapping GameOverlay\n"
                "  // asks for confirmation before closing (prevents accidental loss of progress).\n"
                f"  const isGameActive = {active_expr};\n"
                "  useEffect(() => {\n"
                "    setGameActive(isGameActive);\n"
                "  }, [isGameActive, setGameActive]);"
            )
            content = content.replace(anchor, anchor + effect_code, 1)
            changes.append(f"{filename}: added effect with isGameActive = {active_expr}")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    return "\n".join(changes)


def main():
    print("Applying useGameActivity hook to 16 games...")
    print()
    for filename, active_expr in GAMES:
        if not os.path.exists(os.path.join(GAMES_DIR, filename)):
            print(f"SKIP {filename}: file not found")
            continue
        result = apply_to_game(filename, active_expr)
        print(result)
        print()


if __name__ == "__main__":
    main()
