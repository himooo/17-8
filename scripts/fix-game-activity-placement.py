#!/usr/bin/env python3
"""
Fix the placement of isGameActive + useEffect in each game.

The apply-game-activity.py script inserted the hook right after the last
useShellStore selector, but BEFORE the `phase` state was declared. This
causes "Block-scoped variable 'phase' used before its declaration" errors.

This script moves the isGameActive + useEffect block to AFTER the last
useState declaration in the component body.
"""

import re
import os

GAMES_DIR = "/home/z/my-project/src/components/shell"

GAMES = [
    "LuckyWheelGame.tsx",
    "DiceRollGame.tsx",
    "ReactionTimeGame.tsx",
    "TugOfWarGame.tsx",
    "QuizShowGame.tsx",
    "MathChallengeGame.tsx",
    "MemoryGame.tsx",
    "SpinBottleGame.tsx",
    "HotPotatoGame.tsx",
    "SimonSaysGame.tsx",
    "QuestionChallengeGame.tsx",
    "GroupBattleGame.tsx",
    "DuelQuizGame.tsx",
    "MysteryBoxGame.tsx",
    "QuickFireGame.tsx",
    "GiftRainGame.tsx",
]

# Pattern to find the block we inserted (handles single-line + multi-line forms)
# We look for the comment marker + the const + the useEffect, all together
BLOCK_PATTERN = re.compile(
    r'\n\n  // Mark the game as "active" while in mid-play so the wrapping GameOverlay\n'
    r'  // asks for confirmation before closing \(prevents accidental loss of progress\)\.\n'
    r'  const isGameActive = ([^;]+);\n'
    r'  useEffect\(\(\) => \{\n'
    r'    setGameActive\(isGameActive\);\n'
    r'  \}, \[isGameActive, setGameActive\]\);',
    re.MULTILINE,
)

# Pattern to find the setGameActive declaration line
HOOK_LINE = "  // Mark this game as active/inactive for mid-game exit confirmation.\n  const setGameActive = useGameActivity();\n"


def fix_game(filename: str) -> str:
    path = os.path.join(GAMES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Extract the block we want to move
    match = BLOCK_PATTERN.search(content)
    if not match:
        return f"{filename}: no block found, skipping"
    block_text = match.group(0)
    active_expr = match.group(1)

    # 2. Remove the block from its current position
    content = content[: match.start()] + content[match.end():]

    # 3. Find the LAST `const [...] = useState(...)` declaration in the component body.
    # Simple line-based scan: any line starting with "  const [" and containing "useState("
    lines = content.split("\n")
    last_state_idx = -1
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("const [") and "useState(" in stripped:
            last_state_idx = i
    if last_state_idx == -1:
        return f"{filename}: WARN no useState found, leaving block in original position"

    # 4. Insert the block right after the last useState line
    new_block_lines = [
        "",
        "",
        '  // Mark the game as "active" while in mid-play so the wrapping GameOverlay',
        '  // asks for confirmation before closing (prevents accidental loss of progress).',
        f"  const isGameActive = {active_expr};",
        "  useEffect(() => {",
        "    setGameActive(isGameActive);",
        "  }, [isGameActive, setGameActive]);",
    ]
    lines = lines[: last_state_idx + 1] + new_block_lines + lines[last_state_idx + 1:]
    content = "\n".join(lines)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    return f"{filename}: moved block to after last useState (active_expr: {active_expr})"


def main():
    print("Fixing placement of isGameActive + useEffect in 16 games...")
    print()
    for filename in GAMES:
        if not os.path.exists(os.path.join(GAMES_DIR, filename)):
            print(f"SKIP {filename}: file not found")
            continue
        result = fix_game(filename)
        print(result)


if __name__ == "__main__":
    main()
