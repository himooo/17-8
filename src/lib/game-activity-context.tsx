// ====================================================================
//  game-activity-context.tsx v1.0
//
//  Context that lets any game declare itself "active" (mid-game) so the
//  wrapping GameOverlay can prompt for confirmation before closing.
//
//  Why a context + a shell-store mirror:
//    Games don't create their own GameOverlay — BottomControlBar does.
//    So games have no direct way to pass `isActive` to their wrapper.
//    A context bridges this: each game marks itself active via
//    `useGameActivity()` hook, and GameOverlay reads the value via
//    `useGameActivityState()` to decide whether to confirm on exit.
//
//  The shell-store mirror (`gameExitConfirmPending`) lets the global
//  Escape handler (KeyboardShortcuts.tsx) check whether to confirm
//  before force-closing — Escape goes through the same confirm dialog
//  as clicking X / backdrop.
//
//  Usage in a game:
//    const setActive = useGameActivity();
//    useEffect(() => { setActive(phase === "playing"); }, [phase, setActive]);
//
//  Usage in GameOverlay:
//    const isActive = useGameActivityState();
//    const requestExit = useExitConfirm(onClose, isActive);
//    // attach requestExit to backdrop click + X button
// =================================================================///
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useShellStore } from "./shell-store";

interface GameActivityContextValue {
  /** Whether the current game is mid-play (should confirm before exit). */
  active: boolean;
  /** Mark the current game as active/inactive. */
  setActive: (v: boolean) => void;
}

const GameActivityContext = createContext<GameActivityContextValue>({
  active: false,
  setActive: () => {},
});

/** Provider that wraps each GameOverlay instance. */
export function GameActivityProvider({ children }: { children: ReactNode }) {
  const [active, setActiveState] = useState(false);
  // Mirror to shell-store so the global Escape handler can check whether
  // to confirm before force-closing. We read the setter once.
  const setGameActiveInStore = useShellStore((s) => s.setGameActivityActive);
  const setActive = useCallback(
    (v: boolean) => {
      setActiveState(v);
      setGameActiveInStore(v);
    },
    [setGameActiveInStore]
  );
  const value = useMemo(() => ({ active, setActive }), [active, setActive]);
  return (
    <GameActivityContext.Provider value={value}>
      {children}
    </GameActivityContext.Provider>
  );
}

/** Hook for games to mark themselves active/inactive. */
export function useGameActivity() {
  const ctx = useContext(GameActivityContext);
  return ctx.setActive;
}

/** Hook for GameOverlay to read whether the current game is active. */
export function useGameActivityState() {
  const ctx = useContext(GameActivityContext);
  return ctx.active;
}

