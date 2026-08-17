"use client";

import { useEffect, useRef, useCallback, useState, useLayoutEffect } from "react";
import Image from "next/image";
import { useShellStore } from "@/lib/shell-store";
import {
  useAudioSettingsSync,
  runStepEffect,
} from "@/lib/shell-utils";
import type {
  ShellToSlideMessage,
  SlideToShellMessage,
} from "@/lib/slide-schema";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { MathToolsPanel } from "./MathToolsPanel";

interface IframeStageProps {
  children?: React.ReactNode;
  /** Clean student/OBS scene: render only lesson content and educational whiteboard. */
  studentView?: boolean;
}

/**
 * IframeStage v8.0
 *
 * بنية نهائية نظيفة:
 * - container (المساحة المتاحة للعرض)
 * - wrapper (يحافظ على aspect ratio، يحتوي على iframe + السبورة كأخوين)
 * - iframe (يملأ wrapper)
 * - SmartWhiteboard (يملأ wrapper، فوق iframe، يتحكم في pointer-events داخلياً)
 *
 * التكبير/التصغير: عبر scale state، يحافظ على aspect ratio
 * المقابض: 8 مقابض واضحة
 */
export function IframeStage({ children, studentView = false }: IframeStageProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const lessons = useShellStore((s) => s.lessons);
  const activeLessonId = useShellStore((s) => s.activeLessonId);
  const currentStep = useShellStore((s) => s.currentStep);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  const setManifest = useShellStore((s) => s.setManifest);
  const setCurrentStep = useShellStore((s) => s.setCurrentStep);
  const setCurrentIdea = useShellStore((s) => s.setCurrentIdea);
  const settings = useShellStore((s) => s.settings);
  const playSound = useShellStore((s) => s.playSound);
  const prevStepRef = useRef<number>(currentStep);
  const prevIdeaRef = useRef<string | null>(currentIdeaId);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wrapperRect, setWrapperRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [scale, setScale] = useState(1.0);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [showMathTools, setShowMathTools] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, scale: 1 });

  // The math lab is a teacher utility, not presentation content. Keep it
  // hidden from the stage until the teacher explicitly opens it from the
  // whiteboard tools menu, and close it when the lesson changes.
  useEffect(() => {
    const toggleMathTools = () => {
      if (!activeLessonId || studentView) return;
      setShowMathTools((visible) => !visible);
    };
    window.addEventListener("bisalasa:toggle-math-tools", toggleMathTools);
    return () => window.removeEventListener("bisalasa:toggle-math-tools", toggleMathTools);
  }, [activeLessonId, studentView]);


  const activeLesson = lessons.find((l) => l.id === activeLessonId);
  const orientation = settings.iframeOrientation || "landscape";
  const device = settings.iframeDevice || "desktop";
  const aspectRatio = orientation === "portrait" ? 9 / 16 : 16 / 9;

  // Helper asset viewer
  const viewingHelperAsset = useShellStore((s) => s.viewingHelperAsset);
  const setViewingHelperAsset = useShellStore((s) => s.setViewingHelperAsset);

  // ========== Send messages to iframe ==========
  const sendMessage = useCallback((msg: ShellToSlideMessage) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      // C49 (P0 fix): use '*' instead of window.location.origin.
      // srcDoc iframes with sandbox="allow-scripts allow-same-origin" may have
      // a null origin in some browsers, causing postMessage with a specific
      // origin to SILENTLY FAIL. This broke ALL slide navigation (GOTO_STEP
      // never reached the iframe). Using '*' ensures delivery. Security is
      // maintained by the sandbox attribute (no popups/top-nav/downloads).
      iframe.contentWindow.postMessage(msg, "*");
    } catch (e) {
      console.warn("Failed to send message to iframe:", e);
    }
  }, []);

  // Captures the persisted "resume position" exactly once, before the
  // MANIFEST handshake below can reset currentStep/currentIdeaId back to
  // the start of the lesson. Starts as "pending" so that we evaluate the
  // persisted state lazily (after hydration completes) rather than at mount.
  const resumeTargetRef = useRef<{ step: number; ideaId: string | null } | null | "pending">("pending");

  // ========== Listen for messages from iframe ==========
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Only accept messages from our own slide iframe — not from any other
      // origin/window (postMessage listeners otherwise accept anything).
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as SlideToShellMessage;
      if (!data || typeof data !== "object" || !data.type) return;
      switch (data.type) {
        case "MANIFEST": {
          setManifest(data.payload);
          // v8.0.1: resume to a previously-saved position (e.g. after an
          // accidental page reload mid-class) exactly once per boot. Resolve
          // the target lazily so we read post-hydration state.
          if (resumeTargetRef.current === "pending") {
            const state = useShellStore.getState();
            resumeTargetRef.current =
              state.currentStep > 1 || state.currentIdeaId
                ? { step: state.currentStep, ideaId: state.currentIdeaId }
                : null;
          }
          const resume = resumeTargetRef.current;
          if (resume) {
            resumeTargetRef.current = null;
            if (resume.ideaId) setCurrentIdea(resume.ideaId);
            setCurrentStep(resume.step);
          }
          const ideaId = data.payload.currentIdeaId || data.payload.ideas?.[0]?.id;
          const step = data.payload.currentStep || 1;
          const steps = ideaId
            ? data.payload.ideas?.find((i) => i.id === ideaId)?.steps || []
            : data.payload.steps || [];
          const stepData = steps[step - 1] || steps.find((s) => s.step === step);
          if (stepData) runStepEffect(stepData);
          break;
        }
        case "STEP_CHANGED": {
          // Only update if different from current to prevent loops
          const state = useShellStore.getState();
          if (state.currentStep !== data.step || (data.ideaId && state.currentIdeaId !== data.ideaId)) {
            setCurrentStep(data.step);
            if (data.ideaId) setCurrentIdea(data.ideaId);
          }
          break;
        }
        case "IDEA_CHANGED": {
          setCurrentIdea(data.ideaId);
          if (data.step) setCurrentStep(data.step);
          break;
        }
        case "READY": {
          sendMessage({ type: "REQUEST_MANIFEST" });
          break;
        }
        case "REQUEST_SOUND": {
          playSound(data.sound);
          break;
        }
        case "ERROR": {
          console.warn("Slide error:", data.message);
          break;
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sendMessage, setManifest, setCurrentStep, setCurrentIdea, playSound]);

  // ========== Sync audio engine ==========
  useAudioSettingsSync(settings.muted, settings.volume);

  // ========== Send GOTO_STEP when currentStep changes ==========
  // Debounced to prevent rapid-fire messages causing freezing
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeLesson) return;
    if (currentStep !== prevStepRef.current || currentIdeaId !== prevIdeaRef.current) {
      // Debounce: clear previous timeout and set new one
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = setTimeout(() => {
        sendMessage({ type: "GOTO_STEP", step: currentStep, ideaId: currentIdeaId || undefined });
        // Slide-linked whiteboard snapshots now restore per step. The teacher's
        // explicit clear action remains available; navigation must not erase it.
        prevStepRef.current = currentStep;
        prevIdeaRef.current = currentIdeaId;
      }, 50);
    }
  }, [currentStep, currentIdeaId, activeLesson, sendMessage]);

  // ========== Reset on lesson change ==========
  useEffect(() => {
    if (activeLesson) {
      prevStepRef.current = 1;
      prevIdeaRef.current = null;
      requestAnimationFrame(() => setScale(1.0));
    }
  }, [activeLessonId, activeLesson]);

  // ========== Fullscreen ==========
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // فول اسكرين للمتصفح كامل (يشيل قوائم المتصفح)
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen failed:", e);
      // Fallback: try container fullscreen
      try {
        if (!document.fullscreenElement) {
          await containerRef.current?.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (e2) {
        console.warn("Container fullscreen also failed:", e2);
      }
    }
  }, []);

  // Other components (FloatingSideRail, KeyboardShortcuts) request a toggle
  // via the store instead of reaching into a window.__toggleFullscreen global.
  const fullscreenToggleSignal = useShellStore((s) => s.fullscreenToggleSignal);
  const isFirstFullscreenSignal = useRef(true);
  useEffect(() => {
    if (isFirstFullscreenSignal.current) {
      isFirstFullscreenSignal.current = false;
      return;
    }
    toggleFullscreen();
  }, [fullscreenToggleSignal, toggleFullscreen]);

  // ========== Compute wrapper rect (maintains aspect ratio) ==========
  const computeWrapperRect = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const cw = cRect.width;
    const ch = cRect.height;

    let baseW = cw;
    let baseH = baseW / aspectRatio;
    if (baseH > ch) {
      baseH = ch;
      baseW = baseH * aspectRatio;
    }

    const w = baseW * scale;
    const h = baseH * scale;
    const left = (cw - w) / 2;
    const top = (ch - h) / 2;

    setWrapperRect({ left, top, width: w, height: h });
  }, [aspectRatio, scale]);

  useLayoutEffect(() => {
    computeWrapperRect();
  }, [computeWrapperRect, orientation, activeLessonId]);

  useEffect(() => {
    const ro = new ResizeObserver(() => computeWrapperRect());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", computeWrapperRect);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", computeWrapperRect);
    };
  }, [computeWrapperRect]);

  // ========== Listen for zoom events from side rail ==========
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.action === "enlarge") {
        setScale((s) => Math.min(2.0, s + 0.1));
      } else if (detail.action === "shrink") {
        setScale((s) => Math.max(0.3, s - 0.1));
      } else if (detail.action === "fit") {
        setScale(1.0);
      }
    };
    window.addEventListener("iframe-resize", handler as EventListener);
    return () => window.removeEventListener("iframe-resize", handler as EventListener);
  }, []);

  // ========== Resize via handles ==========
  const handleResizeStart = useCallback((handle: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handle);
    resizeStart.current = { x: e.clientX, y: e.clientY, scale };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [scale]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!activeHandle || !containerRef.current) return;
    e.preventDefault();
    const container = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;

    let delta = 0;
    if (activeHandle.includes("e") || activeHandle.includes("w")) {
      delta = activeHandle.includes("w") ? -dx : dx;
    }
    if (activeHandle.includes("n") || activeHandle.includes("s")) {
      const d = activeHandle.includes("n") ? -dy : dy;
      delta = Math.max(delta, d * aspectRatio);
    }

    const baseW = container.width;
    const scaleDelta = delta / baseW;
    const newScale = Math.max(0.3, Math.min(2.0, resizeStart.current.scale + scaleDelta));
    setScale(newScale);
  }, [activeHandle, aspectRatio]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    const handle = (e.currentTarget as HTMLElement).dataset.handle;
    if (handle) handleResizeStart(handle, e);
  }, [handleResizeStart]);

  const handleResizeEnd = useCallback(() => {
    setActiveHandle(null);
  }, []);

  if (!activeLesson) {
    return (
      <div ref={containerRef} className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/30 to-background">
        <div className="text-center max-w-md p-8">
          <div className="text-7xl mb-4 opacity-30">📐</div>
          <h2 className="text-2xl font-bold text-muted-foreground mb-2">ابدأ بإضافة درس</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            اضغط على أيقونة <span className="font-bold text-primary">المنهج</span> في الشريط الجانبي لاستيراد ملف شريحة.
          </p>
        </div>
      </div>
    );
  }

  const handleSize = 16;
  const handles = [
    { id: "nw", cx: 0, cy: 0, cursor: "nwse-resize" },
    { id: "n", cx: 0.5, cy: 0, cursor: "ns-resize" },
    { id: "ne", cx: 1, cy: 0, cursor: "nesw-resize" },
    { id: "e", cx: 1, cy: 0.5, cursor: "ew-resize" },
    { id: "se", cx: 1, cy: 1, cursor: "nwse-resize" },
    { id: "s", cx: 0.5, cy: 1, cursor: "ns-resize" },
    { id: "sw", cx: 0, cy: 1, cursor: "nesw-resize" },
    { id: "w", cx: 0, cy: 0.5, cursor: "ew-resize" },
  ];

  return (
    <div
      ref={containerRef}
      className={cn(
        "iframe-stage w-full h-full relative overflow-hidden",
        isFullscreen && "fixed inset-0 z-[200]"
      )}
      style={orientation === "portrait" ? { background: "linear-gradient(135deg, #0a0e1a 0%, #131826 100%)" } : undefined}
    >
      {/* ===== Wrapper: contains iframe + whiteboard as siblings =====
          This is the TRUE visible-to-students area (exact aspect-ratio-locked
          box). Games, confetti, and anything else that must stay fully
          visible during screen-share/projection should bound themselves to
          .iframe-visible-area, not the looser outer .iframe-stage container
          (which can be letterboxed/pillarboxed and larger than this). */}
      <div
        ref={wrapperRef}
        className="absolute iframe-visible-area"
        style={{
          left: `${wrapperRect.left}px`,
          top: `${wrapperRect.top}px`,
          width: `${wrapperRect.width}px`,
          height: `${wrapperRect.height}px`,
          transition: activeHandle ? "none" : "all 0.15s ease-out",
        }}
      >
        {/* Iframe (fills wrapper) */}
        <iframe
          ref={iframeRef}
          srcDoc={activeLesson.content}
          title={activeLesson.title}
          className="absolute inset-0 w-full h-full border-0 bg-white"
          // الأمان: sandbox مُقيَّد على أقل صلاحيات لازمة لتشغيل درس الـ iframe
          // (سكربتات الدرس + الوصول لنفس الأصل للـ manifest handshake + النماذج
          // للإجابات التفاعلية). لا popups/top-navigation/downloads — ما يمنع
          // أي درس خبيث من فتح نوافذ أو تنزيل ملفات أو خطف التنقل.
          sandbox="allow-scripts allow-same-origin allow-forms"
          allow="accelerometer; autoplay; camera; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; clipboard-read; clipboard-write; display-capture; picture-in-picture"
          referrerPolicy="origin-when-cross-origin"
          style={{
            borderRadius: device === "mobile" ? "24px" : device === "tablet" ? "16px" : "8px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 1,
          }}
        />

        {/* Whiteboard (sibling of iframe, fills wrapper, on top)
            SmartWhiteboard controls its own pointer-events internally:
            - When tool === "select": pointer-events: none (clicks pass to iframe)
            - When tool !== "select": pointer-events: auto (capture for drawing)
            - When disabled: SmartWhiteboard returns null, so this div is empty
              and we set pointer-events: none to allow clicks to reach the iframe */}
        <div
          className="absolute inset-0"
          style={{ zIndex: 10, pointerEvents: "none" }}
        >
          {children}
        </div>

        {!studentView && showMathTools && <MathToolsPanel onClose={() => setShowMathTools(false)} />}

        {/* ===== Helper Asset Viewer (inside wrapper, below whiteboard) =====
            When a helper asset is being viewed, it replaces the iframe content
            but stays below the whiteboard so the teacher can draw on top */}
        {!studentView && viewingHelperAsset && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 5, overflow: "hidden", background: "#000" }}
          >
            <div className="w-full h-full flex items-center justify-center">
            {viewingHelperAsset.type === "pdf" && (
              <iframe
                src={viewingHelperAsset.data}
                className="w-full h-full border-0"
                title={viewingHelperAsset.name}
                style={{ minHeight: "100%" }}
              />
            )}
            {viewingHelperAsset.type === "image" && (
              <Image
                src={viewingHelperAsset.data}
                alt={viewingHelperAsset.name}
                fill
                sizes="100vw"
                className="object-contain"
                unoptimized
              />
            )}
            {viewingHelperAsset.type === "video" && (
              <video
                src={viewingHelperAsset.data}
                controls
                className="max-w-full max-h-full"
              />
            )}
            {viewingHelperAsset.type === "iframe" && (
              (() => {
                // C12: defence-in-depth — never load javascript:/data:html URLs
                // in an iframe even if the input-side check was bypassed
                // (e.g. asset added via a different code path / imported dump).
                const src = (viewingHelperAsset.data || "").trim().toLowerCase();
                const unsafe =
                  src.startsWith("javascript:") ||
                  src.startsWith("vbscript:") ||
                  src.startsWith("data:text/html") ||
                  src.startsWith("data:application/xhtml");
                if (unsafe) {
                  return (
                    <div className="w-full h-full flex items-center justify-center bg-red-950/60 text-red-200 px-6 text-center">
                      ⚠️ محتوى غير آمن — تم حظر فتح هذا الرابط.
                    </div>
                  );
                }
                return (
                  <iframe
                    src={viewingHelperAsset.data}
                    className="w-full h-full border-0"
                    title={viewingHelperAsset.name}
                    // الأمان: أقل صلاحيات لازمة لعرض مورد مساعد داخلي.
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    allow="accelerometer; autoplay; encrypted-media; fullscreen; geolocation; gyroscope; microphone; clipboard-read; clipboard-write; picture-in-picture; display-capture"
                    referrerPolicy="no-referrer-when-downgrade"
                    style={{ minHeight: "100%" }}
                  />
                );
              })()
            )}
            {viewingHelperAsset.type === "paper" && (
              <div className="w-full h-full relative overflow-hidden" style={{ background: "#fffef7" }}>
                {/* خلفية ورقة طبيعية - خطوط أفقية خفيفة */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: "linear-gradient(to bottom, transparent 31px, rgba(100, 116, 139, 0.25) 32px)",
                    backgroundSize: "100% 32px",
                  }}
                />
                {/* اللوجو + بسلاسة مع م.آية في النص تحت بخط كبير */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-10 pointer-events-none">
                  <svg width="50" height="50" viewBox="0 0 32 32" fill="none">
                    <circle cx="11.5" cy="11" r="2" fill="#DA151C" />
                    <circle cx="20.5" cy="11" r="2" fill="#DA151C" />
                    <path d="M7 16 Q16 25 25 16" stroke="#0142A0" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </svg>
                  <div className="text-sm font-bold text-[#0142A0] mt-1">بسلاسة مع م.آية</div>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* زر إغلاق الأداة المساعدة - يظهر فوق كل شيء في الزاوية */}
        {!studentView && viewingHelperAsset && (
          <button
            onClick={() => setViewingHelperAsset(null)}
            className="absolute top-1 left-1 z-30 w-8 h-8 flex items-center justify-center rounded-lg bg-accent/90 text-white hover:bg-accent transition-colors shadow-lg"
            title="إغلاق الأداة المساعدة والعودة للشريحة"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ===== Resize handles ===== */}
      {!studentView && !isFullscreen && wrapperRect.width > 0 && handles.map((h) => {
        const hx = wrapperRect.left + h.cx * wrapperRect.width;
        const hy = wrapperRect.top + h.cy * wrapperRect.height;
        return (
          <div
            key={h.id}
            data-handle={h.id}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="absolute z-40"
            style={{
              left: `${hx - handleSize / 2}px`,
              top: `${hy - handleSize / 2}px`,
              width: `${handleSize}px`,
              height: `${handleSize}px`,
              cursor: h.cursor,
              opacity: activeHandle === h.id ? 1 : 0.5,
              transition: "opacity 0.15s",
            }}
          >
            <div
              className="w-full h-full rounded-sm border-2"
              style={{
                borderColor: activeHandle === h.id ? "#2563eb" : "rgba(37, 99, 235, 0.7)",
                background: activeHandle === h.id ? "#2563eb" : "rgba(37, 99, 235, 0.25)",
              }}
            />
          </div>
        );
      })}

      {/* Scale indicator */}
      {!studentView && scale !== 1.0 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-card/90 px-3 py-1 rounded-full text-xs font-bold text-primary border border-border">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
}
