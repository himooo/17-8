#!/usr/bin/env python3
"""
Final fix: ensure the entire useGameActivity block (hook call + isGameActive
const + useEffect) is placed AFTER all useState AND useShellStore declarations.

Strategy: 
  1. Find and remove the existing `const setGameActive = useGameActivity();` 
     line (with its comment).
  2. Find and remove the existing `const isGameActive = ...; useEffect(...)`
     block.
  3. Find the last declaration line (useState OR useShellStore selector OR
     other const-with-hook) in the component body.
  4. Insert both pieces together AFTER that last declaration.
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

# Matches: "  // Mark this game as active/inactive...\n  const setGameActive = useGameActivity();\n"
HOOK_DECL_PATTERN = re.compile(
    r'\n  // Mark this game as active/inactive for mid-game exit confirmation\.\n'
    r'  const setGameActive = useGameActivity\(\);\n'
)

# Matches the isGameActive + useEffect block
BLOCK_PATTERN = re.compile(
    r'\n\n  // Mark the game as "active" while in mid-play so the wrapping GameOverlay\n'
    r'  // asks for confirmation before closing \(prevents accidental loss of progress\)\.\n'
    r'  const isGameActive = ([^;]+);\n'
    r'  useEffect\(\(\) => \{\n'
    r'    setGameActive\(isGameActive\);\n'
    r'  \}, \[isGameActive, setGameActive\]\);'
)


def fix_game(filename: str) -> str:
    path = os.path.join(GAMES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Extract the active_expr from the existing block
    block_match = BLOCK_PATTERN.search(content)
    if not block_match:
        return f"{filename}: no isGameActive block found, skipping"
    active_expr = block_match.group(1)

    # 2. Remove the existing block
    content = content[: block_match.start()] + content[block_match.end():]

    # 3. Remove the existing hook declaration line
    hook_match = HOOK_DECL_PATTERN.search(content)
    if hook_match:
        content = content[: hook_match.start()] + content[hook_match.end():]
    else:
        return f"{filename}: WARN no hook declaration found, but block existed"

    # 4. Find the LAST declaration line in the component body.
    # We consider a "declaration" any line matching one of:
    #   - "  const X = useState(...);"
    #   - "  const X = useShellStore(...);"
    #   - "  const [X, setX] = useState(...);"
    #   - "  const { X, Y } = useGameQuestions(...);"
    # Take the LAST one before any function declaration or empty-line + comment.
    lines = content.split("\n")
    last_decl_idx = -1
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Skip lines inside JSX (they have more indentation typically)
        if not stripped.startswith("const "):
            continue
        # Check if it's a hook-based declaration
        if any(h in stripped for h in ["useState(", "useShellStore(", "useGameQuestions(", "useGameStudentPicker(", "useGameGroupPicker(", "useRef(", "useCallback("]):
            last_decl_idx = i
        # Also accept "const X = useShellStore(...)" without selector
        if "useShellStore" in stripped:
            last_decl_idx = i

    if last_decl_idx == -1:
        return f"{filename}: WARN no declaration line found"

    # 5. Insert the combined block after the last declaration
    new_lines = [
        "",
        "  // Mark this game as active/inactive for mid-game exit confirmation.",
        "  const setGameActive = useGameActivity();",
        "",
        '  // Mark the game as "active" while in mid-play so the wrapping GameOverlay',
        '  // asks for confirmation before closing (prevents accidental loss of progress).',
        f"  const isGameActive = {active_expr};",
        "  useEffect(() => {",
        "    setGameActive(isGameActive);",
        "  }, [isGameActive, setGameActive]);",
    ]
    lines = lines[: last_decl_idx + 1] + new_lines + lines[last_decl_idx + 1:]
    content = "\n".join(lines)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    return f"{filename}: consolidated block after line {last_decl_idx + 1} (active_expr: {active_expr})"


def main():
    print("Consolidating useGameActivity block placement in 16 games...")
    print()
    for filename in GAMES:
        if not os.path.exists(os.path.join(GAMES_DIR, filename)):
            print(f"SKIP {filename}: file not found")
            continue
        result = fix_game(filename)
        print(result)


if __name__ == "__main__":
    main()
