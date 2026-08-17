// ====================================================================
//  GameOverlay.tsx — v9.1
//  Games render INSIDE the exact visible-iframe area (.iframe-visible-area
//  — the same aspect-ratio-locked box the lesson iframe fills). This is the
//  ONLY region shown to students via screen-share/projector zoom, in both
//  landscape and portrait. Not one pixel of any game may render outside it.
//
//  v9.1: Added mid-game exit confirmation. Games mark themselves "active"
//  via useGameActivity() hook (from game-activity-context.tsx). When the
//  user clicks X / backdrop / presses Escape while a game is active,
//  GameOverlay opens a confirm dialog instead of closing immediately —
//  prevents accidental loss of progress during a live class.
// ====================================================================
"use client";

import { useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, BookOpen, AlertTriangle } from "lucide-react";
import { getStageBounds } from "@/lib/stage-bounds";
import { useExitConfirm } from "@/lib/useExitConfirm";
import {
  GameActivityProvider,
  useGameActivityState,
} from "@/lib/game-activity-context";

interface GameOverlayProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  accentColor?: string;
  widthPercent?: number;
  heightPercent?: number;
}

interface CanvasBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function GameOverlay({
  open,
  onClose,
  title,
  children,
  accentColor = "#0142A0",
  widthPercent = 90,
  heightPercent = 92,
}: GameOverlayProps) {
  return (
    <GameActivityProvider>
      <GameOverlayInner
        open={open}
        onClose={onClose}
        title={title}
        accentColor={accentColor}
        widthPercent={widthPercent}
        heightPercent={heightPercent}
      >
        {children}
      </GameOverlayInner>
    </GameActivityProvider>
  );
}

function GameOverlayInner({
  open,
  onClose,
  title,
  children,
  accentColor = "#0142A0",
  widthPercent = 90,
  heightPercent = 92,
}: GameOverlayProps) {
  const [bounds, setBounds] = useState<CanvasBounds | null>(null);
  // Initialize mounted from window existence so we avoid setState-in-effect.
  // (SSR-safe: typeof window !== "undefined" is false on server, true on client first render.)
  const [mounted] = useState(() => typeof window !== "undefined");

  // Read whether the wrapped game has marked itself as "active" (mid-play).
  // If so, GameOverlay asks for confirmation before closing — prevents the
  // teacher from accidentally losing progress during a live class.
  const isActive = useGameActivityState();
  const requestExit = useExitConfirm(onClose, isActive, {
    message: "هل تريد الخروج من اللعبة؟ سيتم فقدان التقدم الحالي في هذه الجولة.",
    title: "تأكيد الخروج من اللعبة",
    danger: true,
  });

  useEffect(() => {
    if (!open) return;
    const update = () => {
      // The exact, aspect-ratio-locked area the lesson iframe fills — this
      // is what a teacher's screen-share/projector zoom actually shows
      // students, so it's the only valid bounding box for game UI.
      const stage = getStageBounds();
      if (stage && stage.width > 100 && stage.height > 100) {
        setBounds({ left: stage.left, top: stage.top, width: stage.width, height: stage.height });
      } else {
        setBounds(null);
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    // Poll every 300ms to catch layout/resize-handle/orientation changes
    // that don't fire a resize/scroll event.
    const interval = setInterval(update, 300);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      clearInterval(interval);
    };
  }, [open]);

  // 🟢 v3 fix: Escape key must also go through requestExit so mid-game
  // confirmation works. Previously Escape called onClose directly,
  // bypassing the confirm dialog and letting the teacher accidentally
  // close an active game.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        requestExit();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, requestExit]);

  if (!mounted || !open) return null;

  // ===== No canvas available — show friendly message =====
  if (!bounds) {
    return createPortal(
      <div
        className="fixed inset-0 z-[210] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        role="alertdialog"
        aria-modal="true"
        aria-label="لا يوجد درس محمّل"
        onClick={requestExit}
      >
        <div
          className="bg-zinc-900 rounded-2xl border-2 border-white/15 p-6 max-w-md text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <BookOpen className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h3 className="text-white font-bold text-lg mb-2">لا يوجد درس محمَّل</h3>
          <p className="text-white/60 text-sm mb-4 leading-relaxed">
            يجب تحميل درس من المنهج أولاً حتى تظهر الألعاب داخل منطقة العرض (الكانفاس).
          </p>
          <button
            onClick={requestExit}
            aria-label="إغلاق رسالة عدم وجود درس"
            className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
          >
            حسناً
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ===== Centered window inside the canvas area =====
  const maxWidth = Math.min(bounds.width * (widthPercent / 100), 900);
  const maxHeight = bounds.height * (heightPercent / 100);

  return createPortal(
    <>
      {/* 🟢 v3 fix: full-screen backdrop OUTSIDE the canvas bounds.
          Previously clicks outside the canvas (on the side rail, teleprompter,
          or empty areas) fell through to the page behind and could open other
          panels without closing the game. Now this full-screen dim layer
          catches ALL clicks outside the canvas and routes them through
          requestExit (with confirmation if mid-game). */}
      <div
        className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-[2px]"
        onClick={requestExit}
      />
      {/* Backdrop dimming the rest of the canvas (clickable to close —
          but goes through requestExit which may confirm if mid-game) */}
      <div
        className="fixed z-[100] bg-black/60 backdrop-blur-sm"
        style={{
          left: `${bounds.left}px`,
          top: `${bounds.top}px`,
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
        }}
        onClick={requestExit}
      />
      {/* The centered window — flex-centered inside the canvas area */}
      <div
        className="fixed z-[110] flex items-center justify-center p-2"
        style={{
          left: `${bounds.left}px`,
          top: `${bounds.top}px`,
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
        }}
        onClick={requestExit}
      >
        <div
          className="flex flex-col bg-zinc-900/95 backdrop-blur-md border-2 border-white/15 rounded-2xl shadow-2xl animate-scale-in overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label={title || "لعبة"}
          style={{
            width: `${maxWidth}px`,
            maxHeight: `${maxHeight}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header bar */}
          <div
            className="flex items-center justify-between px-3 py-1.5 shrink-0 border-b border-white/10"
            style={{ background: `${accentColor}30`, borderBottom: `1px solid ${accentColor}50` }}
          >
            <span
              className="text-xs font-bold truncate max-w-[400px] flex items-center gap-1.5"
              style={{ color: accentColor }}
            >
              {isActive && (
                <AlertTriangle className="w-3 h-3 inline shrink-0" aria-label="اللعبة نشطة" />
              )}
              {title || "لعبة"}
            </span>
            <button
              onClick={requestExit}
              title="إغلاق"
              aria-label="إغلاق اللعبة"
              className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10 transition shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Game body — SCROLLS if content overflows */}
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.3) transparent",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

