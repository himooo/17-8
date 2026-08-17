// ====================================================================
//  useExitConfirm.ts v1.0
//
//  Hook that intercepts an "exit" action and asks for confirmation when
//  the user is mid-game. Prevents accidental loss of progress when the
//  teacher presses Escape or clicks the X / backdrop during an active
//  game session.
//
//  Usage:
//    const requestExit = useExitConfirm(canExitImmediately, {
//      message: "هل تريد الخروج من اللعبة؟ سيتم فقدان التقدم الحالي.",
//      title: "تأكيد الخروج",
//    });
//    // Then in JSX: onClick={requestExit} instead of onClick={onClose}
//
//  Behavior:
//    - If `isActive` is false → exits immediately, no dialog.
//    - If `isActive` is true  → opens a confirm dialog via the shared
//      `requestConfirm` action from shell-store. On confirm → exits.
//      On cancel → stays in the game.
// =================================================================///
"use client";

import { useCallback } from "react";
import { useShellStore } from "./shell-store";

export interface UseExitConfirmOptions {
  /** Dialog body text (defaulted if omitted). */
  message?: string;
  /** Dialog title (defaulted if omitted). */
  title?: string;
  /** Mark as danger (red confirm button). */
  danger?: boolean;
}

/**
 * Returns a function you can attach to onClose / onClick / Escape handlers.
 * When `isActive` is true, calling the returned function will open a confirm
 * dialog before exiting. When `isActive` is false, exits immediately.
 *
 * @param onExit  The actual exit callback (e.g. () => setShowGame(false)).
 * @param isActive  Whether the user is mid-game (e.g. phase === "playing").
 * @param opts  Optional dialog text overrides.
 */
export function useExitConfirm(
  onExit: () => void,
  isActive: boolean,
  opts: UseExitConfirmOptions = {}
): () => Promise<void> {
  const requestConfirm = useShellStore((s) => s.requestConfirm);

  return useCallback(async () => {
    if (!isActive) {
      onExit();
      return;
    }
    const ok = await requestConfirm(
      opts.message ?? "هل تريد الخروج من اللعبة؟ سيتم فقدان التقدم الحالي.",
      {
        title: opts.title ?? "تأكيد الخروج",
        danger: opts.danger ?? false,
      }
    );
    if (ok) {
      onExit();
    }
  }, [onExit, isActive, requestConfirm, opts.message, opts.title, opts.danger]);
}
