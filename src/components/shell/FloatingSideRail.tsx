"use client";

import dynamic from "next/dynamic";
import { useShellStore } from "@/lib/shell-store";
import { cn } from "@/lib/utils";
import { Component, type ReactNode, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Users,
  Image as ImageIcon,
  Settings as SettingsIcon,
  StickyNote,
  X,
  Volume2,
  VolumeX,
  PartyPopper,
  Pen,
  Eraser,
  Zap,
  Type,
  MousePointer2,
  Triangle,
  ArrowUpRight,
  Check,
  Star,
  Highlighter,
  Undo2,
  Trash2,
  Monitor,
  Tablet,
  Smartphone,
  Maximize,
  Maximize2,
  Expand,
  ZoomIn,
  ZoomOut,
  RectangleHorizontal,
  RectangleVertical,
  MousePointer,
  CircleDot,
  Circle,
  Square,
  Award,
  Gift as GiftIcon,
  School,
  Layers,
  Music,
  Flame,
  Bot,
  Sparkles,
  FileText,
  Calculator,
  PlugZap,
  Scale,
} from "lucide-react";
import { CanvasPanel } from "./CanvasPanel";

function PanelLoading() {
  return <div className="flex min-h-24 items-center justify-center p-6 text-xs text-muted-foreground">جاري تحميل اللوحة...</div>;
}

type PanelErrorBoundaryProps = { children: ReactNode; panelId: string; onClose: () => void };
type PanelErrorBoundaryState = { hasError: boolean };

class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  state: PanelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PanelErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[FloatingSideRail] panel failed: ${this.props.panelId}`, error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-full min-h-32 flex-col items-center justify-center gap-3 p-5 text-center" dir="rtl">
        <div className="text-sm font-bold text-red-300">تعذر تحميل محتوى هذه اللوحة</div>
        <p className="max-w-[260px] text-[11px] leading-5 text-muted-foreground">لم يتوقف التطبيق. أغلق اللوحة أو أعد المحاولة، وستظل بيانات الجلسة محفوظة.</p>
        <div className="flex gap-2">
          <button type="button" className="rounded-md border border-border px-3 py-1.5 text-[11px] hover:bg-accent/20" onClick={() => this.setState({ hasError: false })}>إعادة المحاولة</button>
          <button type="button" className="rounded-md bg-primary px-3 py-1.5 text-[11px] text-primary-foreground hover:bg-primary/90" onClick={this.props.onClose}>إغلاق اللوحة</button>
        </div>
      </div>
    );
  }
}

const CurriculumPanel = dynamic(() => import("./panels/CurriculumPanel").then((module) => module.CurriculumPanel), { ssr: false, loading: PanelLoading });
const StudentsPanel = dynamic(() => import("./panels/StudentsPanel").then((module) => module.StudentsPanel), { ssr: false, loading: PanelLoading });
const AssetsPanel = dynamic(() => import("./panels/AssetsPanel").then((module) => module.AssetsPanel), { ssr: false, loading: PanelLoading });
const SettingsPanel = dynamic(() => import("./panels/SettingsPanel").then((module) => module.SettingsPanel), { ssr: false, loading: PanelLoading });
const NotesPanel = dynamic(() => import("./panels/NotesPanel").then((module) => module.NotesPanel), { ssr: false, loading: PanelLoading });
const PrizesPanel = dynamic(() => import("./panels/PrizesPanel").then((module) => module.PrizesPanel), { ssr: false, loading: PanelLoading });
const GiftsPanel = dynamic(() => import("./panels/GiftsPanel").then((module) => module.GiftsPanel), { ssr: false, loading: PanelLoading });
const ClassesPanel = dynamic(() => import("./panels/ClassesPanel").then((module) => module.ClassesPanel), { ssr: false, loading: PanelLoading });
const GroupsPanel = dynamic(() => import("./panels/GroupsPanel").then((module) => module.GroupsPanel), { ssr: false, loading: PanelLoading });
const SoundsPanel = dynamic(() => import("./panels/SoundsPanel").then((module) => module.SoundsPanel), { ssr: false, loading: PanelLoading });
const CelebrationsPanel = dynamic(() => import("./CelebrationsPanel").then((module) => module.CelebrationsPanel), { ssr: false, loading: PanelLoading });
const LessonBlueprint = dynamic(() => import("./LessonIntelligence").then((module) => module.LessonBlueprint), { ssr: false, loading: PanelLoading });
const QuickGiftPanel = dynamic(() => import("./GiftPersonalities").then((module) => module.QuickGiftPanel), { ssr: false, loading: PanelLoading });
const AiPanel = dynamic(() => import("./panels/AiPanel").then((module) => module.AiPanel), { ssr: false, loading: PanelLoading });
const ReportsPanel = dynamic(() => import("./panels/ReportsPanel").then((module) => module.ReportsPanel), { ssr: false, loading: PanelLoading });
const MoodlePanel = dynamic(() => import("./panels/MoodlePanel").then((module) => module.MoodlePanel), { ssr: false, loading: PanelLoading });
const LessonEditorPanel = dynamic(() => import("./LessonEditorPanel").then((module) => module.LessonEditorPanel), { ssr: false, loading: PanelLoading });
const LessonFairnessPanel = dynamic(() => import("./LessonFairnessPanel").then((module) => module.LessonFairnessPanel), { ssr: false, loading: PanelLoading });
const RewardsV10Panel = dynamic(() => import("./panels/RewardsV10Panel").then((module) => module.RewardsV10Panel), { ssr: false, loading: PanelLoading });

// تجميع العناصر: تعليمية | طلاب | محتوى | صوت/احتفال | عرض
const RAIL_GROUPS: Array<{
  id: string;
  items: Array<{ id: "curriculum" | "students" | "classes" | "groups" | "prizes" | "gifts" | "sounds" | "celebrations" | "blueprint" | "lesson-editor" | "quickgift" | "assets" | "notes" | "settings" | "moodle" | "ai" | "reports" | "fairness" | "rewards-v10"; icon: typeof BookOpen; label: string }>;
}> = [
  {
    id: "content",
    items: [
      { id: "curriculum", icon: BookOpen, label: "المنهج" },
      { id: "blueprint", icon: Sparkles, label: "التحليل" },
      { id: "lesson-editor", icon: Type, label: "محرر الدرس" },
      { id: "ai", icon: Bot, label: "مساعد AI" },
      { id: "reports", icon: FileText, label: "التقارير" },
      { id: "fairness", icon: Scale, label: "لوحة العدالة" },
      { id: "assets", icon: ImageIcon, label: "الأصول" },
      { id: "notes", icon: StickyNote, label: "النوتس" },
    ],
  },
  {
    id: "students",
    items: [
      { id: "students", icon: Users, label: "الطلاب" },
      { id: "classes", icon: School, label: "الفصول" },
      { id: "groups", icon: Layers, label: "المجموعات" },
    ],
  },
  {
    id: "rewards",
    items: [
      { id: "prizes", icon: Award, label: "الجوائز" },
      { id: "gifts", icon: GiftIcon, label: "الهدايا" },
      { id: "quickgift", icon: GiftIcon, label: "هدية سريعة" },
      { id: "sounds", icon: Music, label: "الأصوات" },
      { id: "celebrations", icon: PartyPopper, label: "الاحتفالات" },
      { id: "rewards-v10", icon: Sparkles, label: "مكافآت V10" },
    ],
  },
  {
    id: "system",
    items: [
      { id: "settings", icon: SettingsIcon, label: "الإعدادات" },
      { id: "moodle", icon: PlugZap, label: "Moodle" },
    ],
  },
];

/**
 * FloatingSideRail v11.0 - شريط جانبي احترافي مع تجميع واضح
 *
 * التجميعات:
 * 1. محتوى (المنهج/الأصول/النوتس)
 * 2. طلاب (الطلاب/الفصول/المجموعات)
 * 3. مكافآت (الجوائز/الهدايا/الأصوات)
 * 4. صوت/احتفال سريع (كتم/احتفال/ألعاب نارية/أصوات)
 * 5. سبورة (dropdown واحد)
 * 6. عرض (أفقي/عمودي/تكبير/تصغير/ملء/Full)
 * 7. نظام (الإعدادات)
 */
export function FloatingSideRail({
  top = 28,
  bottom = 48,
}: {
  top?: number;
  bottom?: number;
}) {
  const router = useRouter();
  const activePanel = useShellStore((s) => s.activePanel);
  const togglePanel = useShellStore((s) => s.togglePanel);
  const setActivePanel = useShellStore((s) => s.setActivePanel);
  const studentsCount = useShellStore((s) => s.students.length);

  const settings = useShellStore((s) => s.settings);
  const activeLessonId = useShellStore((s) => s.activeLessonId);
  const workspaceMode = useShellStore((s) => s.settings.workspaceMode || "landscape");
  const teleprompterWidth = useShellStore((s) => s.settings.teleprompterWidth || 300);
  const teleprompterHeight = useShellStore((s) => s.settings.teleprompterHeight || 150);
  const teacherPrivatePanel = ["ai", "notes", "blueprint", "lesson-editor", "reports", "fairness", "settings", "moodle"].includes(activePanel || "");
  const updateSettings = useShellStore((s) => s.updateSettings);
  const triggerRedFlash = useShellStore((s) => s.triggerRedFlash);
  const triggerGreenFlash = useShellStore((s) => s.triggerGreenFlash);
  const playSound = useShellStore((s) => s.playSound);
  // إزالة dead imports: triggerConfetti و setCelebrationType لم يعودا مستخدمين
  // triggerCelebration يملك الصوت + البانر + الكونفيتي + التسجيل في DB
  const triggerCelebration = useShellStore((s) => s.triggerCelebration);
  const selectedStamp = useShellStore((s) => s.selectedStamp);
  const setSelectedStamp = useShellStore((s) => s.setSelectedStamp);

  const tool = useShellStore((s) => s.whiteboardTool);
  const whiteboardShape = useShellStore((s) => s.whiteboardShape);
  const setWhiteboardTool = useShellStore((s) => s.setWhiteboardTool);
  const clearWhiteboard = useShellStore((s) => s.clearWhiteboard);
  const undoWhiteboard = useShellStore((s) => s.undoWhiteboard);

  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showCelebrationsOverlay, setShowCelebrationsOverlay] = useState(false);
  const iframeDevice = settings.iframeDevice || "desktop";
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    requestAnimationFrame(() => setIsFullscreen(!!document.fullscreenElement));
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const requestFullscreenToggle = useShellStore((s) => s.requestFullscreenToggle);
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const toggleFullscreen = () => {
    requestFullscreenToggle();
  };

  return (
    <>
      <div
        className="fixed right-0 z-[220] flex flex-col gap-0.5 side-panel border-l border-border"
        style={{
          top: `${top}px`,
          bottom: `${bottom}px`,
          width: "52px",
          paddingTop: "4px",
          paddingBottom: "4px",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "thin",
          minHeight: 0, // مهم لـ flexbox
        }}
      >
        {/* ====== Group 1: Content (المنهج/الأصول/النوتس) ====== */}
        {RAIL_GROUPS[0].items.map((item) => (
          <RailButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activePanel === item.id}
            onClick={() => {
              setShowCelebrationsOverlay(false);
              togglePanel(item.id);
            }}
          />
        ))}
        <RailButton
          icon={FileText}
          label="مصنع المناهج"
          active={false}
          onClick={() => router.push("/curriculum-factory")}
        />

        <Divider />

        {/* ====== Group 2: Students (الطلاب/الفصول/المجموعات) ====== */}
        {RAIL_GROUPS[1].items.map((item) => (
          <RailButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activePanel === item.id}
            onClick={() => {
              setShowCelebrationsOverlay(false);
              togglePanel(item.id);
            }}
            badge={item.id === "students" && studentsCount > 0 ? studentsCount : undefined}
          />
        ))}

        <Divider />

        {/* ====== Group 3: Rewards (الجوائز/الهدايا/الأصوات) ====== */}
        {RAIL_GROUPS[2].items.map((item) => (
          <RailButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={item.id === "celebrations" ? showCelebrationsOverlay : activePanel === item.id}
            onClick={() => {
              // إصلاح: زر الاحتفالات يفتح overlay مركزي (مثل الشريط السفلي)
              // بدلاً من القائمة الجانبية
              if (item.id === "celebrations") {
                setShowCelebrationsOverlay(true);
                playSound("click");
              } else {
                setShowCelebrationsOverlay(false);
                togglePanel(item.id);
              }
            }}
          />
        ))}

        <Divider />

        {/* ====== Group 4: Sound/Celebration quick actions ====== */}
        <RailButton
          icon={settings.muted ? VolumeX : Volume2}
          label={settings.muted ? "تشغيل الصوت" : "كتم الصوت"}
          active={settings.muted}
          onClick={() => updateSettings({ muted: !settings.muted })}
          hoverColor="amber"
        />
        <RailButton
          icon={PartyPopper}
          label="احتفال 🎉"
          onClick={() => {
            // triggerCelebration يملك الصوت + البانر + الكونفيتي + التسجيل في DB
            triggerCelebration("confetti");
          }}
          hoverColor="amber"
        />
        <RailButton
          icon={Flame}
          label="ألعاب نارية 🎆"
          onClick={() => {
            triggerCelebration("fireworks");
          }}
          hoverColor="red"
        />

        <Divider />

        {/* ====== Group 5: Whiteboard (dropdown) ====== */}
        <div className="relative">
          <RailButton
            icon={Pen}
            label="أدوات السبورة"
            active={
              tool === "pen" ||
              tool === "highlighter" ||
              tool === "eraser" ||
              tool === "laser" ||
              tool === "text" ||
              tool === "shape" ||
              tool === "arrow" ||
              tool === "check" ||
              tool === "x" ||
              tool === "star"
            }
            onClick={() => setShowToolsMenu(!showToolsMenu)}
          />
          {showToolsMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[250]"
                onClick={() => setShowToolsMenu(false)}
              />
              {/* Dropdown — rendered OUTSIDE the side rail container via portal
                  to escape the z-40 stacking context. Uses same style as floating panels. */}
              {createPortal(
                <div
                  className="fixed z-[260] side-panel rounded-lg p-1 flex flex-col gap-0.5 w-[140px] animate-slide-in-right shadow-2xl"
                  style={{
                    right: "56px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    maxHeight: "calc(100vh - 120px)",
                    overflowY: "auto",
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.3) transparent",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                <DropdownItem
                  icon={Calculator}
                  label="مختبر الرياضيات"
                  onClick={() => {
                    setShowToolsMenu(false);
                    if (!activeLessonId) {
                      import("sonner").then(({ toast }) => toast.info("حمّل درساً أولاً لفتح مختبر الرياضيات"));
                      return;
                    }
                    updateSettings({ whiteboardEnabled: true });
                    window.dispatchEvent(new Event("bisalasa:toggle-math-tools"));
                  }}
                />
                <DropdownItem
                  icon={MousePointer}
                  label="ماوس عادي"
                  active={tool === "select"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("select");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Pen}
                  label="قلم (P)"
                  active={tool === "pen"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("pen");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={CircleDot}
                  label="قلم+ليزر (K)"
                  active={tool === "laserpen"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("laserpen");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Highlighter}
                  label="تظليل (H)"
                  active={tool === "highlighter"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("highlighter");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Eraser}
                  label="ممحاة (E)"
                  active={tool === "eraser"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("eraser");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Eraser}
                  label="ممحاة ×2 (Shift+E)"
                  active={tool === "eraser-big"}
                  color="#fca5a5"
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("eraser-big");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Sparkles}
                  label="قلم قوس قزح (R2)"
                  active={tool === "rainbow"}
                  color="#fbbf24"
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("rainbow");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Zap}
                  label="ليزر (L)"
                  active={tool === "laser"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("laser");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Type}
                  label="نص (T)"
                  active={tool === "text"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("text");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Triangle}
                  label="مثلث (S)"
                  active={tool === "shape" && whiteboardShape === "triangle"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("shape");
                    useShellStore.getState().setWhiteboardShape("triangle");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Circle}
                  label="دائرة (S)"
                  active={tool === "shape" && whiteboardShape === "circle"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("shape");
                    useShellStore.getState().setWhiteboardShape("circle");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Square}
                  label="مربع (S)"
                  active={tool === "shape" && whiteboardShape === "rectangle"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("shape");
                    useShellStore.getState().setWhiteboardShape("rectangle");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={ArrowUpRight}
                  label="سهم (A)"
                  active={tool === "arrow"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("arrow");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Check}
                  label="صح ✓"
                  active={tool === "check"}
                  color="#6ee7b7"
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("check");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={X}
                  label="خطأ ✗"
                  active={tool === "x"}
                  color="#fca5a5"
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("x");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Star}
                  label="نجمة ★"
                  active={tool === "star"}
                  color="#fde047"
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setWhiteboardTool("star");
                    setShowToolsMenu(false);
                  }}
                />

                <div className="h-px bg-border my-0.5" />

                {/* الأختام كأدوات عادية */}
                <div className="text-[9px] text-muted-foreground px-2 py-0.5">أختام</div>
                <DropdownItem
                  icon={Check}
                  label="😊 ابتسامة"
                  active={selectedStamp === "smile-stamp"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setSelectedStamp("smile-stamp");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Star}
                  label="أحسنت!"
                  active={selectedStamp === "bravo"}
                  color="#6ee7b7"
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setSelectedStamp("bravo");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Award}
                  label="ممتاز"
                  active={selectedStamp === "excellent"}
                  color="#60a5fa"
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setSelectedStamp("excellent");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={X}
                  label="خطأ ✗"
                  active={selectedStamp === "wrong"}
                  color="#fca5a5"
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setSelectedStamp("wrong");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Check}
                  label="ختم دائري"
                  active={selectedStamp === "stamp-round"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setSelectedStamp("stamp-round");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Check}
                  label="ختم مستطيل"
                  active={selectedStamp === "stamp-rect"}
                  onClick={() => {
                    updateSettings({ whiteboardEnabled: true });
                    setSelectedStamp("stamp-rect");
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={X}
                  label="إلغاء الختم"
                  color="#fca5a5"
                  onClick={() => {
                    setSelectedStamp(null);
                    setShowToolsMenu(false);
                  }}
                />

                <div className="h-px bg-border my-0.5" />

                <DropdownItem
                  icon={Undo2}
                  label="تراجع (Ctrl+Z)"
                  onClick={() => {
                    undoWhiteboard();
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Undo2}
                  label="إعادة (Ctrl+Y)"
                  onClick={() => {
                    useShellStore.getState().redoWhiteboard();
                    setShowToolsMenu(false);
                  }}
                />
                <DropdownItem
                  icon={Trash2}
                  label="مسح الكل (C)"
                  color="#fca5a5"
                  onClick={async () => {
                    setShowToolsMenu(false);
                    if (await requestConfirm("هل تريد مسح كل الرسم على السبورة؟", { danger: true })) {
                      clearWhiteboard();
                    }
                  }}
                />
                </div>,
                document.body
              )}
            </>
          )}
        </div>

        <Divider />

        {/* ====== Group 6: Display controls ====== */}
        <RailButton
          icon={RectangleHorizontal}
          label="أفقي 16:9"
          active={(settings.iframeOrientation || "landscape") === "landscape"}
          onClick={() => updateSettings({ iframeOrientation: "landscape" })}
        />
        <RailButton
          icon={RectangleVertical}
          label="عمودي 9:16"
          active={settings.iframeOrientation === "portrait"}
          onClick={() => updateSettings({ iframeOrientation: "portrait" })}
        />
        <RailButton
          icon={ZoomIn}
          label="تكبير العرض"
          onClick={() => window.dispatchEvent(new CustomEvent("iframe-resize", { detail: { action: "enlarge" } }))}
        />
        <RailButton
          icon={ZoomOut}
          label="تصغير العرض"
          onClick={() => window.dispatchEvent(new CustomEvent("iframe-resize", { detail: { action: "shrink" } }))}
        />
        <RailButton
          icon={Maximize2}
          label="ملء المساحة"
          onClick={() => window.dispatchEvent(new CustomEvent("iframe-resize", { detail: { action: "fit" } }))}
        />
        <RailButton
          icon={Maximize}
          label="ملء الشاشة (F)"
          active={isFullscreen}
          onClick={toggleFullscreen}
        />
        {/* P9 fix: "app fullscreen" — browser fullscreen WITH all panels visible.
            Unlike the F button (which hides panels for presentation), this
            button keeps every panel/control accessible so the teacher can use
            the full screen real estate during explanation without losing
            access to students/curriculum/games/etc. */}
        <RailButton
          icon={Expand}
          label="ملء المتصفح (كل البانلز)"
          active={!!useShellStore.getState().appFullscreenKeepPanels}
          onClick={() =>
            window.dispatchEvent(new CustomEvent("bisalasa:toggleAppFullscreen"))
          }
        />

        <Divider />

        {/* ====== Group 7: System (الإعدادات وMoodle) ====== */}
        <RailButton
          icon={PlugZap}
          label="Moodle"
          active={activePanel === "moodle"}
          onClick={() => {
            setShowCelebrationsOverlay(false);
            togglePanel("moodle");
          }}
        />
        <RailButton
          icon={SettingsIcon}
          label="الإعدادات"
          active={activePanel === "settings"}
          onClick={() => {
            setShowCelebrationsOverlay(false);
            togglePanel("settings");
          }}
        />
      </div>

      {/* ===== Floating Column Panel (overlay) — 传统 floating panel =====
          Side panels stay as floating columns to the left of the rail.
          z-index = 200 → always above the teleprompter (z-50) and tools dropdown (z-160).
          Scrollable with custom scrollbar. Width = 380px, full height between top and bottom bars.
      */}
      {activePanel && (
        <>
          <div
            className="fixed inset-0 z-[180]"
            onClick={() => setActivePanel(null)}
          />
          <div
            className="fixed z-[200] animate-slide-in-right"
            data-teacher-private={teacherPrivatePanel ? "true" : undefined}
            style={teacherPrivatePanel
              ? {
                  top: `${top}px`,
                  bottom: `${bottom}px`,
                  right: "52px",
                  width: workspaceMode === "landscape" ? `${Math.max(280, Math.min(380, teleprompterWidth))}px` : "min(380px, calc(100vw - 64px))",
                  minHeight: 0,
                }
              : { top: `${top}px`, bottom: `${bottom}px`, right: "52px" }}
          >
            <div
              className="side-panel rounded-xl w-[380px] max-w-[calc(100vw-64px)] h-full min-h-0 flex flex-col overflow-hidden shadow-2xl"
              style={{ maxHeight: "100%" }}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-primary/10 shrink-0">
                <h3 className="text-sm font-bold text-primary">
                  {[...RAIL_GROUPS[0].items, ...RAIL_GROUPS[1].items, ...RAIL_GROUPS[2].items, ...RAIL_GROUPS[3].items].find((i) => i.id === activePanel)?.label}
                </h3>
                <button
                  onClick={() => setActivePanel(null)}
                  className="mini-icon-btn hover:bg-accent/20 hover:text-accent"
                  title="إغلاق"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div
                className="flex-1 min-h-0 overflow-y-auto"
                data-panel-scroll-host="true"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(255,255,255,0.2) transparent",
                }}
              >
                <PanelErrorBoundary panelId={activePanel ?? "unknown"} onClose={() => setActivePanel(null)}>
                  {activePanel === "curriculum" && <CurriculumPanel />}
                  {activePanel === "students" && <StudentsPanel />}
                  {activePanel === "classes" && <ClassesPanel />}
                  {activePanel === "groups" && <GroupsPanel />}
                  {activePanel === "prizes" && <PrizesPanel />}
                  {activePanel === "gifts" && <GiftsPanel />}
                  {activePanel === "sounds" && <SoundsPanel />}
                  {/* إصلاح: الاحتفالات تفتح كـ overlay مركزي، ليس في القائمة الجانبية */}
                  {activePanel === "blueprint" && <LessonBlueprint />}
                  {activePanel === "lesson-editor" && <LessonEditorPanel />}
                  {activePanel === "ai" && <AiPanel />}
                  {activePanel === "reports" && <ReportsPanel />}
                  {activePanel === "fairness" && <LessonFairnessPanel />}
                  {activePanel === "rewards-v10" && <RewardsV10Panel />}
                  {activePanel === "quickgift" && <QuickGiftPanel onClose={() => useShellStore.getState().togglePanel(null)} />}
                  {activePanel === "assets" && <AssetsPanel />}
                  {activePanel === "notes" && <NotesPanel />}
                  {activePanel === "settings" && <SettingsPanel />}
                  {activePanel === "moodle" && <MoodlePanel />}
                </PanelErrorBoundary>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ====== احتفالات مركزي (overlay في منتصف الصفحة) ====== */}
      {showCelebrationsOverlay && (
        <CelebrationsPanel onClose={() => setShowCelebrationsOverlay(false)} />
      )}
    </>
  );
}

// ====================================================================
//  RailButton - زر شريط جانبي مع tooltip
// ====================================================================
function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
  hoverColor,
}: {
  icon: typeof BookOpen;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
  hoverColor?: "amber" | "red" | "green" | "blue";
}) {
  const hoverColorClass =
    hoverColor === "amber"
      ? "hover:bg-amber-500/20 hover:text-amber-400"
      : hoverColor === "red"
      ? "hover:bg-red-500/20 hover:text-red-400"
      : hoverColor === "green"
      ? "hover:bg-green-500/20 hover:text-green-400"
      : hoverColor === "blue"
      ? "hover:bg-blue-500/20 hover:text-blue-400"
      : "";

  return (
    <button
      onClick={onClick}
      className={cn("rail-icon-btn relative group shrink-0", active && "active", hoverColorClass)}
      title={label}
    >
      <Icon className="w-4 h-4" />
      <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-0.5 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-border">
        {label}
      </span>
      {badge !== undefined && (
        <span className="absolute -top-1 -left-1 bg-accent text-accent-foreground text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-1">
          {badge}
        </span>
      )}
    </button>
  );
}

function Divider() {
  return <div className="w-full h-px bg-border my-0.5 shrink-0" />;
}

function DropdownItem({
  icon: Icon,
  label,
  active,
  onClick,
  color,
}: {
  icon: typeof BookOpen;
  label: string;
  active?: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors w-full text-right",
        active ? "bg-primary text-primary-foreground" : "hover:bg-accent/10 text-foreground"
      )}
      title={label}
      style={color && !active ? { color } : undefined}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
