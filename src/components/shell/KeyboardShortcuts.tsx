"use client";

import { useEffect } from "react";
import { useShellStore, type WhiteboardTool, type WhiteboardColor } from "@/lib/shell-store";
import { useAudioSettingsSync } from "@/lib/shell-utils";

/**
 * KeyboardShortcuts v3.0
 *
 * الاختصارات:
 * - ← / Space: الخطوة التالية
 * - →: الخطوة السابقة
 * - P: قلم
 * - H: قلم تظليل (highlighter)
 * - E: ممحاة
 * - L: ليزر
 * - T: نص
 * - S: أشكال
 * - A: سهم
 * - R: اختيار طالب عشوائي
 * - C: مسح السبورة
 * - M: كتم الصوت
 * - W: تفعيل/إيقاف السبورة
 * - F: ملء الشاشة
 * - N: عرض النوتس overlay
 * - +/=: نقطة للطالب المختار
 * - Ctrl+Z: تراجع
 * - 1/2/3/4/5/6: ألوان القلم
 * - -,[: تصغير سماكة القلم / ]: تكبير سماكة القلم
 */
export function KeyboardShortcuts() {
  const nextStep = useShellStore((s) => s.nextStep);
  const prevStep = useShellStore((s) => s.prevStep);
  const setWhiteboardTool = useShellStore((s) => s.setWhiteboardTool);
  const updateSettings = useShellStore((s) => s.updateSettings);
  const settings = useShellStore((s) => s.settings);
  const clearWhiteboard = useShellStore((s) => s.clearWhiteboard);
  const undoWhiteboard = useShellStore((s) => s.undoWhiteboard);
  const awardPoints = useShellStore((s) => s.awardPoints);
  const awardCorrect = useShellStore((s) => s.awardCorrect);
  const awardWrong = useShellStore((s) => s.awardWrong);
  const currentlyCalledStudent = useShellStore((s) => s.currentlyCalledStudent);
  const playSound = useShellStore((s) => s.playSound);
  const students = useShellStore((s) => s.students);
  const setWhiteboardColor = useShellStore((s) => s.setWhiteboardColor);
  const setWhiteboardThickness = useShellStore((s) => s.setWhiteboardThickness);
  const whiteboardThickness = useShellStore((s) => s.whiteboardThickness);
  const requestFullscreenToggle = useShellStore((s) => s.requestFullscreenToggle);

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key;
      const code = e.code;

      // Escape = يقفل كل النوافذ المفتوحة
      if (key === "Escape") {
        // If a game is mid-play, ask for confirmation before force-closing.
        // The confirm dialog itself is dismissable by Escape (handled by
        // ConfirmDialogHost), so a second Escape press will close the dialog
        // and the user can press Escape again to actually exit the game.
        if (useShellStore.getState().gameActivityActive) {
          const ok = await useShellStore.getState().requestConfirm(
            "هل تريد الخروج من اللعبة؟ سيتم فقدان التقدم الحالي في هذه الجولة.",
            { title: "تأكيد الخروج من اللعبة", danger: true }
          );
          if (!ok) return;
          // User confirmed — clear the active flag so subsequent Escapes don't re-prompt.
          useShellStore.getState().setGameActivityActive(false);
        }
        e.preventDefault();
        // إغلاق كل الـ overlays
        useShellStore.getState().setActivePanel(null);
        useShellStore.getState().setActiveGame(null);
        useShellStore.getState().setAwardedGiftDisplay(null);
        useShellStore.getState().setLeaderboardVisible(false);
        useShellStore.getState().setViewingHelperAsset(null);
        useShellStore.getState().setSelectedStamp(null);
        useShellStore.getState().updateSettings({ notesOverlayOpen: false });
        // إرسال حدث لإغلاق أي overlays أخرى
        window.dispatchEvent(new CustomEvent("close-all-overlays"));
        return;
      }
      const lowerKey = key.toLowerCase();
      // استخدام code للتعرف على الحرف بغض النظر عن لغة لوحة المفاتيح
      const keyChar = code.replace("Key", "").replace("Digit", "").toLowerCase();

      // P0-6 fix: when a game overlay is active, ignore all single-letter shortcuts
      // except F (fullscreen), M (mute), and Escape (handled above). This prevents
      // invisible side-effects like pressing A/L during TugOfWar triggering
      // whiteboard tool changes behind the game overlay.
      if (useShellStore.getState().activeGame) {
        if (keyChar === "f") {
          e.preventDefault();
          requestFullscreenToggle();
          return;
        }
        if (keyChar === "m") {
          e.preventDefault();
          updateSettings({ muted: !settings.muted });
          return;
        }
        // All other single-letter shortcuts are ignored while a game is open.
        return;
      }

      // Ctrl+Z = Undo (highest priority)
      if ((e.ctrlKey || e.metaKey) && keyChar === "z") {
        e.preventDefault();
        e.stopPropagation();
        undoWhiteboard();
        playSound("click");
        return;
      }

      // Ctrl+Y = Redo
      if ((e.ctrlKey || e.metaKey) && keyChar === "y") {
        e.preventDefault();
        useShellStore.getState().redoWhiteboard();
        playSound("click");
        return;
      }

      // Shift+E = Big eraser (×2)
      if (e.shiftKey && keyChar === "e") {
        e.preventDefault();
        updateSettings({ whiteboardEnabled: true });
        useShellStore.getState().setWhiteboardTool("eraser-big");
        playSound("click");
        return;
      }

      // Navigation (RTL: ArrowLeft = Next, ArrowRight = Prev)
      if (key === "ArrowLeft" || key === " ") {
        e.preventDefault();
        nextStep();
        return;
      }
      if (key === "ArrowRight") {
        e.preventDefault();
        prevStep();
        return;
      }

      // Fullscreen
      if (keyChar === "f") {
        e.preventDefault();
        requestFullscreenToggle();
        return;
      }

      // Notes overlay toggle
      if (keyChar === "n") {
        e.preventDefault();
        updateSettings({ notesOverlayOpen: !settings.notesOverlayOpen });
        return;
      }

      // Celebration shortcut (G = great!) — uses unified triggerCelebration
      // so DB log + banner + mapped sound all fire correctly.
      if (keyChar === "g") {
        e.preventDefault();
        useShellStore.getState().triggerCelebration("confetti");
        return;
      }

      // Error sound shortcut (B = bad!)
      if (keyChar === "b") {
        e.preventDefault();
        useShellStore.getState().triggerRedFlash();
        useShellStore.getState().playSound("error");
        return;
      }

      // Success sound shortcut (V = valid/correct + award 3 points to current student)
      // C47 (P0-6 fix): added !e.shiftKey guard so Shift+V (toggle virtual comments,
      // handler below) actually works. Previously this handler matched BOTH plain V
      // and Shift+V (because keyChar is always lowercase), returned early, and the
      // Shift+V branch was unreachable — virtual comments keyboard toggle was dead.
      if (!e.shiftKey && keyChar === "v") {
        e.preventDefault();
        useShellStore.getState().triggerGreenFlash();
        useShellStore.getState().playSound("success");
        // Also award points if a student is called
        const cs = useShellStore.getState().currentlyCalledStudent;
        if (cs) {
          useShellStore.getState().awardCorrect(cs.id, 3);
          useShellStore.getState().triggerCelebration("confetti");
        }
        return;
      }

      // v10: D = toggle precision mode
      if (keyChar === "d") {
        e.preventDefault();
        const cur = useShellStore.getState().settings.precisionMode ?? false;
        updateSettings({ precisionMode: !cur });
        playSound("click");
        return;
      }

      // Whiteboard tools
      const toolMap: Record<string, WhiteboardTool> = {
        p: "pen",
        h: "highlighter",
        e: "eraser",
        l: "laser",
        t: "text",
        s: "shape",
        a: "arrow",
        k: "laserpen",
      };
      if (keyChar in toolMap) {
        e.preventDefault();
        updateSettings({ whiteboardEnabled: true });
        setWhiteboardTool(toolMap[keyChar]);
        return;
      }

      // Toggle whiteboard
      if (keyChar === "w") {
        e.preventDefault();
        updateSettings({ whiteboardEnabled: !settings.whiteboardEnabled });
        return;
      }

      // Clear whiteboard
      if (keyChar === "c") {
        e.preventDefault();
        clearWhiteboard();
        playSound("click");
        return;
      }

      // Toggle Virtual Comments (Shift+V — plain V is "success sound" above)
      if (e.shiftKey && keyChar === "v") {
        e.preventDefault();
        const current = useShellStore.getState().virtualCommentsEnabled;
        useShellStore.getState().setVirtualCommentsEnabled(!current);
        playSound("click");
        return;
      }

      // Mute toggle
      if (keyChar === "m") {
        e.preventDefault();
        updateSettings({ muted: !settings.muted });
        return;
      }

      // Random student - dispatch event to open wheel (BottomControlBar listens)
      if (keyChar === "r") {
        e.preventDefault();
        if (students.length > 0) {
          window.dispatchEvent(new CustomEvent("open-student-wheel"));
        }
        return;
      }

      // Award points to current student
      // Note: "=" is accepted as a synonym for "+" because Shift+= produces "+"
      // on most keyboards. Keeping both pressed as one binding is intentional.
      if (key === "+" || key === "=") {
        e.preventDefault();
        if (currentlyCalledStudent) {
          awardPoints(currentlyCalledStudent.id, 1);
          playSound("click");
        }
        return;
      }

      // Correct answer shortcut - already handled above (V = sound + award)
      // Removed duplicate handler

      // Wrong answer shortcut (X = error + deduct 1 point from current student)
      if (keyChar === "x") {
        e.preventDefault();
        useShellStore.getState().triggerRedFlash();
        useShellStore.getState().playSound("error");
        const cs = useShellStore.getState().currentlyCalledStudent;
        if (cs) {
          useShellStore.getState().awardWrong(cs.id);
        }
        return;
      }

      // Color shortcuts (1-6) — Shift+1/2/3 = laser colour instead
      const colorMap: Record<string, WhiteboardColor> = {
        "1": "blue",
        "2": "red",
        "3": "green",
        "4": "yellow",
        "5": "white",
        "6": "black",
      };
      if (keyChar in colorMap) {
        e.preventDefault();
        if (e.shiftKey && (keyChar === "1" || keyChar === "2" || keyChar === "3")) {
          const laserMap = { "1": "red", "2": "green", "3": "blue" } as const;
          useShellStore.getState().setLaserColor(laserMap[keyChar as "1" | "2" | "3"]);
          useShellStore.getState().playSound("click");
          return;
        }
        setWhiteboardColor(colorMap[keyChar]);
        return;
      }

      // Thickness shortcuts (-, [ to decrease / ] to increase)
      // Note: "=" and "+" are NOT bound here — they're claimed by the
      // "award point" shortcut above, which always runs first.
      if (key === "-" || key === "_" || key === "[") {
        e.preventDefault();
        const cur = useShellStore.getState().whiteboardThickness;
        setWhiteboardThickness(Math.max(1, cur - 1));
        playSound("click");
        return;
      }
      if (key === "]") {
        e.preventDefault();
        const cur = useShellStore.getState().whiteboardThickness;
        setWhiteboardThickness(Math.min(30, cur + 1));
        playSound("click");
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    nextStep,
    prevStep,
    setWhiteboardTool,
    updateSettings,
    settings.whiteboardEnabled,
    settings.muted,
    settings.notesOverlayOpen,
    clearWhiteboard,
    undoWhiteboard,
    awardPoints,
    awardCorrect,
    awardWrong,
    currentlyCalledStudent,
    playSound,
    students.length,
    setWhiteboardColor,
    setWhiteboardThickness,
    whiteboardThickness,
    requestFullscreenToggle,
  ]);

  // Sync audio engine
  useAudioSettingsSync(settings.muted, settings.volume);

  return null;
}
