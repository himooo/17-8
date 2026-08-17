// ====================================================================
//  CanvasPanel.tsx — Universal container that places ANY panel content
//  INSIDE the iframe stage (canvas), centered, responsive, and bounded.
//
//  Why:
//    The teacher shares the canvas area on Zoom. All panels (Settings,
//    Students, Classes, Gifts, Sounds, etc.) must appear inside this area
//    so students on Zoom can see what the teacher is doing.
//
//  Behavior:
//    - Reads the iframe-stage bounds via getStageBounds()
//    - Centers the panel inside the canvas
//    - Panel max-width: 90% of canvas width (capped 520px)
//    - Panel max-height: 92% of canvas height
//    - Backdrop dims the rest of the canvas (clickable to close)
//    - Header bar with title + close button
//    - Body scrolls if content overflows
//
//  All FloatingSideRail panels and game menus now use this wrapper.
// ====================================================================
"use client";

import { useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { getStageBounds, type StageBounds } from "@/lib/stage-bounds";
import { X, Maximize2, Minimize2 } from "lucide-react";

interface CanvasPanelProps {
  /** Visible when true */
  open: boolean;
  /** Called when user closes the panel */
  onClose: () => void;
  /** Panel title shown in header */
  title: string;
  /** Accent color (defaults to primary) */
  accentColor?: string;
  /** Icon to show next to title */
  icon?: ReactNode;
  /** Panel content */
  children: ReactNode;
  /** Custom max-width as percentage of canvas (default 90, capped 520px) */
  widthPercent?: number;
  /** Custom max-height as percentage of canvas (default 92) */
  heightPercent?: number;
}

export function CanvasPanel({
  open,
  onClose,
  title,
  accentColor = "#0142A0",
  icon,
  children,
  widthPercent = 90,
  heightPercent = 92,
}: CanvasPanelProps) {
  const [bounds, setBounds] = useState<StageBounds | null>(null);
  // Initialize mounted from window existence so we avoid setState-in-effect.
  const [mounted] = useState(() => typeof window !== "undefined");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const b = getStageBounds();
      if (b) setBounds(b);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    // ResizeObserver tracks the stage element directly — no need for a 200ms poll.
    let ro: ResizeObserver | null = null;
    const stageEl = typeof document !== "undefined" ? document.querySelector(".iframe-visible-area") : null;
    if (stageEl && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(stageEl);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      if (ro) ro.disconnect();
    };
  }, [open]);

  if (!mounted || !open) return null;

  // ===== Expanded (fullscreen) mode =====
  if (expanded) {
    return createPortal(
      <div className="fixed inset-0 z-[210] bg-black/85 backdrop-blur-md flex flex-col">
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-white/10"
          style={{ background: accentColor }}
        >
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(false)}
              title="العودة للكانفاس"
              className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="إغلاق"
              className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-zinc-900">{children}</div>
      </div>,
      document.body
    );
  }

  // ===== Canvas-confined mode (default) =====
  // Fallback: if no stage bounds yet (e.g., no active lesson), render at
  // viewport center with reasonable max dimensions. This way panels still
  // work even when the canvas is not yet visible.
  const useFallback = !bounds || (bounds.width === 0 && bounds.height === 0);
  let effectiveBounds: StageBounds;
  if (useFallback) {
    // Use viewport as fallback bounds (centered, with margins)
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 720;
    effectiveBounds = {
      left: 60,
      top: 60,
      width: vw - 120,
      height: vh - 120,
      right: vw - 60,
      bottom: vh - 60,
      centerX: vw / 2,
      centerY: vh / 2,
    };
  } else {
    effectiveBounds = bounds;
  }
  const bounds2 = effectiveBounds;

  // Compute panel size: centered inside canvas, bounded
  const maxWidth = Math.min(bounds2.width * (widthPercent / 100), 560);
  const maxHeight = Math.min(bounds2.height * (heightPercent / 100), bounds2.height - 20);
  // Center inside the canvas
  const centerX = bounds2.left + bounds2.width / 2;
  const centerY = bounds2.top + bounds2.height / 2;
  // The panel itself sizes to content up to maxHeight, then we center it
  const panelLeft = centerX - maxWidth / 2;
  const panelTop = centerY - maxHeight / 2;

  return createPortal(
    <>
      {/* Backdrop dimming the rest of the canvas (clickable to close) */}
      <div
        className="fixed z-[100] bg-black/60 backdrop-blur-sm"
        style={{
          left: `${bounds2.left}px`,
          top: `${bounds2.top}px`,
          width: `${bounds2.width}px`,
          height: `${bounds2.height}px`,
        }}
        onClick={onClose}
      />
      {/* The panel itself — centered inside the canvas */}
      <div
        className="fixed z-[110] flex flex-col bg-zinc-900/95 backdrop-blur-md border-2 border-white/15 rounded-2xl shadow-2xl animate-scale-in overflow-hidden"
        style={{
          left: `${panelLeft}px`,
          top: `${panelTop}px`,
          width: `${maxWidth}px`,
          maxHeight: `${maxHeight}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-white/10"
          style={{ background: `${accentColor}25` }}
        >
          <h3
            className="text-sm font-bold flex items-center gap-2 truncate"
            style={{ color: accentColor }}
          >
            {icon}
            {title}
          </h3>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setExpanded(true)}
              title="تكبير خارج الكانفاس"
              className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="إغلاق"
              className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-zinc-900/80">{children}</div>
      </div>
    </>,
    document.body
  );
}
