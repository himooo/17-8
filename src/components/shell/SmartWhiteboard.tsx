"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useShellStore } from "@/lib/shell-store";
import { WHITEBOARD_COLORS, getToolCursor } from "@/lib/shell-utils";
import html2canvas from "html2canvas";
import { cn } from "@/lib/utils";
import getStroke from "perfect-freehand";
import {
  buildReplayFrames,
  createWhiteboardDocument,
  exportWhiteboardSvg,
  renderEquationText,
  snapLineGeometry,
  type WhiteboardStrokeV10,
} from "@/lib/whiteboard-v10";

interface Point {
  x: number;
  y: number;
  t: number; // timestamp for trail
}

type StrokeTool =
  | "pen"
  | "highlighter"
  | "eraser"
  | "eraser-big"
  | "rainbow"
  | "laser"
  | "text"
  | "shape"
  | "arrow"
  | "check"
  | "x"
  | "star"
  | "stamp"
  | "equation";

interface Stroke {
  id: string;
  tool: StrokeTool;
  points: Point[];
  color: string;
  thickness: number;
  shape?: "circle" | "rectangle" | "triangle";
  text?: string;
  fontSize?: number;
  stampType?: "smile" | "star" | "check" | "heart" | "trophy" | "thumbs-up" | "100" | "good" | "logo" | "with-aya" | "stamp-round" | "stamp-rect" | "smile-stamp" | "bravo" | "excellent" | "wow" | "try-again" | "wrong" | "almost" | "keep-trying" | "good-job";
  precision?: boolean;
  /** Precision-mode scale (1–5). Higher = more granular smoothing/offset. */
  precisionScale?: number;
  /** For rainbow pen: first color hue in degrees (0-360). */
  rainbowHue?: number;
  /** Text formatting (applies only to text strokes). */
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Raw LaTeX source for an equation element. */
  equationLatex?: string;
  /** V10 layer assignment and geometry snap metadata. */
  layerId?: string;
  locked?: boolean;
  snapped?: boolean;
  geometryRelation?: "parallel" | "perpendicular";
  /** Layer index — lower = further back. If undefined it defaults to array position. */
  zIndex?: number;
}

type BoardLayer = { id: string; name: string; visible: boolean; locked: boolean };
type BoardPage = { id: string; name: string; layers: BoardLayer[]; strokes: Stroke[] };
const createDefaultBoardLayers = (): BoardLayer[] => [{ id: "layer-main", name: "الطبقة الرئيسية", visible: true, locked: false }];

interface LaserTrailPoint {
  x: number;
  y: number;
  t: number;
}

/**
 * SmartWhiteboard v6.0 — Upgraded with:
 *
 * New drawing tools:
 *  - rainbow   : الفرشاة تغيّر اللون تلقائياً كل 100px
 *  - eraser-big: ممحاة ضخمة ×2 (Shift+E)
 *
 * Enhancements:
 *  - laser     : لون/حجم قابل للتعديل + trail مع fade
 *  - text      : bold/italic/underline
 *  - shape/arrow: resize بالسحب من مربعات التحكم بعد الرسم
 *
 * Layers & Selection:
 *  - zIndex لكل stroke + أزرار "أعلى/أسفل"
 *  - marquee select: سحب يحدد مجموعة strokes ويحركها مع بعض
 *
 * History:
 *  - Undo/Redo stack حقيقي (حتى 50 خطوة) مع عداد مرئي
 *
 * Performance:
 *  - requestAnimationFrame throttling على الـ pointermove
 *  - (OffscreenCanvas: intentionally NOT used — main thread is fast enough
 *    here and falling back is more trouble than the perf gain warrants)
 */
export function SmartWhiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null); // separate canvas for laser trail
  const containerRef = useRef<HTMLDivElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const [boardPages, setBoardPages] = useState<BoardPage[]>([{ id: "page-1", name: "صفحة 1", layers: createDefaultBoardLayers(), strokes: [] }]);
  const boardPagesRef = useRef<BoardPage[]>(boardPages);
  const [activeBoardPageId, setActiveBoardPageId] = useState("page-1");
  const [boardLayers, setBoardLayers] = useState<BoardLayer[]>(createDefaultBoardLayers);
  const [activeLayerId, setActiveLayerId] = useState("layer-main");
  const boardPagesLoadedRef = useRef(false);
  const [replayState, setReplayState] = useState<{ active: boolean; cursor: number; frames: ReturnType<typeof buildReplayFrames> }>({ active: false, cursor: -1, frames: [] });
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  // Ref mirrors the active stroke so high-frequency pointer events and
  // pointerup always see the latest points without relying on a stale closure.
  const currentStrokeRef = useRef<Stroke | null>(null);
  const previousToolRef = useRef<string | null>(null);
  const [laserPos, setLaserPos] = useState<Point | null>(null);
  const [editingText, setEditingText] = useState<{
    id: string;
    x: number;
    y: number;
    color: string;
    fontSize: number;
    text: string;
    kind?: "text" | "equation";
  } | null>(null);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const laserTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strokeIdCounter = useRef(0);

  // P5 fix: pass-through clicks to the iframe when the user holds Alt.
  // This lets the teacher click in-lesson buttons without switching the
  // whiteboard tool back to "select". The state is tracked as a ref to
  // avoid re-rendering the canvas on every keydown/keyup; the effect
  // applies pointer-events directly via the inline style on the wrapper.
  const [passThroughClicks, setPassThroughClicks] = useState(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt" && !e.repeat) setPassThroughClicks(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") setPassThroughClicks(false);
    };
    const onBlur = () => setPassThroughClicks(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // ====== Selection / Resize / Marquee ======
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resizingId, setResizingId] = useState<string | null>(null);
  type HandleDir = "nw" | "ne" | "sw" | "se";
  const resizeHandle = useRef<{ id: string; dir: HandleDir; origStart: Point; origEnd: Point } | null>(null);
  const dragSelection = useRef<{ startX: number; startY: number; origStrokes: Map<string, { x: number; y: number }> } | null>(
    null
  );
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  // ====== Rainbow pen state ======
  const rainbowHueRef = useRef(180); // start at cyan-blue
  const rainbowLastPosRef = useRef<Point | null>(null);
  // Tracked by the resize effect below; used to clamp the text-editor
  // overlay's position without reading containerRef.current during render.
  const [containerWidth, setContainerWidth] = useState(800);

  // Laser trail (recent points with timestamps)
  const laserTrailRef = useRef<LaserTrailPoint[]>([]);
  const laserAnimRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  // ====== Synchronous pointer-down flag ======
  // Prevents stale rAF callbacks from reviving a stroke after pointerup.
  // This is a mutable ref (not closure-captured state) so it always reads
  // the live value even inside old requestAnimationFrame closures.
  const pointerDownRef = useRef(false);
  // ====== Active pointer id (multi-touch guard) ======
  // When a second finger touches the canvas mid-stroke, we ignore it instead
  // of orphaning the first stroke. -1 = no active pointer.
  const activePointerId = useRef<number | null>(null);
  // rAF-throttled pointer-move state. Declared before effects so the compiler
  // can distinguish event-time mutation from render-time state.
  const rafPending = useRef<Point | null>(null);
  const rafId = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const tool = useShellStore((s) => s.whiteboardTool);
  const color = useShellStore((s) => s.whiteboardColor);
  const thickness = useShellStore((s) => s.whiteboardThickness);
  const shape = useShellStore((s) => s.whiteboardShape);
  const enabled = useShellStore((s) => s.settings.whiteboardEnabled);
  const activeLessonId = useShellStore((s) => s.activeLessonId);
  const currentStep = useShellStore((s) => s.currentStep);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  const clearSignal = useShellStore((s) => s.whiteboardClearSignal);
  const undoSignal = useShellStore((s) => s.whiteboardUndoSignal);
  const redoSignal = useShellStore((s) => s.whiteboardRedoSignal);
  const setWhiteboardHistoryCount = useShellStore((s) => s.setWhiteboardHistoryCount);
  const laserColor = useShellStore((s) => s.laserColor);
  const laserSize = useShellStore((s) => s.laserSize);
  const textFormat = useShellStore((s) => s.textFormat);
  // v10: precision + stamps
  const precisionMode = useShellStore((s) => s.settings.precisionMode ?? false);
  const precisionScale = useShellStore((s) => s.settings.precisionScale ?? 2);
  const whiteboardBackground = useShellStore((s) => s.settings.whiteboardBackground);
  const selectedStamp = useShellStore((s) => s.selectedStamp);
  const setSelectedStamp = useShellStore((s) => s.setSelectedStamp);
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const playSound = useShellStore((s) => s.playSound);
  const slideBoardKey = `${activeLessonId ?? "session"}:${currentIdeaId ?? "root"}:${currentStep}`;
  const slideSnapshotsRef = useRef<Record<string, Stroke[]>>({});
  const slideRevisionsRef = useRef<Record<string, number>>({});
  const lastSlideBoardKeyRef = useRef<string | null>(null);
  const boardClientIdRef = useRef<string | null>(null);
  const boardChannelRef = useRef<BroadcastChannel | null>(null);
  const skipNextBoardBroadcastRef = useRef(false);
  const boardBroadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideStorageKey = `bisalasa-whiteboard:${activeLessonId ?? "session"}`;
  const slideRevisionStorageKey = `${slideStorageKey}:revisions`;
  const boardPagesStorageKey = `${slideStorageKey}:pages-v10`;
  // إزالة dead import: triggerConfetti لم يكن مستخدماً

  // Map store tool to StrokeTool
  const strokeTool: StrokeTool = (() => {
    // ختم: يُفعّل فقط لو الأداة الحالية select (لتفعيل التبديل المتبادل)
    // أي اختيار أداة تانية (pen/eraser/laser/...) بيمسح selectedStamp تلقائياً في الـ store
    if (selectedStamp && tool === "select") return "stamp";
    if (tool === "highlighter") return "highlighter";
    if (tool === "pen") return "pen";
    if (tool === "eraser") return "eraser";
    if (tool === "eraser-big") return "eraser-big";
    if (tool === "rainbow") return "rainbow";
    if (tool === "laser") return "laser";
    if (tool === "laserpen") return "pen";
    if (tool === "text") return "text";
    if (tool === "equation") return "equation";
    if (tool === "shape") return "shape";
    if (tool === "arrow") return "arrow";
    if (tool === "check") return "check";
    if (tool === "x") return "x";
    if (tool === "star") return "star";
    return "pen";
  })();

  // laserpen: also show laser trail while drawing
  const isLaserPen = tool === "laserpen";

  // ========== Drawing functions ==========
  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      ctx.save();

      if (stroke.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = stroke.thickness * 5;
      } else if (stroke.tool === "eraser-big") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = stroke.thickness * 10; // ×2 of normal eraser
      } else if (stroke.tool === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.thickness * 4;
      } else if (stroke.tool === "rainbow") {
        // Will set per-segment color below; base settings here
        ctx.globalCompositeOperation = "source-over";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.thickness;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.tool === "rainbow") {
        // Draw rainbow as segments — colour shifts every ~100px
        const ptsR = stroke.points;
        if (ptsR.length >= 2) {
          const baseHue = stroke.rainbowHue ?? 180;
          let hueOffset = 0;
          let accumulated = 0;
          let prevP = ptsR[0];
          ctx.strokeStyle = `hsl(${baseHue}, 85%, 55%)`;
          ctx.beginPath();
          ctx.moveTo(prevP.x, prevP.y);
          for (let i = 1; i < ptsR.length; i++) {
            const curr = ptsR[i];
            const d = Math.hypot(curr.x - prevP.x, curr.y - prevP.y);
            accumulated += d;
            if (accumulated >= 100) {
              ctx.stroke();
              hueOffset += 30;
              ctx.beginPath();
              ctx.strokeStyle = `hsl(${(baseHue + hueOffset) % 360}, 85%, 55%)`;
              ctx.moveTo(prevP.x, prevP.y);
              accumulated = 0;
            }
            const midX = (prevP.x + curr.x) / 2;
            const midY = (prevP.y + curr.y) / 2;
            ctx.quadraticCurveTo(prevP.x, prevP.y, midX, midY);
            prevP = curr;
          }
          ctx.lineTo(prevP.x, prevP.y);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }

      if (stroke.tool === "shape" && stroke.shape && stroke.points.length >= 2) {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        drawShape(ctx, stroke.shape, start, end, stroke.color, stroke.thickness);
      } else if (stroke.tool === "arrow" && stroke.points.length >= 2) {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        drawArrow(ctx, start, end, stroke.color, stroke.thickness);
      } else if (stroke.tool === "check" && stroke.points.length >= 1) {
        const center = stroke.points[0];
        drawCheck(ctx, center, stroke.color, stroke.thickness * 6);
      } else if (stroke.tool === "x" && stroke.points.length >= 1) {
        const center = stroke.points[0];
        drawX(ctx, center, stroke.color, stroke.thickness * 6);
      } else if (stroke.tool === "star" && stroke.points.length >= 1) {
        const center = stroke.points[0];
        drawStar(ctx, center, stroke.color, stroke.thickness * 8);
      } else if (stroke.tool === "stamp" && stroke.points.length >= 1) {
        const center = stroke.points[0];
        drawStamp(ctx, center, stroke.stampType || "smile", stroke.color);
      } else if ((stroke.tool === "text" || stroke.tool === "equation") && (stroke.text || stroke.equationLatex)) {
        ctx.fillStyle = stroke.color;
        const weight = stroke.bold !== false ? "bold" : "normal";
        const style = stroke.italic ? "italic " : "";
        ctx.font = `${style}${weight} ${stroke.fontSize || 18}px Cairo, sans-serif`;
        ctx.textBaseline = "top";
        ctx.textAlign = "right"; // RTL
        const displayText = stroke.tool === "equation" ? renderEquationText(stroke.equationLatex || stroke.text || "") : stroke.text || "";
        const lines = displayText.split("\\n");
        const lineHeight = (stroke.fontSize || 18) * 1.3;
        lines.forEach((line, i) => {
          ctx.fillText(line, stroke.points[0].x, stroke.points[0].y + i * lineHeight);
          if (stroke.underline) {
            const w = ctx.measureText(line).width;
            const y = stroke.points[0].y + i * lineHeight + (stroke.fontSize || 18);
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x - w, y);
            ctx.lineTo(stroke.points[0].x, y);
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = Math.max(1, (stroke.fontSize || 18) / 12);
            ctx.stroke();
          }
        });
      } else {
        // pen / highlighter / eraser - freehand
        const pts = stroke.points;
        if (pts.length === 0) {
          ctx.restore();
          return;
        }

          // === perfect-freehand دائماً مفعّل للقلم ===
          // P12 fix (2025-AUG): tuned the perfect-freehand parameters for
          // smoother, more natural handwriting with the mouse. The previous
          // values (thinning: 0.6, smoothing: 0.5, streamline: 0.5) produced
          // slightly jagged lines on fast mouse movements because streamline
          // was too low (causing the path to lag behind the cursor) and
          // smoothing was too aggressive on short strokes.
          //
          // New values:
          //   thinning: 0.5     — slightly less pressure variation (mouse
          //                       doesn't have pressure, so high thinning
          //                       just adds noise)
          //   smoothing: 0.65   — more smoothing = rounder, less jittery
          //   streamline: 0.75  — higher streamline = path follows the
          //                       cursor more closely with less lag
          //   simulatePressure: false — mouse doesn't have pressure; the
          //                              simulated pressure based on speed
          //                              made lines look uneven. We disable
          //                              it for a consistent, clean stroke.
          if (stroke.tool === "pen") {
            let drawPts = pts;
            let drawThickness = stroke.thickness;
            if (stroke.precision) {
              const startX = pts[0].x;
              const startY = pts[0].y;
              drawPts = pts.map((p) => ({
                x: startX + (p.x - startX) * 0.5,
                y: startY + (p.y - startY) * 0.5,
                t: p.t,
              }));
              drawThickness = stroke.thickness / 2;
            }
            const precisionValue = stroke.precisionScale ?? 2;
            const outlinePoints = getStroke(
              drawPts.map((p) => [p.x, p.y, 0.5] as [number, number, number]),
              {
                size: drawThickness * 2 + (stroke.precision ? precisionValue : 2),
                thinning: 0.5,
                smoothing: Math.min(0.85, 0.65 + (stroke.precision ? precisionValue * 0.03 : 0)),
                streamline: 0.75,
                easing: (t) => t * t,
                simulatePressure: false,
                last: true,
              }
            );
          if (outlinePoints.length === 0) {
            // FIX: a single-point pen tap produces an empty outline from
            // perfect-freehand. Fall back to drawing a filled dot so the
            // user sees their tap.
            const p = drawPts[0];
            const r = Math.max(2, drawThickness);
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = stroke.color;
            ctx.fill();
            ctx.restore();
            return;
          }
          // رسم بالـ Bezier curves لتنعيم
          ctx.beginPath();
          ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
          for (let i = 1; i < outlinePoints.length - 1; i++) {
            const midX = (outlinePoints[i][0] + outlinePoints[i + 1][0]) / 2;
            const midY = (outlinePoints[i][1] + outlinePoints[i + 1][1]) / 2;
            ctx.quadraticCurveTo(outlinePoints[i][0], outlinePoints[i][1], midX, midY);
          }
          if (outlinePoints.length > 1) {
            const last = outlinePoints[outlinePoints.length - 1];
            ctx.lineTo(last[0], last[1]);
          }
          ctx.closePath();
          ctx.fillStyle = stroke.color;
          ctx.fill();
        } else if (pts.length === 1) {
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, stroke.thickness / 2, 0, Math.PI * 2);
          ctx.fillStyle = stroke.color;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length - 1; i++) {
            const midX = (pts[i].x + pts[i + 1].x) / 2;
            const midY = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
          }
          const last = pts[pts.length - 1];
          ctx.lineTo(last.x, last.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
    []
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Sizing (including DPR scaling) is owned exclusively by the resize
    // effect below — this just clears and repaints at the canvas's
    // current CSS-pixel size.
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (replayState.active) {
      const frameByStroke = new Map<string, number>();
      replayState.frames.slice(0, Math.max(0, replayState.cursor + 1)).forEach((frame) => frameByStroke.set(frame.strokeId, frame.pointIndex));
      strokes.filter((stroke) => boardLayers.find((layer) => layer.id === (stroke.layerId || "layer-main"))?.visible !== false).forEach((stroke) => {
        const pointIndex = frameByStroke.get(stroke.id);
        if (pointIndex === undefined) return;
        drawStroke(ctx, { ...stroke, points: stroke.points.slice(0, pointIndex + 1) });
      });
    } else {
      strokes.filter((stroke) => boardLayers.find((layer) => layer.id === (stroke.layerId || "layer-main"))?.visible !== false).forEach((s) => drawStroke(ctx, s));
      if (currentStroke) drawStroke(ctx, currentStroke);
    }
  }, [boardLayers, strokes, currentStroke, drawStroke, replayState]);

  // P-WB-2 fix (2026-AUG): incremental draw for smooth pen performance.
  // The full redraw() above redraws ALL committed strokes + the current
  // stroke on every pointermove. With many strokes on the board, this
  // becomes O(n) per move event → visible lag.
  //
  // The fix: during active drawing (pointer down), skip the full redraw
  // and instead do an incremental draw — only drawing the new segment of
  // the current stroke on top of the existing canvas content.
  const incrementalDrawRef = useRef(false);
  const lastIncrementalIdxRef = useRef(-1);

  const drawCurrentStrokeIncremental = useCallback((stroke: Stroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pts = stroke.points;
    if (pts.length === 0) return;
    const lastIdx = pts.length - 1;
    if (lastIdx <= lastIncrementalIdxRef.current) return; // already drawn
    lastIncrementalIdxRef.current = lastIdx;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "eraser" || stroke.tool === "eraser-big") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = stroke.tool === "eraser-big" ? stroke.thickness * 10 : stroke.thickness * 5;
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else if (stroke.tool === "highlighter") {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.thickness * 4;
    } else if (stroke.tool === "pen" && pts.length >= 2) {
      // For pen, use perfect-freehand on the last few points for smooth joins.
      const startIdx = Math.max(0, lastIdx - 8);
      const segment = pts.slice(startIdx);
      try {
        const outlinePoints = getStroke(
          segment.map((p) => [p.x, p.y, 0.5] as [number, number, number]),
          {
            size: stroke.thickness * 2 + 2,
            thinning: 0.5,
            smoothing: 0.65,
            streamline: 0.75,
            easing: (t) => t * t,
            simulatePressure: false,
            last: true,
          }
        );
        if (outlinePoints.length > 1) {
          ctx.beginPath();
          ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
          for (let i = 1; i < outlinePoints.length - 1; i++) {
            const midX = (outlinePoints[i][0] + outlinePoints[i + 1][0]) / 2;
            const midY = (outlinePoints[i][1] + outlinePoints[i + 1][1]) / 2;
            ctx.quadraticCurveTo(outlinePoints[i][0], outlinePoints[i][1], midX, midY);
          }
          const last = outlinePoints[outlinePoints.length - 1];
          ctx.lineTo(last[0], last[1]);
          ctx.closePath();
          ctx.fillStyle = stroke.color;
          ctx.fill();
          ctx.restore();
          return;
        }
      } catch {
        // fall through to simple line
      }
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.thickness;
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.thickness;
    }

    // Simple line from previous point to current
    if (pts.length >= 2) {
      const prev = pts[pts.length - 2];
      const curr = pts[pts.length - 1];
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const startIncrementalDraw = useCallback(() => {
    incrementalDrawRef.current = true;
    lastIncrementalIdxRef.current = -1;
  }, []);

  const endIncrementalDraw = useCallback(() => {
    incrementalDrawRef.current = false;
    lastIncrementalIdxRef.current = -1;
    // Trigger a full redraw to clean up any artifacts and apply the
    // proper perfect-freehand outline to the committed stroke.
    redraw();
  }, [redraw]);

  // ========== Laser Trail Animation ==========
  const drawLaserTrailRef = useRef<() => void>(() => {});
  // Mapped laser color values (from store)
  const laserRgb = laserColor === "green" ? "34,197,94" : laserColor === "blue" ? "59,130,246" : "239,68,68";

  // Update the ref whenever laserPos changes (without re-creating the animation loop)
  useEffect(() => {
    drawLaserTrailRef.current = () => {
      const canvas = trailCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      // P0-3 fix: spec says laser trail fades over 800ms (USER_GUIDE.md +
      // SLIDE_CONFIGURATION.md). Was 2000ms (likely experimentation leftover).
      const trailDuration = 800; // ms - trail fades over 800ms per spec

      // Remove old points
      laserTrailRef.current = laserTrailRef.current.filter(
        (p) => now - p.t < trailDuration
      );

      if (laserTrailRef.current.length < 2 && !laserPos) {
        laserAnimRef.current = requestAnimationFrame(drawLaserTrailRef.current);
        return;
      }

      // Draw trail with fading opacity
      const points = laserTrailRef.current;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const age = now - curr.t;
        const opacity = Math.max(0, 1 - age / trailDuration);

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = `rgba(${laserRgb},1)`;
        ctx.lineWidth = laserSize / 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = `rgba(${laserRgb},1)`;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
        ctx.restore();
      }

      // Draw laser dot at current position
      const currentLaserPos = laserPos;
      if (currentLaserPos) {
        const r = laserSize;
        ctx.save();
        // Outer glow
        const grad = ctx.createRadialGradient(
          currentLaserPos.x,
          currentLaserPos.y,
          0,
          currentLaserPos.x,
          currentLaserPos.y,
          r * 2.5
        );
        grad.addColorStop(0, `rgba(${laserRgb},1)`);
        grad.addColorStop(0.4, `rgba(${laserRgb},0.5)`);
        grad.addColorStop(1, `rgba(${laserRgb},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(currentLaserPos.x, currentLaserPos.y, r * 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Solid core
        ctx.fillStyle = `rgba(${laserRgb},1)`;
        ctx.beginPath();
        ctx.arc(currentLaserPos.x, currentLaserPos.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      laserAnimRef.current = requestAnimationFrame(drawLaserTrailRef.current);
    };
  }, [laserPos, laserColor, laserSize, laserRgb]);

  // Start/stop laser trail animation
  useEffect(() => {
    if ((tool === "laser" || isLaserPen) && enabled) {
      laserAnimRef.current = requestAnimationFrame((t: number) => drawLaserTrailRef.current());
    } else {
      if (laserAnimRef.current) {
        cancelAnimationFrame(laserAnimRef.current);
        laserAnimRef.current = null;
      }
      // Clear trail when not in laser mode
      laserTrailRef.current = [];
      const canvas = trailCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const rect = canvas.getBoundingClientRect();
          ctx.clearRect(0, 0, rect.width, rect.height);
        }
      }
    }
    return () => {
      if (laserAnimRef.current) {
        cancelAnimationFrame(laserAnimRef.current);
      }
    };
  }, [tool, enabled, isLaserPen]);

  // Always call the latest redraw without needing it in the resize effect's
  // deps (which would otherwise recreate the ResizeObserver on every stroke).
  const redrawRef = useRef(redraw);
  useEffect(() => { redrawRef.current = redraw; }, [redraw]);

  // ========== Resize canvas (single source of truth for canvas sizing) ==========
  useEffect(() => {
    const canvas = canvasRef.current;
    const trailCanvas = trailCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      setContainerWidth(rect.width);
      [canvas, trailCanvas].forEach((c) => {
        if (!c) return;
        c.width = rect.width * dpr;
        c.height = rect.height * dpr;
        c.style.width = `${rect.width}px`;
        c.style.height = `${rect.height}px`;
        const ctx = c.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
      });
      // Resizing the canvas (changing .width/.height) clears its bitmap —
      // repaint immediately so drawings aren't lost when the container
      // changes size (window resize, orientation switch, fullscreen, etc.)
      redrawRef.current();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [enabled]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // ========== History (undo/redo) ======
  // historyRef holds snapshots of strokes[]; indexRef is the position of the
  // CURRENT strokes inside that array. We record snapshots on every commit
  // (pointerUp, clear, text-commit, etc.) so undo always has a valid prior state.
  //
  // P0-2 fix: historyRef starts with ONE empty snapshot [[]] and hotIdx=0.
  // Before, historyRef=[] and hotIdx=-1 meant after the first stroke commit,
  // historyRef=[[stroke1]] and hotIdx=0 — but performUndo's guard
  // `if (hotIdx.current <= 0) return` blocked undo at hotIdx=0, so the first
  // stroke could never be undone. Now after first commit: historyRef=[[], [stroke1]],
  // hotIdx=1, and undo moves to hotIdx=0 (restoring []).
  const historyRef = useRef<Stroke[][]>([[]]);
  // C6: `hotIdx` was a fresh object on every render — every re-render reset the
  // history cursor to -1, breaking undo/redo. Must be a stable useRef.
  const hotIdx = useRef<number>(0); // 0 = pointing at the initial empty snapshot
  const MAX_HISTORY = 50;

  const commitHistory = useCallback(
    (nextStrokes: Stroke[]) => {
      historyRef.current = historyRef.current.slice(0, hotIdx.current + 1);
      historyRef.current.push([...nextStrokes]);
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current = historyRef.current.slice(-MAX_HISTORY);
      }
      hotIdx.current = historyRef.current.length - 1;
      setWhiteboardHistoryCount({
        index: hotIdx.current,
        total: historyRef.current.length - 1,
      });
    },
    [setWhiteboardHistoryCount]
  );

  const performUndo = useCallback(() => {
    if (hotIdx.current <= 0) return;
    hotIdx.current -= 1;
    const prev = historyRef.current[hotIdx.current];
    setStrokes(prev ? [...prev] : []);
    setCurrentStroke(null);
    setSelectedIds(new Set());
    setWhiteboardHistoryCount({
      index: hotIdx.current,
      total: historyRef.current.length - 1,
    });
  }, [setWhiteboardHistoryCount]);

  const performRedo = useCallback(() => {
    if (hotIdx.current >= historyRef.current.length - 1) return;
    hotIdx.current += 1;
    const next = historyRef.current[hotIdx.current];
    setStrokes(next ? [...next] : []);
    setSelectedIds(new Set());
    setWhiteboardHistoryCount({
      index: hotIdx.current,
      total: historyRef.current.length - 1,
    });
  }, [setWhiteboardHistoryCount]);

  // ========== Teacher-window whiteboard synchronization ==========
  // The board remains local-first: BroadcastChannel is best-effort and the
  // existing per-slide localStorage snapshot remains the source of recovery.
  // Each slide has a monotonic revision so a late OBS/teacher window can ask
  // for the latest snapshot without echoing its own remote update.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const clientId = boardClientIdRef.current ?? `board-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    boardClientIdRef.current = clientId;
    const channelName = "bisalasa-whiteboard-sync-v1";
    const postSnapshot = (key: string, snapshot: Stroke[], revision: number, target?: string) => {
      const message = { type: "snapshot" as const, key, snapshot, revision, sourceId: clientId, target };
      boardChannelRef.current?.postMessage(message);
    };
    const handleMessage = (event: MessageEvent<{ type?: string; key?: string; snapshot?: Stroke[]; revision?: number; sourceId?: string; target?: string }>) => {
      const message = event.data;
      if (!message || message.sourceId === clientId || (message.target && message.target !== boardClientIdRef.current)) return;
      if (message.type === "request" && message.key) {
        const snapshot = message.key === slideBoardKey ? strokesRef.current : slideSnapshotsRef.current[message.key] ?? [];
        const revision = slideRevisionsRef.current[message.key] ?? 0;
        postSnapshot(message.key, snapshot.slice(-2000), revision, message.sourceId);
        return;
      }
      if (message.type !== "snapshot" || message.key !== slideBoardKey || !Array.isArray(message.snapshot)) return;
      const incomingRevision = Number(message.revision) || 0;
      if (incomingRevision <= (slideRevisionsRef.current[message.key] ?? 0)) return;
      slideRevisionsRef.current[message.key] = incomingRevision;
      slideSnapshotsRef.current[message.key] = message.snapshot.slice(-2000);
      skipNextBoardBroadcastRef.current = true;
      setStrokes([...slideSnapshotsRef.current[message.key]]);
      setCurrentStroke(null);
      setSelectedIds(new Set());
      commitHistory(slideSnapshotsRef.current[message.key]);
      try {
        window.localStorage.setItem(slideStorageKey, JSON.stringify(slideSnapshotsRef.current));
        window.localStorage.setItem(slideRevisionStorageKey, JSON.stringify(slideRevisionsRef.current));
      } catch {
        // Cross-window sync must never break drawing.
      }
    };
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(channelName);
      boardChannelRef.current = channel;
      channel.addEventListener("message", handleMessage as EventListener);
      channel.postMessage({ type: "request", key: slideBoardKey, sourceId: clientId });
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== slideStorageKey || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Record<string, Stroke[]>;
        const next = parsed[slideBoardKey];
        if (!Array.isArray(next)) return;
        slideSnapshotsRef.current = parsed;
        skipNextBoardBroadcastRef.current = true;
        setStrokes(next.slice(-2000));
        setCurrentStroke(null);
        setSelectedIds(new Set());
      } catch {
        // Ignore malformed external storage without affecting the lesson.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      boardChannelRef.current?.removeEventListener("message", handleMessage as EventListener);
      boardChannelRef.current?.close();
      boardChannelRef.current = null;
      if (boardBroadcastTimerRef.current) clearTimeout(boardBroadcastTimerRef.current);
    };
  }, [commitHistory, slideBoardKey, slideRevisionStorageKey, slideStorageKey]);

  // ========== Slide-linked board persistence ==========
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(slideStorageKey);
      slideSnapshotsRef.current = raw ? JSON.parse(raw) as Record<string, Stroke[]> : {};
      const revisions = window.localStorage.getItem(slideRevisionStorageKey);
      slideRevisionsRef.current = revisions ? JSON.parse(revisions) as Record<string, number> : {};
    } catch {
      slideSnapshotsRef.current = {};
      slideRevisionsRef.current = {};
    }
    const previousKey = lastSlideBoardKeyRef.current;
    if (previousKey && previousKey !== slideBoardKey) {
      slideSnapshotsRef.current[previousKey] = strokes.slice(-2000);
    }
    const next = slideSnapshotsRef.current[slideBoardKey] ?? [];
    if (previousKey !== slideBoardKey) {
      setStrokes(next);
      setCurrentStroke(null);
      setSelectedIds(new Set());
    }
    lastSlideBoardKeyRef.current = slideBoardKey;
    try {
      window.localStorage.setItem(slideStorageKey, JSON.stringify(slideSnapshotsRef.current));
      window.localStorage.setItem(slideRevisionStorageKey, JSON.stringify(slideRevisionsRef.current));
    } catch {
      // Local storage quota should never break the live lesson.
    }
    // The active slide key is intentionally the only reactive input; strokes are
    // captured from the current render when the teacher navigates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideBoardKey, slideStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !lastSlideBoardKeyRef.current) return;
    const key = lastSlideBoardKeyRef.current;
    const snapshot = strokes.slice(-2000);
    slideSnapshotsRef.current[key] = snapshot;
    if (skipNextBoardBroadcastRef.current) {
      skipNextBoardBroadcastRef.current = false;
    } else {
      slideRevisionsRef.current[key] = (slideRevisionsRef.current[key] ?? 0) + 1;
      if (boardBroadcastTimerRef.current) clearTimeout(boardBroadcastTimerRef.current);
      boardBroadcastTimerRef.current = setTimeout(() => {
        boardChannelRef.current?.postMessage({ type: "snapshot", key, snapshot, revision: slideRevisionsRef.current[key], sourceId: boardClientIdRef.current ?? "board" });
      }, 120);
    }
    try {
      window.localStorage.setItem(slideStorageKey, JSON.stringify(slideSnapshotsRef.current));
      window.localStorage.setItem(slideRevisionStorageKey, JSON.stringify(slideRevisionsRef.current));
    } catch {
      // Quota errors are non-fatal during a live class.
    }
  }, [strokes, slideRevisionStorageKey, slideStorageKey]);

  // ========== Whiteboard V10 pages / local document ==========
  useEffect(() => { boardPagesRef.current = boardPages; }, [boardPages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    boardPagesLoadedRef.current = false;
    let pages: BoardPage[] = [];
    try {
      const raw = window.localStorage.getItem(boardPagesStorageKey);
      const parsed = raw ? JSON.parse(raw) as { pages?: BoardPage[]; activePageId?: string } : null;
      if (parsed?.pages && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
        pages = parsed.pages.filter((page) => page && typeof page.id === "string" && Array.isArray(page.strokes)).map((page) => ({ ...page, layers: Array.isArray(page.layers) && page.layers.length > 0 ? page.layers : createDefaultBoardLayers() }));
      }
    } catch {
      pages = [];
    }
    if (pages.length === 0) {
      const firstId = `${slideBoardKey.replace(/[^a-zA-Z0-9_-]/g, "-")}-page-1`;
      pages = [{ id: firstId, name: "صفحة 1", layers: createDefaultBoardLayers(), strokes: slideSnapshotsRef.current[slideBoardKey] || [] }];
    }
    const active = pages[0];
    setBoardPages(pages);
    setActiveBoardPageId(active.id);
    setBoardLayers(active.layers);
    setActiveLayerId(active.layers.find((layer) => !layer.locked)?.id || active.layers[0].id);
    setStrokes([...active.strokes]);
    boardPagesRef.current = pages;
    boardPagesLoadedRef.current = true;
    try {
      window.localStorage.setItem(boardPagesStorageKey, JSON.stringify({ version: 10, activePageId: active.id, pages }));
    } catch {
      // localStorage is best-effort; the existing slide snapshot remains available.
    }
  }, [boardPagesStorageKey, slideBoardKey]);

  useEffect(() => {
    if (!boardPagesLoadedRef.current) return;
    const active = boardPagesRef.current.find((page) => page.id === activeBoardPageId);
    const sameStrokes = Boolean(active && active.strokes.length === strokes.length && active.strokes.every((item, index) => item.id === strokes[index]?.id && item.points.length === strokes[index]?.points.length));
    if (active && !sameStrokes) {
      const updated = boardPagesRef.current.map((page) => page.id === activeBoardPageId ? { ...page, layers: boardLayers, strokes: strokes.slice(-2000) } : page);
      boardPagesRef.current = updated;
      setBoardPages(updated);
      try {
        window.localStorage.setItem(boardPagesStorageKey, JSON.stringify({ version: 10, activePageId: activeBoardPageId, pages: updated }));
      } catch {
        // Recovery must not interrupt drawing.
      }
    }
  }, [activeBoardPageId, boardLayers, boardPagesStorageKey, strokes]);

  const addBoardPage = useCallback(() => {
    const id = `${slideBoardKey.replace(/[^a-zA-Z0-9_-]/g, "-")}-page-${boardPagesRef.current.length + 1}-${Date.now()}`;
    const layers = createDefaultBoardLayers();
    const next = [...boardPagesRef.current, { id, name: `صفحة ${boardPagesRef.current.length + 1}`, layers, strokes: [] }];
    boardPagesRef.current = next;
    setBoardPages(next);
    setActiveBoardPageId(id);
    setBoardLayers(layers);
    setActiveLayerId(layers[0].id);
    setStrokes([]);
    commitHistory([]);
    playSound("click");
  }, [commitHistory, playSound, slideBoardKey]);

  const addBoardLayer = useCallback(() => {
    const id = `${activeBoardPageId}-layer-${boardLayers.length + 1}-${Date.now()}`;
    const layer = { id, name: `طبقة ${boardLayers.length + 1}`, visible: true, locked: false };
    const nextLayers = [...boardLayers, layer];
    const nextPages = boardPagesRef.current.map((page) => page.id === activeBoardPageId ? { ...page, layers: nextLayers } : page);
    boardPagesRef.current = nextPages;
    setBoardPages(nextPages);
    setBoardLayers(nextLayers);
    setActiveLayerId(id);
    playSound("click");
  }, [activeBoardPageId, boardLayers, playSound]);

  const toggleBoardLayer = useCallback((layerId: string, field: "visible" | "locked") => {
    const nextLayers = boardLayers.map((layer) => layer.id === layerId ? { ...layer, [field]: !layer[field] } : layer);
    const nextPages = boardPagesRef.current.map((page) => page.id === activeBoardPageId ? { ...page, layers: nextLayers } : page);
    boardPagesRef.current = nextPages;
    setBoardPages(nextPages);
    setBoardLayers(nextLayers);
    if (field === "locked" && nextLayers.find((layer) => layer.id === layerId)?.locked && activeLayerId === layerId) {
      setActiveLayerId(nextLayers.find((layer) => !layer.locked)?.id || layerId);
    }
  }, [activeBoardPageId, activeLayerId, boardLayers]);

  const switchBoardPage = useCallback((pageId: string) => {
    const current = boardPagesRef.current.find((page) => page.id === activeBoardPageId);
    const nextPage = boardPagesRef.current.find((page) => page.id === pageId);
    if (!nextPage || pageId === activeBoardPageId) return;
    const nextPages = boardPagesRef.current.map((page) => page.id === activeBoardPageId && current ? { ...page, strokes: strokesRef.current.slice(-2000) } : page);
    boardPagesRef.current = nextPages;
    setBoardPages(nextPages);
    setActiveBoardPageId(pageId);
    setBoardLayers(nextPage.layers);
    setActiveLayerId(nextPage.layers.find((layer) => !layer.locked)?.id || nextPage.layers[0].id);
    setStrokes([...nextPage.strokes]);
    setCurrentStroke(null);
    setSelectedIds(new Set());
    commitHistory(nextPage.strokes);
  }, [activeBoardPageId, commitHistory]);

  const removeBoardPage = useCallback(async () => {
    if (boardPagesRef.current.length <= 1) return;
    if (!(await requestConfirm("حذف صفحة السبورة الحالية؟", { danger: true }))) return;
    const remaining = boardPagesRef.current.filter((page) => page.id !== activeBoardPageId);
    const nextPage = remaining[remaining.length - 1];
    boardPagesRef.current = remaining;
    setBoardPages(remaining);
    setActiveBoardPageId(nextPage.id);
    setBoardLayers(nextPage.layers);
    setActiveLayerId(nextPage.layers.find((layer) => !layer.locked)?.id || nextPage.layers[0].id);
    setStrokes([...nextPage.strokes]);
    setSelectedIds(new Set());
    commitHistory(nextPage.strokes);
  }, [activeBoardPageId, commitHistory, requestConfirm]);

  const exportBoardSvg = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const doc = createWhiteboardDocument(slideBoardKey);
    doc.activePageId = doc.pages[0].id;
    doc.pages[0].layers = boardLayers.map((layer, order) => ({ id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked, order }));
    doc.pages[0].strokes = strokes.map((stroke) => ({
      id: stroke.id,
      kind: stroke.tool === "text" ? "text" : stroke.tool === "equation" ? "equation" : stroke.tool === "shape" || stroke.tool === "arrow" ? "shape" : stroke.tool === "stamp" ? "stamp" : "path",
      tool: stroke.tool,
      points: stroke.points,
      color: stroke.color,
      thickness: stroke.thickness,
      layerId: stroke.layerId || "layer-main",
      shape: stroke.shape || (stroke.tool === "arrow" ? "arrow" : undefined),
      text: stroke.text,
      latex: stroke.equationLatex,
      fontSize: stroke.fontSize,
    } as WhiteboardStrokeV10));
    const svg = exportWhiteboardSvg(doc, rect.width, rect.height);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bisalasa-whiteboard-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }, [boardLayers, slideBoardKey, strokes]);

  const exportBoardPng = useCallback(async () => {
    const board = canvasRef.current;
    if (!board) return;

    // Capture the imported lesson iframe first, then paint the visible board
    // canvases over the same coordinates. The old implementation exported only
    // `board.toDataURL()`, which produced a transparent image containing ink but
    // omitted the slide beneath it.
    let output = board;
    try {
      const stage = board.closest<HTMLElement>(".iframe-visible-area");
      const iframe = stage?.querySelector<HTMLIFrameElement>("iframe");
      const slideRoot = iframe?.contentDocument?.documentElement;
      if (stage && iframe && slideRoot) {
        const slideWidth = Math.max(1, slideRoot.scrollWidth, iframe.clientWidth);
        const slideHeight = Math.max(1, slideRoot.scrollHeight, iframe.clientHeight);
        const slide = await html2canvas(slideRoot, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          logging: false,
          width: slideWidth,
          height: slideHeight,
          windowWidth: slideWidth,
          windowHeight: slideHeight,
        });
        const composite = document.createElement("canvas");
        composite.width = slide.width;
        composite.height = slide.height;
        const context = composite.getContext("2d");
        if (!context) throw new Error("تعذر تجهيز صورة السبورة");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, composite.width, composite.height);
        context.drawImage(slide, 0, 0);

        const iframeRect = iframe.getBoundingClientRect();
        const boardCanvases = [canvasRef.current, trailCanvasRef.current].filter(
          (canvas): canvas is HTMLCanvasElement => Boolean(canvas)
        );
        for (const layerCanvas of boardCanvases) {
          const rect = layerCanvas.getBoundingClientRect();
          const x = ((rect.left - iframeRect.left) / Math.max(iframeRect.width, 1)) * slide.width;
          const y = ((rect.top - iframeRect.top) / Math.max(iframeRect.height, 1)) * slide.height;
          const width = (rect.width / Math.max(iframeRect.width, 1)) * slide.width;
          const height = (rect.height / Math.max(iframeRect.height, 1)) * slide.height;
          context.drawImage(layerCanvas, x, y, width, height);
        }
        output = composite;
      }
    } catch (error) {
      // Cross-origin or not-yet-ready iframe: preserve the old board-only
      // fallback rather than making the teacher lose the drawing export.
      console.warn("[SmartWhiteboard] composite PNG fallback:", error);
    }

    const link = document.createElement("a");
    link.download = `bisalasa-whiteboard-${Date.now()}.png`;
    link.href = output.toDataURL("image/png");
    link.click();
  }, []);

  const replayBoard = useCallback(() => {
    const doc = createWhiteboardDocument(slideBoardKey);
    doc.pages[0].strokes = strokes.map((stroke) => ({ id: stroke.id, kind: stroke.tool === "text" ? "text" : stroke.tool === "equation" ? "equation" : "path", points: stroke.points, color: stroke.color, thickness: stroke.thickness, layerId: stroke.layerId || "layer-main", text: stroke.text, latex: stroke.equationLatex, fontSize: stroke.fontSize } as WhiteboardStrokeV10));
    const frames = buildReplayFrames(doc.pages[0].strokes, 1);
    setReplayState({ active: true, cursor: -1, frames });
  }, [slideBoardKey, strokes]);

  useEffect(() => {
    if (!replayState.active) return;
    if (replayState.cursor >= replayState.frames.length - 1) {
      const timer = window.setTimeout(() => setReplayState({ active: false, cursor: -1, frames: [] }), 450);
      return () => window.clearTimeout(timer);
    }
    const current = replayState.frames[replayState.cursor + 1];
    const timer = window.setTimeout(() => setReplayState((state) => ({ ...state, cursor: state.cursor + 1 })), Math.max(8, current.elapsedMs - (replayState.frames[replayState.cursor]?.elapsedMs || 0)));
    return () => window.clearTimeout(timer);
  }, [replayState]);

  // ========== Clear on signal ==========
  useEffect(() => {
    if (clearSignal <= 0) return;
    const next: Stroke[] = [];
    commitHistory(next);
    const timer = window.setTimeout(() => {
      setStrokes(next);
      setCurrentStroke(null);
      setSelectedIds(new Set());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clearSignal, commitHistory]);

  // ========== Undo on signal ==========
  useEffect(() => {
    if (undoSignal > 0) {
      performUndo();
    }
  }, [undoSignal, performUndo]);

  // ========== Redo on signal ==========
  useEffect(() => {
    if (redoSignal > 0) {
      performRedo();
    }
  }, [redoSignal, performRedo]);

  // ========== Math tool insertion ==========
  // MathToolsPanel emits a semantic result instead of reaching into the canvas.
  // The board owns the insertion so the result participates in Undo/Redo.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleMathInsert = (event: Event) => {
      if (!enabled) return;
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text?.trim();
      if (!text) return;
      const container = containerRef.current;
      const x = Math.max(24, (container?.clientWidth ?? 800) * 0.28);
      const y = Math.max(42, (container?.clientHeight ?? 500) * 0.35);
      const inserted: Stroke = {
        id: `math-${Date.now()}-${strokeIdCounter.current++}`,
        tool: "text",
        points: [{ x, y, t: Date.now() }],
        color: WHITEBOARD_COLORS[color],
        thickness,
        text,
        fontSize: Math.max(18, Math.min(34, thickness * 5 + 12)),
        bold: true,
      };
      setStrokes((previous) => {
        const next = [...previous, inserted];
        commitHistory(next);
        return next;
      });
      playSound("click");
    };
    window.addEventListener("bisalasa:insert-math", handleMathInsert);
    return () => window.removeEventListener("bisalasa:insert-math", handleMathInsert);
  }, [color, commitHistory, enabled, playSound, thickness]);

  // ========== Laser auto-hide ==========
  useEffect(() => {
    if (laserPos && (tool === "laser" || isLaserPen)) {
      if (laserTimeout.current) clearTimeout(laserTimeout.current);
      laserTimeout.current = setTimeout(() => {
        setLaserPos(null);
        laserTrailRef.current = [];
      }, 1500);
    }
    return () => {
      if (laserTimeout.current) clearTimeout(laserTimeout.current);
    };
  }, [laserPos, tool, isLaserPen]);

  // ========== Abort in-progress stroke on tool switch ==========
  // This effect must depend on the tool only. Depending on currentStroke here
  // clears the stroke after every pointer-move state update, which makes the
  // pen appear broken or intermittently invisible.
  useEffect(() => {
    if (previousToolRef.current === null) {
      previousToolRef.current = tool;
      return;
    }
    if (previousToolRef.current === tool) return;
    previousToolRef.current = tool;
    if (!currentStrokeRef.current) return;
    pointerDownRef.current = false;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    rafPending.current = null;
    currentStrokeRef.current = null;
    setCurrentStroke(null);
  }, [tool]);

  useEffect(() => {
    currentStrokeRef.current = currentStroke;
  }, [currentStroke]);

  // ========== Cleanup rAF on unmount ==========
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, []);

  // ========== Mouse handlers ==========
  const getPos = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, t: 0 };
    const rect = canvas.getBoundingClientRect();
    const eventTime = Number.isFinite(e.timeStamp) && e.timeStamp > 0
      ? e.timeStamp
      : (typeof performance !== "undefined" ? performance.now() : Date.now());
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: eventTime };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!enabled) return;
    // كليك يمين (button 2) = لا يرسم، فقط يفتح القائمة
    if (e.button === 2) {
      e.preventDefault();
      return;
    }
    // كليك اسكرول (button 1) = لا يرسم، يرجع خطوة (handled in ContextMenu)
    if (e.button === 1) {
      e.preventDefault();
      return;
    }
    // ===== Multi-touch guard =====
    // If a pointer is already active (drawing or interacting), ignore any
    // additional pointer-down events. This prevents orphaned strokes and
    // history corruption when two fingers touch the canvas simultaneously.
    if (activePointerId.current !== null && activePointerId.current !== e.pointerId) {
      e.preventDefault();
      return;
    }
    activePointerId.current = e.pointerId;
    // ===== Mark pointer as down (synchronous, for rAF guards) =====
    pointerDownRef.current = true;
    const pos = getPos(e);
    const activeLayer = boardLayers.find((layer) => layer.id === activeLayerId);
    if (activeLayer?.locked && tool !== "select") {
      e.preventDefault();
      return;
    }

    // ===== Interaction tools (select/resizing/marquee) =====
    // Check resize handles first when a single shape/arrow is selected
    if (selectedIds.size === 1 && !resizingId) {
      const selId = [...selectedIds][0];
      const stroke = strokes.find((s) => s.id === selId);
      if (stroke && (stroke.tool === "shape" || stroke.tool === "arrow")) {
        const handle = hitResizeHandle(stroke, pos);
        if (handle) {
          // CRITICAL FIX (history corruption): deep-copy the original points.
          // Storing a reference means subsequent mutation in flushPointerMove
          // would corrupt prior history snapshots that share the same point object.
          const origPts = stroke.points;
          resizeHandle.current = {
            id: selId,
            dir: handle,
            origStart: origPts[0] ? { ...origPts[0] } : { x: 0, y: 0, t: 0 },
            origEnd: origPts[origPts.length - 1]
              ? { ...origPts[origPts.length - 1] }
              : { x: 0, y: 0, t: 0 },
          };
          setResizingId(selId);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // Check if clicking on an already-selected stroke to start dragging
    if (selectedIds.size > 0) {
      const hit = hitStroke(strokes, pos);
      if (hit && selectedIds.has(hit.id)) {
        dragSelection.current = {
          startX: pos.x,
          startY: pos.y,
          origStrokes: new Map(
            strokes
              .filter((s) => selectedIds.has(s.id))
              .map((s) => [s.id, { x: s.points[0].x, y: s.points[0].y }])
          ),
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    // Select tool (with no stamp active) → marquee select OR single-select
    if (tool === "select" && !selectedStamp) {
      const stroke = hitStroke(strokes, pos);
      if (stroke) {
        setSelectedIds(new Set([stroke.id]));
        playSound("click");
        return;
      }
      // Start marquee selection
      marqueeRef.current = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
      setMarqueeBox({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (strokeTool === "text" || strokeTool === "equation") {
      // لا نستخدم setPointerCapture مع النص أو المعادلة
      e.preventDefault();
      e.stopPropagation();
      const id = `txt_${strokeIdCounter.current++}`;
      setEditingText({
        id,
        x: pos.x,
        y: pos.y,
        color: WHITEBOARD_COLORS[color],
        fontSize: 18 + thickness * 4,
        text: "",
        kind: strokeTool === "equation" ? "equation" : "text",
      });
      return;
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (strokeTool === "laser") {
      setLaserPos(pos);
      laserTrailRef.current.push(pos);
      return;
    }

    // laserpen: both draw AND show laser trail
    if (isLaserPen) {
      setLaserPos(pos);
      laserTrailRef.current.push(pos);
      // Fall through to pen drawing below (don't return)
    }

    // Single-click tools (check, x, star, stamp)
    if (strokeTool === "check" || strokeTool === "x" || strokeTool === "star") {
      const newStroke: Stroke = {
        id: `s_${strokeIdCounter.current++}`,
        tool: strokeTool,
        points: [pos],
        color: WHITEBOARD_COLORS[color],
        thickness: thickness,
        layerId: activeLayerId,
      };
      setStrokes((prev) => {
        const next = [...prev, newStroke];
        commitHistory(next);
        return next;
      });
      return;
    }

    // Stamp tool - place a stamp at click position
    if (strokeTool === "stamp") {
      if (!selectedStamp) return;
      const stampStroke: Stroke = {
        id: `s_${strokeIdCounter.current++}`,
        tool: "stamp",
        points: [pos],
        color: WHITEBOARD_COLORS[color],
        thickness: thickness,
        layerId: activeLayerId,
        stampType: selectedStamp,
      };
      setStrokes((prev) => {
        const next = [...prev, stampStroke];
        commitHistory(next);
        return next;
      });
      playSound("celebrate-stamp");
      return;
    }

    // Drawing tools (pen, highlighter, eraser, shape, arrow)
    const newStroke: Stroke = {
      id: `s_${strokeIdCounter.current++}`,
      tool: strokeTool,
      points: [pos],
      color: WHITEBOARD_COLORS[color],
      thickness: thickness,
      shape: strokeTool === "shape" ? shape : undefined,
      precision: strokeTool === "pen" ? precisionMode : false,
      rainbowHue: strokeTool === "rainbow" ? (strokeIdCounter.current * 47) % 360 : undefined,
      precisionScale: strokeTool === "pen" ? precisionScale : undefined,
      layerId: activeLayerId,
    };
    currentStrokeRef.current = newStroke;
    setCurrentStroke(newStroke);
    // P-WB-2 fix: start incremental draw mode for smooth pen performance
    startIncrementalDraw();
    if (strokeTool === "rainbow") {
      rainbowLastPosRef.current = pos;
    }
  };

  // Publish the in-progress stroke to React less frequently than the pointer
  // stream. The mutable ref still receives every point, so pointer-up commits
  // the complete stroke; batching only reduces expensive full-board redraws.
  const appendCurrentStrokePoint = useCallback((pos: Point, shapeMode = false) => {
    const current = currentStrokeRef.current;
    if (!current) return;
    const points = shapeMode ? [current.points[0], pos] : [...current.points, pos];
    const next = { ...current, points };
    currentStrokeRef.current = next;
    // P-WB-2 fix: during active drawing, use incremental draw for pen/highlighter/eraser
    // to avoid O(n) full redraw on every pointermove. Shape/arrow still uses
    // setCurrentStroke (full redraw) because their geometry changes entirely.
    if (incrementalDrawRef.current && !shapeMode && (next.tool === "pen" || next.tool === "highlighter" || next.tool === "eraser" || next.tool === "eraser-big" || next.tool === "rainbow")) {
      drawCurrentStrokeIncremental(next);
    } else if (shapeMode || points.length % 3 === 0) {
      setCurrentStroke(next);
    }
  }, [drawCurrentStrokeIncremental]);

  // rAF-throttled pointer-move state (avoid re-render per event)
  const flushPointerMove = useCallback(() => {
    rafId.current = null;
    const pos = rafPending.current;
    if (!pos) return;
    rafPending.current = null;

    // Cursor preview
    if (
      strokeTool === "pen" ||
      strokeTool === "highlighter" ||
      strokeTool === "eraser" ||
      strokeTool === "eraser-big" ||
      strokeTool === "stamp"
    ) {
      setCursorPos(pos);
    }

    // ===== Resize drag =====
    if (resizingId && resizeHandle.current) {
      const { id, dir, origStart, origEnd } = resizeHandle.current;
      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== id || (s.tool !== "shape" && s.tool !== "arrow")) return s;
          // Both `start` and `end` are fresh copies (origStart was deep-copied
          // at pointer-down). Mutating them is now safe and won't corrupt history.
          const start = { ...origStart };
          const end = { ...origEnd };
          if (dir === "se") { end.x = pos.x; end.y = pos.y; }
          else if (dir === "sw") { end.x = pos.x; start.x = pos.x; }
          else if (dir === "ne") { end.x = pos.x; start.y = pos.y; }
          else { end.y = pos.y; start.x = pos.x; } // "nw"
          return { ...s, points: [start, end] };
        })
      );
      return;
    }

    // ===== Drag selection (translate all selected strokes) =====
    if (dragSelection.current) {
      const dx = pos.x - dragSelection.current.startX;
      const dy = pos.y - dragSelection.current.startY;
      setStrokes((prev) =>
        prev.map((s) => {
          if (!selectedIds.has(s.id)) return s;
          const orig = dragSelection.current!.origStrokes.get(s.id)!;
          return {
            ...s,
            points: s.points.map((p, i) =>
              i === 0
                ? { ...p, x: orig.x + dx, y: orig.y + dy }
                : { ...p, x: p.x + dx, y: p.y + dy }
            ),
          };
        })
      );
      dragSelection.current.startX = pos.x;
      dragSelection.current.startY = pos.y;
      return;
    }

    // ===== Marquee select box =====
    if (marqueeRef.current) {
      marqueeRef.current.x1 = pos.x;
      marqueeRef.current.y1 = pos.y;
      setMarqueeBox({ ...marqueeRef.current });
      return;
    }

    // ===== Laser tool: works on HOVER (always visible) =====
    // الليزر يجب أن يكون ظاهراً دائماً عند تحريك الماوس (hover)
    // بدون الحاجة لضغط زر — هذا هو السلوك المتوقع من أداة الليزر
    if (strokeTool === "laser") {
      setLaserPos(pos);
      laserTrailRef.current.push(pos);
      if (laserTrailRef.current.length > 60) laserTrailRef.current.shift();
      return;
    }

    // ===== laserpen: laser visual always visible on hover =====
    // قلم الليزر يظهر الليزر دائماً عند hover
    // لكن القلم نفسه يكتب فقط عند الضغط (pointer down)
    if (isLaserPen) {
      setLaserPos(pos);
      setCursorPos(pos);
      laserTrailRef.current.push(pos);
      if (laserTrailRef.current.length > 60) laserTrailRef.current.shift();
      // لا نعود (return) — نسقط إلى منطق القلم الذي يتطلب pointer down
    }

    // ===== Guard: pointer must be down to mutate stroke (pen/eraser/shapes) =====
    // أدوات الرسم (قلم، ممحاة، أشكال) تتطلب ضغط الزر
    // الليزر وقلم الليزر مستثناة فوق لأنها تعمل على hover
    if (!pointerDownRef.current) return;

    if (!currentStrokeRef.current) return;
    if (
      strokeTool === "pen" ||
      strokeTool === "highlighter" ||
      strokeTool === "eraser" ||
      strokeTool === "eraser-big"
    ) {
      appendCurrentStrokePoint(pos);
    } else if (strokeTool === "rainbow") {
      // Rainbow pen rotates hue every 100px
      const last = rainbowLastPosRef.current;
      const dist = last ? Math.hypot(pos.x - last.x, pos.y - last.y) : 0;
      if (dist >= 100) {
        rainbowHueRef.current = (rainbowHueRef.current + 30) % 360;
        rainbowLastPosRef.current = pos;
      }
      appendCurrentStrokePoint(pos);
    } else if (strokeTool === "shape" || strokeTool === "arrow") {
      appendCurrentStrokePoint(pos, true);
    }
  }, [
    strokeTool,
    isLaserPen,
    appendCurrentStrokePoint,
    resizingId,
    selectedIds,
  ]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!enabled) return;
    // Multi-touch guard: only the active pointer drives movement.
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) {
      return;
    }
    rafPending.current = getPos(e);
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(flushPointerMove);
    }
  };

  const handlePointerLeave = (e?: React.PointerEvent) => {
    // Only clear if this is the active pointer (or no event was passed — legacy call).
    if (e && activePointerId.current !== null && e.pointerId !== activePointerId.current) {
      return;
    }
    handlePointerUp();
    setCursorPos(null);
  };

  // ====== Hit-testing helpers ======
  // H5 fix (2026-AUG): use a manual loop instead of Math.min(...xs) which
  // causes "Maximum call stack size exceeded" on strokes with >65k points.
  function strokeBBox(s: Stroke): { x0: number; x1: number; y0: number; y1: number } {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < s.points.length; i++) {
      const p = s.points[i];
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    return { x0, x1, y0, y1 };
  }
  function hitStroke(strokesArr: Stroke[], pos: Point): Stroke | null {
    // Reverse order = topmost first (last drawn is on top)
    const pad = 10;
    for (let i = strokesArr.length - 1; i >= 0; i--) {
      const s = strokesArr[i];
      const { x0, x1, y0, y1 } = strokeBBox(s);
      if (pos.x >= x0 - pad && pos.x <= x1 + pad && pos.y >= y0 - pad && pos.y <= y1 + pad) return s;
    }
    return null;
  }

  type ResizeDir = "nw" | "ne" | "sw" | "se";
  function hitResizeHandle(stroke: Stroke, pos: Point): ResizeDir | null {
    if (stroke.points.length < 2) return null;
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const handles: Array<{ x: number; y: number; dir: ResizeDir }> = [
      { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), dir: "nw" },
      { x: Math.max(start.x, end.x), y: Math.min(start.y, end.y), dir: "ne" },
      { x: Math.min(start.x, end.x), y: Math.max(start.y, end.y), dir: "sw" },
      { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y), dir: "se" },
    ];
    const HANDLE_RADIUS = 14;
    for (const h of handles) {
      if (Math.hypot(pos.x - h.x, pos.y - h.y) <= HANDLE_RADIUS) return h.dir;
    }
    return null;
  }

  const handlePointerUp = (e?: React.PointerEvent) => {
    // Multi-touch: ignore pointer-up from non-active pointers.
    if (e && activePointerId.current !== null && e.pointerId !== activePointerId.current) {
      return;
    }
    activePointerId.current = null;
    // ===== Clear pointer-down flag FIRST (synchronous) =====
    // This prevents any stale rAF callback from reviving the stroke.
    pointerDownRef.current = false;

    // ===== Cancel any pending rAF so its stale closure can't fire =====
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    rafPending.current = null;

    if (!enabled) return;
    const strokeToCommit = currentStrokeRef.current;
    if (strokeToCommit) {
      const shouldSnap = strokeToCommit.tool === "shape" || strokeToCommit.tool === "arrow";
      const snapCandidate = shouldSnap ? snapLineGeometry({ id: strokeToCommit.id, kind: "shape", points: strokeToCommit.points, color: strokeToCommit.color, thickness: strokeToCommit.thickness, layerId: "layer-main", shape: strokeToCommit.shape || (strokeToCommit.tool === "arrow" ? "arrow" : undefined) }, strokesRef.current.map((stroke) => ({ id: stroke.id, kind: "path", points: stroke.points, color: stroke.color, thickness: stroke.thickness, layerId: "layer-main" } as WhiteboardStrokeV10))) : null;
      const snapRelation = snapCandidate?.metadata?.relation;
      const geometryRelation: Stroke["geometryRelation"] = snapRelation === "parallel" ? "parallel" : snapRelation === "perpendicular" ? "perpendicular" : undefined;
      const committedStroke: Stroke = snapCandidate ? { ...strokeToCommit, points: snapCandidate.points.map((point) => ({ x: point.x, y: point.y, t: point.t ?? (typeof performance !== "undefined" ? performance.now() : Date.now()) })), snapped: snapCandidate.metadata?.snapped === true, geometryRelation } : strokeToCommit;
      setStrokes((prev) => {
        const next = [...prev, committedStroke];
        commitHistory(next);
        return next;
      });
      currentStrokeRef.current = null;
      setCurrentStroke(null);
      // P-WB-2 fix: end incremental draw mode and trigger a clean full redraw
      // to finalize the stroke with the proper perfect-freehand outline.
      endIncrementalDraw();
    }
    // Finalize marquee selection
    if (marqueeRef.current && marqueeBox) {
      // Select all strokes whose bounding box intersects marquee rect
      const box = marqueeBox;
      const intersects = (s: Stroke) => {
        const pad = 8;
        // H5 fix: use strokeBBox instead of Math.min(...xs)
        const { x0: sx0raw, x1: sx1raw, y0: sy0raw, y1: sy1raw } = strokeBBox(s);
        const sx0 = sx0raw - pad;
        const sy0 = sy0raw - pad;
        const sx1 = sx1raw + pad;
        const sy1 = sy1raw + pad;
        return !(box.x1 < sx0 || box.x0 > sx1 || box.y1 < sy0 || box.y0 > sy1);
      };
      const hits = new Set(strokes.filter(intersects).map((s) => s.id));
      if (hits.size > 0) {
        setSelectedIds(hits);
        playSound("click");
      }
      marqueeRef.current = null;
      setMarqueeBox(null);
    }
    if (resizingId) {
      // Commit resize result into history
      setStrokes((prev) => {
        commitHistory(prev);
        return prev;
      });
      setResizingId(null);
      resizeHandle.current = null;
    }
    if (dragSelection.current) {
      setStrokes((prev) => {
        const next = [...prev];
        commitHistory(next);
        return next;
      });
      dragSelection.current = null;
    }
  };

  // ========== AI whiteboard draft ==========
  // The AI never paints directly. It opens the same editable text overlay used
  // by the teacher, preserving the teacher's final review and commit action.
  useEffect(() => {
    const onAiText = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text?.trim();
      if (!text) return;
      const rect = containerRef.current?.getBoundingClientRect();
      setEditingText({
        id: `ai_txt_${strokeIdCounter.current++}`,
        x: Math.max(40, (rect?.width ?? 800) / 2),
        y: Math.max(40, (rect?.height ?? 500) / 2),
        color: WHITEBOARD_COLORS[color],
        fontSize: 18 + thickness * 4,
        text,
      });
    };
    window.addEventListener("bisalasa:whiteboard-ai-text", onAiText);
    return () => window.removeEventListener("bisalasa:whiteboard-ai-text", onAiText);
  }, [color, thickness]);

  // MathToolsPanel and AI both enter the same teacher-editable overlay.
  useEffect(() => {
    const onInsertMath = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string; latex?: boolean }>).detail;
      const text = detail?.text?.trim();
      if (!text) return;
      const rect = containerRef.current?.getBoundingClientRect();
      setEditingText({
        id: `math_txt_${strokeIdCounter.current++}`,
        x: Math.max(40, (rect?.width ?? 800) / 2),
        y: Math.max(40, (rect?.height ?? 500) / 2),
        color: WHITEBOARD_COLORS[color],
        fontSize: 18 + thickness * 4,
        text,
        kind: detail?.latex ? "equation" : "text",
      });
    };
    window.addEventListener("bisalasa:insert-math", onInsertMath);
    return () => window.removeEventListener("bisalasa:insert-math", onInsertMath);
  }, [color, thickness]);

  // ========== Text input commit ==========
  const commitText = () => {
    if (!editingText || !editingText.text.trim()) {
      setEditingText(null);
      return;
    }
    const newStroke: Stroke = {
      id: editingText.id,
      tool: editingText.kind === "equation" ? "equation" : "text",
      points: [{ x: editingText.x, y: editingText.y, t: typeof performance !== "undefined" ? performance.now() : Date.now() }],
      color: editingText.color,
      thickness: thickness,
      text: editingText.text,
      equationLatex: editingText.kind === "equation" ? editingText.text : undefined,
      fontSize: editingText.fontSize,
      bold: textFormat.bold,
      italic: textFormat.italic,
      underline: textFormat.underline,
      layerId: activeLayerId,
    };
    setStrokes((prev) => {
      const next = [...prev, newStroke];
      commitHistory(next);
      return next;
    });
    setEditingText(null);
  };

  if (!enabled) return null;

  const cursorStyle = getToolCursor(tool);
  const bgType = whiteboardBackground || "transparent";

  // خلفية السبورة
  const bgStyle: React.CSSProperties = {};
  if (bgType === "lined") {
    bgStyle.backgroundImage = "linear-gradient(to bottom, transparent 31px, rgba(100, 116, 139, 0.2) 32px)";
    bgStyle.backgroundSize = "100% 32px";
  } else if (bgType === "grid") {
    bgStyle.backgroundImage = "linear-gradient(to right, rgba(100, 116, 139, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(100, 116, 139, 0.15) 1px, transparent 1px)";
    bgStyle.backgroundSize = "30px 30px";
  } else if (bgType === "dotted") {
    bgStyle.backgroundImage = "radial-gradient(circle, rgba(100, 116, 139, 0.3) 1px, transparent 1px)";
    bgStyle.backgroundSize = "20px 20px";
  }

  return (
    <div
      ref={containerRef}
      className={cn("absolute inset-0 z-20")}
      style={{
        touchAction: "none",
        cursor:
          passThroughClicks
            ? "pointer"
            : strokeTool === "pen" ||
              strokeTool === "highlighter" ||
              strokeTool === "eraser" ||
              strokeTool === "laser" ||
              strokeTool === "stamp" ||
              isLaserPen
              ? "none"
              : cursorStyle,
        // P5 fix: when the user holds Alt (temporarily switch to "interact"
        // mode), we set pointer-events: none so clicks pass through to the
        // iframe below. This lets the teacher click on in-lesson buttons
        // (HTML5 slides often have interactive hotspots) without first
        // switching the whiteboard tool back to "select". The Alt modifier
        // is a well-known pattern used in Figma, Photoshop, etc.
        pointerEvents:
          (tool === "select" && !selectedStamp) || passThroughClicks
            ? "none"
            : "auto",
        // Notes:
        // - tool=select && selectedStamp=undefined → pointer-events:none (let iframe receive clicks)
        // - tool=select && selectedStamp=set      → pointer-events:auto (stamp needs clicks)
        // - tool=anything else                     → pointer-events:auto (drawing tool needs clicks)
        // - passThroughClicks=true (Alt held)     → pointer-events:none (let iframe receive clicks)

        ...bgStyle,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* V10 board controls: teacher-only, above the canvas and never inside the student iframe. */}
      <div
        className="absolute top-2 left-2 z-40 flex flex-wrap items-center gap-1 rounded-lg border border-slate-600 bg-slate-900/90 px-2 py-1 shadow-lg backdrop-blur pointer-events-auto"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="text-[10px] text-slate-300">السبورة</span>
        <select
          value={activeBoardPageId}
          onChange={(event) => switchBoardPage(event.target.value)}
          className="max-w-[110px] rounded bg-slate-800 px-1 py-1 text-[10px] text-white"
          aria-label="صفحة السبورة"
        >
          {boardPages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
        </select>
        <select
          value={activeLayerId}
          onChange={(event) => setActiveLayerId(event.target.value)}
          className="max-w-[115px] rounded bg-slate-800 px-1 py-1 text-[10px] text-white"
          aria-label="طبقة السبورة"
        >
          {boardLayers.map((layer) => <option key={layer.id} value={layer.id} disabled={layer.locked}>{layer.name}{layer.locked ? " 🔒" : ""}</option>)}
        </select>
        <button type="button" onClick={addBoardLayer} className="rounded bg-cyan-700/70 px-1.5 py-1 text-[10px] text-white" title="طبقة جديدة">+ طبقة</button>
        <button type="button" onClick={() => toggleBoardLayer(activeLayerId, "visible")} className="rounded bg-slate-700/80 px-1.5 py-1 text-[10px] text-white" title="إظهار أو إخفاء الطبقة">{boardLayers.find((layer) => layer.id === activeLayerId)?.visible === false ? "إظهار" : "إخفاء"}</button>
        <button type="button" onClick={() => toggleBoardLayer(activeLayerId, "locked")} className="rounded bg-slate-700/80 px-1.5 py-1 text-[10px] text-white" title="قفل أو فتح الطبقة">{boardLayers.find((layer) => layer.id === activeLayerId)?.locked ? "فتح" : "قفل"}</button>
        <button type="button" onClick={addBoardPage} className="rounded bg-blue-700/70 px-1.5 py-1 text-[10px] text-white" title="صفحة جديدة">+ صفحة</button>
        <button type="button" onClick={() => void removeBoardPage()} className="rounded bg-red-700/60 px-1.5 py-1 text-[10px] text-white" title="حذف الصفحة">حذف</button>
        <button type="button" onClick={exportBoardPng} className="rounded bg-emerald-700/70 px-1.5 py-1 text-[10px] text-white" title="تصدير PNG">PNG</button>
        <button type="button" onClick={exportBoardSvg} className="rounded bg-emerald-700/70 px-1.5 py-1 text-[10px] text-white" title="تصدير SVG">SVG</button>
        <button type="button" onClick={() => replayState.active ? setReplayState({ active: false, cursor: -1, frames: [] }) : replayBoard()} className="rounded bg-violet-700/70 px-1.5 py-1 text-[10px] text-white" title="إعادة عرض الرسم">{replayState.active ? "إيقاف" : "إعادة"}</button>
      </div>

      {/* Main canvas for strokes */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="absolute inset-0"
      />

      {/* Separate canvas for laser trail (always on top, no pointer events) */}
      <canvas
        ref={trailCanvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* ===== Selection bounding boxes + resize handles (DOM overlays) ===== */}
      {selectedIds.size > 0 &&
        strokes
          .filter((s) => selectedIds.has(s.id))
          .map((s) => {
            // H5 fix: use strokeBBox instead of Math.min(...xs)
            const { x0, x1, y0, y1 } = strokeBBox(s);
            const w = x1 - x0;
            const h = y1 - y0;
            const isShapeOrArrow = s.tool === "shape" || s.tool === "arrow";
            return (
              <div
                key={`sel-${s.id}`}
                className="absolute pointer-events-none border-2 border-dashed border-blue-500"
                style={{
                  left: x0 - 8,
                  top: y0 - 8,
                  width: w + 16,
                  height: h + 16,
                  background: "rgba(37, 99, 235, 0.05)",
                }}
              >
                {isShapeOrArrow && (
                  <>
                    {(["nw", "ne", "sw", "se"] as const).map((dir) => {
                      const hx = dir.includes("w") ? 0 : w + 16;
                      const hy = dir.includes("n") ? 0 : h + 16;
                      return (
                        <div
                          key={dir}
                          className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2"
                          style={{ left: hx, top: hy, cursor: `${dir}-resize` }}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}

      {/* Marquee select rectangle */}
      {marqueeBox && (
        <div
          className="absolute pointer-events-none border border-blue-500 border-dashed"
          style={{
            left: Math.min(marqueeBox.x0, marqueeBox.x1),
            top: Math.min(marqueeBox.y0, marqueeBox.y1),
            width: Math.abs(marqueeBox.x1 - marqueeBox.x0),
            height: Math.abs(marqueeBox.y1 - marqueeBox.y0),
            background: "rgba(37, 99, 235, 0.08)",
          }}
        />
      )}

      {/* ===== Custom cursor for pen/highlighter/eraser/laserpen/stamp ===== */}
      {cursorPos &&
        (strokeTool === "pen" ||
          strokeTool === "highlighter" ||
          strokeTool === "eraser" ||
          strokeTool === "stamp" ||
          isLaserPen) && (
          <>
            {strokeTool === "stamp" ? (
              /* مؤشر الختم - دائرة كبيرة بحجم الختم */
              <div
                className="absolute pointer-events-none flex items-center justify-center"
                style={{
                  left: cursorPos.x - 30,
                  top: cursorPos.y - 30,
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  border: `2px dashed ${WHITEBOARD_COLORS[color]}`,
                  background: WHITEBOARD_COLORS[color] + "15",
                  opacity: 0.7,
                }}
              >
                <span className="text-[10px] font-bold" style={{ color: WHITEBOARD_COLORS[color] }}>
                  ختم
                </span>
              </div>
            ) : (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: cursorPos.x - (strokeTool === "eraser" ? thickness * 2.5 : thickness),
                  top: cursorPos.y - (strokeTool === "eraser" ? thickness * 2.5 : thickness),
                  width: strokeTool === "eraser" ? thickness * 5 : thickness * 2,
                  height: strokeTool === "eraser" ? thickness * 5 : thickness * 2,
                  borderRadius: "50%",
                  border: `2px solid ${strokeTool === "eraser" ? "#ef4444" : strokeTool === "highlighter" ? WHITEBOARD_COLORS[color] + "80" : WHITEBOARD_COLORS[color]}`,
                  background:
                    strokeTool === "eraser"
                      ? "rgba(239, 68, 68, 0.15)"
                      : strokeTool === "highlighter"
                      ? WHITEBOARD_COLORS[color] + "30"
                      : WHITEBOARD_COLORS[color] + "20",
                  boxShadow:
                    strokeTool === "pen"
                      ? `0 0 6px ${WHITEBOARD_COLORS[color]}80`
                      : "none",
                }}
              />
            )}
          </>
        )}

      {/* Text input overlay - textarea متعدد الأسطر، فوق نقطة الضغط */}
      {editingText && (
        <div
          style={{
            position: "absolute",
            left: Math.max(0, Math.min(editingText.x, containerWidth - 200)),
            top: Math.max(0, editingText.y - 80),
            zIndex: 50,
          }}
        >
          <textarea
            autoFocus
            value={editingText.text}
            onChange={(e) =>
              setEditingText({ ...editingText, text: e.target.value })
            }
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitText();
              } else if (e.key === "Escape") {
                commitText();
              }
              e.stopPropagation();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              color: editingText.color,
              fontSize: editingText.fontSize,
              background: "rgba(255,255,255,0.98)",
              border: `2px solid ${editingText.color}`,
              padding: "4px 8px",
              borderRadius: 4,
              outline: "none",
              minWidth: 120,
              minHeight: 40,
              maxWidth: 300,
              maxHeight: 200,
              fontFamily: "Cairo, sans-serif",
              fontWeight: "bold",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              resize: "both",
              direction: "rtl",
              textAlign: "right",
            }}
            placeholder="اكتب..."
            rows={2}
          />
        </div>
      )}

      {/* ===== Layer controls: Bring to front / Send to back ===== */}
      {selectedIds.size > 0 && (
        <div
          className="absolute top-2 right-2 flex items-center gap-1 bg-slate-800/95 rounded-full px-2 py-1 border border-slate-600 shadow-lg backdrop-blur pointer-events-auto z-40"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="text-[10px] font-bold text-blue-300 hover:text-blue-100 px-1.5"
            title="أرسل للأعلى"
            onClick={() => {
              setStrokes((prev) => {
                const sel = prev.filter((s) => selectedIds.has(s.id));
                const rest = prev.filter((s) => !selectedIds.has(s.id));
                const next = [...rest, ...sel];
                commitHistory(next);
                return next;
              });
              playSound("click");
            }}
          >
            أعلى ⬆️
          </button>
          <span className="text-slate-500 text-[10px]">|</span>
          <button
            className="text-[10px] font-bold text-blue-300 hover:text-blue-100 px-1.5"
            title="أرسل للأسفل"
            onClick={() => {
              setStrokes((prev) => {
                const sel = prev.filter((s) => selectedIds.has(s.id));
                const rest = prev.filter((s) => !selectedIds.has(s.id));
                const next = [...sel, ...rest];
                commitHistory(next);
                return next;
              });
              playSound("click");
            }}
          >
            أسفل ⬇️
          </button>
          <span className="text-slate-500 text-[10px]">|</span>
          <button
            className="text-[10px] font-bold text-red-300 hover:text-red-100 px-1.5"
            title="مسح المحدد"
            onClick={() => {
              setStrokes((prev) => {
                const next = prev.filter((s) => !selectedIds.has(s.id));
                commitHistory(next);
                return next;
              });
              setSelectedIds(new Set());
              playSound("click");
            }}
          >
            ✕ مسح
          </button>
          <span className="text-slate-500 text-[10px]">|</span>
          <span className="text-[10px] text-slate-300">{selectedIds.size} عنصر</span>
        </div>
      )}

      {/* Laser pointer visual (the dot itself - trail is on trailCanvas) */}
      {laserPos && (tool === "laser" || isLaserPen) && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: laserPos.x - 14,
            top: laserPos.y - 14,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(239,68,68,1) 0%, rgba(239,68,68,0.5) 40%, transparent 70%)",
            boxShadow:
              "0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)",
            animation: "laser-pulse 1s ease-in-out infinite",
          }}
        />
      )}

      <style jsx>{`
        @keyframes laser-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

// ====================================================================
//  Shape Drawing Functions
// ====================================================================
function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: "circle" | "rectangle" | "triangle",
  start: Point,
  end: Point,
  color: string,
  thickness: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (shape === "circle") {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    ctx.beginPath();
    ctx.arc(start.x, start.y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === "rectangle") {
    ctx.beginPath();
    ctx.rect(
      Math.min(start.x, end.x),
      Math.min(start.y, end.y),
      Math.abs(end.x - start.x),
      Math.abs(end.y - start.y)
    );
    ctx.stroke();
  } else if (shape === "triangle") {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const size = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(
      start.x + size * Math.cos(angle - Math.PI / 2),
      start.y + size * Math.sin(angle - Math.PI / 2)
    );
    ctx.lineTo(
      start.x + size * Math.cos(angle + Math.PI / 6),
      start.y + size * Math.sin(angle + Math.PI / 6)
    );
    ctx.lineTo(
      start.x + size * Math.cos(angle + (5 * Math.PI) / 6),
      start.y + size * Math.sin(angle + (5 * Math.PI) / 6)
    );
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  thickness: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = thickness * 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const headLength = Math.max(12, thickness * 5);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(
    end.x - headLength * 0.7 * Math.cos(angle),
    end.y - headLength * 0.7 * Math.sin(angle)
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 6),
    end.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 6),
    end.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCheck(
  ctx: CanvasRenderingContext2D,
  center: Point,
  color: string,
  size: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(center.x - size / 2, center.y);
  ctx.lineTo(center.x - size / 6, center.y + size / 3);
  ctx.lineTo(center.x + size / 2, center.y - size / 3);
  ctx.stroke();
  ctx.restore();
}

function drawX(
  ctx: CanvasRenderingContext2D,
  center: Point,
  color: string,
  size: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(center.x - size / 2, center.y - size / 2);
  ctx.lineTo(center.x + size / 2, center.y + size / 2);
  ctx.moveTo(center.x + size / 2, center.y - size / 2);
  ctx.lineTo(center.x - size / 2, center.y + size / 2);
  ctx.stroke();
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  center: Point,
  color: string,
  size: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size / 10);
  ctx.lineJoin = "round";

  const spikes = 5;
  const outerRadius = size;
  const innerRadius = size / 2.5;
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(center.x, center.y - outerRadius);
  for (let i = 0; i < spikes; i++) {
    let x = center.x + Math.cos(rot) * outerRadius;
    let y = center.y + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;
    x = center.x + Math.cos(rot) * innerRadius;
    y = center.y + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(center.x, center.y - outerRadius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ====================================================================
//  drawStamp - رسم الختم على الكانفاس
//  - smile: وجه مبتسم (60px)
//  - star: نجمة ذهبية
//  - check: علامة صح
//  - heart: قلب
//  - trophy: كأس
//  - thumbs-up: إبهام لأعلى
//  - 100: مئة
//  - good: كلمة ممتاز
//  - logo: شعار بسلاسة (0.4 من حجم الختم)
//  - bisalasa: نص "بسلاسة" بخط أحمر
//  - red-line: خط أحمر عريض
//  - with-aya: "مع م.آية" - توقيع المعلمة آية
// ====================================================================
function drawStamp(
  ctx: CanvasRenderingContext2D,
  center: Point,
  type: "smile" | "star" | "check" | "heart" | "trophy" | "thumbs-up" | "100" | "good" | "logo" | "with-aya" | "stamp-round" | "stamp-rect" | "smile-stamp" | "bravo" | "excellent" | "wow" | "try-again" | "wrong" | "almost" | "keep-trying" | "good-job",
  color: string
) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (type === "smile") {
    // ابتسامة معدّلة - عيون صغيرة + ابتسامة عريضة
    const size = 60;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    // العيون (صغيرة)
    ctx.beginPath();
    ctx.arc(center.x - size / 5, center.y - size / 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center.x + size / 5, center.y - size / 8, 3, 0, Math.PI * 2);
    ctx.fill();
    // الابتسامة (عريضة)
    ctx.beginPath();
    ctx.arc(center.x, center.y + size / 8, size / 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (type === "smile-stamp") {
    // ختم الابتسامة - اللوجو المعدّل كختم
    const size = 50;
    // دائرة الختم
    ctx.strokeStyle = "#DA151C";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center.x, center.y, size / 2, 0, Math.PI * 2);
    ctx.stroke();
    // العيون الحمراء (صغيرة)
    ctx.fillStyle = "#DA151C";
    ctx.beginPath();
    ctx.arc(center.x - size / 5, center.y - size / 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center.x + size / 5, center.y - size / 6, 3, 0, Math.PI * 2);
    ctx.fill();
    // الابتسامة الزرقاء (عريضة)
    ctx.strokeStyle = "#0142A0";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(center.x, center.y, size / 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (type === "star") {
    drawStar(ctx, center, "#FFD700", 30);
  } else if (type === "check") {
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(center.x - 18, center.y);
    ctx.lineTo(center.x - 5, center.y + 14);
    ctx.lineTo(center.x + 20, center.y - 14);
    ctx.stroke();
  } else if (type === "heart") {
    ctx.fillStyle = "#ec4899";
    ctx.font = "60px serif";
    ctx.fillText("❤", center.x, center.y);
  } else if (type === "trophy") {
    ctx.font = "60px serif";
    ctx.fillText("🏆", center.x, center.y);
  } else if (type === "thumbs-up") {
    ctx.font = "60px serif";
    ctx.fillText("👍", center.x, center.y);
  } else if (type === "100") {
    ctx.fillStyle = "#0142A0";
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 4;
    ctx.font = "bold 48px Cairo, sans-serif";
    ctx.strokeText("100", center.x, center.y);
    ctx.fillText("100", center.x, center.y);
  } else if (type === "good") {
    ctx.fillStyle = "#10b981";
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.font = "bold 36px Cairo, sans-serif";
    ctx.strokeText("ممتاز!", center.x, center.y);
    ctx.fillText("ممتاز!", center.x, center.y);
  } else if (type === "logo") {
    // شعار بسلاسة - ابتسامة زرقاء + عيون حمراء
    const s = 50;
    // العيون الحمراء
    ctx.fillStyle = "#DA151C";
    ctx.beginPath();
    ctx.arc(center.x - s * 0.18, center.y - s * 0.12, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center.x + s * 0.18, center.y - s * 0.12, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    // الابتسامة الزرقاء
    ctx.strokeStyle = "#0142A0";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(center.x, center.y + s * 0.05, s * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (type === "with-aya") {
    // "بسلاسة مع م.آية" - سطرين + لوجو تحت
    // سطر 1: بسلاسة (أزرق)
    ctx.fillStyle = "#0142A0";
    ctx.font = "bold 24px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("بسلاسة", center.x, center.y - 8);
    // سطر 2: مع م.آية (أحمر)
    ctx.fillStyle = "#DA151C";
    ctx.fillText("مع م.آية", center.x, center.y + 18);
    // لوجو تحت (ابتسامة + عيون)
    const logoY = center.y + 42;
    ctx.fillStyle = "#DA151C";
    ctx.beginPath();
    ctx.arc(center.x - 6, logoY - 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center.x + 6, logoY - 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0142A0";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(center.x, logoY - 2, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (type === "stamp-round") {
    // ختم دائري ورقي - دائرة زرقاء + بسلاسة + مع م.آية + لوجو تحت
    const r = 42;
    // دائرة زرقاء خارجية (سميكة)
    ctx.strokeStyle = "#0142A0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // دائرة حمراء داخلية (رفيعة)
    ctx.strokeStyle = "#DA151C";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r - 5, 0, Math.PI * 2);
    ctx.stroke();
    // سطر 1: بسلاسة (أزرق، في الأعلى)
    ctx.fillStyle = "#0142A0";
    ctx.font = "bold 12px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("بسلاسة", center.x, center.y - 10);
    // سطر 2: مع م.آية (أحمر، في الوسط)
    ctx.fillStyle = "#DA151C";
    ctx.fillText("مع م.آية", center.x, center.y + 4);
    // لوجو تحت (ابتسامة + عيون)
    const logoY = center.y + 20;
    ctx.fillStyle = "#DA151C";
    ctx.beginPath();
    ctx.arc(center.x - 5, logoY, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center.x + 5, logoY, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0142A0";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(center.x, logoY + 2, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (type === "stamp-rect") {
    // ختم مستطيل ورقي - ضلعين طوال + ضلع قصير + بسلاسة + مع م.آية + لوجو
    const w = 100;
    const h = 75;
    // إطار أزرق سميك (ضلعين طوال + ضلع قصير - مثل الختم الورقي)
    ctx.strokeStyle = "#0142A0";
    ctx.lineWidth = 4;
    // الضلع الأيمن (طويل)
    ctx.beginPath();
    ctx.moveTo(center.x + w/2, center.y - h/2);
    ctx.lineTo(center.x + w/2, center.y + h/2);
    ctx.stroke();
    // الضلع الأيسر (طويل)
    ctx.beginPath();
    ctx.moveTo(center.x - w/2, center.y - h/2);
    ctx.lineTo(center.x - w/2, center.y + h/2);
    ctx.stroke();
    // الضلع العلوي (قصير - يبدأ وينتهي قبل الأطراف)
    ctx.beginPath();
    ctx.moveTo(center.x - w/2 + 12, center.y - h/2);
    ctx.lineTo(center.x + w/2 - 12, center.y - h/2);
    ctx.stroke();
    // إطار أحمر داخلي رفيع
    ctx.strokeStyle = "#DA151C";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center.x + w/2 - 5, center.y - h/2 + 4);
    ctx.lineTo(center.x + w/2 - 5, center.y + h/2 - 4);
    ctx.moveTo(center.x - w/2 + 5, center.y - h/2 + 4);
    ctx.lineTo(center.x - w/2 + 5, center.y + h/2 - 4);
    ctx.moveTo(center.x - w/2 + 14, center.y - h/2 + 4);
    ctx.lineTo(center.x + w/2 - 14, center.y - h/2 + 4);
    ctx.stroke();
    // سطر 1: بسلاسة (أزرق)
    ctx.fillStyle = "#0142A0";
    ctx.font = "bold 13px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("بسلاسة", center.x, center.y - 12);
    // سطر 2: مع م.آية (أحمر)
    ctx.fillStyle = "#DA151C";
    ctx.fillText("مع م.آية", center.x, center.y + 4);
    // لوجو تحت (ابتسامة + عيون)
    const logoY2 = center.y + 22;
    ctx.fillStyle = "#DA151C";
    ctx.beginPath();
    ctx.arc(center.x - 5, logoY2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center.x + 5, logoY2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0142A0";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(center.x, logoY2 + 2, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (type === "bravo") {
    // أحسنت! - تهنئة
    ctx.fillStyle = "#10b981";
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.font = "bold 32px Cairo, sans-serif";
    ctx.strokeText("أحسنت!", center.x, center.y);
    ctx.fillText("أحسنت!", center.x, center.y);
    // نجمة
    drawStar(ctx, { x: center.x + 60, y: center.y - 10 } as Point, "#FFD700", 12);
  } else if (type === "excellent") {
    // ممتاز - تهنئة
    ctx.fillStyle = "#0142A0";
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.font = "bold 30px Cairo, sans-serif";
    ctx.strokeText("ممتاز", center.x, center.y);
    ctx.fillText("ممتاز", center.x, center.y);
  } else if (type === "wow") {
    // واااو! - تهنئة
    ctx.fillStyle = "#a855f7";
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.font = "bold 28px Cairo, sans-serif";
    ctx.strokeText("واااو!", center.x, center.y);
    ctx.fillText("واااو!", center.x, center.y);
  } else if (type === "good-job") {
    // عمل رائع - تشجيع
    ctx.fillStyle = "#06b6d4";
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.font = "bold 24px Cairo, sans-serif";
    ctx.strokeText("عمل رائع", center.x, center.y);
    ctx.fillText("عمل رائع", center.x, center.y);
  } else if (type === "try-again") {
    // حاول مرة أخرى - غلط
    ctx.fillStyle = "#f59e0b";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.font = "bold 22px Cairo, sans-serif";
    ctx.strokeText("حاول مرة أخرى", center.x, center.y);
    ctx.fillText("حاول مرة أخرى", center.x, center.y);
  } else if (type === "wrong") {
    // خطأ - غلط
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    // علامة X
    ctx.beginPath();
    ctx.moveTo(center.x - 15, center.y - 15);
    ctx.lineTo(center.x + 15, center.y + 15);
    ctx.moveTo(center.x + 15, center.y - 15);
    ctx.lineTo(center.x - 15, center.y + 15);
    ctx.stroke();
    // كلمة خطأ
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 18px Cairo, sans-serif";
    ctx.fillText("خطأ", center.x, center.y + 35);
  } else if (type === "almost") {
    // قريب جداً - غلط
    ctx.fillStyle = "#f59e0b";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.font = "bold 22px Cairo, sans-serif";
    ctx.strokeText("قريب جداً!", center.x, center.y);
    ctx.fillText("قريب جداً!", center.x, center.y);
  } else if (type === "keep-trying") {
    // استمر في المحاولة - تشجيع
    ctx.fillStyle = "#8338ec";
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.font = "bold 20px Cairo, sans-serif";
    ctx.strokeText("استمر في المحاولة", center.x, center.y);
    ctx.fillText("استمر في المحاولة", center.x, center.y);
  }

  ctx.restore();
}
