"use client";

// ====================================================================
//  StudentViewMode.tsx — P2-15: وضع معاينة الطالب
//
//  يعرض الدرس بنفس الطريقة التي يراه بها الطالب في العرض/الشاشة الكبيرة:
//    • الشريحة في modal fullscreen تملأ الشاشة تقريباً
//    • بدون Teleprompter / SideRail / BottomControlBar
//    • فقط أزرار تنقل أساسية (السابق/التالي) + زر الخروج
//    • يقرأ الـ manifest الحالي مباشرة ويستخدم نفس قناة postMessage
//      (GOTO_STEP) التي يستخدمها IframeStage للمزامنة.
//
//  ملاحظة: هذا المعاينة فقط. لا تعيد توجيه التفاعل، ولا تعرض بيانات
//  الطلاب الحساسة، ولا تبدّل الجلسة.
// ====================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useShellStore } from "@/lib/shell-store";
import type { ShellToSlideMessage, SlideToShellMessage } from "@/lib/slide-schema";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, X, Eye, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// نفس أنماط العرض المقبولة التي في IframeStage — الحفاظ على اتساق الواجهة
const STAGE_ASPECT = "16/9";

/**
 * StudentViewMode — overlay fullscreen يعرض الدرس كما يراه الطالب.
 *
 * ملاحظة هندسية: لا نتيح هذا الوضع إلا عند توفر manifest، لأن عرض محتوى
 * الدرس الحقيقي داخل modal أعمق سيكبّر المخاطر (سبورة، طبقات). الوضع هنا
 * يقرأ الحالة فقط ويقود التنقل خطوة بخطوة من خلال postMessage.
 */
export function StudentViewMode() {
  const [open, setOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const manifest = useShellStore((s) => s.manifest);
  const currentStep = useShellStore((s) => s.currentStep);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  const goToStep = useShellStore((s) => s.goToStep);
  const nextStep = useShellStore((s) => s.nextStep);
  const prevStep = useShellStore((s) => s.prevStep);

  const activeLesson = useShellStore((s) =>
    s.lessons.find((l) => l.id === s.activeLessonId)
  );

  const steps = manifest
    ? currentIdeaId && manifest.ideas
      ? manifest.ideas.find((i) => i.id === currentIdeaId)?.steps ?? []
      : manifest.steps ?? []
    : [];
  const totalSteps = steps.length || manifest?.totalSteps || 0;
  const currentStepData = steps[currentStep - 1] ?? steps[0];
  // نرجّع قيمة currentStepData في JSX فقط لمنع "unused variable" لينتر
  void currentStepData;

  // ========== postMessage bridge (نفس أنماط IframeStage) ==========
  const sendMessage = useCallback((msg: ShellToSlideMessage) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(msg, window.location.origin);
    } catch (e) {
      console.warn("[StudentView] postMessage failed:", e);
    }
  }, []);

  // عند الفتح نطلب الـ manifest حتى نتزامن مع الدرس إذا فُتح بدون أن يكون
  // المشهد الرئيسي قد فتح بعد
  useEffect(() => {
    if (!open || !activeLesson) return;
    // مهلة قصيرة ثم request manifest (الدرس يرد تلقائياً برسالة READY)
    const t = setTimeout(() => {
      sendMessage({ type: "REQUEST_MANIFEST" });
    }, 250);
    return () => clearTimeout(t);
  }, [open, activeLesson, sendMessage]);

  // نسمع رسائل الدرس ونحدّث الخطوة في المتجر حتى تظل المعاينة متزامنة
  useEffect(() => {
    if (!open) return;
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as SlideToShellMessage;
      if (!data || typeof data !== "object" || !data.type) return;
      switch (data.type) {
        case "MANIFEST":
          // manifest الموجود داخل iframe يصل إلينا — ننضم إليه
          useShellStore.getState().setManifest(data.payload);
          break;
        case "STEP_CHANGED":
          goToStep(data.step, data.ideaId);
          break;
        case "REQUEST_SOUND":
          useShellStore.getState().playSound(data.sound);
          break;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [open, goToStep]);

  // مزامنة التنقل: عندما يتغير currentStep من أزرار المعاينة
  useEffect(() => {
    if (!open || !activeLesson) return;
    sendMessage({ type: "GOTO_STEP", step: currentStep, ideaId: currentIdeaId || undefined });
  }, [open, currentStep, currentIdeaId, activeLesson, sendMessage]);

  // اقفل بمفتاح Escape أيضاً
  useEffect(() => {
    if (!open) return;
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [open]);

  // لا نعرض الزر إلا إذا كان هناك manifest حقيقي (شيء يُرسل للطالب)
  if (!manifest || !activeLesson) {
    return (
      <button
        className="tool-btn text-white/50 cursor-not-allowed opacity-50"
        title="حمّل درساً أولاً لاستخدام معاينة الطالب"
        disabled={true}
      >
        <Eye className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <>
      {/* زر التشغيل في الشريط العلوي — يفتح المعاينة في fullscreen */}
      <button
        onClick={() => window.open(`${window.location.pathname}?view=student`, "_blank", "noopener,noreferrer")}
        className="tool-btn border border-emerald-400/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200"
        title="فتح مشهد OBS الطلابي — بدون بانلات المدرس"
        aria-label="فتح مشهد OBS الطلابي"
      >
        <MonitorPlay className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => setOpen(true)}
        className={cn(
          "tool-btn border border-white/10 bg-white/5 hover:bg-white/10 text-white/80",
          open && "bg-cyan-600/40 border-cyan-400/50"
        )}
        title="معاينة الطالب — عرض الدرس كما يظهر له بدون واجهة المعلم"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>

      {/* الشاشة الكاملة عند التفعيل */}
      {open && (
        <div
          className="fixed inset-0 z-[220] bg-black/95 backdrop-blur flex flex-col"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="وضع معاينة الطالب"
        >
          {/* Header رشيق جداً — بدون أطراف تشتت انتباه الطالب */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/70 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="text-xs text-white/70 truncate">
                معاينة الطالب — {manifest.title ?? "درس"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/50">
                {currentStep} / {totalSteps}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="text-white/60 hover:text-white h-7 w-7 p-0"
                title="خروج من معاينة الطالب (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* مساحة العرض — نفس نسبة الستيج */}
          <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
            <div
              className="w-full rounded-lg overflow-hidden shadow-2xl"
              style={{
                aspectRatio: STAGE_ASPECT,
                maxWidth: "100%",
                maxHeight: "100%",
              }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={activeLesson.content}
                title={`معاينة الطالب: ${activeLesson.title}`}
                className="w-full h-full border-0 bg-white"
                // نفس sandbox IframeStage لأمان متسق مع البيئة الرئيسية
                sandbox="allow-scripts allow-same-origin allow-forms"
                allow="accelerometer; autoplay; camera; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; clipboard-read; clipboard-write; display-capture; picture-in-picture"
              />
            </div>
          </div>

          {/* Footer تنقل بسيط جداً */}
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900/70 border-t border-white/10">
            <button
              onClick={prevStep}
              disabled={currentStep <= 1}
              className={cn(
                "tool-btn border border-white/10 bg-white/5 hover:bg-white/10",
                currentStep <= 1 && "opacity-40 cursor-not-allowed"
              )}
              title="الخطوة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-[10px] text-white/60 min-w-[60px] text-center">
              خطوة {currentStep} من {totalSteps || "—"}
            </div>
            <button
              onClick={nextStep}
              disabled={totalSteps > 0 && currentStep >= totalSteps}
              className={cn(
                "tool-btn border border-white/10 bg-white/5 hover:bg-white/10",
                totalSteps > 0 && currentStep >= totalSteps && "opacity-40 cursor-not-allowed"
              )}
              title="الخطوة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * زر standalone صغير للحقن في TopBar (لا يحتاج تفصيل list/manifest داخله)
 * يُركّب فقط عندما يكون الـ manifest موجوداً (لتفادي أخطاء Hydration المبكرة).
 */
export function StudentViewToggleButton() {
  return <StudentViewMode />;
}
