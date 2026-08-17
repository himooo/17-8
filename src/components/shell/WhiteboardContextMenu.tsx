"use client";

import { useState, useEffect, useRef } from "react";
import { useShellStore, type WhiteboardTool, type WhiteboardColor, type StampId } from "@/lib/shell-store";
import { cn } from "@/lib/utils";
import { HelperAssetsPanel } from "./HelperAssetsPanel";
import { announce } from "@/lib/tts-announcer";
import {
  Pen,
  Highlighter,
  Eraser,
  Zap,
  Type,
  Triangle,
  ArrowUpRight,
  Check,
  X,
  Star,
  MousePointer,
  Undo2,
  Trash2,
  PartyPopper,
  Trophy,
  XCircle,
  Circle,
  Square,
  CircleDot,
  Sparkles,
  Flame,
  Music,
  Plus,
  Minus,
  Clapperboard,
  Sparkle,
  Sigma,
  FolderOpen,
  FileText,
} from "lucide-react";

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
}

const TOOLS: Array<{ id: WhiteboardTool; icon: typeof Pen; label: string; shapeId?: string }> = [
  { id: "select", icon: MousePointer, label: "ماوس" },
  { id: "pen", icon: Pen, label: "قلم" },
  { id: "laserpen", icon: CircleDot, label: "قلم+ليزر" },
  { id: "highlighter", icon: Highlighter, label: "تظليل" },
  { id: "eraser", icon: Eraser, label: "ممحاة" },
  { id: "laser", icon: Zap, label: "ليزر" },
  { id: "text", icon: Type, label: "نص" },
  { id: "shape", icon: Triangle, label: "مثلث", shapeId: "triangle" },
  { id: "shape", icon: Circle, label: "دائرة", shapeId: "circle" },
  { id: "shape", icon: Square, label: "مربع", shapeId: "rectangle" },
  { id: "arrow", icon: ArrowUpRight, label: "سهم" },
  { id: "check", icon: Check, label: "صح ✓" },
  { id: "x", icon: X, label: "خطأ ✗" },
  { id: "star", icon: Star, label: "نجمة ★" },
  { id: "equation", icon: Sigma, label: "معادلة LaTeX" },
];

const COLORS: Array<{ id: WhiteboardColor; color: string }> = [
  { id: "blue", color: "#3b82f6" },
  { id: "red", color: "#ef4444" },
  { id: "green", color: "#10b981" },
  { id: "yellow", color: "#fbbf24" },
  { id: "white", color: "#ffffff" },
  { id: "black", color: "#1a1a1a" },
];

/**
 * WhiteboardContextMenu - قائمة سياق عند الكلك يمين
 * تظهر فوق منطقة العرض
 * تحتوي على: أدوات السبورة + ألوان + تراجع/مسح + أزرار احتفال
 */
export function WhiteboardContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false });
  const [showHelperAssets, setShowHelperAssets] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const tool = useShellStore((s) => s.whiteboardTool);
  const setWhiteboardTool = useShellStore((s) => s.setWhiteboardTool);
  const whiteboardShape = useShellStore((s) => s.whiteboardShape);
  const setWhiteboardShape = useShellStore((s) => s.setWhiteboardShape);
  const color = useShellStore((s) => s.whiteboardColor);
  const setWhiteboardColor = useShellStore((s) => s.setWhiteboardColor);
  const thickness = useShellStore((s) => s.whiteboardThickness);
  const setWhiteboardThickness = useShellStore((s) => s.setWhiteboardThickness);
  const updateSettings = useShellStore((s) => s.updateSettings);
  const clearWhiteboard = useShellStore((s) => s.clearWhiteboard);
  const undoWhiteboard = useShellStore((s) => s.undoWhiteboard);
  const redoWhiteboard = useShellStore((s) => s.redoWhiteboard);
  const whiteboardHistoryCount = useShellStore((s) => s.whiteboardHistoryCount);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const triggerRedFlash = useShellStore((s) => s.triggerRedFlash);
  const triggerGreenFlash = useShellStore((s) => s.triggerGreenFlash);
  const playSound = useShellStore((s) => s.playSound);
  // v10: stamps + precision + celebrations
  const selectedStamp = useShellStore((s) => s.selectedStamp);
  const setSelectedStamp = useShellStore((s) => s.setSelectedStamp);
  const precisionMode = useShellStore((s) => s.settings.precisionMode ?? false);
  const precisionScale = useShellStore((s) => s.settings.precisionScale ?? 2);
  const whiteboardBackground = useShellStore((s) => s.settings.whiteboardBackground || "transparent");
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const setViewingHelperAsset = useShellStore((s) => s.setViewingHelperAsset);
  const requestConfirm = useShellStore((s) => s.requestConfirm);

  // الاستماع للكلك يمين على منطقة العرض (iframe-stage) - capture phase
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const stage = target.closest(".iframe-stage");
      if (!stage) return;

      e.preventDefault();
      e.stopPropagation();
      // إيقاف الحدث فوراً لمنع أي كتابة
      if (e.cancelable) e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, visible: true });
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menu.visible && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu((m) => ({ ...m, visible: false }));
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu((m) => ({ ...m, visible: false }));
      }
    };

    // capture: true لضمان التقاط الحدث قبل أي عنصر آخر
    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menu.visible, menu.x, menu.y]);

  // زر الماوس الأوسط (scroll click) = تراجع في الكتابة (undo)
  // كليك يمين (button 2) = لا يفعل شيء (فقط القائمة عبر contextmenu)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // button 1 = middle click (scroll) = undo
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        undoWhiteboard();
        playSound("click");
      }
    };
    // منع قائمة المتصفح الافتراضية على الكليك يمين في كل مكان
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("contextmenu", handleContextMenu, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [undoWhiteboard, playSound]);

  if (!menu.visible && !showHelperAssets) return null;

  if (showHelperAssets) {
    return <HelperAssetsPanel onClose={() => setShowHelperAssets(false)} />;
  }

  // ضبط الموضع بحيث لا يتجاوز الشاشة
  const menuWidth = 200;
  const menuHeight = 580;
  const x = Math.min(menu.x, window.innerWidth - menuWidth - 10);
  const y = Math.min(menu.y, window.innerHeight - menuHeight - 10);

  const selectTool = (toolId: typeof tool, shapeId?: string) => {
    updateSettings({ whiteboardEnabled: true });
    setWhiteboardTool(toolId);
    if (shapeId && toolId === "shape") {
      setWhiteboardShape(shapeId as "circle" | "rectangle" | "triangle");
    }
    setMenu({ ...menu, visible: false });
  };

  // حجم الخط: لا يغلق القائمة
  const changeThickness = (delta: number) => {
    const cur = useShellStore.getState().whiteboardThickness;
    setWhiteboardThickness(Math.max(1, Math.min(30, cur + delta)));
    // لا نغلق القائمة - تبقى مفتوحة
  };

  return (
    <>
      {/* overlay خلفي */}
      <div className="fixed inset-0 z-[90]" onClick={() => setMenu({ ...menu, visible: false })} />
      <div
        ref={menuRef}
        className="fixed z-[100] side-panel rounded-lg shadow-2xl p-2 animate-scale-in"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${menuWidth}px`,
          maxHeight: `${menuHeight}px`,
          overflowY: "auto",
        }}
      >
        {/* أدوات السبورة */}
        <div className="text-[10px] text-muted-foreground mb-1 px-1">الأدوات</div>
        <div className="grid grid-cols-4 gap-1 mb-2">
          {TOOLS.map((t, idx) => {
            const Icon = t.icon;
            const tShapeId = t.shapeId;
            const isActive = tool === t.id && (!tShapeId || whiteboardShape === tShapeId);
            return (
              <button
                key={idx}
                onClick={() => selectTool(t.id, tShapeId)}
                className={cn(
                  "h-8 flex flex-col items-center justify-center rounded transition-all hover:scale-110",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-accent/20"
                )}
                title={t.label}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
        {/* أدوات متقدمة */}
        <div className="text-[10px] text-muted-foreground mb-1 px-1">أدوات متقدمة</div>
        <div className="grid grid-cols-4 gap-1 mb-2">
          <button
            onClick={() => {
              updateSettings({ whiteboardEnabled: true });
              setWhiteboardTool("eraser-big");
              setMenu({ ...menu, visible: false });
            }}
            className={cn(
              "h-8 flex flex-col items-center justify-center rounded transition-all hover:scale-110",
              tool === "eraser-big"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-accent/20"
            )}
            title="ممحاة كبيرة ×2 (Shift+E)"
          >
            <Eraser className="w-3 h-3" />
            <span className="text-[7px]">×2</span>
          </button>
          <button
            onClick={() => {
              updateSettings({ whiteboardEnabled: true });
              setWhiteboardTool("rainbow");
              setMenu({ ...menu, visible: false });
            }}
            className={cn(
              "h-8 flex flex-col items-center justify-center rounded transition-all hover:scale-110",
              tool === "rainbow"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-accent/20"
            )}
            title="قلم قوس قزح — اللون يتغير كل 100px"
          >
            <Sparkles className="w-3 h-3" />
            <span className="text-[7px]">🌈</span>
          </button>
        </div>

        {/* الألوان */}
        <div className="text-[10px] text-muted-foreground mb-1 px-1">الألوان</div>
        <div className="grid grid-cols-6 gap-1 mb-2">
          {COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setWhiteboardColor(c.id);
                setMenu({ ...menu, visible: false });
              }}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-all hover:scale-110",
                color === c.id ? "border-primary scale-110" : "border-border"
              )}
              style={{ background: c.color }}
              title={c.id}
            />
          ))}
        </div>

        {/* تراجع + إعادة + مسح */}
        <div className="grid grid-cols-3 gap-1 mb-1">
          <button
            onClick={() => {
              undoWhiteboard();
              setMenu({ ...menu, visible: false });
            }}
            className="h-7 flex items-center justify-center gap-1 rounded text-[10px] bg-secondary/50 hover:bg-accent/10 transition-colors"
            title="تراجع (Ctrl+Z)"
          >
            <Undo2 className="w-3 h-3" />
            تراجع
          </button>
          <button
            onClick={() => {
              redoWhiteboard();
              setMenu({ ...menu, visible: false });
            }}
            className="h-7 flex items-center justify-center gap-1 rounded text-[10px] bg-secondary/50 hover:bg-accent/10 transition-colors"
            title="إعادة (Ctrl+Y)"
          >
            <Undo2 className="w-3 h-3 scale-x-[-1]" />
            إعادة
          </button>
          <button
            onClick={async () => {
              setMenu({ ...menu, visible: false });
              if (await requestConfirm("مسح كل الرسم؟", { danger: true })) clearWhiteboard();
            }}
            className="h-7 flex items-center justify-center gap-1 rounded text-[10px] bg-secondary/50 hover:bg-accent/20 hover:text-accent transition-colors"
            title="مسح الكل"
          >
            <Trash2 className="w-3 h-3" />
            مسح
          </button>
        </div>
        {/* History counter */}
        {whiteboardHistoryCount.total > 0 && (
          <div className="flex items-center justify-center gap-1 mb-2 text-[9px] text-muted-foreground">
            <span className="bg-slate-700/60 rounded px-1.5 py-0.5 font-mono">
              {whiteboardHistoryCount.index}/{whiteboardHistoryCount.total}
            </span>
          </div>
        )}

        {/* فاصل */}
        <div className="h-px bg-border my-1" />

        {/* حجم الخط/القلم - لا يغلق القائمة */}
        <div className="text-[10px] text-muted-foreground mb-1 px-1">حجم الخط</div>
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => changeThickness(-2)}
            className="h-6 w-6 flex items-center justify-center rounded bg-secondary/50 hover:bg-accent/10 transition-colors"
            title="تصغير"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-[10px] font-bold text-primary flex-1 text-center">
            {thickness}px
          </span>
          <button
            onClick={() => changeThickness(2)}
            className="h-6 w-6 flex items-center justify-center rounded bg-secondary/50 hover:bg-accent/10 transition-colors"
            title="تكبير"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* فاصل */}
        <div className="h-px bg-border my-1" />

        {/* v10: Sound + Effect combos - صوت + احتفال مرتبط */}
        <div className="text-[10px] text-muted-foreground mb-1 px-1">صوت + احتفال</div>
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => {
              triggerGreenFlash();
              playSound("success");
              announce("celebration-fired", { celebrationLabel: "نجاح" });
              setMenu({ ...menu, visible: false });
            }}
            className="h-8 flex flex-col items-center justify-center gap-0.5 rounded text-[9px] font-bold transition-all hover:scale-105"
            style={{ background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7" }}
            title="صوت نجاح + فلاش أخضر"
          >
            <Trophy className="w-3.5 h-3.5" />
            نجاح
          </button>
          <button
            onClick={() => {
              triggerRedFlash();
              playSound("error");
              announce("celebration-fired", { celebrationLabel: "خطأ" });
              setMenu({ ...menu, visible: false });
            }}
            className="h-8 flex flex-col items-center justify-center gap-0.5 rounded text-[9px] font-bold transition-all hover:scale-105"
            style={{ background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5" }}
            title="صوت خطأ + فلاش أحمر"
          >
            <XCircle className="w-3.5 h-3.5" />
            خطأ
          </button>
          <button
            onClick={() => {
              triggerConfetti();
              playSound("celebrate-fanfare");
              announce("celebration-fired", { celebrationLabel: "أبواق" });
              setMenu({ ...menu, visible: false });
            }}
            className="h-8 flex flex-col items-center justify-center gap-0.5 rounded text-[9px] font-bold transition-all hover:scale-105"
            style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}
            title="أبواق + كونفيتي"
          >
            <Music className="w-3.5 h-3.5" />
            أبواق
          </button>
          <button
            onClick={() => {
              triggerConfetti();
              playSound("celebrate-students");
              announce("celebration-fired", { celebrationLabel: "فرحة طلاب" });
              setMenu({ ...menu, visible: false });
            }}
            className="h-8 flex flex-col items-center justify-center gap-0.5 rounded text-[9px] font-bold transition-all hover:scale-105"
            style={{ background: "rgba(168, 85, 247, 0.2)", color: "#c084fc" }}
            title="فرحة طلاب + كونفيتي"
          >
            <Sparkles className="w-3.5 h-3.5" />
            طلاب
          </button>
          <button
            onClick={() => {
              triggerConfetti();
              playSound("celebrate-applause");
              announce("celebration-fired", { celebrationLabel: "تصفيق" });
              setMenu({ ...menu, visible: false });
            }}
            className="h-8 flex flex-col items-center justify-center gap-0.5 rounded text-[9px] font-bold transition-all hover:scale-105"
            style={{ background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7" }}
            title="تصفيق حقيقي + كونفيتي"
          >
            <Clapperboard className="w-3.5 h-3.5" />
            تصفيق
          </button>
          <button
            onClick={() => {
              triggerConfetti();
              setCelebrationType("fireworks");
              playSound("celebrate-fireworks");
              announce("celebration-fired", { celebrationLabel: "ألعاب نارية" });
              setMenu({ ...menu, visible: false });
            }}
            className="h-8 flex flex-col items-center justify-center gap-0.5 rounded text-[9px] font-bold transition-all hover:scale-105"
            style={{ background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5" }}
            title="ألعاب نارية + صوت"
          >
            <Flame className="w-3.5 h-3.5" />
            نارية
          </button>
        </div>

        {/* فاصل */}
        <div className="h-px bg-border my-1" />

        {/* ===== الأختام ===== */}
        <div className="text-[10px] text-muted-foreground mb-1 px-1 flex items-center justify-between">
          <span>الأختام</span>
          {selectedStamp && (
            <button
              onClick={() => {
                setSelectedStamp(null);
                setWhiteboardTool("pen");
              }}
              className="text-[9px] text-red-400 hover:text-red-300"
            >
              إلغاء
            </button>
          )}
        </div>

        {/* مجموعة 1: اختام تهنئة */}
        <div className="text-[9px] text-green-400/60 mb-0.5 px-1">🎉 تهنئة</div>
        <div className="grid grid-cols-4 gap-1 mb-1">
          {([
            { id: "smile-stamp", icon: "😊", label: "ابتسامة" },
            { id: "bravo", icon: "أحسنت!", label: "أحسنت!" },
            { id: "excellent", icon: "ممتاز", label: "ممتاز" },
            { id: "wow", icon: "واااو!", label: "واااو!" },
            { id: "good-job", icon: "رائع", label: "عمل رائع" },
            { id: "star", icon: "⭐", label: "نجمة" },
            { id: "trophy", icon: "🏆", label: "كأس" },
            { id: "100", icon: "💯", label: "مئة" },
          ] as Array<{ id: StampId; icon: string; label: string }>).map((s) => (
            <button
              key={s.id}
              onClick={() => {
                updateSettings({ whiteboardEnabled: true });
                setSelectedStamp(s.id);
                setMenu({ ...menu, visible: false });
              }}
              className={cn(
                "h-8 flex items-center justify-center rounded text-[10px] font-bold transition-all hover:scale-110",
                selectedStamp === s.id
                  ? "bg-[#10b981] text-white"
                  : "bg-secondary/50 hover:bg-accent/20"
              )}
              title={s.label}
            >
              {s.icon}
            </button>
          ))}
        </div>

        {/* مجموعة 2: اختام غلط وتشجيع */}
        <div className="text-[9px] text-red-400/60 mb-0.5 px-1">💪 محاولة وتشجيع</div>
        <div className="grid grid-cols-4 gap-1 mb-1">
          {([
            { id: "try-again", icon: "حاول", label: "حاول مرة أخرى" },
            { id: "wrong", icon: "✗", label: "خطأ" },
            { id: "almost", icon: "قريب", label: "قريب جداً" },
            { id: "keep-trying", icon: "استمر", label: "استمر في المحاولة" },
          ] as Array<{ id: StampId; icon: string; label: string }>).map((s) => (
            <button
              key={s.id}
              onClick={() => {
                updateSettings({ whiteboardEnabled: true });
                setSelectedStamp(s.id);
                setMenu({ ...menu, visible: false });
              }}
              className={cn(
                "h-8 flex items-center justify-center rounded text-[10px] font-bold transition-all hover:scale-110",
                selectedStamp === s.id
                  ? "bg-[#f59e0b] text-white"
                  : "bg-secondary/50 hover:bg-accent/20"
              )}
              title={s.label}
            >
              {s.icon}
            </button>
          ))}
        </div>

        {/* مجموعة 3: اختام بسلاسة */}
        <div className="text-[9px] text-blue-400/60 mb-0.5 px-1">بسلاسة</div>
        <div className="grid grid-cols-4 gap-1 mb-2">
          {([
            { id: "stamp-round", icon: "⭕", label: "ختم دائري" },
            { id: "stamp-rect", icon: "▭", label: "ختم مستطيل" },
            { id: "logo", icon: "😊", label: "شعار بسلاسة" },
            { id: "with-aya", icon: "م.آية", label: "بسلاسة مع م.آية" },
          ] as Array<{ id: StampId; icon: string; label: string }>).map((s) => (
            <button
              key={s.id}
              onClick={() => {
                updateSettings({ whiteboardEnabled: true });
                setSelectedStamp(s.id);
                setMenu({ ...menu, visible: false });
              }}
              className={cn(
                "h-8 flex items-center justify-center rounded text-[10px] font-bold transition-all hover:scale-110",
                selectedStamp === s.id
                  ? "bg-[#DA151C] text-white"
                  : "bg-secondary/50 hover:bg-accent/20"
              )}
              title={s.label}
            >
              {s.icon}
            </button>
          ))}
        </div>

        {/* v11: Precision mode toggle + slider */}
        <button
          onClick={() => {
            updateSettings({ precisionMode: !precisionMode });
            playSound("click");
          }}
          className={cn(
            "w-full h-7 flex items-center justify-center gap-1 rounded text-[10px] font-bold transition-colors mb-1",
            precisionMode
              ? "bg-[#0142A0] text-white"
              : "bg-secondary/50 text-muted-foreground hover:bg-accent/20"
          )}
          title="وضع الدقة العالية - ينتج خطوطاً أنعم وأكثر احترافية"
        >
          <Sparkle className="w-3 h-3" />
          {precisionMode ? "وضع الدقة: مُفعّل" : "وضع الدقة: متوقف"}
        </button>
        {precisionMode && (
          <div className="flex items-center gap-1 mb-2 px-1">
            <span className="text-[9px] text-muted-foreground shrink-0">دقة</span>
            <input
              type="range"
              min={1}
              max={5}
              value={precisionScale}
              onChange={(e) => {
                updateSettings({ precisionScale: parseInt(e.target.value) });
              }}
              className="flex-1 h-1"
            />
            <span className="text-[9px] font-bold text-primary w-4">
              {precisionScale}
            </span>
          </div>
        )}

        {/* v11: خلفية السبورة */}
        <div className="text-[10px] text-muted-foreground mb-1 px-1">خلفية السبورة</div>
        <div className="grid grid-cols-4 gap-1 mb-2">
          {([
            { id: "transparent", label: "شفاف", icon: "⬜" },
            { id: "lined", label: "مسطر", icon: "📝" },
            { id: "grid", label: "شبكة", icon: "🔲" },
            { id: "dotted", label: "منقط", icon: "⚫" },
          ] as Array<{ id: "transparent" | "lined" | "grid" | "dotted"; label: string; icon: string }>).map((bg) => (
            <button
              key={bg.id}
              onClick={() => {
                updateSettings({ whiteboardBackground: bg.id });
                playSound("click");
              }}
              className={cn(
                "h-7 flex flex-col items-center justify-center rounded text-[9px] font-bold transition",
                whiteboardBackground === bg.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 hover:bg-accent/20"
              )}
              title={bg.label}
            >
              <span>{bg.icon}</span>
            </button>
          ))}
        </div>

        {/* فاصل */}
        <div className="h-px bg-border my-1" />

        {/* v10: Celebrations - الاحتفالات */}
        <div className="text-[10px] text-muted-foreground mb-1 px-1">الاحتفالات</div>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {[
            { id: "confetti", icon: "🎉", label: "كونفيتي", color: "rgba(245, 158, 11, 0.2)", textColor: "#fbbf24" },
            { id: "hearts", icon: "💖", label: "قلوب", color: "rgba(236, 72, 153, 0.2)", textColor: "#f9a8d4" },
            { id: "stars", icon: "⭐", label: "نجوم", color: "rgba(250, 204, 21, 0.2)", textColor: "#fde047" },
            { id: "money", icon: "💰", label: "نقود", color: "rgba(16, 185, 129, 0.2)", textColor: "#6ee7b7" },
            { id: "balloons", icon: "🎈", label: "بالونات", color: "rgba(168, 85, 247, 0.2)", textColor: "#c084fc" },
            { id: "fireworks", icon: "🎆", label: "ألعاب نارية", color: "rgba(239, 68, 68, 0.2)", textColor: "#fca5a5" },
            { id: "gift-rain", icon: "🎁", label: "هطول هدايا", color: "rgba(236, 72, 153, 0.2)", textColor: "#f9a8d4" },
            { id: "rainbow", icon: "🌈", label: "قوس قزح", color: "rgba(59, 130, 246, 0.2)", textColor: "#93c5fd" },
            { id: "mega", icon: "🏆", label: "احتفال ضخم", color: "rgba(245, 158, 11, 0.2)", textColor: "#fbbf24" },
            { id: "snow", icon: "❄️", label: "ثلج", color: "rgba(6, 182, 212, 0.2)", textColor: "#67e8f9" },
            { id: "cannon", icon: "🎊", label: "مدفع", color: "rgba(245, 158, 11, 0.2)", textColor: "#fbbf24" },
            { id: "golden-shower", icon: "✨", label: "ذهبي", color: "rgba(250, 204, 21, 0.2)", textColor: "#fde047" },
            { id: "school-pride", icon: "🎓", label: "فخر", color: "rgba(1, 66, 160, 0.2)", textColor: "#60a5fa" },
            { id: "disco", icon: "🪩", label: "ديسكو", color: "rgba(131, 56, 236, 0.2)", textColor: "#c084fc" },
            { id: "champion", icon: "🥇", label: "بطل", color: "rgba(250, 204, 21, 0.2)", textColor: "#fde047" },
            { id: "diamond", icon: "💎", label: "ألماس", color: "rgba(191, 219, 254, 0.2)", textColor: "#bfdbfe" },
            { id: "tornado", icon: "🌪️", label: "إعصار", color: "rgba(6, 182, 212, 0.2)", textColor: "#67e8f9" },
            { id: "spring-blossom", icon: "🌸", label: "أزهار", color: "rgba(249, 168, 212, 0.2)", textColor: "#f9a8d4" },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCelebrationType(c.id);
                triggerConfetti();
                playSound("celebrate-tada");
                setMenu({ ...menu, visible: false });
              }}
              className="h-8 flex flex-col items-center justify-center rounded text-[10px] font-bold transition-all hover:scale-105"
              style={{ background: c.color, color: c.textColor }}
              title={c.label}
            >
              <span className="text-base">{c.icon}</span>
            </button>
          ))}
        </div>

        {/* فاصل */}
        <div className="h-px bg-border my-1" />

        {/* زر صفحة الورقة (للكتابة اليدوية) */}
        <button
          onClick={() => {
            updateSettings({ whiteboardEnabled: true });
            setWhiteboardTool("pen");
            setViewingHelperAsset({
              type: "paper",
              data: "paper",
              name: "ورقة بسلاسة",
            });
            setMenu({ ...menu, visible: false });
          }}
          className="w-full h-8 flex items-center justify-center gap-2 rounded text-[10px] font-bold bg-[#0142A0]/20 text-[#60a5fa] hover:bg-[#0142A0]/40 transition-colors mb-1"
          title="صفحة ورقة للكتابة اليدوية"
        >
          <FileText className="w-3.5 h-3.5" />
          صفحة ورقة
        </button>

        {/* زر الأدوات المساعدة */}
        <button
          onClick={() => {
            setMenu({ ...menu, visible: false });
            setShowHelperAssets(true);
          }}
          className="w-full h-8 flex items-center justify-center gap-2 rounded text-[10px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          title="الأدوات المساعدة (PDF/صور/فيديو/روابط)"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          الأدوات المساعدة
        </button>
      </div>
    </>
  );
}
